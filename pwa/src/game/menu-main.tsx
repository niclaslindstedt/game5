// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FRONT DOOR — the card the app opens onto once the attract card has
// been pressed away: over the TITLE SCENE on a visit's first door, and over
// the LIVE RACE the bot rides once a run has been left for it. Neither stops
// behind the card; a menu that froze the snow would announce the game is not
// running.
//
// THREE THINGS, BY HOW OFTEN THEY ARE WANTED. PLAY is the lit slab and the
// only red on the card: it opens the door's second page, where the three
// ways onto the snow stand — RACE (the race card, `menu-races.tsx`, each
// discipline on its pinned maps), TRICKS (the freestyle card,
// `menu-freestyle.tsx`) and FREE RIDE (its start card, `menu-start.tsx`).
// OPTIONS is the second slab, as big and quieter: every setting, the sound
// included, lives there. Under them, small, the two things that are not a
// run at all — the GALLERY of pictures kept and the STATISTICS — and
// DEVELOPER once it has been let out (the title HELD for seven seconds,
// `menu-hold.ts`, the chip appearing the receipt), with the build's stamp.
//
// THE PLAY PAGE is the same card with its slabs swapped, not a page laid
// over it: the logo stays where the attract card flew it, and BACK (or
// Escape) is the way to the door again. The card is keyed by the page, so
// the cursor lands afresh and the slabs are dealt in again on the turn.
//
// THE COLUMN stands to one side of the scene's subject — left of the skier
// on a wide screen, under him on a phone held upright — over a scrim rather
// than in a box (`menu.css`).

import { useEffect, useRef } from "preact/hooks";
import { DISCIPLINES, SLALOM } from "@engine";

