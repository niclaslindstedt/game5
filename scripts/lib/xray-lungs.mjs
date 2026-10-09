// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LUNGS for the X-ray body lab (`make xray-body`). The body the skeleton
// comes from has no surface for the lungs — only their airways and vessels —
// and the hull round that tree, which the lab first drew, pushed out through
// the ribs and into the heart. A real lung fills its side of the chest: it
// lies against the inside of the ribs and the spine, sits on the dome of the
// diaphragm, rises a little over the first rib, and is hollowed on its inner
// face round the heart and the great vessels. So each lung is BUILT as that
// space, out of the same body's ribs, spine, sternum, diaphragm and
// mediastinum:
//
//   * THE CAGE, slice by slice up the chest: the inside of the ribs, the
//     spine and the sternum read round the slice's middle as the nearest
//     bone at every bearing, the lung kept a few millimetres inside it;
//   * THE FLOOR: the top of the diaphragm under every column;
//   * THE MIDDLE: the heart, the aorta, the venae cavae, the trachea and the
//     oesophagus, filled and grown by a few millimetres, kept out;
//   * THE TOP: the top of the tree the lung's airways branch through, the
//     apex rounded into a dome over the last slices;
//
// filled into a grid, blurred, read back as a surface and smoothed. Every
// input and the result are in the game's frame (x his right, y up, z
// forward, m).

import {
  at,
  blur,
  centre,
  fill,
  gridOver,
  grow,
  largest,
  smooth,
  surface,
} from "./xray-voxels.mjs";

const H = 0.004;
/** How far the lung keeps off the bone and the organs round it, m. */
const GAP = 0.003;
const BINS = 72;

const boxOf = (meshes) => {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const { v } of meshes)
    for (let i = 0; i < v.length; i += 3)
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], v[i + k]);
        hi[k] = Math.max(hi[k], v[i + k]);
      }
  return { lo, hi };
};

/** The inside of the cage at height y: its middle and the nearest bone at
 * each of `BINS` bearings round it, or null where the slice is too open to
 * read (above the ribs). */
function cageSlice(cage, y) {
  const pts = [];
  for (const { v } of cage)
    for (let i = 0; i < v.length; i += 3)
      if (Math.abs(v[i + 1] - y) < 0.012) pts.push([v[i], v[i + 2]]);
  if (pts.length < 40) return null;
  let lx = Infinity;
  let hx = -Infinity;
  let lz = Infinity;
  let hz = -Infinity;
  for (const [x, z] of pts) {
    lx = Math.min(lx, x);
    hx = Math.max(hx, x);
    lz = Math.min(lz, z);
    hz = Math.max(hz, z);
  }
  const mid = [(lx + hx) / 2, (lz + hz) / 2];
  const r = new Float64Array(BINS).fill(Infinity);
  for (const [x, z] of pts) {
    const dx = x - mid[0];
    const dz = z - mid[1];
    const b = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI)) * BINS) % BINS;
    r[b] = Math.min(r[b], Math.hypot(dx, dz));
  }
  const filled = r.filter((x) => x < Infinity).length;
  if (filled < BINS * 0.6) return null;
  // An empty bearing takes its nearest neighbours' reading.
  const out = Float64Array.from(r);
  for (let b = 0; b < BINS; b++) {
    if (r[b] < Infinity) continue;
    let p = 1;
    while (r[(b - p + BINS) % BINS] === Infinity) p++;
    let q = 1;
    while (r[(b + q) % BINS] === Infinity) q++;
    const a = r[(b - p + BINS) % BINS];
    const c = r[(b + q) % BINS];
    out[b] = a + ((c - a) * p) / (p + q);
  }
  // A lone point far in (a rib's head at the spine) never dents the wall more
  // than its neighbours agree to.
  const sm = new Float64Array(BINS);
  for (let b = 0; b < BINS; b++) {
    const w = [-1, 0, 1].map((d) => out[(b + d + BINS) % BINS]).sort((p, q) => p - q);
    sm[b] = w[1];
  }
  return { mid, r: sm };
}

/** Both lungs, `{ lungL, lungR }`, each a closed mesh `{ v, f }`. `parts`:
 * `cage` (ribs and their cartilage, the thoracic spine, the sternum),
 * `diaphragm`, `middle` (each a closed part, filled one by one), and
 * `tree.lungL` / `tree.lungR` (the airway trees, read for their top). */
