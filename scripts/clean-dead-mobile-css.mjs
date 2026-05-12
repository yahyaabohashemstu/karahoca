#!/usr/bin/env node
/**
 * Phase 1 of the mobile-design audit: prune dead CSS.
 *
 * The site historically had a separate mobile.css with classes prefixed
 * `.m-*` (`.m-header`, `.m-hero`, `.m-brandCard`, `.m-flipbookSection`, …).
 * That file was merged into main.css when the mobile-specific React tree
 * was retired, but the rules themselves were never deleted — the live
 * components use the shared desktop classes and `.m-*` matches nothing.
 *
 * This script walks main.css character-by-character with a brace-depth
 * counter, identifies every rule (PLAIN selector OR at-rule like `@media`
 * with a body), and recursively prunes any inner rule whose FIRST selector
 * starts with `.m-`. At-rule wrappers themselves are preserved if they
 * still contain ≥1 live rule after pruning; emptied @media blocks are
 * also dropped to keep the file tidy.
 *
 * "Dead" rule = every comma-separated part of the selector list starts
 * with `.m-`. A mixed list like `.m-card, .news-card { … }` keeps the
 * whole rule (the live half wins).
 *
 * Idempotent. Re-running on a cleaned file is a no-op.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(__dirname, '..', 'src', 'styles', 'main.css');
const src = fs.readFileSync(cssPath, 'utf8');

/**
 * A comma-part of a selector is "dead" iff it references a `.m-*` class
 * ANYWHERE in the chain (not just the leading compound). Example:
 *   `.m-card`                          → dead   (leading)
 *   `body.light-mode .m-footer p`      → dead   (descendant)
 *   `.news-card.m-foo`                 → dead   (compound)
 *   `.m-card, .news-card`              → NOT all-dead, the live half wins
 *   `.container`                       → live
 *
 * We use a global regex (no `^` anchor) so `.m-*` matches in any position.
 * `\b` doesn't work before `.` because `.` is not a word char; we instead
 * require either start-of-string or a non-word/non-dot character before
 * `.m-`, which avoids matching `.confirm-` etc.
 */
const DEAD_ANY_RE = /(^|[^A-Za-z0-9_-])\.m-[A-Za-z_]/;
let droppedCount = 0;

/**
 * Tokenise a CSS source string into a flat list of top-level segments,
 * where each segment is either:
 *   { kind: 'rule',    selector: '…', body: '…'  }  → has `{ … }`
 *   { kind: 'at-rule', prelude:  '…', body: '…'  }  → @media / @supports / etc.
 *   { kind: 'at-stmt', text: '…'  }                  → @import / @charset (no body)
 *   { kind: 'verbatim', text: '…' }                  → comments, blank lines, etc.
 *
 * The split is done by scanning braces while respecting `/* … *\/` block
 * comments and string literals so a `}` inside `content: "}"` doesn't
 * trip the parser.
 */
