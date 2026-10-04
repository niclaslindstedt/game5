// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PIXELS TO OUTLINES, for a lab that draws a mesh flat and wants it back as
// vector shapes (`make hud-body`): a depth-buffered triangle fill that keeps
// the nearest surface's depth and normal at every pixel, the regions of a
// mask (4-connected) and their holes, each boundary followed round (Moore)
// and simplified (Douglas–Peucker).

/** A grid of W × H pixels, each the nearest surface seen down the view:
 * its depth (smaller is nearer; Infinity where nothing is) and its normal. */
export function createView(W, H) {
  return {
    W,
    H,
    depth: new Float32Array(W * H).fill(Infinity),
    normal: new Float32Array(W * H * 3),
  };
}

/**
 * Draw triangles into a view. `p` is every corner already in pixels — x
 * right, y down, d the depth — as a flat [x, y, d, …]; `n` the corners'
 * normals, unit, facing out; `f` the triangles. A pixel is covered when its
 * centre is inside, so two meshes that touch never bleed into each other.
 * `clip`, if given, is the farthest depth kept on each row: a cut through
 * the mesh, everything beyond it left out.
 */
export function drawMesh(view, p, n, f, clip = null) {
  const { W, H, depth, normal } = view;
  for (let t = 0; t < f.length; t += 3) {
    const a = f[t] * 3;
    const b = f[t + 1] * 3;
    const c = f[t + 2] * 3;
    const ax = p[a];
    const ay = p[a + 1];
    const bx = p[b];
    const by = p[b + 1];
    const cx = p[c];
    const cy = p[c + 1];
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-12) continue;
    const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5));
    const x1 = Math.min(W - 1, Math.floor(Math.max(ax, bx, cx) - 0.5));
    const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5));
    const y1 = Math.min(H - 1, Math.floor(Math.max(ay, by, cy) - 0.5));
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const wa = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
        const wb = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
        const wc = 1 - wa - wb;
        if (wa < 0 || wb < 0 || wc < 0) continue;
        const d = wa * p[a + 2] + wb * p[b + 2] + wc * p[c + 2];
        const i = y * W + x;
        if (d >= depth[i] || (clip && d > clip[y])) continue;
        depth[i] = d;
        let nx = wa * n[a] + wb * n[b] + wc * n[c];
        let ny = wa * n[a + 1] + wb * n[b + 1] + wc * n[c + 1];
        let nz = wa * n[a + 2] + wb * n[b + 2] + wc * n[c + 2];
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l;
        ny /= l;
        nz /= l;
        normal[i * 3] = nx;
        normal[i * 3 + 1] = ny;
        normal[i * 3 + 2] = nz;
      }
    }
  }
}

