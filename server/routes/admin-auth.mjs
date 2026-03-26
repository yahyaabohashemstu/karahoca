import { verifyLogin, signToken, isRateLimited, resetRateLimit } from '../auth.mjs';

const getIp = (req) =>
  (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim();

export const handleAdminLogin = async (req, res, { body, sendJson, origin }) => {
  const ip = getIp(req);

  if (isRateLimited(ip)) {
    sendJson(res, 429, { success: false, error: 'Too many login attempts. Try again in 15 minutes.' }, origin);
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

  const valid = verifyLogin(username.trim(), password);

  if (!valid) {
    sendJson(res, 401, { success: false, error: 'Invalid credentials.' }, origin);
    return;
  }

  resetRateLimit(ip);
  const token = signToken({ username, role: 'admin' });
  sendJson(res, 200, { success: true, token }, origin);
};
