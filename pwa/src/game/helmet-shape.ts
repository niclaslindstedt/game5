// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HEAD IN ITS SKI HELMET, AS GEOMETRY — three-free arithmetic, so the
// code's figure (`skier-helmet.ts`) and the Blender model
// (`scripts/blender/kinds/skier.mjs` hands this mesh to `skier.py`) draw
// the one helmet, and the suite can read it. Laid in the head's frame: z
// forward, y up, x to his right, the origin at the middle of the head.
//
// A RACER'S SKI HELMET, after what the rules and the shops say one is
// (EN 1077 class A; the race federation's hard-eared shell for the speed
// events — no spoiler, no edge standing proud) and measured against an
// adult's medium (a head 56–59 cm round, 19.5 × 15.5 cm, in 2–3.5 cm of
// wall): a smooth shell 27.6 cm long, 22.4 wide and 20 tall from the
// lower edge of the ear to the crown — a flattened egg widest just above
// the ears — its front edge a BRIM level over the goggles (no gap between
// them, the fit every guide asks for), dropping down the temple in front
// of the ear to a HARD EAR COVER whose lower edge runs back under the ear
// and rises a little to the nape. The edge is ROLLED: a rubber trim
// round the whole opening, the shell's thickness showing in it, the dark
// liner inside. A stripe in the kit's second colour runs from the brim
// over the crown to the nape. Over the shell the GOGGLES: a frame 17 cm
// across and 9.5 tall bent round the face (a toric lens — a strong curve
// across, a gentle one up and down), a nose arch cut out of its foot, the
// lens a little proud in it and the foam behind it on the face; their
// STRAP, 4 cm of elastic, run round the OUTSIDE of the shell just under
// its widest, two-tone, through a CLIP at the back. Two brow vents and two
// rows of slots over the crown; his face below the goggles and a chin
// strap under the jaw.
//
// THE TRIANGLES GO WHERE THE EYE GOES. The chase camera sees the shell's
// round back for the whole run, thirty pixels across, so its silhouette is
// laid on 56 columns; the columns are laid CONFORMALLY to the lower edge
// (resampled along it by length, eased to an even turn toward the crown),
// so the brim and the ear line are clean curves rather than a grid's
// stairs, and the stripe is cut exactly along its two planes. The crown is
// one vertex, the liner one row (it is only ever seen past the face), the
// vents a handful.

/** What each surface is painted as — the code's materials and the
 * model's are picked by it (`skier-helmet.ts`, `skier.py`). */
export type HelmetMaterial =
  | "shell"
  | "stripe"
  | "trim"
  | "liner"
  | "frame"
  | "foam"
  | "lens"
  | "strap"
  | "band"
  | "skin"
  | "knit";

/** One material's triangles: positions and normals a vertex (x, y, z),
 * the lens's unwrap, three indices a triangle. */
export type HelmetPart = {
  material: HelmetMaterial;
  position: number[];
  normal: number[];
  uv?: number[];
  index: number[];
};

type V = [number, number, number];

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a: V): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V): V => mul(a, 1 / (len(a) || 1));
const lerp = (a: V, b: V, t: number): V => add(a, mul(sub(b, a), t));
const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
const DEG = Math.PI / 180;

/** THE SHELL, m: its widest level (y), the crown, the half width at the
 * widest, how far it reaches ahead of and behind its middle (`z0`), and
 * the squareness of its horizontal sections (2 an ellipse). Below the
 * widest the sides come in a little, the back more (the nape tucked). */
export const SHELL = {
  widest: 0.012,
  crown: 0.127,
  w: 0.112,
  ahead: 0.138,
  behind: 0.138,
  z0: -0.004,
  square: 2.25,
  /** How far below the widest the taper is measured over, m, and what it
   * takes off the sides, the front and the back there. */
  taper: { over: 0.09, side: 0.09, ahead: 0.12, behind: 0.2 },
  /** The wall at the rolled edge, m: the shell, the foam and the trim. */
  thick: 0.02,
};

/** THE LOWER EDGE: its height, m, by how far round from dead ahead, deg —
 * the brim level over the goggles, the drop down the temple in front of
 * the ear, the ear cover's foot and the rise to the nape. */
const EDGE: [number, number][] = [
  [0, 0.046],
  [25, 0.044],
  [38, 0.039],
  [46, 0.03],
  [52, 0.008],
  [58, -0.03],
  [64, -0.057],
  [72, -0.069],
  [92, -0.074],
  [118, -0.069],
  [150, -0.06],
  [180, -0.056],
];

/** How finely each piece is laid: the shell's columns (even) and rows, the
 * rim's turn, the goggles' outline. `detail` 2 for a studio still. */
function counts(detail: number) {
  return {
    columns: 56 * detail,
    rows: 12 * detail,
    rim: 3 * detail,
    outline: 48 * detail,
    lens: 3 * detail,
    strap: 28 * detail,
    head: [14 * detail, 10 * detail] as const,
  };
}

