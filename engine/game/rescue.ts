// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HURT TOO BADLY TO SKI ON — what a run that carries its injuries
// (`GameState.gore`, the INJURIES switch's) does with a body that lives but
// cannot get up: a leg broken, the spine or the neck hurt, an organ torn.
// Every other run never reaches this file, so nothing here moves a digest.
//
// A ski patrol does not stand such a skier back on his skis: he is
// immobilised where he lies (a vacuum mattress on a stretcher, the spine
// held) and flown off the mountain. So here: once he has lain the time a
// fall is got up from (`crash.getUp`) and is still down, and what he
// carries keeps him there (`disablingOf`), he is found INJURED
// (`GoreState.injured`, the `injured` event) — never stood back up again
// (`gore.ts`'s `holdsHim`), and the run is the app's to end, as a death is
// (`hud-wreck.ts`). The air ambulance that takes him off is the next run's
// picture (`pwa/src/game/rescue-plan.ts`); the engine keeps nothing of it.
//
// An arm or a hand hurt never keeps him down: a skier skis an arm out.

import { RAGDOLL as R } from "./ragdoll.ts";
import { INJURIES, type BodyPart } from "./defs/anatomy.ts";
import { mayGetUp } from "./crash.ts";
import type { GameEvent, GameState, Injury, BodyState } from "./state.ts";

/** WHAT KEEPS A SKIER DOWN. The parts a BROKEN bone keeps him down on (a
 * crack is skied out) — the legs and the pelvis under him; the parts ANY
 * fracture does — the spine, from the neck to the low back, where a
 * suspected one is never moved but on a board; and the rank an injury to
 * an ORGAN keeps him down from (AIS 3, "serious": a torn spleen, a bruised
 * lung, a knock-out — never a concussion's 2). */
export const RESCUE = {
  broken: [
    "pelvis",
    "thighL",
    "thighR",
    "kneeL",
    "kneeR",
    "shinL",
    "shinR",
    "footL",
    "footR",
  ] as readonly BodyPart[],
  spine: ["neck", "back"] as readonly BodyPart[],
  organAis: 3,
} as const;

/** Whether one injury keeps him down. */
export function disables(h: Injury): boolean {
  const def = INJURIES[h.kind] as {
    fracture?: string;
    said?: true;
    organs?: readonly string[];
  };
  if (def.said) return true;
  if (def.fracture && RESCUE.spine.includes(h.part)) return true;
  if (def.fracture === "break" && RESCUE.broken.includes(h.part)) return true;
  return !!def.organs && h.ais >= RESCUE.organAis;
}

/** THE INJURY THAT KEEPS HIM DOWN — the worst (the highest AIS, the first
 * of a tie) of those that do — or null: he can get up. */
export function disablingOf(body: BodyState): Injury | null {
  let worst: Injury | null = null;
  for (const h of body.injuries) if (disables(h) && (!worst || h.ais > worst.ais)) worst = h;
  return worst;
}

/** Whether he lies hurt too badly to ski on. */
export function isInjured(state: GameState): boolean {
  return (state.gore?.injured ?? -1) >= 0;
}

/** Find him INJURED, the first step he has lain long enough to get up and
 * cannot — on a run that carries its injuries, alive and not already
 * found so. */
export function callRescue(state: GameState, events: GameEvent[]): void {
  const g = state.gore;
  const off = state.skier.thrown;
  if (!g || !off || g.injured >= 0 || g.mortal >= 0 || g.dead >= 0) return;
  if (!mayGetUp(off)) return;
  const injury = disablingOf(state.skier.body);
  if (!injury) return;
  g.injured = state.t;
  g.injury = injury;
  const P = off.points;
  const at = 3 * R.hipL;
  const bt = 3 * R.hipR;
  events.push({
    kind: "injured",
    t: state.t,
    injury,
    x: (P[at] + P[bt]) / 2,
    y: (P[at + 1] + P[bt + 1]) / 2,
    z: (P[at + 2] + P[bt + 2]) / 2,
  });
}
