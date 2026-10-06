// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRIMBEAR LAB'S SCENES (`grimbear-harness.ts`): the beast a free ride
// meets now and then (`engine/game/grimbear.ts`, drawn by
// `pwa/src/game/grimbear-view.ts`) at every moment he has, photographed
// through the game's own renderer. Two kinds of scene:
//
//   * POSED — the beast stood by hand where a frame wants him (`pose`): his
//     phase, his stride, his speed, the seconds into it; nothing stepped, so
//     the figure is judged alone — the turntable, the run and the walk
//     strobed across one stride, each move from a quarter;
//   * RIDDEN — a free ride the beast hunts, stepped on the engine with the
//     bot skiing down the piste through the woods (`ride`): the ambush from
//     the skier's own chase lens and from beside, the catch and THE KILL
//     frame by frame from a lens planted where it happens, the death cam,
//     the stand-up at the top, and a chase after the catch that comes up
//     short. Nothing reads a wall clock, so a seed's sheet is the same sheet
//     twice.

import {
  NEUTRAL_INPUT,
  botInput,
  placeRun,
  treesNear,
  type GameState,
  type GrimbearPhase,
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
  /** A free ride on the map the beast hunts (`hunt`) or only chases. */
  fresh(ask: "hunt" | "roam"): GameState;
  run(state: GameState, seconds: number, drive?: Drive): void;
  until(state: GameState, test: (s: GameState) => boolean, limit: number, drive?: Drive): boolean;
  shoot(state: GameState, label: string, lens?: Lens): void;
  sky(over: SkyOverride | null): Promise<void>;
};

const still: Drive = () => NEUTRAL_INPUT;
const bot: Drive = (s) => botInput(s);

/** THE WOODS the ridden scenes start above: the first point of the piste,
 * past its first 150 m, with a wood of trunks within 25 m of it. */
function woodsOf(level: Level): { x: number; z: number; heading: number; s: number } {
  const near: number[] = [];
  const pts = level.track.points;
  for (let i = 0; i < pts.length; i += 5) {
    const p = pts[i];
    if (p.s < 150) continue;
    if (treesNear(level, p.x, p.z, 25, near).length >= 4) return p;
  }
  return pts[Math.floor(pts.length / 2)];
}

/** A ride the beast hunts or chases, the skier stood 90 m up the piste from
 * the woods at a skier's pace and the beast set to lie in wait at once. */
function ambush(st: Stage, ask: "hunt" | "roam"): GameState {
  const s = st.fresh(ask);
  const wood = woodsOf(st.level);
  const pts = st.level.track.points;
  const from = pts.find((p) => p.s >= wood.s - 90) ?? pts[0];
  placeRun(s, { x: from.x, z: from.z, heading: from.heading, speed: 14 });
  s.grimbear!.wait = 0;
  return s;
}

const isPhase =
  (phase: GrimbearPhase, after = 0) =>
  (s: GameState) =>
    s.grimbear?.phase === phase && s.grimbear.t >= after;

/** A lens planted off the BEAST: `right` m to the screen's right of the way
 * he faces, `up` m over his snow, `back` m behind him, aimed `over` m up. */
function aroundBeast(right: number, up: number, back: number, fov = 45, over = 1.1): Lens {
  return (state) => {
    const b = state.grimbear!;
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const ex = b.x - fz * right - fx * back;
    const ez = b.z + fx * right - fz * back;
    const g = state.level.groundAt;
    return {
      eye: { x: ex, y: Math.max(g(ex, ez) + 0.4, g(b.x, b.z) + up), z: ez },
      target: { x: b.x, y: g(b.x, b.z) + over, z: b.z },
      fov,
      roll: 0,
    };
  };
}

/** A lens planted ONCE, square to the line from the beast to the skier,
 * `off` m out on the beast's side and `up` m up — every frame of a sequence
 * shot from it, so what moves is what moved. */
