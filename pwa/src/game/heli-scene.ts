// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER IN THE RENDERER — the one hand the renderer holds it by:
// the machine and its pad (`heli-view.ts`), its wash blown into the snow
// cloud, the airframe torn apart when it goes down (`heli-shatter.ts`),
// the fireball, the sparks and the fire on the wreck (`explosion.ts`), the
// lens it takes while the skier sits on its skid (`camera-heli.ts`) and
// the crash's (`camera-crash.ts`), and the skier sat on the skid as the
// figure is posed. Built per map with the rest of the world, on a free
// ride only.
//
// The lens is FLOWN onto the helicopter and off it, never cut: as he sits
// on the skid it is blended over from the skier's ladder, and after he
// pushes off it is held on him for a beat and blended back. Only a new run
// and the ride begun again after a crash cut to it.

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

import { frameCrash, startCrashCam, type CrashCam } from "./camera-crash.ts";
import { createHeliCam, frameHeli, heliMiddleOf, orbitBlend } from "./camera-heli.ts";
import { blendLens, type LensPose, type Vec3 } from "./camera-rigs.ts";
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
   * the lens it wants on `rung` worked out (`lens` hands it over) — a
   * change of rung flown while `flying`, else cut. */
  frame(
    state: GameState,
    alpha: number,
    dt: number,
    player: { x: number; z: number },
    rung: CameraRung,
    flying: boolean,
    cloud: SnowCloud | null,
    snowAt: (x: number, z: number) => SnowProps,
  ): void;
  /** THE LENS this frame, `ladder` the skier's own as framed under it: the
   * helicopter's, blended in from the ladder or out to it — or null once
   * the ladder has it whole (nobody rides it, or the orbit). */
  lens(ladder: LensPose, dt: number): LensPose | null;
  /** The figure sat on the skid (`SkisModel.setPerch`): the skid's top in
   * his body frame and what his dangling legs feel there (`skier-dangle.ts`
   * — the gravity less the seat's acceleration, the air past him, the
   * rotor), or null off it. */
  perch(state: GameState): Perch | null;
  dispose(): void;
};

const trunks: number[] = [];

/** WHETHER A TRUNK STANDS between `eye` and `at` — the crash's lens rises
 * over one. */
function treeBetween(level: Level, eye: Vec3, at: Vec3): boolean {
  for (let t = 0.05; t < 0.95; t += 0.05) {
    const px = eye.x + (at.x - eye.x) * t;
    const pz = eye.z + (at.z - eye.z) * t;
    const py = eye.y + (at.y + 2 - eye.y) * t;
    for (const i of treesNear(level, px, pz, 2.5, trunks)) {
      const tree = level.trees[i];
      if (tree.y + tree.height > py) return true;
    }
  }
  return false;
}

/** How long the drop's lens is held after the push, s, and how long its
 * look takes to come round onto him; how long the lens takes to fly onto
 * the helicopter as he sits on the skid, and back to the ladder after the
 * drop, s. */
