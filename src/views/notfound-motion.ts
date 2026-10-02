/**
 * The 404 page draws its number in stars. Moving the pointer through the
 * digits scatters them, and they drift back into place. Without WebGL the
 * plain "404" in the page stays visible instead.
 */
import { gsap, afterFonts } from '../motion/core';
import { getScene } from '../motion/scene';
import { fromText } from '../motion/shapes';

const code = document.querySelector<HTMLElement>('.code');

afterFonts(async () => {
  const scene = await getScene();
  if (!scene || !code) return;
  scene.assemble(fromText('404', Math.min(scene.count, 900), '600 240px Poppins, sans-serif'), code, 1);
  scene.repel = true;
  scene.burst = 0.6;
  code.classList.add('drawn');
  gsap.to(scene, { form: 1, duration: 2.2, ease: 'power3.inOut', delay: 0.2 });
});
