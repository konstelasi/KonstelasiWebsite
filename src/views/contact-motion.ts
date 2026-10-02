/**
 * The Contact page's live parts.
 *
 * The clock says what time it is in Yogyakarta and whether that's inside
 * the office hours listed on the page (09.00 to 17.00 on weekdays, 10.00 to
 * 18.00 at weekends, WIB). It runs with or without motion, because it's
 * information, and stays hidden without JS.
 *
 * With motion, the coordinate grid draws in from the location outward.
 */
import { gsap, motionOn } from '../motion/core';

const clock = document.querySelector<HTMLElement>('[data-clock]');
const text = clock?.querySelector<HTMLElement>('[data-clock-text]');

if (clock && text) {
  const lang = document.documentElement.lang === 'id' ? 'id-ID' : 'en-GB';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const shown = new Intl.DateTimeFormat(lang, { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  const update = (): void => {
    const now = new Date();
    const p = Object.fromEntries(parts.formatToParts(now).map((x) => [x.type, x.value]));
    const minutes = Number(p.hour) * 60 + Number(p.minute);
    const weekend = p.weekday === 'Sat' || p.weekday === 'Sun';
    const [open, close] = weekend ? [10 * 60, 18 * 60] : [9 * 60, 17 * 60];
    const inside = minutes >= open && minutes < close;
    const template = (inside ? clock.dataset.open : clock.dataset.closed) ?? '';
    text.textContent = template.replace('{time}', shown.format(now));
    clock.classList.toggle('is-open', inside);
  };
  update();
  clock.hidden = false;
  window.setInterval(update, 20_000);
}

const geo = document.querySelector<SVGSVGElement>('[data-geo]');
if (geo && motionOn) {
  const here = geo.querySelector<SVGCircleElement>('.here');
  const cx = Number(here?.getAttribute('cx') ?? 0);
  const cy = Number(here?.getAttribute('cy') ?? 0);
  const lines = [...geo.querySelectorAll<SVGLineElement>('.meridian line, .parallel line')];
  // Nearest lines first, so the grid spreads out from the location.
  const dist = (l: SVGLineElement): number =>
    l.x1.baseVal.value === l.x2.baseVal.value ? Math.abs(l.x1.baseVal.value - cx) : Math.abs(l.y1.baseVal.value - cy);
  lines.sort((a, b) => dist(a) - dist(b));
  gsap
    .timeline({ scrollTrigger: { trigger: geo, start: 'top 85%', once: true } })
    .from(lines, { opacity: 0, scale: 0, transformOrigin: '50% 50%', duration: 0.9, ease: 'expo.out', stagger: 0.05 })
    .from(geo.querySelectorAll('text'), { opacity: 0, duration: 0.6, stagger: 0.04 }, 0.3)
    .from(geo.querySelector('.cross'), { opacity: 0, duration: 0.6 }, 0.5)
    .from(here, { scale: 0, transformOrigin: '50% 50%', duration: 0.6, ease: 'back.out(3)' }, 0.6);
}
