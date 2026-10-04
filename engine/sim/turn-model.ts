// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT'S MODEL OF A CARVED TURN — what the slalom's planner
// (`slalom-plan.ts`) skis a way of steering forward on, a moment at a
// time: the physics' own limits, read off `limits.ts` and `incline.ts`,
// on a skier reduced to a handful of numbers.
//
//   * THE EDGE rolls at the skier's rate (`steer.edgeRate` × the pair's ×
//     the technique's) toward the edge asked — but never further over than
//     his body is laid to that side plus his angulation (`edgeWithin`'s
//     rule: |incline| + `skier.angulateMost`).
//   * THE SKIS TURN at the rate the carve that edge buys asks of the yaw
//     hand: the sidecut's arc (`carveCurvature`, the tips and the cut
//     tightening it) no tighter than the ski's geometry bends
//     (`carveMost`, R·cos edge), no faster than the corner grip turns the
//     way (`steer.pathShare`), the nose held toward the way he is going
//     (`steer.slipHold` against `yawHold`).
//   * THE WAY turns only by the snow's grip across skis pointed off it
//     (`grip.sideRef`, the corner grip at that edge its most), less the
//     slope's pull across it — so a skier whose skis point inside the old
//     turn goes on round it until they have swung through his way.
//   * THE BALANCE of the turn he is making (the snow's grip across his
//     skis over its push) eased over `skier.balanceLag`; and THE LEAN held
//     toward it, committed on toward the bend the edge asked for wants and
//     gated by the old turn's load (`inclineTarget`'s rule), reached
//     `LEAN_LAG` late.
//
//   * THE CHECK he asks for pivots the skis the way he steers
//     (`skidAngleAt`) and slides them (`grip.skidHold`); and HIS SPEED
//     is the pitch's pull less the base, the air, the skid's drag and the
//     share of the snow's grip skis pointed off his way push back along it.
//
// Two numbers are this model's own and not the physics': the lean's lag
// and the share of the corner grip the way is turned with, both measured
// (the model's open-loop prediction against the engine's own run),
// because the physics has no single number for either — the lean is a
// roll spring and damper on the body's inertia under the snow's moments,
// the grip six stations' loads. Pure: it reads the state and writes only
// the model.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { trackPointAt } from "../mapgen/index.ts";
import type { TrackPoint } from "../mapgen/types.ts";
import { techniqueOf } from "../game/defs/technique.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { footprintOf } from "../game/footprint.ts";
import { leanMostOf } from "../game/incline.ts";
import { carveCurvature, carveMost, cornerGrip, edgeLockAt, edgeMostOf } from "../game/limits.ts";
import { dragAreaOf } from "../game/air.ts";
import { skidAngleAt } from "../game/skier.ts";
import { totalMass } from "../game/defs/skis.ts";
import type { GameState } from "../game/state.ts";

/** How late the body's lean follows the lean it is held toward, s — a
 * first-order lag fitted to the engine's roll on the 20° strip (a turn
 * every 0.9–1.1 s): the lean ~15° off over 0.3 s, the way 4–5° off and
 * the line 0.15 m. */
export const LEAN_LAG = 0.25;
/** The share of the corner grip at an edge (`cornerGrip`, pressed) the
 * snow turns his way with — fitted the same way down real slaloms (the
 * line 0.2 m off over 0.6 s, a check in it or not): the stations' loads
 * and the shake under them take the rest. */
export const GRIP_SHARE = 0.7;
/** The longest step the model is skied on, s: the skis' slip off the way
 * settles in a few hundredths of a second. */
export const TURN_STEP = 0.025;

/** How many edges the carve, the grip and the lean asked are tabled at,
 * flat to the edge held. */
const TABLE = 16;

/** A skier as the model has him: where he is against the line's frame
 * (`u` along, `y` right, m; `psi` his way's heading off the piste's,
 * rad, right positive), how far his skis point off his way (`slip`, rad,
 * right positive), his edge, the turn's balance and his lean (rad, right
 * side down positive). */
export type TurnState = {
  u: number;
  y: number;
  psi: number;
  slip: number;
  edge: number;
  balance: number;
  lean: number;
  skid: number;
  /** His speed, m/s. */
  v: number;
};

