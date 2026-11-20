// Global error-handling middleware (always last in app.js).
// Catches ApiError instances, anything passed to next(err), and thrown errors.
//
// Response shape matches the rest of the API:
//   { success: false, message: "..." }

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;

  // Only log real server errors (500) - client errors (400/404/...) are normal.
  if (statusCode >= 500) {
    console.error('Unexpected error:', err.message);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Something went wrong',
  });
}
