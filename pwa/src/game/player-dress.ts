// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE PLAYER WEARS on a run: his own outfit (the modelled kit where his
// body is the modelled one), a wingsuit's, or a freerider's on the freeride
// bike (`bike-variant.ts`). The renderer asks it; presentation only.

import type { GameState } from "@engine";
import { bikeLook } from "./bike-variant.ts";
import { rideKit, type Outfit } from "./outfit.ts";
import type { SkierDress } from "./skier-dress.ts";
import { suitOf } from "./wingsuit-look.ts";

export type PlayerKit = "own" | "suit" | "bike";

/** The kit a run dresses the player in. */
export function playerKitOf(state: GameState): PlayerKit {
  if (state.wingsuit) return "suit";
  return state.bike && bikeLook() === "freeride" ? "bike" : "own";
}

/** The player's dress in that kit. */
export function playerDress(kit: PlayerKit, outfit: Outfit): SkierDress {
  if (kit === "suit") return { outfit, suit: suitOf(outfit) };
  return kit === "bike" ? { outfit: rideKit(outfit) } : { outfit, model: true };
}
