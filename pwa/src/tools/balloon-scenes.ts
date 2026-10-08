// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BALLOON LAB'S SCENES (`balloon-harness.ts`): every moment the free
// ride's hot air balloon has (`docs/hot-air-balloon.md`), staged on the
// engine and photographed through the game's own renderer. A scene stands
// up its own run (`Stage.fresh`: in the basket, tethered on the valley
// floor), so any one can be shot alone; it moves it on by stepping the
// engine on the skier's own controls (the tuck the blast valve, the skid
// the parachute's cord, the edge and the lean his walk, the machine press
// over the side) or on the bot's hands (`balloonPilot`) — and for a look
// the engine reaches only in a gale or a fire (the envelope leant over,
// burning, laid on the snow) it sets the state's drawn shares by hand and
// draws it still. Nothing reads a wall clock, so a seed's sheet is the same
// sheet twice.

import {
  NEUTRAL_INPUT,
  balloonPilot,
  type BalloonState,
  type GameState,
  type Level,
  type SkierInput,
  type SkyOverride,
} from "@engine";

import { everyColourway, SCHEMES, type Colourway } from "../game/balloon-look.ts";
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
  /** A free ride stood up in the basket, tethered on the valley floor. */
  fresh(): GameState;
  /** Every run after flown in `sky`'s weather — the engine's air and the
   * picture's — or the map's own again (null). */
  fly(sky: SkyOverride | null): Promise<void>;
  /** Stepped and drawn every sixtieth of a second. */
  run(state: GameState, seconds: number, drive?: Drive): void;
  /** Stepped and not drawn — the long way up, then `run` a moment so the
   * drawing catches up. */
  skip(state: GameState, seconds: number, drive?: Drive): void;
  until(state: GameState, test: (s: GameState) => boolean, limit: number, drive?: Drive): boolean;
  once(state: GameState, input: SkierInput): void;
  camera(rung: CameraRung): void;
  shoot(state: GameState, label: string, lens?: Lens): void;
  sky(over: SkyOverride | null): Promise<void>;
  /** Every balloon painted in `c`, or its map's own again (null). */
  paint(c: Colourway | null): void;
};

const still: Drive = () => NEUTRAL_INPUT;
const bot: Drive = (s) => balloonPilot(s);
const RUNGS = ["tips", "helmet", "chase", "far", "high", "orbit"] as const;
const ride =
  (o: Partial<SkierInput>): Drive =>
  () => ({ ...NEUTRAL_INPUT, ...o });

const ball = (s: GameState): BalloonState => s.balloon!;

/** A lens planted off the basket where it is: `right` m to the right of the
 * way it faces, `up` m over its floor, `back` m behind it, looking at the
 * axis `over` m over the floor (11 frames the whole balloon, 1 the
 * basket). */
function around(
  right: number,
  up: number,
  back: number,
  fov = 50,
  over = 11,
): (s: GameState) => LensPose {
  return (state) => {
    const b = ball(state);
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const ex = b.x + fz * right - fx * back;
    const ez = b.z - fx * right - fz * back;
    const ey = Math.max(state.level.groundAt(ex, ez) + 0.5, b.y + up);
    return {
      eye: { x: ex, y: ey, z: ez },
      target: { x: b.x, y: b.y + over, z: b.z },
      fov,
      roll: 0,
    };
  };
}

/** From inside the basket, at a skier's eye, looking up into the mouth —
 * `tilt` rad off straight up toward the basket's front. */
function upward(tilt = 0.12, fov = 80): (s: GameState) => LensPose {
  return (state) => {
    const b = ball(state);
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const eye = { x: b.x - fx * 0.35, y: b.y + 1.7, z: b.z - fz * 0.35 };
    const k = Math.tan(tilt) * 20;
    return {
      eye,
      target: { x: eye.x + fx * k, y: eye.y + 20, z: eye.z + fz * k },
      fov,
      roll: 0,
    };
  };
}

/** From the snow under it, `off` m to the side, looking up at it. */
function fromSnow(off: number, fov = 55): (s: GameState) => LensPose {
  return (state) => {
    const b = ball(state);
    const ex = b.x + off;
    const ez = b.z + off * 0.6;
    return {
      eye: { x: ex, y: state.level.groundAt(ex, ez) + 1.7, z: ez },
      target: { x: b.x, y: b.y + 10, z: b.z },
      fov,
      roll: 0,
    };
  };
}

/** Up off the tether on the bot's hands, a working height over the slope. */
function aloft(st: Stage, seconds = 110): GameState {
  const s = st.fresh();
  st.skip(s, seconds, bot);
  st.run(s, 1, bot);
  return s;
}

