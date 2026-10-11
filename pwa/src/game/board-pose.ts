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
//   * A CARVE IS CARRIED BY THE INCLINATION: the root is already rolled
//     onto the line he leans along, so the body stays one long line from
//     the edge — tall-ish, never folded at the waist or down on his knees.
//   * TOESIDE (his toe edge down): the knees and ankles driven forward
//     into the hill, the hips over the toes, the trunk tall along the
//     inclined line, the chest facing up the slope, both arms forward at
//     waist height; cut hard, the front hand reaches toward the snow.
//   * HEELSIDE: the hips low over the heel edge as on a chair (the knees
//     ~70–100°), the trunk leaning back along the line, the chest open down
//     the hill, the front arm pointing down the turn and the rear hand
//     trailing low — brushing the snow only when the turn is cut hard. One
//     hand at most is ever on the snow.
//   * THE TUCK side-on: the knees folded deep, the chest low over the
//     front knee, the hands in front of it, the head down along the nose.
//   * A LANDING folds the knees on the view's spring, the arms forward;
//     IN THE AIR the knees come up (the board drawn up under the hips),
//     the board levelled and the arms out.
//   * THE ONE-FOOT SKATE: the rear foot out of its binding pushing beside
//     the heel edge, never ahead of the front binding, the torso turned to
//     face the nose; between pushes it rests on the stomp pad by the rear
//     binding. HOPPING, both feet in, the knees fold and spring on the
//     stride's phase.
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
  hop: number;
  drive: number;
  stride: number;
  /** Stood still: his own clock, s, and how still, 0..1. */
  idle?: { t: number; still: number };
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

/** TOESIDE and HEELSIDE at a full turn: the knees' extra flexion, the hips'
 * shift toward the toes (positive) or back over the heels, the trunk's
 * extra lean and opening, rad, m. */
export const TOESIDE = { knee: 0.12, hips: 0.1, lean: -0.08, open: 0.05 };
export const HEELSIDE = { knee: 0.32, hips: -0.08, lean: -0.12, open: 0.3 };

/** THE TUCK at full crouch: the knees' extra flexion, the trunk's lean and
 * its opening toward the nose — the chest over the front knee. */
export const TUCK = { knee: 1.0, lean: 0.75, open: 0.2 };

/** How far past it the knees may fold, rad, and the shin's least and most
 * forward lean in a soft boot — the highback's lean (~14°) to a soft
 * boot's full flex. */
export const KNEE_MOST = 2.1;

/** THE ONE-FOOT SKATE: the free foot's push along the deck (m, from just
 * behind the front binding back past the rear one), out beside the heel
 * edge, its lift on the way back, the share of the stride it pushes for,
 * and the torso's turn to the nose, rad. */
export const SKATE = {
  from: 0.12,
  to: -0.42,
  out: 0.1,
  lift: 0.07,
  push: 0.55,
  open: 1.0,
};

/** THE HOP's height at its top, m. */
export const HOP = 0.11;

/** The low carve: the inclination over which a hand goes toward the snow
 * on a turn cut hard, rad; how close the brushing hand is held over it and
 * the least height any other hand keeps, m; how far the toeside front
 * hand reaches down toward it, m. */
