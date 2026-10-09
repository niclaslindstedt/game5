// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABIN BUILDER'S PARTS — the pieces every log building is made of
// (`cabin-shapes.ts`), on the trees' bench (`tree-mesh.ts`): a round log
// faceted to six sides with its end grain showing where it runs past a
// corner, a box, a wall of dressed stones laid in courses, a window in its
// casing with its mullions, sill and shutters, a plank door, a stack of
// split firewood showing its ends, a gable roof of boards with its eaves and
// verges, and the BLANKET OF SNOW on a roof slope — thick, lumped, run out
// over the eave in a rounded lip and cut off square at the verge, where its
// depth shows. Faceted light, as the woods round them, and every face
// carrying the MATERIAL it is made of: the buildings' painted stack
// (`facade-paint.ts` — the bark along a log and the rings on its sawn end,
// dressed stone, split firewood, a casement, a plank door, a board shutter)
// tinted by the face's colour, so the detail is in the paint and a wall of
// stone or a window is a handful of faces rather than a stone or a board a
// box.
//
// THE FRAME is the building's (`defs/cabins.ts`): x across its front, y up
// from the floor, z toward its front. A WALL is stated as a frame of its
// own — `u` along it, `y` up, `o` out of it — so a window or a door is laid
// on any wall by the same code.

import * as THREE from "three";

import { FACADE, FACADE_TILE, type FacadeLayer } from "./facade-paint.ts";
import { Shape, faceNormal, jitter, type V3 } from "./tree-mesh.ts";

const colour = (hex: number): THREE.Color => new THREE.Color(hex);

/** The paints, sRGB. */
export const CABIN_PAINT = {
  /** Weathered round logs, two shades and the dark of the lowest course. */
  log: [colour(0x7d5a3a), colour(0x6c4c31), colour(0x84603f)],
  logLow: colour(0x5b412b),
  /** The end grain of a sawn log, and its bark ring. */
  grain: colour(0xd2b184),
  grainDark: colour(0xb08e63),
  /** A stack's log ends as the far cut paints them: the grain in the
   * shadow between the ends, two bands, so it never flashes at distance. */
  stackFar: [colour(0x8f6e4c), colour(0x6e5238)],
  /** The chinking between the courses. */
  chink: colour(0xd9d0be),
  /** Dressed stone, four tones, and the mortar's. */
  stone: [colour(0x8e8a84), colour(0x76726c), colour(0x9e9890), colour(0x6c6964)],
  mortar: colour(0x5d5b57),
  /** The roof: its boards on top, the soffit under the eaves, the fascia. */
  shingle: colour(0x3d3029),
  soffit: colour(0x9a7650),
  fascia: colour(0x4a3526),
  /** Painted trim: the window casings, and two shutter colours. */
  trim: colour(0xebe5d6),
  shutter: [colour(0x2f5a3c), colour(0x8c2f25)],
  glass: colour(0x1f2a33),
  door: [colour(0x5e3d24), colour(0x4f3320)],
  iron: colour(0x2a2a2a),
  /** The dark of a room seen through an open door. */
  room: colour(0x15110d),
  /** Plank walls (a shed), and the render of a chalet's stone floor. */
  board: [colour(0x7a5a3c), colour(0x6a4c32)],
  render: colour(0xe6e0d3),
  /** No tint: a material in its own painted colours. */
  white: colour(0xffffff),
  /** The snow, lit and in its own shade. */
  snow: colour(0xf4f7fa),
  snowShade: colour(0xdfe7ef),
};

export type CabinShape = Shape;

/** A fresh bench: no lean, no trunk, every face wound outward, a GLOW mark
 * (a window's pane, lit at night) and the facade's two (`facadeLayer`, the
 * material, and `facadeUv` over its tile), every push matte until a face
 * names its material. */
export function cabinBench(): Shape {
  const s = new Shape(0, {
    stems: false,
    wind: true,
    marks: { glow: 1, facadeUv: 2, facadeLayer: 1 },
  });
  s.mark("facadeLayer", FACADE.matte);
  s.facet = 0.7;
  return s;
}

/** UVs over a layer's tile: a corner of a face `u`, `v` metres from its
 * own origin, or the face's share 0..1 across a `once` tile. */
type UV = [number, number];