export const VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  // ── TETHERED ON THE VALLEY FLOOR ───────────────────────────────────────
  tethered(st) {
    const s = st.fresh();
    st.run(s, 1, still);
    st.shoot(s, "chase", "chase");
    st.shoot(s, "quarter", around(20, 4, 24, 50));
    st.shoot(s, "side", around(34, 6, 0, 50));
    st.shoot(s, "front", around(-4, 5, -34, 50));
    st.shoot(s, "low", around(22, 1.2, 26, 62, 13));
    st.shoot(s, "far", around(90, 25, 130, 32));
  },
  // ── IN FLIGHT OVER THE MOUNTAIN ────────────────────────────────────────
  flight(st) {
    const s = aloft(st);
    st.shoot(s, "chase", "chase");
    st.shoot(s, "side", around(38, 0, 8, 45));
    st.shoot(s, "quarter-high", around(26, 22, 30, 45));
    st.shoot(s, "above", around(10, 48, 16, 50));
    st.shoot(s, "from-snow", fromSnow(30, 50));
    st.shoot(s, "far", around(160, 40, 220, 28));
  },
  // ── THE BASKET, THE BURNER, THE SKIRT CLOSE UP ─────────────────────────
  basket(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    st.shoot(s, "quarter", around(2.6, 1.7, 2.8, 50, 1.0));
    st.shoot(s, "side", around(3.6, 1.2, 0.2, 50, 0.8));
    st.shoot(s, "rim", around(1.2, 1.5, 1.5, 45, 1.0));
    st.shoot(s, "burner", around(1.0, 2.3, 1.3, 55, 2.3));
    st.shoot(s, "skirt", around(5, 4.2, 5.5, 55, 3.6));
    st.shoot(s, "inside", around(0.3, 4.0, 0.7, 60, 0.3));
  },
  // ── UNDER THE MOUTH ────────────────────────────────────────────────────
  mouth(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    st.shoot(s, "up", upward(0.1, 85));
    st.shoot(s, "up-front", upward(0.45, 75));
    st.run(s, 2.5, ride({ tuck: 1 }));
    st.shoot(s, "burning-up", upward(0.1, 85));
    st.shoot(s, "throat", around(3, 1.6, 2, 70, 7));
  },
  // ── THE PARACHUTE PULLED ───────────────────────────────────────────────
  vent(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    ball(s).vent = 1;
    st.shoot(s, "up", upward(0.05, 80));
    st.shoot(s, "crown", around(6, 34, 8, 45, 20));
    ball(s).vent = 0;
    st.shoot(s, "crown-shut", around(6, 34, 8, 45, 20));
  },
  // ── LEANT OVER BY THE AIR PAST IT ──────────────────────────────────────
  lean(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    const b = ball(s);
    for (const [lean, shear] of [
      [0.06, 3],
      [0.16, 6],
      [0.3, 9],
    ]) {
      b.lean = lean;
      b.leanTo = b.heading + Math.PI / 2;
      b.shear = shear;
      st.shoot(s, `${shear}ms-behind`, around(0, 6, 40, 45));
      st.shoot(s, `${shear}ms-quarter`, around(-22, 6, 28, 45));
    }
  },
  // ── AFTER DARK, THE BURNER LIT ─────────────────────────────────────────
  async night(st) {
    await st.sky({ hour: 21 });
    const s = st.fresh();
    st.run(s, 0.5, still);
    st.shoot(s, "cold", around(20, 4, 24, 50));
    st.run(s, 2.5, ride({ tuck: 1 }));
    st.shoot(s, "burn-chase", "chase");
    st.shoot(s, "burn-quarter", around(20, 4, 24, 50));
    st.shoot(s, "burn-low", around(22, 1.2, 26, 62, 13));
    st.shoot(s, "burn-up", upward(0.1, 85));
    await st.sky({ hour: 17.2 });
    st.shoot(s, "dusk-quarter", around(20, 4, 24, 50));
    await st.sky(null);
  },
  // ── ALIGHT ─────────────────────────────────────────────────────────────
  burn(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    const b = ball(s);
    b.scorch = 0.9;
    st.shoot(s, "scorched", around(14, 3, 16, 50, 6));
    b.burning = true;
    for (const burnt of [0.2, 0.5, 0.85]) {
      b.burnt = burnt;
      st.shoot(s, `burnt-${burnt}`, around(20, 4, 24, 50));
    }
  },
  // ── LAID ON THE SNOW ───────────────────────────────────────────────────
  down(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    const b = ball(s);
    b.mode = "down";
    b.leanTo = b.heading + 0.6;
    for (const d of [0.2, 0.45, 0.7, 1]) {
      b.deflate = d;
      st.shoot(s, `deflate-${d}`, around(18, 9, 22, 50, 2));
    }
    st.shoot(s, "laid-low", around(-10, 1.8, 10, 60, 0.5));
  },
  // ── EVERY COLOURWAY ────────────────────────────────────────────────────
  colours(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    for (const c of everyColourway()) {
      st.paint(c);
      st.shoot(s, SCHEMES[c.scheme], around(24, 5, 30, 45));
    }
    st.paint(null);
  },
  // ── WALKING THE BASKET ─────────────────────────────────────────────────
  walk(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    st.shoot(s, "middle", around(0.6, 3.4, 1.2, 60, 0.6));
    st.run(s, 1.2, ride({ steer: 1, lean: -1 }));
    st.shoot(s, "front-right", around(0.6, 3.4, 1.2, 60, 0.6));
    st.run(s, 2.4, ride({ steer: -1, lean: 1 }));
    st.shoot(s, "back-left", around(0.6, 3.4, 1.2, 60, 0.6));
    st.shoot(s, "back-left-side", around(5, 1.5, 0, 50, 1.5));
  },
  // ── THE BALLOON ALONE, FROM EIGHT SIDES ────────────────────────────────
  turntable(st) {
    const s = aloft(st);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      st.shoot(s, `${i * 45}deg`, around(Math.sin(a) * 42, 3, Math.cos(a) * 42, 42));
    }
  },
  // ── OVER THE SIDE ──────────────────────────────────────────────────────
  jump(st) {
    const s = aloft(st, 60);
    st.once(s, { ...NEUTRAL_INPUT, machine: true });
    st.run(s, 0.6, still);
    st.shoot(s, "over-the-side", "chase");
    st.run(s, 4, still);
    st.shoot(s, "adrift", fromSnow(25, 60));
  },
  // ── EVERY RUNG OF THE LADDER ───────────────────────────────────────────
  lenses(st) {
    for (const rung of RUNGS) {
      const s = st.fresh();
      st.camera(rung);
      st.skip(s, 90, bot);
      st.run(s, 1.5, bot);
      st.shoot(s, rung, rung);
    }
    st.camera("chase");
  },
};

