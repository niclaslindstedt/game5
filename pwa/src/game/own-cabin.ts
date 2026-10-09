// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER'S OWN GONDOLA CABIN — the one that comes round the bottom
// wheel to him on the platform, opens its doors, takes his skis on its
// rack and him on its back bench, shuts and carries him up the line
// (`lift-board.ts`, `lift-ride.ts`). Drawn apart from the clock's cabins
// (`lifts.ts`) but built to the same loft, band for band: its body open on
// its right side for the door, two door leaves that slide apart along its
// flank, the glass on its own clear material so he is seen inside, and a
// lining, a ceiling, a floor and benches for when the lens is in it. His
// skis are the engine's own pair, stood in the back leaf's rack
// (`lift-skis.ts`).
//
// Its frame is the grip's: +z the way it travels, +x its right — the
// platform's side — and y down from the grip to its floor.

import * as THREE from "three";
import { CABIN_HALF, CABIN_Y, cabinHanger } from "./lift-carriers.ts";
import { LIFT_PAINT as P, Shape } from "./lift-shapes.ts";

/** The cabin's paints, sRGB: its bench. */
export type CabinPaint = { seat: number };

/** The door: half its opening's width along the flank, m; where its leaves
 * stand across the cabin shut, and how far further out they slide open, m
 * — the engine's rack rides the back one (`lift-skis.ts`'s `RACK`). */
const DOOR = { half: 0.5, flank: 0.96, out: 0.04 };

/** Inside: the walls' lining and the floor's rubber, sRGB. */
const LINING = 0xd9d6cf;
const FLOOR = 0x2b2f34;

export type OwnCabin = {
  group: THREE.Group;
  /** How open its doors are, 0 shut … 1 open. */
  set(open: number): void;
};

/** The clock's cabin's rings (`lift-carriers.ts`'s `cabinGeometry`), drawn
 * in by `inset` more all round for the lining inside it. */
function rings(inset = 0) {
  const Y = CABIN_Y;
  const { w, l } = CABIN_HALF;
  const ring = (y: number, i: number, cut: number) => ({
    y,
    hw: w - i - inset,
    hl: l - i - inset,
    cut,
  });
  return [
    ring(Y.floor, 0.15, 0.3),
    ring(Y.skirt, 0.02, 0.36),
    ring(Y.belt, 0, 0.38),
    ring(Y.glassFoot, 0, 0.38),
    ring((Y.glassFoot + Y.glassTop) / 2 + 0.1, 0.01, 0.375),
    ring(Y.glassTop, 0.03, 0.37),
    ring(Y.eave, 0.06, 0.36),
    ring(Y.crown, 0.3, 0.28),
  ];
}

/** Bands 1–4 (the skirt up to the glass's top) of the right flank are the
 * door's opening; bands 3–4's flats the glass. */
