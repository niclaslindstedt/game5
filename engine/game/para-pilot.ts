// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT'S HANDS ON THE PARAMOTOR (`para.ts`) — what a pre-roll, a lab and
// the sim fly it on: the skier's own input, as the player's is. Off the
// summit it skis straight down the fall line on full throttle until the wing
// lifts it off; in the air it holds a working height over the snow on the
// throttle and turns the wing down the fall line on the toggles, never
// dropping the rig; a fold it pumps out on the brakes, twice a second.
// Pure over the state.

import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "./state.ts";

/** The height it holds over the snow, m, and how much throttle a metre
 * short of it asks. */
const HOLD = 60;
const PER_METRE = 1 / 40;
/** How hard a radian off the fall line pulls a toggle. */
const TURN = 1.2;
/** How deep a fold it pumps out, share of the wing. */
const PUMP = 0.1;
const normal = { x: 0, y: 1, z: 0 };

/** The bot's controls under the wing for this step. */
export function paraPilot(state: GameState): SkierInput {
  const p = state.para!;
  const c = state.skier;
  state.level.normalAt(c.x, c.z, normal);
  const flat = hypot(normal.x, normal.z);
  const heading = p.mode === "flown" && p.flying ? p.heading : c.heading;
  let off = flat > 0.02 ? Math.atan2(normal.x, normal.z) - heading : 0;
  off = Math.atan2(Math.sin(off), Math.cos(off));
  const steer = clamp(off * TURN, -1, 1);
  if (!p.flying) return { ...NEUTRAL_INPUT, tuck: 1, steer: steer * 0.5 };
  const tuck = clamp(0.45 + (HOLD - p.agl) * PER_METRE, 0, 1);
  // A FOLD pumped out: the brakes pulled and let up, never while stalled.
  const pump = p.fold > PUMP && !p.stalled && (state.t * 2) % 1 < 0.5 ? 0.7 : 0;
  // Against a folded side, the other toggle holds the line.
  return {
    ...NEUTRAL_INPUT,
    tuck,
    steer: clamp(steer - p.foldSide * p.fold * 0.5, -1, 1),
    brake: pump,
  };
}
