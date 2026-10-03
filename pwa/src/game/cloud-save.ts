// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CLOUD SAVE — the skier's RECORD BOOK, their GHOSTS, their CAMPAIGN BOARD
// and the settings that belong to the SKIER rather than to the machine,
// carried between their own devices by the platform's cloud (iCloud
// key-value storage in the store app; the seam in `../shell-host.ts` is
// written so a second platform is a new native provider and no change here).
//
// STORE APP ONLY. A browser has no platform cloud to talk to, so the shell
// bridge never answers and every entry point is a no-op there — the website
// keeps writing `localStorage` exactly as it did.
//
// WHAT TRAVELS, AND WHAT DOES NOT:
//
//   records   YES. A best time is the thing a skier would be sorriest to lose
//             with a phone, and it is small.
//   ghosts    YES, within a budget. A tape is a few kilobytes a lap and the
//             whole store is a megabyte (`CLOUD_BUDGET`), so the smallest go
//             first and a tape that does not fit stays on the device that
//             rode it — its time still travels in the book.
//   campaign  YES. A board half-ridden on one device and half on another is
//             the case this whole file exists for.
//   settings  THE SKIER'S HALF. The camera, the skis, the outfit, the sound and its
//             faders, the keys, the help, damage, the trial's length, the
//             level card's map, the trick map, the free ride's card, the
//             HUD switch — a person's preferences. NOT the picture (`video`, `probed`, `autoPicture`: what
//             THIS machine can hold) and NOT the thumbs (`touch`: the travel
//             of a screen this size) and NOT the developer page (`developer`,
//             `dev`: a bench let out on one machine is not let out on the
//             next) — `DEVICE_SETTINGS`.
//
// THE MERGE IS MECHANICAL, NEVER A JUDGEMENT CALL. Two devices that both rode
// while offline must both keep their work, and running the merge again must
// change nothing the second time:
//
//   records   BEST PER ROW, kept by `beats()` — the comparison a fresh run
//             goes through, the mode read out of the row's own id.
//   ghosts    THE FASTER TAPE PER ROW, the same rule the book keeps.
//   campaign  FURTHEST PROGRESS. Per map: the better time (and the skis that
//             set it, together), the HIGHER place, the better medal, and the
//             field's points from whichever afternoon placed the player
//             higher — exactly what `recordRun` does for a local run.
//   settings  THE LATER CHANGE. A preference has no "better", so this is the
//             one half decided by a clock: each device stamps the moment its
//             skier last moved one of the carried rows, and the newer stamp
//             wins whole. A stamp of 0 — never touched — never overrides.
//
// Every rule is the game's own, imported rather than restated; everything
// above the storage line is PURE, so `tests/cloud_save_test.ts` holds it
// without a browser.

import {
  EMPTY_PROGRESS,
  MEDALS,
  PLAYER_ID,
  PROGRESS_KEY,
  findLevel,
  loadProgress,
  mergeProgress,
  saveProgress,
  type CampaignProgress,
  type LevelResult,
  type Medal,
} from "./campaign.ts";
import { loadGhosts, readsAsGhost, saveGhost, type GhostRun } from "./ghost.ts";
import {
  beats,
  loadRecords,
  mergeRecords,
  saveRecords,
  type RecordBook,
  type RunRecord,
} from "./records.ts";
import { mergeSettings, type Settings } from "./settings.ts";

/** Bump when the blob's SHAPE changes; a later build reads an earlier one. */
export const CLOUD_SAVE_VERSION = 1;

/** THE MOST THE SAVE MAY WEIGH, characters of JSON. The platform's key-value
 * store holds a megabyte for the whole app; this leaves it headroom, and
 * only the ghosts are ever trimmed to meet it. */
export const CLOUD_BUDGET = 900_000;

/** The rows that are a fact about the MACHINE, not the skier: never carried,
 * never overwritten by another device's. */
export const DEVICE_SETTINGS = [
  "video",
  "probed",
  "autoPicture",
  "touch",
  "developer",
  "dev",
] as const;
type DeviceKey = (typeof DEVICE_SETTINGS)[number];

/** The skier's half of the settings. */
export type CarriedSettings = Omit<Settings, DeviceKey>;

/** The skier's half, and when the device that wrote it last moved a row of
 * it (unix ms; 0 is never). */
export type SettingsStamp = { at: number; values: CarriedSettings };

export type CloudSave = {
  v: typeof CLOUD_SAVE_VERSION;
  /** THE LADDER the board was won on (`PROGRESS_KEY`): a board from a
   * ladder this build has re-cut names its maps by ids that now mean
   * other maps, so it is read only when this matches. */
  ladder: string;
  records: RecordBook;
  ghosts: GhostRun[];
  campaign: CampaignProgress;
  settings: SettingsStamp | null;
};

