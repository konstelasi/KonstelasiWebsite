/**
 * The envelope in the closing band, drawn as a small constellation above the
 * email address. When the band comes into view its corners light up and the
 * outline draws between them. After that a star keeps travelling around it,
 * the way a message goes out, while the band is on screen. Without motion the
 * envelope is simply there.
 */
import { gsap, ScrollTrigger, motionOn } from '../../motion/core';

const svg = document.querySelector<SVGSVGElement>('[data-send]');

if (svg && motionOn) {
  const stars = svg.querySelectorAll('.send-star');
  const lines = svg.querySelectorAll<SVGPathElement>('.send-body, .send-flap');
  const route = svg.querySelector<SVGPathElement>('.send-route');
  const packet = svg.querySelector<SVGCircleElement>('.send-packet');

  gsap
    .timeline({ scrollTrigger: { trigger: svg, start: 'top 90%', once: true } })
    .from(stars, { opacity: 0, scale: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(3)', stagger: 0.12 })
    .fromTo(lines, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.25 }, 0.3);

  if (route && packet) {
    const length = route.getTotalLength();
    const tick = (time: number): void => {
      const t = (time / 7) % 1;
      const p = route.getPointAtLength(t * length);
      packet.setAttribute('cx', p.x.toFixed(1));
      packet.setAttribute('cy', p.y.toFixed(1));
    };
    let running = false;
    ScrollTrigger.create({
      trigger: svg,
      start: 'top bottom',
      end: 'bottom top',
      onToggle(self) {
        if (self.isActive && !running) gsap.ticker.add(tick);
        if (!self.isActive && running) gsap.ticker.remove(tick);
        running = self.isActive;
      },
    });
  }
}
