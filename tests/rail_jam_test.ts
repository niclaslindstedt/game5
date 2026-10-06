// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RAIL JAM (R40): the set built to its rule — the drop-in sized to the
// features' speed, the deck and its row of rails and boxes — the mode's
// rules and presets, a hit judged on the feature ridden, the session's
// dealt field on streams of its own, and the bot riding a whole session
// across every feature.

import { describe, expect, it } from "vitest";

import {
  FREESTYLE,
  KNUCKLE_HUCK,
  MODE_RULES,
  RAIL_JAM,
  RAIL_JAM_FORMAT,
  RAIL_JAM_RULE,
  botInput,
  createGame,
  jamBoard,
  jamFormatOf,
  jibImpression,
  jumpHeightAt,
  railHitImpression,
  railJamProfile,
  railJamSpeed,
  railKind,
  raceRiderOf,
  raceSkisOf,
  rivalHits,
  setRailJam,
  skisById,
  step,
  type JibRecord,
} from "@engine";
import { levelFor } from "./support/levels.ts";

const R = RAIL_JAM_RULE;
const RAD = Math.PI / 180;
const p = railJamProfile();

/** The set's slope at `x` m of plan, degrees, falling positive. */
function slopeAt(x: number): number {
  return Math.atan2(jumpHeightAt(p, x - 0.25) - jumpHeightAt(p, x + 0.25), 0.5) / RAD;
}

describe("the rail jam's profile (R40)", () => {
  it("is built in the rule's order", () => {
    expect(p.gate).toBeGreaterThanOrEqual(R.platform);
    expect(p.gate).toBeLessThan(p.deck);
    expect(p.features - p.deck).toBeCloseTo(R.deck.lead, 5);
    expect(p.features).toBeLessThan(p.finish);
    expect(p.finish).toBeLessThan(p.end);
  });

  it("lays its deck at the rule's grade", () => {
    for (let x = p.deck + 2; x < p.deck + R.deck.length - 2; x += 2) {
      expect(slopeAt(x)).toBeCloseTo(R.deck.grade, 0);
    }
  });

  it("brings a skier stood up to the features at their design speed", () => {
    // To the quarter-metre the pen draws in.
    expect(Math.abs(railJamSpeed(p, p.features) - R.speed)).toBeLessThan(0.15);
    let steepest = 0;
    for (let x = p.gate; x < p.deck; x += 0.5) steepest = Math.max(steepest, slopeAt(x));
    expect(steepest).toBeCloseTo(R.dropIn, 0);
  });
});

describe("the set built on a map (R40)", () => {
  const level = setRailJam(levelFor(1));
  const set = level.railJam;

  it("is set, its start gate and finish line its only gates", () => {
    expect(set).toBeDefined();
    expect(level.slopestyle).toBeUndefined();
    expect(level.checkpoints).toHaveLength(2);
    expect(set!.to).toBeCloseTo(p.finish, 5);
  });

  it("stands every feature of the rule side by side on the deck", () => {
    const jibs = level.jibs ?? [];
    expect(jibs).toHaveLength(R.jibs.length);
    expect(new Set(jibs.map((j) => j.line)).size).toBe(R.jibs.length);
    expect(jibs.some((j) => j.kind === "box")).toBe(true);
    expect(jibs.some((j) => j.shape === "rainbow")).toBe(true);
    for (const j of jibs) {
      const a = j.points[0];
      expect(a.y - level.groundAt(a.x, a.z)).toBeCloseTo(R.entry, 1);
      // Every point stands over the snow.
      for (const pt of j.points) expect(pt.y).toBeGreaterThan(level.groundAt(pt.x, pt.z));
    }
  });

  it("is the same set built again", () => {
    expect(setRailJam(levelFor(1))).toBe(level);
    expect(setRailJam(level)).toBe(level);
  });
});

