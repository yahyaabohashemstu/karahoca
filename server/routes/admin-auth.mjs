import {
  verifyLogin,
  signToken,
  isRateLimited,
  resetRateLimit,
  getJwtConfigError,
  createAdminSessionCookie,
  clearAdminSessionCookie,
  createAdminCsrfCookie,
  clearAdminCsrfCookie,
  generateCsrfToken,
} from '../auth.mjs';

const getIp = (req) =>
  (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim();

export const handleAdminLogin = async (req, res, { body, sendJson, origin }) => {
  const ip = getIp(req);

  if (await isRateLimited(ip)) {
    sendJson(res, 429, { success: false, error: 'Too many login attempts. Try again in 15 minutes.' }, origin);
    return;
  }

  const jwtConfigError = getJwtConfigError();
  if (jwtConfigError) {
    sendJson(res, 500, { success: false, error: jwtConfigError }, origin);
    return;
  }

  const { username, password } = body;

  // Type + length validation (prevents bcrypt timing issues with non-string inputs)
  if (
    typeof username !== 'string' || typeof password !== 'string' ||
    !username.trim() || !password ||
    username.length > 128 || password.length > 256
  ) {
    sendJson(res, 400, { success: false, error: 'Username and password required.' }, origin);
    return;
  }

  const trimmedUsername = username.trim();
  const valid = verifyLogin(trimmedUsername, password);

  if (!valid) {
    sendJson(res, 401, { success: false, error: 'Invalid credentials.' }, origin);
    return;
  }

  await resetRateLimit(ip);
  const token = signToken({ username: trimmedUsername, role: 'admin' });
  // Mint a fresh CSRF token alongside the session. The SPA reads this cookie
  // and echoes it back on every mutation as X-CSRF-Token (double-submit).
  const csrfToken = generateCsrfToken();

  sendJson(res, 200, { success: true }, origin, {
    // Node's http response accepts an array for multiple Set-Cookie headers.
    'Set-Cookie': [
      createAdminSessionCookie(token),
      createAdminCsrfCookie(csrfToken),
    ],
  });
};

export const handleAdminLogout = async (_req, res, { sendJson, origin }) => {
  sendJson(res, 200, { success: true }, origin, {
    'Set-Cookie': [
      clearAdminSessionCookie(),
      clearAdminCsrfCookie(),
    ],
  });
};
