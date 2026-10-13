/**
 * The one line in the bottom-left corner that says what sky is showing:
 * where, when, which way, the Moon's phase and any active meteor shower.
 *
 * Base.astro renders it hidden, with the page language's strings in
 * `data-sky-line`, and the scene starts it once the sky is running, so it
 * never describes a sky that isn't there.
 */
import type { Moon } from './ephemeris';
import type { Shower } from './showers';
import { simulated, skyNow, wibTime } from './clock';

interface Strings {
  line: string;
  timeSeparator: string;
  phases: Record<Moon['phase'], string>;
  belowHorizon: string;
  shower: string;
  simulated: string;
}

export function startSkyLine(read: () => { moon: Moon | null; shower: Shower | null }): void {
  const el = document.querySelector<HTMLElement>('[data-sky-line]');
  if (!el) return;
  let strings: Strings;
  try {
    strings = JSON.parse(el.dataset.skyLine ?? '') as Strings;
  } catch {
    return;
  }
  const lang = document.documentElement.lang === 'id' ? 'id' : 'en';

  const write = (): void => {
    const { moon, shower } = read();
    const now = skyNow();
    const { hours, minutes } = wibTime(now);
    const time = `${String(hours).padStart(2, '0')}${strings.timeSeparator}${String(minutes).padStart(2, '0')}`;
    const parts = [strings.line.replace('{time}', time)];
    const details: string[] = [];
    if (moon) {
      const phase = strings.phases[moon.phase];
      details.push(moon.dir[2] < 0 ? strings.belowHorizon.replace('{moon}', phase) : phase);
    }
    if (shower) details.push(strings.shower.replace('{name}', shower[lang]));
    if (details.length) {
      const text = details.join(', ');
      parts.push(text.charAt(0).toUpperCase() + text.slice(1) + '.');
    }
    if (simulated()) parts.push(strings.simulated);
    const line = parts.join(' ');
    if (el.textContent !== line) el.textContent = line;
  };

  write();
  el.hidden = false;
  window.setInterval(write, 1000);
}