/** A FACE of a material: a quad a b c d (a its foot's left, b its foot's
 * right, c its head's right, d its head's left) with its corners' UVs. */
export function face(
  s: Shape,
  a: V3,
  b: V3,
  c: V3,
  d: V3,
  uv: readonly [UV, UV, UV, UV],
  layer: FacadeLayer,
  col: THREE.Color,
  n?: V3,
): void {
  const nn = n ?? faceNormal(a, b, c);
  s.mark("facadeLayer", layer);
  const push = (p: V3, t: UV): void => {
    s.mark("facadeUv", t[0], t[1]);
    s.push(p, col, nn);
  };
  push(a, uv[0]);
  push(b, uv[1]);
  push(c, uv[2]);
  // A triangle is a quad whose head is one point.
  if (d !== c) {
    push(a, uv[0]);
    push(c, uv[2]);
    push(d, uv[3]);
  }
  s.mark("facadeUv", 0, 0);
  s.mark("facadeLayer", FACADE.matte);
}

/** A face laid with its material in METRES over the tile — `w` wide, `h`
 * high, from (`u0`, `v0`) m — or once over it for a `once` layer. */
export function laid(
  s: Shape,
  a: V3,
  b: V3,
  c: V3,
  d: V3,
  layer: FacadeLayer,
  col: THREE.Color,
  n?: V3,
  u0 = 0,
  v0 = 0,
): void {
  const t = FACADE_TILE[layer];
  if (t.once) {
    face(
      s,
      a,
      b,
      c,
      d,
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      layer,
      col,
      n,
    );
    return;
  }
  const w = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const h = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
  const ua = u0 / t.u;
  const ub = (u0 + w) / t.u;
  const va = v0 / t.v;
  const vb = (v0 + h) / t.v;
  face(
    s,
    a,
    b,
    c,
    d,
    [
      [ua, va],
      [ub, va],
      [ub, vb],
      [ua, vb],
    ],
    layer,
    col,
    n,
  );
}

/** A box from (x0, y0, z0) to (x1, y1, z1), each face one colour in its
 * material (`layer`, matte unless named, laid in metres); `top` the top's
 * own colour and `topLayer` its own material; `skip` leaves out faces
 * nobody sees ("y-" the bottom, "z-" the back…). */
export function box(
  s: Shape,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  c: THREE.Color,
  top: THREE.Color = c,
  skip: readonly string[] = ["y-"],
  layer: FacadeLayer = FACADE.matte,
  topLayer: FacadeLayer = layer,
): void {
  const p = (x: number, y: number, z: number): V3 => [x, y, z];
  const L = (
    a: V3,
    b: V3,
    cc: V3,
    d: V3,
    col: THREE.Color,
    n: V3,
    ly: FacadeLayer,
    u0: number,
    v0: number,
  ) => laid(s, a, b, cc, d, ly, col, n, u0, v0);
  if (!skip.includes("y+"))
    L(
      p(x0, y1, z1),
      p(x1, y1, z1),
      p(x1, y1, z0),
      p(x0, y1, z0),
      top,
      [0, 1, 0],
      topLayer,
      x0,
      -z1,
    );
  if (!skip.includes("y-"))
    L(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), c, [0, -1, 0], layer, x0, z0);
  if (!skip.includes("z+"))
    L(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), c, [0, 0, 1], layer, x0, y0);
  if (!skip.includes("z-"))
    L(p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), c, [0, 0, -1], layer, -x1, y0);
  if (!skip.includes("x+"))
    L(p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), c, [1, 0, 0], layer, -z1, y0);
  if (!skip.includes("x-"))
    L(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), c, [-1, 0, 0], layer, z0, y0);
}

/** A ROUND LOG from `a` to `b` (horizontal), faceted to six sides with a
 * flat top and bottom — so the courses sit on their flats with the
 * chinking line between — its bark laid along it and its END GRAIN capped
 * where it shows. The flat underside sits on the course below and is never
 * drawn; `flat` false leaves out the top's too, where the next course sits
 * on it. */
