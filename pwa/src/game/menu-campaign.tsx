// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN CARD — a row of four shelves, six boxes each, and the table
// under the one being looked at.
//
// The card is one column: the shelves as a row of tabs across the top (four
// across, two by two on a phone held upright), each led by its GRADE'S SIGN
// (R23: the green circle, the blue square, the red rectangle, the black
// diamond — `grade-mark.tsx`), the six boxes in a grid, then the table.
// A BOX is a number, a name, what the map is (a race or a time trial, over
// top to bottom) and the day it is skied in, the piste itself drawn behind
// the words (`CourseMap`), and what has been got out of it — the best place
// and the points it paid, the best time, the medal. Shut, it is the number,
// the piste and a padlock, and the reason is its accessible name.
//
// THE RING is on the box the campaign would pick next (`continueAt`): where
// the cursor lands, and what RIDE in the head takes, so a pad walks INTO the
// campaign rather than back to the first box every time.
//
// Which shelf is being looked at is the card's own state and nothing the game
// remembers: the card opens on the furthest shelf the campaign has reached,
// which is where a returning player wants to be.

import { RACE } from "@engine";
import { useState } from "preact/hooks";

import { formatTime } from "@niclaslindstedt/oss-game-framework/hud/format";
import {
  MEDALS,
  PLAYER_ID,
  POINTS,
  SHELVES,
  continueAt,
  levelUnlocked,
  levelsCleared,
  playerStanding,
  reachedShelf,
  shelfStandings,
  shelfUnlocked,
  shelfWon,
  type CampaignLevel,
  type CampaignProgress,
  type CampaignShelf,
} from "./campaign.ts";
import { CAMPAIGN_ROUTES } from "./campaign-routes.ts";
import { MenuHead } from "./menu-knobs.tsx";
import { GradeMark } from "./grade-mark.tsx";
import { Glyph } from "./menu-glyphs.tsx";
import { ROUTE_BOX, ROUTE_STROKE } from "./route-shape.ts";
import { STRINGS } from "./strings.ts";

/** THE MAP'S OWN LOOP, as the shape it is — the whole track in its own box,
 * so a shelf's six boxes read as six different rides before a word on any of
 * them has been read.
 *
 * It sits BEHIND the words rather than beside them: a box is already as
 * short as its contents allow, and a picture given a column of its own would
 * cost the grid the height it was cut down to get. Stroked in
 * `currentColor`, so the box's own state paints it — and aria-hidden, since
 * it says nothing the box does not already say in words. A map `make routes`
 * has not drawn yet simply has no line. */
