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

  // The path's x is the middle of the gap before the notes on wide screens,
  // and the left gutter when the notes sit under their paragraphs.
  // A `.reveal` beat that hasn't entered yet sits 1.25rem low, and its
  // bounding box includes that shift. Taking it off keeps the path on the
  // layout the beat settles into.
  const shift = (el: Element): number => parseFloat(getComputedStyle(el).translate.split(' ')[1] ?? '') || 0;

  function build(): void {
    const box = essay!.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    // With the notes under their paragraphs the path runs down the left
    // gutter, which can be as narrow as 1rem on a phone, so it stays inside it.
    const lane = Math.min(14, box.left / 2);
    const sway = Math.min(10, lane * 0.6);
    const pts: Array<[number, number]> = [];
    beats.forEach((beat, i) => {
      const note = notes[i];
      const dy = shift(beat);
      const b = beat.getBoundingClientRect();
      const n = note?.getBoundingClientRect();
      const side = n && n.left > b.left + 40;
      const x = side && n ? n.left - box.left - 26 : -lane;
      const s = side ? 10 : sway;
      pts.push([x + (i % 2 ? s : -s), b.top - dy - box.top + 6]);
      pts.push([x + (i % 2 ? -s : s), b.bottom - dy - box.top - 6]);
    });
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const my = (y0 + y1) / 2;
      d += ` C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`;
    }
    rail.setAttribute('d', d);
    trail.setAttribute('d', d);
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
      note.classList.toggle('lit', p.y >= top - 4);
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