/** A GALE for the engine and the picture: a fair sky with a strong wind,
 * so the fire it lights can be seen. */
const GALE: SkyOverride = { weather: { kind: "fair", wind: 13 } };

/** Close on the burner and the mouth, from beside and a little under. */
const burnerLens = around(3.0, 2.3, 3.8, 62, 3.9);
/** Close on the pilot lights. */
const pilotLens = around(0.75, 2.62, 0.95, 32, 2.42);

/** Up off the tether on the bot's hands, then alight. */
function alight(st: Stage, seconds = 110): GameState {
  const s = aloft(st, seconds);
  const b = ball(s);
  b.scorch = 1;
  b.burning = true;
  return s;
}

export const FIRE_VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  // ── THE BURNER BY DAY: lit, its ignition and its tail ──────────────────
  fire(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    st.shoot(s, "pilot-close", pilotLens);
    let t = 0;
    for (const at of [0.04, 0.1, 0.2, 0.4, 1.2]) {
      st.run(s, at - t, ride({ tuck: 1 }));
      t = at;
      st.shoot(s, `ignite-${at}s`, burnerLens);
    }
    st.shoot(s, "burning-quarter", around(20, 4, 24, 50));
    st.shoot(s, "burning-chase", "chase");
    st.shoot(s, "up-into-mouth", upward(0.08, 85));
    st.shoot(s, "up-front", upward(0.4, 75));
    t = 0;
    for (const at of [0.05, 0.12, 0.25, 0.45]) {
      st.run(s, at - t, still);
      t = at;
      st.shoot(s, `tail-${at}s`, burnerLens);
    }
  },
  // ── THE BURNER AFTER DARK ──────────────────────────────────────────────
  async "fire-night"(st) {
    await st.sky({ hour: 21 });
    const s = st.fresh();
    st.run(s, 0.5, still);
    st.shoot(s, "pilot-night", pilotLens);
    st.run(s, 1.5, ride({ tuck: 1 }));
    st.shoot(s, "night-close", burnerLens);
    st.shoot(s, "night-quarter", around(20, 4, 24, 50));
    st.shoot(s, "night-low", around(22, 1.2, 26, 62, 13));
    st.shoot(s, "night-up", upward(0.08, 85));
    st.shoot(s, "night-chase", "chase");
    await st.sky({ hour: 17.3 });
    st.shoot(s, "dusk-quarter", around(20, 4, 24, 50));
    await st.sky(null);
  },
  // ── THE FLAME LAID OVER BY THE AIR PAST IT ─────────────────────────────
  "fire-wind"(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    st.run(s, 1.2, ride({ tuck: 1 }));
    const b = ball(s);
    for (const shear of [3, 7, 11]) {
      b.shear = shear;
      b.lean = shear * 0.025;
      b.leanTo = b.heading + Math.PI / 2;
      st.shoot(s, `bent-${shear}ms`, around(6, 3.2, 1, 62, 4.2));
    }
  },
  // ── CATCHING IN A GALE, FRAME BY FRAME ─────────────────────────────────
  async catch(st) {
    await st.fly(GALE);
    const s = st.fresh();
    st.run(s, 0.5, still);
    const burn = ride({ tuck: 1 });
    const lens = (state: GameState): LensPose => {
      // From the windward side and a little ahead, where it catches.
      const bb = ball(state);
      const from = bb.leanTo + Math.PI;
      const ex = bb.x + Math.sin(from) * 16 + Math.cos(from) * 9;
      const ez = bb.z + Math.cos(from) * 16 - Math.sin(from) * 9;
      return {
        eye: { x: ex, y: Math.max(state.level.groundAt(ex, ez) + 1.6, bb.y + 4), z: ez },
        target: { x: bb.x, y: bb.y + 6, z: bb.z },
        fov: 55,
        roll: 0,
      };
    };
    st.shoot(s, "gale-cold", lens);
    for (const at of [0.3, 0.6, 0.9]) {
      st.until(s, (x) => ball(x).scorch >= at || ball(x).burning, 30, burn);
      st.shoot(s, `scorch-${at}`, lens);
    }
    st.until(s, (x) => ball(x).burning, 30, burn);
    st.shoot(s, "alight", lens);
    for (const at of [0.06, 0.15, 0.3, 0.5, 0.75]) {
      st.until(s, (x) => ball(x).burnt >= at, 30, still);
      st.shoot(s, `burnt-${at}`, around(26, 2, 30, 55, 8));
    }
    await st.fly(null);
  },
  // ── BURNING IN FLIGHT, FALLING, THE WRECK ──────────────────────────────
  inferno(st) {
    const s = alight(st);
    st.run(s, 1.5, still);
    st.shoot(s, "caught", around(26, 4, 32, 50, 10));
    st.until(s, (x) => ball(x).burnt >= 0.25, 20, still);
    st.shoot(s, "climbing-gores", around(26, 4, 32, 50, 10));
    st.shoot(s, "from-basket-up", upward(0.1, 85));
    st.once(s, { ...NEUTRAL_INPUT, machine: true });
    st.until(s, (x) => ball(x).burnt >= 0.5, 20, still);
    st.shoot(s, "engulfed", around(30, 6, 40, 50, 9));
    st.until(s, (x) => ball(x).burnt >= 0.8, 20, still);
    st.shoot(s, "falling", around(40, 10, 60, 50, 6));
    st.shoot(s, "falling-from-snow", fromSnow(70, 50));
    st.until(s, (x) => ball(x).mode === "down", 120, still);
    st.run(s, 2, still);
    st.shoot(s, "wreck-2s", around(18, 8, 24, 50, 1));
    st.run(s, 13, still);
    st.shoot(s, "wreck-15s", around(18, 8, 24, 50, 1));
    st.skip(s, 45, still);
    st.run(s, 2, still);
    st.shoot(s, "wreck-smoulder", around(30, 10, 40, 50, 6));
  },
  // ── ALIGHT AFTER DARK ──────────────────────────────────────────────────
  async "inferno-night"(st) {
    await st.sky({ hour: 20.5 });
    const s = alight(st);
    st.until(s, (x) => ball(x).burnt >= 0.35, 30, still);
    st.shoot(s, "night-burning", around(30, 5, 40, 50, 9));
    st.until(s, (x) => ball(x).burnt >= 0.7, 30, still);
    st.shoot(s, "night-falling", around(40, 10, 60, 50, 6));
    await st.sky(null);
  },
};

Object.assign(VIEWS, FIRE_VIEWS);

export const GROUPS: Record<string, readonly string[]> = {
  tethered: ["tethered"],
  flight: ["flight"],
  basket: ["basket"],
  mouth: ["mouth", "vent"],
  lean: ["lean"],
  night: ["night"],
  burn: ["burn"],
  down: ["down"],
  colours: ["colours"],
  walk: ["walk"],
  turntable: ["turntable"],
  jump: ["jump"],
  lenses: ["lenses"],
  fire: ["fire", "fire-night", "fire-wind"],
  catch: ["catch"],
  inferno: ["inferno", "inferno-night"],
};
