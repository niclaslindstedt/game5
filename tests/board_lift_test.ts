// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDER ON A LIFT, AND ON THE CARD (`board-lift.ts`, the engine's
// `lift-ride.ts`, the ski card's rack and sheet, what the game remembers):
// a board ridden up a chair rides with its rear foot out from the load zone
// to the top and straps back in once going again; sat on the chair, every
// joint of him is a number, the board hangs off his front foot below the
// seat with its tail down and his rear foot resting on its deck; carried,
// it is under his arm on his rear-foot side; and the board is a pick the
// card offers, the game keeps and a link names — where a free choice of
// pair is the run's.

import { describe, expect, it } from "vitest";

import {
  BOARD_CATALOG,
  LYNX,
  NEUTRAL_INPUT,
  SKIS,
  SKI_CATALOG,
  createGame,
  isBoard,
  placeRun,
  step,
  type SkierInput,
} from "@engine";

import { flatLevel } from "./support/synthetic.ts";
import { boardInputOf, boardOf } from "../pwa/src/game/board-input.ts";
import { createSkierSpring } from "../pwa/src/game/skier-pose.ts";
import {
  BOARD_SEAT_Y,
  boardLiftPose,
  chairBoardPose,
  underArmFrame,
  underArmHand,
} from "../pwa/src/game/board-lift.ts";
import {
  bindingsOf,
  boardPose,
  frontIndex,
  onDeck,
  type BoardPoseInput,
} from "../pwa/src/game/board-pose.ts";
import { boardAllowed, mergeSettings, specFor, freshSettings } from "../pwa/src/game/settings.ts";
import { rackOf, skisBars, skisFacts } from "../pwa/src/game/ski-stats.ts";
import { skiShares, stationOf } from "../pwa/src/game/ski-stand.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

const board = boardOf(LYNX);
const finite = (v: { x: number; y: number; z: number }) =>
  Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("the board on a chair", () => {
  const chair = chairBoardPose(board, BOARD_SEAT_Y);
  const p = chair.pose;
  const fi = frontIndex(board.lead);
  const ri = 1 - fi;

  it("is a number in every joint", () => {
    for (const v of [p.hips, p.head, ...p.hipJoints, ...p.knees, ...p.feet, ...p.hands])
      expect(finite(v)).toBe(true);
    expect(finite(chair.board.centre)).toBe(true);
    expect(p.poles).toBe(null);
  });

  it("hangs the board off his front foot, below the seat, tail down", () => {
    expect(chair.free).toBe(ri);
    // The front boot stands in its binding (`feet` is the boot's cuff).
    const soles = bindingsOf(chair.board, { board }).sole;
    expect(dist(soles[fi], p.feet[fi])).toBeLessThan(0.35); // the sole to the cuff
    // The whole deck under the seat's top.
    const tail = onDeck(chair.board, board, -LYNX.length / 2);
    const nose = onDeck(chair.board, board, LYNX.length / 2);
    expect(Math.max(tail.y, nose.y, chair.board.centre.y)).toBeLessThan(BOARD_SEAT_Y);
    expect(tail.y).toBeLessThan(nose.y);
    // Turned off the line of travel, not pointed straight ahead.
    expect(Math.abs(chair.board.along.x)).toBeGreaterThan(0.2);
  });

  it("rests his rear foot on the deck, within his legs' reach", () => {
    const thigh = dist(p.hipJoints[ri], p.knees[ri]);
    const shin = dist(p.knees[ri], p.feet[ri]);
    expect(dist(p.hipJoints[ri], p.feet[ri])).toBeLessThanOrEqual(thigh + shin + 1e-6);
    // Over the deck, not hanging in the air beside it.
    const d = p.feet[ri];
    const c = chair.board.centre;
    const n = chair.board.normal;
    const over = (d.x - c.x) * n.x + (d.y - c.y) * n.y + (d.z - c.z) * n.z;
    expect(over).toBeGreaterThan(0);
    expect(over).toBeLessThan(0.6);
  });

  it("is the riding pose itself until he sits", () => {
    const input = riding();
    const seated = boardLiftPose(input, { seated: 1, towing: 0, y: BOARD_SEAT_Y, cabin: false });
    expect(seated.free).toBe(ri);
    const standing = boardLiftPose(input, { seated: 0, towing: 0, y: BOARD_SEAT_Y, cabin: false });
    expect(standing).toEqual(boardPose(input));
  });
});

/** A rider stood still on the board on the flat, as the game hands one. */
function riding(): BoardPoseInput {
  const state = createGame({ level: flatLevel({ size: 400 }), spec: LYNX, rivals: 0, quiet: true });
  placeRun(state, { x: 200, z: 100, heading: 0, speed: 0 });
  step(state, NEUTRAL_INPUT);
  return boardInputOf(state.skier, createSkierSpring(0), state.skier.q).input;
}