export function logBar(
  s: Shape,
  a: V3,
  b: V3,
  r: number,
  c: THREE.Color,
  capA: boolean,
  capB: boolean,
  flat = true,
): void {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dz) || 1;
  // Across the log in plan, and up.
  const sx = -dz / len;
  const sz = dx / len;
  const ring = (p: V3, k: number, rr: number): V3 => {
    const t = (k / 6) * Math.PI * 2;
    return [p[0] + sx * Math.cos(t) * rr, p[1] + Math.sin(t) * rr, p[2] + sz * Math.cos(t) * rr];
  };
  const out = (k: number): V3 => {
    const t = ((k + 0.5) / 6) * Math.PI * 2;
    return [sx * Math.cos(t), Math.sin(t), sz * Math.cos(t)];
  };
  // A log tapers a little from its butt to its top; the bark is laid in
  // metres along it (from where it starts, so two logs never repeat in
  // step) and once round it.
  const rb = r * 0.94;
  const tile = FACADE_TILE[FACADE.bark].u;
  const u0 = (a[0] * 0.37 + a[2] * 0.61 + a[1] * 1.7) / tile;
  const u1 = u0 + len / tile;
  for (let k = 0; k < 6; k++) {
    if (k === 4 || (k === 1 && !flat)) continue;
    // The underside's two faces are a shade darker: the shadow a course
    // throws on the one below.
    const shade = k >= 3 ? c.clone().multiplyScalar(0.9) : c;
    face(
      s,
      ring(a, k, r),
      ring(b, k, rb),
      ring(b, k + 1, rb),
      ring(a, k + 1, r),
      [
        [u0, k / 6],
        [u1, k / 6],
        [u1, (k + 1) / 6],
        [u0, (k + 1) / 6],
      ],
      FACADE.bark,
      shade,
      out(k),
    );
  }
  // The sawn end: the rings painted on one flat face.
  const cap = (p: V3, rr: number, n: V3, flip: number): void => {
    const pts = [0, 1, 2, 3, 4, 5].map((k) => ring(p, k, rr));
    const uv = (k: number): UV => {
      const t = (k / 6) * Math.PI * 2;
      return [0.5 + 0.49 * Math.cos(t) * flip, 0.5 + 0.49 * Math.sin(t)];
    };
    face(
      s,
      pts[0],
      pts[1],
      pts[2],
      pts[3],
      [uv(0), uv(1), uv(2), uv(3)],
      FACADE.endGrain,
      CABIN_PAINT.white,
      n,
    );
    face(
      s,
      pts[0],
      pts[3],
      pts[4],
      pts[5],
      [uv(0), uv(3), uv(4), uv(5)],
      FACADE.endGrain,
      CABIN_PAINT.white,
      n,
    );
  };
  if (capA) cap(a, r, [-dx / len, 0, -dz / len], -1);
  if (capB) cap(b, rb, [dx / len, 0, dz / len], 1);
}

/** A WALL'S OWN FRAME: `u` along it, `y` up, `o` out of it, from the
 * point (`x`, `z`) on its outer face at u = 0. */
export type Wall = { x: number; z: number; ux: number; uz: number; nx: number; nz: number };

/** The four walls of a footprint `w` × `d`, each with u running left to
 * right seen from outside it and u = 0 its middle. */
export function wallsOf(w: number, d: number): Record<"front" | "back" | "left" | "right", Wall> {
  return {
    front: { x: 0, z: d / 2, ux: 1, uz: 0, nx: 0, nz: 1 },
    back: { x: 0, z: -d / 2, ux: -1, uz: 0, nx: 0, nz: -1 },
    right: { x: w / 2, z: 0, ux: 0, uz: -1, nx: 1, nz: 0 },
    left: { x: -w / 2, z: 0, ux: 0, uz: 1, nx: -1, nz: 0 },
  };
}

/** A point on a wall. */
export function on(w: Wall, u: number, y: number, o: number): V3 {
  return [w.x + w.ux * u + w.nx * o, y, w.z + w.uz * u + w.nz * o];
}

/** A box laid on a wall: `u0..u1` along it, `y0..y1`, `o0..o1` out of it,
 * in its material (`layer`, matte unless named); `skip` leaves out the
 * faces nobody sees ("top", "bottom", "front", "ends"). */
