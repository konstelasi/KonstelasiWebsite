/**
 * Hold every built page to its JavaScript budget, measured gzipped.
 *
 * For each page in dist/, this follows the module scripts the page loads and
 * every chunk they import in turn, counts each file once, and sums their
 * gzipped sizes. The home pages carry the star field, the orbit and the
 * pinned sequences, so they get the larger budget.
 *
 * Run `npm run build` first, then `npm run verify:budget`.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const HOME_BUDGET = 160 * KB;
const PAGE_BUDGET = 110 * KB;

const dist = join(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'dist');
if (!existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const gzipped = new Map<string, number>();
function size(file: string): number {
  let n = gzipped.get(file);
  if (n === undefined) {
    n = gzipSync(readFileSync(file), { level: 9 }).length;
    gzipped.set(file, n);
  }
  return n;
}

/** Every JS file reachable from `entry` through static imports. */
function closure(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry) || !existsSync(entry)) return seen;
  seen.add(entry);
  const code = readFileSync(entry, 'utf8');
  for (const m of code.matchAll(/(?:import|from)\s*["']([^"']+\.js)["']/g)) {
    const spec = m[1];
    const next = spec.startsWith('/') ? join(dist, spec) : join(dirname(entry), spec);
    closure(next, seen);
  }
  return seen;
}

const pages = walk(dist).filter((f) => f.endsWith('.html'));
let failed = false;

for (const file of pages.sort()) {
  const html = readFileSync(file, 'utf8');
  const files = new Set<string>();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"/g)) {
    for (const f of closure(join(dist, m[1]))) files.add(f);
  }
  const total = [...files].reduce((sum, f) => sum + size(f), 0);
  const page = '/' + relative(dist, file).replace(/\\/g, '/').replace(/index\.html$/, '');
  const budget = page === '/' || page === '/id/' ? HOME_BUDGET : PAGE_BUDGET;
  const line = `${page} ${(total / KB).toFixed(1)} KB of ${budget / KB} KB`;
  if (total > budget) {
    failed = true;
    console.error(`  FAIL ${line}`);
  } else {
    console.log(`  ok   ${line}`);
  }
}

console.log(failed ? '\nFAILED' : '\nevery page is within its JS budget');
process.exit(failed ? 1 : 0);
