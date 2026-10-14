/**
 * The sky's debug panel, loaded only with `?sky-debug` in the URL, so normal
 * visitors never download it. It shows the numbers behind the picture and
 * takes keys that move the clock or fire events, because most of what the
 * sky shows (the Moon, a shower, a given figure) only happens at some hours.
 *
 * Keys:
 * - `[` and `]` step time by an hour, `,` and `.` by a day, `0` goes back to now.
 * - `M` jumps to the next time the Moon is in view.
 * - `S` fires a shooting star, `T` sends a satellite.
 * - `G` toggles a grid of altitude and azimuth, with the horizon, the
 *   meridian, the zenith, the compass points and the active radiant.
 * - `L` draws every constellation in view, with its name.
 */
import type { SkyHooks } from '../scene';
import { clock, resetClock, setSkyTime, skyNow, wibTime } from './clock';

const HOUR = 3600000;

export function openDebug(hooks: SkyHooks): void {
  // Scripts that inspect the sky (a headless browser, the console) find the
  // hooks here. `?sky-debug=hooks` exposes them without the panel, for clean
  // screenshots.
  (window as unknown as { skyHooks: SkyHooks }).skyHooks = hooks;
  if (new URLSearchParams(window.location.search).get('sky-debug') === 'hooks') return;
  const panel = document.createElement('pre');
  panel.setAttribute('aria-hidden', 'true');
  Object.assign(panel.style, {
    position: 'fixed',
    top: '72px',
    right: '12px',
    zIndex: '30',
    margin: '0',
    padding: '10px 12px',
    font: '400 11px/1.5 var(--mono)',
    color: 'var(--text)',
    background: 'color-mix(in srgb, var(--bg-raised) 92%, transparent)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    maxWidth: 'calc(100vw - 24px)',
    overflow: 'hidden',
  });
  document.body.append(panel);

  const grid = document.createElement('canvas');
  grid.setAttribute('aria-hidden', 'true');
  Object.assign(grid.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '4', pointerEvents: 'none', display: 'none' });
  document.body.append(grid);
  const g = grid.getContext('2d');

  let showGrid = false;
  let showAll = false;
  let note = '';

  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp = (ms: number): string => {
    const d = new Date(ms + 7 * HOUR);
    const { hours, minutes } = wibTime(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(hours)}:${pad(minutes)} WIB`;
  };

  function render(): void {
    const s = hooks.state();
    const now = skyNow();
    const lines = [
      `time    ${stamp(now)}  (${new Date(now).toISOString().slice(0, 16)}Z)`,
      `speed   ${clock.speed}x${clock.alt !== null ? `   tilt pinned at ${clock.alt}°` : ''}`,
      `camera  ${s.camAlt.toFixed(1)}° up, ${s.ppd.toFixed(1)} px per degree`,
      s.moon
        ? `moon    ${s.moon.phase}, ${(s.moon.lit * 100).toFixed(1)}% lit, alt ${s.moon.alt.toFixed(1)}° az ${s.moon.az.toFixed(1)}°`
        : 'moon    not computed yet',
      s.moon ? `        ${s.moon.inView ? 'in view' : `not in view, ${s.moon.why}`}` : '',
      `sun     alt ${s.sunAlt.toFixed(1)}°`,
      `shower  ${s.shower ? `${s.shower.name}, radiant ${s.shower.radiantAlt.toFixed(1)}° up` : 'none active'}`,
      `pool    ${s.pool.bound} stars, ${s.pool.spare} spare, ${s.pool.rebinds} swapped in the last minute`,
      `figures ${s.figures.map((f) => `${f.name} ${f.score.toFixed(2)}`).join(', ') || 'none'}`,
      `frame   ${s.frameMs.toFixed(2)} ms`,
      '',
      '[ ] hour   , . day   0 now   M moon   S meteor   T satellite',
      `G grid ${showGrid ? 'on' : 'off'}   L all figures ${showAll ? 'on' : 'off'}`,
    ];
    if (note) lines.push('', note);
    panel.textContent = lines.join('\n');
  }

  /** A curve of altitude and azimuth samples, broken where it leaves the view. */
  function curve(points: Array<[number, number]>): void {
    if (!g) return;
    let open = false;
    let last: [number, number] | null = null;
    g.beginPath();
    for (const [alt, az] of points) {
      const p = hooks.project(alt, az);
      if (!p || (last && Math.hypot(p[0] - last[0], p[1] - last[1]) > 400)) {
        open = false;
        last = null;
        continue;
      }
      if (open) g.lineTo(p[0], p[1]);
      else g.moveTo(p[0], p[1]);
      open = true;
      last = p;
    }
    g.stroke();
  }

  function drawGrid(): void {
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (grid.width !== Math.round(W * dpr)) grid.width = Math.round(W * dpr);
    if (grid.height !== Math.round(H * dpr)) grid.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim() || '#888';
    const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#b39ddb';
    g.strokeStyle = color;
    g.fillStyle = color;
    g.font = '11px ui-monospace, monospace';
    g.globalAlpha = 0.35;
    g.lineWidth = 1;
    const range = (from: number, to: number, step: number): number[] => {
      const out: number[] = [];
      for (let v = from; v <= to + 1e-9; v += step) out.push(v);
      return out;
    };
    for (let alt = 10; alt < 90; alt += 10) curve(range(0, 360, 2).map((az) => [alt, az]));
    for (let az = 0; az < 360; az += 10) curve(range(0, 90, 2).map((alt) => [alt, az]));
    for (let alt = 10; alt < 90; alt += 10) {
      const p = hooks.project(alt, 180);
      if (p) g.fillText(`${alt}°`, p[0] + 4, p[1] - 3);
    }
    g.globalAlpha = 0.9;
    g.lineWidth = 1.5;
    curve(range(0, 360, 1).map((az) => [0, az]));
    g.strokeStyle = brand;
    curve(range(0, 90, 1).map((alt) => [alt, 180]));
    curve(range(0, 90, 1).map((alt) => [alt, 0]));
    const zenith = hooks.project(90, 0);
    if (zenith) {
      g.beginPath();
      g.arc(zenith[0], zenith[1], 5, 0, Math.PI * 2);
      g.stroke();
      g.fillText('zenith', zenith[0] + 8, zenith[1] + 4);
    }
    g.fillStyle = color;
    for (const [name, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as Array<[string, number]>) {
      const p = hooks.project(1, az);
      if (p) g.fillText(name, p[0] - 4, p[1] - 6);
    }
    const s = hooks.state();
    if (s.moon) {
      const p = hooks.project(s.moon.alt, s.moon.az);
      if (p) g.fillText(`moon ${s.moon.inView ? '' : '(off)'}`, p[0] + 18, p[1] + 4);
    }
  }

  function moveTo(ms: number, message = ''): void {
    setSkyTime(ms);
    hooks.refresh();
    note = message;
    render();
  }

  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const now = skyNow();
    switch (e.key) {
      case '[':
        moveTo(now - HOUR);
        break;
      case ']':
        moveTo(now + HOUR);
        break;
      case ',':
        moveTo(now - 24 * HOUR);
        break;
      case '.':
        moveTo(now + 24 * HOUR);
        break;
      case '0':
        resetClock();
        hooks.refresh();
        note = '';
        break;
      case 'm':
      case 'M': {
        // Ten-minute steps, up to two months ahead, with the tilt as it is now.
        let found = -1;
        for (let t = now + 10 * 60000; t < now + 60 * 24 * HOUR; t += 10 * 60000) {
          if (hooks.moonInView(t)) {
            found = t;
            break;
          }
        }
        if (found > 0) moveTo(found, `moon in view from ${stamp(found)}`);
        else note = 'the moon is not in view at this tilt in the next two months, try scrolling';
        break;
      }
      case 's':
      case 'S':
        hooks.fireMeteor();
        break;
      case 't':
      case 'T':
        hooks.sendSatellite();
        break;
      case 'g':
      case 'G':
        showGrid = !showGrid;
        grid.style.display = showGrid ? 'block' : 'none';
        break;
      case 'l':
      case 'L':
        showAll = !showAll;
        hooks.setShowAll(showAll);
        break;
      default:
        return;
    }
    render();
  });

  const tick = (): void => {
    if (showGrid) drawGrid();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  render();
  window.setInterval(render, 250);
}
