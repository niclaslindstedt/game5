// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTERS AS DRAWN IN THE RUN — every machine the engine
// flies (`army.ts`, `GameState.army`) drawn by `army-heli-view.ts` where it
// is this frame (carried on its way by the share of a step the picture is
// past the state), its attitude, its rotor's spool, its doors slid open as
// it engages and each manned door gun turned where the engine aims it,
// with the door gunner sat at it and posed to that aim (`gunnerPosed`).
// A machine rammed out of the air goes up where it lands — the game's
// explosion (`explosion.ts`), the helicopter's size — and its wreck burns
// until the engine lets it go — and so does a carrier, a truck or a tank
// knocked out by a rocket's burst (`army-burst.ts`), with no helicopter
// burning. The men it puts on the snow (and the lifts'
// squads) are `army-ground-view.ts`'s, and its snowmobiles with their
// crews `army-sled-view.ts`'s, in the same group.
//
// Built the first time a run carries the army's air; nothing on any other
// run. Presentation only: it reads the state and writes nothing.

import * as THREE from "three";
import {
  ARMY_HELI,
  armyHelis,
  armyQuat,
  armyVehicles,
  type ArmyHeli,
  type GameState,
} from "@engine";

import { gunnerSeat, type Side } from "./army-heli-plan.ts";
import { createArmyGroundView } from "./army-ground-view.ts";
import { createArmySledView } from "./army-sled-view.ts";
import { createArmyVehicleView } from "./army-vehicle-view.ts";
import { createArmyHeliView, type ArmyHeliPose, type ArmyHeliView } from "./army-heli-view.ts";
import { createExplosion, type Explosion } from "./explosion.ts";
import type { HazeUniforms } from "./haze.ts";
import { gunnerPosed } from "./soldier-pose.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import { SoldierView, soldierMaterial } from "./soldier-shapes.ts";
import type { Stamp } from "./trail-stamp.ts";

/** How far a gun must turn before its gunner is posed afresh, rad — a
 * pose solved outright is a few hundred vertices moved. */
const REPOSE = 0.01;

/** One machine as drawn: its view, its gunners and the aim each was last
 * posed at, and the phase it was last drawn in (a fall becoming a wreck is
 * the moment it goes up). */
type Drawn = {
  view: ArmyHeliView;
  gunners: { r: SoldierView | null; l: SoldierView | null };
  posedAt: { r: { yaw: number; pitch: number }; l: { yaw: number; pitch: number } };
  phase: ArmyHeli["phase"];
  seen: number;
};

export type ArmyAirView = {
  group: THREE.Group;
  /** Draw `state`'s army helicopters, `alpha` the share of a step (`simDt`
   * s) the picture is past it; `dt` s of the picture on — with the waves'
   * vehicles' prints pressed into `stamps` and their snow into `cloud`. */
  frame(
    state: GameState,
    alpha: number,
    dt: number,
    simDt: number,
    stamps?: Stamp[] | null,
    cloud?: SnowCloud | null,
  ): void;
  /** The fire's light at `lit` (the sky's lamps), the wrecks' smoke
   * drawn for an eye at `eye`; the rotors' smear shaded to the light. */
  lamps(lit: number, eye: { x: number; y: number; z: number }): void;
  setPace(pace: number): void;
  /** The primer's model in the group (`ArmyHeliView.ready`). */
  ready: Promise<void>;
  dispose(): void;
};