function plantedSide(state: GameState, off: number, up: number, fov = 50): LensPose {
  const b = state.grimbear!;
  const c = state.skier;
  const mx = (b.x + c.x) / 2;
  const mz = (b.z + c.z) / 2;
  const dx = c.x - b.x;
  const dz = c.z - b.z;
  const d = Math.max(0.1, Math.hypot(dx, dz));
  // Square to the line, on the side the beast came from (away from the
  // piste the skier skis).
  let nx = -dz / d;
  let nz = dx / d;
  if (nx * (b.x - c.x) + nz * (b.z - c.z) < 0) {
    nx = -nx;
    nz = -nz;
  }
  const ex = mx + nx * off;
  const ez = mz + nz * off;
  const g = state.level.groundAt;
  return {
    eye: { x: ex, y: Math.max(g(ex, ez), g(mx, mz)) + up, z: ez },
    target: { x: mx, y: g(mx, mz) + 1, z: mz },
    fov,
    roll: 0,
  };
}

/** The beast stood by hand in a free ride on a flat-ish open spot of the
 * piste, the skier stood 3 m off for scale, nothing stepped. */
function posed(st: Stage): GameState {
  const s = st.fresh("roam");
  const pts = st.level.track.points;
  const p = pts.find((q) => q.s >= 60) ?? pts[0];
  // The skier beside him, side on to the lens, for his size.
  const rx = Math.cos(p.heading);
  const rz = -Math.sin(p.heading);
  placeRun(s, { x: p.x - rx * 2.6, z: p.z - rz * 2.6, heading: p.heading + Math.PI / 2 });
  st.run(s, 0.3, still);
  Object.assign(s.grimbear!, { x: p.x, z: p.z, heading: p.heading + Math.PI / 2 });
  return s;
}

function pose(
  s: GameState,
  phase: GrimbearPhase,
  o: { stride?: number; speed?: number; t?: number; heading?: number } = {},
): void {
  const b = s.grimbear!;
  b.phase = phase;
  b.stride = o.stride ?? 0;
  b.speed = o.speed ?? 0;
  b.t = o.t ?? 1;
  if (o.heading !== undefined) b.heading = o.heading;
}