import { REPO_URL } from "../identity.ts";
import { Glyph } from "./menu-glyphs.tsx";
import { NO_HOLD, holdWait, tickHold, type HoldState } from "./menu-hold.ts";
import { DEV_HOLD_MS } from "./settings.ts";
import { STRINGS } from "./strings.ts";
import { TitleLogo } from "./title-logo.tsx";
import type { MenuPage } from "./url-params.ts";

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
      // Small print, not a stop on the keys' walk: the cursor would otherwise
      // step off a slab onto a link out of the game.
      data-nav-skip
      tabIndex={-1}
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
  page,
  onPage,
  seed,
  pinned,
  onRace,
  onFree,
  onOptions,
  onGallery,
  stats,
  onStats,
  tricks,
  onTricks,
  developer,
  onDeveloper,
  onHeld,
}: {
  /** Which face of the door is up: the door itself, or PLAY's page. */
  page: MenuPage;
  onPage: (page: MenuPage) => void;
  /** The seed a run off a seed of its own will build. */
  seed: number;
  /** Whether a link pinned it. */
  pinned: boolean;
  /** Onto the race card (`menu-races.tsx`). */
  onRace: () => void;
  /** Onto the free ride's start card. */
  onFree: () => void;
  onOptions: () => void;
  onGallery: () => void;
  /** The STATISTICS button's face (runs and metres skied; the rest is its
   * card's), and the press onto its card. */
  stats: { runs: number; distance: number; kmh: number | null };
  onStats: () => void;
  /** The TRICKS slab: the map it rides and how long the run lasts, s. */
  tricks?: { map: string; seconds: number };
  onTricks?: () => void;
  /** Whether the DEVELOPER chip is out, the press that opens its page, and
   * what a seven-second hold on the title does (let it out). */
  developer?: boolean;
  onDeveloper?: () => void;
  onHeld?: () => void;
}) {
  const hold = useTitleHold(onHeld);
  const lean = useLean();
  const play = page === "play";
  return (
    <div class="menu menu-door" {...lean}>
      <div
        key={play ? "play" : "root"}
        class={`menu-card menu-card-root${play ? " menu-card-play" : ""}`}
      >
        <div class="menu-brand" {...hold}>
          <TitleLogo lockup="inline" className="menu-brand-logo" />
        </div>
        {play ? (
          <>
            <div class="menu-play-head" style={at(0)}>
              <button type="button" class="menu-back" data-nav-back onClick={() => onPage("root")}>
                ‹ {STRINGS.menuBack}
              </button>
              <span class="menu-play-title">{STRINGS.menuPlay}</span>
            </div>
            <div class="menu-tiles">
              {/* THE RACES, one slab: the disciplines built, named on it,
                  and the race card behind it — the seed a link pinned said
                  instead. The way on of this page, so the lit one. */}
              <button
                type="button"
                class="menu-tile menu-tile-hero"
                data-menu="race"
                data-nav-next
                data-nav-focus
                style={at(1)}
                onClick={onRace}
              >
                <span class="menu-tile-sheen" aria-hidden="true" />
                <Glyph name="flag" />
                <span class="menu-tile-words">
                  <span class="menu-tile-name">{STRINGS.menuRaces}</span>
                  <span class="menu-tile-line">
                    {pinned
                      ? STRINGS.menuRaceSeed(seed)
                      : STRINGS.menuRacesLine(
                          DISCIPLINES.filter((d) => d.mode !== null).map(
                            (d) => STRINGS.disciplines[d.id],
                          ),
                        )}
                  </span>
                  <span class="menu-tile-line">{STRINGS.menuRacesFormat(SLALOM.field + 1)}</span>
                </span>
              </button>
              {tricks && (
                <button
                  type="button"
                  class="menu-tile menu-tile-wide"
                  data-menu="tricks"
                  style={at(2)}
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
              <button
                type="button"
                class="menu-tile menu-tile-wide"
                data-menu="free"
                style={at(3)}
                onClick={onFree}
              >
                <Glyph name="kicker" />
                <span class="menu-tile-words">
                  <span class="menu-tile-name">{STRINGS.menuFree}</span>
                  <span class="menu-tile-line">{STRINGS.menuFreeLine}</span>
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div class="menu-tiles">
              <button
                type="button"
                class="menu-tile menu-tile-hero"
                data-menu="play"
                data-nav-next
                data-nav-focus
                style={at(0)}
                onClick={() => onPage("play")}
              >
                {/* The sheen: a slow bar of light travelling the slab, a
                    transform and off under `prefers-reduced-motion`. */}
                <span class="menu-tile-sheen" aria-hidden="true" />
                <Glyph name="play" />
                <span class="menu-tile-words">
                  <span class="menu-tile-name">{STRINGS.menuPlay}</span>
                  <span class="menu-tile-line">{STRINGS.menuPlayLine}</span>
                </span>
              </button>
              <button
                type="button"
                class="menu-tile menu-tile-wide"
                data-menu="options"
                style={at(1)}
                onClick={onOptions}
              >
                <Glyph name="sliders" />
                <span class="menu-tile-words">
                  <span class="menu-tile-name">{STRINGS.menuOptions}</span>
                  <span class="menu-tile-line">{STRINGS.menuOptionsLine}</span>
                </span>
              </button>
            </div>
            <div class="menu-minor">
              <button
                type="button"
                class="menu-chip menu-minor-item"
                data-menu="gallery"
                style={at(2)}
                onClick={onGallery}
              >
                <Glyph name="camera" />
                <span class="menu-tile-words">
                  <span class="menu-tile-name">{STRINGS.menuGallery}</span>
                </span>
              </button>
              {/* THE STATISTICS (`menu-stats.tsx`): every run counted —
                  billed small, with how many and how far. */}
              <button
                type="button"
                class="menu-chip menu-minor-item"
                data-menu="stats"
                style={at(3)}
                onClick={onStats}
              >
                <Glyph name="chart" />
                <span class="menu-tile-words">
                  <span class="menu-tile-name">{STRINGS.menuStats}</span>
                  <span class="menu-tile-line">
                    {STRINGS.menuStatsLine(stats.runs, stats.distance)}
                  </span>
                </span>
              </button>
            </div>
            <div class="menu-strip" style={at(4)}>
              {developer && (
                <button type="button" class="menu-chip" data-menu="developer" onClick={onDeveloper}>
                  <Glyph name="gauge" />
                  <span class="menu-tile-name">{STRINGS.devTitle}</span>
                </button>
              )}
              <VersionStamp />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** A slab's place in the deal: `menu.css` staggers each one's arrival by
 * it, so the order is the markup's and never a list of `nth-child` rules. */
const at = (i: number): Record<string, string> => ({ "--i": String(i) });

/**
 * THE LEAN: a mouse over the door tilts the column a few pixels against
 * where it is, as the title scene's lens leans with it (`title-stage.tsx`),
 * so the card and the mountain part by depth. Written as two custom
 * properties on `.menu` once a frame at most; `menu.css` reads them. A
 * thumb is not a pointer resting anywhere, and a machine that asked for
 * less motion gets none, so neither is listened to.
 */
function useLean() {
  const frame = useRef(0);
  const want = useRef<[number, number]>([0, 0]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const fine =
    typeof matchMedia === "function" &&
    matchMedia("(pointer: fine)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine) return {};
  return {
    onPointerMove: (e: PointerEvent) => {
      const host = e.currentTarget as HTMLElement;
      want.current = [(e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1];
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        host.style.setProperty("--px", want.current[0].toFixed(3));
        host.style.setProperty("--py", want.current[1].toFixed(3));
      });
    },
  };
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
