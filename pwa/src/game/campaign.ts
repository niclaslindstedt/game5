// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN — pinned maps, in order, ridden for points.
//
// Everything a generated map needs is a seed and the generator it was built
// by, so a campaign map is just those with a name and the mode pinned to
// them (`campaign-levels.ts`): the same generator builds it, on the version
// it was curated under, and it comes out identical for every player.
//
// A CAMPAIGN IS A CHAMPIONSHIP, the sibling games' shape retyped for snow.
// Every race rung is ridden against the same three rivals — on the snow to
// make it feel raced, never leaned on (`RunRules.contact` is off) — and pays
// the podium the way a kart game does: three for the win, two for second,
// one for third, nothing at all for fourth. The points are kept for the
// WHOLE field, because the thing that has to be true at the end of a shelf
// is "you beat these three", and that is only a sentence if their points are
// on the board beside yours. A TIME TRIAL rung is ridden alone against the
// clock and pays a MEDAL instead — bronze, silver, gold, against times set
// off the bot's own run — and no points, because there is nobody out there
// to have beaten.
//
// The results are also THE LOCK, at both scales:
//
//   * A MAP opens once the one before it CLEARED — a podium on a race, a
//     medal on a trial.
//   * A SHELF opens once the one before it has been WON: every map on it
//     cleared, and the player top of its table.
//
// Nothing here is ever spent: a map can be ridden again as often as the
// player likes, and the board keeps the better afternoon. That is the whole
// shape of the thing — see the shelf, then go back for the wins it costs to
// leave it — and it is why a map already cleared is still worth riding.
//
// THE PINNED MAPS ARE THE GAME'S MEASURED MAPS, not the campaign's alone. A
// RACE and a TIME TRIAL off the front door pick one of these maps rather
// than a seed — the same snow, the same day, ridden for the record book
// instead of for points (`menu-levels.tsx`, `pinnedFor`) — and what the
// level card offers is gated on the campaign having OPENED that shelf. A
// seed of your own is the FREE RIDE's, and a link's (`?seed=`).
//
// Two halves, the way `records.ts` is split: everything above the storage
// line is PURE — a map built, a run booked, a lock read — so
// `tests/campaign_test.ts` holds the policy without a browser, and the three
// functions under it are the skin over `localStorage`. A device with no
// storage still keeps this session's board in memory.

import {
  LEVEL_RULES,
  RACE,
  generateLevel,
  isSkiId,
  type Assist,
  type CreateGameOptions,
  type GameMode,
  type Level,
  type SkyOverride,
  type SkiId,
  type SkiSpec,
} from "@engine";

import {
  CAMPAIGN_LEVELS,
  MEDALS,
  SHELVES,
  type CampaignLevel,
  type CampaignShelf,
  type Medal,
} from "./campaign-levels.ts";

export { CAMPAIGN_LEVELS, MEDALS, SHELVES } from "./campaign-levels.ts";
export type { CampaignLevel, CampaignMode, CampaignShelf, Medal } from "./campaign-levels.ts";

/* ── THE MAP, BUILT ───────────────────────────────────────────────────── */

/** The shelf a map belongs to. */
export function shelfOf(level: CampaignLevel): CampaignShelf {
  return SHELVES.find((s) => s.levels.includes(level)) ?? SHELVES[0];
}

/** Where a map id sits, for the finish handler that has only the id. */
export function findLevel(
  id: string,
): { shelf: CampaignShelf; level: CampaignLevel; index: number } | null {
  for (const shelf of SHELVES) {
    const index = shelf.levels.findIndex((l) => l.id === id);
    if (index >= 0) return { shelf, level: shelf.levels[index], index };
  }
  return null;
}

/** THE MAP ITSELF, exactly as it was curated: the seed on its own generator
 * version, in its country, built to its grade (R23). Nothing about the sky
 * is in here — a pinned sky is laid over the run (`pinnedGameOptions`), and
 * the same map under a different sky is the same map, with the same
 * digest. */
