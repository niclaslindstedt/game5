// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARDS A PINNED MAP IS CHOSEN ON, as the front door's pages see them:
// the CAMPAIGN card (a rung, ridden for points), the LEVEL card (a map for a
// RACE or a TIME TRIAL, ridden for the record book) and the TRICK MAP card
// (a map for a TRICKS run). One component so `App.tsx` routes the three
// pages with one branch: which card is up is the page, and what a pick does
// is the app's.

import { skisById, type GameMode, type SkiId } from "@engine";

import { measuredLaps, type CampaignLevel, type CampaignProgress } from "./campaign.ts";
import { CampaignPage } from "./menu-campaign.tsx";
import { LevelsPage } from "./menu-levels.tsx";
import { TrickMapsPage } from "./menu-tricks.tsx";
import type { RecordKey, RunRecord } from "./records.ts";
import type { Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";
import type { TrickMap } from "./trick-maps.ts";

export function PinnedCards({
  page,
  mode,
  settings,
  skis,
  progress,
  standing,
  onBack,
  onChoose,
  onTrick,
}: {
  page: "campaign" | "levels" | "tricks";
  /** The mode the level card picks a map for. */
  mode: GameMode;
  /** The trial's length off the front door's chip, and the map the level
   * card last picked (`Settings.level`). */
  settings: Settings;
  /** The machine the skis card holds — a record book row is one skis's. */
  skis: SkiId;
  progress: CampaignProgress;
  /** The record book's row under a key (`ghost-run.ts`'s `standing`). */
  standing: (key: RecordKey) => RunRecord | null;
  onBack: () => void;
  /** A map picked, on to the skis card: a campaign RUNG, or a map off the
   * level card. */
  onChoose: (level: CampaignLevel, rung: boolean) => void;
  /** A trick map picked, on to the skis card. */
  onTrick: (map: TrickMap) => void;
}) {
  if (page === "tricks") {
    return <TrickMapsPage chosen={settings.trickMap} onBack={onBack} onPick={onTrick} />;
  }
  if (page === "campaign") {
    return (
      <CampaignPage progress={progress} onBack={onBack} onRide={(level) => onChoose(level, true)} />
    );
  }
  const laps = measuredLaps(mode, settings.trialLaps);
  return (
    <LevelsPage
      mode={mode}
      progress={progress}
      chosen={settings.level}
      best={(level) => {
        const row = standing({ seed: level.seed, course: level.course, skis, mode, laps });
        return row ? STRINGS.levelsBest(row.value, skisById(row.skis).name) : null;
      }}
      onBack={onBack}
      onPick={(level) => onChoose(level, false)}
    />
  );
}