export const LOW = { from: 0.5, to: 0.8, gap: 0.03, clear: 0.18, reach: 0.22 };

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
  const lifted = (lf + lb) / 2 + input.air * 0.16;
  const pitch = Math.atan2(lf - lb, b.stance) * (1 - ground);
  const place = (v: V3): V3 => rz(ry(rz(rx(v, -pitch), -edge), input.angle), r);
  const along = place({ x: 0, y: 0, z: 1 });
  const normal = place({ x: 0, y: 1, z: 0 });
  const right = place({ x: 1, y: 0, z: 0 });
  const snow = rz(UP, r);
  const centre = add(
    {
      x: 0,
      y: input.ground + lifted + input.crouchDrop * input.crouch,
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
  const free = input.free && onSnow > 0.5;
  const phase = input.stride - Math.floor(input.stride);
  const pushing = free ? smooth(0.15, 0.5, input.drive) : 0;
  // THE HOP: the knees folded before it and the whole of him up over it.
  const hop = clamp(input.hop, 0, 1) * onSnow;
  const hopUp = Math.max(0, Math.sin(2 * Math.PI * phase));
  const hopLoad = Math.max(0, -Math.sin(2 * Math.PI * phase));
  const rise = hop * HOP * hopUp;

  // THE FREE FOOT: pushing beside the heel edge, or on the stomp pad.
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
    const base = add(
      add(add(deck.centre, scale(nose, along)), scale(F, -(b.waist / 2 + SKATE.out))),
      scale(snow, up + SOFT_BOOT.sole * 0.2),
    );
    const pushF = norm(add(nose, scale(F, 0.45)));
    const padF = norm(add(scale(F, 0.8), scale(deck.along, 0.55)));
    freeSole = mix(padAt, base, pushing);
    const fr = norm(mix(padF, pushF, pushing));
    const n = norm(mix(deck.normal, snow, pushing));
    freeBoot = { f: norm(sub(fr, scale(n, dot(fr, n)))), n };
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
  const fore =
    0.06 * clamp(input.lean, -1, 1) + (free ? 0.1 : 0) + still * 0.025 * Math.sin(clock * 0.55);
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
      0.7 * air +
      0.5 * hop * hopLoad -
      0.15 * still -
      (free ? 0.12 * pushing : 0),
    0.3,
    KNEE_MOST,
  );
  // The pelvis square to the board, opened a little to the nose.
  const openUpper =
    STANCE.open +
    TOESIDE.open * toeK +
    HEELSIDE.open * heelK +
    TUCK.open * crouch +
    (free ? SKATE.open : 0) * (0.6 + 0.4 * pushing);
  // ...turned back the way a fakie rider looks.
  const fakie = input.switched ? -1 : 1;
  const openSign = fakie;
  const hipFace = turn(F, UP, -face * openSign * openUpper * STANCE.hips);
  const pelvis = cross(UP, hipFace); // left to right
  // Height: each leg's hip joint over its cuff at the flexion asked for.
  const span = Math.sqrt(
    BODY.thigh * BODY.thigh +
      SHIN_ABOVE_CUFF * SHIN_ABOVE_CUFF +
      2 * BODY.thigh * SHIN_ABOVE_CUFF * Math.cos(flex),
  );
  // ACROSS AS THE DECK LIES: where the engine's inclination and the deck's
  // edge differ, the column he is rolled onto stands off the deck's normal,
  // and hips set across the column would hang off the edge (a heelside
  // rider sat down behind it). Each metre up the column carries them
  // `UP·right` across the deck; taken back out, they stand over the edge.
  const tilt = dot(UP, deck.right) * face;
  const hipsXZ = add(add(mid, scale(F, across - (span + 0.12) * tilt)), scale(nose, fore));
  let hipY = 0;
  for (let i = 0; i < 2; i++) {
    const j = add(hipsXZ, scale(pelvis, (i === 0 ? -1 : 1) * BODY.hip));
    const dx = j.x - feet[i].x;
    const dz = j.z - feet[i].z;
    hipY += feet[i].y + Math.sqrt(Math.max(0.01, span * span - dx * dx - dz * dz));
  }
  hipY /= 2;
  // Stood still he breathes on his legs.
  hipY += still * 0.008 * Math.sin(clock * 1.7);
  const hips: V3 = { x: hipsXZ.x, y: hipY, z: hipsXZ.z };
  const hipJoints = [add(hips, scale(pelvis, -BODY.hip)), add(hips, scale(pelvis, BODY.hip))] as [
    V3,
    V3,
  ];
  // THE KNEES, solved over the toes (each shin forward of its boot).
  const knees = [0, 1].map((i) => {
    const toward = norm(add(add(boots[i].f, scale(boots[i].n, 0.15)), scale(F, 0.3)));
    return solveLimb(hipJoints[i], feet[i], BODY.thigh, SHIN_ABOVE_CUFF, toward);
  }) as [V3, V3];

  // THE TRUNK: leaning toward his toes (and down over the front knee in a
  // tuck), the shoulders opened to the nose.
  const chestFace = turn(F, UP, -face * openSign * openUpper);
  const lean = clamp(
    STANCE.lean +
      TOESIDE.lean * toeK +
      HEELSIDE.lean * heelK +
      TUCK.lean * crouch +
      0.35 * fold +
      0.3 * clamp(input.load, 0, 1) +
      0.1 * air +
      (free ? 0.12 : 0),
    -0.2,
    1.25,
  );
  // In a tuck the chest goes down over the FRONT knee: the lean's way
  // turned toward the nose.
  const leanWay = norm(add(chestFace, scale(nose, 0.35 * crouch * fakie)));
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
  const tuckF = add(add(kf, scale(F, 0.14)), scale(UP, 0.06));
  const tuckR = add(add(mix(knees[0], knees[1], 0.5), scale(F, 0.2)), scale(UP, 0.14));
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
      0.7,
    );
    handR = mix(
      handR,
      add(add(add(sR, scale(lead2, 0.05 - swing)), scale(F, 0.24)), scale(downV, 0.45)),
      0.7,
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
    if (toe > 0) handF = add(handF, scale(plane.normal, -LOW.reach * brush));
    else handR = toSnow(add(handR, scale(lead2, -0.08 * brush)), sR);
  }
  // ...and none is ever drawn into it.
  handF = above(handF, LOW.gap);
  handR = above(handR, LOW.gap);
  const elbowPole = (i: number): V3 => {
    const out = norm(sub(shoulders[i], neck));
    return norm(add(add(scale(UP, -0.55), scale(out, 0.8)), scale(chestFace, -0.25)));
  };
  const hands: [V3, V3] = [handF, handR];
  const armF = arm(sF, hands[0], elbowPole(fi));
  const armR = arm(sR, hands[1], elbowPole(ri));
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
    board: deck,
    free: free ? ri : null,
    rise,
  };
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

