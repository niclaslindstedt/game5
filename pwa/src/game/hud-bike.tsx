// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S STRIP (`bike.ts`) — top centre, in the air clock's
// place: the speed and the height are the HUD's own already, so all a rider
// reads more is THE TRAIL — its grade's mark and the name on its sign, how
// far is left of it, and his falls this ride. Off it on foot, the word that
// it is there and how far — and stood beside it, the press that puts him
// back on. Every figure is the snapshot's (`bike-hud.ts`).

import type { HudBike } from "./bike-hud.ts";
import { GradeMark } from "./grade-mark.tsx";
import { MachinePress } from "./hud-machine-press.tsx";
import { STRINGS } from "./strings.ts";

export function BikeReadout({
  bike,
  touch,
  machineKey,
  onBoard,
}: {
  bike: HudBike;
  touch: boolean;
  machineKey: string;
  onBoard: () => void;
}) {
  if (bike.kind === "waiting") {
    if (bike.near)
      return (
        <MachinePress
          word={STRINGS.bikeCall}
          sub={STRINGS.bikeTake(touch, machineKey)}
          kind="bike"
          onBoard={onBoard}
        />
      );
    return (
      <div class="hud-bike hud-bike-call" role="status">
        <span class="hud-bike-word">{STRINGS.bikeCall}</span>
        <span class="hud-bike-sub">{STRINGS.bikeAway(bike.away)}</span>
      </div>
    );
  }
  const left = bike.toGo !== null ? STRINGS.bikeToGo(bike.toGo) : null;
  const fell = bike.falls > 0 ? STRINGS.bikeFalls(bike.falls) : null;
  return (
    <div class="hud-bike" role="status">
      {bike.trail && (
        <span class="hud-bike-trail">
          {bike.grade && <GradeMark grade={bike.grade} className="hud-bike-grade" />}
          <span class="hud-bike-word">{bike.trail}</span>
        </span>
      )}
      {(left || fell) && (
        <span class="hud-bike-sub">{[left, fell].filter((s) => s !== null).join(" · ")}</span>
      )}
    </div>
  );
}
