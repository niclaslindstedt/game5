// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START HOUSE, as a plan — where a slalom's start hut stands (R31) and
// how big it is, where its start clock hangs and where the television's
// start camera stands to look at the racer in it. Three-free, because three
// files need the same answer and two of them cannot import three:
// `start-house.ts` draws it, `camera-start.ts` films the racer in it and
// `camera-clear.ts` keeps a lens from standing in its walls.
//
// WHAT A RACE'S START LOOKS LIKE: a closed house over the top of the
// course, out of the weather, its FRONT a tall flat wall — a billboard,
// wider than the house behind it, a coloured band along its top, white
// boards flanking a narrow DOORWAY, dark inside. The racer stands in the
// doorway on the snow, his boots just behind the WAND — a bar at shin
// height between two short posts at the door's foot that starts his clock
// as his legs push it open — his poles planted over it, outside the posts,
// in the two holes every racer before him has trodden in the snow. The broadcast films him from over the door at an
// angle, looking down on him leaning out over the wand, then cuts inside
// the house behind him: his back, the posts and the course below through
// the doorway — the shot he goes on.

import type { Level } from "@engine";

/** The house's measure, m. */
export const HOUSE = {
  /** THE FRONT WALL: across the course and up from the snow at its foot,
   * the band along its top, and the white boards either side of the door. */
  front: { width: 7.2, height: 4.6, band: 0.9, board: 0.85 },
  /** THE DOORWAY: its width and its height. */
  door: { width: 1.35, height: 2.45 },
  /** THE HOUSE behind the front: across, back up the course, and its
   * height over the snow at the door. */
  width: 3.4,
  depth: 3.6,
  height: 3.1,
  /** How far down the piste of the wand's line the front stands. */
  ahead: 0.15,
  /** THE WAND: its height over the snow, between two posts this tall at
   * the door's foot. */
  wand: { height: 0.42, post: 0.75 },
  /** THE POLE HOLES: where every racer plants his poles, just outside the
   * wand's posts and out beyond them, the snow trodden down into a dish —
   * how far out of the door, how far apart, their size and how deep. */
  holes: { out: 0.5, apart: 1.75, width: 0.5, length: 0.6, depth: 0.06 },
  /** THE START CLOCK inside the doorway's left jamb, facing the racer:
   * its centre's height, and its face's width and height. */
  clock: { height: 1.7, width: 0.5, tall: 0.34 },
} as const;

/** THE TELEVISION'S TWO START SHOTS, m and deg: OVERHEAD — under the
 * house's roof `back` m behind the racer and to one side, `high` m over the
 * snow under him, looking steeply down past his helmet and shoulders at his
 * skis behind the wand and his poles planted beyond it (`aim` m out of the
 * door, `low` m up); and BEHIND — inside the house at his
 * back, looking out through the doorway past him, the wand's posts and his
 * planted poles, down the course: held nearly LEVEL, dipped `dip` rad, so
 * the start drop falls away out of the bottom of the door — a lens tipped
 * down to the snow flattens the steepest hill. */
export const START_SHOT = {
  over: { back: 0.45, side: 0.4, high: 2.75, aim: 0.35, low: 0.15, fov: 62 },
  behind: { back: 2.1, high: 1.7, ahead: 12, dip: 0.1, fov: 52 },
} as const;

/** A point on the plan: x, z on the map and y its height. */
export type HousePoint = { x: number; y: number; z: number };

export type HousePlan = {
  /** The middle of the doorway, on the snow under the wand. */
  x: number;
  z: number;
  y: number;
  /** The way down the course out of it, and its right, unit. */
  fx: number;
  fz: number;
  rx: number;
  rz: number;
  heading: number;
  /** The house's roof, level all round — it stands on the slope. */
  eaves: number;
  /** The start clock's face. */
  clock: HousePoint;
  /** Each start shot's lens and the point it aims at. */
  shots: Record<keyof typeof START_SHOT, { lens: HousePoint; aim: HousePoint }>;
};

const plans = new WeakMap<Level, HousePlan | null>();

/** THE START HOUSE of `level`'s slalom, or null on a map with none. Kept
 * per map. */
export function startHousePlan(level: Level): HousePlan | null {
  if (plans.has(level)) return plans.get(level) ?? null;
  const sl = level.slalom;
  const start = level.checkpoints[0];
  if (!sl || !start) {
    plans.set(level, null);
    return null;
  }
  const heading = start.heading;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  const x = start.x + fx * HOUSE.ahead;
  const z = start.z + fz * HOUSE.ahead;
  const y = level.groundAt(x, z);
  // The eaves level over the house's highest corner — the back, up the
  // slope — so the hut stands on the hill with its front tall.
  let top = -Infinity;
  for (const along of [0, -HOUSE.depth]) {
    for (const side of [-1, 1]) {
      const cx = x + fx * along + rx * side * (HOUSE.width / 2);
      const cz = z + fz * along + rz * side * (HOUSE.width / 2);
      top = Math.max(top, level.groundAt(cx, cz));
    }
  }
  const eaves = top + HOUSE.height;
  const C = HOUSE.clock;
  const cx = x - rx * (HOUSE.door.width / 2 - 0.05) - fx * 0.4;
  const cz = z - rz * (HOUSE.door.width / 2 - 0.05) - fz * 0.4;
  const S = START_SHOT;
  const racer = level.spawn;
  const feet = level.groundAt(racer.x, racer.z);
  const at = (along: number, side: number, up: number): HousePoint => {
    const px = x + fx * along + rx * side;
    const pz = z + fz * along + rz * side;
    return { x: px, y: level.groundAt(px, pz) + up, z: pz };
  };
  const back = Math.hypot(racer.x - x, racer.z - z);
  const plan: HousePlan = {
    x,
    z,
    y,
    fx,
    fz,
    rx,
    rz,
    heading,
    eaves,
    clock: { x: cx, y: level.groundAt(cx, cz) + C.height, z: cz },
    shots: {
      over: {
        lens: { ...at(-back - S.over.back, S.over.side, 0), y: feet + S.over.high },
        aim: at(S.over.aim, 0, S.over.low),
      },
      behind: {
        lens: { ...at(-back - S.behind.back, 0, 0), y: feet + S.behind.high },
        aim: {
          ...at(S.behind.ahead, 0, 0),
          y: feet + S.behind.high - S.behind.ahead * Math.tan(S.behind.dip),
        },
      },
    },
  };
  plans.set(level, plan);
  return plan;
}
