const request = require("supertest");
const app = require("../../src/service");
const { expectValidJwt, fixtures } = require("../testHelper");

// Full auth-flow coverage: register → login → use token → logout → token rejected
describe("Auth Router", () => {
  // Use a per-run unique email to avoid conflicts across test reruns
  const timestamp = Date.now();
  const testUser = {
    name: "Auth Test User",
    email: `authtest-${timestamp}@test.com`,
    password: "testpass123",
  };
  let authToken;

  // ── Registration (POST /api/auth) ─────────────────────────────────────────

  describe("POST /api/auth (register)", () => {
    test("registers a new user and returns a valid JWT", async () => {
      const res = await request(app).post("/api/auth").send(testUser);

      expect(res.status).toBe(200);
      expectValidJwt(res.body.token);
      expect(res.body.user).toHaveProperty("id");
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.name).toBe(testUser.name);
      expect(res.body.user).not.toHaveProperty("password");

      authToken = res.body.token; // reuse in later tests
    });

    test("returns 409 when email is already registered", async () => {
      const res = await request(app).post("/api/auth").send(testUser);
      expect(res.status).toBe(409);
    });
  });

  // ── Login (PUT /api/auth) ──────────────────────────────────────────────────

  describe("PUT /api/auth (login)", () => {
    test("logs in with correct credentials", async () => {
      const res = await request(app).put("/api/auth").send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(res.status).toBe(200);
      expectValidJwt(res.body.token);
      expect(res.body.user.email).toBe(testUser.email);
    });

    test("returns 404 with wrong password", async () => {
      const res = await request(app).put("/api/auth").send({
        email: testUser.email,
        password: "wrongpassword",
      });
      expect(res.status).toBe(404);
    });

    test("returns 404 for unknown email", async () => {
      const res = await request(app).put("/api/auth").send({
        email: "nobody@nowhere.test",
        password: "whatever",
      });
      expect(res.status).toBe(404);
    });

    test("seeded diner can log in with fixture credentials", async () => {
      const res = await request(app).put("/api/auth").send({
        email: fixtures.diner.email,
        password: fixtures.diner.password,
      });
      expect(res.status).toBe(200);
      expectValidJwt(res.body.token);
    });

    test("seeded admin can log in with fixture credentials", async () => {
      const res = await request(app).put("/api/auth").send({
        email: fixtures.admin.email,
        password: fixtures.admin.password,
      });
      expect(res.status).toBe(200);
      expectValidJwt(res.body.token);
    });
  });

  // ── Logout (DELETE /api/auth) ─────────────────────────────────────────────

  describe("DELETE /api/auth (logout)", () => {
    test("requires authentication", async () => {
      const res = await request(app).delete("/api/auth");
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("unauthorized");
    });

    test("logs out successfully and returns confirmation", async () => {
      const res = await request(app)
        .delete("/api/auth")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("logout successful");
    });

    test("token is rejected after logout", async () => {
      // authToken was invalidated in the previous test
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(401);
    });
  });
});