/** The skier's half of a settings object. */
export function carriedSettings(settings: Settings): CarriedSettings {
  const out: Record<string, unknown> = { ...settings };
  for (const key of DEVICE_SETTINGS) delete out[key];
  return out as CarriedSettings;
}

/** BEST PER ROW. Every row from both books, each kept by the comparison a
 * live run goes through; a tie keeps the row that was standing. */
export function mergeBooks(mine: RecordBook, theirs: RecordBook): RecordBook {
  const out: Record<string, RunRecord> = { ...mine };
  for (const [id, row] of Object.entries(theirs)) {
    const standing = out[id] ?? null;
    // `beats` takes the mode, and a record's mode is the first segment of
    // its id (`recordId`) — so a mode this build does not keep a book for
    // is kept only where nothing stands against it.
    const mode = id.split("/")[0] as Parameters<typeof beats>[0];
    if (standing === null || beats(mode, row.value, standing)) out[id] = row;
  }
  return out;
}

/** THE FASTER TAPE PER ROW, in id order so a save written twice is written
 * the same. A tie keeps the tape that was standing. */
export function mergeGhosts(mine: readonly GhostRun[], theirs: readonly GhostRun[]): GhostRun[] {
  const out = new Map<string, GhostRun>();
  for (const run of mine) out.set(run.id, run);
  for (const run of theirs) {
    const standing = out.get(run.id);
    if (standing === undefined || run.value < standing.value) out.set(run.id, run);
  }
  return [...out.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function betterMedal(a: Medal | null, b: Medal | null): Medal | null {
  if (a === null) return b;
  if (b === null) return a;
  return MEDALS.indexOf(a) >= MEDALS.indexOf(b) ? a : b;
}

/** FURTHEST PROGRESS. Per map, the better of the two rows, and the board from
 * whichever afternoon placed the player higher. A map this ladder does not
 * have is dropped: the ladder moved under it. */
export function mergeBoards(mine: CampaignProgress, theirs: CampaignProgress): CampaignProgress {
  const results: Record<string, LevelResult> = { ...mine.results };
  for (const [id, row] of Object.entries(theirs.results)) {
    if (!findLevel(id)) continue;
    const standing = results[id];
    if (standing === undefined) {
      results[id] = row;
      continue;
    }
    // The time and the skis are kept or replaced TOGETHER, as `recordRun`
    // keeps them — a best time beside the wrong machine is a line the card
    // would read out loud.
    // A row with no time is one DEVELOPER ▸ UNLOCKS set by hand: any run's
    // figure beats it.
    const figure =
      row.best !== undefined && (standing.best === undefined || row.best < standing.best)
        ? { best: row.best, skis: row.skis }
        : { best: standing.best, skis: standing.skis };
    results[id] = {
      ...figure,
      place: Math.min(standing.place, row.place),
      medal: betterMedal(standing.medal, row.medal),
    };
  }
  // THE BOARD FOLLOWS THE BETTER AFTERNOON: a map's points are the whole
  // field's from one run, so they are taken or left together rather than
  // blended into a table no afternoon produced.
  const points = { ...mine.points };
  for (const [id, board] of Object.entries(theirs.points)) {
    if (!findLevel(id)) continue;
    const standing = points[id];
    if (standing === undefined || (board[PLAYER_ID] ?? 0) > (standing[PLAYER_ID] ?? 0)) {
      points[id] = board;
    }
  }
  return { results, points };
}

/** THE LATER CHANGE. The newer stamp wins whole; a tie, or a side that has
 * none, keeps mine. */
export function mergeStamps(
  mine: SettingsStamp | null,
  theirs: SettingsStamp | null,
): SettingsStamp | null {
  if (mine === null) return theirs;
  if (theirs === null) return mine;
  return theirs.at > mine.at ? theirs : mine;
}

/** Two saves laid over each other. */
export function mergeSaves(mine: CloudSave, theirs: CloudSave): CloudSave {
  return {
    v: CLOUD_SAVE_VERSION,
    ladder: PROGRESS_KEY,
    records: mergeBooks(mine.records, theirs.records),
    ghosts: mergeGhosts(mine.ghosts, theirs.ghosts),
    campaign: mergeBoards(mine.campaign, theirs.campaign),
    settings: mergeStamps(mine.settings, theirs.settings),
  };
}

/** THE SAVE AS IT GOES UP: everything but the ghosts always, then the tapes
 * smallest first — ties by id, so the same save packs the same way — for as
 * long as they fit under `budget`. */
export function packSave(save: CloudSave, budget = CLOUD_BUDGET): string {
  const sized = save.ghosts
    .map((run) => ({ run, size: JSON.stringify(run).length }))
    .sort((a, b) => a.size - b.size || (a.run.id < b.run.id ? -1 : 1));
  let used = JSON.stringify({ ...save, ghosts: [] }).length;
  const kept = new Set<GhostRun>();
  for (const { run, size } of sized) {
    // The tape, and the comma before it.
    if (used + size + 1 > budget) break;
    used += size + 1;
    kept.add(run);
  }
  return JSON.stringify({ ...save, ghosts: save.ghosts.filter((run) => kept.has(run)) });
}

/** A blob off the cloud, checked the way a stored blob is — every half
 * through the same validators local storage uses, so a save written by a
 * build that knew more maps than this one cannot put a row on a board this
 * ladder does not have. Null for nothing, or for something that is not a
 * save at all. */
export function parseSave(text: string | null): CloudSave | null {
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const blob = parsed as Record<string, unknown>;
  const ghosts = Array.isArray(blob.ghosts) ? blob.ghosts.filter(readsAsGhost) : [];
  let settings: SettingsStamp | null = null;
  const stamp = blob.settings as { at?: unknown; values?: unknown } | null | undefined;
  const at = stamp && typeof stamp === "object" ? stamp.at : undefined;
  // A stamp that is not a moment is a row nobody moved: it never wins.
  if (typeof at === "number" && Number.isFinite(at) && at > 0) {
    settings = { at, values: carriedSettings(mergeSettings(stamp?.values)) };
  }
  return {
    v: CLOUD_SAVE_VERSION,
    ladder: PROGRESS_KEY,
    records: mergeRecords(blob.records),
    ghosts: mergeGhosts([], ghosts),
    // A board off another ladder — or written before boards carried one —
    // is left behind, as local storage leaves it under its old key.
    campaign:
      blob.ladder === PROGRESS_KEY && blob.campaign !== undefined
        ? mergeProgress(blob.campaign)
        : EMPTY_PROGRESS,
    settings,
  };
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

/** Where this device keeps the stamp on its settings — the one thing the
 * cloud save stores of its own. */
export const CLOUD_KEY = "fall-line.cloud.v1";

export function loadSettingsStamp(): number {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CLOUD_KEY) ?? "null");
    const at = (parsed as { settingsAt?: unknown } | null)?.settingsAt;
    return typeof at === "number" && Number.isFinite(at) && at > 0 ? at : 0;
  } catch {
    return 0;
  }
}

