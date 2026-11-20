import { ApiError } from '../utils/ApiError.js';

// Not-found handler for unknown routes.
// Always registered before the global error handler in app.js.
// Passes an ApiError to the global error handler so ALL error responses
// go through one single place.

export function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}
