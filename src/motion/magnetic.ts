/**
 * A light magnetic pull on primary links and the header tools. The element
 * leans toward the pointer while it's close and springs back when it leaves.
 * Mouse and trackpad only, since there's no hover on a touch screen.
 */
import { gsap, finePointer, motionOn } from './core';

const STRENGTH = 0.28;

export function initMagnetic(): void {
  if (!motionOn || !finePointer) return;
  document.querySelectorAll<HTMLElement>('.go, [data-magnetic]').forEach((el) => {
    const toX = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
    const toY = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });
    const strength = Number(el.dataset.magnetic) || STRENGTH;

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      toX((e.clientX - (r.left + r.width / 2)) * strength);
      toY((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
    });
  });
}
