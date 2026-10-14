// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BARS ON THE BENCH (`make bike-steer`): how the downhill bike answers
// its steer, ridden by the REAL bodies (`bike-body.ts`) on the flat
// hardpack. A STEP of the bars at a held speed — ramped on as the keyboard
// ramps it (`input-model.ts`'s attack) — read for what a rider feels: the
// countersteer's dip the wrong way, the time until the bike is plainly
// turning (its heading 3° round) and until the turn is 90 % made, the radius
// and the lean it settles at, and whether it went down and how. Swept over
// speed and the bars' throw into a FLIP MAP: which turns are ridden and
// which throw him. Shared by the lab and the suite (`tests/bike_steer_test.ts`).

import { BIKE, type BikeState } from "@engine";
import { NO_HANDS, RAW, RIDDEN, benchRide, benchWorld, slope } from "./bike-worlds.ts";
import type { BikeRide } from "@engine";

const DEG = 180 / Math.PI;
/** The keyboard's steer attack, 1/s (`input-model.ts`'s `KEY_STEER_ATTACK`). */
const KEY_ATTACK = 6;
/** When the step comes, s: a second of straight riding first. */
const AT = 1;

export type SteerStep = {
  /** Speed held, m/s, and the bars' throw asked, -1..1. */
  v: number;
  steer: number;
  /** The most the heading went the wrong way first, deg. */
  dip: number;
  /** Seconds from the press until the heading is 3° round the asked way. */
  felt: number;
  /** Seconds from the press until the yaw rate is a quarter of its
   * settled, the right way: the turn biting. */
  bite: number;
  /** Seconds from the press until the yaw rate is 90 % of its settled. */
  made: number;
  /** The settled radius, m, and lean, deg (Infinity / NaN when down). */
  radius: number;
  lean: number;
  /** How he went down, or null. */
  crash: string | null;
  /** When, s after the press. */
  crashAt: number;
};

const hold = (v: number) => (b: BikeState) => ({
  ...NO_HANDS,
  pedal: b.way < v - 0.1 ? 1 : 0,
  rear: b.way > v + 0.4 ? 0.25 : 0,
});

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The bars stepped to `steer` at `v` m/s (ramped on as a key ramps them,
 * or at once with `instant`), ridden `seconds` after. */
export function steerStep(
  v: number,
  steer: number,
  o: { ride?: BikeRide; seconds?: number; instant?: boolean } = {},
): SteerStep {
  const seconds = o.seconds ?? 5;
  const sign = Math.sign(steer) || 1;
  let h0 = 0;
  let dip = 0;
  let felt = NaN;
  const rates: { t: number; r: number }[] = [];
  let lean = 0;
  let n = 0;
  const s = benchRide(benchWorld(slope(0), "hardpack"), {
    z: -60,
    speed: v,
    seconds: AT + seconds,
    ride: o.ride ?? RIDDEN,
    hand: (b, t) => {
      const u =
        t < AT ? 0 : o.instant ? steer : sign * Math.min(Math.abs(steer), (t - AT) * KEY_ATTACK);
      return { ...hold(v)(b), steer: u };
    },
    watch: ({ t, b }) => {
      if (t < AT) {
        h0 = b.heading;
        return;
      }
      const turned = sign * wrap(b.heading - h0) * DEG;
      if (Number.isNaN(felt)) dip = Math.max(dip, -turned);
      if (Number.isNaN(felt) && turned > 3) felt = t - AT;
      // The engine's heading turns clockwise with a positive steer.
      rates.push({ t: t - AT, r: sign * b.wy });
      if (t > AT + seconds - 1.5) {
        lean += b.roll;
        n++;
      }
    },
  });
  const settled = n > 0 && !s.crash ? rates.slice(-Math.round(1.5 * 120)) : [];
  const yaw = settled.length ? settled.reduce((a, r) => a + r.r, 0) / settled.length : NaN;
  const made = Number.isFinite(yaw) ? (rates.find((r) => r.r >= 0.9 * yaw)?.t ?? NaN) : NaN;
  const bite = Number.isFinite(yaw) ? (rates.find((r) => r.r >= 0.25 * yaw)?.t ?? NaN) : NaN;
  return {
    v,
    steer,
    dip,
    felt,
    bite,
    made,
    radius: Number.isFinite(yaw) && yaw > 1e-3 ? v / yaw : Infinity,
    lean: n > 0 && !s.crash ? (Math.abs(lean) / n) * DEG : NaN,
    crash: s.crash,
    crashAt: s.crash ? s.t - AT : NaN,
  };
}

export const SPEEDS = [3, 5, 8, 11, 14, 17];
export const THROWS = [0.2, 0.4, 0.6, 0.7, 0.8, 0.9, 1];

/** The flip map: every speed against every throw. */
export function flipMap(ride: BikeRide = RIDDEN): SteerStep[] {
  const out: SteerStep[] = [];
  for (const v of SPEEDS) for (const s of THROWS) out.push(steerStep(v, s, { ride }));
  return out;
}

export { RIDDEN, RAW };
export const LOCK = BIKE.steer.lock;
