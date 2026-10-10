// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R25 — A REAL FACE: the massif's shape read off a real mountainside.
//
// A resort can be raised on one of the REAL faces instead of the massif
// `massif.ts` deals: a 4×4 km stretch of a real ski mountain, its summit
// ridge along the map's top and its valley floor along the bottom, baked
// offline off the 30 m elevation model by `scripts/real-faces.mjs` into a
// generated file a face (`real-faces/face-<id>.ts`), listed in
// `real-faces-index.ts`. What the face replaces is the massif's
// SHAPE — the ridge, the profile, the bench, the folds a dealt mountain is
// given — and nothing else: the vertical is still dealt in R25's band (the
// face stretched to it, so its grades are the game's), the peak, the
// shoulder and the village are read off where the real ones stand, and the
// rollers and the little hills R3 lays are laid over it at their own scale,
// under the 30 m the model can see. Everything downstream — the lifts, the
// runs walked and graded, the woods, the courses — is built onto it as onto
// any massif, by the same rules and the same analysis.
//
// A face's id is its region and a number, a key that never moves. The
// start card names it by PLACE — the RANGE it lies in, the AREA its ski
// area is known by and the PART of that area — off the index the bake
// writes; never by a brand, a lift or a piste.
//
// A FACE IS LOADED BEFORE IT IS READ. Its heights and its hints are a
// chunk of their own, fetched only when a map is raised on it
// (`loadRealFace`), so the bundle carries the index alone however many
// faces there are. Reading a face that is listed but not loaded THROWS —
// a host that raised a map on it without loading it first would otherwise
// build a different mountain without a word.

import { base64 } from "./base64.ts";
import { RUN_GRADES, type RunGrade } from "./grades.ts";
import { FACE_GRID, FACE_INDEX, FACE_LOADERS, type FaceData } from "./real-faces-index.ts";
import { faceHasHints, loadRealHints, realHintsLoaded } from "./real-hints.ts";
import { HINT_GRADES, HINT_TREES } from "./real-hints-index.ts";
import type { RegionId } from "./regions.ts";

/** One face decoded: real heights over the map's square, m, row 0 the
 * map's top edge, `FACE_GRID.n` samples a side `FACE_GRID.cell` apart. */
export type RealFace = {
  readonly id: string;
  readonly region: RegionId;
  readonly heights: Float32Array;
};

/** Every face there is, in the order the bake lists them. */
export const REAL_FACE_IDS: readonly string[] = FACE_INDEX.map((f) => f.id);

/** The region a face lies in, or null for an id no face has. */
export function realFaceRegion(id: string): RegionId | null {
  return FACE_INDEX.find((f) => f.id === id)?.region ?? null;
}

/** Where a face is: its RANGE (a key the start card names — a country's
 * code, or a range across borders), its AREA (the place its ski area is
 * known by), the PART of the area it is, and its latitude and longitude
 * (°). Null for an id no face has. */
export function realFacePlace(
  id: string,
): { range: string; area: string; part: string; lat: number; lon: number } | null {
  const f = FACE_INDEX.find((e) => e.id === id);
  return f ? { range: f.range, area: f.area, part: f.part, lat: f.lat, lon: f.lon } : null;
}

/** A face's WOODS BY HEIGHT, read off the forest the real map draws: the
 * tree line and each band's share wooded, in the face's own real metres
 * (`lo` its lowest sample, `hi` its highest; the bands split the span
 * evenly, bottom first). */
export type FaceTrees = {
  readonly lo: number;
  readonly hi: number;
  readonly line: number;
  readonly bands: readonly number[];
};

/** A face's woods (`FaceTrees`), or null for a face whose map draws no
 * forest — its region's row stands in. Reads the face's heights, so it is
 * loaded first. */
