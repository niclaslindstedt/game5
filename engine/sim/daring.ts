// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DARING BOT — the bot (`bot.ts`) with the knob that makes him SHOW
// THE MOUNTAIN OFF (`BotProfile.daring`): what the menu's backdrop rides
// (`showcase.ts`), so the game's own front door demonstrates what is fun in
// it rather than a skier holding the middle of a groomer. Read only on a
// run that owes no course (`RunRules.course` off): a race keeps its line.
//
// Four habits, each a plain rule over what the state and the map publish:
//
//   THE ROAM. The piste is cut into stretches (`roam.every` m); on a share
//   of them, picked off a hash of the map's seed and the stretch, his line
//   swings out past the piste's edge into the powder and the glades — out
//   over the first part of the stretch, held, and back in over the last —
//   so he leaves the groomer, throws his powder turns and comes back.
//
//   THE HUNT. A kicker or a drop whose lip lies ahead of him, inside a cone
//   about the way down and pointing down it too, is GONE AT: he lines up on
//   its own axis a run-up short of the lip and goes through it, tucked, as
//   fast as the snow under its landing lets him come down
//   (`kicker-speed.ts`, at the hunt's own margin).
//
//   THE POP. The jump key held into the lip and let go off it — a kicker's,
//   a drop's, or a crest on his line where the snow steepens sharply — so
//   he leaves the snow springing, higher than the lip alone throws him.
//
//   THE AIR. A trick for every flight with the air for one, picked off a
//   hash of the run's seed and the step he left the snow: a flip (`flipLean`
//   paces it round onto his skis), a spin of half turns tapped out on the
//   edge (`strokes.ts` settles it square), a grab held and let go before the
//   snow — and the levelling to the landing kept under the loop's gate, so a
//   big flight is never thrown into a loop he did not pick.
//
// Nothing here draws from `state.rng`: every choice is a hash of the map's
// seed and a stretch or a step, and what he has committed to is kept beside
// the state (`memos`), never in it — so a run replays to the same tricks.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { hash2 } from "@niclaslindstedt/oss-game-framework/core/noise";
import type { Cliff, Kicker, TrackHit, TrackPoint } from "../mapgen/types.ts";
import { trackPointAt } from "../mapgen/index.ts";
import { landingAhead } from "../game/flight.ts";
import { brakeDecel, flightGravity } from "../game/limits.ts";
import { flipLean } from "../game/strokes.ts";
import { TUNING } from "../game/defs/tuning.ts";
import type { GameState, SkierInput } from "../game/state.ts";
import { solidsNear } from "../game/posts.ts";
import { bedrockOf } from "../game/rock-ground.ts";
import { dropSpeed, kickerSpeed } from "./kicker-speed.ts";

