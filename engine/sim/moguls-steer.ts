// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT ON A MOGULS COURSE (R40) — a competent mogul skier's run: out of
// the start onto the zipper line, then a turn on every mogul — the edge
// swung from side to side on the moguls' own rhythm, the line held to the
// track's middle — his speed held to a pace he can absorb with a skid set
// against the bumps, his legs FOLDED up each mogul's face and EXTENDED down
// its back (the tuck read as the fold), straight and stood up through each
// air bump's run-in, and off each a trick off his plan (`AIRS`): a 360 off
// the top air and a back flip off the bottom one — two different jumps, as
// the rules want. The strokes refuse what the air left cannot turn, so a
// short air is a smaller trick, never a crash. Through the finish area,
// straight to the line.

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { fieldCoords, mogulShare, mogulsAt } from "../mapgen/mogul-field.ts";
import { techniqueOf } from "../game/defs/technique.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { edgeLockAt, edgeMostOf } from "../game/limits.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "../game/state.ts";
import type { TrackHit } from "../mapgen/types.ts";

/** THE BOT'S HOLD ON A MOGUL LINE: the speed he skis it at, m/s, and how
 * hard he skids over it; how far he swings off the fall line each turn,
 * rad; how far ahead the line is read, m; the speed he poles himself up
 * to; how far ahead of a crest he folds, m; when in the air his taps
 * come and how far apart, s; and how far past an air bump's lip he starts
 * to scrub the flight's speed off on its landing, m. */
export const MOGUL_STEER = {
  pace: 9,
  skid: 0.6,
  swing: 0.35,
  look: 6,
  crawl: 4,
  fold: 0.6,
  tapFrom: 0.15,
  tapEvery: 0.22,
  settle: 4,
} as const;

/** AN AIR'S TRICK: half turns of spin (`taps`, the edge), whole flips
 * (`flips`, the lean back) and a grab. */
type Air = { taps: number; flips: number; grab: boolean };
const AIRS: readonly Air[] = [
  { taps: 2, flips: 0, grab: false },
  { taps: 0, flips: 1, grab: false },
];

/** The input that skis `state`'s skier down a moguls course, or null on a
 * map with none — or in a flight with no trick in it, which the bot's own
 * hands level to the landing. `on` is where he stands on its line. */
export function mogulsInput(state: GameState, on: TrackHit): SkierInput | null {
  const level = state.level;
  const course = level.moguls;
  const f = level.bumps;
  if (!course || !f) return null;
  const c = state.skier;
  const K = MOGUL_STEER;
  const at = fieldCoords(f, c.x, c.z);
  // IN THE AIR: off an air bump, its trick; off a mogul, nothing.
  if (c.airborne) {
    const air = course.airs.findIndex((a) => at.along > a.foot - 2 && at.along < a.landed + 4);
    // A flight the strokes will not turn (`strokes.ts`: one that left the
    // snow climbing too slowly), or a hop off a mogul, is the bot's own:
    // levelled to the landing.
    if (air < 0 || c.launchVy < TUNING.tricks.launch) return null;
    const plan = AIRS[air % AIRS.length];
    let steer = 0;
    let lean = 0;
    for (let n = 0; n < plan.taps; n++) {
      const t0 = K.tapFrom + n * K.tapEvery;
      if (c.airTime > t0 && c.airTime < t0 + 0.08) steer = 1;
    }
    if (plan.flips > 0 && c.airTime > K.tapFrom && c.airTime < K.tapFrom + 0.08) lean = 1;
    return { ...NEUTRAL_INPUT, steer, lean, trick: plan.grab && c.airTime > K.tapFrom };
  }
  const v = Math.max(1, c.speed);
  const travel = Math.atan2(c.vx, c.vz);
  const onField = mogulShare(f, at.along) > 0.2 && at.along > course.from;
  const nearAir = course.airs.some((a) => at.along > a.foot - 8 && at.along < a.landed);
  // THE TURN: the edge swung across the fall line once a mogul, its phase
  // the moguls' own, so every turn is made on a bump's shoulder.
  const phase = (2 * Math.PI * (at.along - f.from)) / f.spacing;
  const side = onField && !nearAir ? Math.sign(Math.sin(phase)) || 1 : 0;
  const aim = f.heading + side * K.swing - at.across * 0.08;
  const look = Math.max(K.look, 0.5 * v);
  const want = (-2 * angleDiff(aim, travel)) / look - (on.lateral * 1.5) / (look * look);
  const spec = c.spec;
  const T = techniqueOf(state.rules);
  const lock = Math.max(0.05, Math.min(edgeMostOf(spec, T), edgeLockAt(spec, c.speed, T)));
  const edge = Math.sign(want) * Math.atan(Math.abs(want) * spec.sidecut);
  // THE PACE: a skid set against the bumps over it.
  // ...and on an air bump's landing, once he is down on it, the speed the
  // flight gave him scrubbed back before the moguls start again: met at
  // 13 m/s, past what the legs fold to, they throw him.
  const landing = course.airs.some(
    (a) => at.along > a.lip + K.settle && at.along < a.landed + f.ease,
  );
  const brake = (onField && !nearAir) || landing ? clamp((c.speed - K.pace) * K.skid, 0, 1) : 0;
  // THE LEGS: folded up a mogul's face (the snow ahead rising toward the
  // crest), extended down its back.
  const ahead = mogulsAt(f, at.along + K.fold, at.across) - mogulsAt(f, at.along, at.across);
  const fold = onField && !nearAir ? clamp(ahead * 4, 0, 1) : 0;
  return {
    ...NEUTRAL_INPUT,
    steer: clamp(edge / lock, -1, 1),
    brake,
    tuck: c.speed < K.crawl ? 1 : fold,
  };
}
