// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK'S ADAPTIVE MESH — a right-triangulated irregular network over a
// tile of the rock field (`rock-field.ts`) sampled on a grid of n × n cells
// (n a power of two): the tile is two right triangles, each split at its
// hypotenuse's middle into two, and so on down to the grid's own cells, and a
// triangle is split only where it stands too far off the samples it covers —
// so a block's flat face is a few big triangles, and a ledge's lip and a
// crack many small ones. The two triangles that share a hypotenuse split
// together (they read one error, kept at its middle), and a triangle is
// never split without its parent, so the mesh has no cracks.
//
// THE ERROR IS EXACT: a triangle's error is the worst of every sample it
// covers against its plane, not only its hypotenuse's middle, so the mesh at
// a tolerance stands within it of the FINEST mesh — every grid cell split as
// the hierarchy splits it — which is the surface the physics rides
// (`rockLeaf`). Both meshes are flat between samples, so the samples bound
// it. The error is ONE-SIDED: standing over the ridden rock is counted whole,
// standing under it a `down`th, so a body never floats over drawn stone by
// more than a hair. Where both the plane and the rock are under the snow
// (`ground`) the snow is what is met and seen, and only a plane sunk far
// under it counts; a triangle with no rock out of the snow counts nothing.
// The rock is never held more than a few cm under the snow
// (`ROCK_FIELD.under`), so a plane under the snow stands within that of it.
//
// Pure arithmetic over arrays; the building is resumable a slice at a time.

/** How lightly a plane sunk under the snow is counted, of a standing-over
 * error: under the snow the rock is never seen, and the snow is what is met
 * — it is held only near enough under that it never shows through a seam. */
const HIDDEN = 40;

/** A tile's errors under way: `rtinStart`, `rtinStep` until it is whole. */
export type RtinBuild = {
  readonly n: number;
  readonly size: number;
  /** The rock's height a sample, row by row (`size` × `size`). */
  readonly rock: Float32Array;
  /** The snow's (the map's ground) a sample. */
  readonly ground: Float32Array;
  /** The error kept at each hypotenuse's middle, m (as standing over). */
  readonly errors: Float32Array;
  /** A summed-area table of the samples where rock shows. */
  readonly sat: Int32Array;
  readonly down: number;
  /** The next triangle (Martini's order, deepest first) and the count. */
  i: number;
  readonly count: number;
};

/** Start a tile: `rock` and `ground` are `(n + 1)²` samples, row by row. */
export function rtinStart(
  n: number,
  rock: Float32Array,
  ground: Float32Array,
  down: number,
): RtinBuild {
  const size = n + 1;
  const sat = new Int32Array(size * size + size + size + 1);
  // sat[(y + 1) * (size + 1) + (x + 1)]: the samples showing in [0..x]×[0..y].
  const w = size + 1;
  for (let y = 0; y < size; y++) {
    let row = 0;
    for (let x = 0; x < size; x++) {
      const k = y * size + x;
      if (rock[k] > ground[k] - 0.005) row++;
      sat[(y + 1) * w + x + 1] = sat[y * w + x + 1] + row;
    }
  }
  const count = n * n * 2 - 2;
  return {
    n,
    size,
    rock,
    ground,
    errors: new Float32Array(size * size),
    sat,
    down,
    i: count - 1,
    count,
  };
}

function showing(b: RtinBuild, x0: number, y0: number, x1: number, y1: number): number {
  const w = b.size + 1;
  const s = b.sat;
  return s[(y1 + 1) * w + x1 + 1] - s[y0 * w + x1 + 1] - s[(y1 + 1) * w + x0] + s[y0 * w + x0];
}

/** The worst of triangle (a, b, c)'s samples against its plane. */
function exact(
  B: RtinBuild,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  const x0 = Math.min(ax, bx, cx);
  const x1 = Math.max(ax, bx, cx);
  const y0 = Math.min(ay, by, cy);
  const y1 = Math.max(ay, by, cy);
  if (showing(B, x0, y0, x1, y1) === 0) return 0;
  const size = B.size;
  const R = B.rock;
  const G = B.ground;
  const ha = R[ay * size + ax];
  const hb = R[by * size + bx];
  const hc = R[cy * size + cx];
  // The plane: h = ha + gx (x − ax) + gy (y − ay).
  const e1x = bx - ax;
  const e1y = by - ay;
  const e2x = cx - ax;
  const e2y = cy - ay;
  const det = e1x * e2y - e2x * e1y;
  const d1 = hb - ha;
  const d2 = hc - ha;
  const gx = (d1 * e2y - d2 * e1y) / det;
  const gy = (e1x * d2 - e2x * d1) / det;
  // Inside: the three edge functions of one sign as the triangle's.
  const s = det > 0 ? 1 : -1;
  const down = B.down;
  let worst = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const w0 = s * ((bx - ax) * (y - ay) - (by - ay) * (x - ax));
      const w1 = s * ((cx - bx) * (y - by) - (cy - by) * (x - bx));
      const w2 = s * ((ax - cx) * (y - cy) - (ay - cy) * (x - cx));
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const k = y * size + x;
      const plane = ha + gx * (x - ax) + gy * (y - ay);
      const g = G[k];
      // The surface ridden is the rock where it stands out of the snow and
      // the snow where it does not. Under the snow, drawn or ridden, nothing
      // is seen and the snow is met: only a plane sunk far under it is
      // counted, lightly.
      const r = R[k] > g ? R[k] : g;
      const e =
        plane <= g && r <= g ? (g - plane) / HIDDEN : plane > r ? plane - r : (r - plane) / down;
      if (e > worst) worst = e;
    }
  }
  return worst;
}

