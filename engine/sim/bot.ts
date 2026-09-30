// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The bot skier — a deterministic player stand-in that reads the same
// GameState the HUD reads and produces the same SkierInput a thumb
// produces. It skis the PISTE'S CENTRELINE — or a LANE beside it, the line
// a rival started on: a point a speed-dependent distance ahead of where it
// stands on the piste, that far across it, is what it edges toward;
// it reads the bends coming and skids off speed for the ones it cannot
// carve at the speed it has, and for a kicker it would overshoot; it tucks
// wherever nothing asks it not to; off the piste before the start gate (a
// hand-built map's start line in the powder), it skis onto the piste short
// of the gate, so it crosses it skiing down it; it levels itself to the
// slope it is going to land on while in the air; it skis round a trunk in
// its way; and it asks to be reset when a gate has not come for too long.
//
// It must never reach into the physics' internals: everything it knows it
// reads off the state, the level and `limits.ts`. The target is a COMPETENT
// skier — human capability, never a superhuman one: it sees the piste ahead
// the way a skier does and skids with the grip a skier has.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { arcAhead, nearestTrackPoint, trackPointAt } from "../mapgen/index.ts";
import type { Kicker, Level, TrackHit, TrackPoint } from "../mapgen/types.ts";
import { treesNear } from "../game/collision.ts";
import { brakeDecel, cornerGrip, edgeLockAt, flightGravity, harshSpeedOf } from "../game/limits.ts";
import type { SkiSpec } from "../game/defs/skis.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "../game/state.ts";

export type BotProfile = {
  /** How far ahead along the piste the aim point stands, m, at rest, and
   * how many more metres per m/s of speed. */
  lookBase: number;
  lookPerSpeed: number;
  /** Steering gain on the bearing error, per radian, and how far ahead the
   * bot reads its own yaw rate, s — the correction is judged against the
   * heading the body will have carried itself to. */
  steerGain: number;
  yawLead: number;
  /** In powder: how much further ahead the yaw is read (a share more of
   * `yawLead`), and how much of the gain is given up. */
  powderLead: number;
  powderEase: number;
  /** The share of the corner grip (`limits.ts`) the bot carves a bend at,
   * and of the braking grip it plans its skid on. */
  cornerShare: number;
  brakeShare: number;
  /** The share of the edge that catches (`skier.slipEdge`) the bot stands
   * his skis up to while they are pivoted in a skid or still sliding
   * across their line. */
  slideEdge: number;
  /** How far off the arc a bend is measured over, m, either side. */
  bendSpan: number;
  /** Pitch gains in the air: on the error to the slope ahead, and on the
   * pitch rate. */
  airGain: number;
  airDamp: number;
  /** Before the start gate: how far short of it the bot aims onto the
   * piste, as a share of how far off the piste it is, and the least and
   * most that may be, m. */
  entryShare: number;
  entryMin: number;
  entryMax: number;
  /** How far ahead it watches for a trunk, m, how wide a corridor, m, and
   * how far off its line it moves its aim to miss one, m. */
  treeLook: number;
  treeCorridor: number;
  dodge: number;
  /** Seconds without a gate before it asks to be reset. */
  giveUpAfter: number;
  /** The least speed any turn is planned at, m/s — a skier slower than
   * this turns poorly and bogs in powder. */
  crawl: number;
  /** The share of the harsh-landing speed (`air.harshSpeed`) a kicker is
   * planned to be landed under. */
  kickerMargin: number;
  /** The turn onto the piste out of the start line's powder is planned at
   * this radius, m. */
  entryRadius: number;
  /** THE TUCK: how far over the speed the bends allow it stands up out of
   * the tuck, m/s, and how far over it skids. */
  standOver: number;
  skidOver: number;
};

