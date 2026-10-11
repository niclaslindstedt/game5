// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CHALLENGE BOOK AND ITS RIG (`pwa/src/game/challenge-book.ts`,
// `challenge-run.ts`, `challenge-hud.ts`): a medal only ever replacing a
// worse one and a better value on the same medal kept, what is found kept
// found, a stored blob trusted no further than the rig could have written
// it, the medals totalled — and the rig over a free ride: judged only when
// the player rides it, its news, its book filed at once, the HUD's chip and
// plate, the minimap's marks (a hidden spot never before it is found) and
// the pause card's rows — and what stands on the snow for them
// (`challenge-flags-plan.ts`).

import { describe, expect, it } from "vitest";

import {
  createGame,
  dealChallenges,
  dealtRuns,
  isLine,
  isSpots,
  isSummits,
  isTrick,
  trackPointAt,
  TUNING,
  type ChallengeEvent,
  type GameState,
  type LineChallenge,
} from "@engine";
import {
  emptyChallenges,
  entryOf,
  fileResult,
  medalTally,
  memoryOf,
  readChallenges,
  type ChallengeBook,
} from "../pwa/src/game/challenge-book.ts";
import { createChallengeRig, readEvents } from "../pwa/src/game/challenge-run.ts";
import {
  challengeMarks,
  challengeRows,
  challengeTile,
  medalInReach,
  PLATE_HOLD,
} from "../pwa/src/game/challenge-hud.ts";
import { CHALLENGE_FLAG, planFlags } from "../pwa/src/game/challenge-flags-plan.ts";
import { levelFor } from "./support/levels.ts";

const LINE = {
  id: "line:4:1",
  medals: { gold: 50, silver: 60, bronze: 80 },
  better: "lower" as const,
};
const COUNT = {
  id: "spots",
  medals: { bronze: 2, silver: 4, gold: 5 },
  better: "higher" as const,
};

describe("the challenge book", () => {
  it("files a medal over a worse one and never under it", () => {
    let book = emptyChallenges();
    let r = fileResult(book, "m", LINE, { id: LINE.id, value: 70 }, 1);
    expect(r.filed).toBe("new");
    book = r.book;
    expect(entryOf(book, "m", LINE.id)).toMatchObject({ medal: "bronze", value: 70 });
    r = fileResult(book, "m", LINE, { id: LINE.id, value: 55 }, 2);
    expect(r.filed).toBe("medal");
    book = r.book;
    expect(entryOf(book, "m", LINE.id)).toMatchObject({ medal: "silver", value: 55, at: 2 });
    // A worse run changes nothing; a better time on the same medal is kept.
    expect(fileResult(book, "m", LINE, { id: LINE.id, value: 75 }, 3).filed).toBeNull();
    r = fileResult(book, "m", LINE, { id: LINE.id, value: 52 }, 4);
    expect(r.filed).toBe("value");
    expect(entryOf(r.book, "m", LINE.id)).toMatchObject({ medal: "silver", value: 52 });
  });

  it("keeps a time too slow for a medal only until there is one", () => {
    let r = fileResult(emptyChallenges(), "m", LINE, { id: LINE.id, value: 95 }, 1);
    expect(entryOf(r.book, "m", LINE.id)).toMatchObject({ medal: null, value: 95 });
    r = fileResult(r.book, "m", LINE, { id: LINE.id, value: 90 }, 2);
    expect(r.filed).toBe("value");
    r = fileResult(r.book, "m", LINE, { id: LINE.id, value: 79 }, 3);
    expect(r.filed).toBe("medal");
    expect(fileResult(r.book, "m", LINE, { id: LINE.id, value: 85 }, 4).filed).toBeNull();
  });

  it("adds what is found to what was found, and reads the medal off the count", () => {
    let book: ChallengeBook = emptyChallenges();
    for (const [i, id] of ["s2", "s1", "s2", "s3", "s4"].entries())
      book = fileResult(book, "m", COUNT, { id: "spots", found: [id] }, i).book;
    const e = entryOf(book, "m", "spots")!;
    expect(e.found).toEqual(["s1", "s2", "s3", "s4"]);
    expect(e.value).toBe(4);
    expect(e.medal).toBe("silver");
    expect(memoryOf(book, "m").found).toEqual({ spots: ["s1", "s2", "s3", "s4"] });
    expect(memoryOf(book, "other").found).toEqual({});
  });

  it("reads a stored blob no further than the rig could have written it", () => {
    expect(readChallenges(null)).toEqual(emptyChallenges());
    expect(readChallenges({ v: 2, maps: {} })).toEqual(emptyChallenges());
    const book = readChallenges({
      v: 1,
      maps: {
        a: {
          good: { medal: "gold", value: 40, at: 5 },
          found: { medal: "tin", found: ["s1", 3, "s1"], at: "x" },
          bad: { medal: "gold", value: -1 },
          junk: 7,
        },
        empty: {},
        b: { x: { medal: "bronze", value: 3 } },
      },
    });
    expect(Object.keys(book.maps).sort()).toEqual(["a", "b"]);
    expect(book.maps.a.good).toEqual({ medal: "gold", value: 40, at: 5 });
    expect(book.maps.a.found).toEqual({ medal: null, found: ["s1"], at: 0 });
    expect(book.maps.a.bad).toEqual({ medal: "gold", at: 0 });
    expect(book.maps.a.junk).toBeUndefined();
    expect(medalTally(book)).toEqual({ gold: 2, silver: 0, bronze: 1 });
    // The book round-trips through JSON.
    expect(readChallenges(JSON.parse(JSON.stringify(book)))).toEqual(book);
  });

  it("names the medal still in reach", () => {
    const m = LINE.medals;
    expect(medalInReach(10, m)).toEqual({ medal: "gold", time: 50 });
    expect(medalInReach(50.5, m)).toEqual({ medal: "silver", time: 60 });
    expect(medalInReach(79, m)).toEqual({ medal: "bronze", time: 80 });
    expect(medalInReach(81, m)).toBeNull();
  });
});

