// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON A HURT BODY, as the renderer asks for it: the X-RAY CAM
// (`xray-shots.ts` directs, `camera-xray.ts` frames, `xray-view.ts` draws
// the skeleton inside him) while the app has it running, and the DEATH CAM
// (`camera-death.ts`) while he is off his skis otherwise. One place picks
// between them, so the renderer asks one question for both.

import * as THREE from "three";

import type { GameState, Thrown } from "@engine";

import { createDeathCam, dropDeathCam, frameDeath } from "./camera-death.ts";
import type { LensPose, LineClear } from "./camera-rigs.ts";
import { createXrayLens, frameXray } from "./camera-xray.ts";
import { createXrayView, type XraySkin } from "./xray-view.ts";
import type { XrayLook } from "./xray-shots.ts";

export type HurtLens = {
  /** The skeleton's group, added to the scene once. */
  group: THREE.Group;
  /** Whether the app lets the death cam take the lens. */
  setDeathCam(on: boolean): void;
  /** The X-ray cam's look this frame (null: off). */
  setXray(look: XrayLook | null): void;
  /** Pose the skeleton inside his skin. */
  update(state: GameState, skin: XraySkin): void;
  /** The lens to draw, or null for the ladder's own. `snap` is called on
   * the frame a cam lets go, so the ladder cuts back in. */
  lens(
    allowed: boolean,
    body: Thrown | null,
    ladder: LensPose,
    dt: number,
    groundAt: (x: number, z: number) => number,
    clear: LineClear | undefined,
    snap: () => void,
  ): LensPose | null;
  /** Whether the X-ray cam has the run (the figure is drawn whatever rung). */
  active(): boolean;
  dispose(): void;
};

export function createHurtLens(): HurtLens {
  const view = createXrayView();
  const xlens = createXrayLens();
  const death = createDeathCam();
  let deathOn = false;
  let look: XrayLook | null = null;
  const target = new THREE.Vector3();
  /** The lens either cam drew last frame: what the other flies off. */
  let prev: LensPose | null = null;

  return {
    group: view.group,
    setDeathCam(on) {
      deathOn = on;
    },
    setXray(next) {
      look = next;
    },
    update(state, skin) {
      const meshes: THREE.Mesh[] = [];
      skin.group.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.Mesh);
      });
      view.update(look ?? IDLE_LOOK, state, skin, meshes);
    },
    lens(allowed, body, ladder, dt, groundAt, clear, snap) {
      const shot = allowed && look?.active ? look.shot : null;
      let at: THREE.Vector3 | null = null;
      if (shot) {
        // The whole of him is looked at where his body lies, the skeleton
        // faded out by then.
        at =
          shot.kind === "bone"
            ? view.centreOf(shot.bone, target)
            : shot.kind === "tear"
              ? // Between where it tore and where he has slid since: the
                // stump and the piece in one frame.
                body
                ? target.set(
                    (shot.at.x + body.x) / 2,
                    (shot.at.y + body.y) / 2,
                    (shot.at.z + body.z) / 2,
                  )
                : target.set(shot.at.x, shot.at.y, shot.at.z)
              : body
                ? target.set(body.x, body.y, body.z)
                : view.bodyCentre(target);
        // A bone not drawn (torn away) is looked for in the body.
        at ??= view.bodyCentre(target);
        if (!at && body) at = target.set(body.x, body.y, body.z);
      }
      const x = frameXray(xlens, shot, at, prev ?? ladder, dt, groundAt, clear);
      if (x) {
        if (death.active) dropDeathCam(death);
        return (prev = x);
      }
      if (deathOn && allowed) {
        const dead = frameDeath(death, body, prev ?? ladder, dt, groundAt, clear);
        if (death.ended) snap();
        return (prev = dead);
      }
      if (death.active) dropDeathCam(death);
      return (prev = null);
    },
    active: () => !!look?.active,
    dispose() {
      view.dispose();
    },
  };
}

const IDLE_LOOK: XrayLook = { active: false, rate: 1, xray: 0, shot: null, age: 0, index: 0 };
