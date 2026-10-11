// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDER OFF THE SNOW — on a lift, and with the board carried —
// as the same `BoardPose` the riding rider is drawn from (`board-pose.ts`).
// Three-free: the model (`board-model.ts`), the lift labs and the suite
// read it alike. From the project's snowboard research (§5 lifts, §8 what
// reads right, the chairlift photographs):
//
//   * ON A CHAIR he rides with the FRONT FOOT STRAPPED IN and the REAR FOOT
//     OUT (the engine keeps `SkierState.board.free` set from the load zone
//     to the top). Sat back on the seat as a skier sits, the board HANGS OFF
//     HIS FRONT FOOT, its tail down and turned some 45° off the line of
//     travel, the nose forward and out to his front foot's side — the
//     binding's angle across the deck turns the foot in to it — and his free
//     rear foot RESTS ON THE DECK by the rear binding, taking the board's
//     weight off the front knee (`chairBoardPose`).
//   * LOADING AND UNLOADING are the riding pose with the rear foot on the
//     stomp pad — the board pointed up the line, nose first, gliding
//     straight — blended to the chair's by how seated he is.
//   * A T-BAR is ridden SIDE-ON as he rides, the board up the track, the
//     rear foot free on the pad, and — alone on it — the bar's middle
//     BETWEEN HIS LEGS, the bar across behind his front thigh pulling him
//     by it, its stem leaning up the track in front of his front hip to the
//     cord, the rope over him (`BOARD_TOW`: `lifts.ts` hangs it there, the
//     engine's `teeSide` stands him under the rope).
//   * IN A GONDOLA'S CABIN he sits on the bench with both feet on its floor,
//     the board standing in the rack on the door (`cabinBoardPose`).
//   * CARRIED, the board is held UNDER HIS ARM on his rear-foot side, on
//     its edge along his way, its base against his hip and his hand round
//     its lower edge (`UNDER_ARM`, `underArmFrame`).

import { TUNING } from "@engine";

