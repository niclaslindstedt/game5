// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI IN THE PICTURE — the renderer's one door to it: the room the
// picture cuts to while he is in a lodge (`afterski-interior.ts`, built the
// first time he goes in and kept), and THE BUZZ ON THE LENS — the view
// swaying and rolling with his head, and the picture swimming
// (`region-picture.ts`'s `setBuzz`), in full through his own eyes (the
// TIPS and HELMET rungs), a touch of it from behind, and none at all on a
// planted lens (a replay's broadcast, a lab).

import * as THREE from "three";

import type { GameState } from "@engine";

import { createInterior, type Interior } from "./afterski-interior.ts";
import type { Outfit } from "./outfit.ts";
import type { RegionPicture } from "./region-picture.ts";

/** How much of the buzz the picture and the lens take off his eyes and
 * from behind him, and inside the lodge. */
const SHARE = { eyes: 1, behind: 0.22, inside: 0.45 };
/** The lens's sway at full buzz on his own eyes: its roll, rad, and its
 * yaw and pitch, rad, each over its own slow period, s. */
const SWAY = { roll: 0.16, rollAt: 4.1, yaw: 0.07, yawAt: 2.9, pitch: 0.05, pitchAt: 3.7 };

export type AfterskiView = {
  /** The room's scene and lens while he is in a lodge, posed for this
   * frame; null outside. */
  inside(state: GameState, outfit: Outfit, key: string, aspect: number): Interior | null;
  /** Sway `camera` with the buzz and set the picture's: `rung` the lens's
   * rung, `planted` whether a planted lens has it. */
  sway(camera: THREE.Camera, state: GameState, rung: string, planted: boolean): void;
  dispose(): void;
};

export function createAfterskiView(picture: RegionPicture): AfterskiView {
  let room: Interior | null = null;
  let indoors = false;
  return {
    inside(state, outfit, key, aspect) {
      indoors = !!state.afterski?.inside;
      if (!indoors) return null;
      room ??= createInterior();
      room.dress(outfit, key);
      room.update(state, aspect);
      return room;
    },
    sway(camera, state, rung, planted) {
      const buzz = state.skier.buzz ?? 0;
      const eyes = rung === "tips" || rung === "helmet";
      const share = planted ? 0 : indoors ? SHARE.inside : eyes ? SHARE.eyes : SHARE.behind;
      picture.setBuzz(buzz * share, state.t);
      if (buzz <= 0 || planted || indoors) return;
      const b = buzz * (eyes ? 1 : SHARE.behind);
      const t = state.t;
      const w = (at: number): number =>
        Math.sin((t * Math.PI * 2) / at) * 0.7 + Math.sin((t * Math.PI * 2) / (at * 2.3)) * 0.3;
      camera.rotateY(SWAY.yaw * b * w(SWAY.yawAt));
      camera.rotateX(SWAY.pitch * b * w(SWAY.pitchAt));
      camera.rotateZ(SWAY.roll * b * w(SWAY.rollAt));
      camera.updateMatrixWorld();
    },
    dispose() {
      room?.dispose();
      room = null;
    },
  };
}