export type Daring = {
  /** THE ROAM: how long a stretch of the piste one decision covers, m; the
   * share of stretches he leaves the piste on, 0..1; how far past the
   * piste's edge he swings out, the least and the most, m; and the share
   * of a stretch spent swinging out and the same coming back. */
  roam: {
    every: number;
    share: number;
    least: number;
    most: number;
    ease: number;
    /** ...and only while it pays: never under `slow` m/s, and out to the
     * full swing only where the snow there falls at `grade` or more over
     * the next `probe` m down, none of it where it falls at `flat` or less
     * — deep snow on a gentle slope bogs a skier down. */
    slow: number;
    flat: number;
    grade: number;
    probe: number;
    /** ...and into the open: the trunks and posts standing within `radius`
     * m of where it would have him, `few` or fewer taking nothing off the
     * swing and `many` all of it; and the most he carries off the piste
     * with more than `few` within `radius` of where he is going, m/s. */
    radius: number;
    few: number;
    many: number;
    woods: number;
  };
  /** THE HUNT: how far ahead a lip is looked for, m, and how near it may
   * already be, m; the most the bearing to it may stand off the way down,
   * rad, and its own heading off the way down, rad; the lowest kicker worth
   * the detour, m; the highest drop he goes off, m; how far short of the
   * lip he lines up on its axis, m, and how far past it the line runs on,
   * m; how far ahead along that axis he chases it, m at rest and per m/s;
   * and the share of the harsh-landing speed (`air.harshSpeed`) he plans to
   * come down at. */
  hunt: {
    look: number;
    near: number;
    cone: number;
    align: number;
    least: number;
    drop: number;
    runup: number;
    past: number;
    chase: number;
    chasePerSpeed: number;
    margin: number;
  };
  /** THE POP: how long the jump is held into a lip, s at his speed; the
   * steepening of the snow over `span` m either side that is a crest worth
   * popping, as a grade; the least speed a crest is popped at, m/s. */
  pop: { hold: number; crest: number; span: number; least: number };
  /** THE OLLIE: in each `every` s, on a `share` of them, the jump held
   * between `least` and `most` s at some point of it — never steering past
   * `steer` of the edge, nor with the woods ahead. */
  ollie: { every: number; share: number; least: number; most: number; steer: number };
  /** THE AIR: the most of the lean the levelling may ask, 0..1 — under the
   * loop's gate (`TUNING.tricks.flipGate`); the whole flight a flip asks,
   * s, a double's, a spin of N half turns' (the Nth row the (N+1)th), a
   * grab's; the share of flips and doubles taken where there is the air;
   * when the first tap comes, s, and the gap between taps, s, and how long
   * each is held, s; and how long before the snow a grab is let go, s. */
  air: {
    level: number;
    flip: number;
    double: number;
    spins: readonly number[];
    grab: number;
    flipShare: number;
    doubleShare: number;
    tapFrom: number;
    tapEvery: number;
    tapFor: number;
    letGo: number;
    /** The levelling lean a grab waits under, and the one it is let go at
     * (`|lean|`, 0..1). */
    settled: number;
    drift: number;
  };
};

export const DARING: Daring = {
  roam: {
    every: 150,
    share: 0.6,
    least: 10,
    most: 35,
    ease: 0.3,
    slow: 9,
    flat: 0.18,
    grade: 0.32,
    probe: 30,
    radius: 12,
    few: 2,
    many: 8,
    woods: 9,
  },
  hunt: {
    look: 90,
    near: 6,
    cone: 0.55,
    align: 0.8,
    least: 0.6,
    drop: 9,
    runup: 14,
    past: 8,
    chase: 6,
    chasePerSpeed: 0.3,
    margin: 0.75,
  },
  pop: { hold: 0.7, crest: 0.14, span: 3, least: 9 },
  ollie: { every: 5, share: 0.7, least: 0.8, most: 2, steer: 0.5 },
  air: {
    level: 0.7,
    flip: 1.1,
    double: 2.4,
    spins: [0.5, 0.8, 1.05, 1.3],
    grab: 0.7,
    flipShare: 0.6,
    doubleShare: 0.3,
    tapFrom: 0.12,
    tapEvery: 0.2,
    tapFor: 0.08,
    letGo: 0.35,
    settled: 0.25,
    drift: 0.5,
  },
};

/** What the daring line asks of the step: the fastest he may be going now
 * to come down from the lip he is hunting, m/s (Infinity with none), and
 * how far short of that lip he stands along its axis, m (Infinity with
 * none; under 0 past it). */
export type DaringAim = { cap: number; lip: number };

/** One flight's trick: the half turns tapped out and which way, the loops
 * turned and which way (+1 back), and whether a grab is held. */
type Plan = { taps: number; way: number; loops: number; dir: number; grab: boolean };

/** What he has committed to, kept beside the state: the lip he is going at
 * and the flight he is in (by the step he left the snow on) with its trick. */
type Memo = {
  target: Kicker | Cliff | null;
  takeoff: number;
  plan: Plan | null;
};
const memos = new WeakMap<GameState, Memo>();
function memoOf(state: GameState): Memo {
  let m = memos.get(state);
  if (!m) memos.set(state, (m = { target: null, takeoff: -1, plan: null }));
  return m;
}

/** The salts every choice is hashed under, so the roam and the tricks are
 * dealt apart. */
const ROAM_SALT = 0x5e7a;
const AIR_SALT = 0x2b1d;
const POP_SALT = 0x0711;

/** The seed a run's choices are hashed off: its own, and its showcase take
 * (`GameState.showcase`) — so a backdrop stood up again skis a new way. */
function takeSeed(state: GameState): number {
  return (state.seed + 7919 * (state.showcase ?? 0)) | 0;
}

const pt: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };

