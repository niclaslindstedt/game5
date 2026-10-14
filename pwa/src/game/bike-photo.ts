// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER AS PHOTOGRAPHED — the downhill rider on his bike laid to match
// riders' photographs frame for frame. Every number in `PHOTO` was traced
// off reference frames of real downhill and freeride riders (side, front and
// chase views, studied locally and never committed): the attack stance on
// a fast straight, the brake, the landing's fold, the legs reaching for the
// ground before it, the knees drawn up in the air, the berm, the foot out,
// the whip and the table. Two halves:
//
//   THE TRACK  what the photographs show riders doing over TIME that the
//              engine does not hold: the cranks levelled when coasting and
//              the outside pedal dropped in a turn (back-pedalled, the
//              freehub's free way), the foot out put down and taken back
//              at a body's pace, the legs folding on a landing and drawn
//              up in the air, the levers' weight shift eased. A memory a
//              bike, keyed on its state and advanced by the run's own clock
//              (`photoTrack`), so the game, the labs and a replay all read
//              the same answer; a clock that goes back starts it afresh.
//
//   THE POSE   the hips placed off the bottom bracket where the photographs
//              stand them (`PHOTO.hips`), raised and sunk by the engine's
//              own rider spring and the track, held off the saddle; the
//              trunk's bend solved so the HEAD stays where a rider holds it
//              (the legs do the work, the head stays quiet); and the hips
//              slid fore and aft so the ELBOWS hold the photographs' bend
//              (`photoHips`, `photoPitch`).
//
// Presentation only: the engine is never told, so no digest moves.
// Three-free, so the suite and the labs read it.

import { BIKE, type BikeState } from "@engine";

/** THE PHOTOGRAPHS' NUMBERS. Angles are inside angles (a straight limb
 * 180°); heights are the hips' middle over the bottom bracket, m, and
 * `back` how far behind it, m. */
export const PHOTO = {
  /** The ATTACK STANCE on a fast straight (side-on frames): trunk 60–70°
   * forward of upright, knees ~120°, elbows ~105° bent out and up, hips a
   * hand behind the cranks, eyes up the trail. */
  hips: { y: 0.77, back: 0.13 },
  /** The elbows' bend the hips are slid fore and aft to hold, deg, by
   * moment: the attack, on the levers (arms longer, the weight back), the
   * landing's fold (the arms take it too), in the air. */
  elbow: { attack: 108, brake: 128, fold: 96, air: 112 },
  /** The hips' reach fore and aft of `back`, m — no rider stands his hips
   * over the bars or past the rear axle. */
  reach: [0.06, 0.26] as const,
  /** The trunk's bend the head is held by, rad: never prouder than 23° (a nose-down landing's),
   * never flatter than 78° (the frames' range). */
  pitch: [0.4, 1.36] as const,
  /** The head over the bottom bracket the trunk is bent to hold, m, and
   * the share of the hips' own travel it follows (a quiet head moves a
   * little with them, never a lot). */
  head: { y: 0.98, follow: 0.3 },
  /** The ENGINE'S RIDER SPRING (`BIKE.rider.stand.y` its rest): the share
   * of its travel the hips follow, and the lowest the hips are ever drawn
   * — sat back on the tyre a rider is no lower than 0.44 m over the
   * cranks (a landing's deepest frames). */
  spring: { follow: 0.8, floor: 0.58, soft: 0.1 },
  /** ON THE LEVERS: the hips back and down, the heels dropped. */
  brake: { back: 0.07, down: 0.05 },
  /** IN THE AIR: the knees drawn up as the bike is pulled under him, m of
   * hips over the cranks given up, and the legs pushed back out to meet
   * the ground as the fall runs out (`reach` s before it). */
  air: { tuck: 0.03, reach: 0.22, out: 0.04 },
  /** PEDALLING stood up: the hips' rise and fall with each stroke, m, and
   * the trunk's sway, rad. */
  pedal: { bob: 0.025, sway: 0.06 },
  /** IN A TURN: the share of the bike's lean the trunk does NOT follow
   * (berm frames lean with the bike more than flat-turn frames), the hips
   * dropped as the bike is laid over, m a radian. */
  turn: { upright: 0.32, drop: 0.08 },
  /** The knees and elbows out past a walker's (front-on frames: elbows out
   * nearly level with the bar, knees out off the top tube). */
  out: { knees: 0.5, elbows: 0.75 },
};

