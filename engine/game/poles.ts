// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DRIVE A SKIER MAKES HIMSELF — the one push that is not gravity. Out of
// the start gate, across the flat at the bottom of a run-out, and out of the
// powder he has stopped in, a skier works for his speed: at a crawl he
// SKATES (the skis opened into a V, a leg pushing off each stride and the
// poles planted with it), and once he is rolling he DOUBLE-POLES (both
// poles planted ahead together and the body folded down over them). At
// speed the arms cannot keep up with the snow and he stands or tucks. What
// the snow makes of the push is the grip's (`skier.ts` applies it along
// the skis); this module owns what a stride is worth.
//
// Off a standstill and up a rise he STRIDES — the diagonal stride, the skis
// parallel and each leg kicking back in turn as the other arm plants —
// before the skis will take a V (`strideShare`).
//
// THE PUSH IS POWER-LIMITED, which is how every human-powered drive behaves:
// the force is the lesser of what a plant can press (`SkiSpec.polePush`)
// and `poles.power` over the way (both the rider's own, `strength`) — so the first strides off a standstill
// are strong and each one after buys less, and a skier on the flat runs up
// to over 40 km/h and no further. Under `poles.speed` it is whole, and it
// is gone by `poles.fade`; `poles.powderShare` of it is left in powder.
//
// THE STRIDE is a cycle (`SkierState.stride`, counted in strides, advanced
// only while he is pushing): the push is ON for `duty` of it — a half-sine
// — with a `floor` of the mean between, and the mean of a whole cycle is
// the power-limited force. The pose reads the same cycle, so a leg is seen
// pushing on the step the snow is pushed.
//
// THE SKATE GOES WHERE THE SKI POINTS. A skater stands on one ski of the
// V at a time and rides it: each push sends his body off along the other
// ski's line, so he travels on a zig-zag — diagonally one way for a
// stride, diagonally the other the next — and never straight up the
// middle of the V. `glideYaw` is that line off his heading, the gliding
// ski's (`skateAngle` of the V's arm, by how much of him is skating,
// `skateWork`), carried across from one arm to the other over the push;
// `skier.ts` grips and pushes along it, and the pose opens the V by the
// same angle, so the ski he stands on points the way he goes.
//
// IT IS AUTOMATIC: a skier going slowly works whatever the thumbs say. What
// stops it is the skid thrown (a skier braking is not also pushing), a jump
// being loaded, the air, and being thrown off his skis — `skier.ts` asks.
//
// HE TURNS BY STEPPING (`stepWork`, `SkierState.step`). A skier at a crawl
// does not wait for his sidecut to bring him round — a ski's arc at a walk
// is fifteen metres and more — he STEPS his skis round: the skate turn
// (skating more to one side: the V turned toward the turn, its inside arm
// opened wide and glided on, the outside ski pushed off and brought in,
// a step turned in each stride) and, slower, the step turn of a walk.
// Each stride turns his heading by `turn.step` (`stepYaw`) on top of what
// the edge carves, the V leads it by `turn.lead`, and the drive is NOT
// taken away for the bend: a skier stepping round a turn is pushing all
// the way through it, which is how he gains speed out of it.
//
// STOOD STILL WITH ONLY A STEER HELD he is going nowhere, and STEPS HIS
// SKIS ROUND ON THE SPOT (`stepRound`, `poles.pivot`, `SkierState.pivot`):
// the inside ski's tip lifted and set down further round off its tail,
// then the outside one brought alongside — a pair at a time, a pair begun
// always finished — on flat skis, until he faces the way he wants. Asked
// to go (the tuck) he skates off and steps round as he goes, above.
//
// WITHOUT POLES (`SkierState.poles` off — the player's hard mode,
// `poles.bare`) the arms have nothing to push on: there is no double pole,
// so he SKATES at every speed the drive reaches, on his legs' share of the
// power (`bare.legs`); and up a rise a push with no basket to brace it
// slips back down the hill (`climbShare`), so a pitch he would skate up on
// his poles he can barely walk.
//
// A drive that is one-way and only ever gentle: nothing here can push a
// skier faster than the fade, and nothing here brakes him.

