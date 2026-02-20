// Runs before each test file (setupFilesAfterFramework in jest.config.json).
// Delegates all seeding to testFixtures.js so the logic and constants
// live in one place and are importable by individual test files.

const { seedTestDatabase } = require("./testFixtures");

beforeAll(async () => {
  await seedTestDatabase();
});