/** THE TRACK'S PACES: time constants, s, and the cranks' turn. */
export const TRACK = {
  /** The cranks back-pedalled to their coasting place, rad/s at most, how
   * fast a pedal stroke takes them back, s, and how long the engine's pedal
   * must be held before the drawn cranks are given to it, s (a crawl's
   * single-step pushes are no stroke). */
  crank: { rate: 7, catch: 0.12, hold: 0.12 },
  /** The lean that drops the outside pedal, rad: starts and is whole. */
  lean: [0.14, 0.38] as const,
  /** The foot out: put down and taken back, s; its own lean and slide
   * needed past this share before it goes. */
  foot: { down: 0.14, up: 0.2, gate: 0.25 },
  /** The levers' weight shift, s. */
  brake: 0.12,
  /** The hips on a spring of their own over the engine's (a body's
   * response, ~3 Hz, a little under critical). */
  hips: { hz: 3.2, zeta: 0.8 },
  /** The tuck in the air, s to draw up and to reach out. */
  tuck: 0.1,
  /** The bike's lean as the trunk reads it, s. */
  lean2: 0.08,
  /** A gap in the clock this long starts the track afresh, s. */
  gap: 0.5,
  /** THE LANDING'S FOLD: the hips kicked down at a touch-down by this share
   * of the speed he came down at (the frames' legs folding 20–25 cm into a
   * landing the bike's own travel takes far less of), and never below this
   * over the cranks, m. */
  land: { kick: 1.4, floor: 0.48 },
};

/** WHAT THE TRACK SHOWS this frame. */
export type Shown = {
  /** The cranks as drawn, rad (`pedalsAt`). */
  crank: number;
  /** The foot out, 0..1, and which (0 the −x foot). */
  footOut: number;
  foot: 0 | 1;
  /** The levers' weight, 0..1. */
  brake: number;
  /** The hips over the bottom bracket the track has them at, m (before
   * the stroke's bob and the brake). */
  hipsY: number;
  /** The knees drawn up in the air, 0..1, and the legs reached for the
   * ground, 0..1. */
  tuck: number;
  reach: number;
  /** The bike's lean as the trunk follows it, rad. */
  lean: number;
};

type Track = Shown & {
  t: number;
  vy: number;
  offset: number;
  fall: number;
  air: boolean;
  pedal: number;
};

const tracks = new WeakMap<BikeState, Track>();

const smooth = (a: number, b: number, x: number): number => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
/** `x` eased toward `to` over `tau` s in `dt` s. */
const ease = (x: number, to: number, tau: number, dt: number): number =>
  x + (to - x) * (1 - Math.exp(-dt / Math.max(1e-4, tau)));
/** The angle `a` wrapped into (−π, π]. */
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** WHERE THE CRANKS COAST: level, the −x (left) foot forward — a rider's
 * front foot — turned to drop the OUTSIDE pedal as the bike is laid over
 * (`pedalsAt`: the −x pedal is down at π/2, the +x at −π/2; a roll right
 * side down is a turn to +x, so the −x foot is outside). */
export function coastCrank(lean: number): number {
  const k = smooth(TRACK.lean[0], TRACK.lean[1], Math.abs(lean));
  return (Math.sign(lean) || 1) * k * (Math.PI / 2);
}

/** The hips' target over the cranks off the engine's rider at `riderY` m
 * over the bottom bracket (`BikePose.rider.y`). */
export function hipsOver(riderY: number): number {
  const P = PHOTO.spring;
  const y = PHOTO.hips.y + (riderY - BIKE.rider.stand.y) * P.follow;
  // Softly held off the floor: past `soft` over it the drop is eased.
  const knee = P.floor + P.soft;
  if (y >= knee) return y;
  const d = knee - y;
  return knee - P.soft * (1 - Math.exp(-d / P.soft));
}

