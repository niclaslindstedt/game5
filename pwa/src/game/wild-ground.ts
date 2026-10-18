// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COUNTRY AS THE DRAWING ASKS ABOUT IT — the engine's `wildGround` (the
// trunks, the loop and the runs, the slope, the map's edge), and where the
// DRAWN snow's surface stands over it: the ground plus the loose cover the
// shader lifts off the groomer (`LOOSE`), which is what a drawn animal
// stands in. Cached against the level.

import { wildGround as engineGround, type Level, type WildGround as Ground } from "@engine";

import { LOOSE } from "./trail-stamp.ts";

export type WildGround = Ground & {
  /** Where the drawn snow stands, m. */
  snowY(x: number, z: number): number;
};

const cache = new WeakMap<Level, WildGround>();

export function wildGround(level: Level): WildGround {
  const hit = cache.get(level);
  if (hit) return hit;
  const ground: WildGround = {
    ...engineGround(level),
    snowY: (x, z) => level.groundAt(x, z) + LOOSE * (1 - level.packedAt(x, z)),
  };
  cache.set(level, ground);
  return ground;
}
