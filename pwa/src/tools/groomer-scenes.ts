// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINE LAB'S SCENES (`groomer-harness.ts`): the night's
// groomers (`engine/game/groomer.ts`, drawn by `pwa/src/game/groomer-view.ts`
// and `groomer-scene.ts`) photographed through the game's own renderer:
//
//   * POSED — a machine stopped where it works, the skier stood beside it
//     for its size: the figure from eight sides and up close;
//   * WORKING — the machines stepped on the engine at their lanes, the
//     swath they lay behind them and the day's skied-up piste ahead, by
//     day, after dark with every lamp lit, and in the fall and the storm;
//   * DRIVEN — the skier stood beside one, the machine press given, and
//     the machine driven up the run on the game's own camera ladder;
//   * STRUCK — the skier skied into its blade, frame by frame from a lens
//     planted square to it, and as the death cam shows it.
//
// Nothing reads a wall clock, so a seed's sheet is the same sheet twice.

import {
  NEUTRAL_INPUT,
  placeRun,
  severityOf,
  type GameState,
  type GroomerState,
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
  /** A free ride on the map with the machines out, whatever the hour. */
  fresh(): GameState;
  run(state: GameState, seconds: number, drive?: Drive): void;
  until(state: GameState, test: (s: GameState) => boolean, limit: number, drive?: Drive): boolean;
  shoot(state: GameState, label: string, lens?: Lens): void;
  sky(over: SkyOverride | null): Promise<void>;
};

const still: Drive = () => NEUTRAL_INPUT;

/** The machine a scene is about: the first one out. */
const first = (s: GameState): GroomerState => s.groomers![0];

/** A lens planted off the MACHINE: `right` m to the right of the way it
 * faces, `back` m behind its middle, `up` m over its snow, aimed `over` m
 * up at a point `ahead` m forward of its middle. */
function around(right: number, up: number, back: number, fov = 45, over = 1.6, ahead = 0): Lens {
  return (state) => {
    const g = first(state);
    const fx = Math.sin(g.heading);
    const fz = Math.cos(g.heading);
    const ex = g.x + fz * right - fx * back;
    const ez = g.z - fx * right - fz * back;
    const ground = state.level.groundAt;
    const tx = g.x + fx * ahead;
    const tz = g.z + fz * ahead;
    return {
      eye: { x: ex, y: Math.max(ground(ex, ez) + 0.5, g.y + up), z: ez },
      target: { x: tx, y: ground(tx, tz) + over, z: tz },
      fov,
      roll: 0,
    };
  };
}

/** A lens fixed where `lens` stands now — every frame of a sequence shot
 * from it, so what moves is what moved. */
function planted(state: GameState, lens: Lens): LensPose {
  return typeof lens === "function" ? lens(state) : (lens as LensPose);
}

/** A ride with the machines out, the first one stopped where it works. */
function parked(st: Stage): GameState {
  const s = st.fresh();
  const g = first(s);
  g.mode = "parked";
  g.speed = 0;
  // The skier beside its cab, side on, for its size.
  const rx = Math.cos(g.heading);
  const rz = -Math.sin(g.heading);
  placeRun(s, { x: g.x - rx * 4.6, z: g.z - rz * 4.6, heading: g.heading });
  st.run(s, 0.3, still);
  return s;
}

/** A ride with the machines working: stepped `seconds` on from the start
 * so the swath behind the first is fresh, the skier stood well clear. */
function working(st: Stage, seconds: number): GameState {
  const s = st.fresh();
  const g = first(s);
  const rx = Math.cos(g.heading);
  const rz = -Math.sin(g.heading);
  placeRun(s, { x: g.x - rx * 150, z: g.z - rz * 150, heading: g.heading });
  st.run(s, seconds, still);
  return s;
}

/** The working views: from ahead of the blade, the quarter, behind over
 * the tiller and its swath, and high over the run. */
function workViews(st: Stage, s: GameState, tag: string): void {
  st.shoot(s, `${tag}-ahead`, around(-3, 2.2, -32, 42, 1.6));
  st.shoot(s, `${tag}-quarter`, around(-11, 3.2, -11, 48, 1.4));
  st.shoot(s, `${tag}-behind`, around(4, 5, 20, 50, 0.6, 2));
  st.shoot(s, `${tag}-above`, around(-14, 34, 26, 50, 0, -6));
}

/** The machine press: given on one engine step, as the app gives it. */
function press(): Drive {
  let given = false;
  return () => {
    if (given) return NEUTRAL_INPUT;
    given = true;
    return { ...NEUTRAL_INPUT, machine: true };
  };
}
const forward =
  (steer = 0): Drive =>
  () => ({ ...NEUTRAL_INPUT, tuck: 1, steer });

