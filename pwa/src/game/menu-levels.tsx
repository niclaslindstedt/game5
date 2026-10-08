// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEVEL CARD — which of the pinned maps a RACE is ridden on.
//
// THE GAME'S MEASURED MAPS ARE PINNED. A time is only worth measuring
// against somebody else's if the two were skied down the same piste on the
// same day, and a seed dealt at random is a mountain nobody else has ever
// seen — so the modes that keep a record book pick a MAP here, and a seed of
// one's own stays where nothing is measured (the FREE RIDE's start card, and
// a link's `?seed=`).
//
// A RACE — a slalom, a super-G, a downhill — picks one of ITS DISCIPLINE'S NINE
// (`race-maps.ts`), every one open: nine maps chosen for the discipline, one
// page of boxes, the course's drop and length on each.
//
// The card wears the map boxes' own silhouette and classes — the boxes, the
// piste behind each (`course-map.tsx`) — because a map should look like
// itself wherever it is offered: what the run would BE and the best it has
// ever been ridden in.

import { type GameMode } from "@engine";

import { CourseMap, dayLine } from "./course-map.tsx";
import { type PinnedLevel, type PinnedMode } from "./pinned.ts";
import { raceMapsOf, type RaceMap } from "./race-maps.ts";
import { GradeMark } from "./grade-mark.tsx";
import { MenuBody, MenuHead } from "./menu-knobs.tsx";
import { Glyph } from "./menu-glyphs.tsx";
import { STRINGS } from "./strings.ts";

/** The measured mode's own billing word: the slalom's for any other. */
function billedMode(mode: GameMode): PinnedMode {
  return mode === "downhill" ||
    mode === "superG" ||
    mode === "giantSlalom" ||
    mode === "speedSki" ||
    mode === "skiCross"
    ? mode
    : "slalom";
}

function LevelBox({
  level,
  mode,
  best,
  chosen,
  onPick,
}: {
  level: PinnedLevel | RaceMap;
  mode: GameMode;
  /** The best this map has seen in THIS mode, as the record book reads it. */
  best: string | null;
  /** The box the card would ride — where the cursor lands. One per card. */
  chosen: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      class={`menu-level menu-level-open${chosen ? " menu-level-next" : ""}`}
      aria-current={chosen ? "step" : undefined}
      data-nav-next={chosen ? "" : undefined}
      data-nav-focus={chosen ? "" : undefined}
      onClick={onPick}
    >
      <CourseMap levelId={level.id} />
      <span class="menu-level-head">
        <GradeMark grade={level.grade} className="menu-level-grade" />
        <Glyph name="flag" className="menu-level-mode" />
        <span class="menu-level-billing">{STRINGS.mapBilling(billedMode(mode))}</span>
      </span>
      <span class="menu-level-name">{level.name}</span>
      <span class="menu-level-day">{dayLine(level)}</span>
      {"figures" in level && (
        <span class="menu-level-day">
          {STRINGS.levelsFigures(level.figures.vertical, level.figures.length)}
        </span>
      )}
      <span class="menu-level-marks">
        <span class={`menu-level-mark${best === null ? "" : " menu-level-mark-lit"}`}>
          {best ?? STRINGS.levelsNoBest}
        </span>
      </span>
    </button>
  );
}

export function LevelsPage({
  mode,
  chosen,
  best,
  onBack,
  onPick,
}: {
  mode: GameMode;
  /** The map the settings already stand on, if any. */
  chosen: string | null;
  /** The record standing on a map in this mode, as a line, or null. */
  best: (level: PinnedLevel) => string | null;
  onBack: () => void;
  /** On to the skis card, which is where RIDE is. */
  onPick: (level: PinnedLevel) => void;
}) {
  // Only a race reaches this card (`skisBack`): a mode with no nine of its
  // own has nothing to pick here.
  const races = raceMapsOf(mode);
  if (!races) return null;
  return (
    <RaceMapsPage
      mode={mode}
      maps={races}
      chosen={chosen}
      best={best}
      onBack={onBack}
      onPick={onPick}
    />
  );
}

/** The title over a level card, by the mode it picks a map for. */
function levelsTitle(mode: GameMode): string {
  return mode === "downhill"
    ? STRINGS.levelsDownhill
    : mode === "superG"
      ? STRINGS.levelsSuperG
      : mode === "giantSlalom"
        ? STRINGS.levelsGiantSlalom
        : mode === "speedSki"
          ? STRINGS.levelsSpeedSki
          : mode === "skiCross"
            ? STRINGS.levelsSkiCross
            : STRINGS.levelsRace;
}

/** THE RIDE PRESS in a level card's head: on to the skis card. */
function RidePress({ onPick }: { onPick: () => void }) {
  return (
    <button
      type="button"
      class="menu-item menu-item-start menu-head-go"
      data-menu="skis"
      onClick={onPick}
    >
      <span class="menu-item-name">{STRINGS.mapRide}</span>
    </button>
  );
}

/** A DISCIPLINE'S NINE, on one page, every one open. */
function RaceMapsPage({
  mode,
  maps,
  chosen,
  best,
  onBack,
  onPick,
}: {
  mode: GameMode;
  maps: readonly RaceMap[];
  chosen: string | null;
  best: (level: PinnedLevel) => string | null;
  onBack: () => void;
  onPick: (level: PinnedLevel) => void;
}) {
  const pick = maps.find((map) => map.id === chosen) ?? maps[0];
  return (
    <div class="menu-card menu-card-levels">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={levelsTitle(mode)}
        action={<RidePress onPick={() => onPick(pick)} />}
      />
      <MenuBody>
        <p class="menu-sub">{STRINGS.levelsRaceMaps}</p>
        <div class="menu-levels">
          {maps.map((map) => (
            <LevelBox
              key={map.id}
              level={map}
              mode={mode}
              best={best(map)}
              chosen={map === pick}
              onPick={() => onPick(map)}
            />
          ))}
        </div>
      </MenuBody>
    </div>
  );
}