export const VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  // ── THE FIGURE ALONE ───────────────────────────────────────────────────
  turntable(st) {
    const s = posed(st);
    pose(s, "leave");
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      st.shoot(s, `${i * 45}deg`, aroundBeast(Math.sin(a) * 5, 1.5, -Math.cos(a) * 5, 40, 1.1));
    }
  },
  /** Up close: the face, and every joint bent as far as a move bends it. */
  closeup(st) {
    const s = posed(st);
    const face = aroundBeast(0, 1.95, -1.9, 32, 1.8);
    pose(s, "leave");
    st.shoot(s, "face", face);
    pose(s, "halt", { t: 0.6 });
    st.shoot(s, "face-roar", aroundBeast(-1, 2.0, -1.7, 34, 1.85));
    pose(s, "run", { stride: 0.9, speed: 11 });
    st.shoot(s, "run-side", aroundBeast(-3.2, 1.3, 0, 40, 1.1));
    st.shoot(s, "run-behind", aroundBeast(-1.6, 1.6, 2.8, 42, 1.1));
    pose(s, "lurk", { t: 2 });
    st.shoot(s, "crouch-side", aroundBeast(-3, 1.1, -0.6, 40, 0.9));
    pose(s, "maul", { t: 0.3 });
    st.shoot(s, "arms-up", aroundBeast(-2.6, 1.6, -2, 44, 1.6));
  },
  stride(st) {
    const s = posed(st);
    for (let i = 0; i < 8; i++) {
      pose(s, "run", { stride: (i / 8) * 3.4, speed: 10 });
      st.shoot(s, `run-${i}of8`, aroundBeast(-5, 1.2, 0, 40));
    }
  },
  walk(st) {
    const s = posed(st);
    for (let i = 0; i < 6; i++) {
      pose(s, "leave", { stride: (i / 6) * 1.6, speed: 1.6 });
      st.shoot(s, `walk-${i}of6`, aroundBeast(-5, 1.2, 0, 40));
    }
  },
  moves(st) {
    const s = posed(st);
    const quarter = aroundBeast(-4, 1.4, -3.5, 45);
    pose(s, "lurk", { t: 2 });
    st.shoot(s, "lurk", quarter);
    pose(s, "run", { stride: 0.9, speed: 11 });
    st.shoot(s, "run", quarter);
    pose(s, "halt", { t: 0.6 });
    st.shoot(s, "halt-roar", quarter);
    pose(s, "maul", { t: 0.3 });
    st.shoot(s, "maul", quarter);
    pose(s, "maul", { t: 0.65 });
    st.shoot(s, "maul-blow", quarter);
    pose(s, "leave", { stride: 0.5, speed: 1.6 });
    st.shoot(s, "leave", quarter);
  },
  // ── THE AMBUSH, RIDDEN ─────────────────────────────────────────────────
  ambush(st) {
    const s = ambush(st, "hunt");
    if (!st.until(s, isPhase("lurk", 0.3), 30, bot)) return;
    st.shoot(s, "unseen", "chase");
    st.shoot(s, "behind-his-trunk", aroundBeast(6, 1.8, 2.5, 45));
    if (!st.until(s, isPhase("run", 0.25), 30, bot)) return;
    st.shoot(s, "out-of-the-trees", "chase");
    st.shoot(s, "out-side", aroundBeast(-6, 1.6, 0, 50));
    st.run(s, 0.6, bot);
    st.shoot(s, "coming", "chase");
    st.until(s, (q) => q.grimbear!.phase !== "run" || hypot(q) < 5, 10, bot);
    st.shoot(s, "on-him", "chase");
  },
  // ── THE KILL, FRAME BY FRAME ───────────────────────────────────────────
  kill(st) {
    const s = ambush(st, "hunt");
    if (!st.until(s, isPhase("run"), 60, bot)) return;
    st.until(s, (q) => q.grimbear!.phase !== "run" || hypot(q) < 4, 10, bot);
    const lens = plantedSide(s, 11, 2.2);
    st.shoot(s, "reach", lens);
    st.until(s, isPhase("maul"), 3, bot);
    let at = 0;
    for (const t of [0.08, 0.25, 0.5, 1, 1.8, 3, 4.5, 6.5, 8.5]) {
      st.run(s, t - at, still);
      at = t;
      st.shoot(s, `+${t}s`, lens);
    }
  },
  "kill-cam"(st) {
    // The same kill as the player sees it: the game's chase rung, which
    // the death cam (`camera-death.ts`) takes over while he is down.
    const s = ambush(st, "hunt");
    if (!st.until(s, isPhase("run"), 60, bot)) return;
    st.until(s, isPhase("maul"), 12, bot);
    let at = 0;
    for (const t of [0.15, 0.6, 1.5, 3, 5, 8]) {
      st.run(s, t - at, still);
      at = t;
      st.shoot(s, `+${t}s`, "chase");
    }
    st.until(s, (q) => !q.skier.thrown, 6, still);
    st.run(s, 0.4, still);
    st.shoot(s, "stood-up-at-the-top", "chase");
  },
  // ── AFTER THE CATCH: THE CHASE THAT COMES UP SHORT ─────────────────────
  chase(st) {
    const s = ambush(st, "roam");
    if (!st.until(s, isPhase("run", 0.4), 60, bot)) return;
    st.shoot(s, "out-of-the-trees", "chase");
    st.shoot(s, "running-after", aroundBeast(-6, 1.6, 0, 50));
    st.run(s, 1.2, bot);
    st.shoot(s, "falling-behind", "chase");
    st.shoot(s, "falling-behind-far", "far");
    if (!st.until(s, isPhase("halt", 0.5), 8, bot)) return;
    st.shoot(s, "pulled-up-roaring", aroundBeast(-4, 1.4, -4, 45));
  },
  // ── AFTER DARK ─────────────────────────────────────────────────────────
  async night(st) {
    await st.sky({ hour: 21 });
    const s = ambush(st, "hunt");
    if (st.until(s, isPhase("lurk", 0.3), 30, bot)) {
      st.shoot(s, "eyes-behind-his-trunk", aroundBeast(6, 1.8, 2.5, 45));
    }
    if (st.until(s, isPhase("run", 0.3), 30, bot)) st.shoot(s, "in-the-headlamp", "chase");
    await st.sky(null);
  },
};

/** How far the beast is from the skier, m. */
function hypot(s: GameState): number {
  const b = s.grimbear!;
  return Math.hypot(b.x - s.skier.x, b.z - s.skier.z);
}

export const GROUPS: Record<string, readonly string[]> = {
  figure: ["turntable", "closeup"],
  gait: ["stride", "walk"],
  moves: ["moves"],
  ambush: ["ambush"],
  kill: ["kill", "kill-cam"],
  chase: ["chase"],
  night: ["night"],
};
