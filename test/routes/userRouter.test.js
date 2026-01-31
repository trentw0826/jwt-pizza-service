const request = require('supertest');
const app = require('../../src/service');
const { Role, DB } = require('../../src/database/database.js');
const { generateRandomString, expectValidJwt } = require('../testHelper');

describe('User Router', () => {
  let adminUser;
  let adminAuthToken;
  let regularUser;
  let regularUserAuthToken;
  let otherUser;
  let otherUserAuthToken;

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

    // Create another regular user
    otherUser = {
      name: generateRandomString(),
      email: `${generateRandomString()}@test.com`,
      password: 'otherpass',
    };
    const otherUserRes = await request(app).post('/api/auth').send(otherUser);
    otherUserAuthToken = otherUserRes.body.token;
    otherUser.id = otherUserRes.body.user.id;
  });

  describe('GET /api/user/me', () => {
    test('should get authenticated user info', async () => {
      const res = await request(app)
        .get('/api/user/me')
        .set('Authorization', `Bearer ${regularUserAuthToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', regularUser.id);
      expect(res.body).toHaveProperty('name', regularUser.name);
      expect(res.body).toHaveProperty('email', regularUser.email);
      expect(res.body).toHaveProperty('roles');
      expect(Array.isArray(res.body.roles)).toBe(true);
      expect(res.body).not.toHaveProperty('password');
    });

    test('should get admin user info', async () => {
      const res = await request(app)
        .get('/api/user/me')
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', adminUser.id);
      expect(res.body).toHaveProperty('name', adminUser.name);
      expect(res.body).toHaveProperty('email', adminUser.email);
      expect(res.body.roles).toContainEqual({ role: Role.Admin });
    });

    test('should fail without authentication', async () => {
      const res = await request(app).get('/api/user/me');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
    });

    test('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/api/user/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
    });
  });

  describe('PUT /api/user/:userId', () => {
    test('should update own user name', async () => {
      const newName = generateRandomString();
      const res = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularUserAuthToken}`)
        .send({
          name: newName,
          email: regularUser.email,
          password: regularUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.name).toBe(newName);
      expect(res.body.user.email).toBe(regularUser.email);
      expect(res.body.user).not.toHaveProperty('password');
      expectValidJwt(res.body.token);

      // Update local user data for subsequent tests
      regularUser.name = newName;
      regularUserAuthToken = res.body.token;
    });

    test('should update own user email', async () => {
      const newEmail = `${generateRandomString()}@test.com`;
      const res = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularUserAuthToken}`)
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
      regularUserAuthToken = res.body.token;
    });

    test('should update own user password', async () => {
      const newPassword = generateRandomString();
      const res = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularUserAuthToken}`)
        .send({
          name: regularUser.name,
          email: regularUser.email,
          password: newPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expectValidJwt(res.body.token);

      // Verify new password works
      const loginRes = await request(app).put('/api/auth').send({
        email: regularUser.email,
        password: newPassword,
      });

      expect(loginRes.status).toBe(200);
      regularUser.password = newPassword;
      regularUserAuthToken = loginRes.body.token;
    });

    test('should update multiple fields at once', async () => {
      const newName = generateRandomString();
      const newEmail = `${generateRandomString()}@test.com`;
      const newPassword = generateRandomString();

      const res = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularUserAuthToken}`)
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
      regularUserAuthToken = res.body.token;
    });

    test('should allow admin to update other users', async () => {
      const newName = generateRandomString();
      const res = await request(app)
        .put(`/api/user/${otherUser.id}`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
          name: newName,
          email: otherUser.email,
          password: otherUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe(newName);
      expect(res.body.user.id).toBe(otherUser.id);
    });

    test('should prevent non-admin from updating other users', async () => {
      const res = await request(app)
        .put(`/api/user/${otherUser.id}`)
        .set('Authorization', `Bearer ${regularUserAuthToken}`)
        .send({
          name: generateRandomString(),
          email: otherUser.email,
          password: otherUser.password,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('unauthorized');
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .send({
          name: generateRandomString(),
          email: regularUser.email,
          password: regularUser.password,
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
    });

    test('should return new token after update', async () => {
      const oldToken = regularUserAuthToken;
      const res = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularUserAuthToken}`)
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

  describe('DELETE /api/user/:userId', () => {
    test('should return not implemented', async () => {
      const res = await request(app)
        .delete(`/api/user/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularUserAuthToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('not implemented');
    });

    test('should require authentication', async () => {
      const res = await request(app).delete(`/api/user/${regularUser.id}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
    });
  });

  describe('GET /api/user', () => {
    test('should return not implemented', async () => {
      const res = await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('not implemented');
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('more');
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users).toEqual([]);
      expect(res.body.more).toBe(false);
    });

    test('should require authentication', async () => {
      const res = await request(app).get('/api/user');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('unauthorized');
    });

    test('should be accessible by regular users', async () => {
      const res = await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${regularUserAuthToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('not implemented');
    });
  });
});
