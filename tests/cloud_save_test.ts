// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CLOUD SAVE's merge (`pwa/src/game/cloud-save.ts`): two devices that both
// rode while offline, reconciled without a judgement call.
//
// The rules under test are the ones the game already uses for a live run —
// the better row per record, the faster tape, furthest progress — so these
// cases are as much about the merge AGREEING with the game as about the merge
// working. A rule that drifts is a rule that quietly disagrees with the game
// about who is faster. The settings are the one half decided by a clock, and
// the one half that must never carry what belongs to the machine.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CLOUD_KEY,
  applyCloudSave,
  carriedSettings,
  mergeBoards,
  mergeBooks,
  mergeGhosts,
  mergeSaves,
  mergeStamps,
  packSave,
  parseSave,
  type CloudSave,
} from "../pwa/src/game/cloud-save.ts";
import { EMPTY_PROGRESS, type CampaignProgress } from "../pwa/src/game/campaign.ts";
import { GHOST_FORMAT, GHOST_PREFIX, type GhostRun } from "../pwa/src/game/ghost.ts";
import { RECORDS_KEY, recordId, type RecordBook } from "../pwa/src/game/records.ts";
import { freshSettings } from "../pwa/src/game/settings.ts";

const raceId = recordId({ seed: 5, skis: "hare", mode: "race", laps: 3 });
const trialId = recordId({ seed: 5, skis: "hare", mode: "timeTrial", laps: 1 });

const book = (rows: Record<string, number>): RecordBook =>
  Object.fromEntries(
    Object.entries(rows).map(([id, value]) => [id, { value, skis: "hare", at: 1, splits: [] }]),
  );

const tape = (id: string, value: number, steps = 100): GhostRun => ({
  id,
  map: "0badf00d",
  format: GHOST_FORMAT,
  seed: 5,
  skis: "hare",
  mode: "timeTrial",
  laps: 1,
  assist: { yaw: 1, air: 1 },
  value,
  steps,
  steer: "AA",
  lean: "AA",
  tuck: "AA",
  brake: "AA",
  flags: "AA",
});

const save = (over: Partial<CloudSave>): CloudSave => ({
  v: 1,
  records: {},
  ghosts: [],
  campaign: EMPTY_PROGRESS,
  settings: null,
  ...over,
});

describe("the record book: best per row", () => {
  it("keeps the FASTER time when both devices rode the same row", () => {
    const merged = mergeBooks(book({ [raceId]: 92.5 }), book({ [raceId]: 88.1 }));
    expect(merged[raceId]?.value).toBe(88.1);
    expect(mergeBooks(book({ [raceId]: 88.1 }), book({ [raceId]: 92.5 }))[raceId]?.value).toBe(
      88.1,
    );
  });

  it("keeps a row only one device has ever ridden", () => {
    const merged = mergeBooks(book({ [raceId]: 92.5 }), book({ [trialId]: 61 }));
    expect(Object.keys(merged).sort()).toEqual([raceId, trialId].sort());
  });

  it("does not care which side is which, and does not drift on a second run", () => {
    const mine = book({ [raceId]: 92.5, [trialId]: 60 });
    const theirs = book({ [raceId]: 88.1, [trialId]: 64 });
    const once = mergeBooks(mine, theirs);
    expect(mergeBooks(theirs, mine)).toEqual(once);
    expect(mergeBooks(once, theirs)).toEqual(once);
  });
});

describe("the ghosts: the faster tape per row", () => {
  it("keeps the faster tape, and every tape only one side has", () => {
    const other = recordId({ seed: 9, skis: "swift", mode: "timeTrial", laps: 3 });
    const merged = mergeGhosts([tape(trialId, 64)], [tape(trialId, 60), tape(other, 180)]);
    expect(merged.map((g) => [g.id, g.value])).toEqual(
      [
        [trialId, 60],
        [other, 180],
      ].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    );
  });

  it("packs the smallest tapes first and leaves one that does not fit", () => {
    const small = tape(recordId({ seed: 1, skis: "hare", mode: "timeTrial", laps: 1 }), 50);
    const big = { ...tape(trialId, 60), steer: "A".repeat(5000) };
    const base = JSON.stringify(save({ ghosts: [] })).length;
    const text = packSave(save({ ghosts: [big, small] }), base + JSON.stringify(small).length + 10);
    expect(parseSave(text)?.ghosts.map((g) => g.id)).toEqual([small.id]);
    // With room, both go up.
    expect(parseSave(packSave(save({ ghosts: [big, small] })))?.ghosts).toHaveLength(2);
  });
});

