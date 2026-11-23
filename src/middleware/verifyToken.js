import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { ApiError } from '../utils/ApiError.js';

const validRoles = new Set(['student', 'tutor', 'admin']);
let remoteJwks;

function getRemoteJwks() {
  if (remoteJwks) return remoteJwks;

  const authBaseUrl = process.env.BETTER_AUTH_URL || process.env.CLIENT_URL;
  if (!authBaseUrl) {
    throw new ApiError(
      500,
      'BETTER_AUTH_URL or CLIENT_URL is required to verify access tokens'
    );
  }

  let jwksUrl;
  try {
    jwksUrl = new URL('/api/auth/jwks', authBaseUrl);
  } catch {
    throw new ApiError(500, 'The Better Auth URL is invalid');
  }

  remoteJwks = createRemoteJWKSet(jwksUrl);
  return remoteJwks;
}

export async function verifyToken(req, res, next) {
  const authorization = req.get('authorization')?.trim();
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return next(new ApiError(401, 'A Bearer token is required'));
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(match[1], getRemoteJwks(), {
      algorithms: ['EdDSA'],
      requiredClaims: ['exp', 'sub'],
    }));
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }

    if (error instanceof errors.JOSEError) {
      if (error.code === 'ERR_JWKS_TIMEOUT') {
        return next(new ApiError(503, 'Better Auth key lookup timed out'));
      }

      return next(new ApiError(401, 'The Bearer token is invalid or expired'));
    }

    if (error instanceof TypeError) {
      return next(new ApiError(503, 'Could not reach the Better Auth key endpoint'));
    }

    return next(error);
  }

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    !validRoles.has(payload.role)
  ) {
    return next(new ApiError(401, 'The Bearer token is missing required user claims'));
  }

  req.user = {
    id: payload.sub,
    email: payload.email,
    name: typeof payload.name === 'string' ? payload.name : '',
    role: payload.role,
  };

  return next();
}
