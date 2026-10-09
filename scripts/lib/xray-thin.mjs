// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THINNING A MESH TO A BUDGET (`make xray-body`): QUADRIC EDGE COLLAPSE
// (Garland and Heckbert) — the edge whose collapse moves the surface least
// is collapsed first, its two corners merged at the point that sits closest
// to every plane they bounded, until the piece is down to its budget. A rib
// stays a rounded bar and a skull stays closed at a few hundred triangles,
// where clustering the corners on a grid (what this lab first did) cut thin
// bones into blocks and left holes. A collapse is refused when it would make
// the surface non-manifold (the two corners share a neighbour that is not on
// a triangle of the edge) or turn a triangle over, so a closed piece stays
// closed and the triangles keep facing out.

/** Corners closer than `eps` merged (the OBJ parts are welded, but a merged
 * piece's parts touch). Returns `{ v, f }` with every triangle's corners
 * distinct. */
function weld(v, f, eps = 1e-7) {
  const map = new Map();
  const out = [];
  const of = new Int32Array(v.length / 3);
  for (let i = 0; i < v.length / 3; i++) {
    const key = `${Math.round(v[i * 3] / eps)},${Math.round(v[i * 3 + 1] / eps)},${Math.round(v[i * 3 + 2] / eps)}`;
    let k = map.get(key);
    if (k === undefined) {
      k = out.length / 3;
      map.set(key, k);
      out.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
    }
    of[i] = k;
  }
  const face = [];
  for (let t = 0; t < f.length; t += 3) {
    const a = of[f[t]];
    const b = of[f[t + 1]];
    const c = of[f[t + 2]];
    if (a !== b && b !== c && a !== c) face.push(a, b, c);
  }
  return { v: Float64Array.from(out), f: Uint32Array.from(face) };
}

/** A binary min-heap of [cost, a, b, stamp]. */
class Heap {
  constructor() {
    this.items = [];
  }
  push(x) {
    const h = this.items;
    h.push(x);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p][0] <= h[i][0]) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  }
  pop() {
    const h = this.items;
    const top = h[0];
    const last = h.pop();
    if (h.length > 0) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && h[l][0] < h[m][0]) m = l;
        if (r < h.length && h[r][0] < h[m][0]) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.items.length;
  }
}

/** A mesh `{ v, f }` (corners in m) thinned to `budget` triangles or fewer
 * (or as near as a manifold collapse allows). */