export function createTurnState(): TurnState {
  return { u: 0, y: 0, psi: 0, slip: 0, edge: 0, balance: 0, lean: 0, skid: 0, v: 0 };
}

/** What a decision's model is read off, tabled once a decision. */
export type TurnModel = {
  speed: number;
  /** The edge he rolls at, rad/s, and the most he cuts the skis to now. */
  rate: number;
  held: number;
  /** The slope's pull across his line, m/s² at a heading of 90° off the
   * piste, and the snow's push along its normal, m/s². */
  across: number;
  normal: number;
  packed: number;
  /** At each tabled edge: the yaw rate the carve asks for, rad/s; the
   * grip across the skis, m/s²; and the lean the bend that edge asks for
   * balances, rad. */
  yaw: Float64Array;
  grip: Float64Array;
  asked: Float64Array;
  leanMost: number;
  /** THE CHECK he is about to ask for (the brake, 0..1), and how far a
   * skid pivots the skis at this speed, rad (`skidAngleAt`). */
  brake: number;
  skidAngle: number;
  /** The air's drag on him, 1/m (a m/s² per (m/s)²). */
  air: number;
};

export function createTurnModel(): TurnModel {
  return {
    speed: 0,
    rate: 0,
    held: 0.2,
    across: 0,
    normal: TUNING.g,
    packed: 1,
    yaw: new Float64Array(TABLE + 1),
    grip: new Float64Array(TABLE + 1),
    asked: new Float64Array(TABLE + 1),
    leanMost: 0,
    brake: 0,
    skidAngle: 0,
    air: 0,
  };
}

const pa: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const pb: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };

/** Table `m` for the skier in `state` at arc `s` of the piste, about to
 * ask for `brake`. */
export function readTurnModel(state: GameState, s: number, brake: number, m: TurnModel): void {
  const c = state.skier;
  const spec = c.spec;
  const T = techniqueOf(state.rules);
  const CV = TUNING.carve;
  const S = TUNING.steer;
  const speed = Math.max(3, hypot(c.vx, c.vz));
  m.speed = speed;
  m.packed = c.packed;
  m.rate = S.edgeRate * footprintOf(spec).edgeRate * T.edgeRate;
  m.held = Math.max(
    0.2,
    Math.min(edgeMostOf(spec, T), edgeLockAt(spec, speed, T) * (1 + CV.edge * c.carve)),
  );
  m.leanMost = leanMostOf(T);
  m.brake = brake;
  m.skidAngle = skidAngleAt(speed);
  m.air = (0.5 * TUNING.airDensity * dragAreaOf(spec, c.crouch)) / totalMass(spec);
  // The pitch under him, down the piste.
  const grade = Math.atan(
    (trackPointAt(state.level, s - 3, pa).y - trackPointAt(state.level, s + 3, pb).y) / 6,
  );
  m.across = TUNING.g * Math.sin(grade);
  m.normal = TUNING.g * Math.cos(grade);
  const pressed = 1 + CV.grip * c.carve;
  const tight = (1 - S.tipLoad * c.lean) * (1 + CV.tighten * c.carve);
  const cut = 1 + CV.tighten * c.carve;
  for (let i = 0; i <= TABLE; i++) {
    const e = (m.held * i) / TABLE;
    const grip = cornerGrip(spec, c.packed, speed, e, T) * pressed;
    const most = carveMost(spec, e);
    // The yaw hand's: the carve's rate, no faster than the grip turns the
    // way at (`steer.pathShare`).
    m.yaw[i] = Math.min(
      speed * Math.min(carveCurvature(spec, e) * tight, most),
      (grip * S.pathShare) / speed,
    );
    m.grip[i] = grip;
    // ...and the lean the bend this edge ASKS for balances, as
    // `inclineTarget` reads it (the cut without the tips' share).
    m.asked[i] = Math.atan2(
      Math.min(speed * speed * Math.min(carveCurvature(spec, e) * cut, most), grip),
      TUNING.g,
    );
  }
}

