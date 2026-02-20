const request = require("supertest");
const app = require("../../src/service");
const { Role, DB } = require("../../src/database/database.js");
const {
  generateRandomString,
  createUserWithRole,
  fixtures,
  seedTestDatabase,
} = require("../testHelper");

describe("Franchise Router", () => {
  let adminUser;
  let franchiseeUser;
  let regularUser;
  // Use a seeded franchise for read-only tests to avoid per-test DB writes
  let seededFranchise;

  beforeAll(async () => {
    await DB.initialized;

    // Log in as the seeded admin — avoids creating an extra user
    const adminLogin = await request(app).put("/api/auth").send({
      email: fixtures.admin.email,
      password: fixtures.admin.password,
    });
    adminUser = { ...adminLogin.body.user, token: adminLogin.body.token };

    regularUser = await createUserWithRole(app, Role.Diner);
    franchiseeUser = await createUserWithRole(app, Role.Diner);

    // Create a dedicated franchise for this test run
    const franchiseRes = await request(app)
      .post("/api/franchise")
      .set("Authorization", `Bearer ${adminUser.token}`)
      .send({
        name: generateRandomString(),
        admins: [{ email: franchiseeUser.email }],
      });
    seededFranchise = franchiseRes.body;
  });

  // ── GET /api/franchise ────────────────────────────────────────────────────

  describe("GET /api/franchise", () => {
    test("is publicly accessible and returns franchises + more flag", async () => {
      const res = await request(app).get("/api/franchise");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("franchises");
      expect(res.body).toHaveProperty("more");
      expect(Array.isArray(res.body.franchises)).toBe(true);
      expect(typeof res.body.more).toBe("boolean");
    });

    test("pagination limit is respected", async () => {
      const res = await request(app).get("/api/franchise?page=0&limit=3");
      expect(res.status).toBe(200);
      expect(res.body.franchises.length).toBeLessThanOrEqual(3);
    });

    test("name filter narrows results", async () => {
      const res = await request(app).get(
        `/api/franchise?name=${encodeURIComponent(seededFranchise.name)}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.franchises.length).toBeGreaterThanOrEqual(1);
      expect(res.body.franchises[0].name).toBe(seededFranchise.name);
    });

    test("unauthenticated response includes id, name, and stores", async () => {
      const res = await request(app).get("/api/franchise");
      expect(res.status).toBe(200);
      if (res.body.franchises.length > 0) {
        const f = res.body.franchises[0];
        expect(f).toHaveProperty("id");
        expect(f).toHaveProperty("name");
        expect(f).toHaveProperty("stores");
      }
    });

    test("admin response includes revenue data", async () => {
      const res = await request(app)
        .get("/api/franchise")
        .set("Authorization", `Bearer ${adminUser.token}`);
      expect(res.status).toBe(200);
      if (
        res.body.franchises.length > 0 &&
        res.body.franchises[0].stores.length > 0
      ) {
        expect(res.body.franchises[0].stores[0]).toHaveProperty("totalRevenue");
      }
    });
  });

  // ── GET /api/franchise/:userId ─────────────────────────────────────────────

  describe("GET /api/franchise/:userId", () => {
    test("franchisee can view their own franchises", async () => {
      const res = await request(app)
        .get(`/api/franchise/${franchiseeUser.id}`)
        .set("Authorization", `Bearer ${franchiseeUser.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].name).toBe(seededFranchise.name);
    });

    test("admin can view any user's franchises", async () => {
      const res = await request(app)
        .get(`/api/franchise/${franchiseeUser.id}`)
        .set("Authorization", `Bearer ${adminUser.token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("user with no franchises gets empty array", async () => {
      const res = await request(app)
        .get(`/api/franchise/${regularUser.id}`)
        .set("Authorization", `Bearer ${regularUser.token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test("non-admin cannot view another user's franchises", async () => {
      const res = await request(app)
        .get(`/api/franchise/${franchiseeUser.id}`)
        .set("Authorization", `Bearer ${regularUser.token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]); // access denied silently returns empty
    });

    test("returns 401 without authentication", async () => {
      const res = await request(app).get(`/api/franchise/${franchiseeUser.id}`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/franchise ────────────────────────────────────────────────────

  describe("POST /api/franchise", () => {
    test("admin creates a franchise and it includes id and admins", async () => {
      const newFranchise = {
        name: generateRandomString(),
        admins: [{ email: franchiseeUser.email }],
      };
      const res = await request(app)
        .post("/api/franchise")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send(newFranchise);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body.name).toBe(newFranchise.name);
      expect(res.body.admins).toHaveLength(1);
      expect(res.body.admins[0].email).toBe(franchiseeUser.email);
    });

    test("creates franchise with multiple admins", async () => {
      const res = await request(app)
        .post("/api/franchise")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          name: generateRandomString(),
          admins: [
            { email: franchiseeUser.email },
            { email: regularUser.email },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.admins).toHaveLength(2);
    });

    test("non-admin gets 403", async () => {
      const res = await request(app)
        .post("/api/franchise")
        .set("Authorization", `Bearer ${regularUser.token}`)
        .send({ name: generateRandomString(), admins: [] });
      expect(res.status).toBe(403);
    });

    test("returns 401 without authentication", async () => {
      const res = await request(app)
        .post("/api/franchise")
        .send({ name: generateRandomString(), admins: [] });
      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/franchise/:franchiseId ────────────────────────────────────

  describe("DELETE /api/franchise/:franchiseId", () => {
    test("admin can delete a franchise", async () => {
      const createRes = await request(app)
        .post("/api/franchise")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          name: generateRandomString(),
          admins: [{ email: franchiseeUser.email }],
        });
      const franchiseId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/franchise/${franchiseId}`)
        .set("Authorization", `Bearer ${adminUser.token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("franchise deleted");
    });

    test("deletion cascades — franchise no longer appears in list", async () => {
      const name = generateRandomString();
      const createRes = await request(app)
        .post("/api/franchise")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({ name, admins: [{ email: franchiseeUser.email }] });
      const franchiseId = createRes.body.id;

      await request(app)
        .delete(`/api/franchise/${franchiseId}`)
        .set("Authorization", `Bearer ${adminUser.token}`);

      const listRes = await request(app).get(`/api/franchise?name=${name}`);
      expect(listRes.body.franchises.length).toBe(0);
    });

    test("non-admin gets 403", async () => {
      const res = await request(app)
        .delete(`/api/franchise/${seededFranchise.id}`)
        .set("Authorization", `Bearer ${regularUser.token}`);
      expect(res.status).toBe(403);
    });

    test("returns 401 without authentication", async () => {
      const res = await request(app).delete(
        `/api/franchise/${seededFranchise.id}`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/franchise/:franchiseId/store ────────────────────────────────

  describe("POST /api/franchise/:franchiseId/store", () => {
    test("franchise admin can create a store", async () => {
      const res = await request(app)
        .post(`/api/franchise/${seededFranchise.id}/store`)
        .set("Authorization", `Bearer ${franchiseeUser.token}`)
        .send({ name: generateRandomString() });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body.franchiseId).toBe(seededFranchise.id);
    });

    test("system admin can create a store", async () => {
      const res = await request(app)
        .post(`/api/franchise/${seededFranchise.id}/store`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({ name: generateRandomString() });
      expect(res.status).toBe(200);
    });

    test("non-franchisee gets 403", async () => {
      const res = await request(app)
        .post(`/api/franchise/${seededFranchise.id}/store`)
        .set("Authorization", `Bearer ${regularUser.token}`)
        .send({ name: generateRandomString() });
      expect(res.status).toBe(403);
    });

    test("returns 401 without authentication", async () => {
      const res = await request(app)
        .post(`/api/franchise/${seededFranchise.id}/store`)
        .send({ name: generateRandomString() });
      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/franchise/:franchiseId/store/:storeId ────────────────────

  describe("DELETE /api/franchise/:franchiseId/store/:storeId", () => {
    let store;

    beforeEach(async () => {
      store = await DB.createStore(seededFranchise.id, {
        name: generateRandomString(),
      });
    });

    test("franchise admin can delete a store", async () => {
      const res = await request(app)
        .delete(`/api/franchise/${seededFranchise.id}/store/${store.id}`)
        .set("Authorization", `Bearer ${franchiseeUser.token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("store deleted");
    });

    test("system admin can delete a store", async () => {
      const res = await request(app)
        .delete(`/api/franchise/${seededFranchise.id}/store/${store.id}`)
        .set("Authorization", `Bearer ${adminUser.token}`);
      expect(res.status).toBe(200);
    });

    test("non-franchisee gets 403", async () => {
      const res = await request(app)
        .delete(`/api/franchise/${seededFranchise.id}/store/${store.id}`)
        .set("Authorization", `Bearer ${regularUser.token}`);
      expect(res.status).toBe(403);
    });

    test("returns 401 without authentication", async () => {
      const res = await request(app).delete(
        `/api/franchise/${seededFranchise.id}/store/${store.id}`,
      );
      expect(res.status).toBe(401);
    });
  });
});
