// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FALL MATRIX — a skier dropped from a height onto a face of a given
// steepness and snow, landing on his skis or on his body, many times over,
// and what came of it: how often he DIED (a run with the INJURIES switch
// on, `gore.ts`), the median worst AIS and injury severity score, how often
// he was thrown. `make falls` (`scripts/fall-lab.mjs`) charts it and
// `tests/fall_lab_test.ts` holds the corners of it to what a fall from a
// height does to a body (`docs/riding.md` § *Falls from a height*).
//
// THE STAGING. The bench is a plane falling away down +z at `slope`
// degrees, its snow the ground's (the injury bench's four: a deep day's
// powder, a day's loose snow, the groomer, ice). The skier comes down from
// `height` m over the snow he meets at the speed of a REAL fall from it,
// √(2gh) — the injury lab's convention, so a row reads in real metres —
// going `along` m/s across the ground as well (a chair's speed). How he
// meets it:
//   - FEET: on his skis, laid parallel to the face — the landing a skier
//     dropping a cliff aims for;
//   - CROOKED: on his skis, the tails 20° first and rolled 17° — a jump off
//     a chair or a cliff that did not come down true;
//   - BACK, SIDE, HEAD, SEAT: thrown, his body posed as it falls (flat on
//     his back, on his left side, head first, sat back) — the fall of a
//     man who has lost his skis or never had them under him.

import {
  NEUTRAL_INPUT,
  RAGDOLL,
  TUNING,
  bodyThrown,
  createGame,
  flightGravity,
  letGo,
  placeRun,
  severityOf,
  step,
  type GameState,
  type Level,
} from "@engine";
import { fromAxisAngle, multiply, type Quat } from "@niclaslindstedt/oss-game-framework/core/quat";
import { shapedLevel } from "./synthetic.ts";
import type { Ground } from "./injury-stage.ts";

export type { Ground };

/** HOW HE MEETS THE SNOW (the header's). */
export type FallHow = "feet" | "crooked" | "back" | "side" | "head" | "seat";

export type FallCase = {
  height: number;
  /** The face's steepness, degrees. */
  slope: number;
  ground: Ground;
  how: FallHow;
  /** Speed across the ground as he falls, m/s. */
  along?: number;
};

export type FallTrial = {
  dead: boolean;
  worst: number;
  iss: number;
  thrown: boolean;
  /** The landing's load, g (0 for none — a body thrown). */
  land: number;
  /** The hardest blow, g. */
  peak: number;
};

export type FallRates = {
  /** The share of the trials he died in. */
  dead: number;
  /** The median worst AIS and injury severity score. */
  worst: number;
  iss: number;
  thrown: number;
  land: number;
  peak: number;
};

export const FALL_TRIALS = 16;
/** How long a trial runs, s: the fall, the blow and the slide after it. */
const RUN = 3;
const AT = { x: 300, z: 300 };
const g = TUNING.g;
const dt = TUNING.dt;
const R = RAGDOLL;
/** A thrown body is staged this far over the snow, m. */
const LEAD = 0.3;

const benches = new Map<string, Level>();

/** The face: a plane down +z at `slope` degrees. */
function benchOf(slope: number, ground: Ground): Level {
  const key = `${slope}|${ground}`;
  let level = benches.get(key);
  if (level) return level;
  const k = Math.tan((slope * Math.PI) / 180);
  const packed = ground === "groomed" || ground === "ice" ? 1 : 0;
  level = shapedLevel((_x, z) => -k * (z - AT.z), { packed, size: 600, cell: 1 });
  if (ground === "ice") level.iceAt = () => 1;
  benches.set(key, level);
  return level;
}

/** A falling body's attitude in the world for a pose, heading +z (the
 * standing body's forward lean, `ragdoll.ts`'s 0.4, taken out). */
function poseOf(how: FallHow): Quat {
  const unlean = fromAxisAngle(1, 0, 0, -0.4);
  const by = (q: Quat): Quat => multiply(q, unlean);
  switch (how) {
    case "head":
      return by(fromAxisAngle(1, 0, 0, Math.PI));
    case "back":
      return by(fromAxisAngle(1, 0, 0, -Math.PI / 2));
    case "side":
      return by(fromAxisAngle(0, 0, 1, Math.PI / 2));
    default:
      // Sat back, the trunk upright over the seat.
      return multiply(fromAxisAngle(1, 0, 0, -0.15), unlean);
  }
}

