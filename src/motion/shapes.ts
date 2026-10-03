/**
 * Point sets the star field can assemble into. Every shape is a list of
 * points in a unit box (0 to 1 on both axes, with `aspect` = width / height),
 * which the scene then fits into an element on the page. Each point also
 * carries:
 *
 * - `key`: 1 for points drawn in the brand violet, 0 for the text colour.
 * - `path`: position along a connector, 0 to 1, for travelling pulses. -1
 *   for points that aren't on a connector.
 * - `weight`: brightness, 0 to 1.
 *
 * A shape also has an `outline`: polylines in the same unit box that trace
 * what the stars are meant to be. The scene fades them in as the stars gather
 * and out as they scatter, so the shape reads even before every star is home.
 *
 * Shapes come from SVG markup (the logo), from text (the 404), or from
 * lines drawn in code (the services system).
 */

export interface Outline {
  pts: Array<[number, number]>;
  /** Drawn in the brand violet rather than the text colour. */
  key: boolean;
}

export interface Shape {
  count: number;
  aspect: number;
  x: Float32Array;
  y: Float32Array;
  key: Float32Array;
  path: Float32Array;
  weight: Float32Array;
  outline: Outline[];
}

/**
 * Where a shape of `aspect` sits when fitted inside `box`, centred, using
 * `fit` of the room. The scene and any labels laid over the shape both use
 * it, so they always agree.
 */
export function fitRect(aspect: number, box: DOMRect, fit: number): { x: number; y: number; w: number; h: number } {
  let h: number;
  let w: number;
  if (box.width / Math.max(1, box.height) > aspect) {
    h = box.height * fit;
    w = h * aspect;
  } else {
    w = box.width * fit;
    h = w / aspect;
  }
  return { x: box.left + (box.width - w) / 2, y: box.top + (box.height - h) / 2, w, h };
}

interface Pt {
  x: number;
  y: number;
  key: number;
  path: number;
  weight: number;
}

function build(points: Pt[], aspect: number, outline: Outline[] = []): Shape {
  const n = points.length;
  const s: Shape = {
    count: n,
    aspect,
    x: new Float32Array(n),
    y: new Float32Array(n),
    key: new Float32Array(n),
    path: new Float32Array(n),
    weight: new Float32Array(n),
    outline,
  };
  // Shuffle, so the particles that join a shape first are spread over all
  // of it rather than filling it from one corner.
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }
  points.forEach((p, i) => {
    s.x[i] = p.x;
    s.y[i] = p.y;
    s.key[i] = p.key;
    s.path[i] = p.path;
    s.weight[i] = p.weight;
  });
  return s;
}

function context(): CanvasRenderingContext2D {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return ctx;
}

/**
 * Fills the paths of an SVG with `n` points in total, sharing them out by
 * area. A path's `fill-opacity` becomes the brightness of its points, and a
 * faint path (below 0.5) is drawn in violet. In the logo that's the orbit
 * band, so the ring of the mark comes out in the brand colour.
 */
export function fromSvg(markup: string, n: number): Shape {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const svg = doc.documentElement;
  const [, , vw, vh] = (svg.getAttribute('viewBox') ?? '0 0 100 100').split(/\s+/).map(Number);
  const ctx = context();
  const paths = [...svg.querySelectorAll('path')].map((el) => ({
    path: new Path2D(el.getAttribute('d') ?? ''),
    rule: (el.getAttribute('fill-rule') === 'evenodd' ? 'evenodd' : 'nonzero') as CanvasFillRule,
    opacity: Number(el.getAttribute('fill-opacity') ?? 1),
  }));

  const points: Pt[] = [];
  let guard = n * 400;
  while (points.length < n && guard-- > 0) {
    const x = Math.random() * vw;
    const y = Math.random() * vh;
    // The topmost path containing the point wins, as in the drawing.
    for (let p = paths.length - 1; p >= 0; p--) {
      const { path, rule, opacity } = paths[p];
      if (!ctx.isPointInPath(path, x, y, rule)) continue;
      const faint = opacity < 0.5;
      points.push({ x: x / vw, y: y / vh, key: faint ? 1 : 0, path: -1, weight: faint ? 0.9 : 1 });
      break;
    }
  }
  return build(points, vw / vh, outlineOfSvg(svg, vw, vh));
}

/**
 * Traces every contour of an SVG's paths as a polyline in the unit box. The
 * browser measures the paths, so they are attached to the page, hidden, for
 * the moment it takes. A faint path (the logo's orbit band) is a violet line.
 */
