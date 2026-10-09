// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A GONDOLA WALKED ABOARD — the pair carried, never worn, through a
// gondola's stations (`lift-ride.ts`, `lift-board.ts`), as every rider of
// one goes:
//
//   * SHORT OF THE DOOR (`offForDoor`): skated up the lane, he stops
//     `gondola.walkIn` m short of the door at the back of the hall, steps
//     out of his bindings and shoulders the pair — the town's own beats
//     (`town.ts`), without the town;
//   * ON FOOT TO THE DOOR (`doorIn`): walked the rest of the way in his
//     boots, the picture black `gondola.inset` m short of the wall, before
//     the tips on his shoulder are at its glass, and out onto the platform
//     to wait for his cabin with the pair still on his shoulder;
//   * INTO THE RACK (`rackSkis`): his cabin alongside, he turns to it, takes
//     the pair off his shoulder onto its tails in front of him and stands it
//     in the rack on the cabin's back door leaf (`own-cabin.ts` draws it),
//     then steps in on foot; the pair rides there, placed where the leaf
//     has it every step, the leaf sliding shut with the doors and the cabin
//     swinging on its hanger;
//   * OUT AT THE TOP (`carryOut`): the pair off the rack and on his
//     shoulder behind the station's fade, he is walked out onto the pad,
//     and once the lift lets him go he lays it down and steps back in (the
//     town's `drop` and `clip`, off the streets).
//
// The pair is the thrown skier's shape (`LoneSki`), placed and never
// stepped. Nothing here draws on any stream.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { onFoot } from "./buzz.ts";
import { TOWN } from "./defs/town.ts";
import { TUNING } from "./defs/tuning.ts";
import type { LiftPlan } from "./lift-line.ts";
import type { GameEvent, GameState, LiftRide, LoneSki } from "./state.ts";
import {
  blankSki,
  mixPlace,
  placeSkis,
  setSki,
  townEase,
  unit,
  upright,
  type Place,
} from "./town.ts";

const G = TUNING.lift.gondola;

/** Where on a gondola's line he is walked to, short of the door at the
 * back of its hall, m up the line from the bottom wheel. */
export function doorIn(plan: LiftPlan): { x: number; z: number } {
  const u = plan.look.entry.at - G.inset;
  return { x: plan.lift.bottom.x + plan.dx * u, z: plan.lift.bottom.z + plan.dz * u };
}

/** A pair fresh out of its bindings, to be placed. */
function freshPair(run: GameState): LoneSki[] {
  const m = run.skier.spec.mount;
  return [blankSki(-1, m), blankSki(1, m)];
}

/** OUT OF HIS SKIS SHORT OF THE DOOR: the beats begun where he stands —
 * out of the bindings, the pair onto his shoulder (`town.ts`). */
export function offForDoor(run: GameState): void {
  const c = run.skier;
  c.town = {
    phase: "out",
    phaseT: 0,
    t: 0,
    skis: freshPair(run),
    at: { x: c.x, z: c.z, heading: c.heading },
    walked: 0,
  };
  onFoot(run, c.x, c.z, c.heading, 0, 0);
  placeSkis(run);
}

/** IN THE RACK ON HIS CABIN'S BACK DOOR LEAF, the two skis side by side
 * on their tails, tips up, their topsheets out — `own-cabin.ts`'s leaf
 * slid `doors` of the way open (0 shut … 1 open), the cabin's grip at
 * (`gx`, `gy`, `gz`) and swung `swing` rad about it. */
const RACK = {
  /** The leaf's middle from the cabin's middle along it, shut and opened
   * further, m, and how far out of the flank it is, shut and opened. */
  leaf: [0.25, 0.5],
  flank: [0.96, 0.04],
  /** Each ski: along the leaf and out of it, m. */
  along: [-0.08, 0.06],
  out: [0.09, 0.13],
  /** The tails' foot under the grip, m. */
  foot: 4.12,
};
const racked: Place[] = [0, 1].map(() => ({ b: [0, 0, 0], d: [0, 1, 0], u: [1, 0, 0] }));

