// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEVELOPER ▸ UNLOCKS, as policy: the campaign's board SET rather than
// earned.
//
// The ladder costs evenings — sixteen maps, each behind a podium on the one
// before it, and a shelf behind a table won outright. That is the
// right price for a player and the wrong one for anybody who has to LOOK at
// the last rung, which is every review pass. So every shelf can be opened
// or shut by hand, and the whole ladder at once.
//
// BOTH PRESSES WORK ON A PREFIX, because that is the only shape a ladder can
// be in: opening a shelf wins it AND every shelf before it (a summit open
// over a first shelf never cleared is a board no player could have), and
// shutting one wipes it and every shelf after it.
//
// A GRANT MOVES THE PLACE AND THE BOARD, AND NEVER A TIME: a map
// opened by hand keeps any figure actually ridden on it and invents none
// (`LevelResult`'s time is optional for exactly this). NEITHER PRESS TOUCHES
// THE RECORD BOOK (`records.ts`), which is a different store: a lock puts the
// ladder back without costing a line of what was ridden for it.
//
// Storage-free, so `tests/campaign_test.ts` reads it; `menu-unlocks.tsx` is
// the markup over these answers.

import {
  PLAYER_ID,
  POINTS,
  SHELVES,
  levelCleared,
  skierKey,
  shelfUnlocked,
  shelfWon,
  type CampaignProgress,
  type CampaignShelf,
  type LevelResult,
  type LevelScores,
} from "./campaign.ts";

/** A map won outright: first on the race with the board to match. */
function grantLevel(): { result: LevelResult; scores: LevelScores } {
  const scores: LevelScores = { [PLAYER_ID]: POINTS[0] };
  for (let i = 1; i < POINTS.length; i++) scores[skierKey(i - 1)] = POINTS[i];
  return { result: { place: 1 }, scores };
}

function open(progress: CampaignProgress, shelves: readonly CampaignShelf[]): CampaignProgress {
  const results = { ...progress.results };
  const points = { ...progress.points };
  for (const shelf of shelves) {
    for (const level of shelf.levels) {
      const { result, scores } = grantLevel();
      const stood = results[level.id];
      results[level.id] =
        stood?.best === undefined ? result : { ...result, best: stood.best, skis: stood.skis };
      points[level.id] = scores;
    }
  }
  return { results, points };
}

function shut(progress: CampaignProgress, shelves: readonly CampaignShelf[]): CampaignProgress {
  const results = { ...progress.results };
  const points = { ...progress.points };
  for (const shelf of shelves) {
    for (const level of shelf.levels) {
      delete results[level.id];
      delete points[level.id];
    }
  }
  return { results, points };
}

/** Open the campaign AS FAR AS one shelf — it and every shelf before it
 * won. Null (or an id this ladder does not know) opens the lot. */
export function unlockShelves(
  progress: CampaignProgress,
  shelfId: string | null,
): CampaignProgress {
  const index = SHELVES.findIndex((shelf) => shelf.id === shelfId);
  return open(progress, index < 0 ? SHELVES : SHELVES.slice(0, index + 1));
}

/** Shut one shelf and every shelf after it. Null shuts the lot. */
export function lockShelves(progress: CampaignProgress, shelfId: string | null): CampaignProgress {
  const index = SHELVES.findIndex((shelf) => shelf.id === shelfId);
  return shut(progress, index < 0 ? SHELVES : SHELVES.slice(index));
}

/** One shelf's row on the UNLOCKS page, and whether either press still has
 * anything to do — read over the RUN of shelves each press works on. */
export type UnlockRow = {
  shelf: CampaignShelf;
  cleared: number;
  of: number;
  /** Whether the campaign lets the player onto it at all. */
  open: boolean;
  /** Nothing left for OPEN to do: it and every shelf before it won. */
  won: boolean;
  /** Nothing left for SHUT to do: it and every shelf after it unridden. */
  shut: boolean;
};

export function unlockRows(progress: CampaignProgress): UnlockRow[] {
  const won = SHELVES.map((shelf) => shelfWon(shelf, progress));
  const ridden = SHELVES.map((shelf) =>
    shelf.levels.some((level) => progress.results[level.id] !== undefined),
  );
  return SHELVES.map((shelf, index) => ({
    shelf,
    cleared: shelf.levels.filter((level) => levelCleared(progress, level)).length,
    of: shelf.levels.length,
    open: shelfUnlocked(shelf, progress),
    won: won.slice(0, index + 1).every(Boolean),
    shut: !ridden.slice(index).some(Boolean),
  }));
}
