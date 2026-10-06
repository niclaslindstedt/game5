// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FINISH PLATE — the card over a race the player has finished.
//
// A FINISHED RUN COASTS: the engine hands the skier neutral from the finish
// line on, so the tuck, the edge and the reset all stop answering. That is
// the run being over rather than the game hanging — but a plate that only
// stated the result would leave the skier standing in the arena with
// nothing on screen saying what to do about it. So it says what happened —
// the place and the time — then the WHOLE FIELD's table under it, which is
// live: the rest of the field is still racing home behind the skier, and
// each of them lands on the table with a time the moment they cross the
// line. Then the ways on, as PRESSES.
//
// IT PRESSES THE GAME'S OWN BUTTONS AND ADDS NONE: RACE AGAIN is the very
// line the B key lands on and MAIN MENU is the pause card's own. NEW
// MOUNTAIN is the front door's RACE, pressed from here so a skier who wants
// another mountain is not sent through a card to get it.
//
// UNDER THE TITLE, the course raced by its runs' names (`courseName`).
//
// A TIME TRIAL'S PLATE is the same card with the time where the place was
// and no table under it — there is nobody else to list — and under either
// the RECORD BOOK's line (`records.ts`): a new record, or the row that
// stood with its pair, its date and how far off it this run was. The row
// is the one that stood when the run began (`HudSnapshot.best`), so the
// plate can say the run beat it after the book has been rewritten.
//
// ON A CAMPAIGN RUNG the plate adds three lines — the rung, what it paid
// (points on a race, a medal on a trial) and what the finish did to the
// ladder — and NEXT RUN takes NEW MOUNTAIN's place, skiing the rung the ladder
// opened (`campaign-run.ts` writes the lines; this only draws them).
// A TRICKS RUN'S PLATE is the score where the time was, and no book under
// it: the record book is a book of times (`records.ts`).
//
// A SLALOM'S PLATE says which run it was; on the second the first run's
// time, this run's and the total, and the place is on combined time. Under
// it the BOARD (`hud-board.tsx`) — the whole start list, the player's row
// lit — and after the first run the SECOND RUN press, or why there is none
// (`secondRunOf`: out of the first run, or outside the qualifying places).
// A run that went OUT — in any race discipline — is no finish: the plate
// says DISQUALIFIED or DID NOT FINISH, why under it in plain words, and the
// TRY AGAIN press, and nothing else.
//
// A SKI CROSS'S PLATE is its own (`hud-cross.tsx`): the qualification's
// place and board, or a heat's four in their order and who goes through,
// and the press on to the next round.
//
// A DOWNHILL'S PLATE says whether it was the TRAINING run or the RACE, its
// speed through the trap and the field's fastest, and after a training run
// home the RACE press first (`downhill-run.ts`).
//
// ITS OWN LAYER, drawn by App.tsx outside the HUD, and gated here: it is up
// over a finished race and down under the pause card, which offers its own.

import { isSkiId, skisById } from "@engine";

import { formatTime } from "@niclaslindstedt/oss-game-framework/hud/format";
import { SLALOM, SPEED_SKI } from "@engine";

import type { CampaignLevel } from "./campaign.ts";
import type { CampaignPlate } from "./campaign-run.ts";
import { SlalomBoard } from "./hud-board.tsx";
import { CrossPlate } from "./hud-cross.tsx";
import { BigAirPlate } from "./hud-bigair.tsx";
import { JamPlate } from "./hud-knuckle.tsx";
import { SlopestylePlate } from "./hud-slopestyle.tsx";
import { speedGapOf, speedOf } from "./speed-ski-run.ts";
import type { HudSnapshot, RaceHud } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

