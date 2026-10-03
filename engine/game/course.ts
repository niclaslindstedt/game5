// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE — the gates in order, the finish, and the way back onto the
// piste.
//
// A GATE is a line across the piste, crossed by a move through it in its
// facing direction within its width (plus `course.grace` either side: at
// gate range, "did I clip that?" is answered in the skier's favour). ONE IS
// LIVE AT A TIME — the one the run owes — and nothing else counts: a skier
// who misses a gate is not disqualified, the next one is simply not
// credited until the missed one is taken. The moment he skis past it —
// across its line beside it — it is flagged, and the HUD's arrow points him
// back at it and lights the reset (`Progress.missed`, `bearingToNext`).
//
// THE RUN: the field stands on the start line a few metres above the START
// GATE (gate 0) and the run owes that gate first — crossing it opens the
// run. Then 1, 2, … down the piste to the LAST gate, the FINISH LINE, which
// ends it. So a run of `n` gates is `n` crossings, and the standings count
// them (`rivals.ts`). `rules.laps` is always one: a piste is skied top to
// bottom and nothing wraps.
//
// THE RESET stands the skier on the piste a few metres past the last gate
// he took, facing down it, at rest — or on the start line before he has
// taken one. It is the skier's (the key) and the engine's (`run.ts`: on his
// back, or bogged going nowhere). On a free ride it stands him on the
// nearest run of the resort, a piste before a lane.

