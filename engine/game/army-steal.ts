// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTER TAKEN OFF THE SNOW (`steal.ts`): one of the hunt's
// machines set down on its skids to put its men out or pick them up
// (`army.ts`' `set`, `army-ground.ts`' landing) is a machine to take — the
// skier at the pilot's door, slow, gives the machine press and is in its
// right seat, the rotor turning as its crew left it. It leaves the hunt
// (its flight `gone`, its landing over) and becomes the run's helicopter in
// the army's livery (`heli.ts`' `takeHeli`, `HeliLivery` "army"): flown on
// the free ride's own flight model and hands, drawn as the army's machine
// with its own flight deck (`army-heli-ride.ts`), and the worst theft but a
// tank's (`stole-army-heli`).
//
// Nothing here draws from any stream.

import { fromEuler, rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { ARMY_HELI } from "./defs/army-heli.ts";
import { HELI } from "./defs/heli.ts";
import type { ArmyHeli } from "./army-state.ts";
import type { StealSource } from "./steal.ts";

/** THE PILOT'S DOOR in the army machine's body frame as the engine keeps
 * it, m: forward of the cabin's sliding door on the side of the right
 * seat (`ARMY_HELI` states its places for the picture's right; the
 * engine's x is its mirror), a step out from the cabin's side. */
export const ARMY_PILOT_DOOR = {
  x: -(ARMY_HELI.body.width / 2 + 0.75),
  y: 0,
  z: (ARMY_HELI.cabin.front + ARMY_HELI.body.nose) / 2 - 0.4,
} as const;

/** Where a set-down machine's pilot's door is on the snow. */
export function armyHeliDoor(h: Pick<ArmyHeli, "x" | "z" | "heading" | "pitch" | "roll">): {
  x: number;
  z: number;
} {
  const w = rotate(fromEuler(h.heading, h.pitch, h.roll), ARMY_PILOT_DOOR);
  return { x: h.x + w.x, z: h.z + w.z };
}

/** THE ARMY'S MACHINES ON THE SNOW: every one set down on its skids. The
 * run's own helicopter becomes it, so a run without one (a race) has none
 * to take. Index: the machine's id. */
export const ARMY_HELI_SOURCE: StealSource = {
  id: "army-heli",
  parked(state, out) {
    const a = state.army;
    if (!a?.helis.length || !state.heli) return;
    for (const h of a.helis) {
      if (h.phase !== "set") continue;
      out.push({
        kind: "heli",
        livery: "army",
        from: "army-heli",
        index: h.id,
        x: h.x,
        y: h.y,
        z: h.z,
        heading: h.heading,
        pitch: h.pitch,
        roll: h.roll,
        door: armyHeliDoor(h),
        reach: HELI.board.reach + 0.6,
        fastest: HELI.board.fastest,
        spool: Math.max(0, Math.min(1, h.spool)),
      });
    }
  },
  taken(state, index) {
    const h = state.army?.helis.find((o) => o.id === index);
    if (!h) return;
    // Out of the hunt: its landing over, its men left to the ground.
    if (h.task) h.task.done = true;
    h.task = null;
    h.aboard = 0;
    h.phase = "gone";
  },
};