/** The horizontal section's half width and its reach ahead and behind at
 * height `y`. */
function section(y: number): { w: number; f: number; b: number } {
  const S = SHELL;
  if (y >= S.widest) {
    const u = Math.min(1, (y - S.widest) / (S.crown - S.widest));
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    return { w: S.w * s, f: S.ahead * s, b: S.behind * s };
  }
  const u = (S.widest - y) / S.taper.over;
  const k = u * u;
  return {
    w: S.w * (1 - S.taper.side * k),
    f: S.ahead * (1 - S.taper.ahead * k),
    b: S.behind * (1 - S.taper.behind * k),
  };
}

const spow = (c: number, p: number): number => Math.sign(c) * Math.abs(c) ** p;

/** The shell's point at height `y`, `a` rad round from dead ahead
 * (clockwise from above: +x is his right). */
export function shellAt(y: number, a: number): V {
  const { w, f, b } = section(y);
  const p = 2 / SHELL.square;
  const c = Math.cos(a);
  return [spow(Math.sin(a), p) * w, y, SHELL.z0 + spow(c, p) * (c > 0 ? f : b)];
}

/** The shell's outward normal at height `y`, `a` round. */
export function shellNormal(y: number, a: number): V {
  const h = 1e-4;
  const top = SHELL.crown - 2e-4;
  if (y >= top) return [0, 1, 0];
  const pa = sub(shellAt(y, a + h), shellAt(y, a - h));
  const py = sub(shellAt(Math.min(top, y + h), a), shellAt(y - h, a));
  let n = norm(cross(py, pa));
  const p = shellAt(y, a);
  if (dot(n, sub(p, [0, SHELL.widest, SHELL.z0])) < 0) n = mul(n, -1);
  return n;
}

/** How far round from dead ahead `a` rad is, either way, deg (0..180). */
function roundFrom(a: number): number {
  return Math.abs(((((a / DEG + 180) % 360) + 360) % 360) - 180);
}

/** The edge's height `a` round, by a smooth curve through `EDGE`. */
export function edgeAt(a: number): number {
  const d = roundFrom(a);
  for (let i = 1; i < EDGE.length; i++) {
    const [a1, y1] = EDGE[i];
    if (d <= a1) {
      const [a0, y0] = EDGE[i - 1];
      // Cubic through the neighbours (Catmull–Rom), so the drop down the
      // temple has no corner at its table's rows.
      const m = (j: number) => {
        const lo = EDGE[Math.max(0, j - 1)];
        const hi = EDGE[Math.min(EDGE.length - 1, j + 1)];
        return ((hi[1] - lo[1]) / (hi[0] - lo[0])) * (a1 - a0);
      };
      const t = (d - a0) / (a1 - a0);
      const t2 = t * t;
      const t3 = t2 * t;
      return (
        (2 * t3 - 3 * t2 + 1) * y0 +
        (t3 - 2 * t2 + t) * m(i - 1) +
        (-2 * t3 + 3 * t2) * y1 +
        (t3 - t2) * m(i)
      );
    }
  }
  return EDGE[EDGE.length - 1][1];
}

/**
 * How far the shell reaches from the head's middle along the direction
 * `a` round and `e` up, m, `lift` proud of it — where a ray from the
 * middle leaves the shell (the headlamp is strapped on by it).
 */
export function helmetReach(a: number, e: number, lift = 0): number {
  const dir: V = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
  return len(surfaceAlong([0, 0, 0], dir)) + lift;
}

// ── A mesh being built ───────────────────────────────────────────────────

class Piece {
  readonly position: number[] = [];
  readonly normal: number[] = [];
  readonly uv: number[] = [];
  readonly index: number[] = [];
  readonly material: HelmetMaterial;
  constructor(material: HelmetMaterial) {
    this.material = material;
  }
  vert(p: V, n?: V, uv?: [number, number]): number {
    this.position.push(...p);
    this.normal.push(...(n ?? [0, 0, 0]));
    if (uv) this.uv.push(...uv);
    return this.position.length / 3 - 1;
  }
  tri(a: number, b: number, c: number): void {
    this.index.push(a, b, c);
  }
  /** A quad a–b–c–d, wound a, b, c and a, c, d. */
  quad(a: number, b: number, c: number, d: number): void {
    this.index.push(a, b, c, a, c, d);
  }
  /** Normals off the faces, area-weighted, for every vertex (the ones
   * given are kept unless `all`). */
  faceNormals(all = true): void {
    const P = this.position;
    const acc = new Float64Array(P.length);
    const at = (i: number): V => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    for (let t = 0; t < this.index.length; t += 3) {
      const [i, j, k] = [this.index[t], this.index[t + 1], this.index[t + 2]];
      const n = cross(sub(at(j), at(i)), sub(at(k), at(i)));
      for (const v of [i, j, k]) for (let c = 0; c < 3; c++) acc[v * 3 + c] += n[c];
    }
    for (let v = 0; v < P.length / 3; v++) {
      const given: V = [this.normal[v * 3], this.normal[v * 3 + 1], this.normal[v * 3 + 2]];
      if (!all && len(given) > 0) continue;
      const n = norm([acc[v * 3], acc[v * 3 + 1], acc[v * 3 + 2]]);
      this.normal.splice(v * 3, 3, ...n);
    }
  }
  /** Turn every triangle the other way round. */
  flip(): void {
    for (let t = 0; t < this.index.length; t += 3) {
      const b = this.index[t + 1];
      this.index[t + 1] = this.index[t + 2];
      this.index[t + 2] = b;
    }
  }
}

