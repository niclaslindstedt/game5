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
// A run that went OUT is no finish: the plate says DISQUALIFIED or DID NOT
// FINISH and why, in plain words, with no time and no place, over the same
// board.
//
// A DOWNHILL'S PLATE says whether it was the TRAINING run or the RACE, its
// speed through the trap and the field's fastest, and after the training —
// home or out of it — the RACE press first (`downhill-run.ts`).
//
// ITS OWN LAYER, drawn by App.tsx outside the HUD, and gated here: it is up
// over a finished race and down under the pause card, which offers its own.

import { isSkiId, skisById } from "@engine";

import { formatTime } from "@niclaslindstedt/oss-game-framework/hud/format";
import { SLALOM } from "@engine";

import type { CampaignLevel } from "./campaign.ts";
import type { CampaignPlate } from "./campaign-run.ts";
import { SlalomBoard } from "./hud-board.tsx";
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
  if (!snap?.standings) return null;
  const { result, standings, best, race: slalom } = snap;
  const out = slalom?.out ?? null;
  if (!result && !out) return null;
  if (!result)
    return (
      <OutPlate
        snap={snap}
        onAgain={onAgain}
        onMenu={onMenu}
        onReplay={onReplay}
        onSecond={onSecond}
      />
    );
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
              {STRINGS.resultLead(mine.gap)}
            </span>
          )}
          {/* A DOWNHILL'S SPEED TRAP: his speed through it, the field's
              fastest beside it. */}
          {slalom?.trap?.speed != null && (
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
              {second.kind === "out"
                ? STRINGS.secondOut
                : STRINGS.secondShort(second.place, SLALOM.qualify)}
            </span>
          )}
          {second?.kind === "go" && onSecond && (
            <span class="hud-card-note">{STRINGS.secondNote(SLALOM.qualify)}</span>
          )}
          {/* A downhill's training counts for nothing: the race is next. */}
          {second?.kind === "race" && onSecond && (
            <span class="hud-card-note">{STRINGS.raceNote}</span>
          )}
          {/* THE SLALOM'S BOARD: the whole start list, the player's row lit. */}
          {slalom && <SlalomBoard rows={standings} second={slalom.run === 2} />}
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
                {second.kind === "race" ? STRINGS.raceRun : STRINGS.secondRun}
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

/** THE PLATE OVER A RUN THAT WENT OUT (R31): the verdict and why, the board
 * under it, and the ways on — the run again, the replay, the front door. */
function OutPlate({
  snap,
  onAgain,
  onMenu,
  onReplay,
  onSecond,
}: {
  snap: HudSnapshot;
  onAgain: () => void;
  onMenu: () => void;
  onReplay: (() => void) | null;
  /** A downhill's RACE, after a training run that went out. */
  onSecond: (() => void) | null;
}) {
  const slalom = snap.race;
  const out = slalom?.out;
  if (!slalom || !out || !snap.standings) return null;
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div class="hud-card hud-result hud-result-out hud-result-boarded">
          <span class="hud-card-note hud-result-label">{raceTitle(slalom)}</span>
          {snap.course && <span class="hud-card-note">{snap.course}</span>}
          <span class="hud-card-title hud-result-verdict">{STRINGS.outTitle(out.status)}</span>
          <span class="hud-card-note hud-result-why">{STRINGS.outWhy(out)}</span>
          {slalom.second?.kind === "out" && <span class="hud-card-note">{STRINGS.secondOut}</span>}
          {slalom.second?.kind === "race" && onSecond && (
            <span class="hud-card-note">{STRINGS.raceNote}</span>
          )}
          <SlalomBoard rows={snap.standings} second={slalom.run === 2} />
          <div class="hud-result-acts">
            {slalom.second?.kind === "race" && onSecond && (
              <button
                type="button"
                class="hud-mini hud-result-act hud-result-second"
                data-nav-next
                onClick={onSecond}
              >
                {STRINGS.raceRun}
              </button>
            )}
            <button
              type="button"
              class="hud-mini hud-result-act"
              data-nav-next={slalom.second?.kind === "race" && onSecond ? undefined : true}
              onClick={onAgain}
            >
              {raceAgain(slalom)}
            </button>
            {onReplay && (
              <button type="button" class="hud-mini hud-result-act" onClick={onReplay}>
                {STRINGS.replayWatch}
              </button>
            )}
            <button type="button" class="hud-mini hud-result-act" onClick={onMenu}>
              {STRINGS.pauseMainMenu}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A race's plate title: the slalom's run, the downhill's training or race. */
function raceTitle(race: RaceHud): string {
  return race.discipline === "downhill"
    ? STRINGS.resultDownhillTitle(race.training)
    : STRINGS.resultSlalomTitle(race.run);
}

/** The press that skis this race's run again. */
function raceAgain(race: RaceHud): string {
  return race.discipline === "downhill"
    ? STRINGS.downhillAgain(race.training)
    : STRINGS.runAgain(race.run);
}
