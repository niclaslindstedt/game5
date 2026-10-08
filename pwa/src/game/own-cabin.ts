// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER'S OWN GONDOLA CABIN — the one that comes round the bottom
// wheel to him on the platform, opens its doors, takes his skis on its
// rack and him on its back bench, shuts and carries him up the line
// (`lift-board.ts`, `lift-ride.ts`). Drawn apart from the clock's cabins
// (`lifts.ts`): its body open on its right side for the door, two door
// leaves that slide apart along its flank, the glass in panes, and his
// skis stood in the rack on the back leaf once he has racked them.
//
// Its frame is the grip's: +z the way it travels, +x its right — the
// platform's side — and y down from the grip to its floor.

import * as THREE from "three";
import { box, merged } from "./station-parts.ts";
import { CABIN_HALF, CABIN_Y, cabinHanger } from "./lift-carriers.ts";
import { LIFT_PAINT, Shape } from "./lift-shapes.ts";

/** The cabin's paints, sRGB: its body, the dark steel of the grip and the
 * hanger, its bench and the skis in its rack. */
export type CabinPaint = { cabin: number; dark: number; seat: number; skis: number };

/** The door: half its opening's width along the flank, m, and how far
 * out of the flank its leaves slide, m. */
const DOOR = { half: 0.5, out: 0.04 };

/** How far down from the grip: the glass band's middle and the body's
 * middle, the floor, m — the clock's cabins' (`lift-carriers.ts`). */
const Y = { glass: -2.75, body: -3.7, floor: -4.175 };

export type OwnCabin = {
  group: THREE.Group;
  /** How open its doors are, 0 shut … 1 open, and whether his skis stand
   * in its rack. */
  set(open: number, racked: boolean): void;
};

export function createOwnCabin(
  painted: THREE.Material,
  glass: THREE.Material,
  paint: CabinPaint,
  benchTop: number,
  geos: THREE.BufferGeometry[],
): OwnCabin {
  const keep = <G extends THREE.BufferGeometry>(g: G): G => {
    geos.push(g);
    return g;
  };
  const stub = 1.06 - DOOR.half;
  const stubZ = DOOR.half + stub / 2;
  const posts = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => box(0.07, 0.85, 0.07, sx * 0.94, Y.glass, sz * 1.04, paint.cabin)),
  );
  const body = new THREE.Mesh(
    keep(
      merged([
        ...posts,
        // The door's posts.
        box(0.07, 0.85, 0.07, 0.94, Y.glass, -DOOR.half, paint.cabin),
        box(0.07, 0.85, 0.07, 0.94, Y.glass, DOOR.half, paint.cabin),
        // The floor, the left wall, the ends and the stubs either side of
        // the door.
        box(1.92, 0.1, 2.12, 0, Y.floor, 0, paint.cabin),
        box(0.06, 1.05, 2.12, -0.93, Y.body, 0, paint.cabin),
        box(1.92, 1.05, 0.06, 0, Y.body, -1.03, paint.cabin),
        box(1.92, 1.05, 0.06, 0, Y.body, 1.03, paint.cabin),
        box(0.06, 1.05, stub, 0.93, Y.body, -stubZ, paint.cabin),
        box(0.06, 1.05, stub, 0.93, Y.body, stubZ, paint.cabin),
        // The benches along both ends.
        box(1.8, 0.08, 0.5, 0, benchTop - 0.04, -0.78, paint.seat),
        box(1.8, 0.08, 0.5, 0, benchTop - 0.04, 0.78, paint.seat),
        box(1.8, 0.4, 0.06, 0, benchTop - 0.24, -0.53, paint.seat),
        box(1.8, 0.4, 0.06, 0, benchTop - 0.24, 0.53, paint.seat),
      ]),
    ),
    painted,
  );
  body.castShadow = true;
  // The grip, the hanger and the rounded roof and skirt the clock's
  // cabins have (`lift-carriers.ts`).
  const shell = new Shape();
  cabinHanger(shell);
  const { w, l } = CABIN_HALF;
  const C = CABIN_Y;
  const ring = (y: number, inset: number, cut: number) => ({
    y,
    hw: w - inset,
    hl: l - inset,
    cut,
  });
  shell.loft(
    [ring(C.glassTop, 0.03, 0.37), ring(C.eave, 0.06, 0.36), ring(C.crown, 0.3, 0.28)],
    () => LIFT_PAINT.roof,
    LIFT_PAINT.roof,
    LIFT_PAINT.roof,
  );
  const top = new THREE.Mesh(keep(shell.geometry()), painted);
  top.castShadow = true;
  const panes = new THREE.Mesh(
    keep(
      merged([
        box(0.02, 0.85, 2.1, -0.94, Y.glass, 0, 0),
        box(1.9, 0.85, 0.02, 0, Y.glass, -1.04, 0),
        box(1.9, 0.85, 0.02, 0, Y.glass, 1.04, 0),
        box(0.02, 0.85, stub, 0.94, Y.glass, -stubZ, 0),
        box(0.02, 0.85, stub, 0.94, Y.glass, stubZ, 0),
      ]),
    ),
    glass,
  );
  panes.renderOrder = 1;
  // THE DOOR'S TWO LEAVES: a painted panel under a pane, sliding apart
  // along the flank; the rack and the skis in it on the back one.
  const leafBody = keep(
    merged([
      box(0.04, 1.05, DOOR.half, 0, Y.body, 0, paint.cabin),
      box(0.05, 0.06, DOOR.half, 0, Y.glass - 0.42, 0, paint.cabin),
    ]),
  );
  const leafPane = keep(merged([box(0.02, 0.8, DOOR.half - 0.04, 0, Y.glass, 0, 0)]));
  const rack = keep(merged([box(0.06, 0.06, DOOR.half - 0.06, 0.05, -3.4, 0, paint.dark)]));
  const skis = keep(
    merged([
      box(0.03, 1.75, 0.09, 0.08, -3.25, -0.08, paint.skis),
      box(0.03, 1.75, 0.09, 0.12, -3.25, 0.06, paint.skis),
    ]),
  );
  const leaves = [-1, 1].map((side) => {
    const leaf = new THREE.Group();
    const panel = new THREE.Mesh(leafBody, painted);
    panel.castShadow = true;
    const pane = new THREE.Mesh(leafPane, glass);
    pane.renderOrder = 1;
    leaf.add(panel, pane);
    return { leaf, side };
  });
  const back = leaves[0].leaf;
  back.add(new THREE.Mesh(rack, painted));
  const stood = new THREE.Mesh(skis, painted);
  stood.castShadow = true;
  back.add(stood);
  const group = new THREE.Group();
  group.add(body, top, panes, ...leaves.map((l) => l.leaf));
  group.visible = false;

  const set = (open: number, racked: boolean): void => {
    const k = Math.max(0, Math.min(1, open));
    for (const { leaf, side } of leaves) {
      leaf.position.set(0.96 + DOOR.out * k, 0, side * (DOOR.half / 2 + DOOR.half * k));
    }
    stood.visible = racked;
  };
  set(0, true);
  return { group, set };
}