export function ResultPlate({
  snap,
  touch,
  onAgain,
  onNew,
  onMenu,
  campaign = null,
  onNext,
  onReplay = null,
  onSecond = null,
}: {
  /** The race, or null while the plate is not the player's to press. */
  snap: HudSnapshot | null;
  /** Whether there is a thumb on the screen — the key note is for the other
   * kind of player, and the presses are for both. */
  touch: boolean;
  onAgain: () => void;
  onNew: () => void;
  onMenu: () => void;
  /** A CAMPAIGN RUNG's lines (`campaign-run.ts`): what it paid and what it
   * did to the ladder — and the NEXT press in place of NEW MAP where the
   * ladder has a map open after it. */
  campaign?: CampaignPlate | null;
  onNext?: (next: CampaignLevel) => void;
  /** The race watched back (`replay-run.ts`), or null where there is no
   * recording of it. */
  onReplay?: (() => void) | null;
  /** A slalom's SECOND RUN stood up (`pinned-run.ts`), or null where the
   * app offers none. */
  onSecond?: (() => void) | null;
}) {
  // BIG AIR's plate is its own: the jump judged and the contest's board.
  if (snap?.bigAir?.judged) {
    return (
      <BigAirPlate
        snap={snap}
        touch={touch}
        onAgain={onAgain}
        onNew={onNew}
        onMenu={onMenu}
        onReplay={onReplay}
        onSecond={onSecond}
      />
    );
  }
  // A SLOPESTYLE run's plate is its own: the sheet and the board.
  if (snap?.slopestyle?.judged) {
    return (
      <SlopestylePlate
        snap={snap}
        touch={touch}
        onAgain={onAgain}
        onNew={onNew}
        onMenu={onMenu}
        onReplay={onReplay}
        onSecond={onSecond}
      />
    );
  }
  // A KNUCKLE HUCK's plate is its own: the jam's board at the buzzer.
  if (snap?.jam) {
    return (
      <JamPlate
        snap={snap}
        touch={touch}
        onAgain={onAgain}
        onNew={onNew}
        onMenu={onMenu}
        onReplay={onReplay}
      />
    );
  }
  if (!snap?.standings) return null;
  // A SKI CROSS's plate is its own: a heat's order and who goes through.
  if (snap.cross) {
    return (
      <CrossPlate
        snap={snap}
        touch={touch}
        onAgain={onAgain}
        onNew={onNew}
        onMenu={onMenu}
        onReplay={onReplay}
        onSecond={onSecond}
      />
    );
  }
  const { result, standings, best, race: slalom } = snap;
  const out = slalom?.out ?? null;
  if (!result && !out) return null;
  if (!result) return <OutPlate snap={snap} onAgain={onAgain} />;
  const trial = snap.mode === "timeTrial";
  const record = best === null || result.time < best.time;
  const gold = snap.tricks ? false : trial ? record : result.place === 1;
  const mine = standings.find((s) => s.you);
  const second = slalom?.second ?? null;
  const onward = (second?.kind === "go" || second?.kind === "race") && onSecond !== null;
  const skisName = (id: string): string => (isSkiId(id) ? skisById(id).name : id);
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div
          class={`hud-card hud-result${gold ? " hud-result-record" : ""}${slalom ? " hud-result-boarded" : ""}`}
        >
          <span class="hud-card-note hud-result-label">
            {snap.tricks
              ? STRINGS.resultTricksTitle
              : trial
                ? STRINGS.resultTrialTitle
                : slalom
                  ? raceTitle(slalom)
                  : STRINGS.resultTitle}
          </span>
          {snap.course && <span class="hud-card-note">{snap.course}</span>}
          {snap.tricks ? (
            <span class="hud-card-title">{STRINGS.score(snap.tricks.score)}</span>
          ) : trial ? (
            <span class="hud-card-title">{STRINGS.resultTime(result.time)}</span>
          ) : slalom?.zone ? (
            /* A SPEED RACE: the place and the SPEED the zone timed, the time
               it was read off under it, and on the final the speed he
               qualified at. */
            <>
              <span class="hud-card-title">{STRINGS.resultPlace(result.place, snap.skiers)}</span>
              <span class="hud-card-note hud-result-speed">
                {STRINGS.resultSpeed(speedOf(result.time, slalom.zone) ?? 0)}
              </span>
              <span class="hud-card-note">{STRINGS.resultZone(result.time, slalom.zone)}</span>
              {slalom.run === 2 && (
                <span class="hud-card-note">
                  {STRINGS.resultQualifying(speedOf(slalom.before, slalom.zone) ?? 0)}
                </span>
              )}
            </>
          ) : slalom?.run === 2 ? (
            <>
              <span class="hud-card-title">{STRINGS.resultPlace(result.place, snap.skiers)}</span>
              <span class="hud-card-note">{STRINGS.resultRuns(slalom.before, result.time)}</span>
              <span class="hud-card-note">{STRINGS.resultTotal(slalom.before + result.time)}</span>
            </>
          ) : (
            <>
              <span class="hud-card-title">{STRINGS.resultPlace(result.place, snap.skiers)}</span>
              <span class="hud-card-note">{STRINGS.resultTime(result.time)}</span>
            </>
          )}
          {/* Where the player stands against the leader on the board. */}
          {slalom && mine?.gap !== null && mine?.gap !== undefined && (
            <span class="hud-card-note hud-result-lead" data-lead={mine.gap <= 0 ? "1" : undefined}>
              {slalom.zone
                ? STRINGS.resultLeadSpeed(speedGapOf(mine.total, mine.gap, slalom.zone) ?? 0)
                : STRINGS.resultLead(mine.gap)}
            </span>
          )}
          {/* A SPEED COURSE'S TRAP: his speed through it, the field's
              fastest beside it. */}
          {slalom?.trap?.speed != null && !slalom.zone && (
            <span class="hud-card-note hud-result-trap">
              {STRINGS.resultTrap(slalom.trap.speed, slalom.trap.best)}
            </span>
          )}
          {/* What the time owes the slalom gates skied past — already in
              it (`Progress.penalty`), so the time stands as the clock. */}
          {!snap.tricks && result.penalty > 0 && (
            <span class="hud-card-note hud-result-penalty">
              {STRINGS.resultPenalty(result.penalty)}
            </span>
          )}
          {/* THE RECORD BOOK's line: the row this run set, or the one that
              stood and how far off it the run was. */}
          {!snap.tricks && (
            <span class="hud-card-note hud-result-book" data-record={record ? "1" : undefined}>
              {record || best === null
                ? STRINGS.resultRecord
                : slalom?.zone
                  ? `${STRINGS.resultBestSpeed(speedOf(best.time, slalom.zone) ?? 0, skisName(best.skis), best.at)} · ${STRINGS.resultOffSpeed((speedOf(result.time, slalom.zone) ?? 0) - (speedOf(best.time, slalom.zone) ?? 0))}`
                  : `${STRINGS.resultBest(best.time, skisName(best.skis), best.at)} · ${STRINGS.resultOff(result.time - best.time)}`}
            </span>
          )}
          {/* THE CAMPAIGN'S lines on a rung: the rung, what it paid, and
              what the finish did to the ladder. */}
          {campaign && <span class="hud-card-note hud-result-rung">{campaign.title}</span>}
          {campaign && (
            <span
              class="hud-card-note hud-result-award"
              data-cleared={campaign.cleared ? "1" : undefined}
            >
              {campaign.award}
            </span>
          )}
          {campaign?.ladder && (
            <span class="hud-card-note hud-result-ladder">{campaign.ladder}</span>
          )}
          {/* THE SECOND RUN, or why there is none. */}
          {(second?.kind === "out" || second?.kind === "short") && (
            <span class="hud-card-note hud-result-penalty">
              {slalom?.zone
                ? second.kind === "out"
                  ? STRINGS.finalOut
                  : STRINGS.finalShort(second.place, SPEED_SKI.qualify)
                : second.kind === "out"
                  ? STRINGS.secondOut
                  : STRINGS.secondShort(second.place, SLALOM.qualify)}
            </span>
          )}
          {second?.kind === "go" && onSecond && (
            <span class="hud-card-note">
              {slalom?.zone
                ? STRINGS.finalNote(SPEED_SKI.qualify)
                : STRINGS.secondNote(SLALOM.qualify)}
            </span>
          )}
          {/* A downhill's training counts for nothing: the race is next. */}
          {second?.kind === "race" && onSecond && (
            <span class="hud-card-note">{STRINGS.raceNote}</span>
          )}
          {/* THE SLALOM'S BOARD: the whole start list, the player's row lit. */}
          {slalom && (
            <SlalomBoard
              rows={standings}
              second={slalom.run === 2 && !slalom.zone}
              zone={slalom.zone}
            />
          )}
          {/* THE FIELD, best first. A skier still out is billed by the gate
              he has got to, so the table fills in as they come home. */}
          {!slalom && standings.length > 1 && (
            <ol class="hud-standings">
              {standings.map((s) => (
                <li key={s.slot} class={`hud-standing${s.you ? " hud-standing-you" : ""}`}>
                  <span class="hud-standing-place">{s.place}</span>
                  <span class="hud-standing-name">
                    {s.you ? STRINGS.skierYou : STRINGS.skierRival(s.slot)}
                  </span>
                  <span class="hud-standing-time">
                    {s.time !== null
                      ? formatTime(s.time)
                      : STRINGS.standingOut(s.taken, snap.gates)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {/* THE WAYS ON. Racing again first — it is what a skier wants most
              of the time and the only one with a key behind it. */}
          <div class="hud-result-acts">
            {/* A slalom's SECOND RUN — a downhill's RACE after its training —
                first: it is the way on. */}
            {onward && (
              <button
                type="button"
                class="hud-mini hud-result-act hud-result-second"
                data-nav-next
                onClick={onSecond}
              >
                {second.kind === "race"
                  ? STRINGS.raceRun
                  : slalom?.zone
                    ? STRINGS.finalRun
                    : STRINGS.secondRun}
              </button>
            )}
            <button
              type="button"
              class="hud-mini hud-result-act"
              data-nav-next={onward ? undefined : true}
              onClick={onAgain}
            >
              {trial || snap.tricks
                ? STRINGS.resultTrialAgain
                : slalom
                  ? raceAgain(slalom)
                  : STRINGS.resultAgain}
            </button>
            {campaign ? (
              campaign.next &&
              onNext && (
                <button
                  type="button"
                  class="hud-mini hud-result-act"
                  onClick={() => campaign.next && onNext(campaign.next)}
                >
                  {STRINGS.plateNext}
                </button>
              )
            ) : (
              <button type="button" class="hud-mini hud-result-act" onClick={onNew}>
                {STRINGS.resultNew}
              </button>
            )}
            {onReplay && (
              <button type="button" class="hud-mini hud-result-act" onClick={onReplay}>
                {STRINGS.replayWatch}
              </button>
            )}
            <button type="button" class="hud-mini hud-result-act" onClick={onMenu}>
              {STRINGS.pauseMainMenu}
            </button>
          </div>
          {!touch && (
            <span class="hud-card-note hud-result-note">
              {slalom ? STRINGS.slalomNote : STRINGS.resultNote}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** THE PLATE OVER A RUN THAT WENT OUT (R31): the verdict, why under it, and
 * TRY AGAIN — nothing else. A run that is out has no place, no time and
 * nothing to weigh, so the plate says what happened and offers the one press
 * a racer wants then; the front door is the pause card's. */
function OutPlate({ snap, onAgain }: { snap: HudSnapshot; onAgain: () => void }) {
  const race = snap.race;
  const out = race?.out;
  if (!race || !out) return null;
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div class="hud-card hud-result hud-result-out">
          <span class="hud-card-title hud-result-verdict">{STRINGS.outTitle(out.status)}</span>
          <span class="hud-card-note hud-result-why">{STRINGS.outWhy(out)}</span>
          <div class="hud-result-acts">
            <button type="button" class="hud-mini hud-result-act" data-nav-next onClick={onAgain}>
              {STRINGS.outAgain}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A race's plate title: the slalom's run, the giant slalom's, the
 * downhill's training or race, the super-G. */
function raceTitle(race: RaceHud): string {
  if (race.discipline === "superG") return STRINGS.resultSuperGTitle;
  if (race.discipline === "giantSlalom") return STRINGS.resultGiantSlalomTitle(race.run);
  if (race.discipline === "speedSki") return STRINGS.resultSpeedSkiTitle(race.run);
  return race.discipline === "downhill"
    ? STRINGS.resultDownhillTitle(race.training)
    : STRINGS.resultSlalomTitle(race.run);
}

/** The press that skis this race's run again. */
function raceAgain(race: RaceHud): string {
  if (race.discipline === "superG") return STRINGS.superGAgain;
  if (race.discipline === "speedSki") return STRINGS.speedSkiAgain(race.run);
  return race.discipline === "downhill"
    ? STRINGS.downhillAgain(race.training)
    : STRINGS.runAgain(race.run);
}
