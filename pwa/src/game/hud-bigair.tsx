// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// BIG AIR'S PLATE (R37) — the card over a jump the panel has judged, drawn
// by `ResultPlate` in place of its own.
//
// It says which jump it was, THE TRICK as the judges call it and the
// panel's SCORE (or the fall), then the phase's BOARD — the player's row
// and the best around him, each jump's score and the total the phase
// counts (the qualification's best jump, the final's best two different
// tricks) — and under it WHAT COMES NEXT (`big-air-run.ts`'s `BigAirNext`):
// the phase's next jump with its press first, on to the final, or the
// contest over for him at his place. Then the plate's usual ways on.

import { BIG_AIR } from "@engine";

import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

export function BigAirPlate({
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
  const air = snap.bigAir;
  if (!air?.judged) return null;
  const { judged, next } = air;
  const onward = (next?.kind === "jump" || next?.kind === "final") && onSecond !== null;
  const won = next?.kind === "done" && next.place === 1;
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div class={`hud-card hud-result hud-result-boarded${won ? " hud-result-record" : ""}`}>
          <span class="hud-card-note hud-result-label">
            {STRINGS.bigAirTitle(air.phase, air.jump, air.of)}
          </span>
          <span class="hud-card-title">
            {judged.trick ? STRINGS.trickName(judged.trick) : STRINGS.trickNone}
          </span>
          <span class="hud-card-title hud-result-verdict">
            {judged.fell
              ? STRINGS.bigAirFellScore(judged.score)
              : STRINGS.bigAirScore(judged.score)}
          </span>
          {next && (
            <span
              class="hud-card-note hud-result-award"
              data-cleared={next.kind !== "out" ? "1" : undefined}
            >
              {next.kind === "jump"
                ? STRINGS.bigAirTotal(air.phase)
                : next.kind === "final"
                  ? STRINGS.bigAirNextFinal(next.place)
                  : next.kind === "out"
                    ? STRINGS.bigAirShort(next.place, BIG_AIR.finalists)
                    : STRINGS.bigAirDone(next.place)}
            </span>
          )}
          {/* THE BOARD: the phase as far as he has jumped. */}
          <ol class="hud-standings hud-bigair-board">
            {air.board.map((r) => (
              <li key={r.id} class={`hud-standing${r.you ? " hud-standing-you" : ""}`}>
                <span class="hud-standing-place">{r.place}</span>
                <span class="hud-standing-name">
                  {r.you ? STRINGS.bigAirYou : STRINGS.bigAirBib(r.id)}
                </span>
                <span class="hud-standing-time">
                  {STRINGS.bigAirRow(air.phase, r.scores, r.fell, r.total)}
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
                {next?.kind === "jump" ? STRINGS.bigAirNextJump(next.jump) : STRINGS.bigAirToFinal}
              </button>
            )}
            <button
              type="button"
              class="hud-mini hud-result-act"
              data-nav-next={onward ? undefined : true}
              onClick={onAgain}
            >
              {STRINGS.bigAirAgain}
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