function outlineOfSvg(svg: Element, vw: number, vh: number): Outline[] {
  const NS = 'http://www.w3.org/2000/svg';
  const host = document.createElementNS(NS, 'svg');
  host.setAttribute('width', '0');
  host.setAttribute('height', '0');
  host.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  document.body.appendChild(host);
  const out: Outline[] = [];
  const step = vw / 110;
  for (const el of svg.querySelectorAll('path')) {
    const key = Number(el.getAttribute('fill-opacity') ?? 1) < 0.5;
    for (const sub of (el.getAttribute('d') ?? '').match(/M[^M]*/gi) ?? []) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', sub);
      host.appendChild(path);
      const len = path.getTotalLength();
      if (len < step * 4) continue;
      const pts: Array<[number, number]> = [];
      const n = Math.ceil(len / step);
      for (let i = 0; i <= n; i++) {
        const p = path.getPointAtLength((i / n) * len);
        pts.push([p.x / vw, p.y / vh]);
      }
      out.push({ pts, key });
    }
  }
  host.remove();
  return out;
}

/** Fills the glyphs of a short text with `n` points. */
export function fromText(text: string, n: number, font = '600 200px Poppins, sans-serif'): Shape {
  const ctx = context();
  ctx.font = font;
  const m = ctx.measureText(text);
  const w = Math.ceil(m.width) + 20;
  const h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 20;
  ctx.canvas.width = w;
  ctx.canvas.height = h;
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, 10, 10 + m.actualBoundingBoxAscent);
  const data = ctx.getImageData(0, 0, w, h).data;

  const points: Pt[] = [];
  let guard = n * 400;
  while (points.length < n && guard-- > 0) {
    const x = Math.floor(Math.random() * w);
    const y = Math.floor(Math.random() * h);
    if (data[(y * w + x) * 4 + 3] > 128) points.push({ x: x / w, y: y / h, key: 0, path: -1, weight: 1 });
  }
  return build(points, w / h);
}

export interface Segment {
  /** Points of a polyline in the unit box. */
  pts: Array<[number, number]>;
  key?: boolean;
  /** Carries travelling pulses. */
  pulse?: boolean;
  weight?: number;
}

/**
 * Lays `n` points along polylines, shared out by length, so a diagram reads
 * as dotted lines of light. Pulse segments record each point's position along
 * the line for the travelling glow.
 */
export function fromSegments(segments: Segment[], n: number, aspect: number): Shape {
  const lengths = segments.map((s) => {
    let len = 0;
    for (let i = 1; i < s.pts.length; i++) {
      len += Math.hypot((s.pts[i][0] - s.pts[i - 1][0]) * aspect, s.pts[i][1] - s.pts[i - 1][1]);
    }
    return len;
  });
  const total = lengths.reduce((a, b) => a + b, 0);
  const points: Pt[] = [];

  segments.forEach((seg, si) => {
    const count = Math.max(2, Math.round((lengths[si] / total) * n));
    for (let k = 0; k < count; k++) {
      const t = k / (count - 1);
      // Walk to distance t along the polyline.
      let target = t * lengths[si];
      let x = seg.pts[0][0];
      let y = seg.pts[0][1];
      for (let i = 1; i < seg.pts.length; i++) {
        const [x0, y0] = seg.pts[i - 1];
        const [x1, y1] = seg.pts[i];
        const len = Math.hypot((x1 - x0) * aspect, y1 - y0);
        if (target <= len || i === seg.pts.length - 1) {
          const f = len === 0 ? 0 : Math.min(1, target / len);
          x = x0 + (x1 - x0) * f;
          y = y0 + (y1 - y0) * f;
          break;
        }
        target -= len;
      }
      const jitter = 0.004;
      points.push({
        x: x + (Math.random() - 0.5) * jitter,
        y: y + (Math.random() - 0.5) * jitter * aspect,
        key: seg.key ? 1 : 0,
        path: seg.pulse ? t : -1,
        weight: seg.weight ?? 1,
      });
    }
  });
  // The lines themselves are the outline, without the faint tick marks.
  const outline = segments.filter((s) => (s.weight ?? 1) >= 0.5).map((s) => ({ pts: s.pts, key: !!s.key }));
  return build(points, aspect, outline);
}

/** An ellipse as a closed polyline, for orbits and rings. */
export function ellipse(cx: number, cy: number, rx: number, ry: number, tilt = 0, steps = 96): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  return pts;
}