/** A triangle soup's vertex: where, which way it faces. */
type Corner = { p: V; n: V };

/** A polygon cut by the plane x = `c`: the part at x < c and at x > c. */
function cutX(poly: Corner[], c: number): [Corner[], Corner[]] {
  const lo: Corner[] = [];
  const hi: Corner[] = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i];
    const B = poly[(i + 1) % poly.length];
    const da = A.p[0] - c;
    const db = B.p[0] - c;
    (da <= 0 ? lo : hi).push(A);
    if (da < 0 !== db < 0 && da !== 0 && db !== 0) {
      const t = da / (da - db);
      const X = { p: lerp(A.p, B.p, t), n: norm(lerp(A.n, B.n, t)) };
      lo.push(X);
      hi.push(X);
    }
  }
  return [lo, hi];
}

// ── The shell ────────────────────────────────────────────────────────────

/** The edge resampled into `n` columns evenly by its length round the
 * shell, symmetric about the middle: each column's azimuth at the edge
 * and the even turn it eases to toward the crown. */
function columns(n: number): { edge: number; even: number }[] {
  const half = n / 2;
  const fine = 720;
  const pts: number[] = [0];
  let prev = shellAt(edgeAt(0), 0);
  const az: number[] = [0];
  for (let k = 1; k <= fine; k++) {
    const a = (Math.PI * k) / fine;
    const p = shellAt(edgeAt(a), a);
    pts.push(pts[k - 1] + len(sub(p, prev)));
    az.push(a);
    prev = p;
  }
  const total = pts[fine];
  const at = (s: number): number => {
    let k = 1;
    while (k < fine && pts[k] < s) k++;
    const t = (s - pts[k - 1]) / (pts[k] - pts[k - 1] || 1);
    return az[k - 1] + (az[k] - az[k - 1]) * t;
  };
  const right = Array.from({ length: half + 1 }, (_, i) => at((total * i) / half));
  const out: { edge: number; even: number }[] = [];
  for (let i = 0; i < n; i++) {
    const r = i <= half ? i : n - i;
    const sign = i <= half ? 1 : -1;
    out.push({ edge: sign * right[r], even: (sign * Math.PI * r) / half });
  }
  return out;
}

/** A column's point `t` of the way from the crown (0) to the edge (1),
 * by length down it — its azimuth eased from the even turn to the edge's
 * over its lower two thirds. */
function columnCurve(col: { edge: number; even: number }): (t: number) => { y: number; a: number } {
  const ye = edgeAt(col.edge);
  const steps = 64;
  const ys: number[] = [];
  const as: number[] = [];
  const ss: number[] = [0];
  for (let k = 0; k <= steps; k++) {
    const f = k / steps;
    // Even in the angle down the dome, so the crown is not starved.
    const y = SHELL.crown - (SHELL.crown - ye) * (1 - Math.cos((f * Math.PI) / 2));
    const a = col.even + (col.edge - col.even) * smooth((f - 0.3) / 0.7);
    ys.push(y);
    as.push(a);
    if (k > 0) ss.push(ss[k - 1] + len(sub(shellAt(y, a), shellAt(ys[k - 1], as[k - 1]))));
  }
  const total = ss[steps];
  return (t) => {
    const s = t * total;
    let k = 1;
    while (k < steps && ss[k] < s) k++;
    const u = (s - ss[k - 1]) / (ss[k] - ss[k - 1] || 1);
    return { y: ys[k - 1] + (ys[k] - ys[k - 1]) * u, a: as[k - 1] + (as[k] - as[k - 1]) * u };
  };
}

/** THE STRIPE's half width, m: from the brim over the crown to the nape. */
const STRIPE = 0.024;

