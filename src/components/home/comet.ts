/**
 * The comet down the "How we work" essay. One path weaves through the gap
 * between the paragraphs and their margin notes, a violet trail draws along
 * it with the scroll, and each note lights up as the comet passes it.
 *
 * Built entirely here, so without JS or with reduced motion there is no
 * path at all and the notes simply read as they are.
 */
import { gsap, ScrollTrigger, motionOn } from '../../motion/core';

const NS = 'http://www.w3.org/2000/svg';
const essay = document.querySelector<HTMLElement>('.essay');

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

if (essay && motionOn) {
  const beats = [...essay.querySelectorAll<HTMLElement>('.beat')];
  const notes = beats.map((b) => b.querySelector<HTMLElement>('aside'));

  const svg = el('svg', { class: 'comet-sky', 'aria-hidden': 'true' });
  const rail = el('path', { class: 'comet-rail' });
  const trail = el('path', { class: 'comet-trail' });
  const halo = el('circle', { class: 'comet-halo', r: '14' });
  const head = el('circle', { class: 'comet-head', r: '4.5' });
  svg.append(rail, trail, halo, head);
  essay.prepend(svg);

  let length = 1;
  let progress = 0;

  // A `.reveal` beat that hasn't entered yet sits 1.25rem low, and its
  // bounding box includes that shift. Taking it off keeps the rail on the
  // layout the beat settles into.
  const shift = (el: Element): number => parseFloat(getComputedStyle(el).translate.split(' ')[1] ?? '') || 0;

  const stops = beats.map(() => el('circle', { class: 'comet-stop', r: '3.5' }));
  rail.after(...stops);

  // One straight line down the gap between the paragraphs and their notes,
  // with a stop at the top of each beat. On a phone, where the notes sit
  // under their paragraphs, it runs down the left gutter instead.
  function build(): void {
    const box = essay!.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const side = notes.some((n, i) => n && n.getBoundingClientRect().left > beats[i].getBoundingClientRect().left + 40);
    const gutter = Math.min(14, box.left / 2);
    const first = notes.find(Boolean)?.getBoundingClientRect();
    const x = side && first ? first.left - box.left - 28 : -gutter;
    const tops = beats.map((beat) => beat.getBoundingClientRect().top - shift(beat) - box.top + 14);
    const bottom = beats[beats.length - 1].getBoundingClientRect().bottom - shift(beats[beats.length - 1]) - box.top - 6;
    const d = `M ${x} ${tops[0]} L ${x} ${bottom}`;
    rail.setAttribute('d', d);
    trail.setAttribute('d', d);
    stops.forEach((c, i) => {
      c.setAttribute('cx', String(x));
      c.setAttribute('cy', String(tops[i]));
    });
    length = trail.getTotalLength();
    trail.style.strokeDasharray = `${length}`;
    place();
  }

  function place(): void {
    trail.style.strokeDashoffset = `${length * (1 - progress)}`;
    const p = trail.getPointAtLength(length * progress);
    for (const c of [head, halo]) {
      c.setAttribute('cx', p.x.toFixed(1));
      c.setAttribute('cy', p.y.toFixed(1));
    }
    const box = essay!.getBoundingClientRect();
    notes.forEach((note) => {
      if (!note) return;
      const top = note.getBoundingClientRect().top - box.top;
      note.classList.toggle('lit', p.y >= top + 8);
    });
    svg.classList.toggle('moving', progress > 0.001 && progress < 0.999);
  }

  build();
  new ResizeObserver(() => {
    build();
    ScrollTrigger.refresh();
  }).observe(essay);

  const proxy = { p: 0 };
  gsap.to(proxy, {
    p: 1,
    ease: 'none',
    scrollTrigger: { trigger: essay, start: 'top 70%', end: 'bottom 55%', scrub: 0.5 },
    onUpdate() {
      progress = proxy.p;
      place();
    },
  });
}