export function thin(v0, f0, budget) {
  const { v, f } = weld(v0, f0);
  const nv = v.length / 3;
  let alive = f.length / 3;
  if (alive <= budget) return { v, f };
  const P = Float64Array.from(v);
  const faces = [];
  for (let t = 0; t < f.length; t += 3) faces.push([f[t], f[t + 1], f[t + 2]]);
  const dead = new Uint8Array(faces.length);
  const around = Array.from({ length: nv }, () => new Set());
  faces.forEach((fc, t) => fc.forEach((k) => around[k].add(t)));
  const gone = new Uint8Array(nv);
  const stamp = new Uint32Array(nv);

  // Each corner's quadric: the sum of its triangles' planes, area weighted
  // (10 numbers of the symmetric 4×4).
  const Q = new Float64Array(nv * 10);
  const normalOf = (t) => {
    const [a, b, c] = faces[t];
    const ux = P[b * 3] - P[a * 3];
    const uy = P[b * 3 + 1] - P[a * 3 + 1];
    const uz = P[b * 3 + 2] - P[a * 3 + 2];
    const wx = P[c * 3] - P[a * 3];
    const wy = P[c * 3 + 1] - P[a * 3 + 1];
    const wz = P[c * 3 + 2] - P[a * 3 + 2];
    return [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
  };
  const addPlane = (k, nx, ny, nz, d, w) => {
    const q = k * 10;
    Q[q] += w * nx * nx;
    Q[q + 1] += w * nx * ny;
    Q[q + 2] += w * nx * nz;
    Q[q + 3] += w * nx * d;
    Q[q + 4] += w * ny * ny;
    Q[q + 5] += w * ny * nz;
    Q[q + 6] += w * ny * d;
    Q[q + 7] += w * nz * nz;
    Q[q + 8] += w * nz * d;
    Q[q + 9] += w * d * d;
  };
  const edgeCount = new Map();
  const ekey = (a, b) => (a < b ? a * nv + b : b * nv + a);
  faces.forEach((fc, t) => {
    const n = normalOf(t);
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l === 0) return;
    const nx = n[0] / l;
    const ny = n[1] / l;
    const nz = n[2] / l;
    const d = -(nx * P[fc[0] * 3] + ny * P[fc[0] * 3 + 1] + nz * P[fc[0] * 3 + 2]);
    for (const k of fc) addPlane(k, nx, ny, nz, d, l / 2);
    for (let e = 0; e < 3; e++) {
      const key = ekey(fc[e], fc[(e + 1) % 3]);
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  });
  // An open border holds its place: a plane through it, square to the face.
  faces.forEach((fc, t) => {
    const n = normalOf(t);
    for (let e = 0; e < 3; e++) {
      const a = fc[e];
      const b = fc[(e + 1) % 3];
      if (edgeCount.get(ekey(a, b)) !== 1) continue;
      const ex = P[b * 3] - P[a * 3];
      const ey = P[b * 3 + 1] - P[a * 3 + 1];
      const ez = P[b * 3 + 2] - P[a * 3 + 2];
      let px = ey * n[2] - ez * n[1];
      let py = ez * n[0] - ex * n[2];
      let pz = ex * n[1] - ey * n[0];
      const l = Math.hypot(px, py, pz);
      if (l === 0) continue;
      px /= l;
      py /= l;
      pz /= l;
      const d = -(px * P[a * 3] + py * P[a * 3 + 1] + pz * P[a * 3 + 2]);
      const w = 1000 * Math.hypot(ex, ey, ez) ** 2;
      addPlane(a, px, py, pz, d, w);
      addPlane(b, px, py, pz, d, w);
    }
  });

  const S = new Float64Array(10);
  /** The cost and the point of collapsing a–b. */
  const plan = (a, b) => {
    for (let i = 0; i < 10; i++) S[i] = Q[a * 10 + i] + Q[b * 10 + i];
    const [a11, a12, a13, a14, a22, a23, a24, a33, a34] = S;
    const det =
      a11 * (a22 * a33 - a23 * a23) - a12 * (a12 * a33 - a23 * a13) + a13 * (a12 * a23 - a22 * a13);
    const err = (x, y, z) =>
      S[0] * x * x +
      2 * S[1] * x * y +
      2 * S[2] * x * z +
      2 * S[3] * x +
      S[4] * y * y +
      2 * S[5] * y * z +
      2 * S[6] * y +
      S[7] * z * z +
      2 * S[8] * z +
      S[9];
    const mid = [
      (P[a * 3] + P[b * 3]) / 2,
      (P[a * 3 + 1] + P[b * 3 + 1]) / 2,
      (P[a * 3 + 2] + P[b * 3 + 2]) / 2,
    ];
    const cands = [
      [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]],
      [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]],
      mid,
    ];
    const scale = Math.abs(a11) + Math.abs(a22) + Math.abs(a33);
    if (Math.abs(det) > 1e-12 * scale ** 3) {
      // Solve A x = -b by Cramer's rule.
      const bx = -a14;
      const by = -a24;
      const bz = -a34;
      const x =
        (bx * (a22 * a33 - a23 * a23) - a12 * (by * a33 - a23 * bz) + a13 * (by * a23 - a22 * bz)) /
        det;
      const y =
        (a11 * (by * a33 - bz * a23) - bx * (a12 * a33 - a23 * a13) + a13 * (a12 * bz - by * a13)) /
        det;
      const z =
        (a11 * (a22 * bz - a23 * by) - a12 * (a12 * bz - by * a13) + bx * (a12 * a23 - a22 * a13)) /
        det;
      // Never further from the edge than the edge is long.
      const el = Math.hypot(
        P[a * 3] - P[b * 3],
        P[a * 3 + 1] - P[b * 3 + 1],
        P[a * 3 + 2] - P[b * 3 + 2],
      );
      if (Math.hypot(x - mid[0], y - mid[1], z - mid[2]) < el) cands.push([x, y, z]);
    }
    let best = cands[0];
    let cost = Infinity;
    for (const c of cands) {
      const e = err(c[0], c[1], c[2]);
      if (e < cost) {
        cost = e;
        best = c;
      }
    }
    return [Math.max(0, cost), best];
  };

  const heap = new Heap();
  const pushEdge = (a, b) => heap.push([plan(a, b)[0], a, b, stamp[a], stamp[b]]);
  for (const key of edgeCount.keys()) {
    const a = Math.floor(key / nv);
    const b = key % nv;
    pushEdge(a, b);
  }

  const neighbours = (k) => {
    const s = new Set();
    for (const t of around[k]) for (const j of faces[t]) if (j !== k) s.add(j);
    return s;
  };
  /** Whether merging b into a at p keeps every surviving triangle facing
   * the way it did (and not collapsed to a sliver). */
  const keepsFacing = (a, b, p) => {
    for (const k of [a, b])
      for (const t of around[k]) {
        const fc = faces[t];
        if (fc.includes(a) && fc.includes(b)) continue;
        const before = normalOf(t);
        const save = [];
        for (const j of fc)
          if (j === a || j === b) {
            save.push([j, P[j * 3], P[j * 3 + 1], P[j * 3 + 2]]);
            P[j * 3] = p[0];
            P[j * 3 + 1] = p[1];
            P[j * 3 + 2] = p[2];
          }
        const after = normalOf(t);
        for (const [j, x, y, z] of save) {
          P[j * 3] = x;
          P[j * 3 + 1] = y;
          P[j * 3 + 2] = z;
        }
        const lb = Math.hypot(...before);
        const la = Math.hypot(...after);
        if (la === 0 || lb === 0) return false;
        const cos =
          (before[0] * after[0] + before[1] * after[1] + before[2] * after[2]) / (lb * la);
        if (cos < 0.2) return false;
      }
    return true;
  };

  while (alive > budget && heap.size > 0) {
    const [, a, b, sa, sb] = heap.pop();
    if (gone[a] || gone[b] || stamp[a] !== sa || stamp[b] !== sb) continue;
    // The edge must still be one.
    let shared = 0;
    for (const t of around[a]) if (faces[t].includes(b)) shared++;
    if (shared === 0) continue;
    // THE LINK CONDITION: the corners' common neighbours are exactly the
    // triangles' third corners.
    const na = neighbours(a);
    const nb = neighbours(b);
    let common = 0;
    for (const k of na) if (nb.has(k)) common++;
    if (common !== shared) continue;
    const [, p] = plan(a, b);
    if (!keepsFacing(a, b, p)) continue;
    // Collapse b into a.
    P[a * 3] = p[0];
    P[a * 3 + 1] = p[1];
    P[a * 3 + 2] = p[2];
    for (let i = 0; i < 10; i++) Q[a * 10 + i] += Q[b * 10 + i];
    for (const t of around[b]) {
      const fc = faces[t];
      if (fc.includes(a)) {
        dead[t] = 1;
        alive--;
        for (const j of fc) if (j !== b) around[j].delete(t);
        continue;
      }
      fc[fc.indexOf(b)] = a;
      around[a].add(t);
    }
    around[b].clear();
    gone[b] = 1;
    stamp[a]++;
    for (const k of neighbours(a)) {
      stamp[k]++;
    }
    for (const k of neighbours(a)) {
      pushEdge(a, k);
      for (const j of neighbours(k)) if (j !== a) pushEdge(k, j);
    }
  }

  // Only the corners a triangle still uses, renumbered.
  const used = new Int32Array(nv).fill(-1);
  const out = [];
  const face = [];
  faces.forEach((fc, t) => {
    if (dead[t]) return;
    for (const k of fc) {
      if (used[k] < 0) {
        used[k] = out.length / 3;
        out.push(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]);
      }
      face.push(used[k]);
    }
  });
  return { v: Float64Array.from(out), f: Uint32Array.from(face) };
}
