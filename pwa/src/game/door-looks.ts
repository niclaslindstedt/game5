// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOORS AS DRAWN, decided — every kind's LEAF (`door-look`'s row: what
// it is made of, where its face stands off the wall, its sill) and the leaf
// itself BUILT IN THE FACADE KIT'S PAINTED MATERIALS, in its own hinge
// frame: x from the hinge toward the latch (`dir` +1, or −1 for a leaf
// hung on the other jamb), y up from its foot, its outer face at z = 0
// looking out (+z) and its thickness behind it. A plank door's boards and
// ledges, a glazed leaf's frame and glass (lit after dark), a steel leaf,
// a roller door's slats — each with the lever (or a glazed door's pull bar)
// a walker reaches for, on both faces.
//
// The doorway behind a leaf is the building's own (`DOOR_VOID`: a dark
// face set back in the opening where the door was painted), so an open
// door shows a room's darkness rather than the wall. Three-free: the kit's
// arrays are made a geometry by `doors-view.ts`, and the suite reads them.

import { DOOR, type CabinKind } from "@engine";

import { FACADE, type FacadeLayer } from "./facade-paint.ts";
import { FacadeKit, type Tint } from "./facade-kit.ts";

/** What a leaf is drawn as. */
export type LeafStyle = "plank" | "glazed" | "steel" | "roll";

/** A kind's leaf: its `style`, its tint (a steel or a plain leaf's paint),
 * its outer face `face` m out of the wall's outer face (negative: set back
 * in the opening, a log wall's), and its foot `sill` m over the floor. */
export type DoorLook = { style: LeafStyle; tint: Tint; face: number; sill: number };

/** How thick a leaf is, m. */
export const LEAF_THICK = 0.045;

/** The colour of the dark the open doorway shows. */
export const DOOR_VOID: Tint = 0x15110d;

/** Every kind's leaf, measured off the door each kind's builder painted
 * there before (`cabin-shapes.ts`'s holes, `village-build.ts`,
 * `village-town.ts` and `mountain-build.ts`'s insets). */
export const DOOR_LOOKS: Readonly<Record<Exclude<CabinKind, "shed">, DoorLook>> = {
  hut: { style: "plank", tint: 0xffffff, face: -0.02, sill: 0 },
  cabin: { style: "plank", tint: 0xffffff, face: -0.02, sill: 0 },
  chalet: { style: "plank", tint: 0xffffff, face: -0.02, sill: 0 },
  afterski: { style: "plank", tint: 0xffffff, face: -0.02, sill: 0 },
  restaurant: { style: "glazed", tint: 0xffffff, face: 0.055, sill: 0 },
  ticket: { style: "glazed", tint: 0xffffff, face: 0.045, sill: 0 },
  rental: { style: "glazed", tint: 0xffffff, face: 0.055, sill: 0 },
  school: { style: "glazed", tint: 0xffffff, face: 0.045, sill: 0 },
  firstAid: { style: "glazed", tint: 0xffffff, face: 0.045, sill: 0.3 },
  hotel: { style: "glazed", tint: 0xffffff, face: 0.055, sill: 0 },
  garage: { style: "roll", tint: 0xffffff, face: 0.065, sill: 0 },
  pumpHouse: { style: "steel", tint: 0x6c747b, face: 0.055, sill: 0 },
  house: { style: "plank", tint: 0xffffff, face: 0.055, sill: 0.2 },
  apartments: { style: "glazed", tint: 0xffffff, face: 0.055, sill: 0.3 },
  shop: { style: "glazed", tint: 0xffffff, face: 0.055, sill: 0.15 },
  church: { style: "plank", tint: 0xffffff, face: 0.055, sill: 0.4 },
  mountainHut: { style: "glazed", tint: 0xffffff, face: 0.055, sill: 0 },
  patrol: { style: "plank", tint: 0xffffff, face: 0.045, sill: 0 },
};

/** The look of `kind`'s door, or null for a kind with none. */
export function doorLookOf(kind: CabinKind): DoorLook | null {
  return kind === "shed" ? null : DOOR_LOOKS[kind];
}

const FRAME: Tint = 0x7d848a;
const EDGE: Tint = 0x2c2620;
const HANDLE: Tint = 0x9aa0a6;

/** One face of the leaf over x0..x1 × y0..y1 at depth z, looking `out`
 * (+z) or in, its UVs laid once over the layer's tile from `ua` at x0 to
 * `ub` at x1 (and `va`..`vb` up). */
function face(
  kit: FacadeKit,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  out: boolean,
  layer: FacadeLayer,
  tint: Tint,
  ua = 0,
  ub = 1,
  va = 0,
  vb = 1,
): void {
  // Counter-clockwise seen from the side it looks to.
  const flip = x1 > x0 !== out;
  const a: [number, number, number] = [x0, y0, z];
  const b: [number, number, number] = [x1, y0, z];
  const c: [number, number, number] = [x1, y1, z];
  const d: [number, number, number] = [x0, y1, z];
  if (!flip) {
    kit.tri(a, b, c, [ua, va], [ub, va], [ub, vb], layer, tint);
    kit.tri(a, c, d, [ua, va], [ub, vb], [ua, vb], layer, tint);
  } else {
    kit.tri(b, a, d, [ub, va], [ua, va], [ua, vb], layer, tint);
    kit.tri(b, d, c, [ub, va], [ua, vb], [ub, vb], layer, tint);
  }
}

