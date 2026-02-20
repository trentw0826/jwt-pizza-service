const express = require("express");
const jwt = require("jsonwebtoken");
const config = require("../config.js");
const { asyncHandler } = require("../endpointHelper.js");
const { DB, Role } = require("../database/database.js");

// Create the auth router with Express
const authRouter = express.Router();

// Populate documentation for this router
authRouter.docs = [
  {
    method: "POST",
    path: "/api/auth",
    description: "Register a new user",
    example: `curl -X POST localhost:3000/api/auth -d '{"name":"pizza diner", "email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json'`,
    response: {
      user: {
        id: 2,
        name: "pizza diner",
        email: "d@jwt.com",
        roles: [{ role: "diner" }],
      },
      token: "tttttt",
    },
  },
  {
    method: "PUT",
    path: "/api/auth",
    description: "Login existing user",
    example: `curl -X PUT localhost:3000/api/auth -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json'`,
    response: {
      user: {
        id: 1,
        name: "常用名字",
        email: "a@jwt.com",
        roles: [{ role: "admin" }],
      },
      token: "tttttt",
    },
  },
  {
    method: "DELETE",
    path: "/api/auth",
    requiresAuth: true,
    description: "Logout a user",
    example: `curl -X DELETE localhost:3000/api/auth -H 'Authorization: Bearer tttttt'`,
    response: { message: "logout successful" },
  },
];

// Middleware to set req.user if a valid auth token is provided
// This runs for every request to the service
// Validates token against both JWT signature and database session
// Adds isRole helper method to check user permissions
async function setAuthUser(req, res, next) {
  const token = readAuthToken(req);
  if (token) {
    try {
      if (await DB.isLoggedIn(token)) {
        // Check the database to make sure the token is valid.
        req.user = jwt.verify(token, config.jwtSecret); // Verify JWT token by decoding it and checking signature
        req.user.isRole = (role) =>
          !!req.user.roles.find((r) => r.role === role);
      }
    } catch {
      req.user = null;
    }
  }
  next();
}

// Authenticate token
authRouter.authenticateToken = (req, res, next) => {
  if (!req.user) {
    return res.status(401).send({ message: "unauthorized" });
  }
  next();
};

// register
authRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email, and password are required" });
    }
    const user = await DB.addUser({
      name,
      email,
      password,
      roles: [{ role: Role.Diner }],
    });
    const auth = await setAuth(user);
    res.json({ user: user, token: auth });
  }),
);

// login
authRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await DB.getUser(email, password);
    const auth = await setAuth(user);
    res.json({ user: user, token: auth });
  }),
);

// logout
authRouter.delete(
  "/",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    await clearAuth(req);
    res.json({ message: "logout successful" });
  }),
);

// Creates JWT token for user and records it in database for session tracking
async function setAuth(user) {
  const token = jwt.sign(user, config.jwtSecret);
  await DB.loginUser(user.id, token);
  return token;
}

// Helper to clear authentication for a user
async function clearAuth(req) {
  const token = readAuthToken(req);
  if (token) {
    await DB.logoutUser(token);
  }
}

// Helper to read the auth token from the request headers
function readAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return authHeader.split(" ")[1];
  }
  return null;
}

module.exports = { authRouter, setAuthUser, setAuth };
