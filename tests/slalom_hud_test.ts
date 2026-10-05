// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLALOM ON THE HUD — what a slalom's readouts and plate are worked out
// FROM, read without a browser: the board of the field skied before the
// player (`slalom-board.ts`, `snapshot.ts`'s `standingsOf`), an out run that
// is no finish, the starter's small word in place of the big lights, the
// intermediates against the leader, the run, the second run and its heat
// (`slalom-heat.ts`, `pinned-run.ts`), the record kept per run
// (`records.ts`), and the news and the pulse a pole and an out earn.

import { describe, expect, it } from "vitest";

import {
  SLALOM,
  TUNING,
  createGame,
  setSlalom,
  skisById,
  startNumbers,
  step,
  withDay,
  NEUTRAL_INPUT,
  type GameEvent,
  type GameState,
} from "@engine";

import { secondRunAgain } from "../pwa/src/game/pinned-run.ts";
import { recordId, runKey } from "../pwa/src/game/records.ts";
import { recipeOf } from "../pwa/src/game/replay.ts";
import { rumbleForEvent } from "../pwa/src/game/rumble.ts";
import { newsFor, POLE_SAID } from "../pwa/src/game/run-news.ts";
import { createNewsFeed } from "../pwa/src/game/run-watch.ts";
import {
  TIMING_HOLD,
  boardOf,
  leaderOf,
  playerBib,
  timingGates,
  timingSplit,
} from "../pwa/src/game/slalom-board.ts";
import { heatAfter, heatOf, secondRunOf } from "../pwa/src/game/slalom-heat.ts";
import { standingsOf, takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const BASE = syntheticLevel();
const SWIFT = skisById("swift");

/** A slalom's first run on the slope, the board dealt. */
function slalom(): GameState {
  return createGame({ level: BASE, seed: 5, mode: "slalom", spec: SWIFT, quiet: true });
}

/** The player home in `time` (or out, with `out`). */
function home(state: GameState, time: number): GameState {
  const p = state.progress;
  p.started = true;
  p.finished = true;
  p.time = time;
  state.phase = "finished";
  return state;
}

/** The field's home times, best first. */
function homeTimes(state: GameState): number[] {
  return state
    .field!.runs.filter((r) => r.time !== null)
    .map((r) => r.time!)
    .sort((a, b) => a - b);
}

describe("the board (slalom-board.ts, snapshot.ts)", () => {
  it("reads the field, never the rivals: every racer by start number, the player last of the first run", () => {
    const state = home(slalom(), 0);
    state.progress.time = homeTimes(state)[2] + 0.01;
    expect(state.rivals).toHaveLength(0);
    const rows = standingsOf(state);
    expect(rows).toHaveLength(SLALOM.field + 1);
    expect(new Set(rows.map((r) => r.bib)).size).toBe(SLALOM.field + 1);
    expect(rows.find((r) => r.you)!.bib).toBe(playerBib(state));
    expect(playerBib(state)).toBe(SLALOM.field + 1);
    // The start numbers are the first run's order.
    const bibs = startNumbers(state.seed, SLALOM.field);
    state.field!.runs.forEach((r, i) => expect(bibs[r.id]).toBe(i + 1));
    // Home first, by time and numbered; the player fourth; the gap to the
    // leader 0 at the top and growing down the sheet.
    const placed = rows.filter((r) => r.place !== null);
    expect(placed.map((r) => r.place)).toEqual(placed.map((_, i) => i + 1));
    expect(rows.findIndex((r) => r.you)).toBe(3);
    expect(placed[0].gap).toBe(0);
    for (let i = 1; i < placed.length; i++)
      expect(placed[i].total!).toBeGreaterThanOrEqual(placed[i - 1].total!);
    // The racers out of it last, with how, and no place.
    const outs = rows.filter((r) => r.out);
    expect(outs.length).toBeGreaterThan(0);
    expect(rows.slice(-outs.length).every((r) => r.out && r.place === null)).toBe(true);
    // Places by `fieldPlace`, which the snapshot bills.
    expect(takeSnapshot(state).result!.place).toBe(4);
    expect(takeSnapshot(state).skiers).toBe(SLALOM.field + 1);
  });

  it("an out run is no finish: no result, the plate's verdict, the board under it", () => {
    const state = home(slalom(), 30);
    state.progress.out = { status: "dsq", why: "straddle", gate: 7 };
    const snap = takeSnapshot(state);
    expect(snap.finished).toBe(true);
    expect(snap.result).toBe(null);
    expect(snap.race!.out).toEqual({ status: "dsq", why: "straddle", gate: 7 });
    expect(snap.standings).not.toBe(null);
    const mine = snap.standings!.find((r) => r.you)!;
    expect(mine.place).toBe(null);
    expect(mine.out?.why).toBe("straddle");
    expect(snap.race!.second).toEqual({ kind: "out" });
    // The gates he had taken, never the whole course.
    expect(snap.taken).toBeLessThan(snap.gates);
  });

  it("on the second run bills the first run's time and the total, and the racers still to come down as waiting", () => {
    const first = home(slalom(), 0);
    first.progress.time = homeTimes(first)[1] + 0.01;
    const heat = heatAfter(first)!;
    const second = createGame({ ...recipeOf(first, "slalom"), heat });
    expect(second.field!.run).toBe(2);
    const f = second.field!;
    // Third after the first run: two go after him.
    expect(f.runs.length - f.slot).toBe(2);
    const live = boardOf(second);
    const waiting = live.filter((r) => r.waiting);
    expect(waiting).toHaveLength(2);
    expect(live.slice(-2).every((r) => r.waiting)).toBe(true);
    home(second, 50);
    const done = boardOf(second);
    expect(done.some((r) => r.waiting)).toBe(false);
    const mine = done.find((r) => r.you)!;
    expect(mine.before).toBeCloseTo(heat.player, 9);
    expect(mine.total).toBeCloseTo(heat.player + 50, 9);
    for (const r of done.filter((d) => !d.you && d.total !== null))
      expect(r.total).toBeCloseTo(r.before! + r.time!, 9);
  });
});

describe("the starter and the intermediates (snapshot.ts)", () => {
  it("leaves the big lights to the line start: READY, then GO until a moment after the wand", () => {
    const state = slalom();
    const at = takeSnapshot(state);
    expect(at.countdown).toBe(0);
    expect(at.go).toBe(false);
    expect(at.race!.word).toBe("ready");
    expect(at.race!.run).toBe(1);
    expect(at.race!.runs).toBe(2);
    const steps = Math.round((state.rules.countdown + 0.2) * TUNING.physicsHz);
    for (let i = 0; i < steps; i++) step(state, NEUTRAL_INPUT);
    // GO while he is held in the house...
    expect(takeSnapshot(state).race!.word).toBe("go");
    // ...and gone once he is a while out of it.
    state.progress.started = true;
    state.progress.time = 2;
    expect(takeSnapshot(state).race!.word).toBe(null);
    // Any other run keeps the big lights.
    const race = createGame({ level: BASE, seed: 5, quiet: true });
    expect(takeSnapshot(race).countdown).toBeGreaterThan(0);
    expect(takeSnapshot(race).race).toBe(null);
  });

  it("times two intermediates near a third and two thirds of the course", () => {
    const state = slalom();
    const cps = state.level.checkpoints;
    const gates = timingGates(state.level);
    expect(gates).toHaveLength(2);
    const from = cps[0].s;
    const span = cps[cps.length - 1].s - from;
    expect(gates[0]).toBeGreaterThan(0);
    expect(gates[1]).toBeLessThan(cps.length - 1);
    expect((cps[gates[0]].s - from) / span).toBeCloseTo(1 / 3, 0);
    expect((cps[gates[1]].s - from) / span).toBeCloseTo(2 / 3, 0);
  });

  it("shows the intermediate against the leader while it is fresh, and not gate by gate", () => {
    const state = slalom();
    const p = state.progress;
    const [g1] = timingGates(state.level);
    const leader = leaderOf(state.field!)!;
    p.started = true;
    state.phase = "racing";
    p.splits[g1 - 1] = leader.splits[g1 - 1];
    p.lastCheckpoint = g1 - 1;
    p.time = p.splits[g1 - 1] + 0.1;
    expect(timingSplit(state)).toBe(null);
    expect(takeSnapshot(state).split).toBe(null);
    p.splits[g1] = leader.splits[g1] - 0.25;
    p.lastCheckpoint = g1;
    p.time = p.splits[g1] + 0.5;
    const t = takeSnapshot(state).race!.timing!;
    expect(t.point).toBe(1);
    expect(t.time).toBe(p.splits[g1]);
    expect(t.gap).toBeCloseTo(-0.25, 9);
    p.time = p.splits[g1] + TIMING_HOLD + 0.1;
    expect(timingSplit(state)).toBe(null);
  });
});

describe("the second run (slalom-heat.ts, pinned-run.ts)", () => {
  it("is offered to a finisher inside the qualifying places, never to one out of the first", () => {
    const state = slalom();
    expect(secondRunOf(state)).toBe(null);
    home(state, homeTimes(state)[0] - 1);
    expect(secondRunOf(state)).toEqual({ kind: "go", place: 1 });
    state.progress.out = { status: "dnf", why: "fall", gate: 4 };
    expect(secondRunOf(state)).toEqual({ kind: "out" });
    expect(heatAfter(state)).toBe(null);
  });

  it("hands the first run over as the heat, and reads the same heat back off the second", () => {
    const first = home(slalom(), 0);
    first.progress.time = homeTimes(first)[4] + 0.01;
    const heat = heatAfter(first)!;
    expect(heat).toMatchObject({ run: 2, player: first.progress.time });
    expect(heatOf(first)).toBeUndefined();
    const second = createGame({ ...recipeOf(first, "slalom"), heat });
    expect(second.level.slalom?.run).toBe(2);
    const back = heatOf(second)!;
    const again = createGame({ level: second.level, seed: 5, mode: "slalom", heat: back });
    expect(again.field).toEqual(second.field);
    // No second run is offered after the second.
    expect(secondRunOf(home(second, 40))).toBe(null);
  });

  it("restarts a second run as the second run, on the very map the renderer holds", () => {
    const first = home(slalom(), 0);
    first.progress.time = homeTimes(first)[0] + 0.5;
    const second = createGame({ ...recipeOf(first, "slalom"), heat: heatAfter(first)! });
    const again = secondRunAgain(second)!;
    expect(again.level).toBe(second.level);
    expect(again.field).toEqual(second.field);
    expect(secondRunAgain(first)).toBe(null);
    // A first run stood up again stands on its own map too.
    expect(createGame({ level: first.level, seed: 5, mode: "slalom" }).level).toBe(first.level);
  });

  it("sets the second run under the first run's sun", () => {
    const run1 = withDay(setSlalom(BASE, 1), { hour: 15.5 });
    const run2 = setSlalom(run1, 2);
    expect(run2.slalom?.run).toBe(2);
    expect(run2.sun.hour).toBe(run1.sun.hour);
    expect(setSlalom(run2, 2)).toBe(run2);
  });
});

describe("the record book per run (records.ts)", () => {
  it("files a second run under a row of its own, and every other run under the id it had", () => {
    const key = { seed: 38, skis: "swift" as const, mode: "slalom" as const, laps: 1 };
    expect(recordId(key)).toBe("slalom/38/swift/1");
    expect(recordId({ ...key, run: 1 })).toBe(recordId(key));
    expect(recordId({ ...key, run: 2 })).not.toBe(recordId(key));
    const first = home(slalom(), 0);
    first.progress.time = homeTimes(first)[0] - 1;
    expect(runKey(first, "slalom").run).toBeUndefined();
    const second = createGame({ ...recipeOf(first, "slalom"), heat: heatAfter(first)! });
    expect(runKey(second, "slalom").run).toBe(2);
    expect(recordId(runKey(second, "slalom"))).toBe(`${recordId(runKey(first, "slalom"))}/run2`);
  });
});

describe("what a slalom says and is felt (run-news.ts, run-watch.ts, rumble.ts)", () => {
  const pole = (speed: number, t = 1): GameEvent => ({ kind: "pole", t, gate: 5, speed });

  it("bills a pole driven over, never a brush, and then keeps quiet a while", () => {
    const state = slalom();
    expect(newsFor(pole(POLE_SAID - 1), state)).toBe(null);
    expect(newsFor(pole(POLE_SAID + 1), state)?.text).toContain("5");
    const feed = createNewsFeed();
    state.events = [pole(POLE_SAID + 2)];
    expect(feed.step(state)).toHaveLength(1);
    state.t += 1;
    expect(feed.step(state)).toHaveLength(0);
    state.t += 10;
    expect(feed.step(state)).toHaveLength(1);
  });

  it("says a disqualification and a fall, and why", () => {
    const state = slalom();
    const dsq = newsFor(
      { kind: "out", t: 1, out: { status: "dsq", why: "missed", gate: 9 } },
      state,
    );
    expect(dsq?.tone).toBe("bad");
    expect(dsq?.text).toContain("9");
    const dnf = newsFor({ kind: "out", t: 1, out: { status: "dnf", why: "fall", gate: 3 } }, state);
    expect(dnf?.text).not.toBe(dsq?.text);
  });

  it("bills only the intermediates, and the finish against the whole board", () => {
    const state = slalom();
    const [g1] = timingGates(state.level);
    const cp = (index: number): GameEvent => ({
      kind: "checkpoint",
      t: 1,
      index,
      lap: 0,
      split: 9,
    });
    expect(newsFor(cp(g1 - 1), state)).toBe(null);
    expect(newsFor(cp(g1), state)).not.toBe(null);
    const fin = newsFor({ kind: "finish", t: 1, time: 50, place: 3 }, state)!;
    expect(fin.text).toContain(String(SLALOM.field + 1));
  });

  it("puts a knock in the hands for a pole, sized by how hard", () => {
    const soft = rumbleForEvent(pole(3))!;
    const hard = rumbleForEvent(pole(12))!;
    expect(soft.strength).toBeLessThan(hard.strength);
    expect(hard.strength).toBeLessThan(1);
  });
});
