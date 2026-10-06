// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POSE AS JOINTS: every point `skierPose` (`skier-pose.ts`) places, in
// the engine's own body frame — what the figure, the rig, the ragdoll's
// hand-over and the labs all read. Three-free; re-exported by
// `skier-pose.ts`, where it is made.

import type { Boot } from "./skier-limbs.ts";
import type { V3 } from "./skier-vec.ts";

export type SkierPose = {
  hips: V3;
  /** The hip joints, left and right — the pelvis turned with the skis. */
  hipJoints: [V3, V3];
  /** The small of the back, where the lumbar span meets the chest's. */
  waist: V3;
  neck: V3;
  head: V3;
  /** Trunk pitch forward, rad, and roll toward the skier's right, rad. */
  pitch: number;
  roll: number;
  /** The head's roll in the pair's frame, rad, right side down positive —
   * nearer the horizon than the trunk's. */
  headRoll: number;
  knees: [V3, V3];
  /** Each leg's end where the figure's own cloth stops: the top of the
   * boot's cuff. */
  feet: [V3, V3];
  /** Each FOOT's frame — the boot on its ski on the snow, turned and
   * tipped with it; thrown, the foot at the end of his shin, its sole
   * square to it. The feet (in the boots' liners) ride it, so on the skis
   * they sit hidden in the shells and thrown they go with him. */
  boots: [Boot, Boot];
  shoulders: [V3, V3];
  elbows: [V3, V3];
  hands: [V3, V3];
  /** Each pole's basket end, or null with the poles gone (a thrown skier
   * has let go of them). */
  poles: [V3, V3] | null;
  /** How far the skier looks into the turn, rad (positive to his right). */
  look: number;
};
