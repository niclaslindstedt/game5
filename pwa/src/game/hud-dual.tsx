// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DUAL MOGULS' PLATE (R43) — the card over a run the panel has decided,
// drawn by `ResultPlate` in place of its own.
//
// After the QUALIFICATION: his score, its three parts and the board, and
// the seed it gave him in the ladder (or that it did not). After a DUAL:
// the votes his and his rival's, how they split — the turns, the air, the
// speed — the gap at the line, and WHAT COMES NEXT (`dual-moguls-run.ts`'s
// `DualNext`): the next dual with its press first, or the contest over for
// him at his place, the podium under it.

import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

export function DualPlate({
  snap,
  touch,
  onAgain,
  onNew,
  onMenu,
  onReplay,
  onSecond,
}: {
  snap: HudSnapshot;
  touch: boolean;
  onAgain: () => void;
  onNew: () => void;
  onMenu: () => void;
  onReplay: (() => void) | null;
  onSecond: (() => void) | null;
}) {
  const run = snap.dualMoguls;
  if (!run) return null;
  const { judged, votes, next, you } = run;
  const them = you === 0 ? 1 : 0;
  const onward = next?.kind === "duel" && onSecond !== null;
  const won = votes ? votes.winner === you : false;
  const champion = next?.kind === "done" && next.place === 1;
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div
          class={`hud-card hud-result hud-result-boarded${champion ? " hud-result-record" : ""}`}
        >
          <span class="hud-card-note hud-result-label">{STRINGS.dualTitle(run.round)}</span>
          {!judged && !votes && <span class="hud-card-title">{STRINGS.dualWaiting}</span>}
          {judged && (
            <>
              <span class="hud-card-title hud-result-verdict">
                {judged.fell ? STRINGS.mogulsOut : STRINGS.mogulsScore(judged.total)}
              </span>
              {!judged.fell && (
                <span class="hud-card-note">
                  {STRINGS.mogulsParts(judged.turns, judged.air, judged.speed)}
                </span>
              )}
            </>
          )}
          {votes && (
            <>
              <span class="hud-card-title hud-result-verdict">
                {STRINGS.dualVotes(votes.votes[you], votes.votes[them])}
              </span>
              <span class="hud-card-note">
                {run.out[you] ? STRINGS.dualOut : won ? STRINGS.dualWon : STRINGS.dualLost}
              </span>
              {run.out[them] && !run.out[you] && (
                <span class="hud-card-note">{STRINGS.dualRivalOut}</span>
              )}
              {!run.out[0] && !run.out[1] && (
                <span class="hud-card-note">
                  {STRINGS.dualParts(
                    [votes.turns[you], votes.turns[them]],
                    [votes.air[you], votes.air[them]],
                    [votes.speed[you], votes.speed[them]],
                  )}
                </span>
              )}
              {votes.gap !== null && (
                <span class="hud-card-note">
                  {STRINGS.dualGap(votes.gap, votes.speed[you] >= votes.speed[them])}
                </span>
              )}
            </>
          )}
          {next && (
            <span
              class="hud-card-note hud-result-award"
              data-cleared={next.kind !== "out" ? "1" : undefined}
            >
              {next.kind === "duel"
                ? judged && run.seed !== null
                  ? STRINGS.dualSeed(run.seed)
                  : STRINGS.dualThrough(next.round)
                : next.kind === "out"
                  ? judged
                    ? STRINGS.dualShort(next.place)
                    : STRINGS.dualOutAt(next.place)
                  : STRINGS.dualDone(next.place)}
            </span>
          )}
          {run.board.length > 0 && (
            <ol class="hud-standings hud-bigair-board">
              {run.board.map((r) => (
                <li
                  key={r.id ?? -1}
                  class={`hud-standing${r.id === null ? " hud-standing-you" : ""}`}
                >
                  <span class="hud-standing-place">{r.place}</span>
                  <span class="hud-standing-name">
                    {r.id === null ? STRINGS.dualYou : STRINGS.dualBib(r.id)}
                  </span>
                  <span class="hud-standing-time">{STRINGS.dualRow(r.score, r.fell)}</span>
                </li>
              ))}
            </ol>
          )}
          {run.podium && (
            <ol class="hud-standings hud-bigair-board">
              {run.podium.map((id, i) => (
                <li key={id ?? -1} class={`hud-standing${id === null ? " hud-standing-you" : ""}`}>
                  <span class="hud-standing-place">{i + 1}</span>
                  <span class="hud-standing-name">
                    {id === null ? STRINGS.dualYou : STRINGS.dualBib(id)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div class="hud-result-acts">
            {onward && next?.kind === "duel" && (
              <button
                type="button"
                class="hud-mini hud-result-act hud-result-second"
                data-nav-next
                onClick={onSecond ?? undefined}
              >
                {STRINGS.dualToNext(next.round)}
              </button>
            )}
            <button
              type="button"
              class="hud-mini hud-result-act"
              data-nav-next={onward ? undefined : true}
              onClick={onAgain}
            >
              {STRINGS.dualAgain}
            </button>
            <button type="button" class="hud-mini hud-result-act" onClick={onNew}>
              {STRINGS.resultNew}
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
          {!touch && <span class="hud-card-note hud-result-note">{STRINGS.slalomNote}</span>}
        </div>
      </div>
    </div>
  );
}
