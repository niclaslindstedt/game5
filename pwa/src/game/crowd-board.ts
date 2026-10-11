// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD'S SNOWBOARDERS, POSED — the joints of an amateur on a board
// (`Amateur.board`) for each of the shapes his figure is drawn between
// (`BOARD_POSES`), as `crowd-rig.ts` poses one on skis. Three-free, so the
// suite reads it (`tests/crowd_figure_test.ts`).
//
// THE PLAYER'S OWN RIDER, NOT A SECOND ONE. Every shape is the snowboarder
// the player rides as (`board-pose.ts`'s `boardPose`, `board-lift.ts`'s
// chair) solved for the moment it names, on the Lynx, and sized to the
// amateur's body: the athletic stance across the board, a toeside and a
// heelside turn and each carved hard, the side-on tuck, the heelside skid a
// rider stops on, the one-foot skate, the air, the T-bar's stance with the
// rear foot out on the pad, the chair with the board hanging off his front
// foot, and stood still, waiting. The one shape the player has no pose for
// is the rider SAT IN THE SNOW — at the top of a run strapping in, below a
// crest waiting — and it is built here off the player's own seated pose
// (`skier-seat.ts`) lowered onto the snow: the board across the hill in
// front of him on its heel edge, his knees up, his hands behind him (the
// project's snowboard research, the resting and strap-in photographs).
//
// A REGULAR RIDER ONLY. Every shape is a regular rider's (the left foot
// forward); a goofy one is the same figure mirrored (`boardDialsOf`'s
// mirror), as a fall's side mirrors one on skis.
//
// The frame is the amateur's — x right, y up, z forward along his heading,
// the origin on the snow under the board's middle — and a board's heading
// is its nose's: the rider stands across it, side-on to the way he goes.

import { LYNX, type Amateur } from "@engine";

import { BOARD_SEAT_Y, chairBoardPose } from "./board-lift.ts";
import {
  bindingsOf,
  boardPose,
  cuffOver,
  snowPlane,
  type BoardFrame,
  type BoardPoseInput,
} from "./board-pose.ts";
import { fromPlayer, mapPosed, type CrowdLook, type Posed, type V3 } from "./crowd-rig.ts";
import { solveLimb } from "./skier-limbs.ts";
import { BODY, MOUNTS, SHIN_ABOVE_CUFF, skierPose, type SkierPose } from "./skier-pose.ts";
import { seatPose } from "./skier-seat.ts";
import { smooth } from "./skier-stroke.ts";

/** The shapes a rider's figure is drawn between, each a morph target of its
 * own off the riding stance, in the order the weights go in. */
export const BOARD_POSES = [
  "crouch",
  "toe",
  "heel",
  "carveToe",
  "carveHeel",
  "stop",
  "skate0",
  "skate1",
  "skate2",
  "skate3",
  "air",
  "tow",
  "idle",
  "idleAway",
  "chair",
  "sit",
] as const;
export type BoardShapePose = (typeof BOARD_POSES)[number];
export type BoardDials = Partial<Record<BoardShapePose, number>>;

/** The one-foot skate as keys over one stride (`board-pose.ts`' `SKATE`). */
export const BOARD_SKATE_KEYS = 4;

/** The board every amateur rides: the Lynx, its numbers as the pose wants
 * them, a regular rider's. */
export const CROWD_BOARD: BoardPoseInput["board"] = {
  length: LYNX.length,
  waist: LYNX.waist,
  tipWidth: LYNX.tipWidth,
  tailWidth: LYNX.tailWidth,
  sidecut: LYNX.sidecut,
  stance: LYNX.board!.stance,
  front: LYNX.board!.front,
  back: LYNX.board!.back,
  lead: "regular",
};

/** The inclination a turn and a carve are drawn at, rad, toe and heel —
 * the heel edge stood the less (`BoardFit.heel`) — and the lean the crowd
 * reads as the turn's whole, past which it carves (`Amateur.lean`). */
const TURN = { toe: 0.26, heel: 0.28, carveToe: 0.36, carveHeel: 0.5 };
const LEAN = { turn: 0.4, carve: 0.75 };
/** The heelside skid's pivot, rad: the board thrown across his way, so he
 * faces down it on his heel edge. */
const STOP_ANGLE = -1.35;
/** The player's wait's two moments (`crowd-rig.ts`' `WAIT`). */
const WAIT = { one: 95.48, other: 62.43, period: 7.3 };
/** The reference man's height, m — the board pose's measures are his. */
const REFERENCE = 1.8;