/** Ease in and out over `ease` of 0..1 at each end. */
function envelope(f: number, ease: number): number {
  const up = clamp(f / ease, 0, 1);
  const down = clamp((1 - f) / ease, 0, 1);
  const e = Math.min(up, down);
  return e * e * (3 - 2 * e);
}

/** How far right of the piste's centreline the roam has him `s` m down
 * it, m — 0 on a stretch he stays on. */
export function roamAt(state: GameState, s: number, d: Daring): number {
  const R = d.roam;
  const i = Math.floor(s / R.every);
  const seed = takeSeed(state) ^ ROAM_SALT;
  if (hash2(i, 0, seed) >= R.share) return 0;
  const side = hash2(i, 1, seed) < 0.5 ? -1 : 1;
  const out = R.least + (R.most - R.least) * hash2(i, 2, seed);
  const half = trackPointAt(state.level, s, pt).width / 2;
  return side * (half + out) * envelope(s / R.every - i, R.ease);
}

/** THE LINE: the aim moved onto the lip he is hunting, or swung out by the
 * roam; and what the hunt asks of his speed, written into `out`. */
export function daringLine(
  state: GameState,
  on: TrackHit,
  aim: TrackPoint,
  d: Daring,
  out: DaringAim,
): void {
  out.cap = Infinity;
  out.lip = Infinity;
  const c = state.skier;
  const memo = memoOf(state);
  if (c.thrown) memo.target = null;
  const here = trackPointAt(state.level, on.s, pt);
  const down = here.heading;
  const offPiste = on.distance > here.width / 2 + 2;
  const target = hunted(state, memo, down, d);
  if (target) {
    const fx = Math.sin(target.heading);
    const fz = Math.cos(target.heading);
    // Along the lip's own axis (negative short of it) and across it.
    const along = (c.x - target.x) * fx + (c.z - target.z) * fz;
    const ahead = clamp(
      along + d.hunt.chase + d.hunt.chasePerSpeed * c.speed,
      -d.hunt.runup,
      d.hunt.past,
    );
    aim.x = target.x + fx * ahead;
    aim.z = target.z + fz * ahead;
    out.lip = -along;
    const fall = flightGravity(state.rules);
    const v =
      "drop" in target
        ? dropSpeed(state.level, target, c.spec, d.hunt.margin, fall)
        : kickerSpeed(state.level, target, c.spec, d.hunt.margin, fall);
    const decel = brakeDecel(c.spec, c.packed) * 0.7;
    out.cap = Math.sqrt(v * v + 2 * decel * Math.max(0, -along - d.hunt.runup));
    return;
  }
  let across = c.speed < d.roam.slow ? 0 : roamAt(state, aim.s, d);
  if (across !== 0) {
    // How steeply the snow out there falls away down the piste's way — the
    // mountain's own fall, never a wall's ledges (`withRock`).
    const ground = bedrockOf(state.level).groundAt;
    const ax = aim.x + Math.cos(aim.heading) * across;
    const az = aim.z - Math.sin(aim.heading) * across;
    const b = trackPointAt(state.level, aim.s + d.roam.probe, pt);
    const bx = b.x + Math.cos(b.heading) * across;
    const bz = b.z - Math.sin(b.heading) * across;
    const grade = (ground(ax, az) - ground(bx, bz)) / d.roam.probe;
    const R = d.roam;
    const open = 1 - clamp((trunksNear(state, ax, az, d) - R.few) / (R.many - R.few), 0, 1);
    across *= clamp((grade - R.flat) / (R.grade - R.flat), 0, 1) * open;
  }
  // IN THE WOODS, checked to a speed he can thread them at.
  if (offPiste && c.speed > d.roam.woods) {
    const ahead = trunksNear(state, c.x + c.vx * 0.6, c.z + c.vz * 0.6, d);
    if (ahead > d.roam.few) out.cap = d.roam.woods;
  }
  aim.x += Math.cos(aim.heading) * across;
  aim.z -= Math.sin(aim.heading) * across;
}

/** How many trunks and posts stand within the roam's radius of a point. */
const near: number[] = [];
function trunksNear(state: GameState, x: number, z: number, d: Daring): number {
  return solidsNear(state.level, x, z, d.roam.radius, near).length;
}

