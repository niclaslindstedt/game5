// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THINNING A MESH TO A BUDGET (`make xray-body`): every corner snapped to a
// grid and the corners in a cell merged to their mean, the triangles that
// collapse dropped — vertex clustering, which keeps a piece's shape and its
// holes at the grid's scale and gives the faceted look the game's figures
// share. The cell is searched (halved and doubled, then bisected) for the
// finest grid that keeps the piece within its budget of triangles.

/** One clustering at cell `c`, m: `{ v, f }`. */
function cluster(v, f, c) {
  const cells = new Map();
  const sums = [];
  const of = new Int32Array(v.length / 3);
  for (let i = 0; i < v.length / 3; i++) {
    const key = `${Math.floor(v[i * 3] / c)},${Math.floor(v[i * 3 + 1] / c)},${Math.floor(v[i * 3 + 2] / c)}`;
    let k = cells.get(key);
    if (k === undefined) {
      k = sums.length;
      cells.set(key, k);
      sums.push([0, 0, 0, 0]);
    }
    const s = sums[k];
    s[0] += v[i * 3];
    s[1] += v[i * 3 + 1];
    s[2] += v[i * 3 + 2];
    s[3]++;
    of[i] = k;
  }
  const seen = new Set();
  const tri = [];
  for (let t = 0; t < f.length; t += 3) {
    const a = of[f[t]];
    const b = of[f[t + 1]];
    const d = of[f[t + 2]];
    if (a === b || b === d || a === d) continue;
    const key = [a, b, d].sort((p, q) => p - q).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    tri.push(a, b, d);
  }
  // Only the corners a triangle still uses, renumbered.
  const used = new Int32Array(sums.length).fill(-1);
  const out = [];
  const face = new Uint32Array(tri.length);
  for (let i = 0; i < tri.length; i++) {
    const k = tri[i];
    if (used[k] < 0) {
      used[k] = out.length / 3;
      const s = sums[k];
      out.push(s[0] / s[3], s[1] / s[3], s[2] / s[3]);
    }
    face[i] = used[k];
  }
  return { v: Float64Array.from(out), f: face };
}

/** A mesh `{ v, f }` (corners in m) thinned to `budget` triangles or fewer. */
export function thin(v, f, budget) {
  if (f.length / 3 <= budget) return { v, f };
  let lo = 0.0005;
  let hi = 0.002;
  while (cluster(v, f, hi).f.length / 3 > budget) hi *= 2;
  let best = cluster(v, f, hi);
  for (let k = 0; k < 14; k++) {
    const mid = Math.sqrt(lo * hi);
    const t = cluster(v, f, mid);
    if (t.f.length / 3 > budget) lo = mid;
    else {
      hi = mid;
      best = t;
    }
  }
  return best;
}
