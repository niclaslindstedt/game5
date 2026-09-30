// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN'S POLICY (pwa/src/game/campaign.ts, campaign-run.ts): the
// ladder's shape, what a finish pays, what the board keeps, what opens what,
// where a returning player picks back up, what a stored board is allowed to
// be, which map a measured run is on — and the rig that books a rung's
// finish, ridden with a real engine state. All of it storage-free, so none
// of it needs a browser; the maps themselves are held to their digests in
// `generator_version_test.ts`, which builds them.

import { describe, expect, it } from "vitest";

import {
  FULL_ASSIST,
  LEVEL_RULES,
  PISTE_GRADES,
  RACE,
  SKIS,
  createGame,
  type GameState,
} from "@engine";

import {
  CAMPAIGN_LEVELS,
  EMPTY_PROGRESS,
  MEDALS,
  PLAYER_ID,
  POINTS,
  SHELVES,
  campaignGameOptions,
  campaignStanding,
  continueAt,
  findLevel,
  fitsMode,
  frontDoorPins,
  ladderAfter,
  levelCleared,
  levelUnlocked,
  medalFor,
  mergeProgress,
  pinnedFor,
  pinnedGameOptions,
  pinnedRun,
  pointsFor,
  recordRun,
  skierKey,
  shelfStandings,
  shelfUnlocked,
  shelfWon,
  type CampaignLevel,
  type CampaignProgress,
} from "../pwa/src/game/campaign.ts";
import { campaignPlateFor, createCampaignRig } from "../pwa/src/game/campaign-run.ts";
import { skisBack } from "../pwa/src/game/pinned-run.ts";
import { freshSettings, mergeSettings } from "../pwa/src/game/settings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** The field in the order it stood at the player's flag: the player at
 * `place`, the three rivals round him by slot. */
function orderWith(place: number): (number | null)[] {
  const order: (number | null)[] = Array.from({ length: RACE.rivals }, (_, i) => i);
  order.splice(place - 1, 0, null);
  return order;
}

const [FIRST, SECOND, THIRD] = SHELVES;
const race = (shelf = FIRST): CampaignLevel => shelf.levels.find((l) => l.mode === "race")!;
const trial = (shelf = FIRST): CampaignLevel => shelf.levels.find((l) => l.mode === "timeTrial")!;

/** Every map of a shelf cleared: the race won, the trial on gold. */
function winShelf(progress: CampaignProgress, shelf = FIRST): CampaignProgress {
  let out = progress;
  for (const level of shelf.levels) {
    out = recordRun(out, level, {
      time: level.medals ? level.medals.gold - 1 : 300,
      skis: "hare",
      order: orderWith(1),
    });
  }
  return out;
}

