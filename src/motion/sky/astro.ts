/**
 * Where things are in the sky over Yogyakarta, and where that lands on the
 * screen. No DOM here, so `scripts/verify-sky.ts` can check it in Node.
 *
 * Directions above the horizon are unit vectors in a local frame: x points
 * east, y north, z up. The camera always faces south and only tilts, so its
 * `alt` is the one thing that changes what's on screen.
 */

export const SITE = { name: 'Yogyakarta', lat: -7.8, lon: 110.37 };

export const RAD = Math.PI / 180;

/** Julian date of a moment in Unix milliseconds. */
export function julian(ms: number): number {
  return ms / 86400000 + 2440587.5;
}

/** Julian centuries since J2000, for the Sun and Moon series. */
export function centuries(ms: number): number {
  // The series run on Terrestrial Time, about 69 s ahead of UTC.
  return (julian(ms + 69000) - 2451545) / 36525;
}

/** Local sidereal time in degrees: which right ascension is due south now. */
export function sidereal(ms: number, lon = SITE.lon): number {
  const d = julian(ms) - 2451545;
  const T = d / 36525;
  const gmst = 280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000;
  return (((gmst + lon) % 360) + 360) % 360;
}

/**
 * Right ascension and declination (degrees) to a local direction, for a
 * sidereal time `lst` (degrees). Writes into `out` so the scene can reuse one
 * array.
 */
export function toLocal(ra: number, dec: number, lst: number, out: [number, number, number] = [0, 0, 0], lat = SITE.lat): [number, number, number] {
  const h = (lst - ra) * RAD;
  const d = dec * RAD;
  const p = lat * RAD;
  const cd = Math.cos(d);
  const sd = Math.sin(d);
  const ch = Math.cos(h);
  out[0] = -cd * Math.sin(h);
  out[1] = sd * Math.cos(p) - cd * ch * Math.sin(p);
  out[2] = sd * Math.sin(p) + cd * ch * Math.cos(p);
  return out;
}

/** A local direction as altitude and azimuth in degrees, azimuth from north through east. */
export function altAz(v: [number, number, number]): { alt: number; az: number } {
  const alt = Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD;
  let az = Math.atan2(v[0], v[1]) / RAD;
  if (az < 0) az += 360;
  return { alt, az };
}

export function fromAltAz(alt: number, az: number): [number, number, number] {
  const a = alt * RAD;
  const z = az * RAD;
  return [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)];
}

/**
 * Stereographic projection for a camera facing south, tilted up by `alt`
 * degrees. Returns screen offsets from the centre of the view in radians
 * (x right, y down), or null for a direction behind the camera. Stereographic
 * keeps shapes true, so a constellation looks the same anywhere on screen.
 */
export function project(v: [number, number, number], alt: number, out: [number, number] = [0, 0]): [number, number] | null {
  const s = Math.sin(alt * RAD);
  const c = Math.cos(alt * RAD);
  // Facing south, west is on the right and the zenith side is up.
  const X = -v[0];
  const Y = v[1] * s + v[2] * c;
  const Z = -v[1] * c + v[2] * s;
  if (Z < -0.6) return null;
  const k = 2 / (1 + Z);
  out[0] = X * k;
  out[1] = -Y * k;
  return out;
}

/** The camera tilt that puts the southern horizon exactly at the bottom edge. */
export function horizonAlt(height: number, scale: number): number {
  return (2 * Math.atan(height / 2 / (2 * scale))) / RAD;
}
