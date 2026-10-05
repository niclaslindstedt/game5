// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER ON A SNOWMOBILE'S BOARDS (`skier-sled.ts`): his weight hung
// where the engine has it — the hips part of the way across, the knees
// solved again to the boots on the boards, the trunk leant into the turn —
// every joint a smooth function of the hang, so a turn ridden from one
// side to the other never jumps him up or down.

import { describe, expect, it } from "vitest";

import { BODY, MOUNTS, SHIN_ABOVE_CUFF } from "../pwa/src/game/skier-pose.ts";
import { seatedPose } from "../pwa/src/game/skier-seat.ts";
import type { Board } from "../pwa/src/game/skier-sled.ts";
import type { SkierPose } from "../pwa/src/game/skier-joints.ts";
import type { V3 } from "../pwa/src/game/skier-vec.ts";

/** Stood on boards 0.67 m apart, the grips forward and up. */
const ON_BOARDS = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 10,
  mounts: MOUNTS,
  spread: [-0.2, 0.2] as const,
};

const board = (x: number, z = 0): Board => ({
  grips: [
    { x: -0.37, y: -0.2, z: 0.75 },
    { x: 0.37, y: -0.2, z: 0.75 },
  ],
  lean: 0.42,
  hang: { x, z },
});

const poseAt = (x: number, z = 0): SkierPose =>
  seatedPose(ON_BOARDS, { share: 1, y: 0, board: board(x, z) });

const dist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Every joint the board moves, as a list of points. */
const joints = (p: SkierPose): V3[] => [
  p.hips,
  ...p.hipJoints,
  p.waist,
  p.neck,
  p.head,
  ...p.knees,
  ...p.shoulders,
  ...p.elbows,
  ...p.hands,
];

describe("the rider on the boards", () => {
  it("moves no joint more than a centimetre for a millimetre of hang, across or along", () => {
    for (const along of [false, true]) {
      let last: SkierPose | null = null;
      for (let mm = -250; mm <= 250; mm++) {
        const h = mm / 1000;
        const p = along ? poseAt(0, h * 0.7) : poseAt(h);
        if (last) {
          const a = joints(last);
          const b = joints(p);
          for (let j = 0; j < a.length; j++) expect(dist(a[j], b[j])).toBeLessThan(0.01);
        }
        last = p;
      }
    }
  });

  it("keeps each leg whole between its hip and its boot, and never straight", () => {
    for (const h of [-0.21, -0.1, 0, 0.1, 0.21]) {
      const p = poseAt(h, -0.1);
      for (let i = 0; i < 2; i++) {
        expect(dist(p.hipJoints[i], p.knees[i])).toBeCloseTo(BODY.thigh, 3);
        expect(dist(p.knees[i], p.feet[i])).toBeCloseTo(SHIN_ABOVE_CUFF, 3);
        expect(dist(p.hipJoints[i], p.feet[i])).toBeLessThan(BODY.thigh + SHIN_ABOVE_CUFF - 0.01);
      }
    }
  });

  it("hangs his hips and leans his trunk into the turn, the boots left on the boards and the hands in reach", () => {
    const still = poseAt(0);
    for (const side of [-1, 1]) {
      const p = poseAt(0.21 * side);
      expect((p.hips.x - still.hips.x) * side).toBeGreaterThan(0.05);
      expect((p.head.x - p.hips.x) * side).toBeGreaterThan(0.1);
      expect(Math.abs(p.hips.y - still.hips.y)).toBeLessThan(0.05);
      expect(p.feet).toEqual(still.feet);
      for (let i = 0; i < 2; i++)
        expect(dist(p.hands[i], p.shoulders[i])).toBeLessThan(BODY.upperArm + BODY.forearm);
    }
  });
});
