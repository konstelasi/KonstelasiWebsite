/**
 * Check the built site in dist/ for broken internal references.
 *
 * - Every internal link, stylesheet, script and image points at a file that
 *   exists, with `/path/` resolving to `/path/index.html` as on Apache.
 * - Every `og:image` and `canonical` URL on this site exists.
 * - Every indexed page has an English and an Indonesian `hreflang`
 *   alternate, both exist, and each of them lists the other in return.
 *
 * External links are not fetched. Run `npm run build` first, then
 * `npm run verify:links`.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SITE = 'https://konstelasi.co.id';
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

/** The file Apache would serve for a site path, or null for none. */
function fileFor(path: string): string | null {
  const clean = decodeURI(path.split(/[?#]/)[0]);
  const candidate = clean.endsWith('/') ? join(dist, clean, 'index.html') : join(dist, clean);
  return existsSync(candidate) && statSync(candidate).isFile() ? candidate : null;
}

/** The site path of a URL on this site, or null for an external one. */
function internal(url: string): string | null {
  if (url.startsWith(SITE)) return url.slice(SITE.length) || '/';
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return null;
}

/** The site path a built page answers at. */
function pathOf(file: string): string {
  const rel = '/' + relative(dist, file).replace(/\\/g, '/');
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
}

const pages = walk(dist).filter((f) => f.endsWith('.html'));
const problems: string[] = [];
const alternates = new Map<string, Map<string, string>>();
let checked = 0;

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const page = pathOf(file);

  const refs = [
    ...[...html.matchAll(/<(?:a|link)\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<(?:img|script)\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/\bsrcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+/)[0])),
    ...[...html.matchAll(/<meta\b[^>]*property="og:image"[^>]*content="([^"]+)"/g)].map((m) => m[1]),
  ];
  for (const ref of refs) {
    const path = internal(ref);
    if (path === null) continue;
    checked++;
    if (!fileFor(path)) problems.push(`${page} links to ${path}, which does not exist`);
  }

  if (/<meta name="robots" content="noindex"/.test(html)) continue;
  const alts = new Map<string, string>();
  for (const m of html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)) {
    alts.set(m[1], internal(m[2]) ?? m[2]);
  }
  alternates.set(page, alts);
  for (const lang of ['en', 'id']) {
    if (!alts.has(lang)) problems.push(`${page} has no hreflang="${lang}" alternate`);
  }
}

for (const [page, alts] of alternates) {
  for (const [lang, target] of alts) {
    if (lang === 'x-default') continue;
    const back = alternates.get(target);
    if (!back) {
      problems.push(`${page} lists ${target} as its ${lang} version, but that page was not built`);
    } else if (![...back.values()].includes(page)) {
      problems.push(`${target} does not list ${page} back as an alternate`);
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\nFAILED, ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`link checks pass (${pages.length} pages, ${checked} internal references, ${alternates.size} hreflang sets)`);
