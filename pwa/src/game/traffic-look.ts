// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE VILLAGE'S TRAFFIC LOOKS LIKE (`traffic.ts`'s cars, ski bus and
// bicycles, and the cars parked in its bays): each vehicle's paint, the
// snow left on it, what it carries on its roof, its lamps and how bright
// each is at a moment — dealt off the map's seed and the vehicle's own
// number on a salt of its own, so it is the same car every frame and every
// visit and moves nothing the engine draws. Three-free, so the suite reads
// it; `traffic-shapes.ts` builds the bodies and `traffic-view.ts` draws
// them.
//
// THE NUMBERS, measured off the real thing (`docs/traffic.md`):
//   * PAINT: a European winter car park is grey, white and black — about a
//     quarter of new cars grey, a quarter white, a fifth black, a tenth
//     blue, then silver, red, green and the browns and beiges.
//   * SNOW: a car parked overnight in a snowfall wears it on every flat
//     face (the roof, the bonnet, the boot, the screens); a car on the road
//     has had its screens and bonnet cleared and keeps a slab on its roof
//     about one time in three.
//   * THE ROOF: a ski area's cars carry a ROOF BOX (250–600 l: some 1.9 m
//     long, 0.8 wide and 0.35 tall, mostly black or a dark grey) or a SKI
//     RACK of two bars with the skis laid flat on it.
//   * LAMPS: dipped headlamps after dark and daytime running lamps by day;
//     the tail lamps after dark (a few candela), the brake lamps an order
//     of magnitude brighter (60–185 cd); indicators flashing at 1.5 Hz (the
//     rule's 60–120 a minute).

import type { CrowdBody, VehicleKind, VehiclePose } from "@engine";
import { VEHICLES } from "@engine";

/** The salt every look is dealt on. */
export const LOOK_SALT = 9157;

/** A small hash of the map's seed, a vehicle's number, a draw and the
 * salt, to 0..1. */
