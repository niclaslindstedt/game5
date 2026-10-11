// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICK GOAL — one kicker of the map and three goals off it: a clean
// air for bronze, and for silver and gold a trick the kicker's size allows
// — a 360 off a small one, a 720 or a flip off a big one. Judged off the
// flights the engine files on every run (`state.tricks.flights`): a flight
// that left the snow at the kicker's lip and LANDED whole, read as a trick
// (`readTrick`), earns the best tier whose goal it meets.
//
// A kicker is named by where its lip stands (`trick:<x>:<z>`, metres):
// the same kicker is a course's `K3` on one map and its run's `4K2` on the
// same mountain stood up on another course, and its lip is the one thing
// that does not move.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { Kicker, Level } from "../../mapgen/types.ts";
import { CHALLENGES } from "../defs/challenges.ts";
import { readTrick } from "../judge.ts";
import type { FlightRecord } from "../flight-record.ts";
import type { GameState } from "../state.ts";
import { byId, dealtRuns, onRun } from "./common.ts";
import {
  medalOf,
  type ChallengeBase,
  type ChallengeEvent,
  type ChallengeKind,
  type ChallengeWatch,
  type Medal,
} from "./types.ts";

const T = CHALLENGES.trick;

/** A TRICK GOAL: the spin at the least, degrees, the flips at the least,
 * and whether a grab must be held — all in one flight, landed whole. */
export type TrickGoal = { spin: number; flips: number; grab: boolean };

/** A TRICK CHALLENGE: the kicker (its lip, heading, size), the run it
 * stands on (null off the pistes), and the goal for each medal. Its value
 * is the tier met, 1 bronze … 3 gold. */
export interface TrickChallenge extends ChallengeBase {
  kind: "trick";
  kicker: { x: number; y: number; z: number; heading: number; height: number; width: number };
  size: "small" | "medium" | "big";
  run: string | null;
  goals: Record<Medal, TrickGoal>;
}

export function isTrick(c: ChallengeBase): c is TrickChallenge {
  return c.kind === "trick";
}

const AIR: TrickGoal = { spin: 0, flips: 0, grab: false };

/** The silver and gold a kicker of each size may ask, one pair dealt. */
const LADDERS: Record<TrickChallenge["size"], [TrickGoal, TrickGoal][]> = {
  small: [
    [
      { spin: 180, flips: 0, grab: false },
      { spin: 360, flips: 0, grab: false },
    ],
    [
      { spin: 0, flips: 0, grab: true },
      { spin: 360, flips: 0, grab: true },
    ],
  ],
  medium: [
    [
      { spin: 360, flips: 0, grab: false },
      { spin: 720, flips: 0, grab: false },
    ],
    [
      { spin: 360, flips: 0, grab: true },
      { spin: 0, flips: 1, grab: false },
    ],
  ],
  big: [
    [
      { spin: 720, flips: 0, grab: false },
      { spin: 360, flips: 1, grab: false },
    ],
    [
      { spin: 0, flips: 1, grab: true },
      { spin: 720, flips: 0, grab: true },
    ],
  ],
};

/** The stable key of a kicker: its lip to the metre. */
export function kickerKey(k: Pick<Kicker, "x" | "z">): string {
  return `${Math.round(k.x)}:${Math.round(k.z)}`;
}

function sizeOf(k: Kicker): TrickChallenge["size"] {
  return k.height < T.small ? "small" : k.height >= T.big ? "big" : "medium";
}

function dealTricks(level: Level, rng: Rng): TrickChallenge[] {
  const runs = dealtRuns(level);
  const kickers = (level.kickers ?? [])
    .filter((k) => !k.trick)
    .map((k) => ({ k, key: kickerKey(k) }))
    .sort((a, b) => byId(a.key, b.key));
  if (kickers.length === 0) return [];
  const want = Math.min(
    kickers.length,
    Math.max(T.least, Math.min(T.most, Math.round(kickers.length / T.perKickers))),
  );
  // One of each size there is first, the biggest first, then any.
  const order: typeof kickers = [];
  for (const size of ["big", "medium", "small"] as const) {
    const of = kickers.filter((e) => sizeOf(e.k) === size);
    if (of.length > 0) order.push(rng.pick(of));
  }
  const rest = kickers.filter((e) => !order.includes(e));
  while (rest.length > 0) order.push(rest.splice(Math.floor(rng.next() * rest.length), 1)[0]);
  return order.slice(0, want).map(({ k, key }) => {
    const size = sizeOf(k);
    const [silver, gold] = rng.pick(LADDERS[size]);
    // The run under its lip, read off the runs (sorted, so the same on
    // every course): the nearest whose snow it is on.
    let run: string | null = null;
    let best = Infinity;
    for (const r of runs) {
      const at = onRun(r, k.x, k.z, 80);
      if (at && at.out <= 0 && at.out < best) {
        best = at.out;
        run = r.id;
      }
    }
    return {
      id: `trick:${key}`,
      kind: "trick" as const,
      kicker: { x: k.x, y: k.y, z: k.z, heading: k.heading, height: k.height, width: k.width },
      size,
      run,
      goals: { bronze: AIR, silver, gold },
      medals: { bronze: 1, silver: 2, gold: 3 },
      better: "higher" as const,
      unit: "tier" as const,
    };
  });
}

/** Whether flight `f` meets `goal`. */
export function meetsGoal(f: FlightRecord, goal: TrickGoal): boolean {
  const r = readTrick(f);
  return r.spin >= goal.spin && r.flips >= goal.flips && (!goal.grab || r.grabs.length > 0);
}

/** The tier flight `f` earns off trick challenge `c`: 0 when it was not
 * off that kicker or did not land whole, else 1 … 3. */
export function tierOf(c: TrickChallenge, f: FlightRecord): number {
  if (f.outcome !== "landed" || f.x === undefined || f.z === undefined) return 0;
  const near = T.near + c.kicker.width / 2;
  if (hypot(f.x - c.kicker.x, f.z - c.kicker.z) > near) return 0;
  if (meetsGoal(f, c.goals.gold)) return 3;
  if (meetsGoal(f, c.goals.silver)) return 2;
  return meetsGoal(f, c.goals.bronze) ? 1 : 0;
}

function watchTricks(goals: readonly TrickChallenge[]): ChallengeWatch {
  let seen: GameState | null = null;
  let read = 0;
  return {
    step(state, out: ChallengeEvent[]) {
      const flights = state.tricks.flights;
      // A run first seen is judged from here on: what it flew before the
      // judge was armed (a pre-roll) is not the player's.
      if (seen !== state) read = flights.length;
      else if (flights.length < read) read = 0;
      seen = state;
      for (; read < flights.length; read++) {
        const f = flights[read];
        for (const c of goals) {
          const tier = tierOf(c, f);
          if (tier > 0) {
            out.push({ kind: "done", id: c.id, t: state.t, value: tier, medal: medalOf(c, tier) });
          }
        }
      }
    },
  };
}

export const TRICK_KIND: ChallengeKind<TrickChallenge> = {
  id: "trick",
  deal: dealTricks,
  watch: (_level, dealt) => watchTricks(dealt),
};
