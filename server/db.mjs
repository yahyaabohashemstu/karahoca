// Backward-compatibility shim. The canonical database service now lives in
// `./services/db.mjs`. Existing routes that import from `../db.mjs` continue
// to work — they receive the same exports via this re-export.
//
// New code SHOULD import directly from `./services/db.mjs` (or a route module's
// own `../services/db.mjs`). This shim will be removed once the sweep is done.
export * from './services/db.mjs';
