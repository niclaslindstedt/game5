// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BUILDER'S KIT FOR BUILDINGS — the few shapes every lift station, hut
// and start house is made of, each face carrying the MATERIAL it is made of
// (a `FACADE` layer of `facade-paint.ts`'s stack) and its UV over that
// layer's tile, so a low-poly box reads as boards, ribs, seams and glass:
// a quad, a box, a prism over any outline and a frustum between two, a
// gable or a mono-pitch roof with its eaves, its fascia and a BLANKET OF
// SNOW on every slope, a column.
//
// THE FRAME: a building is stated in its own metres — x across it, y up, z
// along it — and set down by `at(x, y, z, yaw)` onto the world (its +z
// turned to `yaw`, the engine's heading convention: 0 = +z, clockwise from
// above). Faces are flat-lit, their normals their own, as the rest of the
// mountain is faceted.
//
// Three-free: the arrays it fills are made a geometry by `facade-mesh.ts`,
// and the suite reads them as they are.

import { FACADE, FACADE_TILE, tiledAlong, type FacadeLayer } from "./facade-paint.ts";

export type V3 = [number, number, number];

/** A colour, sRGB 0xRRGGBB, as the vertex tints the layer. */
export type Tint = number;

/** An opening stood on a wall (`inset`), recorded in world metres when a
 * kit is asked to (`FacadeKit.openings`): its foot's two ends, the height
 * it runs up from and to, and what it is (a pane, a door). The rooms read
 * them to cut their linings (`interior-build.ts`). */
export type Opening = { a: V3; b: V3; y0: number; y1: number; layer: FacadeLayer };

