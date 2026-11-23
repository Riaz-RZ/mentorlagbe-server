import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { requireRole } from '../src/middleware/requireRole.js';

let server;
let apiServer;
let privateKey;
let verifyToken;
let publicJwk;
let apiOrigin;

before(async () => {
  const keys = await generateKeyPair('EdDSA');
  privateKey = keys.privateKey;
  publicJwk = {
    ...(await exportJWK(keys.publicKey)),
    alg: 'EdDSA',
    kid: 'auth-test-key',
    use: 'sig',
  };

  server = createServer((req, res) => {
    if (req.url !== '/api/auth/jwks') {
      res.writeHead(404).end();
      return;
    }

    res.writeHead(200, {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300',
    });
    res.end(JSON.stringify({ keys: [publicJwk] }));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  process.env.CLIENT_URL = `http://127.0.0.1:${server.address().port}`;

  ({ verifyToken } = await import('../src/middleware/verifyToken.js'));

  const { default: app } = await import('../src/app.js');
  apiServer = createServer(app);
  apiServer.listen(0, '127.0.0.1');
  await once(apiServer, 'listening');
  apiOrigin = `http://127.0.0.1:${apiServer.address().port}`;
});

after(async () => {
  apiServer.close();
  await once(apiServer, 'close');
  server.close();
  await once(server, 'close');
});

async function createToken(claims = {}, expiration = '5m') {
  return new SignJWT({
    email: 'user@example.com',
    name: 'Test User',
    role: 'student',
    ...claims,
  })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'auth-test-key' })
    .setSubject('user-123')
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(privateKey);
}

async function invokeVerifyToken(token) {
  const req = {
    get: () => (token ? `Bearer ${token}` : undefined),
  };
  let error;
  await verifyToken(req, {}, (nextError) => {
    error = nextError;
  });
  return { req, error };
}

test('accepts a valid Better Auth JWT and exposes verified identity', async () => {
  const { req, error } = await invokeVerifyToken(await createToken());

  assert.equal(error, undefined);
  assert.deepEqual(req.user, {
    id: 'user-123',
    email: 'user@example.com',
    name: 'Test User',
    role: 'student',
  });
});

test('rejects missing and invalid tokens', async () => {
  const missing = await invokeVerifyToken();
  assert.equal(missing.error.statusCode, 401);

  const token = await createToken();
  const [header, payload, signature] = token.split('.');
  const changedPayload = `${payload[0] === 'A' ? 'B' : 'A'}${payload.slice(1)}`;
  const tampered = `${header}.${changedPayload}.${signature}`;
  const invalid = await invokeVerifyToken(tampered);
  assert.equal(invalid.error.statusCode, 401);
});

test('rejects expired tokens', async () => {
  const { error } = await invokeVerifyToken(await createToken({}, '-10s'));
  assert.equal(error.statusCode, 401);
});

test('rejects signed tokens without an allowed user role', async () => {
  const { error } = await invokeVerifyToken(
    await createToken({ role: 'untrusted-role' })
  );
  assert.equal(error.statusCode, 401);
});

test('allows only the specified roles', async () => {
  const allowStudent = requireRole('student');
  const allowAdmin = requireRole('admin');

  let studentError;
  allowStudent({ user: { role: 'student' } }, {}, (error) => {
    studentError = error;
  });
  assert.equal(studentError, undefined);

  let adminError;
  allowAdmin({ user: { role: 'student' } }, {}, (error) => {
    adminError = error;
  });
  assert.equal(adminError.statusCode, 403);
});

test('protects admin API routes while leaving health public', async () => {
  const unauthenticated = await fetch(`${apiOrigin}/api/users/stats`);
  assert.equal(unauthenticated.status, 401);

  const studentToken = await createToken();
  const wrongRole = await fetch(`${apiOrigin}/api/users/stats`, {
    headers: { authorization: `Bearer ${studentToken}` },
  });
  assert.equal(wrongRole.status, 403);

  const health = await fetch(`${apiOrigin}/api/health`);
  assert.equal(health.status, 200);
});

test('initializes MongoDB before public data routes', async () => {
  const originalDbUri = process.env.DB_URI;
  delete process.env.DB_URI;

  try {
    const response = await fetch(`${apiOrigin}/api/tuitions`);
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.match(body.message, /DB_URI is missing/);

    const publicStats = await fetch(`${apiOrigin}/api/users/public-stats`);
    const statsBody = await publicStats.json();
    assert.equal(publicStats.status, 500);
    assert.match(statsBody.message, /DB_URI is missing/);
  } finally {
    if (originalDbUri !== undefined) {
      process.env.DB_URI = originalDbUri;
    } else {
      delete process.env.DB_URI;
    }
  }

  const root = await fetch(`${apiOrigin}/`);
  assert.equal(root.status, 200);
  assert.deepEqual(await root.json(), {
    success: true,
    message: 'MentorLagbe API is running',
    data: { status: 'OK' },
  });
});
