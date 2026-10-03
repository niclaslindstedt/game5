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
// and `poles.power` over the way — so the first strides off a standstill
// are strong and each one after buys less, and a skier on the flat runs up
// to about 25 km/h and no further. Under `poles.speed` it is whole, and it
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
// WITHOUT POLES (`SkierState.poles` off — the player's hard mode,
// `poles.bare`) the arms have nothing to push on: there is no double pole,
// so he SKATES at every speed the drive reaches, on his legs' share of the
// power (`bare.legs`); and up a rise a push with no basket to brace it
// slips back down the hill (`climbShare`), so a pitch he would skate up on
// his poles he can barely walk.
//
// A drive that is one-way and only ever gentle: nothing here can push a
// skier faster than the fade, and nothing here brakes him.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";

const P = TUNING.poles;
const B = P.bare;

/** How much of the push the way leaves, 0..1: whole under `poles.speed`,
 * gone by `poles.fade` — and the poles' share of it gone sooner, once his
 * arms cannot keep up with the snow (`poleKeepUp`): he stops working them
 * and tucks. A skier with no `poles` skates all the way to the fade. */
export function driveReach(way: number, poles = true): number {
  const fade = 1 - clamp((Math.abs(way) - P.speed) / (P.fade - P.speed), 0, 1);
  return fade * (1 - (1 - skateShare(way, poles)) * (1 - poleKeepUp(way)));
}

/** The share of the drive that is SKATING rather than double-poling at a
 * way of `way` m/s, 0..1 — all of it with no `poles` to double-pole on. */
export function skateShare(way: number, poles = true): number {
  if (!poles) return 1;
  return 1 - clamp((Math.abs(way) - P.skateFrom) / (P.skateTo - P.skateFrom), 0, 1);
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
export function skateWork(drive: number, speed: number, poles = true): number {
  const d = clamp((drive - P.skateDrive) / (1 - P.skateDrive), 0, 1);
  const work = d * d * (3 - 2 * d) * clamp(2 * driveReach(speed, poles), 0, 1);
  return work * (1 - strideShare(speed)) * skateShare(speed, poles);
}

/** THE LINE HE GLIDES ON, rad off his heading (clockwise positive), at
 * stride `stride` (counted) and `speed` m/s, `skate` of him skating
 * (`skateWork`): the gliding ski's arm of the V — the right ski's while
 * the left leg pushes, the left's while the right does — reached over the
 * push from the arm he glided on before, eased at both ends, and held
 * through the glide. */
export function glideYaw(stride: number, speed: number, skate: number): number {
  if (skate <= 0) return 0;
  const p = stride - Math.floor(stride);
  const side = Math.floor(stride) % 2 === 0 ? 1 : -1;
  const k = clamp(p / P.duty, 0, 1);
  const across = k * k * (3 - 2 * k);
  return side * skateAngle(speed) * skate * (2 * across - 1);
}

/** The most of one push a planted pole can sweep, m — the skate's at a
 * crawl, the double pole's once rolling. */
export function poleSweep(way: number): number {
  const k = skateShare(way);
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
export function strideRate(way: number, poles = true): number {
  const k = skateShare(way, poles);
  const pinned = (Math.abs(way) * P.duty) / P.sweep;
  const pole = clamp(pinned, P.cadencePole, P.cadenceMax);
  return skateCadence(way) * k + pole * (1 - k);
}

/** THE SKATE'S CADENCE, strides a second, at `way` m/s (`poles.cadence`):
 * slow and long at a crawl, quickening toward his top speed. */
function skateCadence(way: number): number {
  const C = P.cadence;
  return C.slow + (C.fast - C.slow) * clamp((Math.abs(way) - C.from) / (C.to - C.from), 0, 1);
}

/** THE POLES' SHARE OF A STRIDE on the snow, 0..1, at `way` m/s: the
 * double pole's whole push (`poles.duty`); skating, no longer than the
 * snow takes to pass under one sweep of the pole at the skate's cadence
 * — a quick bite inside the leg's long push — and never less than
 * `poles.dutyLeast`. What the arms are posed on. */
export function poleDuty(way: number): number {
  const k = skateShare(way);
  const bite = (P.sweepSkate * skateCadence(way)) / Math.max(1e-6, Math.abs(way));
  const skate = clamp(bite, P.dutyLeast, P.duty);
  return skate * k + P.duty * (1 - k);
}

/** How well a push keeps up with the snow at `way` m/s, 0..1: whole while
 * one push sweeps all the snow that passes under it in the poles' bite
 * (`poleDuty`), gone once his arms at their quickest cannot keep up —
 * where a skier stops working the poles and folds into the tuck instead. */
export function poleKeepUp(way: number): number {
  const fit = (poleSweep(way) * strideRate(way)) / Math.max(1e-6, Math.abs(way) * poleDuty(way));
  return clamp((fit - P.keepUp.to) / (P.keepUp.from - P.keepUp.to), 0, 1);
}

/** The shape of a push over one stride at phase 0..1: a half-sine over the
 * first `duty` of it on a `floor`, its mean over the whole cycle 1. */
export function strideShape(phase: number): number {
  const p = phase - Math.floor(phase);
  const peak = Math.PI / (2 * P.duty);
  const on = p < P.duty ? peak * Math.sin((Math.PI * p) / P.duty) : 0;
  return P.floor + (1 - P.floor) * on;
}

/** The plants' pulse at stride `stride` (strides counted), 0..1 — the
 * pole in the snow for the push, out of it for the recovery. What the
 * pose and the audio read. */
export function plantPulse(stride: number): number {
  const p = stride - Math.floor(stride);
  return p < P.duty ? Math.sin((Math.PI * p) / P.duty) : 0;
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
): number {
  if (effort <= 0) return 0;
  const reach = driveReach(way, poles);
  if (reach <= 0) return 0;
  const legs = poles ? 1 : B.legs;
  const force = legs * Math.min(spec.polePush, P.power / Math.max(0.5, Math.abs(way)));
  const snow = packed + (1 - packed) * P.powderShare;
  return force * reach * snow * effort;
}

/** The force the drive pushes with THIS STEP along the skis, N: the mean
 * shaped by the stride's phase. */
export function poleForce(
  spec: SkiSpec,
  way: number,
  packed: number,
  effort: number,
  stride: number,
  poles = true,
): number {
  return driveForce(spec, way, packed, effort, poles) * strideShape(stride);
}
