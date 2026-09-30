// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MODELLED PAIR OF SKIS POSED AS THE GAME POSES ITS OWN. A pair made by
// `make blender` is one skinned mesh on a rig (`scripts/blender/lib.py`):
// DRIVERS the game sets off the engine's readings, and LINKAGES that
// follow. This is the game's side of that contract, written once for the
// game (`skier-models.ts`) and the skis lab alike:
//
//   ski_l, ski_r   lifted by their leg's compression (`gearLift`) and the
//                  tuck's drop, turned about the up axis by `skiAngle`, and
//                  tipped about their own length onto the edge (`skiTilt`)
//                  — matched to the engine's skis by which side of the
//                  body they stand on
//   a linkage      any bone whose extras name an `aim`: turned so it points
//                  at that bone's head, and stretched to reach it where
//                  `stretch` is set
//
// And the CLIPS the model carries, played at a moment. Three only: the
// asset's frame is the loader's business (`skier-models.ts` and the lab's
// `skis-harness.ts` turn it).

import * as THREE from "three";
import type { SkierState } from "@engine";

import { gearLift, SINK_SHARE, skiTilt } from "./ski-gear.ts";
import { gaitOf } from "./skier-pose.ts";

type Rest = { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 };
type Aim = {
  node: THREE.Object3D;
  target: THREE.Object3D;
  stretch: boolean;
  dir: THREE.Vector3;
  length: number;
};

export type AssetRig = {
  /** The clips the model carries, by name, with their lengths, s. */
  clips: { name: string; seconds: number }[];
  /** Back to the rest pose, every clip stopped. */
  rest(): void;
  /** Posed off the engine's state; `run` is kept for the lab's call shape
   * (nothing on a pair of skis runs), and `sink` is how much deeper the
   * drawn furrow is than the physics' sink. */
  pose(skier: SkierState, run?: number, sink?: number): void;
  /** Clip `name` at `t` s. */
  play(name: string, t: number): void;
};

const Y = new THREE.Vector3(0, 1, 0);

/** `root` is the loaded scene; its PARENT stands in the pair's body frame
 * (the loader's turn between them), and "up" and "side" are that frame's —
 * a skier in the game pitches and rolls. */
export function rigAsset(root: THREE.Object3D, animations: THREE.AnimationClip[]): AssetRig {
  const body = root.parent ?? root;
  body.updateMatrixWorld(true);
  const rest = new Map<THREE.Object3D, Rest>();
  const named = new Map<string, THREE.Object3D>();
  const morphs: THREE.Mesh[] = [];
  root.traverse((o) => {
    rest.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
    named.set(o.name, o);
    if ((o as THREE.Mesh).morphTargetInfluences) morphs.push(o as THREE.Mesh);
  });
  const extras = (o: THREE.Object3D) => o.userData as { aim?: string; stretch?: number };

  const aims: Aim[] = [];
  const tmp = new THREE.Vector3();
  for (const node of named.values()) {
    const aim = extras(node).aim;
    const target = aim ? named.get(aim) : undefined;
    if (!target || !node.parent) continue;
    const d = node.parent
      .worldToLocal(target.getWorldPosition(tmp.set(0, 0, 0)))
      .sub(node.position);
    aims.push({
      node,
      target,
      stretch: extras(node).stretch === 1,
      dir: d.clone().normalize(),
      length: d.length(),
    });
  }
  // The engine's ski 0 stands at x negative in the body frame: the model's
  // skis matched to the engine's by side, never by name (a model's own
  // left is its frame's, which the loader's turn may have put either way).
  const sideOf = (o: THREE.Object3D) =>
    body.worldToLocal(o.getWorldPosition(new THREE.Vector3())).x;
  const skis = ["ski_l", "ski_r"]
    .map((n) => named.get(n))
    .filter((o): o is THREE.Object3D => !!o)
    .sort((a, b) => sideOf(a) - sideOf(b));
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const side = new THREE.Vector3();

  const mixer = new THREE.AnimationMixer(root);

  function reset(): void {
    mixer.stopAllAction();
    for (const [o, r] of rest) {
      o.position.copy(r.p);
      o.quaternion.copy(r.q);
      o.scale.copy(r.s);
    }
    for (const m of morphs) m.morphTargetInfluences!.fill(0);
    root.updateMatrixWorld(true);
  }

  const w = new THREE.Vector3();
  const pq = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  /** Move `o` by `lift` up the body, turn it by `angle` about the body's
   * up, then tip it by `tilt` about the body's forward (right edges down
   * positive). */
  function drive(o: THREE.Object3D, lift: number, angle = 0, tilt = 0): void {
    const parent = o.parent!;
    o.getWorldPosition(w);
    const at = parent.worldToLocal(w.clone().addScaledVector(up, lift));
    o.position.copy(at);
    if (angle || tilt) {
      parent.getWorldQuaternion(pq);
      q.setFromAxisAngle(up, angle).multiply(new THREE.Quaternion().setFromAxisAngle(fwd, -tilt));
      o.quaternion.premultiply(pq.clone().invert().multiply(q).multiply(pq));
    }
  }

  return {
    clips: animations.map((c) => ({ name: c.name, seconds: c.duration })),
    rest: reset,
    pose(skier, _run = 0, sink = 0) {
      reset();
      body.getWorldQuaternion(pq);
      up.copy(Y).applyQuaternion(pq);
      fwd.set(0, 0, 1).applyQuaternion(pq);
      side.set(1, 0, 0).applyQuaternion(pq);
      const lift = gearLift(skier);
      const drop = skier.spec.crouchDrop * skier.crouch;
      const tilt = skiTilt(skier);
      // The gait's V, the push out and the lifted recovery, as the code's
      // skis are drawn (`ski-gear.ts`).
      const gait = gaitOf(skier);
      skis.forEach((o, i) => {
        drive(o, lift[i] + gait.lift[i] + drop + sink * SINK_SHARE, skier.skiAngle + gait.splay[i], tilt);
        if (gait.out[i] !== 0) {
          o.getWorldPosition(w);
          o.position.copy(o.parent!.worldToLocal(w.addScaledVector(side, gait.out[i])));
        }
      });
      root.updateMatrixWorld(true);
      for (const a of aims) {
        const d = a.node.parent!.worldToLocal(a.target.getWorldPosition(w)).sub(a.node.position);
        const r = rest.get(a.node)!;
        a.node.quaternion.setFromUnitVectors(a.dir, d.clone().normalize()).multiply(r.q);
        if (a.stretch) a.node.scale.y = (r.s.y * d.length()) / a.length;
      }
      root.updateMatrixWorld(true);
    },
    play(name, t) {
      reset();
      const clip = animations.find((c) => c.name === name);
      if (!clip) return;
      const action = mixer.clipAction(clip).reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true; // its last frame, not its first again
      action.play();
      mixer.setTime(t);
      root.updateMatrixWorld(true);
    },
  };
}
