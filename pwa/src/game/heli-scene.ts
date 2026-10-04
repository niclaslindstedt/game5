// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER IN THE RENDERER — the one hand the renderer holds it by:
// the machine and its pad (`heli-view.ts`), its wash blown into the snow
// cloud, the explosion when it goes down and the fire on the wreck
// (`explosion.ts`), the lens it takes while the skier sits on its skid
// (`camera-heli.ts`), and the skier sat on the skid as the figure is posed.
// Built per map with the rest of the world, on a free ride only.

import * as THREE from "three";
import {
  HANG_AIR,
  HANG_GROUND,
  TUNING,
  airAt,
  treesNear,
  unrotate,
  washAt,
  type GameState,
  type Level,
  type Wash,
} from "@engine";

import { createHeliCam, frameHeli } from "./camera-heli.ts";
import type { LensPose } from "./camera-rigs.ts";
import { createExplosion, type Explosion } from "./explosion.ts";
import type { HazeUniforms } from "./haze.ts";
import { createHeliView, type HeliView, type WashPuff } from "./heli-view.ts";
import type { Perch } from "./skier-dangle.ts";
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
  /** The figure sat on the skid (`SkisModel.setPerch`): the skid's top in
   * his body frame and what his dangling legs feel there (`skier-dangle.ts`
   * — the gravity less the seat's acceleration, the air past him, the
   * rotor), or null off it. */
  perch(state: GameState): Perch | null;
  dispose(): void;
};

/** Where the crash's lens stands off the wreck, m: back along the way it
 * was flying, out to the side, and up — and how high over the woods it
 * goes where no bearing sees the wreck clear. */
const CRASH_LENS = { back: 42, side: 16, up: 14, over: 45 };
const trunks: number[] = [];

/** WHERE THE CRASH'S LENS STANDS: back off the wreck along the way it was
 * flying and out to the side (`CRASH_LENS`) — or, where a trunk stands on
 * that line of sight, turned round the wreck an eighth at a time to the
 * first bearing that sees it clear; lifted high over the woods where none
 * does. */
function crashLens(
  level: Level,
  at: { x: number; y: number; z: number },
  heading: number,
): { x: number; y: number; z: number } {
  const reach = Math.hypot(CRASH_LENS.back, CRASH_LENS.side);
  const base = heading + Math.PI + Math.atan2(CRASH_LENS.side, CRASH_LENS.back);
  for (let k = 0; k < 16; k++) {
    const a = base + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
    const ex = at.x + Math.sin(a) * reach;
    const ez = at.z + Math.cos(a) * reach;
    const ey = Math.max(at.y + CRASH_LENS.up, level.groundAt(ex, ez) + 3);
    let clear = true;
    for (let t = 0.05; t < 0.95 && clear; t += 0.05) {
      const px = ex + (at.x - ex) * t;
      const pz = ez + (at.z - ez) * t;
      const py = ey + (at.y + 2 - ey) * t;
      for (const i of treesNear(level, px, pz, 2.5, trunks)) {
        const tree = level.trees[i];
        if (tree.y + tree.height > py) clear = false;
      }
    }
    if (clear) return { x: ex, y: ey, z: ez };
  }
  const ex = at.x - Math.sin(heading) * CRASH_LENS.back;
  const ez = at.z - Math.cos(heading) * CRASH_LENS.back;
  return { x: ex, y: Math.max(at.y, level.groundAt(ex, ez)) + CRASH_LENS.over, z: ez };
}

/** How long the drop's lens is held after the push, s. */
const DROP_HOLD = 1.6;
/** How quickly the seat's acceleration is followed, s — the steps'
 * difference of its velocity smoothed of their jitter. */
const ACCEL_LAG = 0.06;
/** How far under his body origin his boots hang, m, where the air is read,
 * and the height over the snow his skis rest at below which they are laid
 * down on it rather than dangled, m. */
const FEET = 0.9;
const REST = 0.15;

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
  // THE SEAT'S ACCELERATION, world frame, m/s²: its velocity differenced
  // between the engine's steps (the tick it was read at, and the velocity).
  const accel = { x: 0, y: 0, z: 0 };
  const lastV = { x: 0, y: 0, z: 0 };
  let lastTick = -1;
  const wash: Wash = { x: 0, y: 0, z: 0 };
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
        crashEye = crashLens(state.level, h.wreck, h.heading);
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
      if (!h?.rider) {
        lastTick = -1;
        return null;
      }
      const c = state.skier;
      if (state.tick !== lastTick) {
        const span = (state.tick - lastTick) * TUNING.dt;
        if (lastTick >= 0 && span > 0) {
          const k = 1 - Math.exp(-span / ACCEL_LAG);
          accel.x += ((c.vx - lastV.x) / span - accel.x) * k;
          accel.y += ((c.vy - lastV.y) / span - accel.y) * k;
          accel.z += ((c.vz - lastV.z) / span - accel.z) * k;
        } else accel.x = accel.y = accel.z = 0;
        lastTick = state.tick;
        lastV.x = c.vx;
        lastV.y = c.vy;
        lastV.z = c.vz;
      }
      // The air at his boots: the weather's wind at their height over the
      // snow and the rotor's wash there, less his own way.
      const level = state.level;
      const feet = c.y - FEET;
      const over = feet - level.groundAt(c.x, c.z);
      const wind = airAt(level, state.t, c.x, c.z, Math.max(0.5, over));
      washAt(level, h, c.x, feet, c.z, wash);
      const air = unrotate(c.q, {
        x: wind.x + wash.x - c.vx,
        y: wash.y - c.vy,
        z: wind.z + wash.z - c.vz,
      });
      const gravity = unrotate(c.q, { x: -accel.x, y: -TUNING.g - accel.y, z: -accel.z });
      // His skis hang free as the engine lowers them off the snow, and are
      // laid back down on it near the snow.
      const hang = (HANG_GROUND - h.hang) / (HANG_GROUND - HANG_AIR);
      const near = (over - REST) / 0.5;
      return {
        y: -h.hang,
        gravity,
        air,
        spool: h.spool,
        rotor: h.rotor,
        hanging: Math.max(0, Math.min(1, hang, near)),
        t: state.t,
      };
    },
    dispose() {
      view.dispose();
      boom.dispose();
    },
  };
}