export const RIDER_BOT: BotProfile = {
  lookBase: 8,
  lookPerSpeed: 0.5,
  steerGain: 1.6,
  yawLead: 0.45,
  powderLead: 1,
  powderEase: 0.45,
  cornerShare: 0.7,
  brakeShare: 0.7,
  slideEdge: 0.8,
  bendSpan: 8,
  airGain: 2.2,
  airDamp: 0.6,
  entryShare: 0.15,
  entryMin: 8,
  entryMax: 14,
  treeLook: 28,
  treeCorridor: 1.4,
  dodge: 4,
  giveUpAfter: 35,
  crawl: 6,
  kickerMargin: 0.85,
  entryRadius: 12,
  standOver: 0,
  skidOver: 1.5,
};

const hit: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
const pa: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const pb: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const pc: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const near: number[] = [];

/** Where on the piste the skier stands, restricted to the stretch between
 * the last gate he took and the one he owes — so a switchback's other leg a
 * few metres away is never mistaken for his own, and a gate gone past is
 * skied back to. Writes `hit`. */
function locate(state: GameState): TrackHit {
  const level = state.level;
  const p = state.progress;
  const cps = level.checkpoints;
  const c = state.skier;
  // A FREE RIDE owes nothing, so there is no stretch to hold him to: he is
  // wherever the piste is nearest.
  if (!state.rules.course) return nearestTrackPoint(level, c.x, c.z, hit);
  const sNext = cps[p.nextCheckpoint].s;
  const from = Math.max(0, p.lastCheckpoint >= 0 ? cps[p.lastCheckpoint].s - 20 : sNext - 200);
  const to = Math.min(level.track.length, sNext + 20);
  nearestTrackPoint(level, c.x, c.z, hit);
  if (hit.s >= from && hit.s <= to) return hit;
  // The nearest centreline is another stretch's: walk this one.
  const pts = level.track.points;
  let best = Infinity;
  for (let s = from; s <= to; s += 2) {
    const at = trackPointAt(level, s, pa);
    const dd = hypot(at.x - c.x, at.z - c.z);
    if (dd < best) {
      best = dd;
      hit.s = at.s;
      hit.x = at.x;
      hit.z = at.z;
      hit.distance = dd;
    }
  }
  hit.index = Math.min(pts.length - 1, Math.floor((hit.s / level.track.length) * pts.length));
  return hit;
}

/** How sharp the piste bends at arc `s`, 1/m. */
function bendAt(level: Level, s: number, span: number): number {
  trackPointAt(level, s - span, pa);
  trackPointAt(level, s + span, pb);
  return Math.abs(angleDiff(pa.heading, pb.heading)) / (2 * span);
}

/** How near the piste's edge a lane may run, m: clear of the flat shoulder
 * and the windrow's bench (R8, R18) whatever the piste's width here, and
 * further in the faster the skier goes (`LANE_DRIFT` m per m/s) — a skid
 * into a bend carries him outward by about that, and a lane held on the
 * outside of one at speed was a skier skidded off the piste into the
 * powder. So the field holds its slots out of the gate and closes on the
 * racing line as it gathers pace. */
const LANE_MARGIN = 3;
const LANE_DRIFT = 0.25;

/** How far short of a kicker's lip the bot is at the speed it takes it at,
 * m — about the length of the ramp. */
const KICKER_RUNUP = 10;

/** THE SPEED A KICKER WANTS, m/s: the fastest a skier can leave its lip and
 * still come down on its landing rather than past it — found by flying a
 * point off the lip at the ramp's own angle over the real snow, at each
 * speed in turn, until the impact into the slope would fold the legs of
 * the skier on these skis. A skier learns this on his first run; the bot
 * is handed it. Worked out once per kicker per pair. */
