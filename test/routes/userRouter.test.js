const request = require("supertest");
const app = require("../../src/service");
const { Role, DB } = require("../../src/database/database.js");
const {
  generateRandomString,
  expectValidJwt,
  createUserWithRole,
  fixtures,
} = require("../testHelper");

describe("User Router", () => {
  // Shared persistent users — never mutated after initialization
  let adminUser;
  let otherUser;

  beforeAll(async () => {
    await DB.initialized;

    // Log in as the seeded admin and diner using fixture credentials
    const adminLogin = await request(app).put("/api/auth").send({
      email: fixtures.admin.email,
      password: fixtures.admin.password,
    });
    adminUser = { ...adminLogin.body.user, token: adminLogin.body.token };

    // otherUser is an extra diner for cross-user authorization tests
    otherUser = await createUserWithRole(app, Role.Diner);
  });

  // ── GET /api/user/me ───────────────────────────────────────────────────────

  describe("GET /api/user/me", () => {
    test("returns authenticated user info without password", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id", adminUser.id);
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("email");
      expect(res.body).not.toHaveProperty("password");
    });

    test("roles include the admin role for admin users", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.roles).toContainEqual({ role: Role.Admin });
    });

    test("returns 401 without a token", async () => {
      const res = await request(app).get("/api/user/me");
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("unauthorized");
    });

    test("returns 401 with a malformed token", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", "Bearer not.a.valid.jwt");
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/user/:userId ──────────────────────────────────────────────────
  //
  // Each test gets a fresh user to prevent shared-state coupling.

  describe("PUT /api/user/:userId", () => {
    let user; // re-created before each test

    beforeEach(async () => {
      user = await createUserWithRole(app, Role.Diner);
    });

    test("user can update their own name", async () => {
      const newName = generateRandomString();
      const res = await request(app)
        .put(`/api/user/${user.id}`)
        .set("Authorization", `Bearer ${user.token}`)
        .send({ name: newName, email: user.email, password: user.password });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe(newName);
      expect(res.body.user).not.toHaveProperty("password");
      expectValidJwt(res.body.token);
    });

    test("user can update their own email", async () => {
      const newEmail = `${generateRandomString()}@test.com`;
      const res = await request(app)
        .put(`/api/user/${user.id}`)
        .set("Authorization", `Bearer ${user.token}`)
        .send({ name: user.name, email: newEmail, password: user.password });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(newEmail);
    });

    test("user can update their own password and log in with it", async () => {
      const newPassword = generateRandomString();
      const updateRes = await request(app)
        .put(`/api/user/${user.id}`)
        .set("Authorization", `Bearer ${user.token}`)
        .send({ name: user.name, email: user.email, password: newPassword });
      expect(updateRes.status).toBe(200);

      const loginRes = await request(app)
        .put("/api/auth")
        .send({ email: user.email, password: newPassword });
      expect(loginRes.status).toBe(200);
      expectValidJwt(loginRes.body.token);
    });

    test("response token changes after update", async () => {
      const oldToken = user.token;
      const res = await request(app)
        .put(`/api/user/${user.id}`)
        .set("Authorization", `Bearer ${oldToken}`)
        .send({
          name: generateRandomString(),
          email: user.email,
          password: user.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).not.toBe(oldToken);
      expectValidJwt(res.body.token);
    });

    test("admin can update a different user", async () => {
      const newName = generateRandomString();
      const res = await request(app)
        .put(`/api/user/${user.id}`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({ name: newName, email: user.email, password: user.password });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe(newName);
    });

    test("non-admin cannot update another user (403)", async () => {
      const res = await request(app)
        .put(`/api/user/${otherUser.id}`)
        .set("Authorization", `Bearer ${user.token}`)
        .send({
          name: generateRandomString(),
          email: otherUser.email,
          password: otherUser.password,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("unauthorized");
    });

    test("returns 401 without a token", async () => {
      const res = await request(app).put(`/api/user/${user.id}`).send({
        name: generateRandomString(),
        email: user.email,
        password: user.password,
      });
      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/user/:userId ───────────────────────────────────────────────

  describe("DELETE /api/user/:userId", () => {
    test("user can delete their own account", async () => {
      const target = await createUserWithRole(app, Role.Diner);
      const res = await request(app)
        .delete(`/api/user/${target.id}`)
        .set("Authorization", `Bearer ${target.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("user deleted");
    });

    test("deleted user cannot log in again", async () => {
      const target = await createUserWithRole(app, Role.Diner);
      await request(app)
        .delete(`/api/user/${target.id}`)
        .set("Authorization", `Bearer ${target.token}`);

      const loginRes = await request(app)
        .put("/api/auth")
        .send({ email: target.email, password: target.password });
      expect(loginRes.status).toBe(404);
    });

    test("deleted user's token is immediately invalidated", async () => {
      const target = await createUserWithRole(app, Role.Diner);
      const oldToken = target.token;
      await request(app)
        .delete(`/api/user/${target.id}`)
        .set("Authorization", `Bearer ${oldToken}`);

      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${oldToken}`);
      expect(res.status).toBe(401);
    });

    test("admin can delete another user", async () => {
      const target = await createUserWithRole(app, Role.Diner);
      const res = await request(app)
        .delete(`/api/user/${target.id}`)
        .set("Authorization", `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("user deleted");
    });

    test("non-admin cannot delete another user (403)", async () => {
      const res = await request(app)
        .delete(`/api/user/${otherUser.id}`)
        .set("Authorization", `Bearer ${otherUser.token}`);

      // otherUser trying to delete otherUser is fine; they're the same user
      // Use a separate user to test the 403 path
      const requester = await createUserWithRole(app, Role.Diner);
      const forbidden = await request(app)
        .delete(`/api/user/${otherUser.id}`)
        .set("Authorization", `Bearer ${requester.token}`);
      expect(forbidden.status).toBe(403);
    });

    test("returns 401 without a token", async () => {
      const res = await request(app).delete(`/api/user/${otherUser.id}`);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/user ──────────────────────────────────────────────────────────

  describe("GET /api/user", () => {
    test("returns a users array for authenticated users", async () => {
      const res = await request(app)
        .get("/api/user")
        .set("Authorization", `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("users");
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBeGreaterThan(0);
    });

    test("pagination — limit parameter is respected", async () => {
      const res = await request(app)
        .get("/api/user?page=1&limit=5")
        .set("Authorization", `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.users.length).toBeLessThanOrEqual(5);
    });

    test("name filter narrows results", async () => {
      const res = await request(app)
        .get("/api/user?name=Bulk+User")
        .set("Authorization", `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      res.body.users.forEach((u) => expect(u.name).toMatch(/Bulk User/));
    });

    test("regular users can access the list", async () => {
      const diner = await createUserWithRole(app, Role.Diner);
      const res = await request(app)
        .get("/api/user")
        .set("Authorization", `Bearer ${diner.token}`);
      expect(res.status).toBe(200);
    });

    test("returns 401 without a token", async () => {
      const res = await request(app).get("/api/user");
      expect(res.status).toBe(401);
    });
  });
});
