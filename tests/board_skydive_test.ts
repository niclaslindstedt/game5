// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDER THROUGH A SKYDIVE (`board-skydive.ts`) — three-free: at
// every stage of the jump his boots stay in the board's bindings and his
// legs keep their lengths, the freefall's body is not his riding pose (the
// board lies across his raised feet, not flat under him), his hands are up
// on the toggles under the canopy, and the stage turns him out of the door
// in it, square to the air in freefall and side-on for the snow.

import { describe, expect, it } from "vitest";
import { pairById } from "@engine";

import { boardOf } from "../pwa/src/game/board-input.ts";
import { bindingsOf, cuffOver } from "../pwa/src/game/board-pose.ts";
import {
  boardSkydiveMounts,
  boardSkydivePose,
  boardSkydiveStand,
  boardSkydiveYaw,
} from "../pwa/src/game/board-skydive.ts";
import { BODY, SHIN_ABOVE_CUFF } from "../pwa/src/game/skier-mounts.ts";
import type { SkydiveShape } from "../pwa/src/game/skier-skydive.ts";
import type { V3 } from "../pwa/src/game/skier-vec.ts";

const spec = pairById("lynx");
const board = boardOf(spec);
const mounts = boardSkydiveMounts(spec);
const stand = boardSkydiveStand(mounts, 0);

const dist = (a: V3, b: V3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function shape(o: Partial<SkydiveShape>): SkydiveShape {
  return {
    door: 0,
    box: 0,
    track: 0,
    head: 0,
    turn: 0,
    reach: 0,
    throw: 0,
    hang: 0,
    toggles: [0, 0],
    riser: 0,
    shock: 0,
    flare: 0,
    pads: 0,
    punch: 0,
    reserve: 0,
    attitude: 0,
    ...o,
  };
}

const STAGES: Record<string, SkydiveShape> = {
  door: shape({ door: 1 }),
  box: shape({ box: 1, attitude: Math.PI / 2 }),
  track: shape({ track: 1, attitude: Math.PI / 2 }),
  head: shape({ head: 1, attitude: Math.PI }),
  reach: shape({ box: 1, reach: 1, attitude: Math.PI / 2 }),
  throw: shape({ box: 1, throw: 1, attitude: Math.PI / 2 }),
  shock: shape({ hang: 0.5, box: 0.5, shock: 1 }),
  canopy: shape({ hang: 1, toggles: [0, 0] }),
  pulled: shape({ hang: 1, toggles: [1, 1] }),
  cutaway: shape({ hang: 0.5, pads: 1, punch: 1 }),
  reserve: shape({ box: 1, reserve: 1, attitude: Math.PI / 2 }),
  flare: shape({ hang: 1, flare: 1, toggles: [1, 1] }),
};

describe("the snowboarder's skydive", () => {
  it("keeps both boots in the bindings and the legs their lengths at every stage", () => {
    for (const [name, s] of Object.entries(STAGES)) {
      const { pose, deck } = boardSkydivePose(stand, s, board, mounts);
      const { sole, boot } = bindingsOf(deck, { board });
      for (const i of [0, 1] as const) {
        expect(dist(pose.feet[i], cuffOver(sole[i], boot[i])), `${name} foot ${i}`).toBeLessThan(
          1e-6,
        );
        expect(dist(pose.boots[i].n, deck.normal), `${name} boot ${i}`).toBeLessThan(1e-6);
        expect(dist(pose.hipJoints[i], pose.knees[i]), `${name} thigh ${i}`).toBeCloseTo(
          BODY.thigh,
          3,
        );
        expect(dist(pose.knees[i], pose.feet[i]), `${name} shin ${i}`).toBeCloseTo(
          SHIN_ABOVE_CUFF,
          3,
        );
      }
    }
  });

  it("lays the board across his raised feet in the box, not flat under him", () => {
    const riding = boardSkydivePose(stand, STAGES.door, board, mounts);
    const { pose, deck } = boardSkydivePose(stand, STAGES.box, board, mounts);
    // Across his feet: the deck runs along his shoulders' line...
    expect(Math.abs(deck.along.x)).toBeGreaterThan(0.9);
    // ...stood up off his back (the body frame's up, before the attitude
    // lays him on the air) with the shins, where in the door it lies flat.
    expect(riding.deck.normal.y).toBeGreaterThan(0.9);
    expect(deck.normal.y).toBeLessThan(0.6);
    for (const i of [0, 1] as const) {
      expect(dist(pose.feet[i], riding.pose.feet[i])).toBeGreaterThan(0.3);
    }
    // The nose on his lead side: a regular rider's to his left.
    expect(Math.sign(deck.along.x)).toBe(board.lead === "regular" ? -1 : 1);
  });

  it("has the hands up at the toggles under the canopy, and drawn down on them", () => {
    const up = boardSkydivePose(stand, STAGES.canopy, board, mounts).pose;
    const down = boardSkydivePose(stand, STAGES.pulled, board, mounts).pose;
    for (const i of [0, 1] as const) {
      expect(up.hands[i].y).toBeGreaterThan(up.shoulders[i].y + 0.25);
      expect(down.hands[i].y).toBeLessThan(up.hands[i].y - 0.4);
    }
  });

  it("is turned out of the door in it, square in the air, side-on at the flare", () => {
    const ride = board.lead === "regular" ? Math.PI / 2 : -Math.PI / 2;
    expect(boardSkydiveYaw(STAGES.door, board.lead)).toBeCloseTo(-Math.PI / 2);
    expect(boardSkydiveYaw(STAGES.box, board.lead)).toBe(0);
    expect(boardSkydiveYaw(STAGES.canopy, board.lead)).toBe(0);
    expect(boardSkydiveYaw(STAGES.flare, board.lead)).toBeCloseTo(ride);
    expect(boardSkydiveYaw(STAGES.flare, "goofy")).toBeCloseTo(-Math.PI / 2);
  });
});