/** The lip he goes at: the one committed to while it is still ahead of him
 * and on his line, else the nearest one ahead inside the hunt's cone. */
function hunted(state: GameState, memo: Memo, down: number, d: Daring): Kicker | Cliff | null {
  const c = state.skier;
  const H = d.hunt;
  const t = memo.target;
  if (t) {
    const fx = Math.sin(t.heading);
    const fz = Math.cos(t.heading);
    const along = (c.x - t.x) * fx + (c.z - t.z) * fz;
    const across = Math.abs((c.x - t.x) * fz - (c.z - t.z) * fx);
    // Past the lip, or come in too wide of it to make it: let go.
    const wide = along > -4 && across > t.width / 2 + 1;
    if (along < 0 && !wide && !c.airborne) return t;
    memo.target = null;
    if (along < H.past) return null;
  }
  if (c.airborne) return null;
  const ux = Math.sin(down);
  const uz = Math.cos(down);
  const reach = Math.tan(H.cone);
  let best: Kicker | Cliff | null = null;
  let bestAlong = Infinity;
  const consider = (k: Kicker | Cliff): void => {
    if (k.y > c.y - 0.5) return;
    if (Math.abs(angleDiff(k.heading, down)) > H.align) return;
    const rx = k.x - c.x;
    const rz = k.z - c.z;
    const along = rx * ux + rz * uz;
    if (along < H.near || along > H.look || along >= bestAlong) return;
    if (Math.abs(rx * uz - rz * ux) > along * reach) return;
    best = k;
    bestAlong = along;
  };
  for (const k of state.level.kickers ?? []) if (k.height >= H.least) consider(k);
  for (const k of state.level.cliffs ?? []) if (k.drop <= H.drop) consider(k);
  memo.target = best;
  return best;
}

/** ON THE SNOW: the jump held into a lip or a crest and let go off it. */
export function daringSnow(state: GameState, input: SkierInput, d: Daring, line: DaringAim): void {
  const c = state.skier;
  if (c.thrown || c.airborne) return;
  const lead = c.speed * d.pop.hold;
  // Into a lip he is hunting: held from `hold` s short of it, and let go
  // once the snow has gone (`TUNING.jump.grace` pops him off it).
  if (line.lip < lead && line.lip > -1) {
    input.jump = true;
    input.tuck = Math.max(input.tuck, 0.6);
    return;
  }
  if (c.speed < d.pop.least) return;
  const v = hypot(c.vx, c.vz);
  const ux = c.vx / v;
  const uz = c.vz / v;
  const S = d.pop.span;
  const ground = state.level.groundAt;
  // The first crest on his way within the lead: the grade over the span
  // past it steeper than the one before it by `crest`.
  for (let a = 1; a <= lead; a += 0.5) {
    const x = c.x + ux * a;
    const z = c.z + uz * a;
    const g0 = ground(x, z);
    const before = (g0 - ground(x - ux * S, z - uz * S)) / S;
    const after = (ground(x + ux * S, z + uz * S) - g0) / S;
    if (before - after > d.pop.crest) {
      // Held into it, let go a step short of it.
      input.jump = a > c.speed * TUNING.dt * 2;
      return;
    }
  }
  // THE OLLIE: with no lip or crest to spring off, now and then the jump
  // held for a beat in the open and let go — off the flat it buys him a
  // second of air under the real g, the room for a 360 or a grab.
  const O = d.ollie;
  const seed = takeSeed(state) ^ POP_SALT;
  const b = Math.floor(state.t / O.every);
  if (hash2(b, 0, seed) >= O.share || Math.abs(input.steer) > O.steer) return;
  const hold = O.least + (O.most - O.least) * hash2(b, 1, seed);
  const from = b * O.every + (O.every - hold) * hash2(b, 2, seed);
  if (state.t < from || state.t > from + hold) return;
  if (trunksNear(state, c.x + c.vx, c.z + c.vz, d) > d.roam.few) return;
  input.jump = true;
}

/** IN THE AIR: the flight's trick, and the levelling kept under the
 * loop's gate. `input` carries the bot's levelling lean in, and leaves with
 * this step's trick on it. */
