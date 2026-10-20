// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY ON THE GROUND AS DRAWN IN THE RUN — every soldier the engine
// puts on the snow (`army-ground.ts`, `ArmyState.troops`) drawn as the
// part-3 figures (`soldier-shapes.ts`) in the pose his mode says, where he
// is this frame:
//
//   * a rifleman on his skis (the `skier` figure): skiing — tucked, leant
//     into his turn, poling as he works up a rise — stood or knelt to aim
//     (`skiAim`, `skiKneel`), knelt facing out at the dismount, sat on a
//     chair of a lift (`seat`), knelt over the man he arrests (`pin`);
//   * down a fast rope (the `foot` figure, `rope`), the rope itself hung
//     from the machine's door to the snow;
//   * the anti-armour man on foot (the `rocketeer` figure): walking, the
//     launcher on his shoulder stood or knelt;
//   * KNOCKED DOWN, or killed with the INJURIES on: hung on his body's
//     ragdoll (`foot.ts`, read as his joints — `lyingPose`), posed outright;
//   * aboard a machine again or in a gondola's cabin: not drawn.
//
// His rounds' flashes, tracers and strikes are the guns' (`gunfire-view.ts`,
// the engine's `gunfire` state). Presentation only: it reads the state
// and writes nothing.

import * as THREE from "three";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import {
  ARMY_HELI,
  CROWD,
  carrierAt,
  carrierSwingAt,
  liftPlans,
  armyHelis,
  armyPoint,
  armyTroops,
  inGondola,
  soldierKey,
  type GameState,
  type Soldier,
} from "@engine";

import { seatHeight } from "./crowd-rig.ts";
import type { CrowdLod } from "./crowd-shapes.ts";
import { lyingPose } from "./crowd-fall.ts";
import { CROWD_CUTS } from "./crowd-view.ts";
import { lyingSoldier, PACK, ROPE_AHEAD, SOLDIER_LOOK, type SoldierKind } from "./soldier-pose.ts";
import { SoldierView } from "./soldier-shapes.ts";

/** How far under a chair's grip-hung seat a sat soldier's figure stands,
 * m (the figure's origin is the snow under him). */
const SEAT_DROP = seatHeight(SOLDIER_LOOK);

/** A pole's stride as drawn while he works up a rise: its rate, Hz. */
const STRIDE_HZ = 1.1;
/** The rocketeer's walk: a stride's length, m. */
const PACE = 1.4;

/** Fast ropes drawn at once at the most (two a machine). */
const ROPES = 8;

/** One soldier as drawn: his figure, its cut, and the ragdoll it was last
 * posed off (`settled`, posed once more and then left). */
type Drawn = { view: SoldierView; kind: SoldierKind; lod: CrowdLod; seen: number; lay: number };

export type ArmyGroundView = {
  group: THREE.Group;
  /** Draw `state`'s soldiers, `alpha` the share of a step (`simDt` s) the
   * picture is past it. */
  frame(state: GameState, alpha: number, simDt: number): void;
  /** Where the lens is, for the figures' cuts. */
  seen(eye: { x: number; y: number; z: number }): void;
  dispose(): void;
};

/** Which figure a soldier is drawn as, by his role and what he is doing. */
function kindOf(s: Soldier): SoldierKind {
  if (s.mode === "rope") return "foot";
  return s.role === "rocket" ? "rocketeer" : "skier";
}

