// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FRONT DOOR — the card the app opens onto once the attract card has
// been pressed away, painted over a LIVE RACE: the engine is stepping a
// bot-ridden race behind this card the whole time it is up, and the camera
// turns slowly round the skis. A menu that stopped the snow would be a menu
// that announces the game is not running.
//
// THE CAMPAIGN IS THE LIT TILE: three shelves of six pinned maps, ridden
// for points against the field (`menu-campaign.tsx`). Its face is the one
// on the card that CHANGES between visits — how far up the ladder the player
// has got, and the rung it would pick next — which is what stops a front
// door being furniture.
//
// THE RACE AND THE TIME TRIAL under it ride a PINNED map too, picked on the
// level card (`menu-levels.tsx`) out of the shelves the campaign has opened,
// so a time in the record book is a time down a piste somebody else can
// ride. The map is ON the tile — the name the level card last picked. A link
// that pinned a seed says so instead, because that visit rides the seed.
// The SLALOM is two runs against a field of thirty, one on the course at a
// time; under it the disciplines named and not built yet, dimmed and not
// pressable (`DISCIPLINES`). The trial is the
// same piste alone against the clock, the record book's row for that
// mountain and pair, and the ghost of the run that set it (`ghost-run.ts`).
// TRICKS beside them: two minutes on the map's trick field (R20), alone, the
// score the run — on the map the menu stands over.
// THE FREE RIDE beside it, unlit: the whole map and nobody on it, set up on
// its own start card (`menu-start.tsx`) — a second way onto the snow, so a
// tile, but never a second red one.
//
// EVERYTHING THAT IS NOT SNOW, along the foot: OPTIONS (`menu-options.tsx` —
// the sound switch and every other setting live there, not on this card),
// the GALLERY of pictures kept (`menu-gallery.tsx`) and the build. And DEVELOPER, once it
// has been let out: the title HELD for seven seconds (`menu-hold.ts`) is the
// one door to it, and the chip appearing is the receipt. Low, and not tile-shaped at
// all, because a thing that does not start a race should not wear the shape
// of one.

import { useEffect, useRef } from "preact/hooks";
import { DISCIPLINES, SLALOM } from "@engine";

import { APP_NAME, REPO_URL } from "../identity.ts";
import { MarkTrails } from "./mark-trails.tsx";
import { Glyph } from "./menu-glyphs.tsx";
import { NO_HOLD, holdWait, tickHold, type HoldState } from "./menu-hold.ts";
import { DEV_HOLD_MS } from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** The build, bottom right, linking to the exact commit it was cut from. A
 * build with no commit behind it says so and links nowhere — a dead link is
 * worse than an honest label. */
function VersionStamp() {
  const label = `v${__APP_VERSION__}`;
  const sha = __COMMIT_SHA__;
  if (!sha || sha === "dev") {
    return <span class="menu-version menu-version-dev">{label} · dev</span>;
  }
  return (
    <a
      class="menu-version"
      href={`${REPO_URL}/commit/${sha}`}
      target="_blank"
      rel="noreferrer noopener"
      title="Open this build's commit on GitHub"
    >
      {label} · {sha}
    </a>
  );
}

