// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFTS' HARDWARE AS BUILT — every part of a lift that is steel,
// rubber, cushion or glass rather than a building, faceted and coloured
// per vertex, each a geometry `lifts.ts` instances once for the whole
// resort (`docs/lifts.md` says what each real part is and its measure):
//
//   * THE TOWER: a round tapered steel column, a ladder up its downhill
//     face on stand-off brackets, and at its head a box-girder crossarm
//     with a SHEAVE TRAIN on each end — a row of rubber-lined wheels on a
//     balanced beam the rope rides over, cantilevered so a passing grip
//     clears it — a catwalk with its railing along the crossarm, a
//     lifting frame over it, a lightning rod and the tower's number plate;
//     a drag's single arm with its one short train.
//   * THE CHAIR (a detachable quad): the grip and its carriage on the
//     rope, the hanger curving down behind the back, the seat frame, four
//     padded seat cushions and four backrests, the armrests, and the
//     safety bar lowered with its footrest.
//   * THE CABIN (an eight-seat monocable cabin): the grip, the hanger to a
//     roof frame, a body rounded at its corners and its roof, the window
//     band round it with the corner pillars and mullions, the door's seams
//     on the platform side and the ski racks on its ends.
//   * THE T-BAR: the grip and the spring box (the reel the cord is wound
//     on), and the bar with its padded arms on its stem.
//   * THE BULLWHEEL: a spoked wheel with its lined rim.
//
// Each in its own frame: +z the way a carrier travels (and a tower's
// line), +x right, y up — a carrier's grip and a tower's rope at y = 0.

import * as THREE from "three";

/** The paints, sRGB. */
export const LIFT_PAINT = {
  /** Galvanised steel: the columns, crossarms and hangers. */
  galv: 0xa3abb2,
  /** Painted dark steel: the grips, the frames, the trains' beams. */
  dark: 0x33383e,
  /** The sheaves' rubber liners. */
  rubber: 0x141618,
  /** The sheaves' and wheels' machined hubs. */
  hub: 0x7d858c,
  /** A chair's cushions and a cabin's body. */
  seat: 0x1f4f8f,
  cushion: 0x24569b,
  cabin: 0xb5262c,
  /** A cabin's roof and skirt. */
  roof: 0xe6e9ec,
  skirt: 0x3a3f45,
  glass: 0x34495c,
  /** A cabin's glass where it catches the sky. */
  sky: 0x6f8aa3,
  /** The catwalk's grating, the number plate, the spring box. */
  grate: 0x5b6168,
  plate: 0xf1efe8,
  spring: 0xc9a227,
} as const;
const P = LIFT_PAINT;

type V = THREE.Vector3;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A faceted shape built triangle by triangle, every face flat and in its
 * own colour — ONE geometry for one draw. */
export class Shape {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private c = new THREE.Color();