/** Each corner's normal: the area-weighted mean of its faces'. */
export function vertexNormals(v, f) {
  const n = new Float64Array(v.length);
  for (let t = 0; t < f.length; t += 3) {
    const a = f[t] * 3;
    const b = f[t + 1] * 3;
    const c = f[t + 2] * 3;
    const ux = v[b] - v[a];
    const uy = v[b + 1] - v[a + 1];
    const uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a];
    const wy = v[c + 1] - v[a + 1];
    const wz = v[c + 2] - v[a + 2];
    const nx = uy * wz - uz * wy;
    const ny = uz * wx - ux * wz;
    const nz = ux * wy - uy * wx;
    for (const k of [a, b, c]) {
      n[k] += nx;
      n[k + 1] += ny;
      n[k + 2] += nz;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  return n;
}

/** A field box-blurred `r` pixels each way (twice: near enough a Gaussian),
 * read only where `m` is set. */
export function blurIn(field, m, W, H, r) {
  let a = Float32Array.from(field, (x, i) => (m[i] ? x : 0));
  let w = Float32Array.from(m, (x) => (x ? 1 : 0));
  const pass = (src, horiz) => {
    const out = new Float32Array(W * H);
    for (let o = 0; o < (horiz ? H : W); o++) {
      let acc = 0;
      const at = (k) => (horiz ? o * W + k : k * W + o);
      const L = horiz ? W : H;
      for (let k = -r; k <= r; k++) if (k >= 0 && k < L) acc += src[at(k)];
      for (let k = 0; k < L; k++) {
        out[at(k)] = acc;
        const add = k + r + 1;
        const sub = k - r;
        if (add < L) acc += src[at(add)];
        if (sub >= 0) acc -= src[at(sub)];
      }
    }
    return out;
  };
  for (let k = 0; k < 2; k++) {
    a = pass(pass(a, true), false);
    w = pass(pass(w, true), false);
  }
  return Float32Array.from(a, (x, i) => (w[i] > 0 ? x / w[i] : 0));
}

/** The mask's regions (4-connected), each `{ id, n, start, box }`; `lab`
 * the region of every pixel. */
export function components(m, W, H, minArea) {
  const lab = new Int32Array(W * H);
  const comps = [];
  let id = 0;
  const st = [];
  for (let s = 0; s < W * H; s++) {
    if (!m[s] || lab[s]) continue;
    id++;
    st.push(s);
    lab[s] = id;
    let n = 0;
    const box = [W, H, 0, 0];
    while (st.length) {
      const q = st.pop();
      n++;
      const x = q % W;
      const y = (q / W) | 0;
      if (x < box[0]) box[0] = x;
      if (y < box[1]) box[1] = y;
      if (x > box[2]) box[2] = x;
      if (y > box[3]) box[3] = y;
      if (x > 0 && m[q - 1] && !lab[q - 1]) ((lab[q - 1] = id), st.push(q - 1));
      if (x < W - 1 && m[q + 1] && !lab[q + 1]) ((lab[q + 1] = id), st.push(q + 1));
      if (y > 0 && m[q - W] && !lab[q - W]) ((lab[q - W] = id), st.push(q - W));
      if (y < H - 1 && m[q + W] && !lab[q + W]) ((lab[q + W] = id), st.push(q + W));
    }
    if (n >= minArea) comps.push({ id, n, start: s, box });
  }
  return { lab, comps };
}

const DIRS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/** A region's boundary, followed round from its first pixel (Moore). */
export function contour(lab, W, H, id, start) {
  const is = (x, y) => x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === id;
  const pts = [];
  let x = start % W;
  let y = (start / W) | 0;
  const x0 = x;
  const y0 = y;
  let dir = 7;
  let guard = 0;
  do {
    pts.push([x + 0.5, y + 0.5]);
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8;
      if (is(x + DIRS[d][0], y + DIRS[d][1])) {
        x += DIRS[d][0];
        y += DIRS[d][1];
        dir = d;
        found = true;
        break;
      }
    }
    if (!found) break;
  } while ((x !== x0 || y !== y0) && ++guard < 1e6);
  return pts;
}

/** Douglas–Peucker on an open run. */
export function dp(pts, e) {
  if (pts.length < 3) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let im = 0;
  let dm = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d =
      L > 1e-9
        ? Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / L
        : Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]);
    if (d > dm) {
      dm = d;
      im = i;
    }
  }
  if (dm <= e) return [a, b];
  return [...dp(pts.slice(0, im + 1), e).slice(0, -1), ...dp(pts.slice(im), e)];
}

/** A closed ring simplified: split in two so its ends are not one point. */
export function ring(pts, e) {
  const h = pts.length >> 1;
  return [...dp(pts.slice(0, h + 1), e).slice(0, -1), ...dp(pts.slice(h), e)];
}

/** A mask as shapes: every region at least `minArea` pixels a ring, with
 * the holes inside it at least `minHole` pixels as rings of their own —
 * `[{ outer, holes, n }]`, in pixels, simplified to `e`. */
export function traceMask(m, W, H, { minArea = 4, minHole = 4, e = 1 } = {}) {
  const { lab, comps } = components(m, W, H, minArea);
  const out = comps.map((c) => ({
    outer: ring(contour(lab, W, H, c.id, c.start), e),
    holes: [],
    n: c.n,
  }));
  const inv = Uint8Array.from(m, (x) => (x ? 0 : 1));
  const bg = components(inv, W, H, minHole);
  for (const hole of bg.comps) {
    const [x0, y0, x1, y1] = hole.box;
    if (x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1) continue;
    const k = comps.findIndex((c) => c.id === lab[hole.start - 1]);
    if (k >= 0) out[k].holes.push(ring(contour(bg.lab, W, H, hole.id, hole.start), e));
  }
  return out;
}
