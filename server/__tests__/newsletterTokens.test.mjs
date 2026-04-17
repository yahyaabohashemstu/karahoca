import { describe, expect, it } from 'vitest';

process.env.JWT_SECRET = 'vitest-newsletter-secret-at-least-32-chars';
process.env.NEWSLETTER_UNSUBSCRIBE_TOKEN_TTL_SEC = '31536000';

const {
  buildUnsubscribeUrl,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} = await import('../newsletterTokens.mjs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Newsletter unsubscribe tokens', () => {
  it('creates and verifies a valid unsubscribe token', () => {
    const token = createUnsubscribeToken({
      subscriberKey: 'subscriber_opaque_key_123',
      lang: 'tr',
      expiresInSec: 3600,
    });

    const payload = verifyUnsubscribeToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.subscriberKey).toBe('subscriber_opaque_key_123');
    expect(payload?.lang).toBe('tr');
    expect(payload?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects a tampered token', () => {
    const token = createUnsubscribeToken({
      subscriberKey: 'subscriber_opaque_key_123',
      lang: 'en',
      expiresInSec: 3600,
    });

    const tampered = `${token.slice(0, -1)}X`;
    expect(verifyUnsubscribeToken(tampered)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = createUnsubscribeToken({
      subscriberKey: 'subscriber_opaque_key_456',
      expiresInSec: 1,
    });

    await sleep(1200);
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it('builds a public unsubscribe URL without leaking an email address', () => {
    const url = buildUnsubscribeUrl({
      siteUrl: 'https://karahoca.com/',
      subscriberKey: 'opaque_subscriber_key',
      lang: 'ar',
    });

    expect(url).toContain('/unsubscribe?token=');
    expect(url).not.toContain('@');
    expect(url).not.toContain('email=');
  });
});
