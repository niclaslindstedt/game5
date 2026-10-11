// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMP'S FLIGHT (R43) — the air off the edge flown on the AIR the
// body and the V of skis make, a flight of its own as an aerials jump's is
// (`aerial-flight.ts`), from the edge to the feet on the snow.
//
// THE FORCES. Gravity at the real g; LIFT and DRAG off the air past him —
// his velocity less the wind's at the hill (`airAt`, or a staged one) — at
// the hill's density, through AREAS that are functions of the ANGLE OF
// ATTACK his skis meet that air at (the POLAR, `JUMP.polar`): a smooth
// table with its best lift to drag at 20–25° and its stall past 40°. The
// lift stands at right angles to the air, tilted by his roll; the drag lies
// along it. Because the areas follow the angle to the AIR, a head wind —
// air faster past him and coming flatter — is lift that stands more
// upright: a head wind carries him further and a tail wind shortens him,
// as the hills' published wind factors say (a fixed-area model gets that
// backwards: its head wind is only drag).
//
// THE ATTITUDE. He holds an angle of attack — the air's own pitching
// moment carries him to a sat-up TRIM, the lean moves him off it, and the
// assist's hand eases him to the polar's best through the flight
// (`attitude.ideal`); he moves to what he holds over `attitude.lag`. Under
// `attitude.over` the moment turns on him and runs the angle away: the
// tips go down and he is over (`record.lost`). Past `attitude.stall` the
// lift has gone and he drops. The take-off's error is in his attitude for
// its first second (`rotation`), and he lays out over his skis and opens
// the V over the first half second (`layout`) — the tuck key holds the V
// open (the assist does it for him), the edge holds the ROLL level against
// the air across the hill (the assist levels it too).
//
// THE LANDING: the trick key in the last moments asks for the TELEMARK —
// the body comes up, the angle of attack to ~40° — and the feet's first
// touch is the DISTANCE (`Level.skiJump.distanceAt`, to the half metre).
// Turned over, sat back past `landing.sat` or rolled past
// `landing.rolled`, he falls; otherwise he is handed to the engine's skier
// just over the snow with his velocity into it, and the legs, the landing's
// load (`landingLoad`) and the wipeout are the engine's own (`skier.ts`,
// `crash.ts`).
// Nothing here is random and nothing reads a clock but the run's.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { measuredDistance } from "../mapgen/ski-jump.ts";
import { JUMP } from "./defs/ski-jump-flight.ts";
import { TUNING } from "./defs/tuning.ts";
import { throwRider } from "./crash.ts";
import { hillFrame, hillWind, massOf, slopeAt } from "./jump-inrun.ts";
import { derive } from "./skier.ts";
import type { GameEvent, GameState, SkierInput } from "./state.ts";
import type { SkiJumpState } from "./ski-jump-state.ts";

const D = Math.PI / 180;
const P = JUMP.polar;
const A = JUMP.attitude;
const LD = JUMP.landing;

/** A row of the polar at `alpha` deg, read linearly between its rows. */
function tableAt(rows: readonly number[], alpha: number): number {
  const xs = P.alpha;
  if (alpha <= xs[0]) return rows[0];
  for (let i = 1; i < xs.length; i++) {
    if (alpha <= xs[i]) {
      const f = (alpha - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return rows[i - 1] + (rows[i] - rows[i - 1]) * f;
    }
  }
  return rows[rows.length - 1];
}

/** THE POLAR: the lift and drag areas, m², of the jumper laid out in the
 * V-style at an angle of attack of `alpha` deg (negative read as its
 * mirror's lift turned down). */
export function polarAt(alpha: number): { lift: number; drag: number } {
  const a = Math.abs(alpha);
  const lift = tableAt(P.lift, a) * Math.sign(alpha || 1) * P.scale;
  return { lift, drag: tableAt(P.drag, a) * P.scale };
}

/** THE IDEAL ANGLE OF ATTACK `t` s after the edge, deg (`attitude.ideal`). */
export function idealAoa(t: number): number {
  const rows = A.ideal;
  if (t <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) {
    if (t <= rows[i][0]) {
      const u = (t - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0]);
      const s = u * u * (3 - 2 * u);
      return rows[i - 1][1] + (rows[i][1] - rows[i - 1][1]) * s;
    }
  }
  return rows[rows.length - 1][1];
}