export function saveSettingsStamp(at: number): void {
  try {
    localStorage.setItem(CLOUD_KEY, JSON.stringify({ settingsAt: at }));
  } catch {
    // Storage unavailable — this device's settings simply never win.
  }
}

/** This device's save, as it stands in storage, with `settings` the ones the
 * app is holding. */
export function localSave(settings: Settings): CloudSave {
  const at = loadSettingsStamp();
  return {
    v: CLOUD_SAVE_VERSION,
    ladder: PROGRESS_KEY,
    records: loadRecords(),
    ghosts: mergeGhosts([], loadGhosts()),
    campaign: loadProgress(),
    settings: at > 0 ? { at, values: carriedSettings(settings) } : null,
  };
}

/** What a merge changed on this device, for the app to take up. */
export type CloudApplied = {
  /** What should now go up. */
  save: CloudSave;
  records: boolean;
  campaign: boolean;
  /** The settings to hold now, or null when this device's stood. */
  settings: Settings | null;
};

/** MERGE A CLOUD SAVE INTO THIS DEVICE and hand back what should go up.
 *
 * Everything merged is written to local storage before it is returned: a
 * device that merged and then failed to upload has still KEPT the other
 * device's work, which is the half that cannot be recovered by trying
 * again. The settings are handed back rather than written — the app holds
 * them, and writes them down itself. */
export function applyCloudSave(remote: CloudSave | null, settings: Settings): CloudApplied {
  const mine = localSave(settings);
  if (remote === null) return { save: mine, records: false, campaign: false, settings: null };
  const save = mergeSaves(mine, remote);
  const records = JSON.stringify(save.records) !== JSON.stringify(mine.records);
  const campaign = JSON.stringify(save.campaign) !== JSON.stringify(mine.campaign);
  if (records) saveRecords(save.records);
  if (campaign) saveProgress(save.campaign);
  const held = new Map(mine.ghosts.map((run) => [run.id, run]));
  for (const run of save.ghosts) if (held.get(run.id) !== run) saveGhost(run);
  let adopted: Settings | null = null;
  if (save.settings !== null && save.settings !== mine.settings) {
    saveSettingsStamp(save.settings.at);
    adopted = { ...settings, ...save.settings.values };
  }
  return { save, records, campaign, settings: adopted };
}
