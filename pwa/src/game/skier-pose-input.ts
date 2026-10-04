// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE POSE IS HANDED — every reading `skierPose` (`skier-pose.ts`)
// stands the skier up from, one frame's worth: the engine's own fields as
// the view carries them (`skis-body.ts`'s `poseInputOf`), or a moment a lab
// or the crowd poses by hand. Three-free.

import type { TrickPose } from "@engine";

import type { Gait } from "./skier-gait.ts";
import type { GateShape } from "./slalom-start.ts";
import type { Jolt } from "./skier-save.ts";
import type { FlightShape } from "./skier-flight.ts";
import type { Mounts } from "./skier-mounts.ts";
import type { GateBlock, TechniquePose } from "./technique-pose.ts";

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
  /** ...and that gate a slalom's start house: the slalom start clip's
   * shape this frame (`slalom-start.ts`). */
  house?: GateShape;
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
  /** THE TECHNIQUE he carries himself by (`technique-pose.ts`): his upper
   * body, hands and poles, legs, transitions and tuck — the free skier's
   * when left out, which is the pose with no row at all. */
  style?: TechniquePose;
  /** THE BLOCK he is making at a pole gate's turning pole (`gateBlock`),
   * or none. */
  block?: GateBlock;
  /** How far he has been edging lately, rad (`SkierSpring.swing`) — what
   * tells an edge change from a straight run; none when left out. */
  swing?: number;
  mounts?: Mounts;
};
