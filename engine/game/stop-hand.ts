// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ONE-KEY BRAKE AND THE CLIMB — the player's hands on the back key and
// the tuck made into what a skier does with them, on a run with no course
// owed (`RunRules.course` off: the free ride and the tricks park).
//
// THE BACK KEY HELD WITH NO EDGE ASKED STOPS HIM. At speed he LINKS
// SKIDDED TURNS — each finished `hand.across` across the fall line and the
// next begun the other way — and from `hand.link` down the turn he is in
// is carried on round into a HOCKEY STOP, uphill, until he stands. Held on
// once he has stopped, he stands. An edge asked with the back key is the
// hockey stop by hand, and the hand lets go.
//
// PRESSED AGAIN STOOD STILL, IT TAKES HIM BACK — up the hill when it rises
// behind him or beside him: walked straight up a gentle slope (under
// `hand.walk`) and SIDESTEPPED up a steeper one, stood across it first;
// with the hill IN FRONT of him, he steps round to face down it; on the
// flat, he steps round to face the way he came and walks it.
//
// THE TUCK HELD STOOD FACING A HILL CLIMBS IT the same way.
//
// None of it is the engine's own step: the hand turns the player's input
// into the controls this step is ridden on — a steer, a brake, a tuck —
// and those are what the engine is handed, what a ghost records and what a
// replay rides again. The engine's own moves do the rest: the skid
// (`skier.ts`), the step round on the spot (`poles.ts`'s `stepRound`), the
// walk (`poles.ts`), the sidestep (`sidestep.ts`). It reads the state and
// draws nothing from the stream, so no digest moves; the bot never asks
// for it.