/** Work through more of `b`'s triangles while `more()` says so; true once
 * every error is in. */
export function rtinStep(b: RtinBuild, more: () => boolean): boolean {
  const { n, size, errors } = b;
  const last = b.count - n * n;
  let i = b.i;
  while (i >= 0) {
    for (let stop = Math.max(-1, i - 1024); i > stop; i--) {
      let id = i + 2;
      let ax = 0;
      let ay = 0;
      let bx = 0;
      let by = 0;
      let cx = 0;
      let cy = 0;
      if (id & 1) bx = by = cx = n;
      else ax = ay = cy = n;
      while ((id >>= 1) > 1) {
        const mx = (ax + bx) >> 1;
        const my = (ay + by) >> 1;
        if (id & 1) {
          bx = ax;
          by = ay;
          ax = cx;
          ay = cy;
        } else {
          ax = bx;
          ay = by;
          bx = cx;
          by = cy;
        }
        cx = mx;
        cy = my;
      }
      const m = ((ay + by) >> 1) * size + ((ax + bx) >> 1);
      let e = exact(b, ax, ay, bx, by, cx, cy);
      if (i < last) {
        const l = ((ay + cy) >> 1) * size + ((ax + cx) >> 1);
        const r = ((by + cy) >> 1) * size + ((bx + cx) >> 1);
        e = Math.max(e, errors[l], errors[r]);
      }
      if (e > errors[m]) errors[m] = e;
    }
    if (i >= 0 && !more()) break;
  }
  b.i = i;
  return i < 0;
}

/** Every triangle of `b`'s mesh at tolerance `tol` m: corners (a, b, c) in
 * grid cells, `c` the right angle. */
export function rtinMesh(
  b: RtinBuild,
  tol: number,
  emit: (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => void,
): void {
  const { n, size, errors } = b;
  const walk = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): void => {
    const mx = (ax + bx) >> 1;
    const my = (ay + by) >> 1;
    if (Math.abs(ax - cx) + Math.abs(ay - cy) > 1 && errors[my * size + mx] > tol) {
      walk(cx, cy, ax, ay, mx, my);
      walk(bx, by, cx, cy, mx, my);
    } else emit(ax, ay, bx, by, cx, cy);
  };
  walk(0, 0, n, n, n, 0);
  walk(n, n, 0, 0, 0, n);
}

/** THE FINEST TRIANGLE holding (u, v) (grid cells, 0..n) into `out`: a, b
 * and c's cells — the surface ridden is this triangle's plane. */
export function rockLeaf(n: number, u: number, v: number, out: Int32Array): void {
  let ax: number;
  let ay: number;
  let bx: number;
  let by: number;
  let cx: number;
  let cy: number;
  // The two halves split along the diagonal (0, 0)–(n, n).
  if (u >= v) {
    ax = 0;
    ay = 0;
    bx = n;
    by = n;
    cx = n;
    cy = 0;
  } else {
    ax = n;
    ay = n;
    bx = 0;
    by = 0;
    cx = 0;
    cy = n;
  }
  while (Math.abs(ax - cx) + Math.abs(ay - cy) > 1) {
    const mx = (ax + bx) >> 1;
    const my = (ay + by) >> 1;
    // Children (c, a, m) and (b, c, m), split along c–m: the side a is on.
    const side = (mx - cx) * (v - cy) - (my - cy) * (u - cx);
    const sa = (mx - cx) * (ay - cy) - (my - cy) * (ax - cx);
    if (side * sa >= 0) {
      bx = ax;
      by = ay;
      ax = cx;
      ay = cy;
    } else {
      ax = bx;
      ay = by;
      bx = cx;
      by = cy;
    }
    cx = mx;
    cy = my;
  }
  out[0] = ax;
  out[1] = ay;
  out[2] = bx;
  out[3] = by;
  out[4] = cx;
  out[5] = cy;
}
