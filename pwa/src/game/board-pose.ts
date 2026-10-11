// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDER'S POSE — the rider stood ACROSS his board, as the same
// joints `skierPose` places (`SkierPose`), so the rig, the dressed skin and
// the figure hang on him unchanged (`skier-figure.ts`, `skier-rig.ts`).
// Three-free: the suite and the labs read it (`tests/board_pose_test.ts`,
// `make board-metrics`).
//
// Everything is in the engine's BODY FRAME (x right, y up, z along the
// board to its nose, the origin at his centre of gravity), and the body
// frame is already rolled into the turn by the engine: the lean of a turn
// is the root's, and this pose is the rider within it. A REGULAR rider
// (left foot forward) faces the board's right — his toe edge — a GOOFY one
// its left. From the project's snowboard research (§2 the stance, §3 the
// technique, §8 what reads right), each a reading the engine wrote:
//
//   * THE FEET are in the BINDINGS, a stance apart along the deck, each
//     turned to its binding's angle (the duck stance's +15/−15), standing
//     on the deck as it lies on the snow (`boardFrame`: turned by the skid,
//     stood on the engine's EDGE against the snow, pitched by the two
//     feet's compression, bowed by the carve). Each SOFT BOOT holds its
//     shin over the highback's forward lean.
//   * THE ATHLETIC STANCE: ankles, knees and hips flexed (the knees some
//     45°), the hips centred between the feet and a little back over the
//     heels, the spine fairly upright, the HIPS AND SHOULDERS SQUARE TO THE
//     BOARD — the body sideways to his travel — the shoulders opened a
//     little to the nose, the front arm leading over the nose and the toe
//     edge, the rear one balancing by the rear hip.
//   * THE HEAD is turned to look ALONG HIS TRAVEL over his front shoulder
//     — over the other one riding fakie, and wherever a sideslip drifts —
//     his eyes held toward the horizon, never on the board (`headOf`).
//   * A CARVE IS CARRIED BY THE INCLINATION and ridden COMPACT on its
//     edge (`board-carve.ts`, the legs solved shin first). TOESIDE: both
//     ankles flexed over the toe edge, both knees bent ~80–100° down it
//     (the rear one driven toward the front binding), the hips low, the
//     arms forward; cut hard, folded down over the knees, the front hand at
//     the snow. HEELSIDE: the shins held by the highbacks, sat low as on a
//     chair (~85–100°), the front arm down the turn, the rear hand trailing
//     — at the snow cut hard. One hand at most is ever on the snow.
//   * THE TUCK side-on: the knees folded deep, the chest low over the
//     front knee, the hands in front of it, the head down along the nose.
//   * A LANDING folds the knees on the view's spring, the arms forward;
//     IN THE AIR the legs absorb: the knees pulled up past ~100° (the
//     board drawn up under the hips), the board levelled, the arms out.
//   * THE ONE-FOOT SKATE: the rear foot out of its binding pushing beside
//     the HEEL edge, behind his back, the board pointed along his travel
//     and the body SIDE-ON over it (the shoulders part way open, the head
//     over the front shoulder) — a rider, never a runner squared to his way.
//     HOPPING, both feet in, the knees fold and spring on the stride's phase.
//   * NO POLES: the hands are empty, after the skier's poleless carriage
//     (`skier-bare.ts`): soft elbows, the fists eased inside the arm's
//     reach.

