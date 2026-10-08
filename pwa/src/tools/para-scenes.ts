// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR LAB'S SCENES (`para-harness.ts`): every moment the free
// ride's paramotor has (`docs/paramotor.md`), staged on the engine and
// photographed through the game's own renderer. A scene stands up its own
// run (`Stage.fresh`), so any one of them can be shot alone; it moves it on
// by stepping the engine on the pilot's own controls (the tuck the
// throttle, the skid the brakes, the edge the toggles, the lean the risers,
// the machine press the release) or on the bot's hands (`paraPilot`).
// Nothing reads a wall clock, so a seed's sheet is the same sheet twice.

import {
  NEUTRAL_INPUT,
  paraPilot,
  type GameState,
  type Level,
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
  /** A free ride stood up on the summit under the wing. */
  fresh(): GameState;
  /** Stepped and drawn every sixtieth of a second. */
  run(state: GameState, seconds: number, drive?: Drive): void;
  /** Stepped and not drawn — the long way into the air, then `run` a
   * moment so the drawing's tracks and springs catch up. */
  skip(state: GameState, seconds: number, drive?: Drive): void;
  until(state: GameState, test: (s: GameState) => boolean, limit: number, drive?: Drive): boolean;
  once(state: GameState, input: SkierInput): void;
  camera(rung: CameraRung): void;
  shoot(state: GameState, label: string, lens?: Lens): void;
  sky(over: SkyOverride | null): Promise<void>;
};

const still: Drive = () => NEUTRAL_INPUT;
const bot: Drive = (s) => paraPilot(s);
const RUNGS = ["tips", "helmet", "chase", "far", "high", "orbit"] as const;
const ride =
  (o: Partial<SkierInput>): Drive =>
  () => ({ ...NEUTRAL_INPUT, ...o });

/** A lens planted off the pilot where he is: `right` m to the screen's
 * right of the way the wing flies, `up` m over him, `back` m behind him,
 * looking at a point `ahead` m along that way and `over` m up his lines
 * (3 frames the whole rig, 0 the pilot). */
function around(
  right: number,
  up: number,
  back: number,
  fov = 50,
  ahead = 0,
  over = 3,
): (s: GameState) => LensPose {
  return (state) => {
    const c = state.skier;
    const p = state.para;
    const h = p && p.mode !== "dropped" ? p.heading : c.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const rx = -fz;
    const rz = fx;
    const ex = c.x + rx * right - fx * back;
    const ez = c.z + rz * right - fz * back;
    const ey = Math.max(state.level.groundAt(ex, ez) + 0.4, c.y + up);
    return {
      eye: { x: ex, y: ey, z: ez },
      target: { x: c.x + fx * ahead, y: c.y + over, z: c.z + fz * ahead },
      fov,
      roll: 0,
    };
  };
}

/** A lens planted off a released piece lying on the snow. */
function overPiece(
  which: "canopy" | "motor",
  right: number,
  up: number,
  back: number,
  fov = 45,
): (s: GameState) => LensPose {
  return (state) => {
    const b = state.para?.[which];
    const at = b ?? { x: state.skier.x, y: state.skier.y, z: state.skier.z, heading: 0 };
    const fx = Math.sin(at.heading);
    const fz = Math.cos(at.heading);
    const ex = at.x - fz * right - fx * back;
    const ez = at.z + fx * right - fz * back;
    return {
      eye: { x: ex, y: Math.max(state.level.groundAt(ex, ez) + 0.4, at.y + up), z: ez },
      target: { x: at.x, y: at.y + 0.2, z: at.z },
      fov,
      roll: 0,
    };
  };
}

/** Down to the snow: the throttle off and the wing turned ACROSS the fall
 * line, so the mountain stops falling away under the glide; `brake` of the
 * toggles held to slow it. */
