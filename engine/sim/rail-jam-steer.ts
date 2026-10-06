// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT IN A RAIL JAM (R40) — a competent jib skier's session: every hit
// a different feature of the set, left to right and round again, so the
// session's variety is there, ridden down its line as a slopestyle rail
// section's is (`slopestyle-steer.ts`): stood up, checked to the set's
// design speed, and on the feature a trick it can hold —
//
//   the down box      a nose press held to the end
//   the flat-down     swapped onto a slide (the edge tapped)
//   the kinked box    a tail press
//   the kinked rail   a 50-50 turned out a half turn (the edge held at the
//                     end): ridden away switch
//   the rainbow       swapped onto a slide
//
// — then straight on to the finish line, where the jam stands him back on
// the platform. At a crawl off the platform the tuck is the poles' push.

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { jibLength } from "../game/jib.ts";
import { techniqueOf } from "../game/defs/technique.ts";
import { edgeLockAt, edgeMostOf } from "../game/limits.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "../game/state.ts";
import type { TrackHit } from "../mapgen/types.ts";

/** THE BOT'S HOLD ON A LINE (as `SLOPE_STEER`): over how far he comes back
 * onto it, m — at rest and per m/s — how far ahead his own turn is read,
 * s; how much over the design speed he lets himself go, m/s, before he
 * checks it; the speed under which he poles himself on, m/s; and how long
 * before a feature's end he holds the edge for a turn out, s. */
export const RAIL_STEER = {
  lookBase: 1.5,
  lookPerSpeed: 0.25,
  yawLead: 0.3,
  over: 0.8,
  crawl: 3,
  outHold: 0.5,
} as const;

/** What the bot does on each feature, left to right. */
type Ride = "nose" | "swap" | "tail" | "out" | "fifty";
const RIDES: readonly Ride[] = ["nose", "swap", "tail", "out", "swap"];

/** The input that rides `state`'s skier through a rail jam's hit, or null
 * on a map with no set. `on` is where he stands on it. */
export function railJamInput(state: GameState, on: TrackHit): SkierInput | null {
  const level = state.level;
  const set = level.railJam;
  const jibs = level.jibs;
  if (!set || !jibs || jibs.length === 0 || !state.rules.jam) return null;
  const c = state.skier;
  const K = RAIL_STEER;
  const pick = (state.jam?.hits.length ?? 0) % jibs.length;
  // ON THE FEATURE: its trick, nothing else.
  const ride = c.jib;
  if (ride) {
    const jib = jibs[ride.index];
    const what = RIDES[ride.index] ?? "fifty";
    const togo = jib ? (jibLength(jib) - ride.u) / Math.max(0.5, ride.v) : 0;
    const tap = what === "swap" && ride.u > 0.8 && ride.u < 1.4 && ride.swaps === 0;
    const out = what === "out" && togo < K.outHold;
    return {
      ...NEUTRAL_INPUT,
      steer: tap ? 1 : out ? 0.4 : 0,
      lean: what === "nose" ? -1 : what === "tail" ? 1 : 0,
    };
  }
  if (c.airborne) return { ...NEUTRAL_INPUT };
  // THE LINE: the feature picked for this hit, held to the finish.
  const lateral = jibs[pick].line * set.lines;
  const v = Math.max(4, c.speed);
  const heading = level.track.points[0].heading;
  const yaw = rotate(c.q, { x: c.wx, y: c.wy, z: c.wz }).y;
  const facing = c.switched ? c.heading + Math.PI : c.heading;
  const turned = angleDiff(heading, facing + yaw * K.yawLead);
  const look = K.lookBase + K.lookPerSpeed * v;
  const want = -(2 * turned) / look - (on.lateral - lateral) / (look * look);
  const spec = c.spec;
  const T = techniqueOf(state.rules);
  const lock = Math.max(0.05, Math.min(edgeMostOf(spec, T), edgeLockAt(spec, c.speed, T)));
  const edge = Math.sign(want) * Math.atan(Math.abs(want) * spec.sidecut);
  const held = clamp(edge / lock, -1, 1);
  // THE SPEED: checked to the design speed before the features, never
  // after them.
  const before = on.s < set.features + 2;
  const fast = before && c.speed > set.speed + K.over;
  return {
    ...NEUTRAL_INPUT,
    steer: held,
    brake: fast ? 0.6 : 0,
    tuck: c.speed < K.crawl ? 1 : 0,
  };
}
