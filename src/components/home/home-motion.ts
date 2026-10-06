/**
 * The home page sequences that use the star field.
 *
 * 1. Opening: the stars assemble into the Konstelasi mark beside the
 *    headline, then break apart into the sky as you scroll away.
 * 2. What we do: on wide screens the section pins for three screens of
 *    scroll. The stars form the services system, each stage opens in turn
 *    on the left while its node lights up in violet, and the ground of open
 *    innovation lights up last.
 *
 * One director decides, every frame, which shape the sky holds and how far
 * it's formed. Shapes are only swapped while the stars are loose (form 0),
 * so a swap is never visible. Without WebGL, or with reduced motion, none of
 * this runs and the page keeps its SVG constellation and its clickable
 * system diagram.
 */
import logoSvg from '../../assets/konstelasi-logo.svg?raw';
import { gsap, ScrollTrigger, afterFonts } from '../../motion/core';
import { getScene } from '../../motion/scene';
import { fitRect, fromSvg, type Shape } from '../../motion/shapes';
import { ASPECT, systemShapes } from './system-shape';

const opening = document.querySelector<HTMLElement>('.opening');
const what = document.querySelector<HTMLElement>('.what');
const whatSky = document.querySelector<HTMLElement>('.what-sky');
const map = document.querySelector<HTMLElement>('[data-map]');

async function start(): Promise<void> {
  const scene = await getScene();
  if (!scene || !opening || !what || !whatSky) return;

  const wide = window.matchMedia('(min-width: 62rem)');
  const markAnchor = (): DOMRect => {
    const r = opening.getBoundingClientRect();
    if (!wide.matches) {
      // The SVG fallback bleeds off the right edge, so centre the mark on the
      // screen instead of on that box.
      const sky = opening.querySelector('.opening-sky')?.getBoundingClientRect() ?? r;
      const side = 16;
      return new DOMRect(side, sky.top, window.innerWidth - side * 2, sky.height);
    }
    // The right part of the opening, kept inside the viewport.
    const left = r.left + r.width * 0.52;
    const width = Math.min(r.right, window.innerWidth) - left;
    return new DOMRect(left, r.top, width, r.height);
  };

  const mark = fromSvg(logoSvg, Math.min(scene.count, 1100));
  const intro = { v: 0 };
  gsap.to(intro, { v: 1, duration: 2.4, ease: 'power2.inOut', delay: 0.15 });
  // The mark lets go as the opening scrolls away. On a phone the mark sits
  // under the headline, so starting at the top of the page would put the
  // outline out about when the mark comes into view. There it holds until
  // the mark is centred on the screen.
  const sky = opening.querySelector<HTMLElement>('.opening-sky');
  const leave = ScrollTrigger.create({
    trigger: opening,
    start: () => {
      const top = opening.getBoundingClientRect().top + window.scrollY;
      if (wide.matches || !sky) return top;
      const r = sky.getBoundingClientRect();
      return Math.max(top, r.top + window.scrollY + r.height / 2 - window.innerHeight / 2);
    },
    end: 'bottom 25%',
  });

  // The pinned services sequence, on wide screens only.
  let system: Shape[] = [];
  let seq: ScrollTrigger | null = null;
  const stages = [...what.querySelectorAll<HTMLDetailsElement>('details')];
  const list = what.querySelector<HTMLElement>('.system');

  // Opening a stage changes the height of the text column. Left alone, the
  // column would re-centre against the graphic at every step and jump. So it
  // is held at the tallest state, measured by opening each stage in turn.
  function holdHeight(): void {
    if (!list) return;
    const open = stages.find((d) => d.open);
    list.style.minHeight = '';
    let tallest = 0;
    for (const d of stages) {
      d.open = true;
      tallest = Math.max(tallest, list.offsetHeight);
    }
    list.style.minHeight = `${tallest}px`;
    for (const d of stages) d.open = d === open;
  }
  const mm = gsap.matchMedia();
  // Wide and tall enough that the stage list fits inside the pinned screen.
  // A short window keeps the plain, clickable system diagram instead.
  mm.add('(min-width: 62rem) and (min-height: 44rem)', () => {
    what.dataset.mode = 'sequence';
    system = system.length ? system : systemShapes(Math.min(scene.count, 950));
    holdHeight();
    ScrollTrigger.addEventListener('refreshInit', holdHeight);
    let step = -1;
    seq = ScrollTrigger.create({
      trigger: what,
      start: 'top top',
      end: '+=280%',
      pin: true,
      anticipatePin: 1,
      // Pins refresh first, so every trigger further down the page is
      // measured with the pin's scroll length already added. Without it the
      // orbit, the comet and the headings below fire thousands of pixels
      // early, because they were created before this pin existed.
      refreshPriority: 10,
      onUpdate(self) {
        const next = Math.min(3, Math.floor(self.progress * 4.4 - 0.2));
        const s = Math.max(0, next);
        if (s !== step) {
          step = s;
          if (stages[s] && !stages[s].open) stages[s].open = true;
        }
      },
    });
    ScrollTrigger.refresh();
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', holdHeight);
      if (list) list.style.minHeight = '';
      delete what.dataset.mode;
      seq?.kill();
      seq = null;
    };
  });

  let held: Shape | null = null;
  let lit = -2;
  const smooth = { form: 0 };
  gsap.ticker.add(() => {
    let want: Shape = mark;
    let active = -1;
    let anchor: Element | (() => DOMRect) = markAnchor;
    let form = intro.v * (1 - leave.progress);
    let fit = 0.82;

    if (seq && seq.progress > 0 && seq.progress < 1 && system.length) {
      const p = seq.progress;
      // Form over the first tenth, hold, and break apart over the last.
      const f = Math.min(1, p / 0.1) * Math.min(1, (1 - p) / 0.1);
      active = Math.max(0, Math.min(3, Math.floor(p * 4.4 - 0.2)));
      want = system[active];
      anchor = whatSky;
      form = f;
      fit = 0.95;
    }

    let target = form;
    if (want !== held) {
      // A different stage of the same system only moves the highlight, so
      // it can switch at any time. Anything else waits for loose stars. While
      // it waits, the shape on show lets go (target 0), so a fast scroll that
      // lands mid-sequence can't leave the stars holding the wrong shape.
      const sameSystem = system.includes(want) && held !== null && system.includes(held);
      if (sameSystem || smooth.form < 0.02) {
        scene.assemble(want, anchor, fit);
        held = want;
      } else {
        target = 0;
      }
    }
    smooth.form += (target - smooth.form) * (target === 0 && form > 0 ? 0.2 : 0.12);
    scene.form = smooth.form;
    scene.burst = held === mark ? 1 : 0.5;

    // The labels ride on the fitted system shape and follow its highlight.
    if (map) {
      const showing = active >= 0 && held !== null && system.includes(held);
      if (showing) {
        const box = whatSky.getBoundingClientRect();
        const f = fitRect(ASPECT, box, 0.95);
        map.style.left = `${f.x - box.left}px`;
        map.style.top = `${f.y - box.top}px`;
        map.style.width = `${f.w}px`;
        map.style.height = `${f.h}px`;
      }
      map.style.opacity = showing ? String(Math.max(0, Math.min(1, (smooth.form - 0.4) / 0.5))) : '0';
      if (showing && active !== lit) {
        lit = active;
        map.querySelectorAll('[data-node], [data-tag]').forEach((el) => {
          const i = Number((el as HTMLElement).dataset.node ?? (el as HTMLElement).dataset.tag);
          el.classList.toggle('on', i === active);
        });
      }
    }
  });
}

afterFonts(() => void start());
