import { ApiError } from '../utils/ApiError.js';

const validRoles = new Set(['student', 'tutor', 'admin']);

export function requireRole(...allowedRoles) {
  if (
    allowedRoles.length === 0 ||
    allowedRoles.some((role) => !validRoles.has(role))
  ) {
    throw new Error('requireRole must receive one or more valid roles');
  }

  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication is required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }

    return next();
  };
}
