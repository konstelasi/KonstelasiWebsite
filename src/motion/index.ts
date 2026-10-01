/**
 * Site-wide motion, loaded on every page by Base.astro. Page-specific
 * sequences live next to their components and import from `./core`.
 */
import { startSmoothScroll, ready, afterFonts } from './core';
import { initType } from './type';
import { initMagnetic } from './magnetic';

startSmoothScroll();
initMagnetic();
afterFonts(initType);
ready();
