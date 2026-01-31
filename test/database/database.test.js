const { DB } = require('../../src/database/database.js');
const { Role } = require('../../src/model/model.js');
const { generateRandomString } = require('../testHelper.js');

describe('Database Tests', () => {
  let testUser;
  let testFranchise;
  let testStore;
  let testMenuItem;

  beforeAll(async () => {
    // Wait for database to be ready
    await DB.initialized;
  });

  beforeEach(() => {
    // Generate unique test data for each test
    testUser = {
      name: generateRandomString(),
      email: `${generateRandomString()}@test.com`,
      password: 'password123',
      roles: [{ role: Role.Diner }],
    };

    testFranchise = {
      name: generateRandomString(),
      admins: [],
    };

    testStore = {
      name: generateRandomString(),
    };

    testMenuItem = {
      title: generateRandomString(),
      description: 'Test pizza',
      image: 'pizza.png',
      price: 0.0042,
    };
  });

  describe('Menu Operations', () => {
    test('should get menu items', async () => {
      const menu = await DB.getMenu();
      expect(Array.isArray(menu)).toBe(true);
    });

    test('should add a menu item', async () => {
      const addedItem = await DB.addMenuItem(testMenuItem);
      expect(addedItem).toMatchObject(testMenuItem);
      expect(addedItem.id).toBeDefined();
    });
  });

  describe('User Operations', () => {
    test('should add a new user', async () => {
      const user = await DB.addUser(testUser);
      expect(user.name).toBe(testUser.name);
      expect(user.email).toBe(testUser.email);
      expect(user.password).toBeUndefined();
      expect(user.id).toBeDefined();
    });

    test('should get user by email', async () => {
      const addedUser = await DB.addUser(testUser);
      const retrievedUser = await DB.getUser(testUser.email, testUser.password);
      expect(retrievedUser.id).toBe(addedUser.id);
      expect(retrievedUser.email).toBe(testUser.email);
      expect(retrievedUser.password).toBeUndefined();
    });

    test('should fail to get user with wrong password', async () => {
      await DB.addUser(testUser);
      await expect(DB.getUser(testUser.email, 'wrongpassword')).rejects.toThrow('unknown user');
    });

    test('should fail to get non-existent user', async () => {
      await expect(DB.getUser('nonexistent@test.com', 'password')).rejects.toThrow('unknown user');
    });

    test('should update user information', async () => {
      const addedUser = await DB.addUser(testUser);
      const newName = generateRandomString();
      const newEmail = `${generateRandomString()}@test.com`;
      const newPassword = 'newpassword456';
      
      const updatedUser = await DB.updateUser(addedUser.id, newName, newEmail, newPassword);
      expect(updatedUser.name).toBe(newName);
      expect(updatedUser.email).toBe(newEmail);
    });
  });

  describe('Authentication Operations', () => {
    test('should login and logout user', async () => {
      const user = await DB.addUser(testUser);
      const token = 'header.payload.testSignature123';
      
      await DB.loginUser(user.id, token);
      const isLoggedIn = await DB.isLoggedIn(token);
      expect(isLoggedIn).toBe(true);
      
      await DB.logoutUser(token);
      const isStillLoggedIn = await DB.isLoggedIn(token);
      expect(isStillLoggedIn).toBe(false);
    });

    test('should check if token is not logged in', async () => {
      const token = 'header.payload.nonExistentToken';
      const isLoggedIn = await DB.isLoggedIn(token);
      expect(isLoggedIn).toBe(false);
    });
  });

  describe('Franchise Operations', () => {
    test('should create a franchise', async () => {
      const admin = await DB.addUser(testUser);
      testFranchise.admins = [{ email: admin.email }];
      
      const franchise = await DB.createFranchise(testFranchise);
      expect(franchise.name).toBe(testFranchise.name);
      expect(franchise.id).toBeDefined();
      expect(franchise.admins[0].id).toBe(admin.id);
    });

    test('should fail to create franchise with non-existent admin', async () => {
      testFranchise.admins = [{ email: 'nonexistent@test.com' }];
      await expect(DB.createFranchise(testFranchise)).rejects.toThrow('unknown user');
    });

    test('should get franchises', async () => {
      const admin = await DB.addUser(testUser);
      testFranchise.admins = [{ email: admin.email }];
      await DB.createFranchise(testFranchise);
      
      const [franchises, hasMore] = await DB.getFranchises(null, 0, 10, '*');
      expect(Array.isArray(franchises)).toBe(true);
      expect(franchises.length).toBeGreaterThan(0);
      expect(typeof hasMore).toBe('boolean');
    });

    test('should get user franchises', async () => {
      const admin = await DB.addUser(testUser);
      testFranchise.admins = [{ email: admin.email }];
      await DB.createFranchise(testFranchise);
      
      const franchises = await DB.getUserFranchises(admin.id);
      expect(Array.isArray(franchises)).toBe(true);
      expect(franchises.length).toBeGreaterThan(0);
    });

    test('should delete a franchise', async () => {
      const admin = await DB.addUser(testUser);
      testFranchise.admins = [{ email: admin.email }];
      const franchise = await DB.createFranchise(testFranchise);
      
      await expect(DB.deleteFranchise(franchise.id)).resolves.not.toThrow();
    });
  });

  describe('Store Operations', () => {
    let franchiseId;

    beforeEach(async () => {
      const admin = await DB.addUser(testUser);
      testFranchise.admins = [{ email: admin.email }];
      const franchise = await DB.createFranchise(testFranchise);
      franchiseId = franchise.id;
    });

    test('should create a store', async () => {
      const store = await DB.createStore(franchiseId, testStore);
      expect(store.name).toBe(testStore.name);
      expect(store.id).toBeDefined();
      expect(store.franchiseId).toBe(franchiseId);
    });

    test('should delete a store', async () => {
      const store = await DB.createStore(franchiseId, testStore);
      await expect(DB.deleteStore(franchiseId, store.id)).resolves.not.toThrow();
    });
  });

  describe('Order Operations', () => {
    let user;
    let franchiseId;
    let storeId;
    let menuItemId;

    beforeEach(async () => {
      // Create user
      user = await DB.addUser(testUser);
      
      // Create franchise and store
      const admin = await DB.addUser({
        name: generateRandomString(),
        email: `${generateRandomString()}@test.com`,
        password: 'password',
        roles: [{ role: Role.Diner }],
      });
      testFranchise.admins = [{ email: admin.email }];
      const franchise = await DB.createFranchise(testFranchise);
      franchiseId = franchise.id;
      
      const store = await DB.createStore(franchiseId, testStore);
      storeId = store.id;
      
      // Add menu item
      const menuItem = await DB.addMenuItem(testMenuItem);
      menuItemId = menuItem.id;
    });

    test('should add a diner order', async () => {
      const order = {
        franchiseId,
        storeId,
        items: [
          {
            menuId: menuItemId,
            description: testMenuItem.description,
            price: testMenuItem.price,
          },
        ],
      };
      
      const addedOrder = await DB.addDinerOrder(user, order);
      expect(addedOrder.id).toBeDefined();
      expect(addedOrder.franchiseId).toBe(franchiseId);
      expect(addedOrder.storeId).toBe(storeId);
    });

    test('should get orders for a user', async () => {
      const order = {
        franchiseId,
        storeId,
        items: [
          {
            menuId: menuItemId,
            description: testMenuItem.description,
            price: testMenuItem.price,
          },
        ],
      };
      
      await DB.addDinerOrder(user, order);
      const orders = await DB.getOrders(user, 1);
      
      expect(orders.dinerId).toBe(user.id);
      expect(Array.isArray(orders.orders)).toBe(true);
      expect(orders.orders.length).toBeGreaterThan(0);
      expect(orders.page).toBe(1);
    });
  });
});
