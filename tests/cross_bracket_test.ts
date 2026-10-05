// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI CROSS'S FORMAT (R35, `engine/game/cross-bracket.ts`): the
// qualification ranked, the bracket of heats of four it seeds, the first two
// of each heat through, the small and the big final, a heat the player is
// not in dealt the same every time, and the final ranking.
import { describe, expect, it } from "vitest";

import {
  CROSS_ROUNDS,
  QUARTERS,
  SKI_CROSS,
  advance,
  bracketDone,
  crossStandings,
  dealHeat,
  finalPlace,
  heatsOf,
  nextHeat,
  placeOrder,
  qualified,
  qualify,
  type Bracket,
  type CrossPlace,
  type CrossResult,
  type FieldRun,
} from "@engine";

const SEED = 7;

/** A board of the start list: racer `id` home in 60 + id/10 s, the ones in
 * `out` out at gate 3. */
function board(out: number[] = []): FieldRun[] {
  return Array.from({ length: SKI_CROSS.field }, (_, id) => ({
    id,
    skis: "wolverine",
    time: out.includes(id) ? null : 60 + id / 10,
    out: out.includes(id) ? { status: "dnf", why: "fall", gate: 3 } : null,
    splits: [],
    before: 0,
    trap: null,
  }));
}

/** The player qualified at `time`. */
function bracketAt(time: number, out: number[] = []): Bracket {
  return qualify(SEED, { time, out: null, gates: 0 }, board(out));
}

/** The player's heat raced to `place` (1-based), the others behind him in
 * seed order. */
function raced(b: Bracket, place: number): CrossResult {
  const heat = nextHeat(b);
  if (!heat) throw new Error("no heat");
  const others = heat.racers.filter((e) => e.id !== null);
  const me = heat.racers.find((e) => e.id === null);
  if (!me) throw new Error("not in it");
  const order = [...others];
  order.splice(place - 1, 0, me);
  return {
    heat,
    order: order.map((entry, i) => ({ entry, time: 60 + i, out: null, gates: Infinity })),
  };
}

describe("the qualification", () => {
  it("ranks every racer home by time, the out after them by how far they got", () => {
    const b = bracketAt(60.55, [2, 5]);
    expect(b.ranked).toHaveLength(SKI_CROSS.field + 1);
    // Home between racer 5's and racer 6's times, two of the first six out.
    expect(b.ranked.findIndex((e) => e.id === null) + 1).toBe(5);
    expect(b.ranked.slice(-2).map((e) => e.id)).toEqual([5, 2]);
    expect(b.ranked.map((e) => e.rank)).toEqual(b.ranked.map((_, i) => i + 1));
  });

  it("goes to the later starter on a tie — the player, who starts last", () => {
    const b = bracketAt(60.3);
    expect(b.ranked.findIndex((e) => e.id === null)).toBeLessThan(
      b.ranked.findIndex((e) => e.id === 3),
    );
  });

  it("puts the best sixteen in the bracket, and no one else", () => {
    expect(qualified(bracketAt(61.45))).toBe(true);
    expect(qualified(bracketAt(61.55))).toBe(false);
    expect(nextHeat(bracketAt(65))).toBeNull();
    const out = qualify(
      SEED,
      { time: null, out: { status: "dnf", why: "fall", gate: 2 }, gates: 2 },
      board(),
    );
    expect(qualified(out)).toBe(false);
  });
});

describe("the bracket", () => {
  it("seeds the quarter-finals the standard way, every racer once", () => {
    const b = bracketAt(59);
    const heats = heatsOf(b, "quarter")!;
    expect(heats).toHaveLength(4);
    expect(heats.map((h) => h.racers.map((e) => e.rank))).toEqual(QUARTERS.map((q) => [...q]));
    const all = heats.flatMap((h) => h.racers.map((e) => e.rank)).sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    // The best two seeds can meet only in the final.
    expect(Math.floor(heats.findIndex((h) => h.racers.some((e) => e.rank === 1)) / 2)).not.toBe(
      Math.floor(heats.findIndex((h) => h.racers.some((e) => e.rank === 2)) / 2),
    );
  });

  it("has no semi-final until the quarter-finals are raced", () => {
    expect(heatsOf(bracketAt(59), "semi")).toBeNull();
  });

  it("takes the first two of each heat on, through to the big final", () => {
    let b = bracketAt(59);
    for (const round of ["quarter", "semi", "final"] as const) {
      const heat = nextHeat(b)!;
      expect(heat.round).toBe(round);
      expect(heat.racers).toHaveLength(SKI_CROSS.heat);
      // Lanes are chosen in seed order.
      expect(heat.racers.map((e) => e.rank)).toEqual(
        [...heat.racers.map((e) => e.rank)].sort((x, y) => x - y),
      );
      b = advance(b, raced(b, 2));
    }
    expect(nextHeat(b)).toBeNull();
    expect(bracketDone(b)).toBe(true);
    expect(finalPlace(b)).toBe(2);
    // The small final was raced beside the big one.
    expect(b.results.some((r) => r.heat.round === "small")).toBe(true);
  });

  it("sends a semi-final's third to the small final", () => {
    let b = bracketAt(59);
    b = advance(b, raced(b, 1));
    b = advance(b, raced(b, 3));
    expect(nextHeat(b)?.round).toBe("small");
    b = advance(b, raced(b, 1));
    expect(finalPlace(b)).toBe(5);
  });

  it("deals the whole bracket to its end once the player is out of it", () => {
    let b = bracketAt(59);
    b = advance(b, raced(b, 4));
    expect(nextHeat(b)).toBeNull();
    expect(CROSS_ROUNDS.every((r) => b.results.some((x) => x.heat.round === r))).toBe(true);
    // Fourth of a quarter-final: thirteenth to sixteenth.
    expect(finalPlace(b)).toBeGreaterThanOrEqual(13);
    expect(finalPlace(b)).toBeLessThanOrEqual(16);
    const ranking = crossStandings(b);
    expect(ranking).toHaveLength(SKI_CROSS.field + 1);
    expect(new Set(ranking.map((e) => e.id)).size).toBe(ranking.length);
  });

  it("deals a heat the same every time, off the race's seed", () => {
    const heat = heatsOf(bracketAt(59), "quarter")![2];
    expect(dealHeat(SEED, heat)).toEqual(dealHeat(SEED, heat));
    expect(dealHeat(SEED, heat).order).toHaveLength(4);
  });
});

describe("a heat's order", () => {
  const entry = (rank: number) => ({ id: rank, rank });
  const place = (rank: number, p: Partial<CrossPlace>): CrossPlace => ({
    entry: entry(rank),
    time: null,
    out: null,
    gates: Infinity,
    ...p,
  });

  it("is home by time, then the out by gates taken, the disqualified last — a tie to the better seed", () => {
    const order = placeOrder([
      place(4, { out: { status: "dsq", why: "contact", gate: 5 }, gates: 9 }),
      place(3, { out: { status: "dnf", why: "fall", gate: 6 }, gates: 6 }),
      place(2, { time: 61 }),
      place(1, { out: { status: "dnf", why: "fall", gate: 6 }, gates: 6 }),
    ]);
    expect(order.map((p) => p.entry.rank)).toEqual([2, 1, 3, 4]);
    expect(
      placeOrder([place(5, { time: 60 }), place(1, { time: 60 })]).map((p) => p.entry.rank),
    ).toEqual([1, 5]);
  });
});
