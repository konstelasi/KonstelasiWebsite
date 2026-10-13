/**
 * The Sun and the Moon, from the short series in Jean Meeus, "Astronomical
 * Algorithms" (chapters 25 and 47), truncated to the terms that matter at
 * screen scale. The Moon comes out within about 0.1° of its true place, which
 * is a fifth of its width. No DOM here, so `scripts/verify-sky.ts` can check
 * it in Node against JPL Horizons.
 */
import { RAD, SITE, centuries, sidereal, toLocal } from './astro.ts';

const sin = (deg: number): number => Math.sin(deg * RAD);
const cos = (deg: number): number => Math.cos(deg * RAD);
const norm = (deg: number): number => ((deg % 360) + 360) % 360;

/** Ecliptic longitude and latitude (degrees) to right ascension and declination. */
function equatorial(lon: number, lat: number, T: number): { ra: number; dec: number } {
  const e = 23.439291 - 0.0130042 * T;
  const ra = Math.atan2(sin(lon) * cos(e) - Math.tan(lat * RAD) * sin(e), cos(lon)) / RAD;
  const dec = Math.asin(sin(lat) * cos(e) + cos(lat) * sin(e) * sin(lon)) / RAD;
  return { ra: norm(ra), dec };
}

/** The Sun's ecliptic longitude (degrees) and distance (km). */
export function sun(ms: number): { lon: number; dist: number; ra: number; dec: number } {
  const T = centuries(ms);
  const L0 = 280.46646 + 36000.76983 * T;
  const M = 357.52911 + 35999.05029 * T;
  const C = (1.914602 - 0.004817 * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
  const e = 0.016708634 - 0.000042037 * T;
  const v = M + C;
  const au = (1.000001018 * (1 - e * e)) / (1 + e * cos(v));
  const lon = norm(L0 + C - 0.00569);
  return { lon, dist: au * 149597870.7, ...equatorial(lon, 0, T) };
}

// Meeus table 47.A: multiples of D, M, M', F, then the longitude term (1e-6°)
// and the distance term (metres).
const LR: number[][] = [
  [0, 0, 1, 0, 6288774, -20905355],
  [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888],
  [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158],
  [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620],
  [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755],
  [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782],
  [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636],
  [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675],
  [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445],
  [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003],
];

// Meeus table 47.B: multiples of D, M, M', F, then the latitude term (1e-6°).
const B: number[][] = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
];

/** The Moon seen from the centre of the Earth: ecliptic position and distance (km). */
export function moonGeocentric(ms: number): { lon: number; lat: number; dist: number; ra: number; dec: number } {
  const T = centuries(ms);
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.29 * T;
  const A3 = 313.45 + 481266.484 * T;

  let sl = 0;
  let sr = 0;
  for (const [d, m, mp, f, l, r] of LR) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sl += l * e * sin(arg);
    sr += r * e * cos(arg);
  }
  let sb = 0;
  for (const [d, m, mp, f, b] of B) {
    const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sb += b * e * sin(d * D + m * M + mp * Mp + f * F);
  }
  sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);

  const lon = norm(Lp + sl / 1e6);
  const lat = sb / 1e6;
  return { lon, lat, dist: 385000.56 + sr / 1000, ...equatorial(lon, lat, T) };
}

export type Phase =
  | 'new'
  | 'waxingCrescent'
  | 'firstQuarter'
  | 'waxingGibbous'
  | 'full'
  | 'waningGibbous'
  | 'lastQuarter'
  | 'waningCrescent';

export interface Moon {
  /** Direction from Yogyakarta, in the local frame of `astro.ts`. */
  dir: [number, number, number];
  /** Direction of the Sun, the same way, for lighting the disc. */
  sunDir: [number, number, number];
  /** Fraction of the disc that is lit, 0 to 1. */
  lit: number;
  /** Sun to Moon to Earth angle in degrees: 0 at full, 180 at new. */
  phaseAngle: number;
  phase: Phase;
  waxing: boolean;
}

const EARTH_RADIUS = 6378.14;

/** The Moon as seen from Yogyakarta at `ms`, with its phase. */
export function moon(ms: number): Moon {
  const m = moonGeocentric(ms);
  const s = sun(ms);
  const lst = sidereal(ms);

  // Seen from the surface rather than the centre of the Earth, the Moon
  // shifts by up to a degree. Work in equatorial vectors in km and subtract
  // where Yogyakarta is.
  const vec = (ra: number, dec: number, r: number): [number, number, number] => [
    r * cos(dec) * cos(ra),
    r * cos(dec) * sin(ra),
    r * sin(dec),
  ];
  const mv = vec(m.ra, m.dec, m.dist);
  const site = vec(lst, SITE.lat, EARTH_RADIUS);
  const tx = mv[0] - site[0];
  const ty = mv[1] - site[1];
  const tz = mv[2] - site[2];
  const tr = Math.hypot(tx, ty, tz);
  const ra = Math.atan2(ty, tx) / RAD;
  const dec = Math.asin(tz / tr) / RAD;

  // Phase, from the elongation between the two as seen from the Earth.
  const cosPsi = sin(m.dec) * sin(s.dec) + cos(m.dec) * cos(s.dec) * cos(m.ra - s.ra);
  const psi = Math.acos(Math.max(-1, Math.min(1, cosPsi)));
  const phaseAngle = Math.atan2(s.dist * Math.sin(psi), m.dist - s.dist * Math.cos(psi)) / RAD;
  const lit = (1 + Math.cos(phaseAngle * RAD)) / 2;
  const waxing = norm(m.lon - s.lon) < 180;

  let phase: Phase;
  if (lit < 0.02) phase = 'new';
  else if (lit > 0.98) phase = 'full';
  else if (Math.abs(lit - 0.5) < 0.04) phase = waxing ? 'firstQuarter' : 'lastQuarter';
  else if (lit < 0.5) phase = waxing ? 'waxingCrescent' : 'waningCrescent';
  else phase = waxing ? 'waxingGibbous' : 'waningGibbous';

  return {
    dir: toLocal(norm(ra), dec, lst),
    sunDir: toLocal(s.ra, s.dec, lst),
    lit,
    phaseAngle,
    phase,
    waxing,
  };
}
