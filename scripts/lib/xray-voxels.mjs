// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// VOXELS FOR THE X-RAY BODY LAB (`make xray-body`): a closed mesh filled
// into a grid (a ray up every column, the inside between its crossings),
// a grid grown or blurred, and a grid's surface read back as a mesh
// (SURFACE NETS: a corner in every cell the surface passes through, a quad
// across every grid edge it cuts) and smoothed (Taubin's two-step, which
// rounds without shrinking). The lungs are built with them (`xray-lungs.mjs`)
// and the lab's clipping table measures with them.

/** A grid over a box: `lo` its corner, `h` its cell, `n` its cells a side. */
export function gridOver(lo, hi, h) {
  const n = [0, 1, 2].map((k) => Math.max(2, Math.ceil((hi[k] - lo[k]) / h) + 1));
  return { lo, h, n, data: new Float32Array(n[0] * n[1] * n[2]) };
}

export const at = (g, i, j, k) => (k * g.n[1] + j) * g.n[0] + i;
export const centre = (g, i, j, k) => [g.lo[0] + i * g.h, g.lo[1] + j * g.h, g.lo[2] + k * g.h];

/** Fill a closed mesh `{ v, f }` into the grid (sets 1 inside). A ray up y
 * through every column's centre; the inside lies between pairs of crossings. */
export function fill(g, mesh) {
  const { v, f } = mesh;
  const cols = new Map();
  for (let t = 0; t < f.length; t += 3) {
    const a = f[t] * 3;
    const b = f[t + 1] * 3;
    const c = f[t + 2] * 3;
    const ax = v[a];
    const az = v[a + 2];
    const bx = v[b];
    const bz = v[b + 2];
    const cx = v[c];
    const cz = v[c + 2];
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(den) < 1e-14) continue;
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - g.lo[0]) / g.h));
    const i1 = Math.min(g.n[0] - 1, Math.floor((Math.max(ax, bx, cx) - g.lo[0]) / g.h));
    const k0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - g.lo[2]) / g.h));
    const k1 = Math.min(g.n[2] - 1, Math.floor((Math.max(az, bz, cz) - g.lo[2]) / g.h));
    for (let i = i0; i <= i1; i++)
      for (let k = k0; k <= k1; k++) {
        // A hair off the grid's lines, so a ray never runs down an edge.
        const x = g.lo[0] + i * g.h + 1.3e-7;
        const z = g.lo[2] + k * g.h + 0.7e-7;
        const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den;
        const w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const y = w0 * v[a + 1] + w1 * v[b + 1] + w2 * v[c + 1];
        const key = k * g.n[0] + i;
        const list = cols.get(key);
        if (list) list.push(y);
        else cols.set(key, [y]);
      }
  }
  for (const [key, ys] of cols) {
    if (ys.length < 2) continue;
    ys.sort((p, q) => p - q);
    const i = key % g.n[0];
    const k = Math.floor(key / g.n[0]);
    for (let s = 0; s + 1 < ys.length; s += 2) {
      const j0 = Math.max(0, Math.ceil((ys[s] - g.lo[1]) / g.h));
      const j1 = Math.min(g.n[1] - 1, Math.floor((ys[s + 1] - g.lo[1]) / g.h));
      for (let j = j0; j <= j1; j++) g.data[at(g, i, j, k)] = 1;
    }
  }
  return g;
}

/** Every cell within `r` (m) of a set cell set too. */
export function grow(g, r) {
  const steps = Math.round(r / g.h);
  let cur = g.data;
  for (let s = 0; s < steps; s++) {
    const next = Float32Array.from(cur);
    for (let k = 0; k < g.n[2]; k++)
      for (let j = 0; j < g.n[1]; j++)
        for (let i = 0; i < g.n[0]; i++) {
          if (cur[at(g, i, j, k)] < 0.5) continue;
          if (i > 0) next[at(g, i - 1, j, k)] = 1;
          if (i < g.n[0] - 1) next[at(g, i + 1, j, k)] = 1;
          if (j > 0) next[at(g, i, j - 1, k)] = 1;
          if (j < g.n[1] - 1) next[at(g, i, j + 1, k)] = 1;
          if (k > 0) next[at(g, i, j, k - 1)] = 1;
          if (k < g.n[2] - 1) next[at(g, i, j, k + 1)] = 1;
        }
    cur = next;
  }
  g.data = cur;
  return g;
}