function buildShell(detail: number): Piece[] {
  const C = counts(detail);
  const cols = columns(C.columns);
  const curves = cols.map(columnCurve);
  const N = cols.length;
  const M = C.rows;
  // Every grid point: (column, row 1..M), and the crown.
  const grid: Corner[][] = curves.map((f) =>
    Array.from({ length: M + 1 }, (_, r) => {
      const { y, a } = f(r / M);
      return { p: r === 0 ? [0, SHELL.crown, SHELL.z0] : shellAt(y, a), n: shellNormal(y, a) };
    }),
  );
  // The soup, then each triangle cut along the stripe's two planes.
  const shell = new Piece("shell");
  const stripe = new Piece("stripe");
  const emit = (poly: Corner[]) => {
    if (poly.length < 3) return;
    const mid = poly.reduce((s, c) => s + c.p[0], 0) / poly.length;
    const to = Math.abs(mid) < STRIPE ? stripe : shell;
    const ids = poly.map((c) => to.vert(c.p, c.n));
    for (let k = 1; k + 1 < ids.length; k++) to.tri(ids[0], ids[k], ids[k + 1]);
  };
  const tri = (a: Corner, b: Corner, c: Corner) => {
    const [l, rest] = cutX([a, b, c], -STRIPE);
    const [m, r] = cutX(rest, STRIPE);
    emit(l);
    emit(m);
    emit(r);
  };
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    // Wound so the face looks out: round clockwise from above, down.
    tri(grid[i][0], grid[i][1], grid[j][1]);
    for (let r = 1; r < M; r++) {
      tri(grid[i][r], grid[i][r + 1], grid[j][r + 1]);
      tri(grid[i][r], grid[j][r + 1], grid[j][r]);
    }
  }
  fixWinding(shell);
  fixWinding(stripe);

  // THE ROLLED EDGE: a half round from the shell's face to its inside,
  // the trim; then the liner a little way back up inside, one row deep.
  const trim = new Piece("trim");
  const liner = new Piece("liner");
  const r0 = SHELL.thick / 2;
  const rimIds: number[][] = [];
  const linerIds: number[][] = [];
  for (let i = 0; i < N; i++) {
    const p = grid[i][M].p;
    const n = grid[i][M].n;
    const above = grid[i][M - 1].p;
    let d = norm(sub(p, above));
    d = norm(sub(d, mul(n, dot(d, n))));
    const ring: number[] = [];
    for (let k = 0; k <= C.rim; k++) {
      const th = (Math.PI * k) / C.rim;
      const q = add(add(p, mul(d, r0 * Math.sin(th))), mul(n, -r0 * (1 - Math.cos(th))));
      ring.push(trim.vert(q, norm(add(mul(n, Math.cos(th)), mul(d, Math.sin(th))))));
    }
    rimIds.push(ring);
    const up: number[] = [];
    for (const r of [M, M - 3]) {
      const c = grid[i][Math.max(1, r)];
      up.push(liner.vert(add(c.p, mul(c.n, -SHELL.thick)), mul(c.n, -1)));
    }
    linerIds.push(up);
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    for (let k = 0; k < C.rim; k++) {
      trim.quad(rimIds[i][k], rimIds[i][k + 1], rimIds[j][k + 1], rimIds[j][k]);
    }
    liner.quad(linerIds[i][0], linerIds[i][1], linerIds[j][1], linerIds[j][0]);
  }
  fixWinding(trim);
  fixWinding(liner);
  return [shell, stripe, trim, liner];
}

/** Turn every triangle to face the way its own vertex normals do. */
function fixWinding(p: Piece): void {
  const P = p.position;
  const N = p.normal;
  const at = (i: number): V => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  const nm = (i: number): V => [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]];
  for (let t = 0; t < p.index.length; t += 3) {
    const [i, j, k] = [p.index[t], p.index[t + 1], p.index[t + 2]];
    const f = cross(sub(at(j), at(i)), sub(at(k), at(i)));
    if (dot(f, add(add(nm(i), nm(j)), nm(k))) < 0) {
      p.index[t + 1] = k;
      p.index[t + 2] = j;
    }
  }
}

/** A slot laid on the shell `lift` proud of it: centred at height `y`, `a`
 * round, `w` across and `h` tall, an oval — a vent. */
function slot(into: Piece, y: number, a: number, w: number, h: number, lift: number): void {
  const p = shellAt(y, a);
  // How far round the shell a metre across it is, there.
  const round = 1 / Math.hypot(p[0], p[2] - SHELL.z0);
  const on = (u: number, v: number): number => {
    const yy = y + v;
    const aa = a + u * round;
    const n = shellNormal(yy, aa);
    return into.vert(add(shellAt(yy, aa), mul(n, lift)), n);
  };
  const ids = [on(0, 0)];
  const K = 12;
  for (let k = 0; k < K; k++) {
    const t = (2 * Math.PI * k) / K;
    ids.push(on((Math.cos(t) * w) / 2, (Math.sin(t) * h) / 2));
  }
  for (let k = 0; k < K; k++) into.tri(ids[0], ids[1 + k], ids[1 + ((k + 1) % K)]);
}

