/**
 * Enforce the two house writing rules a script can check reliably.
 *
 * 1. No em dash or en dash anywhere in human-read files: page copy, content,
 *    interface strings, code comments, README.md and the Apache rules.
 * 2. No colon or semicolon in a heading or title. That covers Markdown
 *    headings, frontmatter titles and headings, the static text of <h1> to
 *    <h6> in .astro files, and copy properties named like a title.
 *
 * Agent-facing files (CLAUDE.md, AGENTS.md) are exempt by design. The rest
 * of the style guide (spaced hyphens used as dashes, colons in prose, the
 * generated-text patterns) is checked by review.
 *
 * Run with `npm run verify:copy`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SCAN_DIRS = ['src', 'scripts'];
const SCAN_FILES = ['README.md', 'public/.htaccess', 'public/robots.txt', 'astro.config.mjs', 'deploy.sh'];
const EXTENSIONS = /\.(astro|md|json|ts|mjs|css|sh)$/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.test(name)) out.push(full);
  }
  return out;
}

const files = [
  ...SCAN_DIRS.flatMap((d) => walk(join(root, d))),
  ...SCAN_FILES.map((f) => join(root, f)).filter((f) => {
    try {
      return statSync(f).isFile();
    } catch {
      return false;
    }
  }),
];

const problems: string[] = [];
const DASH = /[–—]/;
const TITLE_PUNCT = /[:;]/;

// A property that holds a title, in a copy object or in frontmatter.
const TITLE_KEY = /(?:^|[\s{,])(\w*(?:title|heading|headline|statement)\w*)\s*:\s*(?:(['"`])((?:(?!\2).)*)\2|([^'"`\s].*)$)/gi;

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/');
  if (rel === 'scripts/verify-copy.ts') continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const isMd = rel.endsWith('.md');
  let inFence = false;
  let inFrontmatter = isMd && lines[0]?.trim() === '---';

  lines.forEach((line, i) => {
    const where = `${rel}:${i + 1}`;
    if (DASH.test(line)) problems.push(`${where} has an em or en dash`);

    if (isMd) {
      if (i > 0 && inFrontmatter && line.trim() === '---') {
        inFrontmatter = false;
        return;
      }
      if (line.trim().startsWith('```')) inFence = !inFence;
      if (!inFence && !inFrontmatter && /^#{1,6}\s/.test(line) && TITLE_PUNCT.test(line.replace(/^#+\s*/, ''))) {
        problems.push(`${where} has a colon or semicolon in a heading`);
      }
    }

    if (isMd ? inFrontmatter : rel.endsWith('.astro') || rel.endsWith('.ts')) {
      for (const m of line.matchAll(TITLE_KEY)) {
        const value = (m[3] ?? m[4] ?? '').trim();
        // An unquoted value is copy only in frontmatter. In code it's a
        // variable or a call, not text.
        if ((m[3] !== undefined || isMd) && TITLE_PUNCT.test(value)) {
          problems.push(`${where} has a colon or semicolon in "${m[1]}"`);
        }
      }
    }
  });

  if (rel.endsWith('.astro')) {
    for (const m of text.matchAll(/<h([1-6])[^>]*>([^<{]*)<\/h\1>/g)) {
      if (TITLE_PUNCT.test(m[2])) {
        const lineNo = text.slice(0, m.index).split('\n').length;
        problems.push(`${rel}:${lineNo} has a colon or semicolon in an <h${m[1]}>`);
      }
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\nFAILED, ${problems.length} problem(s) in ${files.length} files`);
  process.exit(1);
}
console.log(`copy checks pass (${files.length} files)`);