/** A small box x0..x1 × y0..y1 × z0..z1 in `tint`, all six faces. */
function block(
  kit: FacadeKit,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  tint: Tint,
): void {
  const [xa, xb] = x0 < x1 ? [x0, x1] : [x1, x0];
  kit.box(xa, y0, z0, xb, y1, z1, FACADE.plain, tint, { layer: FACADE.plain, tint });
  // The box's bottom, which the kit leaves open.
  kit.quad([xa, y0, z0], [xb, y0, z0], [xb, y0, z1], [xa, y0, z1], FACADE.plain, tint);
}

/**
 * THE LEAF of `look`'s kind, `w` m wide and `h` m tall from its foot, its
 * latch `dir` along x from the hinge (+1 or −1) — the latch side's edge is
 * where its lever is. A glazed leaf takes its `half` of the painted pair
 * (0 the left, 1 the right, each laid hinge to latch).
 */
export function leafArrays(look: DoorLook, w: number, h: number, dir: 1 | -1, half = 0): FacadeKit {
  const kit = new FacadeKit();
  kit.at(0, 0, 0, 0);
  const x0 = 0;
  const x1 = dir * w;
  const t = LEAF_THICK;
  // u runs 0 at the hinge to 1 at the latch on a once-laid door.
  if (look.style === "plank") {
    face(kit, x0, x1, 0, h, 0, true, FACADE.plankDoor, look.tint);
    face(kit, x0, x1, 0, h, -t, false, FACADE.plankDoor, look.tint);
  } else if (look.style === "glazed") {
    // The painted pair's leaf: its left half or its right, the latch
    // toward the middle where the pair meet.
    const [ua, ub] = half === 0 ? [0, 0.5] : [1, 0.5];
    kit.glow = 1;
    face(kit, x0, x1, 0, h, 0, true, FACADE.door, 0xffffff, ua, ub);
    face(kit, x0, x1, 0, h, -t, false, FACADE.door, 0xffffff, ua, ub);
    kit.glow = 0;
  } else if (look.style === "roll") {
    face(kit, x0, x1, 0, h, 0, true, FACADE.shutter, 0xffffff);
    face(kit, x0, x1, 0, h, -t, false, FACADE.shutter, 0xb8bcc0);
  } else {
    face(kit, x0, x1, 0, h, 0, true, FACADE.plain, look.tint);
    face(kit, x0, x1, 0, h, -t, false, FACADE.plain, look.tint);
  }
  // Its edges: the hinge stile, the latch stile, the head and the foot.
  const edge = look.style === "glazed" ? FRAME : look.style === "plank" ? EDGE : look.tint;
  for (const x of [x0, x1]) {
    const out = (x === x1) === dir > 0;
    kit.quad(
      [x, 0, out ? 0 : -t],
      [x, 0, out ? -t : 0],
      [x, h, out ? -t : 0],
      [x, h, out ? 0 : -t],
      FACADE.plain,
      edge,
    );
  }
  const [xa, xb] = dir > 0 ? [x0, x1] : [x1, x0];
  kit.quad([xa, h, 0], [xb, h, 0], [xb, h, -t], [xa, h, -t], FACADE.plain, edge);
  if (look.style === "roll") return kit;
  // THE HANDLE on both faces at the lever's height: a glazed door's pull
  // bar standing off the glass, the others a lever on a rose.
  const y = DOOR.lever.y - look.sill;
  const lx = x1 - dir * DOOR.lever.inset;
  for (const side of [1, -1] as const) {
    const z0 = side > 0 ? 0 : -t;
    const z1 = z0 + side * 0.07;
    const [za, zb] = side > 0 ? [z0, z1] : [z1, z0];
    if (look.style === "glazed") {
      block(
        kit,
        lx - dir * 0.02,
        lx,
        y - 0.4,
        y + 0.4,
        side > 0 ? z1 - 0.025 : za,
        side > 0 ? zb : za + 0.025,
        HANDLE,
      );
      for (const k of [-0.32, 0.32])
        block(kit, lx - dir * 0.02, lx, y + k - 0.015, y + k + 0.015, za, zb, HANDLE);
      continue;
    }
    // The rose, then the lever running back toward the hinge.
    block(
      kit,
      lx - 0.025,
      lx + 0.025,
      y - 0.06,
      y + 0.06,
      side > 0 ? z0 : z0 - 0.012,
      side > 0 ? z0 + 0.012 : z0,
      HANDLE,
    );
    const zl = side > 0 ? [z0 + 0.045, z0 + 0.065] : [z0 - 0.065, z0 - 0.045];
    block(kit, lx, lx - dir * 0.13, y - 0.012, y + 0.012, zl[0], zl[1], HANDLE);
    block(
      kit,
      lx - 0.01,
      lx + 0.01,
      y - 0.01,
      y + 0.01,
      side > 0 ? z0 : zl[1],
      side > 0 ? zl[0] : z0,
      HANDLE,
    );
  }
  return kit;
}

/** How far open a leaf stands as drawn: the angle it is swung, rad, or a
 * roller door's lift, m — off the engine's share of its opening. */
export function leafPose(style: LeafStyle, share: number, height: number): number {
  return style === "roll" ? share * DOOR.leaf.roll * height : share * DOOR.leaf.open;
}