export function daringAir(state: GameState, input: SkierInput, d: Daring): void {
  const c = state.skier;
  const A = d.air;
  const memo = memoOf(state);
  memo.target = null;
  const takeoff = state.tick - Math.round(c.airTime / TUNING.dt);
  if (memo.takeoff !== takeoff) {
    memo.takeoff = takeoff;
    memo.plan = null;
  }
  const down = landingAhead(c, state.level, flightGravity(state.rules));
  const left = down ? down.t : 3;
  // PICKED once, the first step the flight counts as one, off the whole
  // of it.
  // ...and only a flight the strokes will turn: one he sprang into, or one
  // with the air for a loop whatever threw him (`strokes.ts`).
  const sprang = c.launchVy >= TUNING.tricks.launch;
  if (memo.plan === null && c.airTime >= TUNING.air.counts && !c.thrown) {
    memo.plan = planFlight(state, takeoff, c.airTime + left, sprang, left, d);
  }
  const plan = memo.plan;
  input.lean = clamp(input.lean, -A.level, A.level);
  if (!plan || c.thrown) return;
  const k = state.tricks;
  // THE LOOP, paced round onto his skis; let go, nothing more is asked of
  // the lean until it has died away.
  if (plan.loops > 0) {
    const lean = flipLean(state, plan.loops, plan.dir);
    if (lean !== 0) input.lean = lean;
    else if (k.flipGoal !== 0 || k.flipDone !== 0) input.lean = 0;
    return;
  }
  // THE TWIRL, half a turn a tap.
  let tapped = false;
  for (let n = 0; n < plan.taps; n++) {
    const at = A.tapFrom + n * A.tapEvery;
    if (c.airTime >= at && c.airTime < at + A.tapFor) tapped = true;
  }
  if (tapped) input.steer = plan.way;
  // THE GRAB, once the taps are thrown and his pitch has settled onto the
  // landing — grabbing, nothing levels or damps it (`poseInput`) — let go
  // before the snow, or as soon as the levelling would ask hard again.
  const thrown = A.tapFrom + plan.taps * A.tapEvery;
  const settled = Math.abs(input.lean) < (k.pose !== null ? A.drift : A.settled);
  if (plan.grab && c.airTime >= thrown && left > A.letGo && settled) {
    input.trick = true;
    input.steer = 0;
    // Which grab: the hand on the ski, the spread or the daffy.
    const r = hash2(takeoff, 3, takeSeed(state) ^ AIR_SALT);
    input.lean = r >= 0.4 && r < 0.7 ? 1 : 0;
    if (r >= 0.7) input.steer = plan.way;
  }
}

/** The trick a flight of `total` s gets, `left` of it still to come: one
 * he `sprang` into takes any the air has room for; one a knoll threw him
 * into, only a loop with a big flight's air still ahead (`strokes.ts`'s
 * `bigFlight`) or a grab. */
function planFlight(
  state: GameState,
  takeoff: number,
  total: number,
  sprang: boolean,
  left: number,
  d: Daring,
): Plan {
  const A = d.air;
  const seed = takeSeed(state) ^ AIR_SALT;
  const r = hash2(takeoff, 0, seed);
  const way = hash2(takeoff, 1, seed) < 0.5 ? -1 : 1;
  const plan: Plan = { taps: 0, way, loops: 0, dir: 1, grab: false };
  const big = left >= TUNING.tricks.bigFlight + 0.1;
  if (!sprang) {
    if (big && total >= A.flip && r < A.flipShare) plan.loops = 1;
    else plan.grab = total >= A.grab;
    return plan;
  }
  if (total >= A.flip && r < A.flipShare) {
    plan.loops = total >= A.double && hash2(takeoff, 2, seed) < A.doubleShare ? 2 : 1;
    plan.dir = hash2(takeoff, 4, seed) < 0.7 ? 1 : -1;
    return plan;
  }
  // The most half turns the air allows, and now and then one fewer.
  let most = 0;
  while (most < A.spins.length && total >= A.spins[most]) most++;
  // ...and a spin that lands him switch (an odd count) more often rounded
  // down to one that does not.
  const fewer = most > 1 && hash2(takeoff, 5, seed) < (most % 2 === 1 ? 0.6 : 0.25) ? 1 : 0;
  plan.taps = most - fewer;
  plan.grab = total >= A.grab + plan.taps * A.tapEvery;
  return plan;
}
