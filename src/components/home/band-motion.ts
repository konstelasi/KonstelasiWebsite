/**
 * The stars of the closing band. When the band comes into view they fly in
 * from scattered places and settle on the tilted ring around the contact
 * details, then the ring itself draws through them. Without motion they are
 * simply there.
 */
import { gsap, motionOn } from '../../motion/core';

const svg = document.querySelector<SVGSVGElement>('[data-band-stars]');

if (svg && motionOn) {
  const stars = svg.querySelectorAll('circle');
  const ring = svg.querySelector<SVGPathElement>('.band-ring');
  const tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 85%', once: true } });
  tl.from(stars, {
    x: () => gsap.utils.random(-260, 260),
    y: () => gsap.utils.random(-180, 180),
    opacity: 0,
    duration: 1.6,
    ease: 'expo.out',
    stagger: { amount: 0.6, from: 'random' },
  });
  if (ring) {
    tl.fromTo(ring, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, '-=0.9');
  }
}