describe("the campaign: furthest progress", () => {
  const board = (result: Partial<CampaignProgress["results"][string]>): CampaignProgress => ({
    results: { "nursery-1": { best: 100, skis: "hare", place: 4, medal: null, ...result } },
    points: {},
  });

  it("keeps the better time, and the skis that set it, together", () => {
    const merged = mergeBoards(
      board({ best: 95, skis: "hare", place: 3 }),
      board({ best: 90, skis: "swift", place: 2 }),
    );
    expect(merged.results["nursery-1"]).toMatchObject({ best: 90, skis: "swift" });
  });

  it("keeps the HIGHER place even when the other device was slower", () => {
    const merged = mergeBoards(board({ best: 90, place: 4 }), board({ best: 95, place: 2 }));
    expect(merged.results["nursery-1"]).toMatchObject({ best: 90, place: 2 });
  });

  it("lets any ridden time beat a row UNLOCKS set by hand", () => {
    const unlocked: CampaignProgress = {
      results: { "nursery-1": { place: 4, medal: null } },
      points: {},
    };
    expect(
      mergeBoards(unlocked, board({ best: 97, skis: "swift" })).results["nursery-1"],
    ).toMatchObject({
      best: 97,
      skis: "swift",
    });
    expect(
      mergeBoards(board({ best: 97, skis: "swift" }), unlocked).results["nursery-1"],
    ).toMatchObject({
      best: 97,
      skis: "swift",
    });
  });

  it("keeps the better medal", () => {
    const merged = mergeBoards(
      board({ best: 95, medal: "bronze" }),
      board({ best: 99, medal: "gold" }),
    );
    expect(merged.results["nursery-1"]?.medal).toBe("gold");
  });

  it("drops a map this ladder no longer has", () => {
    const merged = mergeBoards(EMPTY_PROGRESS, {
      results: { "a-shelf-that-was-recut-9": { best: 1, skis: "hare", place: 1, medal: "gold" } },
      points: { "a-shelf-that-was-recut-9": { you: 3 } },
    });
    expect(merged).toEqual(EMPTY_PROGRESS);
  });

  it("takes the field's points from whichever afternoon placed the player higher", () => {
    // Points are one afternoon's whole field, so they move together — a
    // blended table is a table no afternoon produced.
    const mine: CampaignProgress = { results: {}, points: { "nursery-1": { you: 1, r1: 3 } } };
    const theirs: CampaignProgress = { results: {}, points: { "nursery-1": { you: 3, r1: 2 } } };
    expect(mergeBoards(mine, theirs).points["nursery-1"]).toEqual({ you: 3, r1: 2 });
    expect(mergeBoards(theirs, mine).points["nursery-1"]).toEqual({ you: 3, r1: 2 });
  });
});

describe("the settings: the skier's half, the later change", () => {
  it("never carries the picture or the thumbs — they belong to the machine", () => {
    const carried = carriedSettings(freshSettings()) as Record<string, unknown>;
    expect(carried).not.toHaveProperty("video");
    expect(carried).not.toHaveProperty("probed");
    expect(carried).not.toHaveProperty("autoPicture");
    expect(carried).not.toHaveProperty("touch");
    expect(carried).toHaveProperty("keys");
    expect(carried).toHaveProperty("assist");
  });

  it("lets the newer stamp win whole, and a tie keep mine", () => {
    const values = carriedSettings(freshSettings());
    const old = { at: 10, values: { ...values, camera: "far" as const } };
    const fresh = { at: 20, values: { ...values, camera: "tips" as const } };
    expect(mergeStamps(old, fresh)).toBe(fresh);
    expect(mergeStamps(fresh, old)).toBe(fresh);
    expect(mergeStamps(null, old)).toBe(old);
    const tie = { at: 20, values };
    expect(mergeStamps(fresh, tie)).toBe(fresh);
  });

  it("reads a stamp off the wire through the settings' own validator", () => {
    const text = JSON.stringify({
      settings: { at: 5, values: { camera: "orbit", skis: "swift", video: { pixels: 9 } } },
    });
    const read = parseSave(text)?.settings;
    // `orbit` is no rung C can walk to, so it is the default rung; the picture
    // never arrives at all.
    expect(read?.values.camera).toBe(freshSettings().camera);
    expect(read?.values.skis).toBe("swift");
    expect(read?.values).not.toHaveProperty("video");
    // A stamp that is not a moment never wins.
    expect(parseSave(JSON.stringify({ settings: { at: 0, values: {} } }))?.settings).toBeNull();
  });
});