  /** A triangle facing `out` (it is turned round if it does not). */
  tri(a: V, b: V, c: V, colour: number, out?: V): void {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-14) return;
    n.normalize();
    if (out && n.dot(out) < 0) {
      [b, c] = [c, b];
      n.negate();
    }
    this.c.set(colour);
    for (const p of [a, b, c]) {
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n.x, n.y, n.z);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }

  quad(a: V, b: V, c: V, d: V, colour: number, out?: V): void {
    this.tri(a, b, c, colour, out);
    this.tri(a, c, d, colour, out);
  }

  /** A three.js geometry laid in by `m`, in one colour. */
  geo(g: THREE.BufferGeometry, colour: number, m?: THREE.Matrix4): this {
    const flat = g.index ? g.toNonIndexed() : g;
    if (m) flat.applyMatrix4(m);
    flat.computeVertexNormals();
    const p = flat.getAttribute("position");
    const n = flat.getAttribute("normal");
    this.c.set(colour);
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
    if (flat !== g) flat.dispose();
    g.dispose();
    return this;
  }

  /** A box `w × h × d` centred at (x, y, z), turned `pitch` about x. */
  box(w: number, h: number, d: number, x: number, y: number, z: number, colour: number, pitch = 0) {
    const m = new THREE.Matrix4().makeRotationX(pitch).setPosition(x, y, z);
    return this.geo(new THREE.BoxGeometry(w, h, d), colour, m);
  }

  /** A CUSHION: a box whose top is drawn in by `round` all round, so it
   * reads padded — `w × h × d` centred at (x, y, z), turned `pitch`
   * about x (a backrest's lean). */
  pad(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    colour: number,
    round: number,
    pitch = 0,
  ) {
    const m = new THREE.Matrix4().makeRotationX(pitch).setPosition(x, y, z);
    const g = new THREE.BoxGeometry(w, h, d);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) {
        p.setX(i, p.getX(i) - Math.sign(p.getX(i)) * round);
        p.setZ(i, p.getZ(i) - Math.sign(p.getZ(i)) * round);
      }
    }
    return this.geo(g, colour, m);
  }

  /** A round bar `r` thick through the points, `sides` round. */
  tube(points: readonly V[], r: number, colour: number, sides = 6): this {
    const up = v3(0, 1, 0);
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      if (len < 1e-6) continue;
      // Each length run on past its joint by its radius, so a bend is shut.
      const ends = (i > 0 ? r : 0) + (i + 2 < points.length ? r : 0);
      const g = new THREE.CylinderGeometry(r, r, len + ends, sides, 1, true);
      g.translate(0, ((i + 2 < points.length ? r : 0) - (i > 0 ? r : 0)) / 2, 0);
      const m = new THREE.Matrix4().compose(
        a.clone().add(b).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()),
        v3(1, 1, 1),
      );
      this.geo(g, colour, m);
    }
    return this;
  }

  /** A wheel turning about x at (x, y, z): its rubber liner round the
   * rim and its hub's faces inside it. */
  wheel(r: number, width: number, x: number, y: number, z: number, sides = 8): this {
    const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(x, y, z);
    this.geo(new THREE.CylinderGeometry(r, r, width, sides), P.rubber, m);
    return this.geo(new THREE.CylinderGeometry(r * 0.58, r * 0.58, width * 1.15, sides), P.hub, m);
  }

  /** A body lofted through RINGS — a rectangle `hw` across and `hl` along
   * with its corners cut by `cut` — at height `y`, each band between two
   * rings coloured by `colourOf(band, face)` (face 0 the +x flat, then on
   * round: the even faces flats, the odd ones the cut corners), the top
   * and the bottom shut. */
  loft(
    rings: readonly { y: number; hw: number; hl: number; cut: number }[],
    colourOf: (band: number, face: number) => number,
    top: number,
    bottom: number,
  ): this {
    const ring = (r: { y: number; hw: number; hl: number; cut: number }): V[] => {
      const { y, hw, hl, cut } = r;
      return [
        v3(hw, y, -hl + cut),
        v3(hw, y, hl - cut),
        v3(hw - cut, y, hl),
        v3(-hw + cut, y, hl),
        v3(-hw, y, hl - cut),
        v3(-hw, y, -hl + cut),
        v3(-hw + cut, y, -hl),
        v3(hw - cut, y, -hl),
      ];
    };
    const all = rings.map(ring);
    for (let b = 0; b + 1 < all.length; b++) {
      const lo = all[b];
      const hi = all[b + 1];
      for (let f = 0; f < 8; f++) {
        const g = (f + 1) % 8;
        const mid = lo[f].clone().add(lo[g]).add(hi[f]).add(hi[g]).multiplyScalar(0.25);
        this.quad(lo[f], lo[g], hi[g], hi[f], colourOf(b, f), v3(mid.x, 0, mid.z));
      }
    }
    const cap = (pts: V[], colour: number, out: V) => {
      for (let i = 1; i + 1 < pts.length; i++) this.tri(pts[0], pts[i], pts[i + 1], colour, out);
    };
    cap(all[all.length - 1], top, v3(0, 1, 0));
    cap(all[0], bottom, v3(0, -1, 0));
    return this;
  }

  geometry(): THREE.BufferGeometry {
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    out.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    return out;
  }
}

/** A TOWER'S COLUMN: a round steel tube, `sides` facets round, of radius 1
 * at its foot tapered to `taper` at its head, 1 tall from its foot — the
 * instance scales it to the plan's girth and height. */
export function columnGeometry(taper: number, sides = 12): THREE.BufferGeometry {
  const s = new Shape();
  const g = new THREE.CylinderGeometry(taper, 1, 1, sides, 1, true);
  g.translate(0, 0.5, 0);
  s.geo(g, 0xffffff);
  return s.geometry();
}

/** A tower's LADDER, `length` m of it down from its top at y = 0 (the
 * snow hides what is under it): two rails 0.42 m apart and a rung every
 * 0.3 m, its face toward −z. */
