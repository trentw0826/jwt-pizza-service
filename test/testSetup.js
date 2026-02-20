// Runs before each test file (setupFilesAfterFramework).
// Clears all tables and seeds a minimal predictable set of fixtures so every
// test file starts from a known, clean state.

const { DB } = require("../src/database/database");
const { Role } = require("../src/model/model");

beforeAll(async () => {
  await DB.initialized;
  await DB.clearAllData();

  // Seed a default admin so tests that need one can rely on these credentials
  await DB.addUser({
    name: "Test Admin",
    email: "admin@test.com",
    password: "adminpass",
    roles: [{ role: Role.Admin }],
  });
});