export function wallBox(
  s: Shape,
  w: Wall,
  u0: number,
  u1: number,
  y0: number,
  y1: number,
  o0: number,
  o1: number,
  c: THREE.Color,
  top: THREE.Color = c,
  layer: FacadeLayer = FACADE.matte,
  skip: readonly string[] = [],
): void {
  const n: V3 = [w.nx, 0, w.nz];
  const along: V3 = [w.ux, 0, w.uz];
  const p = (u: number, y: number, o: number): V3 => on(w, u, y, o);
  if (!skip.includes("front"))
    laid(s, p(u0, y0, o1), p(u1, y0, o1), p(u1, y1, o1), p(u0, y1, o1), layer, c, n, u0, y0);
  if (!skip.includes("top"))
    laid(s, p(u0, y1, o1), p(u1, y1, o1), p(u1, y1, o0), p(u0, y1, o0), layer, top, [0, 1, 0], u0);
  if (!skip.includes("bottom"))
    laid(s, p(u0, y0, o0), p(u1, y0, o0), p(u1, y0, o1), p(u0, y0, o1), layer, c, [0, -1, 0], u0);
  if (!skip.includes("ends")) {
    laid(s, p(u1, y0, o1), p(u1, y0, o0), p(u1, y1, o0), p(u1, y1, o1), layer, c, along, 0, y0);
    laid(
      s,
      p(u0, y0, o0),
      p(u0, y0, o1),
      p(u0, y1, o1),
      p(u0, y1, o0),
      layer,
      c,
      [-along[0], 0, -along[2]],
      0,
      y0,
    );
  }
}

/** A face on a wall: `u0..u1` × `y0..y1`, `o` out of it, in its material. */
export function wallFace(
  s: Shape,
  w: Wall,
  u0: number,
  u1: number,
  y0: number,
  y1: number,
  o: number,
  layer: FacadeLayer,
  c: THREE.Color,
): void {
  laid(
    s,
    on(w, u0, y0, o),
    on(w, u1, y0, o),
    on(w, u1, y1, o),
    on(w, u0, y1, o),
    layer,
    c,
    [w.nx, 0, w.nz],
    u0,
    y0,
  );
}

/** An opening in a wall: a window or a door, `u0..u1` and `y0..y1`. */
export type Opening = { wall: Wall; u0: number; u1: number; y0: number; y1: number };

/** THE OPENING'S SURROUND: the reveals from the wall's face back to what
 * is set in it, and the casing boards proud round it — their faces and
 * their outer edges — `k` m wide, in `c`. */
function surround(
  s: Shape,
  op: Opening,
  back: number,
  k: number,
  c: THREE.Color,
  sill: boolean,
): void {
  const { wall: w, u0, u1, y0, y1 } = op;
  const along: V3 = [w.ux, 0, w.uz];
  const T = FACADE.timber;
  const o = 0.05;
  // The reveals: the opening's two sides and its head, inside the casing.
  laid(
    s,
    on(w, u0, y0, back),
    on(w, u0, y0, o),
    on(w, u0, y1, o),
    on(w, u0, y1, back),
    T,
    c,
    along,
  );
  laid(s, on(w, u1, y0, o), on(w, u1, y0, back), on(w, u1, y1, back), on(w, u1, y1, o), T, c, [
    -along[0],
    0,
    -along[2],
  ]);
  laid(
    s,
    on(w, u0, y1, o),
    on(w, u1, y1, o),
    on(w, u1, y1, back),
    on(w, u0, y1, back),
    T,
    c,
    [0, -1, 0],
  );
  // The casing: its two sides and its head, their faces and outer edges.
  const foot = sill ? y0 : y0 - k;
  wallFace(s, w, u0 - k, u0, foot, y1 + k, o, T, c);
  wallFace(s, w, u1, u1 + k, foot, y1 + k, o, T, c);
  wallFace(s, w, u0, u1, y1, y1 + k, o, T, c);
  laid(
    s,
    on(w, u0 - k, foot, 0),
    on(w, u0 - k, foot, o),
    on(w, u0 - k, y1 + k, o),
    on(w, u0 - k, y1 + k, 0),
    T,
    c,
    [-along[0], 0, -along[2]],
  );
  laid(
    s,
    on(w, u1 + k, foot, o),
    on(w, u1 + k, foot, 0),
    on(w, u1 + k, y1 + k, 0),
    on(w, u1 + k, y1 + k, o),
    T,
    c,
    along,
  );
  laid(
    s,
    on(w, u0 - k, y1 + k, o),
    on(w, u1 + k, y1 + k, o),
    on(w, u1 + k, y1 + k, 0),
    on(w, u0 - k, y1 + k, 0),
    T,
    c,
    [0, 1, 0],
  );
}

