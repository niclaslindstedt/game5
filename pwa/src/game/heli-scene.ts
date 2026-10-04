// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER IN THE RENDERER — the one hand the renderer holds it by:
// the machine and its pad (`heli-view.ts`), its wash blown into the snow
// cloud, the explosion when it goes down and the fire on the wreck
// (`explosion.ts`), the lens it takes while the skier sits on its skid
// (`camera-heli.ts`), and the skier sat on the skid as the figure is posed.
// Built per map with the rest of the world, on a free ride only.

import * as THREE from "three";
import type { GameState, Level } from "@engine";

import { createHeliCam, frameHeli } from "./camera-heli.ts";
import type { LensPose } from "./camera-rigs.ts";
import { createExplosion, type Explosion } from "./explosion.ts";
import type { HazeUniforms } from "./haze.ts";
import { createHeliView, type HeliView, type WashPuff } from "./heli-view.ts";
import type { CameraRung } from "./renderer-api.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import type { SnowProps } from "./snowpack.ts";

export type HeliScene = {
  group: THREE.Group;
  /** One frame: the machine drawn, the wash blown, the fire burning, and
   * the lens it asks for on `rung` (null once nobody rides it, or on the
   * orbit). */
  frame(
    state: GameState,
    alpha: number,
    dt: number,
    player: { x: number; z: number },
    rung: CameraRung,
    cloud: SnowCloud | null,
    snowAt: (x: number, z: number) => SnowProps,
  ): LensPose | null;
  /** The figure sat on the skid: the skid's top in his body frame, m, or
   * null off it (`SkisModel.setPerch`). */
  perch(state: GameState): number | null;
  dispose(): void;
};

/** Where the crash's lens stands off the wreck, m: back along the way it
 * was flying, out to the side, and up. */
const CRASH_LENS = { back: 42, side: 16, up: 14 };
/** How long the drop's lens is held after the push, s. */
const DROP_HOLD = 1.6;

export function createHeliScene(level: Level, haze: HazeUniforms): HeliScene {
  const group = new THREE.Group();
  group.name = "helicopter";
  const view: HeliView = createHeliView(level, haze);
  const boom: Explosion = createExplosion();
  group.add(view.group, boom.group);
  const cam = createHeliCam();
  let wasWreck = false;
  /** THE CRASH'S LENS: planted back off the wreck the moment it goes up,
   * looking at the fire, for as long as it burns — the blast seen whole
   * rather than from inside it. */
  let crashEye: { x: number; y: number; z: number } | null = null;
  /** THE DROP'S LENS: the helicopter's last, held where it was for a beat
   * after he pushes off and turned down after him as he falls — the
   * ladder's boom, which framed him sat on the skid, would be inside the
   * airframe — and the seconds since the push. */
  let lastLens: LensPose | null = null;
  let since = Infinity;
  return {
    group,
    frame(state, alpha, dt, player, rung, cloud, snowAt) {
      const h = state.heli;
      if (!h) return null;
      view.update(state, alpha, dt, player);
      const puff: WashPuff = (x, y, z, vx, vy, vz, size) => cloud?.blow(x, y, z, vx, vy, vz, size);
      view.blow(state, dt, puff, (x, z) => snowAt(x, z).loose);
      const wreck = h.mode === "wreck";
      if (wreck && !wasWreck && h.wreck) {
        // IT GOES UP: the fireball, and the snow round it thrown up by the
        // shock.
        boom.burst(h.wreck.x, h.wreck.y, h.wreck.z, h.wreck.speed);
        const { x, y, z } = h.wreck;
        const back = { x: -Math.sin(h.heading), z: -Math.cos(h.heading) };
        const ex = x + back.x * CRASH_LENS.back - back.z * CRASH_LENS.side;
        const ez = z + back.z * CRASH_LENS.back + back.x * CRASH_LENS.side;
        crashEye = {
          x: ex,
          y: Math.max(y + CRASH_LENS.up, state.level.groundAt(ex, ez) + 3),
          z: ez,
        };
        for (let i = 0; i < 3; i++) cloud?.burst(x, y + 0.5, z, 0, 0, 2.5, snowAt(x, z));
      }
      if (!wreck && wasWreck) {
        boom.clear();
        crashEye = null;
      }
      wasWreck = wreck;
      boom.burning(wreck, h.x, h.y, h.z);
      boom.update(dt, (x, z) => state.level.groundAt(x, z));
      if (wreck && crashEye && h.wreck?.aboard && rung !== "orbit") {
        return {
          eye: { ...crashEye },
          target: { x: h.wreck.x, y: h.wreck.y + 4, z: h.wreck.z },
          fov: 55,
          roll: 0,
        };
      }
      const at = view.drawn();
      if (!h.rider || !at || rung === "orbit") {
        cam.fresh = true;
        if (lastLens && h.mode === "home" && since < DROP_HOLD && rung !== "orbit") {
          since += dt;
          const c = state.skier;
          return { ...lastLens, target: { x: c.x, y: c.y, z: c.z }, roll: 0 };
        }
        lastLens = null;
        return null;
      }
      since = 0;
      lastLens = frameHeli(cam, h, at, rung, Math.min(dt, 0.1), (x, z) =>
        state.level.groundAt(x, z),
      );
      return lastLens;
    },
    perch(state) {
      const h = state.heli;
      return h?.rider ? -h.hang : null;
    },
    dispose() {
      view.dispose();
      boom.dispose();
    },
  };
}
