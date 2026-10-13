// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL RIDER AS DRAWN by the procedural rig (`bike-rig-switch.ts`):
// the figure built in code (`bike-rider-build.ts`) laid every frame on a
// skeleton from one of three places —
//
//   ON THE BIKE   solved by IK on the bike as drawn (`solveRider`), hung in
//                 the bike's own frame from its bottom bracket, the lag of
//                 his body against the frame's accelerations stepped here
//                 off the bike's drawn motion (`createRiderDynamics`), the
//                 cranks eased level while he coasts (the bike's drawn
//                 cranks are handed the same angle);
//   THROWN        the engine's ragdoll's thirteen points, in the world;
//   PUSHING IT    the walk's key (`walkingKey`) laid in his own frame off
//                 the snow — the ground — under him.
//
// Anything else (a chair, a cabin, a body the gore has cut) is left to the
// dressed skier, and `drawn()` says so.

import * as THREE from "three";
import type { BikePose, GameState } from "@engine";

import { buildRiderFigure } from "./bike-rider-build.ts";
import {
  createRiderDynamics,
  jointsFromPoints,
  solveRider,
  type RiderJoints,
} from "./bike-rider-ik.ts";
import { keyPoints } from "./party-pose.ts";
import { walkingKey } from "./skier-bike.ts";
import type { HazeUniforms } from "./haze.ts";

export type BikeRiderView = {
  /** Pose him for this frame. `frame` is the bike's frame node (origin the
   * bottom bracket), `world` the world's group, `pose` the bike's pose as
   * the bike is drawn. Returns the crank angle the bike should draw. */
  update(
    state: GameState,
    pose: BikePose,
    frame: THREE.Object3D,
    world: THREE.Object3D,
    dt: number,
  ): number;
  /** Not drawn, until this frame's `update` says otherwise. */
  clear(): void;
  /** Whether this rider is drawn this frame (the skier's figure is not). */
  drawn(): boolean;
  /** Shown or hidden by the lens (the figure off on the bar-cam and in his
   * eyes); his head alone is hidden while the lens is in it. */
  show(on: boolean, head: boolean): void;
  dispose(): void;
};

export function createBikeRiderView(haze: HazeUniforms): BikeRiderView {
  const fig = buildRiderFigure(haze);
  const dyn = createRiderDynamics();
  let active = false;
  let shown = true;
  let head = true;
  // The bike's drawn motion, for its acceleration in its own frame.
  const last = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const now = new THREE.Vector3();
  const nv = new THREE.Vector3();
  const qi = new THREE.Quaternion();
  let have = 0;
  let lastPitch = 0;
  let joints: RiderJoints | null = null;

  const place = (parent: THREE.Object3D): void => {
    if (fig.group.parent !== parent) parent.add(fig.group);
  };

  return {
    update(state, pose, frame, world, dt) {
      const b = state.bike;
      const c = state.skier;
      active = false;
      let crank = pose.crank;
      if (!b) return crank;
      if (b.onIt && !c.thrown && b.mode !== "lift") {
        // ON THE BIKE: the frame's acceleration off its drawn motion.
        frame.getWorldPosition(now);
        if (dt > 1e-4) {
          if (have > 0) {
            nv.copy(now).sub(last).divideScalar(dt);
            // A jump between frames no bike rides (a frame drawn seconds
            // after the last, a restart) starts the reading again.
            if (nv.length() > 60) have = 0;
            else {
              if (have > 1) acc.copy(nv).sub(vel).divideScalar(dt).clampLength(0, 40);
              vel.copy(nv);
            }
          }
          have = Math.min(2, have + 1);
          last.copy(now);
          frame.getWorldQuaternion(qi).invert();
          acc.applyQuaternion(qi);
          const rate = (pose.pitch - lastPitch) / dt;
          lastPitch = pose.pitch;
          const lag = dyn.step({ x: acc.x, y: acc.y, z: acc.z }, rate, dt);
          crank = dyn.crank(pose, dt);
          joints = solveRider(pose, lag, crank);
        } else if (!joints) {
          joints = solveRider(pose, undefined, dyn.crank(pose, 0));
        }
        place(frame);
        active = true;
      } else if (c.thrown && !state.gore) {
        have = 0;
        dyn.reset();
        joints = jointsFromPoints(c.thrown.points);
        place(world);
        active = true;
      } else if (b.afoot && !b.onIt && !c.lift && !c.thrown) {
        have = 0;
        dyn.reset();
        // His own frame: x his right (the engine's right of his heading is
        // (cos h, −sin h)), y up off the ground under him, z ahead.
        const k = keyPoints(walkingKey(b.afoot), 0);
        const h = c.heading;
        const ground = state.level.groundAt(c.x, c.z);
        const pts: number[] = [];
        for (let i = 0; i < k.length; i += 3) {
          const x = k[i];
          const y = k[i + 1];
          const z = k[i + 2];
          pts.push(
            c.x + x * Math.cos(h) + z * Math.sin(h),
            ground + y,
            c.z - x * Math.sin(h) + z * Math.cos(h),
          );
        }
        joints = jointsFromPoints(pts);
        place(world);
        active = true;
      } else {
        have = 0;
      }
      fig.group.visible = active && shown;
      if (active && joints) fig.pose(joints, head);
      return crank;
    },
    clear() {
      active = false;
      fig.group.visible = false;
    },
    drawn: () => active,
    show(on, h) {
      shown = on;
      head = h;
      fig.group.visible = active && shown;
    },
    dispose() {
      fig.group.removeFromParent();
      fig.dispose();
    },
  };
}
