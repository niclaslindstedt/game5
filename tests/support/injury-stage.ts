// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INJURY BENCH — a skier staged at the moment before a blow, and the
// engine left to deal it. Either thrown (his body off the skis, posed by
// hand — head first, flat on his back, on his side, onto his hands — and
// driven into the snow or into a solid at a speed), or on his skis (dropped
// off a cliff onto the flat, landed in the back seat or over the tips, an
// edge caught at speed, skied into a trunk or a tower). Nothing here rules
// on an injury: the engine's own ragdoll, landing and body do, and the
// scenarios (`injury-scenarios.ts`) say what each moment ought to do.
//
// Every staging is drawn TRIALS times, each with a run seed of its own: an
// injury is a chance (`body.ts`' risk curve, drawn off a hash of the step
// and the seed), so what a moment does is a RATE — how often each injury
// came of it.

import {
  BONES,
  CABIN_LAYOUT,
  FRACTURE_GRADE,
  NEUTRAL_INPUT,
  RAGDOLL,
  TUNING,
  bodyThrown,
  createGame,
  flightGravity,
  fracturesOf,
  letGo,
  placeRun,
  step,
  type Bone,
  type GameEvent,
  type GameState,
  type InjuryKind,
  type Level,
  type SkierInput,
  type Stuff,
  type TreeDef,
} from "@engine";
import { fromAxisAngle, multiply, type Quat } from "@niclaslindstedt/oss-game-framework/core/quat";
import { shapedLevel } from "./synthetic.ts";

/** THE SNOW a moment is staged on: a deep day's untracked POWDER, a
 * day's ordinary loose snow (SOFT), the GROOMED piste, bare ICE. */
export type Ground = "powder" | "soft" | "groomed" | "ice";

/** HOW HIS BODY MEETS IT, thrown off the skis: HEAD first (upside down,
 * or — into a solid — diving), FACE down, flat on his BACK, on his LEFT
 * or RIGHT side, onto his outstretched HANDS (a fall forward caught on
 * them), onto a SHOULDER (his left, the arm in), FEET first (stood up,
 * off the skis), on his SEAT (sat back, the trunk upright), and — into a
 * solid — his FRONT (chest first), his BACK or a SIDE leading. */
export type Pose =
  "head" | "face" | "back" | "left" | "right" | "hands" | "shoulder" | "feet" | "seat" | "front";

/** A MOMENT, staged:
 *  - `fall`: the body posed and driven straight into the snow at `speed`
 *    m/s (a fall from h is √(2gh)), sliding on along it at `slide` m/s;
 *  - `into`: the body posed, flying level at `speed` m/s into a solid of
 *    `stuff` (a trunk of radius `radius`, a tower's column, a log wall);
 *  - `drop`: on his skis, stood up, off a cliff of `height` m onto the
 *    flat, going `speed` m/s on — tips `pitch` rad up (negative down) and
 *    `roll` rad over as they meet the snow;
 *  - `ski`: on his skis at `speed` m/s straight at a solid of `stuff`,
 *    `offset` m beside his line (0 square on the tips, ~0.5 his shoulder);
 *  - `catch`: carving at `speed` m/s, the outside ski over on its edge as
 *    the skis are thrown across his way — an edge caught. */
export type Stage =
  | { how: "fall"; pose: Pose; speed: number; slide?: number }
  | { how: "into"; pose: Pose; stuff: Stuff; speed: number; radius?: number }
  | { how: "drop"; height: number; speed: number; pitch?: number; roll?: number }
  | { how: "ski"; stuff: Stuff; speed: number; offset: number; radius?: number }
  | { how: "catch"; speed: number };

export type Staging = { stage: Stage; ground: Ground };

/** What one trial did: every injury taken, in the order taken, the worst
 * AIS, the hardest blow (g) and what first threw him, if anything did. */
export type Trial = {
  injuries: { kind: InjuryKind; part: string }[];
  worst: number;
  peak: number;
  cause: string | null;
  /** The hardest landing's load, g (0 for none). */
  land: number;
  /** The bones he was left with SHATTERED — broken into pieces by more
   * than twice the energy that breaks them (`injury.comminute`). */
  shattered: Bone[];
};

/** How many trials a moment is drawn, and how long each runs, s. */
export const TRIALS = 24;
const RUN = 2;

/** Where everything is staged: the middle of a flat bench. */
const AT = { x: 300, z: 300 };
/** A solid stands this far down +z from the moment. */
const AHEAD = 6;

