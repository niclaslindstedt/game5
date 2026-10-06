// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT ON A SLOPESTYLE COURSE (R39) — a competent skier's run: down the
// course's straight line, holding a LINE across it, as a speed skier
// holds a track's middle (`speed-ski-steer.ts`) but looking nearer, since a
// rail section's two lines are a dozen metres apart.
//
// THE RAIL SECTIONS. He picks the RAIL in each (the harder line, so the
// judges' better marks), stood up and checking his speed down to the
// section's design speed before it, and rides it: the first a 50-50, the
// second swapped onto a slide (the edge tapped), the third pressed onto
// its nose. Nothing at the end: he turns out the near way and lands
// straight.
//
// THE JUMPS. Tucked down each approach and never checking it (the course
// is built for the speed a tucked skier carries), the middle of the course
// held, and in the air a spin the strokes can turn: a 360 one way off the
// first jump, the other way off the second, a 720 off the last — the
// strokes refuse what the air left cannot turn, so a short flight is a
// smaller trick, never a crash.

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { SLOPESTYLE_RULE } from "../mapgen/trick-rules.ts";
import { nearestTrackPoint } from "../mapgen/query.ts";
import type { Level, TrackHit } from "../mapgen/types.ts";
import { techniqueOf } from "../game/defs/technique.ts";
import { edgeLockAt, edgeMostOf } from "../game/limits.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "../game/state.ts";

/** THE BOT'S HOLD ON A LINE: over how far he comes back onto it, m — at
 * rest and per m/s — and how far ahead his own turn is read, s; how far
 * before a rail section he takes its line, m; how much
 * over a rail section's design speed he lets himself go, m/s, before he
 * checks it; and the speed under which he pushes himself on with his
 * poles, m/s. */
export const SLOPE_STEER = {
  lookBase: 2,
  lookPerSpeed: 0.5,
  ahead: 40,
  yawLead: 0.3,
  over: 1,
  crawl: 3,
} as const;

/** The taps of the edge off each jump (`strokes.ts`: each a half turn),
 * and which way. */
const SPINS: readonly { taps: number; way: 1 | -1 }[] = [
  { taps: 2, way: 1 },
  { taps: 2, way: -1 },
  { taps: 4, way: 1 },
];

/** The input that skis `state`'s skier down the slopestyle course, or null
 * on a map with none. `on` is where he stands on it. */
export function slopestyleInput(state: GameState, on: TrackHit): SkierInput | null {
  const level = state.level;
  const course = level.slopestyle;
  if (!course || !state.rules.course) return null;
  const c = state.skier;
  const K = SLOPE_STEER;
  // ON A JIB: the section's trick, nothing else.
  const ride = c.jib;
  if (ride) {
    const jib = level.jibs?.[ride.index];
    const section = jib?.section ?? 1;
    const tap = section === 2 && ride.u > 1 && ride.u < 1.6 && ride.swaps === 0;
    return { ...NEUTRAL_INPUT, steer: tap ? 1 : 0, lean: section === 3 ? -1 : 0 };
  }
  const i = course.sections.findIndex((s) => on.s >= s.from && on.s < s.to);
  const here = course.sections[i];
  // IN THE AIR off a jump: the spin the strokes will turn.
  if (c.airborne && here?.kind === "jump" && here.lip !== undefined && on.s > here.lip - 2) {
    const j = course.sections.filter((s) => s.kind === "jump").indexOf(here);
    const spin = SPINS[j] ?? SPINS[0];
    const t = c.airTime;
    let tap = false;
    for (let n = 0; n < spin.taps; n++) {
      const at = 0.15 + n * 0.22;
      if (t > at && t < at + 0.1) tap = true;
    }
    return { ...NEUTRAL_INPUT, steer: tap ? spin.way : 0 };
  }
  if (c.airborne) return { ...NEUTRAL_INPUT };
  // THE LINE: the rail of the next rail section whose rail is still ahead
  // of him — taken as soon as the last one is behind him — or the middle.
  const next = course.sections[i + 1];
  let lateral = 0;
  const rails = level.jibs ?? [];
  for (const jib of rails) {
    if (jib.kind !== "rail") continue;
    const end = jib.points[jib.points.length - 1];
    const s0 = course.sections[jib.section - 1].from;
    if (on.s > s0 - K.ahead && arcOf(level, end.x, end.z) > on.s) {
      lateral = jib.line * course.lines;
      break;
    }
  }
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
  // THE SPEED: stood up and checked into a rail section, tucked into a
  // jump.
  const toRails = here?.kind === "rail" || next?.kind === "rail";
  if (toRails) {
    const fast = c.speed > SLOPESTYLE_RULE.rails.speed + K.over;
    // At a crawl — off the start platform — the tuck is the poles' push.
    return {
      ...NEUTRAL_INPUT,
      steer: held,
      brake: fast ? 0.6 : 0,
      tuck: c.speed < K.crawl ? 1 : 0,
    };
  }
  return { ...NEUTRAL_INPUT, steer: held, tuck: 1 };
}

/** The arc down the course a point stands at, m. */
function arcOf(level: Level, x: number, z: number): number {
  return nearestTrackPoint(level, x, z, scratch).s;
}
const scratch: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