export function createArmyGroundView(material: THREE.Material): ArmyGroundView {
  const group = new THREE.Group();
  group.name = "army-ground";
  const drawn = new Map<number, Drawn>();
  const eye = { x: 0, y: 0, z: 0 };
  let owner: GameState | null = null;
  let frameNo = 0;
  const normal = { x: 0, y: 1, z: 0 };
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const drop3 = new THREE.Vector3();

  // THE FAST ROPES: a segment each, the door's hook to the snow.
  const ropePos = new Float32Array(ROPES * 6);
  const ropeGeo = new THREE.BufferGeometry();
  ropeGeo.setAttribute("position", new THREE.BufferAttribute(ropePos, 3));
  const ropes = new THREE.LineSegments(ropeGeo, new THREE.LineBasicMaterial({ color: 0x2a2a24 }));
  ropes.frustumCulled = false;
  group.add(ropes);

  const drop = (id: number): void => {
    const d = drawn.get(id);
    if (!d) return;
    group.remove(d.view.mesh);
    d.view.dispose();
    drawn.delete(id);
  };

  const figure = (s: Soldier, kind: SoldierKind, lod: CrowdLod): Drawn => {
    let d = drawn.get(s.id);
    if (d && (d.kind !== kind || d.lod !== lod)) {
      drop(s.id);
      d = undefined;
    }
    if (!d) {
      const view = new SoldierView(kind, lod, material);
      group.add(view.mesh);
      d = { view, kind, lod, seen: frameNo, lay: -1 };
      drawn.set(s.id, d);
    }
    d.seen = frameNo;
    return d;
  };

  /** Stood upright on the snow under him (or square to it), facing `face`. */
  const stand = (
    mesh: THREE.Object3D,
    state: GameState,
    x: number,
    y: number,
    z: number,
    face: number,
    onSlope: boolean,
  ): void => {
    if (onSlope) state.level.normalAt(x, z, normal);
    else {
      normal.x = normal.z = 0;
      normal.y = 1;
    }
    up.set(normal.x, normal.y, normal.z);
    fwd.set(Math.sin(face), 0, Math.cos(face));
    right.crossVectors(up, fwd).normalize();
    fwd.crossVectors(right, up).normalize();
    basis.makeBasis(right, up, fwd);
    mesh.quaternion.setFromRotationMatrix(basis);
    mesh.position.set(x, y, z);
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
      const down = state.foot?.down ?? [];
      for (const s of armyTroops(state)) {
        if (s.mode === "gone" || inGondola(state, s)) continue;
        // DOWN: on his body's ragdoll, posed outright while it moves.
        if (s.mode === "down" || s.mode === "hurt" || s.mode === "dead") {
          const body = down.find((f) => f.key === soldierKey(s));
          if (!body) continue;
          const kind = kindOf(s);
          const d = figure(s, kind, "near");
          const p = body.thrown.points;
          const at: [number, number, number] = [p[0], p[1], p[2]];
          if (d.lay !== 1 || !body.settled) {
            const posed = lyingPose(p, "man", at, false, SOLDIER_LOOK);
            d.view.posed(lyingSoldier(posed, kind));
            d.lay = body.settled ? 1 : 0;
          }
          d.view.mesh.quaternion.identity();
          d.view.mesh.position.set(at[0], at[1], at[2]);
          d.view.mesh.visible = true;
          continue;
        }
        const far = Math.hypot(s.x - eye.x, s.y - eye.y, s.z - eye.z);
        const lod: CrowdLod = far < CROWD_CUTS.near ? "near" : far < CROWD_CUTS.mid ? "mid" : "far";
        const kind = kindOf(s);
        const d = figure(s, kind, lod);
        // Back on his feet off a ragdoll: the morph targets again.
        if (d.lay >= 0) {
          drop(s.id);
          figure(s, kind, lod);
        }
        const v = drawn.get(s.id)!.view;
        v.mesh.visible = true;
        const moving =
          s.mode === "chase" || s.mode === "board" || s.mode === "walk" || s.mode === "cover";
        const x = s.x + (moving ? s.vx * ahead : 0);
        const z = s.z + (moving ? s.vz * ahead : 0);
        const ground = moving ? state.level.groundAt(x, z) : s.y;
        switch (s.mode) {
          case "rope":
            // Down the rope, the rope through his hands in front of him.
            stand(v.mesh, state, x, s.y, z, s.heading, false);
            v.mesh.position.x -= Math.sin(s.heading) * ROPE_AHEAD;
            v.mesh.position.z -= Math.cos(s.heading) * ROPE_AHEAD;
            v.pose("rope");
            break;
          case "ride": {
            stand(v.mesh, state, x, s.y - SEAT_DROP, z, s.heading, false);
            const plan = liftPlans(state.level)[s.lift];
            if (plan && plan.lift.kind === "chair") {
              // Hung from the grip `ride.under` m over the seat and swung
              // about it as the chair swings, as the crowd's riders are.
              const c = carrierAt(plan, s.carrier, state.t);
              const e = fromEuler(s.heading, carrierSwingAt(plan, c.u, c.side), 0);
              v.mesh.quaternion.set(e.x, e.y, e.z, e.w);
              const grip = CROWD.ride.under;
              // Sat forward on the seat by his pack's depth, the pack
              // against the backrest rather than through it.
              drop3.set(0, -(grip + SEAT_DROP), PACK.depth).applyQuaternion(v.mesh.quaternion);
              v.mesh.position.set(s.x, s.y + grip, s.z).add(drop3);
            }
            if (kind === "skier") v.pose("seat");
            else v.pose("carry");
            break;
          }
          case "aim":
            stand(v.mesh, state, x, ground, z, s.aimH, true);
            if (kind === "rocketeer") v.pose(s.kneel ? "kneelLaunch" : "launch");
            else v.pose(s.kneel ? "skiKneel" : "skiAim");
            break;
          case "arrest":
            stand(v.mesh, state, x, ground, z, s.heading, true);
            if (kind === "rocketeer") v.pose("kneelLaunch");
            else v.pose("pin");
            break;
          default: {
            stand(v.mesh, state, x, ground, z, s.heading, true);
            if (s.mode === "out" && s.kneel) {
              // Knelt at the dismount, the rifle out over the snow.
              if (kind === "rocketeer") v.pose("kneelLaunch");
              else v.pose("skiKneel");
              break;
            }
            if (kind === "rocketeer") {
              // Walking: a stride off each foot, by the ground he covers.
              if (s.speed < 0.2) v.pose("carry");
              else {
                const u = (state.t * s.speed) / PACE;
                const k = 0.5 + 0.5 * Math.sin(u * Math.PI);
                v.pose("walkA", k, "walkB");
              }
              break;
            }
            if (s.climb && s.speed < 4) {
              // Working up a rise: poling stride on stride.
              const k = 0.5 + 0.5 * Math.sin(state.t * STRIDE_HZ * 2 * Math.PI + s.id);
              v.pose("pole", k, "ski");
            } else if (s.tuck > 0.2) v.pose("tuck", Math.min(1, s.tuck));
            else if (Math.abs(s.lean) > 0.08)
              v.pose(s.lean > 0 ? "lean" : "leanLeft", Math.min(1, Math.abs(s.lean)));
            else v.pose("ski");
          }
        }
      }
      for (const [id, d] of drawn) if (d.seen !== frameNo) drop(id);
      // THE FAST ROPES, from each machine holding over a spot.
      let n = 0;
      for (const h of armyHelis(state)) {
        if (h.phase !== "rope" || !h.task || n >= ROPES) continue;
        const g = state.level.groundAt(h.task.x, h.task.z);
        for (const side of [1, -1]) {
          if (n >= ROPES) break;
          // From each door's hook (where the engine starts a man down it)
          // to the snow.
          const R = ARMY_HELI.rope;
          const hook = armyPoint(h, { x: side * R.x, y: R.y, z: R.z });
          ropePos.set([hook.x, hook.y, hook.z, hook.x, g, hook.z], n * 6);
          n++;
        }
      }
      ropeGeo.setDrawRange(0, n * 2);
      ropeGeo.attributes.position.needsUpdate = true;
      ropes.visible = n > 0;
    },
    seen(at) {
      eye.x = at.x;
      eye.y = at.y;
      eye.z = at.z;
    },
    dispose() {
      for (const id of [...drawn.keys()]) drop(id);
      ropeGeo.dispose();
      (ropes.material as THREE.Material).dispose();
    },
  };
}
