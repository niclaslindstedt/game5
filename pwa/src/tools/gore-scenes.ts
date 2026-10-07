// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GORE LAB'S SCENES (`gore-harness.ts`): the moments a body is torn
// apart on a run with the INJURIES switch on (`engine/game/gore.ts`, drawn
// by `pwa/src/game/gore-view.ts`), each STAGED on the map by hand — the
// skier stood skiing at a trunk, or his body thrown and posed as the
// injury lab's (`tests/support/injury-stage.ts`) are, onto the snow, into
// a trunk, down onto a tree's top or a post's — then stepped on the engine
// and photographed through the game's own renderer, frame by frame from a
// lens planted where it happens. Nothing reads a wall clock, so a seed's
// sheet is the same sheet twice.

import {
  NEUTRAL_INPUT,
  RAGDOLL,
  TUNING,
  bodyThrown,
  botInput,
  centreOf,
  letGo,
  placeRun,
  solidsOf,
  treesNear,
  type GameState,
  type Level,
  type SkierInput,
  type SkyOverride,
} from "@engine";
import { fromAxisAngle, multiply, type Quat } from "@niclaslindstedt/oss-game-framework/core/quat";

import type { LensPose } from "../game/camera-rigs.ts";
import type { CameraRung } from "../game/renderer-api.ts";

export type Lens = CameraRung | LensPose | ((state: GameState) => LensPose);
export type Drive = (state: GameState) => SkierInput;

export type Stage = {
  level: Level;
  /** A free ride with the injuries on — the grimbear hunting, if asked. */
  fresh(grimbear?: boolean): GameState;
  run(state: GameState, seconds: number, drive?: Drive): void;
  until(state: GameState, test: (s: GameState) => boolean, limit: number, drive?: Drive): boolean;
  shoot(state: GameState, label: string, lens?: Lens): void;
  sky(over: SkyOverride | null): Promise<void>;
};

type P3 = { x: number; y: number; z: number };

const still: Drive = () => NEUTRAL_INPUT;
const bot: Drive = (s) => botInput(s);
const R = RAGDOLL;

/** How his body meets it (the injury lab's poses, heading +z). */
type Pose = "head" | "face" | "back" | "left" | "feet" | "front";

function poseOf(pose: Pose, into: boolean): Quat {
  const unlean = fromAxisAngle(1, 0, 0, -0.4);
  const tip = (a: number) => fromAxisAngle(1, 0, 0, a);
  if (into) {
    if (pose === "head") return multiply(tip(Math.PI / 2), unlean);
    return unlean;
  }
  switch (pose) {
    case "head":
      return multiply(tip(Math.PI), unlean);
    case "face":
      return multiply(tip(Math.PI / 2), unlean);
    case "back":
      return multiply(tip(-Math.PI / 2), unlean);
    case "left":
      return multiply(fromAxisAngle(0, 0, 1, Math.PI / 2), unlean);
    default:
      return unlean;
  }
}

/** A point's radius on the ragdoll. */
function radius(i: number): number {
  const B = TUNING.crash.body;
  return i === R.head ? B.head : i <= R.shoulderR ? TUNING.crash.radius : B.limb;
}

/** A spot on the piste past its first stretch, where the ground is the
 * flattest — the snow a fall is staged on. */
function flatSpot(level: Level): { x: number; z: number; heading: number } {
  let best = level.track.points[0];
  let flat = -1;
  const n = { x: 0, y: 1, z: 0 };
  for (const p of level.track.points) {
    if (p.s < 80 || p.s > level.track.length - 120) continue;
    level.normalAt(p.x, p.z, n);
    if (n.y > flat) {
      flat = n.y;
      best = p;
    }
  }
  return best;
}

/** The kinds whose trunk stands bare under a high crown — a body met on
 * one is seen, not swallowed by a spruce's skirt of boughs to the snow. */
const BARE = new Set(["pine", "larch", "lodgepole", "snag", "whitepine"]);

/** A tree standing alone on gentle ground near the piste, at least `tall`
 * m tall — the one a scene throws him at or onto; a `bare` one's trunk is
 * clear under its crown. */
function loneTree(
  level: Level,
  tall = 0,
  bare = false,
): { x: number; z: number; y: number; height: number; radius: number } {
  const near: number[] = [];
  const n = { x: 0, y: 1, z: 0 };
  let best = level.trees[0];
  let score = -Infinity;
  for (const t of level.trees) {
    if (t.height < tall) continue;
    level.normalAt(t.x, t.z, n);
    const crowd = treesNear(level, t.x, t.z, 4, near).length;
    const s = n.y * 10 - crowd * 3 + (bare && BARE.has(t.kind ?? "spruce") ? 20 : 0);
    if (s > score) {
      score = s;
      best = t;
    }
  }
  return {
    x: best.x,
    z: best.z,
    y: level.groundAt(best.x, best.z),
    height: best.height,
    radius: best.radius,
  };
}