import { BINDING, SOFT_BOOT } from "./board-look.ts";
import {
  bindingsOf,
  boardPose,
  cuffOver,
  frontIndex,
  onDeck,
  type BoardFrame,
  type BoardPose,
  type BoardPoseInput,
} from "./board-pose.ts";
import { CABIN_FLOOR, CHAIR_SEAT, seatPose } from "./skier-seat.ts";
import { BODY, MOUNTS, SHIN_ABOVE_CUFF, skierPose, type SkierPose } from "./skier-pose.ts";
import { solveLimb, type Boot } from "./skier-limbs.ts";
import { add, dot, len, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";

type Board = BoardPoseInput["board"];

/** THE BOARD ON THE CHAIR: how far the front foot is turned in off the
 * line (rad — the board's nose follows it round, `90° − binding` past it),
 * how far the sole is rolled so the tail drops (rad), how far forward of
 * plumb the front shin hangs (rad), and where along the deck from its
 * middle the free rear foot rests on it (a share of the stance, the stomp
 * pad by the rear binding). */
export const CHAIR_BOARD = { turnIn: 0.5, roll: 0.75, shin: 0.3, rest: -0.22 };

/** A T-BAR'S BAR UNDER A BOARD RIDER, in his body frame, m: the bar's
 * middle between his legs (x 0) behind his FRONT thigh (the board points
 * up the track, so the front leg is up it, `z` positive), at the height of
 * the back of that thigh, the bar across the line; its stem leaning `lean`
 * rad up the track off plumb, toward the cord pulling it. */
export const BOARD_TOW = { y: -0.28, z: 0.12, lean: 0.6 };

/** The point `up` m up a board rider's T-bar stem from the bar, in his
 * body frame (`BOARD_TOW`). */
export function boardStem(up: number): V3 {
  return {
    x: 0,
    y: BOARD_TOW.y + up * Math.cos(BOARD_TOW.lean),
    z: BOARD_TOW.z + up * Math.sin(BOARD_TOW.lean),
  };
}

/** THE HAND ON THE T-BAR'S STEM, m: how far up the stem from the bar the
 * fist closes round it (`lifts.ts` stands the stem 0.6 m up from the bar,
 * its eye at the top), and the elbow's pole — out from the body and down. */
export const TOW_GRIP = { up: 0.4, elbowOut: 1, elbowDown: -0.7 };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const UP: V3 = { x: 0, y: 1, z: 0 };
const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** `v` turned `a` rad about the unit axis `k`. */
function turn(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

/** A skier's pose stood at rest, his hands empty — what a seat reshapes. */
function restPose(): SkierPose {
  return skierPose({
    hipRight: 0,
    hipAft: 0,
    lean: 0,
    steer: 0,
    crouch: 0,
    airborne: false,
    landing: 0,
    poles: false,
  });
}

/** The deck whose binding of foot `i` has its sole at `sole` and its boot
 * `boot`: the board turned about the boot's sole to the binding's angle. */
export function deckFromBoot(board: Board, i: 0 | 1, sole: V3, boot: Boot): BoardFrame {
  const fi = frontIndex(board.lead);
  const face = board.lead === "regular" ? 1 : -1;
  const front = i === fi;
  const a = front ? board.front : board.back;
  // The toes are `right·face·cos a + along·sin a` (`bindingsOf`): the deck's
  // nose is the toes turned back about the sole's normal by 90° − a.
  const n = norm(boot.n);
  const along = norm(turn(boot.f, n, -face * (Math.PI / 2 - a)));
  const right = norm(cross(n, along));
  const s = ((front ? 1 : -1) * board.stance) / 2;
  const frame: BoardFrame = { centre: { x: 0, y: 0, z: 0 }, along, normal: n, right, bend: 0 };
  frame.centre = sub(sole, onDeck(frame, board, s, BINDING.plate));
  return frame;
}

/** THE RIDER SAT ON A CHAIR, `seatY` the seat's top in his body frame: the
 * board hung off his front foot, his rear foot resting on its deck. */
export function chairBoardPose(board: Board, seatY: number): BoardPose {
  const fi = frontIndex(board.lead);
  const ri = (1 - fi) as 0 | 1;
  const face = board.lead === "regular" ? 1 : -1;
  // Sat back, the thighs along the seat (where `seatPose` puts the hips).
  const sat = seatPose(restPose(), { share: 1, y: seatY }, MOUNTS);
  const hip = sat.hipJoints[fi];
  const knee = add(hip, { x: 0, y: -0.04, z: BODY.thigh * 0.99 });
  // The front shin hung a little forward of plumb, its boot turned in.
  const B = CHAIR_BOARD;
  const shin = norm({ x: 0, y: -Math.cos(B.shin), z: Math.sin(B.shin) });
  const cuffF = add(knee, scale(shin, SHIN_ABOVE_CUFF));
  const toes = turn({ x: 0, y: 0, z: 1 }, UP, face * B.turnIn);
  const flatToes = norm({ x: toes.x, y: -0.25, z: toes.z });
  // The sole rolled about the foot so the deck's tail, on the rear foot's
  // side, drops.
  const up0 = norm(sub(UP, scale(flatToes, dot(UP, flatToes))));
  const nF = norm(turn(up0, flatToes, -face * B.roll));
  const bootF: Boot = { f: flatToes, n: nF };
  const soleF = add(add(cuffF, scale(nF, -SOFT_BOOT.cuff)), scale(flatToes, SOFT_BOOT.heel));
  const deck = deckFromBoot(board, fi, soleF, bootF);
  // The rear foot on the deck by its binding — or as near it along the
  // deck as his leg reaches.
  const rearToes = bindingsOf(deck, { board }).boot[ri];
  const reach = (BODY.thigh + SHIN_ABOVE_CUFF) * 0.97;
  let at = B.rest * board.stance;
  let cuffR = cuffOver(onDeck(deck, board, at, 0.004), rearToes);
  for (let k = 0; k < 12 && len(sub(cuffR, sat.hipJoints[ri])) > reach; k++) {
    at += 0.04;
    cuffR = cuffOver(onDeck(deck, board, at, 0.004), rearToes);
  }
  const base = restPose();
  base.feet[fi] = cuffF;
  base.boots[fi] = bootF;
  base.feet[ri] = cuffR;
  base.boots[ri] = rearToes;
  const p = seatPose(base, { share: 1, y: seatY }, MOUNTS);
  // Each knee over its own foot, bent up and out off the seat's edge.
  for (const i of [0, 1] as const) {
    p.knees[i] = solveLimb(p.hipJoints[i], p.feet[i], BODY.thigh, SHIN_ABOVE_CUFF, {
      x: (i ? 1 : -1) * 0.15,
      y: 0.6,
      z: 1,
    });
  }
  p.poles = null;
  return { pose: p, board: deck, free: ri, rise: 0 };
}

/** THE RIDER SAT IN A GONDOLA'S CABIN, both soft boots on its floor; the
 * board is in the rack (laid where the engine racks it, `rackedFrame`). */
export function cabinBoardPose(seatY: number, floor = CABIN_FLOOR): SkierPose {
  const base = restPose();
  for (const i of [0, 1] as const) {
    const f = norm({ x: (i ? 1 : -1) * 0.25, y: 0, z: 1 });
    base.boots[i] = { f, n: UP };
    base.feet[i] = {
      x: (i ? 1 : -1) * 0.14,
      y: floor + SOFT_BOOT.cuff,
      z: 0.28 - SOFT_BOOT.heel,
    };
  }
  const p = seatPose(base, { share: 1, y: seatY, floor }, MOUNTS);
  p.poles = null;
  return p;
}

/** Two poses blended joint by joint, `k` of the way from `a` to `b`. */
export function mixPose(a: SkierPose, b: SkierPose, k: number): SkierPose {
  const t = clamp(k, 0, 1);
  const m = (p: V3, q: V3): V3 => mix(p, q, t);
  const m2 = (p: [V3, V3], q: [V3, V3]): [V3, V3] => [m(p[0], q[0]), m(p[1], q[1])];
  const boot = (p: Boot, q: Boot): Boot => ({ f: norm(m(p.f, q.f)), n: norm(m(p.n, q.n)) });
  return {
    ...b,
    hips: m(a.hips, b.hips),
    hipJoints: m2(a.hipJoints, b.hipJoints),
    waist: m(a.waist, b.waist),
    neck: m(a.neck, b.neck),
    head: m(a.head, b.head),
    pitch: a.pitch + (b.pitch - a.pitch) * t,
    roll: a.roll + (b.roll - a.roll) * t,
    headRoll: a.headRoll + (b.headRoll - a.headRoll) * t,
    knees: m2(a.knees, b.knees),
    feet: m2(a.feet, b.feet),
    boots: [boot(a.boots[0], b.boots[0]), boot(a.boots[1], b.boots[1])],
    shoulders: m2(a.shoulders, b.shoulders),
    elbows: m2(a.elbows, b.elbows),
    hands: m2(a.hands, b.hands),
    poles: null,
    look: a.look + (b.look - a.look) * t,
  };
}

/** Two decks blended, `k` of the way from `a` to `b`, its axes kept square. */
export function mixDeck(a: BoardFrame, b: BoardFrame, k: number): BoardFrame {
  const t = clamp(k, 0, 1);
  const along = norm(mix(a.along, b.along, t));
  let normal = mix(a.normal, b.normal, t);
  normal = norm(sub(normal, scale(along, dot(normal, along))));
  return {
    centre: mix(a.centre, b.centre, t),
    along,
    normal,
    right: norm(cross(normal, along)),
    bend: a.bend + (b.bend - a.bend) * t,
  };
}

/** How the lift has him as drawn: sat on a chair or a cabin's bench
 * (`seated`, 0..1) and towed (`towing`, 0..1), the seat's top in his body
 * frame, and whether the seat is a cabin's. */
export type BoardSeat = { seated: number; towing: number; y: number; cabin: boolean };

/** The seat's top under a chair's or a cabin's rider, m (`skier-seat.ts`). */
export const BOARD_SEAT_Y = TUNING.lift.seat - CHAIR_SEAT;

/** THE RIDER ON A LIFT for one frame: the riding pose off the engine's
 * readings (the rear foot on the pad), sat onto a chair by `seat.seated`,
 * his board hung off his front foot; in a cabin, sat on the bench with the
 * deck left where the riding pose had it (the model lays it in the rack).
 * Towed by a T-bar he rides side-on as he rides, the riding pose itself. */
export function boardLiftPose(input: BoardPoseInput, seat: BoardSeat): BoardPose {
  const ride = boardPose(input);
  if (seat.seated <= 0) return seat.towing > 0 ? towedBoardPose(ride, seat.towing) : ride;
  if (seat.cabin) {
    return { ...ride, pose: mixPose(ride.pose, cabinBoardPose(seat.y), seat.seated), free: null };
  }
  const chair = chairBoardPose(input.board, seat.y);
  return {
    pose: mixPose(ride.pose, chair.pose, seat.seated),
    board: mixDeck(ride.board, chair.board, seat.seated),
    free: chair.free,
    rise: ride.rise * (1 - seat.seated),
  };
}

/** TOWED BY A T-BAR, by `share` (0..1): the riding pose with the hand
 * nearer the stem (`lifts.ts` hangs it between his legs, the bar behind
 * his front thigh, `boardStem`) closed round it `TOW_GRIP.up` up it,
 * its elbow solved again out from the body; the other hand left where the
 * riding pose has it. */
export function towedBoardPose(ride: BoardPose, share: number): BoardPose {
  const k = clamp(share, 0, 1);
  if (k <= 0) return ride;
  const p = ride.pose;
  const stem = boardStem(TOW_GRIP.up);
  const i = len(sub(p.shoulders[0], stem)) <= len(sub(p.shoulders[1], stem)) ? 0 : 1;
  const hands = [p.hands[0], p.hands[1]] as [V3, V3];
  const elbows = [p.elbows[0], p.elbows[1]] as [V3, V3];
  const reach = BODY.upperArm + BODY.forearm;
  // Short of the stem the fist reaches as far toward it as the arm goes.
  const to = sub(stem, p.shoulders[i]);
  const far = len(to);
  const grip = far > reach * 0.98 ? add(p.shoulders[i], scale(to, (reach * 0.98) / far)) : stem;
  hands[i] = mix(p.hands[i], grip, k);
  const out = norm({ x: Math.sign(grip.x - p.hips.x) || -1, y: 0, z: 0 });
  const pole = norm(add(scale(out, TOW_GRIP.elbowOut), { x: 0, y: TOW_GRIP.elbowDown, z: 0 }));
  elbows[i] = mix(
    p.elbows[i],
    solveLimb(p.shoulders[i], hands[i], BODY.upperArm, BODY.forearm, pole),
    k,
  );
  return { ...ride, pose: { ...p, hands, elbows } };
}

/** UNDER HIS ARM, in the frame of a rider stood on foot (x his right, y up
 * off the snow, z the way he faces), m: the deck's middle on his REAR-FOOT
 * side by his hip, on its edge along his way, the nose a little down; and
 * the hand on that side round the deck's lower edge outside it. */
export const UNDER_ARM = {
  centre: { x: 0.25, y: 0.98, z: 0.06 },
  nose: -0.12,
  hand: { x: 0.36, y: 0.86, z: 0.14 },
};

/** The deck under his arm in the on-foot frame, for a board ridden by
 * `lead` (carried on the rear foot's side: the right for a regular rider). */
export function underArmFrame(lead: "regular" | "goofy"): BoardFrame {
  const side = lead === "regular" ? 1 : -1;
  const along = norm({ x: 0, y: UNDER_ARM.nose, z: 1 });
  // The base against his hip, the bindings out.
  const normal: V3 = { x: side, y: 0, z: 0 };
  return {
    centre: { ...UNDER_ARM.centre, x: UNDER_ARM.centre.x * side },
    along,
    normal,
    right: norm(cross(normal, along)),
    bend: 0,
  };
}

/** The hand round the carried deck's lower edge: index 1 his right. */
export function underArmHand(lead: "regular" | "goofy"): { i: 0 | 1; at: V3 } {
  const side = lead === "regular" ? 1 : -1;
  return { i: side > 0 ? 1 : 0, at: { ...UNDER_ARM.hand, x: UNDER_ARM.hand.x * side } };
}
