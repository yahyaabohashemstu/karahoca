import { requireAuth } from '../auth.mjs';
import { sendJson } from './cors.mjs';

/**
 * Guard for `/api/admin/*` routes. Returns the decoded admin user payload
 * on success, or writes a 401 and returns `null` (the caller should early-
 * return in that case).
 */
export const requireAdminAuth = (request, response, requestOrigin) => {
  const user = requireAuth(request);
  if (!user || user.role !== 'admin') {
    sendJson(response, 401, { success: false, error: 'Unauthorized.' }, requestOrigin);
    return null;
  }
  return user;
};