import { angleDiff, approach, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { TUNING } from "./defs/tuning.ts";
import { hillSide, slopeOf } from "./sidestep.ts";
import type { GameState, SkierInput } from "./state.ts";

const H = TUNING.hand;

/** What the hands are asking for this step, as the keys and thumbs are
 * held: `back` the back key down in its brake meaning (`input-model.ts`'s
 * `backMode`), `go` the tuck down. */
export type HandAsk = { back: boolean; go: boolean };

/** What the hand is doing: nothing; slowing him to a stop; stood after
 * one; taking him back; climbing. */
export type HandMode = "none" | "stop" | "stopped" | "back" | "climb";

export type StopHand = {
  mode: HandMode;
  /** The side the turn he is in goes, ±1 (steer's sign). */
  side: number;
  /** Turns the zig-zag still owes before the hockey stop may come. */
  owed: number;
  /** The steer the zig-zag has put on, -1..1: eased in and swung across
   * at `hand.swing`, never thrown at once. */
  steer: number;
  /** The heading he is stepping round to, rad, once one is chosen. */
  aim: number | null;
  /** What BACK does this press, decided as it went down: climb the hill
   * behind him, turn to face down the one in front, or turn round on the
   * flat and walk back. */
  plan: "climb" | "down" | "turn" | null;
  /** Whether the back key and the tuck were down last step. */
  back: boolean;
  go: boolean;
};

export function createStopHand(): StopHand {
  return {
    mode: "none",
    side: 1,
    owed: 0,
    steer: 0,
    aim: null,
    plan: null,
    back: false,
    go: false,
  };
}

const n: Vec3 = { x: 0, y: 1, z: 0 };

/** Out on the snow on his own skis: not in the air, thrown, on a lift, a
 * machine, a tunnel's wind or a rail, under a wing, in a basket, indoors
 * or walking in town. */
function onOwnSkis(state: GameState): boolean {
  const c = state.skier;
  if (c.airborne || c.thrown || c.lift || c.tunnel || c.jib || c.town || c.fetch) return false;
  if (state.heli?.rider || state.sled?.mode === "ridden" || state.balloon?.aboard) return false;
  if (state.para && state.para.mode !== "dropped") return false;
  if (state.afterski?.inside) return false;
  return !state.groomers?.some((g) => g.rider);
}

/** The heading straight down the slope under normal `n`, rad. */
function fallHeading(v: Vec3): number {
  return Math.atan2(v.x, v.z);
}

/**
 * This step's controls, the hand applied: `input` (what the keys and the
 * thumbs made, written in place) shaped by `ask` on the run `state`.
 * Returns `input`.
 */
export function stopHand(
  hand: StopHand,
  state: GameState,
  ask: HandAsk,
  input: SkierInput,
): SkierInput {
  const c = state.skier;
  const pressedBack = ask.back && !hand.back;
  const pressedGo = ask.go && !hand.go;
  hand.back = ask.back;
  hand.go = ask.go;
  const free = !state.rules.course && state.phase === "racing" && onOwnSkis(state);
  // An edge asked with the back key is his own hockey stop.
  const handsOn = Math.abs(input.steer) > H.steerFree;
  if (!free || (!ask.back && !ask.go) || (ask.back && handsOn)) {
    hand.mode = "none";
    hand.aim = null;
    hand.plan = null;
    return input;
  }
  const speed = c.speed;
  state.level.normalAt(c.x, c.z, n);
  const slope = slopeOf(n);
  const theta = angleDiff(fallHeading(n), c.heading);

  if (ask.back) {
    if (pressedBack || hand.mode === "none" || hand.mode === "climb") {
      hand.aim = null;
      hand.plan = null;
      hand.steer = 0;
      hand.mode = speed < H.crawl ? "back" : "stop";
      // Fast, he zig-zags at least once before he stops.
      hand.owed = speed > H.link ? H.links : 0;
      // The turn begun the way he already leans off the fall line.
      hand.side = Math.abs(theta) > 0.05 ? Math.sign(theta) : 1;
    }
    // Taken back and found sliding down the hill, he stops first.
    if (hand.mode === "back" && speed > H.crawl && c.vy < -H.still) {
      hand.mode = "stop";
      hand.aim = null;
      hand.plan = null;
      hand.owed = 0;
    }
    if (hand.mode === "stop") {
      if (speed < H.still) hand.mode = "stopped";
      // Steered by the way he is GOING, off the fall line: on a steep
      // slope skis across it still slip down it.
      else
        return slowDown(
          hand,
          input,
          speed,
          slope,
          angleDiff(fallHeading(n), Math.atan2(c.vx, c.vz)),
        );
    }
    if (hand.mode === "stopped") {
      // Stood on the brake, his skis set: held there, across the hill or
      // a little up it, until he lets go — and held after, on his edges.
      input.steer = 0;
      input.tuck = 0;
      input.brake = 1;
      return input;
    }
    return goBack(hand, state, input, slope, theta);
  }

  // THE TUCK HELD: a climb, if it went down slow and facing a hill.
  if (pressedGo || hand.mode !== "climb") {
    hand.aim = null;
    hand.plan = null;
    const facingUp = Math.abs(theta) > H.facing;
    hand.mode = speed < H.crawl && slope >= H.hill && facingUp ? "climb" : "none";
  }
  if (hand.mode !== "climb") return input;
  return climb(hand, state, input, slope, theta);
}

/** THE ZIG-ZAG AND THE HOCKEY STOP: a skidded turn toward `hand.side`,
 * finished across the fall line — the further the steeper — and the next
 * begun the other way while he is fast; and the last carried round until
 * he is going a little uphill, where the slope stops him. `psi` is the way
 * he is going off the fall line, rad. */
function slowDown(
  hand: StopHand,
  input: SkierInput,
  speed: number,
  slope: number,
  psi: number,
): SkierInput {
  const linking = speed > H.link || (hand.owed > 0 && speed > H.owedTo);
  const steep = clamp((slope - H.gentle) / (H.steep - H.gentle), 0, 1);
  const across = linking
    ? H.across + (H.acrossSteep - H.across) * steep
    : H.last + (H.lastSteep - H.last) * steep;
  if (linking && hand.side * psi >= across - H.flip) {
    hand.side = -hand.side;
    hand.owed = Math.max(0, hand.owed - 1);
  }
  // At speed a turn is laid in, never thrown: the steer eased toward its
  // side, the faster the gentler — and, nearing the end of the turn, eased
  // off so it is finished where it is meant to be, not carried round.
  const most = Math.max(Math.min(1, H.link / speed) ** H.ease, H.least);
  const want = hand.side * clamp((across - hand.side * psi) / H.band, -most, most);
  hand.steer = approach(hand.steer, want, H.swing * TUNING.dt);
  input.steer = hand.steer;
  input.brake = linking ? H.skid : H.stop * (1 - steep);
  input.tuck = 0;
  input.lean = 0;
  return input;
}

/** The heading square across the fall line `fall` nearer `heading`. */
function nearestAcross(heading: number, fall: number): number {
  const right = fall + Math.PI / 2;
  const left = fall - Math.PI / 2;
  return Math.abs(angleDiff(heading, right)) <= Math.abs(angleDiff(heading, left)) ? right : left;
}

/** The steer that steps him round on the spot toward `aim`: none once he
 * is there. */
function stepToward(c: GameState["skier"], aim: number): number {
  const d = angleDiff(c.heading, aim);
  return Math.abs(d) <= H.aim ? 0 : Math.sign(d);
}

/** Whether he is still STEPPING ROUND (`poles.ts`'s `stepRound`): a pair
 * of steps is let finish, and the step round let go, before the next
 * move is asked for — a steer held on would begin another pair. */
function turning(c: GameState["skier"]): boolean {
  return c.pivot !== 0;
}

/** BACK: up the hill behind or beside him, round to face down one in front
 * of him, or round to walk back the way he came on the flat — which, is
 * decided as the key goes down and kept while it is held. */
function goBack(
  hand: StopHand,
  state: GameState,
  input: SkierInput,
  slope: number,
  theta: number,
): SkierInput {
  const c = state.skier;
  input.brake = 0;
  input.lean = 0;
  if (hand.plan === null) {
    hand.plan = slope < H.hill ? "turn" : Math.abs(theta) > H.upHill ? "down" : "climb";
    hand.aim =
      hand.plan === "turn" ? c.heading + Math.PI : hand.plan === "down" ? c.heading - theta : null;
  }
  if (hand.plan === "climb") return climb(hand, state, input, slope, theta);
  const turn = stepToward(c, hand.aim ?? c.heading);
  input.steer = turn;
  // Round on the flat, he walks back the way he came; round to face down
  // a hill, he lets it take him back, ploughed.
  const round = turn === 0 && !turning(c);
  input.tuck = hand.plan === "turn" && round ? 1 : 0;
  input.brake = hand.plan === "down" && round ? 1 : 0;
  return input;
}

/** UP THE HILL: walked straight up a gentle one, sidestepped up a steep
 * one, stepped round on the spot first to face it or stand across it. */
function climb(
  hand: StopHand,
  state: GameState,
  input: SkierInput,
  slope: number,
  theta: number,
): SkierInput {
  const c = state.skier;
  input.brake = 0;
  input.lean = 0;
  const fall = c.heading - theta;
  if (slope < H.walk) {
    // Walked straight up: round to face it, then the tuck walks him.
    const turn = stepToward(c, fall + Math.PI);
    input.steer = turn;
    input.tuck = turn === 0 && !turning(c) ? 1 : 0;
    return input;
  }
  input.tuck = 0;
  // Stood across it, the steer into the hill sidesteps him up it.
  const side = hillSide(c, n);
  if (side !== 0 && (c.sidestep !== 0 || hand.aim === null || stepToward(c, hand.aim) === 0)) {
    input.steer = turning(c) ? 0 : side;
    return input;
  }
  // ...else round to stand across it, whichever way is nearer.
  if (hand.aim === null) hand.aim = nearestAcross(c.heading, fall);
  input.steer = stepToward(c, hand.aim);
  return input;
}

/** His heading off straight down the slope, rad (0 down it, ±π up it). */
export function headingOffFall(state: GameState): number {
  const c = state.skier;
  state.level.normalAt(c.x, c.z, n);
  return hypot(n.x, n.z) < 1e-6 ? 0 : angleDiff(fallHeading(n), c.heading);
}
