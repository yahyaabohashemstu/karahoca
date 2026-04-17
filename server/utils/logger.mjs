import pino from 'pino';

// ═══════════════════════════════════════════════════════════════════════════
// Central Pino logger
// ─────────────────────────────────────────────────────────────────────────
// Every module in server/ imports from here (or via requestContext.getLogger
// for request-scoped child loggers). We never call console.* in server code
// — raw stdout strings are unparseable for log pipelines (Loki / CloudWatch
// / Coolify's attached-log viewer).
//
// Level:
//   - tests  → 'silent'  (keeps CI output clean; tests read return values)
//   - dev    → 'debug'   (LOG_LEVEL env overrides)
//   - prod   → 'info'    (LOG_LEVEL env overrides)
//
// Serializers:
//   - req / res get pino's defaults PLUS our reqId (populated by
//     pino-http / requestContext).
//   - errors are serialized with cause chain.
//
// Redaction:
//   - strips common secret-bearing fields from logs so tokens / passwords
//     never hit disk even if a handler accidentally logs its own body.
// ═══════════════════════════════════════════════════════════════════════════

const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';

const DEFAULT_LEVEL = isTest ? 'silent' : (isProduction ? 'info' : 'debug');

export const logger = pino({
  level: process.env.LOG_LEVEL || DEFAULT_LEVEL,
  base: {
    // Drop the default pid/hostname noise; we add what we want explicitly.
    service: 'karahoca-api',
    env: process.env.NODE_ENV || 'development',
    ...(process.env.APP_VERSION ? { version: process.env.APP_VERSION } : {}),
    ...(process.env.GIT_COMMIT ? { commit: process.env.GIT_COMMIT } : {}),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    // Emit level as the string ('info', 'error') instead of the numeric
    // (30, 50). Downstream log viewers and grep -E patterns love this.
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      // Authorization headers & cookies
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'res.headers["set-cookie"]',
      // Common body-level secrets
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
      '*.api_key',
      'body.password',
      'body.token',
    ],
    remove: true,
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.socket?.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

/**
 * Startup banner. Called once at boot so operators can confirm the logger
 * is wired and the expected env flags are in effect. Uses the base logger
 * (no request context yet at boot time).
 */
export const logStartup = (extra = {}) => {
  logger.info(
    {
      node: process.version,
      platform: process.platform,
      ...extra,
    },
    '[startup] logger initialized',
  );
};
