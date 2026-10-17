// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// QUICK START'S NEXT RIDE, dealt BEFORE it is pressed, so its mountain is
// raised on a worker behind the front door (`use-ahead.ts`) and the press
// finds it built rather than raising it under the loading card.
//
// It is dealt off a salt of its own (`quickRide` off `createRng`), so the
// ride ordered ahead and the ride pressed are the same ride: only its draws
// are the salt's — the rider, the pair and the help are the cards' as they
// stand at the press. Dealt anew once it is ridden.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { useState } from "preact/hooks";
import type { CreateGameOptions } from "@engine";

import { freeGameOptions, quickRide, type FreeRide } from "./free-ride.ts";

const newSalt = (): number => Math.floor(Math.random() * 2 ** 32);

export function useQuickRide(base: FreeRide): {
  /** The ride QUICK START will stand up. */
  next: () => FreeRide;
  /** …as the options its run is stood up with, for the skier given. */
  options: (skier: Parameters<typeof freeGameOptions>[2]) => CreateGameOptions;
  /** Changes each time a new ride is dealt. */
  dealt: number;
  /** The ride was pressed: deal the next. */
  ridden: () => void;
} {
  const [salt, setSalt] = useState(newSalt);
  const next = (): FreeRide => quickRide(base, createRng(salt).next);
  return {
    next,
    options: (skier) => {
      const ride = next();
      return freeGameOptions(ride, ride.seed ?? 1, skier);
    },
    dealt: salt,
    ridden: () => setSalt(newSalt()),
  };
}
