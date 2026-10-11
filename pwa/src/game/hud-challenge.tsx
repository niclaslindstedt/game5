// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A FREE RIDE'S CHALLENGES ON THE HUD — drawn off the snapshot's
// `challenge` tile (`challenge-hud.ts`, DOM-free):
//
//   THE CHIP, under the seed in the top left while a timed line runs: the
//   line's clock big, the medal still in reach under it with that medal's
//   time — in the medal's own colour, so the colour drains from gold to
//   silver to bronze as the clock passes each — and a bar of how far down
//   the line the skier is.
//
//   THE PLATE, centred in the upper third for a few seconds after a line or
//   a trick goal is done: the medal won (or the empty ring), the challenge,
//   the time or the trick, and NEW BEST or how far off bronze it was.

import { formatTime } from "@niclaslindstedt/oss-game-framework/hud/format";

import type { ChallengeChip } from "./challenge-hud.ts";
import type { ChallengePlate } from "./challenge-run.ts";
import { MEDAL_LOOK } from "./medal-look.ts";
import { MedalMark } from "./medal-mark.tsx";
import { STRINGS } from "./strings.ts";

export function ChallengeChipView({ chip }: { chip: ChallengeChip }) {
  const reach = chip.reach;
  const ink = reach ? MEDAL_LOOK[reach.medal].ink : undefined;
  return (
    <div class="hud-chip hud-challenge" style={ink ? { "--medal-ink": ink } : undefined}>
      <span class="hud-challenge-time">{formatTime(chip.elapsed)}</span>
      <span class="hud-chip-sub hud-challenge-reach">
        <MedalMark medal={reach?.medal ?? null} className="hud-challenge-medal" />
        {STRINGS.challengeChipFor(reach?.medal ?? null)}
        {reach && <span class="hud-challenge-target">{formatTime(reach.time)}</span>}
      </span>
      <span class="hud-challenge-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(chip.share * 100)}%` }} />
      </span>
      <span class="hud-chip-sub">
        {STRINGS.challengeChipLabel} · {chip.run}
      </span>
    </div>
  );
}

export function ChallengePlateView({ plate }: { plate: ChallengePlate }) {
  const medal = plate.medal;
  const ink = medal ? MEDAL_LOOK[medal].ink : undefined;
  const value = plate.kind === "line" ? formatTime(plate.value) : plate.what;
  const note =
    plate.filed === "medal" || plate.filed === "value" || (plate.filed === "new" && medal)
      ? STRINGS.challengePlateNew
      : plate.gap !== null
        ? STRINGS.challengePlateGap(plate.gap)
        : null;
  return (
    <div
      class="hud-challenge-plate"
      role="status"
      key={`${plate.id}-${plate.t}`}
      style={ink ? { "--medal-ink": ink } : undefined}
    >
      <MedalMark medal={medal} className="hud-challenge-plate-medal" />
      <div class="hud-challenge-plate-text">
        <span class="hud-challenge-plate-medal-name">
          {medal ? STRINGS.medalNames[medal] : STRINGS.challengePlateNone}
        </span>
        <span class="hud-challenge-plate-name">{plate.name}</span>
        {value && <span class="hud-challenge-plate-value">{value}</span>}
        {note && <span class="hud-challenge-plate-note">{note}</span>}
      </div>
    </div>
  );
}
