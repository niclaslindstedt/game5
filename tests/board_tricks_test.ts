// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SNOWBOARDER'S TRICKS (`engine/game/board-tricks.ts`): the board's seven
// grabs picked off the lean and the edge and paid as a skier's grabs are,
// its spins named FRONTSIDE or BACKSIDE by the way he faces, SWITCH off a
// switch take-off and NOLLIE off a pop from the nose — and none of it read
// on a pair of skis.

import { describe, expect, it } from "vitest";

import {
  LYNX,
  NEUTRAL_INPUT,
  SKIS,
  TUNING,
  boardGrabOf,
  createGame,
  placeRun,
  spinSide,
  step,
  type GameEvent,
  type GameState,
  type RunMoment,
  type SkiSpec,
  type SkierInput,
  type BoardGrab,
} from "@engine";
import { boardInputOf } from "../pwa/src/game/board-input.ts";
import { bindingsOf, boardPose, grabGap } from "../pwa/src/game/board-pose.ts";
import { createSkierSpring, stepSkierSpring } from "../pwa/src/game/skier-pose.ts";
import { comboLine } from "../pwa/src/game/strings.ts";
import { flatLevel } from "./support/synthetic.ts";

const GOOFY: SkiSpec = { ...LYNX, board: { ...LYNX.board!, lead: "goofy" } };

/** A kicker's flight: 1.2 m up, climbing 8.5 m/s at 65 km/h. */
const LAUNCH: RunMoment = { x: 1500, z: 200, heading: 0, speed: 18, height: 1.2, vy: 8.5 };

function staged(spec: SkiSpec = LYNX, moment: RunMoment = LAUNCH, grade = 0): GameState {
  const level = flatLevel({ packed: 1, ...(grade ? { grade, slopeFrom: 0 } : {}) });
  const state = createGame({ level, spec, mode: "tricks", countdown: 0, quiet: true, crowd: 0 });
  placeRun(state, moment);
  return state;
}

function ride(state: GameState, seconds: number, at: (t: number) => Partial<SkierInput>) {
  const events: GameEvent[] = [];
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, { ...NEUTRAL_INPUT, ...at(i * TUNING.dt) });
    events.push(...state.events);
  }
  return events;
}

const tricksOf = (events: GameEvent[]): string[] =>
  events.flatMap((e) => (e.kind === "trick" ? [e.trick] : []));
/** Two taps of the edge to the right: a whole turn, clockwise from above. */
const TWO_TAPS = (t: number): Partial<SkierInput> => ({
  steer: t < 0.05 || (t > 0.1 && t < 0.15) ? 1 : 0,
});

describe("the board's grabs", () => {
  const at = (steer: number, lean: number, spec = LYNX, switched = false): string =>
    boardGrabOf({ ...NEUTRAL_INPUT, steer, lean, trick: true }, spec, switched);

  it("the lean picks the hand and the edge the place, the indy at rest", () => {
    // A regular rider faces his board's right: the steer right is his toes.
    expect(at(0, 0)).toBe("indy");
    expect(at(1, 0)).toBe("mute");
    expect(at(-1, 0)).toBe("melon");
    expect(at(0, -1)).toBe("nose");
    expect(at(0, 1)).toBe("tail");
    expect(at(-1, 1)).toBe("stalefish");
    expect(at(-1, -1)).toBe("method");
    expect(at(1, -1)).toBe("mute");
    expect(at(1, 1)).toBe("indy");
  });

  it("the toes are on the other side for a goofy rider, and riding switch", () => {
    expect(at(-1, 0, GOOFY)).toBe("mute");
    expect(at(1, 0, GOOFY)).toBe("melon");
    expect(at(-1, 0, LYNX, true)).toBe("mute");
    expect(at(-1, 0, GOOFY, true)).toBe("melon");
  });

  it("a grab held in the air is a board grab, paid as a skier's", () => {
    const board = staged();
    const ski = staged(SKIS);
    const hold = (t: number): Partial<SkierInput> => ({ trick: t < 0.8, lean: t < 0.8 ? 1 : 0 });
    const onBoard = ride(board, 4, hold);
    const onSkis = ride(ski, 4, hold);
    expect(tricksOf(onBoard)).toEqual(["air", "tail"]);
    expect(tricksOf(onSkis)).toEqual(["air", "spread"]);
    const paid = (events: GameEvent[], kind: string) =>
      events.find((e) => e.kind === "trick" && e.trick === kind);
    const tail = paid(onBoard, "tail");
    const spread = paid(onSkis, "spread");
    expect(tail?.kind === "trick" && tail.points).toBe(TUNING.tricks.posePoints);
    expect(spread?.kind === "trick" && spread.points).toBe(TUNING.tricks.posePoints);
    expect(comboLine(board.tricks.lastParts)).toBe("BIG AIR + TAIL GRAB");
  });

  it("each of the seven is won and named", () => {
    const asks: [number, number, string][] = [
      [0, 0, "INDY"],
      [1, 0, "MUTE"],
      [-1, 0, "MELON"],
      [-1, 1, "STALEFISH"],
      [-1, -1, "METHOD"],
      [0, -1, "NOSE GRAB"],
      [0, 1, "TAIL GRAB"],
    ];
    for (const [steer, lean, word] of asks) {
      const state = staged();
      // The grab asked once the strokes' gates are behind him: held, the
      // edge and the lean are the grab's and never a stroke.
      ride(state, 4, (t) => (t < 0.8 ? { trick: true, steer, lean } : {}));
      expect(comboLine(state.tricks.lastParts)).toBe(`BIG AIR + ${word}`);
    }
  });
});

