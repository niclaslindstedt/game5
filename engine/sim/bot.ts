// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The bot skier — a deterministic player stand-in that reads the same
// GameState the HUD reads and produces the same SkierInput a thumb
// produces. It skis the PISTE'S CENTRELINE — or a LANE beside it, the line
// a rival started on: a point a speed-dependent distance ahead of where it
// stands on the piste, that far across it, is what it edges toward;
// it reads the bends coming and skids off speed for the ones it cannot
// carve at the speed it has, and for a kicker or a drop (R24) it would
// overshoot; it tucks
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

import { pilotInput } from "../game/heli.ts";
import { sledPilot } from "../game/sled-pilot.ts";
import { paraPilot } from "../game/para-pilot.ts";
import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import {
  arcAhead,
  nearestTrackPoint,
  speedCourseOf,
  speedLineAt,
  trackPointAt,
} from "../mapgen/index.ts";
import type { Cliff, Kicker, Level, TrackHit, TrackPoint } from "../mapgen/types.ts";
import { solidsNear, solidsOf } from "../game/posts.ts";
import { gateLineAt, lineBendAt } from "../game/course.ts";
import {
  brakeDecel,
  carveSpeedOf,
  cornerGrip,
  cutGrip,
  edgeLockAt,
  edgeMostOf,
  flightGravity,
  harshSpeedOf,
} from "../game/limits.ts";
import type { SkiSpec } from "../game/defs/skis.ts";
import { lineSpeed, raceLineAt, raceSpanAt } from "../game/race-line.ts";
import { slalomSteer, type SlalomChoice } from "./slalom-plan.ts";
import { downhillSteer, steerOf } from "./downhill-steer.ts";
import { speedSkiInput } from "./speed-ski-steer.ts";
import { slopestyleInput } from "./slopestyle-steer.ts";
import { packedUnder } from "../game/snow.ts";
import { techniqueOf } from "../game/defs/technique.ts";
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
  /** Seconds without a gate before it asks to be reset — and how much
   * longer it gives a skier still MOVING at `stillGoing` m/s or more (a
   * gale in his face on a traverse slows him to a skater's pace, not to
   * nowhere). */
  giveUpAfter: number;
  stillGoing: number;
  patience: number;
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
  /** ON A SLALOM (R31): how far ahead along its racing line the aim
   * stands, m, at rest and per m/s — a racer reads a gate or two ahead,
   * never the piste's next bend. */
  slalomLook: number;
  slalomLookPerSpeed: number;
  /** ...and how far over the speed its line allows it skids, m/s: a
   * slalom is carved, and a skid between two poles is a skier sliding past
   * the next. */
  slalomSkidOver: number;
  /** ...and the model a way of steering is skied forward on there
   * (`slalom-plan.ts` over `turn-model.ts`), the skis CUT HARD as a racer
   * skis a slalom (`TUNING.carve`): over how many seconds at the least,
   * over how many metres of the piste at the least, and how far outside a
   * turning pole the feet are planned past it, m. */
  slalomHorizon: number;
  slalomReach: number;
  slalomClear: number;
  /** ...and what a way's heading off the line's own at the end of it
   * costs against its distance off the line, m² a rad². */
  slalomHeading: number;
  /** ...and what a m/s over the speed the course allows costs it there,
   * m² a (m/s)². */
  slalomSpeed: number;
  /** ...and what a change of the steer it holds costs, m² a whole
   * lock's swing squared. */
  slalomChange: number;
  /** The share of that cut-hard corner grip the line's bend is planned at
   * — the rest is the edge rolling from one turn into the next, where the
   * skis carve tighter than the line's mean bend to make up for it. */
  slalomPace: number;
  /** ...and how long he runs between two turns crossing from one edge to
   * the next, s (`lineSpeed`): the skis swung through his way and onto the
   * new edge under him (the racer's cross-under, `Technique.cross`) while
   * his body comes over. */
  slalomCross: number;
  /** ...and THE RACING STANCE: the most of the tuck he folds into between
   * the poles, 0..1 — a slalom racer skis half up and never tucks (the
   * par's own `PAR.crouch`). */
  slalomStance: number;
  /** ...and THE CHECK, the skid he scrubs speed with when he is over what
   * the line allows: at least this much of the brake, 0..1 (a pivot of
   * some 15° at slalom pace), more the further over he is; and held at
   * least that while the skis still slide across their line fast. */
  slalomSkid: number;
  /** ...and the share of the brake past which a slide is a skid he asked
   * for rather than an edge giving way (just over `crash.catchSkid`): the
   * edge is stood down out of a fast slide only under it. */
  slalomSkidHeld: number;
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
  stillGoing: 1.2,
  patience: 3,
  crawl: 6,
  kickerMargin: 0.85,
  entryRadius: 12,
  standOver: 0,
  skidOver: 1.5,
  slalomLook: 2,
  slalomLookPerSpeed: 0.35,
  slalomSkidOver: 0.5,
  slalomHorizon: 0.6,
  slalomReach: 7,
  slalomClear: 0.4,
  slalomHeading: 2,
  slalomSpeed: 1,
  slalomChange: 6,
  slalomPace: 0.65,
  slalomCross: 0.15,
  slalomStance: 0.3,
  slalomSkid: 0.4,
  slalomSkidHeld: 0.55,
};

