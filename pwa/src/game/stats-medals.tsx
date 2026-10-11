// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STATISTICS CARD'S MEDALS — every challenge medal held across every
// mountain (`challenge-book.ts`'s `medalTally`): a disc of each colour over
// its count, gold first. Read off the book on disk as the card opens; the
// challenges' rig files a medal the moment it is won, so it is never a run
// behind.

import { useMemo } from "preact/hooks";

import { loadChallenges, medalTally } from "./challenge-book.ts";
import { MedalMark } from "./medal-mark.tsx";
import { STRINGS } from "./strings.ts";

export function MedalTally() {
  const tally = useMemo(() => medalTally(loadChallenges()), []);
  const none = tally.gold + tally.silver + tally.bronze === 0;
  return (
    <section class="stats-section stats-medals">
      <h3 class="stats-heading">{STRINGS.statsMedals}</h3>
      {none ? (
        <div class="stats-quiet">{STRINGS.statsMedalsNone}</div>
      ) : (
        <div class="stats-medal-row">
          {(["gold", "silver", "bronze"] as const).map((m) => (
            <div class="stats-medal" key={m}>
              <MedalMark medal={m} />
              <span class="stats-medal-count">{tally[m]}</span>
              <span class="stats-medal-label">{STRINGS.medalNames[m]}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
