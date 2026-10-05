// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEVEL CARD — which of the pinned maps a RACE or a TIME TRIAL is ridden
// on.
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
// A TIME TRIAL picks one of the CAMPAIGN'S maps, and what is open is what
// the campaign has opened, a whole shelf at a time (`shelfUnlocked`). Not
// map by map: this is not a second ladder to climb, it is the shelves you
// have been given, and a skier who has skied the glacier should be able to
// time any of it. The first shelf holding a map the mode can ride is open
// on a fresh app (`shelfOpenFor`), so the card is never empty and always
// has its SKI press.
//
// The card wears the campaign's own silhouette and classes — the shelf tabs,
// the boxes, the piste behind each — because a map should look like itself
// wherever it is offered. What is INSIDE a box is each card's own: the ladder
// shows what a rung paid, and this shows what the run would BE and the best
// it has ever been ridden in.

import { type GameMode } from "@engine";
import { useState } from "preact/hooks";

import {
  findLevel,
  fitsMode,
  reachedShelfFor,
  shelfOpenFor,
  type CampaignLevel,
  type CampaignMode,
  type CampaignProgress,
  type CampaignShelf,
} from "./campaign.ts";
import { CourseMap, ShelfTabs, dayLine } from "./menu-campaign.tsx";
import { raceMapsOf, type RaceMap } from "./race-maps.ts";
import { GradeMark } from "./grade-mark.tsx";
import { MenuBody, MenuHead } from "./menu-knobs.tsx";
import { Glyph } from "./menu-glyphs.tsx";
import { STRINGS } from "./strings.ts";

/** The measured mode's own billing word: the slalom's for any other. */
function billedMode(mode: GameMode): CampaignMode {
  return mode === "timeTrial" || mode === "downhill" || mode === "superG" || mode === "speedSki"
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
  level: CampaignLevel | RaceMap;
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
        <Glyph name={mode === "timeTrial" ? "clock" : "flag"} className="menu-level-mode" />
        <span class="menu-level-billing">{STRINGS.campaignBilling(billedMode(mode))}</span>
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
  progress,
  chosen,
  best,
  onBack,
  onPick,
}: {
  mode: GameMode;
  /** The campaign's board — what is open here is what it has opened. */
  progress: CampaignProgress;
  /** The map the settings already stand on, if any. */
  chosen: string | null;
  /** The record standing on a map in this mode, as a line, or null. */
  best: (level: CampaignLevel) => string | null;
  onBack: () => void;
  /** On to the skis card, which is where RIDE is. */
  onPick: (level: CampaignLevel) => void;
}) {
  const races = raceMapsOf(mode);
  if (races) {
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
  return (
    <ShelvesPage
      mode={mode}
      progress={progress}
      chosen={chosen}
      best={best}
      onBack={onBack}
      onPick={onPick}
    />
  );
}

/** The title over a level card, by the mode it picks a map for. */
function levelsTitle(mode: GameMode): string {
  return mode === "timeTrial"
    ? STRINGS.levelsTrial
    : mode === "downhill"
      ? STRINGS.levelsDownhill
      : mode === "superG"
        ? STRINGS.levelsSuperG
        : mode === "speedSki"
          ? STRINGS.levelsSpeedSki
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
      <span class="menu-item-name">{STRINGS.campaignRide}</span>
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
  best: (level: CampaignLevel) => string | null;
  onBack: () => void;
  onPick: (level: CampaignLevel) => void;
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

/** THE CAMPAIGN'S SHELVES, as the time trial picks a map off them. */
function ShelvesPage({
  mode,
  progress,
  chosen,
  best,
  onBack,
  onPick,
}: {
  mode: GameMode;
  progress: CampaignProgress;
  chosen: string | null;
  best: (level: CampaignLevel) => string | null;
  onBack: () => void;
  onPick: (level: CampaignLevel) => void;
}) {
  const stood = chosen === null ? null : findLevel(chosen);
  const offered = (shelf: CampaignShelf): boolean => shelfOpenFor(shelf, mode, progress);
  const [shown, setShown] = useState<CampaignShelf>(() =>
    stood && fitsMode(stood.level, mode) && offered(stood.shelf)
      ? stood.shelf
      : reachedShelfFor(mode, progress),
  );
  const open = offered(shown);
  // Only the maps the mode can ride: a slalom only where the campaign sets
  // one, a downhill on a downhill's course (`fitsMode`).
  const maps = shown.levels.filter((level) => fitsMode(level, mode));
  const billed = billedMode(mode);
  const pick = open ? (maps.find((level) => level.id === chosen) ?? maps[0] ?? null) : null;
  return (
    <div class="menu-card menu-card-levels">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={levelsTitle(mode)}
        action={pick ? <RidePress onPick={() => onPick(pick)} /> : undefined}
      />
      <MenuBody>
        <ShelfTabs
          shown={shown}
          open={offered}
          line={(shelf) => shelf.blurb}
          hint={STRINGS.levelsShelfLocked}
          onPick={setShown}
        />
        {open && maps.length === 0 ? (
          <p class="menu-empty">{STRINGS.levelsNoneHere(billed)}</p>
        ) : open ? (
          <div class="menu-levels">
            {maps.map((level) => (
              <LevelBox
                key={level.id}
                level={level}
                mode={mode}
                best={best(level)}
                chosen={level === pick}
                onPick={() => onPick(level)}
              />
            ))}
          </div>
        ) : (
          <p class="menu-empty">{STRINGS.campaignShelfLocked}</p>
        )}
      </MenuBody>
    </div>
  );
}
