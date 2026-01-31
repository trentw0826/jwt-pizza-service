const request = require('supertest');
const app = require('../../src/service');
const { Role, DB } = require('../../src/database/database.js');
const { generateRandomString, expectValidJwt } = require('../testHelper');

describe('Order Router', () => {
  let testUser;
  let testUserAuthToken;
  let adminUser;
  let adminAuthToken;
  let testFranchise;
  let testStore;
  let testMenuItem;

  beforeAll(async () => {
    // Wait for database to be ready
    await DB.initialized;

    // Create a regular test user
    testUser = {
      name: generateRandomString(),
      email: `${generateRandomString()}@test.com`,
      password: 'password123',
    };
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    testUser.id = registerRes.body.user.id;

    // Create an admin user
    adminUser = {
      name: generateRandomString(),
      email: `${generateRandomString()}@test.com`,
      password: 'adminpass',
    };
    const adminData = await DB.addUser({
      ...adminUser,
      roles: [{ role: Role.Admin }],
    });
    adminUser.id = adminData.id;

    // Get admin auth token
    const adminLoginRes = await request(app).put('/api/auth').send({
      email: adminUser.email,
      password: adminUser.password,
    });
    adminAuthToken = adminLoginRes.body.token;

    // Create franchise and store for order tests
    testFranchise = {
      name: generateRandomString(),
      admins: [{ email: adminUser.email }],
    };
    const franchise = await DB.createFranchise(testFranchise);
    testFranchise.id = franchise.id;

    testStore = await DB.createStore(testFranchise.id, { name: generateRandomString() });

    // Add a menu item
    testMenuItem = {
      title: 'Test Pizza',
      description: 'A delicious test pizza',
      image: 'pizza.png',
      price: 0.0042,
    };
  });

  describe('GET /api/order/menu', () => {
    test('should get the pizza menu without authentication', async () => {
      const res = await request(app).get('/api/order/menu');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('should return menu items with correct structure', async () => {
      const res = await request(app).get('/api/order/menu');
      expect(res.status).toBe(200);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('title');
        expect(res.body[0]).toHaveProperty('description');
        expect(res.body[0]).toHaveProperty('image');
        expect(res.body[0]).toHaveProperty('price');
      }
    });
  });

  describe('PUT /api/order/menu', () => {
    test('should add menu item as admin', async () => {
      const newItem = {
        title: generateRandomString(),
        description: 'New test pizza',
        image: 'newpizza.png',
        price: 0.005,
      };

      const res = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(newItem);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const addedItem = res.body.find((item) => item.title === newItem.title);
      expect(addedItem).toBeDefined();
      expect(addedItem.description).toBe(newItem.description);
      expect(addedItem.price).toBe(newItem.price);
    });

    test('should fail to add menu item without authentication', async () => {
      const newItem = {
        title: generateRandomString(),
        description: 'Unauthorized pizza',
        image: 'pizza.png',
        price: 0.003,
      };

      const res = await request(app).put('/api/order/menu').send(newItem);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
    });

    test('should fail to add menu item as non-admin user', async () => {
      const newItem = {
        title: generateRandomString(),
        description: 'Non-admin pizza',
        image: 'pizza.png',
        price: 0.003,
      };

      const res = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send(newItem);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('unable to add menu item');
    });
  });

  describe('GET /api/order', () => {
    test('should get orders for authenticated user', async () => {
      const res = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dinerId');
      expect(res.body).toHaveProperty('orders');
      expect(res.body).toHaveProperty('page');
      expect(Array.isArray(res.body.orders)).toBe(true);
      expect(res.body.dinerId).toBe(testUser.id);
    });

    test('should fail to get orders without authentication', async () => {
      const res = await request(app).get('/api/order');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
    });

    test('should support pagination', async () => {
      const res = await request(app)
        .get('/api/order?page=2')
        .set('Authorization', `Bearer ${testUserAuthToken}`);

      expect(res.status).toBe(200);
      expect(res.body.page).toBe('2'); // Query params come as strings
    });
  });

  describe('POST /api/order', () => {
    let menuItemId;

    beforeAll(async () => {
      // Add a menu item for order tests
      const item = await DB.addMenuItem(testMenuItem);
      menuItemId = item.id;
    });

    test('should create order successfully with valid data', async () => {
      // Mock the factory API call
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              jwt: 'factory.jwt.token',
              reportUrl: 'https://pizza-factory.cs329.click/api/order/verify/abc123',
            }),
        })
      );

      const orderRequest = {
        franchiseId: testFranchise.id,
        storeId: testStore.id,
        items: [
          {
            menuId: menuItemId,
            description: testMenuItem.description,
            price: testMenuItem.price,
          },
        ],
      };

      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send(orderRequest);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('order');
      expect(res.body).toHaveProperty('jwt');
      expect(res.body).toHaveProperty('followLinkToEndChaos');
      expect(res.body.order).toHaveProperty('id');
      expect(res.body.order.franchiseId).toBe(testFranchise.id);
      expect(res.body.order.storeId).toBe(testStore.id);
      expect(res.body.jwt).toBe('factory.jwt.token');

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://pizza-factory.cs329.click/api/order',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            authorization: expect.stringContaining('Bearer'),
          }),
        })
      );
    });

    test('should fail to create order without authentication', async () => {
      const orderRequest = {
        franchiseId: testFranchise.id,
        storeId: testStore.id,
        items: [
          {
            menuId: menuItemId,
            description: testMenuItem.description,
            price: testMenuItem.price,
          },
        ],
      };

      const res = await request(app).post('/api/order').send(orderRequest);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
    });

    test('should handle factory service failure', async () => {
      // Mock factory API failure
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          json: () =>
            Promise.resolve({
              message: 'Factory service unavailable',
              reportUrl: 'https://pizza-factory.cs329.click/api/order/verify/error',
            }),
        })
      );

      const orderRequest = {
        franchiseId: testFranchise.id,
        storeId: testStore.id,
        items: [
          {
            menuId: menuItemId,
            description: testMenuItem.description,
            price: testMenuItem.price,
          },
        ],
      };

      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send(orderRequest);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Failed to fulfill order at factory');
      expect(res.body).toHaveProperty('followLinkToEndChaos');
    });

    test('should create order with multiple items', async () => {
      // Mock the factory API call
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              jwt: 'multi.item.jwt',
              reportUrl: 'https://pizza-factory.cs329.click/api/order/verify/multi',
            }),
        })
      );

      const orderRequest = {
        franchiseId: testFranchise.id,
        storeId: testStore.id,
        items: [
          {
            menuId: menuItemId,
            description: testMenuItem.description,
            price: testMenuItem.price,
          },
          {
            menuId: menuItemId,
            description: 'Another pizza',
            price: 0.006,
          },
        ],
      };

      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send(orderRequest);

      expect(res.status).toBe(200);
      expect(res.body.order.items).toHaveLength(2);
    });
  });

  afterEach(() => {
    // Clean up mocks after each test
    if (global.fetch && global.fetch.mockClear) {
      global.fetch.mockClear();
    }
  });
});
