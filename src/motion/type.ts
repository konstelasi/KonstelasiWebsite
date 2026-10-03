/**
 * Kinetic type. Any element with `data-split` enters by its variant when it
 * scrolls into view, or straight away if it's already on screen.
 *
 * - `lines`: each line rises out of a mask. For statements.
 * - `words`: words surface out of a blur, one after another. For lines
 *   meant to be read slowly.
 * - `chars`: letters fly in from scattered positions and settle. For short
 *   names and titles, where the assembling is the point.
 *
 * SplitText re-splits on resize and after fonts load (`autoSplit`), which
 * keeps Indonesian lines, usually longer, breaking where they should.
 */
import { gsap, ScrollTrigger, SplitText, motionOn } from './core';

type Variant = 'lines' | 'words' | 'chars';

function animate(variant: Variant, split: SplitText, trigger: Element): gsap.core.Tween {
  const scrollTrigger = { trigger, start: 'top 88%', once: true };
  if (variant === 'lines') {
    return gsap.from(split.lines, {
      yPercent: 105,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.09,
      scrollTrigger,
    });
  }
  if (variant === 'words') {
    return gsap.from(split.words, {
      opacity: 0,
      y: '0.35em',
      filter: 'blur(8px)',
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.045,
      scrollTrigger,
    });
  }
  return gsap.from(split.chars, {
    opacity: 0,
    x: () => gsap.utils.random(-60, 60),
    y: () => gsap.utils.random(-40, 40),
    rotation: () => gsap.utils.random(-30, 30),
    duration: 1.1,
    ease: 'power4.out',
    stagger: { amount: 0.55, from: 'random' },
    scrollTrigger,
  });
}

export function initType(): void {
  if (!motionOn) return;
  document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    const variant = (el.dataset.split as Variant) || 'lines';
    try {
      SplitText.create(el, {
        type: variant === 'chars' ? 'words,chars' : variant,
        mask: variant === 'lines' ? 'lines' : undefined,
        linesClass: 'line',
        // Spans, not the default divs, so a split link stays valid HTML.
        tag: 'span',
        aria: 'auto',
        autoSplit: true,
        onSplit(self) {
          el.classList.add('split-ready');
          return animate(variant, self, el);
        },
      });
    } catch {
      // A heading that can't be split just shows, instead of staying hidden.
      el.classList.add('split-ready');
    }
  });
  ScrollTrigger.refresh();
}
