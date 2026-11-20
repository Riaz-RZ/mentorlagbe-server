// Standard SUCCESS response helper.
// Every success response uses the same shape:
//   { success: true, message, data }

export class ApiResponse {
  static success(res, { statusCode = 200, message = 'Request successful', data = null } = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }
}
