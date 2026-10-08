// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A CAMPAIGN RUN, BOOKED — the rig the app drives beside a run on a rung,
// and the lines the finish plate adds for it.
//
// The rig is ARMED with the rung a run is ridden on before its first step,
// and it books the run on the step the PLAYER takes the flag: the field
// placed as it stands at that moment (`fieldOrder` — a rival still out is
// behind a skier who has finished), the board kept at the better afternoon
// (`recordRun`), and the plate's lines written from the ladder as it stood
// before the run and as it stands after. A run is booked once: a restart
// arms the rig again, and anything that is not a rung — a free ride, a race
// off the level card, the bot's race under a card — is armed with nothing.
//
// It is the ghost rig's shape (`ghost-run.ts`) and for the same reason: the
// app decides WHEN a run is armed, stepped and dropped, and this decides
// what a finish on a rung is WORTH. DOM-free, storage-free — the board is
// handed in and handed back — so `tests/campaign_test.ts` rides it with a
// real engine state and no browser.

import { fieldOrder, type GameState } from "@engine";

import {
  findLevel,
  ladderAfter,
  levelCleared,
  levelUnlocked,
  pointsFor,
  recordRun,
  shelfWon,
  type CampaignLevel,
  type CampaignProgress,
} from "./campaign.ts";
import { STRINGS } from "./strings.ts";

/** What the finish plate says about a rung, over what it says of any run. */
export type CampaignPlate = {
  /** The shelf, the rung's number and its name. */
  title: string;
  /** What the run paid: the points. */
  award: string;
  /** Whether the run CLEARED the rung — the award is lit. */
  cleared: boolean;
  /** What the finish did to the ladder: a map opened, a shelf won, what is
   * still owed — or nothing, when the ladder did not move. */
  ladder: string | null;
  /** The map the plate's NEXT press rides, where the ladder has one open. */
  next: CampaignLevel | null;
};

/** THE PLATE'S LINES for a run on `level` that finished `place` of the field,
 * with the board as it stood before the run and after it. Pure. */
export function campaignPlateFor(
  level: CampaignLevel,
  place: number,
  before: CampaignProgress,
  after: CampaignProgress,
): CampaignPlate {
  const here = findLevel(level.id);
  const shelf = here?.shelf;
  const title = STRINGS.plateRung(shelf?.name ?? "", (here?.index ?? 0) + 1, level.name);
  const award = STRINGS.platePoints(pointsFor(place));
  const cleared = pointsFor(place) > 0;

  const step = ladderAfter(level.id, after);
  let ladder: string | null = null;
  if (shelf && shelfWon(shelf, after) && !shelfWon(shelf, before)) {
    ladder = STRINGS.plateShelfWon(shelf.name);
  } else if (step.kind === "next") {
    const found = findLevel(step.level.id);
    const wasOpen = found ? levelUnlocked(found.shelf, found.index, before) : true;
    if (!wasOpen) ladder = STRINGS.plateOpened(step.level.name);
  } else if (step.kind === "locked") {
    ladder = levelCleared(after, level) ? STRINGS.plateTableLocked : STRINGS.plateLocked;
  } else {
    ladder = levelCleared(after, level) ? STRINGS.plateEnd : STRINGS.plateLocked;
  }
  return {
    title,
    award,
    cleared,
    ladder,
    next: step.kind === "next" ? step.level : null,
  };
}

export type CampaignRig = {
  /** The rung the next run is ridden on, or null for any other run. Clears
   * the plate: a run armed again is a run not yet booked. */
  arm: (level: CampaignLevel | null) => void;
  /** The rung being ridden, or null. */
  riding: () => CampaignLevel | null;
  /** One step of the PLAYER's run — the rig books it on the flag. */
  step: (state: GameState) => void;
  /** The plate's lines once the run is booked; null until the flag. */
  plate: () => CampaignPlate | null;
};

export function createCampaignRig(world: {
  progress: () => CampaignProgress;
  /** The board after a booking — the app keeps it and writes it down. */
  setProgress: (progress: CampaignProgress) => void;
}): CampaignRig {
  let level: CampaignLevel | null = null;
  let plate: CampaignPlate | null = null;
  return {
    arm: (next) => {
      level = next;
      plate = null;
    },
    riding: () => level,
    step: (state) => {
      if (!level || plate) return;
      for (const e of state.events) {
        if (e.kind !== "finish") continue;
        const before = world.progress();
        const order = fieldOrder(state);
        const after = recordRun(before, level, {
          time: e.time,
          skis: state.skier.spec.id,
          order,
        });
        world.setProgress(after);
        plate = campaignPlateFor(level, order.indexOf(null) + 1, before, after);
      }
    },
    plate: () => plate,
  };
}