const opening = (band: number, face: number) => face === 0 && band >= 1 && band <= 4;
const glazed = (band: number, face: number) => (band === 3 || band === 4) && face % 2 === 0;

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
  const Y = CABIN_Y;
  const { w, l } = CABIN_HALF;
  const glassY = (Y.glassTop + Y.glassFoot) / 2;
  const glassH = Y.glassTop - Y.glassFoot;
  const lowY = (Y.glassFoot + Y.skirt) / 2;
  const lowH = Y.glassFoot - Y.skirt;

  // THE SHELL: the clock's cabin lofted band for band, its door's
  // opening and its glass left out.
  const s = new Shape();
  cabinHanger(s);
  s.loft(
    rings(),
    (band, face) =>
      opening(band, face) || glazed(band, face)
        ? -1
        : band === 0
          ? P.skirt
          : band === 2 || band >= 5
            ? P.roof
            : P.cabin,
    P.roof,
    P.skirt,
  );
  // The wall either side of the opening, set in behind the leaves.
  const stub = l - 0.38 - DOOR.half;
  for (const sz of [-1, 1]) {
    const z = sz * (DOOR.half + stub / 2);
    s.box(0.03, Y.belt - Y.skirt, stub, w - 0.05, (Y.belt + Y.skirt) / 2, z, P.cabin);
    s.box(0.03, Y.glassFoot - Y.belt, stub, w - 0.05, (Y.glassFoot + Y.belt) / 2, z, P.roof);
    s.box(0.04, glassH, 0.05, w - 0.05, glassY, sz * (DOOR.half + 0.02), P.cabin);
  }
  // The mullions: up the middle of the left flank and of each end.
  s.box(0.06, glassH, 0.08, -w - 0.005, glassY, 0, P.cabin);
  for (const z of [-l, l]) s.box(0.08, glassH, 0.06, 0, glassY, z + Math.sign(z) * 0.005, P.cabin);
  // The leaves' rails over and under the opening.
  s.box(0.04, 0.05, 1.3, w + 0.02, Y.glassTop + 0.03, 0, P.skirt);
  s.box(0.04, 0.05, 1.1, w + 0.02, Y.skirt + 0.04, 0, P.skirt);
  // THE SKI RACKS on the ends: a tray at the skirt, a rail at the belt.
  for (const z of [-l - 0.06, l + 0.06]) {
    s.box(1.15, 0.05, 0.14, 0, Y.skirt + 0.06, z, P.dark);
    s.box(1.15, 0.05, 0.05, 0, Y.belt - 0.1, z, P.dark);
    for (const x of [-0.55, -0.18, 0.18, 0.55])
      s.box(0.04, 0.72, 0.04, x, Y.skirt + 0.38, z, P.dark);
  }
  // INSIDE: the lining off the skirt to the eave, the ceiling under it and
  // the floor, seen from in the cabin; the benches along both ends, each a
  // seat on a box with a back up to the glass and a grab rail over it.
  s.loft(
    rings(0.04).slice(1, 7),
    (band, face) => (opening(band + 1, face) || glazed(band + 1, face) ? -1 : LINING),
    LINING,
    FLOOR,
    true,
  );
  for (const sz of [-1, 1]) {
    const back = sz * (l - 0.12);
    s.box(1.7, 0.08, 0.46, 0, benchTop - 0.04, sz * 0.8, paint.seat);
    s.box(
      1.7,
      benchTop - 0.08 - Y.skirt,
      0.4,
      0,
      (benchTop - 0.08 + Y.skirt) / 2,
      sz * 0.82,
      P.skirt,
    );
    s.box(
      1.7,
      Y.glassFoot - benchTop + 0.1,
      0.06,
      0,
      (Y.glassFoot + benchTop) / 2,
      back,
      paint.seat,
    );
    s.box(1.5, 0.035, 0.035, 0, Y.glassTop - 0.12, sz * (l - 0.2), P.galv);
  }
  const body = new THREE.Mesh(keep(s.geometry()), painted);
  body.castShadow = true;

  // THE GLASS: the shell's flats in bands 3–4 but the opening, and the
  // panes either side of it.
  const g = new Shape();
  g.loft(rings(), (band, face) => (glazed(band, face) && !opening(band, face) ? 0 : -1), -1, -1);
  for (const sz of [-1, 1]) {
    g.box(0.02, glassH, stub - 0.04, w - 0.05, glassY, sz * (DOOR.half + stub / 2 + 0.02), 0);
  }
  const panes = new THREE.Mesh(keep(g.geometry()), glass);
  panes.renderOrder = 1;

  // THE DOOR'S TWO LEAVES sliding apart along the flank, each a panel to
  // the belt, the belt's white band, a framed pane and a handle; the
  // engine stands his skis in the rack on the back one.
  const leaf = new Shape();
  const half = DOOR.half;
  leaf.box(0.04, Y.belt - Y.skirt, half, 0, (Y.belt + Y.skirt) / 2, 0, P.cabin);
  leaf.box(0.04, Y.glassFoot - Y.belt, half, 0, (Y.glassFoot + Y.belt) / 2, 0, P.roof);
  leaf.box(0.045, 0.04, half, 0, Y.glassTop - 0.02, 0, P.cabin);
  for (const z of [-1, 1])
    leaf.box(0.045, glassH, 0.04, 0, glassY, (z * (half - 0.04)) / 2, P.cabin);
  leaf.box(0.05, 0.22, 0.03, 0.03, lowY + lowH * 0.2, 0, P.galv);
  leaf.box(0.06, 0.05, half - 0.08, 0.06, -3.4, 0, P.dark);
  leaf.box(0.12, 0.04, half - 0.08, 0.08, Y.skirt + 0.1, 0, P.dark);
  const leafGeo = keep(leaf.geometry());
  const leafPane = new Shape();
  leafPane.box(0.02, glassH - 0.04, half - 0.08, 0, glassY, 0, 0);
  const leafPaneGeo = keep(leafPane.geometry());
  const leaves = [-1, 1].map((side) => {
    const group = new THREE.Group();
    const panel = new THREE.Mesh(leafGeo, painted);
    panel.castShadow = true;
    const pane = new THREE.Mesh(leafPaneGeo, glass);
    pane.renderOrder = 1;
    group.add(panel, pane);
    return { group, side };
  });
  const group = new THREE.Group();
  group.add(body, panes, ...leaves.map((x) => x.group));
  group.visible = false;

  const set = (open: number): void => {
    const k = Math.max(0, Math.min(1, open));
    for (const { group: lf, side } of leaves) {
      lf.position.set(DOOR.flank + DOOR.out * k, 0, side * (half / 2 + half * k));
    }
  };
  set(0);
  return { group, set };
}
