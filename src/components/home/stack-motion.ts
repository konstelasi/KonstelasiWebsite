// The layers of the stack are struck through one at a time as it scrolls
// through the view, and the database turns into the shared hosting account
// last. Scrolling back stands them up again, so the reader sets the pace.
// Without motion none of this runs and the CSS shows the end state.
import { ScrollTrigger, motionOn } from '../../motion/core';

function lower(stack: HTMLElement): void {
  const gone = [...stack.querySelectorAll<HTMLElement>('.layers:not(.ghost) .gone')];
  const base = stack.querySelector<HTMLElement>('.layers:not(.ghost) .base');
  if (!gone.length || !base) return;

  // Scroll mode stands the layers up and shows the hidden copy that holds
  // the height, which makes the section taller. Measure again, so triggers
  // further down the page account for it.
  stack.dataset.mode = 'scroll';
  ScrollTrigger.refresh();

  ScrollTrigger.create({
    trigger: stack,
    start: 'top 75%',
    end: 'bottom 40%',
    onUpdate(self) {
      // One step per struck layer, then one for the base.
      const n = Math.floor(self.progress * (gone.length + 2));
      gone.forEach((el, i) => el.classList.toggle('out', i < n));
      base.classList.toggle('done', n > gone.length);
    },
  });
}

if (motionOn) document.querySelectorAll<HTMLElement>('[data-stack]').forEach(lower);
