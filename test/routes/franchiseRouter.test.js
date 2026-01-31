const request = require('supertest');
const app = require('../../src/service');
const { Role, DB } = require('../../src/database/database.js');
const { generateRandomString } = require('../testHelper');

describe('Franchise Router', () => {
  let adminUser;
  let adminAuthToken;
  let franchiseeUser;
  let franchiseeAuthToken;
  let regularUser;
  let regularUserAuthToken;
  let testFranchise;

  beforeAll(async () => {
    // Wait for database to be ready
    await DB.initialized;

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

    const adminLoginRes = await request(app).put('/api/auth').send({
      email: adminUser.email,
      password: adminUser.password,
    });
    adminAuthToken = adminLoginRes.body.token;

    // Create a regular user
    regularUser = {
      name: generateRandomString(),
      email: `${generateRandomString()}@test.com`,
      password: 'userpass',
    };
    const regularUserRes = await request(app).post('/api/auth').send(regularUser);
    regularUserAuthToken = regularUserRes.body.token;
    regularUser.id = regularUserRes.body.user.id;

    // Create a franchisee user
    franchiseeUser = {
      name: generateRandomString(),
      email: `${generateRandomString()}@test.com`,
      password: 'franchiseepass',
    };
    const franchiseeRes = await request(app).post('/api/auth').send(franchiseeUser);
    franchiseeAuthToken = franchiseeRes.body.token;
    franchiseeUser.id = franchiseeRes.body.user.id;

    // Create a franchise for the franchisee
    testFranchise = {
      name: generateRandomString(),
      admins: [{ email: franchiseeUser.email }],
    };
    const franchise = await DB.createFranchise(testFranchise);
    testFranchise.id = franchise.id;
  });

  describe('GET /api/franchise', () => {
    test('should list all franchises without authentication', async () => {
      const res = await request(app).get('/api/franchise');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('franchises');
      expect(res.body).toHaveProperty('more');
      expect(Array.isArray(res.body.franchises)).toBe(true);
      expect(typeof res.body.more).toBe('boolean');
    });

    test('should support pagination parameters', async () => {
      const res = await request(app).get('/api/franchise?page=0&limit=5');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('franchises');
      expect(res.body.franchises.length).toBeLessThanOrEqual(5);
    });

    test('should support name filter', async () => {
      // Test with wildcard filter
      const res = await request(app).get('/api/franchise?name=*&limit=100');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('franchises');
      expect(Array.isArray(res.body.franchises)).toBe(true);
    });

    test('should return basic info for unauthenticated users', async () => {
      const res = await request(app).get('/api/franchise');
      expect(res.status).toBe(200);
      if (res.body.franchises.length > 0) {
        const franchise = res.body.franchises[0];
        expect(franchise).toHaveProperty('id');
        expect(franchise).toHaveProperty('name');
        expect(franchise).toHaveProperty('stores');
      }
    });
  });

  describe('GET /api/franchise/:userId', () => {
    test('should get user franchises for own account', async () => {
      const res = await request(app)
        .get(`/api/franchise/${franchiseeUser.id}`)
        .set('Authorization', `Bearer ${franchiseeAuthToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].name).toBe(testFranchise.name);
    });

    test('should allow admin to get any user franchises', async () => {
      const res = await request(app)
        .get(`/api/franchise/${franchiseeUser.id}`)
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('should return empty array for user with no franchises', async () => {
      const res = await request(app)
        .get(`/api/franchise/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularUserAuthToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    test('should fail without authentication', async () => {
      const res = await request(app).get(`/api/franchise/${franchiseeUser.id}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
    });

    test('should prevent non-admin from accessing other user franchises', async () => {
      const res = await request(app)
        .get(`/api/franchise/${franchiseeUser.id}`)
        .set('Authorization', `Bearer ${regularUserAuthToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /api/franchise', () => {
    test('should create franchise as admin', async () => {
      const newFranchise = {
        name: generateRandomString(),
        admins: [{ email: franchiseeUser.email }],
      };

      const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(newFranchise);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(newFranchise.name);
      expect(res.body).toHaveProperty('id');
      expect(res.body.admins).toHaveLength(1);
      expect(res.body.admins[0].email).toBe(franchiseeUser.email);
    });

    test('should fail to create franchise without authentication', async () => {
      const newFranchise = {
        name: generateRandomString(),
        admins: [{ email: franchiseeUser.email }],
      };

      const res = await request(app).post('/api/franchise').send(newFranchise);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
    });

    test('should fail to create franchise as non-admin', async () => {
      const newFranchise = {
        name: generateRandomString(),
        admins: [{ email: franchiseeUser.email }],
      };

      const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${regularUserAuthToken}`)
        .send(newFranchise);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('unable to create a franchise');
    });

    test('should create franchise with multiple admins', async () => {
      const newFranchise = {
        name: generateRandomString(),
        admins: [
          { email: franchiseeUser.email },
          { email: regularUser.email },
        ],
      };

      const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(newFranchise);

      expect(res.status).toBe(200);
      expect(res.body.admins).toHaveLength(2);
    });
  });

  describe('DELETE /api/franchise/:franchiseId', () => {
    test('should delete franchise', async () => {
      // Create a franchise to delete
      const franchiseToDelete = {
        name: generateRandomString(),
        admins: [{ email: franchiseeUser.email }],
      };
      const createRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(franchiseToDelete);

      const franchiseId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/franchise/${franchiseId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('franchise deleted');
    });

    test('should allow deletion without authentication', async () => {
      // Note: This endpoint doesn't require authentication based on the router code
      const franchiseToDelete = {
        name: generateRandomString(),
        admins: [{ email: franchiseeUser.email }],
      };
      const createRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(franchiseToDelete);

      const franchiseId = createRes.body.id;

      const res = await request(app).delete(`/api/franchise/${franchiseId}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('franchise deleted');
    });
  });

  describe('POST /api/franchise/:franchiseId/store', () => {
    test('should create store as franchise admin', async () => {
      const newStore = {
        name: generateRandomString(),
      };

      const res = await request(app)
        .post(`/api/franchise/${testFranchise.id}/store`)
        .set('Authorization', `Bearer ${franchiseeAuthToken}`)
        .send(newStore);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(newStore.name);
      expect(res.body).toHaveProperty('id');
      expect(res.body.franchiseId).toBe(testFranchise.id);
    });

    test('should create store as system admin', async () => {
      const newStore = {
        name: generateRandomString(),
      };

      const res = await request(app)
        .post(`/api/franchise/${testFranchise.id}/store`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(newStore);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(newStore.name);
      expect(res.body.franchiseId).toBe(testFranchise.id);
    });

    test('should fail to create store without authentication', async () => {
      const newStore = {
        name: generateRandomString(),
      };

      const res = await request(app)
        .post(`/api/franchise/${testFranchise.id}/store`)
        .send(newStore);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
    });

    test('should fail to create store as non-franchisee', async () => {
      const newStore = {
        name: generateRandomString(),
      };

      const res = await request(app)
        .post(`/api/franchise/${testFranchise.id}/store`)
        .set('Authorization', `Bearer ${regularUserAuthToken}`)
        .send(newStore);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('unable to create a store');
    });
  });

  describe('DELETE /api/franchise/:franchiseId/store/:storeId', () => {
    let storeToDelete;

    beforeEach(async () => {
      // Create a store to delete
      storeToDelete = await DB.createStore(testFranchise.id, {
        name: generateRandomString(),
      });
    });

    test('should delete store as franchise admin', async () => {
      const res = await request(app)
        .delete(`/api/franchise/${testFranchise.id}/store/${storeToDelete.id}`)
        .set('Authorization', `Bearer ${franchiseeAuthToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('store deleted');
    });

    test('should delete store as system admin', async () => {
      const res = await request(app)
        .delete(`/api/franchise/${testFranchise.id}/store/${storeToDelete.id}`)
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('store deleted');
    });

    test('should fail to delete store without authentication', async () => {
      const res = await request(app).delete(
        `/api/franchise/${testFranchise.id}/store/${storeToDelete.id}`
      );

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
    });

    test('should fail to delete store as non-franchisee', async () => {
      const res = await request(app)
        .delete(`/api/franchise/${testFranchise.id}/store/${storeToDelete.id}`)
        .set('Authorization', `Bearer ${regularUserAuthToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('unable to delete a store');
    });
  });
});
