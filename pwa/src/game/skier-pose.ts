// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S POSE, as arithmetic — where his hips, shoulders, hands and
// feet are in the pair's own body frame (x right, y up, z forward, the
// origin at the centre of gravity of skier and skis) for what the engine
// says he is doing. `skier-figure.ts` hangs the figure on these points;
// this module is three-free so the suite reads it
// (`tests/skier_pose_test.ts`, `tests/world_render_test.ts`).
//
// A SKIER STANDS ON HIS SKIS. His boots are clamped to them, so his feet go
// where the skis go — up toward his hips as a leg folds (`lift`, off the
// engine's `skiCompression`), turned with the skid's pivot, tipped with the
// edge — and everything above the boots is his to move. The base pose is
// the athletic stance every skier is taught: the ankles flexed into the
// boots' cuffs, the knees bent, the hips over the feet, the trunk pitched
// a little forward, the hands out ahead at hip height with the poles
// hanging back from them. Every input the engine reports moves it:
//
//   * `crouch` folds him into the TUCK: the hips drop toward the boots and
//     back, the trunk goes to near level with the back ROUNDED (the spine
//     is two spans, the lumbar and the chest's), the hands come together
//     ahead of the knees and the poles swing back under the arms — the
//     shape every downhill racer makes on a schuss;
//   * `hipRight` is where the engine has put his mass in a turn (m): the
//     legs lean in with the skis — each SHIN HELD IN ITS BOOT, tipped with
//     the ski's edge — and the trunk leans in too but less, a hinge at the
//     hips (the ANGULATION), the shoulders counter-rotated toward the
//     outside ski and the eyes held toward the horizon (`roll`, the
//     pair's own). That is what a carved turn looks like from behind: an
//     inclined column with a hinge at the hips, never a man sat sideways;
//   * `hipAft` and `lean` are the fore and aft weight — back at speed and
//     for a landing, forward to load the tips;
//   * `bump` is his legs taking a hit (`skierSpring`): a landing folds him
//     down and he comes back up;
//   * THE GAIT at a crawl (`gaitOf`, off the engine's own `drive` and
//     `stride`): SKATING — the skis opened into a V, a leg driven out long
//     off its edge each stride and lifted back in while the weight goes
//     wholly over the other ski, the one he glides on and the way he goes
//     (the engine's `glide`) — and, rolling, DOUBLE-POLING — both poles
//     planted ahead together, the body folded down over them and the arms
//     driven back past the hips until they are long, then swung forward
//     for the next. Every arm works one STROKE (plant, push, recover) and
//     every pole is a rigid rod turned through it, so the cycle runs on
//     from stride to stride without a joint jumping;
//   * THE JUMP: sunk onto the legs and the arms drawn back while it loads
//     (`jumpLoad`), then sprung — the legs straight and the arms thrown up
//     and forward — for a moment after the pop (`popped`); in FLIGHT he is
//     compact, the knees bent and the skis under him, and he goes into the
//     air and comes out of it as motions (the view's eased `air`) — and
//     rides a FALL by how far it is (`flight`, `skier-flight.ts`): secure
//     off a kicker, spotting a drop, windmilling a cliff, reaching for the
//     snow;
//   * STOOD STILL (`idle`) he breathes, shifts his weight, looks about and
//     works the grips — on his own clock, so a start line of four is not
//     in step;
//   * THE EDGE CUT HARDER (`carve`): the angulation deepened and the inside
//     hand carried down toward the snow; THE HOCKEY STOP (`skid`): sat
//     down and back into it, the upper body facing on down the hill while
//     the skis are thrown across;
//   * on a tricks run a GRAB held in the air folds him to a hand on a ski,
//     kicks the skis apart (a spread) or fore and aft (a daffy);
//   * THE SAVE (`jolt`, `skier-save.ts`): thrown by a near fall — sunk,
//     lurched, rocked, the shoulders knocked round, the arms flung out or
//     a hand put down to the snow — and fighting back up out of it;
//   * WITHOUT POLES (`poles: false`, `skier-bare.ts`): empty hands, no plant.
//
// The limbs are two bones each, solved analytically (`solveLimb`) toward a
// pole — the knees forward and a little out, the elbows out and down — so a
// foot lifted by a folded leg bends the knee rather than stretching it.

import { TUNING, type TrickPose } from "@engine";

