#!/usr/bin/env node
/**
 * Defensive guardrail: enforce a hard upper bound on `!important`
 * declarations in public-facing CSS, so the cascade war Phase 2 eliminated
 * doesn't silently regrow. Counts are compared against a frozen budget;
 * any new usage beyond the budget fails the build.
 *
 * Runs in CI (via .github/workflows/ci.yml) and locally via `npm run lint`.
 * The budget can be lowered as cleanup progresses — lowering is always
 * welcome, raising requires deliberate action.
 *
 * Not using stylelint because:
 *   - stylelint + its plugins would add ~15 MB of node_modules for one rule
 *   - a grep-based check is adequate (we care about the count, not the
 *     AST context) and runs in <20 ms
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Budgets: the CURRENT count at time of writing. Lower freely when cleanup
// lands; raising MUST come with a comment justifying why. CI hard-fails on
// any number above the budget.
//
// Why these numbers: they are the result of Phase 2 cleanup (main.css:
// 317 → 113 then further reduced during this hardening pass). Admin.css
// and LanguageSwitcher.css are not yet cleaned; their current counts are
// frozen as ceilings so they can't grow, and will be lowered as cleanup
// tracks land.
const BUDGETS = [
  { file: 'src/styles/main.css', max: 109 },
  { file: 'src/styles/employee.css', max: 2 },
  { file: 'src/components/LanguageSwitcher.css', max: 10 },
  // admin.css is deliberately excluded — it's a separate cleanup track.
  // When admin.css is cleaned up, add it here with its new ceiling.
];

const countImportant = (filePath) => {
  try {
    const text = readFileSync(filePath, 'utf8');
    // Match `!important` as a whole word so we don't count it inside
    // comments like `/* no !important allowed */`. Simple approximation:
    // exclude lines where the token is inside a /* ... */ block on the
    // same line.
    const lines = text.split('\n');
    let count = 0;
    let inBlockComment = false;
    for (const rawLine of lines) {
      let line = rawLine;
      if (inBlockComment) {
        const end = line.indexOf('*/');
        if (end === -1) continue;
        line = line.slice(end + 2);
        inBlockComment = false;
      }
      // Strip inline /* ... */
      line = line.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '');
      // Track any unterminated block-comment opener
      const openIdx = line.indexOf('/*');
      if (openIdx !== -1) {
        inBlockComment = true;
        line = line.slice(0, openIdx);
      }
      if (line.includes('!important')) {
        count += line.match(/!important/g)?.length ?? 0;
      }
    }
    return count;
  } catch (err) {
    if (err.code === 'ENOENT') return -1;
    throw err;
  }
};

let hadFailure = false;

console.log('');
console.log('CSS !important budget enforcement');
console.log('─'.repeat(60));

for (const budget of BUDGETS) {
  const fullPath = path.join(projectRoot, budget.file);
  const count = countImportant(fullPath);

  if (count === -1) {
    console.log(`  [warn] ${budget.file}: file not found — skipping`);
    continue;
  }

  const verdict = count <= budget.max ? 'OK' : 'OVER BUDGET';
  const line = `  ${verdict.padEnd(12)} ${budget.file}: ${count} / ${budget.max}`;

  if (count > budget.max) {
    console.log(line);
    console.log(`               → ${count - budget.max} declaration(s) above the budget.`);
    console.log(`               → Lower the count, or lower the budget (requires reviewer sign-off).`);
    hadFailure = true;
  } else {
    const slack = budget.max - count;
    if (slack > 0 && count < budget.max) {
      // Encourage lowering the budget when slack accumulates.
      console.log(`${line}  (consider lowering the budget — ${slack} slack)`);
    } else {
      console.log(line);
    }
  }
}

console.log('─'.repeat(60));
console.log('');

if (hadFailure) {
  process.exit(1);
}
