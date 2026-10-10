// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAUSE CARD'S PISTE MAP — another run on THIS mountain, picked without
// leaving the ride for the front door. A free ride paused opens it from the
// card's foot: the start card's own RUN row and chart (`run-pick.ts`), on the
// map the ride is skied on, and GO stands the ride up again there — by the
// lift up to the run's head (ANY run of the mountain, whatever its colour),
// at a spot pressed on the chart, or on a machine off the START row.
//
// ONLY THE RUN AND THE START ARE ASKED. The mountain, its country and its grade are the
// ride's own (a different one is a different map, and that is the start
// card's question), and the day and the snow stay as they were: the ride goes
// on, somewhere else on the hill. What the panel picks is written to
// `settings.ride` like the start card's rows, so START AGAIN and the start
// card both remember it.
//
// It is a panel of the pause card, as OPTIONS is: its head's ‹ goes back to
// the card, and the backdrop does the same. GO stands in the head opposite
// it, where the start card keeps its way on, so the chart never pushes it
// below the fold of a phone on its side.

import { useState } from "preact/hooks";

import { rideOnto, runPicked, startPicked, type FreeRide } from "./free-ride.ts";
import { Caption, MenuBody, MenuHead, StepRow, type Hint } from "./menu-knobs.tsx";
import { useRunPick } from "./run-pick.ts";
import { SeedPreview } from "./seed-preview.tsx";
import type { Settings } from "./settings.ts";
import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

export function PauseSlopes({
  snap,
  settings,
  onSettings,
  onRide,
  onBack,
}: {
  snap: HudSnapshot;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  /** Stand the ride up again on this ride's answers. */
  onRide: (ride: FreeRide) => void;
  onBack: () => void;
}) {
  const [hint, setHint] = useState<Hint | null>(null);
  const seed = snap.seed;
  // The ride the panel starts from: the stored one, moved onto the map and
  // country the paused ride is skied on (a link may have named either).
  const ride = rideOnto(settings.ride, seed, snap.region, snap.face);
  const here: Settings = ride === settings.ride ? settings : { ...settings, ride };
  const setRide = (patch: Partial<FreeRide>): void =>
    onSettings({ ...here, ride: { ...ride, ...patch } });
  const pick = useRunPick(here, seed);
  return (
    <div
      class="menu-card menu-card-pause menu-card-pause-slopes"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerLeave={() => setHint(null)}
      role="presentation"
    >
      <MenuHead
        back={onBack}
        backLabel={STRINGS.pauseBack}
        title={STRINGS.pauseSlopes}
        action={
          <button
            type="button"
            class="menu-item menu-item-start menu-head-go"
            data-menu="ride"
            data-nav-next
            data-nav-focus
            disabled={pick.start === ""}
            onClick={() => {
              if (ride !== settings.ride) onSettings(here);
              onRide(ride);
            }}
          >
            <span class="menu-item-name">{STRINGS.pauseSlopesRide}</span>
          </button>
        }
      />
      <MenuBody class="pause-slopes">
        <SeedPreview
          chart={pick.chart}
          entry={pick.marked}
          machine={pick.machine}
          spot={pick.spot}
          onSpot={(at) => setRide({ spot: { seed, x: at.x, z: at.z } })}
        />
        <div class="pause-slopes-rows">
          <div class="knob-rows">
            <StepRow
              label={STRINGS.startStart}
              hint={STRINGS.pauseSlopesStartHint}
              stops={pick.starts}
              value={pick.start}
              extra={STRINGS.startRunWaiting}
              onPick={(id) => setRide(startPicked(ride, seed, id))}
              onHint={setHint}
            />
            <StepRow
              label={STRINGS.startRun}
              hint={STRINGS.pauseSlopesRunHint}
              stops={pick.stops}
              value={pick.value}
              extra={pick.machine ? STRINGS.startRunOff : STRINGS.startRunWaiting}
              onPick={(id) => setRide(runPicked(ride, seed, id))}
              onHint={setHint}
            />
          </div>
          <div class="start-actions">
            <button
              type="button"
              class="menu-chip"
              data-menu="grid"
              disabled={pick.spot === null}
              onClick={() => setRide({ spot: null })}
            >
              <span class="menu-tile-name">{STRINGS.startGrid}</span>
            </button>
          </div>
        </div>
      </MenuBody>
      <Caption hint={hint} fallback={STRINGS.pauseSlopesCaption} />
    </div>
  );
}
