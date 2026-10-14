// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE CARD — the gear card of a SUMMER free ride begun on the downhill
// bike (`free-ride.ts`'s `bikeOn`). There is no snow to ski or ride a board
// on, so there is no rack of pairs and no SKIS / SNOWBOARD switch: the bike
// stands on the trail behind the card with him on it (`gear-stage.ts`), and
// beside it the figures that say what it is — off the engine's own `BIKE`,
// never restated. Its way back is the rider card; its press rides.

import { BIKE } from "@engine";

import { useBusyPress } from "./busy-press.ts";
import { MenuBody, MenuHead } from "./menu-knobs.tsx";
import { Figure } from "./menu-skis.tsx";
import type { SkisFact } from "./ski-stats.ts";
import { STRINGS } from "./strings.ts";

const F = STRINGS.bikeFacts;

/** The bike's figures, each off the engine's numbers. */
export function bikeFacts(): SkisFact[] {
  return [
    { key: "travel", label: F.travel, value: BIKE.rearEnd.travel * 1000, places: 0, unit: "MM" },
    { key: "head", label: F.head, value: BIKE.headAngle, places: 1, unit: "°", tight: true },
    {
      key: "wheelbase",
      label: F.wheelbase,
      value: (BIKE.frontAxle.z - BIKE.rearAxle.z) * 100,
      places: 0,
      unit: "CM",
    },
    { key: "weight", label: F.weight, value: BIKE.mass, places: 0, unit: "KG" },
  ];
}

export function BikePage({ onBack, onRide }: { onBack: () => void; onRide: () => void }) {
  const [busy, ride] = useBusyPress(onRide);
  return (
    <div class="menu-card menu-card-skis menu-card-staged">
      <div class="stage-top" data-stage-cover>
        <MenuHead
          back={onBack}
          backLabel={STRINGS.menuBack}
          title={STRINGS.bikeTitle}
          action={
            <button
              type="button"
              class="menu-item menu-item-start menu-head-go skis-done"
              data-menu="ride"
              data-nav-next
              data-nav-focus
              data-busy={busy ? "1" : undefined}
              aria-busy={busy}
              onClick={ride}
            >
              <span class="menu-item-name">{STRINGS.bikeRide}</span>
              {busy && <span class="menu-busy" aria-hidden="true" />}
            </button>
          }
        />
      </div>
      <div class="stage-sheet" data-stage-cover>
        <MenuBody>
          <div class="skis-pick skis-pick-one">
            <div class="skis-pick-id">
              <span class="skis-pick-name">{STRINGS.bikeName}</span>
            </div>
          </div>
          <div class="skis-spec">
            <div class="skis-figures bike-figures">
              {bikeFacts().map((fact) => (
                <Figure key={fact.key} fact={fact} />
              ))}
            </div>
          </div>
        </MenuBody>
      </div>
    </div>
  );
}