/** A store in memory. */
function memoryStore(book = emptyChallenges()) {
  const store = {
    book,
    saves: 0,
    load: () => store.book,
    save: (b: ChallengeBook) => {
      store.book = b;
      store.saves++;
    },
    now: () => 1_700_000_000_000,
  };
  return store;
}

/** Ski the skier down `line`'s run from before its start to past its
 * finish, stepping the rig; every line it said. */
function skiLine(
  state: GameState,
  rig: ReturnType<typeof createChallengeRig>,
  line: LineChallenge,
) {
  const run = dealtRuns(state.level).find((r) => r.id === line.run)!;
  const said: string[] = [];
  for (let s = line.start.s - 10; s <= line.finish.s + 5; s += 14 * TUNING.dt) {
    const p = trackPointAt(run, s);
    state.t += TUNING.dt;
    state.tick += 1;
    state.events.length = 0;
    state.skier.x = p.x;
    state.skier.z = p.z;
    said.push(...rig.step(state).map((l) => l.text));
  }
  return said;
}

describe("the challenges' rig", () => {
  const level = levelFor(38);
  const plan = dealChallenges(level);
  const line = plan.challenges.find(isLine)!;

  it("judges only a free ride the player rides", () => {
    const store = memoryStore();
    const rig = createChallengeRig(store);
    for (const [mode, rides] of [
      ["slalom", true],
      ["free", false],
    ] as const) {
      const state = createGame({ level, countdown: 0, quiet: true });
      rig.arm(state, mode, rides);
      expect(challengeTile(state)).toBeNull();
      expect(challengeRows(state)).toBeNull();
      expect(challengeMarks(state)).toBeNull();
      expect(skiLine(state, rig, line)).toEqual([]);
    }
  });

  it("says a line's start, its split and its finish, files it at once and shows chip and plate", () => {
    const store = memoryStore();
    const rig = createChallengeRig(store);
    const state = createGame({ level, countdown: 0, quiet: true });
    rig.arm(state, "free", true);
    expect(challengeRows(state)!.length).toBe(plan.challenges.length);
    const said = skiLine(state, rig, line);
    expect(said[0]).toMatch(/^LINE RUN \d+ · G /);
    expect(said.some((s) => s.startsWith("HALF WAY"))).toBe(true);
    const done =
      said.find((s) => s.startsWith("LINE RUN") && s !== said[0]) ??
      said.find((s) => s.includes("NO MEDAL"));
    expect(done).toBeDefined();
    expect(store.saves).toBe(1);
    const entry = entryOf(store.book, plan.key, line.id)!;
    expect(entry.value).toBeGreaterThan(0);
    const tile = challengeTile(state)!;
    expect(tile.chip).toBeNull();
    expect(tile.plate).toMatchObject({ id: line.id, kind: "line", filed: "new" });
    const row = challengeRows(state)!.find((r) => r.id === line.id)!;
    expect(row.held).not.toBeNull();
    expect(row.run).toBe(line.run);
    expect(row.bars.map((b) => b.medal)).toEqual(["gold", "silver", "bronze"]);
    // The plate goes after its hold.
    state.t += PLATE_HOLD + 0.1;
    expect(challengeTile(state)).toBeNull();
  });

  it("shows the chip while a line runs, its finish lit on the minimap", () => {
    const rig = createChallengeRig(memoryStore());
    const state = createGame({ level, countdown: 0, quiet: true });
    rig.arm(state, "free", true);
    const run = dealtRuns(level).find((r) => r.id === line.run)!;
    for (const s of [line.start.s - 3, line.start.s + 3, line.start.s + 10]) {
      const p = trackPointAt(run, s);
      state.t += TUNING.dt;
      state.events.length = 0;
      state.skier.x = p.x;
      state.skier.z = p.z;
      rig.step(state);
    }
    const chip = challengeTile(state)!.chip!;
    expect(chip.run).toMatch(/^RUN \d+$/);
    expect(chip.reach?.medal).toBe("gold");
    expect(chip.share).toBeGreaterThan(0);
    const marks = challengeMarks(state)!;
    const lit = marks.gates.filter((g) => g.live);
    expect(lit).toEqual([expect.objectContaining({ id: line.id, role: "finish" })]);
    expect(marks.gates.length).toBe(plan.challenges.filter(isLine).length * 2);
    expect(marks.kickers.length).toBe(plan.challenges.filter(isTrick).length);
  });

  it("marks a hidden spot only once it is found, and a summit only until it is", () => {
    const spots = plan.challenges.find(isSpots)!;
    const summits = plan.challenges.find(isSummits)!;
    const rig = createChallengeRig(memoryStore());
    const state = createGame({ level, countdown: 0, quiet: true });
    rig.arm(state, "free", true);
    expect(challengeMarks(state)!.spots).toEqual([]);
    expect(challengeMarks(state)!.summits.length).toBe(summits.tops.length);
    const events: ChallengeEvent[] = [
      { kind: "found", id: "spots", t: 1, what: spots.spots[0].id, value: 1 },
      { kind: "found", id: "summits", t: 1, what: summits.tops[0].lift, value: 1 },
    ];
    const r = readEvents(level, plan, emptyChallenges(), events, 5);
    expect(r.lines.map((l) => l.text)).toEqual([
      expect.stringMatching(new RegExp(`^HIDDEN SPOT 1/${spots.spots.length} · `)),
      `SUMMIT 1/${summits.tops.length}`,
    ]);
    // Stood up again on what that filed, the mark shows and the top goes.
    const again = createChallengeRig(memoryStore(r.book));
    const next = createGame({ level, countdown: 0, quiet: true });
    again.arm(next, "free", true);
    const marks = challengeMarks(next)!;
    expect(marks.spots).toEqual([{ x: spots.spots[0].x, z: spots.spots[0].z }]);
    expect(marks.summits.length).toBe(summits.tops.length - 1);
    expect(challengeRows(next)!.find((row) => row.id === "spots")!.name).toBe(
      `HIDDEN SPOTS 1/${spots.spots.length}`,
    );
  });

  it("says a medal won for the book, a trick's goal and a void", () => {
    const trick = plan.challenges.find(isTrick)!;
    const events: ChallengeEvent[] = [
      { kind: "done", id: trick.id, t: 2, value: 2, medal: "silver" },
      { kind: "void", id: line.id, t: 3, why: "fall" },
      { kind: "done", id: line.id, t: 4, value: line.medals.bronze + 3, medal: null },
    ];
    const r = readEvents(level, plan, emptyChallenges(), events, 5);
    const texts = r.lines.map((l) => l.text);
    expect(texts[0]).toMatch(/^KICKER · .* · SILVER$/);
    expect(texts[1]).toMatch(/SILVER MEDAL · KICKER · /);
    expect(texts).toContain("LINE OFF · FELL");
    expect(texts.some((t) => t.includes("NO MEDAL, +3.0 S TO BRONZE"))).toBe(true);
    expect(r.plate).toMatchObject({ id: line.id, medal: null, gap: 3 });
    expect(entryOf(r.book, plan.key, trick.id)).toMatchObject({ medal: "silver", value: 2 });
  });
});

