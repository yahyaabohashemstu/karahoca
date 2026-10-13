/**
 * RFC 8058 one-click unsubscribe headers for newsletter e-mails.
 *
 * Gmail and Yahoo expect them from bulk senders: the mail client shows its
 * own "Unsubscribe" button and POSTs `List-Unsubscribe=One-Click` (a form
 * body, not JSON) to the URL in the header. That URL therefore points at the
 * API endpoint, with the same signed token as the visible link — not at the
 * /unsubscribe page, which nginx serves as static files and answers a POST
 * with 405.
 */

const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

/**
 * @param {{ unsubscribeUrl: string, apiBaseUrl: string }} options
 *   unsubscribeUrl — the visible link (buildUnsubscribeUrl), its token is reused.
 * @returns {Record<string, string>} the two headers, or {} when either part is missing.
 */
export const buildListUnsubscribeHeaders = ({ unsubscribeUrl, apiBaseUrl }) => {
  let token = '';
  try {
    token = new URL(unsubscribeUrl).searchParams.get('token') || '';
  } catch {
    return {};
  }
  const base = trimTrailingSlash(typeof apiBaseUrl === 'string' ? apiBaseUrl.trim() : '');
  if (!token || !/^https?:\/\//i.test(base)) return {};

  return {
    'List-Unsubscribe': `<${base}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
};
