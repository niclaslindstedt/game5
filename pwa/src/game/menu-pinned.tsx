// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARDS A PINNED MAP IS CHOSEN ON, as the front door's pages see them:
// the LEVEL card (a map for a RACE — one of its discipline's nine, raced for
// the record book) and the TRICK MAP card (a map for a TRICKS run). One
// component so `App.tsx` routes both pages with one branch: which card is up
// is the page, and what a pick does is the app's.

import { LEVEL_RULES, skisById, type GameMode, type SkiId } from "@engine";

import { LevelsPage } from "./menu-levels.tsx";
import type { PinnedLevel } from "./pinned.ts";
import { disciplineOf } from "./race-maps.ts";
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
  standing,
  onBack,
  onChoose,
  onTrick,
  onSettings,
}: {
  page: "levels" | "tricks";
  /** The mode the level card picks a map for. */
  mode: GameMode;
  /** The maps the level cards last picked (`Settings.raceMap`). */
  settings: Settings;
  /** The machine the skis card holds — a record book row is one skis's. */
  skis: SkiId;
  /** The record book's row under a key (`ghost-run.ts`'s `standing`). */
  standing: (key: RecordKey) => RunRecord | null;
  onBack: () => void;
  /** A map picked off the level card, on to the skis card. */
  onChoose: (level: PinnedLevel) => void;
  /** A trick map picked, on to the skis card. */
  onTrick: (map: TrickMap) => void;
  /** A setting changed on a card — the jump an aerials contest declares. */
  onSettings: (next: (s: Settings) => Settings) => void;
}) {
  if (page === "tricks") {
    return (
      <TrickMapsPage
        mode={mode}
        chosen={settings.trickMap}
        plan={settings.aerialPlan}
        onPlan={(plan) => onSettings((s) => ({ ...s, aerialPlan: plan }))}
        onBack={onBack}
        onPick={onTrick}
      />
    );
  }
  // A race off the level card is the race's one run (R16).
  const laps = LEVEL_RULES.race.laps;
  const pick = disciplineOf(mode);
  return (
    <LevelsPage
      mode={mode}
      chosen={pick === null ? null : (settings.raceMap[pick] ?? null)}
      best={(level) => {
        const row = standing({ seed: level.seed, course: level.course, skis, mode, laps });
        return row ? STRINGS.levelsBest(row.value, skisById(row.skis).name) : null;
      }}
      onBack={onBack}
      onPick={onChoose}
    />
  );
}
