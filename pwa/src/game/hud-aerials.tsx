// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AERIALS' PLATE (R44) — the card over a jump the panel has scored,
// drawn by `ResultPlate` in place of its own.
//
// It says which phase it was and its SCORE (or why it is no finish), the
// jump declared in words and the jump flown, the three parts — the air,
// the form and the landing, each the middle three of five judges — and
// their sum times the DD, then the phase's BOARD and WHAT COMES NEXT
// (`aerials-run.ts`'s `AerialsNext`): on to the next final on the jump it
// will declare, with its press first, or the contest over for him.

import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

export function AerialsPlate({
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
  const run = snap.aerials;
  if (!run?.judged) return null;
  const { judged, next } = run;
  const onward = next?.kind === "final" && onSecond !== null;
  const won = next?.kind === "done" && next.place === 1;
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div class={`hud-card hud-result hud-result-boarded${won ? " hud-result-record" : ""}`}>
          <span class="hud-card-note hud-result-label">{STRINGS.aerialsTitle(run.phase)}</span>
          <span class="hud-card-title hud-result-verdict">
            {judged.dnf ? STRINGS.aerialsOut(judged.dnf) : STRINGS.aerialsScore(judged.score)}
          </span>
          <span class="hud-card-note">
            {STRINGS.aerialsJumpCode(judged.plan, judged.dd)} ·{" "}
            {STRINGS.aerialsJumpWords(judged.plan)}
          </span>
          <span class="hud-card-note">
            {STRINGS.aerialsFlown(judged.flown)}
            {judged.fell ? ` · ${STRINGS.aerialsFell}` : ""}
          </span>
          {judged.dnf !== "start" && (
            <span class="hud-card-note">
              {STRINGS.aerialsParts(judged.air, judged.form, judged.landing)}
            </span>
          )}
          {!judged.dnf && (
            <span class="hud-card-note">{STRINGS.aerialsSum(judged.raw, judged.dd)}</span>
          )}
          {next && (
            <span
              class="hud-card-note hud-result-award"
              data-cleared={next.kind !== "out" ? "1" : undefined}
            >
              {next.kind === "final"
                ? STRINGS.aerialsThrough(next.place)
                : next.kind === "out"
                  ? STRINGS.aerialsShort(next.place)
                  : STRINGS.aerialsDone(next.place)}
            </span>
          )}
          <ol class="hud-standings hud-bigair-board">
            {run.board.map((r) => (
              <li key={r.id} class={`hud-standing${r.you ? " hud-standing-you" : ""}`}>
                <span class="hud-standing-place">{r.place}</span>
                <span class="hud-standing-name">
                  {r.you ? STRINGS.aerialsYou : STRINGS.aerialsBib(r.id)}
                </span>
                <span class="hud-standing-time">{STRINGS.aerialsRow(r.plan, r.score, r.dnf)}</span>
              </li>
            ))}
          </ol>
          <div class="hud-result-acts">
            {onward && next?.kind === "final" && (
              <button
                type="button"
                class="hud-mini hud-result-act hud-result-second"
                data-nav-next
                onClick={onSecond ?? undefined}
              >
                {STRINGS.aerialsToFinal(next.phase, next.plan)}
              </button>
            )}
            <button
              type="button"
              class="hud-mini hud-result-act"
              data-nav-next={onward ? undefined : true}
              onClick={onAgain}
            >
              {STRINGS.aerialsAgain}
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