const g = TUNING.g;
const dt = TUNING.dt;
const R = RAGDOLL;

const levels = new Map<string, Level>();

/** The bench for a staging: flat, its snow the ground's, and a solid on it
 * when the moment needs one — a trunk or a column of `radius`, or a log
 * wall across the way. */
function benchOf(s: Staging): Level {
  const st = s.stage;
  const solid = st.how === "into" || st.how === "ski" ? st : null;
  const key = `${s.ground}|${solid ? `${solid.stuff}:${solid.radius ?? ""}:${solid.how}` : ""}`;
  let level = levels.get(key);
  if (level) return level;
  const trees: TreeDef[] = [];
  if (solid) {
    const stuff = solid.stuff;
    const wall = CABIN_LAYOUT.wall;
    const radius =
      solid.radius ?? (stuff === "log" ? wall.radius : stuff === "padded" ? 0.45 : 0.22);
    const z = AT.z + AHEAD;
    // A wall is a cabin's row of uprights across the way, as `cabinWalls`
    // stands them; a trunk or a column one.
    const across = stuff === "log" ? [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => k * wall.gap) : [0];
    for (const dx of across) {
      const tree: TreeDef & { stuff: Stuff } = {
        x: AT.x + dx,
        z,
        y: 0,
        height: 12,
        radius,
        crown: 2,
        stuff,
      };
      trees.push(tree);
    }
  }
  const packed = s.ground === "groomed" || s.ground === "ice" ? 1 : 0;
  level = shapedLevel(() => 0, { packed, size: 600, cell: 1, trees });
  if (s.ground === "ice") level.iceAt = () => 1;
  levels.set(key, level);
  return level;
}

/** The snow dial a ground is staged at: a deep day for powder. */
function depthOf(ground: Ground): number {
  return ground === "powder" ? 2 : 1;
}

/** The body's attitude for a pose, heading +z: the standing body's lean
 * taken out (`ragdoll.ts` stands it pitched 0.4 forward), then tipped. */
function poseOf(pose: Pose): Quat {
  const unlean = fromAxisAngle(1, 0, 0, -0.4);
  // About his right (x): forward is positive — the up axis toward +z.
  const tip = (a: number): Quat => fromAxisAngle(1, 0, 0, a);
  // About his forward (z): positive brings his right side up.
  const roll = (a: number): Quat => fromAxisAngle(0, 0, 1, a);
  const by = (q: Quat): Quat => multiply(q, unlean);
  switch (pose) {
    case "head":
      return by(tip(Math.PI));
    case "face":
    case "hands":
      return by(tip(Math.PI / 2));
    case "back":
      return by(tip(-Math.PI / 2));
    case "left":
      return by(roll(Math.PI / 2));
    case "right":
      return by(roll(-Math.PI / 2));
    case "shoulder":
      // Head and shoulder first, the trunk tipped over to his left.
      return by(roll(Math.PI * 0.75));
    case "seat":
      return multiply(tip(-0.15), unlean);
    case "feet":
    case "front":
      return by(tip(0));
  }
}

/** Turn a body's points so a pose leads the way it is going, heading +z
 * (an `into` moment): the chest, the back or a side first; the head first
 * is a dive, the body laid level. */
function intoOf(pose: Pose): Quat {
  const unlean = fromAxisAngle(1, 0, 0, -0.4);
  const yaw = (a: number): Quat => fromAxisAngle(0, 1, 0, a);
  switch (pose) {
    case "head":
      return multiply(fromAxisAngle(1, 0, 0, Math.PI / 2), unlean);
    case "feet":
      // Laid back level, feet first: a slide into it on his back.
      return multiply(fromAxisAngle(1, 0, 0, -Math.PI / 2), unlean);
    case "back":
      return multiply(yaw(Math.PI), unlean);
    case "left":
      return multiply(yaw(Math.PI / 2), unlean);
    case "right":
      return multiply(yaw(-Math.PI / 2), unlean);
    default:
      return unlean;
  }
}

/** A fall is met this far below where it is staged, m: long enough for
 * his reflex to throw his hands out at the snow, as a falling man's does. */
const LEAD = 0.3;

/** Sit a posed body down: his legs out ahead of his hips along the way he
 * faces, the knees a little up — on his seat, not his feet. */