import { approach, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fromAxisAngle,
  multiply,
  normalize,
  rotate,
  type Vec3,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { riderOf } from "./defs/riders.ts";
import type { Level } from "../mapgen/types.ts";
import type { SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import type { SkierState } from "./state.ts";

const P = TUNING.poles;
const B = P.bare;

/** How much of the push the way leaves, 0..1, whole under `poles.speed`:
 * THE SKATE'S gone by `poles.skateFade` — the legs cannot keep up with
 * skis running on that fast — and THE DOUBLE POLE'S by `poles.fade`, eased
 * (little of it lost at first, the last going quickly), and sooner once
 * his arms at their quickest cannot keep up with the snow (`poleKeepUp`):
 * he stops working them and tucks. Blended by how much of him is skating
 * (`skateShare`) — so a skier with no `poles` skates to the skate's fade,
 * and a step turn is a crawl's.  */
export function driveReach(way: number, poles = true, step = 0): number {
  const w = Math.abs(way);
  const skate = skateShare(way, poles, step);
  const legs = 1 - clamp((w - P.speed) / (P.skateFade - P.speed), 0, 1);
  const k = clamp((w - P.speed) / (P.fade - P.speed), 0, 1);
  const arms = (1 - k * k * k) * poleKeepUp(way, step);
  return skate * legs + (1 - skate) * arms;
}

/** THE HILL TAKES OVER, 0..1: the share of his work a skier keeps up on
 * a pitch whose pull along his skis is `along` m/s² (downhill positive),
 * when his poles would add `push` m/s² at the speed he is going
 * (`driveForce` over his mass). Whole on the flat and up a rise; given up
 * from `hill.from` times what the poles add and gone by `hill.to` times —
 * the snow is carrying him faster than his arms can, so he tucks. */
export function slopeShare(along: number, push: number): number {
  if (along <= 0) return 1;
  const H = P.hill;
  const r = along / Math.max(1e-6, push);
  const k = clamp((r - H.from) / (H.to - H.from), 0, 1);
  return 1 - k * k * (3 - 2 * k);
}

/** THE HILL'S PULL along the way he is going, m/s² (downhill positive),
 * for `slopeShare`: read off the ground over `hill.span` m about him, not
 * off his skis' pitch — a skier judges the hill, and the up-face of a
 * roller is no reason to start poling. */
export function hillPull(level: Level, x: number, z: number, heading: number, way: number): number {
  const s = (way < 0 ? -P.hill.span : P.hill.span) / 2;
  const dx = Math.sin(heading) * s;
  const dz = Math.cos(heading) * s;
  const grade = (level.groundAt(x - dx, z - dz) - level.groundAt(x + dx, z + dz)) / Math.abs(2 * s);
  return (TUNING.g * grade) / Math.sqrt(1 + grade * grade);
}

/** HOW FOLDED A DOUBLE-POLER IS on the mean, as a crouch 0..1 (`poles.fold`):
 * the share of him double-poling — working, within the drive's reach, and
 * not skating — times the fold a stroke averages. What the air meets
 * (`air.ts`). */
export function poleFold(c: SkierState): number {
  if (c.drive <= 0) return 0;
  const pole = 1 - skateShare(c.speed, c.poles, c.step);
  return P.fold * c.drive * driveReach(c.speed, c.poles, c.step) * pole;
}

/** The share of the drive that is SKATING rather than double-poling at a
 * way of `way` m/s, 0..1 — all of it with no `poles` to double-pole on,
 * and, stepping round a turn (`step`, −1..1, `SkierState.step`), as much
 * of it as the turn: a double pole's skis stay together and turn nothing,
 * so a skier on his poles skates through a bend, as a racer does out of
 * the gate. */
export function skateShare(way: number, poles = true, step = 0): number {
  if (!poles) return 1;
  const pole = clamp((Math.abs(way) - P.skateFrom) / (P.skateTo - P.skateFrom), 0, 1);
  return 1 - pole * (1 - Math.min(1, Math.abs(step)));
}

/** THE CLIMB WITHOUT POLES, 0..1: the share of a push left up a rise of
 * `pitch` rad (the pair's own, tips up positive — `SkierState.pitch`). On
 * his poles a skier braces every push and climbs whatever he can skate;
 * with none, the ski he pushes off slips back from `bare.climb.from` and
 * holds only `least` of it by `to`. Whole with `poles`, and on the flat. */
export function climbShare(pitch: number, poles = true): number {
  if (poles) return 1;
  const C = B.climb;
  return 1 - (1 - C.least) * clamp((pitch - C.from) / (C.to - C.from), 0, 1);
}

/** The share of the drive that is the DIAGONAL STRIDE (the skis parallel,
 * the legs kicking alternately, the arms opposite) at `speed` m/s, 0..1 —
 * the rest is the skate's and the double pole's (`skateShare`). */
export function strideShare(speed: number): number {
  return 1 - clamp((Math.abs(speed) - P.strideFrom) / (P.strideTo - P.strideFrom), 0, 1);
}

/** THE SKATE'S V: each ski's angle off his line, rad, at `speed` m/s —
 * wide at a crawl, where a push must go out to the side to go anywhere,
 * and closing as he rolls (`poles.vee`). */
export function skateAngle(speed: number): number {
  const k = clamp((Math.abs(speed) - P.strideFrom) / (P.skateTo - P.strideFrom), 0, 1);
  return P.vee.slow + (P.vee.fast - P.vee.slow) * k;
}

/** HOW MUCH OF HIM IS SKATING, 0..1, working at `drive` (`SkierState.drive`)
 * at `speed` m/s: the drive eased in over its upper half (`poles.skateDrive`)
 * — a skater commits to a stride or he does not, and a skier half working
 * under a held brake or on an edge does not step his skis into a V — over
 * the share of the push the speed leaves (`driveReach`), less the walk's
 * diagonal stride and the double pole. */
export function skateWork(drive: number, speed: number, poles = true, step = 0): number {
  const d = clamp((drive - P.skateDrive) / (1 - P.skateDrive), 0, 1);
  const work = d * d * (3 - 2 * d) * clamp(2 * driveReach(speed, poles, step), 0, 1);
  return work * (1 - strideShare(speed)) * skateShare(speed, poles, step);
}

/** HOW MUCH OF HIM CAN STEP HIS SKIS ROUND A TURN, 0..1, working at
 * `drive` at `speed` m/s: all of the drive the speed leaves him, eased in
 * over its upper half as the skate is (`skateWork`) — a skier walking
 * steps his skis round, a skater skates more to one side, and one on his
 * poles goes over to the skate for the turn (`skateShare`'s `step`). What
 * a turn at a crawl can be stepped by. */
export function stepWork(drive: number, speed: number, poles = true): number {
  const d = clamp((drive - P.skateDrive) / (1 - P.skateDrive), 0, 1);
  return d * d * (3 - 2 * d) * clamp(2 * driveReach(speed, poles, 1), 0, 1);
}

/** THE STEP TURN'S RATE, rad/s, clockwise positive, for a step turn of
 * `step` (`SkierState.step`, −1..1) made at `drive` at `way` m/s: a
 * stride's turn (`turn.step`) at the strides he takes a second, quickened
 * (`stepQuick`). */
export function stepYaw(step: number, drive: number, way: number, poles = true): number {
  return step * P.turn.step * strideRate(way, poles, step) * stepQuick(step, way) * drive;
}

/** How much quicker his strides come stepping round a turn of `step`
 * (−1..1) at `way` m/s: at a walk a step turn is short quick steps, not a
 * skater's long glide — and rolling, a skater turns on his own cadence
 * (whole under `strideTo`, gone by `skateFrom`). */
export function stepQuick(step: number, way: number): number {
  const walk = 1 - clamp((Math.abs(way) - P.strideTo) / (P.skateFrom - P.strideTo), 0, 1);
  return 1 + P.turn.quick * Math.abs(step) * walk;
}

/** THE LINE HE GLIDES ON, rad off his heading (clockwise positive), at
 * stride `stride` (counted) and `speed` m/s, `skate` of him skating
 * (`skateWork`): the gliding ski's arm of the V — the right ski's while
 * the left leg pushes, the left's while the right does — reached over the
 * push from the arm he glided on before, eased at both ends, and held
 * through the glide; and, stepping round a turn (`step`, −1..1), the whole
 * V turned toward it by `turn.lead` — its inside arm opened wide, its
 * outside one closed: skating more to one side. */
export function glideYaw(stride: number, speed: number, skate: number, step = 0): number {
  const lead = step * P.turn.lead;
  if (skate <= 0) return lead;
  const p = stride - Math.floor(stride);
  const side = Math.floor(stride) % 2 === 0 ? 1 : -1;
  const k = clamp(p / P.duty, 0, 1);
  const across = k * k * (3 - 2 * k);
  return side * skateAngle(speed) * skate * (2 * across - 1) + lead;
}

/** The most of one push a planted pole can sweep, m — the skate's at a
 * crawl, the double pole's once rolling. */
export function poleSweep(way: number, step = 0): number {
  const k = skateShare(way, true, step);
  return P.sweepSkate * k + P.sweep * (1 - k);
}

/** Strides a second at a way. THE SKATE is a leg's push and a long glide
 * on the other ski, at a skater's own unhurried cadence (`poles.cadence`),
 * quickening only toward his top speed — the faster he goes, the further
 * each glide carries him, and the shorter the poles' bite in it
 * (`poleDuty`). THE
 * DOUBLE POLE keeps a planted pole PLANTED: a basket in the snow stays
 * where it bit while he goes by it, so a push lasts only as long as the
 * snow takes to pass under one sweep of the pole (`poleSweep`), and the
 * faster he goes the quicker and harder he works his arms — from
 * `poles.cadencePole` up to the quickest an arm swings
 * (`poles.cadenceMax`). Blended between by `skateShare`; with no `poles`,
 * the skate's alone. */
export function strideRate(way: number, poles = true, step = 0, hill = 0): number {
  const k = skateShare(way, poles, step);
  const pinned = (Math.abs(way) * P.duty) / P.sweep;
  const pole = clamp(pinned, P.cadencePole, P.cadenceMax);
  return skateCadence(way, hill) * k + pole * (1 - k);
}

/** THE SKATE'S CADENCE, strides a second, at `way` m/s (`poles.cadence`):
 * slow and long at a crawl, quickening toward his top speed — and, up a
 * rise whose pull along his way is `hill` m/s² (downhill positive,
 * `SkierState.hill`), quicker still as the climb cuts the glide short
 * (`poles.climb`). The flat's cadence down a pitch: the hill there is the
 * tuck's business, not a longer glide's. */
export function skateCadence(way: number, hill = 0): number {
  const C = P.cadence;
  const flat = C.slow + (C.fast - C.slow) * clamp((Math.abs(way) - C.from) / (C.to - C.from), 0, 1);
  if (hill >= 0) return flat;
  const slows = glideSlowing(way);
  const glide = (1 - P.duty) / flat;
  const push = P.duty / flat;
  const climbing = 1 / (push + (glide * slows) / (slows - hill));
  return Math.max(flat, Math.min(P.climb.most, climbing));
}

/** How quickly a gliding ski slows ON THE FLAT at `way` m/s, m/s²: the
 * base's rolling resistance and the air's drag on a skier stood up
 * (`poles.climb`). */
export function glideSlowing(way: number): number {
  const G = P.climb;
  return TUNING.snow.crrPacked * TUNING.g + (0.5 * TUNING.airDensity * G.area * way * way) / G.mass;
}

/** THE LEG'S PUSH'S SHARE OF A SKATING STRIDE, 0..1, at `way` m/s up a
 * pull of `hill` m/s²: `poles.duty` on the flat; up a rise the push keeps
 * its time while the glide shortens, so it fills more of each stride —
 * to `climb.duty`. */
export function skateDuty(way: number, hill = 0): number {
  if (hill >= 0) return P.duty;
  const flat = skateCadence(way, 0);
  return Math.min(P.climb.duty, (P.duty * skateCadence(way, hill)) / flat);
}

/** THE POLES' SHARE OF A STRIDE on the snow, 0..1, at `way` m/s: the
 * double pole's whole push (`poles.duty`); skating, no longer than the
 * snow takes to pass under one sweep of the pole at the skate's cadence
 * — a quick bite inside the leg's long push — and never less than
 * `poles.dutyLeast`. What the arms are posed on. */
export function poleDuty(way: number, step = 0, hill = 0): number {
  const k = skateShare(way, true, step);
  const bite = (P.sweepSkate * skateCadence(way, hill)) / Math.max(1e-6, Math.abs(way));
  const skate = clamp(bite, P.dutyLeast, skateDuty(way, hill));
  return skate * k + doublePoleDuty(way) * (1 - k);
}

/** THE DOUBLE POLE'S SHARE OF A STROKE on the snow, 0..1, at `way` m/s:
 * the whole push (`poles.duty`) while his arms can keep a planted basket
 * where it bit, SHORTENING once his cadence is at its quickest
 * (`cadenceMax`) — the push lasting only as long as the snow takes to pass
 * under one sweep of the pole — to `poles.jab`. Measured, a
 * double-poler's poling time falls from some 0.3 s to 0.2 s as he drives
 * his cadence up: a quick hard jab, then a long recovery. */
export function doublePoleDuty(way: number): number {
  const w = Math.max(1e-6, Math.abs(way));
  const rate = clamp((w * P.duty) / P.sweep, P.cadencePole, P.cadenceMax);
  return clamp((P.sweep * rate) / w, P.jab, P.duty);
}

/** THE PUSH'S SHARE OF A STRIDE, 0..1, at `way` m/s: the skating leg's long
 * push (`poles.duty`) by the share of him skating, the double pole's jab
 * (`doublePoleDuty`) by the rest — what the force is shaped over
 * (`strideShape`). */
export function pushDuty(way: number, poles = true, step = 0, hill = 0): number {
  const k = skateShare(way, poles, step);
  return skateDuty(way, hill) * k + doublePoleDuty(way) * (1 - k);
}

/** How well a push keeps up with the snow at `way` m/s, 0..1: whole while
 * one push sweeps all the snow that passes under it in the poles' bite
 * (`poleDuty`), gone once his arms at their quickest cannot keep up —
 * where a skier stops working the poles and folds into the tuck instead. */
export function poleKeepUp(way: number, step = 0): number {
  const fit =
    (poleSweep(way, step) * strideRate(way, true, step)) /
    Math.max(1e-6, Math.abs(way) * poleDuty(way, step));
  return clamp((fit - P.keepUp.to) / (P.keepUp.from - P.keepUp.to), 0, 1);
}

/** The shape of a push over one stride at phase 0..1: a half-sine over the
 * first `duty` of it (`pushDuty`; `poles.duty` unless told) on a `floor`, its mean over the whole cycle 1. */
export function strideShape(phase: number, duty: number = P.duty): number {
  const p = phase - Math.floor(phase);
  const peak = Math.PI / (2 * duty);
  const on = p < duty ? peak * Math.sin((Math.PI * p) / duty) : 0;
  return P.floor + (1 - P.floor) * on;
}

/** The plants' pulse at stride `stride` (strides counted), 0..1 — the
 * pole in the snow for the push, out of it for the recovery. What the
 * pose and the audio read. */
export function plantPulse(stride: number, duty: number = P.duty): number {
  const p = stride - Math.floor(stride);
  return p < duty ? Math.sin((Math.PI * p) / duty) : 0;
}

/** The MEAN force the skier drives himself with along the skis, N, at
 * `way` m/s on snow `packed` 0..1, working at `effort` 0..1 — with no
 * `poles`, his legs' share of the power and of the press (`bare.legs`). */
export function driveForce(
  spec: SkiSpec,
  way: number,
  packed: number,
  effort: number,
  poles = true,
  step = 0,
): number {
  if (effort <= 0) return 0;
  const reach = driveReach(way, poles, step);
  if (reach <= 0) return 0;
  const legs = poles ? 1 : B.legs;
  // The rider's own push (`RiderSpec.strength`) is in the plant and the
  // power alike — `polePush` already carries it.
  const power = P.power * riderOf(spec).strength;
  const force = legs * Math.min(spec.polePush, power / Math.max(0.5, Math.abs(way)));
  const snow = packed + (1 - packed) * P.powderShare;
  return force * reach * snow * effort;
}

/** The force the drive pushes with THIS STEP along the skis, N: the mean
 * shaped by the stride's phase — up a pull of `hill` m/s² (downhill
 * positive), a longer push in a shorter stride (`skateDuty`). */
export function poleForce(
  spec: SkiSpec,
  way: number,
  packed: number,
  effort: number,
  stride: number,
  poles = true,
  step = 0,
  hill = 0,
): number {
  return (
    driveForce(spec, way, packed, effort, poles, step) *
    strideShape(stride, pushDuty(way, poles, step, hill))
  );
}

/** ONE STEP OF HIS STRIDES, for a skier working at `c.drive` at `speed`
 * m/s over `dt` s: the stride counted on (`SkierState.stride`), the step
 * turn taken up or let go (`SkierState.step`), the line he glides on
 * (`SkierState.glide`) — and his way turned with that line and with the
 * step he turns, by the leg, its speed kept. Returns the step turn's rate,
 * rad/s, clockwise positive: what `skier.ts` asks of the yaw on top of the
 * carve. */
export function strideOn(c: SkierState, speed: number, dt: number): number {
  // Read off the SPEED, not the way: a skier sliding sideways at 80 km/h has
  // no way along his skis and no business pushing on them.
  if (c.drive > 0 && driveReach(speed, c.poles, c.step) > 0) {
    c.stride +=
      strideRate(speed, c.poles, c.step, c.hill) * stepQuick(c.step, speed) * c.drive * dt;
  }
  // STEPPING ROUND A TURN: the steer key over the share of him that can
  // step, taken up and let go over a stride or so. A board ridden FAKIE
  // steps round the way he goes: the steer `switch.ts` mirrors for the
  // carve (whose ask is the signed way) mirrored back, since a step turns
  // the board and its tail with it.
  const board = c.spec.board !== undefined;
  const side = board && c.switched ? -c.steer : c.steer;
  c.step = approach(c.step, side * stepWork(c.drive, speed, c.poles), P.turn.rate * dt);
  // SKATING, he rides the gliding ski's line: the snow grips him along it
  // and the push drives him along it — and the push's SIDEWAYS share is
  // what carries his way from one arm of the V to the other, so the way is
  // turned with the line, its speed kept: the leg pays for the turn, the
  // snow is not asked to scrub it out of him. Each stride's step turned
  // likewise.
  // A BOARD is one deck under both feet: it runs on its own line, and no
  // stride lays it onto another arm of a V.
  const glide0 = c.glide;
  c.glide = board
    ? 0
    : glideYaw(c.stride, speed, skateWork(c.drive, speed, c.poles, c.step), c.step);
  const onSnow = !c.airborne && c.thrown === null;
  const stepped = onSnow ? stepYaw(c.step, c.drive, speed, c.poles) : 0;
  if (onSnow && (c.glide !== glide0 || stepped !== 0)) {
    const turn = c.glide - glide0 + stepped * dt;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const vx = c.vx;
    c.vx = vx * cos + c.vz * sin;
    c.vz = c.vz * cos - vx * sin;
  }
  return stepped;
}

/** The speed, m/s, under which a skier is STOOD STILL — `skier.ts`'s own
 * threshold for setting off — and the drive under which he is not
 * working. */
const STILL_SPEED = 0.4;
export const STILL_DRIVE = 0.02;
/** The steer, of full, that steps a skier stood still round on the spot. */
const PIVOT_STEER = 0.3;

/** STOOD STILL, at `speed` m/s: not asked to go (the tuck), not working,
 * braking, loading a jump, in the air or thrown. A steer here steps him
 * round on the spot (`stepRound`) and stands his skis on no edge. */
export function stoodStill(c: SkierState, speed: number): boolean {
  return (
    speed <= STILL_SPEED &&
    c.tuck <= 0.05 &&
    c.drive < STILL_DRIVE &&
    c.brake < 0.05 &&
    c.jumpLoad === 0 &&
    !c.airborne &&
    c.thrown === null
  );
}

/** HOW FAR ROUND EACH SKI HAS BEEN STEPPED over a pair of steps on the
 * spot, at its phase `u` 0..1 (`stepRound`), as shares of the step's
 * angle: the INSIDE ski's tip lifted and set down round over the first
 * part, the OUTSIDE ski brought alongside it over the second, each eased
 * at both ends — and the body, which stands between them, half of each. */
export function pivotSteps(u: number): { inside: number; outside: number; body: number } {
  const ease = (a: number, b: number): number => {
    const k = clamp((u - a) / (b - a), 0, 1);
    return k * k * (3 - 2 * k);
  };
  const inside = ease(0, 0.45);
  const outside = ease(0.5, 0.95);
  return { inside, outside, body: (inside + outside) / 2 };
}

/** THE STEP TURN ON THE SPOT, this step (`poles.pivot`): a skier stood
 * still (`still`, `stoodStill`) with a steer held steps his skis round a
 * pair at a time, the inside one first — `SkierState.pivot` ±1 the way he
 * steps, the stride's phase where in the pair he is (the pose reads both)
 * — and a pair begun is finished the way it was begun, whatever the thumb
 * does meanwhile; let go, or set off, he stands with his skis together.
 * His body, which stands between his skis, is turned about the snow's
 * normal `n` (and the little way he has with it). */
export function stepRound(c: SkierState, n: Vec3, still: boolean, dt: number): void {
  const mid = c.pivot !== 0 && c.stride - Math.floor(c.stride) > 1e-6;
  if (!still || (!mid && Math.abs(c.steer) <= PIVOT_STEER)) {
    // Off the spot, a pair half taken is set down together.
    if (mid) c.stride = Math.round(c.stride);
    c.pivot = 0;
    return;
  }
  if (!mid) {
    // A pair is begun from the skis together, the way the steer asks.
    c.stride = Math.ceil(c.stride - 1e-6);
    c.pivot = Math.sign(c.steer);
  }
  const u0 = c.stride - Math.floor(c.stride);
  // The pair ends with the skis together: never carried past it.
  const end = Math.floor(c.stride) + 1;
  c.stride = Math.min(c.stride + P.pivot.steps * dt, end);
  const u1 = c.stride >= end ? 1 : c.stride - Math.floor(c.stride);
  const yaw = c.pivot * P.pivot.angle * (pivotSteps(u1).body - pivotSteps(u0).body);
  const turn = fromAxisAngle(n.x, n.y, n.z, yaw);
  c.q = normalize(multiply(turn, c.q));
  const v = rotate(turn, { x: c.vx, y: c.vy, z: c.vz });
  c.vx = v.x;
  c.vy = v.y;
  c.vz = v.z;
}