import { STILL_GAIT, type Gait } from "./skier-gait.ts";
import {
  armAt,
  DOUBLE_ARM,
  DOUBLE_BASKET,
  easeFist,
  holdPush,
  plantPole,
  plantReach,
  smooth,
  STRIDE_STROKE,
  strokeHand,
  strokePole,
  strokeSwing,
  TURN_PLANT,
  type Stroke,
} from "./skier-stroke.ts";
import { joltHand, NO_JOLT, type Jolt } from "./skier-save.ts";
import { bareRest, placeBare } from "./skier-bare.ts";
import { flightHands, flightPole, type FlightShape } from "./skier-flight.ts";
import { add, clamp01, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";
import {
  bootFrame,
  bootKnee,
  CUFF,
  hipsOver,
  kneeRoom,
  pelvisAxis,
  solveLimb,
  turnAbout,
} from "./skier-limbs.ts";

export { STILL_GAIT, gaitOf, type Gait } from "./skier-gait.ts";
export {
  createSkierSpring,
  drawnSkiAngle,
  inStartGate,
  leadOf,
  pitchHeld,
  stepSkierSpring,
  type SkierSpring,
} from "./skier-spring.ts";

export type { V3 } from "./skier-vec.ts";
import type { SkierPose } from "./skier-joints.ts";
export type { SkierPose } from "./skier-joints.ts";
import { MOUNTS, type Mounts } from "./skier-mounts.ts";
export { MOUNTS, mountsFor, type Mounts } from "./skier-mounts.ts";
export { solveLimb, type Boot } from "./skier-limbs.ts";

/** Limb lengths and body proportions, m — the engine's own
 * (`TUNING.crash.body`), which the thrown body is built on. */
export const BODY = {
  thigh: 0.44,
  /** The knee to the ankle — the ragdoll's shin. The figure's leg ends at
   * the boot's CUFF, which holds the lower shin rigid, so the bone it bends
   * is `shin − cuffOverAnkle`. */
  shin: 0.46,
  upperArm: 0.31,
  /** The elbow to the middle of the fist round the pole's grip — the
   * forearm and the hand as one bone, since the hand never leaves the grip. */
  forearm: 0.34,
  /** Hips to the base of the neck. */
  spine: 0.5,
  /** Half the shoulders' width, and of the hips'. */
  shoulder: 0.2,
  hip: 0.12,
  /** Base of the neck to the helmet's centre. */
  neck: 0.18,
  /** How far the shoulder joints sit below the base of the neck, and
   * forward of it — rounded forward, the way a skier holds himself. */
  shoulderDrop: 0.06,
  shoulderFore: 0.03,
  /** How far a boot's cuff top stands over the ankle inside it, m — the
   * stretch of shin the boot holds, which bends nothing. */
  cuffOverAnkle: 0.17,
};

/** THE SHIN THE FIGURE BENDS: the knee to the boot's cuff, m. A leg solved
 * to the cuff on the whole knee-to-ankle shin stands a skier on stilts that
 * can only be folded into a squat; this is why the knees read right. */
export const SHIN_ABOVE_CUFF = BODY.shin - BODY.cuffOverAnkle;

/** How far the hips go inside for every metre the engine has moved his
 * mass — the hips go further than the centre of mass does, because the
 * feet stay on the skis. */
const HANG = 1.15;
/** How far the knees angulate inside the line from the hips to the boots,
 * rad — the edge a ski stands on that the hips need not follow. */
const KNEE_IN = 0.22;
/** …and how much more they take for every radian of edge past half a
 * radian — a steep edge is held as much in the knees as at the hips. */
const KNEE_STEEP = 0.5;
/** …and how far the hips may hang inside the shins' line, rad — the knees
 * bowed out a little, no more, and only in a turn the skis are tipped into. */
const KNEE_OUT = 0.06;
/** How much of the tuck a full skid stands him out of. */
const SKID_RISE = 0.6;
/** THE ANGULATION: the share of the legs' lean in the world the trunk
 * takes back at the hips — the hinge a carved turn is skied on (a racer's
 * is 15–30°, up to 40° at the height of a slalom turn). */
const ANGULATE_SHARE = 0.6;
/** The trunk's pitch standing and in a full tuck, rad (0 upright). */
const PITCH_STAND = 0.32;
const PITCH_TUCK = 1.25;
/** THE COUNTER-ROTATION, rad at full steer: the skis turn under a quiet
 * upper body that keeps facing down the fall line — so the shoulders face
 * the OUTSIDE of the turn off the skis' line, and the pelvis half as far. */
const TWIST = 0.28;
/** THE UPPER BODY LEADS A TURN (`SkierSpring`'s `leadOf`): a skier starts
 * one by moving his upper body into it — the head turned, the hips crossed
 * over toward the new turn, the shoulders and the hands carried with them
 * — and the knees follow the skis onto their edges. At a full lead: how far
 * the trunk leans into the turn in the world, rad, how far the hips cross
 * over, m, how far the shoulders turn toward it, rad, how far the head
 * looks into it, rad, and how far the hands are carried across, m. */
const LEAD = { lean: 0.3, hips: 0.08, twist: 0.15, look: 0.4, hands: 0.1 };
/** THE SPINE'S TWO SPANS: the lumbar's share of hips-to-neck, and how far
 * the back rounds between them, rad — standing, in a full tuck, at a
 * double pole's push and in a landing's fold (added). */
export const LUMBAR = 0.45;
const SPINE_ROUND = { stand: 0.08, tuck: 0.5, pole: 0.42, fold: 0.25 };

/** How much of the trunk's lean in the world the head keeps (the rest it
 * rolls back toward the horizon), and the most the neck rolls it off the
 * trunk, rad. */
const HEAD_LEAN = 0.35;
const NECK_ROLL = 0.5;
/** How far back a hanging pole swings from the vertical, rad. */
const POLE_HANG = 0.75;
/** How far over the snow a pole the push cannot plant is held, m at none
 * of a plant — clear of the snow, never skimming along it. */
const POLE_SHY = 0.2;

export type SkierPoseInput = {
  /** The pair's own roll in the world, rad, right side down positive
   * (`SkierState.roll`) — what the head levels against. */
  roll?: number;
  hipRight: number;
  hipAft: number;
  lean: number;
  steer: number;
  /** The skis' tilt in the body frame, rad (`skiTilt`), and the skid's
   * pivot, rad — the boots go with them. */
  edge?: number;
  skiAngle?: number;
  /** The skis' tilt and the pair's roll as his body above the boots
   * carries them (`SkierSpring`, eased) — what the legs lean and the trunk
   * hinges by; `edge` and `roll` when left out. The boots stay on `edge`. */
  body?: { tilt: number; roll: number };
  /** The upper body's lead into a turn, −1..1, right positive
   * (`leadOf`); none when left out. */
  lead?: number;
  /** The tuck the body is in, 0..1 (`SkierState.crouch`). */
  crouch: number;
  /** The tuck ASKED for, 0..1 (`SkierState.tuck`) — the crouch is also a
   * jump's load, and only a skier tucked stays folded through the pop;
   * `crouch` when left out. */
  tuck?: number;
  /** How far the tuck has dropped the body's origin toward the skis, m —
   * the feet rise by it. `crouch` × the mounts' `crouchDrop` when left
   * out. */
  drop?: number;
  /** Each ski's lift off its rest, m — a folded leg, the inside ski's rise
   * on an inclined stance — its shift across off half the stance and
   * along, m, and the inclination its boot is pivoted against
   * (`ski-stand.ts`'s `lift`, `out`, `fore` and `incline`). */
  lift?: readonly [number, number];
  spread?: readonly [number, number];
  fore?: readonly [number, number];
  incline?: number;
  airborne: boolean;
  /** Seconds since the last landing — a fresh landing folds the knees when
   * no `bump` is handed in. */
  landing: number;
  /** How far his legs are folded by a hit, m — positive is the body sunk
   * toward the skis (`skierSpring`). */
  bump?: number;
  /** A pole plant in hand, 0..1 — a lone plant, when no `gait` is given. */
  plant?: number;
  /** THE POLE PLANT a turn is started on (`SkierSpring`): the pole (0
   * left), how far through it he is (0..1) and how much of it his riding
   * allows (0..1). */
  plantAt?: { side: 0 | 1; t: number; weight: number };
  /** THE GAIT the skier is working in at a crawl (`gaitOf`). */
  gait?: Gait;
  /** The snow passed since the stroke's plant, m, as the view kept it
   * (`SkierSpring.poled`) — the gait's own reckoning when left out. */
  poled?: number;
  /** How far into the air his body is, 0..1, eased (`SkierSpring.air`);
   * `airborne` as 0 or 1 when left out. */
  air?: number;
  /** THE JUMP loading, 0..1 of a full load, and seconds since the last
   * pop (`SkierState.jumpLoad` / `popped`) — the load as his body holds it
   * (`SkierSpring.load`) when the view keeps one. */
  jumpLoad?: number;
  popped?: number;
  /** The edge cut hard, 0..1, and the skid's pivot share, 0..1. */
  carve?: number;
  skid?: number;
  /** STANDING STILL: his own clock, s (`SkierSpring.clock`), and how still
   * he is, 0 moving to 1 stood on the snow — what he breathes, shifts his
   * weight and looks about by while he waits. */
  idle?: { t: number; still: number };
  /** IN THE START GATE under the lights, 0..1 (`SkierSpring.ready`):
   * crouched with his poles planted over the wand ahead of his boots. */
  ready?: number;
  /** A TRICKS run's grab held in the air (`strokes.ts`), or none. */
  trick?: TrickPose | null;
  /** THE SAVE his body is making (`skier-save.ts`), or none. */
  jolt?: Jolt;
  /** How far his trunk is held off the skis' pitch, rad — further forward
   * of skis rocked back under him over a bump (`pitchHeld`). */
  pitchHeld?: number;
  /** THE FALL his body is riding (`skier-flight.ts`), or none. */
  flight?: FlightShape;
  /** Whether he has his poles (`SkierState.poles`); with them when left out. */
  poles?: boolean;
  mounts?: Mounts;
};

/** How far a double-pole's push folds the trunk further over, rad — a
 * skier working out of a gate, not a cross-country racer bowed to his
 * knees. (The skate's own lean, roll, sink and twist are the gait's.) */
const POLE_FOLD = 0.36;
/** …and what the rest of him does through it: how far the hips sink and
 * go back as he crunches onto the poles, m, how far he rises and comes
 * forward over his feet into the plant, m, and how far the trunk leans on
 * over the skis the whole time he works, rad — he FALLS ONTO the poles at
 * the plant, his weight ahead of his feet, rather than standing up for it
 * (a man stood upright to plant reads as unsure of his skis). Measured
 * double poling has the trunk some 40–45° over at the plant and 55° at
 * the bottom of the push; this plants at 39° and crunches to 60°. */
const POLE_BODY = { sink: 0.1, back: 0.07, rise: 0.03, forward: 0.03, lean: 0.36 };
/** How much wider of the hips the fists go working the poles, m. */
const POLE_WIDE = 0.06;
/** How far out the elbows flare at the double pole's plant. */
const PLANT_FLARE = 0.35;
/** THE START GATE (`ready`): how far the hips sink and sit back over the
 * boots, m, how far the trunk tips over them, rad, and how far out from
 * the centre the baskets are planted, m — ahead of the boots, over the
 * wand, as far ahead as the poles reach from the fists. The crouch a
 * racer waits in before he falls forward onto the poles at GO. */
const GATE = { sink: 0.1, back: 0.03, pitch: 0.3, basket: 0.36 };
/** WAITING: the breath's lift of the chest (rad off the trunk's pitch),
 * the weight's shift from ski to ski (m), the glance about (rad of the
 * head's turn) and the hands working the grips (m) — at their fullest. */
const IDLE = { breath: 0.035, shift: 0.025, glance: 0.3, fidget: 0.012 };
/** COMPACT IN THE AIR: how far his body sinks toward the skis in flight,
 * m (negative is down) — the knees bent and the skis carried under him, a
 * skier's flight, not one stood up on long legs while the skis hang. */
const AIR_SINK = -0.13;
/** How long the pop's spring shows, s, and how long it takes to rise out
 * of the crouch into it. */
const POP_SHOWN = 0.35;
const POP_RISE = 0.18;
/** How much further a jump being loaded sinks him, m, at a full load in a
 * full tuck — the engine's crouch already folds a skier stood up into the
 * load, but a tucked skier has nowhere left in it to go, so the view takes
 * him lower on his knees. */
const LOAD_SINK = 0.09;

/** THE WHOLE POSE for one frame. */
export function skierPose(input: SkierPoseInput): SkierPose {
  const M = input.mounts ?? MOUNTS;
  const lean = Math.max(-1, Math.min(1, input.lean));
  const edge = input.edge ?? 0;
  const bodyTilt = input.body?.tilt ?? edge;
  const skiAngle = input.skiAngle ?? 0;
  // Thrown across under a body inclined to the snow, the skis (pivoted in
  // the snow's plane, `bootFrame`) tip their boots fore and aft: the hips
  // sit back along them by as much, the legs kept a column over the boots.
  const tip = Math.sin(input.incline ?? 0) * Math.sin(skiAngle);
  const lift = input.lift ?? [0, 0];
  const drop = input.drop ?? clamp01(input.crouch) * M.crouchDrop;
  // Over a hop the gait handed in is still his stroke (`flying`); with no
  // eased air handed in, any air stills it.
  const gait = input.airborne && input.air === undefined ? STILL_GAIT : (input.gait ?? STILL_GAIT);
  const carve = clamp01(input.carve ?? 0);
  // In the start gate the brake is the wand holding him, not a skid to draw.
  const ready = clamp01(input.ready ?? 0) * (1 - clamp01(input.air ?? 0));
  const bare = input.poles === false;
  const skid = clamp01(input.skid ?? 0) * (1 - ready);
  const J = input.jolt ?? NO_JOLT;
  const F = input.flight;
  // A SKIER BRAKING RISES OUT OF HIS TUCK: skis thrown across under a man
  // folded flat swing his legs into profile, the knees up by his shoulders
  // — so the skid stands him up, the skis where the engine's drop has them.
  const crouch = clamp01(input.crouch) * (1 - SKID_RISE * skid);
  // Into the air and back as motions (the view's eased `air`), and a
  // load let go of over the pop rather than in a step.
  const air = clamp01(input.air ?? (input.airborne ? 1 : 0));
  const load = input.air === undefined && input.airborne ? 0 : clamp01(input.jumpLoad ?? 0);
  // The pop's spring: straight up out of the crouch for a moment after he
  // leaves the snow off his own legs.
  // Tucked, he springs off his legs and stays folded: only a skier stood
  // up rises out of his crouch into the pop.
  const tucked = clamp01(input.tuck ?? input.crouch) * (1 - skid);
  const pop =
    input.popped !== undefined && input.popped < POP_SHOWN
      ? smooth(input.popped / POP_RISE) * (1 - smooth(input.popped / POP_SHOWN)) * (1 - tucked)
      : 0;
  // A fresh landing takes it in the knees — the spring's, when there is
  // one, or else a fold over a third of a second.
  const bump = input.bump ?? (input.airborne ? 0 : Math.max(0, 1 - input.landing / 0.35) * 0.12);
  const fold = Math.max(0, bump);
  // THE ARMS' CYCLE: the double pole's, and the skate's — both poles
  // planted with every push, the way a racer skates out of the gate — or
  // a lone plant handed in.
  // ...worked only while a stroke keeps up with the snow (`gait.keep`).
  const arms = bare ? 0 : clamp01(gait.pole + gait.skate) * (1 - crouch * 0.5) * gait.keep;
  // The arms as posed: working, or set at the plant in the start gate —
  // where GO's first push begins from.
  const armW = bare ? 0 : arms + ready * (1 - arms);
  const lone =
    bare || gait.stride + gait.skate + gait.pole > 0.01
      ? 0
      : clamp01(input.plant ?? 0) * (1 - crouch) * (1 - air);
  // The poles' share of the stride: a double pole's whole push, a quick
  // bite inside a skate's long one (`poleDuty`).
  const duty = gait.duty;
  // Where the arms are in their swing: 0 planted ahead, 1 swept through
  // past the hips at the end of the push, and back over the recovery.
  const swing = strokeSwing(gait.phase, duty);
  // THE BODY WORKS THE POLES, not the arms alone: through the push he
  // crunches down onto them — the trunk folded over, the back rounded, the
  // knees giving and the hips going back — and over the recovery he rises
  // tall again on his legs as the arms swing through, standing up into the
  // next plant. The double pole's and the skate's poling alike.
  const crunch = arms * swing;
  const tall = arms * (1 - swing);
  // The diagonal stride's arms each have a cycle two strides long, planted
  // with the kick of the leg on their own side — so they swing opposite,
  // a man walking, and pass each other rather than both stopping.
  const strideDuty = TUNING.poles.duty / 2;
  const stridePhase = [0, 1].map((i) => ((i === gait.push ? 0 : 1) + gait.phase) / 2);
  const strideSwing = stridePhase.map((p) => strokeSwing(p, strideDuty));
  // Hung inside: how far, as a share of a full hang, signed to the side —
  // deeper for an edge cut hard.
  const hang = Math.max(-1, Math.min(1, (input.hipRight / 0.3) * (1 + 0.35 * carve)));
  // HOW FAR INTO A TURN HE IS, −1..1: the engine's own hip shift, which
  // lags the key — never the key itself, which flips from one side to the
  // other in a step and would snap the shoulders, the pelvis and the head
  // round at every change of edge.
  const turning = Math.max(-1, Math.min(1, input.hipRight / 0.3));
  // THE UPPER BODY FIRST: how far his upper body has gone into a turn
  // ahead of his legs — so the head, the hips and the shoulders go, and
  // the knees follow.
  const ahead = Math.max(-1, Math.min(1, input.lead ?? 0)) * (1 - air) * (1 - 0.5 * crouch);

  // THE FEET, on the boots: each binding where its ski stands — raised by
  // the tuck's drop and the ski's lift, out along a skate's V and up off
  // the snow as the gait says — and the cuff up the boot's own frame, so a
  // ski pivoted or edged carries its boot round its binding.
  const cuff = M.foot.y - M.ground;
  const bootOn = (i: number) =>
    bootFrame(skiAngle + gait.splay[i], edge + gait.tilt[i], input.incline ?? 0);
  const feet: [V3, V3] = [-1, 1].map((side, i) => {
    const boot = bootOn(i);
    const base = {
      x: side * M.foot.x + gait.out[i] + (input.spread?.[i] ?? 0),
      y: M.ground + drop + lift[i] + gait.lift[i],
      z: gait.fore[i] + (input.fore?.[i] ?? 0),
    };
    return add(base, add(scale(boot.n, cuff), scale(boot.f, M.foot.z)));
  }) as [V3, V3];
  // The feet's average lift: the LEGS TAKE IT (`hipsOver`). (Skating, the
  // gait has put the feet under him: his weight over the gliding ski.)
  const hipsLift = hipsOver((lift[0] + lift[1]) / 2);

  // THE HIPS: over the feet standing, down and back in a tuck, inside the
  // turn by the engine's angulation, aft of nominal by the engine's shift,
  // sunk by a landing's fold and a jump being loaded, sat down into a
  // hockey stop, and up and forward in the pop.
  const rest = mix(M.hips, M.tuckHips, crouch);
  // ALIVE WHILE HE WAITS: stood still (the start line, the finish), a
  // skier is never a statue — he breathes (the chest rising every few
  // seconds), shifts his weight from ski to ski, looks about and works his
  // hands on the grips, each on a period of its own so nothing repeats in
  // step. Faded out the moment he moves.
  const still = input.idle ? clamp01(input.idle.still) * (1 - air) * (1 - crouch) : 0;
  const it = input.idle?.t ?? 0;
  const wave = (period: number, phase = 0) => Math.sin((2 * Math.PI * it) / period + phase);
  const breath = still * IDLE.breath * (0.5 + 0.5 * wave(3.9));
  const shift = still * IDLE.shift * wave(7.3, 1.1);
  const glance = still * IDLE.glance * (1 - 0.8 * ready) * wave(9.7, 2.3) * (0.6 + 0.4 * wave(4.1));
  const fidget = [still * IDLE.fidget * wave(2.9, 0.4), still * IDLE.fidget * wave(3.4, 1.9)];
  // THE LEGS STAND IN THE SKIS' FRAME: the hips' place over the boots —
  // the hang into the turn across the skis, the stance's sit behind the
  // boots along them — is turned with the skid's pivot, because the boots
  // hold each shin in its ski's own plane. Stated in the pair's frame, a
  // pair thrown across under him swings the thighs out over the tips and
  // folds the knees up to the hips.
  const hang0 = input.hipRight * HANG * (1 + 0.35 * carve);
  // THE LEGS LEAN WITH THE SKIS, AS A COLUMN: the hips swing over the
  // boots on the legs' own length, coming down as they go in — never slid
  // across at a standing height, which folds the thighs flat and sits him
  // sideways in a chair. A boot clamped to an edged ski holds its
  // shin tipped with it, so the hips go where the engine has put his mass
  // only as far as the knees can angulate off the shins' line — inside it
  // by up to `KNEE_IN` (the knees driven in, the hips kept out over the
  // outside ski), barely outside it. The engine's roll of the whole pair
  // has already leaned the legs into the turn; a hang laid on top of that
  // with the skis flat under him throws the thighs out sideways and folds
  // the knees up to the hips.
  const legH = Math.max(0.3, rest.y - M.foot.y - drop);
  // Measured from the boots: an edged ski's cuff stands to the side of
  // where it stood flat.
  const bootsAcross = (M.foot.y - M.ground) * Math.sin(edge);
  // THE KNEES GO INTO THE TURN THE SKIS ARE EDGED FOR — its side read off
  // the edge IN THE WORLD, never off the skis' tilt in the pair's frame:
  // the engine's roll of the pair runs past the edge for half a second
  // into every turn, which flips that tilt against the turn and bowed
  // the knees out of it before they went in.
  const turnEdge = bodyTilt + (input.body?.roll ?? input.roll ?? 0);
  const inward = 0.5 + 0.5 * Math.tanh(turnEdge / 0.08);
  // Inclined about his feet (`ski-stand.ts`), his hips are already inside
  // the turn by the legs' length × sin incline: only what is left of the
  // engine's hip shift hangs them further — never twice.
  const carried = Math.sign(hang0) * legH * Math.sin(input.incline ?? 0);
  const legLean0 = Math.atan2(
    Math.sign(hang0) * Math.max(0, Math.abs(hang0) - Math.max(0, carried)),
    legH,
  );
  // The steeper the edge, the more of it the knees take on their own.
  const kneeIn = KNEE_IN + KNEE_STEEP * Math.max(0, Math.abs(bodyTilt) - 0.5);
  // ...and outside it by `KNEE_OUT` at most, only while the skis' tilt
  // agrees with the turn: tipped against it (the roll run past the edge),
  // a hip hung inside the shins' line is a knee bowed OUT of the turn.
  const agree = clamp01((bodyTilt * Math.sign(turnEdge)) / 0.1);
  const out = KNEE_OUT * agree;
  const legLeanTo = Math.max(
    bodyTilt - kneeIn * inward - out * (1 - inward),
    Math.min(bodyTilt + out * inward + kneeIn * (1 - inward), legLean0),
  );
  const across0 = rest.x + bootsAcross + legH * Math.sin(legLeanTo) + LEAD.hips * ahead + shift;
  const along0 =
    rest.z -
    input.hipAft * 0.8 -
    0.05 * lean +
    0.03 * lone -
    0.06 * load -
    POLE_BODY.back * crunch +
    POLE_BODY.forward * tall -
    GATE.back * ready -
    legH * tip;
  const pc = Math.cos(skiAngle);
  const ps = Math.sin(skiAngle);
  let hips: V3 = {
    x: across0 * pc + along0 * ps,
    y:
      rest.y +
      hipsLift -
      legH * (1 - Math.cos(legLeanTo)) -
      bump +
      AIR_SINK * air -
      0.06 * skid * (1 - crouch) -
      gait.sink -
      POLE_BODY.sink * crunch +
      POLE_BODY.rise * tall -
      GATE.sink * ready +
      0.08 * pop -
      LOAD_SINK * load * tucked -
      J.sink +
      (F?.lift ?? 0),
    z: -across0 * ps + along0 * pc,
  };
  // THE GRABS, in the air: a DAFFY kicks one ski forward and one back, a
  // SPREAD flings both wide, a GRAB folds him to a hand on the outside of
  // his boot.
  if (input.trick === "daffy") {
    feet[0] = { x: feet[0].x, y: feet[0].y - 0.1, z: feet[0].z - 0.45 };
    feet[1] = { x: feet[1].x, y: feet[1].y + 0.1, z: feet[1].z + 0.5 };
  } else if (input.trick === "spread") {
    feet[0] = { x: feet[0].x - 0.45, y: feet[0].y + 0.15, z: feet[0].z + 0.08 };
    feet[1] = { x: feet[1].x + 0.45, y: feet[1].y + 0.15, z: feet[1].z + 0.08 };
  }
  // THE PELVIS: turned with the skis as a hockey stop throws them across
  // (the legs turn under him; the shoulders stay facing down the hill),
  // the hip joints a hip's width either side along it, TILTED up over the
  // higher ski (`pelvisAxis`).
  // Skating, his hips turn toward the line he glides on (`gait.twist`).
  const pelvisYaw = skiAngle * 0.9 - turning * TWIST * 0.4 * (1 - 0.5 * crouch) + gait.twist;
  const pelvis = pelvisAxis(pelvisYaw, lift[1] - lift[0], BODY.hip);
  // THE LEGS FIT THE BOOTS: a hip a thigh and more from the knee its boot
  // allows at the cuff's least lean would need the shin stood up behind
  // the cuff — so the hips SINK until that knee can be reached, the knees
  // bending further (a skier in ski boots cannot stand on straight legs).
  // Sunk, never drawn sideways: a skate's weight stays where it was put.
  let sink = 0;
  [-1, 1].forEach((side, i) => {
    const hip = add(hips, scale(pelvis, side * BODY.hip));
    const boot = bootOn(i);
    const k = CUFF.least;
    const knee0 = add(
      feet[i],
      scale(add(scale(boot.n, Math.cos(k)), scale(boot.f, Math.sin(k))), SHIN_ABOVE_CUFF),
    );
    const d = sub(hip, knee0);
    const reach = BODY.thigh * 0.995;
    const flat = d.x * d.x + d.z * d.z;
    if (flat < reach * reach) sink = Math.max(sink, d.y - Math.sqrt(reach * reach - flat));
  });
  hips = { x: hips.x, y: hips.y - sink, z: hips.z };
  // THE KNEES FOLD ONLY AS FAR AS KNEES DO (`kneeRoom`): the hips lift
  // instead, and the trunk folds forward at the hips by as much below.
  const raise = kneeRoom(hips, pelvis, feet, crouch, BODY.hip, BODY.thigh, SHIN_ABOVE_CUFF);
  hips = { x: hips.x, y: hips.y + raise, z: hips.z };
  // lean, folded further by a landing, over the poles on a double pole's
  // push and into a skate's, and stood up by the pop.
  const pitch =
    PITCH_STAND +
    (PITCH_TUCK - PITCH_STAND) * crouch -
    0.3 * lean * (1 - crouch) +
    fold * 1.4 +
    POLE_FOLD * crunch +
    POLE_BODY.lean * arms +
    GATE.pitch * ready * (1 - arms) +
    gait.pitch +
    0.15 * gait.stride +
    0.25 * load -
    0.25 * pop +
    0.1 * skid -
    breath +
    J.lurch +
    (F?.pitch ?? 0) +
    (input.pitchHeld ?? 0) +
    Math.asin(Math.min(1, raise / BODY.spine));
  // ANGULATED, NOT SAT SIDEWAYS: a carving skier is a column inclined
  // into the turn with a hinge at the hips — the legs lean in with the
  // skis, and the trunk leans in too, but by `ANGULATE_SHARE` less (more
  // for an edge cut hard), so the shoulders come nearer level than the hips and
  // his weight stays over the outside ski. The trunk is never thrown out
  // past where the legs stand. Skating, the shoulders lean over the
  // gliding ski with the hips.
  const legLean = Math.atan2(
    hips.x - (feet[0].x + feet[1].x) / 2,
    hips.y - (feet[0].y + feet[1].y) / 2,
  );
  // THE HINGE IS STATED IN THE WORLD: the engine has already rolled the
  // whole pair into the turn (`input.roll`), so the legs' lean is that
  // roll and their own on it, and the trunk comes back up toward the
  // vertical a share of it — never out past the vertical. Stated in the
  // pair's frame, a rolled pair carries the trunk over with the legs and
  // the whole man tips into the turn as one stiff stick.
  const pairRoll = input.roll ?? 0;
  const legsWorld = (input.body?.roll ?? pairRoll) + legLean;
  const angulate =
    Math.min(0.6, ANGULATE_SHARE * Math.abs(legsWorld)) * (1 - 0.5 * crouch) * (1 + 0.4 * carve);
  const roll =
    legsWorld - Math.sign(legsWorld) * angulate - pairRoll + LEAD.lean * ahead + gait.roll + J.sway;
  const spineDir: V3 = {
    x: Math.sin(roll) * Math.cos(pitch),
    y: Math.cos(roll) * Math.cos(pitch),
    z: Math.sin(pitch),
  };
  // THE BACK ROUNDS: the spine is two spans — the lumbar from the hips to
  // the waist and the chest's from the waist to the neck — bent through
  // `round` between them, the lower one tipped back and the upper one
  // forward about the shoulders' line so the chord between hips and neck
  // keeps the trunk's pitch: near straight standing, a racer's rounded
  // back in the tuck, curled over the poles on a double pole's push and
  // folded by a landing.
  const round =
    SPINE_ROUND.stand +
    SPINE_ROUND.tuck * crouch +
    SPINE_ROUND.pole * crunch +
    SPINE_ROUND.fold * Math.min(1, fold / 0.15);
  const lumbar = BODY.spine * LUMBAR;
  const thoracic = BODY.spine - lumbar;
  const bendAxis = norm({ x: Math.cos(roll), y: -Math.sin(roll), z: 0 });
  const lowerDir = turnAbout(norm(spineDir), bendAxis, (-round * thoracic) / BODY.spine);
  const upperDir = turnAbout(norm(spineDir), bendAxis, (round * lumbar) / BODY.spine);
  const waist = add(hips, scale(lowerDir, lumbar));
  const neck = add(waist, scale(upperDir, thoracic));
  // The head held up to look down the hill: the neck bends back out of a
  // tuck's pitch, and turns into the turn.
  const look = turning * 0.35 + LEAD.look * ahead + glance;
  // THE EYES NEARER LEVEL: whatever the body leans, a skier holds his
  // eyes toward the horizon — the head rolls back off the trunk's lean in
  // the WORLD (the pair's own roll, `input.roll`, and the trunk's on it)
  // until it keeps only `HEAD_LEAN` of it, as far as the neck turns.
  const trunkWorld = pairRoll + roll;
  const headRoll =
    roll + Math.max(-NECK_ROLL, Math.min(NECK_ROLL, HEAD_LEAN * trunkWorld - pairRoll - roll));
  const head = add(
    neck,
    scale(
      norm({
        x: Math.sin(headRoll),
        y: 1 - 0.3 * J.duck,
        z: upperDir.z * (0.35 + 0.45 * crouch) + (F?.nod ?? 0),
      }),
      BODY.neck,
    ),
  );
  // The shoulders face on down the hill while a hockey stop throws the
  // skis across under them.
  const twist =
    -turning * TWIST * (1 - 0.5 * crouch) +
    LEAD.twist * ahead -
    skiAngle * 0.5 * skid +
    0.5 * gait.twist +
    J.twist;
  const across: V3 = norm({
    x: Math.cos(roll) * Math.cos(twist),
    y: -Math.sin(roll),
    z: -Math.cos(roll) * Math.sin(twist),
  });
  const spineUp = upperDir;
  const chest = norm({
    x: across.y * spineUp.z - across.z * spineUp.y,
    y: across.z * spineUp.x - across.x * spineUp.z,
    z: across.x * spineUp.y - across.y * spineUp.x,
  });

  const hipJoints = [-1, 1].map((side) => add(hips, scale(pelvis, side * BODY.hip))) as [V3, V3];
  // THE KNEES: each SHIN IS HELD BY ITS BOOT, in the boot's own plane —
  // tipped and turned with its ski — leaning forward of the ski's normal by
  // at least the cuff's lean and as far as the boot flexes. The knee is
  // found on that plane a shin up from the cuff and a thigh from the hip
  // (`bootKnee`), the leg solved through it so no bone stretches: the knees
  // of a carve go in with the skis, and stay over them in a tuck.
  const knees = [0, 1].map((i) => {
    const hip = hipJoints[i];
    const boot = bootOn(i);
    const target = bootKnee(hip, feet[i], boot, BODY.thigh, SHIN_ABOVE_CUFF);
    return solveLimb(
      hip,
      feet[i],
      BODY.thigh,
      SHIN_ABOVE_CUFF,
      sub(target, mix(hip, feet[i], 0.5)),
    );
  }) as [V3, V3];
  // The shoulders a little below the base of the neck and rounded forward.
  const yoke = add(add(neck, scale(spineUp, -BODY.shoulderDrop)), scale(chest, BODY.shoulderFore));
  const shoulders = [-1, 1].map((side) => add(yoke, scale(across, side * BODY.shoulder))) as [
    V3,
    V3,
  ];
  // THE HANDS: ahead at hip height standing, together ahead of the face in
  // a tuck, carried in with the hips' hang, a lone plant reaching forward
  // and down to its pole — and, working, swung through the double pole's
  // arc: up and ahead for the plant, down and back past the hips at the
  // end of the push. Loading a jump draws them back; the pop throws them
  // up and forward. Cut hard, the inside hand goes down toward the snow.
  // THE TURN'S POLE PLANT: the fist reaches forward for the touch and
  // stays there while the body passes the pole, then comes back.
  const plantAt = bare ? undefined : input.plantAt;
  const plantW = plantAt ? clamp01(plantAt.weight) * (1 - crouch) * (1 - air) : 0;
  const plantU = plantAt ? clamp01(plantAt.t) : 0;
  const reachOf = (i: number): number =>
    plantAt && plantAt.side === i ? plantW * plantReach(plantU) : 0;
  // The double pole's fist swung from its shoulder (`DOUBLE_ARM`): the arm
  // pressing down on the push, swung through long on the recovery.
  const armLength = BODY.upperArm + BODY.forearm;
  const pushing = gait.phase < duty;
  const double = armAt(DOUBLE_ARM, swing, pushing);
  // …and in the start gate, set at the plant whatever the stride says.
  const planted = armAt(DOUBLE_ARM, 0, true);
  const gateW = armW - arms;
  const hands = [-1, 1].map((side, i) => {
    // With no poles, the empty hand's own rest (`skier-bare.ts`).
    const grip = { x: side * M.hand.x, y: M.hand.y, z: M.hand.z };
    const h = mix(
      bare ? bareRest(grip, side, still) : grip,
      { x: side * M.tuckHand.x, y: M.tuckHand.y, z: M.tuckHand.z },
      crouch,
    );
    const inside = side * hang > 0 ? Math.abs(hang) : 0;
    // Working the poles, the fists go wide of the hips — and are left
    // there as the skate carries his hips across, so the arm on the
    // pushing side swings through outside the leg driven out under it.
    const polesX =
      h.x +
      hips.x * 0.6 +
      LEAD.hands * ahead +
      side * 0.1 * air +
      side * TURN_PLANT.reach.x * reachOf(i) +
      armW * side * POLE_WIDE;
    // Off the stance, or — working the poles — off the shoulder, which
    // already rides the hips' sink and the legs' fold.
    const own = h.y + hipsLift * 0.6 - bump * 0.5 - sink;
    const toArm = {
      y: armW * (shoulders[i].y - own) + armLength * (arms * double.y + gateW * planted.y),
      z: armW * (shoulders[i].z - h.z) + armLength * (arms * double.z + gateW * planted.z),
    };
    return {
      x: polesX,
      y:
        h.y +
        hipsLift * 0.6 -
        bump * 0.5 -
        sink +
        fidget[i] -
        0.12 * lone * (side > 0 ? 1 : 0.4) +
        toArm.y +
        gait.stride * strokeHand(STRIDE_STROKE, strideSwing[i]).y -
        0.1 * load +
        0.25 * pop -
        0.3 * carve * inside +
        TURN_PLANT.reach.y * reachOf(i),
      z:
        h.z +
        0.25 * lone +
        0.08 * air -
        0.15 * Math.max(0, lean) +
        toArm.z +
        gait.stride * strokeHand(STRIDE_STROKE, strideSwing[i]).z -
        0.3 * load +
        0.2 * pop +
        TURN_PLANT.reach.z * reachOf(i),
    };
  }) as [V3, V3];
  // THE ARMS NEVER LOCK: a fist carried toward the arm's full length is
  // eased in short of it (`easeFist`) — inside the solve for a held pole,
  // whose basket must be where the eased fist puts it.
  const reachArm = BODY.upperArm + BODY.forearm;
  // THE PUSH HELD TO THE SNOW (`holdPush`): each working arm driven back
  // as fast as the snow passes its planted basket, off the pose at the
  // plant — where the baskets bit, which the trunk crunching over the
  // poles since has not moved.
  const push =
    arms > 0 && gait.pass > 0
      ? holdPush({
          hands,
          shoulders,
          plant: skierPose({ ...input, gait: { ...gait, phase: 0, pass: 0 } }).poles,
          arms,
          armLength,
          arm: double,
          ground: M.ground + drop,
          pole: M.pole,
          bites: gait.keep,
          pass: gait.pass,
          phase: gait.phase,
          duty,
          poled: input.poled,
          reach: reachArm,
        })
      : null;
  if (push) {
    hands[0] = push.hands[0];
    hands[1] = push.hands[1];
  }
  if (bare) placeBare(hands, knees, { gait, crouch, air, ready, hang });
  // THE FALL: the fists spotting, circling or reaching for the snow.
  if (F) flightHands(F, shoulders, hands, armLength);
  // THE SAVE: the arms flung out for the balance, or a hand put down.
  if (J !== NO_JOLT) {
    for (const i of [0, 1]) hands[i] = joltHand(hands[i], i ? 1 : -1, J, M.ground + drop);
  }
  if (input.trick === "grab") {
    // Folded to the right boot, the other hand out for balance.
    hands[1] = { x: feet[1].x + 0.12, y: feet[1].y + 0.04, z: feet[1].z + 0.12 };
    hands[0] = { x: -0.45, y: hips.y + 0.35, z: 0.1 };
  }
  // Every other fist eased the same way. A grab reaches for its boot as it
  // is; a save's arm has been flung where it is.
  if (input.trick !== "grab" && (!push || J !== NO_JOLT)) {
    for (const i of [0, 1]) hands[i] = easeFist(shoulders[i], hands[i], reachArm);
  }
  // Elbows OUT and a little down, tucked in against the ribs in a tuck —
  // and, working the poles, down and back behind the fists, the arms
  // driving the push rather than flapping out like wings. The bend is
  // stated off the ARM itself: in the plane through the shoulders' line —
  // down for a fist ahead, back and up for a fist driven behind him — with
  // the elbow flared out on top, so no arm the strokes swing ever points
  // along it (where an elbow solved to a fixed pole flips across). At the
  // double pole's plant the elbows are OUT, bent over the grips, and close
  // in as the push drives them down and back.
  const working = clamp01(arms + gait.stride + (bare ? gait.skate : 0));
  const elbows = [-1, 1].map((side, i) => {
    const arm = norm(sub(hands[i], shoulders[i]));
    const bendTo = norm({
      x: across.y * arm.z - across.z * arm.y,
      y: across.z * arm.x - across.x * arm.z,
      z: across.x * arm.y - across.y * arm.x,
    });
    const flare =
      Math.max(0.08, 0.6 - 0.4 * crouch - 0.5 * working) +
      PLANT_FLARE * (arms * (1 - swing) + gateW);
    return solveLimb(
      shoulders[i],
      hands[i],
      BODY.upperArm,
      BODY.forearm,
      add(bendTo, scale(across, side * flare)),
    );
  }) as [V3, V3];
  // THE POLES: hanging back from the grips, laid back under the arms in a
  // tuck, a lone plant reaching the snow ahead — and, working, planted
  // ahead of the boots on the push and swept back behind him through it,
  // then swung forward in the air for the next.
  const ground = M.ground + drop;
  const poles = [-1, 1].map((side, i) => {
    const hangDir = norm({ x: side * 0.12, y: -Math.cos(POLE_HANG), z: -Math.sin(POLE_HANG) });
    const tuckDir = norm({ x: side * 0.06, y: 0.1, z: -1 });
    const dir = norm(mix(hangDir, tuckDir, crouch));
    const free = add(hands[i], scale(dir, M.pole));
    const planted: V3 = { x: side * 0.4, y: ground, z: M.poleReach * 0.9 };
    let tip = mix(free, planted, lone * (side > 0 ? 1 : 0.35));
    // The fist at another point of a stroke, everything else held.
    const handIn = (st: Stroke, w: number, now: number) => (at: number) => {
      const a = strokeHand(st, now);
      const b = strokeHand(st, at);
      return { x: hands[i].x, y: hands[i].y + w * (b.y - a.y), z: hands[i].z + w * (b.z - a.z) };
    };
    if (gait.stride > 0) {
      const dir = strokePole(
        STRIDE_STROKE.basket,
        side,
        ground,
        stridePhase[i],
        strideDuty,
        handIn(STRIDE_STROKE, gait.stride, strideSwing[i]),
        M.pole,
        undefined,
        hands[i],
      );
      tip = add(hands[i], scale(norm(mix(norm(sub(tip, hands[i])), dir, gait.stride)), M.pole));
    }
    if (arms > 0) {
      // The fist at another point of the push, its shoulder held.
      const now = push ? push.arm[i] : double;
      const handAt = (at: number): V3 => {
        const b = armAt(DOUBLE_ARM, at, true);
        return {
          x: hands[i].x,
          y: hands[i].y + arms * armLength * (b.y - now.y),
          z: hands[i].z + arms * armLength * (b.z - now.z),
        };
      };
      const dir = strokePole(
        DOUBLE_BASKET,
        side,
        ground,
        gait.phase,
        duty,
        handAt,
        M.pole,
        push?.held[i],
        hands[i],
      );
      // A pole pushed on is IN the snow or it is not: half a stroke blended
      // with the hang lifts a planted basket and drags it along.
      // Double-poling, a pole pushed on is IN the snow or it is not: half
      // a stroke blended with the hang lifts a planted basket and drags
      // it. Beside the diagonal stride it is shared by the arms as ever.
      const w = clamp01(2 * arms) + (arms - clamp01(2 * arms)) * clamp01(4 * gait.stride);
      tip = add(hands[i], scale(norm(mix(norm(sub(tip, hands[i])), dir, w)), M.pole));
      // A POLE THE PUSH CANNOT PLANT is held clear of the snow, never
      // skimming along it — the rod tipped up at the fist just enough,
      // its heading kept.
      const shy = POLE_SHY * (1 - gait.keep) * w;
      if (shy > 0) {
        const floor = ground + shy - hands[i].y;
        const d = norm(sub(tip, hands[i]));
        if (d.y * M.pole < floor) {
          const y = Math.max(-1, Math.min(1, floor / M.pole));
          const flat = Math.hypot(d.x, d.z);
          const k = flat > 1e-6 ? Math.sqrt(1 - y * y) / flat : 0;
          tip = add(hands[i], scale({ x: d.x * k, y, z: d.z * k }, M.pole));
        }
      }
    }
    if (ready > 0) {
      // In the gate, planted ahead: the basket on the snow as far ahead of
      // the fist as the rod reaches, the pole leant forward to it.
      const h = hands[i];
      const x = side * GATE.basket;
      const reach = M.pole * M.pole - (h.y - ground) ** 2 - (x - h.x) ** 2;
      const ahead = norm(sub({ x, y: ground, z: h.z + Math.sqrt(Math.max(0, reach)) }, h));
      const w = ready * (1 - arms);
      tip = add(h, scale(norm(mix(norm(sub(tip, h)), ahead, w)), M.pole));
    }
    if (plantAt && plantAt.side === i && plantW > 0) {
      const hang = norm(sub(tip, hands[i]));
      const dir = plantPole(hang, hands[i], ground, side, plantU, M.pole);
      tip = add(hands[i], scale(norm(mix(hang, dir, plantW)), M.pole));
    }
    return F ? flightPole(F, i, hands[i], tip, M.pole) : tip;
  }) as [V3, V3];
  return {
    hips,
    hipJoints,
    waist,
    neck,
    head,
    pitch,
    roll,
    headRoll,
    knees,
    feet,
    boots: [bootOn(0), bootOn(1)],
    shoulders,
    elbows,
    hands,
    poles: bare ? null : poles,
    look,
  };
}