/**
 * THE BOARD UNDER A THROWN RIDER'S FEET (`board-crash.ts` keeps it on):
 * the deck laid along the line from his back foot to his front one, its
 * top square to his shins, the soles in its bindings — and his boots turned
 * to the bindings' angles, so the figure's feet stand in them. Made over
 * in place: `pose.boots` and `pose.feet` are the bindings'.
 */
export function boardUnderFeet(pose: SkierPose, board: BoardPoseInput["board"]): BoardFrame {
  const fi = frontIndex(board.lead);
  const ri = 1 - fi;
  const along0 = sub(pose.feet[fi], pose.feet[ri]);
  const along = len(along0) > 1e-4 ? norm(along0) : { x: 0, y: 0, z: 1 };
  // The shins' mean up, squared to the board's length.
  const shin = (i: number) => norm(sub(pose.knees[i], pose.feet[i]));
  let up = add(shin(0), shin(1));
  up = sub(up, scale(along, dot(up, along)));
  const normal = len(up) > 1e-4 ? norm(up) : norm(cross(along, { x: 1, y: 0, z: 0 }));
  const right = norm(cross(normal, along));
  const frame: BoardFrame = { centre: { x: 0, y: 0, z: 0 }, along, normal, right, bend: 0 };
  const { sole, boot } = bindingsOf(frame, { board });
  // The deck's middle under the feet' middle, the soles' height under the
  // cuffs.
  const mid = mix(pose.feet[0], pose.feet[1], 0.5);
  const soleMid = mix(sole[0], sole[1], 0.5);
  const cuffMid = mix(cuffOver(sole[0], boot[0]), cuffOver(sole[1], boot[1]), 0.5);
  frame.centre = add(sub(mid, cuffMid), soleMid);
  const placed = bindingsOf(frame, { board });
  for (let i = 0; i < 2; i++) {
    pose.boots[i] = placed.boot[i];
    pose.feet[i] = cuffOver(placed.sole[i], placed.boot[i]);
  }
  return frame;
}