/** Where a ray from `from` along `dir` leaves the shell. */
function surfaceAlong(from: V, dir: V): V {
  const inside = (p: V): boolean => {
    if (p[1] > SHELL.crown) return false;
    const { w, f, b } = section(p[1]);
    const dz = p[2] - SHELL.z0;
    const q = SHELL.square;
    return Math.abs(p[0] / w) ** q + Math.abs(dz / (dz > 0 ? f : b)) ** q < 1;
  };
  let lo = 0;
  let hi = 0.3;
  for (let k = 0; k < 30; k++) {
    const m = (lo + hi) / 2;
    if (inside(add(from, mul(dir, m)))) lo = m;
    else hi = m;
  }
  return add(from, mul(dir, (lo + hi) / 2));
}

/** A slot running fore and aft over the crown, `x` m off the middle, from
 * `s0` to `s1` deg round the head's middle in its own plane (0 dead
 * ahead, 90 the crown), `w` m wide, `lift` proud — a top vent. */
function groove(into: Piece, x: number, s0: number, s1: number, w: number, lift: number): void {
  const K = 6;
  const ids: [number, number][] = [];
  for (let k = 0; k <= K; k++) {
    const sd = (s0 + ((s1 - s0) * k) / K) * DEG;
    const at = (dx: number) =>
      surfaceAlong([x + dx, SHELL.widest, SHELL.z0], [0, Math.sin(sd), Math.cos(sd)]);
    // Its ends rounded: narrower over the last step each way.
    const half = (w / 2) * (k === 0 || k === K ? 0.45 : 1);
    const a = at(-half);
    const b = at(half);
    const n = norm(cross(sub(at(0.001), at(-0.001)), [0, Math.cos(sd), -Math.sin(sd)]));
    const out = n[1] < 0 ? mul(n, -1) : n;
    ids.push([into.vert(add(a, mul(out, lift)), out), into.vert(add(b, mul(out, lift)), out)]);
  }
  for (let k = 0; k < K; k++) into.quad(ids[k][0], ids[k + 1][0], ids[k + 1][1], ids[k][1]);
}

/** The vents: two over the brim to clear the goggles; on the crown two
 * rows of two slots running fore and aft either side of the stripe — the
 * way he is going, read from behind. (Exhausts at the back, either side of
 * the stripe over the clip, made a face of the back of his head.) */
function buildVents(): Piece {
  const vent = new Piece("liner");
  for (const s of [-1, 1]) {
    slot(vent, 0.064, s * 19 * DEG, 0.028, 0.008, 0.0008);
    groove(vent, s * 0.043, 58, 82, 0.0085, 0.0008);
    groove(vent, s * 0.043, 96, 120, 0.0085, 0.0008);
  }
  fixWinding(vent);
  return vent;
}

// ── The goggles ──────────────────────────────────────────────────────────

/** THE GOGGLES, m: the frame's half width (along its curve) and half
 * height, its middle's height, the radius it is bent round across and up
 * and down, where its front stands, how deep the frame and the foam are,
 * the frame's width round the lens, and the nose arch's half width and
 * height. */
export const GOGGLES = {
  half: 0.095,
  tall: 0.0475,
  mid: -0.0035,
  across: 0.12,
  updown: 0.3,
  front: 0.136,
  frame: 0.02,
  foam: 0.013,
  rim: 0.011,
  nose: { half: 0.024, high: 0.026 },
  /** How far the lens stands proud at its middle, m. */
  bulge: 0.004,
};

/** A point of the goggles: `u` across (m along the curve), `v` up from
 * their middle, `depth` back toward the face. */
function goggleAt(u: number, v: number, depth: number): V {
  const G = GOGGLES;
  const R = G.across - depth;
  const zc = G.front - G.across;
  return [
    R * Math.sin(u / G.across),
    G.mid + v,
    zc + R * Math.cos(u / G.across) - (v * v) / (2 * G.updown),
  ];
}

/** The frame's outline, (u, v) round from his right, `n` points: a
 * squared superellipse narrowing to its foot, the nose arch cut from it. */
function outline(n: number): [number, number][] {
  const G = GOGGLES;
  const pts: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const t = (2 * Math.PI * k) / n;
    const u = spow(Math.cos(t), 2 / 3.6) * G.half;
    let v = spow(Math.sin(t), 2 / 3.6) * G.tall;
    if (v < 0) {
      const x = u / G.half;
      v *= 1 - 0.14 * x * x;
      const nose = Math.abs(u) / G.nose.half;
      if (nose < 1) v += G.nose.high * Math.cos((nose * Math.PI) / 2) ** 2;
    }
    pts.push([u, v]);
  }
  return pts;
}

/** The outline moved `by` m inward (toward the lens) along its own normal
 * in (u, v). */
