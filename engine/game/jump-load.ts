// THE JUMP'S LOAD AND ITS SPRING (`TUNING.jump`), one skier's step of it:
// loaded while it is held on the snow — the time held, to `full` — and
// sprung the step it is let go, off the snow if he is on it or left it
// under `grace` s ago (a lip is left a beat before the thumb comes off).
// Let go later in the air, it is spent. A touch FLICK (`SkierInput.pop`)
// springs it the step it comes, as loaded as the flick asked (or as the
// jump already held, whichever is more).

import { TUNING } from "./defs/tuning.ts";
import type { SkierInput, SkierState } from "./state.ts";

const J = TUNING.jump;

/** The jump's spring this step (m/s off the snow, 0 for none) and the load it was sprung from (s). */
export type JumpSpring = { pop: number; loaded: number };

/** Steps the jump's load on `c` and says what it springs this step. */
export function stepJumpLoad(c: SkierState, input: SkierInput, dt: number): JumpSpring {
  let pop = 0;
  let loaded = 0;
  c.popped += dt;
  const sprung = !c.airborne || c.airTime <= J.grace;
  const charge = (input.pop ?? 0) > 0 ? Math.min(1, input.pop ?? 0) * J.full : 0;
  if (charge > 0) {
    loaded = Math.max(c.jumpLoad, charge);
    if (sprung && c.thrown === null) pop = popOf(loaded);
    c.jumpLoad = 0;
  } else if (input.jump === true && c.thrown === null) {
    if (!c.airborne) c.jumpLoad = Math.min(J.full, c.jumpLoad + dt);
  } else if (c.jumpLoad > 0) {
    loaded = c.jumpLoad;
    if (sprung && c.thrown === null) pop = popOf(loaded);
    c.jumpLoad = 0;
  }
  return { pop, loaded };
}

function popOf(loaded: number): number {
  return J.popMin + ((J.popMax - J.popMin) * loaded) / J.full;
}