function rackPlace(
  run: GameState,
  plan: LiftPlan,
  grip: { x: number; y: number; z: number },
  swing: number,
  doors: number,
): Place[] {
  const spec = run.skier.spec;
  const cs = Math.cos(swing);
  const sn = Math.sin(swing);
  const k = clamp(doors, 0, 1);
  for (let i = 0; i < 2; i++) {
    const a = -(RACK.leaf[0] + RACK.leaf[1] * k) + RACK.along[i];
    const s = RACK.flank[0] + RACK.flank[1] * k + RACK.out[i];
    // The boot's middle on its base, its length up from the tail's foot.
    const d = RACK.foot - spec.length * spec.mount;
    const ahead = a * cs + d * sn;
    const p = racked[i];
    p.b[0] = grip.x + plan.dx * ahead + plan.dz * s;
    p.b[1] = grip.y + a * sn - d * cs;
    p.b[2] = grip.z + plan.dz * ahead - plan.dx * s;
    // Up the cabin, as it hangs.
    p.d[0] = -plan.dx * sn;
    p.d[1] = cs;
    p.d[2] = -plan.dz * sn;
    unit(p.d);
    p.u[0] = plan.dz;
    p.u[1] = 0;
    p.u[2] = -plan.dx;
  }
  return racked;
}

/** THE PAIR IN THE RACK while the cabin carries him: placed there. */
export function inRack(
  run: GameState,
  plan: LiftPlan,
  ride: LiftRide,
  grip: { x: number; y: number; z: number },
  swing: number,
  doors: number,
): void {
  // A ride begun in the cabin (a free ride's arrival, a reset) has a pair
  // in its rack all the same.
  ride.skis ??= freshPair(run);
  const at = rackPlace(run, plan, grip, swing, doors);
  for (let i = 0; i < 2; i++) setSki(ride.skis[i], at[i], run.skier.spec.length, false);
}

/** How long into the racking the pair is stood on its tails in front of
 * him — the town's `drop` to its half — before it goes into the rack, s. */
const UNSHOULDER = TOWN.drop / 2;
const stood: Place[] = [0, 1].map(() => ({ b: [0, 0, 0], d: [0, 1, 0], u: [1, 0, 0] }));

/** INTO THE RACK, a step of it (`ride.rack` s in): stood where he waits,
 * turned to his cabin, the pair off his shoulder onto its tails in front of
 * him (the town's `drop` to its half), then lifted into the rack. True once
 * it is there: the pair is the cabin's (`ride.skis`), and he steps in. */
export function rackSkis(
  run: GameState,
  plan: LiftPlan,
  ride: LiftRide,
  grip: { x: number; y: number; z: number },
  swing: number,
  doors: number,
  events: GameEvent[],
): boolean {
  const c = run.skier;
  const w = c.town;
  if (!w) return true;
  const was = ride.rack ?? 0;
  const t = was + TUNING.dt;
  ride.rack = t;
  // Turned from up the line to face the cabin on his left.
  const face = plan.heading - (Math.PI / 2) * townEase(t / UNSHOULDER, [0, 0.6]);
  onFoot(run, ride.from.x, ride.from.z, face, 0, 0);
  // Off the shoulder onto its tails: the town's `drop`, to its half.
  w.phase = "drop";
  w.phaseT = Math.min(t, UNSHOULDER);
  w.at = { x: c.x, z: c.z, heading: face };
  placeSkis(run);
  if (t > UNSHOULDER) {
    // ...and up into the rack.
    upright(run, stood);
    const at = rackPlace(run, plan, grip, swing, doors);
    const k = townEase((t - UNSHOULDER) / (G.rack - UNSHOULDER), [0, 1]);
    const mixed: Place = { b: [0, 0, 0], d: [0, 1, 0], u: [1, 0, 0] };
    for (let i = 0; i < 2; i++) {
      mixPlace(stood[i], at[i], k, mixed);
      setSki(w.skis[i], mixed, c.spec.length, false);
    }
  }
  if (was < G.rack - 0.15 && t >= G.rack - 0.15)
    events.push({ kind: "town", t: run.t, phase: "lay" });
  if (t < G.rack) return false;
  ride.skis = w.skis;
  c.town = null;
  delete ride.rack;
  return true;
}

/** OUT AT THE TOP, the pair off the rack and on his shoulder — behind the
 * station's fade — to be walked out onto the pad. */
export function carryOut(run: GameState, ride: LiftRide): void {
  const c = run.skier;
  c.town = {
    phase: "walk",
    phaseT: 0,
    t: 0,
    skis: ride.skis ?? freshPair(run),
    at: { x: c.x, z: c.z, heading: c.heading },
    walked: 0,
  };
  delete ride.skis;
}

/** STOOD WHERE THE LIFT HAS HIM, on his skis or — walking a gondola's
 * station — on foot, the pair where its beat has it. */
export function standOnFoot(
  run: GameState,
  x: number,
  z: number,
  heading: number,
  way: number,
): void {
  onFoot(run, x, z, heading, Math.sin(heading) * way, Math.cos(heading) * way);
  const w = run.skier.town;
  if (w) w.walked += way * TUNING.dt;
  placeSkis(run);
}
