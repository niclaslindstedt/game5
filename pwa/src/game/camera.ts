// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS — the ladder of rigs (`camera-rigs.ts`) put on a three.js
// camera, with the flown hand-over between two rungs: for `HANDOVER`
// seconds after a change both rigs are framed and the lens is blended from
// the one to the other, so a switch is a move rather than a cut.

import * as THREE from "three";

import {
  blendLens,
  createBoomState,
  frameRig,
  HANDOVER,
  RIGS,
  type LensPose,
  type LineClear,
  type TrunksNear,
  type RigPose,
  type Rung,
} from "./camera-rigs.ts";

export type Lens = {
  camera: THREE.PerspectiveCamera;
  rung(): Rung;
  /** Change rung; `cut` skips the hand-over. */
  set(rung: Rung, cut?: boolean): void;
  /** Snap the booms onto the skier on the next frame (a new run, a reset). */
  snap(): void;
  /** `clear` keeps the booms out of the course's posts (and whatever else
   * it calls solid); `trunks` is what they are pushed off (`camera-rigs.ts`). */
  frame(
    pose: RigPose,
    dt: number,
    groundAt: (x: number, z: number) => number,
    clear?: LineClear,
    trunks?: TrunksNear,
  ): LensPose;
};

export function createLens(near: number, far: number): Lens {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, near, far);
  let current: Rung = "chase";
  let previous: Rung | null = null;
  let since = HANDOVER;
  const states = new Map<Rung, ReturnType<typeof createBoomState>>();
  const stateOf = (r: Rung) => {
    let s = states.get(r);
    if (!s) {
      s = createBoomState();
      states.set(r, s);
    }
    return s;
  };
  const target = new THREE.Vector3();

  return {
    camera,
    rung: () => current,
    set(rung, cut = false) {
      if (rung === current) return;
      previous = cut ? null : current;
      since = cut ? HANDOVER : 0;
      current = rung;
      if (cut) stateOf(rung).fresh = true;
    },
    snap() {
      for (const s of states.values()) s.fresh = true;
      since = HANDOVER;
      previous = null;
    },
    frame(pose, dt, groundAt, clear, trunks) {
      const st = stateOf(current);
      // A rung that has not been framed for a while starts from the skier.
      let lens = frameRig(RIGS[current], pose, st, dt, groundAt, clear, trunks);
      since += dt;
      if (previous && since < HANDOVER) {
        const from = frameRig(RIGS[previous], pose, stateOf(previous), dt, groundAt, clear, trunks);
        lens = blendLens(from, lens, since / HANDOVER);
      } else {
        previous = null;
      }
      // Every other boom keeps swinging behind the scenes, so a switch to it
      // starts from where it would be rather than from a stale frame.
      for (const r of ["chase", "far", "high"] as const) {
        if (r !== current && r !== previous)
          frameRig(RIGS[r], pose, stateOf(r), dt, groundAt, clear, trunks);
      }
      camera.position.set(lens.eye.x, lens.eye.y, lens.eye.z);
      camera.up.set(0, 1, 0);
      camera.lookAt(target.set(lens.target.x, lens.target.y, lens.target.z));
      if (lens.roll !== 0) camera.rotateZ(-lens.roll);
      if (Math.abs(camera.fov - lens.fov) > 1e-3) {
        camera.fov = lens.fov;
        camera.updateProjectionMatrix();
      }
      camera.updateMatrixWorld();
      return lens;
    },
  };
}
