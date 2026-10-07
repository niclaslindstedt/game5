// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MOGULS' PLATE (R40) — the card over a run the panel and the clock
// have scored, drawn by `ResultPlate` in place of its own.
//
// It says which phase it was and its SCORE (or the run out), the three
// parts under it — the turns, the air and the speed — each jump with its
// trick, its degree of difficulty and what it earned, the time against
// the pace, then the phase's BOARD and WHAT COMES NEXT (`moguls-run.ts`'s
// `MogulsNext`): on to the next final with its press first, or the
// contest over for him at his place.

import type { HudSnapshot } from "./snapshot.ts";
import { ContestBoard } from "./hud-contest-board.tsx";
import { STRINGS } from "./strings.ts";

export function MogulsPlate({
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
  const run = snap.moguls;
  if (!run?.judged) return null;
  const { judged, next } = run;
  const onward = next?.kind === "final" && onSecond !== null;
  const won = next?.kind === "done" && next.place === 1;
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div class={`hud-card hud-result hud-result-boarded${won ? " hud-result-record" : ""}`}>
          <span class="hud-card-note hud-result-label">{STRINGS.mogulsTitle(run.phase)}</span>
          <span class="hud-card-title hud-result-verdict">
            {judged.fell ? STRINGS.mogulsOut : STRINGS.mogulsScore(judged.total)}
          </span>
          {!judged.fell && (
            <span class="hud-card-note">
              {STRINGS.mogulsParts(judged.turns, judged.air, judged.speed)}
            </span>
          )}
          {judged.jumps.map((j, k) => (
            <span key={k} class="hud-card-note">
              {j
                ? STRINGS.mogulsJump(STRINGS.trickName(j.trick), j.dd, j.form, j.points)
                : STRINGS.mogulsNoJump}
            </span>
          ))}
          {!judged.fell && (
            <span class="hud-card-note">{STRINGS.mogulsTime(judged.time, run.pace)}</span>
          )}
          {next && (
            <span
              class="hud-card-note hud-result-award"
              data-cleared={next.kind !== "out" ? "1" : undefined}
            >
              {next.kind === "final"
                ? STRINGS.mogulsThrough(next.place)
                : next.kind === "out"
                  ? STRINGS.mogulsShort(next.place)
                  : STRINGS.mogulsDone(next.place)}
            </span>
          )}
          <ContestBoard
            rows={run.board}
            name={(r) => (r.you ? STRINGS.mogulsYou : STRINGS.mogulsBib(r.id))}
            figure={(r) => STRINGS.mogulsRow(r.total, r.fell)}
          />
          <div class="hud-result-acts">
            {onward && next?.kind === "final" && (
              <button
                type="button"
                class="hud-mini hud-result-act hud-result-second"
                data-nav-next
                onClick={onSecond ?? undefined}
              >
                {STRINGS.mogulsToFinal(next.phase)}
              </button>
            )}
            <button
              type="button"
              class="hud-mini hud-result-act"
              data-nav-next={onward ? undefined : true}
              onClick={onAgain}
            >
              {STRINGS.mogulsAgain}
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
