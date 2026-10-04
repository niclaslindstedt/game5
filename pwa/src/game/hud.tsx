// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HUD: chunky arcade chrome over the canvas. Reads a low-rate snapshot
// (the app refreshes it ~12×/s — the canvas is the 60 fps surface, the HUD
// is not) and lays out everything drawn over the snow:
//
//   top left      the run clock, the POSITION, the GATE count and the
//                 vertical DROPPED on one row — the facts about how the run
//                 is going, read down one left-aligned column — and under
//                 them the SPLIT at the last gate while it is fresh. On a
//                 FREE RIDE, which has no run to read, the clock, the BEST
//                 AIR, the distance SKIED and the map's SEED
//   top right     the MINIMAP — the piste, the field and the gate owed,
//                 turned heading-up about the skier, and PRESSED to pause
//                 (minimap.tsx) — and under it two presses, RESET and CAMERA
//   top centre    the AIR CLOCK while the skis are off the snow — the one
//                 number a skier is trying to make go up, where he is
//                 already looking to aim the landing
//   dead centre   the LIGHTS, and GO
//   upper centre  a MISSED GATE warning with an arrow pointing back up at
//                 it and the metres to go, until it is taken — or BOGGED,
//                 while the skier is sunk to the knees and wants poling out
//   left edge     THE BODY: the skier from behind, every part painted by
//                 its worst injury, the word for the whole of him and the
//                 worst injuries in plain words (hud-body.tsx)
//   centre        THE G METER, shaking, the moment a blow lands
//                 (hud-gforce.tsx)
//   bottom left   the EDGE bar over the speed, the WIND METER to the right
//                 of the speed (hud-wind.tsx), and on a run with damage on
//                 the DAMAGE instrument beside it (hud-damage.tsx)
//   bottom right  the news column — a gate's clock, a tree, a wipeout
//
// WITH THE READOUTS OFF (H, OPTIONS ▸ HUD) it is `data-bare`: the thumbs and
// the corner presses stay — a skier still has to steer and still has to get
// out, so with the map gone a PAUSE disc heads the row — and everything that
// READS goes, so the snow is clear for a look or
// a picture (the framework's `shots/shot-hud` then leaves the chrome out of the frame).
//
// The thumb zones it hangs under all that are next door in hud-touch.tsx:
// they are the one part of this screen that does NOT run off the snapshot
// (they write into the input manager at pointer rate). Every word here comes
// from strings.ts (§39.1).

import { REPO_URL } from "../identity.ts";
import { formatTime } from "@niclaslindstedt/oss-game-framework/hud/format";
import { HudActions } from "./hud-actions.tsx";
import { ComboTile, TricksChips } from "./hud-combo.tsx";
import { BodyPanel } from "./hud-body.tsx";
import { DamageGauge } from "./hud-damage.tsx";
import { GForce } from "./hud-gforce.tsx";
import { GradeMark } from "./grade-mark.tsx";
import { EdgeBar } from "./hud-dial.tsx";
import { BarZone, LeverZone, type ZoneSide } from "./hud-touch.tsx";
import type { TouchFeel } from "./input-model.ts";
import type { InputManager } from "./input.ts";
import { Minimap } from "./minimap.tsx";
import type { HudFlash } from "./run-news.ts";
import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";
import { UpdateButton } from "./update-button.tsx";
import { WindMeter } from "./hud-wind.tsx";

export type { HudFlash };

/** Whether the device has a touchscreen to put the thumb zones on. A laptop
 * with one reports it and gets them; a desktop does not. */
export function hasTouch(): boolean {
  return typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
}

/** THE ARROW BACK TO A MISSED GATE: a chevron turned by the screen
 * angle the snapshot hands it (clockwise from straight ahead), so "behind
 * you and to the left" reads as an arrow pointing down and left. */
function MissedArrow({ angle }: { angle: number }) {
  return (
    <svg
      class="hud-missed-arrow"
      viewBox="-50 -50 100 100"
      aria-hidden="true"
      style={{ transform: `rotate(${((angle * 180) / Math.PI).toFixed(1)}deg)` }}
    >
      <path d="M 0 -42 L 34 20 L 0 4 L -34 20 Z" />
    </svg>
  );
}

