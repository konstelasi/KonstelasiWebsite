/**
 * The 404 page draws its number in stars. Moving the pointer through the
 * digits scatters them, and they drift back into place. Without WebGL the
 * plain "404" in the page stays visible instead.
 */
import { gsap, afterFonts } from '../motion/core';
import { getScene } from '../motion/scene';
import { fromText } from '../motion/shapes';

const code = document.querySelector<HTMLElement>('.code');

const FONT = '600 240px Poppins, sans-serif';

afterFonts(async () => {
  const scene = await getScene();
  if (!scene || !code) return;
  // The page itself may never ask for this weight, so load it before the
  // canvas measures the digits, or they are drawn in a fallback face.
  try {
    await document.fonts.load(FONT, '404');
  } catch {
    // The fallback face still draws a readable 404.
  }
  scene.assemble(fromText('404', Math.min(scene.count, 900), FONT), code, 1);
  scene.repel = true;
  scene.burst = 0.6;
  code.classList.add('drawn');
  gsap.to(scene, { form: 1, duration: 2.2, ease: 'power3.inOut', delay: 0.2 });
});
