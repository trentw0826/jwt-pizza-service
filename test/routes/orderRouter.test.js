const request = require("supertest");
const app = require("../../src/service");
const { Role, DB } = require("../../src/database/database.js");
const {
  createUserWithRole,
  generateRandomString,
  fixtures,
} = require("../testHelper");

// ---------------------------------------------------------------------------
// Factory mock helper — avoids copy-pasting fetch mocks across tests
// ---------------------------------------------------------------------------

function mockFactory({
  ok = true,
  jwt = "factory.jwt.token",
  reportUrl = "https://pizza-factory.cs329.click/api/order/verify/ok",
} = {}) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok,
      json: () =>
        Promise.resolve(
          ok
            ? { jwt, reportUrl }
            : { message: "Factory unavailable", reportUrl },
        ),
    }),
  );
}

afterEach(() => {
  if (global.fetch?.mockRestore) global.fetch.mockRestore();
  if (global.fetch?.mockClear) global.fetch.mockClear();
});

describe("Order Router", () => {
  let testUser;
  let adminUser;
  // Use the seeded franchise/store/menu items — no extra beforeAll DB writes needed
  let franchise;
  let store;
  let menuItem;
  let menuItemId;

  beforeAll(async () => {
    await DB.initialized;

    testUser = await createUserWithRole(app, Role.Diner);

    const adminLogin = await request(app).put("/api/auth").send({
      email: fixtures.admin.email,
      password: fixtures.admin.password,
    });
    adminUser = { ...adminLogin.body.user, token: adminLogin.body.token };

    // Pull from the seeded data
    franchise = { id: (await DB.getUserFranchises(adminUser.id))[0]?.id };
    // If admin doesn't have any, create one
    if (!franchise.id) {
      const f = await request(app)
        .post("/api/franchise")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          name: generateRandomString(),
          admins: [{ email: fixtures.admin.email }],
        });
      franchise = f.body;
    }
    store = await DB.createStore(franchise.id, {
      name: generateRandomString(),
    });

    menuItem = fixtures.menuItems[0]; // Margherita — always seeded
    // Find its id from the live menu
    const menu = await DB.getMenu();
    const found = menu.find((m) => m.title === menuItem.title);
    menuItemId = found?.id;
  });

  // ── GET /api/order/menu ────────────────────────────────────────────────────

  describe("GET /api/order/menu", () => {
    test("is publicly accessible and returns an array", async () => {
      const res = await request(app).get("/api/order/menu");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("menu items have the expected fields", async () => {
      const res = await request(app).get("/api/order/menu");
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      const item = res.body[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("description");
      expect(item).toHaveProperty("image");
      expect(item).toHaveProperty("price");
    });

    test("seeded menu items all appear in the menu", async () => {
      const res = await request(app).get("/api/order/menu");
      const titles = res.body.map((m) => m.title);
      fixtures.menuItems.forEach((f) => expect(titles).toContain(f.title));
    });
  });

  // ── PUT /api/order/menu ────────────────────────────────────────────────────

  describe("PUT /api/order/menu", () => {
    test("admin can add a menu item", async () => {
      const newItem = {
        title: generateRandomString(),
        description: "New test pizza",
        image: "new.png",
        price: 0.005,
      };
      const res = await request(app)
        .put("/api/order/menu")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send(newItem);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const added = res.body.find((i) => i.title === newItem.title);
      expect(added).toBeDefined();
      expect(added.price).toBe(newItem.price);
    });

    test("menu count increases after adding an item", async () => {
      const before = (await request(app).get("/api/order/menu")).body.length;
      await request(app)
        .put("/api/order/menu")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          title: generateRandomString(),
          description: "x",
          image: "x.png",
          price: 0.001,
        });
      const after = (await request(app).get("/api/order/menu")).body.length;
      expect(after).toBe(before + 1);
    });

    test("non-admin gets 403", async () => {
      const res = await request(app)
        .put("/api/order/menu")
        .set("Authorization", `Bearer ${testUser.token}`)
        .send({
          title: generateRandomString(),
          description: "x",
          image: "x.png",
          price: 0.001,
        });
      expect(res.status).toBe(403);
    });

    test("returns 401 without authentication", async () => {
      const res = await request(app).put("/api/order/menu").send({
        title: generateRandomString(),
        description: "x",
        image: "x.png",
        price: 0.001,
      });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/order ─────────────────────────────────────────────────────────

  describe("GET /api/order", () => {
    test("returns dinerId, orders array, and page for authenticated user", async () => {
      const res = await request(app)
        .get("/api/order")
        .set("Authorization", `Bearer ${testUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("dinerId", testUser.id);
      expect(res.body).toHaveProperty("orders");
      expect(res.body).toHaveProperty("page");
      expect(Array.isArray(res.body.orders)).toBe(true);
    });

    test("pagination page param is reflected in response", async () => {
      const res = await request(app)
        .get("/api/order?page=2")
        .set("Authorization", `Bearer ${testUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.page).toBe("2");
    });

    test("returns 401 without authentication", async () => {
      const res = await request(app).get("/api/order");
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/order ────────────────────────────────────────────────────────

  describe("POST /api/order", () => {
    let baseOrder;

    beforeAll(() => {
      baseOrder = {
        franchiseId: franchise.id,
        storeId: store.id,
        items: [
          {
            menuId: menuItemId,
            description: menuItem.description,
            price: menuItem.price,
          },
        ],
      };
    });

    test("creates an order and returns jwt + followLinkToEndChaos", async () => {
      mockFactory();
      const res = await request(app)
        .post("/api/order")
        .set("Authorization", `Bearer ${testUser.token}`)
        .send(baseOrder);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("order");
      expect(res.body).toHaveProperty("jwt", "factory.jwt.token");
      expect(res.body).toHaveProperty("followLinkToEndChaos");
      expect(res.body.order).toHaveProperty("id");
      expect(res.body.order.franchiseId).toBe(franchise.id);
    });

    test("created order appears in GET /api/order", async () => {
      mockFactory();
      await request(app)
        .post("/api/order")
        .set("Authorization", `Bearer ${testUser.token}`)
        .send(baseOrder);

      const getRes = await request(app)
        .get("/api/order")
        .set("Authorization", `Bearer ${testUser.token}`);
      expect(getRes.body.orders.length).toBeGreaterThan(0);
    });

    test("creates order with multiple items", async () => {
      mockFactory({ jwt: "multi.jwt" });
      const res = await request(app)
        .post("/api/order")
        .set("Authorization", `Bearer ${testUser.token}`)
        .send({
          ...baseOrder,
          items: [
            {
              menuId: menuItemId,
              description: menuItem.description,
              price: menuItem.price,
            },
            { menuId: menuItemId, description: "Extra cheese", price: 0.001 },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.order.items).toHaveLength(2);
    });

    test("factory service failure returns 500 with followLinkToEndChaos", async () => {
      mockFactory({ ok: false });
      const res = await request(app)
        .post("/api/order")
        .set("Authorization", `Bearer ${testUser.token}`)
        .send(baseOrder);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to fulfill order at factory");
      expect(res.body).toHaveProperty("followLinkToEndChaos");
    });

    test("returns 401 without authentication", async () => {
      const res = await request(app).post("/api/order").send(baseOrder);
      expect(res.status).toBe(401);
    });

    test("factory is called with the correct payload shape", async () => {
      mockFactory();
      await request(app)
        .post("/api/order")
        .set("Authorization", `Bearer ${testUser.token}`)
        .send(baseOrder);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://pizza-factory.cs329.click/api/order",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            authorization: expect.stringContaining("Bearer"),
          }),
        }),
      );
    });
  });
});
