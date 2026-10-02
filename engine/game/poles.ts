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
// IT IS AUTOMATIC: a skier going slowly works whatever the thumbs say. What
// stops it is the skid thrown (a skier braking is not also pushing), a jump
// being loaded, the air, and being thrown off his skis — `skier.ts` asks.
//
// A drive that is one-way and only ever gentle: nothing here can push a
// skier faster than the fade, and nothing here brakes him.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";

const P = TUNING.poles;

/** How much of the push the way leaves, 0..1: whole under `poles.speed`,
 * gone by `poles.fade` — and the poles' share of it gone sooner, once his
 * arms cannot keep up with the snow (`poleKeepUp`): he stops working them
 * and tucks. */
export function driveReach(way: number): number {
  const fade = 1 - clamp((Math.abs(way) - P.speed) / (P.fade - P.speed), 0, 1);
  return fade * (1 - (1 - skateShare(way)) * (1 - poleKeepUp(way)));
}

/** The share of the drive that is SKATING rather than double-poling at a
 * way of `way` m/s, 0..1. */
export function skateShare(way: number): number {
  return 1 - clamp((Math.abs(way) - P.skateFrom) / (P.skateTo - P.skateFrom), 0, 1);
}

/** The share of the drive that is the DIAGONAL STRIDE (the skis parallel,
 * the legs kicking alternately, the arms opposite) at `speed` m/s, 0..1 —
 * the rest is the skate's and the double pole's (`skateShare`). */
export function strideShare(speed: number): number {
  return 1 - clamp((Math.abs(speed) - P.strideFrom) / (P.strideTo - P.strideFrom), 0, 1);
}

/** The most of one push a planted pole can sweep, m — the skate's at a
 * crawl, the double pole's once rolling. */
export function poleSweep(way: number): number {
  const k = skateShare(way);
  return P.sweepSkate * k + P.sweep * (1 - k);
}

/** Strides a second at a way — the skate's cadence at a crawl, the double
 * pole's once rolling — and, faster, the cadence that keeps a planted pole
 * PLANTED: a basket in the snow stays where it bit while he goes by it, so
 * a push lasts only as long as the snow takes to pass under one sweep of
 * the pole (`poleSweep`). The faster he goes the quicker and harder he
 * works his arms, up to the quickest an arm swings (`poles.cadenceMax`). */
export function strideRate(way: number): number {
  const k = skateShare(way);
  const cadence = P.cadence * k + P.cadencePole * (1 - k);
  return Math.min(
    Math.max(cadence, P.cadenceMax),
    Math.max(cadence, (Math.abs(way) * P.duty) / poleSweep(way)),
  );
}

/** How well a push keeps up with the snow at `way` m/s, 0..1: whole while
 * one push sweeps all the snow that passes under it, gone once his arms at
 * their quickest cannot keep up — where a skier stops working the poles
 * and folds into the tuck instead. */
export function poleKeepUp(way: number): number {
  const fit = (poleSweep(way) * strideRate(way)) / Math.max(1e-6, Math.abs(way) * P.duty);
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
 * `way` m/s on snow `packed` 0..1, working at `effort` 0..1. */
export function driveForce(spec: SkiSpec, way: number, packed: number, effort: number): number {
  if (effort <= 0) return 0;
  const reach = driveReach(way);
  if (reach <= 0) return 0;
  const force = Math.min(spec.polePush, P.power / Math.max(0.5, Math.abs(way)));
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
): number {
  return driveForce(spec, way, packed, effort) * strideShape(stride);
}
