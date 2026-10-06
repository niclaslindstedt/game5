// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIRDS, DRAWN — the flocks and the crossings `bird-plan.ts` laid over
// the map, as three.js sees them: one instanced mesh a species FORM and cut
// (`bird-shapes.ts`), holding whatever of it is within sight this frame,
// each bird posed off the engine's own clock, its wings hinged in the shader,
// and drawn as WHO it is (`wild-traits.ts`: its form, its size, its shade —
// dealt off the flock's own scatter, never the engine's stream) at the NEAR
// cut within `WildLook.near` of the lens and the FAR one past it. How many
// forms a species is drawn in is the FOREST row's (`FOREST_LOOK[row].wild`).
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
import { BIRD_STYLES, birdMaterial, buildBird, type BirdLod } from "./bird-shapes.ts";
import type { HazeUniforms } from "./haze.ts";
import type { WildLook } from "./settings-video.ts";
import { BIRD_FORMS, birdIndividual, drawnForm, freshIndividual } from "./wild-traits.ts";

/** How far from the LENS a flock is drawn at all, m, and a crossing: a
 * raven is a speck at half a kilometre, a skein a shape from much further. */
const FLOCK_REACH = 700;
const CROSSING_REACH = 1600;

/** The cuts, in the order a roster's slots are laid. */
const LODS: readonly BirdLod[] = ["near", "far"];

/** One mesh of a species: a form at a cut. */
type Slot = {
  mesh: THREE.InstancedMesh;
  flaps: THREE.InstancedBufferAttribute;
  folds: THREE.InstancedBufferAttribute;
  n: number;
};

/** A species' meshes, form by form and cut by cut (`form * 2 + lod`), and
 * how many of its forms are drawn. */
type Roster = { slots: Slot[]; forms: number };

export type Birds = {
  group: THREE.Group;
  /** Put every bird within sight of (`eyeX`, `eyeZ`) where the plan says
   * it is at the state's clock, and see whether any skier has put a covey
   * up. */
  update: (state: GameState, eyeX: number, eyeZ: number) => void;
  /** A new run on the same map: every covey back on the snow. */
  reset: () => void;
  /** The FOREST row moved: how many forms are drawn and where the cuts
   * hand over. */
  setLook: (look: WildLook) => void;
  plan: BirdPlan;
  dispose: () => void;
};

export function createBirds(level: Level, haze: HazeUniforms, look: WildLook): Birds {
  const group = new THREE.Group();
  const plan = birdPlanFor(level);
  const rosters = new Map<BirdId, Roster>();
  let near = look.near;
  let drawnForms = look.forms;

  const clear = (): void => {
    for (const roster of rosters.values()) {
      for (const slot of roster.slots) {
        group.remove(slot.mesh);
        slot.mesh.geometry.dispose();
        (slot.mesh.material as THREE.Material).dispose();
      }
    }
    rosters.clear();
  };
  const build = (forms: number): void => {
    clear();
    for (const spec of BIRDS) {
      const capacity = residentCount(plan, spec.id) + crossingCapacity(plan, spec.id);
      if (capacity === 0) continue;
      const drawn = Math.max(1, Math.min(forms, BIRD_FORMS[spec.id].length));
      const slots: Slot[] = [];
      for (const form of BIRD_FORMS[spec.id].slice(0, drawn)) {
        for (const lod of LODS) {
          const geometry = buildBird(spec, BIRD_STYLES[spec.id], form, lod);
          const flaps = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
          flaps.setUsage(THREE.DynamicDrawUsage);
          geometry.setAttribute("aFlap", flaps);
          const folds = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
          folds.setUsage(THREE.DynamicDrawUsage);
          geometry.setAttribute("aFold", folds);
          const mesh = new THREE.InstancedMesh(geometry, birdMaterial(spec, haze), capacity);
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          // Every individual's shade, written as it is drawn.
          mesh.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(capacity * 3),
            3,
          );
          mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
          mesh.count = 0;
          mesh.visible = false;
          // The instances move every frame and the mesh has no fixed extent;
          // the reach test below is the cull.
          mesh.frustumCulled = false;
          group.add(mesh);
          slots.push({ mesh, flaps, folds, n: 0 });
        }
      }
      rosters.set(spec.id, { slots, forms: drawn });
    }
  };
  build(look.forms);

  /** When each flock was last put up, on the engine's clock. */
  const flushed = new Float64Array(plan.flocks.length).fill(-Infinity);

  const pose = freshBirdPose();
  const who = freshIndividual();
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const size = new THREE.Vector3();
  const tint = new THREE.Color();
  let eyeX = 0;
  let eyeZ = 0;

  /** Draw the bird in `pose` as bird `i` of a group scattered by `scatter`. */
  const write = (roster: Roster, species: BirdId, scatter: number, i: number): void => {
    birdIndividual(species, scatter, i, who);
    const lod = Math.hypot(pose.x - eyeX, pose.z - eyeZ) < near ? 0 : 1;
    const slot = roster.slots[drawnForm(who.form, roster.forms) * 2 + lod];
    if (slot.n >= slot.mesh.instanceMatrix.count) return;
    pos.set(pose.x, pose.y, pose.z);
    quat.set(pose.q.x, pose.q.y, pose.q.z, pose.q.w);
    m.compose(pos, quat, size.setScalar(who.scale));
    slot.mesh.setMatrixAt(slot.n, m);
    slot.mesh.setColorAt(slot.n, tint.setRGB(who.shade[0], who.shade[1], who.shade[2]));
    slot.flaps.setX(slot.n, pose.flap);
    slot.folds.setX(slot.n, pose.fold);
    slot.n++;
  };

  const update = (state: GameState, x: number, z: number): void => {
    eyeX = x;
    eyeZ = z;
    for (const roster of rosters.values()) for (const slot of roster.slots) slot.n = 0;
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
        write(roster, flock.species, flock.scatter, i);
      }
    });
    forEachCrossing(plan, t, (crossing) => {
      const roster = rosters.get(crossing.species);
      if (!roster) return;
      crossingPose(crossing, 0, t, pose);
      if (Math.hypot(pose.x - eyeX, pose.z - eyeZ) > CROSSING_REACH) return;
      write(roster, crossing.species, crossing.scatter, 0);
      for (let i = 1; i < crossing.count; i++) {
        crossingPose(crossing, i, t, pose);
        write(roster, crossing.species, crossing.scatter, i);
      }
    });
    for (const roster of rosters.values()) {
      for (const slot of roster.slots) {
        slot.mesh.count = slot.n;
        slot.mesh.visible = slot.n > 0;
        if (slot.n === 0) continue;
        slot.mesh.instanceMatrix.needsUpdate = true;
        if (slot.mesh.instanceColor) slot.mesh.instanceColor.needsUpdate = true;
        slot.flaps.needsUpdate = true;
        slot.folds.needsUpdate = true;
      }
    }
  };

  return {
    group,
    update,
    reset: () => flushed.fill(-Infinity),
    setLook: (next) => {
      near = next.near;
      if (next.forms !== drawnForms) build(next.forms);
      drawnForms = next.forms;
    },
    plan,
    dispose: clear,
  };
}
