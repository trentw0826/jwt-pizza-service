// Import Express framework
const express = require("express");

// Import routers
const { authRouter, setAuthUser } = require("./routes/authRouter.js");
const orderRouter = require("./routes/orderRouter.js");
const franchiseRouter = require("./routes/franchiseRouter.js");
const userRouter = require("./routes/userRouter.js");

// Import version and config
const version = require("./version.json");
const config = require("./config.js");

// Initialize Express application
const app = express();
app.use(express.json()); // Middleware to parse JSON request bodies
app.use(setAuthUser); // Custom middleware to set authenticated user if token is valid
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

// Set up API routes under /api using the imported routers
const apiRouter = express.Router();
app.use("/api", apiRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/user", userRouter);
apiRouter.use("/order", orderRouter);
apiRouter.use("/franchise", franchiseRouter);

// Endpoint to provide API documentation
apiRouter.use("/docs", (req, res) => {
  res.json({
    version: version.version,
    endpoints: [
      ...authRouter.docs,
      ...userRouter.docs,
      ...orderRouter.docs,
      ...franchiseRouter.docs,
    ],
    config: { factory: config.factory.url, db: config.db.connection.host },
  });
});

// Root endpoint providing welcome message and version
app.get("/", (req, res) => {
  res.json({
    message: "welcome to JWT Pizza",
    version: version.version,
  });
});

// Handle unknown endpoints with 404 response
app.use("*", (req, res) => {
  res.status(404).json({
    message: "unknown endpoint",
  });
});

// Default error handler for all exceptions and errors.
app.use((err, req, res, next) => {
  res
    .status(err.statusCode ?? 500)
    .json({ message: err.message, stack: err.stack });
  next();
});

module.exports = app;
