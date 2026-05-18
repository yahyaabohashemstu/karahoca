/**
 * server/routes/admin-ab-tests.mjs — admin CRUD for A/B experiments
 * and a thin handler that exposes the public /api/ab/active feed
 * (the one the SPA hits on boot to know which experiments are
 * currently assigning).
 *
 * Route surface:
 *
 *   Admin (auth + CSRF, behind /api/admin/ab-tests)
 *     GET    /api/admin/ab-tests              list experiments + variants
 *     POST   /api/admin/ab-tests              create experiment (status=draft)
 *     GET    /api/admin/ab-tests/{id}         single experiment + results
 *     PUT    /api/admin/ab-tests/{id}         update experiment fields
 *     POST   /api/admin/ab-tests/{id}/start   draft → running, stamps started_at
 *     POST   /api/admin/ab-tests/{id}/stop    running → stopped, stamps stopped_at
 *     DELETE /api/admin/ab-tests/{id}         hard delete (variants ON CASCADE)
 *     POST   /api/admin/ab-tests/{id}/variants            add variant
 *     PUT    /api/admin/ab-tests/{id}/variants/{vkey}     update weight/label
 *     DELETE /api/admin/ab-tests/{id}/variants/{vkey}     remove variant
 *
 *   Public (anonymous)
 *     GET    /api/ab/active                   running experiments + variants
 *
 * The /api/ab/active feed is the *only* thing the SPA needs at run-time;
 * variant assignment happens client-side via FNV-1a hashing in
 * useExperiment.ts so we never round-trip per page-view.
 */

import { getDb, logAudit } from '../db.mjs';
import { computeExperimentResults, listRunningExperiments } from '../services/abTesting.mjs';

const VALID_STATUSES = new Set(['draft', 'running', 'stopped', 'done']);

const readExperiment = (db, id) => db.prepare(`
  SELECT id, key, name, description, status, goal_event, started_at, stopped_at, created_at, updated_at
  FROM ab_experiments WHERE id=?
`).get(id);

const readVariants = (db, experimentId) => db.prepare(`
  SELECT id, variant_key, label, weight, created_at
  FROM ab_variants WHERE experiment_id=? ORDER BY id ASC
`).all(experimentId);