export function buildCampaignLevel(level: CampaignLevel): Level {
  return generateLevel(level.seed, {
    version: level.version,
    region: level.region,
    grade: level.grade,
  });
}

/** THE SKY the map is ridden under, where the rung pins one over the day its
 * seed dealt — what the rating reads, and what the run is stood up in. */
export function campaignSky(level: CampaignLevel): SkyOverride | undefined {
  return level.sky;
}

/** WHETHER A PINNED MAP CAN BE RIDDEN AS `mode`: every one of them takes the
 * RACE and the TIME TRIAL — a map carries no discipline of its own, the piste
 * is the piste — and none takes the FREE RIDE, the one mode allowed a seed and
 * a day of its own. */
export function fitsMode(_level: CampaignLevel, mode: GameMode): boolean {
  return mode === "race" || mode === "timeTrial";
}

/** The pinned map named by an id, where it exists and the mode can ride it —
 * null on anything else, so a stale stored id is simply not a map. */
export function levelForMode(id: string | null, mode: GameMode): CampaignLevel | null {
  if (id === null) return null;
  const found = findLevel(id);
  return found && fitsMode(found.level, mode) ? found.level : null;
}

/** THE PINNED MAP A MEASURED RUN IS ON, or null where it is choosing its
 * own. A RACE and a TIME TRIAL ride the map the level card last picked
 * (`Settings.level`) — or the first rung, on a fresh app — so two figures in
 * the record book are two figures down the same piste. Two answers are null:
 * a FREE RIDE, the mode that picks a seed; and a LINK that names a seed
 * (`?seed=`), which takes the pinned map off for that visit so a lab or a
 * shared link rides exactly the seed it names. */
export function pinnedFor(
  chosen: string | null,
  mode: GameMode,
  linkSeed: number | null,
): CampaignLevel | null {
  if (linkSeed !== null || !fitsMode(CAMPAIGN_LEVELS[0], mode)) return null;
  return levelForMode(chosen, mode) ?? CAMPAIGN_LEVELS[0];
}

/** WHAT A RIDE PRESS STANDS UP ON A PINNED MAP, as the arguments of the
 * app's `pinned` press: the rung the campaign card opened, in its own mode —
 * or the map `pinnedFor` puts a measured run on — or null where the run is
 * choosing its own seed. */
export function pinnedPress(
  rung: CampaignLevel | null,
  chosen: string | null,
  mode: GameMode,
  linkSeed: number | null,
): [CampaignLevel, CampaignLevel["mode"], boolean] | null {
  if (rung) return [rung, rung.mode, true];
  const pin = pinnedFor(chosen, mode, linkSeed);
  return pin ? [pin, mode === "timeTrial" ? "timeTrial" : "race", false] : null;
}

/** Whether `level` is the very map `pin` builds — the same seed on the same
 * generator — so a run on it can reuse a map already standing rather than
 * build it again. */
export function isPinnedMap(level: Level, pin: CampaignLevel): boolean {
  return level.seed === pin.seed && level.version === pin.version;
}

/** Who skis a pinned run, and with what: the pair, the help, and whether
 * blows cost him. */
export type PinnedSkier = { spec: SkiSpec; assist: Assist; damage: boolean };

/** A RUN ON THE PINNED MAP — the map's own snow under the map's own sky,
 * skied as `mode` on the skier's pair. `laps` is the run's own — a
 * rung's, or a measured run's (`measuredLaps`) — and the rung's when left
 * out.
 *
 * `built` is the map already paid for — building one is the most expensive
 * thing this engine does, and the map under the menu is often the very one
 * asked for. */
