// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S BUILDING VIEWS, together: the lift stations'
// (`station-view.ts`), the start's and the finish arena's
// (`race-buildings-view.ts`), the wind tunnels' (`tunnel-view.ts`) and the
// lifts' hardware (`lift-view.ts`), one spread for the harness.

import type { GameState, Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { liftShots } from "./lift-view.ts";
import { raceBuildingShots } from "./race-buildings-view.ts";
import { stationShots } from "./station-view.ts";
import { tunnelShots } from "./tunnel-view.ts";

type Lab = {
  level: Level;
  state?: GameState;
  still(): void;
  setOverride(p: LensPose | null): void;
  canvas: HTMLCanvasElement;
};

/** Every building view, keyed by name. */
export function buildingShots(lab: Lab): Record<string, () => string> {
  return {
    ...stationShots(lab),
    ...raceBuildingShots(lab),
    ...tunnelShots(lab),
    ...liftShots(lab),
  };
}
