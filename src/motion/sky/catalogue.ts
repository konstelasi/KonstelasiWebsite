/**
 * The star catalogue and constellation figures made by `scripts/gen-sky.ts`,
 * decoded. No DOM here: the scene fetches the two files and hands their
 * contents over, and `scripts/verify-sky.ts` reads them from disk.
 */

export interface Figure {
  name: string;
  /** 1 for the well-known figures, 3 for the faint ones. */
  rank: number;
  /** Pairs of star indices into the catalogue. */
  edges: Array<[number, number]>;
}

export interface SkyData {
  epoch: number;
  stars: number;
  figures: Figure[];
}

export interface Catalogue {
  count: number;
  /** Right ascension and declination in degrees, at the data's epoch. */
  ra: Float32Array;
  dec: Float32Array;
  /** Visual magnitude. Lower is brighter, and 6.5 is about the faintest the eye sees. */
  mag: Float32Array;
  figures: Figure[];
  /** For each star, the figures it belongs to, if any. */
  figuresOf: Map<number, number[]>;
}

export function decode(bin: ArrayBuffer, data: SkyData): Catalogue {
  const view = new DataView(bin);
  const count = Math.floor(bin.byteLength / 5);
  const ra = new Float32Array(count);
  const dec = new Float32Array(count);
  const mag = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    ra[i] = (view.getUint16(i * 5, true) / 65536) * 360;
    dec[i] = (view.getInt16(i * 5 + 2, true) / 32767) * 90;
    mag[i] = view.getInt8(i * 5 + 4) / 10;
  }
  const figuresOf = new Map<number, number[]>();
  data.figures.forEach((f, k) => {
    for (const s of new Set(f.edges.flat())) {
      if (!figuresOf.has(s)) figuresOf.set(s, []);
      figuresOf.get(s)!.push(k);
    }
  });
  return { count, ra, dec, mag, figures: data.figures, figuresOf };
}
