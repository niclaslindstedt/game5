// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON A SKIER THROWN (`camera-subject.ts`). Off his skis, the
// skier's state goes on as the pair he left sliding down the hill while his
// body tumbles on its own; the ladder's boom must stay on the BODY. Staged
// on the synthetic slope's lone trunk: the chase is framed every step off
// the pose the renderer hands it, and its aim is held to the body.

import { describe, expect, it } from "vitest";

import { createGame, NEUTRAL_INPUT, placeRun, step, TUNING, type SkierInput } from "@engine";
import { createBoomState, frameRig, freshRigPose, RIGS } from "../pwa/src/game/camera-rigs.ts";
import { createThrownLens, subjectPose } from "../pwa/src/game/camera-subject.ts";
import { LONE_TREE, syntheticLevel } from "./support/synthetic.ts";

const TUCK: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };

type P = { x: number; y: number; z: number };

/** How far `p` stands off the lens's line of sight, rad. */
function offAxis(eye: P, target: P, p: P): number {
  const a = [target.x - eye.x, target.y - eye.y, target.z - eye.z];
  const b = [p.x - eye.x, p.y - eye.y, p.z - eye.z];
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.min(1, dot / (Math.hypot(...a) * Math.hypot(...b))));
}

describe("the ladder on a skier thrown", () => {
  it("keeps the chase on his body, not on the skis sliding on", () => {
    const state = createGame({ level: syntheticLevel(), rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: LONE_TREE.x + 0.3, z: LONE_TREE.z - 30, heading: 0, speed: 50 / 3.6 });
    const pose = freshRigPose();
    const boom = createBoomState();
    const mem = createThrownLens();
    const groundAt = state.level.groundAt;
    let thrownFor = 0;
    let parted = 0;
    let worst = 0;
    for (let i = 0; i < 8 * TUNING.physicsHz; i++) {
      step(state, TUCK);
      const c = state.skier;
      const drawn = { x: c.x, y: c.y, z: c.z, q: c.q };
      subjectPose(pose, c, drawn, 0, c.thrown, groundAt, mem);
      const lens = frameRig(RIGS.chase, pose, boom, TUNING.dt, groundAt);
      const b = c.thrown;
      if (!b) continue;
      thrownFor += TUNING.dt;
      parted = Math.max(parted, Math.hypot(c.x - b.x, c.z - b.z));
      // A second for the boom to swing round onto him after the blow.
      if (thrownFor > 1) worst = Math.max(worst, offAxis(lens.eye, lens.target, b));
    }
    expect(thrownFor).toBeGreaterThan(2);
    // The skis' state goes on without him...
    expect(parted).toBeGreaterThan(4);
    // ...and the lens looks at him: inside 14° of its axis (the skis' state
    // would leave him 30° off it, out of the frame).
    expect(worst).toBeLessThan(0.25);
  });

  it("leaves a skier on his skis framed off his state", () => {
    const state = createGame({ level: syntheticLevel(), rivals: 0, countdown: 0, quiet: true });
    const c = state.skier;
    const pose = subjectPose(
      freshRigPose(),
      c,
      { x: 1, y: 2, z: 3, q: c.q },
      0.1,
      null,
      () => 0,
      createThrownLens(),
    );
    expect([pose.x, pose.y, pose.z]).toEqual([1, 1.9, 3]);
    expect(pose.heading).toBe(c.heading);
  });
});