/** A WINDOW in its opening: the casement set back in the wall — its sash,
 * its cross of mullions and the glass painted, the glass alone lit at
 * night (the GLOW mark; the material lights only a casement's glass) — the
 * reveals and the casing boards round it; a sill with its line of snow;
 * and a pair of board shutters folded back beside it (`shutter` null:
 * none). */
export function windowIn(s: Shape, op: Opening, shutter: THREE.Color | null): void {
  const { wall: w, u0, u1, y0, y1 } = op;
  const P = CABIN_PAINT;
  const back = -0.06;
  s.mark("glow", 1);
  wallFace(s, w, u0, u1, y0, y1, back, FACADE.casement, P.white);
  s.mark("glow", 0);
  const k = 0.09;
  surround(s, op, back, k, P.trim, true);
  // The sill stands out of the wall, and snow lies along it.
  wallBox(
    s,
    w,
    u0 - k - 0.04,
    u1 + k + 0.04,
    y0 - k - 0.04,
    y0,
    back,
    0.12,
    P.trim,
    P.trim,
    FACADE.timber,
    ["bottom"],
  );
  wallBox(s, w, u0 - k, u1 + k, y0, y0 + 0.05, 0, 0.12, P.snow, P.snow, FACADE.snow, [
    "bottom",
    "ends",
  ]);
  if (shutter) {
    const sw = (u1 - u0) / 2 + 0.04;
    for (const [a, b] of [
      [u0 - k - sw, u0 - k - 0.01],
      [u1 + k + 0.01, u1 + k + sw],
    ]) {
      wallBox(s, w, a, b, y0 - 0.04, y1 + 0.04, 0.04, 0.09, shutter, shutter, FACADE.boardShutter, [
        "bottom",
        "top",
      ]);
    }
  }
}

/** A PLANK DOOR in its opening: its boards, ledges, brace and latch
 * painted on one face set back in the wall, the reveals and the casing
 * round it — or, `hung`, the doorway a walker goes in at: the room's dark
 * behind where its leaf hangs (`room`: a leaf that swings in, the dark
 * room laid behind the hole by `doors-view.ts`), the leaf itself hung and
 * swung there. */
export function doorIn(s: Shape, op: Opening, hung = false, room = false): void {
  const { wall: w, u0, u1, y0, y1 } = op;
  const P = CABIN_PAINT;
  const back = -0.06;
  // A leaf that swings in has the dark room `doors-view.ts` lays behind
  // the hole; one that swings out stands before a dark face here.
  if (hung && !room) wallFace(s, w, u0, u1, y0, y1, back - 0.01, FACADE.matte, P.room);
  else if (!hung) wallFace(s, w, u0, u1, y0, y1, back, FACADE.plankDoor, P.white);
  surround(s, op, back, 0.1, P.door[1], true);
}

/** A FACE OF DRESSED STONE on a wall: `u0..u1` × `y0..y1`, `o` out — the
 * courses, the running bond and the mortar painted (`FACADE.stone`). */
export function stoneFace(
  s: Shape,
  w: Wall,
  u0: number,
  u1: number,
  y0: number,
  y1: number,
  o: number,
): void {
  wallFace(s, w, u0, u1, y0, y1, o, FACADE.stone, CABIN_PAINT.white);
}

/** A STACK OF SPLIT FIREWOOD against a wall: `u0..u1` along it, up to
 * `h`, `depth` out of it — its ends painted (`FACADE.woodpile`) on its
 * face, the bark of the split logs on its ends and top, and a cap of
 * snow. */
export function woodStack(
  s: Shape,
  w: Wall,
  u0: number,
  u1: number,
  h: number,
  depth: number,
  o0 = 0.02,
): void {
  const P = CABIN_PAINT;
  const o1 = o0 + depth;
  wallBox(s, w, u0, u1, 0, h, o0, o1, P.log[1], P.log[1], FACADE.bark, ["front", "bottom"]);
  wallFace(s, w, u0, u1, 0, h, o1, FACADE.woodpile, P.white);
  wallBox(s, w, u0 - 0.03, u1 + 0.03, h, h + 0.09, o0, o1 + 0.03, P.snow, P.snow, FACADE.snow, [
    "bottom",
  ]);
}

