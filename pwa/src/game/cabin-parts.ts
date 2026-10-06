// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABIN BUILDER'S PARTS — the pieces every log building is made of
// (`cabin-shapes.ts`), on the trees' bench (`tree-mesh.ts`): a round log
// faceted to six sides with its end grain showing where it runs past a
// corner, a box, a wall of dressed stones laid in courses, a window in its
// casing with its mullions, sill and shutters, a plank door, a stack of
// split firewood showing its ends, a gable roof of boards with its eaves and
// verges, and the BLANKET OF SNOW on a roof slope — thick, lumped, run out
// over the eave in a rounded lip and cut off square at the verge, where its
// depth shows. Flat colour a face, faceted light, as the woods round them.
//
// THE FRAME is the building's (`defs/cabins.ts`): x across its front, y up
// from the floor, z toward its front. A WALL is stated as a frame of its
// own — `u` along it, `y` up, `o` out of it — so a window or a door is laid
// on any wall by the same code.

import * as THREE from "three";

import { Shape, jitter, type V3 } from "./tree-mesh.ts";

const colour = (hex: number): THREE.Color => new THREE.Color(hex);

/** The paints, sRGB. */
export const CABIN_PAINT = {
  /** Weathered round logs, two shades and the dark of the lowest course. */
  log: [colour(0x7d5a3a), colour(0x6c4c31), colour(0x84603f)],
  logLow: colour(0x5b412b),
  /** The end grain of a sawn log, and its bark ring. */
  grain: colour(0xd2b184),
  grainDark: colour(0xb08e63),
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
  /** Plank walls (a shed), and the render of a chalet's stone floor. */
  board: [colour(0x7a5a3c), colour(0x6a4c32)],
  render: colour(0xe6e0d3),
  /** The snow, lit and in its own shade. */
  snow: colour(0xf4f7fa),
  snowShade: colour(0xdfe7ef),
};

export type CabinShape = Shape;

/** A fresh bench: no lean, no trunk, every face wound outward, a GLOW mark
 * (a window's pane, lit at night). */
export function cabinBench(): Shape {
  const s = new Shape(0, { stems: false, wind: true, marks: { glow: 1 } });
  s.facet = 0.7;
  return s;
}

/** A box from (x0, y0, z0) to (x1, y1, z1), each face one colour; `top`
 * the top's own colour; `skip` leaves out faces nobody sees ("y-" the
 * bottom, "z-" the back…). */
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
): void {
  const p = (x: number, y: number, z: number): V3 => [x, y, z];
  if (!skip.includes("y+"))
    s.quad(p(x0, y1, z0), p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), top, [0, 1, 0]);
  if (!skip.includes("y-"))
    s.quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), c, [0, -1, 0]);
  if (!skip.includes("z+"))
    s.quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), c, [0, 0, 1]);
  if (!skip.includes("z-"))
    s.quad(p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), c, [0, 0, -1]);
  if (!skip.includes("x+"))
    s.quad(p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), c, [1, 0, 0]);
  if (!skip.includes("x-"))
    s.quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), c, [-1, 0, 0]);
}

/** A ROUND LOG from `a` to `b` (horizontal), faceted to six sides with a
 * flat top and bottom — so the courses sit on their flats with the
 * chinking line between — and its END GRAIN capped where it shows. */
export function logBar(
  s: Shape,
  a: V3,
  b: V3,
  r: number,
  c: THREE.Color,
  capA: boolean,
  capB: boolean,
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
  // A log tapers a little from its butt to its top.
  const rb = r * 0.94;
  for (let k = 0; k < 6; k++) {
    // The flat underside sits on the course below: never seen.
    if (k === 4) continue;
    // The underside's two faces are a shade darker: the shadow a course
    // throws on the one below.
    const shade = k >= 3 ? c.clone().multiplyScalar(0.9) : c;
    s.quad(ring(a, k, r), ring(b, k, rb), ring(b, k + 1, rb), ring(a, k + 1, r), shade, out(k));
  }
  // The sawn end: the grain as one flat face, a shade darker toward the
  // bark on its lower half.
  const cap = (p: V3, rr: number, n: V3): void => {
    const pts = [0, 1, 2, 3, 4, 5].map((k) => ring(p, k, rr));
    s.tri(pts[0], pts[1], pts[2], CABIN_PAINT.grain, n);
    s.tri(pts[0], pts[2], pts[3], CABIN_PAINT.grain, n);
    s.tri(pts[0], pts[3], pts[4], CABIN_PAINT.grainDark, n);
    s.tri(pts[0], pts[4], pts[5], CABIN_PAINT.grainDark, n);
  };
  if (capA) cap(a, r, [-dx / len, 0, -dz / len]);
  if (capB) cap(b, rb, [dx / len, 0, dz / len]);
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

/** A box laid on a wall: `u0..u1` along it, `y0..y1`, `o0..o1` out of it. */
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
): void {
  const n: V3 = [w.nx, 0, w.nz];
  const along: V3 = [w.ux, 0, w.uz];
  const p = (u: number, y: number, o: number): V3 => on(w, u, y, o);
  s.quad(p(u0, y0, o1), p(u1, y0, o1), p(u1, y1, o1), p(u0, y1, o1), c, n);
  s.quad(p(u0, y1, o0), p(u0, y1, o1), p(u1, y1, o1), p(u1, y1, o0), top, [0, 1, 0]);
  s.quad(p(u0, y0, o0), p(u1, y0, o0), p(u1, y0, o1), p(u0, y0, o1), c, [0, -1, 0]);
  s.quad(p(u1, y0, o1), p(u1, y0, o0), p(u1, y1, o0), p(u1, y1, o1), c, along);
  s.quad(p(u0, y0, o0), p(u0, y0, o1), p(u0, y1, o1), p(u0, y1, o0), c, [-along[0], 0, -along[2]]);
}