export function ladderGeometry(length = 30): THREE.BufferGeometry {
  const s = new Shape();
  s.box(0.05, length, 0.05, -0.21, -length / 2, 0, P.galv);
  s.box(0.05, length, 0.05, 0.21, -length / 2, 0, P.galv);
  for (let y = -0.3; y > -length; y -= 0.3) {
    // A rung as its front and its top: all of it an eye ever sees.
    s.quad(
      v3(-0.2, y - 0.02, -0.015),
      v3(0.2, y - 0.02, -0.015),
      v3(0.2, y + 0.02, -0.015),
      v3(-0.2, y + 0.02, -0.015),
      P.galv,
      v3(0, 0, -1),
    );
    s.quad(
      v3(-0.2, y + 0.02, -0.015),
      v3(0.2, y + 0.02, -0.015),
      v3(0.2, y + 0.02, 0.015),
      v3(-0.2, y + 0.02, 0.015),
      P.galv,
      v3(0, 1, 0),
    );
  }
  return s.geometry();
}

/** The kinds of tower a head is built for. */
export type HeadKind = "chair" | "gondola" | "drag";

/** A SHEAVE TRAIN on the rope at `x`: `n` wheels `r` in radius in a row
 * under it, the rope in their grooves at y = 0, on bogies of two
 * balanced on a main beam, all on the train's INBOARD side (toward the
 * tower, `inward` ±1) so a grip passing over the wheels clears it. */
function train(s: Shape, x: number, n: number, r: number, inward: number): number {
  const pitch = 2 * r + 0.09;
  const y = -r - 0.03;
  const length = n * pitch;
  for (let i = 0; i < n; i++) s.wheel(r, 0.1, x, y, (i - (n - 1) / 2) * pitch);
  const plate = x + inward * 0.09;
  for (let i = 0; i + 1 < n; i += 2) {
    const z = (i + 0.5 - (n - 1) / 2) * pitch;
    s.box(0.04, 0.17, pitch * 1.7, plate, y, z, P.dark);
    s.box(0.05, 0.22, 0.07, plate + inward * 0.03, y - 0.18, z, P.dark);
  }
  const beam = y - 0.32;
  s.box(0.12, 0.16, length * 0.82, x + inward * 0.12, beam, 0, P.dark);
  return beam;
}

/** A TOWER'S HEAD in its own frame — the rope at y = 0, x across the line,
 * z up it — over a column of half-width `column` at its foot, tapered to
 * `taper` of it: the crossarm and the sheave trains for a chair or a
 * gondola (`gauge` m between the ropes), a drag's single arm out to its
 * rope at `arm`. The column's head is 0.9 m under the rope. */