function inset(pts: [number, number][], by: number): [number, number][] {
  const n = pts.length;
  return pts.map((p, k) => {
    const a = pts[(k + n - 1) % n];
    const b = pts[(k + 1) % n];
    const tu = b[0] - a[0];
    const tv = b[1] - a[1];
    const l = Math.hypot(tu, tv) || 1;
    // Round anticlockwise in (u, v), the inside is to the left.
    return [p[0] - (tv / l) * by, p[1] + (tu / l) * by];
  });
}

function buildGoggles(detail: number): Piece[] {
  const G = GOGGLES;
  const C = counts(detail);
  const out = outline(C.outline);
  const inner = inset(out, G.rim);
  const n = out.length;
  const frame = new Piece("frame");
  const foam = new Piece("foam");
  const lens = new Piece("lens");

  // The frame's face, from its outer edge rolled a little back to the
  // lens's lip; its outer wall back toward the face; the foam behind it.
  const face = out.map(([u, v], k) => [
    frame.vert(goggleAt(u, v, 0.004)),
    frame.vert(goggleAt(u * 0.995, v * 0.99, 0)),
    frame.vert(goggleAt(inner[k][0], inner[k][1], 0)),
    frame.vert(goggleAt(inner[k][0], inner[k][1], 0.004)),
  ]);
  const wall = new Piece("frame");
  const sides = out.map(([u, v]) => [
    wall.vert(goggleAt(u, v, 0.004)),
    wall.vert(goggleAt(u, v, G.frame)),
  ]);
  const pad = out.map(([u, v]) => [
    foam.vert(goggleAt(u * 0.985, v * 0.97, G.frame)),
    foam.vert(goggleAt(u * 0.96, v * 0.93, G.frame + G.foam)),
  ]);
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    for (let r = 0; r < 3; r++) frame.quad(face[k][r], face[j][r], face[j][r + 1], face[k][r + 1]);
    wall.quad(sides[k][0], sides[k][1], sides[j][1], sides[j][0]);
    foam.quad(pad[k][0], pad[k][1], pad[j][1], pad[j][0]);
  }
  // THE LENS: rings in from the frame's lip to its middle, standing
  // proud by `bulge` at the middle; unwrapped flat for the model's mirror.
  const centre: [number, number] = [0, 0.004];
  const rings: number[][] = [];
  const at = (u: number, v: number, f: number): number => {
    const d = 0.004 - G.bulge * (1 - (1 - f) * (1 - f));
    return lens.vert(goggleAt(u, v, d), undefined, [
      0.5 + u / (2 * G.half),
      0.5 + v / (2 * G.tall),
    ]);
  };
  for (let q = 0; q < C.lens; q++) {
    const f = q / C.lens;
    rings.push(inner.map(([u, v]) => at(u + (centre[0] - u) * f, v + (centre[1] - v) * f, f)));
  }
  const mid = at(centre[0], centre[1], 1);
  for (let q = 0; q < C.lens; q++) {
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      if (q + 1 < C.lens) lens.quad(rings[q][k], rings[q][j], rings[q + 1][j], rings[q + 1][k]);
      else lens.tri(rings[q][k], rings[q][j], mid);
    }
  }
  for (const p of [frame, wall, foam, lens]) {
    p.faceNormals();
    orientOut(p, [0, G.mid, G.front - G.across]);
  }
  // The foam faces in toward the face as well as out: it is seen past
  // the frame's side.
  return [frame, wall, foam, lens];
}

/** Wind (and face) every triangle away from `from`. */
function orientOut(p: Piece, from: V): void {
  const P = p.position;
  const at = (i: number): V => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  let flipped = 0;
  for (let t = 0; t < p.index.length; t += 3) {
    const [i, j, k] = [p.index[t], p.index[t + 1], p.index[t + 2]];
    const f = cross(sub(at(j), at(i)), sub(at(k), at(i)));
    const c = mul(add(add(at(i), at(j)), at(k)), 1 / 3);
    if (dot(f, sub(c, from)) < 0) flipped++;
  }
  if (flipped * 2 > p.index.length / 3) {
    p.flip();
    for (let i = 0; i < p.normal.length; i++) p.normal[i] = -p.normal[i];
  }
}

// ── The strap and its clip ───────────────────────────────────────────────

/** THE STRAP: its width, m, the share of it in the kit's colour (the
 * middle lane), how far proud of the shell it lies, where it comes onto
 * the shell (deg round), and its middle's height there and at the back. */
export const STRAP = { width: 0.04, band: 0.6, lift: 0.0035, on: 54, y: -0.003, back: 0.004 };

function strapY(a: number): number {
  const f = (roundFrom(a) - STRAP.on) / (180 - STRAP.on);
  return STRAP.y + (STRAP.back - STRAP.y) * Math.max(0, f) ** 2;
}

