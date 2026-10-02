// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GAIT — how the skier works for his speed at a crawl, off the
// engine's own drive (`poles.ts`): the diagonal stride up a rise, the
// skate's V and the double pole, and what each does to each ski as drawn. One statement
// the skis (`ski-gear.ts`, `ski-rig.ts`) and the figure (`skier-pose.ts`)
// both read, so a boot never leaves its ski. Three-free.

import {
  TUNING,
  driveReach,
  poleKeepUp,
  skateShare,
  strideRate,
  strideShare,
  type SkierState,
} from "@engine";

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const smooth01 = (v: number): number => {
  const k = clamp01(v);
  return k * k * (3 - 2 * k);
};

/** THE GAIT: how the skier is working for his speed this frame, off the
 * engine's own `drive` and `stride` (`poles.ts`), and what it does to each
 * ski as drawn — the one statement the skis (`ski-gear.ts`, `ski-rig.ts`)
 * and the figure both read, so a boot never leaves its ski. */
export type Gait = {
  /** How much of him is striding (the diagonal stride), skating, and
   * double-poling, 0..1 each. */
  stride: number;
  skate: number;
  pole: number;
  /** Where in the stride he is, 0..1, and which leg is pushing (0 left). */
  phase: number;
  push: 0 | 1;
  /** Each ski's turn off the line, rad (clockwise positive — the V opens
   * the left ski anticlockwise), how far out it has been pushed, m, and how
   * far up it has been lifted for the recovery, m. */
  splay: [number, number];
  out: [number, number];
  lift: [number, number];
  /** Each ski slid forward (+) or back along its line, m — the stride's
   * kick and glide. */
  fore: [number, number];
  /** Each ski tipped onto an edge of its own on top of the pair's, rad,
   * right edges down positive — the skate's pushing ski on its INSIDE
   * edge, which is what it pushes off. */
  tilt: [number, number];
  /** How far he goes over the snow in one stride, m — what a planted
   * basket is left behind by over a push (`pinnedSwing`); 0 standing —
   * and how much he works the poles on it, 0..1: all of it while one push
   * sweeps the snow going by under it, none once his arms at their
   * quickest (`poleKeepUp`) or folded into the tuck, which shortens the
   * stroke, cannot keep up — he stops poling rather than swing the poles
   * over the snow. */
  pass: number;
  keep: number;
};

/** What one push of the poles sweeps from the plant to the release, m —
 * double-poling and skating — and the share of it a full tuck takes off
 * (the pose's own strokes, measured). */
const POLE_SWEEP = { pole: 1.55, skate: 1.19, tuck: 0.75 };

/** The skate's V, each ski off the line, rad; how far out a push takes the
 * ski, m, and how far behind him it finishes, m — the body glides on past
 * a foot pushed out sideways, so the push ends out AND back; how high the
 * recovery lifts it, m; and how far the pushing ski is rolled onto its
 * inside edge at the end of the push, rad — a flat ski has nothing to push
 * off, and a skater's push is a leg driven out along a ski on its edge
 * while he glides on the other, flat. */
const SKATE = { splay: 0.3, out: 0.26, back: 0.22, lift: 0.09, edge: 0.45 };
/** THE DIAGONAL STRIDE: how far the kicking ski slides back and the
 * gliding one forward, m, and how high the kick comes off the snow. */
const STRIDE = { back: 0.3, ahead: 0.24, kick: 0.04 };
/** THE STRIDE IS FOR CLIMBING: the pair's pitch up a rise, rad, past
 * which a skier at a walk strides, and the span over which he takes it
 * up. On the flat and down a pitch he sets off on his POLES — the push a
 * racer makes out of the gate — because a diagonal stride there is a man
 * walking on skis, upright with the poles trailing. */
const CLIMB = { from: 0.03, span: 0.05 };

export const STILL_GAIT: Gait = {
  stride: 0,
  skate: 0,
  pole: 0,
  phase: 0,
  push: 0,
  splay: [0, 0],
  out: [0, 0],
  lift: [0, 0],
  fore: [0, 0],
  tilt: [0, 0],
  pass: 0,
  keep: 1,
};

export function gaitOf(
  s: Pick<SkierState, "drive" | "stride" | "speed" | "airborne" | "thrown" | "pitch"> & {
    way?: number;
    crouch?: number;
  },
): Gait {
  if (s.airborne || s.thrown || s.drive <= 0.01) return STILL_GAIT;
  // THE MOTION IS WHOLE while he works at all: the push fades with speed
  // (`driveReach`), but a skier pushing at all makes a whole stride of it —
  // a stride drawn at half size reads as a twitch. It comes in over the
  // drive's own rise, eased, so the arms come up from their hang (or out
  // of the start gate) into the stroke as a motion — even a stroke the
  // engine's stride count starts halfway through.
  const d = clamp01(s.drive);
  const work = d * d * (3 - 2 * d) * clamp01(2 * driveReach(s.speed));
  if (work <= 0.01) return STILL_GAIT;
  // At a walk he strides up a rise and double-poles everywhere else; the
  // skate takes over from either as he rolls.
  const walk = strideShare(s.speed);
  const climb = clamp01((s.pitch - CLIMB.from) / CLIMB.span);
  const striding = walk * climb;
  const skating = (1 - walk) * skateShare(s.speed);
  const stride = work * striding;
  const skate = work * skating;
  const phase = s.stride - Math.floor(s.stride);
  const push = (Math.floor(s.stride) % 2) as 0 | 1;
  const glide = (1 - push) as 0 | 1;
  const duty = TUNING.poles.duty;
  // The snow passed in a stride — the engine counts one at `strideRate` ×
  // the drive a second — and how much of it one push sweeps.
  const pass = Math.abs(s.way ?? s.speed) / (strideRate(s.speed) * Math.max(0.2, s.drive));
  const poling = skate + work * Math.max(0, 1 - striding - skating);
  const sweep =
    (poling > 0
      ? (POLE_SWEEP.pole * (poling - skate) + POLE_SWEEP.skate * skate) / poling
      : POLE_SWEEP.pole) *
    (1 - POLE_SWEEP.tuck * clamp01(s.crouch ?? 0));
  const fit = sweep / Math.max(1e-6, pass * duty);
  const out: [number, number] = [0, 0];
  const lift: [number, number] = [0, 0];
  const fore: [number, number] = [0, 0];
  const tilt: [number, number] = [0, 0];
  // THE PUSHING LEG goes out along its ski's line (skating) or back along
  // it (striding), weighted; then comes back in, lifted clear of the snow,
  // for the next.
  const reach =
    phase < duty
      ? Math.sin((Math.PI / 2) * (phase / duty))
      : Math.cos((Math.PI / 2) * ((phase - duty) / (1 - duty)));
  const recover = phase < duty ? 0 : Math.sin((Math.PI * (phase - duty)) / (1 - duty));
  const side = push === 0 ? -1 : 1;
  out[push] = side * SKATE.out * skate * reach;
  tilt[push] = -side * SKATE.edge * skate * reach;
  lift[push] = SKATE.lift * skate * recover + STRIDE.kick * stride * reach;
  fore[push] = -(STRIDE.back * stride + SKATE.back * skate) * reach;
  fore[glide] = STRIDE.ahead * stride * reach;
  return {
    stride,
    skate,
    pole: work * Math.max(0, 1 - striding - skating),
    phase,
    push,
    splay: [-SKATE.splay * skate, SKATE.splay * skate],
    out,
    lift,
    fore,
    tilt,
    pass,
    keep: poleKeepUp(s.speed) * smooth01((fit - 0.8) / 0.15),
  };
}
