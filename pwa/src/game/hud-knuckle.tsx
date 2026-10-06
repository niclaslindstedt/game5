// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE KNUCKLE HUCK ON THE HUD (R38) — and the RAIL JAM (R40), the same
// jam: the jam's chips beside the clock — the session's mark as it stands, the jam's clock left, the hits ridden and
// the place on the board — the last hit as the judges called it, over the
// nose for a moment after it ends, and at the buzzer the PLATE: the place,
// the session's mark and the whole board, drawn by `ResultPlate` in place
// of its own.

import type { JamHud } from "./knuckle-huck-run.ts";
import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

/** How long the last hit's call stays up, s. */
const CALLED_FOR = 3.5;

/** The jam's chips beside the clock. */
export function JamChips({ jam }: { jam: JamHud }) {
  return (
    <>
      <div class="hud-chip hud-score" key={jam.score}>
        <span>{STRINGS.knuckleScore(jam.score)}</span>
        <span class="hud-chip-sub">{STRINGS.knuckleSession}</span>
      </div>
      <div class={`hud-chip${jam.left < 10 ? " hud-score-late" : ""}`}>
        <span>{STRINGS.knuckleClock(jam.left)}</span>
        <span class="hud-chip-sub">{STRINGS.timeLeftLabel}</span>
      </div>
      <div class="hud-chip hud-run">
        <span>{STRINGS.knuckleHits(jam.hits)}</span>
        <span class="hud-chip-sub">{STRINGS.knucklePlace(jam.place, jam.riders)}</span>
      </div>
    </>
  );
}

/** The last hit, called over the nose for a moment after it ends. */
export function JamCalled({ jam }: { jam: JamHud }) {
  const last = jam.last;
  if (!last || last.ago > CALLED_FOR || jam.done) return null;
  return (
    <div
      class={`hud-combo hud-combo-closed${last.fell ? " hud-combo-bailed" : ""}`}
      key={jam.hits}
      role="status"
    >
      <span class="hud-combo-line">
        {last.jib
          ? STRINGS.jibName(last.jib.ride, last.jib.shape)
          : last.trick
            ? STRINGS.trickName(last.trick)
            : STRINGS.trickNone}
      </span>
      <span class="hud-combo-points">
        {last.fell ? STRINGS.knuckleFall : STRINGS.knuckleImpression(last.impression)}
      </span>
    </div>
  );
}

export function JamPlate({
  snap,
  touch,
  onAgain,
  onNew,
  onMenu,
  onReplay,
}: {
  snap: HudSnapshot;
  touch: boolean;
  onAgain: () => void;
  onNew: () => void;
  onMenu: () => void;
  onReplay: (() => void) | null;
}) {
  const jam = snap.jam;
  if (!jam?.done) return null;
  const won = jam.place === 1;
  const rail = jam.format === "rail";
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div class={`hud-card hud-result hud-result-boarded${won ? " hud-result-record" : ""}`}>
          <span class="hud-card-note hud-result-label">
            {rail ? STRINGS.railJamTitle : STRINGS.knuckleTitle}
          </span>
          <span class="hud-card-title">{STRINGS.knuckleResult(jam.place)}</span>
          <span class="hud-card-title hud-result-verdict">{STRINGS.knuckleScore(jam.score)}</span>
          <span class="hud-card-note hud-result-award">
            {rail ? STRINGS.railJamNote : STRINGS.knuckleNote}
          </span>
          {/* THE BOARD: every rider's session at the buzzer. */}
          <ol class="hud-standings hud-bigair-board">
            {jam.board.map((r) => (
              <li key={r.id} class={`hud-standing${r.you ? " hud-standing-you" : ""}`}>
                <span class="hud-standing-place">{r.place}</span>
                <span class="hud-standing-name">
                  {r.you ? STRINGS.bigAirYou : STRINGS.bigAirBib(r.id)}
                </span>
                <span class="hud-standing-time">
                  {STRINGS.knuckleRow(r.hits, r.falls, r.score)}
                </span>
              </li>
            ))}
          </ol>
          <div class="hud-result-acts">
            <button type="button" class="hud-mini hud-result-act" data-nav-next onClick={onAgain}>
              {STRINGS.knuckleAgain}
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
