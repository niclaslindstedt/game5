// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIRSTRIP'S BUILDINGS on the facade kit (`facade-kit.ts`), on the
// footprints the engine placed them on (`airstrip-site.ts`'s `buildings`,
// which the skier meets as solids — `airstrip-solids.ts`), each built as a
// small mountain strip builds them:
//   * THE HANGAR — a steel-framed shed clad in ribbed steel sheet on a
//     concrete footing, a low gable over its front, and across that front
//     the SLIDING DOORS, four clad leaves on a track wider than the plane's
//     wing, one slid a little behind its neighbour; a header over them with
//     the operator's band of colour, two lamps over the door that light the
//     apron after dark, a man door and a row of small windows down its
//     side;
//   * THE LEAN-TO in its place where no hangar fits: a timber-framed open
//     shed under a mono roof, its back and ends boarded;
//   * THE FUEL SHED — a roof of steel sheet on posts over a pallet of
//     200-litre drums, its back boarded, a hand pump on the nearest drum
//     and the red extinguisher beside them;
//   * THE HUT — the manifest and the packing room: boards on a footing, a
//     gable roof under snow, a door to the apron, a window lit after dark,
//     a bench along its front and the stove's pipe through the roof.
// Three-free: what the kit fills is made one mesh by `strip-view.ts`.

import type { StripBuilding } from "@engine";

import { FacadeKit } from "./facade-kit.ts";
import { FACADE } from "./facade-paint.ts";

/** The tints: the hangar's sheet and its doors, the operator's band, the
 * boards, the trim, the drums. */
const T = {
  sheet: 0x8d989d,
  door: 0xb9c2c6,
  band: 0xc4502c,
  boards: 0xd9b48a,
  trim: 0x7a5c40,
  steel: 0x8a9096,
  dark: 0x3c4146,
  footing: 0xd0ccc4,
} as const;
const ROOF = { layer: FACADE.roof, tint: 0x6f777c } as const;
const BOARDS = { layer: FACADE.boards, tint: T.boards } as const;
const FASCIA = { layer: FACADE.boards, tint: T.trim } as const;
const SHEET = { layer: FACADE.cladding, tint: T.sheet } as const;
const SNOW = 0.32;

/** Every building beside the strip into `kit`. */
export function buildStrip(kit: FacadeKit, buildings: readonly StripBuilding[]): void {
  for (const b of buildings) {
    kit.at(b.x, b.floor, b.z, b.heading);
    const base = b.base - b.floor - 0.35;
    if (b.kind === "hangar") hangar(kit, b, base);
    else if (b.kind === "leanTo") leanTo(kit, b, base);
    else if (b.kind === "fuel") fuelShed(kit, b, base);
    else hut(kit, b, base);
  }
}

