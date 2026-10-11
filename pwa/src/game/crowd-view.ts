// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD, DRAWN — every amateur the engine has out on the ski area
// (`crowd.ts`), one instanced mesh a BODY and CUT (`crowd-shapes.ts`)
// holding whatever of that body is within sight this frame: NEAR within
// `CROWD_CUTS.near` of the lens, MID to `CROWD_CUTS.mid`, FAR to the edge of
// what is drawn at all. Each is placed where the engine has him, stood on
// the snow's own slope, turned to his heading, mirrored to the side he went
// down on, posed by the weights of the player's poses (`dialsOf`) and
// dressed in his outfit (`outfitOf`) — a matrix, a morph weight a pose
// and two vec4s an instance, written into buffers allocated once.
//
// Presentation, end to end: it reads `GameState` and the `Level`, writes
// neither. An amateur on a lift (`crowd-lift.ts`) is drawn where it has
// him — in its queue, sat on his chair, stood behind his T-bar — save in a
// cabin, on the chair the player rides, or up a lift on a map with none.
//
// A SNOWBOARDER (`Amateur.board`) is a figure of his own — the same body
// on a board, its targets the player's rider's (`crowd-board.ts`) — so a
// body ridden both ways is two meshes a cut, each sized to its own share of
// the crowd, and a goofy rider is drawn mirrored.
//
// AN AMATEUR DOWN (`Amateur.thrown`) is no blend of targets: his figure is
// hung on the engine's ragdoll as it tumbles and lies, and lifted off it as
// he gets up (`crowd-fall.ts`) — the same mesh at the same cut, its
// positions written afresh each frame into a mesh of its own, kept in a
// small pool. A fall is rare, so a few such meshes at a time cost nothing.

