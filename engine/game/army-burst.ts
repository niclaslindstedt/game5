// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BURST AMONG THE ARMY'S OWN — what the blast layer (`blast.ts`) does to
// the hunt's machines where a rocket or a shell goes off, whoever fired it:
//   * a CARRIER, A TRUCK OR A TANK whose middle is within
//     `ARMY_AIR.burst.vehicle` m is KNOCKED OUT — a shoulder rocket's
//     shaped charge through a carrier's or a truck's skin, or down through
//     a tank's thin roof — and burns where it stands (`wreck`). Its CREW
//     and half the men still in its back BAIL OUT (`bailOut`) and fight on
//     on foot; the rest are lost with it;
//   * a PARAMOTOR's wing within `ARMY_AIR.burst.wing` m is shredded and its
//     soldier comes down (`army-para.ts`' `downPara`);
//   * a BALLOON's envelope or basket near it is torn and sinks
//     (`army-balloon.ts`' `tearBalloon`);
//   * one of its HELICOPTERS within `heli` m (his own tank's shell,
//     `armour.ts`) comes down as a rammed one does.
// Nothing here draws from any stream.

import { hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { ARMY_AIR } from "./defs/army-air.ts";
import { freshAirState } from "./army-air-state.ts";
import { enlist } from "./army-troop.ts";
import { ARMY_VEHICLE } from "./defs/army-vehicle.ts";
import { ARMY_WAVE } from "./defs/army-wave.ts";
import { downPara } from "./army-para.ts";
import { burstOnBalloons } from "./army-balloon.ts";
import { raiseHeat } from "./wanted.ts";
import type { ArmyState, ArmyVehicle } from "./army-state.ts";
import type { GameEvent, GameState } from "./state.ts";

/** THE CREW BAILS OUT of a vehicle knocked out: its crew and a share of the
 * men still aboard climb out of its sides, alternately left and right along
 * it, and go after him on foot as every soldier of a wave does — under the
 * waves' bound on men out at once. Returns how many got out. */
export function bailOut(state: GameState, a: ArmyState, v: ArmyVehicle): number {
  const K = ARMY_VEHICLE;
  const B = K.bail;
  const w = state.wanted;
  if (!w || w.ended !== null) return 0;
  let live = 0;
  for (const s of a.troops) if (s.from === "wave" && s.mode !== "gone" && s.mode !== "dead") live++;
  const room = Math.max(0, (ARMY_WAVE.most[w.stars] ?? 0) - live);
  const n = Math.min(room, K.kinds[v.kind].crew + Math.floor(v.aboard * B.aboard));
  const half = K.kinds[v.kind].halfWidth + B.out;
  const fx = Math.sin(v.heading);
  const fz = Math.cos(v.heading);
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const along = (Math.floor(i / 2) - 1) * 1.6;
    const x = v.x + fx * along + fz * half * side;
    const z = v.z + fz * along - fx * half * side;
    const s = enlist(
      state,
      a,
      i % 3 === 2 ? "foot" : "rifle",
      "wave",
      K.ids.squad + v.id,
      "chase",
      x,
      z,
      v.heading + (side * Math.PI) / 2,
    );
    s.next = state.t + B.stunned + i * B.every;
  }
  a.bailed += n;
  return n;
}

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
    bailOut(state, a, v);
    v.aboard = 0;
    const air = (a.air ??= freshAirState());
    air.knocked++;
    events.push({
      kind: "army-vehicle",
      t: state.t,
      change: "wreck",
      id: v.id,
      vehicle: v.kind,
      x: v.x,
      y: v.y,
      z: v.z,
    });
    events.push({
      kind: "army-air",
      t: state.t,
      change: "knocked",
      craft: "vehicle",
      id: v.id,
      x: v.x,
      y: v.y,
      z: v.z,
    });
  }
  // A HELICOPTER of theirs within its cabin's reach of a shell he fired
  // (`armour.ts`): its tail and its controls gone, it comes down as a
  // rammed one does — and the heat with it.
  for (const h of a.helis) {
    if (h.phase === "due" || h.phase === "gone" || h.phase === "wreck" || h.phase === "fall")
      continue;
    if (hypot3(h.x - x, h.y + 1.4 - y, h.z - z) > B.heli) continue;
    h.phase = "fall";
    h.t = 0;
    a.downed++;
    raiseHeat(state, "downed-helicopter");
  }
  const air = a.air;
  if (!air) return;
  for (const p of air.paras) {
    if (p.mode !== "fly" && p.mode !== "leave") continue;
    const w = p.wing;
    if (hypot3(w.x - x, w.y - y, w.z - z) < B.wing || hypot3(p.x - x, p.y - y, p.z - z) < B.wing)
      downPara(state, air, p, "burst", events);
  }
  burstOnBalloons(state, air, x, y, z, events);
}
