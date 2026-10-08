// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT'S HANDS ON THE HOT AIR BALLOON (`balloon.ts`) — what a pre-roll, a
// lab and the sim fly it on: the skier's own input, as the player's is. It
// looks along its drift for the highest snow it will cross, and flies by
// the TRIM (`balloonTrim`, the envelope's temperature at which the balloon
// weighs nothing where it is), as a pilot reads his burns: the climb it
// wants off the height it holds over that snow, the temperature that
// climb asks over the trim, and the burner held open below it — the valve
// pulled only when it runs well over. It never jumps and never steps out.
// Pure over the state.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { balloonTrim } from "./balloon.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "./state.ts";

/** The height it holds over the snow, m, when not asked another. */
export const PILOT_HOLD = 120;
/** The climb asked a metre short of it, per s, and the most it climbs and
 * sinks at, m/s. */
const PER_METRE = 1 / 25;
const CLIMB_MOST = 2.5;
const SINK_MOST = 1.5;
/** The temperature asked over the trim for each m/s of climb wanted, K, and
 * for each m/s the climb is short of it (the lag looked past). */
const PER_CLIMB = 1.2;
const PER_SHORT = 2.5;
/** How far ahead it looks along its drift, s, in how many looks. */
const AHEAD = 40;
const LOOKS = 8;
/** How far over the aim before the valve is pulled, K. */
const OVER = 3;

/** The bot's controls in the basket for this step, holding `hold` m over
 * the snow. */
export function balloonPilot(state: GameState, hold = PILOT_HOLD): SkierInput {
  const b = state.balloon;
  if (!b || !b.aboard) return NEUTRAL_INPUT;
  // THE GROUND AHEAD: the highest snow under where the drift carries it in
  // the next `AHEAD` s — the slope rises into a balloon faster than it climbs.
  let ground = state.level.groundAt(b.x, b.z);
  for (let k = 1; k <= LOOKS; k++) {
    const s = (AHEAD * k) / LOOKS;
    ground = Math.max(ground, state.level.groundAt(b.x + b.vx * s, b.z + b.vz * s));
  }
  const want = clamp((ground + hold - b.y) * PER_METRE, -SINK_MOST, CLIMB_MOST);
  const aim = balloonTrim(state, b) + PER_CLIMB * want + PER_SHORT * (want - b.climb);
  const tuck = b.temp < aim ? 1 : 0;
  const brake = b.temp > aim + OVER ? clamp((b.temp - aim - OVER) / 4, 0, 1) : 0;
  return { ...NEUTRAL_INPUT, tuck, brake };
}