export function pinnedGameOptions(
  level: CampaignLevel,
  mode: CampaignLevel["mode"],
  skier: PinnedSkier,
  opts: { laps?: number; built?: Level; contact?: boolean } = {},
): CreateGameOptions {
  return {
    seed: level.seed,
    level: opts.built ?? buildCampaignLevel(level),
    mode,
    laps: opts.laps ?? level.laps,
    sky: campaignSky(level),
    spec: skier.spec,
    assist: skier.assist,
    damage: skier.damage,
    contact: opts.contact,
  };
}

/** A CAMPAIGN RUN of the map: the pinned map in the rung's own mode over the
 * rung's own laps, with the field on it (a race) and nobody able to lean on
 * anybody. */
export function campaignGameOptions(
  level: CampaignLevel,
  skier: PinnedSkier,
  built?: Level,
): CreateGameOptions {
  return pinnedGameOptions(level, level.mode, skier, { built, contact: false });
}

/** How many runs a MEASURED run on a pinned map is: a race is the race's
 * one (R16) whatever the rung's own, a trial the front door's chip (one). */
export function measuredLaps(mode: GameMode, trialLaps: number): number {
  return mode === "timeTrial" ? trialLaps : LEVEL_RULES.race.laps;
}

/** THE RUN A PRESS ASKS FOR on a pinned map: a campaign RUNG in its own mode
 * over its own laps, or — off the level card — the map ridden as `mode`, a
 * race over the race's laps and a trial over the front door's `trialLaps`. */
export function pinnedRun(
  pin: CampaignLevel,
  mode: CampaignLevel["mode"],
  rung: boolean,
  skier: PinnedSkier,
  trialLaps: number,
  built?: Level,
): CreateGameOptions {
  if (rung) return campaignGameOptions(pin, skier, built);
  return pinnedGameOptions(pin, mode, skier, { laps: measuredLaps(mode, trialLaps), built });
}

/* ── THE POINTS ───────────────────────────────────────────────────────── */

/** The player's own id on a board; a rival's is `skierKey(rival.id)`. */
export const PLAYER_ID = "you";

/** A skier's key on the board from the engine's own reading of the field
 * (`fieldOrder`: a rival's slot id, `null` for the player). */
export function skierKey(id: number | null): string {
  return id === null ? PLAYER_ID : `r${id}`;
}

/** What a place is worth, best first. Off the end of it a race is worth
 * nothing at all: a table where everybody scores is a starting-money table,
 * and fourth of four has to STING. */
export const POINTS = [3, 2, 1] as const;

/** How many places the podium is — the length of the points table, because
 * they are the same statement: finish where nothing is paid and the rung is
 * not cleared. */
export const PODIUM = POINTS.length;

export function pointsFor(place: number): number {
  return POINTS[place - 1] ?? 0;
}

/** WHICH MEDAL a time earns on a trial, or none. A race pays no medal. */
export function medalFor(level: CampaignLevel, time: number): Medal | null {
  if (!level.medals) return null;
  let won: Medal | null = null;
  for (const medal of MEDALS) if (time <= level.medals[medal]) won = medal;
  return won;
}

/** Points for one race, by skier id. */
export type LevelScores = Record<string, number>;

/** What the player got out of a map, best of every afternoon: the time, the
 * skis that set it, the best place against the field (1 on a trial, where
 * there is no field) and — on a trial — the best medal.
 *
 * The time and the skis are absent together on a map opened by hand
 * (`campaign-unlocks.ts`): it has a place and a medal because that is what a
 * lock reads, and no time because nobody rode one. The first real run fills
 * the pair in. */
export type LevelResult = {
  best?: number;
  skis?: SkiId;
  place: number;
  medal: Medal | null;
};

export type CampaignProgress = {
  /** The player's best on each map ridden to the flag, by map id. */
  results: Record<string, LevelResult>;
  /** What every race has paid the WHOLE FIELD, by map id — the board the
   * campaign is played on. A map never ridden, and a trial, is absent. */
  points: Record<string, LevelScores>;
};

export const EMPTY_PROGRESS: CampaignProgress = { results: {}, points: {} };