import { BODY, LUMBAR, SHIN_ABOVE_CUFF, type SkierPose } from "./skier-pose.ts";
import type { Boot } from "./skier-limbs.ts";
import { solveLimb } from "./skier-limbs.ts";
import { add, dot, len, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";
import {
  BINDING,
  SOFT_BOOT,
  boardBaseHeight,
  boardBend,
  boardThickness,
  bowAt,
  type BoardShape,
} from "./board-look.ts";
import type { BoardGrab } from "@engine";
import { CONTACT, boardHalfWidth } from "./board-look.ts";
import {
  END_IN,
  FIST,
  GRAB_LOOKS,
  POP,
  PRESS,
  SPIN,
  spinTwist,
  type GrabLook,
} from "./board-grab.ts";
import { onEdge } from "./board-carve.ts";

/** What the pose is handed: the board's own numbers and one frame's
 * readings, each the engine's (eased by the view's spring where it says). */
export type BoardPoseInput = {
  /** The board: its outline, the stance (binding centre to centre, m), the
   * binding angles (rad, toward the nose positive) and who rides it. */
  board: BoardShape & { stance: number; front: number; back: number; lead: "regular" | "goofy" };
  /** The snow under the origin, m (−`cogHeight`), and how far a full tuck
   * drops the origin toward it, m. */
  ground: number;
  crouchDrop: number;
  /** THE EDGE the board stands on against the snow, rad, its right edge
   * down positive (`SkierState.edge`), and the body's inclination to the
   * snow as drawn, rad (`Stand.incline` — the root is already rolled by
   * it), and the skid's pivot, rad, clockwise. */
  edge: number;
  incline: number;
  angle: number;
  /** The world's up in the body frame — what his eyes hold level to. */
  worldUp: V3;
  /** Each foot's lift toward the body off the engine's legs, m: the front
   * foot, then the back (`gearLift`). */
  lift: readonly [number, number];
  /** The tuck the body is in, 0..1, and the lean fore and aft, −1..1. */
  crouch: number;
  lean: number;
  /** How far into the air, 0..1 (eased), the legs folded by a hit, m
   * (`SkierSpring.bump`), a jump being loaded, 0..1, the edge cut hard,
   * 0..1, the skid, 0..1. */
  air: number;
  bump: number;
  load: number;
  carve: number;
  skid: number;
  /** His travel in the body frame, m/s (his velocity), and his speed. */
  travel: V3;
  speed: number;
  /** Riding fakie (`SkierState.switched`). */
  switched: boolean;
  /** THE FEET AT A CRAWL (`SkierState.board`): the rear foot out, the hop
   * share, how hard he is working (`drive`, 0..1) and the stride's count
   * (`stride` — its fraction the phase). */
  free: boolean;
  /** How far the rear foot is drawn out of its binding, 0..1 — `free`
   * eased by the drawing (`easeFree`) so the foot, the hips and the arms
   * go over in a moment rather than a frame; `free` itself when left out. */
  freeShare?: number;
  hop: number;
  drive: number;
  stride: number;
  /** Stood still: his own clock, s, and how still, 0..1. */
  idle?: { t: number; still: number };
  /** THE TRICKS (`board-grab.ts`): the grab held in the air and how far
   * into it, 0..1 (eased by the drawing, `easeGrab`); the press on the
   * snow, −1 (the nose) … 1 (the tail); the load before a pop, + over the
   * tail (an ollie), − over the nose (a nollie); the wind-up before a spin,
   * −1 … 1 (the steer held while a jump is loaded, + a clockwise one); and
   * his turn about his up, rad/s (clockwise +) — the head and the
   * shoulders lead a spin. */
  grab?: BoardGrab | null;
  grabShare?: number;
  press?: number;
  pop?: number;
  windup?: number;
  spin?: number;
};

/** THE DECK as laid in the body frame: the middle of its base, its axes
 * (along to the nose, out of its top, to its right), and its bow, 1/m. */
export type BoardFrame = { centre: V3; along: V3; normal: V3; right: V3; bend: number };

/** The pose, the deck, which foot is out of its binding (0 the left, or
 * null), and how far the whole rider is lifted off the snow by a hop, m. */
export type BoardPose = {
  pose: SkierPose;
  board: BoardFrame;
  free: 0 | 1 | null;
  rise: number;
};

/** THE STANCE, rad and m: the knees' flexion standing (~45° — ski and board
 * studies run 30–80° riding), how far the hips sit behind the toes' line,
 * the trunk's forward lean, the shoulders opened to the nose, and the
 * hips opened half as far. */
export const STANCE = { knee: 0.9, hipsBack: 0.05, lean: 0.24, open: 0.18, hips: 0.5 };

/** TOESIDE and HEELSIDE at a full turn: the knees' extra flexion (the
 * toeside's legs are `board-carve.ts`'s), the hips' shift toward the toes
 * (positive) or back over the heels, the trunk's extra lean toward the toes
 * — and how much more cut hard (`cutLean`: toeside folded forward down
 * over the knees toward the snow, heelside laid back toward it) — and its
 * opening, rad, m. */
export const TOESIDE = { knee: 0.4, hips: 0.1, lean: -0.25, cutLean: 0.7, open: 0.05 };
export const HEELSIDE = { knee: 0.65, hips: -0.08, lean: 0.12, cutLean: -0.4, open: 0.3 };

/** IN THE AIR: the knees' extra flexion (rad — pulled up to ~100–115°, the
 * legs absorbing, never hung stiff under him; in a grab its own fold takes
 * over from `grab`), how far the board is drawn
 * up toward him for it (m), and the trunk's lean over the knees (rad). */
export const AIR = { knee: 1.0, grab: 0.7, lift: 0.28, lean: 0.25 };

/** THE TUCK at full crouch: the knees' extra flexion, the trunk's lean and opening, rad. */
export const TUCK = { knee: 0.75, lean: 0.6, open: 0.2 };

/** How far past it the knees may fold, rad, and the shin's least and most
 * forward lean in a soft boot — the highback's lean (~14°) to a soft
 * boot's full flex. */
export const KNEE_MOST = 2.1;

/** THE ONE-FOOT SKATE: the free foot behind him by the heel edge, toes ahead,
 * PRESSED OUT SIDEWAYS — along the deck (m back of its middle) and out past
 * the heel edge (m) at the plant and the press's end, its lift back, the
 * stride's share pressed, the torso's turn to the nose (rad), the hips'
 * shift to the toes (m). */
export const SKATE = {
  from: -0.12,
  to: -0.26,
  out: 0.06,
  outTo: 0.3,
  lift: 0.07,
  push: 0.55,
  open: 0.35,
  toes: 0.05,
};

/** WHERE THE KNEES POINT: over the toes (`toes`), to the way he faces
 * (`face`), and along the deck toward the nose — the front knee a little
 * (`front`), the rear one driven in toward it (`rear`). */
export const KNEES = { toes: 0.6, face: 0.2, front: 0.2, rear: 0.5 };

/** NEVER KNEELING: the most a shin ever needs to the snow (~17°), the least
 * (~6°, an edge laid past what the ankle's flex leaves — `ANKLE`), each
 * try's straightening of the knees, the tries, and the least flexion they
 * are straightened to (~29°: never stiff-legged at speed), rad. */
export const SHIN = { least: 0.3, floor: 0.1, straighten: 0.04, tries: 40, flexLeast: 0.5 };

/** THE ANKLE IN A SOFT BOOT on the toe edge: the most a shin stands forward
 * of the deck's normal, rad (~28°), the most the hips go back to keep it
 * there and the least they keep over the deck's middle toward the toes, m;
 * the most any shin leans off the deck's normal (rad, ~47°: the highback's
 * lean and the soft boot's whole give), and how far back the hips may sit
 * for it, m. */
export const ANKLE = { most: 0.49, back: 0.25, over: 0.005, deck: 0.82, seat: 0.3 };

/** THE HOP's height at its top, m. */
export const HOP = 0.11;

/** The low carve: the inclination over which a hand goes toward the snow
 * on a turn cut hard, rad; how close the brushing hand is held over it and
 * the least height any other hand keeps, m; how far the toeside front
 * hand reaches down toward it, m. */
export const LOW = { from: 0.5, to: 0.8, gap: 0.03, clear: 0.18, reach: 0.34 };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const UP: V3 = { x: 0, y: 1, z: 0 };

/** `v` turned `a` rad about the unit axis `k`. */
function turn(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

/** Rotations about the body's own axes (three's right-handed sense). */
const rz = (v: V3, a: number): V3 => ({
  x: v.x * Math.cos(a) - v.y * Math.sin(a),
  y: v.x * Math.sin(a) + v.y * Math.cos(a),
  z: v.z,
});
const ry = (v: V3, a: number): V3 => ({
  x: v.x * Math.cos(a) + v.z * Math.sin(a),
  y: v.y,
  z: -v.x * Math.sin(a) + v.z * Math.cos(a),
});
const rx = (v: V3, a: number): V3 => ({
  x: v.x,
  y: v.y * Math.cos(a) - v.z * Math.sin(a),
  z: v.y * Math.sin(a) + v.z * Math.cos(a),
});

/** THE SNOW under the deck, in the body frame: a point on it (under the
 * deck's low edge — the deck's middle is lifted off it by its edge) and its
 * normal, the snow he inclines to. */
export function snowPlane(input: BoardPoseInput, f: BoardFrame): { point: V3; normal: V3 } {
  const normal = rz(UP, input.incline);
  const edge = input.edge * (1 - 0.75 * clamp(input.air, 0, 1));
  const lift = (input.board.waist / 2) * Math.abs(Math.sin(edge));
  return { point: add(f.centre, scale(normal, -lift)), normal };
}

/** The side the front foot is on: 0 the left (a regular rider's). */
export function frontIndex(lead: "regular" | "goofy"): 0 | 1 {
  return lead === "regular" ? 0 : 1;
}

/** THE TOESIDE SHARE of a turn, −1 (a full heelside) … 1 (a full toeside):
 * the edge he stands on, by which way he faces, faded out flat. */
export function toeShare(edge: number, lead: "regular" | "goofy"): number {
  const side = Math.sign(edge) * (lead === "regular" ? 1 : -1);
  return side * smooth(0.08, 0.6, Math.abs(edge));
}

/**
 * THE DECK ON THE SNOW, in the body frame: in the SNOW's frame (the body's
 * rolled back by its inclination) it is turned by the skid's pivot about
 * the snow's normal, stood on its edge, and pitched by the feet's lifts;
 * its middle where the engine's legs put the feet, lifted on its edge so
 * its low edge — not its middle — is on the snow.
 */
export function boardFrame(input: BoardPoseInput): BoardFrame {
  const b = input.board;
  const ground = input.air;
  // In the air the deck comes level under him.
  const edge = input.edge * (1 - 0.75 * ground);
  const r = input.incline;
  const [lf, lb] = input.lift;
  const lifted = (lf + lb) / 2 + input.air * AIR.lift;
  // A PRESS or the load before a pop bends the deck onto one end (nose up
  // positive), its low end kept on the snow.
  const tilt = (PRESS.most * (input.press ?? 0) + POP.most * (input.pop ?? 0)) * (1 - ground);
  const pitch = Math.atan2(lf - lb, b.stance) * (1 - ground) + tilt;
  const place = (v: V3): V3 => rz(ry(rz(rx(v, -pitch), -edge), input.angle), r);
  const along = place({ x: 0, y: 0, z: 1 });
  const normal = place({ x: 0, y: 1, z: 0 });
  const right = place({ x: 1, y: 0, z: 0 });
  const snow = rz(UP, r);
  const centre = add(
    {
      x: 0,
      y:
        input.ground +
        lifted +
        input.crouchDrop * input.crouch +
        Math.sin(Math.abs(tilt)) * CONTACT * b.length,
      z: 0,
    },
    scale(snow, (b.waist / 2) * Math.abs(Math.sin(edge))),
  );
  // Bowed by the carve when it is loaded on its edge on the snow.
  const bend = boardBend(edge, b.sidecut, (1 - ground) * smooth(4, 10, input.speed));
  return { centre, along, normal, right, bend };
}

/** A point on the deck's TOP at `s` m along it from its middle, `h` m
 * over the top. */
export function onDeck(f: BoardFrame, b: BoardShape & { stance: number }, s: number, h = 0): V3 {
  const y = boardBaseHeight(b, s, b.stance) + boardThickness(b, s) + bowAt(f.bend, s, b.length) + h;
  return add(add(f.centre, scale(f.along, s)), scale(f.normal, y));
}

/** Each foot's binding: where its boot's sole stands (on the baseplate),
 * and the boot's frame (its toes along the binding's angle, its sole on
 * the deck). */
export function bindingsOf(
  f: BoardFrame,
  input: Pick<BoardPoseInput, "board">,
): { sole: [V3, V3]; boot: [Boot, Boot] } {
  const b = input.board;
  const fi = frontIndex(b.lead);
  const face = b.lead === "regular" ? 1 : -1;
  const sole: V3[] = [];
  const boot: Boot[] = [];
  for (let i = 0; i < 2; i++) {
    const front = i === fi;
    const s = ((front ? 1 : -1) * b.stance) / 2;
    const a = front ? b.front : b.back;
    sole.push(onDeck(f, b, s, BINDING.plate));
    const toes = norm(add(scale(f.right, face * Math.cos(a)), scale(f.along, Math.sin(a))));
    boot.push({ f: toes, n: f.normal });
  }
  return { sole: [sole[0], sole[1]], boot: [boot[0], boot[1]] };
}

/** The cuff's top over a boot whose sole stands at `sole`: where the
 * figure's leg ends (the dress's liner, `cutFeet`). */
export function cuffOver(sole: V3, boot: Boot): V3 {
  return add(add(sole, scale(boot.n, SOFT_BOOT.cuff)), scale(boot.f, -SOFT_BOOT.heel));
}

/** An arm from `shoulder` toward `target`: the hand eased inside the arm's
 * reach, the elbow bent toward `pole`. */
function arm(shoulder: V3, target: V3, pole: V3): { elbow: V3; hand: V3 } {
  const reach = (BODY.upperArm + BODY.forearm) * 0.96;
  const d = sub(target, shoulder);
  const l = len(d);
  const hand = l > reach ? add(shoulder, scale(d, reach / l)) : target;
  return { elbow: solveLimb(shoulder, hand, BODY.upperArm, BODY.forearm, pole), hand };
}

/** HOW HIS HEAD IS TURNED: looking along `look` (body frame), its up held
 * toward `up` — read as the rig's head angles (`skier-rig.ts`'s
 * `headAxes`: yaw `look / 2`, pitch `−0.2 + pitch × 0.3`, roll
 * `−headRoll`, three's "YXZ"). */
export function headAngles(look: V3, up: V3): { look: number; pitch: number; headRoll: number } {
  const fwd = norm(look);
  const right = norm(cross(up, fwd));
  const a = -Math.asin(clamp(fwd.y, -1, 1));
  const b = Math.atan2(fwd.x, fwd.z);
  const x0 = { x: Math.cos(b), y: 0, z: -Math.sin(b) };
  const y0 = { x: Math.sin(a) * Math.sin(b), y: Math.cos(a), z: Math.sin(a) * Math.cos(b) };
  const c = Math.atan2(dot(right, y0), dot(right, x0));
  return { look: 2 * b, pitch: (a + 0.2) / 0.3, headRoll: -c };
}

/** The head's forward as the rig turns it for `look`, `pitch` (the rig's
 * own readings, `headAngles`' inverse). */
export function headForward(p: Pick<SkierPose, "look" | "pitch">): V3 {
  const a = -0.2 + p.pitch * 0.3;
  const b = p.look * 0.5;
  return { x: Math.cos(a) * Math.sin(b), y: -Math.sin(a), z: Math.cos(a) * Math.cos(b) };
}

/** Angle from `a` to `b` about the body's up, rad, wrapped to ±π. */
function yawBetween(a: V3, b: V3): number {
  const d = Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z);
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/** Level `v` into the body's horizontal plane. */
const level = (v: V3): V3 => norm({ x: v.x, y: 0, z: v.z });

/** THE SNOWBOARDER POSED for one frame. */
export function boardPose(input: BoardPoseInput): BoardPose {
  const b = input.board;
  const fi = frontIndex(b.lead);
  const ri = (1 - fi) as 0 | 1;
  const face = b.lead === "regular" ? 1 : -1;
  const air = clamp(input.air, 0, 1);
  const onSnow = 1 - air;
  const deck = boardFrame(input);
  const { sole, boot } = bindingsOf(deck, input);
  // THE GRAB, drawn in the air only (`board-grab.ts`).
  const look = input.grab ? GRAB_LOOKS[input.grab] : null;
  const g = look ? clamp(input.grabShare ?? 1, 0, 1) * smooth(0.3, 0.9, air) : 0;

  // THE RIDER'S AXES, level in the body: the nose's way, the way he faces
  // (his toes), and his own right.
  const nose = level(deck.along);
  const F = scale(cross(UP, nose), face);
  // How far into a toeside (+) or heelside (−) turn, on the snow.
  const toe = toeShare(input.edge, b.lead) * onSnow;
  const toeK = Math.max(0, toe);
  const heelK = Math.max(0, -toe);
  const cut = 1 + 0.4 * clamp(input.carve, 0, 1);
  const crouch = clamp(input.crouch, 0, 1);
  const still = input.idle?.still ?? 0;
  const clock = input.idle?.t ?? 0;
  // The rear foot out, and how far drawn out (eased).
  const freeK = onSnow > 0.5 ? clamp(input.freeShare ?? (input.free ? 1 : 0), 0, 1) : 0;
  const free = freeK > 0;
  const phase = input.stride - Math.floor(input.stride);
  const pushing = free ? smooth(0.15, 0.5, input.drive) : 0;
  // THE HOP: the knees folded before it and the whole of him up over it.
  const hop = clamp(input.hop, 0, 1) * onSnow;
  const hopUp = Math.max(0, Math.sin(2 * Math.PI * phase));
  const hopLoad = Math.max(0, -Math.sin(2 * Math.PI * phase));
  const rise = hop * HOP * hopUp;

  // THE FREE FOOT: pushing behind him beside the heel edge, or on the
  // stomp pad.
  let freeSole: V3 | null = null;
  let freeBoot: Boot | null = null;
  if (free) {
    // The stomp pad lies between the bindings, toward the rear one (the
    // tail's way, the deck's −s, whichever foot leads).
    const padAt = onDeck(deck, b, -b.stance * 0.22, 0.004);
    const p = phase < SKATE.push ? phase / SKATE.push : 1 - (phase - SKATE.push) / (1 - SKATE.push);
    const along = SKATE.from + (SKATE.to - SKATE.from) * (0.5 - 0.5 * Math.cos(Math.PI * p));
    const up = phase < SKATE.push ? 0 : SKATE.lift * Math.sin(Math.PI * (1 - p));
    const snow = rz(UP, input.incline);
    const wide = SKATE.out + (SKATE.outTo - SKATE.out) * (0.5 - 0.5 * Math.cos(Math.PI * p));
    const base = add(
      add(add(deck.centre, scale(nose, along)), scale(F, -(b.waist / 2 + wide))),
      scale(snow, up + SOFT_BOOT.sole * 0.2),
    );
    const pushF = nose;
    const padF = norm(add(scale(F, 0.8), scale(deck.along, 0.55)));
    freeSole = mix(sole[ri], mix(padAt, base, pushing), freeK);
    const fr = norm(mix(padF, pushF, pushing));
    const n = norm(mix(deck.normal, snow, pushing));
    const out = { f: norm(sub(fr, scale(n, dot(fr, n)))), n };
    freeBoot = { f: norm(mix(boot[ri].f, out.f, freeK)), n: norm(mix(boot[ri].n, out.n, freeK)) };
  }
  const soles: [V3, V3] = [sole[0], sole[1]];
  const boots: [Boot, Boot] = [boot[0], boot[1]];
  if (freeSole && freeBoot) {
    soles[ri] = freeSole;
    boots[ri] = freeBoot;
  }
  const feet = [cuffOver(soles[0], boots[0]), cuffOver(soles[1], boots[1])] as [V3, V3];

  // THE HIPS: centred between the bindings, back over the heels, shifted
  // toward the toes on a toeside turn and sat back on a heelside; along the
  // deck by the lean (and over the front foot while the rear one works).
  const mid = mix(sole[0], sole[1], 0.5);
  // (the lean +1 is BACK, `SkierInput.lean`: the hips go toward the tail;
  // further in a press or over the loaded end before a pop).
  const fore =
    -0.06 * clamp(input.lean, -1, 1) -
    PRESS.hips * (input.press ?? 0) * onSnow -
    POP.hips * (input.pop ?? 0) * onSnow +
    0.1 * freeK +
    still * 0.025 * Math.sin(clock * 0.55);
  // THE LOW CARVE: laid over past ~35°, he reaches the snow on the turn's
  // inside — bent down to it over his toes, or sat back toward it behind
  // his heels.
  const low =
    smooth(LOW.from, LOW.to, Math.abs(input.incline)) * onSnow * smooth(0.2, 0.6, Math.abs(toe));
  const across =
    -STANCE.hipsBack +
    TOESIDE.hips * toeK * cut +
    HEELSIDE.hips * heelK * cut -
    0.04 * crouch * (1 - toeK);
  // THE KNEES' FLEXION he stands at — the hips are set at the height that
  // gives it.
  // A hit folds him; the g of a carve held on its edge only a little —
  // the turn is carried by the inclination, not by sinking onto the knees.
  const fold = Math.min(1, Math.max(0, input.bump) / 0.2) * (1 - 0.6 * Math.abs(toe));
  const flex = clamp(
    STANCE.knee +
      TOESIDE.knee * toeK * cut +
      HEELSIDE.knee * heelK * cut +
      TUCK.knee * crouch +
      0.4 * fold +
      0.55 * clamp(input.load, 0, 1) +
      (look ? AIR.knee + (AIR.grab - AIR.knee) * smooth(0, 0.3, g) : AIR.knee) * air +
      (look?.knee ?? 0) * g +
      0.5 * hop * hopLoad -
      0.15 * still,
    0.3,
    KNEE_MOST,
  );
  // The pelvis square to the board, opened a little to the nose.
  const openUpper =
    STANCE.open +
    TOESIDE.open * toeK +
    HEELSIDE.open * heelK +
    TUCK.open * crouch +
    SKATE.open * freeK * (0.6 + 0.4 * pushing);
  // ...turned back the way a fakie rider looks.
  const fakie = input.switched ? -1 : 1;
  const openSign = fakie;
  // THE SPIN: wound up against it while the jump is loaded, then led by the
  // shoulders (and the head, below) — a turn about his up, clockwise +.
  const twist = spinTwist(input);
  // A grab turns the shoulders to the nose or the tail (`GrabLook.open`).
  const openAll = openUpper + ((look?.open ?? 0) * g - twist * face) * openSign;
  const hipFace = turn(F, UP, -face * openSign * openAll * STANCE.hips);
  const pelvis = cross(UP, hipFace); // left to right
  // ACROSS AS THE DECK LIES: where the engine's inclination and the deck's
  // edge differ, the column he is rolled onto stands off the deck's normal,
  // and hips set across the column would hang off the edge (a heelside
  // rider sat down behind it). Each metre up the column carries them
  // `UP·right` across the deck; taken back out, they stand over the edge.
  const tilt = dot(UP, deck.right) * face;
  let hips: V3 = V0();
  const hipJoints = [V0(), V0()] as [V3, V3];
  // Height: each leg's hip joint over its cuff at the flexion asked for.
  const setHips = (flexNow: number, acrossNow: number): void => {
    const span = Math.sqrt(
      BODY.thigh * BODY.thigh +
        SHIN_ABOVE_CUFF * SHIN_ABOVE_CUFF +
        2 * BODY.thigh * SHIN_ABOVE_CUFF * Math.cos(flexNow),
    );
    const hipsXZ = add(add(mid, scale(F, acrossNow - (span + 0.12) * tilt)), scale(nose, fore));
    // (While the rear foot is out the front leg carries him: its height
    // counts the most, so the free foot's reach back never folds it.)
    let hipY = 0;
    for (let i = 0; i < 2; i++) {
      const j = add(hipsXZ, scale(pelvis, (i === 0 ? -1 : 1) * BODY.hip));
      const dx = j.x - feet[i].x;
      const dz = j.z - feet[i].z;
      const w = 0.5 + (i === fi ? 0.3 : -0.3) * freeK;
      hipY += w * (feet[i].y + Math.sqrt(Math.max(0.01, span * span - dx * dx - dz * dz)));
    }
    // Stood still he breathes on his legs.
    hipY += still * 0.008 * Math.sin(clock * 1.7);
    hips = { x: hipsXZ.x, y: hipY, z: hipsXZ.z };
    hipJoints[0] = add(hips, scale(pelvis, -BODY.hip));
    hipJoints[1] = add(hips, scale(pelvis, BODY.hip));
  };
  setHips(flex, across);
  // THE KNEES, solved over the toes (each shin forward of its boot).
  // THE GRAB'S BOARD: drawn up by the knees under the hips (and kicked
  // behind him in a method), tweaked, the feet in its bindings — the hips
  // where the air left them.
  let ridden = deck;
  const standOn = (f: BoardFrame): void => {
    ridden = f;
    const at = bindingsOf(f, input);
    for (let i = 0; i < 2; i++) {
      soles[i] = at.sole[i];
      boots[i] = at.boot[i];
      feet[i] = cuffOver(soles[i], boots[i]);
    }
  };
  if (look && g > 0) standOn(tweakDeck(deck, look, g, face, F));
  const knees = [V0(), V0()] as [V3, V3];
  const solveKnees = (): void => {
    // Each knee over its toes, and both drawn toward the nose — the front
    // one over the front foot, the rear one driven in toward it — never
    // splayed apart, and never laid toward the snow on the toe edge.
    for (let i = 0; i < 2; i++) {
      // The free foot's knee bends over its own toes, straight down its
      // line of push, never in across the front leg.
      const out = i === ri ? freeK : 0;
      const inward = i === fi ? KNEES.front : KNEES.rear * (1 - out);
      const toward = norm(
        add(
          add(add(scale(boots[i].f, KNEES.toes), scale(boots[i].n, 0.15)), scale(F, KNEES.face)),
          scale(ridden.along, inward),
        ),
      );
      // A method's knees driven forward under him, the board kicked behind.
      const fore = look?.knees ? look.knees * g : 0;
      const pole = fore > 0 ? norm(mix(toward, norm(add(F, scale(UP, -0.35))), fore)) : toward;
      knees[i] = solveLimb(hipJoints[i], feet[i], BODY.thigh, SHIN_ABOVE_CUFF, pole);
    }
  };
  solveKnees();
  // NEVER KNEELING, THE BEND KEPT IN THE ANKLES: no shin on the snow lies
  // flatter than a soft boot's ankle leaves at this edge (`90° − edge −
  // ANKLE.most`, held between `SHIN.floor` and `SHIN.least`). Where it
  // would, the hips go BACK first — the knees kept bent — as far as they
  // stay over the toe edge; only then are the legs straightened.
  if (onSnow > 0.5) {
    const n = rz(UP, input.incline);
    const lowest = (): number =>
      Math.min(...[0, 1].map((i) => Math.asin(clamp(dot(norm(sub(knees[i], feet[i])), n), -1, 1))));
    const least = clamp(Math.PI / 2 - Math.abs(input.edge) - ANKLE.most, SHIN.floor, SHIN.least);
    const try_ = (flexNow: number, acrossNow: number): number => {
      setHips(flexNow, acrossNow);
      solveKnees();
      return lowest();
    };
    let flexNow = flex;
    let acrossNow = across;
    if (lowest() < least && toeK > 0) {
      const over = (): number => dot(sub(hips, deck.centre), deck.right) * face;
      const per = Math.max(0.3, dot(F, deck.right) * face);
      // How far back the hips may go: while they stay over the toe edge.
      const floor = Math.max(across - ANKLE.back, across - (over() - ANKLE.over) / per);
      if (floor < across) {
        // The least way back that stands the shins up, else all the way.
        let lo = floor;
        let hi = across;
        if (try_(flexNow, floor) >= least)
          for (let k = 0; k < 12; k++) {
            const m = (lo + hi) / 2;
            if (try_(flexNow, m) >= least) lo = m;
            else hi = m;
          }
        acrossNow = lo;
        try_(flexNow, acrossNow);
      }
    }
    for (let k = 0; k < SHIN.tries && lowest() < least; k++) {
      flexNow = Math.max(SHIN.flexLeast, flexNow - SHIN.straighten);
      try_(flexNow, acrossNow);
    }
    // THE SOFT BOOT'S REACH: no shin leans further over the deck than the
    // boot flexes (`ANKLE.deck`) — deep knees on a flat base (the tuck, a
    // jump loaded) sit the hips back over the heels for it.
    const deckLow = (): number =>
      Math.min(...[0, 1].map((i) => dot(norm(sub(knees[i], feet[i])), deck.normal)));
    const most = Math.cos(ANKLE.deck);
    if (!free && deckLow() < most) {
      let lo = acrossNow - ANKLE.seat;
      let hi = acrossNow;
      for (let k = 0; k < 12; k++) {
        const m = (lo + hi) / 2;
        setHips(flexNow, m);
        solveKnees();
        if (deckLow() >= most) lo = m;
        else hi = m;
      }
      setHips(flexNow, lo);
      solveKnees();
    }
  }

  // THE LEGS ON AN EDGE, solved shin first (`board-carve.ts`): on the toe
  // edge the ankles flexed over it, both knees bent down it, the hips low.
  // On the heel edge, the shins held by the highbacks and sat down.
  const edgeLeg = Math.max(toeK, heelK) * (onSnow > 0.5 ? 1 : 0) * (1 - freeK);
  if (edgeLeg > 0) {
    const legs = { hips, hipJoints, knees };
    onEdge(legs, edgeLeg, {
      toe: toeK > 0,
      cuffs: feet,
      deck,
      face,
      front: fi,
      edge: input.edge,
      pelvis,
      bend: clamp(input.carve, 0, 1),
      more: 0.3 * fold + TUCK.knee * crouch,
      speed: input.speed,
    });
    hips = legs.hips;
  }

  // THE TRUNK: leaning toward his toes (and down over the front knee in a
  // tuck), the shoulders opened to the nose.
  const chestFace = turn(F, UP, -face * openSign * openAll);
  const lean = clamp(
    STANCE.lean +
      (TOESIDE.lean + TOESIDE.cutLean * clamp(input.carve, 0, 1)) * toeK +
      (HEELSIDE.lean + HEELSIDE.cutLean * clamp(input.carve, 0, 1)) * heelK +
      TUCK.lean * crouch +
      0.35 * fold +
      0.3 * clamp(input.load, 0, 1) +
      AIR.lean * air +
      (look?.lean ?? 0) * g +
      0.04 * freeK,
    -0.2,
    1.25,
  );
  // In a tuck the chest goes down over the FRONT knee: the lean's way
  // turned toward the nose.
  let leanWay = norm(add(chestFace, scale(nose, 0.35 * crouch * fakie)));
  // ...and in a grab toward where the hand goes.
  if (look) leanWay = norm(mix(leanWay, norm(add(scale(F, look.to), scale(nose, look.fore))), g));
  const spineDir = norm(add(scale(UP, Math.cos(lean)), scale(leanWay, Math.sin(lean))));
  const round = 0.12 + 0.35 * crouch + 0.2 * fold;
  const bendAxis = norm(cross(spineDir, leanWay));
  const lumbar = BODY.spine * LUMBAR;
  const thoracic = BODY.spine - lumbar;
  const lowerDir = turn(spineDir, bendAxis, (-round * thoracic) / BODY.spine);
  const upperDir = turn(spineDir, bendAxis, (round * lumbar) / BODY.spine);
  const breathe = still * 0.006 * Math.sin(clock * 1.7 + 0.6);
  const waist = add(hips, scale(lowerDir, lumbar));
  const neck = add(waist, scale(upperDir, thoracic + breathe));
  const chestAcross = norm(cross(upperDir, chestFace));
  const shoulderAt = (side: number): V3 =>
    add(
      add(add(neck, scale(upperDir, -BODY.shoulderDrop)), scale(chestFace, BODY.shoulderFore)),
      scale(chestAcross, side * BODY.shoulder),
    );
  // `chestAcross` points to his right (as `pelvis` does): index 0 his left.
  const shoulders = [shoulderAt(-1), shoulderAt(1)] as [V3, V3];
  const head = add(neck, scale(norm(mix(upperDir, UP, 0.55)), BODY.neck));

  // THE HEAD: along his travel, over the front shoulder (the rear one
  // fakie), clamped to what a neck turns.
  const travelFlat = { x: input.travel.x, y: 0, z: input.travel.z };
  const moving = smooth(0.6, 2.5, Math.hypot(travelFlat.x, travelFlat.z));
  const lead = scale(nose, fakie);
  let want = moving > 0 ? norm(mix(lead, norm(add(travelFlat, scale(lead, 1e-3))), moving)) : lead;
  // In a turn the eyes go to its exit: toward the turn's inside.
  const inside = scale(F, toe >= 0 ? 1 : -1);
  want = norm(add(want, scale(inside, 0.3 * Math.abs(toe))));
  // Stood still he glances about.
  want = turn(want, UP, still * 0.35 * Math.sin(clock * 0.37));
  // A spin is led by the head.
  want = turn(want, UP, clamp(SPIN.head * (input.spin ?? 0), -SPIN.most, SPIN.most) * air);
  const off = yawBetween(chestFace, want);
  const NECK = 1.35;
  const yaw = clamp(off, -NECK, NECK);
  const flatLook = turn(chestFace, UP, yaw);
  const down = 0.18 + 0.12 * crouch + 0.15 * air + 0.1 * fold;
  const worldUp = norm(input.worldUp);
  const lookDir = norm(add(scale(flatLook, Math.cos(down)), scale(worldUp, -Math.sin(down))));
  const headUp = norm(mix(upperDir, worldUp, 0.7));
  const angles = headAngles(lookDir, headUp);

  // THE ARMS, empty: the front one leading over the nose and the toe edge,
  // the rear one by the rear hip.
  const sF = shoulders[fi];
  const sR = shoulders[ri];
  const lead2 = scale(nose, fakie);
  const downV = scale(UP, -1);
  let handF = add(add(add(sF, scale(lead2, 0.3)), scale(F, 0.18)), scale(downV, 0.4));
  let handR = add(add(add(sR, scale(lead2, -0.1)), scale(F, 0.16)), scale(downV, 0.48));
  // Toeside: both arms forward at waist height, over the toe edge.
  handF = add(handF, scale(add(scale(F, 0.16), scale(downV, -0.1)), toeK));
  handR = add(handR, scale(add(add(scale(F, 0.2), scale(lead2, 0.12)), scale(downV, -0.12)), toeK));
  // Heelside: the front arm points down the turn, the rear hand trails low
  // behind.
  handR = add(
    handR,
    scale(add(add(scale(lead2, -0.24), scale(F, -0.18)), scale(downV, 0.06)), heelK),
  );
  handF = add(
    handF,
    scale(add(add(scale(lead2, 0.2), scale(F, -0.12)), scale(downV, -0.12)), heelK),
  );
  // The tuck: both hands in front of the front knee.
  const kf = knees[fi];
  const tuckF = add(add(kf, scale(F, 0.08)), scale(UP, 0.02));
  const tuckR = add(add(mix(knees[0], knees[1], 0.6), scale(F, 0.1)), scale(UP, 0.06));
  handF = mix(handF, tuckF, crouch * 0.9);
  handR = mix(handR, tuckR, crouch * 0.9);
  // The air: the arms out wide for balance.
  const outF = add(add(add(sF, scale(lead2, 0.45)), scale(F, 0.12)), scale(downV, 0.12));
  const outR = add(add(add(sR, scale(lead2, -0.42)), scale(F, 0.08)), scale(downV, 0.18));
  handF = mix(handF, outF, air * (1 - crouch));
  handR = mix(handR, outR, air * (1 - crouch));
  // A landing: the arms forward.
  handF = add(handF, scale(add(scale(F, 0.12), scale(UP, 0.08)), fold));
  handR = add(handR, scale(add(scale(F, 0.18), scale(UP, 0.1)), fold));
  // Loading a jump: drawn down and back.
  const ld = clamp(input.load, 0, 1) * (1 - crouch);
  handF = add(handF, scale(add(scale(F, -0.1), scale(downV, 0.08)), ld));
  handR = add(handR, scale(add(scale(F, -0.12), scale(downV, 0.05)), ld));
  // Skating: the arms out for balance, swung against the push.
  if (free) {
    const swing = Math.sin(2 * Math.PI * phase) * 0.1 * pushing;
    handF = mix(
      handF,
      add(add(add(sF, scale(lead2, 0.28 + swing)), scale(F, 0.12)), scale(downV, 0.42)),
      0.7 * freeK,
    );
    handR = mix(
      handR,
      add(add(add(sR, scale(lead2, 0.05 - swing)), scale(F, 0.24)), scale(downV, 0.45)),
      0.7 * freeK,
    );
  }
  // Stood still the hands hang by his thighs.
  const hangF = add(add(sF, scale(F, 0.08)), scale(downV, 0.58));
  const hangR = add(add(sR, scale(F, 0.06)), scale(downV, 0.58));
  handF = mix(handF, hangF, still * 0.7 * (1 - crouch));
  handR = mix(handR, hangR, still * 0.7 * (1 - crouch));
  // THE LOW CARVE CUT HARD: toeside the front hand reaches toward the
  // snow; heelside the rear one brushes it — laid on it as near where it
  // was trailing as the arm will go. No other hand comes near the snow.
  const brush = low * smooth(0.2, 0.8, clamp(input.carve, 0, 1));
  const plane = snowPlane(input, deck);
  const over = (p: V3): number => dot(sub(p, plane.point), plane.normal);
  const reach = (BODY.upperArm + BODY.forearm) * 0.95;
  const toSnow = (p: V3, s: V3): V3 => {
    let q = add(p, scale(plane.normal, LOW.gap - over(p)));
    const foot = add(s, scale(plane.normal, LOW.gap - over(s)));
    const h = Math.max(0, over(s) - LOW.gap);
    const out = sub(q, foot);
    const most = Math.sqrt(Math.max(0, reach * reach - h * h));
    if (len(out) > most) q = add(foot, scale(norm(out), most));
    return mix(p, q, brush);
  };
  const above = (p: V3, least: number): V3 => {
    const d = over(p) - least;
    return d < 0 ? add(p, scale(plane.normal, -d)) : p;
  };
  // Every hand is held clear of the snow first...
  handF = above(handF, LOW.clear * onSnow + LOW.gap);
  handR = above(handR, LOW.clear * onSnow + LOW.gap);
  if (brush > 0) {
    if (toe > 0) handF = toSnow(add(handF, scale(lead2, LOW.reach * brush)), sF);
    else handR = toSnow(add(handR, scale(lead2, -0.08 * brush)), sR);
  }
  // ...and none is ever drawn into it.
  handF = above(handF, LOW.gap);
  handR = above(handR, LOW.gap);
  // THE GRAB: the hand down to its place on the board, the free arm thrown
  // out and up.
  const grabFront = look?.hand === "front";
  if (look && g > 0) {
    const spot = grabSpot(look, ridden, b, face);
    const freeS = grabFront ? sR : sF;
    const out = norm(sub(freeS, neck));
    const thrown = add(
      add(add(freeS, scale(UP, 0.32)), scale(out, 0.3)),
      scale(nose, (grabFront ? -0.25 : 0.25) * fakie),
    );
    if (grabFront) {
      handF = mix(handF, spot, g);
      handR = mix(handR, thrown, g * 0.85);
    } else {
      handR = mix(handR, spot, g);
      handF = mix(handF, thrown, g * 0.85);
    }
  }
  const elbowPole = (i: number): V3 => {
    const out = norm(sub(shoulders[i], neck));
    return norm(add(add(scale(UP, -0.55), scale(out, 0.8)), scale(chestFace, -0.25)));
  };
  // A grab's elbow out to the side, or round behind him (a stalefish).
  const grabPole = (i: number): V3 =>
    look && g > 0 && (i === fi) === grabFront
      ? norm(mix(elbowPole(i), norm(add(scale(F, -look.elbow), scale(UP, 0.2))), g * 0.6))
      : elbowPole(i);
  const hands: [V3, V3] = [handF, handR];
  let armF = arm(sF, hands[0], grabPole(fi));
  let armR = arm(sR, hands[1], grabPole(ri));
  // OUT OF REACH, the knees draw the board the rest of the way up to the
  // hand — a little, never past `REACH_MOST` m.
  if (look && g > 0) {
    const reached = grabFront ? armF.hand : armR.hand;
    const want = grabFront ? hands[0] : hands[1];
    const short = sub(want, reached);
    const l = len(short);
    if (l > 0.003) {
      const shift = scale(short, -Math.min(l, REACH_MOST) / l);
      standOn({ ...ridden, centre: add(ridden.centre, shift) });
      solveKnees();
      const spot = mix(want, grabSpot(look, ridden, b, face), g);
      if (grabFront) armF = arm(sF, spot, grabPole(fi));
      else armR = arm(sR, spot, grabPole(ri));
    }
  }
  const elbows = [V0(), V0()] as [V3, V3];
  const fists = [V0(), V0()] as [V3, V3];
  elbows[fi] = armF.elbow;
  fists[fi] = armF.hand;
  elbows[ri] = armR.elbow;
  fists[ri] = armR.hand;

  return {
    pose: {
      hips,
      hipJoints,
      waist,
      neck,
      head,
      pitch: angles.pitch,
      roll: 0,
      headRoll: angles.headRoll,
      knees,
      feet,
      boots,
      shoulders,
      elbows,
      hands: fists,
      poles: null,
      look: angles.look,
    },
    board: ridden,
    free: freeK > 0.5 ? ri : null,
    rise,
  };
}

/** The most the board is drawn up to a hand that cannot reach it, m. */
export const REACH_MOST = 0.3;

/** THE DECK A GRAB HOLDS: drawn up toward the hips and across (`lift`,
 * `across`), tweaked (`roll` the heel edge up, `pitch` the nose up, `yaw`
 * the nose toward the toes), all by the grab's share `g`. `face` +1 for a
 * regular rider, `F` the way he faces. */
export function tweakDeck(
  deck: BoardFrame,
  look: GrabLook,
  g: number,
  face: number,
  F: V3,
): BoardFrame {
  const heel = scale(deck.right, -face);
  const rollAxis = norm(cross(heel, deck.normal));
  const pitchAxis = norm(cross(deck.along, deck.normal));
  // About the deck's normal a positive turn is clockwise from above: the
  // nose toward a regular rider's toes.
  const spin = (v: V3): V3 =>
    turn(
      turn(turn(v, rollAxis, look.roll * g), pitchAxis, look.pitch * g),
      deck.normal,
      look.yaw * g * face,
    );
  const centre = add(add(deck.centre, scale(UP, look.lift * g)), scale(F, look.across * g));
  return {
    centre,
    along: norm(spin(deck.along)),
    normal: norm(spin(deck.normal)),
    right: norm(spin(deck.right)),
    bend: deck.bend * (1 - g),
  };
}

/** WHERE THE HAND CLOSES on the deck for a grab: on its edge between (or
 * beyond) the feet, or on an end — a fist's thickness off the board. */
export function grabSpot(
  look: GrabLook,
  f: BoardFrame,
  b: BoardPoseInput["board"],
  face: number,
  fist = FIST,
): V3 {
  if (look.end) {
    const s = look.end * (b.length / 2 - END_IN);
    return add(onDeck(f, b, s), scale(f.normal, fist * 0.5));
  }
  const s = (look.at * b.stance) / 2;
  const top = onDeck(f, b, s);
  const out = scale(f.right, face * look.edge);
  return add(add(top, scale(out, boardHalfWidth(b, s) + fist * 0.6)), scale(f.normal, -0.01));
}

/** THE HAND'S GAP to the board it grabs, m — from the hand's point to the
 * edge (or the end) it closes on, so a fist round it reads a few cm: 0
 * with no grab. */
export function grabGap(bp: BoardPose, input: BoardPoseInput): number {
  if (!input.grab) return 0;
  const look = GRAB_LOOKS[input.grab];
  const face = input.board.lead === "regular" ? 1 : -1;
  const fi = frontIndex(input.board.lead);
  const i = look.hand === "front" ? fi : 1 - fi;
  const spot = grabSpot(look, bp.board, input.board, face, 0);
  const h = bp.pose.hands[i];
  return Math.max(0, len(sub(h, spot)));
}

function V0(): V3 {
  return { x: 0, y: 0, z: 0 };
}

/** THE KNEE'S FLEXION of leg `i` of a pose, rad (0 straight). */
export function kneeFlex(p: SkierPose, i: 0 | 1): number {
  const a = sub(p.hipJoints[i], p.knees[i]);
  const b = sub(p.feet[i], p.knees[i]);
  return Math.PI - Math.acos(clamp(dot(norm(a), norm(b)), -1, 1));
}
