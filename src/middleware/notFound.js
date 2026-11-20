// Not-found handler for unknown routes.
// Always registered before the global error handler in app.js.

export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}
