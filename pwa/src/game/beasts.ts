// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANIMALS, DRAWN — the groups `beast-plan.ts` laid over the map, one
// instanced mesh a species holding whatever of it is within sight this
// frame, each animal posed off the engine's own clock with its legs and its
// head moved in the shader; and their PRINTS, handed to the trail map as
// stamps beside the skiers' own.
//
// TWO MEMORIES, both the renderer's, both decided by rules stated in the
// plan: when each group was last frightened and where it ran (`spookAt`),
// and which of its prints have been laid. Last night's prints
// (`priorPrints`) go down over the whole map once, the frame a run starts;
// the fine window of the trail map follows the player and is refilled from
// the coarse map when it moves, so every print inside the new window is
// laid again at the fine map's grain (MAX blending makes a print laid twice
// the same print). A frightened animal walks a round nobody has walked, so
// it lays NEW prints as it goes.
//
// NOTHING IS ALLOCATED PER FRAME but the prints themselves.

import * as THREE from "three";
import type { GameState, Level } from "@engine";

import { BEASTS, beastById, type BeastId } from "./beast-defs.ts";
import {
  CALM,
  beastCount,
  beastPlanFor,
  beastPose,
  freshBeastPose,
  spookAt,
  type BeastPlan,
  type Spook,
} from "./beast-plan.ts";
import { beastModel } from "./beast-models.ts";
import { BEAST_STYLES, beastDepthMaterial, beastMaterial, buildBeast } from "./beast-shapes.ts";
import { TRACKED, footfall, footfallSpacing, priorPrints } from "./beast-tracks.ts";
import type { HazeUniforms } from "./haze.ts";
import type { SnowSampler, Stamp } from "./trail-stamp.ts";
import { wildGround } from "./wild-ground.ts";

/** How far from the lens an animal is drawn, m: a reindeer is a mark on a
 * far hillside at half a kilometre, and a hare past two hundred metres is a
 * white thing on white nobody sees. */
const REACH = 520;
/** The most new prints kept to be laid again when the window moves. */
const MOST_FRESH = 6000;

type Roster = {
  mesh: THREE.InstancedMesh;
  gait: THREE.InstancedBufferAttribute;
  stride: THREE.InstancedBufferAttribute;
  graze: THREE.InstancedBufferAttribute;
  n: number;
};

/** The fine trail window, as the renderer has it: its corner and its side. */
export type TrailWindow = { x: number; z: number; span: number };

export type Beasts = {
  group: THREE.Group;
  /** Frighten, pose and draw every animal within sight of (`eyeX`,
   * `eyeZ`); push any prints owed onto `stamps` (null with the trails
   * off), `window` being the fine trail map's. */
  update: (
    state: GameState,
    eyeX: number,
    eyeZ: number,
    stamps: Stamp[] | null,
    window: TrailWindow | null,
  ) => void;
  /** The trail maps were wiped: lay every print again. */
  retrack: () => void;
  /** A new run on the same map: every group back on its round. */
  reset: () => void;
  plan: BeastPlan;
  dispose: () => void;
};

/** WHAT SNOW THE PRINTS GO INTO (`snowpack.ts`), as the renderer's run
 * reads it: the snow at a point, and how much has fallen into last night's
 * prints since (0..1). Left out, every print is in settled powder over the
 * packed field. */
export type PrintSnow = { at: SnowSampler; soften: () => number };

