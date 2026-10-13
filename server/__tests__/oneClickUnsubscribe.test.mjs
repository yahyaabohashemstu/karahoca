/**
 * RFC 8058 one-click unsubscribe: the List-Unsubscribe headers on newsletter
 * e-mails, the endpoint that receives the mail client's POST, and the
 * campaign template's localised wording.
 */
import { Readable } from 'node:stream';
import { describe, expect, it, vi, beforeEach } from 'vitest';

process.env.REDIS_URL = 'redis://127.0.0.1:1';
process.env.JWT_SECRET = 'vitest-newsletter-secret-at-least-32-chars';

const unsubscribeBySubscriberKey = vi.fn(() => ({ status: 'unsubscribed' }));
vi.mock('../services/newsletter.mjs', () => ({
  subscribeNewsletter: vi.fn(),
  unsubscribeBySubscriberKey: (key) => unsubscribeBySubscriberKey(key),
}));

const { buildListUnsubscribeHeaders } = await import('../services/listUnsubscribe.mjs');
const { buildUnsubscribeUrl } = await import('../newsletterTokens.mjs');
const { buildEmailContent } = await import('../routes/admin-campaigns.mjs');
const { handleNewsletterUnsubscribe } = await import('../routes/api-newsletter.mjs');

const unsubscribeUrl = buildUnsubscribeUrl({
  siteUrl: 'https://karahoca.com',
  subscriberKey: 'subscriber_key_1',
  lang: 'en',
});
const token = new URL(unsubscribeUrl).searchParams.get('token');

describe('buildListUnsubscribeHeaders', () => {
  it('points one-click at the API endpoint with the link’s token', () => {
    const headers = buildListUnsubscribeHeaders({ unsubscribeUrl, apiBaseUrl: 'https://api.karahoca.com/' });
    expect(headers['List-Unsubscribe']).toBe(
      `<https://api.karahoca.com/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}>`,
    );
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('adds nothing without a token or an absolute API base', () => {
    expect(buildListUnsubscribeHeaders({ unsubscribeUrl: 'https://karahoca.com/unsubscribe', apiBaseUrl: 'https://api.karahoca.com' })).toEqual({});
    expect(buildListUnsubscribeHeaders({ unsubscribeUrl, apiBaseUrl: '' })).toEqual({});
    expect(buildListUnsubscribeHeaders({ unsubscribeUrl: 'not a url', apiBaseUrl: 'https://api.karahoca.com' })).toEqual({});
  });
});

describe('buildEmailContent', () => {
  const build = (lang) => buildEmailContent({
    subject: 'Subject',
    body: 'Hello',
    lang,
    sendId: 7,
    unsubscribeUrl,
    imageUrl: null,
    requestHostOrigin: 'https://api.karahoca.com',
  });

  it('writes the template’s own words in the language sent', () => {
    expect(build('ar').html).toContain('النشرة الإخبارية الرسمية');
    expect(build('ar').html).toContain('جميع الحقوق محفوظة.');
    expect(build('tr').html).toContain('Resmi Bülten');
    expect(build('tr').html).toContain('Tüm hakları saklıdır.');
    expect(build('ru').html).toContain('Официальная рассылка');
    expect(build('ru').html).toContain('Все права защищены.');
    for (const lang of ['ar', 'tr', 'ru']) {
      expect(build(lang).html).not.toContain('Official Newsletter');
      expect(build(lang).html).not.toContain('All rights reserved.');
    }
    expect(build('en').html).toContain('Official Newsletter');
    expect(build('en').html).toContain('All rights reserved.');
  });

  it('returns the one-click headers for Resend', () => {
    const { headers } = build('en');
    expect(headers['List-Unsubscribe']).toMatch(/^<https?:\/\/[^>]+\/api\/newsletter\/unsubscribe\?token=[^>]+>$/);
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });
});

describe('POST /api/newsletter/unsubscribe', () => {
  let ip = 0;
  const call = async ({ url, body = '', contentType = 'application/json' }) => {
    const request = Readable.from(body ? [Buffer.from(body)] : []);
    request.method = 'POST';
    request.url = url;
    request.headers = { 'content-type': contentType };
    request.socket = { remoteAddress: `10.9.0.${++ip}` };
    const response = {
      status: 0,
      body: null,
      writeHead(status) { this.status = status; },
      end(payload) { this.body = JSON.parse(payload); },
    };
    await handleNewsletterUnsubscribe(request, response, { origin: '' });
    return response;
  };

  beforeEach(() => unsubscribeBySubscriberKey.mockClear());

  it('accepts the mail client’s one-click form POST with the token in the URL', async () => {
    const res = await call({
      url: `/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
      body: 'List-Unsubscribe=One-Click',
      contentType: 'application/x-www-form-urlencoded',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(unsubscribeBySubscriberKey).toHaveBeenCalledWith('subscriber_key_1');
  });

  it('still accepts the unsubscribe page’s JSON body', async () => {
    const res = await call({ url: '/api/newsletter/unsubscribe', body: JSON.stringify({ token }) });
    expect(res.status).toBe(200);
    expect(unsubscribeBySubscriberKey).toHaveBeenCalledWith('subscriber_key_1');
  });

  it('rejects a bad token either way', async () => {
    const oneClick = await call({
      url: '/api/newsletter/unsubscribe?token=v1.bogus.sig',
      body: 'List-Unsubscribe=One-Click',
      contentType: 'application/x-www-form-urlencoded',
    });
    expect(oneClick.status).toBe(400);
    const json = await call({ url: '/api/newsletter/unsubscribe', body: JSON.stringify({ token: 'nope' }) });
    expect(json.status).toBe(400);
    expect(unsubscribeBySubscriberKey).not.toHaveBeenCalled();
  });
});