/** A finished run, as the app hands it in: the time, the skis, and the field
 * in the order it stood at the player's flag (`fieldOrder`). */
export type CampaignRun = {
  time: number;
  skis: SkiId;
  order: readonly (number | null)[];
};

/** THE RUN, BOOKED: the map's result and the field's points, keeping THE
 * BETTER AFTERNOON — the one that placed the player higher, and the whole
 * field's points from that same run with it. A worse run changes nothing on
 * the board (a run skied for fun must never cost a title), while the best
 * time and the best medal improve on their own, whatever the field did.
 * Pure: returns the progress to render from. */
export function recordRun(
  progress: CampaignProgress,
  level: CampaignLevel,
  run: CampaignRun,
): CampaignProgress {
  const place = run.order.indexOf(null) + 1 || run.order.length + 1;
  const medal = medalFor(level, run.time);
  const stood = progress.results[level.id];
  // The time and the skis are kept or replaced TOGETHER — a best time beside
  // the wrong pair is a line the card would read out loud.
  const figure =
    stood?.best === undefined || run.time < stood.best
      ? { best: run.time, skis: run.skis }
      : { best: stood.best, skis: stood.skis };
  const result: LevelResult = {
    ...figure,
    place: stood === undefined ? place : Math.min(stood.place, place),
    medal: stood === undefined ? medal : bestMedal(stood.medal, medal),
  };
  const results = { ...progress.results, [level.id]: result };
  if (level.mode !== "race") return { results, points: progress.points };
  const scored: LevelScores = {};
  run.order.forEach((id, i) => {
    scored[skierKey(id)] = pointsFor(i + 1);
  });
  const board = progress.points[level.id];
  const mine = scored[PLAYER_ID] ?? 0;
  const theirs = board?.[PLAYER_ID] ?? 0;
  const points =
    board === undefined || mine > theirs
      ? { ...progress.points, [level.id]: scored }
      : progress.points;
  return { results, points };
}

function bestMedal(a: Medal | null, b: Medal | null): Medal | null {
  if (a === null) return b;
  if (b === null) return a;
  return MEDALS.indexOf(a) >= MEDALS.indexOf(b) ? a : b;
}

/* ── THE LOCKS ────────────────────────────────────────────────────────── */

/** CLEARED — the map paid the player something: a podium on a race, a medal
 * on a trial. */
export function levelCleared(progress: CampaignProgress, level: CampaignLevel): boolean {
  const result = progress.results[level.id];
  if (result === undefined) return false;
  return level.mode === "timeTrial" ? result.medal !== null : result.place <= PODIUM;
}

/** A map opens once the one before it on its shelf has been cleared; the
 * first is always open — on a shelf that is. */
export function levelUnlocked(
  shelf: CampaignShelf,
  index: number,
  progress: CampaignProgress,
): boolean {
  if (!shelfUnlocked(shelf, progress)) return false;
  if (index <= 0) return true;
  return levelCleared(progress, shelf.levels[index - 1]);
}

/** One skier's line of a shelf's table. */
export type StandingsRow = {
  id: string;
  points: number;
  /** Race wins — the first tie-break, and the line a shelf is remembered by. */
  wins: number;
  /** 1 is the lead. */
  place: number;
  you: boolean;
};

/** THE TABLE — every skier entered on the shelf, the player included, best
 * first. Ties go to race wins, then to the player: a shelf that ends level
 * and hands the next one to the machine is a lock with no visible way in.
 * The rivals are the race's start line, by slot, so a skier who has never scored
 * still has a row. */
