// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S VEHICLE AS THE HUD READS IT (`hud-armour.tsx` draws it) —
// DOM-free, so the suite reads it. While he drives one he took
// (`armour.ts`): which it is, its speed, whether it backs or is knocked
// out, and the tank's turret off the hull's nose and whether its gun is
// loaded. Stood at the door of one he may take (`stealWithin`), or of his
// own left standing (`armourWithin`): which, for the machine press.

import {
  ARMOUR,
  armourWithin,
  gunReady,
  stealWithin,
  type ArmyVehicleKind,
  type GameState,
} from "@engine";

import { SCREEN_TO_ENGINE } from "./input-model.ts";

export type HudArmour =
  | {
      kind: "driven";
      vehicle: ArmyVehicleKind;
      /** Its way along its nose, km/h (backing negative). */
      kmh: number;
      dead: boolean;
      /** The tank's: the turret off the nose as SCREEN deg (right
       * positive as the player sees it), and the gun loaded. */
      turret: number | null;
      loaded: boolean;
    }
  | {
      kind: "waiting";
      vehicle: ArmyVehicleKind;
      /** Whose: the army's (the press steals it), or his own left. */
      steal: boolean;
    };

export function armourOf(state: GameState): HudArmour | null {
  const r = state.armour;
  if (r?.rider && !state.skier.thrown) {
    const b = r.body;
    const tank = b.kind === "tank";
    const gun = state.gunfire?.guns.find((g) => g.id === ARMOUR.tank.gun);
    return {
      kind: "driven",
      vehicle: b.kind,
      kmh: b.speed * 3.6,
      dead: r.dead,
      turret: tank ? Math.round(((b.turret * 180) / Math.PI) * SCREEN_TO_ENGINE) : null,
      loaded: tank && !r.dead && (!gun || gunReady(gun)),
    };
  }
  const taken = stealWithin(state);
  if (taken && (taken.kind === "carrier" || taken.kind === "truck" || taken.kind === "tank"))
    return { kind: "waiting", vehicle: taken.kind, steal: true };
  if (r && armourWithin(state)) return { kind: "waiting", vehicle: r.body.kind, steal: false };
  return null;
}
