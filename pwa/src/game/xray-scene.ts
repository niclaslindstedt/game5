// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON A HURT BODY, as the renderer asks for it: the X-RAY CAM
// (`xray-shots.ts` directs, `camera-xray.ts` frames, `xray-view.ts` draws
// the skeleton inside him) while the app has it running, and the DEATH CAM
// (`camera-death.ts`) while he is off his skis otherwise. One place picks
// between them, so the renderer asks one question for both — and the death
// cam (or the ladder) is what the X-ray lens flies in off and back home to,
// so neither hand-over is a cut.

import * as THREE from "three";

import type { GameState, Level, Thrown } from "@engine";

import { createLineClear, heliBox, type SolidBox } from "./camera-clear.ts";
import { createDeathCam, dropDeathCam, frameDeath } from "./camera-death.ts";
import type { LensPose, LineClear } from "./camera-rigs.ts";
import { createXrayLens, frameXray } from "./camera-xray.ts";
import { createXrayView, type XraySkin } from "./xray-view.ts";
import { IDLE_XRAY, type XrayLook } from "./xray-shots.ts";

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
  /** How far the skin is glass this frame, 0 … 1: what is drawn outside
   * him (the gore's blood and shards) stands down while the world is veiled. */
  veil(): number;
  dispose(): void;
};

export function createHurtLens(): HurtLens {
  const view = createXrayView();
  const xlens = createXrayLens();
  const death = createDeathCam();
  let deathOn = false;
  let look: XrayLook | null = null;
  const target = new THREE.Vector3();
  /** The lens the game's own camera drew last frame (the death cam's or
   * the ladder's), what the death cam flies on from. */
  let prev: LensPose | null = null;
  /** THE HELICOPTER'S CABIN the lens keeps out of (`heliBox`): a skier shed
   * off its skid falls past it, a bone's width from the glass. Built once a
   * map, on a run with a helicopter only. */
  let run: GameState | null = null;
  let builtFor: Level | null = null;
  let machine: LineClear | undefined;
  const cabin: SolidBox = {
    x: 0,
    z: 0,
    dx: 0,
    dz: 1,
    halfLength: 0,
    halfWidth: 0,
    base: 0,
    top: 0,
  };
  const cabins = (): readonly SolidBox[] => (run?.heli ? [heliBox(run.heli, cabin)] : []);

  return {
    group: view.group,
    setDeathCam(on) {
      deathOn = on;
    },
    setXray(next) {
      look = next;
    },
    update(state, skin) {
      run = state;
      if (builtFor !== state.level) {
        builtFor = state.level;
        machine = state.heli
          ? createLineClear(state.level, { trees: false, movers: cabins })
          : undefined;
      }
      const meshes: THREE.Mesh[] = [];
      skin.group.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.Mesh);
      });
      view.update(look ?? IDLE_XRAY, state, skin, meshes);
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
            : // A tear is seen on him, at the stump — the piece is flung
              // off out of the frame; the way back looks where he lies.
              body
              ? target.set(body.x, body.y, body.z)
              : shot.kind === "tear"
                ? target.set(shot.at.x, shot.at.y, shot.at.z)
                : view.bodyCentre(target);
        // A bone not drawn (torn away) is looked for in the body.
        at ??= view.bodyCentre(target);
        if (!at && body) at = target.set(body.x, body.y, body.z);
      }
      // THE GAME'S OWN CAMERA this frame — the death cam's while it has him,
      // else the ladder's: run underneath the X-ray cam, so the lens flies
      // in off it and is drawn back home to it.
      let home: LensPose | null = null;
      if (deathOn && allowed) {
        home = frameDeath(death, body, prev ?? ladder, dt, groundAt, clear);
        if (death.ended && !shot) snap();
      } else if (death.active) dropDeathCam(death);
      prev = home;
      // Nothing hides him under the X-ray (`xray-view.ts`), so its lens is
      // pulled in by nothing that stands between but the helicopter he
      // falls past (`machine`): a lens is never stood in its cabin.
      const x = frameXray(xlens, shot, at, home ?? ladder, look?.back ?? 0, dt, groundAt, machine);
      return x ?? home;
    },
    active: () => !!look?.active,
    veil: () => (look?.active ? look.xray : 0),
    dispose() {
      view.dispose();
    },
  };
}
