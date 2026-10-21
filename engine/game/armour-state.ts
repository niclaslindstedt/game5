// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN ARMY VEHICLE HE TOOK, as the run holds it (`armour.ts`) — a type of
// its own so `state.ts` can carry it without importing the step that moves
// it.

import type { ArmyVehicle } from "./army-state.ts";

/** THE VEHICLE HE TOOK from the ground waves (`steal.ts`): its body as the
 * waves drove it — the kind, its place and attitude, its pace, a carrier's
 * rear unit, a tank's turret and gun (`ArmyVehicle`, its `mode` "drive" or,
 * knocked out, "wreck") — now his to drive; whether he is in it; the
 * seconds since he climbed in or out; the controls as his hands have them
 * (`drive` −1..1 forward, `steer` −1..1 to the right, the turret's
 * `traverse` and the gun's `elevate` −1..1, and whether the trick key is
 * laying the gun, `laying` — the app takes the gunner's sight then); its way over the snow (m/s,
 * world); whether it is knocked out (`dead`: it will not drive); whether
 * the fire key was held last step (a shot is its press), and the rounds
 * he has fired. */
export type ArmourRide = {
  body: ArmyVehicle;
  rider: boolean;
  t: number;
  drive: number;
  steer: number;
  traverse: number;
  elevate: number;
  laying: boolean;
  vx: number;
  vy: number;
  vz: number;
  dead: boolean;
  trigger: boolean;
  shots: number;
};

/** THE RIDE'S EVENT: taken (`board`, the first time by `steal.ts`, again
 * after he left it), left (`hop`), a shell fired from its gun (`fire`), and
 * knocked out under him (`dead`). */
export type ArmourEvent = {
  kind: "armour";
  t: number;
  change: "board" | "hop" | "fire" | "dead";
  vehicle: ArmyVehicle["kind"];
  x: number;
  y: number;
  z: number;
};