export function lookHash(seed: number, id: number, k: number): number {
  let h = Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (id + 0x632be5ab), 0xc2b2ae35);
  h = Math.imul(h ^ (k * 0x27d4eb2f + LOOK_SALT), 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** A pick off a table of shares. */
function shareOf<T>(rows: readonly { v: T; share: number }[], u: number): T {
  let total = 0;
  for (const r of rows) total += r.share;
  let x = u * total;
  for (const r of rows) {
    x -= r.share;
    if (x < 0) return r.v;
  }
  return rows[rows.length - 1].v;
}

/** THE PAINTS a car is dealt and their shares (sRGB). */
export const CAR_PAINTS: readonly { v: number; share: number }[] = [
  { v: 0xe8eaec, share: 17 }, // white
  { v: 0xd8d4c8, share: 7 }, // pearl
  { v: 0x9ea3a8, share: 9 }, // light grey
  { v: 0x585e65, share: 11 }, // dark grey
  { v: 0x3b3f44, share: 6 }, // graphite
  { v: 0x101113, share: 21 }, // black
  { v: 0xb4b8bc, share: 7 }, // silver
  { v: 0x1c2c52, share: 6 }, // dark blue
  { v: 0x31598c, share: 5 }, // blue
  { v: 0x8e1619, share: 5 }, // red
  { v: 0x2a4634, share: 3 }, // green
  { v: 0x8f7d60, share: 2 }, // beige
  { v: 0x4a3628, share: 1 }, // brown
];

/** A van's paint: mostly white, the rest a fleet's plain colours. */
const VAN_PAINTS: readonly { v: number; share: number }[] = [
  { v: 0xeceeef, share: 60 },
  { v: 0xb4b8bc, share: 12 },
  { v: 0x34383d, share: 10 },
  { v: 0x1c2c52, share: 8 },
  { v: 0x8e1619, share: 5 },
  { v: 0x2a4634, share: 5 },
];

/** The ski bus's skirt: the operator's colour under its white upper. */
const BUS_PAINTS: readonly { v: number; share: number }[] = [
  { v: 0x1f4f8a, share: 3 },
  { v: 0x1e6b45, share: 2 },
  { v: 0xa3191d, share: 2 },
  { v: 0xd9861a, share: 1 },
];

/** A bicycle's frame. */
const FRAME_PAINTS: readonly { v: number; share: number }[] = [
  { v: 0x15171a, share: 5 },
  { v: 0x8a9096, share: 2 },
  { v: 0x2a5d8f, share: 2 },
  { v: 0xa82a22, share: 2 },
  { v: 0x3e6a3a, share: 1 },
  { v: 0xd8d6cf, share: 1 },
];

/** A roof box's shell. */
const BOX_PAINTS: readonly { v: number; share: number }[] = [
  { v: 0x111214, share: 6 },
  { v: 0x45494e, share: 3 },
  { v: 0xd6d8da, share: 1 },
];

/** How a car wears the snow: none, a slab on its roof, or every flat face
 * (a car parked through the fall). */
export type SnowCover = "none" | "roof" | "all";

/** What a car carries on its roof. */
export type RoofLoad = "none" | "box" | "rack";

/** THE SHARES the looks are dealt by. */
export const LOOK = {
  /** A car on the road with a slab on its roof. */
  roofSnow: 0.35,
  /** A car parked with the night's snow on it; the rest were cleared. */
  parkedSnow: 0.82,
  /** A car (not a van) with a roof box, and with a ski rack. */
  box: 0.2,
  rack: 0.14,
  /** A cyclist in a helmet (the rest a beanie). */
  helmet: 0.55,
  /** The bodies the cyclists ride as. */
  riders: ["man", "woman", "teen", "oldMan", "man", "woman"] as readonly CrowdBody[],
} as const;

/** ONE VEHICLE'S LOOK. */
export type VehicleLook = {
  /** The body's paint (sRGB); on the bus its skirt, on a bike its frame. */
  paint: number;
  snow: SnowCover;
  roof: RoofLoad;
  /** The roof box's shell (sRGB). */
  box: number;
  /** A cyclist's body, and whether he wears a helmet. */
  rider: CrowdBody;
  helmet: boolean;
};

/** THE LOOK of vehicle `id` (a moving one's index in the plan, or a parked
 * car's number past them) of `kind` on the map of `seed`. */
export function vehicleLook(
  seed: number,
  id: number,
  kind: VehicleKind,
  parked: boolean,
): VehicleLook {
  const u = (k: number) => lookHash(seed, id, k);
  const table =
    kind === "van"
      ? VAN_PAINTS
      : kind === "bus"
        ? BUS_PAINTS
        : kind === "bike"
          ? FRAME_PAINTS
          : CAR_PAINTS;
  const car = kind !== "bus" && kind !== "bike";
  const snow: SnowCover = !car
    ? "none"
    : parked
      ? u(2) < LOOK.parkedSnow
        ? "all"
        : "none"
      : u(2) < LOOK.roofSnow
        ? "roof"
        : "none";
  const r = u(3);
  const roof: RoofLoad =
    !car || kind === "van"
      ? "none"
      : r < LOOK.box
        ? "box"
        : r < LOOK.box + LOOK.rack
          ? "rack"
          : "none";
  return {
    paint: shareOf(table, u(1)),
    snow,
    roof,
    box: shareOf(BOX_PAINTS, u(4)),
    rider: LOOK.riders[Math.floor(u(5) * LOOK.riders.length)],
    helmet: u(6) < LOOK.helmet,
  };
}

/** WHERE A VEHICLE'S LAMPS ARE, in its own frame (x right, y up off the
 * road, z forward, the body's middle at 0): the two headlamps', the two
 * tail lamps' and the four indicators' middles, and each lens's size
 * (across, tall). */
export type LampLayout = {
  head: { x: number; y: number; z: number; w: number; h: number };
  tail: { x: number; y: number; z: number; w: number; h: number };
};

export function lampLayout(kind: VehicleKind): LampLayout {
  const V = VEHICLES[kind];
  const L = V.length / 2;
  const W = V.width / 2;
  switch (kind) {
    case "bus":
      return {
        head: { x: W - 0.42, y: 0.52, z: L, w: 0.42, h: 0.16 },
        tail: { x: W - 0.3, y: 0.95, z: -L, w: 0.2, h: 0.55 },
      };
    case "van":
      return {
        head: { x: W - 0.32, y: 0.68, z: L, w: 0.34, h: 0.2 },
        tail: { x: W - 0.2, y: 1.05, z: -L, w: 0.16, h: 0.5 },
      };
    case "bike":
      return {
        head: { x: 0, y: 0.95, z: 0.62, w: 0.06, h: 0.05 },
        tail: { x: 0, y: 0.78, z: -0.62, w: 0.05, h: 0.04 },
      };
    case "suv":
      return {
        head: { x: W - 0.3, y: 0.7, z: L, w: 0.34, h: 0.13 },
        tail: { x: W - 0.26, y: 0.88, z: -L, w: 0.28, h: 0.14 },
      };
    default:
      return {
        head: { x: W - 0.3, y: 0.55, z: L, w: 0.34, h: 0.12 },
        tail: { x: W - 0.25, y: 0.72, z: -L, w: 0.28, h: 0.13 },
      };
  }
}

/** THE BICYCLE'S GEOMETRY, its own frame (the body's middle at 0): the
 * axles, the bottom bracket the cranks turn about, the saddle and the
 * bars' grips — where the rider's figure is posed to (`traffic-rider.ts`). */
export const BIKE = {
  rear: -0.555,
  front: 0.545,
  wheel: VEHICLES.bike.wheel,
  bb: { y: 0.3, z: -0.02 },
  crank: 0.17,
  saddle: { y: 0.93, z: -0.24 },
  grips: { x: 0.27, y: 1.03, z: 0.3 },
} as const;

/** The indicators' flash, Hz. */
export const FLASH = 1.5;

/** THE LAMPS' BRIGHTNESS at a moment, 0..1 each, into `out`: the
 * headlamps (dipped after dark, the daytime running lamps' glow by day),
 * the tail lamps (lit after dark, the brake lamps over them), the left and
 * the right indicators flashing as the engine signals. A parked car's are
 * all out. `dark` is the night's share (`SkyLook.lamps`). */
export function lampLevels(
  pose: Pick<VehiclePose, "brake" | "signal" | "speed"> | null,
  dark: number,
  t: number,
  out: [number, number, number, number],
): [number, number, number, number] {
  if (!pose) {
    out[0] = out[1] = out[2] = out[3] = 0;
    return out;
  }
  out[0] = 0.32 + 0.68 * dark;
  out[1] = Math.min(1, 0.45 * dark + (pose.brake ? 0.85 : 0));
  const on = (t * FLASH) % 1 < 0.5 ? 1 : 0;
  // The engine's signal is by the heading's sign: the heading grows
  // clockwise from above, so its positive side is a turn to the RIGHT.
  out[2] = pose.signal < 0 ? on : 0;
  out[3] = pose.signal > 0 ? on : 0;
  return out;
}
