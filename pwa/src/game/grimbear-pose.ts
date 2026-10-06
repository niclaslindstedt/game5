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
  const legSwing = 0.85 * run + 0.4 * walk;
  out.hip[0] = s * legSwing;
  out.hip[1] = -s * legSwing;
  // The knee folds as the leg comes through, and is long under him.
  out.knee[0] =
    (0.15 + Math.max(0, Math.cos(a)) * 1.2) * run + Math.max(0, Math.cos(a)) * 0.3 * walk;
  out.knee[1] =
    (0.15 + Math.max(0, -Math.cos(a)) * 1.2) * run + Math.max(0, -Math.cos(a)) * 0.3 * walk;
  // The arms against the legs, bent at the elbow.
  const armSwing = 0.9 * run + 0.3 * walk;
  out.shoulder[0] = -s * armSwing;
  out.shoulder[1] = s * armSwing;
  out.elbow[0] = 0.4 + 1.0 * run;
  out.elbow[1] = 0.4 + 1.0 * run;
  out.lean = 0.12 + 0.3 * run;
  out.bob = -Math.abs(Math.cos(a)) * 0.08 * run - 0.04;
  out.spread = 0.12;
  out.look = 0.1 - 0.15 * run;
  out.jaw = 0.1 * run;
  if (phase === "lurk") {
    // Crouched behind his trunk, breathing.
    const breathe = Math.sin(t * 2.2) * 0.04;
    out.hip[0] = out.hip[1] = 0.35;
    out.knee[0] = out.knee[1] = 0.6;
    out.shoulder[0] = out.shoulder[1] = 0.3;
    out.elbow[0] = out.elbow[1] = 0.9;
    out.lean = 0.35 + breathe;
    out.bob = -0.22;
    out.look = -0.25;
    out.jaw = 0.05;
  } else if (phase === "maul") {
    // Over the body, the arms coming down in turn.
    const blow = t * 5;
    out.hip[0] = out.hip[1] = 0.5;
    out.knee[0] = out.knee[1] = 0.7;
    out.shoulder[0] = 2.2 + Math.sin(blow) * 0.9;
    out.shoulder[1] = 2.2 - Math.sin(blow) * 0.9;
    out.elbow[0] = 0.6 + Math.max(0, Math.cos(blow)) * 0.6;
    out.elbow[1] = 0.6 + Math.max(0, -Math.cos(blow)) * 0.6;
    out.lean = 0.75;
    out.bob = -0.25;
    out.spread = 0.25;
    out.look = 0.55;
    out.jaw = 0.5;
  } else if (phase === "halt" && speed < 1) {
    // Pulled up, stood tall, the arms thrown out and roaring.
    const heave = Math.sin(t * 3) * 0.05;
    out.hip[0] = out.hip[1] = 0;
    out.knee[0] = out.knee[1] = 0.1;
    out.shoulder[0] = out.shoulder[1] = 1.3 + heave;
    out.elbow[0] = out.elbow[1] = 0.5;
    out.lean = -0.1;
    out.bob = 0;
    out.spread = 1.0;
    out.look = -0.45;
    out.jaw = 0.75;
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
