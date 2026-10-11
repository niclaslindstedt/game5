// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAUSE CARD'S CHALLENGES — every challenge THIS mountain deals
// (`docs/challenges.md`), listed on a panel of the free ride's pause card:
// each one's name (`LINE · RUN 4`, `KICKER · RUN 2`, `HIDDEN SPOTS 2/5`,
// `EVERY SUMMIT 3/7`), its three bars — a time, a trick or a count each,
// gold first — and the best held on this map, or NOT YET. A timed line's
// row carries RIDE, which stands the ride up again by the lift to the top of
// that line's run, the PISTE MAP's own way (`menu-pause-slopes.tsx`).
//
// The rows are the snapshot's (`challenge-hud.ts`, DOM-free); every word is
// the strings table's. It is a panel of the pause card as OPTIONS is: its
// head's ‹ goes back to the card, and the backdrop does the same.

import { rideOnto, runPicked, type FreeRide } from "./free-ride.ts";
import type { ChallengeRow } from "./challenge-hud.ts";
import { GradeMark } from "./grade-mark.tsx";
import { MedalMark } from "./medal-mark.tsx";
import { Caption, MenuBody, MenuHead } from "./menu-knobs.tsx";
import type { Settings } from "./settings.ts";
import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

export function PauseChallenges({
  snap,
  rows,
  settings,
  onSettings,
  onRide,
  onBack,
}: {
  snap: HudSnapshot;
  rows: readonly ChallengeRow[];
  settings: Settings;
  onSettings: (settings: Settings) => void;
  /** Stand the ride up again at the top of a line's run, or null. */
  onRide: ((ride: FreeRide) => void) | null;
  onBack: () => void;
}) {
  const ride = (run: string): void => {
    if (!onRide) return;
    const here = rideOnto(settings.ride, snap.seed, snap.region, snap.face);
    const next = { ...here, ...runPicked(here, snap.seed, run) };
    onSettings({ ...settings, ride: next });
    onRide(next);
  };
  return (
    <div
      class="menu-card menu-card-pause menu-card-pause-challenges"
      onPointerDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <MenuHead back={onBack} backLabel={STRINGS.pauseBack} title={STRINGS.pauseChallenges} />
      <MenuBody class="challenge-list">
        {rows.length === 0 && <p class="challenge-none">{STRINGS.pauseChallengesNone}</p>}
        {rows.map((row) => (
          <div class="challenge-row" key={row.id} data-kind={row.kind}>
            <div class="challenge-row-head">
              {row.grade && <GradeMark grade={row.grade} className="challenge-grade" />}
              <span class="challenge-name">{row.name}</span>
              {row.run && onRide && (
                <button
                  type="button"
                  class="menu-chip challenge-ride"
                  data-menu={`ride-${row.id}`}
                  onClick={() => ride(row.run!)}
                >
                  <span class="menu-tile-name">{STRINGS.challengeRide}</span>
                </button>
              )}
            </div>
            <div class="challenge-row-body">
              <div class="challenge-bars">
                {row.bars.map((b) => (
                  <span class="challenge-bar" key={b.medal}>
                    <MedalMark medal={b.medal} />
                    <span class="challenge-bar-text">{b.text}</span>
                  </span>
                ))}
              </div>
              <div class={`challenge-held${row.held ? "" : " challenge-held-none"}`}>
                <span class="challenge-held-label">{STRINGS.challengeHeld}</span>
                <span class="challenge-held-value">
                  {row.held && <MedalMark medal={row.held.medal} />}
                  {row.held ? row.held.text : STRINGS.challengeNotYet}
                </span>
              </div>
            </div>
          </div>
        ))}
      </MenuBody>
      <Caption hint={null} fallback={STRINGS.pauseChallengesCaption} />
    </div>
  );
}
