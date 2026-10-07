// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S TURNS ON THE BENCH: a sled held at a speed on the flat,
// the bars put over to full lock and held there, ridden by the REAL ENGINE
// on the rider's own controls — and read back as how tightly it turned:
// the radius of the circle it settled on, the sideways pull that took, the
// time it took to turn through 90°, the most it rolled and whether it threw
// its rider. A mountain sled at a crawl on the hardpack turns on a circle
// of some 7.5–11 m radius (measured left and right on two of the class's
// machines, its long belt fighting the skis); at speed it is the grip that
// bounds it — the carbides on the groomer, the rider hanging off and the
// machine rolled onto its edge in powder — and the bands below are the
// game's: a little tighter than the machine, so it is easy to place.
// `tests/sled_turn_test.ts` holds the rows to their bands; `make sled-turn`
// prints the table.

import { NEUTRAL_INPUT, createGame, standSled, step, type GameState, type Level } from "@engine";

import { shapedLevel } from "./synthetic.ts";

const SIZE = 600;
const MID = SIZE / 2;

/** One turn on the bench. */
export type SledTurn = {
  id: string;
  what: string;
  /** 1 the groomer, 0 powder. */
  packed: number;
  /** The way on held, km/h. */
  kmh: number;
  /** The steady radius a rider expects, m: [least, most]. */
  radius: [number, number];
};

export const SLED_TURNS: SledTurn[] = [
  { id: "crawl", what: "at a crawl on the groomer", packed: 1, kmh: 10, radius: [3, 11] },
  { id: "slow", what: "at 25 on the groomer", packed: 1, kmh: 25, radius: [4, 8] },
  { id: "trail", what: "at 40 on the groomer", packed: 1, kmh: 40, radius: [7, 16] },
  { id: "fast", what: "at 60 on the groomer", packed: 1, kmh: 60, radius: [20, 40] },
  { id: "powder-slow", what: "at 25 in powder", packed: 0, kmh: 25, radius: [5, 10] },
  { id: "powder", what: "at 40 in powder", packed: 0, kmh: 40, radius: [12, 26] },
  { id: "powder-fast", what: "at 60 in powder", packed: 0, kmh: 60, radius: [30, 55] },
];

/** What a turn did. */
export type SledTurnResult = {
  id: string;
  /** The steady circle's radius, m. */
  radius: number;
  /** The time to turn through 90°, s (−1 never). */
  quarter: number;
  /** The way on through the steady part, km/h. */
  kmh: number;
  /** The sideways pull through the steady part, g. */
  pull: number;
  /** The most it rolled, degrees. */
  roll: number;
  thrown: boolean;
};

const levels = new Map<number, Level>();
function flat(packed: number): Level {
  let lv = levels.get(packed);
  if (!lv) {
    lv = shapedLevel(() => 0, { packed, size: SIZE });
    levels.set(packed, lv);
  }
  return lv;
}

/** Ride `row`: at its speed, full lock (`steer` 1 to the right, −1 to the
 * left) for 6 s, the throttle given as much as keeps the way on. */
export function rideTurn(row: SledTurn, steer = 1): SledTurnResult {
  const s: GameState = createGame({
    level: flat(row.packed),
    mode: "free",
    sled: true,
    crowd: 0,
    quiet: true,
  });
  const sled = s.sled!;
  const v = row.kmh / 3.6;
  standSled(s, sled, MID, MID - 150, 0);
  sled.vz = v;
  sled.treadSpeed = v;
  const out: SledTurnResult = {
    id: row.id,
    radius: 0,
    quarter: -1,
    kmh: 0,
    pull: 0,
    roll: 0,
    thrown: false,
  };
  const h0 = sled.heading;
  let turned = 0;
  let last = h0;
  // The steady part: from 2 s into the turn to its end, heading turned
  // against the path ridden.
  let path = 0;
  let swept = 0;
  let speeds = 0;
  let n = 0;
  const steps = 6 * 120;
  for (let i = 0; i < steps; i++) {
    const thumb = Math.min(1, Math.max(0, (v - sled.way) * 0.8 + 0.25));
    step(s, { ...NEUTRAL_INPUT, tuck: thumb, steer });
    if (s.events.some((e) => e.kind === "sled" && e.phase === "crash")) {
      out.thrown = true;
      break;
    }
    let dh = sled.heading - last;
    if (dh > Math.PI) dh -= 2 * Math.PI;
    if (dh < -Math.PI) dh += 2 * Math.PI;
    last = sled.heading;
    turned += dh;
    if (out.quarter < 0 && Math.abs(turned) >= Math.PI / 2) out.quarter = s.t;
    out.roll = Math.max(out.roll, Math.abs(sled.roll) * (180 / Math.PI));
    if (s.t >= 2) {
      path += Math.hypot(sled.vx, sled.vz) / 120;
      swept += Math.abs(dh);
      speeds += sled.speed;
      n++;
    }
  }
  out.radius = swept > 0 ? path / swept : Infinity;
  out.kmh = n ? (speeds / n) * 3.6 : 0;
  out.pull = (out.kmh / 3.6) ** 2 / out.radius / 9.81;
  return out;
}
