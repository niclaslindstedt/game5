// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HUD: chunky arcade chrome over the canvas. Reads a low-rate snapshot
// (the app refreshes it ~12×/s — the canvas is the 60 fps surface, the HUD
// is not) and lays out everything drawn over the snow:
//
//   top left      the run clock, the POSITION, the GATE count and the
//                 vertical DROPPED on one row — the facts about how the run
//                 is going, read down one left-aligned column — and under
//                 them the SPLIT at the last gate while it is fresh. On a
//                 SLALOM the RUN (1 / 2) where the position was, and the
//                 split only at its two intermediates, against the leader.
//                 On a
//                 FREE RIDE, which has no run to read, the clock, the BEST
//                 AIR, the distance SKIED and the map's SEED
//   top right     the MINIMAP — the piste, the field and the gate owed,
//                 turned heading-up about the skier, and PRESSED to pause
//                 (minimap.tsx) — and under it two presses, RESET and CAMERA
//   top centre    the AIR CLOCK while the skis are off the snow — the one
//                 number a skier is trying to make go up, where he is
//                 already looking to aim the landing
//   dead centre   the LIGHTS, and GO — on a line start. A slalom's count
//                 is the start clock's in the house, so its READY and GO
//                 are small at the top centre, out of the starter's shot
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
import { StickZone } from "./hud-heli-pad.tsx";
import { edgeFeel, type TouchFeel } from "./input-model.ts";
import type { InputManager } from "./input.ts";
import type { HudLive } from "./hud-live.ts";
import { Minimap } from "./minimap.tsx";
import type { HudFlash } from "./run-news.ts";
import type { HudSnapshot } from "./snapshot.ts";
import { speedOf } from "./speed-ski-run.ts";
import { STRINGS } from "./strings.ts";
import { UpdateButton } from "./update-button.tsx";
import { WindMeter } from "./hud-wind.tsx";
import { HeliReadout } from "./hud-heli.tsx";
import { SledReadout } from "./hud-sled.tsx";
import { AfterskiReadout, BuzzMeter } from "./hud-afterski.tsx";
import { GroomerReadout } from "./hud-groomer.tsx";
import { ParaReadout } from "./hud-para.tsx";

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
  live,
  feel,
  lever,
  away,
  onReset,
  onCamera,
  onPause,
  bare = false,
  machineKey,
  tuckKey,
  injuries = true,
}: {
  snap: HudSnapshot;
  flashes: HudFlash[];
  /** Draw the thumb zones. */
  touch: boolean;
  input: InputManager;
  /** What is drawn every frame rather than off the snapshot. */
  live: HudLive;
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
  /** The machine key as bound (`settings-input.ts`), as the player reads it
   * — what the snowmobile's and the helicopter's prompts name. */
  machineKey: string;
  /** The tuck key as bound — what stands a fallen skier up past the first
   * seconds of his fall, with a tap anywhere on touch. */
  tuckKey: string;
  /** Whether the body's injuries are drawn (`settings.ts`'s
   * `injuriesShown`): off, neither the anatomy plate nor the g meter. */
  injuries?: boolean;
}) {
  const lit = snap.missed !== null || snap.getUp;
  // A free ride is leisure; a tricks run is scored like a contest.
  const leisure = snap.free && !snap.tricks;
  const flown = snap.heli?.kind === "flown" ? snap.heli : null;
  // The snowmobile's readout over the helicopter's call: ridden, or stood
  // beside it, it is the one the machine key is about.
  // A piste machine's over both: driven, or stood beside it.
  const groomerFirst =
    snap.groomer !== null && (snap.groomer.kind === "driven" || snap.groomer.near);
  const indoors = snap.afterski?.kind === "inside";
  const sledFirst =
    !groomerFirst && snap.sled !== null && (snap.sled.kind === "ridden" || snap.sled.near);
  const barSide: ZoneSide = lever === "left" ? "right" : "left";
  // FLYING THE HELICOPTER the thumbs are two pads: the edge thumb's glass
  // the cyclic, the lever's the collective and the pedals.
  const leverZone = flown ? (
    <StickZone touch={input.touch} feel={feel} side={lever} role="power" live={live} />
  ) : (
    <LeverZone touch={input.touch} feel={feel} side={lever} />
  );
  const barZone = flown ? (
    <StickZone touch={input.touch} feel={feel} side={barSide} role="cyclic" />
  ) : (
    <BarZone
      touch={input.touch}
      feel={edgeFeel(feel, snap.race?.discipline ?? null)}
      side={barSide}
    />
  );
  const thumbs = touch && (
    <div class="hud-touch">
      {/* In reading order, so the zone on the left is the first child
          whichever of the two it is. */}
      {lever === "left" && leverZone}
      {barZone}
      {lever === "right" && leverZone}
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
      style={{ "--hud-dark": String(snap.dark) }}
      data-touch={touch ? "1" : undefined}
    >
      {/* THE RUN'S FIGURES — the clock, the place, the gates — are a
          contest's, and a FREE RIDE is no contest: it skis without them,
          and carries the MAP'S SEED alone in their place, so a picture of
          it says which mountain it was taken on — the one number that
          brings it back. */}
      {leisure && (
        <div class="hud-top">
          <div class="hud-top-row">
            <div class="hud-chip hud-seed">
              <span>{snap.seed}</span>
              <span class="hud-chip-sub">{STRINGS.seedLabel}</span>
            </div>
          </div>
        </div>
      )}
      {!leisure && (
        <div class="hud-top">
          <div class="hud-top-row">
            {/* A SPEED RACE reads its SPEED where every other run reads its
              clock — what he carries, then what the zone timed (R34). */}
            {snap.race?.zone ? (
              <div class="hud-clock hud-clock-speed">
                <span class="hud-clock-time">
                  {snap.finished && snap.result
                    ? STRINGS.speedSkiTimed(speedOf(snap.result.time, snap.race.zone) ?? 0)
                    : STRINGS.speedSkiNow(snap.speedKmh)}
                </span>
                <span class="hud-chip-sub">
                  {snap.finished && snap.result
                    ? STRINGS.speedSkiTimedLabel
                    : STRINGS.speedSkiLabel}
                </span>
              </div>
            ) : (
              <div class="hud-clock">
                <span class="hud-clock-time">{formatTime(snap.time)}</span>
                <span class="hud-chip-sub">{STRINGS.clockLabel}</span>
              </div>
            )}
            {/* A TRICKS RUN'S TWO: the score and the buzzer. */}
            {snap.tricks &&
              !snap.bigAir &&
              !snap.slopestyle &&
              !snap.halfpipe &&
              !snap.moguls &&
              !snap.aerials && <TricksChips tile={snap.tricks} />}
            {/* A SLOPESTYLE RUN: its run, its phase, the section he is in. */}
            {snap.slopestyle && (
              <div class="hud-chip hud-run">
                <span>{STRINGS.slopestyleRun(snap.slopestyle.run, snap.slopestyle.of)}</span>
                <span class="hud-chip-sub">
                  {STRINGS.slopestylePhase(snap.slopestyle.phase)} ·{" "}
                  {STRINGS.slopestyleSection(
                    snap.slopestyle.section,
                    snap.slopestyle.sections,
                    snap.slopestyle.kind,
                  )}
                </span>
              </div>
            )}
            {/* AN AERIALS JUMP: its phase, the jump declared, the flips thrown. */}
            {snap.aerials && (
              <div class="hud-chip hud-run">
                <span>{STRINGS.aerialsPhase(snap.aerials.phase)}</span>
                <span class="hud-chip-sub">
                  {STRINGS.aerialsDeclared(
                    snap.aerials.plan,
                    snap.aerials.dd,
                    snap.aerials.thrown,
                    snap.aerials.flips,
                  )}
                </span>
              </div>
            )}
            {/* A MOGULS RUN: its phase, the pace time and the airs so far. */}
            {snap.moguls && (
              <div class="hud-chip hud-run">
                <span>{STRINGS.mogulsPhase(snap.moguls.phase)}</span>
                <span class="hud-chip-sub">
                  {STRINGS.mogulsPace(snap.moguls.pace, snap.moguls.airs)}
                </span>
              </div>
            )}
            {/* A HALFPIPE RUN: its run, its phase, the hits and the last height. */}
            {snap.halfpipe && (
              <div class="hud-chip hud-run">
                <span>{STRINGS.halfpipeRun(snap.halfpipe.run, snap.halfpipe.of)}</span>
                <span class="hud-chip-sub">
                  {STRINGS.halfpipePhase(snap.halfpipe.phase)} ·{" "}
                  {STRINGS.halfpipeHits(snap.halfpipe.hits, snap.halfpipe.over)}
                </span>
              </div>
            )}
            {/* A BIG AIR JUMP: its phase, and which of its jumps. */}
            {snap.bigAir && (
              <div class="hud-chip hud-run">
                <span>{STRINGS.bigAirJump(snap.bigAir.jump, snap.bigAir.of)}</span>
                <span class="hud-chip-sub">{STRINGS.bigAirPhase(snap.bigAir.phase)}</span>
              </div>
            )}
            {/* THE PLACE — the one number a racer reads more than the clock.
              Keyed on the place, so a pass lands with its own beat. Left
              out of a race alone, where 1 / 1 says nothing. */}
            {snap.race ? (
              /* THE RUN in its place: a racer on an interval start is alone
               on the course, and his place is the board's at the flag — a
               slalom's or a giant slalom's run of two, a downhill's
               training or its race, a super-G's one run. */
              <div class="hud-chip hud-run">
                <span>
                  {snap.race.discipline === "downhill"
                    ? STRINGS.downhillRun(snap.race.training)
                    : snap.race.discipline === "superG"
                      ? STRINGS.superGRun
                      : snap.race.discipline === "speedSki"
                        ? STRINGS.speedSkiRun(snap.race.run)
                        : snap.race.discipline === "skiCross"
                          ? STRINGS.crossRound("qualify")
                          : STRINGS.runOf(snap.race.run, snap.race.runs)}
                </span>
                <span class="hud-chip-sub">{STRINGS.runLabel}</span>
              </div>
            ) : snap.cross ? (
              /* A SKI-CROSS HEAT: its round, and his place in the pack of
               four — the first two go through. */
              <>
                <div class="hud-chip hud-run">
                  <span>{STRINGS.crossRound(snap.cross.round)}</span>
                  <span class="hud-chip-sub">
                    {STRINGS.crossHeat(snap.cross.heat, snap.cross.round) ||
                      STRINGS.crossRoundLabel}
                  </span>
                </div>
                <div
                  class={`hud-chip hud-place${snap.place <= snap.cross.through ? " hud-place-through" : ""}`}
                  key={snap.place}
                >
                  <span>{STRINGS.place(snap.place, snap.skiers)}</span>
                  <span class="hud-chip-sub">{STRINGS.placeLabel}</span>
                </div>
              </>
            ) : !snap.free && snap.skiers > 1 ? (
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
              one figure a descent has that a loop never did; a ski-cross
              heat's place in the pack says more, and has the room. */}
            {!snap.free && !(snap.cross && snap.cross.round !== "qualify") && (
              <div class="hud-chip">
                <span>{STRINGS.dropped(snap.dropped)}</span>
                <span class="hud-chip-sub">{STRINGS.droppedLabel}</span>
              </div>
            )}
          </div>
          {/* A RACE'S INTERMEDIATE: the clock at the timing point and the
            gap to the leader there — green ahead, red behind, as television
            shows it. */}
          {snap.race?.timing && (
            <div class="hud-top-row">
              <div class="hud-chip hud-split" key={`t-${snap.race.timing.point}`}>
                <span>{STRINGS.split(snap.race.timing.time)}</span>
                <span class="hud-chip-sub">{STRINGS.timingLabel(snap.race.timing.point)}</span>
              </div>
              {snap.race.timing.gap !== null && (
                <div
                  class={`hud-chip hud-split hud-gap ${snap.race.timing.gap < 0 ? "hud-gap-ahead" : "hud-gap-behind"}`}
                  key={`tg-${snap.race.timing.point}`}
                >
                  <span>{STRINGS.gap(snap.race.timing.gap)}</span>
                  <span class="hud-chip-sub">{STRINGS.leaderGapLabel}</span>
                </div>
              )}
            </div>
          )}
          {/* A DOWNHILL'S SPEED TRAP, fresh: his speed through it and where
            it stands among the field's. */}
          {snap.race?.trapFresh && snap.race.trap?.speed != null && (
            <div class="hud-top-row">
              <div class="hud-chip hud-split hud-trap" key="trap">
                <span>{STRINGS.trapSpeed(snap.race.trap.speed)}</span>
                <span class="hud-chip-sub">{STRINGS.trapLabel(snap.race.trap.rank)}</span>
              </div>
            </div>
          )}
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
      )}

      {/* The map first and the presses UNDER it: the map is read at a
          glance from the top of the corner — and pressed, to hold the race —
          and the reset and the camera sit a thumb's reach lower, nearer the
          hands. */}
      <div class="hud-topright">
        <Minimap map={snap.minimap} dark={snap.dark} onPause={onPause} />
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

      {/* Indoors (the afterski's room) there is nothing to ski: no speed,
          edge or wind, and no body panel. */}
      {!indoors && (
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
      )}

      {/* BOGGED: the skier sunk to the knees, where the missed arrow stands
          (the two are never up together — a bogged skier is going nowhere
          near a gate). Up for as long as the engine says he is in it. */}
      {snap.stuck && snap.missed === null && (
        <div class="hud-missed hud-stuck" role="status">
          <span class="hud-missed-title">{STRINGS.stuck}</span>
          <span class="hud-missed-distance">{STRINGS.stuckHow}</span>
        </div>
      )}

      {/* DOWN, past the first seconds of the fall (`crash.getUp`): what
          stands him up. Before them the fall and the body's plate have the
          screen to themselves; the engine stands him up itself at
          `crash.lieFor`. */}
      {snap.getUp && snap.missed === null && (
        <div class="hud-missed hud-stuck hud-get-up" role="status">
          <span class="hud-missed-distance">{STRINGS.getUp(touch, tuckKey)}</span>
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

      {/* THE STARTER'S WORD on a slalom, small at the top centre: the
          start clock in the house carries the count, and the television
          shot of the start is not to be covered. Keyed on the word, so GO
          lands with its own beat. */}
      {snap.race?.word && (
        <div class="hud-starter" role="status" key={snap.race.word}>
          <span class={snap.race.word === "go" ? "hud-starter-go" : undefined}>
            {snap.race.word === "go" ? STRINGS.starterGo : STRINGS.starterReady}
          </span>
        </div>
      )}
      {/* A SKI-CROSS HEAT'S START: "skiers ready", "attention" — and the
          doors drop at a moment nobody is told, GO only once they have. */}
      {snap.cross?.word && (
        <div class="hud-starter" role="status" key={snap.cross.word}>
          <span class={snap.cross.word === "go" ? "hud-starter-go" : undefined}>
            {snap.cross.word === "go"
              ? STRINGS.crossGo
              : snap.cross.word === "attention"
                ? STRINGS.crossAttention
                : STRINGS.crossReady}
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

      {/* THE HELICOPTER (`hud-heli.tsx`): the drop under its skids while he
          rides it, the call to it while it waits on its pad near him — but
          the snowmobile's word wins while he rides it or stands beside it. */}
      {snap.heli && !sledFirst && !groomerFirst && !snap.para && snap.airTime === 0 && (
        <HeliReadout
          heli={snap.heli}
          live={live}
          touch={touch}
          machineKey={machineKey}
          onBoard={input.requestMachine}
        />
      )}

      {/* THE SNOWMOBILE (`hud-sled.tsx`): the tachometer while he rides it,
          the call to it while it waits near him. */}
      {snap.sled &&
        !groomerFirst &&
        (sledFirst || !snap.heli) &&
        !snap.para &&
        snap.airTime === 0 && (
          <SledReadout
            sled={snap.sled}
            touch={touch}
            machineKey={machineKey}
            onBoard={input.requestMachine}
          />
        )}

      {/* THE AFTERSKI (`hud-afterski.tsx`): the way to a lodge and in, the
          room, the skis to fetch — and the BUZZ meter while he has one. */}
      {snap.afterski && !sledFirst && !groomerFirst && snap.airTime === 0 && (
        <AfterskiReadout
          afterski={snap.afterski}
          touch={touch}
          machineKey={machineKey}
          onPress={input.requestMachine}
        />
      )}
      {snap.buzz > 0.005 && <BuzzMeter buzz={snap.buzz} />}

      {/* THE PARAMOTOR (`hud-para.tsx`): the flight strip while the rig is
          on him — in the air clock's place, which a flight never shows. */}
      {snap.para && <ParaReadout para={snap.para} touch={touch} machineKey={machineKey} />}
      {/* THE PISTE MACHINE (`hud-groomer.tsx`): driven, or the call to one
          working near him when nothing else is calling. */}
      {snap.groomer &&
        (groomerFirst || (!snap.sled && !snap.heli)) &&
        !snap.para &&
        snap.afterski?.kind !== "inside" &&
        snap.airTime === 0 && (
          <GroomerReadout
            groomer={snap.groomer}
            touch={touch}
            machineKey={machineKey}
            onBoard={input.requestMachine}
          />
        )}

      {/* THE BODY at the left edge, and THE G METER over the skier the
          moment a blow lands (`hud-body.tsx`, `hud-gforce.tsx`) — neither
          where OPTIONS ▸ INJURIES or the device's content setting says no. */}
      {injuries && !indoors && <BodyPanel tile={snap.body} />}
      {injuries && snap.body.blow && <GForce blow={snap.body.blow} />}

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
