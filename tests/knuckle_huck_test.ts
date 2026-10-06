// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE KNUCKLE HUCK (R38): the knuckle built to its rule, the mode's rules
// and presets, the press and the butter on the snow and squared in the
// air, the judges' read of it, the jam and its dealt field, and the bot
// riding a whole session off the knuckle.

import { describe, expect, it } from "vitest";

import {
  JAM_FIELD,
  KNUCKLE_HUCK,
  KNUCKLE_JUDGING,
  MODE_RULES,
  TRICK_RULES,
  botInput,
  createGame,
  hitImpression,
  jamBoard,
  jamKind,
  jumpHeightAt,
  jumpProfile,
  lipSpeed,
  placeRun,
  raceRiderOf,
  raceSkisOf,
  readTrick,
  rivalHits,
  sessionImpression,
  sessionScore,
  setKnuckleHuck,
  skisById,
  step,
  takeoffPress,
  type FlightRecord,
  type JamHit,
  type SkierInput,
} from "@engine";
import { levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const K = TRICK_RULES.knuckleHuck;
const RAD = Math.PI / 180;
const p = jumpProfile(K);

/** The knuckle's slope at `x` m of plan, degrees, falling positive. */
function slopeAt(x: number): number {
  return Math.atan2(jumpHeightAt(p, x - 0.25) - jumpHeightAt(p, x + 0.25), 0.5) / RAD;
}

describe("the knuckle's profile (R38)", () => {
  it("is built in the rule's order, with no kicker and no table", () => {
    expect(p.gate).toBeGreaterThanOrEqual(K.platform);
    expect(p.gate).toBeLessThan(p.foot);
    expect(p.foot).toBeLessThanOrEqual(p.knuckle);
    expect(p.knuckle).toBeLessThan(p.landing);
    expect(p.landing).toBeLessThan(p.outrun);
    expect(p.outrun).toBeLessThan(p.finish);
    expect(p.finish).toBeLessThan(p.end);
  });

  it("drops in at its angle onto a level deck", () => {
    let steepest = 0;
    for (let x = p.gate; x < p.foot - K.flat; x += 1) steepest = Math.max(steepest, slopeAt(x));
    expect(steepest).toBeCloseTo(K.dropIn, 0);
    for (let x = p.knuckle - K.flat + 2; x < p.knuckle - 2; x += 2)
      expect(Math.abs(slopeAt(x))).toBeLessThan(0.5);
  });

  it("brings a tucked skier to the knuckle at its design speed", () => {
    expect(lipSpeed(p, K)).toBeCloseTo(K.speed, 1);
  });

  it("rolls over to a landing laid at its steepest", () => {
    let most = 0;
    let held = 0;
    for (let x = p.knuckle; x < p.landing; x += 0.5) {
      const s = slopeAt(x);
      most = Math.max(most, s);
      if (s > K.steepest - 0.5) held += 0.5;
    }
    expect(most).toBeLessThanOrEqual(K.steepest + 0.5);
    expect(held).toBeGreaterThan(K.slope * 0.8);
  });

  it("leaves the big air jump as it was", () => {
    const big = jumpProfile();
    expect(big.lip).toBeLessThan(big.knuckle);
    expect(big.knuckle - big.lip).toBeCloseTo(TRICK_RULES.bigAir.table, 0);
  });
});

describe("the knuckle set on a map (R38)", () => {
  const level = setKnuckleHuck(levelFor(1));
  const course = level.knuckleHuck;

  it("is set, its start gate and finish line its only gates", () => {
    expect(course).toBeDefined();
    expect(level.bigAir).toBeUndefined();
    expect(level.checkpoints).toHaveLength(2);
    expect(level.track.closed).toBe(false);
  });

  it("is graded to its profile along its line", () => {
    const base = level.track.points[0];
    const y0 = level.groundAt(base.x, base.z) - jumpHeightAt(p, base.s);
    for (const pt of level.track.points) {
      expect(Math.abs(level.groundAt(pt.x, pt.z) - y0 - jumpHeightAt(p, pt.s))).toBeLessThan(0.15);
    }
  });

  it("carries the knuckle as its one kicker", () => {
    const pts = level.track.points;
    const near = (x: number, z: number): boolean =>
      pts.some((pt) => Math.hypot(x - pt.x, z - pt.z) < K.width / 2);
    const on = (level.kickers ?? []).filter((k) => near(k.x, k.z));
    expect(on.map((k) => k.id)).toEqual(["KH"]);
  });
});

describe("the knuckle huck as a mode", () => {
  it("is a jam: no course owed, the buzzer, the tricks and the butters", () => {
    const r = MODE_RULES.knuckleHuck(1);
    expect(r.jam).toBe(true);
    expect(r.butters).toBe(true);
    expect(r.course).toBe(false);
    expect(r.tricks).toBe(true);
    expect(r.limit).toBe(KNUCKLE_HUCK.jam);
    expect(r.rivals).toBe(0);
  });

  it("opens on the park twin-tip and the medium build", () => {
    expect(raceSkisOf("knuckleHuck")).toBe("hare");
    expect(skisById(KNUCKLE_HUCK.skis).kind).toBe("Park");
    expect(raceRiderOf("knuckleHuck")).toBe("medium");
  });

  it("stands up a fresh jam on the knuckle", () => {
    const state = createGame({ seed: 1, mode: "knuckleHuck", quiet: true });
    expect(state.level.knuckleHuck).toBeDefined();
    expect(state.jam?.hits).toEqual([]);
    expect(state.jam?.closed).toBe(false);
  });
});

/** A skier on a groomed slope with butters on, at a crawl. */
function pressing() {
  const state = createGame({
    level: flatLevel({ packed: 1, grade: 0.1, slopeFrom: 0 }),
    mode: "free",
    countdown: 0,
    quiet: true,
  });
  state.rules = { ...state.rules, butters: true };
  placeRun(state, { x: 1500, z: 200, heading: 0, pitch: -Math.atan(0.1), speed: 6 });
  return state;
}

const input = (over: Partial<SkierInput>): SkierInput => ({
  steer: 0,
  tuck: 0,
  brake: 0,
  lean: 0,
  reset: false,
  ...over,
});

describe("the press and the butter", () => {
  it("presses the nose on a hard forward lean and keeps it to file", () => {
    const state = pressing();
    for (let i = 0; i < 60; i++) step(state, input({ lean: -1 }));
    expect(state.tricks.press).toBe("nose");
    const rec = takeoffPress(state);
    expect(rec?.end).toBe("nose");
    expect(rec?.yaw).toBe(0);
  });

  it("pivots him round the pressed end with the edge, and costs him speed", () => {
    const state = pressing();
    const plain = pressing();
    for (let i = 0; i < 120; i++) {
      step(state, input({ lean: -1, steer: 1 }));
      step(plain, input({}));
    }
    expect(state.tricks.butterYaw).toBeGreaterThan(Math.PI / 2);
    expect(Math.abs(state.skier.heading)).toBeGreaterThan(1);
    expect(state.skier.speed).toBeLessThan(plain.skier.speed);
    expect(state.skier.thrown).toBeNull();
  });

  it("does nothing on a run without butters", () => {
    const state = pressing();
    state.rules = { ...state.rules, butters: false };
    for (let i = 0; i < 120; i++) step(state, input({ lean: -1, steer: 1 }));
    expect(state.tricks.press).toBeNull();
    expect(state.tricks.butterYaw).toBe(0);
  });
});

/** A flight as `tricks.ts` files one. */
function flight(over: Partial<FlightRecord> = {}): FlightRecord {
  return {
    flight: 1,
    flip: 0,
    spin: 0,
    grabs: [],
    air: 1,
    length: 12,
    height: 1,
    switchIn: false,
    switchOut: false,
    landing: 0.3,
    outcome: "landed",
    t: 10,
    ...over,
  };
}

describe("the judges on a knuckle", () => {
  it("count a butter's winding into the spin and name the press", () => {
    const r = readTrick(
      flight({ spin: Math.PI / 2, butter: { end: "nose", held: 1, yaw: Math.PI / 2 } }),
    );
    expect(r.spin).toBe(180);
    expect(r.butter).toEqual({ end: "nose", wound: 90 });
    expect(readTrick(flight()).butter).toBeNull();
  });

  it("mark a butter over the same spin off no press, and a fall low", () => {
    const air = flight({ spin: Math.PI });
    const butter = flight({
      spin: Math.PI / 2,
      butter: { end: "tail", held: 1, yaw: Math.PI / 2 },
    });
    expect(hitImpression(butter, false)).toBeGreaterThan(hitImpression(air, false));
    expect(hitImpression(butter, true)).toBeLessThan(hitImpression(air, false) / 2);
  });

  it("call a hit's kind off its press and its way", () => {
    expect(jamKind(readTrick(flight({ spin: Math.PI })))).toBe("air right");
    expect(
      jamKind(readTrick(flight({ spin: -Math.PI, butter: { end: "nose", held: 1, yaw: -1 } }))),
    ).toBe("nose left");
  });
});

const hit = (impression: number, kind: string, fell = false): JamHit => ({
  trick: null,
  t: 0,
  fell,
  impression,
  kind,
});

describe("the session", () => {
  it("is the mean of the best three hits, three of them owed", () => {
    expect(sessionImpression([hit(60, "a")])).toBeCloseTo(20, 5);
    const three = [hit(60, "a"), hit(60, "a"), hit(60, "a"), hit(30, "a")];
    expect(sessionImpression(three)).toBeCloseTo(60, 5);
  });

  it("pays for variety and takes a little for each fall", () => {
    const same = [hit(60, "a"), hit(60, "a"), hit(60, "a")];
    const varied = [hit(60, "a"), hit(60, "b"), hit(60, "c")];
    expect(sessionImpression(varied) - sessionImpression(same)).toBeCloseTo(
      2 * KNUCKLE_JUDGING.variety,
      5,
    );
    const fallen = [...same, hit(5, "x", true)];
    expect(sessionImpression(same) - sessionImpression(fallen)).toBeCloseTo(
      KNUCKLE_JUDGING.fall,
      5,
    );
  });

  it("is marked nothing before a hit", () => {
    expect(sessionScore(1, -1, [])).toBe(0);
  });
});

describe("the dealt field", () => {
  it("deals every rival the same hits every time, more of them as the clock runs", () => {
    for (let id = 0; id < KNUCKLE_HUCK.field; id++) {
      const early = rivalHits(7, id, 60);
      const all = rivalHits(7, id, KNUCKLE_HUCK.jam);
      expect(rivalHits(7, id, KNUCKLE_HUCK.jam)).toEqual(all);
      expect(all.slice(0, early.length)).toEqual(early);
      expect(all.length).toBeGreaterThanOrEqual(KNUCKLE_HUCK.jam / JAM_FIELD.gap[1] - 1);
    }
  });

  it("ranks the board best first, the player in it", () => {
    const board = jamBoard(7, [hit(70, "a"), hit(70, "b"), hit(70, "c")], KNUCKLE_HUCK.jam);
    expect(board).toHaveLength(KNUCKLE_HUCK.field + 1);
    expect(board.some((r) => r.id === -1)).toBe(true);
    for (let i = 1; i < board.length; i++)
      expect(board[i - 1].score).toBeGreaterThanOrEqual(board[i].score);
  });
});

describe("the bot's session", () => {
  it("rides hit after hit off the knuckle and lands them, to the buzzer", () => {
    const state = createGame({
      seed: 1,
      mode: "knuckleHuck",
      spec: skisById("hare"),
      countdown: 0,
      quiet: true,
    });
    let harsh = 0;
    let wipeouts = 0;
    for (let i = 0; i < (KNUCKLE_HUCK.jam + 5) * 120 && !state.jam?.closed; i++) {
      step(state, botInput(state));
      for (const e of state.events) {
        if (e.kind === "land" && e.harsh) harsh += 1;
        if (e.kind === "wipeout") wipeouts += 1;
      }
    }
    const jam = state.jam;
    expect(jam?.closed).toBe(true);
    expect(jam!.hits.length).toBeGreaterThanOrEqual(8);
    expect(jam!.hits.every((h) => !h.fell)).toBe(true);
    expect(jam!.hits.every((h) => h.trick !== null && readTrick(h.trick).butter !== null)).toBe(
      true,
    );
    expect(harsh).toBe(0);
    expect(wipeouts).toBe(0);
  });
});