/** A box blur, `passes` times, over each axis in turn. */
export function blur(g, passes = 1) {
  const { n } = g;
  for (let p = 0; p < passes; p++)
    for (let axis = 0; axis < 3; axis++) {
      const out = new Float32Array(g.data.length);
      const step = axis === 0 ? 1 : axis === 1 ? n[0] : n[0] * n[1];
      for (let idx = 0; idx < g.data.length; idx++) {
        const c = [idx % n[0], Math.floor(idx / n[0]) % n[1], Math.floor(idx / (n[0] * n[1]))][
          axis
        ];
        let s = g.data[idx];
        let w = 1;
        if (c > 0) {
          s += g.data[idx - step];
          w++;
        }
        if (c < n[axis] - 1) {
          s += g.data[idx + step];
          w++;
        }
        out[idx] = s / w;
      }
      g.data = out;
    }
  return g;
}

/** The largest connected part of the cells above `iso` kept, the rest
 * cleared. */
export function largest(g, iso = 0.5) {
  const label = new Int32Array(g.data.length).fill(-1);
  let best = -1;
  let bestN = 0;
  let next = 0;
  const { n } = g;
  for (let s = 0; s < g.data.length; s++) {
    if (g.data[s] <= iso || label[s] >= 0) continue;
    const id = next++;
    const stack = [s];
    label[s] = id;
    let count = 0;
    while (stack.length) {
      const c = stack.pop();
      count++;
      const i = c % n[0];
      const j = Math.floor(c / n[0]) % n[1];
      const k = Math.floor(c / (n[0] * n[1]));
      const nb = [];
      if (i > 0) nb.push(c - 1);
      if (i < n[0] - 1) nb.push(c + 1);
      if (j > 0) nb.push(c - n[0]);
      if (j < n[1] - 1) nb.push(c + n[0]);
      if (k > 0) nb.push(c - n[0] * n[1]);
      if (k < n[2] - 1) nb.push(c + n[0] * n[1]);
      for (const q of nb)
        if (g.data[q] > iso && label[q] < 0) {
          label[q] = id;
          stack.push(q);
        }
    }
    if (count > bestN) {
      bestN = count;
      best = id;
    }
  }
  for (let s = 0; s < g.data.length; s++)
    if (label[s] !== best) g.data[s] = Math.min(g.data[s], iso * 0.5);
  return g;
}

/** The surface where the grid crosses `iso`, as a closed mesh `{ v, f }`
 * whose triangles face out of the inside (the cells above `iso`). */
export function surface(g, iso = 0.5) {
  const { n, data } = g;
  const val = (i, j, k) =>
    i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2] ? 0 : data[at(g, i, j, k)];
  // A corner in every cell (i..i+1, …) whose 8 samples straddle iso; cells
  // are offset by one so the grid's own border is outside.
  const vid = new Map();
  const v = [];
  const cellKey = (i, j, k) => ((k + 1) * (n[1] + 2) + (j + 1)) * (n[0] + 2) + (i + 1);
  for (let k = -1; k < n[2]; k++)
    for (let j = -1; j < n[1]; j++)
      for (let i = -1; i < n[0]; i++) {
        let s = [0, 0, 0];
        let cnt = 0;
        const c = [];
        for (let d = 0; d < 8; d++)
          c.push(val(i + (d & 1), j + ((d >> 1) & 1), k + ((d >> 2) & 1)));
        // The twelve edges.
        for (let d = 0; d < 8; d++)
          for (const e of [1, 2, 4]) {
            if (d & e) continue;
            const a = c[d];
            const b = c[d | e];
            if (a > iso === b > iso) continue;
            const t = (iso - a) / (b - a);
            const p = [i + (d & 1), j + ((d >> 1) & 1), k + ((d >> 2) & 1)];
            const axis = e === 1 ? 0 : e === 2 ? 1 : 2;
            p[axis] += t;
            s = [s[0] + p[0], s[1] + p[1], s[2] + p[2]];
            cnt++;
          }
        if (cnt === 0) continue;
        vid.set(cellKey(i, j, k), v.length / 3);
        v.push(
          g.lo[0] + (s[0] / cnt) * g.h,
          g.lo[1] + (s[1] / cnt) * g.h,
          g.lo[2] + (s[2] / cnt) * g.h,
        );
      }
  const f = [];
  // A quad across every grid edge the surface cuts: the four cells round it.
  for (let k = 0; k < n[2]; k++)
    for (let j = 0; j < n[1]; j++)
      for (let i = 0; i < n[0]; i++) {
        const a = val(i, j, k) > iso;
        for (let axis = 0; axis < 3; axis++) {
          const o = [i, j, k];
          o[axis]++;
          const b = val(o[0], o[1], o[2]) > iso;
          if (a === b) continue;
          // The two other axes, so (u, w, axis) is right handed.
          const u = (axis + 1) % 3;
          const w = (axis + 2) % 3;
          const cell = (du, dw) => {
            const q = [i, j, k];
            q[u] -= du;
            q[w] -= dw;
            return vid.get(cellKey(q[0], q[1], q[2]));
          };
          const q = [cell(0, 0), cell(1, 0), cell(1, 1), cell(0, 1)];
          if (q.some((x) => x === undefined)) continue;
          // Facing +axis when the inside is behind (a), −axis otherwise.
          if (a) f.push(q[0], q[1], q[2], q[0], q[2], q[3]);
          else f.push(q[0], q[2], q[1], q[0], q[3], q[2]);
        }
      }
  return { v: Float64Array.from(v), f: Uint32Array.from(f) };
}