export function CourseMap({ levelId }: { levelId: string }) {
  const d = CAMPAIGN_ROUTES[levelId];
  if (d === undefined) return null;
  return (
    <svg
      class="menu-level-route"
      viewBox={`0 0 ${ROUTE_BOX} ${ROUTE_BOX}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        stroke-width={ROUTE_STROKE}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

/** THE DAY a map is ridden in, on one line under its name — the sky and the
 * hour the run starts at. Stated here and read by the level card too: a rung
 * and the same map offered for a time trial must not be able to disagree
 * about what day it is. */
export function dayLine(level: CampaignLevel): string {
  return STRINGS.campaignDay(
    STRINGS.campaignSky[level.day.weather] ?? level.day.weather,
    level.day.hour,
  );
}

/** What a box is: the game and its length. */
export function billing(level: CampaignLevel): string {
  return STRINGS.campaignBilling(level.mode === "timeTrial");
}

function LevelBox({
  level,
  index,
  open,
  next,
  progress,
  onRide,
}: {
  level: CampaignLevel;
  index: number;
  open: boolean;
  next: boolean;
  progress: CampaignProgress;
  onRide: () => void;
}) {
  if (!open) {
    const hint = STRINGS.campaignLevelLocked;
    return (
      <div
        class="menu-level menu-level-locked"
        title={hint}
        aria-label={`${index + 1}, ${level.name} — ${hint}`}
      >
        <CourseMap levelId={level.id} />
        <span class="menu-level-no">{index + 1}</span>
        <Glyph name="lock" className="menu-level-lock" />
      </div>
    );
  }
  const result = progress.results[level.id];
  const points = progress.points[level.id]?.[PLAYER_ID];
  const field = RACE.rivals + 1;
  const won = result?.medal ?? null;
  return (
    <button
      type="button"
      class={`menu-level menu-level-open${next ? " menu-level-next" : ""}`}
      aria-current={next ? "step" : undefined}
      data-nav-next={next ? "" : undefined}
      data-nav-focus={next ? "" : undefined}
      onClick={onRide}
    >
      <CourseMap levelId={level.id} />
      <span class="menu-level-head">
        <span class="menu-level-no">{index + 1}</span>
        <GradeMark grade={level.grade} className="menu-level-grade" />
        <Glyph name={level.mode === "timeTrial" ? "clock" : "flag"} className="menu-level-mode" />
        <span class="menu-level-billing">{billing(level)}</span>
      </span>
      <span class="menu-level-name">{level.name}</span>
      <span class="menu-level-day">{dayLine(level)}</span>
      {level.medals && (
        <span class="menu-level-medals">
          {MEDALS.map((medal) => (
            <span
              key={medal}
              class={`menu-level-medal menu-level-medal-${medal}${won !== null && MEDALS.indexOf(won) >= MEDALS.indexOf(medal) ? " menu-level-medal-won" : ""}`}
            >
              {STRINGS.campaignMedalCost(STRINGS.campaignMedal[medal], level.medals![medal])}
            </span>
          ))}
        </span>
      )}
      {result && (
        <span class="menu-level-marks">
          {points !== undefined && (
            <span class={`menu-level-mark${points === POINTS[0] ? " menu-level-mark-lit" : ""}`}>
              {STRINGS.campaignPoints(points)}
            </span>
          )}
          {level.mode === "race" && (
            <span
              class={`menu-level-mark${result.place <= POINTS.length ? " menu-level-mark-lit" : ""}`}
            >
              {STRINGS.campaignPlace(result.place, field)}
            </span>
          )}
          {result.best !== undefined && (
            <span class="menu-level-mark">{formatTime(result.best)}</span>
          )}
        </span>
      )}
    </button>
  );
}

/** THE TABLE — every skier on the shelf, the player's row lit. */
function ShelfTable({ shelf, progress }: { shelf: CampaignShelf; progress: CampaignProgress }) {
  const rows = shelfStandings(shelf, progress);
  return (
    <div class="menu-table" aria-label={STRINGS.campaignTable}>
      {rows.map((row) => (
        <div key={row.id} class={`menu-table-row${row.you ? " menu-table-you" : ""}`}>
          <span class="menu-table-place">{row.place}</span>
          <span class="menu-table-name">
            {row.you ? STRINGS.skierYou : STRINGS.skierRival(Number(row.id.slice(1)) + 2)}
          </span>
          <span class="menu-table-wins">{STRINGS.campaignWins(row.wins)}</span>
          <span class="menu-table-points">{STRINGS.campaignPoints(row.points)}</span>
        </div>
      ))}
    </div>
  );
}

/** What a shelf's tab says it has given up so far: won outright, or how far
 * its table has got. */
function shelfLine(shelf: CampaignShelf, progress: CampaignProgress): string {
  if (shelfWon(shelf, progress)) return STRINGS.campaignShelfWon;
  return STRINGS.campaignShelfLine(
    levelsCleared(shelf, progress),
    shelf.levels.length,
    playerStanding(shelf, progress).place,
  );
}

/** THE SHELVES, as a row of tabs: a shut one is still SHOWN, with its
 * padlock and the reason, because what is on the other side of the lock is
 * the reason to go through it. */
export function ShelfTabs({
  shown,
  open,
  line,
  hint,
  onPick,
}: {
  shown: CampaignShelf;
  open: (shelf: CampaignShelf) => boolean;
  line: (shelf: CampaignShelf) => string;
  hint: string;
  onPick: (shelf: CampaignShelf) => void;
}) {
  return (
    <div class="menu-shelves" role="tablist">
      {SHELVES.map((shelf) => {
        const unlocked = open(shelf);
        return (
          <button
            key={shelf.id}
            type="button"
            role="tab"
            aria-selected={shelf === shown}
            class={`menu-shelf${shelf === shown ? " menu-shelf-shown" : ""}${unlocked ? "" : " menu-shelf-locked"}`}
            title={unlocked ? shelf.blurb : hint}
            onClick={() => onPick(shelf)}
          >
            <span class="menu-shelf-name">
              {!unlocked && <Glyph name="lock" />}
              <GradeMark grade={shelf.id} className="menu-shelf-grade" />
              {shelf.name}
            </span>
            <span class="menu-shelf-line">{unlocked ? line(shelf) : hint}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CampaignPage({
  progress,
  onBack,
  onRide,
}: {
  progress: CampaignProgress;
  onBack: () => void;
  /** Stand the rung up — the skis card comes first, then the snow. */
  onRide: (level: CampaignLevel) => void;
}) {
  const [shown, setShown] = useState<CampaignShelf>(() => reachedShelf(progress));
  const open = shelfUnlocked(shown, progress);
  const next = open ? continueAt(shown, progress) : null;
  const ride = next ? (
    <button
      type="button"
      class="menu-item menu-item-start menu-head-go"
      data-menu="ride"
      onClick={() => onRide(next)}
    >
      <span class="menu-item-name">{STRINGS.campaignRide}</span>
    </button>
  ) : undefined;
  return (
    <div class="menu-card menu-card-campaign">
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.campaign} action={ride} />
      <ShelfTabs
        shown={shown}
        open={(shelf) => shelfUnlocked(shelf, progress)}
        line={(shelf) => shelfLine(shelf, progress)}
        hint={STRINGS.campaignShelfLocked}
        onPick={setShown}
      />
      <p class="menu-shelf-blurb">{shown.blurb}</p>
      <div class="menu-levels">
        {shown.levels.map((level, index) => (
          <LevelBox
            key={level.id}
            level={level}
            index={index}
            open={levelUnlocked(shown, index, progress)}
            next={level === next}
            progress={progress}
            onRide={() => onRide(level)}
          />
        ))}
      </div>
      <ShelfTable shelf={shown} progress={progress} />
    </div>
  );
}
