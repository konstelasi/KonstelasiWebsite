/**
 * Turns the product orbit. Scroll drives the rotation, and hovering or
 * focusing a product adds an offset that brings its moon to the front by the
 * shortest way round. Moons behind the planet move to the back layer, get
 * smaller and dimmer, and carry their label above rather than below.
 */
import { gsap, ScrollTrigger, motionOn } from '../../motion/core';

const root = document.querySelector<HTMLElement>('[data-orbit]');

if (root && motionOn) {
  const rx = Number(root.dataset.rx);
  const ry = Number(root.dataset.ry);
  const cx = Number(root.dataset.cx);
  const cy = Number(root.dataset.cy);
  const tilt = Number(root.dataset.tilt);
  const back = root.querySelector<SVGGElement>('[data-layer="back"]');
  const front = root.querySelector<SVGGElement>('[data-layer="front"]');
  const items = [...root.querySelectorAll<HTMLLIElement>('.orbit-list li')];
  const moons = items.map((li) => root.querySelector<SVGGElement>(`[data-moon="${li.dataset.slug}"]`));

  if (back && front && moons.every(Boolean)) {
    const n = moons.length;
    const step = (Math.PI * 2) / n;
    const spin = { scroll: 0, offset: 0 };
    let active = -1;

    gsap.to(spin, {
      scroll: Math.PI * 1.5,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
    });

    const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

    items.forEach((li, i) => {
      const bring = (): void => {
        // The rotation that puts moon i at the front (angle pi/2).
        const delta = wrap(-i * step - (spin.scroll + spin.offset));
        // `auto` only replaces an earlier pull on `offset`. `true` would kill
        // every tween on `spin`, the scroll-driven one included, and the
        // orbit would stop turning with the page after the first hover.
        gsap.to(spin, { offset: spin.offset + delta, duration: 1.1, ease: 'power3.inOut', overwrite: 'auto' });
      };
      li.addEventListener('pointerenter', bring);
      li.addEventListener('focusin', bring);
    });

    const draw = (): void => {
      let best = -1;
      let bestSin = -2;
      moons.forEach((moon, i) => {
        if (!moon) return;
        const a = Math.PI / 2 + i * step + spin.scroll + spin.offset;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
        const y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        const sin = Math.sin(a);
        const scale = 0.72 + 0.4 * ((sin + 1) / 2);
        moon.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)})`);
        moon.style.opacity = String(0.45 + 0.55 * ((sin + 1) / 2));
        const layer = sin > 0 ? front : back;
        if (moon.parentNode !== layer) layer.appendChild(moon);
        const label = moon.querySelector('text');
        label?.setAttribute('y', sin > 0 ? '34' : '-22');
        if (sin > bestSin) {
          bestSin = sin;
          best = i;
        }
      });
      if (best !== active) {
        active = best;
        moons.forEach((m, i) => m?.classList.toggle('active', i === best));
        items.forEach((li, i) => li.classList.toggle('active', i === best));
      }
    };

    // Draw only while the orbit is on screen.
    let running = false;
    ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      onToggle(self) {
        if (self.isActive && !running) gsap.ticker.add(draw);
        if (!self.isActive && running) gsap.ticker.remove(draw);
        running = self.isActive;
      },
    });
    draw();
  }
}