/** THE TRACK of the bike `b` at the run's time `t` — advanced once a new
 * moment, read as is at the same one. `riderY` and `crank` are the frame's
 * own (`bikePose`), `foot` the style's raw foot out (`rideStyleOf`), `left`
 * the seconds of fall left in the air. */
export function photoTrack(
  b: BikeState,
  t: number,
  frame: { riderY: number; crank: number; pedalling: boolean; roll: number },
  raw: { footOut: number; foot: 0 | 1; brake: number; left: number },
): Shown {
  let k = tracks.get(b);
  const target = hipsOver(frame.riderY);
  if (!k || t < k.t || t - k.t > TRACK.gap) {
    // Afresh: everything where it stands now.
    const crank = frame.pedalling ? frame.crank : coastCrank(frame.roll);
    k = {
      t,
      crank,
      offset: wrap(crank - frame.crank),
      footOut: raw.footOut,
      foot: raw.foot,
      brake: raw.brake,
      hipsY: target,
      vy: 0,
      tuck: 0,
      reach: 0,
      lean: frame.roll,
      fall: 0,
      air: b.airborne,
      pedal: frame.pedalling ? 2 * TRACK.crank.hold : 0,
    };
    tracks.set(b, k);
    return k;
  }
  const dt = t - k.t;
  if (dt <= 0) return k;
  k.t = t;
  // THE CRANKS: carried by the engine's while he pedals (the offset eased
  // out), back-pedalled to their coasting place while he does not.
  const H = TRACK.crank.hold;
  k.pedal = Math.max(0, Math.min(2 * H, k.pedal + (frame.pedalling ? dt : -dt)));
  if (k.pedal > H) {
    const d = ease(k.offset, 0, TRACK.crank.catch, dt) - k.offset;
    const most = TRACK.crank.rate * dt;
    k.offset += Math.max(-most, Math.min(most, d));
  } else {
    const want = wrap(coastCrank(k.lean) - frame.crank);
    const d = wrap(want - k.offset);
    const most = TRACK.crank.rate * dt;
    k.offset += Math.max(-most, Math.min(most, d * Math.min(1, dt / 0.06)));
  }
  k.crank = frame.crank + k.offset;
  // THE FOOT OUT: the slide's flicker read as a body reads it — down only
  // once the slide holds, back up at a body's pace; the side held while
  // the foot is out.
  const want = raw.footOut > TRACK.foot.gate ? raw.footOut : 0;
  if (k.footOut < 0.05) k.foot = raw.foot;
  const sameSide = raw.foot === k.foot;
  k.footOut = ease(
    k.footOut,
    sameSide ? want : 0,
    want > k.footOut ? TRACK.foot.down : TRACK.foot.up,
    dt,
  );
  k.brake = ease(k.brake, raw.brake, TRACK.brake, dt);
  k.lean = ease(k.lean, frame.roll, TRACK.lean2, dt);
  // IN THE AIR: drawn up, then reached for the ground.
  const air = b.airborne;
  const reach = air ? 1 - smooth(0, PHOTO.air.reach, raw.left) : 0;
  const tuck = air ? 1 - reach : 0;
  k.tuck = ease(k.tuck, tuck, TRACK.tuck, dt);
  k.reach = ease(k.reach, reach, TRACK.tuck, dt);
  // THE LANDING: the fall he came down at folds the legs into it.
  if (air) k.fall = Math.min(0, b.vy);
  else if (k.air) k.vy += TRACK.land.kick * k.fall;
  k.air = air;
  // THE HIPS on a body's own spring over the engine's, stepped implicitly
  // so a slow frame (or a lab sampling every few) never rings it.
  const w = 2 * Math.PI * TRACK.hips.hz;
  k.vy =
    (k.vy + w * w * (target - k.hipsY) * dt) / (1 + 2 * TRACK.hips.zeta * w * dt + w * w * dt * dt);
  k.hipsY += k.vy * dt;
  if (k.hipsY < TRACK.land.floor) {
    k.hipsY = TRACK.land.floor;
    k.vy = Math.max(0, k.vy);
  }
  return k;
}