export function createArmyAirView(haze: HazeUniforms): ArmyAirView {
  const group = new THREE.Group();
  group.name = "army-air";
  const material = soldierMaterial(haze);
  const drawn = new Map<number, Drawn>();
  const ground = createArmyGroundView(material);
  group.add(ground.group);
  const sleds = createArmySledView(haze, material);
  group.add(sleds.group);
  const vehicles = createArmyVehicleView(material);
  group.add(vehicles.group);
  const boom: Explosion = createExplosion();
  boom.clear();
  group.add(boom.group);
  // A PRIMER, never shown: one machine with a gunner in its door, built
  // with the view — which the free ride builds with the world — so the
  // model is in and its programs are linked behind the loading card, not on
  // the frame the first machine comes after him.
  const primer = createArmyHeliView(haze);
  primer.group.visible = false;
  const primed = new SoldierView("gunner", "near", material);
  primer.body.add(primed.mesh);
  group.add(primer.group);
  let owner: GameState | null = null;
  let pace = 1;
  let frameNo = 0;
  let lastDt = 0;
  let groundAt: (x: number, z: number) => number = () => 0;
  let burning: ArmyHeli | null = null;
  const pose: ArmyHeliPose = {
    x: 0,
    y: 0,
    z: 0,
    q: { x: 0, y: 0, z: 0, w: 1 },
    spool: 0,
    doors: { r: 0, l: 0 },
    guns: { r: { yaw: 0, pitch: 0 }, l: { yaw: 0, pitch: 0 } },
  };

  const gunner = (d: Drawn, side: Side): SoldierView => {
    const key = side === 1 ? "r" : "l";
    let s = d.gunners[key];
    if (!s) {
      s = new SoldierView("gunner", "near", material);
      const seat = gunnerSeat(side);
      s.mesh.position.set(seat.x, ARMY_HELI.sill, seat.z);
      s.mesh.rotation.set(0, seat.facing, 0);
      d.view.body.add(s.mesh);
      d.gunners[key] = s;
      d.posedAt[key] = { yaw: NaN, pitch: NaN };
    }
    return s;
  };

  const drop = (id: number): void => {
    const d = drawn.get(id);
    if (!d) return;
    group.remove(d.view.group);
    d.gunners.r?.dispose();
    d.gunners.l?.dispose();
    d.view.dispose();
    drawn.delete(id);
  };

  return {
    group,
    frame(state, alpha, dt, simDt, stamps = null, cloud = null) {
      lastDt = dt;
      frameNo++;
      groundAt = (x, z) => state.level.groundAt(x, z);
      if (owner !== state) {
        // A new run: nothing of the last one's machines carried in.
        owner = state;
        for (const id of [...drawn.keys()]) drop(id);
        boom.clear();
        burning = null;
      }
      const ahead = alpha * simDt;
      burning = null;
      for (const h of armyHelis(state)) {
        let d = drawn.get(h.id);
        if (!d) {
          const view = createArmyHeliView(haze);
          view.setPace(pace);
          group.add(view.group);
          d = {
            view,
            gunners: { r: null, l: null },
            posedAt: { r: { yaw: NaN, pitch: NaN }, l: { yaw: NaN, pitch: NaN } },
            phase: h.phase,
            seen: frameNo,
          };
          drawn.set(h.id, d);
        }
        d.seen = frameNo;
        const moving = h.phase === "hunt" || h.phase === "leave" || h.phase === "fall";
        pose.x = h.x + (moving ? h.vx * ahead : 0);
        pose.y = h.y + (moving ? h.vy * ahead : 0);
        pose.z = h.z + (moving ? h.vz * ahead : 0);
        const q = armyQuat(h);
        pose.q.x = q.x;
        pose.q.y = q.y;
        pose.q.z = q.z;
        pose.q.w = q.w;
        pose.spool = Math.max(0, h.spool);
        pose.doors.r = h.doors.r;
        pose.doors.l = h.doors.l;
        pose.guns.r.yaw = h.guns.r.yaw;
        pose.guns.r.pitch = h.guns.r.pitch;
        pose.guns.l.yaw = h.guns.l.yaw;
        pose.guns.l.pitch = h.guns.l.pitch;
        d.view.pose(pose, dt);
        // THE GUNNERS at their guns, posed to the aim.
        for (const side of [1, -1] as const) {
          const key = side === 1 ? "r" : "l";
          const manned = h.manned[key] && h.phase === "hunt";
          if (!manned) {
            if (d.gunners[key]) d.gunners[key]!.mesh.visible = false;
            continue;
          }
          const s = gunner(d, side);
          s.mesh.visible = true;
          const aim = h.guns[key];
          const at = d.posedAt[key];
          if (!(Math.abs(aim.yaw - at.yaw) < REPOSE && Math.abs(aim.pitch - at.pitch) < REPOSE)) {
            s.posed(gunnerPosed(side, aim.yaw, aim.pitch));
            at.yaw = aim.yaw;
            at.pitch = aim.pitch;
          }
        }
        // DOWN: it goes up where it landed, and burns.
        if (h.phase === "wreck" && d.phase === "fall") boom.burst(h.x, h.y + 1, h.z, 30);
        if (h.phase === "wreck") burning = h;
        d.phase = h.phase;
      }
      for (const [id, d] of drawn) if (d.seen !== frameNo) drop(id);
      ground.frame(state, alpha, simDt);
      sleds.frame(state, alpha, simDt);
      vehicles.frame(state, alpha, dt, simDt, stamps, cloud);
      if (burning) boom.burning(true, burning.x, burning.y, burning.z, 0.8);
      else {
        // ...else the newest of the waves' vehicles knocked out.
        let wreck: { x: number; y: number; z: number } | null = null;
        for (const v of armyVehicles(state)) if (v.mode === "wreck") wreck = v;
        if (wreck) boom.burning(true, wreck.x, wreck.y + 1.6, wreck.z, 0.6);
        else boom.burning(false, 0, 0, 0);
      }
    },
    lamps(lit, eye) {
      boom.dusk(lit);
      boom.update(lastDt, groundAt, eye);
      ground.seen(eye);
      for (const d of drawn.values()) d.view.shade(1 - 0.85 * lit);
    },
    setPace(next) {
      pace = next > 0 ? next : 1;
      for (const d of drawn.values()) d.view.setPace(pace);
    },
    ready: primer.ready,
    dispose() {
      for (const id of [...drawn.keys()]) drop(id);
      primed.dispose();
      primer.dispose();
      ground.dispose();
      sleds.dispose();
      vehicles.dispose();
      boom.dispose();
      material.dispose();
    },
  };
}
