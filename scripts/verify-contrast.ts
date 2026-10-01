/**
 * Hold every text colour to WCAG AA (4.5:1) against every surface it can sit
 * on, in both themes.
 *
 * A build can't catch this. It accepts any six-digit hex, and a grey that
 * looks faint enough by eye is often below the floor. The tokens are read
 * straight out of `src/styles/tokens.css`, so a palette change is checked
 * without this file changing. Only the pairings below are this script's
 * opinion.
 *
 * Run with `npm run verify:contrast`.
 */

import { readFileSync } from 'node:fs';

const AA_NORMAL = 4.5;

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

/** Every `--token: #rrggbb;` inside the first block that `opener` matches. */
function readBlock(opener: RegExp, label: string): Map<string, string> {
  const start = css.search(opener);
  if (start < 0) throw new Error(`no ${label} block found in tokens.css`);
  const body = css.slice(start, css.indexOf('}', start));
  const tokens = new Map<string, string>();
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens.set(m[1], m[2]);
  }
  return tokens;
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ratio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const themes: Array<[string, Map<string, string>]> = [
  ['light', readBlock(/:root\s*{\s*color-scheme:\s*light/, 'light')],
  ['dark', readBlock(/:root:not\(\[data-theme="light"\]\)\s*{/, 'dark')],
];

/** Every surface text can land on. */
const SURFACES = ['bg', 'bg-raised', 'panel', 'panel-2'];

/** Every token used as a text colour, including `--brand` for links. */
const FOREGROUNDS = ['text', 'text-dim', 'text-faint', 'brand'];

/** Text on the violet band, which the aurora shades between three steps. */
const BAND_PAIRS: Array<[string, string]> = [
  ['on-brand-fill', 'brand-fill'],
  ['on-brand-dim', 'brand-fill'],
  ['on-brand-fill', 'brand-fill-2'],
  ['on-brand-dim', 'brand-fill-2'],
  ['on-brand-fill', 'brand-fill-3'],
  ['on-brand-dim', 'brand-fill-3'],
];

let failed = false;

for (const [name, tokens] of themes) {
  const tok = (t: string): string => {
    const v = tokens.get(t);
    if (!v) throw new Error(`token --${t} missing from the ${name} block`);
    return v;
  };
  const pairs: Array<[string, string]> = [
    ...FOREGROUNDS.flatMap((fg) => SURFACES.map((bg): [string, string] => [fg, bg])),
    ...BAND_PAIRS,
  ];
  console.log(`${name} theme`);
  for (const [fg, bg] of pairs) {
    const r = ratio(tok(fg), tok(bg));
    const line = `--${fg} on --${bg} (${r.toFixed(2)}:1)`;
    if (r < AA_NORMAL) {
      failed = true;
      console.error(`  FAIL ${line}, below ${AA_NORMAL}:1`);
    } else {
      console.log(`  ok   ${line}`);
    }
  }
}

console.log(failed ? '\nFAILED' : '\nall contrast checks pass');
process.exit(failed ? 1 : 0);
