// Custom ERROR class for the API.
// Throw (or pass to next()) an ApiError anywhere in a route and the global
// error handler will respond with the right status code and message:
//   { success: false, message }
//
// Examples:
//   next(new ApiError(404, 'Tuition not found'));
//   next(new ApiError(400, 'Title is required'));
//
// statusCode defaults:
//   400 - bad request (wrong/missing input)
//   401 - not authenticated (no/invalid token)
//   403 - not authorized (wrong role / not the owner)
//   404 - not found
//   500 - something went wrong on the server

export class ApiError extends Error {
  constructor(statusCode = 500, message = 'Something went wrong') {
    super(message);
    this.statusCode = statusCode;
    this.success = false;
  }
}