export const VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  // ── THE FIGURE ─────────────────────────────────────────────────────────
  async turntable(st) {
    await st.sky({ hour: 13, weather: "clear" });
    const s = parked(st);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      st.shoot(s, `${i * 45}deg`, around(Math.sin(a) * 15, 3.5, -Math.cos(a) * 15, 42, 1.6));
    }
    await st.sky(null);
  },
  async closeup(st) {
    await st.sky({ hour: 13, weather: "clear" });
    const s = parked(st);
    st.shoot(s, "blade", around(-3.5, 1.4, -8.5, 44, 1.0, 3));
    st.shoot(s, "cab", around(-5, 3.4, -4, 44, 2.6, 0.6));
    st.shoot(s, "tracks", around(-6.5, 0.9, 0, 50, 0.7));
    st.shoot(s, "tiller", around(4, 2.2, 10.5, 46, 0.7, -4));
    st.shoot(s, "roof", around(-2, 6.5, -5, 48, 2.8));
    st.shoot(s, "low", around(-7, 0.4, -9, 50, 2.0));
    await st.sky(null);
  },
  // ── WORKING ────────────────────────────────────────────────────────────
  async day(st) {
    await st.sky({ hour: 15, weather: "clear" });
    const s = working(st, 12);
    workViews(st, s, "day");
    // Along the swath's edge: its corduroy to one side, the day's piste to
    // the other.
    st.shoot(s, "day-swath-edge", around(2.6, 1.4, 18, 55, 0.2, -6));
    await st.sky(null);
  },
  async dusk(st) {
    await st.sky({ hour: 17.6 });
    workViews(st, working(st, 12), "dusk");
    await st.sky(null);
  },
  async night(st) {
    await st.sky({ hour: 21 });
    const s = working(st, 12);
    workViews(st, s, "night");
    st.shoot(s, "night-low", around(-6, 0.6, -18, 55, 2.4));
    st.shoot(s, "night-wide", around(-30, 8, -40, 50, 1));
    st.shoot(s, "night-close", around(-6, 2.6, -9, 46, 1.8, 1));
    st.shoot(s, "night-rear", around(5, 2.8, 12, 46, 1.4, -2));
    st.shoot(s, "night-chase", "chase");
    await st.sky(null);
  },
  async snow(st) {
    await st.sky({ hour: 21, weather: "snow" });
    workViews(st, working(st, 12), "snow");
    await st.sky(null);
  },
  async storm(st) {
    await st.sky({ hour: 21, weather: "storm" });
    const s = working(st, 12);
    st.shoot(s, "storm-ahead", around(-3, 2.2, -26, 46, 1.6));
    st.shoot(s, "storm-quarter", around(-10, 3, -10, 50, 1.4));
    st.shoot(s, "storm-behind", around(4, 5, 18, 52, 0.6, 2));
    await st.sky(null);
  },
  // ── GROOMING, FROM THE SKIER'S CHASE ───────────────────────────────────
  async groom(st) {
    await st.sky({ hour: 20 });
    const s = working(st, 30);
    const g = first(s);
    // The skier on the swath it laid, behind the tiller, coming down its
    // lane after it.
    const fx = Math.sin(g.heading);
    const fz = Math.cos(g.heading);
    const back = g.dir > 0 ? -1 : 1;
    placeRun(s, { x: g.x - fx * 26, z: g.z - fz * 26, heading: g.heading, speed: 4 });
    st.run(s, 0.4, still);
    st.shoot(s, "chase", "chase");
    st.shoot(s, "far", "far");
    st.shoot(s, "high", "high");
    st.shoot(s, "swath-edge", around(-8, 1.6, 22, 50, 0, 10 * back));
    st.shoot(s, "corduroy-down", around(0.5, 7, 16, 60, 0, -8));
    await st.sky(null);
  },
  // ── THE HIJACK ─────────────────────────────────────────────────────────
  async ride(st) {
    await st.sky({ hour: 21 });
    const s = parked(st);
    st.shoot(s, "beside-it", "chase");
    st.run(s, 1 / 60, press());
    st.run(s, 0.5, still);
    st.shoot(s, "in-the-cab", "chase");
    st.run(s, 4, forward());
    st.shoot(s, "chase", "chase");
    st.shoot(s, "cab", "helmet");
    st.shoot(s, "blade", "tips");
    st.run(s, 3, forward(0.7));
    st.shoot(s, "turning-far", "far");
    st.shoot(s, "turning-high", "high");
    st.run(s, 1 / 60, press());
    st.run(s, 0.6, still);
    st.shoot(s, "hopped-off", "chase");
    await st.sky(null);
  },
  // ── STRUCK ─────────────────────────────────────────────────────────────
  async strike(st) {
    await st.sky({ hour: 21 });
    const s = parked(st);
    const g = first(s);
    const fx = Math.sin(g.heading);
    const fz = Math.cos(g.heading);
    // Twenty metres ahead of its blade, skiing straight at it.
    placeRun(s, { x: g.x + fx * 26, z: g.z + fz * 26, heading: g.heading + Math.PI, speed: 13 });
    const lens = planted(s, around(-14, 2.2, -12, 50, 1.2, 4));
    st.shoot(s, "coming", "chase");
    st.until(s, (q) => q.skier.thrown !== null, 4, still);
    st.shoot(s, "struck", lens);
    let at = 0;
    for (const t of [0.15, 0.4, 0.8, 1.5, 3]) {
      st.run(s, t - at, still);
      at = t;
      st.shoot(s, `+${t}s`, lens);
    }
    // The death cam as the player has it: flown a moment on its own first.
    st.run(s, 1.2, still);
    st.shoot(s, "death-cam", "chase");
    await st.sky(null);
  },
};

/** What the frame shows, as a caption. */
export function stateLine(s: GameState): string {
  const c = s.skier;
  const skier = c.thrown
    ? `thrown (${c.thrown.cause}, ${c.thrown.t.toFixed(1)} s) ISS ${severityOf(c.body)}`
    : `on snow ${(c.speed * 3.6).toFixed(0)} km/h`;
  const g = s.groomers?.[0];
  if (!g) return skier;
  return `${g.mode} lane ${g.lane + 1}/${g.lanes} ${g.speed.toFixed(1)} m/s ${g.tiller ? "tiller down" : ""}\nskier ${skier} · t ${s.t.toFixed(1)} s`;
}

export const GROUPS: Record<string, readonly string[]> = {
  figure: ["turntable", "closeup"],
  day: ["day", "dusk"],
  night: ["night"],
  snow: ["snow", "storm"],
  groom: ["groom"],
  ride: ["ride"],
  strike: ["strike"],
};