const kickerSpeeds = new WeakMap<SkiSpec, Map<number, WeakMap<Kicker, number>>>();
function kickerSpeed(
  level: Level,
  k: Kicker,
  spec: SkiSpec,
  profile: BotProfile,
  fall: number,
): number {
  let bySpec = kickerSpeeds.get(spec);
  if (!bySpec) {
    bySpec = new Map();
    kickerSpeeds.set(spec, bySpec);
  }
  let mine = bySpec.get(fall);
  if (!mine) {
    mine = new WeakMap();
    bySpec.set(fall, mine);
  }
  const known = mine.get(k);
  if (known !== undefined) return known;
  const fx = Math.sin(k.heading);
  const fz = Math.cos(k.heading);
  const lip = level.groundAt(k.x, k.z);
  // The ramp rises as t² (`kickerProfile`), steepest AT the lip, so its
  // grade over the last 2 m reads flatter than the one the skier leaves on:
  // the profile's own share of that difference is put back, exactly.
  const back = Math.min(2, k.ramp);
  const averaged = (k.height * (1 - (1 - back / k.ramp) ** 2)) / back;
  const angle = Math.atan(
    (lip - level.groundAt(k.x - fx * back, k.z - fz * back)) / back +
      (2 * k.height) / k.ramp -
      averaged,
  );
  const floor = 0.9;
  const limit = harshSpeedOf(spec) * profile.kickerMargin;
  const n = { x: 0, y: 1, z: 0 };
  let best = 8;
  for (let v = 8; v <= 45; v += 1) {
    let x = k.x;
    let z = k.z;
    let y = lip + floor;
    const h = v * Math.cos(angle);
    let vy = v * Math.sin(angle);
    let impact = 0;
    for (let t = 0; t < 5; t += 0.02) {
      x += fx * h * 0.02;
      z += fz * h * 0.02;
      vy -= fall * 0.02;
      y += vy * 0.02;
      if (y <= level.groundAt(x, z) + floor) {
        level.normalAt(x, z, n);
        impact = -(fx * h * n.x + vy * n.y + fz * h * n.z);
        break;
      }
    }
    if (impact > limit) break;
    best = v;
  }
  mine.set(k, best);
  return best;
}

/** The fastest the skier may be going NOW for every bend and kicker within
 * skidding reach to be taken at its own speed, m/s. */
function speedAllowed(state: GameState, s: number, speed: number, profile: BotProfile): number {
  const level = state.level;
  const spec = state.skier.spec;
  const aLat = cornerGrip(spec, 1) * profile.cornerShare;
  const decel = brakeDecel(spec, 1) * profile.brakeShare;
  const reach = (speed * speed) / (2 * decel) + 30;
  const y0 = trackPointAt(level, s, pc).y;
  let allowed = Infinity;
  for (let d = 0; d <= reach; d += 4) {
    // THE SKIDDING ROOM, less what the fall of the piste gives back: a skid
    // down a steep pitch sheds only what it takes beyond the slope's own
    // pull, so the height the piste drops by the bend is paid out of it
    // (v² = v_bend² + 2·a·d − 2·g·drop). The bends themselves shed little
    // (`steer.scrub`), so a skier who planned for the brake alone on a
    // steep pitch arrives at the bend still carrying the pitch.
    const drop = Math.max(0, y0 - trackPointAt(level, s + d, pc).y);
    const room = Math.max(0, 2 * decel * Math.max(0, d - 6) - 2 * TUNING.g * drop);
    // The room alone already allows what is allowed: no bend this far on,
    // however tight, can lower it — nor any further on, the room only ever
    // growing on a piste that never climbs faster than the brake bites.
    if (Math.sqrt(room) >= allowed && drop === 0) break;
    const k = bendAt(level, s + d, profile.bendSpan);
    if (k < 1e-4) continue;
    const corner = Math.sqrt(aLat / k);
    const now = Math.sqrt(corner * corner + room);
    if (now < allowed) allowed = now;
  }
  for (const k of level.kickers ?? []) {
    if (!k.onTrack || k.s === undefined) continue;
    const d = arcAhead(level, s, k.s);
    if (d < 0 || d > reach) continue;
    const v = kickerSpeed(level, k, spec, profile, flightGravity(state.rules));
    // At its speed a ramp's length SHORT of the lip, and steady up the ramp:
    // a skier skidding on the lip loads his tips, and with them gone over
    // the crest he pitches onto them before he has left the snow.
    const now = Math.sqrt(v * v + 2 * decel * Math.max(0, d - KICKER_RUNUP));
    if (now < allowed) allowed = now;
  }
  return allowed;
}

