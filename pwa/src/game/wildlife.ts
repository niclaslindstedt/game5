// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WILDLIFE, as the renderer holds it: the birds (`birds.ts`) and the
// animals on the snow (`beasts.ts`) behind one door, so `renderer.ts` builds
// one thing with the map, moves it once a frame and wipes it with a run.
//
// Presentation, end to end. Everything here reads `GameState` and the
// `Level` and writes neither; the plans are dealt off the map's seed on
// generators of their own (`bird-roost.ts`, `beast-plan.ts`), so no digest
// the suite holds — a pinned map's, a run's — can see a single bird.

import * as THREE from "three";
import type { GameState, Level } from "@engine";

import { createBeasts, type Beasts, type PrintSnow, type TrailWindow } from "./beasts.ts";
import { createBirds, type Birds } from "./birds.ts";
import type { HazeUniforms } from "./haze.ts";
import type { Stamp } from "./trail-stamp.ts";

export type Wildlife = {
  group: THREE.Group;
  /** Once a frame, with the lens at (`eyeX`, `eyeZ`): the flushes and the
   * frights, every pose, and the prints owed pushed onto `stamps` (null
   * with the trails off). */
  update: (
    state: GameState,
    eyeX: number,
    eyeZ: number,
    stamps: Stamp[] | null,
    window: TrailWindow | null,
  ) => void;
  /** The trail maps were rebuilt: lay the prints again. */
  retrack: () => void;
  /** A new run on the same map. */
  reset: () => void;
  birds: Birds;
  beasts: Beasts;
  dispose: () => void;
};

export function createWildlife(level: Level, haze: HazeUniforms, snow?: PrintSnow): Wildlife {
  const birds = createBirds(level, haze);
  const beasts = createBeasts(level, haze, snow);
  const group = new THREE.Group();
  group.add(birds.group, beasts.group);
  return {
    group,
    update(state, eyeX, eyeZ, stamps, window) {
      birds.update(state, eyeX, eyeZ);
      beasts.update(state, eyeX, eyeZ, stamps, window);
    },
    retrack: () => beasts.retrack(),
    reset() {
      birds.reset();
      beasts.reset();
    },
    birds,
    beasts,
    dispose() {
      birds.dispose();
      beasts.dispose();
    },
  };
}