/** The angle of attack he holds `t` s into the flight, deg: the trim the
 * air carries him to eased toward the ideal by the assist's hand, the lean
 * moving him off it (back up, forward down). */
function heldAoa(state: GameState, input: SkierInput, t: number): number {
  const hand = clamp(state.assist.air, 0, 1);
  const base = A.trim + (idealAoa(t) - A.trim) * hand;
  const reach = A.lean.bare + (A.lean.assisted - A.lean.bare) * hand;
  return base + clamp(input.lean, -1, 1) * reach;
}

/** ONE STEP OF THE FLIGHT, `dt` s of it (the rest of the edge's step, or a
 * whole one). On the feet's touch the jump is down. */
export function stepFlight(
  state: GameState,
  input: SkierInput,
  events: GameEvent[],
  dt: number,
): void {
  const j = state.jump!;
  if (j.stage !== "air" || dt <= 0) return;
  const hill = state.level.skiJump!;
  const c = state.skier;
  const m = massOf(c);
  const L = JUMP.layout;
  const t = state.t - j.edgeAt;
  // THE TRANSITION: laid out over the skis, the V opened.
  const slow = 1 + L.slow * (1 - j.record.share);
  j.lay = Math.min(1, j.lay + dt / (L.time * slow));
  const open = state.assist.air >= LD.auto || input.tuck >= 0.5;
  if (t >= L.veeFrom) {
    j.vee = open ? Math.min(1, j.vee + dt / L.veeOpen) : Math.max(0, j.vee - dt / L.veeClose);
  }
  if (j.vee >= 0.9 && j.record.veeAt < 0) j.record.veeAt = t;
  // THE AIR at him, over the snow under him.
  const ground = hill.yAt(j.along);
  const gap = j.y - LD.feet - ground;
  const wind = hillWind(state, j, gap + LD.feet);
  // THE LANDING MADE READY: the trick key, or the assist's hand near the
  // snow.
  if (j.prepAt < 0 && t > L.time) {
    const asked = input.trick === true;
    const auto = state.assist.air >= LD.auto && gap < LD.autoAt && j.vy < 0;
    if (asked || auto) j.prepAt = state.t;
  }
  // THE AIR PAST HIM. Near the hill the air FOLLOWS ITS SLOPE, keeping its
  // speed over the ground's plan (the wind is read level, as the hill's
  // stations read it): a head wind blows up the landing hill, rising as it
  // goes — the updraft a jumper is carried on — and a tail wind down it.
  const beta = slopeAt(hill, j.along);
  const ru = j.va + wind.head;
  const rw = j.vw - wind.across;
  const ry = j.vy - wind.head * Math.tan(beta);
  const gamma = Math.atan2(-ry, ru);
  // THE ATTITUDE HELD, and the take-off's error in it, dying away. He
  // holds it against his path over the snow — the hill is what he sees,
  // not the air — so the wind's turn of the air past him is in his angle
  // of attack: a head wind's updraft raises it, a tail wind lowers it.
  j.error *= Math.exp(-dt / JUMP.rotation.settle);
  const held = j.prepAt >= 0 ? LD.prepAoa : heldAoa(state, input, t);
  const lag = j.prepAt >= 0 ? LD.prepLag : A.lag;
  const turn = (gamma - Math.atan2(-j.vy, j.va)) * A.wind;
  const want = held * D + j.error + turn;
  j.aoa += (want - j.aoa) * Math.min(1, dt / lag);
  // ...and under the moment's turn, run away: over.
  if (j.lay >= 0.9 && j.aoa < A.over * D) {
    j.aoa -= A.diverge * (A.over * D - j.aoa) * dt;
    if (j.aoa < 0) j.record.lost = true;
  }
  j.aoa = Math.max(A.least * D, j.aoa);
  // THE ROLL: the edge's, the wind across's, the hand's levelling.
  const R = JUMP.roll;
  j.roll +=
    (clamp(input.steer, -1, 1) * R.rate +
      wind.across * R.cross -
      (clamp(state.assist.air, 0, 1) * j.roll) / R.level) *
    dt;
  if (Math.abs(j.roll) > R.lost) j.record.lost = true;
  j.record.roll = Math.max(j.record.roll, Math.abs(j.roll) / D);
  // THE FORCES: the air past him, the areas at its angle.
  const V = hypot3(ru, rw, ry);
  const size = Math.pow(m / P.mass, 2 / 3);
  const laid = polarAt(j.aoa / D);
  const vee = P.closed.lift + (1 - P.closed.lift) * j.vee;
  const veeDrag = P.closed.drag + (1 - P.closed.drag) * j.vee;
  let lift = P.crouch.lift + (laid.lift * vee - P.crouch.lift) * j.lay;
  let drag = P.crouch.drag + (laid.drag * veeDrag - P.crouch.drag) * j.lay;
  if (j.record.lost) {
    lift = P.tumble.lift;
    drag = P.tumble.drag;
  }
  const q = 0.5 * j.density * V * V * size;
  const Lf = (q * lift) / m;
  const Df = (q * drag) / m;
  const inv = V > 1e-6 ? 1 / V : 0;
  // Lift at right angles to the air in the hill's upright plane, rolled.
  const lu = Math.sin(gamma);
  const ly = Math.cos(gamma);
  const cr = Math.cos(j.roll);
  const sr = Math.sin(j.roll);
  const au = Lf * lu * cr - Df * ru * inv;
  const aw = Lf * sr - Df * rw * inv;
  const ay = Lf * ly * cr - Df * ry * inv - TUNING.g;
  j.va += au * dt;
  j.vw += aw * dt;
  j.vy += ay * dt;
  const along0 = j.along;
  const gap0 = gap;
  j.along += j.va * dt;
  j.across += j.vw * dt;
  j.y += j.vy * dt;
  // THE RECORD as he flies.
  const after = j.lay >= 1 && j.prepAt < 0;
  if (after) j.errSum += Math.abs(j.aoa / D - idealAoa(t)) * dt;
  j.windSum += wind.head * dt;
  j.timeSum += dt;
  const over = j.y - hill.yAt(j.along);
  if (over > j.record.peak) {
    j.record.peak = over;
    j.record.peakAt = hill.distanceAt(j.along);
  }
  c.airTime += dt;
  // THE SKIER IN THE AIR: his skis at the angle of attack to the air.
  place(state, j, gamma);
  const gap1 = j.y - LD.feet - hill.yAt(j.along);
  if (gap1 > 0) return;
  // THE FEET ON THE SNOW, where in the step they met it.
  const f = clamp(gap0 / Math.max(1e-9, gap0 - gap1), 0, 1);
  const at = along0 + (j.along - along0) * f;
  touchDown(state, j, at, events);
}

