/**
 * The one place GSAP and Lenis are set up. Every motion module imports
 * from here, so plugins are registered once and every module agrees on
 * whether motion is on.
 *
 * Motion is on when the visitor hasn't asked for reduced motion. The inline
 * script in Base.astro has already put `motion` on <html> in that case, and
 * CSS uses the class to hide what is about to animate in. `ready()` tells
 * that script the modules arrived, so it doesn't fall back to showing
 * everything statically.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger, SplitText };

export const motionOn = document.documentElement.classList.contains('motion');
export const finePointer = window.matchMedia('(pointer: fine)').matches;

let lenis: Lenis | null = null;

/**
 * Smooth scrolling, driven from GSAP's ticker so ScrollTrigger reads the
 * same position Lenis draws. Skipped with reduced motion and on touch
 * screens, where native scrolling already has momentum and feels right.
 */
export function startSmoothScroll(): void {
  if (!motionOn || !finePointer || lenis) return;
  lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95, anchors: true, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

export function ready(): void {
  document.documentElement.classList.add('motion-ready');
}

/**
 * Runs `fn` once fonts are in, so text is measured with Poppins, or after
 * 1.5 s at the latest, so a slow font never keeps headings hidden.
 */
export function afterFonts(fn: () => void): void {
  let done = false;
  const once = (): void => {
    if (done) return;
    done = true;
    fn();
  };
  if (document.fonts?.status === 'loaded') return once();
  document.fonts.ready.then(once, once);
  window.setTimeout(once, 1500);
}