describe("what comes off the wire", () => {
  it("reads nothing out of nothing rather than throwing", () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave("not json")).toBeNull();
    expect(parseSave("3")).toBeNull();
  });

  it("puts a blob through the same validators local storage uses", () => {
    const read = parseSave(
      JSON.stringify({
        records: { [raceId]: { value: -1, skis: "hare", at: 1, splits: [] } },
        ghosts: [{ id: trialId, value: 60 }, tape(trialId, 61)],
        campaign: { results: {}, points: {} },
      }),
    );
    // A negative time is not a row a run could have set, and half a tape is
    // not a tape, so neither becomes one by arriving from another device.
    expect(read?.records).toEqual({});
    expect(read?.ghosts.map((g) => g.value)).toEqual([61]);
  });

  it("merges a whole save to a fixed point", () => {
    const a = save({ records: book({ [raceId]: 90 }), ghosts: [tape(trialId, 64)] });
    const b = save({ records: book({ [raceId]: 85 }), ghosts: [tape(trialId, 60)] });
    const once = mergeSaves(a, b);
    expect(mergeSaves(once, b)).toEqual(once);
    expect(parseSave(packSave(once))).toEqual(once);
  });
});

describe("a device merging the cloud into itself", () => {
  let store: Map<string, string>;
  const globals = globalThis as unknown as Record<string, unknown>;
  let before: unknown;

  beforeEach(() => {
    store = new Map();
    before = globals.localStorage;
    globals.localStorage = {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    };
  });

  afterEach(() => {
    if (before === undefined) delete globals.localStorage;
    else globals.localStorage = before;
  });

  it("uploads its own when the cloud has nothing yet, and changes nothing here", () => {
    store.set(RECORDS_KEY, JSON.stringify(book({ [raceId]: 90 })));
    const out = applyCloudSave(null, freshSettings());
    expect(out.save.records[raceId]?.value).toBe(90);
    expect(out).toMatchObject({ records: false, campaign: false, settings: null });
    // Never touched, so its settings go up as nobody's to win with.
    expect(out.save.settings).toBeNull();
  });

  it("writes the other device's better rows and tapes down before it answers", () => {
    store.set(RECORDS_KEY, JSON.stringify(book({ [raceId]: 90 })));
    store.set(GHOST_PREFIX + trialId, JSON.stringify(tape(trialId, 64)));
    const remote = save({ records: book({ [raceId]: 85 }), ghosts: [tape(trialId, 60)] });
    const out = applyCloudSave(remote, freshSettings());
    expect(out.records).toBe(true);
    expect(JSON.parse(store.get(RECORDS_KEY) ?? "{}")[raceId].value).toBe(85);
    expect(JSON.parse(store.get(GHOST_PREFIX + trialId) ?? "{}").value).toBe(60);
  });

  it("takes the skier's settings from a later device, and keeps its own picture", () => {
    store.set(CLOUD_KEY, JSON.stringify({ settingsAt: 10 }));
    const mine = { ...freshSettings(), camera: "far" as const };
    mine.video = { ...mine.video };
    const theirs = {
      at: 20,
      values: { ...carriedSettings(freshSettings()), camera: "tips" as const },
    };
    const out = applyCloudSave(save({ settings: theirs }), mine);
    expect(out.settings?.camera).toBe("tips");
    expect(out.settings?.video).toBe(mine.video);
    expect(JSON.parse(store.get(CLOUD_KEY) ?? "{}").settingsAt).toBe(20);
    // An older device's settings change nothing here.
    const stale = { at: 5, values: theirs.values };
    expect(applyCloudSave(save({ settings: stale }), mine).settings).toBeNull();
  });
});
