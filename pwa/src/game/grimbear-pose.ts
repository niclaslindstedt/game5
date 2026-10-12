// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRIMBEAR'S POSE (three-free): the joint angles his figure is drawn in
// (`grimbear-view.ts`), off what the engine says he is doing
// (`GrimbearState`). He RUNS LIKE A MAN — an upright sprinter's stride, the
// arms pumping against the legs, the trunk leant into it — and is built
// like a bear; so the stride is a runner's and the bulk is the view's.
//
// Angles are rad: a joint's swing positive FORWARD (the knee and the elbow
// positive bent), `lean` the trunk pitched forward, `spread` the arms out
// from the sides, `look` the head pitched down, `jaw` the mouth open.

import type { GrimbearPhase } from "@engine";

export type GrimbearPose = {
  lean: number;
  /** The hips' height over the snow's below standing, m (negative down). */
  bob: number;
  hip: [number, number];
  knee: [number, number];
  shoulder: [number, number];
  elbow: [number, number];
  spread: number;
  look: number;
  jaw: number;
};

/** One stride — two steps — at a run and at a walk, m. */
const RUN_STRIDE = 3.4;
const WALK_STRIDE = 1.6;
/** The speed a walk becomes a run at, m/s. */
const RUNNING = 3;

/** How long a change of what he is doing takes to draw, s: the pose he
 * was in carried on and faded into the new one (`grimbear-view.ts`). */
export const GRIMBEAR_BLEND = 0.35;

function smooth(x: number): number {
  const u = x < 0 ? 0 : x > 1 ? 1 : x;
  return u * u * (3 - 2 * u);
}

/** `out` taken `w` of the way to `to` (0 leaves it, 1 is `to`). */
export function mixGrimbearPose(out: GrimbearPose, to: GrimbearPose, w: number): GrimbearPose {
  const m = (a: number, b: number): number => a + (b - a) * w;
  out.lean = m(out.lean, to.lean);
  out.bob = m(out.bob, to.bob);
  out.spread = m(out.spread, to.spread);
  out.look = m(out.look, to.look);
  out.jaw = m(out.jaw, to.jaw);
  for (let i = 0; i < 2; i++) {
    out.hip[i] = m(out.hip[i], to.hip[i]);
    out.knee[i] = m(out.knee[i], to.knee[i]);
    out.shoulder[i] = m(out.shoulder[i], to.shoulder[i]);
    out.elbow[i] = m(out.elbow[i], to.elbow[i]);
  }
  return out;
}

const held = freshGrimbearPose();

/** What his figure is doing: the engine's phase, with a halt he has
 * pulled up from (`stood`, under 1 m/s) told from one still running out. */
export type GrimbearMove = GrimbearPhase | "stood";

export function grimbearMove(phase: GrimbearPhase, speed: number): GrimbearMove {
  return phase === "halt" && speed < 1 ? "stood" : phase;
}

