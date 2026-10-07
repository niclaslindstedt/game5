// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HALFPIPE'S PLATE (R39) — the card over a run the judges have scored,
// drawn by `ResultPlate` in place of its own.
//
// It says which run it was and its SCORE (or the fall), the run's hits
// under it — each the trick the judges called and its height over the
// coping, an alley-oop named — then the phase's BOARD and WHAT COMES NEXT
// (`halfpipe-run.ts`'s `PipeNext`): the phase's next run with its press
// first, on to the final, or the contest over for him at his place.

import { HALFPIPE } from "@engine";

import type { HudSnapshot } from "./snapshot.ts";
import { ContestBoard } from "./hud-contest-board.tsx";
import { STRINGS } from "./strings.ts";

export function HalfpipePlate({
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
  const run = snap.halfpipe;
  if (!run?.judged) return null;
  const { judged, next } = run;
  const onward = (next?.kind === "run" || next?.kind === "final") && onSecond !== null;
  const won = next?.kind === "done" && next.place === 1;
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div class={`hud-card hud-result hud-result-boarded${won ? " hud-result-record" : ""}`}>
          <span class="hud-card-note hud-result-label">
            {STRINGS.halfpipeTitle(run.phase, run.run, run.of)}
          </span>
          <span class="hud-card-title hud-result-verdict">
            {judged.fell
              ? STRINGS.halfpipeFellScore(judged.total)
              : STRINGS.halfpipeScore(judged.total)}
          </span>
          {judged.hits.length === 0 && <span class="hud-card-note">{STRINGS.halfpipeNoHits}</span>}
          {judged.hits.map((h, k) => (
            <span key={k} class="hud-card-note">
              {STRINGS.halfpipeHit(STRINGS.trickName(h.read), h.alleyOop, h.over)}
            </span>
          ))}
          {next && (
            <span
              class="hud-card-note hud-result-award"
              data-cleared={next.kind !== "out" ? "1" : undefined}
            >
              {next.kind === "run"
                ? STRINGS.halfpipeTotal
                : next.kind === "final"
                  ? STRINGS.halfpipeNextFinal(next.place)
                  : next.kind === "out"
                    ? STRINGS.halfpipeShort(next.place, HALFPIPE.finalists)
                    : STRINGS.halfpipeDone(next.place)}
            </span>
          )}
          <ContestBoard
            rows={run.board}
            name={(r) => (r.you ? STRINGS.halfpipeYou : STRINGS.halfpipeBib(r.id))}
            figure={(r) => STRINGS.halfpipeRow(r.scores, r.fell, r.total)}
          />
          <div class="hud-result-acts">
            {onward && (
              <button
                type="button"
                class="hud-mini hud-result-act hud-result-second"
                data-nav-next
                onClick={onSecond ?? undefined}
              >
                {next?.kind === "run" ? STRINGS.halfpipeNextRun(next.run) : STRINGS.halfpipeToFinal}
              </button>
            )}
            <button
              type="button"
              class="hud-mini hud-result-act"
              data-nav-next={onward ? undefined : true}
              onClick={onAgain}
            >
              {STRINGS.halfpipeAgain}
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
