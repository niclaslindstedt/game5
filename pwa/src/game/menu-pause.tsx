// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAUSE CARD — the one menu you reach from INSIDE a race, by pressing
// Escape or the HUD's pause mark. The race holds where it stands
// (`shell.ts` says why this is the one card that freezes) and the card
// carries the ways on and nothing else:
//
//   RESUME        back to the snow, on the very frame it was left.
//   OPTIONS       the front door's OPTIONS page itself, every row of it,
//                 with the camera on top — ON A PANEL OF ITS OWN rather
//                 than inline under RESUME.
//   RESTART       the run again from the start line, on the same map — the B
//                 key's own line. Over a free ride, START AGAIN: the same
//                 ride from where it started.
//   PISTE MAP     on a free ride, a LIT ROW of its own under RESUME: any
//                 run on THIS mountain or a ride up on a machine — the
//                 start card's START and RUN rows and chart on a panel of
//                 their own (`menu-pause-slopes.tsx`), and GO stands the
//                 ride up there. Over a race, beside OPTIONS, half its
//                 row: the level card of the race's own discipline, a
//                 piste drawn on every map — which leaves it.
//   CHALLENGES    on a free ride, beside OPTIONS, half its row: the
//                 medals this mountain deals and what is held of them
//                 (`menu-pause-challenges.tsx`).
//   WATCH REPLAY  the race so far, from the outside (`replay-run.ts`) —
//                 which ENDS it, and the press says so.
//   MAIN MENU     out of the race and back to the front door. Nothing is
//                 torn down: the same skis carries on under the bot.
//
// AND THE RACE ITSELF IS BILLED (`pause-stats.ts`): up to four figures under
// the head — the standing and the clock, then what the corner behind this
// card cannot hold: the record being ridden against, the longest flight, how
// far has been ridden.
//
// THE SETTINGS ARE BEHIND A DOOR, NOT SPREAD ACROSS THE CARD. Nine people in
// ten open this card to RESUME, and every row above that press is a row in
// the way of it; one word costs the card one row. Behind the door is THE
// OPTIONS PAGE, the very component the front door opens (`OptionsPage`), so
// the two can never drift: the picture rows apply to the held frame the
// moment they are pressed, and the frame behind the card is the answer. Its
// KEYS row opens the keys page on a panel of its own, one press back to the
// options.
//
// THE PRESSES THAT END THE RACE ARE THE QUIET ONES. RESUME and OPTIONS are
// rows; RESTART, WATCH REPLAY and MAIN MENU share ONE strip at the foot, a
// mark over a short word each, with no fill of their own. A phone on its
// side has 390 px of height for this whole card, and three full rows for the
// presses a skier seldom wants cost it the fold — and they are the ones a
// stray thumb should find hardest.
//
// EACH PANEL OWNS ITS OWN WAY OUT, one press deep at all times. On the card
// that is RESUME (`data-nav-back`, and where the cursor lands —
// `data-nav-focus`): a card opened by a thumb aiming for the reset beside the
// pause mark must cost one press to leave. On the panel it is the head's ‹
// back to the card. The BACKDROP follows whichever is up, so Escape, the
// backdrop and the cursor's own way out are always the same step. The strip
// stands below OPTIONS, never one row's travel from RESUME.
//
// It wears the front door's own chrome (`.menu` / `.menu-card`): it is the
// same game asking the same kind of question, and `menu-nav.ts` already
// walks anything inside a `.menu-card`. Every word comes from strings.ts.

import { useState } from "preact/hooks";

import type { FreeRide } from "./free-ride.ts";

import { Glyph } from "./menu-glyphs.tsx";
import { KeysPage } from "./menu-keys.tsx";
import { OptionsPage } from "./menu-options.tsx";
import { PauseChallenges } from "./menu-pause-challenges.tsx";
import { PauseSlopes } from "./menu-pause-slopes.tsx";
import { pauseStats } from "./pause-stats.ts";
import type { CameraRung } from "./renderer-api.ts";
import type { Settings } from "./settings.ts";
import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