describe("the board's spins", () => {
  it("FRONTSIDE or BACKSIDE by the way he faces and the way he turns", () => {
    // A regular rider faces his board's right: clockwise from above turns
    // his back to the way he goes first — backside — and anticlockwise his
    // chest: frontside. A goofy rider the other way round; riding switch
    // swaps them again.
    expect(spinSide(1, LYNX, false)).toBe("backside");
    expect(spinSide(-1, LYNX, false)).toBe("frontside");
    expect(spinSide(1, GOOFY, false)).toBe("frontside");
    expect(spinSide(1, LYNX, true)).toBe("frontside");
    expect(spinSide(1, GOOFY, true)).toBe("backside");
  });

  it("a whole turn clockwise is a BACKSIDE 360 regular and a FRONTSIDE 360 goofy", () => {
    const regular = staged();
    ride(regular, 4, TWO_TAPS);
    expect(comboLine(regular.tricks.lastParts)).toContain("BACKSIDE 360");
    const goofy = staged(GOOFY);
    ride(goofy, 4, TWO_TAPS);
    expect(comboLine(goofy.tricks.lastParts)).toContain("FRONTSIDE 360");
  });

  it("half a turn alone is a 180 with its side", () => {
    const state = staged();
    ride(state, 4, (t) => ({ steer: t < 0.05 ? -1 : 0 }));
    expect(comboLine(state.tricks.lastParts)).toContain("FRONTSIDE 180");
  });

  it("taken off riding switch it is a SWITCH spin", () => {
    // Riding fakie down a pitch, tail first, thrown off a kicker's flight.
    const state = staged(LYNX, { ...LAUNCH, heading: Math.PI, speed: -18 });
    state.skier.switched = true;
    ride(state, 4, TWO_TAPS);
    const line = comboLine(state.tricks.lastParts);
    expect(line).toMatch(/SWITCH (FRONT|BACK)SIDE 360/);
  });

  it("popped off the nose it is a NOLLIE spin, off the tail no word at all", () => {
    const popped = (lean: number): string => {
      const state = staged(LYNX, { x: 1500, z: 200, heading: 0, speed: 12 });
      let air = -1;
      ride(state, 3.5, (t) => {
        if (air < 0 && state.skier.airborne) air = t;
        const up = air >= 0 ? t - air : -1;
        return {
          lean: t < 1.0 ? lean : 0,
          jump: t > 0.3 && t < 1.0,
          steer: up >= 0.2 && up < 0.25 ? 1 : 0,
        };
      });
      return comboLine(state.tricks.lastParts);
    };
    expect(popped(-1)).toContain("NOLLIE BACKSIDE 180");
    const ollie = popped(0);
    expect(ollie).toContain("BACKSIDE 180");
    expect(ollie).not.toContain("NOLLIE");
  });

  it("a skier's spin carries no side", () => {
    const state = staged(SKIS);
    ride(state, 4, TWO_TAPS);
    const spin = state.tricks.lastParts.find((p) => p.kind === "spin");
    expect(spin).toBeDefined();
    expect(spin?.side).toBeUndefined();
    expect(comboLine(state.tricks.lastParts)).toContain("360");
    expect(comboLine(state.tricks.lastParts)).not.toContain("SIDE");
  });
});

describe("the grabs as drawn", () => {
  it("each grab's hand is on the board, a fist's thickness off its edge", () => {
    const asks: [BoardGrab, number, number][] = [
      ["indy", 0, 0],
      ["mute", 1, 0],
      ["melon", -1, 0],
      ["stalefish", -1, 1],
      ["method", -1, -1],
      ["nose", 0, -1],
      ["tail", 0, 1],
    ];
    for (const [grab, steer, lean] of asks) {
      const state = staged();
      const legs = createSkierSpring(0);
      ride(state, 0.75, () => ({ trick: true, steer, lean }));
      // The body's spring stood in the air, as the drawing has it there.
      for (let i = 0; i < 90; i++) {
        const c = state.skier;
        stepSkierSpring(legs, c.vy, c.airborne, TUNING.dt, 0, c, false, undefined, 0);
      }
      expect(state.tricks.pose).toBe(grab);
      const c = state.skier;
      const { input } = boardInputOf(c, legs, c.q);
      input.grab = grab;
      input.grabShare = 1;
      const bp = boardPose(input);
      expect(grabGap(bp, input), grab).toBeLessThan(0.05);
      // ...and the board still under his feet: each boot in its binding.
      const at = bindingsOf(bp.board, input);
      for (let i = 0; i < 2; i++) {
        const d = Math.hypot(
          bp.pose.boots[i].f.x - at.boot[i].f.x,
          bp.pose.boots[i].f.y - at.boot[i].f.y,
          bp.pose.boots[i].f.z - at.boot[i].f.z,
        );
        expect(d, grab).toBeLessThan(1e-6);
      }
    }
  });
});