/** An opening in a wall: a window or a door, `u0..u1` and `y0..y1`. */
export type Opening = { wall: Wall; u0: number; u1: number; y0: number; y1: number };

/** A WINDOW in its opening: the pane set back in the wall, lit at night
 * (the GLOW mark); a cross of mullions; the casing boards round it; a sill
 * with its line of snow; and a pair of shutters folded back beside it
 * (`shutter` null: none). */
export function windowIn(s: Shape, op: Opening, shutter: THREE.Color | null): void {
  const { wall: w, u0, u1, y0, y1 } = op;
  const P = CABIN_PAINT;
  const back = -0.06;
  s.mark("glow", 1);
  s.quad(
    on(w, u0, y0, back),
    on(w, u1, y0, back),
    on(w, u1, y1, back),
    on(w, u0, y1, back),
    P.glass,
    [w.nx, 0, w.nz],
  );
  s.mark("glow", 0);
  // The mullions: a cross laid flat on the pane, seen from outside only.
  const um = (u0 + u1) / 2;
  const ym = (y0 + y1) / 2;
  const bar = 0.035;
  const front = (a: number, b: number, ya: number, yb: number, o: number, c: THREE.Color): void =>
    s.quad(on(w, a, ya, o), on(w, b, ya, o), on(w, b, yb, o), on(w, a, yb, o), c, [w.nx, 0, w.nz]);
  front(um - bar, um + bar, y0, y1, back + 0.03, P.trim);
  front(u0, u1, ym - bar, ym + bar, back + 0.031, P.trim);
  const k = 0.09;
  wallBox(s, w, u0 - k, u0, y0 - k, y1 + k, back, 0.05, P.trim);
  wallBox(s, w, u1, u1 + k, y0 - k, y1 + k, back, 0.05, P.trim);
  wallBox(s, w, u0, u1, y1, y1 + k, back, 0.05, P.trim);
  // The sill stands out of the wall, and snow lies along it.
  wallBox(s, w, u0 - k - 0.04, u1 + k + 0.04, y0 - k - 0.04, y0, back, 0.12, P.trim);
  wallBox(s, w, u0 - k, u1 + k, y0, y0 + 0.05, 0, 0.12, P.snow);
  if (shutter) {
    const sw = (u1 - u0) / 2 + 0.04;
    for (const [a, b] of [
      [u0 - k - sw, u0 - k - 0.01],
      [u1 + k + 0.01, u1 + k + sw],
    ]) {
      wallBox(s, w, a, b, y0 - 0.04, y1 + 0.04, 0.04, 0.09, shutter);
      // The shutter's ledges.
      for (const y of [y0 + 0.12, y1 - 0.12]) {
        front(a + 0.03, b - 0.03, y - 0.035, y + 0.035, 0.1, shutter.clone().multiplyScalar(0.75));
      }
    }
  }
}

/** A PLANK DOOR in its opening: the planks set back in the wall, its
 * ledges, its iron latch and the casing round it. */
export function doorIn(s: Shape, op: Opening): void {
  const { wall: w, u0, u1, y0, y1 } = op;
  const P = CABIN_PAINT;
  const back = -0.06;
  const planks = 4;
  for (let i = 0; i < planks; i++) {
    const a = u0 + ((u1 - u0) * i) / planks;
    const b = u0 + ((u1 - u0) * (i + 1)) / planks;
    s.quad(
      on(w, a, y0, back),
      on(w, b, y0, back),
      on(w, b, y1, back),
      on(w, a, y1, back),
      P.door[i % 2],
      [w.nx, 0, w.nz],
    );
  }
  for (const y of [y0 + 0.3, y1 - 0.35]) {
    wallBox(s, w, u0 + 0.05, u1 - 0.05, y - 0.06, y + 0.06, back, back + 0.04, P.door[1]);
  }
  wallBox(s, w, u1 - 0.2, u1 - 0.12, y0 + 0.95, y0 + 1.05, back, back + 0.08, P.iron);
  const k = 0.1;
  wallBox(s, w, u0 - k, u0, y0, y1 + k, back, 0.05, P.door[1]);
  wallBox(s, w, u1, u1 + k, y0, y1 + k, back, 0.05, P.door[1]);
  wallBox(s, w, u0 - k, u1 + k, y1, y1 + k, back, 0.06, P.door[1]);
}