describe("the challenges on the snow", () => {
  const level = levelFor(38);
  const plan = dealChallenges(level);
  const flags = planFlags(level, plan);

  it("plants two feather flags and two timing posts at every line's start and finish", () => {
    const lines = plan.challenges.filter(isLine);
    expect(flags.flags.length).toBe(lines.length * 4);
    expect(flags.sensors.length).toBe(lines.length * 4);
    expect(flags.dyes.length).toBe(lines.length * 2);
    for (const c of lines) {
      for (const role of ["start", "finish"] as const) {
        const g = c[role];
        const own = flags.flags.filter((f) => f.id === c.id && f.role === role);
        expect(own).toHaveLength(2);
        for (const f of own) {
          // Outside the run's edge, never on its snow, and sunk into the ground.
          const across = Math.abs(
            (f.x - g.x) * Math.cos(g.heading) - (f.z - g.z) * Math.sin(g.heading),
          );
          expect(across).toBeGreaterThan(g.width / 2 + 0.5);
          expect(f.y).toBeLessThan(level.groundAt(f.x, f.z));
          expect(f.y).toBeGreaterThan(level.groundAt(f.x, f.z) - 0.2);
        }
      }
    }
  });

  it("stands a kicker's pennant off its side and a pennant over every hidden spot", () => {
    const tricks = plan.challenges.filter(isTrick);
    expect(flags.kickers).toHaveLength(tricks.length);
    for (const t of tricks) {
      const p = flags.kickers.find((k) => k.id === t.id)!;
      const k = t.kicker;
      const across = Math.abs(
        (p.x - k.x) * Math.cos(k.heading) - (p.z - k.z) * Math.sin(k.heading),
      );
      expect(across).toBeCloseTo(k.width / 2 + CHALLENGE_FLAG.pennant.out, 3);
    }
    const spots = plan.challenges.find(isSpots);
    expect(flags.spots).toHaveLength(spots?.spots.length ?? 0);
  });
});