export function MainMenu({
  campaign,
  onCampaign,
  raceMap,
  trialMap,
  seed,
  pinned,
  trial,
  onRace,
  onFree,
  onTrial,
  onOptions,
  onGallery,
  tricks,
  onTricks,
  developer,
  onDeveloper,
  onHeld,
}: {
  /** THE CAMPAIGN tile's face: how far up the ladder, and the rung next. */
  campaign: { cleared: number; of: number; next: string | null };
  onCampaign: () => void;
  /** The pinned map the RACE and the TIME TRIAL ride, by name — null where
   * a link pinned a seed instead. */
  raceMap: string | null;
  trialMap: string | null;
  /** The seed RACE will build. */
  seed: number;
  /** Whether a link pinned it. */
  pinned: boolean;
  /** The TIME TRIAL tile: its seed and the row standing. */
  trial: { seed: number; best: { time: number; skis: string } | null };
  onRace: () => void;
  onTrial: () => void;
  /** Onto the free ride's start card. */
  onFree: () => void;
  onOptions: () => void;
  onGallery: () => void;
  /** The TRICKS tile: the map it rides and how long the run lasts, s. */
  tricks?: { map: string; seconds: number };
  onTricks?: () => void;
  /** Whether the DEVELOPER chip is out, the press that opens its page, and
   * what a seven-second hold on the title does (let it out). */
  developer?: boolean;
  onDeveloper?: () => void;
  onHeld?: () => void;
}) {
  const hold = useTitleHold(onHeld);
  return (
    <div class="menu">
      <div class="menu-card menu-card-root">
        <div class="menu-brand" {...hold}>
          <div class="menu-brand-line">
            <MarkTrails lay="once" className="menu-brand-mark" />
            <span class="menu-brand-name">{APP_NAME.toUpperCase()}</span>
          </div>
        </div>
        <div class="menu-tiles">
          <button
            type="button"
            class="menu-tile menu-tile-hero"
            data-menu="campaign"
            data-nav-next
            data-nav-focus
            onClick={onCampaign}
          >
            {/* The sheen: a slow bar of light travelling the tile, the one
                moving thing on the card. A transform, and off under
                `prefers-reduced-motion`. */}
            <span class="menu-tile-sheen" aria-hidden="true" />
            <Glyph name="peaks" />
            <span class="menu-tile-words">
              <span class="menu-tile-name">{STRINGS.campaign}</span>
              <span class="menu-tile-line">
                {STRINGS.menuCampaignLine(campaign.cleared, campaign.of)}
              </span>
              <span class="menu-tile-line">
                {campaign.next === null
                  ? STRINGS.menuCampaignDone
                  : STRINGS.menuCampaignNext(campaign.next)}
              </span>
            </span>
          </button>
          <button type="button" class="menu-tile menu-tile-wide" data-menu="race" onClick={onRace}>
            <Glyph name="flag" />
            <span class="menu-tile-words">
              <span class="menu-tile-name">{STRINGS.menuRace}</span>
              <span class="menu-tile-line">
                {raceMap === null
                  ? STRINGS.menuRaceLine(seed, SLALOM.field + 1)
                  : STRINGS.menuPinnedLine(raceMap)}
              </span>
              {pinned && <span class="menu-tile-line">{STRINGS.menuRacePinned}</span>}
            </span>
          </button>
          <div class="menu-disciplines" aria-disabled="true">
            {DISCIPLINES.filter((d) => d.mode === null).map((d) => (
              <span key={d.id} class="menu-discipline">
                {STRINGS.disciplines[d.id]}
              </span>
            ))}
            <span class="menu-discipline-soon">{STRINGS.menuComing}</span>
          </div>
          <button
            type="button"
            class="menu-tile menu-tile-wide"
            data-menu="trial"
            onClick={onTrial}
          >
            <Glyph name="clock" />
            <span class="menu-tile-words">
              <span class="menu-tile-name">{STRINGS.menuTrial}</span>
              <span class="menu-tile-line">
                {trialMap === null
                  ? STRINGS.menuTrialLine(trial.seed)
                  : STRINGS.menuPinnedLine(trialMap)}
              </span>
              <span class="menu-tile-line">
                {trial.best
                  ? STRINGS.menuTrialBest(trial.best.time, trial.best.skis)
                  : STRINGS.menuTrialNoBest}
              </span>
            </span>
          </button>
          {tricks && (
            <button
              type="button"
              class="menu-tile menu-tile-wide"
              data-menu="tricks"
              onClick={onTricks}
            >
              <Glyph name="flip" />
              <span class="menu-tile-words">
                <span class="menu-tile-name">{STRINGS.menuTricks}</span>
                <span class="menu-tile-line">
                  {STRINGS.menuTricksLine(tricks.map, tricks.seconds)}
                </span>
              </span>
            </button>
          )}
          <button type="button" class="menu-tile menu-tile-wide" data-menu="free" onClick={onFree}>
            <Glyph name="kicker" />
            <span class="menu-tile-words">
              <span class="menu-tile-name">{STRINGS.menuFree}</span>
              <span class="menu-tile-line">{STRINGS.menuFreeLine}</span>
            </span>
          </button>
        </div>
        <div class="menu-strip">
          <button type="button" class="menu-chip" data-menu="options" onClick={onOptions}>
            <Glyph name="sliders" />
            <span class="menu-tile-name">{STRINGS.menuOptions}</span>
          </button>
          <button type="button" class="menu-chip" data-menu="gallery" onClick={onGallery}>
            <Glyph name="camera" />
            <span class="menu-tile-name">{STRINGS.menuGallery}</span>
          </button>
          {developer && (
            <button type="button" class="menu-chip" data-menu="developer" onClick={onDeveloper}>
              <Glyph name="gauge" />
              <span class="menu-tile-name">{STRINGS.devTitle}</span>
            </button>
          )}
          <VersionStamp />
        </div>
      </div>
    </div>
  );
}

/** The page's clock, ms — read from the pointer handlers and the timer,
 * never while rendering. */
const clockMs = (): number => performance.now();

/** THE HOLD on the title, as pointer handlers: silent while it runs, and
 * `onHeld` once it has run `DEV_HOLD_MS`. The timer asks again for whatever
 * is left rather than trusting one timeout (`holdWait`). */
function useTitleHold(onHeld: (() => void) | undefined) {
  const held = useRef<HoldState>(NO_HOLD);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const check = (): void => {
    const now = clockMs();
    const next = tickHold(held.current, now, DEV_HOLD_MS);
    if (next !== held.current && next.fired) {
      held.current = next;
      onHeld?.();
      return;
    }
    const wait = holdWait(held.current, now, DEV_HOLD_MS);
    if (wait > 0) timer.current = window.setTimeout(check, wait);
  };
  const release = (): void => {
    held.current = NO_HOLD;
    clearTimeout(timer.current);
  };
  return {
    onPointerDown: () => {
      if (!onHeld) return;
      held.current = { from: clockMs(), fired: false };
      clearTimeout(timer.current);
      timer.current = window.setTimeout(check, DEV_HOLD_MS);
    },
    onPointerUp: release,
    onPointerLeave: release,
    onPointerCancel: release,
    // A long press on a phone opens the page's own menu over the title.
    onContextMenu: (e: Event) => e.preventDefault(),
  };
}