import * as THREE from "three";
import { smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import {
  CROWD,
  CROWD_BODIES,
  TUNING,
  carrierAt,
  carrierSwingAt,
  inCabin,
  liftPlans,
  type CrowdBody,
  type GameState,
  type Level,
} from "@engine";

import { BOARD_POSES, boardDialsOf, boardSeatHeight } from "./crowd-board.ts";
import { outfitOf, type Outfit } from "./crowd-dress.ts";
import { fallenPose, standFrame } from "./crowd-fall.ts";
import { CROWD_LOOKS, CROWD_POSES, dialsOf, seatHeight } from "./crowd-rig.ts";
import {
  CROWD_LODS,
  buildCrowdFigure,
  crowdMaterial,
  poseCrowdFigure,
  type CrowdLod,
} from "./crowd-shapes.ts";
import { FIGURE, type ViewCull } from "./view-cull.ts";
import { sharing } from "./geometry-share.ts";
import type { HazeUniforms } from "./haze.ts";
import { shadeDepth } from "./terrain-shade.ts";

/** Where the cuts hand over, m from the lens, and the furthest one is
 * drawn: past it a person is under a pixel. */
export const CROWD_CUTS = { near: 40, mid: 140, far: 700 };

/** A mesh an amateur down is drawn with: one instance, no morphs. */
type Fallen = {
  mesh: THREE.InstancedMesh;
  dress: THREE.InstancedBufferAttribute;
  dress2: THREE.InstancedBufferAttribute;
};

type Slot = {
  mesh: THREE.InstancedMesh;
  dress: THREE.InstancedBufferAttribute;
  dress2: THREE.InstancedBufferAttribute;
  weights: Float32Array;
  /** How many targets the figure carries (the morph texture's stride, less
   * the base), and how many of that body ride this way. */
  targets: number;
  capacity: number;
  n: number;
};

/** Which figure an amateur is: his body, on skis or on a board. */
type Gear = "ski" | "board";
const GEARS: readonly Gear[] = ["ski", "board"];
const gearOf = (a: { board: unknown }): Gear => (a.board ? "board" : "ski");

export type CrowdView = {
  group: THREE.Group;
  /** Pose and draw every amateur within sight of the lens at `eye` — and,
   * handed `cull`, only those in its frustum or shadowing into view. */
  update: (state: GameState, eye: THREE.Vector3, cull?: ViewCull) => void;
  dispose: () => void;
};

const TARGETS = CROWD_POSES.length;
const BOARD_TARGETS = BOARD_POSES.length;

export function createCrowdView(level: Level, haze: HazeUniforms): CrowdView {
  const group = new THREE.Group();
  group.name = "crowd";
  const material = crowdMaterial(haze);
  const slots = new Map<string, Slot>();
  let capacityOf: Map<string, number> | null = null;
  let outfits: Outfit[] = [];
  let dealtFor: unknown = null;

  /** The pool of meshes an amateur down is drawn with, by body and cut,
   * and how many of each this frame takes. */
  const fallen = new Map<string, { meshes: Fallen[]; n: number }>();

  const clear = (): void => {
    for (const slot of slots.values()) {
      group.remove(slot.mesh);
      slot.mesh.dispose();
    }
    slots.clear();
    for (const pool of fallen.values()) {
      for (const f of pool.meshes) {
        group.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mesh.dispose();
      }
    }
    fallen.clear();
  };
  /** A mesh off the pool for `body` at `lod`, built the first time. */
  const fallenMesh = (body: CrowdBody, lod: CrowdLod, gear: Gear): Fallen => {
    const key = `${body}:${lod}:${gear}`;
    let pool = fallen.get(key);
    if (!pool) fallen.set(key, (pool = { meshes: [], n: 0 }));
    if (pool.n < pool.meshes.length) return pool.meshes[pool.n++];
    const geometry = buildCrowdFigure(body, lod, gear === "board").clone();
    geometry.morphAttributes = {};
    const dress = new THREE.InstancedBufferAttribute(new Float32Array(4), 4);
    const dress2 = new THREE.InstancedBufferAttribute(new Float32Array(4), 4);
    geometry.setAttribute("aDress", dress);
    geometry.setAttribute("aDress2", dress2);
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    mesh.castShadow = lod !== "far";
    if (mesh.castShadow) mesh.customDepthMaterial = shadeDepth(haze);
    mesh.receiveShadow = lod === "near";
    mesh.frustumCulled = false;
    mesh.name = `crowd-down-${key}`;
    group.add(mesh);
    const f = { mesh, dress, dress2 };
    pool.meshes.push(f);
    pool.n++;
    return f;
  };
  /** A mesh a body, way of riding and cut, each as big as its share of the
   * crowd. */
  const build = (counts: Map<string, number>): void => {
    clear();
    for (const [figure, capacity] of counts) {
      if (capacity === 0) continue;
      const [body, gear] = figure.split(":") as [CrowdBody, Gear];
      const targets = gear === "board" ? BOARD_TARGETS : TARGETS;
      for (const lod of CROWD_LODS) {
        const geometry = sharing(buildCrowdFigure(body, lod, gear === "board"));
        const dress = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        const dress2 = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        dress.setUsage(THREE.DynamicDrawUsage);
        dress2.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute("aDress", dress);
        geometry.setAttribute("aDress2", dress2);
        const mesh = new THREE.InstancedMesh(geometry, material, capacity);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.morphTargetInfluences = new Array<number>(targets).fill(0);
        // The morph texture, allocated once at the crowd's size.
        mesh.setMorphAt(0, mesh);
        mesh.castShadow = lod !== "far";
        if (mesh.castShadow) mesh.customDepthMaterial = shadeDepth(haze);
        mesh.receiveShadow = lod === "near";
        mesh.frustumCulled = false;
        mesh.count = 0;
        mesh.visible = false;
        mesh.name = `crowd-${body}-${lod}${gear === "board" ? "-board" : ""}`;
        group.add(mesh);
        const weights = mesh.morphTexture!.image.data as unknown as Float32Array;
        slots.set(`${body}:${gear}:${lod}`, {
          mesh,
          dress,
          dress2,
          weights,
          targets,
          capacity,
          n: 0,
        });
      }
    }
  };

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const size = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const normal = { x: 0, y: 1, z: 0 };
  const lift = new THREE.Vector3();
  /** When each amateur was last sat on a chair, s of the engine's clock. */
  let satAt = new Float64Array(0);
  const dials = new Float32Array(TARGETS);
  const boardDials = new Float32Array(BOARD_TARGETS);
  /** How far under a chair's seat each body's figure is set, m, on skis
   * and on a board. */
  const seatDrop = Object.fromEntries(
    CROWD_BODIES.map((b) => [b, seatHeight(CROWD_LOOKS[b])]),
  ) as Record<CrowdBody, number>;
  const boardDrop = Object.fromEntries(
    CROWD_BODIES.map((b) => [b, boardSeatHeight(CROWD_LOOKS[b])]),
  ) as Record<CrowdBody, number>;

  const update: CrowdView["update"] = (state, eye, cull) => {
    const crowd = state.crowd;
    if (!crowd) {
      for (const slot of slots.values()) slot.mesh.visible = false;
      for (const pool of fallen.values()) for (const f of pool.meshes) f.mesh.visible = false;
      return;
    }
    if (dealtFor !== crowd) {
      // A crowd of its own: the meshes sized to it and every outfit dealt.
      dealtFor = crowd;
      const counts = new Map<string, number>();
      for (const b of CROWD_BODIES) for (const g of GEARS) counts.set(`${b}:${g}`, 0);
      for (const a of crowd.amateurs) {
        const key = `${a.body}:${gearOf(a)}`;
        counts.set(key, counts.get(key)! + 1);
      }
      const same = capacityOf && [...counts].every(([key, n]) => (capacityOf!.get(key) ?? 0) >= n);
      if (!same) {
        build(counts);
        capacityOf = counts;
      }
      outfits = crowd.amateurs.map((a) => outfitOf(a, crowd.groups[a.group], level.seed));
      satAt = new Float64Array(crowd.amateurs.length).fill(-Infinity);
    }
    for (const slot of slots.values()) slot.n = 0;
    for (const pool of fallen.values()) pool.n = 0;
    const reach2 = CROWD_CUTS.far * CROWD_CUTS.far;
    const plans = liftPlans(level);
    const mine = state.skier.lift;
    for (const a of crowd.amateurs) {
      if (a.mode === "lift") continue;
      // ON A LIFT (`crowd-lift.ts`): in a cabin he is out of sight, and on
      // the chair the player rides his own is the player's alone.
      const kind = a.mode === "ride" ? plans[a.lift]?.lift.kind : undefined;
      if (inCabin(a, plans[a.lift])) continue;
      if (kind && mine?.phase === "ride" && mine.index === a.lift) {
        const c = carrierAt(plans[a.lift], a.carrier, state.t);
        const his =
          mine.carrier !== undefined
            ? mine.carrier === a.carrier
            : c.side === 0 && Math.abs(c.u - mine.u) < plans[a.lift].look.every / 2;
        if (his) continue;
      }
      // Sat on a chair: scooped onto it over `ride.sit` s, swung on its
      // hanger as the clock swings it, and stood up off it at the unload
      // over `lift.rise` s as he slides away.
      let seat = 0;
      let swing = 0;
      if (kind === "chair") {
        seat = Math.min(1, a.timer / CROWD.ride.sit);
        const c = carrierAt(plans[a.lift], a.carrier, state.t);
        swing = carrierSwingAt(plans[a.lift], c.u, c.side) * seat;
        satAt[a.id] = state.t;
      } else if (!kind) {
        const since = state.t - satAt[a.id];
        if (since >= 0 && since < TUNING.lift.rise)
          seat = 1 - smoothstep(0, TUNING.lift.rise, since);
      }
      const dx = a.x - eye.x;
      const dz = a.z - eye.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > reach2) continue;
      const far = Math.sqrt(d2 + (a.y - eye.y) ** 2);
      const lod: CrowdLod = far < CROWD_CUTS.near ? "near" : far < CROWD_CUTS.mid ? "mid" : "far";
      // Out of the frustum and shadowing nothing in it: not posed at all.
      const foot = seat > 0 ? a.y - 1 : a.y;
      if (
        cull &&
        !a.thrown &&
        !cull.seen(a.x, foot, a.z, FIGURE.radius, FIGURE.height, lod !== "far")
      )
        continue;
      // Stood on the snow's own slope, facing his heading — or, sat on a
      // chair, upright on its seat.
      if (seat > 0) normal.x = normal.z = 0;
      else level.normalAt(a.x, a.z, normal);
      if (seat > 0) normal.y = 1;
      up.set(normal.x, normal.y, normal.z);
      fwd.set(Math.sin(a.heading), 0, Math.cos(a.heading));
      right.crossVectors(up, fwd).normalize();
      fwd.crossVectors(right, up).normalize();
      if (a.thrown) {
        // DOWN: hung on his ragdoll, or getting up off it.
        const pose = fallenPose(a, standFrame(a, normal), [a.x, a.y, a.z]);
        if (!pose) continue;
        const f = fallenMesh(a.body, lod, gearOf(a));
        poseCrowdFigure(a.body, lod, pose, f.mesh.geometry, a.board !== null);
        f.mesh.setMatrixAt(0, m.makeTranslation(a.x, a.y, a.z));
        f.mesh.instanceMatrix.needsUpdate = true;
        const o = outfits[a.id];
        f.dress.setXYZW(0, o[0], o[1], o[2], o[3]);
        f.dress2.setXYZW(0, o[4], o[5], o[6], 0);
        f.dress.needsUpdate = true;
        f.dress2.needsUpdate = true;
        continue;
      }
      const gear = gearOf(a);
      const slot = slots.get(`${a.body}:${gear}:${lod}`);
      if (!slot || slot.n >= slot.capacity) continue;
      const i = slot.n;
      basis.makeBasis(right, up, fwd);
      quat.setFromRotationMatrix(basis);
      // A rider on a T-bar rides it stood, his rear foot out on the pad.
      const mirror =
        gear === "board"
          ? boardDialsOf(a, boardDials, state.t, seat, kind === "drag" ? 1 : 0)
          : dialsOf(a, dials, state.t, seat);
      const drop = (gear === "board" ? boardDrop : seatDrop)[a.body];
      if (kind === "chair") {
        // Hung from the grip `ride.under` m over the seat, swung about it.
        const e = fromEuler(a.heading, swing, 0);
        quat.set(e.x, e.y, e.z, e.w);
        pos.set(0, -(CROWD.ride.under + drop), 0).applyQuaternion(quat);
        pos.add(lift.set(a.x, a.y + CROWD.ride.under, a.z));
      } else pos.set(a.x, a.y - (kind && seat > 0 ? drop : 0), a.z);
      m.compose(pos, quat, size.set(mirror, 1, 1));
      slot.mesh.setMatrixAt(i, m);
      // The morph texture: the base's influence, then each target's.
      const w = slot.weights;
      const from = gear === "board" ? boardDials : dials;
      const at = i * (slot.targets + 1);
      w[at] = 1;
      for (let k = 0; k < slot.targets; k++) w[at + 1 + k] = from[k];
      const o = outfits[a.id];
      slot.dress.setXYZW(i, o[0], o[1], o[2], o[3]);
      slot.dress2.setXYZW(i, o[4], o[5], o[6], 0);
      slot.n++;
    }
    for (const pool of fallen.values()) {
      pool.meshes.forEach((f, k) => (f.mesh.visible = k < pool.n));
    }
    for (const slot of slots.values()) {
      slot.mesh.count = slot.n;
      slot.mesh.visible = slot.n > 0;
      if (slot.n === 0) continue;
      slot.mesh.instanceMatrix.needsUpdate = true;
      slot.mesh.morphTexture!.needsUpdate = true;
      slot.dress.needsUpdate = true;
      slot.dress2.needsUpdate = true;
    }
  };

  return {
    group,
    update,
    dispose() {
      clear();
      material.dispose();
    },
  };
}
