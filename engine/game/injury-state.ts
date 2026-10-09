// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN INJURY AS THE STATE KEEPS IT, and a landing's load owed to the trunk
// (`BodyState`, `body.ts`).

import type { BodyPart, InjuryKind } from "./defs/anatomy.ts";

/** The load a landing hands the trunk: the spine's, the chest's and the
 * belly's, g, and the neck's blow, g. */
export type TrunkLoad = { back: number; chest: number; abdomen: number; neck: number };

/** ONE INJURY: the part, which, its AIS rank, and the run clock it came at
 * (the engine's own, `GameState.t`) — and the ENERGY that did it, over the
 * energy of the injury's even chance (`body.ts`' `energyOver`; 1 when left
 * out), raised by every harder blow on the part after it: what grades a
 * break simple, wedge or shattered (`fracturesOf`). */
export type Injury = {
  part: BodyPart;
  kind: InjuryKind;
  ais: number;
  t: number;
  energy?: number;
  /** THE SIDE of a paired organ it hurt (`InjuryDef.organs`: a lung, a
   * kidney) — the side the blow came from, or one drawn off a hash. */
  side?: "L" | "R";
};