function buildStrap(detail: number): Piece[] {
  const C = counts(detail);
  const G = GOGGLES;
  // The centre line: from the frame's right end along the shell round the
  // back to its left end — each point, its across (up the band) and out.
  const line: { p: V; up: V; out: V }[] = [];
  const end = (s: number) => {
    const p = goggleAt(s * G.half, 0, G.frame * 0.5);
    const q = shellAt(strapY(s * STRAP.on * DEG), s * STRAP.on * DEG);
    const out = norm([p[0], 0, p[2] - (G.front - G.across)]);
    return { p, q, out };
  };
  const right = end(1);
  const left = end(-1);
  line.push({ p: right.p, up: [0, 1, 0], out: right.out });
  const span = 360 - 2 * STRAP.on;
  for (let k = 0; k <= C.strap; k++) {
    const a = (STRAP.on + (span * k) / C.strap) * DEG;
    const y = strapY(a);
    const n = shellNormal(y, a);
    const p = add(shellAt(y, a), mul(n, STRAP.lift));
    const up = norm(sub(shellAt(y + 1e-3, a), shellAt(y - 1e-3, a)));
    line.push({ p, up, out: n });
  }
  line.push({ p: left.p, up: [0, 1, 0], out: left.out });
  const edge = new Piece("strap");
  const band = new Piece("band");
  const w = STRAP.width / 2;
  const lanes: [number, number, Piece][] = [
    [-w, -w * STRAP.band, edge],
    [-w * STRAP.band, w * STRAP.band, band],
    [w * STRAP.band, w, edge],
  ];
  for (const [lo, hi, into] of lanes) {
    const ids = line.map((c) => [
      into.vert(add(c.p, mul(c.up, lo)), c.out),
      into.vert(add(c.p, mul(c.up, hi)), c.out),
    ]);
    for (let k = 0; k + 1 < ids.length; k++)
      into.quad(ids[k][0], ids[k + 1][0], ids[k + 1][1], ids[k][1]);
  }
  fixWinding(edge);
  fixWinding(band);
  // THE CLIP at the back, over the strap: a block with its corners cut,
  // its face a little domed.
  const clip = new Piece("strap");
  const y = strapY(Math.PI);
  const n = shellNormal(y, Math.PI);
  const c = add(shellAt(y, Math.PI), mul(n, STRAP.lift));
  const up: V = [0, 1, 0];
  const across = norm(cross(up, n));
  const [hx, hy, deep, cut] = [0.024, 0.017, 0.007, 0.006];
  const octagon: [number, number][] = [
    [-hx + cut, -hy],
    [hx - cut, -hy],
    [hx, -hy + cut],
    [hx, hy - cut],
    [hx - cut, hy],
    [-hx + cut, hy],
    [-hx, hy - cut],
    [-hx, -hy + cut],
  ];
  const ring = (out: number, k: number): number[] =>
    octagon.map(([u, v]) =>
      clip.vert(add(add(add(c, mul(across, u * k)), mul(up, v * k)), mul(n, out))),
    );
  const rb = ring(-0.003, 1);
  const rf = ring(deep, 1);
  const rt = ring(deep + 0.0015, 0.7);
  for (let k = 0; k < 8; k++) {
    const j = (k + 1) % 8;
    clip.quad(rb[k], rb[j], rf[j], rf[k]);
    clip.quad(rf[k], rf[j], rt[j], rt[k]);
  }
  const cap = clip.vert(add(c, mul(n, deep + 0.002)));
  for (let k = 0; k < 8; k++) clip.tri(rt[k], rt[(k + 1) % 8], cap);
  clip.faceNormals();
  orientOut(clip, sub(c, mul(n, 0.05)));
  return [edge, band, clip];
}

// ── The head and the chin strap ──────────────────────────────────────────

/** THE HEAD under it, m: an egg a little long, its middle, the jaw carried
 * forward to a chin, a nose under the goggles' arch. */
const HEAD = { r: [0.077, 0.104, 0.097] as V, at: [0, -0.014, -0.006] as V };

function headPoint(theta: number, phi: number): V {
  // theta up from the chin (0) to the crown (π), phi round from ahead.
  const s = Math.sin(theta);
  const d: V = [Math.sin(phi) * s, -Math.cos(theta), Math.cos(phi) * s];
  let p: V = [d[0] * HEAD.r[0], d[1] * HEAD.r[1], d[2] * HEAD.r[2]];
  // The jaw: the lower face carried forward and squared to a chin.
  const fore = Math.max(0, d[2]);
  const low = smooth((-d[1] - 0.15) / 0.6);
  p = add(p, [d[0] * -0.012 * low, -0.004 * low * fore, 0.03 * low * fore * fore]);
  return add(p, HEAD.at);
}