/** Throw the body: posed `pose` heading `heading`, going `v`, its lowest
 * point `lift` m over `floor`, its hips over (x, z). */
function throwAt(
  s: GameState,
  x: number,
  z: number,
  heading: number,
  pose: Pose,
  v: P3,
  floor: number,
  lift: number,
  into = false,
): void {
  placeRun(s, { x, z, heading, speed: 0 });
  const q = multiply(fromAxisAngle(0, 1, 0, heading), poseOf(pose, into));
  const b = bodyThrown(
    into ? "tree" : "landing",
    q,
    x,
    floor + 3,
    z,
    v,
    { x: 0, y: 0, z: 0 },
    heading,
  );
  const P = b.points;
  const L = b.last;
  let low = Infinity;
  for (let i = 0; i < R.count; i++) low = Math.min(low, P[3 * i + 1] - radius(i));
  const dy = floor + lift - low;
  const dx = x - (P[3 * R.hipL] + P[3 * R.hipR]) / 2;
  const dz = z - (P[3 * R.hipL + 2] + P[3 * R.hipR + 2]) / 2;
  for (let i = 0; i < R.count; i++) {
    P[3 * i] += dx;
    P[3 * i + 1] += dy;
    P[3 * i + 2] += dz;
    L[3 * i] += dx;
    L[3 * i + 1] += dy;
    L[3 * i + 2] += dz;
  }
  b.x += dx;
  b.y += dy;
  b.z += dz;
  b.skis = letGo(s, s.skier, 1, 0);
  s.skier.thrown = b;
}

/** A lens planted round `at`: `dist` m out at `yaw` (rad, from +z), `up` m
 * over the snow there, aimed `aim` m over `at`. */
function around(
  level: Level,
  at: P3,
  yaw: number,
  dist: number,
  up: number,
  fov = 45,
  aim = 0.4,
): LensPose {
  const ex = at.x + Math.sin(yaw) * dist;
  const ez = at.z + Math.cos(yaw) * dist;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + 0.3, at.y + up), z: ez },
    target: { x: at.x, y: at.y + aim, z: at.z },
    fov,
    roll: 0,
  };
}

/** A lens that follows his body: `dist` m out at `yaw`, `up` m over it. */
function onBody(yaw: number, dist: number, up: number, fov = 45): Lens {
  return (s) => {
    const b = s.skier.thrown;
    const c = b ? centreOf(b.points) : { x: s.skier.x, y: s.skier.y, z: s.skier.z };
    return around(s.level, c, yaw, dist, up, fov, 0);
  };
}

/** Shoot `s` at each of `times`, s after now, from `lens`. */
function strobe(st: Stage, s: GameState, times: number[], lens: Lens, drive = still): void {
  let at = 0;
  for (const t of times) {
    st.run(s, t - at, drive);
    at = t;
    st.shoot(s, `+${t}s`, lens);
  }
}

/** Ski straight at a lone trunk at `speed` m/s from `back` m up the line. */
function skiAtTree(st: Stage, speed: number, back = 7): { s: GameState; tree: P3; side: number } {
  const s = st.fresh();
  const t = loneTree(st.level, 0, true);
  // Coming at it down the fall line: from uphill.
  const n = { x: 0, y: 1, z: 0 };
  st.level.normalAt(t.x, t.z, n);
  const h = Math.hypot(n.x, n.z) > 0.02 ? Math.atan2(n.x, n.z) : 0;
  placeRun(s, { x: t.x - Math.sin(h) * back, z: t.z - Math.cos(h) * back, heading: h, speed });
  return { s, tree: { x: t.x, y: t.y, z: t.z }, side: h + Math.PI / 2 };
}

/** His body flown into a lone trunk, `pose` leading, at `speed` m/s. */
function intoTree(st: Stage, pose: Pose, speed: number): { s: GameState; tree: P3 } {
  const s = st.fresh();
  const t = loneTree(st.level, 0, true);
  const h = 0.6;
  const x = t.x - Math.sin(h) * 2.2;
  const z = t.z - Math.cos(h) * 2.2;
  throwAt(
    s,
    x,
    z,
    h,
    pose,
    { x: Math.sin(h) * speed, y: 0, z: Math.cos(h) * speed },
    st.level.groundAt(x, z),
    0.35,
    true,
  );
  return { s, tree: { x: t.x, y: t.y, z: t.z } };
}

/** His body thrown onto the flat piste, `pose` first, at `speed` m/s down
 * into it, sliding `slide` m/s along it. */