/** The hangar, its front (+z) to the strip. */
function hangar(kit: FacadeKit, b: StripBuilding, base: number): void {
  const hw = b.width / 2;
  const hd = b.depth / 2;
  const eave = b.eave;
  const door = { half: 9, top: 4.8 };
  // The footing, a hand over the snow at the highest corner.
  kit.box(-hw - 0.1, base, -hd - 0.1, hw + 0.1, 0, hd + 0.1, FACADE.concrete, T.footing);
  // The back and the sides in ribbed sheet, a darker skirt along the foot.
  kit.wall(hw, -hd, -hw, -hd, 0, eave, FACADE.cladding, T.sheet);
  kit.wall(-hw, -hd, -hw, hd, 0, eave, FACADE.cladding, T.sheet);
  kit.wall(hw, hd, hw, -hd, 0, eave, FACADE.cladding, T.sheet);
  for (const [x0, z0, x1, z1] of [
    [hw, -hd, -hw, -hd],
    [-hw, -hd, -hw, hd],
    [hw, hd, hw, -hd],
  ] as const) {
    kit.wall(x0, z0, x1, z1, 0, 0.5, FACADE.cladding, T.dark);
  }
  // The front: the jambs either side of the door, the header over it.
  kit.wall(-hw, hd, -door.half, hd, 0, eave, FACADE.cladding, T.sheet);
  kit.wall(door.half, hd, hw, hd, 0, eave, FACADE.cladding, T.sheet);
  kit.wall(-door.half, hd, door.half, hd, door.top, eave, FACADE.cladding, T.sheet);
  // The operator's band across the header and round the corners.
  kit.wall(-hw, hd + 0.02, hw, hd + 0.02, eave - 0.75, eave - 0.35, FACADE.plain, T.band);
  // The dark of the hall behind the doors, where a leaf stands slid open:
  // the floor and the back of the opening.
  kit.wall(-door.half, hd - 6, door.half, hd - 6, 0, door.top, FACADE.plain, 0x1c1f22);
  kit.wall(-door.half, hd - 6, -door.half, hd, 0, door.top, FACADE.plain, 0x26292c);
  kit.wall(door.half, hd, door.half, hd - 6, 0, door.top, FACADE.plain, 0x26292c);
  kit.cap(
    [
      [-door.half, hd - 6],
      [door.half, hd - 6],
      [door.half, hd],
      [-door.half, hd],
    ],
    door.top,
    FACADE.plain,
    0x202326,
    true,
  );
  // The track the doors hang from, and the four leaves on it: the second
  // slid a little behind its neighbour.
  kit.box(-hw + 0.4, door.top, hd, hw - 0.4, door.top + 0.22, hd + 0.3, FACADE.steel, T.dark, {
    layer: FACADE.steel,
    tint: T.dark,
  });
  const leaf = (2 * door.half) / 4;
  for (let i = 0; i < 4; i++) {
    const x0 = -door.half + i * leaf;
    const proud = i % 2 === 0 ? 0.16 : 0.06;
    const shift = i === 1 ? -1.4 : 0;
    kit.inset(
      x0 + shift,
      hd,
      x0 + leaf + shift,
      hd,
      0.02,
      door.top - 0.02,
      proud,
      FACADE.cladding,
      T.door,
    );
    // Each leaf's frame: a dark stile down its edge.
    kit.inset(
      x0 + shift,
      hd,
      x0 + 0.12 + shift,
      hd,
      0.02,
      door.top - 0.02,
      proud + 0.01,
      FACADE.plain,
      T.dark,
    );
  }
  // The floor's lip and the doors' bottom guide along the front.
  kit.box(-door.half, -0.05, hd, door.half, 0.04, hd + 0.35, FACADE.concrete, T.footing);
  // THE LAMPS over the door, their glass lit after dark.
  for (const x of [-door.half * 0.55, door.half * 0.55]) {
    kit.box(x - 0.3, door.top + 0.3, hd, x + 0.3, door.top + 0.42, hd + 0.55, FACADE.steel, T.dark);
    kit.inset(
      x - 0.25,
      hd + 0.55,
      x + 0.25,
      hd + 0.55,
      door.top + 0.3,
      door.top + 0.42,
      0.01,
      FACADE.window,
      0xfff4d8,
      true,
    );
  }
  // The man door and the windows down the side away from the strip's end.
  kit.inset(-hw, hd - 2.4, -hw, hd - 1.4, 0, 2.05, 0.04, FACADE.door, 0xcfd4d6, true);
  for (let z = hd - 4.5; z > -hd + 1; z -= 3.2) {
    kit.inset(-hw, z - 1.2, -hw, z, 2.6, 3.4, 0.04, FACADE.window, 0xd9dde0, true);
  }
  // A vent box on the back, the downpipes at the corners.
  kit.inset(1.2, -hd, -1.2, -hd, eave - 1.6, eave - 0.6, 0.05, FACADE.louvre, T.steel);
  for (const [x, z] of [
    [hw - 0.15, hd - 0.15],
    [-hw + 0.15, hd - 0.15],
    [hw - 0.15, -hd + 0.15],
    [-hw + 0.15, -hd + 0.15],
  ] as const) {
    kit.column(x, z, 0, eave, 0.06, FACADE.steel, T.steel, 6);
  }
  // The gable over the front, low, its sheet roof under snow; the gable
  // ends clad.
  kit.gableRoof(hw, hd, eave, b.rise, 0.45, ROOF, SHEET, FASCIA, SNOW);
}