/** A GABLE ROOF stated across its slope: `along` from `a0` to `a1` down
 * the ridge's axis; the wall plate `span` m either side of the ridge at
 * height `plate`; the ridge at `ridge`; the eaves `eave` m past the wall
 * plate; the boards `t` m thick. `at(a, b, y)` puts a point of the roof
 * into the building's frame (b across the slope, + one side). */
export type Roof = {
  a0: number;
  a1: number;
  span: number;
  plate: number;
  ridge: number;
  eave: number;
  t: number;
  at: (a: number, b: number, y: number) => V3;
};

/** The roof's underside over a point `b` across it (|b| from the ridge). */
export function roofUnder(r: Roof, b: number): number {
  return r.ridge - (Math.abs(b) / r.span) * (r.ridge - r.plate);
}

/** Both slopes of a gable roof: the boards' top, the soffit under the
 * eaves, the fascia along them and the verges' ends. */
export function gableRoof(s: Shape, r: Roof, sides: readonly number[] = [-1, 1]): void {
  const P = CABIN_PAINT;
  const e = r.span + r.eave;
  const yE = roofUnder(r, e);
  for (const sg of sides) {
    const E0 = (a: number): V3 => r.at(a, sg * e, yE);
    const E1 = (a: number): V3 => r.at(a, sg * e, yE + r.t);
    const R0 = (a: number): V3 => r.at(a, 0, r.ridge);
    const R1 = (a: number): V3 => r.at(a, 0, r.ridge + r.t);
    const up: V3 = r.at(0, sg * 0.6, 1);
    const upN: V3 = [up[0] - r.at(0, 0, 0)[0], 1, up[2] - r.at(0, 0, 0)[2]];
    s.quad(E1(r.a0), E1(r.a1), R1(r.a1), R1(r.a0), P.shingle, upN);
    laid(
      s,
      E0(r.a0),
      E0(r.a1),
      R0(r.a1),
      R0(r.a0),
      FACADE.timber,
      P.soffit,
      [-upN[0], -1, -upN[2]],
      r.a0,
    );
    const out = r.at(0, sg, 0);
    const o0 = r.at(0, 0, 0);
    laid(s, E0(r.a0), E0(r.a1), E1(r.a1), E1(r.a0), FACADE.timber, P.fascia, [
      out[0] - o0[0],
      0,
      out[2] - o0[2],
    ]);
    for (const [a, k] of [
      [r.a0, -1],
      [r.a1, 1],
    ] as const) {
      const n = r.at(k, 0, 0);
      s.quad(E0(a), E1(a), R1(a), R0(a), P.fascia, [n[0] - o0[0], 0, n[2] - o0[2]]);
    }
  }
}

/** THE SNOW ON A ROOF SLOPE: a blanket `depth` m thick over the boards,
 * lumped along the ridge, running out over the eave in a rounded lip that
 * curls down past the fascia, and cut square a hand inside the verge — its
 * section showing there, the depth a skier reads the winter by. `segs`
 * pieces along the ridge (fewer on the far cut). */