export function buildLungs(parts) {
  const { cage, diaphragm, middle, tree } = parts;
  const box = boxOf(cage);
  const top = Math.max(boxOf(tree.lungL).hi[1], boxOf(tree.lungR).hi[1]) + 0.006;
  const lo = [box.lo[0] - 0.02, boxOf(diaphragm).lo[1] - 0.01, box.lo[2] - 0.02];
  const hi = [box.hi[0] + 0.02, top + 0.02, box.hi[2] + 0.02];
  const midX =
    boxOf(cage.filter((m) => m.spine)).lo[0] / 2 + boxOf(cage.filter((m) => m.spine)).hi[0] / 2;

  // THE CAGE, slice by slice.
  const g0 = gridOver(lo, hi, H);
  const slices = [];
  let lastGood = -1;
  for (let j = 0; j < g0.n[1]; j++) {
    const s = cageSlice(cage, lo[1] + j * H);
    slices.push(s);
    if (s) lastGood = j;
  }
  // Over the ribs, the dome: the last slice's wall drawn in to the apex.
  const domeFrom = Math.min(lastGood, Math.floor((top - 0.045 - lo[1]) / H));

  // THE FLOOR: the diaphragm's top, column by column (filled where a column
  // missed it, from its neighbours).
  const fx = g0.n[0];
  const fz = g0.n[2];
  const floor = new Float64Array(fx * fz).fill(-Infinity);
  for (const { v } of diaphragm)
    for (let p = 0; p < v.length; p += 3) {
      const i = Math.round((v[p] - lo[0]) / H);
      const k = Math.round((v[p + 2] - lo[2]) / H);
      for (let di = -1; di <= 1; di++)
        for (let dk = -1; dk <= 1; dk++) {
          const ii = i + di;
          const kk = k + dk;
          if (ii < 0 || kk < 0 || ii >= fx || kk >= fz) continue;
          floor[kk * fx + ii] = Math.max(floor[kk * fx + ii], v[p + 1]);
        }
    }
  for (let pass = 0; pass < 12; pass++)
    for (let k = 0; k < fz; k++)
      for (let i = 0; i < fx; i++) {
        if (floor[k * fx + i] > -Infinity) continue;
        let m = -Infinity;
        for (const [di, dk] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const ii = i + di;
          const kk = k + dk;
          if (ii >= 0 && kk >= 0 && ii < fx && kk < fz) m = Math.max(m, floor[kk * fx + ii]);
        }
        if (m > -Infinity) floor[k * fx + i] = m;
      }

  // THE MIDDLE, filled and grown.
  const mid = gridOver(lo, hi, H);
  for (const m of middle) fill(mid, m);
  grow(mid, GAP + H);

  const lungs = {};
  for (const side of ["lungL", "lungR"]) {
    const g = gridOver(lo, hi, H);
    for (let k = 0; k < g.n[2]; k++)
      for (let j = 0; j < g.n[1]; j++)
        for (let i = 0; i < g.n[0]; i++) {
          const p = centre(g, i, j, k);
          // His right is +x.
          if (side === "lungR" ? p[0] < midX + 0.006 : p[0] > midX - 0.006) continue;
          if (p[1] > top) continue;
          if (p[1] < floor[k * fx + i] + GAP) continue;
          if (mid.data[at(mid, i, j, k)] > 0.5) continue;
          const s = slices[Math.min(j, domeFrom)];
          if (!s) continue;
          const dx = p[0] - s.mid[0];
          const dz = p[2] - s.mid[1];
          const b = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI)) * BINS) % BINS;
          let wall = s.r[b] - GAP - 0.004;
          if (j > domeFrom) {
            const t = Math.min(1, ((j - domeFrom) * H) / (top - (lo[1] + domeFrom * H)));
            wall *= Math.sqrt(Math.max(0, 1 - t * t));
            // The apex rises over the back of the first rib, toward the side.
            const across = (side === "lungR" ? 1 : -1) * (p[0] - midX);
            if (across < 0.025) continue;
          }
          if (Math.hypot(dx, dz) < wall) g.data[at(g, i, j, k)] = 1;
        }
    largest(g);
    blur(g, 2);
    const m = smooth(surface(g, 0.5), 10);
    lungs[side] = outward(m);
  }
  return lungs;
}

/** The mesh with its triangles turned to face out (a positive volume). */
export function outward(m) {
  let vol = 0;
  const { v, f } = m;
  for (let t = 0; t < f.length; t += 3) {
    const a = f[t] * 3;
    const b = f[t + 1] * 3;
    const c = f[t + 2] * 3;
    vol +=
      v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) -
      v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) +
      v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]);
  }
  if (vol >= 0) return m;
  const out = Uint32Array.from(f);
  for (let t = 0; t < out.length; t += 3) [out[t + 1], out[t + 2]] = [out[t + 2], out[t + 1]];
  return { v, f: out };
}
