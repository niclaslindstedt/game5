// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SLOPESTYLE'S PLATE (R38) — the card over a run the judges have scored,
// drawn by `ResultPlate` in place of its own.
//
// It says which run it was and its SCORE (or the fall), the judges' sheet
// under it — each section's trick mark, then the trick panels' mean and the
// composition — then the phase's BOARD and WHAT COMES NEXT
// (`slopestyle-run.ts`'s `SlopeNext`): the phase's next run with its press
// first, on to the final, or the contest over for him at his place.

import { SLOPESTYLE } from "@engine";

import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

export function SlopestylePlate({
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
  const run = snap.slopestyle;
  if (!run?.judged) return null;
  const { judged, next } = run;
  const onward = (next?.kind === "run" || next?.kind === "final") && onSecond !== null;
  const won = next?.kind === "done" && next.place === 1;
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div class={`hud-card hud-result hud-result-boarded${won ? " hud-result-record" : ""}`}>
          <span class="hud-card-note hud-result-label">
            {STRINGS.slopestyleTitle(run.phase, run.run, run.of)}
          </span>
          <span class="hud-card-title hud-result-verdict">
            {judged.fell
              ? STRINGS.slopestyleFellScore(judged.total)
              : STRINGS.slopestyleScore(judged.total)}
          </span>
          <span class="hud-card-note">{STRINGS.slopestyleSections(judged.sections)}</span>
          <span class="hud-card-note">
            {STRINGS.slopestylePanels(judged.trick, judged.composition)}
          </span>
          {next && (
            <span
              class="hud-card-note hud-result-award"
              data-cleared={next.kind !== "out" ? "1" : undefined}
            >
              {next.kind === "run"
                ? STRINGS.slopestyleTotal
                : next.kind === "final"
                  ? STRINGS.slopestyleNextFinal(next.place)
                  : next.kind === "out"
                    ? STRINGS.slopestyleShort(next.place, SLOPESTYLE.finalists)
                    : STRINGS.slopestyleDone(next.place)}
            </span>
          )}
          <ol class="hud-standings hud-bigair-board">
            {run.board.map((r) => (
              <li key={r.id} class={`hud-standing${r.you ? " hud-standing-you" : ""}`}>
                <span class="hud-standing-place">{r.place}</span>
                <span class="hud-standing-name">
                  {r.you ? STRINGS.slopestyleYou : STRINGS.slopestyleBib(r.id)}
                </span>
                <span class="hud-standing-time">
                  {STRINGS.slopestyleRow(r.scores, r.fell, r.total)}
                </span>
              </li>
            ))}
          </ol>
          <div class="hud-result-acts">
            {onward && (
              <button
                type="button"
                class="hud-mini hud-result-act hud-result-second"
                data-nav-next
                onClick={onSecond ?? undefined}
              >
                {next?.kind === "run"
                  ? STRINGS.slopestyleNextRun(next.run)
                  : STRINGS.slopestyleToFinal}
              </button>
            )}
            <button
              type="button"
              class="hud-mini hud-result-act"
              data-nav-next={onward ? undefined : true}
              onClick={onAgain}
            >
              {STRINGS.slopestyleAgain}
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