/** What a kit has built, in world metres. */
export type FacadeArrays = {
  pos: number[];
  nrm: number[];
  col: number[];
  uv: number[];
  layer: number[];
  glow: number[];
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const lerp3 = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** sRGB 0..255 to linear 0..1, as three keeps vertex colours. */
function linear(c: number): [number, number, number] {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [f((c >> 16) & 255), f((c >> 8) & 255), f(c & 255)];
}

/** A far cut keeps a small triangle with an edge this long, m. */
export const LONG = 2;

/** Whether triangle `t` of `pos` (world corners, nine numbers a triangle)
 * and `glow` (one a corner) stays in a cut whose floor is `minArea` m² —
 * `FacadeKit.tri`'s own rule: a pane that lights, a long thin one
 * (`LONG`), or one as big. What a cut thinned after it is built keeps. */
export function keepsTriangle(
  pos: ArrayLike<number>,
  glow: ArrayLike<number>,
  t: number,
  minArea: number,
): boolean {
  if (glow[t * 3] !== 0) return true;
  const o = t * 9;
  const ux = pos[o + 3] - pos[o];
  const uy = pos[o + 4] - pos[o + 1];
  const uz = pos[o + 5] - pos[o + 2];
  const vx = pos[o + 6] - pos[o];
  const vy = pos[o + 7] - pos[o + 1];
  const vz = pos[o + 8] - pos[o + 2];
  const l = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  if (l >= minArea * 2) return true;
  const wx = pos[o + 6] - pos[o + 3];
  const wy = pos[o + 7] - pos[o + 4];
  const wz = pos[o + 8] - pos[o + 5];
  const l2 = LONG * LONG;
  return (
    ux * ux + uy * uy + uz * uz >= l2 ||
    vx * vx + vy * vy + vz * vz >= l2 ||
    wx * wx + wy * wy + wz * wz >= l2
  );
}

export class FacadeKit {
  readonly out: FacadeArrays = { pos: [], nrm: [], col: [], uv: [], layer: [], glow: [] };
  private ox = 0;
  private oy = 0;
  private oz = 0;
  private cos = 1;
  private sin = 0;
  /** Whether what is pushed next lights at night (a pane). */
  glow = 0;
  /** A FAR CUT's floor, m²: a triangle smaller than this is left out
   * (the frames, balusters, slats and props a building's near cut
   * carries), unless it is a pane that lights — the windows stay lit across
   * the valley — or a long thin one (`LONG`). 0, the near cut, keeps every
   * triangle. */
  minArea = 0;
  /** Every `inset` set down, when an array is handed in. */
  openings: Opening[] | null = null;

  /** Set the frame down: the building's origin at (x, y, z), its +z turned
   * to `yaw`. */
  at(x: number, y: number, z: number, yaw: number): this {
    this.ox = x;
    this.oy = y;
    this.oz = z;
    this.cos = Math.cos(yaw);
    this.sin = Math.sin(yaw);
    return this;
  }

  /** A point of the building's frame in the world. */
  world(p: V3): V3 {
    // +z to (sin, cos); +x to the right of it seen from above, (cos, −sin).
    return [
      this.ox + p[0] * this.cos + p[2] * this.sin,
      this.oy + p[1],
      this.oz - p[0] * this.sin + p[2] * this.cos,
    ];
  }

  /** How many triangles have been pushed. */
  get triangles(): number {
    return this.out.pos.length / 9;
  }

  /** Whether a triangle has an edge as long as `LONG` — a post, a rail, a
   * ridge's trim: thin, but a line across the far cut's picture. */
  private long(a: V3, b: V3, c: V3): boolean {
    const l2 = LONG * LONG;
    const d2 = (p: V3, q: V3) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    return d2(a, b) >= l2 || d2(b, c) >= l2 || d2(c, a) >= l2;
  }

  /** One triangle, its corners' UVs in the layer's tile, flat-lit. */
  tri(
    a: V3,
    b: V3,
    c: V3,
    ua: number[],
    ub: number[],
    uc: number[],
    layer: FacadeLayer,
    tint: Tint,
  ): void {
    const wa = this.world(a);
    const wb = this.world(b);
    const wc = this.world(c);
    const n = cross(sub(wb, wa), sub(wc, wa));
    const l = len(n);
    if (l < 1e-9) return;
    if (l < this.minArea * 2 && this.glow === 0 && !this.long(wa, wb, wc)) return;
    const col = linear(tint);
    for (const [p, uv] of [
      [wa, ua],
      [wb, ub],
      [wc, uc],
    ] as const) {
      this.out.pos.push(p[0], p[1], p[2]);
      this.out.nrm.push(n[0] / l, n[1] / l, n[2] / l);
      this.out.col.push(col[0], col[1], col[2]);
      this.out.uv.push(uv[0], uv[1]);
      this.out.layer.push(layer);
      this.out.glow.push(this.glow);
    }
  }

  /** A quad a b c d (counter-clockwise seen from its front: a its foot's
   * left, b its foot's right, c its head's right, d its head's left), its
   * UVs laid in metres over the layer's tile from (u0, v0) — or once over
   * it for a `once` layer. */
  quad(a: V3, b: V3, c: V3, d: V3, layer: FacadeLayer, tint: Tint, u0 = 0, v0 = 0): void {
    const t = FACADE_TILE[layer];
    const w = len(sub(b, a));
    const h = len(sub(d, a));
    let uv: number[][];
    if (t.once && !tiledAlong(layer)) {
      uv = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
    } else if (tiledAlong(layer)) {
      // Panes along, laid once up: as many whole panes as fit.
      const panes = Math.max(1, Math.round(w / t.u));
      uv = [
        [0, 0],
        [panes, 0],
        [panes, 1],
        [0, 1],
      ];
    } else {
      const ua = u0 / t.u;
      const va = v0 / t.v;
      const ub = (u0 + w) / t.u;
      const vb = (v0 + h) / t.v;
      uv = [
        [ua, va],
        [ub, va],
        [ub, vb],
        [ua, vb],
      ];
    }
    this.tri(a, b, c, uv[0], uv[1], uv[2], layer, tint);
    this.tri(a, c, d, uv[0], uv[2], uv[3], layer, tint);
  }

  /** A wall from (x0, z0) to (x1, z1) in plan, `y0` to `y1` high, facing
   * (−dz, dx) off its run (dx, dz): a run along +x faces +z. */
  wall(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y0: number,
    y1: number,
    layer: FacadeLayer,
    tint: Tint,
    u0 = 0,
  ): void {
    this.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], layer, tint, u0, y0);
  }

  /** A flat face over an outline at height `y`, looking up (or down),
   * fanned from its first corner; UVs laid in plan. */
  cap(
    outline: readonly [number, number][],
    y: number,
    layer: FacadeLayer,
    tint: Tint,
    down = false,
  ): void {
    const t = FACADE_TILE[layer];
    const uv = (p: [number, number]) => [p[0] / t.u, p[1] / t.v];
    for (let i = 1; i + 1 < outline.length; i++) {
      const a = outline[0];
      const b = outline[i];
      const c = outline[i + 1];
      const pa: V3 = [a[0], y, a[1]];
      const pb: V3 = [b[0], y, b[1]];
      const pc: V3 = [c[0], y, c[1]];
      if (down) this.tri(pa, pb, pc, uv(a), uv(b), uv(c), layer, tint);
      else this.tri(pa, pc, pb, uv(a), uv(c), uv(b), layer, tint);
    }
  }

  /** A PRISM: walls up an outline (counter-clockwise with x to the right
   * and z up the page: (x0, z0), (x1, z0), (x1, z1), (x0, z1)) from `y0` to `y1`, its top capped (unless
   * `top` is null). Each wall's UVs run on round the outline, so boards
   * turn a corner unbroken. */
  prism(
    outline: readonly [number, number][],
    y0: number,
    y1: number,
    layer: FacadeLayer,
    tint: Tint,
    top: { layer: FacadeLayer; tint: Tint } | null = null,
  ): void {
    let u = 0;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      this.wall(b[0], b[1], a[0], a[1], y0, y1, layer, tint, u);
      u += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    if (top) this.cap(outline, y1, top.layer, top.tint);
  }

  /** A BOX from (x0, y0, z0) to (x1, y1, z1): its four sides in `layer`,
   * its top in `top` (left open if null); its bottom never. */
  box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    layer: FacadeLayer,
    tint: Tint,
    top: { layer: FacadeLayer; tint: Tint } | null = { layer: FACADE.plain, tint: 0x5a5f64 },
  ): void {
    this.prism(
      [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ],
      y0,
      y1,
      layer,
      tint,
      top,
    );
  }

  /** A FRUSTUM between two outlines of as many corners (the foot's at
   * `y0`, the head's at `y1`), its sides in `layer`, its head capped. */
  frustum(
    foot: readonly [number, number][],
    head: readonly [number, number][],
    y0: number,
    y1: number,
    layer: FacadeLayer,
    tint: Tint,
    top: { layer: FacadeLayer; tint: Tint } | null,
  ): void {
    let u = 0;
    for (let i = 0; i < foot.length; i++) {
      const j = (i + 1) % foot.length;
      const a: V3 = [foot[j][0], y0, foot[j][1]];
      const b: V3 = [foot[i][0], y0, foot[i][1]];
      const c: V3 = [head[i][0], y1, head[i][1]];
      const d: V3 = [head[j][0], y1, head[j][1]];
      this.quad(a, b, c, d, layer, tint, u, 0);
      u += Math.hypot(foot[i][0] - foot[j][0], foot[i][1] - foot[j][1]);
    }
    if (top) this.cap(head, y1, top.layer, top.tint);
  }

  /** A COLUMN of `sides` from (x, y0, z) to `y1`, radius `r`. */
  column(
    x: number,
    z: number,
    y0: number,
    y1: number,
    r: number,
    layer: FacadeLayer,
    tint: Tint,
    sides = 6,
  ): void {
    const ring: [number, number][] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
      ring.push([x + Math.cos(a) * r, z + Math.sin(a) * r]);
    }
    this.prism(ring, y0, y1, layer, tint, { layer, tint });
  }

  /** A SLOPE of roof: the rectangle from its eave (a → b, along the eave at
   * its height) up to its head (d → c), its boards' UVs running DOWN the
   * slope (v), so a standing seam runs down it; its fascia `thick` deep
   * down the eave's face and its underside (the soffit) in `soffit`; and on
   * it, unless `snow` is 0, a BLANKET OF SNOW that deep, run out over the
   * eave in a rounded lip. */
  slope(
    a: V3,
    b: V3,
    c: V3,
    d: V3,
    roof: { layer: FacadeLayer; tint: Tint },
    thick: number,
    fascia: { layer: FacadeLayer; tint: Tint },
    snow: number,
  ): void {
    // The top: u along the eave, v from the head down to the eave.
    this.quad(a, b, c, d, roof.layer, roof.tint);
    const down: V3 = [0, -thick, 0];
    const at = (p: V3, q: V3): V3 => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
    // The fascia under the eave, and the soffit back under the slope.
    this.quad(at(a, down), at(b, down), b, a, fascia.layer, fascia.tint);
    this.quad(at(d, down), at(c, down), at(b, down), at(a, down), FACADE.plain, 0x6b5a48);
    // The verges either end.
    this.quad(at(b, down), at(c, down), c, b, fascia.layer, fascia.tint);
    this.quad(at(d, down), at(a, down), a, d, fascia.layer, fascia.tint);
    if (snow <= 0) return;
    // The blanket: lifted off the roof along its normal, drawn in a little
    // at the verges, a rounded lip hung over the eave.
    const n = cross(sub(b, a), sub(d, a));
    const nl = len(n) || 1;
    const lift: V3 = [(n[0] / nl) * snow, (n[1] / nl) * snow, (n[2] / nl) * snow];
    const inset = Math.min(0.25, len(sub(b, a)) * 0.04);
    const ab = sub(b, a);
    const abl = len(ab) || 1;
    const sideIn: V3 = [(ab[0] / abl) * inset, (ab[1] / abl) * inset, (ab[2] / abl) * inset];
    const sideOut: V3 = [-sideIn[0], -sideIn[1], -sideIn[2]];
    const sa = at(at(a, sideIn), lift);
    const sb = at(at(b, sideOut), lift);
    const sc = at(at(c, sideOut), lift);
    const sd = at(at(d, sideIn), lift);
    // The lip: out past the eave by a third of the depth, and down over it.
    const eaveOut = sub(a, d);
    const el = len(eaveOut) || 1;
    const over: V3 = [
      (eaveOut[0] / el) * snow * 0.5,
      (eaveOut[1] / el) * snow * 0.5,
      (eaveOut[2] / el) * snow * 0.5,
    ];
    const la = at(at(sa, over), [0, -snow * 0.55, 0]);
    const lb = at(at(sb, over), [0, -snow * 0.55, 0]);
    const ra = at(a, sideIn);
    const rb = at(b, sideOut);
    const lowA = at(at(ra, over), [0, -snow * 1.1, 0]);
    const lowB = at(at(rb, over), [0, -snow * 1.1, 0]);
    this.quad(sa, sb, sc, sd, FACADE.snow, 0xffffff);
    this.quad(la, lb, sb, sa, FACADE.snow, 0xf2f6fa);
    this.quad(lowA, lowB, lb, la, FACADE.snow, 0xdde7f0);
    // The blanket's cut ends at the verges, where its depth shows.
    this.quad(ra, sa, sd, at(d, sideIn), FACADE.snow, 0xe8eef5);
    this.quad(sb, rb, at(c, sideOut), sc, FACADE.snow, 0xe8eef5);
    this.quad(lowA, la, sa, ra, FACADE.snow, 0xe3ebf3);
    this.quad(lb, lowB, rb, sb, FACADE.snow, 0xe3ebf3);
  }

  /** A GABLE ROOF over the rectangle |x| ≤ hw, |z| ≤ hl, its eaves at `y`
   * along the z sides, its ridge `rise` over them along z; `over` m of
   * overhang all round; its gables (the triangles under the verges) in
   * `gable`. */
  gableRoof(
    hw: number,
    hl: number,
    y: number,
    rise: number,
    over: number,
    roof: { layer: FacadeLayer; tint: Tint },
    gable: { layer: FacadeLayer; tint: Tint },
    fascia: { layer: FacadeLayer; tint: Tint },
    snow: number,
  ): void {
    const ew = hw + over;
    const el = hl + over;
    // The eaves drop with the overhang at the roof's pitch.
    const drop = (rise / hw) * over;
    const ridge = y + rise;
    // The left slope (−x) and the right (+x), each from its eave up.
    this.slope(
      [-ew, y - drop, -el],
      [-ew, y - drop, el],
      [0, ridge, el],
      [0, ridge, -el],
      roof,
      0.25,
      fascia,
      snow,
    );
    this.slope(
      [ew, y - drop, el],
      [ew, y - drop, -el],
      [0, ridge, -el],
      [0, ridge, el],
      roof,
      0.25,
      fascia,
      snow,
    );
    // The gables, from the walls' head to the ridge.
    for (const s of [1, -1]) {
      const z = s * hl;
      const a: V3 = [-s * hw, y, z];
      const b: V3 = [s * hw, y, z];
      const c: V3 = [0, ridge, z];
      const t = FACADE_TILE[gable.layer];
      this.tri(
        a,
        b,
        c,
        [0, y / t.v],
        [(2 * hw) / t.u, y / t.v],
        [hw / t.u, ridge / t.v],
        gable.layer,
        gable.tint,
      );
    }
  }

  /** A MONO-PITCH ROOF over |x| ≤ hw, |z| ≤ hl: low at −x (`y`), high at
   * +x (`y + rise`), `over` m of overhang all round; the walls' tops under
   * its rise are filled in `fill`. */
  monoRoof(
    hw: number,
    hl: number,
    y: number,
    rise: number,
    over: number,
    roof: { layer: FacadeLayer; tint: Tint },
    fill: { layer: FacadeLayer; tint: Tint },
    fascia: { layer: FacadeLayer; tint: Tint },
    snow: number,
  ): void {
    const pitch = rise / (2 * hw);
    const lo = y - pitch * over;
    const hi = y + rise + pitch * over;
    const ew = hw + over;
    const el = hl + over;
    this.slope([-ew, lo, -el], [-ew, lo, el], [ew, hi, el], [ew, hi, -el], roof, 0.3, fascia, snow);
    // The high wall's head and the two triangles at the ends.
    this.quad(
      [hw, y, hl],
      [hw, y, -hl],
      [hw, y + rise, -hl],
      [hw, y + rise, hl],
      fill.layer,
      fill.tint,
      0,
      y,
    );
    for (const s of [1, -1]) {
      const z = s * hl;
      const t = FACADE_TILE[fill.layer];
      const a: V3 = [-s * hw, y, z];
      const b: V3 = [s * hw, y, z];
      const c: V3 = [hw, y + rise, z];
      if (s > 0)
        this.tri(
          a,
          b,
          c,
          [0, y / t.v],
          [(2 * hw) / t.u, y / t.v],
          [(2 * hw) / t.u, (y + rise) / t.v],
          fill.layer,
          fill.tint,
        );
      else
        this.tri(
          a,
          b,
          c,
          [(2 * hw) / t.u, y / t.v],
          [0, y / t.v],
          [0, (y + rise) / t.v],
          fill.layer,
          fill.tint,
        );
    }
  }

  /** A FLAT ROOF over |x| ≤ hw, |z| ≤ hl at `y`, its slab `thick` deep and
   * `over` m out all round, and its snow on it. */
  flatRoof(
    hw: number,
    hl: number,
    y: number,
    thick: number,
    over: number,
    edge: { layer: FacadeLayer; tint: Tint },
    snow: number,
  ): void {
    const ew = hw + over;
    const el = hl + over;
    this.box(-ew, y, -el, ew, y + thick, el, edge.layer, edge.tint, {
      layer: FACADE.roof,
      tint: 0x8a8f94,
    });
    this.cap(
      [
        [-ew, -el],
        [ew, -el],
        [ew, el],
        [-ew, el],
      ],
      y,
      FACADE.plain,
      0x5c5a56,
      true,
    );
    if (snow > 0) {
      const i = 0.12;
      this.frustum(
        [
          [-ew + i, -el + i],
          [ew - i, -el + i],
          [ew - i, el - i],
          [-ew + i, el - i],
        ],
        [
          [-ew + i + snow, -el + i + snow],
          [ew - i - snow, -el + i + snow],
          [ew - i - snow, el - i - snow],
          [-ew + i + snow, el - i - snow],
        ],
        y + thick,
        y + thick + snow,
        FACADE.snow,
        0xeef3f8,
        { layer: FACADE.snow, tint: 0xffffff },
      );
    }
  }

  /** A pane or a door laid on a wall from (x0, z0) to (x1, z1) in plan
   * (facing as `wall` does), `y0` to `y1` up, standing `proud` m off it. */
  inset(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y0: number,
    y1: number,
    proud: number,
    layer: FacadeLayer,
    tint: Tint,
    lit = false,
  ): void {
    // The wall's outward normal in plan: to the left of its run.
    const dx = x1 - x0;
    const dz = z1 - z0;
    const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l;
    const nz = dx / l;
    if (this.openings) {
      const a = this.world([x0, y0, z0]);
      const b = this.world([x1, y0, z1]);
      this.openings.push({ a, b, y0: a[1], y1: a[1] + (y1 - y0), layer });
    }
    const was = this.glow;
    this.glow = lit ? 1 : 0;
    this.wall(
      x0 + nx * proud,
      z0 + nz * proud,
      x1 + nx * proud,
      z1 + nz * proud,
      y0,
      y1,
      layer,
      tint,
    );
    this.glow = was;
  }

  /** Points `n` along from a to b, a share `t` each. */
  static along(a: V3, b: V3, t: number): V3 {
    return lerp3(a, b, t);
  }
}