/** Move the aim off a trunk standing in the line from the skier to it. */
function dodgeTrees(
  state: GameState,
  tx: number,
  tz: number,
  profile: BotProfile,
): [number, number] {
  const c = state.skier;
  const dx = tx - c.x;
  const dz = tz - c.z;
  const len = hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const look = Math.min(len, profile.treeLook);
  treesNear(state.level, c.x + (ux * look) / 2, c.z + (uz * look) / 2, look / 2 + 2, near);
  let bestAlong = Infinity;
  let side = 0;
  for (const i of near) {
    const t = state.level.trees[i];
    const rx = t.x - c.x;
    const rz = t.z - c.z;
    const along = rx * ux + rz * uz;
    if (along <= 0 || along > look) continue;
    const across = rx * uz - rz * ux;
    if (Math.abs(across) > profile.treeCorridor + t.radius) continue;
    if (along < bestAlong) {
      bestAlong = along;
      // Pass on the side the trunk is NOT on (positive across is to the
      // right of travel, since right of (ux, uz) is (uz, −ux)).
      side = across >= 0 ? -1 : 1;
    }
  }
  if (side === 0) return [tx, tz];
  // Right of travel is (uz, −ux).
  return [tx + uz * side * profile.dodge, tz - ux * side * profile.dodge];
}

/** The bot's controls for this step. `lane` is the line it holds down the
 * piste, m right of the centreline — a rival's own slot's (`rivals.ts`); the
 * centreline, the racing line, when nothing says (the player's stand-in in
 * the sim and the labs) — held in from the edge on a narrow stretch. */
