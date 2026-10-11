// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT ON A SKI JUMPING HILL (R43) — the player's stand-in, a jumper of
// the field's middle: off the bar the moment the light is green, the crouch
// held down the tracks (`in-run.ts` holds it anyway), the TAKE-OFF pressed
// so the push ends at the edge but for a small error of his own — dealt
// off a hash of the map's seed, never the run's stream, within
// `SKI_JUMP_STEER.timing` s either way — and in the air his hands still:
// the assist holds the polar's best, the V and the roll, and makes the
// telemark. Down, he rides straight down the out-run's middle to the fall
// line, where the run's end stops him (`hockey-stop.ts`).

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { JUMP } from "../game/defs/ski-jump-flight.ts";
import { onHill, timeToEdge } from "../game/jump-inrun.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "../game/state.ts";

/** THE BOT'S HANDS ON A JUMP: the most his take-off is off perfect, s
 * (est.: a good jumper's spread), and how far ahead he holds the out-run's
 * middle, m. */
export const SKI_JUMP_STEER = { timing: 0.04, look: 30 } as const;

/** The bot's own error at the take-off on this map, s (late positive). */
export function botTiming(seed: number): number {
  let h = Math.imul((seed ^ 0x5a17) >>> 0, 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77) >>> 0;
  h ^= h >>> 13;
  return ((h >>> 0) / 4294967296 - 0.5) * 2 * SKI_JUMP_STEER.timing;
}

/** The input that jumps `state`'s hill, or null on any other run. */
export function skiJumpInput(state: GameState): SkierInput | null {
  const j = state.jump;
  if (!j || !state.rules.skiJump) return null;
  if (j.stage === "bar") return { ...NEUTRAL_INPUT, tuck: 1 };
  if (j.stage === "tracks") {
    // Pressed so the push ends at the edge, his error after it.
    const press = timeToEdge(state) <= JUMP.takeOff.push - botTiming(state.seed);
    return { ...NEUTRAL_INPUT, tuck: 1, jump: press };
  }
  if (j.stage === "air") return { ...NEUTRAL_INPUT, tuck: 1, trick: false };
  // Down: straight down the middle of the out-run.
  const c = state.skier;
  const f = state.level.bumps;
  if (!f) return { ...NEUTRAL_INPUT };
  const at = onHill(state, c.x, c.z);
  const aim = f.heading - Math.atan2(at.across, SKI_JUMP_STEER.look);
  const turn = angleDiff(c.heading, aim);
  return { ...NEUTRAL_INPUT, steer: clamp(turn * 2, -1, 1) };
}
