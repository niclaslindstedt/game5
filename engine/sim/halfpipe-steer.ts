// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT IN A HALFPIPE (R39) — a competent pipe skier's run: down the
// middle onto the pipe's pitch and into its mouth, then wall to wall —
// across the flat at an angle off the pipe's line (`PIPE_STEER.approach`)
// so the wall carries him up and off its vert, his skis left alone up the
// wall (the wall turns him; `pipe-air.ts` turns him round in the air), and
// across to the OTHER wall when the snow takes him back — and in the air a
// trick a hit off his plan (`HITS`): a grab, spins both ways, an
// alley-oop. The strokes refuse what the air left cannot turn, so a low
// hit is a smaller trick, never a crash. Out of the pipe's foot, straight
// down the middle to the finish line.

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { pipeCoords, wallShare } from "../mapgen/pipe.ts";
import { techniqueOf } from "../game/defs/technique.ts";
import { edgeLockAt, edgeMostOf } from "../game/limits.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "../game/state.ts";
import type { TrackHit } from "../mapgen/types.ts";

const RAD = Math.PI / 180;

/** THE BOT'S HOLD IN A PIPE: the angle he crosses the flat at off the
 * pipe's line, rad; how far ahead his line is read, s at his speed, and
 * the least, m; the speed he poles himself on under, m/s; and when the
 * first tap of a spin comes and how far apart the taps are, s. */
export const PIPE_STEER = {
  approach: 64 * RAD,
  look: 0.5,
  lookLeast: 4,
  crawl: 3,
  tapFrom: 0.3,
  tapEvery: 0.22,
} as const;

/** A HIT'S TRICK: half turns of spin (`taps`), which way — `natural` the
 * way down the pipe off the wall he left, `oop` uphill — and a grab. */
type Hit = { taps: number; way: "natural" | "oop"; grab: boolean };
const HITS: readonly Hit[] = [
  { taps: 0, way: "natural", grab: true },
  { taps: 2, way: "natural", grab: false },
  { taps: 2, way: "oop", grab: false },
  { taps: 4, way: "natural", grab: false },
  { taps: 2, way: "natural", grab: true },
  { taps: 4, way: "natural", grab: false },
];

/** The input that rides `state`'s skier through a halfpipe run, or null on
 * a map with no pipe. `on` is where he stands on its line. */
export function halfpipeInput(state: GameState, on: TrackHit): SkierInput | null {
  const level = state.level;
  const course = level.halfpipe;
  const p = level.pipe;
  if (!course || !p) return null;
  const c = state.skier;
  const K = PIPE_STEER;
  const at = pipeCoords(p, c.x, c.z);
  const hits = state.tricks.flights.filter((f) => f.pipe);
  const last = hits[hits.length - 1]?.pipe?.side ?? -1;
  // IN THE AIR: the hit's trick.
  if (c.airborne) {
    const side = Math.sign(at.across) || 1;
    const hit = HITS[hits.length % HITS.length];
    const natural = -side;
    const way = hit.way === "oop" ? -natural : natural;
    let tap = false;
    for (let n = 0; n < hit.taps; n++) {
      const t0 = K.tapFrom + n * K.tapEvery;
      if (c.airTime > t0 && c.airTime < t0 + 0.1) tap = true;
    }
    const grab = hit.grab && c.airTime > K.tapFrom && c.vy > -4;
    return { ...NEUTRAL_INPUT, steer: tap ? way : 0, trick: grab, tuck: 0.6 };
  }
  const inPipe = wallShare(p, at.along) > 0.6 && at.along < p.to - 25;
  const s = p.section;
  const onWall = Math.abs(at.across) > s.flat + 1;
  const goingUp =
    c.vy > 0 &&
    onWall &&
    Math.sign(at.across) === Math.sign(c.vx * Math.cos(p.heading) - c.vz * Math.sin(p.heading));
  // THE PUMP: folded on the flat and in the air, stood up through the
  // transitions, where the snow presses hardest.
  const pump = inPipe && Math.abs(at.across) < s.flat + 0.5 ? 1 : 0;
  // UP A WALL: nothing but the pump — the wall turns him.
  if (inPipe && goingUp) return { ...NEUTRAL_INPUT, tuck: pump };
  // THE LINE: across the flat toward the other wall, or down the middle.
  const v = Math.max(4, c.speed);
  const travel = Math.atan2(c.vx, c.vz);
  let want: number;
  if (inPipe) {
    const wall = -last;
    const aim = p.heading + wall * K.approach;
    const look = Math.max(K.lookLeast, K.look * v);
    want = (-2 * angleDiff(aim, travel)) / look;
  } else {
    const look = Math.max(K.lookLeast, K.look * v);
    want = (-2 * angleDiff(p.heading, travel)) / look - (on.lateral * 2) / (look * look);
  }
  const spec = c.spec;
  const T = techniqueOf(state.rules);
  const lock = Math.max(0.05, Math.min(edgeMostOf(spec, T), edgeLockAt(spec, c.speed, T)));
  const edge = Math.sign(want) * Math.atan(Math.abs(want) * spec.sidecut);
  return {
    ...NEUTRAL_INPUT,
    steer: clamp(edge / lock, -1, 1),
    tuck: c.speed < K.crawl || !inPipe ? 1 : pump,
  };
}
