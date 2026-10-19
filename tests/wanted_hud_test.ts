// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WANTED LEVEL AS THE HUD READS IT (`wanted-tile.ts`), the survival
// highscore's book (`survival-book.ts`) and the news a hunt makes
// (`run-news.ts`) — DOM-free, so headless.

import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  TUNING,
  WANTED,
  createGame,
  raiseHeat,
  step,
  type GameState,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";
import { LOST_HOLD, wantedTile } from "../pwa/src/game/wanted-tile.ts";
import { readSurvival, withSurvival } from "../pwa/src/game/survival-book.ts";
import { newsFor } from "../pwa/src/game/run-news.ts";
import { overLink, readParams } from "../pwa/src/game/url-params.ts";

function ride(wanted?: number): GameState {
  return createGame({
    level: flatLevel(),
    mode: "free",
    quiet: true,
    crowd: 0,
    army: false,
    wanted,
  });
}

function run(state: GameState, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / TUNING.dt); i++) step(state, NEUTRAL_INPUT);
}

describe("the tile", () => {
  it("is null on a run the army never hunted", () => {
    expect(wantedTile(ride())).toBeNull();
  });

  it("lights the stars solid while they have him, and flashes them while they search", () => {
    const s = ride(3);
    run(s, 1);
    expect(wantedTile(s)).toMatchObject({ stars: 3, of: 5, flashing: false, ended: null });
    run(s, WANTED.fix);
    expect(wantedTile(s)!.flashing).toBe(true);
    expect(wantedTile(s)!.survived).toBeCloseTo(WANTED.fix + 1, 1);
  });

  it("holds the stopped timer a few seconds after he lost them, then goes", () => {
    const s = ride(1);
    run(s, WANTED.fix + WANTED.lose[1] + 0.5);
    const tile = wantedTile(s)!;
    expect(tile.ended).toBe("escaped");
    expect(tile.flashing).toBe(false);
    run(s, LOST_HOLD + 1);
    expect(wantedTile(s)).toBeNull();
  });
});

describe("the survival book", () => {
  it("reads only what it trusts", () => {
    expect(readSurvival(null)).toEqual({ best: 0, stars: 0 });
    expect(readSurvival({ best: "x", stars: 9 })).toEqual({ best: 0, stars: 0 });
    expect(readSurvival({ best: 61.5, stars: 4 })).toEqual({ best: 61.5, stars: 4 });
  });

  it("keeps the longer hunt, never a tie", () => {
    const book = { best: 60, stars: 3 };
    expect(withSurvival(book, 60, 5)).toBe(book);
    expect(withSurvival(book, 75, 4)).toEqual({ best: 75, stars: 4 });
  });
});

describe("the news", () => {
  it("says a star gained, the army shaken off, and nothing for a glimpse", () => {
    const s = ride();
    raiseHeat(s, "stole-police");
    const raised = s.events.find((e) => e.kind === "wanted" && e.change === "raised")!;
    expect(newsFor(raised, s)?.tone).toBe("bad");
    expect(newsFor({ kind: "wanted", t: 0, change: "lost", stars: 0 }, s)?.tone).toBe("good");
    expect(newsFor({ kind: "wanted", t: 0, change: "seen", stars: 2 }, s)).toBeNull();
  });
});

describe("the link", () => {
  it("starts a free ride wanted at 1..5 stars, and reads nothing else as a wanted level", () => {
    const ride = { mode: "free" as const };
    expect(overLink(ride, readParams("?wanted=3")).wanted).toBe(3);
    expect(overLink(ride, readParams("?wanted=9")).wanted).toBe(5);
    expect(overLink(ride, readParams("?wanted=0")).wanted).toBeUndefined();
    expect(overLink(ride, readParams("?wanted=x")).wanted).toBeUndefined();
    expect(overLink(ride, readParams("")).wanted).toBeUndefined();
  });
});