export function grimbearPose(
  phase: GrimbearMove,
  stride: number,
  speed: number,
  t: number,
  out: GrimbearPose,
): GrimbearPose {
  if (phase === "halt") phase = grimbearMove(phase, speed);
  const run = Math.min(1, Math.max(0, (speed - RUNNING * 0.5) / RUNNING));
  const walk = Math.min(1, speed / 1.2) * (1 - run);
  // The stride's beat, a run's and a walk's mixed as the one becomes the
  // other — never switched, which would jump the legs half a stride.
  const ar = (stride / RUN_STRIDE) * Math.PI * 2;
  const aw = (stride / WALK_STRIDE) * Math.PI * 2;
  const k = smooth(run * 4);
  const s = Math.sin(ar) * k + Math.sin(aw) * (1 - k);
  const c = Math.cos(ar) * k + Math.cos(aw) * (1 - k);
  // STOOD, he stands as a bear stands up: the knees soft, the trunk over
  // them, the arms hanging a little forward of him and out from his bulk.
  const legSwing = 0.75 * run + 0.4 * walk;
  out.hip[0] = 0.18 + s * legSwing;
  out.hip[1] = 0.18 - s * legSwing;
  // The knee folds as the leg comes through, and is long under him — a
  // smooth fold, never one with a corner in it at the bottom of the swing.
  const fold0 = ((1 + c) / 2) ** 2;
  const fold1 = ((1 - c) / 2) ** 2;
  out.knee[0] = 0.25 + (fold0 * 1.25 + 0.1) * run + fold0 * 0.35 * walk;
  out.knee[1] = 0.25 + (fold1 * 1.25 + 0.1) * run + fold1 * 0.35 * walk;
  // The arms against the legs, a runner's: bent near square, driven back
  // past his hip and forward to his chin.
  const armSwing = 0.55 * run + 0.3 * walk;
  out.shoulder[0] = 0.05 - s * armSwing;
  out.shoulder[1] = 0.05 + s * armSwing;
  out.elbow[0] = 0.35 + 0.8 * run + 0.2 * walk;
  out.elbow[1] = out.elbow[0];
  out.lean = 0.22 + 0.25 * run;
  out.bob = -0.06 - c * c * 0.07 * run;
  out.spread = 0.18;
  out.look = -0.05 - 0.15 * run;
  out.jaw = 0.12 * run;
  if (phase === "lurk") {
    // Crouched behind his trunk, peering round it, breathing.
    const breathe = Math.sin(t * 2.2) * 0.04;
    out.hip[0] = out.hip[1] = 0.75;
    out.knee[0] = out.knee[1] = 1.0;
    out.shoulder[0] = 0.3;
    out.shoulder[1] = 0.15;
    out.elbow[0] = out.elbow[1] = 0.7;
    out.lean = 0.5 + breathe;
    out.bob = -0.3;
    out.spread = 0.25;
    out.look = -0.35;
    out.jaw = 0.08;
  } else if (phase === "maul") {
    // Over the body, both arms raised and brought down together, again.
    const beat = (t * 1.5) % 1;
    const up = beat < 0.6 ? smooth(beat / 0.6) : 1 - smooth((beat - 0.6) / 0.16);
    out.hip[0] = out.hip[1] = 0.55;
    out.knee[0] = out.knee[1] = 0.75;
    out.shoulder[0] = out.shoulder[1] = 0.5 + up * 2.3;
    out.elbow[0] = out.elbow[1] = 0.4 + up * 0.5;
    out.lean = 0.85 - up * 0.35;
    out.bob = -0.22;
    out.spread = 0.3;
    out.look = 0.5 - up * 0.5;
    out.jaw = 0.4 + up * 0.5;
  } else if (phase === "miss") {
    // Stumbling on after the dive, pitched over his own feet...
    out.lean += 0.3;
    out.bob -= 0.05;
    out.shoulder[0] += 0.6;
    out.shoulder[1] -= 0.3;
    out.spread = 0.45;
    // ...out of THE DIVE: thrown forward at the skier, both arms raked down
    // and across through the air where he was, the jaws open — and got
    // up out of it over a moment rather than in a frame.
    const rake = smooth(t / 0.35);
    held.hip[0] = 0.9;
    held.hip[1] = -0.35;
    held.knee[0] = 0.5;
    held.knee[1] = 0.3;
    held.shoulder[0] = held.shoulder[1] = 2.4 - rake * 1.9;
    held.elbow[0] = held.elbow[1] = 0.25 + rake * 0.35;
    held.lean = 0.7 + rake * 0.25;
    held.bob = -0.2;
    held.spread = 0.55 - rake * 0.35;
    held.look = 0.1;
    held.jaw = 0.9;
    mixGrimbearPose(out, held, 1 - smooth((t - 0.5) / 0.4));
  } else if (phase === "stood") {
    // Pulled up, stood tall, the arms up and out and roaring.
    const heave = Math.sin(t * 3) * 0.05;
    out.hip[0] = out.hip[1] = 0.05;
    out.knee[0] = out.knee[1] = 0.12;
    out.shoulder[0] = out.shoulder[1] = 2.3 + heave;
    out.elbow[0] = out.elbow[1] = 0.8;
    out.lean = -0.12;
    out.bob = 0;
    out.spread = 1.0;
    out.look = -0.5;
    out.jaw = 0.85;
  }
  return out;
}

export function freshGrimbearPose(): GrimbearPose {
  return {
    lean: 0,
    bob: 0,
    hip: [0, 0],
    knee: [0, 0],
    shoulder: [0, 0],
    elbow: [0, 0],
    spread: 0,
    look: 0,
    jaw: 0,
  };
}
