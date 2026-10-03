/**
 * The living constellation: one WebGL canvas fixed behind every page.
 *
 * At rest it is a sky of stars at three depths, drifting slowly, joined by
 * faint lines, moving with the scroll at different speeds and leaning a
 * little toward the pointer. A page can ask it to assemble into a shape
 * (`assemble`) fitted into an element, and to let it go again. `form`, from
 * 0 (sky) to 1 (shape), is a plain number, so GSAP can tween it or scrub it
 * with the scroll.
 *
 * Positions are worked out on the CPU in CSS pixels each frame and uploaded
 * as one buffer. With 1,400 stars that's cheap, and it keeps the shader
 * trivial. The scene only starts with WebGL and without reduced motion, and
 * it stops drawing while the tab is hidden.
 */
import { Renderer, Geometry, Program, Mesh, Transform } from 'ogl';
import { gsap, motionOn, finePointer } from './core';
import type { Shape } from './shapes';

const VERTEX = /* glsl */ `
attribute vec3 position;
attribute float aSize;
attribute float aAlpha;
attribute float aKey;
uniform vec2 uResolution;
uniform float uDpr;
varying float vAlpha;
varying float vKey;
void main() {
  vec2 clip = position.xy / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = aSize * uDpr;
  vAlpha = aAlpha;
  vKey = aKey;
}`;

const POINT_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform vec3 uKeyColor;
varying float vAlpha;
varying float vKey;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float core = smoothstep(0.5, 0.05, d);
  float a = core * core * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(mix(uColor, uKeyColor, vKey) * a, a);
}`;

// Lines carry their own alpha per vertex, worked out on the CPU, so a
// constellation fades as a whole and never stretches across the screen.
const LINE_VERTEX = /* glsl */ `
attribute vec3 position;
attribute float aAlpha;
uniform vec2 uResolution;
varying float vAlpha;
void main() {
  vec2 clip = position.xy / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vAlpha = aAlpha;
}`;

const LINE_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uLineAlpha;
varying float vAlpha;
void main() {
  float a = uLineAlpha * min(vAlpha, 1.0);
  gl_FragColor = vec4(uColor * a, a);
}`;

type Anchor = Element | (() => DOMRect);

export interface Scene {
  /** 0 is the open sky, 1 is the current shape fully assembled. */
  form: number;
  /** Extra outward push while a shape breaks apart, 0 to 1. */
  burst: number;
  /** Overall opacity of the sky, 0 to 1, for quieter pages. */
  presence: number;
  /** When set, the pointer pushes the stars of a formed shape aside, and
   *  they drift back once it moves on. */
  repel: boolean;
  /** Fits `shape` into `anchor` and makes it the shape `form` refers to. */
  assemble(shape: Shape, anchor: Anchor, fit?: number): void;
  /** Particle count, for sizing shapes. */
  readonly count: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function create(): Scene | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'sky-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  let renderer: Renderer;
  try {
    renderer = new Renderer({ canvas, dpr: Math.min(window.devicePixelRatio, 1.5), alpha: true, depth: false, premultipliedAlpha: true, antialias: false, webgl: 2 });
  } catch {
    return null;
  }
  const gl = renderer.gl;
  if (!gl) return null;
  document.body.prepend(canvas);

  const N = window.innerWidth >= 900 ? 1400 : 650;

