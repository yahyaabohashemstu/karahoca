/**
 * Google Analytics 4 Data API integration.
 *
 * Required .env variables:
 *   GA_PROPERTY_ID          – numeric property ID, e.g. "123456789"
 *   GA_SERVICE_ACCOUNT_JSON – full JSON string of the service-account credentials file
 *
 * Setup guide (shown to admin when not configured):
 *   1. Open Google Cloud Console → IAM & Admin → Service Accounts → Create
 *   2. Download the JSON key file
 *   3. In GA4 Admin → Property Access Management → add the service-account email as Viewer
 *   4. In Google Cloud Console → APIs & Services → Enable "Google Analytics Data API"
 *   5. Copy the JSON content into .env as GA_SERVICE_ACCOUNT_JSON (one line, escaped)
 *   6. Set GA_PROPERTY_ID to your numeric property ID (found in GA4 Admin → Property Settings)
 */

import { createSign } from 'node:crypto';
import { addDays, fillDays, todayUtc } from '../utils/dateRange.mjs';

// ── Token cache ───────────────────────────────────────────────────────────────
let _cachedToken = null;
let _tokenExpiresAt = 0;

function getServiceAccount() {
  const raw = process.env.GA_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function getAccessToken(sa) {
  if (_cachedToken && Date.now() < _tokenExpiresAt) return _cachedToken;

  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  })).toString('base64url');

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(sa.private_key, 'base64url');
  const jwt = `${header}.${payload}.${sig}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error(`Google token error: ${JSON.stringify(data)}`);
  _cachedToken    = data.access_token;
  _tokenExpiresAt = Date.now() + 3500_000; // refresh 100 s before expiry
  return _cachedToken;
}

// ── GA4 Reporting API ─────────────────────────────────────────────────────────
async function runReport(token, propertyId, body) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GA4 API ${resp.status}: ${err}`);
  }
  return resp.json();
}

function parseRows(result, dimKeys, metricKeys) {
  return (result.rows ?? []).map(row => {
    const obj = {};
    (row.dimensionValues ?? []).forEach((v, i) => { obj[dimKeys[i]]    = v.value; });
    (row.metricValues   ?? []).forEach((v, i) => { obj[metricKeys[i]] = Number(v.value); });
    return obj;
  });
}

// "20250326" → "2025-03-26"
const gaDateToDay = (d) => {
  const s = String(d);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};

// ── Handler ───────────────────────────────────────────────────────────────────
// Auth: only reachable through api-admin.mjs, which runs requireAdminAuth
// before dispatching any /api/admin/* route. (A local `try { requireAuth }`
// used to sit here; requireAuth returns null instead of throwing, so it
// never rejected anything.)
export async function handleAdminGa(req, res, ctx) {
  const { sendJson, origin } = ctx;

  // ?days=30|60|90 — the same window as the Analytics page's period
  // selector (default 30, capped at 365). The GA KPIs used to be a fixed
  // 30 days while the page said "Last 90 days".
  const rawDays = parseInt(new URL(req.url, 'http://localhost').searchParams.get('days') || '30', 10);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 365) : 30;

  const propertyId = (process.env.GA_PROPERTY_ID || '').replace('properties/', '');
  const sa         = getServiceAccount();

  if (!propertyId || !sa) {
    sendJson(res, 200, {
      configured: false,
      message: 'GA4 not configured',
      steps: [
        'Go to Google Cloud Console → IAM & Admin → Service Accounts → Create service account',
        'Download the JSON key file for that service account',
        'In GA4: Admin → Property Access Management → add the service-account email as Viewer',
        'In Google Cloud Console: APIs & Services → Library → Enable "Google Analytics Data API"',
        'Add to your .env:  GA_PROPERTY_ID=XXXXXXXXX  (numeric only)',
        'Add to your .env:  GA_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  (one line)',
        'Restart the server',
      ],
      days,
    }, origin);
    return;
  }

  try {
    const token     = await getAccessToken(sa);
    const dateRange = { startDate: `${days}daysAgo`, endDate: 'today' };
    const order     = (metricName) => [{ metric: { metricName }, desc: true }];

    const [overview, byDay, byCountry, byPage, byDevice, bySource] = await Promise.all([
      // 1. Overall KPIs
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
      }),
      // 2. Sessions per day
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'date' }],
        metrics:    [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys:   [{ dimension: { dimensionName: 'date' } }],
      }),
      // 3. Top countries
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'country' }],
        metrics:    [{ name: 'sessions' }],
        orderBys:   order('sessions'),
        limit: 10,
      }),
      // 4. Top pages
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics:    [{ name: 'screenPageViews' }],
        orderBys:   order('screenPageViews'),
        limit: 10,
      }),
      // 5. Device category
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'deviceCategory' }],
        metrics:    [{ name: 'sessions' }],
        orderBys:   order('sessions'),
      }),
      // 6. Traffic channel
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics:    [{ name: 'sessions' }],
        orderBys:   order('sessions'),
        limit: 8,
      }),
    ]);

    // Parse KPIs
    const mv = overview.rows?.[0]?.metricValues ?? [];
    const summary = {
      sessions:            Number(mv[0]?.value ?? 0),
      activeUsers:         Number(mv[1]?.value ?? 0),
      newUsers:            Number(mv[2]?.value ?? 0),
      pageViews:           Number(mv[3]?.value ?? 0),
      bounceRate:          +(Number(mv[4]?.value ?? 0) * 100).toFixed(1),
      avgSessionDuration:  Math.round(Number(mv[5]?.value ?? 0)), // seconds
    };

    // Format day "2025-03-26" → "26/3"
    const fmtDay = (day) => `${parseInt(day.slice(8), 10)}/${parseInt(day.slice(5, 7), 10)}`;

    // GA omits days with no sessions; fill them with 0 so the trend line
    // doesn't run straight across a dead stretch. GA days are in the
    // property's timezone, so the range ends at whichever is later — its
    // last day or today (UTC) — and nothing GA returned is dropped.
    const dayRows = parseRows(byDay, ['date'], ['sessions', 'users'])
      .map(r => ({ ...r, date: gaDateToDay(r.date) }));
    const lastDay = dayRows.reduce((max, r) => (r.date > max ? r.date : max), todayUtc());
    const firstDay = dayRows.reduce((min, r) => (r.date < min ? r.date : min), addDays(lastDay, -days));
    const filledDays = fillDays(dayRows, firstDay, lastDay, 'date', (date) => ({ date, sessions: 0, users: 0 }));

    sendJson(res, 200, {
      configured: true,
      days,
      summary,
      byDay:     filledDays.map(r => ({ ...r, date: fmtDay(r.date) })),
      byCountry: parseRows(byCountry, ['country'], ['sessions']),
      byPage:    parseRows(byPage,    ['page'],    ['views']),
      byDevice:  parseRows(byDevice,  ['device'],  ['sessions']),
      bySource:  parseRows(bySource,  ['source'],  ['sessions']),
    }, origin);

  } catch (err) {
    sendJson(res, 500, { configured: true, days, error: err.message }, origin);
  }
}
