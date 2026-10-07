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

export function grimbearPose(
  phase: GrimbearPhase,
  stride: number,
  speed: number,
  t: number,
  out: GrimbearPose,
): GrimbearPose {
  const run = Math.min(1, Math.max(0, (speed - RUNNING * 0.5) / RUNNING));
  const walk = Math.min(1, speed / 1.2) * (1 - run);
  const length = run > 0 ? RUN_STRIDE : WALK_STRIDE;
  const a = (stride / length) * Math.PI * 2;
  const s = Math.sin(a);
  const c = Math.cos(a);
  // STOOD, he stands as a bear stands up: the knees soft, the trunk over
  // them, the arms hanging a little forward of him and out from his bulk.
  const legSwing = 0.75 * run + 0.4 * walk;
  out.hip[0] = 0.18 + s * legSwing;
  out.hip[1] = 0.18 - s * legSwing;
  // The knee folds as the leg comes through, and is long under him.
  out.knee[0] = 0.25 + (Math.max(0, c) * 1.25 + 0.1) * run + Math.max(0, c) * 0.35 * walk;
  out.knee[1] = 0.25 + (Math.max(0, -c) * 1.25 + 0.1) * run + Math.max(0, -c) * 0.35 * walk;
  // The arms against the legs, a runner's: bent near square, driven back
  // past his hip and forward to his chin.
  const armSwing = 0.55 * run + 0.3 * walk;
  out.shoulder[0] = 0.05 - s * armSwing;
  out.shoulder[1] = 0.05 + s * armSwing;
  out.elbow[0] = 0.35 + 0.8 * run + 0.2 * walk;
  out.elbow[1] = out.elbow[0];
  out.lean = 0.22 + 0.25 * run;
  out.bob = -0.06 - Math.abs(c) * 0.07 * run;
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
    const up = beat < 0.6 ? beat / 0.6 : Math.max(0, 1 - (beat - 0.6) / 0.12);
    out.hip[0] = out.hip[1] = 0.55;
    out.knee[0] = out.knee[1] = 0.75;
    out.shoulder[0] = out.shoulder[1] = 0.5 + up * 2.3;
    out.elbow[0] = out.elbow[1] = 0.4 + up * 0.5;
    out.lean = 0.85 - up * 0.35;
    out.bob = -0.22;
    out.spread = 0.3;
    out.look = 0.5 - up * 0.5;
    out.jaw = 0.4 + up * 0.5;
  } else if (phase === "miss" && t < 0.6) {
    // THE DIVE: thrown forward at the skier, both arms raked down and
    // across through the air where he was, the jaws open.
    const rake = Math.min(1, t / 0.35);
    out.hip[0] = 0.9;
    out.hip[1] = -0.35;
    out.knee[0] = 0.5;
    out.knee[1] = 0.3;
    out.shoulder[0] = out.shoulder[1] = 2.4 - rake * 1.9;
    out.elbow[0] = out.elbow[1] = 0.25 + rake * 0.35;
    out.lean = 0.7 + rake * 0.25;
    out.bob = -0.2;
    out.spread = 0.55 - rake * 0.35;
    out.look = 0.1;
    out.jaw = 0.9;
  } else if (phase === "miss") {
    // Stumbling on after it, pitched over his own feet.
    out.lean += 0.3;
    out.bob -= 0.05;
    out.shoulder[0] += 0.6;
    out.shoulder[1] -= 0.3;
    out.spread = 0.45;
  } else if (phase === "halt" && speed < 1) {
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
