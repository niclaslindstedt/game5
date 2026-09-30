// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEVELOPER ▸ UNLOCKS — the campaign's board as something to SET rather than
// to earn: each shelf opened or shut by hand, and the whole ladder at once.
//
// EVERY DECISION IS `campaign-unlocks.ts`'s — what a grant writes, what a
// lock takes, which press still has anything left to do. This is the markup
// over those answers, the split every card here is built on. A page of its
// own for the reason the keys are a page behind OPTIONS: it is one question
// asked once per shelf, and the answers do not fit beside a row.

import { campaignStanding, type CampaignProgress } from "./campaign.ts";
import { lockShelves, unlockRows, unlockShelves } from "./campaign-unlocks.ts";
import { MenuHead } from "./menu-knobs.tsx";
import { STRINGS } from "./strings.ts";

export function UnlocksPage({
  progress,
  onProgress,
  onBack,
}: {
  progress: CampaignProgress;
  onProgress: (progress: CampaignProgress) => void;
  onBack: () => void;
}) {
  const rows = unlockRows(progress);
  const { cleared, of } = campaignStanding(progress);
  // Both whole-ladder presses read the row model: OPEN EVERYTHING is spent
  // when the LAST shelf's open is, SHUT EVERYTHING when the FIRST's shut is.
  const allWon = rows[rows.length - 1]?.won ?? false;
  const allShut = rows[0]?.shut ?? true;
  return (
    <div class="menu-card menu-card-options">
      <MenuHead back={onBack} backLabel={STRINGS.devTitle} title={STRINGS.unlocksTitle} />
      <div class="dev-line">{STRINGS.unlocksLine(cleared, of)}</div>
      <button
        type="button"
        class="menu-item menu-item-dev"
        disabled={allWon}
        onClick={() => onProgress(unlockShelves(progress, null))}
      >
        {STRINGS.unlocksAll}
      </button>
      <button
        type="button"
        class="menu-item menu-item-dev"
        disabled={allShut}
        onClick={() => onProgress(lockShelves(progress, null))}
      >
        {STRINGS.unlocksNone}
      </button>
      <div class="dev-line">{STRINGS.unlocksRule}</div>
      <div class="dev-locks">
        {rows.map((row) => (
          <div class="dev-lock" key={row.shelf.id}>
            <span class="dev-lock-text">
              <b>{row.shelf.name.toUpperCase()}</b>
              <span class="menu-item-sub">
                {STRINGS.unlocksShelfLine(row.cleared, row.of, row.open)}
              </span>
            </span>
            <button
              type="button"
              class="menu-item menu-item-dev dev-lock-act"
              disabled={row.won}
              onClick={() => onProgress(unlockShelves(progress, row.shelf.id))}
            >
              {STRINGS.unlocksOpen}
            </button>
            <button
              type="button"
              class="menu-item menu-item-dev dev-lock-act"
              disabled={row.shut}
              onClick={() => onProgress(lockShelves(progress, row.shelf.id))}
            >
              {STRINGS.unlocksShut}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
