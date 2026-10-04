// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S READOUT (`heli.ts`) — top centre, where the air clock
// stands on the snow (the two are never up together: sat on the skid he is
// not in the air on his skis). While he rides it: how high its skids are
// over the snow — the fall a jump off them is, the number the whole game of
// it is played against — its climb, and how to jump; and while it waits on
// its pad near him, the word that it is there and how far. Every figure is
// the snapshot's (`heliOf`).

import type { HudHeli } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

export function HeliReadout({ heli, touch }: { heli: HudHeli; touch: boolean }) {
  if (heli.kind === "waiting") {
    return (
      <div class="hud-heli hud-heli-call" role="status">
        <span class="hud-heli-word">{STRINGS.heliCall}</span>
        <span class="hud-heli-sub">{STRINGS.heliPad(heli.pad)}</span>
      </div>
    );
  }
  return (
    <div class="hud-heli" role="status">
      <span class="hud-chip-sub">{STRINGS.heliHeight}</span>
      <span class="hud-heli-num">{STRINGS.heliMetres(heli.height)}</span>
      <span class="hud-heli-sub">{STRINGS.heliClimb(heli.climb)}</span>
      <span class="hud-heli-hint">
        {heli.landed ? STRINGS.heliLanded : STRINGS.heliJump(touch)}
      </span>
    </div>
  );
}