/** The skier as the flight has him. */
function place(state: GameState, j: SkiJumpState, gamma: number): void {
  const f = hillFrame(state);
  const c = state.skier;
  const fx = Math.sin(f.heading);
  const fz = Math.cos(f.heading);
  c.x = f.x + fx * j.along + fz * j.across;
  c.z = f.z + fz * j.along - fx * j.across;
  c.y = j.y;
  c.vx = fx * j.va + fz * j.vw;
  c.vz = fz * j.va - fx * j.vw;
  c.vy = j.vy;
  // Tips up positive: the skis `aoa` over the air coming at `gamma` down.
  c.q = fromEuler(f.heading, j.aoa - gamma, j.roll);
  c.wx = c.wy = c.wz = 0;
  derive(c, state.level);
}

/** THE TOUCH at `at` m of plan: the distance, how he came down, and the
 * skier handed to the engine just over the snow — or thrown. */
function touchDown(state: GameState, j: SkiJumpState, at: number, events: GameEvent[]): void {
  const hill = state.level.skiJump!;
  const c = state.skier;
  const r = j.record;
  const slope = slopeAt(hill, at + 0.05);
  r.reach = hill.distanceAt(at);
  r.distance = measuredDistance(r.reach);
  r.flightTime = state.t - j.edgeAt;
  r.landingSpeed = hypot3(j.va, j.vw, j.vy);
  // Into the slope: the velocity against its upward normal.
  r.into = Math.max(0, -(j.va * Math.sin(slope) + j.vy * Math.cos(slope)));
  r.attitude = j.timeSum > 0 ? j.errSum / Math.max(1e-6, j.timeSum - JUMP.layout.time) : 0;
  r.wind = j.timeSum > 0 ? j.windSum / j.timeSum : 0;
  const aoa = j.aoa / D;
  const fell = r.lost || aoa > LD.sat || Math.abs(j.roll) > LD.rolled;
  const since = j.prepAt >= 0 ? state.t - j.prepAt : -1;
  r.landing = fell ? "fall" : j.prepAt < 0 ? "twoFooted" : since >= LD.late ? "telemark" : "late";
  j.stage = "down";
  j.along = at;
  events.push({
    kind: "skiJump",
    t: state.t,
    stage: "touch",
    speed: r.landingSpeed,
    distance: r.distance,
  });
  // On the snow: his centre stood over his feet along its normal, his skis
  // down its line, still coming in at his speed into it.
  const f = hillFrame(state);
  const fx = Math.sin(f.heading);
  const fz = Math.cos(f.heading);
  const h = c.spec.cogHeight;
  const sx = f.x + fx * at + fz * j.across;
  const sz = f.z + fz * at - fx * j.across;
  c.x = sx + fx * Math.sin(slope) * h;
  c.z = sz + fz * Math.sin(slope) * h;
  c.y = hill.yAt(at) + Math.cos(slope) * h + 0.02;
  c.q = fromEuler(f.heading, -slope, j.roll);
  c.wx = c.wy = c.wz = 0;
  derive(c, state.level);
  if (fell) {
    r.outcome = "fall";
    const cause = r.lost ? "faceplant" : Math.abs(j.roll) > LD.rolled ? "roll" : "slam";
    throwRider(state, cause, { x: c.vx, y: c.vy, z: c.vz }, events);
  }
}