function seated(P: number[], L: number[]): void {
  const B = TUNING.crash.body;
  for (const [hip, knee, foot] of [
    [R.hipL, R.kneeL, R.footL],
    [R.hipR, R.kneeR, R.footR],
  ]) {
    const to = (i: number, x: number, y: number, z: number): void => {
      const dx = x - P[3 * i];
      const dy = y - P[3 * i + 1];
      const dz = z - P[3 * i + 2];
      P[3 * i] += dx;
      P[3 * i + 1] += dy;
      P[3 * i + 2] += dz;
      L[3 * i] += dx;
      L[3 * i + 1] += dy;
      L[3 * i + 2] += dz;
    };
    const hx = P[3 * hip];
    const hy = P[3 * hip + 1];
    const hz = P[3 * hip + 2];
    to(knee, hx, hy + 0.15, hz + B.thigh * 0.99);
    to(foot, hx, hy + 0.05, hz + B.thigh * 0.99 + B.shin * 0.99);
  }
}

/** Stand a thrown body for a `fall` or an `into` moment. */
function throwStaged(state: GameState, st: Stage & { how: "fall" | "into" }): void {
  const level = state.level;
  const q = st.how === "fall" ? poseOf(st.pose) : intoOf(st.pose);
  // A fall staged LEAD above the snow, as slow as meets it at its speed.
  const down = Math.sqrt(Math.max(0, st.speed * st.speed - 2 * g * LEAD));
  const v = st.how === "fall" ? { x: 0, y: -down, z: st.slide ?? 0 } : { x: 0, y: 0, z: st.speed };
  const thrown = bodyThrown(
    st.how === "into" ? "tree" : "landing",
    q,
    AT.x,
    5,
    AT.z,
    v,
    {
      x: 0,
      y: 0,
      z: 0,
    },
    0,
  );
  const P = thrown.points;
  const L = thrown.last;
  if (st.how === "fall" && st.pose === "seat") seated(P, L);
  // Shift the body to a hand's breadth off what it is about to meet.
  let dx = 0;
  let dy = 0;
  let dz = 0;
  const radius = (i: number): number =>
    i === R.head
      ? TUNING.crash.body.head
      : i <= R.shoulderR
        ? TUNING.crash.radius
        : TUNING.crash.body.limb;
  if (st.how === "fall") {
    let low = Infinity;
    for (let i = 0; i < R.count; i++) {
      const gap = P[3 * i + 1] - radius(i) - level.groundAt(P[3 * i], P[3 * i + 2]);
      low = Math.min(low, gap);
    }
    dy = LEAD - low;
  } else {
    // Level and clear of the snow, the leading point 5 cm off the solid.
    let low = Infinity;
    let lead = -Infinity;
    for (let i = 0; i < R.count; i++) {
      low = Math.min(low, P[3 * i + 1] - radius(i));
      lead = Math.max(lead, P[3 * i + 2] + radius(i));
    }
    dy = 0.25 - low;
    const solids = level.trees;
    const face = Math.min(...solids.map((t) => t.z - t.radius));
    dz = face - 0.05 - lead;
  }
  for (let i = 0; i < R.count; i++) {
    P[3 * i] += dx;
    P[3 * i + 1] += dy;
    P[3 * i + 2] += dz;
    L[3 * i] += dx;
    L[3 * i + 1] += dy;
    L[3 * i + 2] += dz;
  }
  thrown.y += dy;
  thrown.z += dz;
  // ...and his skis let go where he stood, out of the way.
  thrown.skis = letGo(state, state.skier, 1, 0);
  state.skier.thrown = thrown;
}

/** Stand a skier on his skis for a `drop`, `ski` or `catch` moment. */
function placeStaged(state: GameState, st: Stage & { how: "drop" | "ski" | "catch" }): void {
  if (st.how === "drop") {
    // His centre of gravity three metres over the snow, or as high as
    // gives a long drop's fall the 0.4 s that makes it a flight
    // (`TUNING.landing.air`), falling as fast as meets the snow at the
    // speed of a REAL fall from the drop's height: the rest of the way is
    // flown under the air's own (arcade) gravity, `flightGravity`.
    const over = Math.min(st.height, Math.max(3, 0.4 * Math.sqrt(2 * g * st.height)));
    const rest = over - state.skier.spec.cogHeight;
    const vy2 = 2 * g * st.height - 2 * flightGravity(state.rules) * rest;
    placeRun(state, {
      x: AT.x,
      z: AT.z,
      heading: 0,
      speed: st.speed,
      height: over,
      vy: -Math.sqrt(Math.max(0, vy2)),
      pitch: st.pitch ?? 0,
      roll: st.roll ?? 0,
    });
  } else if (st.how === "ski") {
    // Placed on the line `offset` m to the trunk's left: it comes on his
    // right.
    placeRun(state, { x: AT.x - st.offset, z: AT.z, heading: 0, speed: st.speed });
  } else {
    placeRun(state, { x: AT.x, z: AT.z, heading: 0, speed: st.speed });
    // The skis thrown 40° across his way and the outside one (his left in
    // a turn right) laid well over: the edge bites the snow sideways.
    const c = state.skier;
    c.q = multiply(fromAxisAngle(0, 1, 0, 0.7), fromAxisAngle(0, 0, 1, -0.9));
    c.edge = 1;
    c.skid = 0;
  }
}

