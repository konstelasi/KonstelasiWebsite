/**
 * The living constellation: one WebGL canvas fixed behind every page.
 *
 * At rest it is the real sky over Yogyakarta at this moment, facing south.
 * Every star is a real one from the catalogue in `sky/`, placed by the clock,
 * so the sky turns with the Earth. Scrolling tilts the view, from near the
 * zenith at the top of a page down to the southern horizon. Two or three
 * constellations in view are drawn in, line by line, with their names. The
 * Moon sits at its real place and phase. Satellites and shooting stars cross
 * in front, and being nearer, they move more with the scroll and the pointer
 * than the stars do.
 *
 * A page can ask the sky to assemble into a shape (`assemble`) fitted into an
 * element, and to let it go again. `form`, from 0 (sky) to 1 (shape), is a
 * plain number, so GSAP can tween it or scrub it with the scroll. The stars
 * that form a shape are every constellation star and a share of the rest
 * from across the sky, and they fly back to their real places afterwards,
 * so the constellations form out of the breaking shape. The Moon never
 * joins a shape.
 *
 * Positions are worked out on the CPU in CSS pixels each frame and uploaded
 * as one buffer. With 1,400 stars that's cheap, and it keeps the shader
 * trivial. The scene only starts with WebGL and without reduced motion, and
 * it stops drawing while the tab is hidden. `sky/clock.ts` lists the URL
 * switches that take control of time for debugging.
 */
import { Renderer, Geometry, Program, Mesh, Transform } from 'ogl';
import { gsap, motionOn, finePointer } from './core';
import { fitRect, type Shape } from './shapes';
import skyUrl from './sky/sky.json?url';
import { decode, type Catalogue, type SkyData } from './sky/catalogue';
import { RAD, altAz, horizonAlt, sidereal, toLocal } from './sky/astro';
import { moon as moonAt, type Moon } from './sky/ephemeris';
import { activeShower, type Shower } from './sky/showers';
import { clock, skyNow } from './sky/clock';
import { startSkyLine } from './sky/line';

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
// constellation fades as a whole and a shooting star's tail fades to nothing.
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

// The Moon is a quad around its disc. `vLocal` is in disc radii, so the disc
// is everything inside 1 and the rest is room for its halo.
const MOON_VERTEX = /* glsl */ `
attribute vec2 position;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uRadius;
varying vec2 vLocal;
void main() {
  vLocal = position * 1.8;
  vec2 p = uCenter + vLocal * uRadius;
  vec2 clip = p / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

// Each point of the disc is a point on a sphere facing the viewer. It is lit
// where its normal faces the Sun, given as `uLight` in screen terms (x right,
// y down, z toward the viewer), which draws the terminator at the right
// curve for any phase. The dark part keeps a trace of earthshine.
const MOON_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uAlpha;
uniform float uGlow;
uniform float uDark;
uniform float uLit;
uniform float uEdge;
varying vec2 vLocal;
void main() {
  float r = length(vLocal);
  float disc = 1.0 - smoothstep(1.0 - uEdge, 1.0, r);
  vec3 n = vec3(vLocal, sqrt(max(0.0, 1.0 - r * r)));
  float lit = smoothstep(-0.05, 0.08, dot(n, uLight));
  float body = disc * mix(uDark, 0.95, lit);
  float halo = uGlow * uLit * 0.3 * exp(-max(r - 1.0, 0.0) * 4.0) * (1.0 - smoothstep(1.4, 1.8, r));
  float a = (body + halo * (1.0 - disc)) * uAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor * a, a);
}`;

/** The most outline segments the scene will draw for one shape. */
const MAX_OUTLINE = 2600;
/** Room for every constellation line at once, which only the debug view uses. */
const MAX_LINKS = 800;
/** The camera's tilt at the top of a page, in degrees above the horizon. */
const TOP_ALT = 72;
/** The most the view tilts per screen of scroll, so short pages tilt gently. */
const MAX_TILT = 6;
/** Highlighted constellations at once, on wide screens and on phones. */
const FIGURES_WIDE = 3;
const FIGURES_NARROW = 2;

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

/** What the debug panel (`sky/debug.ts`) reads and controls. */
export interface SkyHooks {
  state(): {
    camAlt: number;
    ppd: number;
    moon: { alt: number; az: number; lit: number; phase: string; inView: boolean; why: string } | null;
    sunAlt: number;
    shower: { name: string; radiantAlt: number } | null;
    pool: { bound: number; spare: number; rebinds: number };
    figures: Array<{ name: string; score: number; frac: number }>;
    frameMs: number;
  };
  /** Screen position of an altitude and azimuth, or null when behind the camera. */
  project(alt: number, az: number): [number, number] | null;
  /** Whether the Moon would be in view at `ms`, with the current tilt. */
  moonInView(ms: number): boolean;
  fireMeteor(): void;
  sendSatellite(): void;
  setShowAll(on: boolean): void;
  /** Call after moving the clock, so the sky catches up at once. */
  refresh(): void;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

async function load(): Promise<Catalogue> {
  const res = await fetch(skyUrl);
  if (!res.ok) throw new Error(`sky data answered ${res.status}`);
  return decode((await res.json()) as SkyData);
}

function create(cat: Catalogue): Scene | null {
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
  const labelLayer = document.createElement('div');
  labelLayer.className = 'sky-labels';
  labelLayer.setAttribute('aria-hidden', 'true');
  canvas.after(labelLayer);

  const N = window.innerWidth >= 900 ? 1400 : 650;

  // Each particle is bound to one catalogue star (`star`, -1 for a spare),
  // and carries that star's direction above Yogyakarta (`hx`, `hy`, `hz`:
  // east, north, up) and its brightness from 0 to 1. The rest is how it
  // moves while part of a shape: its stagger when joining, and how it floats
  // and glitters while it holds a filled shape.
  const star = new Int32Array(N).fill(-1);
  const particleOf = new Int32Array(cat.count).fill(-1);
  const hx = new Float32Array(N);
  const hy = new Float32Array(N);
  const hz = new Float32Array(N);
  const bright = new Float32Array(N);
  const stagger = new Float32Array(N);
  const twinkle = new Float32Array(N);
  const floatX = new Float32Array(N);
  const floatY = new Float32Array(N);
  const floatPhase = new Float32Array(N);
  const glint = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    stagger[i] = Math.random() * 0.55;
    twinkle[i] = Math.random() * Math.PI * 2;
    floatX[i] = 0.25 + Math.random() * 0.45;
    floatY[i] = 0.25 + Math.random() * 0.45;
    floatPhase[i] = Math.random() * Math.PI * 2;
    glint[i] = 0.3 + Math.random() * 0.6;
  }
  // Where each star sits in the sky this frame, before any shape moves it,
  // and how much the horizon dims it (0 below it, 1 well above).
  const skyPx = new Float32Array(N);
  const skyPy = new Float32Array(N);
  const ext = new Float32Array(N);
  // Spare particles wait off screen at a spot of their own.
  const spareX = new Float32Array(N);
  for (let i = 0; i < N; i++) spareX[i] = Math.random();

