import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_ADMIN_SECRET = 'karahoca_admin_secret_change_in_production';
const DEV_NEWSLETTER_SECRET = 'karahoca_newsletter_token_dev_secret_change_in_production';
const DEFAULT_UNSUBSCRIBE_TOKEN_TTL_SEC = 60 * 60 * 24 * 365; // 365 days
const isProduction = process.env.NODE_ENV === 'production';

let warnedAboutFallbackSecret = false;

const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

const resolveNewsletterSecret = () => {
  const configuredSecret = process.env.NEWSLETTER_TOKEN_SECRET || process.env.JWT_SECRET || '';

  if (configuredSecret && configuredSecret !== DEFAULT_ADMIN_SECRET) {
    return configuredSecret;
  }

  if (isProduction) {
    throw new Error('NEWSLETTER_TOKEN_SECRET or a strong JWT_SECRET must be configured in production.');
  }

  if (!warnedAboutFallbackSecret) {
    warnedAboutFallbackSecret = true;
    console.warn('[newsletter-tokens] Falling back to the development unsubscribe token secret.');
  }

  return DEV_NEWSLETTER_SECRET;
};

const getTokenTtlSeconds = () => {
  const raw = Number.parseInt(process.env.NEWSLETTER_UNSUBSCRIBE_TOKEN_TTL_SEC || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_UNSUBSCRIBE_TOKEN_TTL_SEC;
};

const encodeSegment = (value) => Buffer.from(value, 'utf8').toString('base64url');
const decodeSegment = (value) => Buffer.from(value, 'base64url').toString('utf8');

const signPayloadSegment = (payloadSegment) =>
  createHmac('sha256', resolveNewsletterSecret()).update(payloadSegment).digest('base64url');

export const createUnsubscribeToken = ({ subscriberKey, lang = 'ar', expiresInSec = getTokenTtlSeconds() }) => {
  if (typeof subscriberKey !== 'string' || !subscriberKey.trim()) {
    throw new Error('subscriberKey is required to generate an unsubscribe token.');
  }

  const payload = {
    v: 1,
    aud: 'newsletter-unsubscribe',
    sub: subscriberKey.trim(),
    lang: typeof lang === 'string' && lang.trim() ? lang.trim() : 'ar',
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
  };

  const payloadSegment = encodeSegment(JSON.stringify(payload));
  const signatureSegment = signPayloadSegment(payloadSegment);

  return `v1.${payloadSegment}.${signatureSegment}`;
};

export const verifyUnsubscribeToken = (token) => {
  if (typeof token !== 'string' || !token.trim()) {
    return null;
  }

  const [version, payloadSegment, signatureSegment] = token.trim().split('.');
  if (version !== 'v1' || !payloadSegment || !signatureSegment) {
    return null;
  }

  const expectedSignature = signPayloadSegment(payloadSegment);
  const providedBuffer = Buffer.from(signatureSegment, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeSegment(payloadSegment));

    if (
      payload?.v !== 1 ||
      payload?.aud !== 'newsletter-unsubscribe' ||
      typeof payload?.sub !== 'string' ||
      !payload.sub.trim() ||
      typeof payload?.exp !== 'number' ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      subscriberKey: payload.sub.trim(),
      lang: typeof payload?.lang === 'string' && payload.lang.trim() ? payload.lang.trim() : 'ar',
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
};

export const buildUnsubscribeUrl = ({ siteUrl, subscriberKey, lang }) => {
  const token = createUnsubscribeToken({ subscriberKey, lang });
  return `${trimTrailingSlash(siteUrl)}/unsubscribe?token=${encodeURIComponent(token)}`;
};