/** The open lean-to, its open front (+z) to the strip. */
function leanTo(kit: FacadeKit, b: StripBuilding, base: number): void {
  const hw = b.width / 2;
  const hd = b.depth / 2;
  kit.box(-hw - 0.1, base, -hd - 0.1, hw + 0.1, 0, hd + 0.1, FACADE.concrete, T.footing);
  // The back high, the ends boarded, the front open on posts.
  const front = b.eave;
  const back = b.eave + b.rise;
  kit.wall(hw, -hd, -hw, -hd, 0, back, FACADE.boards, T.boards);
  kit.wall(-hw, -hd, -hw, hd, 0, front, FACADE.boards, T.boards);
  kit.wall(hw, hd, hw, -hd, 0, front, FACADE.boards, T.boards);
  // The insides the open front shows: darker boards.
  kit.wall(-hw + 0.1, -hd + 0.1, hw - 0.1, -hd + 0.1, 0, back, FACADE.boards, 0x6f5640);
  for (let x = -hw; x <= hw + 0.01; x += b.width / 4) {
    kit.box(x - 0.12, 0, hd - 0.24, x + 0.12, front, hd, FACADE.timber, T.trim);
  }
  kit.box(-hw, front - 0.35, hd - 0.24, hw, front, hd, FACADE.timber, T.trim);
  // The roof falls to the front: the kit's mono roof is low at its −x, so
  // it is laid turned a quarter round.
  const o = kit.world([0, 0, 0]);
  kit.at(o[0], o[1], o[2], b.heading + Math.PI / 2);
  kit.monoRoof(hd, hw, front, b.rise, 0.5, ROOF, BOARDS, FASCIA, SNOW);
  kit.at(o[0], o[1], o[2], b.heading);
}

/** The fuel shed: a roof on posts over the drums, its open front (+z) to
 * the apron. */
function fuelShed(kit: FacadeKit, b: StripBuilding, base: number): void {
  const hw = b.width / 2;
  const hd = b.depth / 2;
  kit.box(-hw, base, -hd, hw, 0, hd, FACADE.concrete, T.footing);
  const eave = b.eave;
  // The back boarded, the posts at the front.
  kit.wall(hw, -hd, -hw, -hd, 0, eave + b.rise, FACADE.boards, T.boards);
  kit.wall(-hw + 0.08, -hd + 0.08, hw - 0.08, -hd + 0.08, 0, eave, FACADE.boards, 0x6f5640);
  // Its ends boarded too, under the roof's end triangles; the front open.
  kit.wall(-hw, -hd, -hw, hd, 0, eave, FACADE.boards, T.boards);
  kit.wall(hw, hd, hw, -hd, 0, eave, FACADE.boards, T.boards);
  for (const x of [-hw + 0.1, hw - 0.1]) {
    kit.box(x - 0.08, 0, hd - 0.18, x + 0.08, eave, hd - 0.02, FACADE.timber, T.trim);
    kit.box(x - 0.08, 0, -hd + 0.02, x + 0.08, eave, -hd + 0.18, FACADE.timber, T.trim);
  }
  // The pallet, and the drums on it — two rows of three, the turbine fuel's
  // blue and a red one for the spare.
  kit.box(-hw + 0.35, 0, -hd + 0.4, hw - 0.35, 0.14, hd - 0.4, FACADE.timber, 0x9c7a55, {
    layer: FACADE.timber,
    tint: 0x9c7a55,
  });
  const R = 0.29;
  const H = 0.88;
  const xs = [-1.3, 0, 1.3].map((v) => v * 0.62);
  for (const [i, x] of xs.entries()) {
    for (const [j, z] of [-0.45, 0.35].entries()) {
      const tint = i === 2 && j === 0 ? 0xa8302a : 0x2f5d8a;
      kit.column(x, z, 0.14, 0.14 + H, R, FACADE.steel, tint, 12);
      // The rolling hoops.
      kit.column(x, z, 0.14 + H * 0.33, 0.14 + H * 0.36, R + 0.012, FACADE.steel, 0x3a3f44, 12);
      kit.column(x, z, 0.14 + H * 0.64, 0.14 + H * 0.67, R + 0.012, FACADE.steel, 0x3a3f44, 12);
    }
  }
  // The hand pump on the front drum: its barrel, the crank and the hose.
  const px = xs[1];
  const pz = 0.35;
  kit.column(px, pz, 0.14 + H, 0.14 + H + 0.42, 0.045, FACADE.steel, 0x9aa0a6, 8);
  kit.box(
    px - 0.02,
    0.14 + H + 0.32,
    pz - 0.02,
    px + 0.28,
    0.14 + H + 0.36,
    pz + 0.02,
    FACADE.steel,
    0x2e3236,
  );
  kit.box(
    px + 0.04,
    0.14 + H + 0.18,
    pz + 0.02,
    px + 0.08,
    0.14 + H + 0.3,
    pz + 0.36,
    FACADE.plain,
    0x1e2124,
  );
  // The extinguisher on its stand at the open end.
  kit.column(hw - 0.35, hd - 0.4, 0.14, 0.14 + 0.62, 0.11, FACADE.steel, 0xc8241c, 10);
  kit.box(
    hw - 0.4,
    0.14 + 0.62,
    hd - 0.45,
    hw - 0.3,
    0.14 + 0.72,
    hd - 0.35,
    FACADE.plain,
    0x1e2124,
  );
  // The roof: steel sheet falling to the front.
  const yaw = b.heading;
  const o = kit.world([0, 0, 0]);
  kit.at(o[0], o[1], o[2], yaw + Math.PI / 2);
  kit.monoRoof(hd, hw, eave, b.rise, 0.35, ROOF, BOARDS, FASCIA, SNOW * 0.8);
  kit.at(o[0], o[1], o[2], yaw);
}