export function realFaceTrees(face: RealFace): FaceTrees | null {
  const hex = HINT_TREES[face.id];
  if (!hex) return null;
  const bytes = Array.from(
    { length: hex.length / 2 },
    (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255,
  );
  let lo = Infinity;
  let hi = -Infinity;
  for (const h of face.heights) {
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  return { lo, hi, line: lo + bytes[0] * (hi - lo), bands: bytes.slice(1) };
}

/** How much of a face's ground `h` m up (real metres) is wooded, 0..1:
 * between the middles of its bands, linearly. */
export function faceCoverAt(trees: FaceTrees, h: number): number {
  const n = trees.bands.length;
  const t = ((h - trees.lo) / Math.max(1, trees.hi - trees.lo)) * n - 0.5;
  const i = Math.min(n - 1, Math.max(0, Math.floor(t)));
  const j = Math.min(n - 1, i + 1);
  const f = Math.min(1, Math.max(0, t - i));
  return trees.bands[i] + (trees.bands[j] - trees.bands[i]) * f;
}

/** The piste grades a face's real ski area signs — every one of R23's
 * four it has a piste of, and ORANGE always, since the game finds its own
 * ski routes on every face (R42). Empty for an id no face has. */
export function realFaceGrades(id: string): readonly RunGrade[] {
  if (!FACE_INDEX.some((f) => f.id === id)) return [];
  const signed = HINT_GRADES[id] ?? [];
  return RUN_GRADES.filter((g) => g === "orange" || signed.includes(g));
}

const loaded = new Map<string, FaceData>();
const loading = new Map<string, Promise<boolean>>();
const decoded = new Map<string, RealFace>();

/** Fetch a face's heights and hints, once; false for an id no face has.
 * Every host that raises a map on a face awaits this first. */
export function loadRealFace(id: string): Promise<boolean> {
  const load = FACE_LOADERS[id];
  if (!load) return Promise.resolve(false);
  if (realFaceLoaded(id)) return Promise.resolve(true);
  let pending = loading.get(id);
  if (!pending) {
    pending = Promise.all([load(), loadRealHints(id)]).then(([{ FACE }]) => {
      loaded.set(id, FACE);
      loading.delete(id);
      return true;
    });
    loading.set(id, pending);
  }
  return pending;
}

/** Every face loaded — a lab's or the suite's, never the app's. */
export async function loadAllRealFaces(): Promise<void> {
  await Promise.all(REAL_FACE_IDS.map(loadRealFace));
}

/** Whether a face's heights and hints are in hand. */
export function realFaceLoaded(id: string): boolean {
  return loaded.has(id) && (!faceHasHints(id) || realHintsLoaded(id));
}

/** A face by its id, decoded once; null for an id no face has. Throws for
 * a face that is listed but not loaded (`loadRealFace`). */
export function realFace(id: string): RealFace | null {
  const kept = decoded.get(id);
  if (kept) return kept;
  if (!FACE_LOADERS[id]) return null;
  const data = loaded.get(id);
  if (!data) throw new Error(`real face ${id} is not loaded (loadRealFace)`);
  const face = { id, region: data.region, heights: decode(data) };
  decoded.set(id, face);
  return face;
}

/** The base64 varints back to heights (the bake's `encode` undone). */
function decode(f: FaceData): Float32Array {
  const { n, step } = FACE_GRID;
  const bytes = base64(f.data);
  const q = new Int32Array(n * n);
  let at = 0;
  for (let i = 0; i < n * n; i++) {
    let z = 0;
    let shift = 0;
    let b: number;
    do {
      b = bytes[at++];
      z |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    const d = z & 1 ? -((z + 1) >>> 1) : z >>> 1;
    const r = Math.floor(i / n);
    const c = i - r * n;
    const left = c > 0 ? q[i - 1] : 0;
    const up = r > 0 ? q[i - n] : 0;
    const diag = r > 0 && c > 0 ? q[i - n - 1] : 0;
    q[i] = d + left + up - diag;
  }
  const out = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) out[i] = f.floor + q[i] * step;
  return out;
}

/** A Catmull–Rom weight set for a fraction `t` between samples 1 and 2. */
function weights(t: number, w: Float64Array): void {
  const t2 = t * t;
  const t3 = t2 * t;
  w[0] = -0.5 * t3 + t2 - 0.5 * t;
  w[1] = 1.5 * t3 - 2.5 * t2 + 1;
  w[2] = -1.5 * t3 + 2 * t2 + 0.5 * t;
  w[3] = 0.5 * t3 - 0.5 * t2;
}

const wx = new Float64Array(4);
const wz = new Float64Array(4);

/** The face's real height at a map point (`x`, `z`), m, bicubic between
 * its samples so the 2 m grid it is baked onto has no creases at 32 m. */
export function faceHeight(face: RealFace, x: number, z: number): number {
  const { n, cell } = FACE_GRID;
  const h = face.heights;
  const gx = Math.min(n - 1, Math.max(0, x / cell));
  const gz = Math.min(n - 1, Math.max(0, z / cell));
  const c = Math.min(n - 2, Math.floor(gx));
  const r = Math.min(n - 2, Math.floor(gz));
  weights(gx - c, wx);
  weights(gz - r, wz);
  let v = 0;
  for (let j = 0; j < 4; j++) {
    const rr = Math.min(n - 1, Math.max(0, r - 1 + j));
    let row = 0;
    for (let i = 0; i < 4; i++) {
      const cc = Math.min(n - 1, Math.max(0, c - 1 + i));
      row += h[rr * n + cc] * wx[i];
    }
    v += row * wz[j];
  }
  return v;
}

/** The mean of the face's heights over a band of rows and columns, m. */
export function faceMean(face: RealFace, x0: number, x1: number, z0: number, z1: number): number {
  const { cell } = FACE_GRID;
  let sum = 0;
  let count = 0;
  for (let z = z0; z <= z1; z += cell) {
    for (let x = x0; x <= x1; x += cell) {
      sum += faceHeight(face, x, z);
      count++;
    }
  }
  return sum / count;
}

/** Where along a row band (`z0`..`z1`) the face stands highest, or (with
 * `low`) lowest, between `x0` and `x1`: the x of the best column, m,
 * read on a 32 m step. */
export function faceExtreme(
  face: RealFace,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  low = false,
): number {
  const { cell } = FACE_GRID;
  let best = x0;
  let bestV = low ? Infinity : -Infinity;
  for (let x = x0; x <= x1; x += cell) {
    const v = faceMean(face, x, x, z0, z1);
    if (low ? v < bestV : v > bestV) {
      bestV = v;
      best = x;
    }
  }
  return best;
}
