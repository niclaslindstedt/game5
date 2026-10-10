// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S ROLLOVERS ON THE BENCH: a sled ridden by the REAL ENGINE
// on the rider's own controls through the manoeuvres that put a real one on
// its side — a turn held at full lock, the bars flicked from one lock to
// the other, a slalom of locks, full throttle at full lock, and seven ways
// across a 20°, 30° and 35° face (held into the hill, the bars off it or let
// go, stalled, stalled hung off the downhill side, turned out of the fall
// line) — from a crawl to 120 km/h, on the groomer and in powder from a thin
// cover to bottomless. Each row is read back as whether it threw its rider
// (and when), the most it rolled off the snow and the way on, and held to
// what a rider of the class expects (`docs/snowmobile.md` § Rollover):
//   * ON THE FLAT it NEVER goes over — on the groomer its 0.91 m stance and
//     a rider hung into the turn carry it, and in powder it is ridden like a
//     bike, leant onto the belt's edge and held there by the carve and the
//     rider;
//   * a TRAVERSE held into the hill stays up across a 20° face in any snow,
//     and on the groomer across any; a turn out of the fall line holds on a
//     20° face;
//   * STALLED at a crawl across a 35° face of bottomless powder, nobody on
//     the uphill side, it goes over — the low ski sunk, the belt's edge all
//     it stands on — the sidehill fall every mountain rider learns on;
//   * every other row may go either way and is reported, not held.
// `tests/sled_tips_test.ts` holds the rows; `make sled-tip` prints the
// table.

import {
  NEUTRAL_INPUT,
  angleDiff,
  createGame,
  standSled,
  step,
  type GameState,
  type Level,
} from "@engine";

import { shapedLevel } from "./synthetic.ts";

const SIZE = 900;
/** Where every row starts: well off the synthetic piste (its gates are
 * solids) and far enough from the map's edge for 8 s at 80 km/h. */
const START_X = 220;
const START_Z = 120;

export type SledTipSurface = "groomer" | "thin" | "powder" | "deep" | "bottomless";
export type SledTipMove =
  | "hold"
  | "flick"
  | "slalom"
  | "throttle"
  | "into"
  | "off"
  | "straight"
  | "stall"
  | "slump"
  | "down";

/** The surfaces: the share packed and the snow dial (`SNOW_DIAL`). */
export const SLED_TIP_SURFACES: Record<SledTipSurface, { packed: number; depth: number }> = {
  groomer: { packed: 1, depth: 1 },
  thin: { packed: 0, depth: 0.5 },
  powder: { packed: 0, depth: 1 },
  deep: { packed: 0, depth: 1.75 },
  bottomless: { packed: 0, depth: 2.5 },
};

/** What the manoeuvres are, in words. */
export const SLED_TIP_MOVES: Record<SledTipMove, string> = {
  hold: "full lock held",
  flick: "full lock, flicked to the other at 1.5 s",
  slalom: "full lock, the other way every second",
  throttle: "full lock on full throttle",
  into: "across the face, held level into the hill",
  off: "across the face, the bars off the hill",
  straight: "across the face, the bars let go",
  stall: "across the face, off the throttle and the bars let go",
  slump: "across the face, off the throttle and hung off the downhill side",
  down: "down the fall line, then turned across the face and held",
};

/** One rollover on the bench. */
export type SledTip = {
  id: string;
  surface: SledTipSurface;
  /** The face's pitch, degrees: 0 the flat, else a sidehill falling to +x
   * ridden across it (the sled heads +z, the hill on its left). */
  slope: number;
  move: SledTipMove;
  kmh: number;
  /** What a rider of the class expects: "up" never thrown, "over" thrown,
   * "either" reported. */
  wants: "up" | "over" | "either";
};

const SPEEDS = [10, 25, 40, 60, 80, 100, 120];
const FLAT_MOVES: SledTipMove[] = ["hold", "flick", "slalom", "throttle"];

/** What a row should do (the header's rules). */
function wantsOf(
  surface: SledTipSurface,
  slope: number,
  move: SledTipMove,
  kmh: number,
): SledTip["wants"] {
  if (slope === 0) return "up";
  if (move === "into") return slope <= 20 || surface === "groomer" ? "up" : "either";
  // A turn out of the fall line is the commonest turn on a mountain: it
  // holds on a 20° face in any snow.
  if (move === "down") return slope <= 20 ? "up" : "either";
  if (
    (move === "stall" || move === "slump") &&
    slope >= 35 &&
    surface === "bottomless" &&
    kmh <= 10
  ) {
    return "over";
  }
  return "either";
}

/** THE BENCH: every manoeuvre on the flat at every speed and surface, and
 * the two traverses across a 20° and a 30° face at the lower speeds. */
