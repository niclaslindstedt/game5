// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START/FINISH ARCH, as a plan — where it stands and how big it is.
// Three-free, because two files need the same answer and one of them cannot
// import three: `gates.ts` draws it and `camera-clear.ts` keeps the lens out
// of it.
//
// WHAT A SKI RACE'S FINISH LOOKS LIKE: an INFLATABLE ARCH over the
// piste — a fat fabric tube in the organiser's colour, two legs on the snow
// either side of the course and a span over it, the words printed on a
// banner across the span's face and checkered blocks either end of them —
// and the line itself dyed across the snow under it as a checkered band.
// It is what every finish arena uses at the line, because it is up in
// minutes on the snow and a skier who meets a leg bounces off it. A rigid
// gantry or a plank on two posts is another sport's.

import type { Checkpoint, Level } from "@engine";

/** The arch's dimensions, m. */
export const ARCH = {
  /** The tube's radius — an inflatable's legs are about a metre thick. */
  tube: 0.55,
  /** The span's centreline over the higher foot. */
  top: 6.2,
  /** The radius the tube turns through at each shoulder. */
  corner: 1.4,
  /** How far past the checkpoint's stakes (half-width + 1) the legs stand:
   * over the groomer's windrow, clear of anything a skier rides. */
  out: 0.9,
  /** How far each leg sinks into the snow. */
  sink: 0.35,
  /** The printed banner across the span's face: its height. */
  panel: 1.25,
  /** The dyed band on the snow: its depth along the track — three rows. */
  band: 1.8,
};

/** THE OWED GATE'S MARKER, m: its width and its height over the panels it
 * stands above. `mark-shapes.ts` builds it off these. */
export const GATE = {
  marker: { width: 0.6, height: 0.7 },
};

/** Where one leg stands. */
export type ArchFoot = { x: number; z: number; y: number };

export type ArchPlan = {
  /** The line's centre. */
  x: number;
  z: number;
  /** The rider's right across the line, unit. */
  rx: number;
  rz: number;
  /** From the line's centre to each leg's axis, m. */
  reach: number;
  /** The left leg (-right) and the right leg, their bases in the snow. */
  feet: [ArchFoot, ArchFoot];
  /** The span's centreline height, m. */
  top: number;
};

export function archPlan(level: Level, cp: Checkpoint): ArchPlan {
  const rx = Math.cos(cp.heading);
  const rz = -Math.sin(cp.heading);
  const reach = cp.width / 2 + 1 + ARCH.out;
  const feet = [-1, 1].map((side) => {
    const x = cp.x + rx * reach * side;
    const z = cp.z + rz * reach * side;
    return { x, z, y: level.groundAt(x, z) - ARCH.sink };
  }) as [ArchFoot, ArchFoot];
  const top = Math.max(feet[0].y, feet[1].y) + ARCH.sink + ARCH.top;
  return { x: cp.x, z: cp.z, rx, rz, reach, feet, top };
}