const across =
  (brake = 0): Drive =>
  (state) => {
    const p = state.para!;
    const c = state.skier;
    const n = { x: 0, y: 1, z: 0 };
    state.level.normalAt(c.x, c.z, n);
    const fall = Math.atan2(n.x, n.z);
    let off = fall + Math.PI / 2 - p.heading;
    off = Math.atan2(Math.sin(off), Math.cos(off));
    const steer = Math.max(-1, Math.min(1, off * 1.2)) * (1 - brake);
    return { ...NEUTRAL_INPUT, steer, brake };
  };

/** Into the air on the bot's hands, a working height under the wing. */
function airborne(st: Stage, seconds = 24): GameState {
  const s = st.fresh();
  st.skip(s, seconds, bot);
  st.run(s, 0.6, bot);
  return s;
}

export const VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  // ── ON THE SUMMIT ──────────────────────────────────────────────────────
  summit(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    st.shoot(s, "chase", "chase");
    st.shoot(s, "behind", around(0, 1.5, 14, 55, 0, 3));
    st.shoot(s, "side", around(14, 2, 0, 55, 0, 3));
    st.shoot(s, "front", around(-3, 1.5, -13, 55, 0, 3));
    st.shoot(s, "under", around(1.5, 0.3, 3, 70, 0, 6));
    st.shoot(s, "far", around(30, 8, 30, 40, 0, 3));
  },
  // ── SKIING OFF, THE WING LET FLY ───────────────────────────────────────
  launch(st) {
    const s = st.fresh();
    st.until(s, (q) => q.para!.mode === "flown", 8, ride({ tuck: 1 }));
    st.run(s, 0.5, ride({ tuck: 1 }));
    st.shoot(s, "let-fly", "chase");
    st.shoot(s, "let-fly-side", around(12, 1, 2, 50, 0, 3));
    st.until(s, (q) => q.para!.flying, 6, ride({ tuck: 1 }));
    st.run(s, 0.8, ride({ tuck: 1 }));
    st.shoot(s, "lift-off", "chase");
    st.shoot(s, "lift-off-side", around(12, 0, 2, 50, 0, 3));
  },
  // ── IN THE AIR ─────────────────────────────────────────────────────────
  flight(st) {
    const s = airborne(st);
    st.shoot(s, "chase", "chase");
    st.shoot(s, "quarter", around(8, 2, 9, 50, 0, 3));
    st.shoot(s, "side", around(14, 3, 0, 50, 0, 3));
    st.shoot(s, "front", around(-4, 2, -14, 50, 0, 3));
    st.shoot(s, "below", around(3, -8, 2, 55, 0, 4));
    st.shoot(s, "above", around(4, 14, 6, 50, 0, 3));
  },
  // ── THE TOGGLE PULLED, THE BRAKES, THE FLARE ───────────────────────────
  turn(st) {
    const s = airborne(st);
    st.run(s, 1.8, ride({ tuck: 0.7, steer: 1 }));
    st.shoot(s, "right-behind", around(0, 1, 12, 55, 0, 3));
    st.shoot(s, "right-front", around(-2, 1, -12, 55, 0, 3));
    st.run(s, 2.5, ride({ tuck: 0.7, steer: -1 }));
    st.shoot(s, "left-behind", around(0, 1, 12, 55, 0, 3));
    st.run(s, 1.5, ride({ tuck: 0.4, brake: 1 }));
    st.shoot(s, "brakes-side", around(12, 2, 0, 55, 0, 3));
    st.shoot(s, "brakes-behind", around(0, 1, 12, 55, 0, 3));
  },
  // ── THE LEAN IN THE HARNESS: forward over the bar, back reclined ──────
  lean(st) {
    const s = airborne(st);
    st.run(s, 2, ride({ tuck: 0.7 }));
    st.shoot(s, "level-side", around(9, 0, 0, 50, 0, 1.5));
    st.run(s, 2, ride({ tuck: 0.7, lean: -1 }));
    st.shoot(s, "forward-side", around(9, 0, 0, 50, 0, 1.5));
    st.shoot(s, "forward-chase", "chase");
    st.run(s, 3, ride({ tuck: 0.7, lean: 1 }));
    st.shoot(s, "back-side", around(9, 0, 0, 50, 0, 1.5));
    st.shoot(s, "back-chase", "chase");
  },
  // ── DOWN ON THE SNOW UNDER IT, AND THE LANDING ─────────────────────────
  landing(st) {
    // Off the summit and straight back down, above the tree line.
    const s = airborne(st, 9);
    // The glide down undrawn, half a second at a time.
    for (let k = 0; k < 360 && s.para!.agl > 25; k++) st.skip(s, 0.5, across(0.2));
    st.until(s, (q) => q.para!.agl < 6, 20, across(0.2));
    st.shoot(s, "final", "chase");
    st.until(s, (q) => q.para!.agl < 1.5, 10, ride({}));
    st.run(s, 0.4, ride({ brake: 1 }));
    st.shoot(s, "flare", around(10, 1, 4, 55, 0, 3));
    st.until(s, (q) => !q.para!.flying, 6, ride({ brake: 0.6 }));
    st.run(s, 1.5, ride({ tuck: 0.3 }));
    st.shoot(s, "speed-riding", "chase");
    st.shoot(s, "speed-riding-side", around(12, 1, 2, 50, 0, 3));
  },
  // ── FOLDED BY ROUGH AIR ────────────────────────────────────────────────
  // The fold set by hand on a wing in calm air (the air's own folds are
  // `make para-wind`'s): the right side under, half the left, the nose.
  fold(st) {
    const s = airborne(st);
    const p = s.para!;
    const folds: [string, number, number][] = [
      ["right", 0.55, 1],
      ["left-deep", 0.9, -1],
      ["frontal", 0.6, 0],
    ];
    for (const [label, fold, side] of folds) {
      p.fold = fold;
      p.foldSide = side;
      st.shoot(s, `${label}-behind`, around(0, 1.5, 12, 55, 0, 3));
      st.shoot(s, `${label}-quarter`, around(-7, 2, -9, 55, 0, 3));
    }
    p.fold = 0;
    p.foldSide = 0;
  },
  // ── THE RIG DROPPED ────────────────────────────────────────────────────
  drop(st) {
    const s = st.fresh();
    st.until(s, (q) => q.para!.mode === "flown", 8, ride({ tuck: 1 }));
    st.run(s, 0.5, ride({ tuck: 1 }));
    st.once(s, { ...NEUTRAL_INPUT, machine: true });
    st.run(s, 0.3, ride({ tuck: 1 }));
    st.shoot(s, "released", around(6, 2, 10, 55, 0, 2));
    st.run(s, 3, ride({ tuck: 1 }));
    st.shoot(s, "skiing-on", "chase");
    st.shoot(s, "canopy-down", overPiece("canopy", 6, 4, 8));
    st.shoot(s, "motor-down", overPiece("motor", 1.5, 1.2, 2.5));
  },
  // A LONG FALL: the rig let go high over the mountain (the bot's flight
  // for 24 s), and the skier watched down onto the snow by the fall look
  // (`camera-fall.ts`) — the chase, the far lens and his own eye.
  "drop-high"(st) {
    const s = airborne(st);
    const high = (q: GameState) => q.skier.y - q.level.groundAt(q.skier.x, q.skier.z);
    st.once(s, { ...NEUTRAL_INPUT, machine: true });
    st.shoot(s, `released-${high(s).toFixed(0)}m`, "chase");
    let t = 0;
    for (const at of [0.8, 1.6]) {
      st.run(s, at - t, still);
      t = at;
      st.shoot(s, `${at}s-${high(s).toFixed(0)}m`, "chase");
    }
    st.shoot(s, `${t}s-far`, "far");
    st.shoot(s, `${t}s-eye`, "helmet");
    st.until(s, (q) => !q.skier.airborne || q.skier.thrown !== null, 15, still);
    st.shoot(s, "touchdown", "chase");
    st.run(s, 1, still);
    st.shoot(s, "after-1s", "chase");
  },
  // ── THE GEAR CLOSE UP ──────────────────────────────────────────────────
  gear(st) {
    const s = airborne(st);
    st.shoot(s, "back", around(0.8, 0.6, 4, 45, 0, 0.4));
    st.shoot(s, "quarter", around(2.6, 0.5, 2.6, 45, 0, 0.4));
    st.shoot(s, "side", around(3.5, 0.3, 0, 45, 0, 0.4));
    st.shoot(s, "front", around(-0.6, 0.4, -3.6, 45, 0, 0.4));
    st.shoot(s, "risers", around(1.2, 1.5, 2, 55, 0, 1.8));
    st.shoot(s, "canopy", around(2, 4.5, 3, 60, 0, 5.8));
  },
  // ── THE RIG ALONE, FROM EIGHT SIDES ────────────────────────────────────
  turntable(st) {
    const s = airborne(st);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      st.shoot(
        s,
        `${(i * 45).toFixed(0)}deg`,
        around(Math.sin(a) * 15, 2.5, Math.cos(a) * 15, 45, 0, 3),
      );
    }
  },
  // ── EVERY RUNG OF THE LADDER ───────────────────────────────────────────
  lenses(st) {
    for (const rung of RUNGS) {
      const s = st.fresh();
      st.camera(rung);
      st.skip(s, 24, bot);
      st.run(s, 1.5, bot);
      st.shoot(s, rung, rung);
    }
    st.camera("chase");
  },
  // ── THROUGH HIS OWN EYES ───────────────────────────────────────────────
  // The pilot's cameras (`camera-para.ts`) at every moment of a flight:
  // HELMET on the summit, skiing off, lifting off and climbing on the
  // throttle, cruising, in a hard turn and on the final glide; TIPS (the
  // look down past the skis) and HIGH (the canopy cam) in the cruise.
  pov(st) {
    const s = st.fresh();
    st.camera("helmet");
    st.run(s, 0.5, still);
    st.shoot(s, "summit", "helmet");
    st.until(s, (q) => q.para!.mode === "flown", 8, ride({ tuck: 1 }));
    st.run(s, 0.5, ride({ tuck: 1 }));
    st.shoot(s, "let-fly", "helmet");
    st.until(s, (q) => q.para!.flying, 6, ride({ tuck: 1 }));
    st.run(s, 2.5, ride({ tuck: 1 }));
    st.shoot(s, "climb", "helmet");
    const a = airborne(st);
    st.run(a, 2, ride({ tuck: 0.6 }));
    st.shoot(a, "cruise", "helmet");
    st.run(a, 0.6, ride({ tuck: 0.6 }));
    st.shoot(a, "cruise-tips", "tips");
    st.run(a, 0.6, ride({ tuck: 0.6 }));
    st.shoot(a, "cruise-high", "high");
    st.camera("helmet");
    st.run(a, 1.5, ride({ tuck: 0.6, steer: 0.5 }));
    st.shoot(a, "turn", "helmet");
    const l = airborne(st, 9);
    for (let k = 0; k < 360 && l.para!.agl > 25; k++) st.skip(l, 0.5, across(0.2));
    st.until(l, (q) => q.para!.agl < 8, 20, across(0.2));
    st.shoot(l, "final", "helmet");
    st.camera("chase");
  },
  // ── AFTER DARK ─────────────────────────────────────────────────────────
  async night(st) {
    await st.sky({ hour: 21 });
    const s = airborne(st);
    st.shoot(s, "chase", "chase");
    st.shoot(s, "quarter", around(8, 2, 9, 50, 0, 3));
    await st.sky(null);
  },
};

export const GROUPS: Record<string, readonly string[]> = {
  summit: ["summit"],
  launch: ["launch"],
  flight: ["flight"],
  turn: ["turn"],
  lean: ["lean"],
  landing: ["landing"],
  fold: ["fold"],
  drop: ["drop", "drop-high"],
  gear: ["gear"],
  turntable: ["turntable"],
  lenses: ["lenses"],
  pov: ["pov"],
  night: ["night"],
};
