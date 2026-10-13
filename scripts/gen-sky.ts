/**
 * Build the star field's sky data from two published sources.
 *
 * - Stars: the Yale Bright Star Catalogue, 5th edition (BSC5, public domain),
 *   from CDS. Every star with a position, down to about magnitude 6.5, which
 *   is what the eye sees on a dark night.
 * - Constellation figures: the lines from d3-celestial by Olaf Frohn
 *   (BSD-3-Clause), pinned below. Each line endpoint is matched to the nearest
 *   catalogue star, so the figures and the stars are one data set.
 *
 * Positions are moved from J2000 to `EPOCH` (proper motion, then precession),
 * so the sky is right to well under a tenth of a degree for decades. The
 * runtime only has to turn them into altitude and azimuth.
 *
 * Writes `src/motion/sky/stars.bin` (5 bytes a star, brightest first) and
 * `src/motion/sky/sky.json` (the epoch and the figures). Both are committed,
 * so this only runs when the data should change. Run with `npm run gen:sky`.
 */

import { writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const EPOCH = 2026.5;
const BSC = 'https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz';
const CELESTIAL = 'https://cdn.jsdelivr.net/npm/d3-celestial@0.7.35';
/** How close, in degrees, a line endpoint must be to a star to count as it. */
const SNAP = 0.3;

const RAD = Math.PI / 180;

async function get(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

interface Star {
  ra: number;
  dec: number;
  mag: number;
  /** J2000 position, for matching the figures, which are drawn in J2000. */
  ra0: number;
  dec0: number;
}

/** Precess an equatorial position from J2000 to `epoch` (IAU 1976). */
function precess(ra: number, dec: number, epoch: number): [number, number] {
  const T = (epoch - 2000) / 100;
  const as = RAD / 3600;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * as;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * as;
  const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * as;
  const a0 = ra * RAD + zeta;
  const d0 = dec * RAD;
  const A = Math.cos(d0) * Math.sin(a0);
  const B = Math.cos(theta) * Math.cos(d0) * Math.cos(a0) - Math.sin(theta) * Math.sin(d0);
  const C = Math.sin(theta) * Math.cos(d0) * Math.cos(a0) + Math.cos(theta) * Math.sin(d0);
  let a = (Math.atan2(A, B) + z) / RAD;
  if (a < 0) a += 360;
  if (a >= 360) a -= 360;
  return [a, Math.asin(C) / RAD];
}

function readCatalogue(text: string): Star[] {
  const stars: Star[] = [];
  const num = (line: string, from: number, to: number): number => Number(line.slice(from - 1, to));
  for (const line of text.split('\n')) {
    // A few entries (novae, clusters) were removed and have no position.
    if (line.length < 107 || !line.slice(75, 77).trim() || !line.slice(102, 107).trim()) continue;
    const ra0 = (num(line, 76, 77) + num(line, 78, 79) / 60 + num(line, 80, 83) / 3600) * 15;
    const sign = line[83] === '-' ? -1 : 1;
    const dec0 = sign * (num(line, 85, 86) + num(line, 87, 88) / 60 + num(line, 89, 90) / 3600);
    const mag = num(line, 103, 107);
    // pmRA is already multiplied by cos(Dec), in arcseconds a year.
    const pmRA = num(line, 149, 154) || 0;
    const pmDE = num(line, 155, 160) || 0;
    const years = EPOCH - 2000;
    const raPm = ra0 + (pmRA * years) / 3600 / Math.max(0.01, Math.cos(dec0 * RAD));
    const decPm = dec0 + (pmDE * years) / 3600;
    const [ra, dec] = precess(raPm, decPm, EPOCH);
    stars.push({ ra, dec, mag, ra0, dec0 });
  }
  return stars.sort((a, b) => a.mag - b.mag);
}

/** Angular distance in degrees. */
function separation(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const c =
    Math.sin(dec1 * RAD) * Math.sin(dec2 * RAD) + Math.cos(dec1 * RAD) * Math.cos(dec2 * RAD) * Math.cos((ra1 - ra2) * RAD);
  return Math.acos(Math.min(1, Math.max(-1, c))) / RAD;
}

interface Feature {
  id: string;
  properties: { name?: string; rank?: string };
  geometry: { coordinates: Array<Array<[number, number]>> };
}

const [catalogue, linesRaw, namesRaw, licence] = await Promise.all([
  get(BSC),
  get(`${CELESTIAL}/data/constellations.lines.json`),
  get(`${CELESTIAL}/data/constellations.json`),
  get(`${CELESTIAL}/LICENSE`),
]);
if (!/Redistribution and use in source and binary forms/.test(licence.toString())) {
  throw new Error('d3-celestial no longer ships the BSD licence this data was taken under. Check it before using the data.');
}

const stars = readCatalogue(gunzipSync(catalogue).toString('latin1'));

// Matching every endpoint against 9,000 stars is fine once, but a coarse grid
// by declination keeps it quick.
const bands = new Map<number, number[]>();
stars.forEach((s, i) => {
  const b = Math.floor(s.dec0);
  if (!bands.has(b)) bands.set(b, []);
  bands.get(b)!.push(i);
});
function nearest(ra: number, dec: number): number {
  let best = -1;
  let bestSep = SNAP;
  for (let b = Math.floor(dec) - 1; b <= Math.floor(dec) + 1; b++) {
    for (const i of bands.get(b) ?? []) {
      const d = separation(ra, dec, stars[i].ra0, stars[i].dec0);
      if (d < bestSep) {
        bestSep = d;
        best = i;
      }
    }
  }
  return best;
}

const names = new Map<string, string>();
for (const f of (JSON.parse(namesRaw.toString()) as { features: Feature[] }).features) {
  names.set(f.id, f.properties.name ?? f.id);
}

let missed = 0;
const figures: Array<{ name: string; rank: number; edges: Array<[number, number]> }> = [];
for (const f of (JSON.parse(linesRaw.toString()) as { features: Feature[] }).features) {
  const edges: Array<[number, number]> = [];
  const seen = new Set<string>();
  for (const line of f.geometry.coordinates) {
    const ids = line.map(([lon, lat]) => nearest(lon < 0 ? lon + 360 : lon, lat));
    for (let k = 1; k < ids.length; k++) {
      const a = ids[k - 1];
      const b = ids[k];
      if (a < 0 || b < 0) {
        missed++;
        continue;
      }
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (a === b || seen.has(key)) continue;
      seen.add(key);
      edges.push([a, b]);
    }
  }
  if (edges.length) figures.push({ name: names.get(f.id) ?? f.id, rank: Number(f.properties.rank ?? 3), edges });
}

// 5 bytes a star: RA as uint16 over the full circle, Dec as int16 over
// plus or minus 90°, and the magnitude times ten as int8.
const out = Buffer.alloc(stars.length * 5);
stars.forEach((s, i) => {
  out.writeUInt16LE(Math.round((s.ra / 360) * 65536) % 65536, i * 5);
  out.writeInt16LE(Math.round((s.dec / 90) * 32767), i * 5 + 2);
  out.writeInt8(Math.max(-128, Math.min(127, Math.round(s.mag * 10))), i * 5 + 4);
});

writeFileSync('src/motion/sky/stars.bin', out);
writeFileSync('src/motion/sky/sky.json', JSON.stringify({ epoch: EPOCH, stars: stars.length, figures }) + '\n');
const edgeCount = figures.reduce((n, f) => n + f.edges.length, 0);
console.log(`wrote ${stars.length} stars and ${figures.length} figures with ${edgeCount} lines`);
if (missed) console.log(`${missed} line segments had an end with no catalogue star within ${SNAP}°, and were left out`);