/** A case stood up for its trial, its run seed `trial + 1`. */
export function stageFall(c: FallCase, trial: number): GameState {
  const level = benchOf(c.slope, c.ground);
  const state = createGame({
    level,
    seed: trial + 1,
    rivals: 0,
    countdown: 0,
    quiet: true,
    snowDepth: c.ground === "powder" ? 2 : 1,
    assist: { yaw: 1, air: 0 },
    gore: true,
  });
  const along = c.along ?? 5;
  const theta = (c.slope * Math.PI) / 180;
  if (c.how === "feet" || c.how === "crooked") {
    // As the injury bench stages a drop: the CoG a few metres up, falling
    // as fast as meets the snow at a real fall's speed from `height` under
    // the air's own gravity for the rest of the way.
    const over = Math.min(c.height, Math.max(3, 0.4 * Math.sqrt(2 * g * c.height)));
    const rest = over - state.skier.spec.cogHeight;
    const vy2 = 2 * g * c.height - 2 * flightGravity(state.rules) * rest;
    const crooked = c.how === "crooked";
    placeRun(state, {
      x: AT.x,
      z: AT.z,
      heading: 0,
      speed: along,
      height: over,
      vy: -Math.sqrt(Math.max(0, vy2)),
      pitch: -theta + (crooked ? 0.35 : 0),
      roll: crooked ? 0.3 : 0,
    });
    return state;
  }
  placeRun(state, { x: AT.x, z: AT.z - 40, heading: 0 });
  const down = Math.sqrt(Math.max(0, 2 * g * c.height - 2 * g * LEAD));
  const thrown = bodyThrown(
    "landing",
    poseOf(c.how),
    AT.x,
    5,
    AT.z,
    { x: 0, y: -down, z: along },
    { x: 0, y: 0, z: 0 },
    0,
  );
  const P = thrown.points;
  const L = thrown.last;
  const radius = (i: number): number =>
    i === R.head
      ? TUNING.crash.body.head
      : i <= R.shoulderR
        ? TUNING.crash.radius
        : TUNING.crash.body.limb;
  let low = Infinity;
  for (let i = 0; i < R.count; i++) {
    const gap = P[3 * i + 1] - radius(i) - level.groundAt(P[3 * i], P[3 * i + 2]);
    low = Math.min(low, gap);
  }
  const dy = LEAD - low;
  for (let i = 0; i < R.count; i++) {
    P[3 * i + 1] += dy;
    L[3 * i + 1] += dy;
  }
  thrown.y += dy;
  thrown.skis = letGo(state, state.skier, 1, 0);
  state.skier.thrown = thrown;
  return state;
}

export function runFall(c: FallCase, trial: number): FallTrial {
  const state = stageFall(c, trial);
  const out: FallTrial = { dead: false, worst: 0, iss: 0, thrown: false, land: 0, peak: 0 };
  for (let i = 0; i < Math.round(RUN / dt); i++) {
    step(state, NEUTRAL_INPUT);
    for (const e of state.events) {
      if (e.kind === "wipeout") out.thrown = true;
      else if (e.kind === "land") out.land = Math.max(out.land, e.g);
    }
    // Never stood back up: a reset would mend him.
    const t = state.skier.thrown;
    if (t) t.t = Math.min(t.t, 0.5);
  }
  const body = state.skier.body;
  out.dead = (state.gore?.mortal ?? -1) >= 0;
  out.worst = body.injuries.reduce((m, h) => Math.max(m, h.ais), 0);
  out.iss = severityOf(body);
  out.peak = body.peak;
  if (c.how !== "feet" && c.how !== "crooked") out.thrown = true;
  return out;
}

export function fallRates(c: FallCase, trials = FALL_TRIALS): FallRates {
  const all: FallTrial[] = [];
  for (let k = 0; k < trials; k++) all.push(runFall(c, k));
  const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1];
  return {
    dead: all.filter((t) => t.dead).length / trials,
    worst: median(all.map((t) => t.worst)),
    iss: median(all.map((t) => t.iss)),
    thrown: all.filter((t) => t.thrown).length / trials,
    land: median(all.map((t) => t.land)),
    peak: median(all.map((t) => t.peak)),
  };
}
