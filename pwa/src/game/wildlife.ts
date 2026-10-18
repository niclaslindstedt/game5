// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WILDLIFE, as the renderer holds it: the birds (`birds.ts`), the
// animals on the snow (`beasts.ts`) and — on a free ride he was dealt to,
// the one creature the ENGINE moves — the grimbear (`grimbear-view.ts`),
// behind one door, so `renderer.ts` builds
// one thing with the map, moves it once a frame and wipes it with a run.
//
// Presentation, end to end. Everything here reads `GameState` and the
// `Level` and writes neither; the plans are dealt off the map's seed on
// generators of their own (`bird-roost.ts`, `beast-plan.ts`), so no digest
// the suite holds — a pinned map's, a run's — can see a single bird.

import * as THREE from "three";
import type { GameState, Level } from "@engine";

import { createBeastGore, type BeastGore } from "./beast-gore.ts";
import { createBeasts, type Beasts, type PrintSnow, type TrailWindow } from "./beasts.ts";
import { createBirds, type Birds } from "./birds.ts";
import { createGrimbearView } from "./grimbear-view.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { WildLook } from "./settings-video.ts";
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
  /** Build what comes out of an animal run down now, with the world, so
   * its programs are compiled behind the loading card. */
  armGore: () => void;
  /** The FOREST row moved (`FOREST_LOOK[row].wild`). */
  setLook: (look: WildLook) => void;
  birds: Birds;
  beasts: Beasts;
  dispose: () => void;
};

export function createWildlife(
  level: Level,
  haze: HazeUniforms,
  look: WildLook,
  snow?: PrintSnow,
): Wildlife {
  const birds = createBirds(level, haze, look);
  const beasts = createBeasts(level, haze, look, snow);
  const grimbear = createGrimbearView(level, haze);
  const group = new THREE.Group();
  group.name = "wildlife";
  group.add(birds.group, beasts.group, grimbear.group);
  // What comes out of an animal run down (`beast-gore.ts`): built with the
  // world when the run it is built for carries the animals as bodies with
  // its injuries on (`armGore`), so its programs are compiled behind the
  // loading card — or else on the first such run.
  let beastGore: BeastGore | null = null;
  const addGore = (): BeastGore => {
    const made = createBeastGore(level, (m, name) => hazeMaterial(m, haze, name));
    group.add(made.group);
    return made;
  };
  return {
    group,
    update(state, eyeX, eyeZ, stamps, window) {
      birds.update(state, eyeX, eyeZ);
      beasts.update(state, eyeX, eyeZ, stamps, window);
      grimbear.update(state);
      if (!beastGore && state.wild && state.gore) beastGore = addGore();
      beastGore?.update(state);
    },
    armGore() {
      beastGore ??= addGore();
    },
    retrack: () => beasts.retrack(),
    reset() {
      birds.reset();
      beasts.reset();
      beastGore?.clear();
    },
    setLook(look) {
      birds.setLook(look);
      beasts.setLook(look);
    },
    birds,
    beasts,
    dispose() {
      birds.dispose();
      beasts.dispose();
      grimbear.dispose();
      beastGore?.dispose();
    },
  };
}
