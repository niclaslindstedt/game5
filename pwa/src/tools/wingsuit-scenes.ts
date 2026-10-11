// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT LAB'S SCENES (`wingsuit-harness.ts`): the free ride's
// wingsuit (`engine/game/wingsuit.ts`, the flyer posed by
// `skier-wingsuit.ts`, the suit drawn by `wingsuit-figure.ts` over
// `wingsuit-cloth.ts`, the BASE rig by `chute-scene.ts`, the hover exit by
// `wingsuit-hover.ts`) staged on the engine and photographed through the
// game's own renderer — stood on the exit, flown hands off off
// `skydiveAt`, flown on the flyer's own keys (the edge a turn, the tuck the
// dive, the back key the flare, the lean the pitch) or on the bot's hands
// from the exit to the landing (`wingsuitInput`). A scene stands up its own
// run (`Stage.fresh`), so any one of them can be shot alone. Nothing reads
// a wall clock, so a seed's sheet is the same sheet twice.

import {
  NEUTRAL_INPUT,
  skydiveAt,
  trackPointAt,
  wingsuitInput,
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
  /** A wingsuit ride stood up on its exit. */
  fresh(): GameState;
  /** Stepped and drawn every sixtieth of a second. */
  run(state: GameState, seconds: number, drive?: Drive): void;
  until(state: GameState, test: (s: GameState) => boolean, limit: number, drive?: Drive): boolean;
  camera(rung: CameraRung): void;
  shoot(state: GameState, label: string, lens?: Lens): void;
  sky(over: SkyOverride | null): Promise<void>;
};

const RUNGS = ["tips", "helmet", "chase", "far", "high", "orbit"] as const;
const still: Drive = () => NEUTRAL_INPUT;
const keys =
  (o: Partial<SkierInput>): Drive =>
  () => ({ ...NEUTRAL_INPUT, ...o });
const bot: Drive = (s) => wingsuitInput(s);

/** A lens planted off the flyer where he is: `right` m to the right of his
 * heading, `up` m over him, `back` m behind him, looking at a point `over`
 * m up from his middle (or `ahead` m along his way). */
function around(
  right: number,
  up: number,
  back: number,
  fov = 40,
  over = 0,
  ahead = 0,
): (s: GameState) => LensPose {
  return (state) => {
    const c = state.skier;
    const h = state.chute?.heading ?? c.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const ex = c.x + fz * right - fx * back;
    const ez = c.z - fx * right - fz * back;
    const ey = Math.max(state.level.groundAt(ex, ez) + 0.5, c.y + up);
    return {
      eye: { x: ex, y: ey, z: ez },
      target: { x: c.x + fx * ahead, y: c.y + over, z: c.z + fz * ahead },
      fov,
      roll: 0,
    };
  };
}

/** THE TURNTABLE: the views round him a suit is judged from. */
const TURNTABLE: [string, (s: GameState) => LensPose][] = [
  ["front", around(0, 0.2, -3.6)],
  ["back", around(0, 0.4, 3.6)],
  ["side", around(3.6, 0.1, 0)],
  ["top", around(0.01, 4, 0.2, 45)],
  ["below", around(0.01, -4, -0.2, 45)],
  ["three-quarter", around(2.6, 1.4, 2.6)],
];

/** Over the middle of the ski area's piste, heading down it. */
function overPiste(level: Level): { x: number; z: number; heading: number } {
  const p = trackPointAt(level, level.track.length * 0.45);
  return { x: p.x, z: p.z, heading: p.heading };
}

/** A flyer stood up `agl` m over the piste flying his glide hands off. */
function gliding(st: Stage, agl = 900): GameState {
  const s = st.fresh();
  skydiveAt(s, { ...overPiste(st.level), agl, mode: "freefall", suit: "wingsuit" });
  st.run(s, 1.2, still);
  return s;
}

/** The bot's ride from the exit to `test`, within `limit` s. */
function ride(st: Stage, s: GameState, test: (s: GameState) => boolean, limit = 240): boolean {
  return st.until(s, test, limit, bot);
}

const side = around(5.5, 0.8, 0.6);

