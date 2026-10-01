/**
 * The services system as a constellation, for the pinned sequence on the
 * home page. Three stage nodes on an arc are joined by connectors that carry
 * pulses, each stage drops a line to the ground of open innovation, and the
 * ground is a long double line with ticks.
 *
 * One variant per step of the sequence. All of them share the same points,
 * so switching variant never moves a star. Only the violet highlight moves
 * to the active stage and the connector leading into it.
 */
import { fromSegments, ellipse, type Segment, type Shape } from '../../motion/shapes';

const ASPECT = 1.15;
const NODES: Array<[number, number]> = [
  [0.17, 0.34],
  [0.5, 0.16],
  [0.83, 0.34],
];
const GROUND = 0.84;

function segments(active: number): Segment[] {
  const s: Segment[] = [];
  NODES.forEach(([x, y], i) => {
    const on = active === i;
    // The node: an outer ring, an inner ring and a short cross for density.
    s.push({ pts: ellipse(x, y, 0.075, 0.075 * ASPECT, 0, 40), key: on, weight: on ? 1 : 0.8 });
    s.push({ pts: ellipse(x, y, 0.035, 0.035 * ASPECT, 0, 24), key: on, weight: 1 });
    // Its line down to the ground.
    s.push({ pts: [[x, y + 0.09 * ASPECT], [x, GROUND - 0.02]], key: on, weight: 0.55, pulse: on });
    // The connector from the previous stage, carrying data into this one.
    if (i > 0) {
      const [px, py] = NODES[i - 1];
      s.push({ pts: [[px + 0.08, py - 0.02], [(px + x) / 2, Math.min(py, y) - 0.06], [x - 0.08, y - 0.02]], key: on, pulse: true, weight: 0.9 });
    }
  });
  const ground = active === 3;
  s.push({ pts: [[0.04, GROUND], [0.96, GROUND]], key: ground, pulse: ground, weight: 1 });
  s.push({ pts: [[0.04, GROUND + 0.05], [0.96, GROUND + 0.05]], key: ground, weight: 0.6 });
  for (let k = 0; k <= 18; k++) {
    const x = 0.04 + (k / 18) * 0.92;
    s.push({ pts: [[x, GROUND], [x - 0.02, GROUND + 0.05]], key: ground, weight: 0.45 });
  }
  return s;
}

/** Variants 0 to 2 light a stage, variant 3 lights the ground. */
export function systemShapes(count: number): Shape[] {
  // Build once with a fixed random state per variant by reusing positions.
  const base = fromSegments(segments(-1), count, ASPECT);
  return [0, 1, 2, 3].map((active) => {
    const lit = fromSegments(segments(active), count, ASPECT);
    // Same geometry, so copy positions from the base and keep only the
    // highlight of this variant, matched by nearest point.
    return relight(base, lit);
  });
}

/** Copies `lit`'s highlight onto `base`'s points without moving any. */
function relight(base: Shape, lit: Shape): Shape {
  const key = new Float32Array(base.count);
  const path = new Float32Array(base.count);
  const weight = new Float32Array(base.count);
  // A coarse grid lookup keeps this linear for a thousand points.
  const cell = 0.02;
  const grid = new Map<string, number[]>();
  for (let j = 0; j < lit.count; j++) {
    const k = `${Math.floor(lit.x[j] / cell)}:${Math.floor(lit.y[j] / cell)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(j);
  }
  for (let i = 0; i < base.count; i++) {
    const gx = Math.floor(base.x[i] / cell);
    const gy = Math.floor(base.y[i] / cell);
    let best = -1;
    let bestD = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${gx + dx}:${gy + dy}`) ?? []) {
          const d = (lit.x[j] - base.x[i]) ** 2 + (lit.y[j] - base.y[i]) ** 2;
          if (d < bestD) {
            bestD = d;
            best = j;
          }
        }
      }
    }
    if (best >= 0) {
      key[i] = lit.key[best];
      path[i] = lit.path[best];
      weight[i] = lit.weight[best];
    } else {
      key[i] = 0;
      path[i] = base.path[i];
      weight[i] = base.weight[i];
    }
  }
  return { ...base, key, path, weight };
}