function ontoSnow(st: Stage, pose: Pose, speed: number, slide = 0): { s: GameState; at: P3 } {
  const s = st.fresh();
  const p = flatSpot(st.level);
  const g = st.level.groundAt(p.x, p.z);
  const v = { x: Math.sin(p.heading) * slide, y: -speed, z: Math.cos(p.heading) * slide };
  throwAt(s, p.x, p.z, p.heading, pose, v, g, 0.3);
  return { s, at: { x: p.x, y: g, z: p.z } };
}

/** His body falling `speed` m/s onto the top of `post` (a tree's or a
 * post's), his hips over it. */
function ontoTop(
  st: Stage,
  post: { x: number; z: number; y: number; height: number },
  pose: Pose,
  speed: number,
): GameState {
  const s = st.fresh();
  throwAt(s, post.x, post.z, 0.4, pose, { x: 0, y: -speed, z: 0 }, post.y + post.height, 0.3);
  return s;
}

const seconds = (s: GameState) => s.t;

export const VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  // ── INTO A TRUNK ────────────────────────────────────────────────────────
  /** Skied square into a trunk at 108 km/h: his body stops on it. */
  "ski-trunk"(st) {
    const { s, tree, side } = skiAtTree(st, 30);
    st.shoot(s, "coming", around(st.level, tree, side, 9, 1.8, 50));
    const lens = onBody(side, 6, 1.8, 50);
    st.until(s, (q) => !!q.skier.thrown, 2, still);
    strobe(st, s, [0.02, 0.08, 0.2, 0.45, 1, 2.5, 5], lens);
    st.shoot(s, "chase", "chase");
  },
  /** Flown head first into a trunk at 90 km/h: the head torn off. */
  decapitation(st) {
    const { s, tree } = intoTree(st, "head", 25);
    st.shoot(s, "flying", around(st.level, tree, 0.6 + Math.PI / 2, 8, 1.6, 50, 0.6));
    const lens = onBody(0.6 + Math.PI / 2, 5, 1.5, 50);
    strobe(st, s, [0.03, 0.08, 0.15, 0.3, 0.6, 1.2, 3], lens);
    st.shoot(s, "close", onBody(2.2, 2.2, 1.2, 40));
  },
  // ── ONTO THE SNOW ──────────────────────────────────────────────────────
  /** Thrown flat on his side into the snow at 100 km/h, sliding on: the
   * limbs torn off at the joints and the trunk burst. */
  mangled(st) {
    const { s, at } = ontoSnow(st, "left", 28, 8);
    const lens = around(st.level, at, 1.4, 9, 2.6, 55, 0);
    strobe(st, s, [0.03, 0.1, 0.25, 0.5, 1, 2, 4], lens);
    st.shoot(s, "close", onBody(1.9, 3, 2, 45));
    st.shoot(s, "chase", "chase");
  },
  /** Thrown head first into the snow at 90 km/h: the skull crushed. */
  crush(st) {
    const { s, at } = ontoSnow(st, "head", 25);
    const lens = around(st.level, at, 1.2, 4.5, 1.2, 45, 0.3);
    strobe(st, s, [0.02, 0.06, 0.15, 0.4, 1, 3], lens);
    st.shoot(s, "close", onBody(0.4, 1.6, 0.9, 40));
  },
  /** Fallen on his feet from a height (20 m/s): the legs broken through
   * the skin (open fractures) — the bones out. */
  fracture(st) {
    const { s, at } = ontoSnow(st, "feet", 26);
    const lens = around(st.level, at, 1.0, 5, 1.6, 45, 0.5);
    strobe(st, s, [0.05, 0.3, 1.5], lens);
    st.shoot(s, "legs", onBody(0.3, 1.8, 0.8, 40));
    st.shoot(s, "legs-side", onBody(1.7, 1.8, 0.6, 40));
  },
  // ── RUN THROUGH ────────────────────────────────────────────────────────
  /** Fallen on his back onto a tree's top: run through on it. */
  "spike-tree"(st) {
    const t = loneTree(st.level, 6);
    const s = ontoTop(st, t, "back", 12);
    const top = { x: t.x, y: t.y + t.height, z: t.z };
    const lens = around(st.level, top, 1.2, 5, 0.6, 45, -0.3);
    strobe(st, s, [0.05, 0.2, 0.6, 1.5, 4, 8], lens);
    st.shoot(s, "below", around(st.level, top, 2.4, 7, -3, 50, -0.4));
    st.shoot(s, "chase", "chase");
  },
  /** Fallen onto a post's top — a mast's or a snow gun's lance: through. */
  "spike-post"(st) {
    const post = solidsOf(st.level).find(
      (u) => u.stuff === "steel" && u.radius <= 0.16 && u.height < 20,
    );
    const s = st.fresh();
    if (!post) {
      st.shoot(s, "no-post-on-this-map", "chase");
      return;
    }
    const q = ontoTop(st, post, "face", 11);
    const top = { x: post.x, y: post.y + post.height, z: post.z };
    const lens = around(st.level, top, 2, 5, 0.5, 45, -0.3);
    strobe(st, q, [0.05, 0.3, 1, 3, 6], lens);
  },
  // ── THE BEAST ──────────────────────────────────────────────────────────
  /** The grimbear's catch on an injuries run: torn in two. */
  maul(st) {
    const s = st.fresh(true);
    s.grimbear!.rng.chance = () => false;
    const pts = st.level.track.points;
    let from = pts[0];
    const near: number[] = [];
    for (const p of pts) {
      if (p.s > 150 && treesNear(st.level, p.x, p.z, 25, near).length >= 4) {
        from = pts.find((q) => q.s >= p.s - 90) ?? pts[0];
        break;
      }
    }
    placeRun(s, { x: from.x, z: from.z, heading: from.heading, speed: 14 });
    s.grimbear!.wait = 0;
    if (!st.until(s, (q) => q.grimbear?.phase === "maul", 60, bot)) {
      st.shoot(s, "no-catch", "chase");
      return;
    }
    const c = { x: s.skier.x, y: s.skier.y, z: s.skier.z };
    const lens = around(st.level, c, s.grimbear!.heading + Math.PI / 2, 4.5, 1.6, 50, 0.4);
    strobe(st, s, [0.1, 0.3, 0.6, 1, 2, 4, 7], lens);
    // The two halves where they lie: the trunk and the hips apart.
    st.shoot(s, "close", onBody(0.9, 2.6, 1.6, 45));
    st.shoot(s, "above", onBody(0.2, 1.2, 3.4, 50));
  },
  // ── THE BLOOD ──────────────────────────────────────────────────────────
  /** The spurt on the heartbeat: a stump close, frame by frame over two
   * beats. */
  spray(st) {
    const { s } = ontoSnow(st, "left", 28, 2);
    st.until(s, (q) => (q.gore?.lost ?? 0) !== 0, 1, still);
    st.run(s, 0.4, still);
    const lens = onBody(1.9, 2.4, 1.1, 45);
    const t0 = seconds(s);
    const times = [0, 0.06, 0.12, 0.18, 0.24, 0.3, 0.36, 0.42, 0.48];
    let at = 0;
    for (const t of times) {
      st.run(s, t - at, still);
      at = t;
      st.shoot(
        s,
        `beat+${(seconds(s) - t0).toFixed(2)}s pulse ${(s.gore?.pulse ?? 0).toFixed(2)}`,
        lens,
      );
    }
  },
  /** The snow red under him: pooled, splashed and smeared, from above. */
  snow(st) {
    const { s, at } = ontoSnow(st, "left", 28, 10);
    st.run(s, 3, still);
    st.shoot(s, "3s", onBody(1.4, 4, 2.5, 50));
    st.run(s, 4, still);
    st.shoot(s, "7s-above", around(st.level, at, 1.0, 1.5, 9, 55, 0));
    st.shoot(s, "7s", onBody(2.5, 4.5, 2.2, 50));
    st.shoot(s, "7s-far", "far");
  },
  // ── THE HUD ────────────────────────────────────────────────────────────
  /** A fatal crash with the HUD over it: skiing, the blow's jolt, the glass
   * cracked, the readouts falling off it, DIED and the dark. */
  wreck(st) {
    const { s, tree, side } = skiAtTree(st, 30, 14);
    const lens = onBody(side + 0.5, 6, 2, 50);
    st.shoot(s, "skiing", "chase");
    st.until(s, (q) => !!q.skier.thrown, 2, still);
    st.run(s, 0.05, still);
    st.shoot(s, "the-blow", lens);
    void tree;
    st.until(s, (q) => (q.gore?.dead ?? -1) >= 0, 8, still);
    const dead = s.gore!.dead;
    for (const t of [0.15, 0.6, 1.3, 2, 3, 4.2]) {
      st.until(s, (q) => q.t - dead >= t, 8, still);
      st.shoot(s, `died+${t}s`, lens);
    }
  },
  /** Up close at the wounds and what was thrown out. */
  closeup(st) {
    const { s } = ontoSnow(st, "left", 28, 6);
    st.run(s, 2.5, still);
    for (let i = 0; i < 6; i++) {
      const yaw = (i / 6) * Math.PI * 2;
      st.shoot(s, `${i * 60}deg`, onBody(yaw, 1.8, 0.9, 42));
    }
  },
};

/** The sheets drawn with the HUD over every frame (`gore-hud.tsx`). */
export const HUD_GROUPS = new Set(["hud"]);

export const GROUPS: Record<string, readonly string[]> = {
  trunk: ["ski-trunk", "decapitation"],
  snow: ["mangled", "crush", "fracture"],
  spike: ["spike-tree", "spike-post"],
  maul: ["maul"],
  blood: ["spray", "snow"],
  close: ["closeup"],
  hud: ["wreck"],
};