export const VIEWS: Record<string, (st: Stage) => Promise<void> | void> = {
  // THE SUIT FLYING, round the turntable.
  "suit-flying": (st) => {
    const s = gliding(st);
    for (const [name, lens] of TURNTABLE) st.shoot(s, name, lens);
  },
  // ...and stood on the exit, the wings slack.
  "suit-slack": (st) => {
    const s = st.fresh();
    st.run(s, 0.3, still);
    for (const [name, lens] of TURNTABLE) {
      if (name === "top" || name === "below") continue;
      st.shoot(s, name, lens);
    }
  },
  // THE WHOLE RIDE on the bot's hands, frame by frame.
  "flight-exit": (st) => {
    const s = st.fresh();
    st.run(s, 0.3, still);
    st.shoot(s, "ready", around(3.5, 0.8, 3));
    ride(st, s, (x) => x.chute?.mode === "exit", 5);
    st.run(s, 0.25, bot);
    st.shoot(s, "exit 0.3 s", around(7, 0.5, -5, 45, -0.5));
    st.run(s, 0.45, bot);
    st.shoot(s, "exit 0.7 s", side);
    st.run(s, 0.5, bot);
    st.shoot(s, "pressurising 1.2 s", side);
    st.run(s, 1.8, bot);
    st.shoot(s, "flying 3 s", side);
    st.run(s, 7, bot);
    st.shoot(s, "glide 10 s", "chase");
  },
  "flight-pull": (st) => {
    const s = st.fresh();
    ride(st, s, (x) => x.chute?.mode === "deploying");
    st.shoot(s, "the reach", side);
    for (const [t, name] of [
      [0.32, "the throw"],
      [0.8, "the bag"],
      [1.6, "line stretch"],
      [2.6, "snivel"],
      [3.6, "inflating"],
    ] as const) {
      ride(st, s, (x) => (x.chute?.deploy?.t ?? 9) >= t || x.chute?.mode !== "deploying", 6);
      st.shoot(s, name, around(7, 2, 7, 45, 2));
    }
  },
  "flight-canopy": (st) => {
    const s = st.fresh();
    ride(st, s, (x) => x.chute?.mode === "open");
    st.run(s, 0.5, bot);
    st.shoot(s, "open", around(6, 1, 6, 45, 2));
    st.run(s, 3, bot);
    st.shoot(s, "unzipping", around(4, 0.5, 3, 45, 1));
    st.run(s, 5, bot);
    st.shoot(s, "flying it", "chase");
    ride(st, s, (x) => (x.chute?.agl ?? 0) < 6 || x.chute?.mode === "landed");
    st.shoot(s, "the flare", around(6, 0.5, 4, 45, 1));
    ride(st, s, (x) => x.chute?.mode === "landed", 30);
    st.run(s, 0.6, bot);
    st.shoot(s, "landed", around(0.5, 7, 6, 45, 0.2));
    st.run(s, 1.4, keys({ tuck: 1 }));
    st.shoot(s, "walking", around(4, 1, 3, 45, 0.4));
  },
  // THE SHAPES on his own keys, off a steady glide.
  poses: (st) => {
    for (const [name, drive, t] of [
      ["neutral", still, 1],
      ["turn right", keys({ steer: 1 }), 1.2],
      ["turn left", keys({ steer: -1 }), 1.2],
      ["dive", keys({ tuck: 1, lean: -1 }), 1.5],
      ["flare", keys({ brake: 1, lean: 1 }), 1.2],
    ] as const) {
      const s = gliding(st);
      st.run(s, t, drive);
      st.shoot(s, `${name} · behind`, around(0.3, 1.4, 4.2, 40));
      st.shoot(s, `${name} · side`, around(4.2, 0.2, 0.4, 40));
    }
  },
  // EVERY RUNG of the game's ladder: gliding, under the canopy, stood.
  "chase-glide": (st) => {
    const s = gliding(st);
    for (const r of RUNGS) st.shoot(s, r, r);
  },
  "chase-canopy": (st) => {
    const s = st.fresh();
    ride(st, s, (x) => x.chute?.mode === "open");
    st.run(s, 4, bot);
    for (const r of RUNGS) st.shoot(s, r, r);
  },
  "chase-exit": (st) => {
    const s = st.fresh();
    st.run(s, 0.4, still);
    for (const r of ["chase", "far", "high"] as const) st.shoot(s, r, r);
  },
  // AFTER DARK.
  "night-exit": async (st) => {
    await st.sky({ hour: 21 });
    const s = st.fresh();
    st.run(s, 0.4, still);
    st.shoot(s, "stood", around(3.5, 0.8, 3));
    await st.sky(null);
  },
  "night-glide": async (st) => {
    await st.sky({ hour: 21 });
    const s = gliding(st);
    st.shoot(s, "gliding", "chase");
    st.shoot(s, "side", around(4, 0.6, 1));
    await st.sky(null);
  },
};

/** The sheets, each the views it is shot from. */
export const GROUPS: Record<string, readonly string[]> = {
  suit: ["suit-flying", "suit-slack"],
  flight: ["flight-exit", "flight-pull", "flight-canopy"],
  poses: ["poses"],
  chase: ["chase-glide", "chase-canopy", "chase-exit"],
  night: ["night-exit", "night-glide"],
};