export function botInput(state: GameState, profile: BotProfile = RIDER_BOT, lane = 0): SkierInput {
  const c = state.skier;
  const p = state.progress;
  const level = state.level;
  if (p.finished) return { ...NEUTRAL_INPUT };
  // GIVE UP on a stretch that has gone nowhere for too long.
  // (A free ride has no gate to wait for; its only way back is the
  // engine's own, off his back or bogged.)
  if (
    state.rules.course &&
    p.time - Math.max(p.lastPassedAt, p.lastResetAt) > profile.giveUpAfter
  ) {
    return { ...NEUTRAL_INPUT, reset: true };
  }
  const speed = c.speed;
  const on = locate(state);
  const cps = level.checkpoints;
  const L = level.track.length;
  let aimS = Math.min(L, on.s + profile.lookBase + profile.lookPerSpeed * speed);
  // BEFORE THE START GATE and off the piste (a start line in the powder, on
  // a hand-built map): aim onto the piste SHORT of the gate, so it is
  // crossed skiing down the piste.
  const halfWidth = trackPointAt(level, on.s, pa).width / 2;
  if (state.rules.course && !p.started && p.nextCheckpoint === 0 && on.distance > halfWidth) {
    const short = clamp(on.distance * profile.entryShare, profile.entryMin, profile.entryMax);
    const toLine = cps[0].s - on.s;
    if (toLine - short <= aimS - on.s) aimS = Math.max(0, cps[0].s - short);
  }
  const aim = trackPointAt(level, aimS, pb);
  // THE LANE: the aim stands that far right of the centreline, no nearer
  // the edge than the margin allows here.
  if (lane !== 0) {
    const room = Math.max(0, aim.width / 2 - LANE_MARGIN - LANE_DRIFT * speed);
    const across = clamp(lane, -room, room);
    aim.x += Math.cos(aim.heading) * across;
    aim.z -= Math.sin(aim.heading) * across;
  }
  // PAST THE FINISH the piste ends: aim straight on down its last heading.
  if (aimS >= L - 0.01) {
    const over = on.s + profile.lookBase + profile.lookPerSpeed * speed - L;
    aim.x += Math.sin(aim.heading) * Math.max(0, over);
    aim.z += Math.cos(aim.heading) * Math.max(0, over);
  }
  const [tx, tz] = dodgeTrees(state, aim.x, aim.z, profile);

  const input: SkierInput = { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false };
  if (c.airborne) {
    // LEVEL TO THE LANDING: pitch toward the slope under where the skier
    // is going, the fall line of the snow a half second on.
    const hs = hypot(c.vx, c.vz);
    const ux = hs > 0.5 ? c.vx / hs : Math.sin(c.heading);
    const uz = hs > 0.5 ? c.vz / hs : Math.cos(c.heading);
    const ax = c.x + c.vx * 0.5;
    const az = c.z + c.vz * 0.5;
    const slope =
      (level.groundAt(ax + ux * 2, az + uz * 2) - level.groundAt(ax - ux * 2, az - uz * 2)) / 4;
    const target = Math.atan(slope);
    const pitchRate = -c.wx;
    input.lean = clamp(profile.airGain * (target - c.pitch) - profile.airDamp * pitchRate, -1, 1);
    input.tuck = 0.3;
    return input;
  }

  // EDGE toward the aim, against the heading the yaw rate is carrying it
  // to. In powder the skis turn off the roll — the carve — which lags the
  // edge by the time it takes to lay the body over, so the bot looks
  // further ahead along its own yaw and asks for less.
  const bearing = Math.atan2(tx - c.x, tz - c.z);
  const powder = 1 - c.packed;
  const yaw = rotate(c.q, { x: c.wx, y: c.wy, z: c.wz }).y;
  const error = angleDiff(
    c.heading + yaw * profile.yawLead * (1 + powder * profile.powderLead),
    bearing,
  );
  input.steer = clamp(profile.steerGain * (1 - powder * profile.powderEase) * error, -1, 1);
  // OUT OF A SKID WITH THE SKIS FLAT: while they are pivoted, or still
  // sliding across their line, the edge is held under what catches
  // (`skier.slipEdge`) — a skier finishing a hockey stop stands his skis up
  // only as the slide dies, and a bot that carved out of one at full edge
  // was thrown by his own high-side.
  const K = TUNING.skier;
  if (c.skid > 0.1 || c.sideSlip > K.slipSpeed * 0.5) {
    const cap = (profile.slideEdge * K.slipEdge) / Math.max(edgeLockAt(c.spec, speed), 0.05);
    input.steer = clamp(input.steer, -cap, cap);
  }

  // THE TUCK AND THE SKID, off the bends within reach — on the piste; out
  // in the powder there is nothing to skid for but the piste itself.
  const onTrack = on.distance <= halfWidth + 2;
  let allowed = onTrack ? speedAllowed(state, on.s, speed, profile) : Infinity;
  // ...and the turn onto the aim itself: pure pursuit's own curvature,
  // 2·sin(error) over the distance to the aim, taken at the grip of the
  // snow the skier is on — which is what slows him for the turn onto the
  // piste out of the powder, and back onto it after running wide.
  if (!p.started && on.distance > halfWidth) {
    const grip = cornerGrip(c.spec, c.packed) * profile.cornerShare;
    const turn = Math.sqrt(grip * profile.entryRadius);
    const left = on.distance - halfWidth;
    allowed = Math.min(
      allowed,
      Math.sqrt(turn * turn + 2 * brakeDecel(c.spec, c.packed) * profile.brakeShare * left),
    );
  }
  const reach = hypot(tx - c.x, tz - c.z);
  const bend = (2 * Math.abs(Math.sin(angleDiff(c.heading, bearing)))) / Math.max(reach, 1);
  if (bend > 1e-3) {
    const grip = cornerGrip(c.spec, c.packed) * profile.cornerShare;
    allowed = Math.min(allowed, Math.max(profile.crawl, Math.sqrt(grip / bend)));
  }
  // Past the finish nothing is owed but a stop: stand up and skid.
  if (p.finished) allowed = 0;
  if (speed > allowed + profile.skidOver) {
    input.tuck = 0;
    input.brake = clamp((speed - allowed) / 3, 0.25, 1);
  } else if (speed > allowed + profile.standOver) {
    input.tuck = 0;
  }
  // A tight bend is carved standing, not tucked: the edge needs the hips —
  // but under a crawl the tuck is the POLES, and a skier poling out of the
  // gate toward the piste's line keeps pushing.
  if (Math.abs(input.steer) > 0.6 && speed >= profile.crawl) input.tuck = Math.min(input.tuck, 0.3);
  return input;
}
