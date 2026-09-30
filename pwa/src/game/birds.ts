// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIRDS, DRAWN — the flocks and the crossings `bird-plan.ts` laid over
// the map, as three.js sees them: one instanced mesh a species, holding
// whatever of that species is within sight this frame, each bird posed off
// the engine's own clock and its wings hinged in the shader.
//
// The wiring and the one thing here with MEMORY: when each flock was last
// put up by a skier, decided by `flushAt` — the rule the plan states once
// for this file and the audio's `bird-bed.ts` both. NOTHING IS ALLOCATED
// PER FRAME: every pose is written into one scratch object and straight
// into the instance buffers.

import * as THREE from "three";
import type { GameState, Level } from "@engine";

import { BIRDS, type BirdId } from "./bird-defs.ts";
import {
  activityAt,
  birdPlanFor,
  birdPose,
  crossingCapacity,
  crossingPose,
  flushAt,
  forEachCrossing,
  freshBirdPose,
  residentCount,
  type BirdPlan,
} from "./bird-plan.ts";
import { birdModel } from "./bird-models.ts";
import { BIRD_STYLES, birdMaterial, buildBird } from "./bird-shapes.ts";
import type { HazeUniforms } from "./haze.ts";

/** How far from the LENS a flock is drawn at all, m, and a crossing: a
 * raven is a speck at half a kilometre, a skein a shape from much further. */
const FLOCK_REACH = 700;
const CROSSING_REACH = 1600;

type Roster = {
  mesh: THREE.InstancedMesh;
  flaps: THREE.InstancedBufferAttribute;
  folds: THREE.InstancedBufferAttribute;
  n: number;
};

export type Birds = {
  group: THREE.Group;
  /** Put every bird within sight of (`eyeX`, `eyeZ`) where the plan says
   * it is at the state's clock, and see whether any skier has put a covey
   * up. */
  update: (state: GameState, eyeX: number, eyeZ: number) => void;
  /** A new run on the same map: every covey back on the snow. */
  reset: () => void;
  plan: BirdPlan;
  dispose: () => void;
};

export function createBirds(level: Level, haze: HazeUniforms): Birds {
  const group = new THREE.Group();
  const plan = birdPlanFor(level);
  const rosters = new Map<BirdId, Roster>();
  for (const spec of BIRDS) {
    const capacity = residentCount(plan, spec.id) + crossingCapacity(plan, spec.id);
    if (capacity === 0) continue;
    // The species' model where one is loaded (`bird-models.ts`), else
    // the code's own bird, flat-shaded as it is built to be.
    const modelled = birdModel(spec, BIRD_STYLES[spec.id]);
    const geometry = modelled ?? buildBird(spec, BIRD_STYLES[spec.id]);
    const flaps = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    flaps.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aFlap", flaps);
    const folds = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    folds.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aFold", folds);
    const mesh = new THREE.InstancedMesh(geometry, birdMaterial(spec, haze, !modelled), capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    // The instances move every frame and the mesh has no fixed extent; the
    // reach test below is the cull.
    mesh.frustumCulled = false;
    group.add(mesh);
    rosters.set(spec.id, { mesh, flaps, folds, n: 0 });
  }

  /** When each flock was last put up, on the engine's clock. */
  const flushed = new Float64Array(plan.flocks.length).fill(-Infinity);

  const pose = freshBirdPose();
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);

  const write = (roster: Roster): void => {
    if (roster.n >= roster.mesh.instanceMatrix.count) return;
    pos.set(pose.x, pose.y, pose.z);
    quat.set(pose.q.x, pose.q.y, pose.q.z, pose.q.w);
    m.compose(pos, quat, one);
    roster.mesh.setMatrixAt(roster.n, m);
    roster.flaps.setX(roster.n, pose.flap);
    roster.folds.setX(roster.n, pose.fold);
    roster.n++;
  };

  const update = (state: GameState, eyeX: number, eyeZ: number): void => {
    for (const roster of rosters.values()) roster.n = 0;
    const t = state.t;
    const activity = activityAt(level);
    plan.flocks.forEach((flock, f) => {
      flushed[f] = flushAt(flock, state, flushed[f]);
      const roster = rosters.get(flock.species);
      if (!roster) return;
      // The whole beat, not the home: a flock wheeling just inside the
      // reach must not pop as it comes round.
      const far = Math.min(
        Math.hypot(flock.home.x - eyeX, flock.home.z - eyeZ),
        Math.hypot(flock.loop.x - eyeX, flock.loop.z - eyeZ) - flock.loop.radius,
      );
      if (far > FLOCK_REACH) return;
      for (let i = 0; i < flock.count; i++) {
        birdPose(flock, i, t, pose, activity, flushed[f]);
        write(roster);
      }
    });
    forEachCrossing(plan, t, (crossing) => {
      const roster = rosters.get(crossing.species);
      if (!roster) return;
      crossingPose(crossing, 0, t, pose);
      if (Math.hypot(pose.x - eyeX, pose.z - eyeZ) > CROSSING_REACH) return;
      write(roster);
      for (let i = 1; i < crossing.count; i++) {
        crossingPose(crossing, i, t, pose);
        write(roster);
      }
    });
    for (const roster of rosters.values()) {
      roster.mesh.count = roster.n;
      roster.mesh.visible = roster.n > 0;
      if (roster.n === 0) continue;
      roster.mesh.instanceMatrix.needsUpdate = true;
      roster.flaps.needsUpdate = true;
      roster.folds.needsUpdate = true;
    }
  };

  return {
    group,
    update,
    reset: () => flushed.fill(-Infinity),
    plan,
    dispose: () => {
      for (const roster of rosters.values()) {
        roster.mesh.geometry.dispose();
        (roster.mesh.material as THREE.Material).dispose();
      }
    },
  };
}