export function createBeasts(level: Level, haze: HazeUniforms, snow?: PrintSnow): Beasts {
  const group = new THREE.Group();
  const plan = beastPlanFor(level);
  const ground = wildGround(level);
  const rosters = new Map<BeastId, Roster>();
  for (const spec of BEASTS) {
    const capacity = beastCount(plan, spec.id);
    if (capacity === 0) continue;
    // The species' model where one is loaded (`beast-models.ts`), else
    // the code's own animal, flat-shaded as it is built to be.
    const modelled = beastModel(spec, BEAST_STYLES[spec.id]);
    const { geometry, pivot } = modelled ?? buildBeast(spec, BEAST_STYLES[spec.id]);
    const attr = (): THREE.InstancedBufferAttribute => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    const gait = attr();
    const stride = attr();
    const graze = attr();
    geometry.setAttribute("aGait", gait);
    geometry.setAttribute("aStride", stride);
    geometry.setAttribute("aGraze", graze);
    const mesh = new THREE.InstancedMesh(
      geometry,
      beastMaterial(spec, pivot, haze, !modelled),
      capacity,
    );
    mesh.customDepthMaterial = beastDepthMaterial(spec, pivot);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
    rosters.set(spec.id, { mesh, gait, stride, graze, n: 0 });
  }

  const prior: Stamp[] = [];
  /** Last night's prints, laid into the snow the run is ridden on — so
   * built when they are first laid, not when the map is. */
  const layPrior = (): void => {
    prior.length = 0;
    const soften = snow?.soften() ?? 0;
    for (const g of plan.groups) priorPrints(g, level.packedAt, prior, snow?.at, soften);
  };
  const fresh: Stamp[] = [];
  let laid = false;
  let windowAt: TrailWindow | null = null;
  const spooks: Spook[] = plan.groups.map(() => CALM);
  /** Per tracked member: where it last left a print, and how many it has
   * left, for the pattern's alternation. NaN until it first runs. */
  const lastX = new Float64Array(plan.groups.length * TRACKED).fill(NaN);
  const lastZ = new Float64Array(plan.groups.length * TRACKED).fill(NaN);
  const prints = new Uint32Array(plan.groups.length * TRACKED);

  const pose = freshBeastPose();
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);

  const inWindow = (s: Stamp, w: TrailWindow): boolean =>
    s.bx > w.x - 2 && s.bz > w.z - 2 && s.bx < w.x + w.span + 2 && s.bz < w.z + w.span + 2;

  const layPrints = (stamps: Stamp[], window: TrailWindow | null): void => {
    const moved =
      window !== null &&
      (windowAt === null ||
        windowAt.x !== window.x ||
        windowAt.z !== window.z ||
        windowAt.span !== window.span);
    if (!laid) {
      layPrior();
      for (const s of prior) stamps.push(s);
      for (const s of fresh) stamps.push(s);
      laid = true;
    } else if (moved && window) {
      for (const s of prior) if (inWindow(s, window)) stamps.push(s);
      for (const s of fresh) if (inWindow(s, window)) stamps.push(s);
    }
    windowAt = window ? { ...window } : null;
  };

  const update: Beasts["update"] = (state, eyeX, eyeZ, stamps, window) => {
    if (stamps) layPrints(stamps, window);
    for (const roster of rosters.values()) roster.n = 0;
    const t = state.t;
    plan.groups.forEach((g, k) => {
      const was = spooks[k];
      const spook = spookAt(g, state, was, ground);
      spooks[k] = spook;
      const roster = rosters.get(g.species);
      if (!roster) return;
      const near = Math.hypot(g.round.x - eyeX, g.round.z - eyeZ) - g.round.radius;
      // A group that has run off its round lays new prints wherever the
      // lens is: the prints are the map's, not the picture's.
      const wandering = spook.at > -Infinity;
      if (near > REACH && !wandering) return;
      const spec = beastById(g.species);
      for (let i = 0; i < g.count; i++) {
        beastPose(g, i, t, ground, pose, spook);
        if (wandering && stamps && i < TRACKED) {
          const slot = k * TRACKED + i;
          if (Number.isNaN(lastX[slot]) || spook !== was) {
            lastX[slot] = pose.x;
            lastZ[slot] = pose.z;
          } else if (
            Math.hypot(pose.x - lastX[slot], pose.z - lastZ[slot]) >= footfallSpacing(spec)
          ) {
            const before = stamps.length;
            // Nothing is pressed into a frozen river's ice.
            if (!ground.onIce(pose.x, pose.z)) {
              footfall(
                spec,
                pose.x,
                pose.z,
                pose.heading,
                prints[slot]++,
                level.packedAt(pose.x, pose.z),
                stamps,
                snow?.at(pose.x, pose.z),
              );
            }
            for (let s = before; s < stamps.length && fresh.length < MOST_FRESH; s++) {
              fresh.push(stamps[s]);
            }
            lastX[slot] = pose.x;
            lastZ[slot] = pose.z;
          }
        }
        if (near > REACH || roster.n >= roster.mesh.instanceMatrix.count) continue;
        pos.set(pose.x, pose.y, pose.z);
        quat.set(pose.q.x, pose.q.y, pose.q.z, pose.q.w);
        m.compose(pos, quat, one);
        roster.mesh.setMatrixAt(roster.n, m);
        roster.gait.setX(roster.n, pose.gait);
        roster.stride.setX(roster.n, pose.stride);
        roster.graze.setX(roster.n, pose.graze);
        roster.n++;
      }
    });
    for (const roster of rosters.values()) {
      roster.mesh.count = roster.n;
      roster.mesh.visible = roster.n > 0;
      if (roster.n === 0) continue;
      roster.mesh.instanceMatrix.needsUpdate = true;
      roster.gait.needsUpdate = true;
      roster.stride.needsUpdate = true;
      roster.graze.needsUpdate = true;
    }
  };

  return {
    group,
    update,
    retrack: () => {
      laid = false;
      windowAt = null;
    },
    reset: () => {
      spooks.fill(CALM);
      fresh.length = 0;
      lastX.fill(NaN);
      lastZ.fill(NaN);
      prints.fill(0);
      laid = false;
      windowAt = null;
    },
    plan,
    dispose: () => {
      for (const roster of rosters.values()) {
        roster.mesh.geometry.dispose();
        (roster.mesh.material as THREE.Material).dispose();
        roster.mesh.customDepthMaterial?.dispose();
      }
    },
  };
}