  const position = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const alpha = new Float32Array(N);
  const key = new Float32Array(N);
  const glow = new Float32Array(N);
  // Extra glow for the stars of a highlighted constellation, set each frame.
  const figGlow = new Float32Array(N);
  // How far each star has been pushed aside by the pointer. Decays back.
  const pushX = new Float32Array(N);
  const pushY = new Float32Array(N);
  // How far each star has joined the current shape, 0 to 1, so the
  // constellation lines can leave with the stars they join.
  const joined = new Float32Array(N);
  // Which point of the current shape each particle forms, or -1.
  const pointOf = new Int32Array(N).fill(-1);

  const points = new Geometry(gl, {
    position: { size: 3, data: position },
    aSize: { size: 1, data: size },
    aAlpha: { size: 1, data: alpha },
    aKey: { size: 1, data: key },
    aGlow: { size: 1, data: glow },
  });

  const linePos = new Float32Array(MAX_LINKS * 2 * 3);
  const lineAlpha = new Float32Array(MAX_LINKS * 2);
  const lines = new Geometry(gl, {
    position: { size: 3, data: linePos },
    aAlpha: { size: 1, data: lineAlpha },
  });

  // Satellites and shooting stars: one satellite and two meteor heads as
  // points, and the two meteor tails as lines.
  const T = 3;
  const tPos = new Float32Array(T * 3);
  const tSize = new Float32Array(T);
  const tAlpha = new Float32Array(T);
  const tGlow = new Float32Array(T);
  const transients = new Geometry(gl, {
    position: { size: 3, data: tPos },
    aSize: { size: 1, data: tSize },
    aAlpha: { size: 1, data: tAlpha },
    aKey: { size: 1, data: new Float32Array(T) },
    aGlow: { size: 1, data: tGlow },
  });
  const tailPos = new Float32Array(2 * 2 * 3);
  const tailAlpha = new Float32Array(2 * 2);
  const tails = new Geometry(gl, {
    position: { size: 3, data: tailPos },
    aAlpha: { size: 1, data: tailAlpha },
  });

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
  const moonUniforms = {
    uResolution: uniforms.uResolution,
    uColor: uniforms.uColor,
    uCenter: { value: [0, 0] },
    uRadius: { value: 10 },
    uLight: { value: [0, 0, 1] },
    uAlpha: { value: 0 },
    uGlow: { value: 0 },
    uDark: { value: 0.05 },
    uLit: { value: 1 },
    uEdge: { value: 0.1 },
  };
  const common = { uniforms, transparent: true, depthTest: false, depthWrite: false };
  const pointProgram = new Program(gl, { ...common, vertex: VERTEX, fragment: POINT_FRAGMENT });
  const lineProgram = new Program(gl, { ...common, vertex: LINE_VERTEX, fragment: LINE_FRAGMENT });
  const tailProgram = new Program(gl, { ...common, uniforms: { ...uniforms, uLineAlpha: { value: 0.8 } }, vertex: LINE_VERTEX, fragment: LINE_FRAGMENT });
  const outlineProgram = new Program(gl, { ...common, vertex: OUTLINE_VERTEX, fragment: OUTLINE_FRAGMENT });
  const moonProgram = new Program(gl, { ...common, uniforms: moonUniforms, vertex: MOON_VERTEX, fragment: MOON_FRAGMENT });
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
  const moonGeometry = new Geometry(gl, {
    position: { size: 2, data: new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]) },
    index: { data: new Uint16Array([0, 1, 2, 2, 1, 3]) },
  });
  const root = new Transform();
  const outlineMesh = new Mesh(gl, { geometry: outlineGeometry, program: outlineProgram });
  outlineMesh.setParent(root);
  new Mesh(gl, { geometry: lines, program: lineProgram, mode: gl.LINES }).setParent(root);
  new Mesh(gl, { geometry: tails, program: tailProgram, mode: gl.LINES }).setParent(root);
  const moonMesh = new Mesh(gl, { geometry: moonGeometry, program: moonProgram });
  moonMesh.setParent(root);
  new Mesh(gl, { geometry: points, program: pointProgram, mode: gl.POINTS }).setParent(root);
  new Mesh(gl, { geometry: transients, program: pointProgram, mode: gl.POINTS }).setParent(root);

  // Theme. Stars glow additively on dark, and sit as soft ink on light.
  let dark = false;
  function theme(): void {
    const css = getComputedStyle(document.documentElement);
    dark = css.colorScheme.includes('dark');
    uniforms.uColor.value = hexToRgb(css.getPropertyValue('--text'));
    uniforms.uKeyColor.value = hexToRgb(css.getPropertyValue('--brand'));
    for (const p of [pointProgram, lineProgram, tailProgram, outlineProgram, moonProgram]) {
      if (dark) p.setBlendFunc(gl.ONE, gl.ONE);
      else p.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }
  theme();
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);

  // The view. Pixels per degree follow the width, so Orion stands about
  // 280 px tall on a laptop and the phone still holds a good stretch of sky.
  // The camera tilts from TOP_ALT down to where the southern horizon meets
  // the bottom edge.
  const view = { W: 0, H: 0, ppd: 0, S: 0, low: 0, top: 0, alt: TOP_ALT };
  function measure(): void {
    view.W = window.innerWidth;
    view.H = window.innerHeight;
    view.ppd = Math.max(6.5, Math.min(16, view.W / 100));
    view.S = view.ppd / RAD;
    view.low = horizonAlt(view.H, view.S);
    view.top = Math.max(view.low, TOP_ALT);
  }
  measure();
  let docHeight = document.documentElement.scrollHeight;
  new ResizeObserver(() => (docHeight = document.documentElement.scrollHeight)).observe(document.body);

  /**
   * Screen position of a local direction for a camera tilted `alt` degrees,
   * as `out`, or false when it's behind the camera. The same stereographic
   * projection as `sky/astro.ts`, inlined because it runs for every star in
   * every frame.
   */
  const proj: [number, number] = [0, 0];
  function toScreen(x: number, y: number, z: number, s: number, c: number, out = proj): boolean {
    const Z = -y * c + z * s;
    if (Z < -0.6) return false;
    const k = (2 / (1 + Z)) * view.S;
    out[0] = view.W / 2 - x * k;
    out[1] = view.H / 2 - (y * s + z * c) * k;
    return true;
  }

  /** The camera's tilt from the scroll, unless the URL pinned it. */
  function tilt(scroll: number): void {
    const range = view.top - view.low;
    const progress = Math.min(1, scroll / Math.max(1, docHeight - view.H));
    view.alt = clock.alt ?? view.top - Math.min(range * progress, (MAX_TILT * scroll) / view.H);
  }

  /**
   * Every star's place on screen for this tilt, before any shape moves it,
   * and how much the horizon dims it. Stars are the far layer, so they lean
   * least toward the pointer.
   */
  function placeSky(sa: number, ca: number): void {
    const leanX = lean.x * 16;
    const leanY = lean.y * 10;
    for (let i = 0; i < N; i++) {
      if (star[i] < 0) {
        skyPx[i] = spareX[i] * view.W;
        skyPy[i] = -80;
        ext[i] = 0;
      } else if (toScreen(hx[i], hy[i], hz[i], sa, ca)) {
        skyPx[i] = proj[0] + leanX;
        skyPy[i] = proj[1] + leanY;
        // The horizon swallows a star, and the thick air near it dims one.
        ext[i] = hz[i] <= 0 ? 0 : 0.2 + 0.8 * clamp01(hz[i] / 0.2);
      } else {
        // Behind the camera: it keeps its last place, unseen.
        ext[i] = 0;
      }
    }
  }

  // The sky's state from the clock: the Moon and the shower, refreshed with
  // the stars' directions.
  let moonState: Moon | null = null;
  let shower: Shower | null = null;
  let radiant: [number, number, number] | null = null;
  const tmp: [number, number, number] = [0, 0, 0];

  function updateSky(now: number): void {
    const lst = sidereal(now);
    for (let i = 0; i < N; i++) {
      const s = star[i];
      if (s < 0) continue;
      toLocal(cat.ra[s], cat.dec[s], lst, tmp);
      hx[i] = tmp[0];
      hy[i] = tmp[1];
      hz[i] = tmp[2];
    }
    moonState = moonAt(now);
    shower = activeShower(now);
    radiant = shower ? toLocal(shower.ra, shower.dec, lst, [0, 0, 0]) : null;
  }

  // The pool. Each particle holds one of the stars that can come into view
  // at some scroll position: every constellation star there, then the
  // brightest of the rest. As the sky turns, stars that set or leave are
  // swapped for ones that came in, except while they're part of a shape.
  let rebindLog: number[] = [];
  let boundAt = 0;
  const reach = new Uint8Array(cat.count);
  const wanted = new Uint8Array(cat.count);
  const held = new Uint8Array(cat.count);
  const lowPt: [number, number] = [0, 0];
  const topPt: [number, number] = [0, 0];

  function bind(now: number): void {
    const lst = sidereal(now);
    const { W, H } = view;
    const m = 60;
    const sl = Math.sin(view.low * RAD);
    const cl = Math.cos(view.low * RAD);
    const st = Math.sin(view.top * RAD);
    const ct = Math.cos(view.top * RAD);
    reach.fill(0);
    for (let i = 0; i < cat.count; i++) {
      toLocal(cat.ra[i], cat.dec[i], lst, tmp);
      if (tmp[2] <= 0) continue;
      const a = toScreen(tmp[0], tmp[1], tmp[2], sl, cl, lowPt);
      const b = toScreen(tmp[0], tmp[1], tmp[2], st, ct, topPt);
      if (!a && !b) continue;
      const inX = (a && lowPt[0] > -m && lowPt[0] < W + m) || (b && topPt[0] > -m && topPt[0] < W + m);
      if (!inX) continue;
      const y0 = a ? lowPt[1] : topPt[1];
      const y1 = b ? topPt[1] : lowPt[1];
      if (Math.max(y0, y1) < -m || Math.min(y0, y1) > H + m) continue;
      reach[i] = 1;
    }
    const desired: number[] = [];
    for (const s of cat.figuresOf.keys()) if (reach[s]) desired.push(s);
    for (let i = 0; i < cat.count && desired.length < N; i++) if (reach[i] && !cat.figuresOf.has(i)) desired.push(i);
    desired.length = Math.min(desired.length, N);
    wanted.fill(0);
    for (const s of desired) wanted[s] = 1;

    held.fill(0);
    const free: number[] = [];
    for (let p = 0; p < N; p++) {
      const s = star[p];
      const locked = joined[p] > 0.001 || (pointOf[p] >= 0 && scene.form > 0.001);
      if (s >= 0 && (wanted[s] || locked)) {
        held[s] = 1;
        continue;
      }
      if (!locked) free.push(p);
    }
    let f = 0;
    const stamp = performance.now();
    for (const s of desired) {
      if (held[s]) continue;
      if (f >= free.length) break;
      const p = free[f++];
      if (star[p] >= 0) {
        particleOf[star[p]] = -1;
        rebindLog.push(stamp);
      }
      star[p] = s;
      particleOf[s] = p;
      held[s] = 1;
    }
    for (; f < free.length; f++) {
      const p = free[f];
      if (star[p] >= 0) particleOf[star[p]] = -1;
      star[p] = -1;
    }
    for (let p = 0; p < N; p++) {
      const s = star[p];
      bright[p] = s >= 0 ? clamp01((6 - cat.mag[s]) / 7.5) : 0;
    }
    rebindLog = rebindLog.filter((t) => stamp - t < 60000);
    boundAt = now;
    updateSky(now);
  }

  // Constellations. Each figure's lines are put in drawing order once: a walk
  // from its brightest star, so a figure draws itself like a pen tracing it.
  const figStars = cat.figures.map((f) => [...new Set(f.edges.flat())]);
  const ordered = cat.figures.map((f) => {
    const out: Array<[number, number]> = [];
    const left = [...f.edges];
    const seen = new Set<number>([Math.min(...f.edges.flat())]);
    while (left.length) {
      let k = left.findIndex(([a, b]) => seen.has(a) || seen.has(b));
      if (k < 0) {
        k = 0;
        seen.add(left[0][0]);
      }
      const [a, b] = left.splice(k, 1)[0];
      out.push(seen.has(a) ? [a, b] : [b, a]);
      seen.add(a);
      seen.add(b);
    }
    return out;
  });

  interface Chosen {
    k: number;
    /** How much of the figure is drawn, 0 to 1. */
    draw: number;
    /** Its opacity, which falls to 0 once it's dropped. */
    alpha: number;
    leaving: boolean;
    score: number;
    frac: number;
    label: HTMLSpanElement;
  }
  const chosen: Chosen[] = [];
  const cooldown = new Map<number, number>();
  let showAll = false;
  let lastPick = -10;

  function label(k: number): HTMLSpanElement {
    const el = document.createElement('span');
    el.textContent = cat.figures[k].name;
    el.style.opacity = '0';
    labelLayer.append(el);
    return el;
  }

  /** How much of figure `k` is on screen, its box, and whether all its stars are in the pool. */
  function measureFigure(k: number): { frac: number; all: boolean; x0: number; y0: number; x1: number; y1: number; b: number } {
    const { W, H } = view;
    let on = 0;
    let all = true;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    let b = 0;
    for (const s of figStars[k]) {
      const p = particleOf[s];
      if (p < 0 || ext[p] <= 0) {
        all = false;
        continue;
      }
      const x = skyPx[p];
      const y = skyPy[p];
      if (x > W * 0.04 && x < W * 0.96 && y > H * 0.05 && y < H * 0.9) on++;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      b += bright[p];
    }
    return { frac: on / figStars[k].length, all, x0, y0, x1, y1, b: b / figStars[k].length };
  }

  /** Keeps the highlighted figures that are still in view and fills the free places. */
  function pickFigures(time: number): void {
    lastPick = time;
    const max = view.W >= 900 ? FIGURES_WIDE : FIGURES_NARROW;
    const boxes: Array<[number, number, number, number]> = [];
    for (const c of chosen) {
      if (c.leaving) continue;
      const m = measureFigure(c.k);
      c.frac = m.frac;
      if (!showAll && (!m.all || m.frac < 0.6)) {
        c.leaving = true;
        cooldown.set(c.k, time + 6);
      } else {
        boxes.push([m.x0, m.y0, m.x1, m.y1]);
      }
    }
    let active = chosen.filter((c) => !c.leaving).length;
    if (!showAll && active >= max) return;
    const candidates: Array<{ k: number; score: number; frac: number; box: [number, number, number, number] }> = [];
    cat.figures.forEach((f, k) => {
      if (chosen.some((c) => c.k === k && !c.leaving)) return;
      if (!showAll && (cooldown.get(k) ?? 0) > time) return;
      const m = measureFigure(k);
      const w = m.x1 - m.x0;
      const h = m.y1 - m.y0;
      if (showAll) {
        if (m.frac >= 0.3) candidates.push({ k, score: 0, frac: m.frac, box: [m.x0, m.y0, m.x1, m.y1] });
        return;
      }
      if (!m.all || m.frac < 0.95 || Math.max(w, h) < 50 || w > view.W * 0.8 || h > view.H * 0.8) return;
      const rankWeight = f.rank === 1 ? 1 : f.rank === 2 ? 0.6 : 0.3;
      candidates.push({ k, score: rankWeight * (0.4 + m.b), frac: m.frac, box: [m.x0, m.y0, m.x1, m.y1] });
    });
    candidates.sort((a, b) => b.score - a.score);
    for (const c of candidates) {
      if (!showAll) {
        if (active >= max) break;
        // Keep the highlighted figures apart, so each reads on its own.
        const [x0, y0, x1, y1] = c.box;
        if (boxes.some(([a0, b0, a1, b1]) => x0 < a1 + 30 && x1 > a0 - 30 && y0 < b1 + 30 && y1 > b0 - 30)) continue;
        boxes.push(c.box);
      }
      const old = chosen.find((o) => o.k === c.k);
      if (old) {
        old.leaving = false;
        old.score = c.score;
      } else {
        chosen.push({ k: c.k, draw: showAll ? 1 : 0, alpha: 1, leaving: false, score: c.score, frac: c.frac, label: label(c.k) });
      }
      active++;
    }
  }

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

  // Phones fire `resize` as the address bar slides away, so the pool is only
  // rebuilt when the width changes.
  let builtFor = window.innerWidth;
  function resize(): void {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.uResolution.value = [window.innerWidth, window.innerHeight];
    measure();
    docHeight = document.documentElement.scrollHeight;
    if (window.innerWidth !== builtFor) {
      builtFor = window.innerWidth;
      bind(skyNow());
    }
  }
  resize();
  window.addEventListener('resize', resize);

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

      // Which stars form it: every constellation star, so the figures form
      // out of the shape as it breaks apart, then a random share of the
      // rest, spread over the whole sky. Spread matters: a shape that took
      // every star on screen would leave the sky that scrolls into view
      // empty while it holds.
      const figureFirst = Array.from({ length: N }, (_, i) => i)
        .filter((i) => star[i] >= 0)
        .map((i) => ({ i, rank: (cat.figuresOf.has(star[i]) ? 0 : 1) + Math.random() }));
      const spare = Array.from({ length: N }, (_, i) => i).filter((i) => star[i] < 0);
      const order = [...figureFirst.sort((a, b) => a.rank - b.rank).map((o) => o.i), ...spare];
      pointOf.fill(-1);
      for (let j = 0; j < Math.min(next.count, N); j++) pointOf[order[j]] = j;
    },
  };

  // Satellites: one at a time, a steady point crossing on a straight line.
  // Some pass into the Earth's shadow on the way and fade out.
  const sat = { on: false, t0: 0, dur: 40, x0: 0, y0: 0, x1: 0, y1: 0, shadow: -1, alt0: 0, next: 20 + Math.random() * 30 };
  function sendSatellite(time: number): void {
    const { W, H } = view;
    const side = Math.random() < 0.5;
    const a = Math.random();
    const b = Math.random();
    // From one edge to the opposite one, mostly across rather than down.
    if (side) Object.assign(sat, { x0: -20, y0: H * (0.1 + a * 0.6), x1: W + 20, y1: H * (0.1 + b * 0.6) });
    else Object.assign(sat, { x0: W + 20, y0: H * (0.1 + a * 0.6), x1: -20, y1: H * (0.1 + b * 0.6) });
    sat.on = true;
    sat.t0 = time;
    sat.dur = 30 + Math.random() * 30;
    sat.shadow = Math.random() < 0.4 ? 0.3 + Math.random() * 0.4 : -1;
    sat.alt0 = view.alt;
    sat.next = time + sat.dur + 60 + Math.random() * 60;
  }

  // Shooting stars. During a shower, most fly out from its radiant.
  const meteors = [0, 1].map(() => ({ on: false, t0: 0, dur: 0.7, x: 0, y: 0, dx: 0, dy: 0, len: 200, alt0: 0 }));
  let nextMeteor = 8 + Math.random() * 20;
  function fireMeteor(time: number): void {
    const m = meteors.find((o) => !o.on);
    if (!m) return;
    const { W, H } = view;
    m.x = W * (0.1 + Math.random() * 0.8);
    m.y = H * (0.08 + Math.random() * 0.5);
    let dx = 0;
    let dy = 0;
    const s = Math.sin(view.alt * RAD);
    const c = Math.cos(view.alt * RAD);
    const p: [number, number] = [0, 0];
    if (radiant && radiant[2] > 0.05 && Math.random() < 0.75 && toScreen(radiant[0], radiant[1], radiant[2], s, c, p)) {
      dx = m.x - p[0];
      dy = m.y - p[1];
    }
    if (Math.hypot(dx, dy) < 1) {
      const angle = (20 + Math.random() * 140) * RAD;
      dx = Math.cos(angle);
      dy = Math.sin(angle);
    }
    const l = Math.hypot(dx, dy);
    m.dx = dx / l;
    m.dy = dy / l;
    m.len = 180 + Math.random() * 140;
    m.dur = 0.55 + Math.random() * 0.35;
    m.t0 = time;
    m.alt0 = view.alt;
    m.on = true;
  }

  const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

  let lastTime = 0;
  let lastSky = -10;
  let lastBindTime = 0;
  let frameMs = 0;
  let moonInViewNow = false;
  let moonWhy = '';

  function frame(time: number): void {
    if (document.hidden) return;
    const started = performance.now();
    const dt = Math.min(0.1, Math.max(0, time - lastTime));
    lastTime = time;
    const { W, H } = view;
    const scroll = window.scrollY;
    lean.x += (pointer.x - lean.x) * 0.05;
    lean.y += (pointer.y - lean.y) * 0.05;

    tilt(scroll);
    const sa = Math.sin(view.alt * RAD);
    const ca = Math.cos(view.alt * RAD);

    // The sky turns a quarter of a degree a minute, so once a second is
    // plenty, unless the clock has been sped up.
    const now = skyNow();
    if (clock.speed !== 1 || time - lastSky >= 1) {
      lastSky = time;
      updateSky(now);
    }
    if (time - lastBindTime >= 10 || Math.abs(now - boundAt) > 600000) {
      lastBindTime = time;
      bind(now);
    }

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

    // Highlighted constellations: how far each is drawn. Which ones are in is
    // decided after the stars below have moved.
    figGlow.fill(0);
    for (let n = chosen.length - 1; n >= 0; n--) {
      const c = chosen[n];
      c.draw = Math.min(1, c.draw + dt / 1.5);
      if (c.leaving) c.alpha -= dt / 0.8;
      if (c.alpha <= 0) {
        c.label.remove();
        chosen.splice(n, 1);
        continue;
      }
      for (const s of figStars[c.k]) {
        const p = particleOf[s];
        if (p >= 0) figGlow[p] = Math.max(figGlow[p], c.alpha * c.draw);
      }
    }

    placeSky(sa, ca);
    for (let i = 0; i < N; i++) {
      const sx = skyPx[i];
      const sy = skyPy[i];
      const e = ext[i];
      let x = sx;
      let y = sy;
      let inShape = 0;
      const j = shape ? pointOf[i] : -1;
      if (shape && j >= 0 && rw > 0) {
        const w = ease((scene.form * 1.55 - stagger[i]) / 1);
        let tx = rx + shape.x[j] * rw;
        let ty = ry + shape.y[j] * rh;
        // A star in a filled shape floats about its place, never further than
        // its room, so the shape keeps its edge. Each axis mixes two sines
        // whose weights add up to 1, so it moves at most 0.7 of the room and
        // the drift as a whole stays inside it.
        const room = Math.min(shape.room[j] * rh * 0.7, 7);
        if (room > 0) {
          const ph = floatPhase[i];
          tx += room * (Math.sin(time * floatX[i] + ph) * 0.7 + Math.sin(time * floatX[i] * 2.3 + ph * 1.7) * 0.3);
          ty += room * (Math.sin(time * floatY[i] + ph * 2.1) * 0.7 + Math.sin(time * floatY[i] * 1.9 + ph * 0.6) * 0.3);
        }
        // A star from far beyond the edge enters from just outside it, so it
        // doesn't streak across the whole screen.
        const fx = Math.min(W * 1.15, Math.max(-W * 0.15, sx));
        const fy = Math.min(H * 1.15, Math.max(-H * 0.15, sy));
        // While breaking apart, stars arc outward from the shape's centre.
        const arc = Math.sin(w * Math.PI) * scene.burst * 140;
        const dx = tx - cx;
        const dy = ty - cy;
        const dl = Math.hypot(dx, dy) || 1;
        x = fx + (tx - fx) * w + (dx / dl) * arc;
        y = fy + (ty - fy) * w + (dy / dl) * arc;
        if (w <= 0) {
          x = sx;
          y = sy;
        }
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
      position[i * 3 + 2] = 0;
      joined[i] = inShape;

      // Brightness comes from the star's magnitude. Stars low in the sky
      // twinkle harder, as they do through more air.
      const b = bright[i];
      const lowSky = 1 - clamp01(hz[i] / 0.5);
      const tw = 1 - (0.18 + lowSky * 0.25) * (0.5 + 0.5 * Math.sin(time * (0.8 + b) + twinkle[i]));
      const skyAlpha = (0.14 + 0.8 * Math.pow(b, 0.8)) * tw * e + figGlow[i] * 0.25 * e;
      let a = skyAlpha;
      let s = 1.2 + 3 * Math.pow(b, 1.2) + figGlow[i] * 0.8;
      if (shape && j >= 0) {
        // A pulse runs along connector points, as data travelling the line.
        const p = shape.path[j];
        const pulse = p >= 0 ? Math.pow(Math.max(0, 1 - Math.abs(((p - time * 0.22) % 1 + 1) % 1 - 0.5) * 9), 2) : 0;
        // Stars in a filled shape glitter: a slow shimmer, and now and then a
        // short glint, a sine raised to a high power so it only peaks briefly.
        const filled = shape.room[j] > 0 ? 1 : 0;
        const shimmer = 1 - filled * 0.18 * (0.5 + 0.5 * Math.sin(time * 1.7 + twinkle[i]));
        const flash = filled * Math.pow(Math.max(0, Math.sin(time * glint[i] + twinkle[i] * 3)), 60);
        const shapeAlpha = (0.75 * shape.weight[j] + pulse * 0.9) * shimmer + flash * 0.7;
        a = skyAlpha + (shapeAlpha - skyAlpha) * inShape;
        s = s + (2.3 + pulse * 3 + flash * 2.2 - s) * inShape;
      } else if (shape) {
        // Stars not in the shape step back while it holds.
        a *= 1 - scene.form * 0.65;
      }
      alpha[i] = a * scene.presence * (dark ? 1 : 0.7);
      size[i] = s;
      // Violet only while a star is part of a shape, never loose in the sky.
      key[i] = shape && j >= 0 ? shape.key[j] * inShape : 0;
      // The glow belongs to the open sky, so it fades as a star joins a shape.
      // Dark only, because a halo of ink on a light page reads as a smudge.
      const starGlow = star[i] >= 0 ? clamp01((1.8 - cat.mag[star[i]]) / 3) * 0.8 : 0;
      glow[i] = dark ? Math.max(starGlow, figGlow[i] * (0.65 + 0.35 * b)) * (1 - inShape) * e : 0;
    }

    if (time - lastPick >= 1.5) pickFigures(time);

    // Constellation lines, drawn edge by edge as a figure comes in. A line
    // leaves with its stars when they join a shape, and fades at the screen's
    // edge and at the horizon.
    const edge = (v: number, extent: number): number => clamp01(Math.min(v + 40, extent + 40 - v) / 160);
    let seg = 0;
    for (const c of chosen) {
      const list = ordered[c.k];
      const n = list.length;
      let lx0 = Infinity;
      let lx1 = -Infinity;
      let ly1 = -Infinity;
      for (let k = 0; k < n && seg < MAX_LINKS; k++) {
        const pa = particleOf[list[k][0]];
        const pb = particleOf[list[k][1]];
        if (pa < 0 || pb < 0) continue;
        const ax = position[pa * 3];
        const ay = position[pa * 3 + 1];
        lx0 = Math.min(lx0, skyPx[pa], skyPx[pb]);
        lx1 = Math.max(lx1, skyPx[pa], skyPx[pb]);
        ly1 = Math.max(ly1, skyPy[pa], skyPy[pb]);
        const p = clamp01(c.draw * n - k);
        if (p <= 0) continue;
        const bx = ax + (position[pb * 3] - ax) * p;
        const by = ay + (position[pb * 3 + 1] - ay) * p;
        const fade = Math.min(edge(ax, W), edge(bx, W), edge(ay, H), edge(by, H));
        // A line only shows while its stars are about as far apart as their
        // real places, so stars still flying home from a shape don't drag it
        // into a long stroke. It comes in as they land.
        const rest = Math.hypot(skyPx[pa] - skyPx[pb], skyPy[pa] - skyPy[pb]) || 1;
        const now01 = Math.hypot(position[pb * 3] - ax, position[pb * 3 + 1] - ay);
        const stretch = clamp01((rest * 1.35 - now01) / (rest * 0.3)) * clamp01((now01 - rest * 0.65) / (rest * 0.3));
        const a01 = c.alpha * fade * stretch * Math.min(ext[pa], ext[pb]) * (1 - Math.max(joined[pa], joined[pb]));
        linePos[seg * 6] = ax;
        linePos[seg * 6 + 1] = ay;
        linePos[seg * 6 + 3] = bx;
        linePos[seg * 6 + 4] = by;
        lineAlpha[seg * 2] = a01;
        lineAlpha[seg * 2 + 1] = a01;
        seg++;
      }
      // The name sits under the figure, once most of it is drawn.
      if (lx0 < Infinity) {
        const x = Math.min(W - 48, Math.max(48, (lx0 + lx1) / 2));
        const y = Math.min(H - 48, Math.max(16, ly1 + 16));
        const o = c.alpha * clamp01(c.draw * 2 - 1) * scene.presence * (1 - scene.form) * 0.9;
        c.label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateX(-50%)`;
        c.label.style.opacity = o.toFixed(3);
      }
    }
    lines.setDrawRange(0, seg * 2);

    // The Moon, at its real place and phase, a few times its true size so
    // the phase reads. It never joins a shape, and steps aside for one.
    moonMesh.visible = false;
    moonInViewNow = false;
    moonWhy = 'not computed yet';
    if (moonState) {
      const m = moonState.dir;
      const radius = Math.max(8, 0.78 * view.ppd);
      const p: [number, number] = [0, 0];
      if (m[2] < -0.01) moonWhy = 'below the horizon';
      else if (!toScreen(m[0], m[1], m[2], sa, ca, p)) moonWhy = 'behind the camera';
      else if (p[0] < -radius * 2 || p[0] > W + radius * 2 || p[1] < -radius * 2 || p[1] > H + radius * 2) moonWhy = 'outside the view';
      else {
        moonInViewNow = true;
        moonWhy = '';
        // The lit side faces the Sun. Its direction on screen comes from a
        // point a little way from the Moon toward the Sun.
        const sd = moonState.sunDir;
        const dot = sd[0] * m[0] + sd[1] * m[1] + sd[2] * m[2];
        let tx = sd[0] - dot * m[0];
        let ty = sd[1] - dot * m[1];
        let tz = sd[2] - dot * m[2];
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx = m[0] + (tx / tl) * 0.01;
        ty = m[1] + (ty / tl) * 0.01;
        tz = m[2] + (tz / tl) * 0.01;
        const q: [number, number] = [0, 0];
        let bx = 0;
        let by = -1;
        if (toScreen(tx, ty, tz, sa, ca, q)) {
          const bl = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
          bx = (q[0] - p[0]) / bl;
          by = (q[1] - p[1]) / bl;
        }
        const i = moonState.phaseAngle * RAD;
        moonUniforms.uLight.value = [Math.sin(i) * bx, Math.sin(i) * by, Math.cos(i)];
        moonUniforms.uCenter.value = [p[0] + lean.x * 16, p[1] + lean.y * 10];
        moonUniforms.uRadius.value = radius;
        moonUniforms.uEdge.value = 1.2 / radius;
        moonUniforms.uLit.value = moonState.lit;
        moonUniforms.uGlow.value = dark ? 1 : 0;
        moonUniforms.uDark.value = dark ? 0.06 : 0.05;
        const low = 0.2 + 0.8 * clamp01(m[2] / 0.2);
        const overlap = rw > 0 && p[0] > rx - radius && p[0] < rx + rw + radius && p[1] > ry - radius && p[1] < ry + rh + radius ? scene.form : 0;
        moonUniforms.uAlpha.value = low * (1 - overlap) * scene.presence * (dark ? 1 : 0.75);
        moonMesh.visible = moonUniforms.uAlpha.value > 0.003;
      }
    }

    // Satellites and shooting stars are nearer than the stars, so they move
    // more with the scroll (as a share of the stars' own move since they
    // appeared) and lean further toward the pointer.
    tAlpha.fill(0);
    tailAlpha.fill(0);
    const quietSky = scene.form < 0.001;
    if (!sat.on && time > sat.next && quietSky) sendSatellite(time);
    if (sat.on) {
      const t = (time - sat.t0) / sat.dur;
      if (t >= 1) sat.on = false;
      else {
        const shift = (view.alt - sat.alt0) * RAD * view.S * 1.6;
        tPos[0] = sat.x0 + (sat.x1 - sat.x0) * t + lean.x * 40;
        tPos[1] = sat.y0 + (sat.y1 - sat.y0) * t + shift + lean.y * 25;
        let a = clamp01(t * sat.dur / 1.5) * clamp01((1 - t) * sat.dur / 1.5);
        if (sat.shadow > 0) a *= clamp01(1 - ((t - sat.shadow) * sat.dur) / 2.5);
        tAlpha[0] = a * 0.6 * scene.presence * clamp01(1 - scene.form * 3) * (dark ? 1 : 0.7);
        tSize[0] = 2.1;
        tGlow[0] = 0;
      }
    }
    if (time > nextMeteor) {
      if (quietSky) fireMeteor(time);
      nextMeteor = time + 20 + Math.random() * 20;
    }
    meteors.forEach((m, n) => {
      if (!m.on) return;
      const t = (time - m.t0) / m.dur;
      if (t >= 1) {
        m.on = false;
        return;
      }
      const shift = (view.alt - m.alt0) * RAD * view.S * 2.5;
      const along = m.len * Math.pow(t, 0.85);
      const hxp = m.x + m.dx * along + lean.x * 64;
      const hyp = m.y + m.dy * along + shift + lean.y * 40;
      const tail = m.len * 0.4 * Math.min(1, t * 3);
      const a = Math.pow(Math.sin(Math.PI * t), 0.6) * scene.presence * (dark ? 1 : 0.75);
      tPos[(n + 1) * 3] = hxp;
      tPos[(n + 1) * 3 + 1] = hyp;
      tAlpha[n + 1] = a;
      tSize[n + 1] = 2.4;
      tGlow[n + 1] = dark ? 0.5 : 0;
      tailPos[n * 6] = hxp;
      tailPos[n * 6 + 1] = hyp;
      tailPos[n * 6 + 3] = hxp - m.dx * tail;
      tailPos[n * 6 + 4] = hyp - m.dy * tail;
      tailAlpha[n * 2] = a;
      tailAlpha[n * 2 + 1] = 0;
    });

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
    uniforms.uLineAlpha.value = (dark ? 0.32 : 0.28) * scene.presence;
    lines.attributes.position.needsUpdate = true;
    lines.attributes.aAlpha.needsUpdate = true;
    tails.attributes.position.needsUpdate = true;
    tails.attributes.aAlpha.needsUpdate = true;
    transients.attributes.position.needsUpdate = true;
    transients.attributes.aAlpha.needsUpdate = true;
    transients.attributes.aSize.needsUpdate = true;
    transients.attributes.aGlow.needsUpdate = true;
    points.attributes.position.needsUpdate = true;
    points.attributes.aAlpha.needsUpdate = true;
    points.attributes.aSize.needsUpdate = true;
    points.attributes.aKey.needsUpdate = true;
    points.attributes.aGlow.needsUpdate = true;
    renderer.render({ scene: root });
    frameMs = frameMs * 0.9 + (performance.now() - started) * 0.1;
  }

  bind(skyNow());
  gsap.ticker.add(frame);
  document.documentElement.classList.add('webgl');
  const quiet = document.body.dataset.sky === 'quiet';
  gsap.to(scene, { presence: quiet ? 0.35 : 1, duration: 1.6, ease: 'power2.out' });
  startSkyLine(() => ({ moon: moonState, shower }));

  if (clock.debug) {
    const hooks: SkyHooks = {
      state() {
        const sunAlt = moonState ? altAz(moonState.sunDir).alt : 0;
        const mo = moonState ? altAz(moonState.dir) : null;
        return {
          camAlt: view.alt,
          ppd: view.ppd,
          moon: moonState && mo ? { ...mo, lit: moonState.lit, phase: moonState.phase, inView: moonInViewNow, why: moonWhy } : null,
          sunAlt,
          shower: shower && radiant ? { name: shower.en, radiantAlt: altAz(radiant).alt } : null,
          pool: { bound: star.filter((s) => s >= 0).length, spare: star.filter((s) => s < 0).length, rebinds: rebindLog.length },
          figures: chosen.filter((c) => !c.leaving).map((c) => ({ name: cat.figures[c.k].name, score: c.score, frac: c.frac })),
          frameMs,
        };
      },
      project(alt, az) {
        const a = alt * RAD;
        const z = az * RAD;
        const p: [number, number] = [0, 0];
        const ok = toScreen(Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a), Math.sin(view.alt * RAD), Math.cos(view.alt * RAD), p);
        return ok ? p : null;
      },
      moonInView(ms) {
        const m = moonAt(ms).dir;
        const p: [number, number] = [0, 0];
        if (m[2] < 0.02 || !toScreen(m[0], m[1], m[2], Math.sin(view.alt * RAD), Math.cos(view.alt * RAD), p)) return false;
        return p[0] > 0 && p[0] < view.W && p[1] > 0 && p[1] < view.H;
      },
      fireMeteor: () => fireMeteor(lastTime),
      sendSatellite: () => sendSatellite(lastTime),
      setShowAll(on) {
        showAll = on;
        for (const c of chosen) c.leaving = true;
        cooldown.clear();
        pickFigures(lastTime);
      },
      refresh() {
        bind(skyNow());
        for (const c of chosen) c.leaving = true;
        cooldown.clear();
        lastPick = -10;
      },
    };
    void import('./sky/debug').then((m) => m.openDebug(hooks));
  }
  return scene;
}

let instance: Promise<Scene | null> | null = null;

/** The page's scene, created on first call. Null when it can't or shouldn't run. */
export function getScene(): Promise<Scene | null> {
  if (!instance) {
    instance = new Promise((resolve) => {
      if (!motionOn) return resolve(null);
      // The star data loads alongside the idle wait. Without it there is no
      // sky to draw, and the page keeps its SVG fallbacks, as without WebGL.
      const data = load();
      const start = (): void => {
        data.then((cat) => resolve(create(cat))).catch(() => resolve(null));
      };
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start, { timeout: 600 });
      else window.setTimeout(start, 200);
    });
  }
  return instance;
}
