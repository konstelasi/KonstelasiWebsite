/**
 * Loops for the Labs miniatures. Each plays only while its drawing is on
 * screen and pauses when it leaves. Every loop ends where it starts, and the
 * drawing at rest is the finished state, so reduced motion simply shows it.
 */
import { gsap, ScrollTrigger, motionOn } from '../../motion/core';

type Builder = (svg: SVGSVGElement, tl: gsap.core.Timeline) => void;

const q = (svg: SVGSVGElement, sel: string): Element[] => [...svg.querySelectorAll(sel)];

const builders: Record<string, Builder> = {
  // Values drop into slots one by one, in no particular order, then clear.
  stardust(svg, tl) {
    const fills = q(svg, '.fill');
    tl.from(fills, {
      opacity: 0,
      scale: 0.3,
      transformOrigin: '50% 50%',
      duration: 0.45,
      ease: 'back.out(2.2)',
      stagger: { each: 0.18, from: 'random' },
    })
      .to({}, { duration: 1.4 })
      .to(fills, { opacity: 0, duration: 0.5, stagger: 0.03 });
  },

  // Modules slide in from the sides and dock, their wires light up, and the
  // kernel answers with a pulse.
  starcore(svg, tl) {
    const modules = q(svg, '.module');
    const kernel = svg.querySelector('.kernel');
    modules.forEach((m, i) => {
      const left = i < 2;
      tl.from(m.querySelector('.mod'), { x: left ? -50 : 50, opacity: 0, duration: 0.6, ease: 'power3.out' }, i * 0.25);
      tl.from(m.querySelector('.wire'), { opacity: 0, duration: 0.3 }, i * 0.25 + 0.45);
    });
    if (kernel) tl.to(kernel, { scale: 1.12, transformOrigin: '50% 50%', duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' });
    tl.to({}, { duration: 1.3 }).to(modules, { opacity: 0, duration: 0.5, stagger: 0.08 });
    tl.set(modules, { opacity: 1 });
  },

  // Fields assemble into a form, and each finished entry lands on the stack.
  'hyper-cms'(svg, tl) {
    q(svg, '.field').forEach((f, i) => {
      tl.from(f.querySelector('.label'), { opacity: 0, x: -10, duration: 0.3 }, i * 0.35);
      tl.from(f.querySelector('.input'), { scaleX: 0, transformOrigin: '0% 50%', duration: 0.45, ease: 'power3.out' }, i * 0.35 + 0.1);
    });
    tl.from(q(svg, '.entry'), { y: -30, opacity: 0, duration: 0.5, ease: 'bounce.out', stagger: 0.25 });
    tl.to({}, { duration: 1.3 }).to(svg.querySelectorAll('.field, .entry'), { opacity: 0, duration: 0.5 });
    tl.set(svg.querySelectorAll('.field, .entry'), { opacity: 1 });
  },

  // The route as typed in, then the optimised one drawing over it.
  routemate(svg, tl) {
    const tangle = svg.querySelector('.tangle');
    const clean = svg.querySelector('.clean');
    tl.fromTo(clean, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, 0.5)
      .to(tangle, { opacity: 0.15, duration: 1 }, 0.7)
      .to({}, { duration: 1.4 })
      .to(clean, { opacity: 0, duration: 0.4 })
      .set(clean, { opacity: 1, strokeDashoffset: 1 })
      .to(tangle, { opacity: 1, duration: 0.4 });
  },
};

if (motionOn) {
  document.querySelectorAll<SVGSVGElement>('svg[data-mini]').forEach((svg) => {
    const build = builders[svg.dataset.mini ?? ''];
    if (!build) return;
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4, paused: true });
    build(svg, tl);
    ScrollTrigger.create({
      trigger: svg,
      start: 'top 90%',
      end: 'bottom 10%',
      onToggle: (self) => (self.isActive ? tl.play() : tl.pause()),
    });
  });
}
