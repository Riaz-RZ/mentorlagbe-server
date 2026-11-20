// Global error-handling middleware (always last in app.js).
// Catches anything passed to next(err) or thrown in a route.
//
// Response shape matches the rest of the API:
//   { success: false, message: "..." }

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('Unexpected error:', err.message);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong',
  });
}