const hit: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
const pa: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const pb: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const pc: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const near: number[] = [];
const choice: SlalomChoice = { steer: 0, brake: 0 };

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
/** ...on a ski cross (R35), whose edges are its fence and whose racers
 * ride four abreast in fourteen metres: the margin a racer keeps off the
 * fence, m, and how much further in per m/s. */
const CROSS_MARGIN = 1.6;
const CROSS_DRIFT = 0.05;
/** How far inside a slalom gate's edge a rival's lane is held, m. */
const SLALOM_MARGIN = 2.5;
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
const kickerSpeeds = new WeakMap<SkiSpec, Map<number, WeakMap<Kicker | Cliff, number>>>();
function knownSpeeds(spec: SkiSpec, fall: number): WeakMap<Kicker | Cliff, number> {
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
  return mine;
}
function kickerSpeed(
  level: Level,
  k: Kicker,
  spec: SkiSpec,
  profile: BotProfile,
  fall: number,
): number {
  const mine = knownSpeeds(spec, fall);
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
  const best = flownSpeed(level, k.x, k.z, fx, fz, lip, angle, spec, profile, fall);
  mine.set(k, best);
  return best;
}

/** THE SPEED A DROP WANTS (R24), m/s: the same flight off its edge, which
 * the shelf leaves level with the line — so the skier goes over it along
 * the line's own pitch, read over the last two metres before it. */
function dropSpeed(
  level: Level,
  d: Cliff,
  spec: SkiSpec,
  profile: BotProfile,
  fall: number,
): number {
  const mine = knownSpeeds(spec, fall);
  const known = mine.get(d);
  if (known !== undefined) return known;
  const fx = Math.sin(d.heading);
  const fz = Math.cos(d.heading);
  const lip = level.groundAt(d.x, d.z);
  const angle = Math.atan((lip - level.groundAt(d.x - fx * 2, d.z - fz * 2)) / 2);
  const best = flownSpeed(level, d.x, d.z, fx, fz, lip, angle, spec, profile, fall);
  mine.set(d, best);
  return best;
}

/** The fastest a point flown off a lip at `angle` over the real snow
 * comes down without the impact into the slope folding the legs. */
function flownSpeed(
  level: Level,
  x0: number,
  z0: number,
  fx: number,
  fz: number,
  lip: number,
  angle: number,
  spec: SkiSpec,
  profile: BotProfile,
  fall: number,
): number {
  const floor = 0.9;
  const limit = harshSpeedOf(spec) * profile.kickerMargin;
  const n = { x: 0, y: 1, z: 0 };
  let best = 8;
  for (let v = 8; v <= 45; v += 1) {
    let x = x0;
    let z = z0;
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
  return best;
}

/** How a pitch is read under a bend, m either side; the share of its pull
 * down the fall line taken off the grip he turns on, and the least of the
 * grip left him. */
const PITCH_SPAN = 6;
const PITCH_PULL = 0.5;
const PITCH_FLOOR = 0.35;
const pt: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };

/** The slowest a bend owed room on a pitch asks him to go, m/s: a skier
 * checks to a crawl over a pitch the brake cannot hold, never to a stop. */
const CRAWL = 4;

/** The share of a giant slalom's cut grip the bot turns on: a turn every
 * twenty-odd metres leaves no straight to win back a line run wide, so he
 * takes each one a little under what the edge would hold. */
const GIANT_SLALOM_CORNER = 0.85;

/** The fastest the skier may be going NOW for every bend and kicker within
 * skidding reach to be taken at its own speed, m/s. */
function speedAllowed(state: GameState, s: number, speed: number, profile: BotProfile): number {
  const level = state.level;
  const spec = state.skier.spec;
  const T = techniqueOf(state.rules);
  const decel = brakeDecel(spec, 1) * profile.brakeShare;
  const reach = (speed * speed) / (2 * decel) + 30;
  const y0 = trackPointAt(level, s, pc).y;
  const downhill = speedCourseOf(level) !== null && state.rules.course;
  let allowed = Infinity;
  for (let d = 0; d <= reach; d += 4) {
    // THE SKIDDING ROOM, less what the fall of the piste gives back: a skid
    // down a steep pitch sheds only what it takes beyond the slope's own
    // pull, so the height the piste drops by the bend is paid out of it
    // (v² = v_bend² + 2·a·d − 2·g·drop). The bends themselves shed little
    // (`steer.scrub`), so a skier who planned for the brake alone on a
    // steep pitch arrives at the bend still carrying the pitch.
    const drop = Math.max(0, y0 - trackPointAt(level, s + d, pc).y);
    // Below nothing: a pitch steeper than the brake can hold is room the
    // skier OWES — he must come to it slower than the bend's own speed.
    const owed = 2 * decel * Math.max(0, d - 6) - 2 * TUNING.g * drop;
    const room = Math.max(0, owed);
    // The room alone already allows what is allowed: no bend this far on,
    // however tight, can lower it — nor any further on, the room only ever
    // growing on a piste that never climbs faster than the brake bites.
    if (Math.sqrt(room) >= allowed && drop === 0) break;
    // The bend, and the weave round the gates on it (R28) — or the line
    // round a slalom's poles (R31).
    const weave = weaveAt(level, s + d).curvature;
    // On a downhill the line's swing through the gates and the piste's own
    // bend are read with their signs (`lineBendAt`): its gates cut the
    // inside of the bends.
    const k = downhill
      ? Math.abs(lineBendAt(level, s + d, profile.bendSpan))
      : bendAt(level, s + d, profile.bendSpan) + weave;
    if (k < 1e-4) continue;
    // A slalom's line (and the piste's bend under it), as fast as the skis
    // CUT HARD can come round it with the run from one edge to the next
    // between two turns taken out of it (`lineSpeed`, the par's own).
    if (level.slalom && state.rules.course && weave > 1e-4) {
      // ...on the snow lying there (`pc` is the piste at s + d, read for
      // its drop above): new snow fallen on the course holds less.
      const packed = packedUnder(level.packedAt(pc.x, pc.z), state.fresh);
      const span = raceSpanAt(level, s + d);
      const v = lineSpeed(spec, T, k, span, packed, profile.slalomPace, profile.slalomCross);
      allowed = Math.min(allowed, Math.sqrt(v * v + room));
      continue;
    }
    // The bend's speed at the grip of a standstill, then once more at the
    // grip left at THAT speed — the chatter takes some of it off the top;
    // on a downhill at the grip the skis CUT HARD hold.
    const grip = (v: number): number =>
      downhill
        ? cutGrip(spec, v, T, packedUnder(level.packedAt(pc.x, pc.z), state.fresh))
        : cornerGrip(spec, 1, v);
    // On a steep pitch the fall line pulls him out of a turn across it: the
    // slope's own pull, a share of it, is taken off the grip he turns on.
    const pitch = Math.max(
      0,
      (trackPointAt(level, s + d - PITCH_SPAN, pt).y -
        trackPointAt(level, s + d + PITCH_SPAN, pt).y) /
        (2 * PITCH_SPAN),
    );
    const pull = TUNING.g * (pitch / hypot(1, pitch)) * PITCH_PULL;
    const share = profile.cornerShare * (level.giantSlalom ? GIANT_SLALOM_CORNER : 1);
    const turnOn = (v: number): number =>
      Math.max(grip(v) * share - pull, grip(v) * share * PITCH_FLOOR);
    const still = Math.sqrt(turnOn(0) / k);
    let corner = Math.sqrt(turnOn(still) / k);
    // ...and no faster than the pair's sidecut can still carve it — the
    // edge's lock eases with speed, and a long ski's runs out first.
    const carve = carveSpeedOf(spec, k, T);
    if (carve > 0) corner = Math.min(corner, carve);
    const now = Math.sqrt(Math.max(CRAWL * CRAWL, corner * corner + owed));
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
  for (const c of level.cliffs ?? []) {
    if (!c.onTrack || c.s === undefined) continue;
    const d = arcAhead(level, s, c.s);
    if (d < 0 || d > reach) continue;
    const v = dropSpeed(level, c, spec, profile, flightGravity(state.rules));
    const now = Math.sqrt(v * v + 2 * decel * Math.max(0, d - KICKER_RUNUP));
    if (now < allowed) allowed = now;
  }
  return allowed;
}

/** THE WEAVE the course asks of a skier `s` metres down the piste: a
 * downhill's racing line (R32), the line a racer takes round a slalom's
 * poles (R31, `race-line.ts`) where one is set, else the line through a
 * course's gates (R28). */
function weaveAt(level: Level, s: number): { offset: number; curvature: number } {
  const line = speedLineAt(level, s);
  if (line) return { offset: line.offset, curvature: Math.abs(line.bend) };
  return raceLineAt(level, s) ?? gateLineAt(level, s);
}

/** How long until a skier in the air comes down, s: his flight carried on
 * under the run's gravity until it meets the snow — two seconds at the
 * most. */
function landingAhead(state: GameState): number {
  const c = state.skier;
  const g = flightGravity(state.rules);
  let y = c.y;
  let vy = c.vy;
  const dt = 0.02;
  for (let t = dt; t < 2; t += dt) {
    vy -= g * dt;
    y += vy * dt;
    if (y <= state.level.groundAt(c.x + c.vx * t, c.z + c.vz * t) + 0.9) return t;
  }
  return 2;
}

/** How far ahead along the way he is actually going the bot looks for a
 * trunk or a post, s at his speed — the drift its aim does not show. */
const TRAVEL_LOOK = 1.2;

/** Move the aim off a trunk or a post (`posts.ts`) standing in the line
 * from the skier to it — or, with that line clear, in the way he is
 * actually going, which a skier drifting wide of his aim runs into. */
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
  const side = blockedSide(state, ux, uz, Math.min(len, profile.treeLook), profile);
  if (side !== 0) return [tx + uz * side * profile.dodge, tz - ux * side * profile.dodge];
  const speed = hypot(c.vx, c.vz);
  if (speed < 1) return [tx, tz];
  const vx = c.vx / speed;
  const vz = c.vz / speed;
  const drift = blockedSide(
    state,
    vx,
    vz,
    Math.min(profile.treeLook, speed * TRAVEL_LOOK),
    profile,
  );
  if (drift === 0) return [tx, tz];
  // Right of travel is (vz, −vx).
  return [tx + vz * drift * profile.dodge, tz - vx * drift * profile.dodge];
}