const RIDE: BoardPoseInput = {
  board: CROWD_BOARD,
  ground: -LYNX.cogHeight,
  crouchDrop: LYNX.crouchDrop,
  edge: 0,
  incline: 0,
  angle: 0,
  worldUp: { x: 0, y: 1, z: 0 },
  lift: [0, 0],
  crouch: 0.15,
  lean: 0,
  air: 0,
  bump: 0,
  load: 0,
  carve: 0,
  skid: 0,
  travel: { x: 0, y: 0, z: 7 },
  speed: 7,
  switched: false,
  free: false,
  hop: 0,
  drive: 0,
  stride: 0,
};

/** A turn's input at its inclination `r` (+ toeside for a regular rider),
 * the edge stood a little past it, the world's up held for the head. */
function turned(r: number, carve: number, crouch = RIDE.crouch): BoardPoseInput {
  return {
    ...RIDE,
    crouch,
    edge: r * 1.1,
    incline: r,
    carve,
    worldUp: { x: -Math.sin(r), y: Math.cos(r), z: 0 },
  };
}

const INPUTS: Readonly<Record<Exclude<BoardShapePose, "chair" | "sit">, BoardPoseInput>> = {
  crouch: { ...RIDE, crouch: 1 },
  toe: turned(TURN.toe, 0.2),
  // On his heels he sits down into the turn, knees well bent.
  heel: turned(-TURN.heel, 0.2, 0.5),
  carveToe: turned(TURN.carveToe, 0.6),
  carveHeel: turned(-TURN.carveHeel, 0.6, 0.65),
  stop: {
    ...RIDE,
    angle: STOP_ANGLE,
    edge: -0.35,
    skid: 1,
    crouch: 0.35,
    travel: { x: 0, y: 0, z: 2 },
    speed: 2,
  },
  ...(Object.fromEntries(
    Array.from({ length: BOARD_SKATE_KEYS }, (_, k) => [
      `skate${k}`,
      {
        ...RIDE,
        free: true,
        freeShare: 1,
        drive: 1,
        stride: k / BOARD_SKATE_KEYS,
        speed: 2,
        travel: { x: 0, y: 0, z: 2 },
      },
    ]),
  ) as Record<`skate${0 | 1 | 2 | 3}`, BoardPoseInput>),
  air: { ...RIDE, air: 1, crouch: 0.4 },
  tow: { ...RIDE, free: true, freeShare: 1, speed: 3, travel: { x: 0, y: 0, z: 3 } },
  idle: { ...RIDE, speed: 0, travel: { x: 0, y: 0, z: 0 }, idle: { t: WAIT.one, still: 1 } },
  idleAway: {
    ...RIDE,
    speed: 0,
    travel: { x: 0, y: 0, z: 0 },
    idle: { t: WAIT.other, still: 1 },
  },
};

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const arr = (v: { x: number; y: number; z: number }): V3 => [v.x, v.y, v.z];

/** Turn `p` about the forward axis through `o` by `a` rad — positive takes
 * the top toward +x (`crowd-rig.ts`' own). */
function rollAbout(p: V3, o: V3, a: number): V3 {
  const x = p[0] - o[0];
  const y = p[1] - o[1];
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [o[0] + x * c + y * s, o[1] - x * s + y * c, p[2]];
}

/** THE PLAYER'S RIDER IN THE CROWD'S JOINTS: the body sized as one on skis
 * is (`fromPlayer`), and the board — the deck `deck` lies on in the
 * player's frame — as the figure's one plank, carried in BOTH ski slots
 * (`skiL` and `skiR` the same: the builder draws the first). */
export function boardPosed(pose: SkierPose, deck: BoardFrame, look: CrowdLook): Posed {
  const posed = fromPlayer(pose, look);
  const k = look.height / REFERENCE;
  const mid: V3 = [deck.centre.x * k, (deck.centre.y - MOUNTS.ground) * k, deck.centre.z * k];
  const along = arr(deck.along);
  const right = arr(deck.right);
  const half = (CROWD_BOARD.length / 2) * k;
  const plank = {
    mid,
    tail: add(mid, mul(along, -half)),
    tip: add(mid, mul(along, half)),
    side: add(mid, mul(right, (CROWD_BOARD.waist / 2 + 0.02) * k)),
  };
  return { ...posed, skiL: plank, skiR: { ...plank } };
}

/** A rider stood at rest, his hands empty — the pose a seat reshapes. */
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

/** SAT IN THE SNOW: how far in front of his hips the board's middle lies,
 * m; the heel edge's dig, rad (the toe edge raised off the snow); how far
 * apart, out and behind his hips his hands are put down, m. */
