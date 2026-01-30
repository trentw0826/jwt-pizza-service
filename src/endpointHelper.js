// Custom Error class to include HTTP status codes
class StatusCodeError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Async handler to wrap async route handlers and middleware
// This will catch any errors and pass them to next()
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  asyncHandler,
  StatusCodeError,
};
