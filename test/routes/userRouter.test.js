const request = require("supertest");
const app = require("../../src/service");
const { Role, DB } = require("../../src/database/database.js");
const {
  generateRandomString,
  expectValidJwt,
  createUserWithRole,
} = require("../testHelper");

describe("User Router", () => {
  let adminUser;
  let regularUser;
  let otherUser;

  beforeAll(async () => {
    // Wait for database to be ready
    await DB.initialized;

    // Create users
    adminUser = await createUserWithRole(app, Role.Admin);
    regularUser = await createUserWithRole(app, Role.Diner);
    otherUser = await createUserWithRole(app, Role.Diner);
  });

  describe("GET /api/user/me", () => {
    test("should get authenticated user info", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${regularUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id", regularUser.id);
      expect(res.body).toHaveProperty("name", regularUser.name);
      expect(res.body).toHaveProperty("email", regularUser.email);
      expect(res.body).toHaveProperty("roles");
      expect(Array.isArray(res.body.roles)).toBe(true);
      expect(res.body).not.toHaveProperty("password");
    });

    test("should get admin user info", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id", adminUser.id);
      expect(res.body).toHaveProperty("name", adminUser.name);
      expect(res.body).toHaveProperty("email", adminUser.email);
      expect(res.body.roles).toContainEqual({ role: Role.Admin });
    });

    test("should fail without authentication", async () => {
      const res = await request(app).get("/api/user/me");

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("unauthorized");
    });

    test("should fail with invalid token", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", "Bearer invalid.token.here");

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("unauthorized");
    });
  });

  describe("PUT /api/user/:userId", () => {
    test("should update own user name", async () => {
      const newName = generateRandomString();
      const res = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .set("Authorization", `Bearer ${regularUser.token}`)
        .send({
          name: newName,
          email: regularUser.email,
          password: regularUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.name).toBe(newName);
      expect(res.body.user.email).toBe(regularUser.email);
      expect(res.body.user).not.toHaveProperty("password");
      expectValidJwt(res.body.token);

      // Update local user data for subsequent tests
      regularUser.name = newName;
      regularUser.token = res.body.token;
    });

    test("should update own user email", async () => {
      const newEmail = `${generateRandomString()}@test.com`;
      const res = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .set("Authorization", `Bearer ${regularUser.token}`)
        .send({
          name: regularUser.name,
          email: newEmail,
          password: regularUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(newEmail);
      expectValidJwt(res.body.token);

      // Update local user data
      regularUser.email = newEmail;
      regularUser.token = res.body.token;
    });

    test("should update own user password", async () => {
      const newPassword = generateRandomString();
      const res = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .set("Authorization", `Bearer ${regularUser.token}`)
        .send({
          name: regularUser.name,
          email: regularUser.email,
          password: newPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expectValidJwt(res.body.token);

      // Verify new password works
      const loginRes = await request(app).put("/api/auth").send({
        email: regularUser.email,
        password: newPassword,
      });

      expect(loginRes.status).toBe(200);
      regularUser.password = newPassword;
      regularUser.token = loginRes.body.token;
    });

    test("should update multiple fields at once", async () => {
      const newName = generateRandomString();
      const newEmail = `${generateRandomString()}@test.com`;
      const newPassword = generateRandomString();

      const res = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .set("Authorization", `Bearer ${regularUser.token}`)
        .send({
          name: newName,
          email: newEmail,
          password: newPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe(newName);
      expect(res.body.user.email).toBe(newEmail);
      expectValidJwt(res.body.token);

      // Update local user data
      regularUser.name = newName;
      regularUser.email = newEmail;
      regularUser.password = newPassword;
      regularUser.token = res.body.token;
    });

    test("should allow admin to update other users", async () => {
      const newName = generateRandomString();
      const res = await request(app)
        .put(`/api/user/${otherUser.id}`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          name: newName,
          email: otherUser.email,
          password: otherUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe(newName);
      expect(res.body.user.id).toBe(otherUser.id);
    });

    test("should prevent non-admin from updating other users", async () => {
      const res = await request(app)
        .put(`/api/user/${otherUser.id}`)
        .set("Authorization", `Bearer ${regularUser.token}`)
        .send({
          name: generateRandomString(),
          email: otherUser.email,
          password: otherUser.password,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("unauthorized");
    });

    test("should fail without authentication", async () => {
      const res = await request(app).put(`/api/user/${regularUser.id}`).send({
        name: generateRandomString(),
        email: regularUser.email,
        password: regularUser.password,
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("unauthorized");
    });

    test("should return new token after update", async () => {
      const oldToken = regularUser.token;
      const res = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .set("Authorization", `Bearer ${regularUser.token}`)
        .send({
          name: generateRandomString(),
          email: regularUser.email,
          password: regularUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.token).not.toBe(oldToken);
      expectValidJwt(res.body.token);
    });
  });

  describe("DELETE /api/user/:userId", () => {
    test("should return not implemented", async () => {
      const res = await request(app)
        .delete(`/api/user/${regularUser.id}`)
        .set("Authorization", `Bearer ${regularUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("not implemented");
    });

    test("should require authentication", async () => {
      const res = await request(app).delete(`/api/user/${regularUser.id}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("unauthorized");
    });
  });

  describe("GET /api/user", () => {
    test("should return not implemented", async () => {
      const res = await request(app)
        .get("/api/user")
        .set("Authorization", `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("not implemented");
      expect(res.body).toHaveProperty("users");
      expect(res.body).toHaveProperty("more");
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users).toEqual([]);
      expect(res.body.more).toBe(false);
    });

    test("should require authentication", async () => {
      const res = await request(app).get("/api/user");

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("unauthorized");
    });

    test("should be accessible by regular users", async () => {
      const res = await request(app)
        .get("/api/user")
        .set("Authorization", `Bearer ${regularUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("not implemented");
    });
  });
});