function tokenize(input) {
  const tokens = [];
  let i = 0;
  let buf = '';
  const n = input.length;

  // Helper: skip a block comment starting at `i` (assumes input[i..i+1] = "/*").
  const skipComment = (start) => {
    let k = start + 2;
    while (k < n - 1 && !(input[k] === '*' && input[k + 1] === '/')) k += 1;
    return Math.min(k + 2, n);
  };
  // Helper: skip a string literal starting at `i` (single or double quoted).
  const skipString = (start, quote) => {
    let k = start + 1;
    while (k < n) {
      if (input[k] === '\\') { k += 2; continue; }
      if (input[k] === quote) return k + 1;
      k += 1;
    }
    return n;
  };

  while (i < n) {
    const ch = input[i];

    if (ch === '/' && input[i + 1] === '*') {
      const end = skipComment(i);
      buf += input.slice(i, end);
      i = end;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const end = skipString(i, ch);
      buf += input.slice(i, end);
      i = end;
      continue;
    }

    if (ch === '{') {
      // Selector or at-rule prelude is whatever buf accumulated, minus a
      // trailing run of verbatim whitespace/comments that should travel
      // WITH the rule (so we keep the rule's leading comment in place).
      const prelude = buf;
      buf = '';
      // Now scan the body. Track depth so nested `{ … }` (e.g. nested
      // at-rules inside @supports) are captured as a single body string.
      let depth = 1;
      let bodyStart = i + 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        const cj = input[j];
        if (cj === '/' && input[j + 1] === '*') {
          j = skipComment(j);
          continue;
        }
        if (cj === '"' || cj === "'") {
          j = skipString(j, cj);
          continue;
        }
        if (cj === '{') depth += 1;
        else if (cj === '}') depth -= 1;
        if (depth === 0) break;
        j += 1;
      }
      const body = input.slice(bodyStart, j);
      i = j + 1; // step over the closing `}`

      // Strip leading comments + whitespace BEFORE deciding rule vs at-rule.
      // A multi-line block comment immediately above an `@media` (very common
      // in this codebase as section banners) otherwise pushes the `@` past
      // the start of the trimmed prelude and the whole @media gets parsed
      // as a regular rule, swallowing thousands of inner lines into its
      // "body" without recursion.
      const preludeNoComments = prelude.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (preludeNoComments.startsWith('@')) {
        tokens.push({
          kind: 'at-rule',
          prelude,
          body,
        });
      } else {
        tokens.push({
          kind: 'rule',
          selector: prelude,
          body,
        });
      }
      continue;
    }

    if (ch === ';') {
      // At-statement (no body): @import / @charset / @namespace.
      buf += ch;
      const trimmed = buf.trim();
      if (trimmed.startsWith('@')) {
        tokens.push({ kind: 'at-stmt', text: buf });
      } else {
        // A stray `;` at top level — treat as verbatim so nothing is lost.
        tokens.push({ kind: 'verbatim', text: buf });
      }
      buf = '';
      i += 1;
      continue;
    }

    buf += ch;
    i += 1;
  }

  if (buf.length > 0) {
    tokens.push({ kind: 'verbatim', text: buf });
  }
  return tokens;
}

/** Strip CSS comments + collapse whitespace for selector analysis. */
function normaliseSelector(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}

/** True iff EVERY comma-separated selector part references a `.m-*` class. */
function isAllDead(selector) {
  const parts = normaliseSelector(selector)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 && parts.every((p) => DEAD_ANY_RE.test(p));
}

/** Process a body string: prune dead rules recursively, return new body. */
function pruneBody(body) {
  const tokens = tokenize(body);
  const kept = [];
  for (const tok of tokens) {
    if (tok.kind === 'rule') {
      if (isAllDead(tok.selector)) {
        droppedCount += 1;
        continue;
      }
      // Live rule — its body is property declarations only, no nested
      // rules in standard CSS, so we don't need to recurse. (CSS nesting
      // is not used in this codebase.)
      kept.push(`${tok.selector}{${tok.body}}`);
    } else if (tok.kind === 'at-rule') {
      const cleanedBody = pruneBody(tok.body);
      // Drop the wrapper if pruning emptied it (e.g. a @media that only
      // contained dead `.m-*` rules).
      const isMeaningful = cleanedBody.replace(/\s|\/\*[\s\S]*?\*\//g, '').length > 0;
      if (!isMeaningful) {
        droppedCount += 1;
        continue;
      }
      kept.push(`${tok.prelude}{${cleanedBody}}`);
    } else if (tok.kind === 'at-stmt') {
      kept.push(tok.text);
    } else {
      kept.push(tok.text);
    }
  }
  return kept.join('');
}

const originalLines = src.split('\n').length;
const cleaned = pruneBody(src);
fs.writeFileSync(cssPath, cleaned, 'utf8');
const newLines = cleaned.split('\n').length;

console.log(`✓ main.css: ${originalLines} → ${newLines} lines (-${originalLines - newLines})`);
console.log(`✓ dropped ${droppedCount} dead rule(s) / empty wrapper(s)`);
