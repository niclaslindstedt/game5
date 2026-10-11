// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI JUMP JUMPED (R43, `RunRules.skiJump`): one step of the jump under
// way — on the BAR and down the TRACKS (`jump-inrun.ts`), off the edge and
// through the AIR (`jump-flight.ts`) — and, once the feet are on the snow,
// the engine's own skier on the landing hill and the out-run, the jump's
// record filled from what his legs made of it (`noteDown`). The run's step
// (`run.ts`) asks this first: while it answers true the snow's step is not
// his.

import { TUNING } from "./defs/tuning.ts";
import { noteDown, stepFlight } from "./jump-flight.ts";
import { stepTracks } from "./jump-inrun.ts";
import type { GameEvent, GameState, SkierInput } from "./state.ts";

/** ONE STEP OF THE JUMP: true while the bar, the tracks or the air carry
 * him (the snow's step is not his), false once he is down — or on any run
 * that is not a ski jump. */
export function stepSkiJump(state: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const j = state.jump;
  if (!j || !state.rules.skiJump || state.skier.thrown !== null) return false;
  if (j.stage === "bar" || j.stage === "tracks") {
    return stepTracks(state, input, events, (dt) => stepFlight(state, input, events, dt));
  }
  if (j.stage === "air") {
    stepFlight(state, input, events, TUNING.dt);
    return true;
  }
  return false;
}

/** After the step: the jump's record kept up once he is down. */
export function afterSkiJump(state: GameState, input: SkierInput, events: GameEvent[]): void {
  if (state.jump) noteDown(state, input, events);
}
