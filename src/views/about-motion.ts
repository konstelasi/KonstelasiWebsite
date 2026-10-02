/**
 * Motion for the About page.
 *
 * - The people, business and technology triad is a small spring system. Each
 *   star leans toward the pointer by its own amount and springs back when it
 *   leaves, and the lines between them stretch to follow.
 * - The values become a horizontal strip on wide screens, pinned while the
 *   scroll slides it past.
 * - The team's stars light up and the line between them draws as the
 *   section comes into view.
 */
import { gsap, ScrollTrigger, motionOn, finePointer } from '../motion/core';

function triad(svg: SVGSVGElement): void {
  const base: Array<[number, number]> = [
    [30, 90],
    [150, 25],
    [270, 90],
  ];
  const depth = [0.8, 1.35, 1.05];
  const nodes = [0, 1, 2].map((i) => svg.querySelector<SVGCircleElement>(`[data-node="${i}"]`));
  const labels = [0, 1, 2].map((i) => svg.querySelector<SVGTextElement>(`[data-label="${i}"]`));
  const edges = svg.querySelector<SVGPathElement>('[data-edges]');
  if (!edges || nodes.some((n) => !n)) return;

  const off = base.map(() => ({ x: 0, y: 0 }));
  const toX = off.map((o) => gsap.quickTo(o, 'x', { duration: 1.4, ease: 'elastic.out(1, 0.35)' }));
  const toY = off.map((o) => gsap.quickTo(o, 'y', { duration: 1.4, ease: 'elastic.out(1, 0.35)' }));

  const area = svg.closest('section') ?? svg;
  area.addEventListener('pointermove', (e) => {
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint((e as PointerEvent).clientX, (e as PointerEvent).clientY).matrixTransform(m.inverse());
    base.forEach(([bx, by], i) => {
      const clamp = gsap.utils.clamp(-22, 22);
      toX[i](clamp((p.x - bx) * 0.1 * depth[i]));
      toY[i](clamp((p.y - by) * 0.1 * depth[i]));
    });
  });
  area.addEventListener('pointerleave', () => base.forEach((_, i) => (toX[i](0), toY[i](0))));

  const draw = (time: number): void => {
    // With no pointer to follow, the stars breathe slowly on their own.
    const idle = finePointer ? 0 : 1;
    const pts = base.map(([bx, by], i) => [
      bx + off[i].x + idle * Math.sin(time * 0.7 + i * 2) * 4,
      by + off[i].y + idle * Math.cos(time * 0.6 + i * 2) * 3,
    ]);
    pts.forEach(([x, y], i) => {
      nodes[i]?.setAttribute('cx', x.toFixed(1));
      nodes[i]?.setAttribute('cy', y.toFixed(1));
      labels[i]?.setAttribute('x', x.toFixed(1));
      labels[i]?.setAttribute('y', (i === 1 ? y - 13 : y + 24).toFixed(1));
    });
    edges.setAttribute('d', `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]} L${pts[2][0]} ${pts[2][1]} Z`);
  };

  let running = false;
  ScrollTrigger.create({
    trigger: svg,
    start: 'top bottom',
    end: 'bottom top',
    onToggle(self) {
      if (self.isActive && !running) gsap.ticker.add(draw);
      if (!self.isActive && running) gsap.ticker.remove(draw);
      running = self.isActive;
    },
  });
}

function strip(section: HTMLElement): void {
  const dl = section.querySelector<HTMLElement>('dl');
  if (!dl) return;
  gsap.matchMedia().add('(min-width: 62rem)', () => {
    section.dataset.mode = 'strip';
    const distance = (): number => Math.max(0, dl.scrollWidth - window.innerWidth);
    const tween = gsap.to(dl, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    });
    gsap.from(dl.children, {
      opacity: 0,
      y: 60,
      rotation: 2,
      duration: 1,
      ease: 'power3.out',
      stagger: 0.12,
      scrollTrigger: { trigger: section, start: 'top 75%', once: true },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      delete section.dataset.mode;
      gsap.set(dl, { clearProps: 'x' });
    };
  });
}

function team(svg: SVGSVGElement): void {
  const lines = svg.querySelector('.team-lines');
  const people = svg.querySelectorAll('.person');
  const faint = svg.querySelectorAll('.faint');
  const tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 80%', once: true } });
  tl.from(faint, { opacity: 0, scale: 0, transformOrigin: '50% 50%', duration: 0.5, stagger: { each: 0.06, from: 'random' } })
    .from(people, { opacity: 0, scale: 0.2, transformOrigin: '50% 50%', duration: 0.7, ease: 'back.out(2.5)', stagger: 0.25 }, 0.2)
    .fromTo(lines, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, 0.5);
}

if (motionOn) {
  const t = document.querySelector<SVGSVGElement>('[data-triad]');
  if (t) triad(t);
  const v = document.querySelector<HTMLElement>('[data-values]');
  if (v) strip(v);
  const s = document.querySelector<SVGSVGElement>('[data-team-sky]');
  if (s) team(s);
}
