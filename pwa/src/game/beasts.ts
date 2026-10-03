// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANIMALS, DRAWN — the groups `beast-plan.ts` laid over the map, one
// instanced mesh a species FORM and cut (`beast-shapes.ts`) holding whatever
// of it is within sight this frame, each animal posed off the engine's own
// clock with its legs, its head and its rack moved in the shader, and drawn
// as WHO it is (`wild-traits.ts`: grown or young, its size, its shade, how
// far its antlers have grown — dealt off the group's own scatter, never the
// engine's stream) at the NEAR cut within `WildLook.near` of the lens and the
// FAR one past it; and their PRINTS, handed to the trail map as stamps beside
// the skiers' own.
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
import {
  BEAST_STYLES,
  beastDepthMaterial,
  beastMaterial,
  buildBeast,
  type BeastLod,
} from "./beast-shapes.ts";
import { TRACKED, footfall, footfallSpacing, priorPrints } from "./beast-tracks.ts";
import type { HazeUniforms } from "./haze.ts";
import type { WildLook } from "./settings-video.ts";
import { BEAST_FORMS, beastIndividual, drawnForm, freshIndividual } from "./wild-traits.ts";
import type { SnowSampler, Stamp } from "./trail-stamp.ts";
import { wildGround } from "./wild-ground.ts";

/** How far from the lens an animal is drawn, m: a reindeer is a mark on a
 * far hillside at half a kilometre, and a hare past two hundred metres is a
 * white thing on white nobody sees. */
const REACH = 520;
/** The most new prints kept to be laid again when the window moves. */
const MOST_FRESH = 6000;

/** The cuts, in the order a roster's slots are laid. */
const LODS: readonly BeastLod[] = ["near", "far"];

/** One mesh of a species: a form at a cut, and its instances' motion
 * (gait, stride, graze, rack). */
type Slot = { mesh: THREE.InstancedMesh; motion: THREE.InstancedBufferAttribute; n: number };

/** A species' meshes, form by form and cut by cut (`form * 2 + lod`), and
 * how many of its forms are drawn. */
type Roster = { slots: Slot[]; forms: number };

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
  /** The FOREST row moved: how many forms are drawn and where the cuts
   * hand over. */
  setLook: (look: WildLook) => void;
  plan: BeastPlan;
  dispose: () => void;
};

/** WHAT SNOW THE PRINTS GO INTO (`snowpack.ts`), as the renderer's run
 * reads it: the snow at a point, and how much has fallen into last night's
 * prints since (0..1). Left out, every print is in settled powder over the
 * packed field. */
export type PrintSnow = { at: SnowSampler; soften: () => number };

export function createBeasts(
  level: Level,
  haze: HazeUniforms,
  look: WildLook,
  snow?: PrintSnow,
): Beasts {
  const group = new THREE.Group();
  const plan = beastPlanFor(level);
  const ground = wildGround(level);
  const rosters = new Map<BeastId, Roster>();
  let near = look.near;
  let drawnForms = look.forms;

  const clear = (): void => {
    for (const roster of rosters.values()) {
      for (const slot of roster.slots) {
        group.remove(slot.mesh);
        slot.mesh.geometry.dispose();
        (slot.mesh.material as THREE.Material).dispose();
        slot.mesh.customDepthMaterial?.dispose();
      }
    }
    rosters.clear();
  };
  const build = (forms: number): void => {
    clear();
    for (const spec of BEASTS) {
      const capacity = beastCount(plan, spec.id);
      if (capacity === 0) continue;
      const drawn = Math.max(1, Math.min(forms, BEAST_FORMS[spec.id].length));
      const slots: Slot[] = [];
      for (const form of BEAST_FORMS[spec.id].slice(0, drawn)) {
        for (const lod of LODS) {
          const { geometry, pivot } = buildBeast(spec, BEAST_STYLES[spec.id], form, lod);
          const motion = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
          motion.setUsage(THREE.DynamicDrawUsage);
          geometry.setAttribute("aMotion", motion);
          const mesh = new THREE.InstancedMesh(
            geometry,
            beastMaterial(spec, pivot, haze),
            capacity,
          );
          mesh.customDepthMaterial = beastDepthMaterial(spec, pivot);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          // Every individual's shade, written as it is drawn.
          mesh.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(capacity * 3),
            3,
          );
          mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
          mesh.count = 0;
          mesh.visible = false;
          mesh.frustumCulled = false;
          group.add(mesh);
          slots.push({ mesh, motion, n: 0 });
        }
      }
      rosters.set(spec.id, { slots, forms: drawn });
    }
  };
  build(look.forms);

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
  const who = freshIndividual();
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const size = new THREE.Vector3();
  const tint = new THREE.Color();

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
    for (const roster of rosters.values()) for (const slot of roster.slots) slot.n = 0;
    const t = state.t;
    plan.groups.forEach((g, k) => {
      const was = spooks[k];
      const spook = spookAt(g, state, was, ground);
      spooks[k] = spook;
      const roster = rosters.get(g.species);
      if (!roster) return;
      const far = Math.hypot(g.round.x - eyeX, g.round.z - eyeZ) - g.round.radius;
      // A group that has run off its round lays new prints wherever the
      // lens is: the prints are the map's, not the picture's.
      const wandering = spook.at > -Infinity;
      if (far > REACH && !wandering) return;
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
        if (far > REACH) continue;
        beastIndividual(g.species, g.scatter, i, g.count, who);
        const lod = Math.hypot(pose.x - eyeX, pose.z - eyeZ) < near ? 0 : 1;
        const slot = roster.slots[drawnForm(who.form, roster.forms) * 2 + lod];
        if (slot.n >= slot.mesh.instanceMatrix.count) continue;
        pos.set(pose.x, pose.y, pose.z);
        quat.set(pose.q.x, pose.q.y, pose.q.z, pose.q.w);
        m.compose(pos, quat, size.setScalar(who.scale));
        slot.mesh.setMatrixAt(slot.n, m);
        slot.mesh.setColorAt(slot.n, tint.setRGB(who.shade[0], who.shade[1], who.shade[2]));
        slot.motion.setXYZW(slot.n, pose.gait, pose.stride, pose.graze, who.rack);
        slot.n++;
      }
    });
    for (const roster of rosters.values()) {
      for (const slot of roster.slots) {
        slot.mesh.count = slot.n;
        slot.mesh.visible = slot.n > 0;
        if (slot.n === 0) continue;
        slot.mesh.instanceMatrix.needsUpdate = true;
        if (slot.mesh.instanceColor) slot.mesh.instanceColor.needsUpdate = true;
        slot.motion.needsUpdate = true;
      }
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
    setLook: (next) => {
      near = next.near;
      if (next.forms !== drawnForms) build(next.forms);
      drawnForms = next.forms;
    },
    plan,
    dispose: clear,
  };
}
