/**
 * Hold the sky's maths to reference positions, so a change to it can't
 * quietly move the Moon or the stars.
 *
 * The Sun and Moon references are JPL Horizons' airless apparent altitude and
 * azimuth, and the Moon's lit fraction, seen from Yogyakarta (7.8° S,
 * 110.37° E). The star references come from Astronomy Engine 2.1.19 for the
 * same place. Each check compares directions, so it fails when a body is more
 * than half a degree off, wherever it is in the sky. Stars are read from the
 * committed `sky.json`, so a broken generator fails here too.
 *
 * Run with `npm run verify:sky`.
 */

import { readFileSync } from 'node:fs';
import { altAz, fromAltAz, sidereal, toLocal } from '../src/motion/sky/astro.ts';
import { decode, type SkyData } from '../src/motion/sky/catalogue.ts';
import { moon, sun } from '../src/motion/sky/ephemeris.ts';
import { activeShower } from '../src/motion/sky/showers.ts';

const LIMIT = 0.5;
const LIT_LIMIT = 0.02;

const at = (jd: number): number => (jd - 2440587.5) * 86400000;

/** Julian date, then the Moon's azimuth, altitude and lit percentage, then the Sun's azimuth and altitude. */
const bodies: Array<[number, number, number, number, number, number]> = [
  [2461050.3, 90.476695, 49.282748, 58.0199, 130.545144, -43.383167],
  [2461327.0, 247.335087, 8.715736, 7.95091, 258.149552, -22.184984],
  [2461330.5, 133.996858, -38.577337, 35.03562, 96.548212, 24.802532],
  [2461338.25, 289.470699, 43.215882, 97.09671, 128.964262, -58.778652],
  [2461345.6, 297.44603, 18.369027, 59.41991, 105.444002, 60.312454],
  [2461352.1, 202.358208, -66.899265, 3.09011, 230.298011, -52.051821],
  [2461600.9, 116.061202, 33.74361, 84.47647, 294.409916, 12.740745],
];

/** A star by its J2000 position (RA hours, Dec degrees), then Julian date, azimuth and altitude. */
const stars: Array<[string, number, number, Array<[number, number, number]>]> = [
  ['Acrux', 12.4433, -63.0992, [[2461327.0, 201.737, -7.892], [2461345.6, 179.864, 34.555], [2461050.3, 161.188, 27.797], [2461600.9, 179.655, 34.541]]],
  ['Antares', 16.4901, -26.432, [[2461327.0, 244.264, 26.094], [2461345.6, 116.074, 29.375], [2461050.3, 117.719, -5.399], [2461600.9, 116.036, 29.032]]],
  ['Sirius', 6.7525, -16.7161, [[2461327.0, 128.953, -50.847], [2461345.6, 253.954, 6.827], [2461050.3, 254.198, 44.163], [2461600.9, 253.988, 7.173]]],
];

let failed = false;
function check(label: string, got: [number, number, number], want: [number, number, number]): void {
  const dot = got[0] * want[0] + got[1] * want[1] + got[2] * want[2];
  const off = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
  const line = `${label} off by ${off.toFixed(3)}°`;
  if (off > LIMIT) {
    failed = true;
    console.error(`  FAIL ${line}`);
  } else {
    console.log(`  ok   ${line}`);
  }
}

for (const [jd, maz, malt, lit, saz, salt] of bodies) {
  const ms = at(jd);
  const m = moon(ms);
  check(`Moon at JD ${jd}`, m.dir, fromAltAz(malt, maz));
  const litOff = Math.abs(m.lit - lit / 100);
  if (litOff > LIT_LIMIT) {
    failed = true;
    console.error(`  FAIL Moon lit fraction at JD ${jd} off by ${(litOff * 100).toFixed(2)}%`);
  }
  const s = sun(ms);
  check(`Sun at JD ${jd}`, toLocal(s.ra, s.dec, sidereal(ms)), fromAltAz(salt, saz));
}

const root = new URL('../src/motion/sky/', import.meta.url);
const data = JSON.parse(readFileSync(new URL('sky.json', root), 'utf8')) as SkyData;
const catalogue = decode(data);
for (const [name, raH, dec0, refs] of stars) {
  // The brightest catalogue star within a degree of its J2000 place.
  let index = -1;
  for (let i = 0; i < catalogue.count && index < 0; i++) {
    const near = Math.abs(catalogue.dec[i] - dec0) < 1 && Math.abs(((catalogue.ra[i] - raH * 15 + 540) % 360) - 180) * Math.cos((dec0 * Math.PI) / 180) < 1;
    if (near) index = i;
  }
  if (index < 0) {
    failed = true;
    console.error(`  FAIL ${name} is missing from sky.json`);
    continue;
  }
  for (const [jd, az, alt] of refs) {
    const ms = at(jd);
    check(`${name} at JD ${jd}`, toLocal(catalogue.ra[index], catalogue.dec[index], sidereal(ms)), fromAltAz(alt, az));
  }
}

const october = activeShower(at(2461327.0));
if (october?.en !== 'Orionids') {
  failed = true;
  console.error(`  FAIL expected the Orionids on 13 October, got ${october?.en ?? 'none'}`);
}
if (activeShower(at(2461218.0)) !== null) {
  failed = true;
  console.error('  FAIL expected no shower on 26 June');
}

const { alt } = altAz(moon(at(2461327.0)).dir);
console.log(`\nMoon over Yogyakarta at 19:00 WIB on 13 October 2026 is ${alt.toFixed(1)}° up`);
console.log(failed ? '\nFAILED' : 'the sky matches its references');
process.exit(failed ? 1 : 0);