export function shelfStandings(shelf: CampaignShelf, progress: CampaignProgress): StandingsRow[] {
  const ids = [PLAYER_ID, ...Array.from({ length: RACE.rivals }, (_, i) => skierKey(i))];
  const rows = ids.map((id) => {
    let points = 0;
    let wins = 0;
    for (const level of shelf.levels) {
      const got = progress.points[level.id]?.[id] ?? 0;
      points += got;
      if (got === POINTS[0]) wins += 1;
    }
    return { id, points, wins, you: id === PLAYER_ID };
  });
  rows.sort(
    (a, b) => b.points - a.points || b.wins - a.wins || (a.you ? -1 : 0) - (b.you ? -1 : 0),
  );
  return rows.map((row, index) => ({ ...row, place: index + 1 }));
}

/** The player's own line of the table. */
export function playerStanding(shelf: CampaignShelf, progress: CampaignProgress): StandingsRow {
  const table = shelfStandings(shelf, progress);
  return table.find((row) => row.you) ?? table[table.length - 1];
}

/** How many of the shelf's maps have been CLEARED. */
export function levelsCleared(shelf: CampaignShelf, progress: CampaignProgress): number {
  return shelf.levels.filter((level) => levelCleared(progress, level)).length;
}

/** WON — every map cleared and the player top of the shelf's table. Both
 * halves matter: a table nobody has scored on is one the player leads on the
 * tie-break, and an empty board must not open a shelf. */
export function shelfWon(shelf: CampaignShelf, progress: CampaignProgress): boolean {
  return (
    levelsCleared(shelf, progress) === shelf.levels.length &&
    playerStanding(shelf, progress).place === 1
  );
}

/** A shelf opens once the one before it has been WON. The first is always
 * open. */
export function shelfUnlocked(shelf: CampaignShelf, progress: CampaignProgress): boolean {
  const index = SHELVES.indexOf(shelf);
  if (index <= 0) return true;
  return shelfWon(SHELVES[index - 1], progress);
}

/** WHERE THE CAMPAIGN PICKS BACK UP on a shelf. Forward first: the next open
 * map never ridden. Then back to the first open race not WON or trial
 * without its gold — which is the whole shape of a points campaign. Null
 * when every open map has given up all it has. */
export function continueAt(shelf: CampaignShelf, progress: CampaignProgress): CampaignLevel | null {
  const open = shelf.levels.filter((_l, index) => levelUnlocked(shelf, index, progress));
  const spent = (level: CampaignLevel): boolean =>
    level.mode === "race"
      ? (progress.points[level.id]?.[PLAYER_ID] ?? 0) === POINTS[0]
      : progress.results[level.id]?.medal === MEDALS[MEDALS.length - 1];
  return (
    open.find((level) => progress.results[level.id] === undefined) ??
    open.find((level) => !spent(level)) ??
    null
  );
}

/** The furthest shelf the campaign has opened — where the card lands. */
export function reachedShelf(progress: CampaignProgress): CampaignShelf {
  let reached = SHELVES[0];
  for (const shelf of SHELVES) if (shelfUnlocked(shelf, progress)) reached = shelf;
  return reached;
}

/** HOW FAR THE CAMPAIGN HAS GOT, in one figure — what the front door's tile
 * bills itself with. CLEARED rather than ridden, because cleared is what
 * opens the next rung. Counted over the whole ladder, so the figure never
 * goes backwards or resets between shelves. */
export function campaignStanding(progress: CampaignProgress): { cleared: number; of: number } {
  return {
    cleared: CAMPAIGN_LEVELS.filter((level) => levelCleared(progress, level)).length,
    of: CAMPAIGN_LEVELS.length,
  };
}

/** THE FRONT DOOR'S PINNED FACES: the campaign tile's (how far up the ladder
 * and the rung it would pick next) and the map the RACE and TIME TRIAL tiles
 * ride — null where a link pinned a seed instead. */
export function frontDoorPins(
  progress: CampaignProgress,
  chosen: string | null,
  linkSeed: number | null,
): {
  campaign: { cleared: number; of: number; next: string | null };
  raceMap: string | null;
  trialMap: string | null;
} {
  return {
    campaign: {
      ...campaignStanding(progress),
      next: continueAt(reachedShelf(progress), progress)?.name ?? null,
    },
    raceMap: pinnedFor(chosen, "race", linkSeed)?.name ?? null,
    trialMap: pinnedFor(chosen, "timeTrial", linkSeed)?.name ?? null,
  };
}

