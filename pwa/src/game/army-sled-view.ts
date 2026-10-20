// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S SNOWMOBILES AS DRAWN IN THE RUN — every machine the engine
// drives after him (`army-sled.ts`, `ArmyState.sleds`) drawn as the free
// ride's own model in the army's livery and kit (`sled-livery.ts`' fleet,
// `sled-army-kit.ts`: olive drab daubed white, the pillion, the rack),
// where the engine's body has it this frame (carried on its way by the
// share of a step the picture is past the state) — with its crew on it in
// the part-3 soldier figures (`soldier-shapes.ts`): the driver astride the
// seat with his fists on the grips (`sledDriverPose`), the gunner on the
// pillion behind him with his light machine gun laid where the engine
// aims it (`sledGunnerPose`). A man knocked off or got off is no longer
// drawn here: he is a soldier on the ground (`army-ground-view.ts`).
//
// Built with the army's air (`army-air-view.ts`); presentation only — it
// reads the state and writes nothing.

import * as THREE from "three";
import { armySleds, type GameState } from "@engine";

import type { HazeUniforms } from "./haze.ts";
import { atBody, createSledFleet, type FleetSled } from "./sled-livery.ts";
import { SLED_SEATS, sledDriverPose, sledGunnerPose } from "./soldier-pose.ts";
import { SoldierView } from "./soldier-shapes.ts";

/** How far the gun must turn before its gunner is posed afresh, rad. */
const REPOSE = 0.02;

/** One machine as drawn: its copy of the model, its two men and the aim
 * the gunner was last posed at. */
type Drawn = {
  sled: FleetSled;
  driver: SoldierView;
  gunner: SoldierView;
  yaw: number;
  pitch: number;
  seen: number;
};

export type ArmySledView = {
  group: THREE.Group;
  /** Draw `state`'s army snowmobiles, `alpha` the share of a step (`simDt`
   * s) the picture is past it. */
  frame(state: GameState, alpha: number, simDt: number): void;
  dispose(): void;
};

export function createArmySledView(haze: HazeUniforms, material: THREE.Material): ArmySledView {
  const group = new THREE.Group();
  group.name = "army-sleds";
  const fleet = createSledFleet(haze);
  group.add(fleet.group);
  const drawn = new Map<number, Drawn>();
  const spare: Drawn[] = [];
  const driverPose = sledDriverPose();
  let owner: GameState | null = null;
  let frameNo = 0;

  const man = (d: { sled: FleetSled }, kind: "gunner" | "foot", z: number): SoldierView => {
    const v = new SoldierView(kind, "near", material);
    v.mesh.position.set(0, 0, z);
    d.sled.frame.add(v.mesh);
    return v;
  };

  const take = (id: number): Drawn => {
    let d = drawn.get(id);
    if (d) return d;
    d = spare.pop();
    if (!d) {
      const sled = fleet.make("army");
      const half = { sled } as Drawn;
      half.driver = man(half, "gunner", SLED_SEATS.driver.z);
      half.driver.posed(driverPose);
      half.gunner = man(half, "foot", SLED_SEATS.gunner.z);
      d = { ...half, yaw: NaN, pitch: NaN, seen: frameNo };
    }
    d.sled.root.visible = true;
    drawn.set(id, d);
    return d;
  };

  const drop = (id: number): void => {
    const d = drawn.get(id);
    if (!d) return;
    d.sled.root.visible = false;
    drawn.delete(id);
    spare.push(d);
  };

  return {
    group,
    frame(state, alpha, simDt) {
      frameNo++;
      if (owner !== state) {
        owner = state;
        for (const id of [...drawn.keys()]) drop(id);
      }
      const ahead = alpha * simDt;
      for (const m of armySleds(state)) {
        const d = take(m.id);
        d.seen = frameNo;
        const b = m.body;
        atBody(d.sled, b);
        d.sled.root.position.x += b.vx * ahead;
        d.sled.root.position.y += b.vy * ahead;
        d.sled.root.position.z += b.vz * ahead;
        d.driver.mesh.visible = m.driver;
        d.gunner.mesh.visible = m.gunner;
        if (
          m.gunner &&
          !(Math.abs(m.aimYaw - d.yaw) < REPOSE && Math.abs(m.aimPitch - d.pitch) < REPOSE)
        ) {
          d.gunner.posed(sledGunnerPose(m.aimYaw, m.aimPitch));
          d.yaw = m.aimYaw;
          d.pitch = m.aimPitch;
        }
        // Its lamps lit while its crew drive it.
        for (const l of d.sled.lamps) l.visible = m.mode === "drive" || m.mode === "halt";
      }
      for (const [id, d] of drawn) if (d.seen !== frameNo) drop(id);
    },
    dispose() {
      for (const d of [...drawn.values(), ...spare]) {
        d.driver.dispose();
        d.gunner.dispose();
      }
      fleet.dispose();
    },
  };
}