const DROP_HOLD = 1.2;
const DROP_TURN = 0.45;
const HAND_IN = 1.1;
const HAND_OUT = 1.3;
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
  /** THE CRASH'S LENS: from the lens on screen the moment it goes up,
   * pulled back to see it whole, for as long as it burns. */
  let crash: CrashCam | null = null;
  /** THE DROP'S LENS: the helicopter's last, held where it was for a beat
   * after he pushes off and turned down after him as he falls — the
   * ladder's boom, which framed him sat on the skid, would be inside the
   * airframe — and the seconds since the push. */
  let lastLens: LensPose | null = null;
  let since = Infinity;
  /** THE HAND-OVER: what the helicopter wants on screen this frame (null:
   * the ladder), whether it is cut to rather than flown, the share of it
   * on screen, the last lens it asked for (flown out from once it stops)
   * and the lens on screen last frame (what a crash starts from). */
  let own: LensPose | null = null;
  let cut = false;
  let share = 0;
  let held: LensPose | null = null;
  let shown: LensPose | null = null;
  let lastState: GameState | null = null;
  /** Where the eye stood last frame, which the fire and smoke are sorted
   * back to front for. */
  const eyeWas = { x: 0, y: 0, z: 0 };
  const hooks = {
    flame: (x: number, y: number, z: number, heat: number, dt: number) =>
      boom.flame(x, y, z, heat, dt),
    strike: (x: number, y: number, z: number, speed: number) => {
      boom.strike(x, y, z, speed);
      strikeCloud?.(x, y, z, speed);
    },
  };
  let strikeCloud: ((x: number, y: number, z: number, speed: number) => void) | null = null;
  // THE SEAT'S ACCELERATION, world frame, m/s²: its velocity differenced
  // between the engine's steps (the tick it was read at, and the velocity).
  const accel = { x: 0, y: 0, z: 0 };
  const lastV = { x: 0, y: 0, z: 0 };
  let lastTick = -1;
  const wash: Wash = { x: 0, y: 0, z: 0 };
  return {
    group,
    frame(state, alpha, dt, player, rung, flying, cloud, snowAt) {
      const h = state.heli;
      cam.cut = !flying;
      own = null;
      cut = state !== lastState;
      lastState = state;
      if (!h) return;
      strikeCloud = (x, y, z, speed) =>
        cloud?.burst(x, y + 0.3, z, 0, 0, Math.min(1.5, speed / 15), snowAt(x, z));
      view.update(state, alpha, dt, player, hooks);
      const puff: WashPuff = (x, y, z, vx, vy, vz, size) => cloud?.blow(x, y, z, vx, vy, vz, size);
      view.blow(state, dt, puff, (x, z) => snowAt(x, z).loose);
      const wreck = h.mode === "wreck";
      const groundAt = (x: number, z: number) => state.level.groundAt(x, z);
      if (wreck && !wasWreck && h.wreck) {
        // IT GOES UP: the fireball, the spray of fuel lit along the way it
        // was going, and the snow round it thrown up and out by the shock.
        const way = view.way();
        boom.burst(h.wreck.x, h.wreck.y, h.wreck.z, h.wreck.speed, way.x, way.z);
        const { x, y, z } = h.wreck;
        const snow = snowAt(x, z);
        for (let i = 0; i < 4; i++)
          cloud?.burst(x, y + 0.5, z, way.x * 0.3, way.z * 0.3, 2.5, snow);
        for (let i = 0; i < 28; i++) {
          const a = (i / 28) * Math.PI * 2;
          const sx = Math.sin(a);
          const sz = Math.cos(a);
          cloud?.blow(x + sx * 4, y + 1, z + sz * 4, sx * 22, 2.5, sz * 22, 2.4);
        }
        crash =
          h.wreck.aboard && shown && rung !== "orbit"
            ? startCrashCam(shown, { x, y: y + 2, z })
            : null;
      }
      if (!wreck && wasWreck) {
        boom.clear();
        crash = null;
        // The ride begun again on the pad: cut to it.
        cut = true;
        cam.fresh = true;
      }
      wasWreck = wreck;
      boom.burning(wreck, h.x, h.y, h.z);
      boom.update(dt, groundAt, eyeWas);
      const step = Math.min(dt, 0.1);
      if (wreck && crash && h.wreck && rung !== "orbit") {
        const w = h.wreck;
        const c = state.skier;
        const t = c.thrown;
        const rider = t ? { x: t.x, y: t.y, z: t.z } : { x: c.x, y: c.y, z: c.z };
        own = frameCrash(
          crash,
          { x: w.x, y: w.y, z: w.z },
          w.aboard ? rider : null,
          step,
          groundAt,
          (e, a) => treeBetween(state.level, e, a),
        );
        cut = true;
        return;
      }
      const at = view.drawn();
      if (!h.rider || !at || rung === "orbit") {
        cam.fresh = true;
        if (lastLens && h.mode === "home" && since < DROP_HOLD && rung !== "orbit") {
          // THE DROP: held where it was, its look coming round onto him as
          // he falls away.
          since += dt;
          const c = state.skier;
          const k = Math.min(1, since / DROP_TURN);
          const s = k * k * (3 - 2 * k);
          const f = lastLens.target;
          own = {
            ...lastLens,
            target: {
              x: f.x + (c.x - f.x) * s,
              y: f.y + (c.y - f.y) * s,
              z: f.z + (c.z - f.z) * s,
            },
            roll: lastLens.roll * (1 - s),
          };
          return;
        }
        lastLens = null;
        return;
      }
      since = 0;
      lastLens = frameHeli(cam, h, at, rung, step, groundAt);
      own = lastLens;
    },
    lens(ladder, dt) {
      if (own) {
        share = cut ? 1 : Math.min(1, share + dt / HAND_IN);
        held = own;
      } else {
        share = cut ? 0 : Math.max(0, share - dt / HAND_OUT);
      }
      // Flown onto it round the machine as it is drawn, never through
      // it; off it, straight back to the skier falling away from it.
      const at = view.drawn();
      shown =
        !held || share <= 0
          ? null
          : share >= 1
            ? held
            : own && at
              ? orbitBlend(ladder, held, share, heliMiddleOf(at))
              : blendLens(ladder, held, share);
      if (!shown) held = null;
      const out = shown;
      // What a crash starts from: the lens on screen, whoever framed it.
      shown = shown ?? ladder;
      Object.assign(eyeWas, shown.eye);
      return out;
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
