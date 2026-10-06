/**
 * The living constellation: one WebGL canvas fixed behind every page.
 *
 * At rest it is a sky of stars at three depths, drifting slowly, joined by
 * faint lines, moving with the scroll at different speeds and leaning a
 * little toward the pointer. On dark, the constellation stars and a few
 * others glow. A page can ask it to assemble into a shape
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
import { fitRect, type Shape } from './shapes';
import { constellations } from './constellations';

const VERTEX = /* glsl */ `
attribute vec3 position;
attribute float aSize;
attribute float aAlpha;
attribute float aKey;
attribute float aGlow;
uniform vec2 uResolution;
uniform float uDpr;
varying float vAlpha;
varying float vKey;
varying float vGlow;
void main() {
  vec2 clip = position.xy / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  // A glowing star's sprite grows to make room for its halo, and the
  // fragment shader scales back, so the core stays the same size.
  gl_PointSize = aSize * (1.0 + aGlow * 2.5) * uDpr;
  vAlpha = aAlpha;
  vKey = aKey;
  vGlow = aGlow;
}`;

// `r` is in core units, 0.5 at the edge of the core. A glowing star adds a
// halo that falls off well past the core and fades out before the sprite's
// edge, so its square never shows.
const POINT_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform vec3 uKeyColor;
varying float vAlpha;
varying float vKey;
varying float vGlow;
void main() {
  float spread = 1.0 + vGlow * 2.5;
  float r = length(gl_PointCoord - 0.5) * spread;
  float core = smoothstep(0.5, 0.05, r);
  float halo = vGlow * 0.6 * exp(-r * 2.6) * smoothstep(0.5 * spread, 0.3 * spread, r);
  float a = (core * core + halo) * vAlpha;
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

// Outlines come from a fixed list of unit-box segments, placed on the screen
// from the shape's fitted rectangle each frame. A browser draws GL lines one
// pixel wide whatever you ask for, so each segment is a quad instead, `uHalf`
// pixels either side of the line and past each end. `position` is the quad's
// corner: x 0 at the start and 1 at the end, y -1 and 1 across.
const OUTLINE_VERTEX = /* glsl */ `
attribute vec2 position;
attribute vec4 aSeg;
attribute float aKey;
uniform vec2 uResolution;
uniform float uHalf;
varying vec2 vLocal;
varying float vLen;
varying float vKey;
void main() {
  vec2 d = aSeg.zw - aSeg.xy;
  float len = length(d);
  vec2 t = len > 0.0001 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  float along = position.x * len + (position.x * 2.0 - 1.0) * uHalf;
  float across = position.y * uHalf;
  vec2 p = aSeg.xy + t * along + n * across;
  vec2 clip = p / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vLocal = vec2(along, across);
  vLen = len;
  vKey = aKey;
}`;

// The distance from the segment, round at both ends, gives a neon profile: a
// thin bright tube, and on dark a soft haze around it (`uGlow`). Segments
// meet end to end, so their round ends overlap at every joint. The outline is
// drawn with MAX blending, so an overlap never adds up into a brighter bead.
const OUTLINE_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform vec3 uKeyColor;
uniform float uOutlineAlpha;
uniform float uGlow;
uniform float uHalf;
varying vec2 vLocal;
varying float vLen;
varying float vKey;
void main() {
  float u = max(0.0, max(-vLocal.x, vLocal.x - vLen));
  float d = length(vec2(u, vLocal.y));
  float core = 1.0 - smoothstep(0.35, 1.25, d);
  float haze = (exp(-d * d / 18.0) * 0.45 + exp(-d / 5.0) * 0.12) * (1.0 - smoothstep(uHalf * 0.6, uHalf, d));
  float a = min(1.0, uOutlineAlpha * (core + haze * uGlow));
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uColor, uKeyColor, vKey) * a, a);
}`;

/** The most outline segments the scene will draw for one shape. */
const MAX_OUTLINE = 2600;

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
  const homeX = new Float32Array(N);
  const homeY = new Float32Array(N);
  const depth = new Float32Array(N);
  const baseDepth = new Float32Array(N);
  const stagger = new Float32Array(N);
  const twinkle = new Float32Array(N);
  // How a star floats and glitters while it holds a filled shape: its own
  // slow speeds and phases on each axis, and when its glints come round.
  const floatX = new Float32Array(N);
  const floatY = new Float32Array(N);
  const floatPhase = new Float32Array(N);
  const glint = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    homeX[i] = Math.random();
    homeY[i] = Math.random();
    baseDepth[i] = Math.pow(Math.random(), 2.2);
    stagger[i] = Math.random() * 0.55;
    twinkle[i] = Math.random() * Math.PI * 2;
    floatX[i] = 0.25 + Math.random() * 0.45;
    floatY[i] = 0.25 + Math.random() * 0.45;
    floatPhase[i] = Math.random() * Math.PI * 2;
    glint[i] = 0.3 + Math.random() * 0.6;
  }
  depth.set(baseDepth);
  skyX.set(homeX);
  skyY.set(homeY);

  const position = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const alpha = new Float32Array(N);
  const key = new Float32Array(N);
  const glow = new Float32Array(N);
  // Which stars glow while loose in the sky. Every constellation star does
  // (set in buildConstellations), and a few loose ones, more often the near.
  const looseGlow = new Float32Array(N);
  const baseGlow = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    looseGlow[i] = Math.random() < 0.015 + baseDepth[i] * 0.06 ? 0.3 + Math.random() * 0.4 : 0;
  }

  const points = new Geometry(gl, {
    position: { size: 3, data: position },
    aSize: { size: 1, data: size },
    aAlpha: { size: 1, data: alpha },
    aKey: { size: 1, data: key },
    aGlow: { size: 1, data: glow },
  });

  // Constellations. A handful of real figures (see constellations.ts) are
  // placed among the loose stars, so some of the sky reads as a constellation
  // and the rest stays plain stars. Each figure's stars share one depth, so
  // they drift and scroll together and keep their shape. Each frame a line
  // still checks its own length, and fades out when its stars are pulled apart
  // (while a shape forms, or when one star wraps around the edge of the sky).
  const MAX_LINKS = 80;
  const links: number[] = [];
  const restLength: number[] = [];
  const linePos = new Float32Array(MAX_LINKS * 2 * 3);
  const lineAlpha = new Float32Array(MAX_LINKS * 2);
  const lines = new Geometry(gl, {
    position: { size: 3, data: linePos },
    aAlpha: { size: 1, data: lineAlpha },
  });

  function buildConstellations(): void {
    const W = window.innerWidth;
    const H = window.innerHeight;
    depth.set(baseDepth);
    baseGlow.set(looseGlow);
    skyX.set(homeX);
    skyY.set(homeY);
    links.length = 0;
    restLength.length = 0;

    const wide = W >= 900;
    const wanted = Math.max(2, Math.min(5, Math.round((W * H) / 260000)));
    const pool = [...constellations].sort(() => Math.random() - 0.5).slice(0, wanted);
    const centres: Array<[number, number]> = [];
    let next = 0;
    for (const c of pool) {
      // A figure's size on screen and its tilt, and a spot a good way from
      // the others.
      const width = (wide ? 170 : 120) * (0.85 + Math.random() * 0.5) * (c.w > 80 ? 1 : 0.7);
      const k = width / c.w;
      const turn = (Math.random() - 0.5) * 0.9;
      let cx = 0;
      let cy = 0;
      for (let tries = 0; tries < 14; tries++) {
        cx = W * (0.12 + Math.random() * 0.76);
        cy = H * (0.12 + Math.random() * 0.76);
        if (centres.every(([ox, oy]) => Math.hypot(ox - cx, oy - cy) > Math.min(W, H) * 0.42)) break;
      }
      centres.push([cx, cy]);
      const z = 0.55 + Math.random() * 0.35;
      const ids = c.stars.map(([sx, sy]) => {
        const i = next++;
        const dx = (sx - c.w / 2) * k;
        const dy = (sy - c.h / 2) * k;
        const x = cx + dx * Math.cos(turn) - dy * Math.sin(turn);
        const y = cy + dx * Math.sin(turn) + dy * Math.cos(turn);
        // The sky draws a star at skyX * (W + 80) - 40, so undo that here.
        skyX[i] = (x + 40) / (W + 80);
        skyY[i] = (y + 40) / (H + 80);
        depth[i] = z;
        baseGlow[i] = 0.65 + Math.random() * 0.35;
        return i;
      });
      for (const [a, b] of c.edges) {
        if (links.length / 2 >= MAX_LINKS) break;
        links.push(ids[a], ids[b]);
        restLength.push(Math.hypot((skyX[ids[a]] - skyX[ids[b]]) * (W + 80), (skyY[ids[a]] - skyY[ids[b]]) * (H + 80)));
      }
    }
  }
  buildConstellations();

  const uniforms = {
    uResolution: { value: [window.innerWidth, window.innerHeight] },
    uDpr: { value: renderer.dpr },
    uColor: { value: [1, 1, 1] },
    uKeyColor: { value: [0.7, 0.6, 0.86] },
    uLineAlpha: { value: 0.2 },
    uOutlineAlpha: { value: 0 },
    uGlow: { value: 0 },
    uHalf: { value: 12 },
  };
  const common = { uniforms, transparent: true, depthTest: false, depthWrite: false };
  const pointProgram = new Program(gl, { ...common, vertex: VERTEX, fragment: POINT_FRAGMENT });
  const lineProgram = new Program(gl, { ...common, vertex: LINE_VERTEX, fragment: LINE_FRAGMENT });
  const outlineProgram = new Program(gl, { ...common, vertex: OUTLINE_VERTEX, fragment: OUTLINE_FRAGMENT });
  // WebGL 1 has MAX blending only through an extension. Without it the joints
  // brighten a little where segments overlap, which is acceptable.
  const blendMax = renderer.isWebgl2 ? (gl as WebGL2RenderingContext).MAX : gl.getExtension('EXT_blend_minmax')?.MAX_EXT;
  if (blendMax) outlineProgram.setBlendEquation(blendMax, blendMax);
  const outlineSeg = new Float32Array(MAX_OUTLINE * 4);
  const outlineKey = new Float32Array(MAX_OUTLINE);
  const outlineGeometry = new Geometry(gl, {
    position: { size: 2, data: new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]) },
    index: { data: new Uint16Array([0, 1, 2, 2, 1, 3]) },
    aSeg: { size: 4, data: outlineSeg, instanced: 1 },
    aKey: { size: 1, data: outlineKey, instanced: 1 },
  });
  const root = new Transform();
  const outlineMesh = new Mesh(gl, { geometry: outlineGeometry, program: outlineProgram });
  outlineMesh.setParent(root);
  new Mesh(gl, { geometry: lines, program: lineProgram, mode: gl.LINES }).setParent(root);
  new Mesh(gl, { geometry: points, program: pointProgram, mode: gl.POINTS }).setParent(root);

  // Theme. Stars glow additively on dark, and sit as soft ink on light.
  let dark = false;
  function theme(): void {
    const css = getComputedStyle(document.documentElement);
    dark = css.colorScheme.includes('dark');
    uniforms.uColor.value = hexToRgb(css.getPropertyValue('--text'));
    uniforms.uKeyColor.value = hexToRgb(css.getPropertyValue('--brand'));
    for (const p of [pointProgram, lineProgram, outlineProgram]) {
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

  // The current shape's outline, as unit-box segment endpoints.
  const outlineUnit = new Float32Array(MAX_OUTLINE * 4);
  let outlineCount = 0;

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
      // Flatten the outline into segment endpoints in the unit box, once.
      let n = 0;
      for (const o of next.outline) {
        for (let i = 1; i < o.pts.length && n < MAX_OUTLINE; i++, n++) {
          const [x0, y0] = o.pts[i - 1];
          const [x1, y1] = o.pts[i];
          outlineUnit[n * 4] = x0;
          outlineUnit[n * 4 + 1] = y0;
          outlineUnit[n * 4 + 2] = x1;
          outlineUnit[n * 4 + 3] = y1;
          outlineKey[n] = o.key ? 1 : 0;
        }
      }
      outlineCount = n;
      outlineGeometry.attributes.aKey.needsUpdate = true;
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
      const f = fitRect(shape.aspect, typeof anchor === 'function' ? anchor() : anchor.getBoundingClientRect(), fit);
      rx = f.x;
      ry = f.y;
      rw = f.w;
      rh = f.h;
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
        let tx = rx + shape.x[i] * rw;
        let ty = ry + shape.y[i] * rh;
        // A star in a filled shape floats about its place, never further than
        // its room, so the shape keeps its edge. Each axis mixes two sines
        // whose weights add up to 1, so it moves at most 0.7 of the room and
        // the drift as a whole stays inside it.
        const room = Math.min(shape.room[i] * rh * 0.7, 7);
        if (room > 0) {
          const ph = floatPhase[i];
          tx += room * (Math.sin(time * floatX[i] + ph) * 0.7 + Math.sin(time * floatX[i] * 2.3 + ph * 1.7) * 0.3);
          ty += room * (Math.sin(time * floatY[i] + ph * 2.1) * 0.7 + Math.sin(time * floatY[i] * 1.9 + ph * 0.6) * 0.3);
        }
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
        // Stars in a filled shape glitter: a slow shimmer, and now and then a
        // short glint, a sine raised to a high power so it only peaks briefly.
        const filled = shape.room[i] > 0 ? 1 : 0;
        const shimmer = 1 - filled * 0.18 * (0.5 + 0.5 * Math.sin(time * 1.7 + twinkle[i]));
        const flash = filled * Math.pow(Math.max(0, Math.sin(time * glint[i] + twinkle[i] * 3)), 60);
        const shapeAlpha = (0.75 * shape.weight[i] + pulse * 0.9) * shimmer + flash * 0.7;
        a = skyAlpha + (shapeAlpha - skyAlpha) * inShape;
        s = s + (2.3 + pulse * 3 + flash * 2.2 - s) * inShape;
      } else if (shape) {
        // Stars not in the shape step back while it holds.
        a *= 1 - scene.form * 0.65;
      }
      alpha[i] = a * scene.presence * (dark ? 1 : 0.7);
      size[i] = s;
      // Violet only while a star is part of a shape, never loose in the sky.
      key[i] = shape && i < shape.count ? shape.key[i] * inShape : 0;
      // The glow belongs to the open sky, so it fades as a star joins a shape.
      // Dark only, because a halo of ink on a light page reads as a smudge.
      glow[i] = dark ? baseGlow[i] * (1 - inShape) : 0;
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
    // The outline lights up only once the stars have nearly gathered, over a
    // short stretch of `form`, and goes out early as they scatter. Its haze
    // comes in later than the tube and goes first, so the stars lead and the
    // glow only crowns a formed shape. Light mode keeps the plain tube,
    // because a haze on a light page reads as a smudge.
    const neon = clamp01((scene.form - 0.78) / 0.175);
    const outlineAlpha = neon * neon * (dark ? 0.75 : 0.55) * scene.presence;
    outlineMesh.visible = outlineAlpha > 0.003 && outlineCount > 0 && rw > 0;
    if (outlineMesh.visible) {
      for (let n = 0; n < outlineCount * 4; n += 2) {
        outlineSeg[n] = rx + outlineUnit[n] * rw;
        outlineSeg[n + 1] = ry + outlineUnit[n + 1] * rh;
      }
      outlineGeometry.setInstancedCount(outlineCount);
      outlineGeometry.attributes.aSeg.needsUpdate = true;
    }
    uniforms.uOutlineAlpha.value = outlineAlpha;
    uniforms.uGlow.value = dark ? neon * neon * neon : 0;
    uniforms.uLineAlpha.value = (dark ? 0.3 : 0.26) * scene.presence;
    lines.attributes.position.needsUpdate = true;
    lines.attributes.aAlpha.needsUpdate = true;
    points.attributes.position.needsUpdate = true;
    points.attributes.aAlpha.needsUpdate = true;
    points.attributes.aSize.needsUpdate = true;
    points.attributes.aKey.needsUpdate = true;
    points.attributes.aGlow.needsUpdate = true;
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