describe("the rail jam as a mode", () => {
  it("is a jam: no course owed, the buzzer, the tricks", () => {
    const r = MODE_RULES.railJam(1);
    expect(r.jam).toBe(true);
    expect(r.course).toBe(false);
    expect(r.tricks).toBe(true);
    expect(r.butters).toBeUndefined();
    expect(r.limit).toBe(RAIL_JAM.jam);
  });

  it("is built on the tricks card", () => {
    expect(FREESTYLE.find((f) => f.id === "railJam")?.mode).toBe("railJam");
  });

  it("opens on the park twin-tip and the medium build", () => {
    expect(raceSkisOf("railJam")).toBe("hare");
    expect(skisById(RAIL_JAM.skis).kind).toBe("Park");
    expect(raceRiderOf("railJam")).toBe("medium");
  });

  it("stands up a fresh jam on the set", () => {
    const state = createGame({ seed: 1, mode: "railJam", quiet: true });
    expect(state.level.railJam).toBeDefined();
    expect(jamFormatOf(state.level)).toBe(RAIL_JAM_FORMAT);
    expect(state.jam?.hits).toEqual([]);
  });
});

const ride = (over: Partial<JibRecord>): JibRecord => ({
  id: "F1",
  section: 1,
  kind: "box",
  on: 0,
  off: 0,
  stances: ["fifty"],
  swaps: 0,
  press: null,
  pressed: 0,
  length: 7,
  whole: true,
  t: 0,
  ...over,
});

describe("a hit judged", () => {
  it("is marked on the feature as the slopestyle judges mark a jib", () => {
    const plain = ride({});
    const hard = ride({ kind: "rail", on: 270, stances: ["slide"], swaps: 1, off: 90 });
    expect(railHitImpression(plain, false)).toBe(jibImpression(plain));
    expect(railHitImpression(hard, false)).toBeGreaterThan(railHitImpression(plain, false));
    expect(railHitImpression(hard, true)).toBeLessThan(railHitImpression(plain, false));
  });

  it("calls a hit's kind off the feature and how it was ridden", () => {
    expect(railKind(ride({}))).toBe("F1 fifty");
    expect(railKind(ride({ id: "F2", on: 270, swaps: 1, stances: ["slide", "fifty"] }))).toBe(
      "F2 slide-fifty 270 on swap",
    );
  });
});

describe("the dealt field", () => {
  it("deals on a stream of its own, not the knuckle huck's", () => {
    const rail = rivalHits(7, 0, RAIL_JAM.jam, RAIL_JAM_FORMAT);
    expect(rivalHits(7, 0, RAIL_JAM.jam, RAIL_JAM_FORMAT)).toEqual(rail);
    expect(rail).not.toEqual(rivalHits(7, 0, KNUCKLE_HUCK.jam));
    expect(rail.length).toBeGreaterThanOrEqual(RAIL_JAM.jam / RAIL_JAM_FORMAT.dealt.gap[1] - 1);
  });

  it("ranks a session of eight", () => {
    const board = jamBoard(7, [], RAIL_JAM.jam, RAIL_JAM_FORMAT);
    expect(board).toHaveLength(RAIL_JAM.field + 1);
  });
});

describe("the bot's session", () => {
  it("rides every feature of the set, hit after hit, to the buzzer", () => {
    const state = createGame({ seed: 1, mode: "railJam", spec: skisById("hare"), quiet: true });
    let wipeouts = 0;
    for (let i = 0; i < (RAIL_JAM.jam + 8) * 120 && !state.jam?.closed; i++) {
      step(state, botInput(state));
      for (const e of state.events) if (e.kind === "wipeout") wipeouts += 1;
    }
    const jam = state.jam!;
    expect(jam.closed).toBe(true);
    expect(jam.hits.length).toBeGreaterThanOrEqual(10);
    expect(jam.hits.every((h) => !h.fell && h.jib?.whole)).toBe(true);
    expect(new Set(jam.hits.map((h) => h.jib?.id)).size).toBe(R.jibs.length);
    expect(wipeouts).toBe(0);
  });
});