/** A FACE OF DRESSED STONE on a wall: `u0..u1` × `y0..y1`, laid in courses
 * `course` m high, each stone `stone` m long (running bond, every other
 * course shifted half a stone), each its own tone, standing `o` out. */
export function stoneFace(
  s: Shape,
  w: Wall,
  u0: number,
  u1: number,
  y0: number,
  y1: number,
  o: number,
  course: number,
  stone: number,
  seed: number,
): void {
  const n: V3 = [w.nx, 0, w.nz];
  const rows = Math.max(1, Math.round((y1 - y0) / course));
  let i = seed * 37;
  for (let r = 0; r < rows; r++) {
    const ya = y0 + ((y1 - y0) * r) / rows;
    const yb = y0 + ((y1 - y0) * (r + 1)) / rows;
    let u = u0;
    let first = true;
    while (u < u1 - 1e-6) {
      const len = stone * (first && r % 2 ? 0.5 : 0.75 + jitter(i++) * 0.5);
      first = false;
      const ub = Math.min(u1, u + len);
      const tone = CABIN_PAINT.stone[Math.floor(jitter(i++) * 4) % 4];
      // A stone stands a hair proud of its mortar at random.
      const proud = o + jitter(i++) * 0.02;
      s.quad(
        on(w, u, ya, proud),
        on(w, ub, ya, proud),
        on(w, ub, yb, proud),
        on(w, u, yb, proud),
        tone,
        n,
      );
      u = ub;
    }
  }
}

/** A STACK OF SPLIT FIREWOOD against a wall: `u0..u1` along it, up to
 * `h`, `depth` out of it — its ends showing as rows of sawn faces over a
 * dark backing, a bark top and a cap of snow. */
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
  const n: V3 = [w.nx, 0, w.nz];
  wallBox(s, w, u0, u1, 0, h, o0, o1 - 0.03, P.logLow, P.log[1]);
  const r = 0.11;
  const rows = Math.floor(h / (r * 1.75));
  const cols = Math.floor((u1 - u0) / (r * 2.05));
  let i = Math.floor(u0 * 100 + h * 31);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cu = u0 + r * 1.05 + col * r * 2.05 + (row % 2 ? r * 0.5 : 0);
      if (cu + r > u1) continue;
      const cy = r * 0.95 + row * r * 1.75;
      const rr = r * (0.8 + jitter(i++) * 0.25);
      const tone = jitter(i++) < 0.3 ? P.grain.clone().multiplyScalar(0.85) : P.grain;
      const pts = [0, 1, 2, 3, 4].map((k): V3 => {
        const t = (k / 5) * Math.PI * 2 + jitter(i) * 2;
        return on(w, cu + Math.cos(t) * rr, cy + Math.sin(t) * rr, o1);
      });
      i++;
      for (let k = 1; k < 4; k++) s.tri(pts[0], pts[k], pts[k + 1], tone, n);
    }
  }
  wallBox(s, w, u0 - 0.03, u1 + 0.03, h, h + 0.09, o0, o1 + 0.03, P.snow);
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
    s.quad(E0(r.a0), R0(r.a0), R0(r.a1), E0(r.a1), P.soffit, [-upN[0], -1, -upN[2]]);
    const out = r.at(0, sg, 0);
    const o0 = r.at(0, 0, 0);
    s.quad(E0(r.a0), E0(r.a1), E1(r.a1), E1(r.a0), P.fascia, [out[0] - o0[0], 0, out[2] - o0[2]]);
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
        s.quad(rings[j][k], rings[j + 1][k], rings[j + 1][k + 1], rings[j][k + 1], col, [
          n[0] - o[0],
          under ? -0.6 : 1,
          n[2] - o[2],
        ]);
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
  seed: number,
): void {
  const faces: Wall[] = [
    { x: (x0 + x1) / 2, z: z1, ux: 1, uz: 0, nx: 0, nz: 1 },
    { x: (x0 + x1) / 2, z: z0, ux: -1, uz: 0, nx: 0, nz: -1 },
    { x: x1, z: (z0 + z1) / 2, ux: 0, uz: -1, nx: 1, nz: 0 },
    { x: x0, z: (z0 + z1) / 2, ux: 0, uz: 1, nx: -1, nz: 0 },
  ];
  faces.forEach((f, i) => {
    const half = i < 2 ? (x1 - x0) / 2 : (z1 - z0) / 2;
    stoneFace(s, f, -half, half, y0, y1, 0, 0.3, 0.42, seed + i);
  });
  const k = 0.07;
  box(s, x0 - k, y1, z0 - k, x1 + k, y1 + 0.12, z1 + k, CABIN_PAINT.stone[1]);
  box(
    s,
    x0 - k + 0.02,
    y1 + 0.12,
    z0 - k + 0.02,
    x1 + k - 0.02,
    y1 + 0.26,
    z1 + k - 0.02,
    CABIN_PAINT.snow,
  );
}