export const SLED_TIPS: SledTip[] = (() => {
  const rows: SledTip[] = [];
  for (const surface of Object.keys(SLED_TIP_SURFACES) as SledTipSurface[]) {
    // A deep fall holds a sled well under 100 km/h: none is asked of it.
    const speeds = surface === "deep" || surface === "bottomless" ? SPEEDS.slice(0, 5) : SPEEDS;
    for (const move of FLAT_MOVES) {
      for (const kmh of speeds) {
        rows.push({
          id: `${surface}-${move}-${kmh}`,
          surface,
          slope: 0,
          move,
          kmh,
          wants: wantsOf(surface, 0, move, kmh),
        });
      }
    }
    for (const slope of [20, 30, 35]) {
      for (const move of ["into", "off", "straight", "stall", "slump", "down"] as SledTipMove[]) {
        for (const kmh of move === "down" ? [25, 40, 60] : [10, 25, 40]) {
          rows.push({
            id: `${surface}-${move}${slope}-${kmh}`,
            surface,
            slope,
            move,
            kmh,
            wants: wantsOf(surface, slope, move, kmh),
          });
        }
      }
    }
  }
  return rows;
})();

/** What a row did. */
export type SledTipResult = {
  id: string;
  /** When the rider was thrown, s (−1 never). */
  thrown: number;
  /** The most it rolled off the snow's plane, degrees. */
  roll: number;
  /** The way on at the end (or when thrown), km/h. */
  kmh: number;
};

const levels = new Map<string, Level>();
function levelOf(packed: number, slope: number): Level {
  const key = `${packed}:${slope}`;
  let lv = levels.get(key);
  if (!lv) {
    const fall = Math.tan((slope * Math.PI) / 180);
    lv = shapedLevel((x) => (SIZE - x) * fall, { packed, size: SIZE });
    levels.set(key, lv);
  }
  return lv;
}

/** The bars a manoeuvre asks for at `t` s, for a sled at `heading` (the
 * traverses steer to hold it across the face, +z). */
function barsOf(move: SledTipMove, t: number, heading: number): number {
  switch (move) {
    case "hold":
    case "throttle":
      return 1;
    case "flick":
      return t < 1.5 ? 1 : -1;
    case "slalom":
      return Math.floor(t) % 2 ? -1 : 1;
    case "into":
      // Held across the face: the bars toward the hill (left, −) as far as
      // keeps the heading, the rider hung off the uphill side with them.
      return Math.max(-1, Math.min(0, -0.6 + 3 * angleDiff(heading, 0)));
    case "off":
    case "slump":
      return 1;
    case "straight":
    case "stall":
      return 0;
    case "down":
      // Down the fall line for half a second, then the bars over until it
      // is across the face the other way and held there into the hill
      // (now on its right).
      return t < 0.5 ? 0 : Math.max(-1, Math.min(1, 0.6 + 3 * angleDiff(heading, Math.PI)));
  }
}

/** Ride `row` for 8 s from its speed. */
export function rideTip(row: SledTip): SledTipResult {
  const surface = SLED_TIP_SURFACES[row.surface];
  const s: GameState = createGame({
    level: levelOf(surface.packed, row.slope),
    mode: "free",
    sled: true,
    crowd: 0,
    quiet: true,
    snowDepth: surface.depth,
  });
  const sled = s.sled!;
  const v = row.kmh / 3.6;
  const down = row.move === "down";
  standSled(
    s,
    sled,
    down ? START_X - 100 : START_X,
    down ? SIZE / 2 : START_Z,
    down ? Math.PI / 2 : 0,
  );
  // Let it settle into the snow at rest before the speed is given.
  for (let i = 0; i < 120; i++) step(s, { ...NEUTRAL_INPUT });
  sled.vx = down ? v : 0;
  sled.vz = down ? 0 : v;
  sled.treadSpeed = v;
  const out: SledTipResult = { id: row.id, thrown: -1, roll: 0, kmh: 0 };
  const t0 = s.t;
  for (let i = 0; i < 8 * 120; i++) {
    const t = s.t - t0;
    const thumb =
      row.move === "throttle"
        ? 1
        : row.move === "stall" || row.move === "slump"
          ? 0
          : Math.min(1, Math.max(0, (v - sled.way) * 0.8 + 0.25));
    step(s, { ...NEUTRAL_INPUT, tuck: thumb, steer: barsOf(row.move, t, sled.heading) });
    out.roll = Math.max(out.roll, Math.abs(rollOffSnow(s)));
    if (s.events.some((e) => e.kind === "sled" && e.phase === "crash")) {
      out.thrown = s.t - t0;
      break;
    }
  }
  out.kmh = sled.speed * 3.6;
  return out;
}

const n = { x: 0, y: 1, z: 0 };
/** The machine's roll off the snow's plane under it, degrees. */
function rollOffSnow(s: GameState): number {
  const c = s.sled!;
  s.level.normalAt(c.x, c.z, n);
  const h = c.heading;
  // The machine's right axis, from its heading and roll (pitch aside).
  const rx = Math.cos(h) * Math.cos(c.roll);
  const ry = -Math.sin(c.roll);
  const rz = -Math.sin(h) * Math.cos(c.roll);
  return (Math.asin(Math.max(-1, Math.min(1, -(rx * n.x + ry * n.y + rz * n.z)))) * 180) / Math.PI;
}

/** Whether `r` is what `row` wants. */
export function tipOk(row: SledTip, r: SledTipResult): boolean {
  if (row.wants === "up") return r.thrown < 0;
  if (row.wants === "over") return r.thrown >= 0;
  return true;
}
