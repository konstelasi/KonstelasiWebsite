/**
 * The sky's clock, and the URL switches that take control of it for
 * debugging. Without a switch it is simply the real time.
 *
 * - `?sky-time=2026-10-20T21:00` starts the clock at that time in WIB, and
 *   lets it run on from there.
 * - `?sky-speed=600` runs time 600 times faster.
 * - `?sky-alt=40` pins the camera's tilt in degrees, whatever the scroll.
 * - `?sky-debug` opens the debug panel (`debug.ts`).
 */

const WIB = 7 * 3600000;

const params = new URLSearchParams(window.location.search);

function parseWib(value: string | null): number | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 21, m[5] ? +m[5] : 0) - WIB;
}

const startAt = parseWib(params.get('sky-time'));
const speedParam = Number(params.get('sky-speed'));
const altParam = params.get('sky-alt');

export const clock = {
  /** The sky time at `base` real time, and how fast it runs from there. */
  base: performance.now(),
  start: startAt ?? Date.now(),
  speed: speedParam > 0 ? speedParam : 1,
  /** A fixed camera tilt in degrees, or null to follow the scroll. */
  alt: altParam !== null && altParam !== '' && Number.isFinite(Number(altParam)) ? Number(altParam) : null,
  debug: params.has('sky-debug'),
};

/** The current sky time, in Unix milliseconds. */
export function skyNow(): number {
  return clock.start + (performance.now() - clock.base) * clock.speed;
}

/** True while the clock isn't simply the real time. */
export function simulated(): boolean {
  return Math.abs(skyNow() - Date.now()) > 60000 || clock.speed !== 1;
}

/** Moves the clock to `ms`, keeping its speed. */
export function setSkyTime(ms: number): void {
  clock.base = performance.now();
  clock.start = ms;
}

export function setSkySpeed(speed: number): void {
  setSkyTime(skyNow());
  clock.speed = speed;
}

/** Back to the real time at the real speed. */
export function resetClock(): void {
  clock.base = performance.now();
  clock.start = Date.now();
  clock.speed = 1;
}

/** The hours and minutes of `ms` in WIB, which has no daylight saving. */
export function wibTime(ms: number): { hours: number; minutes: number } {
  const d = new Date(ms + WIB);
  return { hours: d.getUTCHours(), minutes: d.getUTCMinutes() };
}