export function roofSnow(
  s: Shape,
  r: Roof,
  depth: number,
  segs: number,
  seed: number,
  sides: readonly number[] = [-1, 1],
  closeRidge = false,
): void {
  const P = CABIN_PAINT;
  const e = r.span + r.eave;
  const topAt = (b: number): number => roofUnder(r, b) + r.t;
  // The section across the slope, ridge to lip: (b, height over the boards).
  const section: [number, number][] = [
    [0, depth * 1.02],
    [e * 0.45, depth * 1.06],
    [e * 0.86, depth * 0.95],
    [e + 0.1, depth * 0.62],
    [e + 0.16, depth * 0.2],
    [e + 0.08, -0.1],
    [e - 0.05, -0.01],
  ];
  const a0 = r.a0 + 0.06;
  const a1 = r.a1 - 0.06;
  for (const sg of sides) {
    const rings: V3[][] = [];
    const as: number[] = [];
    const ringAt = (a: number, shrink: number, lump: number): V3[] =>
      section.map(([b, h], k) => {
        const hh = k >= 5 ? h : Math.max(0, h * (1 - shrink) + (k < 3 ? lump : 0));
        const bb = Math.min(b, e + 0.16 - shrink * 0.25);
        return r.at(a, sg * bb, topAt(bb) + hh);
      });
    rings.push(ringAt(a0 + 0.02, 0.6, 0));
    as.push(a0 + 0.02);
    for (let i = 0; i <= segs; i++) {
      const a = a0 + 0.14 + ((a1 - a0 - 0.28) * i) / segs;
      const lump = (jitter(seed * 13 + i * 7 + (sg > 0 ? 3 : 0)) - 0.5) * depth * 0.4;
      rings.push(ringAt(a, i === 0 || i === segs ? 0.12 : 0, lump));
      as.push(a);
    }
    rings.push(ringAt(a1 - 0.02, 0.6, 0));
    as.push(a1 - 0.02);
    // A slope with no other slope to meet at its top (a lean-to) shows the
    // blanket's section along its top edge too.
    if (closeRidge) {
      for (let j = 0; j + 1 < rings.length; j++) {
        const n = r.at(0, -sg, 0);
        const o0 = r.at(0, 0, 0);
        s.quad(
          r.at(as[j], 0, topAt(0)),
          r.at(as[j + 1], 0, topAt(0)),
          rings[j + 1][0],
          rings[j][0],
          P.snowShade,
          [n[0] - o0[0], 0.2, n[2] - o0[2]],
        );
      }
    }
    const o = r.at(0, 0, 0);
    for (let j = 0; j + 1 < rings.length; j++) {
      for (let k = 0; k + 1 < section.length; k++) {
        const under = k >= 4;
        const n = r.at(0, sg * (under ? 0.2 : 0.4), 0);
        const col = under ? P.snowShade : P.snow;
        // The snow's own grain laid in plan: along the ridge and down it.
        const uv = (jj: number, kk: number): [number, number] => [
          as[jj] / 4,
          (sg * section[kk][0]) / 4,
        ];
        face(
          s,
          rings[j][k],
          rings[j + 1][k],
          rings[j + 1][k + 1],
          rings[j][k + 1],
          [uv(j, k), uv(j + 1, k), uv(j + 1, k + 1), uv(j, k + 1)],
          FACADE.snow,
          col,
          [n[0] - o[0], under ? -0.6 : 1, n[2] - o[2]],
        );
      }
    }
    // The square ends at the verges, their faces lit as the snow's side.
    for (const [ring, k] of [
      [rings[0], -1],
      [rings[rings.length - 1], 1],
    ] as const) {
      const n = r.at(k, 0, 0);
      for (let i = 1; i + 1 < ring.length; i++) {
        s.tri(ring[0], ring[i], ring[i + 1], P.snowShade, [n[0] - o[0], 0.2, n[2] - o[2]]);
      }
    }
  }
}

/** A STONE CHIMNEY STACK: `x0..x1` × `z0..z1` from `y0` up to `y1`, its
 * four faces laid in stone, a capstone over it and snow on the cap. */
export function chimney(
  s: Shape,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y0: number,
  y1: number,
): void {
  const faces: Wall[] = [
    { x: (x0 + x1) / 2, z: z1, ux: 1, uz: 0, nx: 0, nz: 1 },
    { x: (x0 + x1) / 2, z: z0, ux: -1, uz: 0, nx: 0, nz: -1 },
    { x: x1, z: (z0 + z1) / 2, ux: 0, uz: -1, nx: 1, nz: 0 },
    { x: x0, z: (z0 + z1) / 2, ux: 0, uz: 1, nx: -1, nz: 0 },
  ];
  faces.forEach((f, i) => {
    const half = i < 2 ? (x1 - x0) / 2 : (z1 - z0) / 2;
    stoneFace(s, f, -half, half, y0, y1, 0);
  });
  const k = 0.07;
  const P = CABIN_PAINT;
  box(
    s,
    x0 - k,
    y1,
    z0 - k,
    x1 + k,
    y1 + 0.12,
    z1 + k,
    P.white,
    P.white,
    ["y+", "y-"],
    FACADE.stone,
  );
  box(
    s,
    x0 - k + 0.02,
    y1 + 0.12,
    z0 - k + 0.02,
    x1 + k - 0.02,
    y1 + 0.26,
    z1 + k - 0.02,
    P.snow,
    P.snow,
    ["y-"],
    FACADE.snow,
  );
}
