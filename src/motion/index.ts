/**
 * Site-wide motion, loaded on every page by Base.astro. Page-specific
 * sequences live next to their components and import from `./core` and
 * `./scene`.
 */
import { startSmoothScroll, ready, afterFonts } from './core';
import { initType } from './type';
import { initMagnetic } from './magnetic';
import { getScene } from './scene';

startSmoothScroll();
initMagnetic();
afterFonts(initType);
ready();

// The sky behind every page. It starts once the browser is idle, so it
// never competes with the first paint.
void getScene();