describe("the board carried", () => {
  it("is under his arm on his rear-foot side, on its edge along his way", () => {
    for (const lead of ["regular", "goofy"] as const) {
      const f = underArmFrame(lead);
      const side = lead === "regular" ? 1 : -1;
      expect(Math.sign(f.centre.x)).toBe(side);
      expect(Math.abs(f.along.z)).toBeGreaterThan(0.9);
      expect(Math.abs(f.normal.x)).toBeCloseTo(1, 6);
      expect(underArmHand(lead).i).toBe(side > 0 ? 1 : 0);
    }
  });
});

describe("riding a lift on the board", () => {
  it("rides with the rear foot out, and straps it back in once going", () => {
    const run = createGame({ seed: 38, mode: "free", byLift: true, quiet: true, spec: LYNX });
    expect(run.skier.lift).not.toBe(null);
    // Up the line, the rear foot out.
    for (let k = 0; k < 120; k++) step(run, NEUTRAL_INPUT);
    expect(run.skier.board?.free).toBe(true);
    let off = false;
    while (run.t < 240 && !off) {
      step(run, NEUTRAL_INPUT);
      off = run.events.some((e) => e.kind === "lift" && e.phase === "off");
    }
    expect(off).toBe(true);
    // Off the top and down the run, tucked: strapped in once going.
    const tuck: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };
    const until = run.t + 30;
    while (run.t < until && run.skier.board?.free) step(run, tuck);
    expect(run.skier.board?.free).toBe(false);
  });
});

describe("the board on the card", () => {
  it("stands at the end of the rack only where a run lets a free pick", () => {
    expect(rackOf(true).at(-1)).toBe(LYNX);
    expect(rackOf(true)).toHaveLength(SKI_CATALOG.length + BOARD_CATALOG.length);
    expect(rackOf(false).some(isBoard)).toBe(false);
    expect(boardAllowed("free")).toBe(true);
    expect(boardAllowed("tricks")).toBe(true);
    expect(boardAllowed("slalom")).toBe(false);
    expect(boardAllowed("downhill")).toBe(false);
  });

  it("bills the board off its own numbers, and no pole", () => {
    const facts = Object.fromEntries(skisFacts(LYNX).map((f) => [f.key, f.value]));
    expect(facts.length).toBeCloseTo(LYNX.length * 100, 6);
    expect(facts.waist).toBeCloseTo(LYNX.waist * 1000, 6);
    expect(facts.stance).toBeCloseTo(LYNX.board!.stance * 100, 6);
    expect(facts.front).toBeCloseTo((LYNX.board!.front * 180) / Math.PI, 6);
    expect(facts.back).toBeCloseTo((LYNX.board!.back * 180) / Math.PI, 6);
    expect(Object.keys(facts)).not.toContain("pole");
    for (const bar of skisBars(LYNX)) expect(bar.value).toBeGreaterThan(0);
    // The skis' sheet is unmoved by the board on the rack.
    expect(skisFacts(SKIS).map((f) => f.key)).toEqual([
      "length",
      "waist",
      "sidecut",
      "weight",
      "top",
    ]);
  });

  it("is kept as the pick and read off a link", () => {
    expect(mergeSettings({ skis: "lynx" }).skis).toBe("lynx");
    expect(readParams("?skis=lynx").skis).toBe("lynx");
  });

  it("rides the board where it is allowed, and the race's pair where not", () => {
    const s = { ...freshSettings(), skis: "lynx" as const };
    expect(isBoard(specFor(s, null, "free"))).toBe(true);
    expect(isBoard(specFor(s, null, "slalom"))).toBe(false);
    expect(isBoard(specFor(s, null, "downhill"))).toBe(false);
  });
});

describe("what the board throws", () => {
  it("reads its four stations as the two feet's, never past the end", () => {
    const level = flatLevel({ size: 400 });
    const board = createGame({ level, spec: LYNX, rivals: 0, quiet: true });
    placeRun(board, { x: 200, z: 100, heading: 0, speed: 8 });
    step(board, NEUTRAL_INPUT);
    const c = board.skier.contacts;
    expect(c).toHaveLength(4);
    for (const k of [0, 1])
      for (const at of [0, 1, 2] as const) expect(stationOf(c, k, at)).toBeDefined();
    expect(stationOf(c, 0, 0)).toBe(c[0]);
    expect(stationOf(c, 1, 2)).toBe(c[3]);
    const shares = skiShares(board.skier);
    expect(shares[0] + shares[1]).toBeCloseTo(1, 6);
    expect(Math.min(...shares)).toBeGreaterThan(0.2);
    // A pair of skis keeps its three stations a ski.
    const skis = createGame({ level, spec: SKIS, rivals: 0, quiet: true });
    step(skis, NEUTRAL_INPUT);
    expect(stationOf(skis.skier.contacts, 1, 2)).toBe(skis.skier.contacts[5]);
  });
});