export function towerHeadGeometry(
  kind: HeadKind,
  gauge: number,
  column: number,
  taper: number,
  dragArm: number,
): THREE.BufferGeometry {
  const s = new Shape();
  const head = column * taper;
  if (kind === "drag") {
    const arm = dragArm;
    const beam = train(s, arm, 4, 0.15, -1);
    s.tube([v3(0, -1.0, 0), v3(0, beam - 0.1, 0)], head * 0.8, P.galv, 8);
    s.box(arm + 0.2, 0.16, 0.16, arm / 2 + 0.02, beam - 0.12, 0, P.galv);
    s.tube([v3(0, -1.55, 0), v3(arm * 0.75, beam - 0.18, 0)], 0.04, P.galv);
    s.box(0.12, 0.3, 0.12, arm, beam - 0.02, 0, P.dark);
    s.tube([v3(0, beam - 0.1, 0), v3(0, 0.9, 0)], 0.018, P.galv, 4);
    s.box(0.3, 0.22, 0.02, 0, -1.6, head + 0.03, P.plate);
    return s.geometry();
  }
  const g = gauge / 2;
  const gondola = kind === "gondola";
  const n = gondola ? 8 : 6;
  const r = gondola ? 0.24 : 0.2;
  let beam = 0;
  for (const side of [-1, 1]) beam = train(s, side * g, n, r, -side);
  // THE CROSSARM: a box girder across, on the column's head, and a
  // bracket up from each end to its train's beam.
  const arm = -0.95;
  const reach = g - 0.2;
  s.box(2 * reach, 0.42, 0.42, 0, arm, 0, P.galv);
  s.box(head * 2.3, 0.6, 0.62, 0, arm - 0.12, 0, P.galv);
  for (const side of [-1, 1]) {
    s.box(0.16, beam - arm, 0.32, side * (reach - 0.08), (beam + arm) / 2, 0, P.galv);
    s.box(0.24, 0.08, 0.4, side * (reach - 0.08), beam - 0.06, 0, P.dark);
  }
  // THE CATWALK on its downhill side: a grating along the crossarm on
  // struts off the column, a railing at its edge and its ends.
  const walk = arm - 0.24;
  const out = -0.95;
  s.box(2 * reach - 0.2, 0.05, 0.75, 0, walk, -0.58, P.grate);
  for (const side of [-1, 1]) {
    s.tube(
      [
        v3(side * head * 0.7, arm - 1.6, -head * 0.7),
        v3(side * (reach - 0.5), walk - 0.04, out + 0.1),
      ],
      0.035,
      P.galv,
      4,
    );
  }
  const posts = Math.max(2, Math.round((2 * reach - 0.2) / 0.9));
  for (let i = 0; i <= posts; i++) {
    const x = -reach + 0.1 + ((2 * reach - 0.2) * i) / posts;
    s.box(0.04, 1.05, 0.04, x, walk + 0.53, out, P.galv);
  }
  s.box(2 * reach - 0.2, 0.045, 0.045, 0, walk + 1.05, out, P.galv);
  s.box(2 * reach - 0.2, 0.035, 0.035, 0, walk + 0.55, out, P.galv);
  for (const side of [-1, 1]) {
    const x = side * (reach - 0.1);
    s.box(0.04, 1.05, 0.04, x, walk + 0.53, -0.22, P.galv);
    s.box(0.045, 0.045, 0.75, x, walk + 1.05, -0.58, P.galv);
  }
  // THE LIFTING FRAMES: an L over each train, a hook block under its end.
  for (const side of [-1, 1]) {
    const x0 = side * (g - 0.5);
    const x1 = side * (g + 0.08);
    s.tube([v3(x0, arm + 0.2, 0), v3(x0, 1.1, 0), v3(x1, 1.1, 0)], 0.07, P.galv, 6);
    s.tube([v3(x0, 0.45, 0), v3(side * (g - 0.15), 1.1, 0)], 0.035, P.galv, 4);
    s.box(0.14, 0.22, 0.14, x1, 0.92, 0, P.dark);
  }
  // A lightning rod over the column, and the tower's number on its
  // uphill face.
  s.tube([v3(0, arm + 0.2, 0), v3(0, 1.9, 0)], 0.02, P.galv, 4);
  s.box(0.5, 0.36, 0.03, 0, arm - 0.9, head + 0.05, P.plate);
  return s.geometry();
}

/** A TOWER'S HEAD AT RANGE: the crossarm, each train as a dark beam with
 * its lifting frame over it, the catwalk's slab; a drag's arm and its
 * train. */
export function towerHeadFarGeometry(
  kind: HeadKind,
  gauge: number,
  column: number,
  taper: number,
  dragArm: number,
): THREE.BufferGeometry {
  const s = new Shape();
  const head = column * taper;
  if (kind === "drag") {
    s.box(0.2, 0.9, 0.2, 0, -0.75, 0, P.galv);
    s.box(dragArm + 0.2, 0.16, 0.16, dragArm / 2, -0.6, 0, P.galv);
    s.box(0.14, 0.32, 0.8, dragArm, -0.22, 0, P.dark);
    return s.geometry();
  }
  const g = gauge / 2;
  const n = kind === "gondola" ? 8 : 6;
  const r = kind === "gondola" ? 0.24 : 0.2;
  const length = n * (2 * r + 0.09);
  s.box(2 * (g - 0.2), 0.42, 0.42, 0, -0.95, 0, P.galv);
  s.box(head * 2.3, 0.6, 0.62, 0, -1.07, 0, P.galv);
  s.box(2 * (g - 0.2) - 0.2, 0.05, 0.75, 0, -1.19, -0.58, P.grate);
  for (const side of [-1, 1]) {
    s.box(0.16, 2 * r + 0.1, length, side * g, -r - 0.05, 0, P.rubber);
    s.box(0.14, 0.5, 0.3, side * (g - 0.28), -0.75, 0, P.galv);
    s.box(0.12, 1.9, 0.12, side * (g - 0.5), 0.15, 0, P.galv);
    s.box(0.6, 0.12, 0.12, side * (g - 0.21), 1.1, 0, P.galv);
  }
  return s.geometry();
}