/** A tabled column at `edge` rad (signed). */
function at(m: TurnModel, col: Float64Array, edge: number): number {
  const f = Math.min(TABLE, (Math.abs(edge) / m.held) * TABLE);
  const i = Math.min(TABLE - 1, Math.floor(f));
  return Math.sign(edge) * (col[i] + (col[i + 1] - col[i]) * (f - i));
}

/** Stand `t` where the skier in `state` is: `y0` m right of the line's
 * frame, his way `psi0` rad off the piste's heading `heading`. */
export function startTurn(
  state: GameState,
  y0: number,
  psi0: number,
  heading: number,
  t: TurnState,
): void {
  const c = state.skier;
  t.u = 0;
  t.y = y0;
  t.psi = psi0;
  t.slip = angleDiff(psi0 + heading, c.heading);
  t.edge = c.edge;
  t.balance = c.balance;
  t.lean = c.incline;
  t.skid = c.skid;
  t.v = Math.max(3, hypot(c.vx, c.vz));
}

/** Ski `t` on for `dt` s (no more than `TURN_STEP`) with the edge `want`
 * rad asked. */
export function stepTurn(m: TurnModel, t: TurnState, want: number, dt: number): void {
  const K = TUNING.skier;
  const S = TUNING.steer;
  // THE EDGE, no further over than the body is laid plus his angulation.
  const reach = K.angulateMost + Math.max(0, t.lean * Math.sign(want)) + (1 - m.packed) * Math.PI;
  const goal = Math.sign(want) * Math.min(Math.abs(want), reach);
  t.edge += clamp(goal - t.edge, -m.rate * dt, m.rate * dt);
  // THE SKIS turn at the rate the carve asks, the nose held to the way;
  // THE WAY is turned by the snow's grip across skis pointed off it, less
  // the slope's pull across it.
  // A CHECK pivots the skis toward the side he steers to and slides them:
  // their grip falls to `grip.skidHold` of it as they bite.
  const v = t.v;
  const G = TUNING.grip;
  t.skid += clamp(m.brake - t.skid, -S.skidRate * dt, S.skidRate * dt);
  const pivot = t.skid * m.skidAngle * clamp((2 * want) / Math.max(m.held, 1e-3), -1, 1);
  const keep = 1 - t.skid * (1 - G.skidHold) * clamp(v / G.skidBite, 0, 1);
  const yaw = at(m, m.yaw, t.edge) - (S.slipHold / S.yawHold) * t.slip;
  const grip = GRIP_SHARE * Math.abs(at(m, m.grip, t.edge)) * keep;
  const skew = Math.sin(t.slip + pivot);
  const snow = grip * Math.tanh((v * skew) / G.sideRef);
  // THE SPEED: the pitch's pull along his way less the base's friction,
  // the air's drag, the skid's own and the share of the snow's grip a ski
  // pointed off his way pushes back along it.
  t.v = Math.max(
    1,
    v +
      (m.across * Math.cos(t.psi) -
        m.normal * (TUNING.snow.crrPacked + S.skidDrag * t.skid) -
        m.air * v * v -
        Math.abs(snow * skew)) *
        dt,
  );
  const turn = (snow - m.across * Math.sin(t.psi)) / v;
  t.slip += (yaw - turn) * dt;
  t.psi += turn * dt;
  t.u += v * Math.cos(t.psi) * dt;
  t.y += v * Math.sin(t.psi) * dt;
  // THE BALANCE: the snow's grip across his skis over its push.
  t.balance += (Math.atan2(snow, m.normal) - t.balance) * Math.min(1, dt / K.balanceLag);
  // THE LEAN, held toward that balance committed on toward the one the
  // edge asked for wants — across, only as the old turn's load lets go.
  const asked = at(m, m.asked, want);
  const opposed = asked * t.balance < 0;
  const commit =
    K.commit * (opposed ? clamp(1 - Math.abs(Math.tan(t.balance)) / K.crossLoad, 0, 1) : 1);
  const target =
    clamp(t.balance + commit * (asked - t.balance), -m.leanMost, m.leanMost) * m.packed +
    (want / Math.max(m.held, 1e-3)) * K.rollPowder * (1 - m.packed);
  t.lean += (target - t.lean) * Math.min(1, dt / LEAN_LAG);
}