function buildHead(detail: number): Piece[] {
  const [around, up] = counts(detail).head;
  const skin = new Piece("skin");
  const ids: number[][] = [];
  for (let j = 0; j <= up; j++) {
    const row: number[] = [];
    for (let i = 0; i < around; i++) {
      row.push(skin.vert(headPoint((Math.PI * j) / up, (2 * Math.PI * i) / around)));
      if (j === 0 || j === up) break;
    }
    ids.push(row);
  }
  for (let j = 0; j < up; j++) {
    for (let i = 0; i < around; i++) {
      const k = (i + 1) % around;
      const a = ids[j][j === 0 ? 0 : i];
      const b = ids[j][j === 0 ? 0 : k];
      const c = ids[j + 1][j + 1 === up ? 0 : k];
      const d = ids[j + 1][j + 1 === up ? 0 : i];
      if (j === 0) skin.tri(a, c, d);
      else if (j + 1 === up) skin.tri(a, b, c);
      else skin.quad(a, b, c, d);
    }
  }
  skin.faceNormals();
  orientOut(skin, HEAD.at);
  // The face is his own below the goggles; the rest of the head and the
  // neck are in a dark knit balaclava, as a racer's are.
  const face = new Piece("skin");
  const knit = new Piece("knit");
  const P = skin.position;
  const Nn = skin.normal;
  for (let t = 0; t < skin.index.length; t += 3) {
    const tri = skin.index.slice(t, t + 3);
    const cy = tri.reduce((sum, i) => sum + P[i * 3 + 1], 0) / 3;
    const cz = tri.reduce((sum, i) => sum + P[i * 3 + 2], 0) / 3;
    const to = cz > 0.045 && cy < 0.01 ? face : knit;
    const ids = tri.map((i) =>
      to.vert([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], [Nn[i * 3], Nn[i * 3 + 1], Nn[i * 3 + 2]]),
    );
    to.tri(ids[0], ids[1], ids[2]);
  }
  // The nose: a wedge from under the goggles' arch.
  const nose = new Piece("skin");
  const tip: V = [0, -0.05, 0.124];
  const root = [
    [-0.012, -0.024, 0.098],
    [0.012, -0.024, 0.098],
    [0.014, -0.058, 0.104],
    [-0.014, -0.058, 0.104],
  ].map((p) => nose.vert(p as V));
  const t = nose.vert(tip);
  for (let k = 0; k < 4; k++) nose.tri(root[k], root[(k + 1) % 4], t);
  nose.faceNormals();
  orientOut(nose, [0, -0.04, 0.06]);
  return [face, knit, nose];
}

/** THE CHIN STRAP: webbing from inside each ear cover down under the jaw,
 * 1.8 cm wide. */
function buildChinStrap(): Piece {
  const into = new Piece("strap");
  const K = 12;
  const ids: number[][] = [];
  for (let k = 0; k <= K; k++) {
    const f = k / K;
    const t = (f * 2 - 1) * (Math.PI / 2);
    const p: V = [0.07 * Math.sin(t), -0.062 - 0.056 * Math.cos(t), 0.004 + 0.05 * Math.cos(t)];
    const out = norm([Math.sin(t), -Math.cos(t) * 0.8, Math.cos(t) * 0.6]);
    const along: V = norm([Math.cos(t), Math.sin(t) * 0.5, -Math.sin(t) * 0.6]);
    const across = norm(cross(along, out));
    ids.push([
      into.vert(add(p, mul(across, -0.009)), out),
      into.vert(add(p, mul(across, 0.009)), out),
    ]);
  }
  for (let k = 0; k < K; k++) into.quad(ids[k][0], ids[k + 1][0], ids[k + 1][1], ids[k][1]);
  fixWinding(into);
  return into;
}

// ── The whole ────────────────────────────────────────────────────────────

/**
 * THE HEAD IN ITS HELMET: every surface, merged a material a part, in the
 * head's frame. `detail` 1 is the game's (the code's figure, the model's
 * game quality), 2 a studio still's.
 */
export function helmetParts(detail = 1): HelmetPart[] {
  const pieces = [
    ...buildShell(detail),
    buildVents(),
    ...buildGoggles(detail),
    ...buildStrap(detail),
    ...buildHead(detail),
    buildChinStrap(),
  ];
  const by = new Map<HelmetMaterial, HelmetPart>();
  for (const p of pieces) {
    let part = by.get(p.material);
    if (!part) {
      part = { material: p.material, position: [], normal: [], index: [] };
      if (p.material === "lens") part.uv = [];
      by.set(p.material, part);
    }
    const base = part.position.length / 3;
    part.position.push(...p.position);
    part.normal.push(...p.normal);
    if (part.uv)
      part.uv.push(...(p.uv.length ? p.uv : new Array((p.position.length / 3) * 2).fill(0)));
    for (const i of p.index) part.index.push(base + i);
  }
  return [...by.values()];
}

/** Triangles the helmet carries, by material — what the lab and the suite
 * hold it to. */
export function helmetTriangles(detail = 1): Record<HelmetMaterial, number> {
  const out = {} as Record<HelmetMaterial, number>;
  for (const p of helmetParts(detail)) out[p.material] = p.index.length / 3;
  return out;
}