/** The input a staged skier rides with: none, or the edge held over. */
function inputOf(st: Stage): SkierInput {
  return st.how === "catch" ? { ...NEUTRAL_INPUT, steer: 1 } : NEUTRAL_INPUT;
}

/** ONE TRIAL of a staging, its run seed `trial + 1`. */
export function runTrial(s: Staging, trial: number): Trial {
  const level = benchOf(s);
  const state = createGame({
    level,
    seed: trial + 1,
    rivals: 0,
    countdown: 0,
    quiet: true,
    snowDepth: depthOf(s.ground),
    // Off a drop the skis meet the snow as staged: nothing levels them in
    // the air.
    assist: { yaw: 1, air: s.stage.how === "drop" ? 0 : 1 },
  });
  const st = s.stage;
  if (st.how === "fall" || st.how === "into") {
    placeRun(state, { x: AT.x, z: AT.z - 20, heading: 0 });
    throwStaged(state, st);
  } else {
    placeStaged(state, st);
  }
  const input = inputOf(st);
  const out: Trial = { injuries: [], worst: 0, peak: 0, cause: null, land: 0, shattered: [] };
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(RUN / dt); i++) {
    step(state, input);
    events.push(...state.events);
    // Never stood back up: a reset would mend him.
    const t = state.skier.thrown;
    if (t) t.t = Math.min(t.t, 0.5);
  }
  for (const e of events) {
    if (e.kind === "injury") {
      out.injuries.push({ kind: e.injury, part: e.part });
      out.worst = Math.max(out.worst, e.ais);
    } else if (e.kind === "wipeout" && out.cause === null) out.cause = e.cause;
    else if (e.kind === "land") out.land = Math.max(out.land, e.g);
  }
  out.peak = state.skier.body.peak;
  const grades = fracturesOf(state.skier.body);
  out.shattered = BONES.filter((_, i) => grades[i] === FRACTURE_GRADE.shatter);
  return out;
}

/** EVERY TRIAL of a staging: how often each injury came of it (a share of
 * the trials), the share thrown, the median worst AIS and hardest blow. */
export type Rates = {
  rate: Map<InjuryKind, number>;
  thrown: number;
  worst: number;
  peak: number;
  land: number;
  /** What threw him, by how many trials. */
  causes: Map<string, number>;
  trials: Trial[];
};

export function ratesOf(s: Staging, trials = TRIALS): Rates {
  const all: Trial[] = [];
  for (let k = 0; k < trials; k++) all.push(runTrial(s, k));
  const rate = new Map<InjuryKind, number>();
  for (const t of all) {
    for (const kind of new Set(t.injuries.map((h) => h.kind))) {
      rate.set(kind, (rate.get(kind) ?? 0) + 1 / trials);
    }
  }
  const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1];
  return {
    rate,
    thrown: all.filter((t) => t.cause !== null).length / trials,
    worst: median(all.map((t) => t.worst)),
    peak: median(all.map((t) => t.peak)),
    land: median(all.map((t) => t.land)),
    causes: all.reduce(
      (m, t) => m.set(t.cause ?? "none", (m.get(t.cause ?? "none") ?? 0) + 1),
      new Map<string, number>(),
    ),
    trials: all,
  };
}

/** The share of trials that left `bone` shattered. */
export function shatterRate(r: Rates, bone: Bone): number {
  return r.trials.filter((t) => t.shattered.includes(bone)).length / r.trials.length;
}

/** The share of trials that took any of `kinds`. */
export function anyRate(r: Rates, kinds: readonly InjuryKind[]): number {
  const set = new Set(kinds);
  return r.trials.filter((t) => t.injuries.some((h) => set.has(h.kind))).length / r.trials.length;
}
