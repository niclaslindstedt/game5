// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BURST AMONG THE ARMY'S OWN — what the blast layer (`blast.ts`) does to
// the hunt's machines where a rocket or a shell goes off, whoever fired it:
//   * a CARRIER, A TRUCK OR A TANK whose middle is within
//     `ARMY_AIR.burst.vehicle` m is KNOCKED OUT — a shoulder rocket's
//     shaped charge through a carrier's or a truck's skin, or down through
//     a tank's thin roof — and burns where it stands (`wreck`), its men
//     aboard lost with it;
//   * a PARAMOTOR's wing within `ARMY_AIR.burst.wing` m is shredded and its
//     soldier comes down (`army-para.ts`' `downPara`).
// Nothing here draws from any stream.

import { hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { ARMY_AIR } from "./defs/army-air.ts";
import { freshAirState } from "./army-air-state.ts";
import { downPara } from "./army-para.ts";
import type { GameEvent, GameState } from "./state.ts";

/** A burst at (x, y, z): the army's vehicles and paramotors near it. */
export function burstOnArmy(
  state: GameState,
  x: number,
  y: number,
  z: number,
  events: GameEvent[],
): void {
  const a = state.army;
  if (!a) return;
  const B = ARMY_AIR.burst;
  for (const v of a.vehicles) {
    if (v.mode === "due" || v.mode === "gone" || v.mode === "wreck") continue;
    if (hypot3(v.x - x, v.y + 1.2 - y, v.z - z) > B.vehicle) continue;
    v.mode = "wreck";
    v.t = 0;
    v.speed = 0;
    v.pace = 0;
    v.aboard = 0;
    const air = (a.air ??= freshAirState());
    air.knocked++;
    events.push({ kind: "army-vehicle", t: state.t, change: "wreck", id: v.id, vehicle: v.kind, x: v.x, y: v.y, z: v.z });
    events.push({ kind: "army-air", t: state.t, change: "knocked", craft: "vehicle", id: v.id, x: v.x, y: v.y, z: v.z });
  }
  const air = a.air;
  if (!air) return;
  for (const p of air.paras) {
    if (p.mode !== "fly" && p.mode !== "leave") continue;
    const w = p.wing;
    if (hypot3(w.x - x, w.y - y, w.z - z) < B.wing || hypot3(p.x - x, p.y - y, p.z - z) < B.wing)
      downPara(state, air, p, "burst", events);
  }
}
