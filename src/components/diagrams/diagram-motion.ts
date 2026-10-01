/**
 * Builds every product and service diagram with the scroll. The parts of a
 * diagram arrive in the order of their `data-step`: boxes grow into place,
 * solid lines draw along their length, dashed lines and text fade in.
 * Scrolling back takes it apart again.
 *
 * A figure inside `data-pin-diagrams` (the product pages) holds still on
 * wide screens while it builds. Anything marked `data-then-dim` fades back
 * once the rest has drawn, which is how RouteMate's typed-in route gives way
 * to the optimised one.
 *
 * Without motion, Figure.astro's own CSS reveal shows the finished drawing.
 */
import { gsap, motionOn } from '../../motion/core';

function isDashed(el: Element): boolean {
  const dash = getComputedStyle(el).strokeDasharray;
  return Boolean(dash) && dash !== 'none';
}

function build(fig: HTMLElement): void {
  const steps = [...fig.querySelectorAll<SVGGraphicsElement>('[data-step]')].sort(
    (a, b) => Number(a.style.getPropertyValue('--step') || 0) - Number(b.style.getPropertyValue('--step') || 0),
  );
  if (!steps.length) return;
  fig.classList.add('scrubbed');

  const wide = window.matchMedia('(min-width: 62rem)').matches;
  const pin = wide && fig.closest('[data-pin-diagrams]') !== null;
  const tl = gsap.timeline({
    defaults: { ease: 'power2.out' },
    scrollTrigger: pin
      ? { trigger: fig, start: 'center center', end: '+=110%', pin: fig.closest('section') ?? fig, scrub: 0.6, anticipatePin: 1 }
      : { trigger: fig, start: 'top 80%', end: 'center 45%', scrub: 0.6 },
  });

  steps.forEach((step, i) => {
    const at = i * 0.6;
    // A step can be one element or a group of them.
    const parts = step.matches('g') ? [...step.querySelectorAll('rect, ellipse, circle, path, line, text')] : [step];
    for (const el of parts) {
      if (el instanceof SVGTextElement) {
        tl.from(el, { opacity: 0, y: 6, duration: 0.5 }, at + 0.25);
      } else if ((el instanceof SVGPathElement || el instanceof SVGLineElement) && !isDashed(el) && !el.closest('.box, .box-key')) {
        const len = (el as SVGGeometryElement).getTotalLength();
        tl.fromTo(el, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.8, ease: 'power1.inOut' }, at);
      } else if (el instanceof SVGPathElement || el instanceof SVGLineElement) {
        tl.from(el, { opacity: 0, duration: 0.6 }, at);
      } else {
        tl.from(el, { opacity: 0, scale: 0.86, transformOrigin: '50% 50%', duration: 0.6, ease: 'back.out(1.6)' }, at);
      }
    }
  });

  const dim = fig.querySelectorAll('[data-then-dim]');
  if (dim.length) tl.to(dim, { opacity: 0.2, duration: 0.6 });
  tl.to({}, { duration: 0.3 });
}

if (motionOn) {
  document.querySelectorAll<HTMLElement>('figure.diagram').forEach(build);
}