const SIT = { ahead: 0.62, dig: 0.3, hands: { out: 0.32, back: 0.2 } };

/** THE RIDER SAT IN THE SNOW facing down the hill: the player's seated pose
 * lowered onto it, the board across the hill in front of him on its heel
 * edge (its nose to his left — a regular rider's), his knees up over his
 * feet in its bindings and his hands put down behind him. */
export function sitBoardPose(): { pose: SkierPose; board: BoardFrame } {
  const snow = MOUNTS.ground;
  const p0 = seatPose(restPose(), { share: 1, y: snow + 0.02 }, MOUNTS);
  const hipsZ = (p0.hipJoints[0].z + p0.hipJoints[1].z) / 2;
  const normal = { x: 0, y: Math.cos(SIT.dig), z: -Math.sin(SIT.dig) };
  const along = { x: -1, y: 0, z: 0 };
  // right = normal × along: the toe edge, down the hill.
  const right = {
    x: normal.y * along.z - normal.z * along.y,
    y: normal.z * along.x - normal.x * along.z,
    z: normal.x * along.y - normal.y * along.x,
  };
  const lift = (CROWD_BOARD.waist / 2) * Math.sin(SIT.dig);
  const deck: BoardFrame = {
    centre: { x: 0, y: snow + lift, z: hipsZ + SIT.ahead },
    along,
    normal,
    right,
    bend: 0,
  };
  const { sole, boot } = bindingsOf(deck, { board: CROWD_BOARD });
  const base = restPose();
  for (const i of [0, 1] as const) {
    base.feet[i] = cuffOver(sole[i], boot[i]);
    base.boots[i] = boot[i];
  }
  const p = seatPose(base, { share: 1, y: snow + 0.02 }, MOUNTS);
  for (const i of [0, 1] as const) {
    p.knees[i] = solveLimb(p.hipJoints[i], p.feet[i], BODY.thigh, SHIN_ABOVE_CUFF, {
      x: (i ? 1 : -1) * 0.2,
      y: 1,
      z: 0.6,
    });
    // The hand put down behind him, out to his side, the elbow soft.
    const side = i ? 1 : -1;
    const hand = {
      x: p.hips.x + side * SIT.hands.out,
      y: snow + 0.05,
      z: p.hips.z - SIT.hands.back,
    };
    p.hands[i] = hand;
    p.elbows[i] = solveLimb(p.shoulders[i], hand, BODY.upperArm, BODY.forearm, {
      x: side,
      y: 0,
      z: -1,
    });
  }
  p.poles = null;
  return { pose: p, board: deck };
}

/** THE SKELETON for one shape: the riding stance with no dial, or the
 * target its one dial names, wholly — the player's rider solved for it,
 * sized to `look`, rolled into a turn about the board's edge on the snow,
 * and stood with the board's low edge on the snow. */
export function poseBoard(look: CrowdLook, dials: BoardDials = {}): Posed {
  const key = (Object.keys(dials) as BoardShapePose[]).find((k) => (dials[k] ?? 0) !== 0);
  if (key === "chair") {
    const c = chairBoardPose(CROWD_BOARD, BOARD_SEAT_Y);
    return boardPosed(c.pose, c.board, look);
  }
  if (key === "sit") {
    const s = sitBoardPose();
    return grounded(boardPosed(s.pose, s.board, look));
  }
  const input = key ? INPUTS[key] : RIDE;
  const bp = boardPose(input);
  const posed = boardPosed(bp.pose, bp.board, look);
  if (input.incline === 0) return grounded(posed);
  // Rolled back out of the body's frame into the snow's, about the board's
  // low edge on it.
  const k = look.height / REFERENCE;
  const c = snowPlane(input, bp.board).point;
  const edge: V3 = [c.x * k, (c.y - MOUNTS.ground) * k, c.z * k];
  return grounded(mapPosed(posed, (q) => rollAbout(q, edge, input.incline)));
}

/** Stood on the snow: the board's middle — its low edge, edged — at 0. */
function grounded(p: Posed): Posed {
  const low = Math.min(p.skiL.mid[1], p.skiL.side[1], 2 * p.skiL.mid[1] - p.skiL.side[1]);
  return low === 0 ? p : mapPosed(p, (q) => [q[0], q[1] - low, q[2]]);
}

/** The skeleton for each shape: the riding stance first, then every target
 * wholly, in `BOARD_POSES`' order. */
export function boardTargets(look: CrowdLook): Posed[] {
  return [poseBoard(look), ...BOARD_POSES.map((k) => poseBoard(look, { [k]: 1 }))];
}

