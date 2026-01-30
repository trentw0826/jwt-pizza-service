const request = require("supertest");
const app = require("../src/service");
const { expectValidJwt } = require("./testHelper");

const testUser = { name: "pizza diner", email: "", password: "a" };
let testUserAuthToken;

describe("Auth Router", function () {
  beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
    const registerRes = await request(app).post("/api/auth").send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);
  });

  test("should authenticate user with valid credentials", async () => {
    const loginRes = await request(app).put("/api/auth").send(testUser);
    expect(loginRes.status).toBe(200);
    expectValidJwt(loginRes.body.token);

    const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
    delete expectedUser.password;
    expect(loginRes.body.user).toMatchObject(expectedUser);
  });
});