/** The hut, its door (+z) to the apron. */
function hut(kit: FacadeKit, b: StripBuilding, base: number): void {
  const hw = b.width / 2;
  const hd = b.depth / 2;
  const eave = b.eave;
  kit.box(-hw - 0.05, base, -hd - 0.05, hw + 0.05, 0, hd + 0.05, FACADE.concrete, T.footing);
  kit.box(-hw, 0, -hd, hw, eave, hd, FACADE.boards, T.boards, null);
  for (const [x, z] of [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ] as const) {
    kit.box(x - 0.07, 0, z - 0.07, x + 0.07, eave, z + 0.07, FACADE.boards, T.trim, null);
  }
  // The door and the window to the apron, a window either end.
  kit.inset(-hw + 0.9, hd, -hw + 1.9, hd, 0, 1.95, 0.03, FACADE.plankDoor, 0x7d3b2a);
  kit.inset(hw - 2.4, hd, hw - 0.8, hd, 0.95, 1.85, 0.03, FACADE.window, 0xe8e2d6, true);
  kit.inset(hw, 0.6, hw, -0.6, 1.0, 1.8, 0.03, FACADE.window, 0xe8e2d6, true);
  kit.inset(-hw, -0.6, -hw, 0.6, 1.0, 1.8, 0.03, FACADE.window, 0xe8e2d6, true);
  // The bench under the window, and the step at the door.
  kit.box(hw - 2.6, 0.42, hd, hw - 0.6, 0.48, hd + 0.4, FACADE.timber, 0x8f6c4a, {
    layer: FACADE.timber,
    tint: 0x8f6c4a,
  });
  for (const x of [hw - 2.45, hw - 0.75])
    kit.box(x - 0.05, 0, hd + 0.1, x + 0.05, 0.42, hd + 0.3, FACADE.timber, T.trim);
  kit.box(-hw + 0.8, -0.2, hd, -hw + 2.0, -0.02, hd + 0.5, FACADE.timber, 0xa08060, {
    layer: FACADE.timber,
    tint: 0xa08060,
  });
  // The roof, its ridge along the front; the stove's pipe.
  const yaw = b.heading;
  const o = kit.world([0, 0, 0]);
  kit.at(o[0], o[1], o[2], yaw + Math.PI / 2);
  kit.gableRoof(hd, hw, eave, b.rise, 0.45, ROOF, BOARDS, FASCIA, SNOW);
  kit.at(o[0], o[1], o[2], yaw);
  kit.column(hw - 1.2, -0.6, eave, eave + b.rise + 0.9, 0.08, FACADE.steel, T.steel, 8);
  kit.box(
    hw - 1.32,
    eave + b.rise + 0.9,
    -0.72,
    hw - 1.08,
    eave + b.rise + 0.98,
    -0.48,
    FACADE.steel,
    T.dark,
  );
}