const AT = Object.fromEntries(BOARD_POSES.map((k, i) => [k, i])) as Record<BoardShapePose, number>;

/** THE WEIGHTS a rider is drawn at, one a target in `BOARD_POSES`' order,
 * into `out`, and the mirror his figure is drawn at (−1 a goofy rider's).
 * Off the numbers the engine keeps for the picture, as `dialsOf` reads one
 * on skis: his lean a toeside or heelside turn — carved past the turn's
 * whole — his crouch the tuck, a stop the heelside skid, his work the
 * one-foot skate, a flight the air, stood still the wait; and off the lift
 * and the snow: sat in the snow (`Amateur.sit`), sat on a chair (`seat`,
 * as `dialsOf`'s), towed by a T-bar or stood in a queue (`tow`). Sat in
 * the snow or on a chair, every other target fades as he does. */
export function boardDialsOf(
  a: Pick<
    Amateur,
    | "id"
    | "board"
    | "crouch"
    | "lean"
    | "across"
    | "fall"
    | "push"
    | "pole"
    | "mode"
    | "airAt"
    | "airT"
    | "speed"
    | "sit"
  >,
  out: Float32Array | number[],
  t = 0,
  seat = 0,
  tow = 0,
): number {
  const mirror = a.board === "goofy" ? -1 : 1;
  const sat = Math.max(seat, a.sit);
  const up = (1 - a.fall) * (1 - sat);
  const at = (k: BoardShapePose, w: number): void => {
    out[AT[k]] = w;
  };
  for (const k of BOARD_POSES) at(k, 0);
  const air =
    a.mode === "air" && a.airT > 0 ? Math.sqrt(Math.sin((Math.PI * a.airAt) / a.airT)) : 0;
  // His lean, his way round: a turn to his toes or his heels.
  const lean = a.lean * mirror;
  const toe = Math.max(0, lean);
  const heel = Math.max(0, -lean);
  const carve = (v: number): number => smooth((v - LEAN.turn) / (LEAN.carve - LEAN.turn));
  const turn = (v: number): number => Math.min(1, v / LEAN.turn);
  const stop = Math.min(1, a.across) * up;
  const ride = up * (1 - stop) * (1 - air);
  at("toe", turn(toe) * (1 - carve(toe)) * ride);
  at("carveToe", carve(toe) * ride);
  at("heel", turn(heel) * (1 - carve(heel)) * ride);
  at("carveHeel", carve(heel) * ride);
  at("stop", stop);
  at("crouch", Math.max(0, a.crouch - 0.2) * 1.25 * up * (1 - stop));
  at("air", air * up);
  // WORKING: the rear foot out and pushing, through its keys at his own
  // place in the stride; at rest in a queue or behind a T-bar, out on the
  // pad.
  const work = a.mode === "air" ? 0 : Math.min(1, a.push) * up;
  if (work > 0) {
    const x = (((a.pole % 1) + 1) % 1) * BOARD_SKATE_KEYS;
    const k = Math.floor(x) % BOARD_SKATE_KEYS;
    const f = x - Math.floor(x);
    at(`skate${k}` as BoardShapePose, (1 - f) * work);
    at(`skate${(k + 1) % BOARD_SKATE_KEYS}` as BoardShapePose, f * work);
  }
  at("tow", Math.max(tow, a.mode === "queue" ? 1 : 0) * up * (1 - work));
  // STOOD STILL, alive: the player's wait, swung on his own clock.
  const still =
    Math.max(0, 1 - a.speed / 1.5) * (1 - work) * (1 - stop) * (a.mode === "air" ? 0 : up);
  const wave = Math.sin((2 * Math.PI * t) / WAIT.period + a.id * 2.39);
  at("idle", still * Math.max(0, wave));
  at("idleAway", still * Math.max(0, -wave));
  const down = 1 - a.fall;
  at("chair", seat * down);
  at("sit", a.sit * (1 - seat) * down);
  return mirror;
}

/** HOW HIGH A RIDER SITS on a chair: the seat's top over the snow in the
 * chair target, m (`crowd-rig.ts`' `seatHeight`, for a board). */
export function boardSeatHeight(look: CrowdLook): number {
  const sat = poseBoard(look, { chair: 1 });
  return sat.pelvis[1] - 0.11 * (look.height / REFERENCE);
}

/** The share of riders a crowd was dealt, for the labs. */
export function boardShare(amateurs: readonly Pick<Amateur, "board">[]): number {
  return amateurs.length ? amateurs.filter((a) => a.board).length / amateurs.length : 0;
}