// ─── Admin handler ──────────────────────────────────────────────────────────
export const handleAdminAbTests = (req, res, { body, sendJson, origin, url, admin }) => {
  const db = getDb();
  const adminUser = admin?.username || 'admin';

  // /api/admin/ab-tests/{id}/start  | /stop
  const startMatch = url.match(/^\/api\/admin\/ab-tests\/(\d+)\/start$/);
  const stopMatch  = url.match(/^\/api\/admin\/ab-tests\/(\d+)\/stop$/);
  if (startMatch && req.method === 'POST') {
    const id = Number(startMatch[1]);
    db.prepare(`UPDATE ab_experiments SET status='running', started_at=COALESCE(started_at, datetime('now')), updated_at=datetime('now') WHERE id=?`).run(id);
    const exp = readExperiment(db, id);
    logAudit({ action: 'UPDATE', entityType: 'ab_test', entityId: id, entityName: `Started experiment "${exp?.key}"`, adminUser });
    sendJson(res, 200, { success: true, experiment: exp }, origin);
    return;
  }
  if (stopMatch && req.method === 'POST') {
    const id = Number(stopMatch[1]);
    db.prepare(`UPDATE ab_experiments SET status='stopped', stopped_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(id);
    const exp = readExperiment(db, id);
    logAudit({ action: 'UPDATE', entityType: 'ab_test', entityId: id, entityName: `Stopped experiment "${exp?.key}"`, adminUser });
    sendJson(res, 200, { success: true, experiment: exp }, origin);
    return;
  }

  // Variants
  const variantsMatch = url.match(/^\/api\/admin\/ab-tests\/(\d+)\/variants(?:\/([^/]+))?$/);
  if (variantsMatch) {
    const expId = Number(variantsMatch[1]);
    const vkey = variantsMatch[2] ? decodeURIComponent(variantsMatch[2]) : null;
    const exp = readExperiment(db, expId);
    if (!exp) { sendJson(res, 404, { success: false, error: 'Experiment not found.' }, origin); return; }

    if (req.method === 'POST' && !vkey) {
      const variant_key = String(body.variant_key || '').trim();
      const label = String(body.label || '').trim();
      const weight = Math.max(0, Math.floor(Number(body.weight) || 1));
      if (!variant_key) { sendJson(res, 400, { success: false, error: 'variant_key required.' }, origin); return; }
      try {
        db.prepare(`INSERT INTO ab_variants(experiment_id, variant_key, label, weight) VALUES(?,?,?,?)`)
          .run(expId, variant_key, label, weight);
      } catch (e) {
        sendJson(res, 409, { success: false, error: `Variant key "${variant_key}" already exists for this experiment.` }, origin);
        return;
      }
      logAudit({ action: 'CREATE', entityType: 'ab_variant', entityId: `${exp.key}/${variant_key}`, entityName: `Variant "${variant_key}" for "${exp.key}"`, adminUser });
      sendJson(res, 201, { success: true, variants: readVariants(db, expId) }, origin);
      return;
    }
    if (req.method === 'PUT' && vkey) {
      const label = body.label !== undefined ? String(body.label) : null;
      const weight = body.weight !== undefined ? Math.max(0, Math.floor(Number(body.weight) || 0)) : null;
      const sets = [];
      const params = [];
      if (label !== null) { sets.push('label=?'); params.push(label); }
      if (weight !== null) { sets.push('weight=?'); params.push(weight); }
      if (sets.length === 0) { sendJson(res, 400, { success: false, error: 'Nothing to update.' }, origin); return; }
      params.push(expId, vkey);
      db.prepare(`UPDATE ab_variants SET ${sets.join(', ')} WHERE experiment_id=? AND variant_key=?`).run(...params);
      logAudit({ action: 'UPDATE', entityType: 'ab_variant', entityId: `${exp.key}/${vkey}`, entityName: `Variant "${vkey}" for "${exp.key}"`, adminUser });
      sendJson(res, 200, { success: true, variants: readVariants(db, expId) }, origin);
      return;
    }
    if (req.method === 'DELETE' && vkey) {
      db.prepare(`DELETE FROM ab_variants WHERE experiment_id=? AND variant_key=?`).run(expId, vkey);
      logAudit({ action: 'DELETE', entityType: 'ab_variant', entityId: `${exp.key}/${vkey}`, entityName: `Variant "${vkey}" for "${exp.key}"`, adminUser });
      sendJson(res, 200, { success: true, variants: readVariants(db, expId) }, origin);
      return;
    }
  }

  // /api/admin/ab-tests/{id}  — single read / update / delete
  const idMatch = url.match(/^\/api\/admin\/ab-tests\/(\d+)$/);
  if (idMatch) {
    const id = Number(idMatch[1]);
    const exp = readExperiment(db, id);
    if (!exp) { sendJson(res, 404, { success: false, error: 'Experiment not found.' }, origin); return; }

    if (req.method === 'GET') {
      const variants = readVariants(db, id);
      const results = computeExperimentResults(exp.key);
      sendJson(res, 200, { success: true, experiment: exp, variants, results }, origin);
      return;
    }
    if (req.method === 'PUT') {
      const fields = [];
      const params = [];
      for (const k of ['name', 'description', 'goal_event']) {
        if (body[k] !== undefined) { fields.push(`${k}=?`); params.push(String(body[k])); }
      }
      if (body.status !== undefined) {
        if (!VALID_STATUSES.has(body.status)) {
          sendJson(res, 400, { success: false, error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` }, origin);
          return;
        }
        fields.push('status=?'); params.push(body.status);
      }
      if (fields.length === 0) { sendJson(res, 400, { success: false, error: 'Nothing to update.' }, origin); return; }
      fields.push(`updated_at=datetime('now')`);
      params.push(id);
      db.prepare(`UPDATE ab_experiments SET ${fields.join(', ')} WHERE id=?`).run(...params);
      const updated = readExperiment(db, id);
      logAudit({ action: 'UPDATE', entityType: 'ab_test', entityId: id, entityName: `Updated experiment "${updated?.key}"`, adminUser });
      sendJson(res, 200, { success: true, experiment: updated }, origin);
      return;
    }
    if (req.method === 'DELETE') {
      db.prepare(`DELETE FROM ab_experiments WHERE id=?`).run(id);
      logAudit({ action: 'DELETE', entityType: 'ab_test', entityId: id, entityName: `Deleted experiment "${exp.key}"`, adminUser });
      sendJson(res, 200, { success: true }, origin);
      return;
    }
  }

  // /api/admin/ab-tests collection
  if (url === '/api/admin/ab-tests' && req.method === 'GET') {
    const exps = db.prepare(`SELECT * FROM ab_experiments ORDER BY id DESC`).all();
    const withVariants = exps.map((e) => ({ ...e, variants: readVariants(db, e.id) }));
    sendJson(res, 200, { success: true, experiments: withVariants }, origin);
    return;
  }
  if (url === '/api/admin/ab-tests' && req.method === 'POST') {
    const key = String(body.key || '').trim();
    const name = String(body.name || '').trim();
    const goal_event = String(body.goal_event || '').trim();
    const description = String(body.description || '').trim();
    if (!key) { sendJson(res, 400, { success: false, error: 'key required.' }, origin); return; }
    if (!name) { sendJson(res, 400, { success: false, error: 'name required.' }, origin); return; }
    if (!goal_event) { sendJson(res, 400, { success: false, error: 'goal_event required.' }, origin); return; }
    if (!/^[a-z0-9_-]+$/i.test(key)) {
      sendJson(res, 400, { success: false, error: 'key must be alphanumeric + underscore/dash.' }, origin);
      return;
    }
    try {
      const info = db.prepare(`
        INSERT INTO ab_experiments(key, name, description, status, goal_event)
        VALUES(?,?,?,?,?)
      `).run(key, name, description || null, 'draft', goal_event);
      // Seed two default variants — "control" and "variant_a" — so the
      // admin sees a working shape immediately.
      db.prepare(`INSERT INTO ab_variants(experiment_id, variant_key, label, weight) VALUES(?,?,?,?)`).run(info.lastInsertRowid, 'control',   'Control',   50);
      db.prepare(`INSERT INTO ab_variants(experiment_id, variant_key, label, weight) VALUES(?,?,?,?)`).run(info.lastInsertRowid, 'variant_a', 'Variant A', 50);
      const exp = readExperiment(db, info.lastInsertRowid);
      logAudit({ action: 'CREATE', entityType: 'ab_test', entityId: info.lastInsertRowid, entityName: `Created experiment "${key}"`, adminUser });
      sendJson(res, 201, { success: true, experiment: { ...exp, variants: readVariants(db, exp.id) } }, origin);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        sendJson(res, 409, { success: false, error: `An experiment with key "${key}" already exists.` }, origin);
      } else {
        sendJson(res, 500, { success: false, error: e.message }, origin);
      }
    }
    return;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
};

// ─── Public handler — exposes running experiments + variants ────────────────
export const handleAbActive = (req, res, { sendJson, origin }) => {
  const exps = listRunningExperiments();
  sendJson(res, 200, { success: true, experiments: exps }, origin);
};
