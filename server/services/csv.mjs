/**
 * server/services/csv.mjs — tiny dependency-free CSV reader/writer.
 *
 * KARAHOCA's CSV needs are constrained to admin import/export of
 * products + a couple of analytics dumps. Pulling in `csv-parse` /
 * `papaparse` (the usual choices) is overkill for this footprint and
 * inflates the production docker image with multi-megabyte packages.
 *
 * The reader handles the subset of RFC 4180 we actually need:
 *
 *   - Comma-separated cells, optional CRLF or LF line endings.
 *   - Double-quoted cells for values containing comma / newline / quote.
 *   - Escaped quotes inside quoted cells (`""` → `"`).
 *   - Optional UTF-8 BOM at start of file (stripped silently).
 *   - Blank lines are skipped (defensive for files round-tripped
 *     through Excel which often appends a trailing CRLF).
 *
 * NOT supported (intentional):
 *   - Custom delimiters. Locale-CSV from Excel (semicolon-separated)
 *     must be re-saved as plain CSV before import.
 *   - Streaming mode. KARAHOCA's catalogue is ~120 products; loading
 *     the whole file into memory is fine. If we ever cross 50k rows
 *     the writer's `for-of` accumulator is the easy first place to
 *     swap for a Writable stream.
 *
 * The writer applies Excel-formula-injection sanitisation: any cell
 * starting with `=`, `+`, `-`, `@`, `\t`, `\r` is prefixed with `'` so
 * opening the file in Excel doesn't execute injected payloads (a
 * documented attack against poorly-sanitised admin exports).
 */

const QUOTE = '"';
const SEPARATOR = ',';

/**
 * Parse a CSV string into an array of rows, where each row is itself
 * an array of cell strings. The first row is treated as a header by
 * the higher-level `parseCsvObjects` wrapper, but parseCsvRows knows
 * nothing about headers — it just tokenises.
 */
export const parseCsvRows = (input) => {
  if (typeof input !== 'string' || input.length === 0) return [];
  // Strip BOM if present — Excel-on-Windows always writes one.
  let i = 0;
  if (input.charCodeAt(0) === 0xFEFF) i = 1;

  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  const pushCell = () => { row.push(cell); cell = ''; };
  const pushRow = () => {
    // Skip completely-empty trailing rows (just `\r\n` at end of file).
    if (row.length === 1 && row[0] === '') {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  const len = input.length;
  for (; i < len; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === QUOTE) {
        // Lookahead: doubled quote → literal quote.
        if (input[i + 1] === QUOTE) {
          cell += QUOTE;
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === QUOTE) {
      inQuotes = true;
      continue;
    }
    if (ch === SEPARATOR) {
      pushCell();
      continue;
    }
    if (ch === '\n') {
      pushCell();
      pushRow();
      continue;
    }
    if (ch === '\r') {
      // CRLF: consume the next \n if present, then break the row.
      pushCell();
      pushRow();
      if (input[i + 1] === '\n') i += 1;
      continue;
    }
    cell += ch;
  }
  // Flush trailing cell / row (file may not end in a newline).
  if (cell.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }
  return rows;
};

/**
 * Parse a CSV string into an array of plain objects using the first
 * row as keys. Unknown columns are preserved (under their header name)
 * so the caller can warn about extra fields without losing data.
 */
export const parseCsvObjects = (input) => {
  const rows = parseCsvRows(input);
  if (rows.length < 2) return { headers: rows[0] || [], records: [] };
  const headers = rows[0].map((h) => String(h || '').trim());
  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c] != null ? String(row[c]) : '';
    }
    records.push(obj);
  }
  return { headers, records };
};

const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Format a single cell for CSV output. Wraps in quotes when the cell
 * contains a comma, quote, or newline; doubles internal quotes; and
 * prefixes formula-leading characters with `'` for Excel safety.
 */
export const formatCsvCell = (value) => {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (FORMULA_LEAD.test(s)) s = `'${s}`;
  if (s.includes(QUOTE) || s.includes(SEPARATOR) || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

/**
 * Serialise an array of plain objects to CSV using the supplied column
 * list as the header order. Missing keys emit empty cells. Returns a
 * UTF-8 string with a BOM prefix (so Excel double-click open detects
 * the encoding and renders Arabic / Russian correctly).
 */
export const stringifyCsv = (records, columns) => {
  const cols = columns || (records[0] ? Object.keys(records[0]) : []);
  const lines = [cols.map(formatCsvCell).join(SEPARATOR)];
  for (const rec of records) {
    lines.push(cols.map((c) => formatCsvCell(rec ? rec[c] : '')).join(SEPARATOR));
  }
  // BOM prefix → Excel opens UTF-8 correctly on Windows. macOS Numbers
  // strips the BOM silently. Other tooling (LibreOffice, Python csv,
  // pandas) handle it without complaint.
  return '﻿' + lines.join('\r\n');
};