type PausePanel = "card" | "options" | "keys" | "slopes" | "challenges";

/** The face the NEXT pause card opens on, taken once by it: the card's own
 * face unless a press asked for another (`pauseOnSlopes`). */
let nextPanel: PausePanel = "card";

/** The next pause card opens on the PISTE MAP — the wingsuit's landed
 * plate's press (`hud-result.tsx`), so the map is one press from the snow. */
export function pauseOnSlopes(): void {
  nextPanel = "slopes";
}

export function PauseMenu({
  snap,
  settings,
  keys,
  touch,
  rung = settings.camera,
  onSettings,
  onCamera,
  onResume,
  onRestart,
  onMainMenu,
  onReplay = null,
  onSlopes = null,
  onMaps = null,
}: {
  /** THE HELD RACE, as the HUD behind this card reads it — which is what the
   * card bills it by, the figures chosen from it by rule (`pause-stats.ts`). */
  snap: HudSnapshot;
  settings: Settings;
  /** Whether this machine has keys worth binding, and a touchscreen — the
   * OPTIONS page's own two questions. */
  keys: boolean;
  touch: boolean;
  /** The rung he is seen on now: his own, or his machine's while he rides one. */
  rung?: CameraRung;
  onSettings: (settings: Settings) => void;
  /** A rung picked on the panel: stored AND put on the lens now, so the held
   * frame behind the card is the answer. */
  onCamera: (rung: CameraRung) => void;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  /** Watch the race so far, or null where there is no recording of it. */
  onReplay?: (() => void) | null;
  /** A free ride stood up again on another run of this mountain, or null
   * where the run is no free ride. */
  onSlopes?: ((ride: FreeRide) => void) | null;
  /** Out to the race's level card, or null where the run is no race. */
  onMaps?: (() => void) | null;
}) {
  // Which of the card's faces is up. Local, and dropped the moment the
  // card is: coming back to a held race costs the same one press every time.
  const [panel, setPanel] = useState<PausePanel>(() => {
    const first = nextPanel;
    nextPanel = "card";
    return first;
  });
  const back = (): void => setPanel("card");
  const stats = pauseStats(snap);
  return (
    <div
      class="menu"
      // The backdrop presses whatever the card's own way out is: one step
      // back off a panel, and off the card back to the snow.
      onPointerDown={() =>
        panel === "card" ? onResume() : panel === "keys" ? setPanel("options") : back()
      }
      role="presentation"
    >
      {panel === "options" || panel === "keys" ? (
        // A box that draws nothing, so the page is the menu's own child as
        // on the front door, and a press on it never reaches the backdrop.
        <div class="pause-panel" onPointerDown={(e) => e.stopPropagation()} role="presentation">
          {panel === "options" ? (
            <OptionsPage
              settings={settings}
              keys={keys}
              touch={touch}
              onSettings={onSettings}
              onBack={back}
              backLabel={STRINGS.pauseBack}
              onKeys={() => setPanel("keys")}
              camera={{ rung, onCamera }}
            />
          ) : (
            <KeysPage
              settings={settings}
              onSettings={onSettings}
              onBack={() => setPanel("options")}
            />
          )}
        </div>
      ) : panel === "slopes" && onSlopes ? (
        <PauseSlopes
          snap={snap}
          settings={settings}
          onSettings={onSettings}
          onRide={onSlopes}
          onBack={back}
        />
      ) : panel === "challenges" && snap.challenges ? (
        <PauseChallenges
          snap={snap}
          rows={snap.challenges}
          settings={settings}
          onSettings={onSettings}
          onRide={onSlopes}
          onBack={back}
        />
      ) : (
        <div
          class="menu-card menu-card-pause"
          onPointerDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <div class="menu-pause-head">
            <div class="menu-title">{STRINGS.pauseHead}</div>
            <div class="menu-sub">
              {snap.tricks
                ? STRINGS.pauseSubTricks(snap.seed, snap.tricks.score)
                : snap.free
                  ? STRINGS.pauseSubFree(snap.seed)
                  : STRINGS.pauseSub(snap.seed, snap.taken, snap.gates)}
            </div>
            {/* THE MOUNTAIN, as the free ride raises it again: its seed, its
                country and its grade off the start card's own rows. */}
            {!snap.free && !snap.tricks && (
              <div class="menu-sub menu-pause-mountain">
                {STRINGS.pauseMountain(
                  snap.seed,
                  STRINGS.regionNames[snap.region],
                  STRINGS.gradeNames[snap.grade],
                )}
              </div>
            )}
          </div>
          {/* HOW THE RACE HAS GONE, in one row across: the figure over its
              caption, the HUD's own arrangement. */}
          {stats.length > 0 && (
            <div class="pause-stats">
              {stats.map((stat) => (
                <div class="pause-stat" key={stat.key}>
                  <span class="pause-stat-value">{stat.value}</span>
                  <span class="pause-stat-label">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
          <div class="menu-items">
            <button
              type="button"
              class="menu-item menu-item-start"
              data-nav-back
              data-nav-focus
              onClick={onResume}
            >
              <Glyph name="play" />
              <span class="menu-item-name">{STRINGS.pauseResume}</span>
            </button>
            {/* ON A FREE RIDE THE PISTE MAP IS A ROW OF ITS OWN, second and
                lit: going on somewhere else on the mountain — any run, or a
                ride up on a machine — is what a free ride's pause is for. */}
            {onSlopes && (
              <button
                type="button"
                class="menu-item pause-slopes-press pause-slopes-lit"
                data-menu="slopes"
                onClick={() => setPanel("slopes")}
              >
                <Glyph name="piste" />
                <span class="menu-item-name">{STRINGS.pauseSlopes}</span>
                <span class="pause-slopes-note">{STRINGS.pauseSlopesNote}</span>
              </button>
            )}
            {/* Then OPTIONS, so a thumb aiming for the snow cannot land on a
                press that ends the race — with a race's level card beside it
                where there is one: half a row each, so the card is no taller
                for it. */}
            <div class={(!onSlopes && onMaps) || snap.challenges ? "pause-pair" : "pause-single"}>
              <button
                type="button"
                class="menu-item"
                data-menu="options"
                onClick={() => setPanel("options")}
              >
                <Glyph name="sliders" />
                <span class="menu-item-name">{STRINGS.pauseOptions}</span>
              </button>
              {/* A FREE RIDE'S CHALLENGES beside OPTIONS: the medals this
                  mountain deals, and what is held of them. */}
              {snap.challenges && (
                <button
                  type="button"
                  class="menu-item"
                  data-menu="challenges"
                  onClick={() => setPanel("challenges")}
                >
                  <Glyph name="medal" />
                  <span class="menu-item-name">{STRINGS.pauseChallenges}</span>
                </button>
              )}
              {!onSlopes && onMaps && (
                <button type="button" class="menu-item pause-slopes-press" onClick={onMaps}>
                  <Glyph name="piste" />
                  <span class="menu-item-name">{STRINGS.pauseSlopes}</span>
                </button>
              )}
            </div>
          </div>
          {/* THE THREE THAT END THE RACE, side by side in one quiet strip:
              a mark over a word, no fill until a finger or the cursor is on
              one. */}
          <div class="pause-foot">
            <button type="button" class="pause-foot-item" onClick={onRestart}>
              <Glyph name="restart" />
              <span class="pause-foot-name">
                {snap.free ? STRINGS.pauseRestartFree : STRINGS.pauseRestart}
              </span>
            </button>
            {onReplay && (
              <button type="button" class="pause-foot-item pause-replay" onClick={onReplay}>
                <Glyph name="replay" />
                <span class="pause-foot-name">{STRINGS.replayLabel}</span>
                <span class="pause-foot-note">{STRINGS.replayWatchNote}</span>
              </button>
            )}
            <button type="button" class="pause-foot-item" onClick={onMainMenu}>
              <Glyph name="exit" />
              <span class="pause-foot-name">{STRINGS.pauseMainMenu}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