export function Hud({
  snap,
  flashes,
  touch,
  input,
  feel,
  lever,
  away,
  onReset,
  onCamera,
  onPause,
  bare = false,
}: {
  snap: HudSnapshot;
  flashes: HudFlash[];
  /** Draw the thumb zones. */
  touch: boolean;
  input: InputManager;
  /** How the thumbs read (OPTIONS ▸ CONTROLS). */
  feel: TouchFeel;
  /** Which side of the glass the lever stands on; the bar takes the other. */
  lever: ZoneSide;
  /** The TAB is away and the clock with it (§37.3) — not the pause card,
   * which is a surface of its own (`menu-pause.tsx`) and stands over all of
   * this. The two share a word and nothing else. */
  away: boolean;
  onReset: () => void;
  onCamera: () => void;
  onPause: () => void;
  /** The readouts are off: the presses and the thumbs alone. */
  bare?: boolean;
}) {
  const lit = snap.missed !== null || snap.down;
  const thumbs = touch && (
    <div class="hud-touch">
      {/* In reading order, so the zone on the left is the first child
          whichever of the two it is. */}
      {lever === "left" && <LeverZone touch={input.touch} feel={feel} side="left" />}
      <BarZone touch={input.touch} feel={feel} side={lever === "left" ? "right" : "left"} />
      {lever === "right" && <LeverZone touch={input.touch} feel={feel} side="right" />}
    </div>
  );
  if (bare) {
    return (
      <div class="hud" data-bare="1" data-touch={touch ? "1" : undefined}>
        <div class="hud-topright">
          <HudActions onPause={onPause} onReset={onReset} onCamera={onCamera} lit={lit} />
        </div>
        {thumbs}
      </div>
    );
  }
  return (
    <div
      class="hud"
      data-air={snap.airTime > 0 ? "1" : undefined}
      data-finished={snap.finished ? "1" : undefined}
      data-touch={touch ? "1" : undefined}
    >
      <div class="hud-top">
        <div class="hud-top-row">
          <div class="hud-clock">
            <span class="hud-clock-time">{formatTime(snap.time)}</span>
            <span class="hud-chip-sub">{STRINGS.clockLabel}</span>
          </div>
          {/* THE FREE RIDE'S TWO: the longest flight so far — keyed on it,
              so a new best lands with its own beat — and the odometer. */}
          {/* A TRICKS RUN'S TWO in their place: the score and the buzzer. */}
          {snap.tricks && <TricksChips tile={snap.tricks} />}
          {snap.free && !snap.tricks && (
            <div class="hud-chip hud-best-air" key={snap.bestAir}>
              <span>{STRINGS.air(snap.bestAir)}</span>
              <span class="hud-chip-sub">{STRINGS.bestAirLabel}</span>
            </div>
          )}
          {snap.free && !snap.tricks && (
            <div class="hud-chip">
              <span>{STRINGS.distance(snap.distance)}</span>
              <span class="hud-chip-sub">{STRINGS.distanceLabel}</span>
            </div>
          )}
          {/* THE MAP'S SEED, so a picture of a free ride says which mountain
              it was taken on — the one number that brings it back. */}
          {snap.free && !snap.tricks && (
            <div class="hud-chip hud-seed">
              <span>{snap.seed}</span>
              <span class="hud-chip-sub">{STRINGS.seedLabel}</span>
            </div>
          )}
          {/* THE PLACE — the one number a racer reads more than the clock.
              Keyed on the place, so a pass lands with its own beat. Left
              out of a race alone, where 1 / 1 says nothing. */}
          {!snap.free && snap.skiers > 1 ? (
            <div class="hud-chip hud-place" key={snap.place}>
              <span>{STRINGS.place(snap.place, snap.skiers)}</span>
              <span class="hud-chip-sub">{STRINGS.placeLabel}</span>
            </div>
          ) : null}
          {!snap.free && (
            <div class="hud-chip hud-gates">
              <span>{STRINGS.gates(snap.taken, snap.gates)}</span>
              <span class="hud-chip-sub">
                {/* THE PISTE'S SIGN (R23) beside its gates: the colour of
                    the run, the whole way down. */}
                <GradeMark grade={snap.grade} className="hud-grade" />
                {STRINGS.gatesLabel}
              </span>
            </div>
          )}
          {/* THE VERTICAL: how far down the mountain the run has got — the
              one figure a descent has that a loop never did. */}
          {!snap.free && (
            <div class="hud-chip">
              <span>{STRINGS.dropped(snap.dropped)}</span>
              <span class="hud-chip-sub">{STRINGS.droppedLabel}</span>
            </div>
          )}
        </div>
        {/* THE SPLIT, under the row it belongs to: the clock as it stood at
            the gate just taken, held for a few seconds and then gone,
            so a stale figure is never read as a fresh one. Keyed on the
            figure so a new split lands with the beat. */}
        {snap.split !== null && (
          <div class="hud-top-row">
            <div class="hud-chip hud-split" key={snap.split}>
              <span>{STRINGS.split(snap.split)}</span>
              <span class="hud-chip-sub">{STRINGS.splitLabel}</span>
            </div>
            {/* ...and beside it, against the record at the same crossing:
                green ahead, red behind. */}
            {snap.gap !== null && (
              <div
                class={`hud-chip hud-split hud-gap ${snap.gap < 0 ? "hud-gap-ahead" : "hud-gap-behind"}`}
                key={`gap-${snap.split}`}
              >
                <span>{STRINGS.gap(snap.gap)}</span>
                <span class="hud-chip-sub">{STRINGS.gapLabel}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* The map first and the presses UNDER it: the map is read at a
          glance from the top of the corner — and pressed, to hold the race —
          and the reset and the camera sit a thumb's reach lower, nearer the
          hands. */}
      <div class="hud-topright">
        <Minimap map={snap.minimap} onPause={onPause} />
        <HudActions onReset={onReset} onCamera={onCamera} lit={lit} />
      </div>

      {/* THE MISSED GATE, centred in the upper quarter where the eye can
          read it without leaving the snow: the word, the arrow back up at
          it and the metres. Up until the gate is taken, however long that
          is — the engine keeps it owed, so nothing here keeps time. */}
      {snap.missed !== null && (
        <div class="hud-missed" role="status">
          <span class="hud-missed-title">{STRINGS.missed}</span>
          <MissedArrow angle={snap.missed.angle} />
          <span class="hud-missed-distance">{STRINGS.missedBack(snap.missed.distance)}</span>
        </div>
      )}

      <div class="hud-speed">
        <div class="hud-revs-row">
          <EdgeBar edge={snap.edge} tuck={snap.tuck} braking={snap.braking} />
          <span class={`hud-chip-sub ${snap.braking ? "hud-brake" : ""}`}>
            {snap.braking ? STRINGS.brake : snap.cutting ? STRINGS.cut : STRINGS.edge}
          </span>
        </div>
        <div class="hud-cluster">
          <span class="hud-speed-num">{Math.round(snap.speedKmh)}</span>
          <span class="hud-speed-unit">{STRINGS.speedUnit}</span>
          <WindMeter wind={snap.wind} />
          {snap.damage && <DamageGauge damage={snap.damage} />}
        </div>
      </div>

      {/* BOGGED: the skier sunk to the knees, where the missed arrow stands
          (the two are never up together — a bogged skier is going nowhere
          near a gate). Up for as long as the engine says he is in it. */}
      {snap.stuck && snap.missed === null && (
        <div class="hud-missed hud-stuck" role="status">
          <span class="hud-missed-title">{STRINGS.stuck}</span>
          <span class="hud-missed-distance">{STRINGS.stuckHow}</span>
        </div>
      )}

      {/* THE LIGHTS, dead centre and as big as the frame allows: the one
          moment the whole screen is about one number. Keyed on the count,
          so each light lands with its own beat; GO is the same element with
          the word in it, for the moment after. */}
      {(snap.countdown > 0 || snap.go) && (
        <div class="hud-center hud-lights">
          <span
            class={`hud-count${snap.go ? " hud-count-go" : ""}`}
            key={snap.go ? 0 : snap.countdown}
          >
            {snap.go ? STRINGS.go : STRINGS.count(snap.countdown)}
          </span>
        </div>
      )}

      {/* THE AIR CLOCK, top centre, from the moment a flight has lasted long
          enough to BE one until the skis are back on the snow. A flight on
          course to be the race's longest says so while it is still up. */}
      {snap.airTime > 0 && (
        <div class="hud-air">
          <div class="hud-air-tile">
            <span class={`hud-air-read ${snap.airBest ? "hud-air-read-best" : ""}`}>
              <span class="hud-air-num">{STRINGS.air(snap.airTime)}</span>
              <span class="hud-chip-sub">{STRINGS.airLabel}</span>
              {snap.airBest && <span class="hud-air-best">{STRINGS.airBest}</span>}
            </span>
          </div>
        </div>
      )}

      {/* THE BODY at the left edge, and THE G METER over the skier the
          moment a blow lands (`hud-body.tsx`, `hud-gforce.tsx`). */}
      <BodyPanel tile={snap.body} />
      {snap.body.blow && <GForce blow={snap.body.blow} />}

      {/* THE COMBO, over the nose (`hud-combo.tsx`). */}
      {snap.tricks && <ComboTile tile={snap.tricks} />}

      <div class="hud-right">
        <div class="hud-flashes">
          {flashes.map((f) => (
            <span key={f.id} class={`hud-flash hud-flash-${f.tone}`}>
              {f.text}
            </span>
          ))}
        </div>
        {/* Nothing on the days there is no new build: it draws itself or it
            draws nothing. At the FOOT of the column, so a flash arriving
            never moves a button a thumb is on its way to. */}
        <UpdateButton />
      </div>

      {/* §38.3: the build says what it is — version and commit, linked to
          the source — and beside it the map this frame is of. */}
      <div class="hud-build">
        <span>{STRINGS.stage(snap.seed)}</span>
        <a href={`${REPO_URL}/commit/${__COMMIT_SHA__}`} target="_blank" rel="noreferrer">
          {__BUILD_LABEL__}
        </a>
      </div>

      {away && (
        <div class="hud-center">
          <div class="hud-card">
            <span class="hud-card-title">{STRINGS.paused}</span>
            <span class="hud-card-note">{STRINGS.pausedNote}</span>
          </div>
        </div>
      )}

      {thumbs}
    </div>
  );
}
