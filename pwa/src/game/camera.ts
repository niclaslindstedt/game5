// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS — the ladder of rigs (`camera-rigs.ts`) put on a three.js
// camera, with the flown hand-over between two rungs: for `HANDOVER`
// seconds after a change both rigs are framed and the lens is blended from
// the one to the other, so a switch is a move rather than a cut. The same
// hand-over carries the lens from one LADDER to another — the skier's rows
// to the snowmobile's (`camera-sled.ts`) as he steps on, and back as he
// steps off — each ladder's booms keeping their own memory.

import * as THREE from "three";

import type { PickRay } from "./machine-pick.ts";

import {
  blendLens,
  createBoomState,
  type BoomState,
  frameRig,
  HANDOVER,
  RIGS,
  type LensPose,
  type LineClear,
  type TrunksNear,
  type Rig,
  type RigPose,
  type Rung,
  type Vec3,
} from "./camera-rigs.ts";

/** A ladder: one rig per rung. */
export type Ladder = Record<Rung, Rig>;

export type Lens = {
  camera: THREE.PerspectiveCamera;
  rung(): Rung;
  /** The rung the player chose for where he is now: on his skis or aboard
   * a machine (`aboard`). */
  chosen(): Rung;
  /** Change rung — both the skier's and the machines', or `craft` the
   * machines' apart from his; `cut` skips the hand-over. */
  set(rung: Rung, cut?: boolean, craft?: Rung): void;
  /** ON OR OFF A MACHINE: `on` whether he rides one this frame. The lens
   * flies to the rung kept for it — a cockpit picked in the air is never
   * his own eyes once he jumps out, nor his chase the plane's. */
  aboard(on: boolean): void;
  /** Whether he rode a machine as last told (`aboard`). */
  riding(): boolean;
  /** Snap the booms onto the skier on the next frame (a new run, a reset). */
  snap(): void;
  /** Whether a change of rung is being flown rather than cut — what a
   * machine's own lens (`camera-heli.ts`) follows. */
  flying(): boolean;
  /** `clear` keeps the booms out of the course's posts (and whatever else
   * it calls solid); `trunks` is what they are pushed off (`camera-rigs.ts`);
   * `ladder` the rows the rungs are framed on (the skier's, or a machine's). */
  frame(
    pose: RigPose,
    dt: number,
    groundAt: (x: number, z: number) => number,
    clear?: LineClear,
    trunks?: TrunksNear,
    ladder?: Ladder,
  ): LensPose;
};

/** `keepOut` puts a FLOWN lens's eye back out of what it may not pass
 * through on its way between two rungs (the balloon's basket and envelope,
 * `camera-balloon.ts`'s `keepOutOfBalloon`). */
export function createLens(near: number, far: number, keepOut?: (eye: Vec3) => void): Lens {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, near, far);
  let current: Rung = "chase";
  let table: Ladder = RIGS;
  // What the lens is handed over FROM: a rung of a ladder, framed for
  // `HANDOVER` s after a change of either.
  let previous: { ladder: Ladder; rung: Rung } | null = null;
  let since = HANDOVER;
  // Whether a frame has been framed since the lens was made or snapped: a
  // run that STARTS on a machine cuts to its ladder rather than flying in.
  let framed = false;
  // THE TWO RUNGS (`aboard`): the skier's own and the machines', and which
  // of them the lens is on.
  const rungs: { rider: Rung; craft: Rung } = { rider: current, craft: current };
  let riding = false;
  const ladders = new Map<Ladder, Map<Rung, BoomState>>();
  const stateOf = (l: Ladder, r: Rung) => {
    let states = ladders.get(l);
    if (!states) {
      states = new Map();
      ladders.set(l, states);
    }
    let s = states.get(r);
    if (!s) {
      s = createBoomState();
      states.set(r, s);
    }
    return s;
  };

  const go = (rung: Rung, cut: boolean): void => {
    if (rung === current) return;
    previous = cut ? null : { ladder: table, rung: current };
    since = cut ? HANDOVER : 0;
    current = rung;
    if (cut) stateOf(table, rung).fresh = true;
  };

  return {
    camera,
    rung: () => current,
    chosen: () => current,
    set(rung, cut = false, craft = rung) {
      rungs.rider = rung;
      rungs.craft = craft;
      go(riding ? craft : rung, cut);
    },
    aboard(on) {
      if (on === riding) return;
      riding = on;
      go(on ? rungs.craft : rungs.rider, !framed);
    },
    riding: () => riding,
    flying: () => previous !== null,
    snap() {
      for (const states of ladders.values()) for (const s of states.values()) s.fresh = true;
      since = HANDOVER;
      previous = null;
      framed = false;
    },
    frame(pose, dt, groundAt, clear, trunks, ladder = RIGS) {
      if (ladder !== table) {
        // On or off a machine: its booms start from where he is now, and
        // the lens is flown across from the ladder it was on — or cut, on
        // a run's first frame.
        // (A change of rung this same frame — `aboard` — flies from its own.)
        const from = since === 0 && previous ? previous : { ladder: table, rung: current };
        previous = framed ? from : null;
        since = framed ? 0 : HANDOVER;
        table = ladder;
        for (const s of ladders.get(ladder)?.values() ?? []) s.fresh = true;
      }
      // A rung that has not been framed for a while starts from the skier.
      let lens = frameRig(
        table[current],
        pose,
        stateOf(table, current),
        dt,
        groundAt,
        clear,
        trunks,
      );
      since += dt;
      if (previous && since < HANDOVER) {
        const { ladder: l, rung: r } = previous;
        const from = frameRig(l[r], pose, stateOf(l, r), dt, groundAt, clear, trunks);
        lens = blendLens(from, lens, since / HANDOVER);
        keepOut?.(lens.eye);
      } else {
        previous = null;
      }
      // Every other boom keeps swinging behind the scenes, so a switch to it
      // starts from where it would be rather than from a stale frame.
      for (const r of ["chase", "far", "high"] as const) {
        if (r !== current && (previous?.ladder !== table || r !== previous.rung))
          frameRig(table[r], pose, stateOf(table, r), dt, groundAt, clear, trunks);
      }
      aimLens(camera, lens);
      framed = true;
      return lens;
    },
  };
}

/** Put `camera` where `lens` stands, looking where it looks. */
export function aimLens(camera: THREE.PerspectiveCamera, lens: LensPose): void {
  camera.position.set(lens.eye.x, lens.eye.y, lens.eye.z);
  camera.up.set(0, 1, 0);
  camera.lookAt(lens.target.x, lens.target.y, lens.target.z);
  if (lens.roll !== 0) camera.rotateZ(-lens.roll);
  if (Math.abs(camera.fov - lens.fov) > 1e-3) {
    camera.fov = lens.fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
}

const pickCaster = new THREE.Raycaster();
const pickAt = new THREE.Vector2();

/** The ray through a point of the picture, in normalized device
 * coordinates (−1..1 right and up) — what a tap on the snow is aimed
 * along (`machine-pick.ts`). */
export function lensRay(camera: THREE.Camera, x: number, y: number): PickRay {
  pickCaster.setFromCamera(pickAt.set(x, y), camera);
  const { origin: o, direction: d } = pickCaster.ray;
  return { o: { x: o.x, y: o.y, z: o.z }, d: { x: d.x, y: d.y, z: d.z } };
}
