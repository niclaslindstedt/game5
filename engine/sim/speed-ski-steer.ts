// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT ON A SPEED TRACK (R34) — a speed skier's whole run: out of the
// house on the push the tuck throws him into, and from there FOLDED, the
// skis flat, straight down the middle of the track. He holds it with the
// smallest corrections a body in a tuck makes — the downhiller's hold on a
// line (`downhill-steer.ts`) with the line the track's middle and no bend
// to feed forward, read far ahead, the edge he asks a share of the speed
// skier's few degrees — and never brakes: the timing zone ends his run,
// and past it the run-out's stand-up and skid are the engine's
// (`run.ts`), as they are for every racer home.
//
// A BIG AIR JUMP (R37) is skied the same way: its line is straight down the
// face too, and a skier drops in tucked and straight to carry the jump's
// design speed off the lip — never checking it, which would knuckle him on
// the table.
//
// An AERIALS SITE (R44) too, its in-run and its out-run; in the air the
// jump declared is `aerials-steer.ts`'s.
//
// A KNUCKLE (R38) too, down to its deck, and there the knuckle huck's hit:
// the legs loaded for a pop, the skis pressed onto their tips and BUTTERED
// round a quarter turn and more (`butter.ts`), the lean short of the
// stroke's gate so no flip is thrown, and the pop sprung at the knuckle —
// the throw squares the butter in the air, a NOSE BUTTER 180 or 360.

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import type { TrackHit } from "../mapgen/types.ts";
import { techniqueOf } from "../game/defs/technique.ts";
import { edgeLockAt, edgeMostOf } from "../game/limits.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "../game/state.ts";
import { aerialsAirInput } from "./aerials-steer.ts";

/** THE SPEED SKIER'S HOLD ON THE TRACK'S MIDDLE. */
export const SPEED_SKI_STEER = {
  /** Over how far he comes back onto the middle, m — at rest and per m/s:
   * at 200 km/h a correction is spread over a hundred metres and more. */
  lookBase: 15,
  lookPerSpeed: 2,
  /** How far ahead his own turn is read, s. */
  yawLead: 0.3,
} as const;

/** THE BOT'S KNUCKLE HIT, m before the knuckle: the press set at
 * `press`, the butter wound from `wind`, the legs loaded from `load` (a
 * small pop: a knuckle is ollied, not launched), the press and the butter
 * let go at `release` and the pop sprung at `pop`. */
export const KNUCKLE_HIT = { load: 5, press: 10, wind: 7, release: 0.4, pop: 0.4 } as const;

/** The input that skis `state`'s skier down the speed track or the big air
 * jump, or null on a map with neither. `on` is where he stands on it. */
export function speedSkiInput(state: GameState, on: TrackHit): SkierInput | null {
  const level = state.level;
  const knuckle = level.knuckleHuck;
  if (!level.speedSki && !level.bigAir && !knuckle && !level.aerials) return null;
  if (!state.rules.course && !state.rules.jam) return null;
  const c = state.skier;
  const K = SPEED_SKI_STEER;
  const v = Math.max(5, c.speed);
  const heading = level.track.points[0].heading;
  const yaw = rotate(c.q, { x: c.wx, y: c.wy, z: c.wz }).y;
  // Riding away SWITCH, he steers the way he goes (`switch.ts`).
  const facing = c.switched ? c.heading + Math.PI : c.heading;
  const turned = angleDiff(heading, facing + yaw * K.yawLead);
  const look = K.lookBase + K.lookPerSpeed * v;
  const want = -(2 * turned) / look - on.lateral / (look * look);
  const spec = c.spec;
  const T = techniqueOf(state.rules);
  const lock = Math.max(0.05, Math.min(edgeMostOf(spec, T), edgeLockAt(spec, c.speed, T)));
  const edge = Math.sign(want) * Math.atan(Math.abs(want) * spec.sidecut);
  // OFF A BIG AIR KICKER, a 360: two taps of the edge early in the flight
  // (`strokes.ts`), the hands off it after.
  if (level.bigAir && c.airborne && state.rules.stunts) {
    const t = c.airTime;
    const tap = (t > 0.2 && t < 0.3) || (t > 0.45 && t < 0.55);
    return { ...NEUTRAL_INPUT, steer: tap ? 1 : 0, tuck: 0 };
  }
  // OFF AN AERIALS KICKER, the jump declared (`aerials-steer.ts`).
  const flown = aerialsAirInput(state);
  if (flown) return flown;
  const held = clamp(edge / lock, -1, 1);
  if (knuckle && state.rules.butters) {
    const H = KNUCKLE_HIT;
    const to = knuckle.knuckle - on.s;
    // In the air the hands are off: the throw squares the butter.
    if (c.airborne) return { ...NEUTRAL_INPUT };
    if (to < 0 || to > H.press) return { ...NEUTRAL_INPUT, steer: held, tuck: 1 };
    return {
      ...NEUTRAL_INPUT,
      jump: to < H.load && to > H.pop,
      lean: to < H.press && to > H.release ? -0.7 : 0,
      steer: to < H.wind && to > H.release ? 1 : held,
    };
  }
  return { ...NEUTRAL_INPUT, steer: held, tuck: 1 };
}
