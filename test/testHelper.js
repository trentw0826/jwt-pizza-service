const request = require("supertest");
const { Role, DB } = require("../src/database/database.js");
const { fixtures, seedTestDatabase } = require("./testFixtures");

function generateRandomString(length = 10) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_!@#$%^&*()-+=";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/,
  );
}

// Helper to create a user with specific role and authenticate them
async function createUserWithRole(app, role = Role.Diner) {
  const userData = {
    name: generateRandomString(),
    email: `${generateRandomString()}@test.com`,
    password: generateRandomString(),
  };

  if (role === Role.Admin) {
    // Admin users need to be created directly in DB
    const adminData = await DB.addUser({
      ...userData,
      roles: [{ role: Role.Admin }],
    });
    userData.id = adminData.id;

    // Login to get token
    const loginRes = await request(app).put("/api/auth").send({
      email: userData.email,
      password: userData.password,
    });
    userData.token = loginRes.body.token;
  } else {
    // Regular users can register normally
    const registerRes = await request(app).post("/api/auth").send(userData);
    userData.token = registerRes.body.token;
    userData.id = registerRes.body.user.id;
  }

  return userData;
}

// Helper to create a franchise
async function createTestFranchise(adminEmail) {
  const franchiseData = {
    name: generateRandomString(),
    admins: [{ email: adminEmail }],
  };
  const franchise = await DB.createFranchise(franchiseData);
  return { ...franchiseData, id: franchise.id };
}

// Helper to create a store
async function createTestStore(franchiseId) {
  const storeName = generateRandomString();
  const store = await DB.createStore(franchiseId, { name: storeName });
  return store;
}

// Helper to create a menu item
async function createTestMenuItem() {
  const menuItem = {
    title: generateRandomString(),
    description: "Test pizza",
    image: "pizza.png",
    price: 0.0042,
  };
  const item = await DB.addMenuItem(menuItem);
  return item;
}

module.exports = {
  generateRandomString,
  expectValidJwt,
  createUserWithRole,
  createTestFranchise,
  createTestStore,
  createTestMenuItem,
  // Fixture constants and seeding — importable so tests know exactly what's in the DB
  fixtures,
  seedTestDatabase,
};
