import { getDb } from './db.mjs';

/**
 * Safe UPDATE-statement builder.
 *
 * Replaces the pattern `db.prepare(\`UPDATE t SET ${sets} ...\`)` with a
 * precompiled, cached, column-allowlisted equivalent. Column names are
 * validated at setup time against a strict identifier regex and NEVER
 * interpolated from user input at request time — only keys of the allow-
 * list are allowed to land in the SQL string.
 *
 * Why a builder: SQLite does not support parameterising column names, so
 * whitelisting is the only safe avenue. The former inline-template pattern
 * was safe today because field lists were hard-coded, but it left a
 * regression-prone surface: one developer adding an unvetted field to the
 * allow-list could reintroduce column injection in a single commit. This
 * module forces every identifier through `assertSafeIdent`, makes the
 * setup path the only place where SQL is assembled, and caches the
 * prepared statements per unique column-subset so repeated calls are as
 * fast as the old inline form.
 */

const SAFE_IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const assertSafeIdent = (name) => {
  if (typeof name !== 'string' || !SAFE_IDENT_RE.test(name)) {
    throw new Error(`[safeUpdate] unsafe SQL identifier: ${JSON.stringify(name)}`);
  }
};

const MAX_CACHED_STATEMENTS = 500;

/**
 * Create an updater function for a single table.
 *
 * @param {string}   table              Table name (validated at setup).
 * @param {string[]} allowedColumns     Columns the updater may touch.
 * @param {object}   [opts]
 * @param {boolean}  [opts.touchUpdatedAt=true]  Append `updated_at = datetime('now')` to every statement.
 * @param {string}   [opts.keyColumn='id']        Primary-key column used in the WHERE clause.
 * @returns {(id: string|number, fields: Record<string, unknown>) => { changes: number, skipped: boolean }}
 */
export const buildUpdater = (
  table,
  allowedColumns,
  { touchUpdatedAt = true, keyColumn = 'id' } = {},
) => {
  assertSafeIdent(table);
  assertSafeIdent(keyColumn);

  const allowed = new Set();
  for (const col of allowedColumns) {
    assertSafeIdent(col);
    if (col === keyColumn) {
      throw new Error(`[safeUpdate] ${table}: keyColumn ${keyColumn} must not appear in allowedColumns`);
    }
    allowed.add(col);
  }

  const cache = new Map();

  const getStatement = (cols) => {
    const cacheKey = cols.join(',');
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // Every identifier below has already been validated at setup time
    // (allowedColumns) or at this moment (ident regex). The only SQL
    // concatenation that happens is of constants from the allow-list.
    const setClauses = cols.map((col) => `${col} = @${col}`);
    if (touchUpdatedAt) {
      setClauses.push(`updated_at = datetime('now')`);
    }
    const sql = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${keyColumn} = @__safeUpdateId`;
    const stmt = getDb().prepare(sql);

    if (cache.size >= MAX_CACHED_STATEMENTS) {
      // FIFO eviction; the realistic upper bound on unique column subsets
      // per entity is in the low dozens, so this guard really only fires
      // if a caller abuses the API.
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }
    cache.set(cacheKey, stmt);
    return stmt;
  };

  return function updateRow(id, fields) {
    if (id === undefined || id === null) {
      throw new Error(`[safeUpdate] ${table}: id is required`);
    }

    if (!fields || typeof fields !== 'object') {
      return { changes: 0, skipped: true };
    }

    const cols = [];
    const params = { __safeUpdateId: id };
    for (const key of Object.keys(fields)) {
      if (!allowed.has(key)) continue;
      if (fields[key] === undefined) continue;
      cols.push(key);
      params[key] = fields[key];
    }

    if (cols.length === 0) return { changes: 0, skipped: true };

    cols.sort(); // canonical order so the cache key is stable
    const stmt = getStatement(cols);
    const result = stmt.run(params);
    return { changes: result.changes, skipped: false };
  };
};