/** AFTER THE TOUCH: what the engine's legs made of it (the `land` event's
 * load), a telemark set on the snow late, a hand down, a fall, and the
 * fall line reached clean. */
export function noteDown(state: GameState, input: SkierInput, events: GameEvent[]): void {
  const j = state.jump;
  if (!j || j.stage !== "down") return;
  const r = j.record;
  for (const e of events) {
    if (e.kind === "land" && r.load === 0) r.load = e.g;
    else if (e.kind === "wipeout" && r.outcome !== "fall") {
      r.outcome = "fall";
      if (state.t - j.edgeAt - r.flightTime < 1.5) r.landing = "fall";
    } else if (e.kind === "save" && e.save === "body" && r.outcome === "pending") {
      r.outcome = "touch";
    }
  }
  if (
    r.landing === "twoFooted" &&
    input.trick === true &&
    state.t - j.edgeAt - r.flightTime <= LD.after
  ) {
    r.landing = "late";
  }
  const p = state.progress;
  if (p.out && r.outcome !== "fall") r.outcome = "fall";
  else if (p.finished && (r.outcome === "pending" || r.outcome === "touch")) {
    if (r.outcome === "pending") r.outcome = "clean";
  }
}

/** Whether the flight is under way: the air is the jump's. */
export function jumpFlying(state: GameState): boolean {
  return state.jump?.stage === "air";
}

/** The speed of a jump's flight as the HUD reads it: |v| in the air. */
export function flightSpeed(j: SkiJumpState): number {
  return hypot(j.va, j.vy);
}
