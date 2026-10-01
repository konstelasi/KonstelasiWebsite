/**
 * Motion for the service pages.
 *
 * Data flows: once the diagram is on screen, small packets travel along each
 * connector in the direction the data really goes (the direction each path
 * is drawn in), violet on the key lines. Arrowheads are left out, because a
 * packet only follows the first stroke of a path.
 *
 * The argument: as the solution scrolls in, the problems before it are
 * struck through one by one.
 */
import { gsap, ScrollTrigger, motionOn } from '../motion/core';

const NS = 'http://www.w3.org/2000/svg';

function flows(fig: HTMLElement): void {
  const svg = fig.querySelector('svg');
  if (!svg) return;
  const lines = [...svg.querySelectorAll<SVGPathElement>('path.line, path.line-key')].filter((p) => !p.hasAttribute('data-no-flow'));
  const packets: Array<{ path: SVGPathElement; dot: SVGCircleElement; len: number; offset: number }> = [];

  for (const line of lines) {
    // Only the first stroke, so arrowheads don't carry packets.
    const d = line.getAttribute('d') ?? '';
    const first = d.split(/(?=M)/i)[0];
    // Measured in the document, since not every browser measures a path
    // that isn't attached.
    const track = document.createElementNS(NS, 'path');
    track.setAttribute('d', first);
    track.setAttribute('fill', 'none');
    track.setAttribute('visibility', 'hidden');
    svg.appendChild(track);
    const len = track.getTotalLength();
    if (len < 30) continue;
    const key = line.classList.contains('line-key');
    const count = len > 240 ? 3 : 2;
    for (let k = 0; k < count; k++) {
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', key ? '4' : '3');
      dot.setAttribute('class', key ? 'packet packet-key' : 'packet');
      dot.style.opacity = '0';
      svg.appendChild(dot);
      packets.push({ path: track, dot, len, offset: k / count });
    }
  }
  if (!packets.length) return;

  const tick = (time: number): void => {
    for (const p of packets) {
      const t = (time * (90 / p.len) + p.offset) % 1;
      const pt = p.path.getPointAtLength(t * p.len);
      p.dot.setAttribute('cx', pt.x.toFixed(1));
      p.dot.setAttribute('cy', pt.y.toFixed(1));
      // Fade in at the start of the line and out at its end.
      p.dot.style.opacity = String(Math.min(1, t * 8, (1 - t) * 8));
    }
  };

  let running = false;
  ScrollTrigger.create({
    trigger: fig,
    start: 'center 75%',
    end: 'bottom top',
    onToggle(self) {
      if (self.isActive && !running) gsap.ticker.add(tick);
      if (!self.isActive && running) gsap.ticker.remove(tick);
      running = self.isActive;
      fig.classList.toggle('flowing', self.isActive);
    },
  });
}

function strike(argument: HTMLElement): void {
  const items = [...argument.querySelectorAll<HTMLLIElement>('.problems li')];
  const solution = argument.querySelector('.solution');
  if (!items.length || !solution) return;
  ScrollTrigger.create({
    trigger: argument,
    start: 'top 65%',
    end: 'bottom 60%',
    onUpdate(self) {
      const n = Math.floor(self.progress * (items.length + 1));
      items.forEach((li, i) => li.classList.toggle('struck', i < n));
    },
  });
}

if (motionOn) {
  document.querySelectorAll<HTMLElement>('[data-flow] figure.diagram').forEach(flows);
  document.querySelectorAll<HTMLElement>('.argument').forEach(strike);
}
