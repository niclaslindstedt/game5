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
  HELI,
  NEUTRAL_INPUT,
  RAGDOLL,
  TUNING,
  bodyThrown,
  botInput,
  centreOf,
  heliPoint,
  letGo,
  pilotInput,
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

export type Fresh = boolean | { grimbear?: boolean; groomer?: boolean; heli?: boolean };
export type Lens = CameraRung | LensPose | ((state: GameState) => LensPose);
export type Drive = (state: GameState) => SkierInput;

export type Stage = {
  level: Level;
  /** A free ride with the injuries on — the grimbear hunting, the piste
   * machines out or the skier on the helicopter's skid, if asked. */
  fresh(ask?: Fresh): GameState;
  run(state: GameState, seconds: number, drive?: Drive): void;
  until(state: GameState, test: (s: GameState) => boolean, limit: number, drive?: Drive): boolean;
  shoot(state: GameState, label: string, lens?: Lens): void;
  sky(over: SkyOverride | null): Promise<void>;
  /** Every body left lying gone. */
  clearBodies(): void;
};

type P3 = { x: number; y: number; z: number };

const still: Drive = () => NEUTRAL_INPUT;
const bot: Drive = (s) => botInput(s);
const R = RAGDOLL;

/** How his body meets it (the injury lab's poses, heading +z). */
export type Pose = "head" | "face" | "back" | "left" | "feet" | "front";

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
export function flatSpot(level: Level): { x: number; z: number; heading: number } {
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

/** A spot in the loose snow off the piste, beside its flattest stretch,
 * where nothing was groomed — the snow a fall into the powder is staged on. */
function looseSpot(level: Level): { x: number; z: number; heading: number } {
  const n = { x: 0, y: 1, z: 0 };
  let best = { x: 0, z: 0, heading: 0 };
  let score = -Infinity;
  for (const p of level.track.points) {
    if (p.s < 80 || p.s > level.track.length - 120) continue;
    for (const side of [-1, 1]) {
      const d = p.width / 2 + 14;
      const x = p.x + Math.cos(p.heading) * d * side;
      const z = p.z - Math.sin(p.heading) * d * side;
      if (level.packedAt(x, z) > 0.1 || treesNear(level, x, z, 5, []).length > 0) continue;
      level.normalAt(x, z, n);
      if (n.y > score) {
        score = n.y;
        best = { x, z, heading: p.heading };
      }
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
export function loneTree(
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
export function throwAt(
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

/** A lens on a helicopter's hub: `dist` m out at `yaw` (world), `up` m
 * over it. */
function onHeli(yaw: number, dist: number, up: number, fov = 50): Lens {
  return (s) => {
    const h = s.heli!;
    const hub = heliPoint(h, { x: 0, y: HELI.rotor.hub - 1, z: HELI.rotor.at });
    const ex = hub.x + Math.sin(yaw) * dist;
    const ez = hub.z + Math.cos(yaw) * dist;
    return { eye: { x: ex, y: hub.y + up, z: ez }, target: hub, fov, roll: 0 };
  };
}

/** The helicopter looped forward over the top, the collective held. */
const loop: Drive = () => ({
  ...NEUTRAL_INPUT,
  heli: { collective: 0.8, pitch: -1, roll: 0, pedal: 0 },
});

/** A free ride on the helicopter's skid, flown 150 m up and looped until
 * his grip gives out over the rotor — stood at the step it goes. */
function rotorRun(st: Stage): GameState | null {
  const s = st.fresh({ heli: true });
  const aim = { x: s.heli!.x, z: s.heli!.z, height: 150 };
  st.run(s, 30, (q) => pilotInput(q, aim));
  if (!st.until(s, (q) => !q.heli?.rider, 12, loop)) {
    st.shoot(s, "held-on", "chase");
    return null;
  }
  return s;
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
export function skiAtTree(
  st: Stage,
  speed: number,
  back = 7,
): { s: GameState; tree: P3; side: number } {
  const s = st.fresh();
  const t = loneTree(st.level, 0, true);
  // Coming at it down the fall line: from uphill.
  const n = { x: 0, y: 1, z: 0 };
  st.level.normalAt(t.x, t.z, n);
  const h = Math.hypot(n.x, n.z) > 0.02 ? Math.atan2(n.x, n.z) : 0;
  placeRun(s, { x: t.x - Math.sin(h) * back, z: t.z - Math.cos(h) * back, heading: h, speed });
  return { s, tree: { x: t.x, y: t.y, z: t.z }, side: h + Math.PI / 2 };
}

/** His body thrown into the snow at (x, z), `pose` first, `speed` m/s down
 * into it, sliding `slide` m/s along it. */
function ontoAt(
  st: Stage,
  p: { x: number; z: number; heading: number },
  pose: Pose,
  speed: number,
  slide: number,
  depth?: number,
): { s: GameState; at: P3 } {
  const s = st.fresh();
  if (depth !== undefined) s.snowDepth = depth;
  const g = st.level.groundAt(p.x, p.z);
  const v = { x: Math.sin(p.heading) * slide, y: -speed, z: Math.cos(p.heading) * slide };
  throwAt(s, p.x, p.z, p.heading, pose, v, g, 0.3);
  return { s, at: { x: p.x, y: g, z: p.z } };
}

/** His body flown into a lone trunk, `pose` leading, at `speed` m/s. */
export function intoTree(st: Stage, pose: Pose, speed: number): { s: GameState; tree: P3 } {
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
export function ontoSnow(
  st: Stage,
  pose: Pose,
  speed: number,
  slide = 0,
): { s: GameState; at: P3 } {
  const s = st.fresh();
  const p = flatSpot(st.level);
  const g = st.level.groundAt(p.x, p.z);
  const v = { x: Math.sin(p.heading) * slide, y: -speed, z: Math.cos(p.heading) * slide };
  throwAt(s, p.x, p.z, p.heading, pose, v, g, 0.3);
  return { s, at: { x: p.x, y: g, z: p.z } };
}

/** His body falling `speed` m/s onto the top of `post` (a tree's or a
 * post's), his hips over it, `lift` m over it. */
export function ontoTop(
  st: Stage,
  post: { x: number; z: number; y: number; height: number },
  pose: Pose,
  speed: number,
  lift = 0.3,
): GameState {
  const s = st.fresh();
  throwAt(s, post.x, post.z, 0.4, pose, { x: 0, y: -speed, z: 0 }, post.y + post.height, lift);
  return s;
}

const seconds = (s: GameState) => s.t;

/** The piste's point `ds` m along it from the one nearest `at`. */
function nearestOn(level: Level, at: P3, ds: number): { x: number; z: number; heading: number } {
  let near = level.track.points[0];
  for (const p of level.track.points) {
    if (Math.hypot(p.x - at.x, p.z - at.z) < Math.hypot(near.x - at.x, near.z - at.z)) near = p;
  }
  const s = Math.max(0, near.s + ds);
  return level.track.points.find((p) => p.s >= s) ?? near;
}

/** Stood up off a fall `fell` he survives, and skied away: only his blood
 * is left where he lay. */
function gotUp(st: Stage, fell: { s: GameState; at: P3 }): void {
  const { s, at } = fell;
  st.run(s, 4, still);
  const close = (onBody(1.3, 3, 1.8, 45) as (q: GameState) => LensPose)(s);
  st.shoot(s, "lying", close);
  st.until(
    s,
    (q) => !q.skier.thrown,
    4,
    () => ({ ...NEUTRAL_INPUT, reset: true }),
  );
  st.run(s, 0.5, still);
  st.shoot(s, "up", close);
  st.run(s, 3, bot);
  st.shoot(s, "gone", close);
  st.shoot(s, "gone-above", around(st.level, at, 1.0, 1.5, 7, 55, 0));
}

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
  // ── THE MACHINES ───────────────────────────────────────────────────────
  /** Knocked down in front of a working piste machine: under its belts and
   * its tiller, torn apart and spat out of the back. */
  groomer(st) {
    const s = st.fresh({ groomer: true });
    const g = s.groomers![0];
    st.run(s, 0.5, still);
    const fx = Math.sin(g.heading);
    const fz = Math.cos(g.heading);
    placeRun(s, { x: g.x + fx * 8, z: g.z + fz * 8, heading: g.heading + Math.PI, speed: 4 });
    const at = {
      x: g.x + fx * 6,
      y: st.level.groundAt(g.x + fx * 6, g.z + fz * 6),
      z: g.z + fz * 6,
    };
    const side = g.heading + Math.PI / 2;
    st.shoot(s, "coming", around(st.level, at, side, 14, 3, 50, 1));
    st.until(s, (q) => !!q.skier.thrown, 3, still);
    strobe(st, s, [0.3, 1, 1.6, 2.2, 3, 4.5], around(st.level, at, side, 10, 2.6, 50, 0.6));
    const end = { x: g.x, y: g.y, z: g.z };
    st.shoot(s, "behind", around(st.level, end, g.heading + Math.PI, 14, 4, 50, 0.4));
    st.shoot(s, "left-behind", onBody(side + 0.6, 4, 2.4, 50));
    st.shoot(s, "above", onBody(0.3, 1.5, 5, 55));
  },
  /** On the helicopter's skid when it is flown into the snow: blown apart
   * by the blast. */
  heli(st) {
    const s = st.fresh({ heli: true });
    const hands =
      (collective: number): Drive =>
      () => ({
        ...NEUTRAL_INPUT,
        heli: { collective, pitch: 0, roll: 0, pedal: 0 },
      });
    st.run(s, 6, hands(0.95));
    st.shoot(s, "flying", "chase");
    if (!st.until(s, (q) => q.heli?.mode === "wreck", 40, hands(0.1))) {
      st.shoot(s, "no-crash", "chase");
      return;
    }
    const w = s.heli!.wreck!;
    const at = { x: w.x, y: st.level.groundAt(w.x, w.z), z: w.z };
    const lens = around(st.level, at, s.heli!.heading + Math.PI / 2, 22, 5, 55, 2);
    st.shoot(s, "blast", lens);
    strobe(st, s, [0.05, 0.15, 0.35, 0.7, 1.4, 3, 6], lens);
    st.shoot(s, "remains", onBody(1.2, 4, 2.5, 50));
    st.shoot(s, "above", around(st.level, at, 0.5, 6, 18, 60, 0));
  },
  /** The same blast followed in the air: the body thrown off the skid with
   * its belly open, the bowel streaming behind him, frame by frame from
   * beside his line until he is down. */
  "heli-fly"(st) {
    const s = st.fresh({ heli: true });
    const hands =
      (collective: number): Drive =>
      () => ({
        ...NEUTRAL_INPUT,
        heli: { collective, pitch: 0, roll: 0, pedal: 0 },
      });
    st.run(s, 6, hands(0.95));
    if (!st.until(s, (q) => q.heli?.mode === "wreck", 40, hands(0.1))) {
      st.shoot(s, "no-crash", "chase");
      return;
    }
    const side = s.heli!.heading + Math.PI / 2;
    strobe(st, s, [0.6, 0.8, 1.0, 1.15, 1.3, 1.45, 1.6, 1.8, 2.4], onBody(side, 3.2, 0.6, 50));
  },
  /** INTO THE ROTOR: flown up and looped until his grip on the skid gives
   * out over the disc, then frame by frame as he falls down through it —
   * from beside the machine, level with its hub, and from under it. */
  rotor(st) {
    const s = rotorRun(st);
    if (!s) return;
    const yaw = s.heli!.heading + Math.PI / 2;
    st.shoot(s, "slip", onHeli(yaw, 16, 1, 55));
    strobe(st, s, [0.45, 0.55, 0.62, 0.68, 0.75, 0.85, 1.0, 1.3], onHeli(yaw, 16, -4, 55), loop);
    st.shoot(s, "under", onHeli(yaw + 0.6, 12, -8, 70));
    st.shoot(s, "behind", "chase");
  },
  /** The same fall, close: his body in the disc, from beside it. */
  "rotor-close"(st) {
    const s = rotorRun(st);
    if (!s) return;
    const yaw = s.heli!.heading + Math.PI / 2;
    strobe(st, s, [0.55, 0.6, 0.64, 0.68, 0.72, 0.8], onHeli(yaw + 0.4, 9, -3, 60), loop);
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
  /** A hard fall with nothing torn off: the parts hit hardest bleed under
   * his clothes, soak them, and run out at the gaps — the collar, the
   * hem, the cuffs, the boot tops — onto the snow. */
  leak(st) {
    const { s } = ontoSnow(st, "back", 16, 4);
    const t0 = s.t;
    for (const t of [1, 4, 10, 20]) {
      st.run(s, t - (s.t - t0), still);
      st.shoot(s, `${t}s`, onBody(1.3, 2.4, 1.3, 45));
    }
    st.shoot(s, "20s-other-side", onBody(4.4, 2.4, 1.3, 45));
    st.shoot(s, "20s-above", onBody(0.4, 1, 3.2, 50));
  },
  /** Face first onto the snow, the head split open: the face has nothing
   * over it, so it streams and drips straight off it. */
  "leak-face"(st) {
    // A fall that splits the head open is rare in a helmet: staged here as
    // a face-first fall with the skull broken by twice what breaks it.
    const { s } = ontoSnow(st, "front", 9, 3);
    st.run(s, 0.4, still);
    s.skier.body.injuries.push({ part: "head", kind: "skullFracture", ais: 4, t: s.t, energy: 2 });
    const t0 = s.t;
    const onHead =
      (yaw: number, dist: number, up: number): Lens =>
      (q) => {
        const p = q.skier.thrown?.points;
        const h = p
          ? { x: p[R.head * 3], y: p[R.head * 3 + 1], z: p[R.head * 3 + 2] }
          : { x: q.skier.x, y: q.skier.y, z: q.skier.z };
        return around(q.level, h, yaw, dist, up, 40, 0);
      };
    for (const t of [0.5, 1.5, 3]) {
      st.run(s, t - (s.t - t0), still);
      st.shoot(s, `+${t}s`, onHead(1.1, 1.2, 0.5));
    }
    st.shoot(s, "+3s-other-side", onHead(4.2, 1.2, 0.5));
    st.shoot(s, "+3s-above", onHead(0.4, 0.6, 1.6));
    // Square on his face, wherever it is turned: forward is his right
    // (shoulder to shoulder) crossed with his neck.
    const onFace: Lens = (q) => {
      const p = q.skier.thrown!.points;
      const at = (i: number) => ({ x: p[i * 3], y: p[i * 3 + 1], z: p[i * 3 + 2] });
      const h = at(R.head);
      const l = at(R.shoulderL);
      const r = at(R.shoulderR);
      const rx = r.x - l.x,
        ry = r.y - l.y,
        rz = r.z - l.z;
      const ux = h.x - (l.x + r.x) / 2,
        uy = h.y - (l.y + r.y) / 2,
        uz = h.z - (l.z + r.z) / 2;
      const fx = ry * uz - rz * uy,
        fy = rz * ux - rx * uz,
        fz = rx * uy - ry * ux;
      const n = Math.hypot(fx, fy, fz) || 1;
      const ex = h.x + (fx / n) * 0.45,
        ez = h.z + (fz / n) * 0.45;
      const ey = Math.max(q.level.groundAt(ex, ez) + 0.12, h.y + (fy / n) * 0.45 + 0.1);
      return {
        eye: { x: ex, y: ey, z: ez },
        target: { x: h.x, y: h.y - 0.05, z: h.z },
        fov: 40,
        roll: 0,
      };
    };
    st.shoot(s, "+3s-face", onFace);
  },
  /** Torn apart on the groomed piste and left lying: his blood spreading
   * wide on the packed snow round him, from above. */
  "pool-piste"(st) {
    const { s } = ontoSnow(st, "left", 28, 6);
    const t0 = s.t;
    for (const t of [5, 15, 30]) {
      st.run(s, t - (s.t - t0), still);
      st.shoot(s, `${t}s`, onBody(0.4, 1.5, 6, 55));
    }
    st.shoot(s, "30s-low", onBody(2.2, 4.5, 1.8, 50));
  },
  /** The same off the piste in a deep day's powder: it sinks in. */
  "pool-powder"(st) {
    const { s } = ontoAt(st, looseSpot(st.level), "left", 45, 8, 2.5);
    const t0 = s.t;
    for (const t of [5, 15, 30]) {
      st.run(s, t - (s.t - t0), still);
      st.shoot(s, `${t}s`, onBody(0.4, 1.5, 6, 55));
    }
    st.shoot(s, "30s-low", onBody(2.2, 4.5, 1.8, 50));
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
  // ── THE DEAD LEFT LYING ────────────────────────────────────────────────
  /** Killed on the piste, then the next rider stood up above him skiing
   * down past his body, his pieces and his blood. */
  remains(st) {
    st.clearBodies();
    const { s, at } = ontoSnow(st, "left", 28, 8);
    st.until(s, (q) => (q.gore?.dead ?? -1) >= 0, 10, still);
    st.run(s, 3, still);
    const close = (onBody(1.4, 4, 2.5, 50) as (q: GameState) => LensPose)(s);
    st.shoot(s, "dead", close);
    // The next rider, a way up the piste, skiing down it past him.
    const next = st.fresh();
    const p = nearestOn(st.level, at, -70);
    placeRun(next, { x: p.x, z: p.z, heading: p.heading, speed: 12 });
    // The same lens on what was left: the statue, not the rider.
    st.shoot(next, "left-lying", close);
    const away = (q: GameState) => Math.hypot(q.skier.x - at.x, q.skier.z - at.z);
    st.run(next, 0.2, bot);
    st.shoot(next, "next-rider", "chase");
    for (const d of [40, 20, 9]) {
      st.until(next, (q) => away(q) < d, 20, bot);
      st.shoot(next, `${d}m`, "chase");
    }
    st.until(next, (q) => away(q) < 4, 10, bot);
    st.shoot(next, "passing", around(st.level, at, 1.4, 8, 2.4, 55, 0.2));
    st.shoot(next, "passing-helmet", "helmet");
    st.run(next, 1, bot);
    st.shoot(next, "past", "chase");
    st.shoot(next, "above", around(st.level, at, 1.0, 1.5, 9, 55, 0));
    st.clearBodies();
    st.shoot(next, "cleared", around(st.level, at, 1.0, 1.5, 9, 55, 0));
  },
  /** A torn limb's artery closing: the stump spurting on the beat at
   * first, then — its spasm shutting it — welling, and dripping. */
  spasm(st) {
    const { s } = ontoSnow(st, "left", 28, 2);
    st.until(s, (q) => (q.gore?.lost ?? 0) !== 0, 1, still);
    const t0 = s.t;
    const lens = onBody(1.9, 2.4, 1.1, 45);
    for (const t of [0.3, 1, 2.5, 5, 9, 15]) {
      st.run(s, t - (s.t - t0), still);
      st.shoot(s, `+${t}s ${((s.gore?.out ?? 0) * 1000).toFixed(1)} ml/s`, lens);
    }
  },
  /** Stood on his skis with an arm hit hard enough to split the skin
   * under the sleeve: it soaks, then drips off the cuff — never a stream. */
  "stand-drip"(st) {
    const s = st.fresh();
    st.run(s, 0.5, still);
    s.skier.body.injuries.push({
      part: "armL",
      kind: "dislocatedElbow",
      ais: 3,
      t: s.t,
      energy: 2.5,
    });
    const t0 = s.t;
    const on = (yaw: number, dist: number): Lens => onBody(yaw + s.skier.heading, dist, 1.0, 40);
    for (const t of [3, 8, 15, 25]) {
      st.run(s, t - (s.t - t0), still);
      st.shoot(s, `+${t}s ${((s.gore?.out ?? 0) * 1000).toFixed(1)} ml/s`, on(1.6, 2.2));
    }
    st.shoot(s, "+25s-behind", on(Math.PI, 2.4));
  },
  /** A hard fall he survives, then stood back up and skied away: nothing
   * of him is left where he lay but his blood. */
  "got-up"(st) {
    gotUp(st, ontoSnow(st, "left", 10, 6));
  },
  /** The same in a deep day's powder off the piste. */
  "got-up-powder"(st) {
    gotUp(st, ontoAt(st, looseSpot(st.level), "left", 10, 6, 2.5));
  },

  // ── THE HUD ────────────────────────────────────────────────────────────
  /** A fatal crash with the HUD over it: skiing, the blow's jolt, the
   * readouts falling off it, DIED and the dark. */
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
  machines: ["groomer", "heli", "heli-fly"],
  rotor: ["rotor", "rotor-close"],
  blood: ["spray", "snow", "spasm", "stand-drip"],
  leak: ["leak", "leak-face", "got-up", "got-up-powder"],
  pools: ["pool-piste", "pool-powder"],
  close: ["closeup"],
  hud: ["wreck"],
  remains: ["remains"],
};