  // Each star's place in the sky, in viewport-relative units, its depth
  // (0 far, 1 near) and its stagger when joining a shape.
  const skyX = new Float32Array(N);
  const skyY = new Float32Array(N);
  const depth = new Float32Array(N);
  const baseDepth = new Float32Array(N);
  const stagger = new Float32Array(N);
  const twinkle = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    skyX[i] = Math.random();
    skyY[i] = Math.random();
    baseDepth[i] = Math.pow(Math.random(), 2.2);
    stagger[i] = Math.random() * 0.55;
    twinkle[i] = Math.random() * Math.PI * 2;
  }
  depth.set(baseDepth);

  const position = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const alpha = new Float32Array(N);
  const key = new Float32Array(N);

  const points = new Geometry(gl, {
    position: { size: 3, data: position },
    aSize: { size: 1, data: size },
    aAlpha: { size: 1, data: alpha },
    aKey: { size: 1, data: key },
  });

  // Constellations: a few short chains of neighbouring stars, drawn as lines.
  // A chain only joins stars that sit a sensible distance apart on screen, and
  // every star of a chain shares one depth, so they drift and scroll together
  // and the lines keep their shape. Each frame a line still checks its own
  // length, and fades out when its stars have been pulled apart (while a shape
  // forms or when one star wraps around the edge of the sky).
  const L = Math.min(N, 200);
  const links: number[] = [];
  const restLength: number[] = [];
  const linePos = new Float32Array(L * 2 * 3);
  const lineAlpha = new Float32Array(L * 2);
  const lines = new Geometry(gl, {
    position: { size: 3, data: linePos },
    aAlpha: { size: 1, data: lineAlpha },
  });

  function buildConstellations(): void {
    const W = window.innerWidth;
    const H = window.innerHeight;
    depth.set(baseDepth);
    links.length = 0;
    restLength.length = 0;
    const px = (i: number): number => skyX[i] * W;
    const py = (i: number): number => skyY[i] * H;
    const minGap = 46;
    const maxGap = Math.min(190, Math.max(110, W * 0.13));
    const wanted = Math.max(2, Math.round((W * H) / 95000));
    const taken = new Set<number>();
    let made = 0;
    for (let start = 0; start < L && made < wanted; start++) {
      if (taken.has(start)) continue;
      const chain = [start];
      const goal = 3 + Math.floor(Math.random() * 3);
      while (chain.length < goal) {
        const tail = chain[chain.length - 1];
        let best = -1;
        let bestD = Infinity;
        for (let j = 0; j < L; j++) {
          if (j === tail || taken.has(j) || chain.includes(j)) continue;
          const d = Math.hypot(px(j) - px(tail), py(j) - py(tail));
          if (d >= minGap && d <= maxGap && d < bestD) {
            best = j;
            bestD = d;
          }
        }
        if (best < 0) break;
        chain.push(best);
      }
      if (chain.length < 3) continue;
      if (links.length / 2 + chain.length - 1 > L) break;
      const z = 0.45 + Math.random() * 0.45;
      chain.forEach((s, k) => {
        taken.add(s);
        depth[s] = z;
        if (k > 0) {
          links.push(chain[k - 1], s);
          restLength.push(Math.hypot(px(s) - px(chain[k - 1]), py(s) - py(chain[k - 1])));
        }
      });
      made++;
    }
  }
  buildConstellations();

  const uniforms = {
    uResolution: { value: [window.innerWidth, window.innerHeight] },
    uDpr: { value: renderer.dpr },
    uColor: { value: [1, 1, 1] },
    uKeyColor: { value: [0.7, 0.6, 0.86] },
    uLineAlpha: { value: 0.2 },
  };
  const common = { uniforms, transparent: true, depthTest: false, depthWrite: false };
  const pointProgram = new Program(gl, { ...common, vertex: VERTEX, fragment: POINT_FRAGMENT });
  const lineProgram = new Program(gl, { ...common, vertex: LINE_VERTEX, fragment: LINE_FRAGMENT });
  const root = new Transform();
  new Mesh(gl, { geometry: lines, program: lineProgram, mode: gl.LINES }).setParent(root);
  new Mesh(gl, { geometry: points, program: pointProgram, mode: gl.POINTS }).setParent(root);

  // Theme. Stars glow additively on dark, and sit as soft ink on light.
  let dark = false;
  function theme(): void {
    const css = getComputedStyle(document.documentElement);
    dark = css.colorScheme.includes('dark');
    uniforms.uColor.value = hexToRgb(css.getPropertyValue('--text'));
    uniforms.uKeyColor.value = hexToRgb(css.getPropertyValue('--brand'));
    for (const p of [pointProgram, lineProgram]) {
      if (dark) p.setBlendFunc(gl.ONE, gl.ONE);
      else p.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }
  theme();
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);

  // Phones fire `resize` as the address bar slides away, so the
  // constellations are only redrawn when the width changes.
  let builtFor = window.innerWidth;
  function resize(): void {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.uResolution.value = [window.innerWidth, window.innerHeight];
    if (window.innerWidth !== builtFor) {
      builtFor = window.innerWidth;
      buildConstellations();
    }
  }
  resize();
  window.addEventListener('resize', resize);

  // The pointer, eased, as an offset from the centre of the screen.
  const pointer = { x: 0, y: 0, px: -9999, py: -9999 };
  const lean = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.px = e.clientX;
    pointer.py = e.clientY;
    if (!finePointer) return;
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = e.clientY / window.innerHeight - 0.5;
  });
  // How far each star has been pushed aside by the pointer. Decays back.
  const pushX = new Float32Array(N);
  const pushY = new Float32Array(N);
  // How far each star has joined the current shape, 0 to 1, so the
  // constellation lines can leave with the stars they join.
  const joined = new Float32Array(N);

  let shape: Shape | null = null;
  let anchor: Anchor | null = null;
  let fit = 0.9;

  const scene: Scene = {
    form: 0,
    burst: 0,
    presence: 0,
    repel: false,
    count: N,
    assemble(next, where, f = 0.9) {
      shape = next;
      anchor = where;
      fit = f;
    },
  };

  const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

  function frame(time: number): void {
    if (document.hidden) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const scroll = window.scrollY;
    lean.x += (pointer.x - lean.x) * 0.05;
    lean.y += (pointer.y - lean.y) * 0.05;

    // Where the current shape sits on screen this frame.
    let rx = 0;
    let ry = 0;
    let rw = 0;
    let rh = 0;
    if (shape && anchor && scene.form > 0.001) {
      const r = typeof anchor === 'function' ? anchor() : anchor.getBoundingClientRect();
      const boxAspect = r.width / Math.max(1, r.height);
      if (boxAspect > shape.aspect) {
        rh = r.height * fit;
        rw = rh * shape.aspect;
      } else {
        rw = r.width * fit;
        rh = rw / shape.aspect;
      }
      rx = r.left + (r.width - rw) / 2;
      ry = r.top + (r.height - rh) / 2;
    }
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;

    for (let i = 0; i < N; i++) {
      const z = depth[i];
      // Sky position: drift sideways over time, move with scroll by depth,
      // wrap around the screen, and lean toward the pointer.
      let sx = (skyX[i] + time * 0.0015 * (0.3 + z)) % 1;
      let sy = (skyY[i] - (scroll / H) * (0.04 + z * 0.3)) % 1;
      if (sy < 0) sy += 1;
      sx = sx * (W + 80) - 40 + lean.x * z * 60;
      sy = sy * (H + 80) - 40 + lean.y * z * 40;

      let x = sx;
      let y = sy;
      let inShape = 0;
      if (shape && i < shape.count && rw > 0) {
        const w = ease((scene.form * 1.55 - stagger[i]) / 1);
        const tx = rx + shape.x[i] * rw;
        const ty = ry + shape.y[i] * rh;
        // While breaking apart, stars arc outward from the shape's centre.
        const arc = Math.sin(w * Math.PI) * scene.burst * 140;
        const dx = tx - cx;
        const dy = ty - cy;
        const dl = Math.hypot(dx, dy) || 1;
        x = sx + (tx - sx) * w + (dx / dl) * arc;
        y = sy + (ty - sy) * w + (dy / dl) * arc;
        inShape = w;
        if (scene.repel) {
          const qx = x + pushX[i] - pointer.px;
          const qy = y + pushY[i] - pointer.py;
          const qd = Math.hypot(qx, qy);
          if (qd < 110 && qd > 0.01) {
            const f = (110 - qd) / 110;
            pushX[i] += (qx / qd) * f * 9;
            pushY[i] += (qy / qd) * f * 9;
          }
        }
        pushX[i] *= 0.93;
        pushY[i] *= 0.93;
        x += pushX[i];
        y += pushY[i];
      }

      position[i * 3] = x;
      position[i * 3 + 1] = y;
      position[i * 3 + 2] = z;
      joined[i] = inShape;

      const tw = 0.7 + 0.3 * Math.sin(time * (0.8 + z) + twinkle[i]);
      const skyAlpha = (0.18 + z * 0.62) * tw;
      let a = skyAlpha;
      let s = 1.4 + z * 2.6;
      if (shape && i < shape.count) {
        // A pulse runs along connector points, as data travelling the line.
        const p = shape.path[i];
        const pulse = p >= 0 ? Math.pow(Math.max(0, 1 - Math.abs(((p - time * 0.22) % 1 + 1) % 1 - 0.5) * 9), 2) : 0;
        const shapeAlpha = 0.75 * shape.weight[i] + pulse * 0.9;
        a = skyAlpha + (shapeAlpha - skyAlpha) * inShape;
        s = s + (2.3 + pulse * 3 - s) * inShape;
      } else if (shape) {
        // Stars not in the shape step back while it holds.
        a *= 1 - scene.form * 0.65;
      }
      alpha[i] = a * scene.presence * (dark ? 1 : 0.7);
      size[i] = s;
      // Violet only while a star is part of a shape, never loose in the sky.
      key[i] = shape && i < shape.count ? shape.key[i] * inShape : 0;
    }

    // A line is drawn only while its two stars still sit where the sky put
    // them, about as far apart as they started. Stars pulled toward a shape,
    // or one that wrapped around the edge of the sky, take the line with them.
    const segments = links.length / 2;
    const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
    const edge = (v: number, extent: number): number => clamp01(Math.min(v + 40, extent + 40 - v) / 160);
    lineAlpha.fill(0);
    for (let k = 0; k < segments; k++) {
      const a = links[k * 2];
      const b = links[k * 2 + 1];
      const ax = position[a * 3];
      const ay = position[a * 3 + 1];
      const bx = position[b * 3];
      const by = position[b * 3 + 1];
      const rest = restLength[k];
      const stretch = clamp01((rest * 1.6 - Math.hypot(ax - bx, ay - by)) / (rest * 0.45));
      const fade = Math.min(edge(ax, W), edge(bx, W), edge(ay, H), edge(by, H));
      const a01 = stretch * fade * (1 - Math.max(joined[a], joined[b]));
      linePos[k * 6] = ax;
      linePos[k * 6 + 1] = ay;
      linePos[k * 6 + 3] = bx;
      linePos[k * 6 + 4] = by;
      lineAlpha[k * 2] = a01;
      lineAlpha[k * 2 + 1] = a01;
    }
    uniforms.uLineAlpha.value = (dark ? 0.2 : 0.16) * scene.presence;
    lines.attributes.position.needsUpdate = true;
    lines.attributes.aAlpha.needsUpdate = true;
    points.attributes.position.needsUpdate = true;
    points.attributes.aAlpha.needsUpdate = true;
    points.attributes.aSize.needsUpdate = true;
    points.attributes.aKey.needsUpdate = true;
    renderer.render({ scene: root });
  }

  gsap.ticker.add(frame);
  document.documentElement.classList.add('webgl');
  const quiet = document.body.dataset.sky === 'quiet';
  gsap.to(scene, { presence: quiet ? 0.35 : 1, duration: 1.6, ease: 'power2.out' });
  return scene;
}

let instance: Promise<Scene | null> | null = null;

/** The page's scene, created on first call. Null when it can't or shouldn't run. */
export function getScene(): Promise<Scene | null> {
  if (!instance) {
    instance = new Promise((resolve) => {
      if (!motionOn) return resolve(null);
      const start = (): void => resolve(create());
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start, { timeout: 600 });
      else window.setTimeout(start, 200);
    });
  }
  return instance;
}