/** Which side to pass the nearest trunk or post standing within the
 * corridor `look` m along (ux, uz) from the skier: −1 left, 1 right, 0
 * when the way is clear. */
function blockedSide(
  state: GameState,
  ux: number,
  uz: number,
  look: number,
  profile: BotProfile,
): number {
  const c = state.skier;
  solidsNear(state.level, c.x + (ux * look) / 2, c.z + (uz * look) / 2, look / 2 + 2, near);
  const solids = solidsOf(state.level);
  let bestAlong = Infinity;
  let side = 0;
  for (const i of near) {
    const t = solids[i];
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
  return side;
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
  // A skier a lift has (`lift-ride.ts`) is left to it: carried, or led off
  // the free ride's lift, his hands off the controls.
  if (c.lift) return { ...NEUTRAL_INPUT };
  // A skier sat on the helicopter's skid flies it up the mountain
  // (`heli.ts`'s `pilotInput`) and never jumps.
  if (state.heli?.rider) return pilotInput(state);
  // ...and one stood on the snowmobile's boards rides it up the mountain
  // (`sled-pilot.ts`) and never hops off.
  if (state.sled?.rider) return sledPilot(state);
  // ...and one under a paramotor's wing skis off the summit and flies it
  // (`para-pilot.ts`), never dropping the rig.
  if (state.para && state.para.mode !== "dropped" && !c.thrown) return paraPilot(state);
  // GIVE UP on a stretch that has gone nowhere for too long.
  // (A free ride has no gate to wait for; its only way back is the
  // engine's own, off his back or bogged.)
  const waited = p.time - Math.max(p.lastPassedAt, p.lastResetAt);
  if (
    state.rules.course &&
    waited > profile.giveUpAfter * (c.speed >= profile.stillGoing ? profile.patience : 1)
  ) {
    return { ...NEUTRAL_INPUT, reset: true };
  }
  const speed = c.speed;
  const on = locate(state);
  // DOWN A SPEED TRACK (R34) or A BIG AIR JUMP (R37): tucked and straight,
  // nothing else.
  const straight = speedSkiInput(state, on);
  if (straight) return straight;
  // DOWN A SLOPESTYLE COURSE (R39): its lines, its jibs and its jumps.
  const slope = slopestyleInput(state, on);
  if (slope) return slope;
  const cps = level.checkpoints;
  const L = level.track.length;
  const poles = state.rules.course && level.slalom !== undefined;
  let aimS = poles
    ? Math.min(L, on.s + profile.slalomLook + profile.slalomLookPerSpeed * speed)
    : Math.min(L, on.s + profile.lookBase + profile.lookPerSpeed * speed);
  // ON A SLALOM, never past the gate owed: a racer goes AT the outside of
  // the next turning pole and only then for the one after — an aim past it
  // cuts inside the pole.
  if (poles && p.started) {
    const gate = cps[p.nextCheckpoint];
    if (gate?.pole !== undefined) {
      const at = gate.pole === "closed" ? gate.s + gate.width / 2 : gate.s;
      aimS = Math.min(aimS, Math.max(on.s + 0.5, at));
    }
  }
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
  // THE GATE LINE (R28): on a course of slalom gates the line through
  // them, weaving either side of the centreline; and THE LANE, that far
  // right of it — inside a slalom gate's own width where there is one.
  // ON A DOWNHILL, the line of the speed gate owed is held until it is
  // taken: a racer reads the next gate only once through this one — the
  // line beyond it, read early, cuts inside a gate set on a bend.
  const owedGate = cps[p.nextCheckpoint];
  const lineS =
    owedGate?.panels && p.started && state.rules.course ? Math.min(aimS, owedGate.s) : aimS;
  const weave = state.rules.course ? weaveAt(level, lineS).offset : 0;
  if (lane !== 0 || weave !== 0) {
    // A slalom's line is the gates' own, inside the piste by the setter's
    // rule; anywhere else the lane keeps clear of the edge.
    // (Held to a speed gate's line, the room is the piste's at the gate,
    // which is where that line was set.)
    const wide = lineS < aimS ? trackPointAt(level, lineS, pc).width : aim.width;
    const room = poles
      ? wide / 2
      : level.skiCross
        ? Math.max(0, wide / 2 - CROSS_MARGIN - CROSS_DRIFT * speed)
        : Math.max(0, wide / 2 - LANE_MARGIN - LANE_DRIFT * speed);
    const gate = cps[Math.min(cps.length - 1, p.nextCheckpoint)];
    const inGate = poles
      ? 0
      : weave !== 0 && gate
        ? Math.max(0, gate.width / 2 - SLALOM_MARGIN)
        : Infinity;
    const across = clamp(weave + clamp(lane, -inGate, inGate), -room, room);
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
  const dodging = tx !== aim.x || tz !== aim.z;

  const input: SkierInput = { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false };
  if (c.airborne) {
    // LEVEL TO THE LANDING: pitch toward the slope under where the skier
    // is going, the fall line of the snow a half second on.
    const hs = hypot(c.vx, c.vz);
    const ux = hs > 0.5 ? c.vx / hs : Math.sin(c.heading);
    const uz = hs > 0.5 ? c.vz / hs : Math.cos(c.heading);
    // ...on a downhill, where he will actually come down: at its speed a
    // flight off a roller lands thirty metres on, far past any half second.
    const ahead = speedCourseOf(level) ? landingAhead(state) : 0.5;
    const ax = c.x + c.vx * ahead;
    const az = c.z + c.vz * ahead;
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
  // ON A DOWNHILL'S LINE the line's own bend is fed forward
  // (`downhill-steer.ts`): a point chased ahead lags it through a long turn
  // by the width of a gate — unless a post stands on the line (a lift's
  // tower on the course's snow), when he goes round it first.
  if (
    speedCourseOf(level) &&
    state.rules.course &&
    p.started &&
    on.distance <= halfWidth + 2 &&
    !dodging
  ) {
    input.steer = downhillSteer(state, on) ?? input.steer;
  }
  // ON A SLALOM'S LINE the skis are steered off the line itself rather than
  // a point on it: the bend it makes a moment ahead, and the heading and
  // the place it asks of him now.
  // A racer skis it CUT HARD (`TUNING.carve`): the skis stood further over
  // and pressed into the groove, every turn.
  const racing = poles && p.started && on.distance <= halfWidth + 2;
  // THE TUCK AND THE SKID, off the bends within reach — on the piste; out
  // in the powder there is nothing to skid for but the piste itself.
  const onTrack = on.distance <= halfWidth + 2;
  let allowed = onTrack ? speedAllowed(state, on.s, speed, profile) : Infinity;
  // ...and the turn onto the aim itself: pure pursuit's own curvature,
  // 2·sin(error) over the distance to the aim, taken at the grip of the
  // snow the skier is on — which is what slows him for the turn onto the
  // piste out of the powder, and back onto it after running wide.
  if (!p.started && on.distance > halfWidth) {
    const grip = cornerGrip(c.spec, c.packed, speed) * profile.cornerShare;
    const turn = Math.sqrt(grip * profile.entryRadius);
    const left = on.distance - halfWidth;
    allowed = Math.min(
      allowed,
      Math.sqrt(turn * turn + 2 * brakeDecel(c.spec, c.packed) * profile.brakeShare * left),
    );
  }
  const reach = hypot(tx - c.x, tz - c.z);
  const bend = (2 * Math.abs(Math.sin(angleDiff(c.heading, bearing)))) / Math.max(reach, 1);
  if (bend > 1e-3 && !racing) {
    const grip = cornerGrip(c.spec, c.packed, speed) * profile.cornerShare;
    allowed = Math.min(allowed, Math.max(profile.crawl, Math.sqrt(grip / bend)));
  }
  // Past the finish nothing is owed but a stop: stand up and skid.
  if (p.finished) allowed = 0;
  // A DOWNHILLER on his line checks with a light skid at the most, and
  // carves cut hard (`downhill-steer.ts`).
  const downhillLine = speedCourseOf(level) !== null && state.rules.course && p.started && onTrack;
  if (downhillLine) {
    const D = steerOf(level);
    input.carve = true;
    if (speed > allowed + profile.skidOver) {
      input.tuck = 0;
      input.brake = clamp((speed - allowed) / D.checkPer, 0.1, D.check);
    } else if (speed > allowed + profile.standOver) input.tuck = 0;
  } else if (speed > allowed + (poles ? profile.slalomSkidOver : profile.skidOver)) {
    input.tuck = 0;
    input.brake = clamp((speed - allowed) / 3, racing ? profile.slalomSkid : 0.25, 1);
  } else if (speed > allowed + profile.standOver) {
    input.tuck = 0;
  }
  const K = TUNING.skier;
  if (racing) {
    // A SKID IS NOT LET GO UNDER A FAST SLIDE: let go there, the edge
    // bites into the slide — so a racer holds his check, past where it
    // stops being his own slide (`crash.catchSkid`), until the skis are
    // back on their line.
    const held = c.skid > 0.3 && c.sideSlip > K.slipSpeed;
    if (held) input.brake = Math.max(input.brake, profile.slalomSkidHeld);
    // ...the steer and the check chosen together, the check a pivot of the
    // skis the way he steers as much as a brake.
    slalomSteer(
      state,
      on.s,
      input.brake,
      held,
      allowed,
      {
        horizon: profile.slalomHorizon,
        reach: profile.slalomReach,
        clear: profile.slalomClear,
        heading: profile.slalomHeading,
        speed: profile.slalomSpeed,
        change: profile.slalomChange,
      },
      choice,
    );
    input.steer = choice.steer;
    input.brake = choice.brake;
    if (input.brake > 0) input.tuck = 0;
    input.carve = true;
    // ...and skis half up between the poles, never tucked.
    input.tuck = Math.min(input.tuck, profile.slalomStance);
  }
  // OUT OF A SKID WITH THE SKIS FLAT: while they are pivoted, or still
  // sliding across their line, the edge is held under what catches
  // (`skier.slipEdge`) — a skier finishing a hockey stop stands his skis up
  // only as the slide dies, and a bot that carved out of one at full edge
  // was thrown by his own high-side.
  // A RACER stands his edge down only in the high-side's own zone: the
  // skis sliding across their line past `skier.slipSpeed` with no skid of
  // his asking to carry the slide. A steep pitch slides a carved ski a few
  // metres a second across its line on every turn, and a cap read off half
  // that held a slalom racer's edge under the shelf it cuts
  // (`grip.platform`) all down a steep course — the turn the planner chose
  // was never the one he skied, and he ran wide of gate after gate.
  const capped =
    racing || downhillLine
      ? c.sideSlip > K.slipSpeed && c.skid < profile.slalomSkidHeld
      : c.skid > 0.1 || c.sideSlip > K.slipSpeed * 0.5;
  if (capped) {
    // ...against the lock the physics stands his skis to (`skier.ts`).
    const T = techniqueOf(state.rules);
    const lock = Math.min(
      edgeMostOf(c.spec, T),
      edgeLockAt(c.spec, speed, T) * (1 + TUNING.carve.edge * c.carve),
    );
    const cap = (profile.slideEdge * K.slipEdge) / Math.max(lock, 0.05);
    input.steer = clamp(input.steer, -cap, cap);
  }

  // A tight bend is carved standing, not tucked: the edge needs the hips —
  // but under a crawl the tuck is the POLES, and a skier poling out of the
  // gate toward the piste's line keeps pushing.
  if (Math.abs(input.steer) > 0.6 && speed >= profile.crawl) input.tuck = Math.min(input.tuck, 0.3);
  return input;
}