describe("the ladder", () => {
  it("is four shelves of six maps, one a grade gentlest first, ids unique and numbered by rung", () => {
    expect(SHELVES).toHaveLength(4);
    expect(SHELVES.map((shelf) => shelf.id)).toEqual(PISTE_GRADES);
    const ids = new Set<string>();
    for (const shelf of SHELVES) {
      expect(shelf.levels).toHaveLength(6);
      shelf.levels.forEach((level, i) => {
        expect(level.id).toBe(`${shelf.id}-${i + 1}`);
        // Every map on a shelf is built to the shelf's grade (R23).
        expect(level.grade).toBe(shelf.id);
        expect(ids.has(level.id), level.id).toBe(false);
        ids.add(level.id);
        expect(level.name.length).toBeGreaterThan(0);
        expect(level.blurb.length).toBeGreaterThan(0);
        expect(level.digest).toMatch(/^[0-9a-f]{8}$/);
      });
    }
    expect(CAMPAIGN_LEVELS).toHaveLength(24);
  });

  it("opens and closes every shelf on a race, with two trials between", () => {
    for (const shelf of SHELVES) {
      expect(shelf.levels[0].mode).toBe("race");
      expect(shelf.levels[shelf.levels.length - 1].mode).toBe("race");
      expect(shelf.levels.filter((l) => l.mode === "timeTrial")).toHaveLength(2);
    }
  });

  it("skis every rung as one run top to bottom, and prices every trial gold under silver under bronze", () => {
    for (const level of CAMPAIGN_LEVELS) {
      expect(level.laps).toBe(1);
      if (level.mode === "race") {
        expect(level.medals).toBeUndefined();
      } else {
        const m = level.medals!;
        expect(m.gold).toBeLessThan(m.silver);
        expect(m.silver).toBeLessThan(m.bronze);
        // Roughly a run's worth of seconds — a few minutes down a 3–4.5 km
        // piste: a medal off by a factor is a typo, not a curation.
        expect(m.silver).toBeGreaterThan(150);
        expect(m.silver).toBeLessThan(600);
      }
    }
  });

  it("uses no seed twice", () => {
    const seeds = CAMPAIGN_LEVELS.map((l) => l.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("finds a map by id, and nothing by a stale one", () => {
    const hit = findLevel("red-3");
    expect(hit?.shelf).toBe(SHELVES[2]);
    expect(hit?.index).toBe(2);
    expect(findLevel("nowhere-9")).toBeNull();
  });
});

describe("the points and the medals", () => {
  it("pays the podium and nothing below it", () => {
    expect(POINTS).toEqual([3, 2, 1]);
    expect([1, 2, 3, 4].map(pointsFor)).toEqual([3, 2, 1, 0]);
  });

  it("gives a medal only on a trial, the best one the time is under", () => {
    const t = trial();
    const m = t.medals!;
    expect(medalFor(race(), 1)).toBeNull();
    expect(medalFor(t, m.gold)).toBe("gold");
    expect(medalFor(t, m.gold + 0.01)).toBe("silver");
    expect(medalFor(t, m.bronze)).toBe("bronze");
    expect(medalFor(t, m.bronze + 0.01)).toBeNull();
    expect(MEDALS).toEqual(["bronze", "silver", "gold"]);
  });
});

describe("the board keeps the better afternoon", () => {
  const level = race();

  it("books the whole field's points on a race", () => {
    const after = recordRun(EMPTY_PROGRESS, level, {
      time: 400,
      skis: "hare",
      order: orderWith(2),
    });
    expect(after.results[level.id]).toEqual({ best: 400, skis: "hare", place: 2, medal: null });
    expect(after.points[level.id][PLAYER_ID]).toBe(2);
    expect(after.points[level.id][skierKey(0)]).toBe(3);
    expect(Object.values(after.points[level.id]).reduce((a, b) => a + b, 0)).toBe(6);
  });

  it("keeps a better place's board over a worse run, and a faster time on its own", () => {
    const won = recordRun(EMPTY_PROGRESS, level, { time: 420, skis: "hare", order: orderWith(1) });
    const worse = recordRun(won, level, { time: 390, skis: "swift", order: orderWith(4) });
    expect(worse.points[level.id]).toEqual(won.points[level.id]);
    expect(worse.results[level.id]).toEqual({ best: 390, skis: "swift", place: 1, medal: null });
  });

  it("books no points on a trial, and keeps the best medal", () => {
    const t = trial();
    const m = t.medals!;
    const gold = recordRun(EMPTY_PROGRESS, t, { time: m.gold, skis: "hare", order: [null] });
    expect(gold.points[t.id]).toBeUndefined();
    const slower = recordRun(gold, t, { time: m.bronze, skis: "hare", order: [null] });
    expect(slower.results[t.id].medal).toBe("gold");
    expect(slower.results[t.id].best).toBe(m.gold);
  });
});

describe("the locks", () => {
  it("opens the first map of the first shelf and nothing else on a fresh board", () => {
    expect(shelfUnlocked(FIRST, EMPTY_PROGRESS)).toBe(true);
    expect(shelfUnlocked(SECOND, EMPTY_PROGRESS)).toBe(false);
    expect(levelUnlocked(FIRST, 0, EMPTY_PROGRESS)).toBe(true);
    expect(levelUnlocked(FIRST, 1, EMPTY_PROGRESS)).toBe(false);
    expect(levelUnlocked(SECOND, 0, EMPTY_PROGRESS)).toBe(false);
  });

  it("opens the next map on a podium, and not on fourth", () => {
    const level = FIRST.levels[0];
    const fourth = recordRun(EMPTY_PROGRESS, level, {
      time: 1,
      skis: "hare",
      order: orderWith(4),
    });
    expect(levelCleared(fourth, level)).toBe(false);
    expect(levelUnlocked(FIRST, 1, fourth)).toBe(false);
    const third = recordRun(fourth, level, { time: 1, skis: "hare", order: orderWith(3) });
    expect(levelCleared(third, level)).toBe(true);
    expect(levelUnlocked(FIRST, 1, third)).toBe(true);
  });

  it("clears a trial on bronze and not without a medal", () => {
    const t = trial();
    const none = recordRun(EMPTY_PROGRESS, t, {
      time: t.medals!.bronze + 5,
      skis: "hare",
      order: [null],
    });
    expect(levelCleared(none, t)).toBe(false);
    const bronze = recordRun(none, t, { time: t.medals!.bronze, skis: "hare", order: [null] });
    expect(levelCleared(bronze, t)).toBe(true);
  });

  it("opens the next shelf when this one is won — every map cleared, top of the table", () => {
    const won = winShelf(EMPTY_PROGRESS);
    expect(shelfWon(FIRST, won)).toBe(true);
    expect(shelfUnlocked(SECOND, won)).toBe(true);
    expect(shelfUnlocked(THIRD, won)).toBe(false);
    expect(shelfStandings(FIRST, won)[0].id).toBe(PLAYER_ID);
  });

  it("keeps the next shelf shut when every map is cleared but a rival tops the table", () => {
    let out: CampaignProgress = EMPTY_PROGRESS;
    for (const level of FIRST.levels) {
      out = recordRun(out, level, {
        time: level.medals ? level.medals.gold : 300,
        skis: "hare",
        order: orderWith(3),
      });
    }
    expect(FIRST.levels.every((l) => levelCleared(out, l))).toBe(true);
    expect(shelfWon(FIRST, out)).toBe(false);
    expect(shelfUnlocked(SECOND, out)).toBe(false);
  });

  it("lists every skier on the table, the player first on a tie", () => {
    const table = shelfStandings(FIRST, EMPTY_PROGRESS);
    expect(table).toHaveLength(RACE.rivals + 1);
    expect(table[0].you).toBe(true);
    expect(table.map((r) => r.place)).toEqual([1, 2, 3, 4]);
  });
});

describe("where the campaign picks back up", () => {
  it("walks forward to the next map never ridden, then back to one not yet won", () => {
    expect(continueAt(FIRST, EMPTY_PROGRESS)).toBe(FIRST.levels[0]);
    const one = recordRun(EMPTY_PROGRESS, FIRST.levels[0], {
      time: 1,
      skis: "hare",
      order: orderWith(2),
    });
    expect(continueAt(FIRST, one)).toBe(FIRST.levels[1]);
    expect(continueAt(FIRST, winShelf(EMPTY_PROGRESS))).toBeNull();
  });

  it("names the next rung, the next shelf, or the end", () => {
    const one = recordRun(EMPTY_PROGRESS, FIRST.levels[0], {
      time: 1,
      skis: "hare",
      order: orderWith(1),
    });
    expect(ladderAfter(FIRST.levels[0].id, one)).toEqual({ kind: "next", level: FIRST.levels[1] });
    expect(ladderAfter(FIRST.levels[1].id, one)).toEqual({ kind: "locked", shelf: FIRST });
    const won = winShelf(EMPTY_PROGRESS);
    expect(ladderAfter(FIRST.levels[5].id, won)).toEqual({ kind: "next", level: SECOND.levels[0] });
    expect(ladderAfter(THIRD.levels[5].id, won).kind).not.toBe("next");
    expect(campaignStanding(won)).toEqual({ cleared: 6, of: 24 });
  });
});

describe("a stored board", () => {
  it("survives a round trip", () => {
    const won = winShelf(EMPTY_PROGRESS);
    expect(mergeProgress(JSON.parse(JSON.stringify(won)))).toEqual(won);
  });

  it("drops anything this ladder does not have or cannot read", () => {
    const out = mergeProgress({
      results: {
        "nowhere-1": { best: 1, skis: "hare", place: 1, medal: null },
        "green-1": { best: "fast", skis: "hare", place: 1, medal: null },
        "green-2": { best: 100, skis: "sofa", place: 1, medal: "gold" },
        "green-3": { best: 100, skis: "hare", place: 0, medal: null },
        "green-4": { best: 100, skis: "hare", place: 2, medal: "platinum" },
      },
      points: { "nowhere-1": { you: 3 }, "green-4": { you: 2, r0: "x" } },
    });
    expect(Object.keys(out.results)).toEqual(["green-4"]);
    expect(out.results["green-4"].medal).toBeNull();
    expect(out.points).toEqual({ "green-4": { you: 2 } });
    for (const junk of [null, 7, "board", [], { results: 3 }]) {
      expect(mergeProgress(junk)).toEqual(EMPTY_PROGRESS);
    }
  });
});

describe("which map a run is on", () => {
  it("rides every pinned map as a race or a time trial, and none as a free ride", () => {
    for (const level of CAMPAIGN_LEVELS) {
      expect(fitsMode(level, "race")).toBe(true);
      expect(fitsMode(level, "timeTrial")).toBe(true);
      expect(fitsMode(level, "free")).toBe(false);
      expect(fitsMode(level, "tricks")).toBe(false);
    }
  });

  it("puts a measured run on the chosen map, the first rung by default, and a link on its seed", () => {
    expect(pinnedFor(null, "race", null)).toBe(CAMPAIGN_LEVELS[0]);
    expect(pinnedFor("black-2", "timeTrial", null)?.id).toBe("black-2");
    expect(pinnedFor("nowhere-2", "race", null)).toBe(CAMPAIGN_LEVELS[0]);
    expect(pinnedFor("black-2", "free", null)).toBeNull();
    expect(pinnedFor("black-2", "race", 38)).toBeNull();
  });

  it("stands a rung up in its own mode and laps, with nobody leaning on anybody", () => {
    const built = syntheticLevel();
    const skier = { spec: SKIS, assist: FULL_ASSIST, damage: false };
    const t = trial(THIRD);
    const rung = campaignGameOptions(t, skier, built);
    expect(rung).toMatchObject({ seed: t.seed, mode: "timeTrial", laps: t.laps, contact: false });
    expect(rung.level).toBe(built);
    // Off the level card: the race over the race's one run top to bottom
    // (a trial rung's map included), the trial over the chip's.
    expect(pinnedRun(trial(), "race", false, skier, 1, built)).toMatchObject({
      mode: "race",
      laps: LEVEL_RULES.race.laps,
    });
    expect(pinnedRun(t, "timeTrial", false, skier, 1, built)).toMatchObject({ laps: 1 });
    expect(pinnedGameOptions(t, "race", skier, { built }).contact).toBeUndefined();
  });

  it("bills the front door off the board and the chosen map", () => {
    const pins = frontDoorPins(EMPTY_PROGRESS, "red-4", null);
    expect(pins.campaign).toEqual({ cleared: 0, of: 24, next: FIRST.levels[0].name });
    expect(pins.raceMap).toBe(findLevel("red-4")!.level.name);
    expect(frontDoorPins(EMPTY_PROGRESS, null, 7).raceMap).toBeNull();
  });

  it("keeps the level card's pick between visits, and only a map this ladder has", () => {
    expect(freshSettings().level).toBeNull();
    expect(mergeSettings({ level: "black-5" }).level).toBe("black-5");
    expect(mergeSettings({ level: "nowhere-1" }).level).toBeNull();
    expect(mergeSettings({ level: 3 }).level).toBeNull();
  });

  it("opens the campaign and the level card off a link, and walks BACK to the card that opened the skis", () => {
    expect(readParams("?menu=campaign").page).toBe("campaign");
    expect(readParams("?menu=levels&mode=trial")).toMatchObject({
      page: "levels",
      mode: "timeTrial",
    });
    expect(skisBack(null, "free", null)).toBe("start");
    expect(skisBack(FIRST.levels[0], "race", null)).toBe("campaign");
    expect(skisBack(null, "race", null)).toBe("levels");
    expect(skisBack(null, "timeTrial", 7)).toBe("root");
    expect(skisBack(null, "tricks", null)).toBe("tricks");
    expect(skisBack(null, "tricks", 7)).toBe("root");
    expect(readParams("?menu=tricks&mode=tricks").page).toBe("tricks");
  });
});

describe("the finish plate on a rung", () => {
  it("pays the podium and says what opened", () => {
    const level = FIRST.levels[0];
    const after = recordRun(EMPTY_PROGRESS, level, { time: 1, skis: "hare", order: orderWith(1) });
    const plate = campaignPlateFor(level, 1, 1, EMPTY_PROGRESS, after);
    expect(plate.cleared).toBe(true);
    expect(plate.award).toContain("3");
    expect(plate.next).toBe(FIRST.levels[1]);
    expect(plate.ladder).toContain(FIRST.levels[1].name.toUpperCase());
  });

  it("says a fourth place clears nothing and offers no next map", () => {
    const level = FIRST.levels[0];
    const after = recordRun(EMPTY_PROGRESS, level, { time: 1, skis: "hare", order: orderWith(4) });
    const plate = campaignPlateFor(level, 1, 4, EMPTY_PROGRESS, after);
    expect(plate.cleared).toBe(false);
    expect(plate.next).toBeNull();
    expect(plate.ladder).not.toBeNull();
  });

  it("names the shelf won on its last rung", () => {
    const before = winShelf(EMPTY_PROGRESS);
    const last = FIRST.levels[5];
    const almost: CampaignProgress = {
      results: { ...before.results },
      points: { ...before.points },
    };
    delete almost.results[last.id];
    delete almost.points[last.id];
    const plate = campaignPlateFor(last, 300, 1, almost, before);
    expect(plate.ladder).toContain(FIRST.name.toUpperCase());
    expect(plate.next).toBe(SECOND.levels[0]);
  });
});

describe("the rig", () => {
  /** A run on the stadium alone, with the flag just fallen at `time`. */
  function finished(time: number): GameState {
    const state = createGame({ level: syntheticLevel(), rivals: 0, countdown: 0, quiet: true });
    state.events = [{ kind: "finish", t: time, time, place: 1 }];
    return state;
  }

  it("books a rung once, on the flag, and hands the board back", () => {
    let board = EMPTY_PROGRESS;
    const rig = createCampaignRig({
      progress: () => board,
      setProgress: (next) => (board = next),
    });
    const t = trial();
    rig.arm(t);
    expect(rig.riding()).toBe(t);
    const state = finished(t.medals!.silver);
    rig.step(state);
    expect(board.results[t.id].medal).toBe("silver");
    expect(rig.plate()?.cleared).toBe(true);
    // The same flag seen again books nothing more.
    rig.step(finished(t.medals!.gold));
    expect(board.results[t.id].medal).toBe("silver");
    // Armed again — a restart — and the next flag books.
    rig.arm(t);
    expect(rig.plate()).toBeNull();
    rig.step(finished(t.medals!.gold));
    expect(board.results[t.id].medal).toBe("gold");
  });

  it("books nothing for a run that is not a rung", () => {
    let board = EMPTY_PROGRESS;
    const rig = createCampaignRig({ progress: () => board, setProgress: (n) => (board = n) });
    rig.arm(null);
    rig.step(finished(100));
    expect(board).toBe(EMPTY_PROGRESS);
    expect(rig.plate()).toBeNull();
  });
});
