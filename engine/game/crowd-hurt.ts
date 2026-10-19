// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN AMATEUR HURT ON HIS OWN, AND FLOWN OFF THE MOUNTAIN — a share of the
// crowd's own falls (a roll for nothing, a kicker's landing; `crowd.ts`'
// `fallDown`) leave him HURT past getting up (`Amateur.hurt`): a wrenched
// knee, a shoulder out, no wound to show, so it is the same with injuries
// on or off. He lies where his body came to rest (`crowd-down.ts`) until
// the air ambulance is called for him (`RescueCall.casualties[k].amateur`,
// a call the app makes mid-run, `pwa/src/game/crowd-calls.ts`) — one run
// into hard enough to stay down (`person-hit.ts`' `injured`) is called for
// the same way. From the call he is the RESCUE'S to draw and to carry
// (`rescue-view.ts`): off the crowd's snow, as one on a lift is
// (`onLift`), held in no one's way, and gone with the machine.
//
// Only on a run that flies the ambulance (`rules.heli`: the free ride), so
// nobody lies waiting for a machine that never comes. Which fall hurts is
// a hash of who he is and the step he fell on, never a draw: the crowd's
// stream is drawn exactly as it was.

import { hash2 } from "@niclaslindstedt/oss-game-framework/core/noise";
import { CROWD } from "./defs/crowd.ts";
import { TUNING } from "./defs/tuning.ts";
import type { Amateur, CrashCause, CrowdState, GameState } from "./state.ts";

const HURT_SALT = 0x4a7e11;

/** Whether this fall of his left him hurt — set on him if so. */
export function hurtFall(state: GameState, a: Amateur, cause: CrashCause): void {
  if (!state.rules.heli || (cause !== "roll" && cause !== "landing")) return;
  const step = Math.round(state.t * TUNING.physicsHz);
  if (hash2(a.id, step, state.seed ^ HURT_SALT) < CROWD.fall.hurt) a.hurt = true;
}

/** Whether he lies waiting for the ambulance: hurt, or run into and
 * injured, alive, and on the snow (never under an avalanche's debris). */
export function waitsForRescue(a: Amateur): boolean {
  return a.mode === "down" && !a.dead && a.buried === undefined && (!!a.hurt || !!a.injured);
}

/** EVERY AMATEUR A CALL HAS COME FOR, taken off the crowd's snow: his
 * body the rescue's from the call on. */
export function carryOff(state: GameState, crowd: CrowdState): void {
  const calls = state.rescue;
  if (!calls?.length) return;
  for (const r of calls) {
    if (r.start > state.t) continue;
    for (const c of r.casualties) {
      if (c.amateur === undefined) continue;
      const a = crowd.amateurs[c.amateur];
      if (a && waitsForRescue(a)) away(a);
    }
  }
}

/** Off the snow, as one gone up a lift unseen, and sound again for the
 * day he comes back down it. */
function away(a: Amateur): void {
  a.mode = "lift";
  a.thrown = null;
  a.rise = 0;
  a.fall = 0;
  a.speed = 0;
  delete a.hurt;
  delete a.injured;
  delete a.crush;
}