/** Taubin's smoothing: a step toward the neighbours' mean and a step back
 * past it, `iterations` times, which rounds a surface without shrinking it. */
export function smooth(mesh, iterations = 12, lambda = 0.5, mu = -0.53) {
  const nv = mesh.v.length / 3;
  const nb = Array.from({ length: nv }, () => new Set());
  for (let t = 0; t < mesh.f.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = mesh.f[t + e];
      const b = mesh.f[t + ((e + 1) % 3)];
      nb[a].add(b);
      nb[b].add(a);
    }
  const v = Float64Array.from(mesh.v);
  const step = (k) => {
    const out = Float64Array.from(v);
    for (let i = 0; i < nv; i++) {
      if (nb[i].size === 0) continue;
      const m = [0, 0, 0];
      for (const j of nb[i]) for (let a = 0; a < 3; a++) m[a] += v[j * 3 + a];
      for (let a = 0; a < 3; a++)
        out[i * 3 + a] = v[i * 3 + a] + k * (m[a] / nb[i].size - v[i * 3 + a]);
    }
    v.set(out);
  };
  for (let it = 0; it < iterations; it++) {
    step(lambda);
    step(mu);
  }
  return { v, f: mesh.f };
}

/** Every part filled into one grid of cell `h`, blurred and read back as one
 * closed, smoothed surface: an organ made of many parts (the heart's
 * chambers and vessels, the bowel's loops, the brain's lobes) as the one
 * shape the eye reads, which a collapse can then thin. Bits under `least`
 * of the whole are dropped, and every plate grown by `thicken`, m. */
export function remesh(parts, h, least = 0.02, thicken = 0) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const { v } of parts)
    for (let i = 0; i < v.length; i += 3)
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], v[i + k]);
        hi[k] = Math.max(hi[k], v[i + k]);
      }
  const g = gridOver(
    lo.map((x) => x - 3 * h),
    hi.map((x) => x + 3 * h),
    h,
  );
  for (const p of parts) {
    const one = gridOver(
      g.lo,
      hi.map((x) => x + 3 * h),
      h,
    );
    fill(one, p);
    for (let i = 0; i < g.data.length; i++) if (one.data[i] > 0.5) g.data[i] = 1;
  }
  dropSmall(g, least);
  // A plate thinner than a cell or two (the temple) is thickened, or it
  // reads back with holes in it.
  if (thicken > 0) grow(g, thicken);
  blur(g, 1);
  return smooth(surface(g, 0.5), 6);
}

/** The connected parts of the set cells under `least` of them all cleared. */
function dropSmall(g, least) {
  const label = new Int32Array(g.data.length).fill(-1);
  const sizes = [];
  const { n } = g;
  for (let s = 0; s < g.data.length; s++) {
    if (g.data[s] <= 0.5 || label[s] >= 0) continue;
    const id = sizes.length;
    const stack = [s];
    label[s] = id;
    let count = 0;
    while (stack.length) {
      const c = stack.pop();
      count++;
      const i = c % n[0];
      const j = Math.floor(c / n[0]) % n[1];
      const k = Math.floor(c / (n[0] * n[1]));
      for (const [ok, q] of [
        [i > 0, c - 1],
        [i < n[0] - 1, c + 1],
        [j > 0, c - n[0]],
        [j < n[1] - 1, c + n[0]],
        [k > 0, c - n[0] * n[1]],
        [k < n[2] - 1, c + n[0] * n[1]],
      ])
        if (ok && g.data[q] > 0.5 && label[q] < 0) {
          label[q] = id;
          stack.push(q);
        }
    }
    sizes.push(count);
  }
  const total = sizes.reduce((a, b) => a + b, 0);
  for (let s = 0; s < g.data.length; s++)
    if (label[s] >= 0 && sizes[label[s]] < least * total) g.data[s] = 0;
}
