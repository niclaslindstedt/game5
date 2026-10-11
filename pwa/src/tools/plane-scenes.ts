// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE LAB'S SCENES (`plane-harness.ts`): the free ride's jump
// plane (`engine/game/plane.ts`, drawn by `plane-view.ts`) staged on the
// engine and photographed through the game's own renderer — parked on its
// strip with the skier in its door, in the air on the pilot's hands
// (`planeFlight`), its surfaces held over by hand, from every rung of the
// camera, after dark. A scene stands up its own run (`Stage.fresh`), so
// any one of them can be shot alone. Nothing reads a wall clock, so a
// seed's sheet is the same sheet twice.

import {
  NEUTRAL_INPUT,
  planeFlight,
  type GameState,
  type Level,
  type PlaneControls,
  type SkierInput,
  type SkyOverride,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import type { CameraRung } from "../game/renderer-api.ts";

/** A lens for a frame: a rung of the game's own ladder, a pose planted for
 * it, or one worked out off the state at the moment it is shot. */
export type Lens = CameraRung | LensPose | ((state: GameState) => LensPose);

/** What drives a run on, step by step. */
export type Drive = (state: GameState) => SkierInput;

/** What a scene may ask of the page. */
export type Stage = {
  level: Level;
  /** A free ride stood up in the jump plane's door on its strip. */
  fresh(): GameState;
  /** Stepped and drawn every sixtieth of a second. */
  run(state: GameState, seconds: number, drive?: Drive): void;
  /** Stepped and not drawn — the long climb — then `run` a moment so the
   * drawing's tracks catch up. */
  skip(state: GameState, seconds: number, drive?: Drive): void;
  until(state: GameState, test: (s: GameState) => boolean, limit: number, drive?: Drive): boolean;
  camera(rung: CameraRung): void;
  shoot(state: GameState, label: string, lens?: Lens): void;
  sky(over: SkyOverride | null): Promise<void>;
};

const RUNGS = ["tips", "helmet", "chase", "far", "high", "orbit"] as const;
const still: Drive = () => NEUTRAL_INPUT;
/** The pilot's own hands (the pre-roll's), climbing to the jump run. */
const pilot: Drive = (s) => ({ ...NEUTRAL_INPUT, plane: planeFlight(s) });
/** The pilot's hands with some of them overridden — a surface held over. */
const held =
  (o: Partial<PlaneControls>): Drive =>
  (s) => ({ ...NEUTRAL_INPUT, plane: { ...planeFlight(s), ...o } });

/** A lens planted off the plane where it is: `right` m to its right (the
 * screen's, the engine's −x: the door's side), `up` m over its datum and
 * `back` m behind it, looking at a point `ahead` m along it and `over` m
 * up. */
function around(
  right: number,
  up: number,
  back: number,
  fov = 40,
  ahead = -1.5,
  over = 2,
): (s: GameState) => LensPose {
  return (state) => {
    const p = state.plane!;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const rx = -fz;
    const rz = fx;
    const ex = p.x + rx * right - fx * back;
    const ez = p.z + rz * right - fz * back;
    const ey = Math.max(state.level.groundAt(ex, ez) + 0.5, p.y + up);
    return {
      eye: { x: ex, y: ey, z: ez },
      target: { x: p.x + fx * ahead, y: p.y + over, z: p.z + fz * ahead },
      fov,
      roll: 0,
    };
  };
}

/** A lens riding the plane in its own frame (the engine's body frame: x
 * the screen's left when seen from behind, y up, z forward): from `eye` to
 * `at`, both off the datum. */
function riding(
  eye: [number, number, number],
  at: [number, number, number],
  fov = 50,
): (s: GameState) => LensPose {
  const turn = (q: { x: number; y: number; z: number; w: number }, v: [number, number, number]) => {
    const [x, y, z] = v;
    const ix = q.w * x + q.y * z - q.z * y;
    const iy = q.w * y + q.z * x - q.x * z;
    const iz = q.w * z + q.x * y - q.y * x;
    const iw = -q.x * x - q.y * y - q.z * z;
    return {
      x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
      y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
      z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
    };
  };
  return (state) => {
    const p = state.plane!;
    const e = turn(p.q, eye);
    const t = turn(p.q, at);
    return {
      eye: { x: p.x + e.x, y: p.y + e.y, z: p.z + e.z },
      target: { x: p.x + t.x, y: p.y + t.y, z: p.z + t.z },
      fov,
      roll: 0,
    };
  };
}

/** Climbed out on the pilot's hands for `seconds`, then a moment drawn. */
function aloft(st: Stage, seconds = 70): GameState {
  const s = st.fresh();
  st.skip(s, seconds, pilot);
  st.run(s, 0.6, pilot);
  return s;
}

export const VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  // ── THE MODEL: parked, from eight sides by day and four after dark ────
  model(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      st.shoot(s, `${k * 45}°`, around(Math.sin(a) * 19, 3.2, Math.cos(a) * 19, 42));
    }
  },
  async "model-night"(st) {
    await st.sky({ hour: 21, weather: "clear" });
    const s = st.fresh();
    st.run(s, 0.5, still);
    for (const [label, r, b] of [
      ["door side", 18, 6],
      ["front", 4, -19],
      ["far side", -18, 6],
      ["behind", 3, 20],
    ] as const) {
      st.shoot(s, label, around(r, 3, b, 42));
    }
    const up = aloft(st, 40);
    st.shoot(up, "aloft", around(14, 3, 18, 40));
    await st.sky(null);
  },
  // ── ON THE STRIP ───────────────────────────────────────────────────────
  strip(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    st.shoot(s, "three-quarter", around(13, 2.2, -9, 45));
    st.shoot(s, "low nose", around(6, 0.6, -8, 50, 1, 1.6));
    for (const r of ["chase", "far", "high", "orbit"] as const) st.shoot(s, r, r);
    // The take-off roll, on the pilot's hands.
    st.run(s, 9, pilot);
    st.shoot(s, "rolling", around(10, 1.5, 8, 40));
    st.run(s, 6, pilot);
    st.shoot(s, "lifting", around(14, 2, 4, 40));
  },
  // ── IN THE AIR ─────────────────────────────────────────────────────────
  flight(st) {
    const s = aloft(st);
    st.shoot(s, "chase", around(0, 3, 22, 40));
    st.shoot(s, "quarter", around(14, 3, 14, 40));
    st.shoot(s, "side", around(22, 0, 0, 40));
    st.shoot(s, "front", around(4, 1, -22, 40));
    st.shoot(s, "below", around(6, -14, 4, 50));
    st.shoot(s, "above", around(3, 18, 8, 45));
  },
  // ── THE SURFACES held over by hand, from behind and close ─────────────
  surfaces(st) {
    const tail = riding([3.2, 4.6, -12.5], [0, 2.6, -6.6], 45);
    const wings = riding([0, 5.5, -9.5], [0, 2.6, -0.5], 70);
    for (const [label, o, lens] of [
      ["roll right", { roll: 1 }, wings],
      ["roll left", { roll: -1 }, wings],
      ["flaps down", { flaps: 1 }, wings],
      ["stick back", { pitch: -1 }, tail],
      ["stick forward", { pitch: 1 }, tail],
      ["rudder right", { yaw: 1 }, tail],
    ] as const) {
      const s = aloft(st, 60);
      st.run(s, 0.4, held(o));
      st.shoot(s, label, lens);
    }
  },
  // ── THE DOOR: the skier in it, parked and on the jump run ─────────────
  door(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    st.shoot(s, "close", around(5.5, 1.2, 1.2, 45, -0.9, 1.6));
    st.shoot(s, "tips", "tips");
    st.shoot(s, "helmet", "helmet");
    const up = aloft(st);
    st.shoot(up, "close aloft", around(5, 1.4, 2, 50, -0.9, 1.6));
    st.shoot(up, "tips aloft", "tips");
    st.shoot(up, "helmet aloft", "helmet");
  },
  // ── EVERY RUNG of the camera in the air ───────────────────────────────
  lenses(st) {
    const s = aloft(st);
    for (const r of RUNGS) {
      st.shoot(s, r, r);
      st.run(s, 0.2, pilot);
    }
  },
  // ── THE COCKPIT (Phase E builds it): what the pilot's eye sees now ─────
  cockpit(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    // Drawn as from the pilot's seat (the HELMET rung's inside view).
    st.camera("helmet");
    st.shoot(s, "helmet", "helmet");
    st.shoot(s, "pilot's eye", riding([0.3, 2.3, 0.72], [0.3, 1.85, 8], 70));
    st.shoot(s, "over the shoulder", riding([0.35, 2.5, -0.4], [0, 2.0, 3], 70));
    const up = aloft(st);
    st.camera("helmet");
    st.shoot(up, "helmet aloft", "helmet");
  },
  // ── THE CRASH (Phase E draws the fire): stick forward into the snow ────
  crash(st) {
    const s = aloft(st, 40);
    st.until(s, (x) => x.plane?.mode === "wreck", 60, held({ pitch: 1, throttle: 1 }));
    st.run(s, 0.5, still);
    st.shoot(s, "wreck", around(16, 4, 12, 45, 0, 1));
    st.run(s, 3, still);
    st.shoot(s, "charred", around(-14, 5, 10, 45, 0, 1));
  },
};

/** The sheets and the views each is made of. */
export const GROUPS: Record<string, readonly string[]> = {
  model: ["model", "model-night"],
  strip: ["strip"],
  flight: ["flight", "surfaces"],
  door: ["door"],
  lenses: ["lenses"],
  cockpit: ["cockpit"],
  crash: ["crash"],
};
