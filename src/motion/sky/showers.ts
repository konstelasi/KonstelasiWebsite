/**
 * The main yearly meteor showers. Each one's meteors seem to fly out of one
 * point in the sky, its radiant, so while a shower is active and its radiant
 * is up, the shooting stars in the scene point away from it.
 *
 * Dates and radiants are the International Meteor Organization's figures at
 * each peak. A radiant drifts a little over the weeks, which doesn't show at
 * this scale. `zhr` is how many meteors an hour the peak brings under a
 * perfect sky, which weighs overlapping showers against each other.
 */

export interface Shower {
  /** The name in English, and in Indonesian, which uses the singular. */
  en: string;
  id: string;
  /** Active from and to, and the peak, as [month, day]. */
  start: [number, number];
  end: [number, number];
  peak: [number, number];
  /** Radiant right ascension and declination, in degrees. */
  ra: number;
  dec: number;
  zhr: number;
}

export const showers: Shower[] = [
  { en: 'Quadrantids', id: 'Quadrantid', start: [12, 28], end: [1, 12], peak: [1, 3], ra: 230, dec: 49, zhr: 110 },
  { en: 'Lyrids', id: 'Lyrid', start: [4, 14], end: [4, 30], peak: [4, 22], ra: 271, dec: 34, zhr: 18 },
  { en: 'Eta Aquariids', id: 'Eta Aquariid', start: [4, 19], end: [5, 28], peak: [5, 6], ra: 338, dec: -1, zhr: 50 },
  { en: 'Southern Delta Aquariids', id: 'Delta Aquariid Selatan', start: [7, 12], end: [8, 23], peak: [7, 31], ra: 340, dec: -16, zhr: 25 },
  { en: 'Perseids', id: 'Perseid', start: [7, 17], end: [8, 24], peak: [8, 12], ra: 48, dec: 58, zhr: 100 },
  { en: 'Orionids', id: 'Orionid', start: [10, 2], end: [11, 7], peak: [10, 21], ra: 95, dec: 16, zhr: 20 },
  { en: 'Leonids', id: 'Leonid', start: [11, 6], end: [11, 30], peak: [11, 17], ra: 152, dec: 22, zhr: 15 },
  { en: 'Geminids', id: 'Geminid', start: [12, 4], end: [12, 20], peak: [12, 14], ra: 112, dec: 33, zhr: 150 },
];

/** Day of the year, 0 to 365, for a [month, day] pair. */
function dayOf([month, day]: [number, number]): number {
  return Math.round((Date.UTC(2001, month - 1, day) - Date.UTC(2001, 0, 1)) / 86400000);
}

/** Days from `a` forward to `b` around the year. */
function ahead(a: number, b: number): number {
  return (b - a + 365) % 365;
}

/**
 * The strongest shower active at `ms` (in WIB, by calendar date), weighted by
 * how close it is to its peak, or null outside every shower.
 */
export function activeShower(ms: number): Shower | null {
  const wib = new Date(ms + 7 * 3600000);
  const today = dayOf([wib.getUTCMonth() + 1, wib.getUTCDate()]);
  let best: Shower | null = null;
  let bestWeight = 0;
  for (const s of showers) {
    const start = dayOf(s.start);
    const length = ahead(start, dayOf(s.end));
    const into = ahead(start, today);
    if (into > length) continue;
    const toPeak = ahead(start, dayOf(s.peak));
    const rise = into <= toPeak ? into / Math.max(1, toPeak) : (length - into) / Math.max(1, length - toPeak);
    const weight = s.zhr * (0.2 + 0.8 * rise);
    if (weight > bestWeight) {
      bestWeight = weight;
      best = s;
    }
  }
  return best;
}