/** Where the ladder goes after a map: the next rung, the next SHELF behind
 * the table it is locked to, or the end of the road. */
export type LadderStep =
  | { kind: "next"; level: CampaignLevel }
  | { kind: "locked"; shelf: CampaignShelf }
  | { kind: "end" };

export function ladderAfter(levelId: string, progress: CampaignProgress): LadderStep {
  const here = findLevel(levelId);
  if (!here) return { kind: "end" };
  const after = here.shelf.levels[here.index + 1];
  if (after) {
    return levelUnlocked(here.shelf, here.index + 1, progress)
      ? { kind: "next", level: after }
      : { kind: "locked", shelf: here.shelf };
  }
  const nextShelf = SHELVES[SHELVES.indexOf(here.shelf) + 1];
  if (!nextShelf) return { kind: "end" };
  return shelfUnlocked(nextShelf, progress)
    ? { kind: "next", level: nextShelf.levels[0] }
    : { kind: "locked", shelf: here.shelf };
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

/** Versioned, so a board a later ladder reshapes is a board it can
 * recognise: the board is keyed by MAP ID and the ids are rung numbers, so a
 * re-cut shelf would land a row on water nobody rode. v2 is the ladder re-cut
 * by piste grade (R23) — its ids are the grades' (`green-1` …), so a v1 row
 * carried in by the cloud save names no map and is dropped too. */
export const PROGRESS_KEY = "fall-line.campaign.v2";

/** A stored blob turned into progress this build can stand on: every id
 * checked against this ladder, every figure checked for being a number, and
 * anything else dropped — a map that no longer exists takes its row with it
 * rather than leaving a ghost on the board. */
export function mergeProgress(parsed: unknown): CampaignProgress {
  const out: CampaignProgress = { results: {}, points: {} };
  if (typeof parsed !== "object" || parsed === null) return out;
  const known = new Set(CAMPAIGN_LEVELS.map((l) => l.id));
  const blob = parsed as { results?: unknown; points?: unknown };
  if (typeof blob.results === "object" && blob.results !== null) {
    for (const [id, row] of Object.entries(blob.results as Record<string, unknown>)) {
      if (!known.has(id) || typeof row !== "object" || row === null) continue;
      const r = row as Partial<LevelResult>;
      if (!Number.isInteger(r.place) || (r.place as number) < 1) continue;
      const medal = MEDALS.find((m) => m === r.medal) ?? null;
      const kept: LevelResult = { place: r.place as number, medal };
      // The time and the skis come as a pair or not at all.
      const timed = typeof r.best === "number" && Number.isFinite(r.best) && r.best >= 0;
      if (timed && typeof r.skis === "string" && isSkiId(r.skis)) {
        kept.best = r.best;
        kept.skis = r.skis;
      } else if (r.best !== undefined || r.skis !== undefined) continue;
      out.results[id] = kept;
    }
  }
  if (typeof blob.points === "object" && blob.points !== null) {
    for (const [id, row] of Object.entries(blob.points as Record<string, unknown>)) {
      if (!known.has(id) || typeof row !== "object" || row === null) continue;
      const scores: LevelScores = {};
      for (const [skier, got] of Object.entries(row as Record<string, unknown>)) {
        if (typeof got === "number" && Number.isFinite(got)) scores[skier] = got;
      }
      out.points[id] = scores;
    }
  }
  return out;
}

export function loadProgress(): CampaignProgress {
  try {
    const stored = localStorage.getItem(PROGRESS_KEY);
    return stored ? mergeProgress(JSON.parse(stored)) : EMPTY_PROGRESS;
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(progress: CampaignProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable — the board still holds for this session */
  }
}