import { angleDiff, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { nearestTrackPoint, trackPointAt } from "../mapgen/index.ts";
import type { Checkpoint, Level, Spawn, TrackPoint } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";
import { derive } from "./skier.ts";
import { bottomlessOf, depthUnder, packedUnder, sinkTarget } from "./snow.ts";
import { probesOf } from "./suspension.ts";
import type { GameEvent, GameState, Progress } from "./state.ts";

const K = TUNING.course;

/** HOW FAR RIGHT OF THE START LINE'S CENTRE a point stands, m, across the
 * line's own heading — the LANE a skier who started there holds down the
 * piste (`sim/bot.ts`), the player's slot's and every rival's. */
export function laneAcross(level: Level, x: number, z: number): number {
  const s = level.spawn;
  return (x - s.x) * Math.cos(s.heading) - (z - s.z) * Math.sin(s.heading);
}

export function freshProgress(level: Level): Progress {
  return {
    nextCheckpoint: 0,
    started: false,
    lap: 0,
    passed: 0,
    lastCheckpoint: -1,
    splits: level.checkpoints.map(() => NaN),
    lapTimes: [],
    lapStart: 0,
    time: 0,
    finished: false,
    missed: null,
    penalty: 0,
    lastPassedAt: 0,
    lastResetAt: 0,
    bestAir: 0,
    distance: 0,
  };
}

/** Whether a plan move from (x0, z0) to (x1, z1) crossed the gate's line
 * in its facing direction, and how far off its centre, m (positive to the
 * right); null if it did not cross at all. The width is not applied. */
export function crossedLine(
  cp: Checkpoint,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): number | null {
  const fx = Math.sin(cp.heading);
  const fz = Math.cos(cp.heading);
  const s0 = (x0 - cp.x) * fx + (z0 - cp.z) * fz;
  const s1 = (x1 - cp.x) * fx + (z1 - cp.z) * fz;
  if (!(s0 < 0 && s1 >= 0)) return null;
  const f = s0 / (s0 - s1);
  const cx = x0 + (x1 - x0) * f;
  const cz = z0 + (z1 - z0) * f;
  return (cx - cp.x) * fz - (cz - cp.z) * fx;
}

/** Whether the move went THROUGH the gate — inside its width and the
 * grace, and `extra` metres more — returning the offset, or null. */
export function crossedCheckpoint(
  cp: Checkpoint,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  extra = 0,
): number | null {
  const lateral = crossedLine(cp, x0, z0, x1, z1);
  if (lateral === null) return null;
  return Math.abs(lateral) <= cp.width / 2 + K.grace + extra ? lateral : null;
}

/** How many crossings a whole run is: every gate once, the start gate and
 * the finish among them. */
export function crossingsToFinish(state: GameState): number {
  return state.level.checkpoints.length * state.rules.laps;
}

/** Check the move the skier just made against the gate the run owes. The
 * clock is run by `run.ts`, not here. */
export function stepCourse(state: GameState, x0: number, z0: number, events: GameEvent[]): void {
  const p = state.progress;
  if (p.finished) return;
  const cps = state.level.checkpoints;
  const n = cps.length;
  const c = state.skier;
  const owed = p.nextCheckpoint;
  const extra = p.started ? 0 : K.startGrace;
  if (crossedCheckpoint(cps[owed], x0, z0, c.x, c.z, extra) !== null) {
    p.passed += 1;
    p.lastCheckpoint = owed;
    p.splits[owed] = p.time;
    p.lastPassedAt = p.time;
    if (p.missed === owed) p.missed = null;
    events.push({ kind: "checkpoint", t: state.t, index: owed, lap: p.lap, split: p.time });
    if (owed === 0 && !p.started) {
      p.started = true;
      p.lapStart = p.time;
    }
    if (owed === n - 1) {
      // THE FINISH LINE: the run is done.
      p.lap += 1;
      const runTime = p.time - p.lapStart;
      p.lapTimes.push(runTime);
      p.nextCheckpoint = n - 1;
      events.push({ kind: "lap", t: state.t, lap: p.lap, time: runTime });
      p.finished = true;
      p.missed = null;
      state.phase = "finished";
      events.push({ kind: "finish", t: state.t, time: p.time, place: placeOf(state) });
      return;
    }
    p.nextCheckpoint = owed + 1;
    return;
  }
  // A SLALOM GATE skied past (R28) — beside it anywhere across the piste,
  // or the next one taken first — costs the run `course.missPenalty` on
  // its clock and the run goes on to the next: a skier never climbs back
  // to a gate set in the middle of a piste.
  if (slalom(cps[owed]) && owed < n - 1) {
    const past = rodePast(cps[owed], x0, z0, c.x, c.z, 0, slalomReach(cps[owed]));
    const next = cps[owed + 1];
    const took = crossedCheckpoint(next, x0, z0, c.x, c.z) !== null;
    if (past || took) {
      p.time += K.missPenalty;
      p.penalty += K.missPenalty;
      p.nextCheckpoint = owed + 1;
      events.push({ kind: "missed", t: state.t, index: owed, penalty: K.missPenalty });
      // The move may have taken the next gate as it went past this one.
      if (took) stepCourse(state, x0, z0, events);
    }
    return;
  }
  // THE ARROW: skiing past the owed gate's line OUTSIDE it — within
  // `missReach` of its edge, so a far sweep of the piste across the line's
  // extension is not taken for it — or crossing the NEXT gate's line while
  // this one is still owed, is a gate gone past. Nothing is charged; the
  // HUD points back and lights the reset.
  const next = owed + 1 < n ? cps[owed + 1] : null;
  if (
    p.missed !== owed &&
    (rodePast(cps[owed], x0, z0, c.x, c.z, extra) ||
      (next !== null && crossedCheckpoint(next, x0, z0, c.x, c.z) !== null))
  ) {
    p.missed = owed;
    events.push({ kind: "missed", t: state.t, index: owed });
  }
}

/** Whether the move crossed the gate's line in its facing direction beside
 * it — past its width and grace (and `extra`), but within
 * `course.missReach` of that edge. */
function rodePast(
  cp: Checkpoint,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  extra: number,
  reach: number = K.missReach,
): boolean {
  const lateral = crossedLine(cp, x0, z0, x1, z1);
  if (lateral === null) return false;
  const edge = cp.width / 2 + K.grace + extra;
  return Math.abs(lateral) > edge && Math.abs(lateral) <= edge + reach;
}

/** Whether a gate is a SLALOM GATE (R28): set off the line, narrower than
 * the piste. */
export function slalom(cp: Checkpoint): boolean {
  return cp.offset !== undefined;
}

/** How far past a slalom gate's edge a crossing of its line still counts as
 * going past it: to the far edge of the piste, and a little more. */
function slalomReach(cp: Checkpoint): number {
  return (cp.span ?? cp.width) / 2 + Math.abs(cp.offset ?? 0) + 10;
}

/** THE GATE LINE (R28): how far right of the piste's centreline the line
 * through a course's gates stands `s` metres down it, m, and how sharply
 * it weaves there, 1/m — a cosine from each gate's offset to the next's,
 * so it stands on every gate's centre, crosses straight between two set
 * either side, and turns hardest round each gate, as a skier does. Zero on
 * a piste whose gates span it. */
export function gateLineAt(level: Level, s: number): { offset: number; curvature: number } {
  const cps = level.checkpoints;
  let i = 0;
  while (i + 1 < cps.length && cps[i + 1].s < s) i++;
  const a = cps[i];
  const b = cps[Math.min(cps.length - 1, i + 1)];
  const oa = a?.offset ?? 0;
  const ob = b?.offset ?? 0;
  if (!a || b === a || oa === ob) return { offset: oa, curvature: 0 };
  const span = Math.max(1, b.s - a.s);
  const t = Math.min(1, Math.max(0, (s - a.s) / span));
  const w = Math.PI / span;
  return {
    offset: oa + ((ob - oa) * (1 - Math.cos(Math.PI * t))) / 2,
    curvature: Math.abs(((ob - oa) * w * w * Math.cos(Math.PI * t)) / 2),
  };
}

/** Where a run that has just finished stands: one more than the rivals
 * already home. A rival's own run has no field, so it reads 1 here and the
 * standings are the player's to work out (`racePlace`). */
function placeOf(state: GameState): number {
  let ahead = 0;
  for (const r of state.rivals) if (r.run.progress.finished) ahead += 1;
  return ahead + 1;
}

/** How much nearer a TRANSPORT LANE (a cat track, R27) must be than the
 * nearest piste for a free ride's reset to stand the skier on it, m: a
 * skier set back on the snow is set on a run to ski, and a lane is only
 * the way between them. */
const LANE_HANDICAP = 40;

/** The point of a run's centreline nearest (x, z) on a free ride: of every
 * run of the resort (R27) — a piste preferred over a lane by
 * `LANE_HANDICAP` — or of the map's one piste where the map is not a
 * resort. Facing the way that run runs there. Pure: the runs are walked in
 * their published order and the first of two equal answers is kept. */
function nearestRunPoint(level: Level, x: number, z: number): TrackPoint {
  const runs = level.resort?.runs ?? [];
  let best: TrackPoint | null = null;
  let score = Infinity;
  for (const run of runs) {
    if (run.points.length < 2) continue;
    const line = { track: { points: run.points, length: run.length } };
    const near = nearestTrackPoint(line, x, z);
    const d = near.distance + (run.kind === "road" ? LANE_HANDICAP : 0);
    if (d < score) {
      score = d;
      best = trackPointAt(line, near.s);
    }
  }
  return best ?? trackPointAt(level, nearestTrackPoint(level, x, z).s);
}

/** Where a reset stands the skier: on the piste's centreline a few metres
 * past the last gate taken (or on the start line before the start gate),
 * facing down the piste. On a FREE RIDE, where no gate is owed, it is the
 * nearest point of the nearest RUN of the resort (`nearestRunPoint`) — the
 * groomer he was last closest to, facing the way it runs there. */
export function resetPose(state: GameState): {
  x: number;
  z: number;
  heading: number;
  checkpoint: number;
} {
  if (!state.rules.course) {
    const at = nearestRunPoint(state.level, state.skier.x, state.skier.z);
    return { x: at.x, z: at.z, heading: at.heading, checkpoint: -1 };
  }
  const cps = state.level.checkpoints;
  const last = state.progress.lastCheckpoint;
  if (last < 0) {
    const spawn = state.level.spawn;
    return { x: spawn.x, z: spawn.z, heading: spawn.heading, checkpoint: -1 };
  }
  const at = trackPointAt(state.level, cps[last].s + K.resetAhead);
  return { x: at.x, z: at.z, heading: at.heading, checkpoint: last };
}

/** Put the skier down at rest at a plan point and heading, standing on his
 * legs at their rest sag on the snow there, pitched and rolled to the
 * slope. */
export function standSkier(state: GameState, x: number, z: number, heading: number): void {
  const c = state.skier;
  const level = state.level;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const L = c.spec.length / 2;
  const W = Math.max(0.3, c.spec.stance / 2);
  const pitch = Math.atan2(
    level.groundAt(x + fx * L, z + fz * L) - level.groundAt(x - fx * L, z - fz * L),
    2 * L,
  );
  const roll = Math.atan2(
    level.groundAt(x - fz * W, z + fx * W) - level.groundAt(x + fz * W, z - fx * W),
    2 * W,
  );
  const packed = packedUnder(level.packedAt(x, z), state.fresh);
  const depth = depthUnder(state.snowDepth, state.fresh);
  const deep = bottomlessOf(state.snowDepth);
  const probes = probesOf(c.spec);
  let midSink = 0;
  for (let i = 0; i < probes.length; i++) {
    c.sinks[i] = sinkTarget(packed, 0, probes[i].sinkScale, 1, depth, 1, deep);
    if (probes[i].station === "mid") midSink = c.sinks[i];
  }
  c.x = x;
  c.z = z;
  c.y = level.groundAt(x, z) - midSink + c.spec.cogHeight;
  c.vx = c.vy = c.vz = 0;
  c.q = fromEuler(heading, pitch, roll);
  c.wx = c.wy = c.wz = 0;
  c.tuck = 0;
  c.brake = 0;
  c.steer = 0;
  c.lean = 0;
  c.edge = 0;
  c.skid = 0;
  c.skiAngle = 0;
  c.carve = 0;
  c.jumpLoad = 0;
  c.popped = 1e6;
  c.drive = 0;
  c.crouch = 0;
  c.hipRight = 0;
  c.hipAft = 0;
  c.packed = packed;
  c.sideSlip = 0;
  c.airborne = false;
  c.airTime = 0;
  c.airReported = false;
  c.launchVy = 0;
  c.landing = 1e6;
  c.overFor = 0;
  c.stuckFor = 0;
  // Stood up out of his hole with his skis back on; what the edges have
  // taken, they keep.
  c.trench = 0;
  c.trenchFor = 0;
  c.boggedFor = 0;
  c.rolledFor = 0;
  c.bodyHit = 0;
  c.bodySide = 0;
  c.save = null;
  c.thrown = null;
  c.hitCooldown = 0;
  c.bumpCooldown = 0;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  c.comps.fill(0);
  derive(c, state.level);
}

/** How far clear of a trunk a free ride may be stood, m past its radius. */
const TREE_CLEAR = 2.5;

/** WHERE A FREE RIDE STARTS when the skier picked a spot on the chart: the
 * point held inside the map's edge (`TUNING.bounds`), facing the way the
 * piste runs at its nearest point — a direction the skier can read off the
 * chart — and, where the spot is inside a trunk, stood on that nearest
 * point of the piste instead: a skier cannot be put down inside a tree. */
export function freeSpawn(level: Level, x: number, z: number): Spawn {
  const B = TUNING.bounds;
  const lo = B.margin + B.soft;
  const hi = level.size - lo;
  const px = Math.min(hi, Math.max(lo, x));
  const pz = Math.min(hi, Math.max(lo, z));
  const near = nearestTrackPoint(level, px, pz);
  const along = trackPointAt(level, near.s);
  for (const t of level.trees) {
    if (hypot(t.x - px, t.z - pz) < t.radius + TREE_CLEAR) {
      return { x: along.x, z: along.z, heading: along.heading };
    }
  }
  return { x: px, z: pz, heading: along.heading };
}

/** `reset`: back on the piste at the last gate taken. */
export function resetSkier(state: GameState, events: GameEvent[], auto: boolean): void {
  const pose = resetPose(state);
  standSkier(state, pose.x, pose.z, pose.heading);
  state.progress.lastResetAt = state.progress.time;
  events.push({ kind: "reset", t: state.t, checkpoint: pose.checkpoint, auto });
}

/** The heading from the skier to the gate the run owes, how far off his
 * own heading that is, and how far away — the HUD's arrow and the bot. */
export function bearingToNext(
  state: GameState,
): { bearing: number; error: number; distance: number; index: number } | null {
  const p = state.progress;
  if (p.finished) return null;
  const cp = state.level.checkpoints[p.nextCheckpoint];
  const c = state.skier;
  const bearing = Math.atan2(cp.x - c.x, cp.z - c.z);
  return {
    bearing,
    error: angleDiff(c.heading, bearing),
    distance: hypot(cp.x - c.x, cp.z - c.z),
    index: p.nextCheckpoint,
  };
}
