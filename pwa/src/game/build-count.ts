// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE LOADING CARD IS TOLD OF A WORLD BEING BUILT.
//
// `renderer.ts`'s `load` is one asynchronous build; this is its running
// account of itself — the stage it has reached (`BuildStage`) and its forest,
// planted a slice at a time with a FRAME let through between slices, so the
// card (`app-load.ts`, `loading-screen.tsx`) paints the count as it climbs.

import type { Level } from "@engine";

import { plantForest, type Planting } from "./forest.ts";
import type { BuildStage } from "./renderer-api.ts";

/** How long a slice of the planting may hold the thread, ms. */
const PLANT_MS = 12;

/** Resolves once the browser has drawn a frame — a bare timeout may run the
 * next slice before it draws — or after a moment, on a hidden page that
 * draws none. */
export function afterFrame(): Promise<void> {
  return new Promise((done) => {
    const late = setTimeout(done, 50);
    requestAnimationFrame(() => {
      clearTimeout(late);
      setTimeout(done, 0);
    });
  });
}

export type BuildCount = {
  /** The build has reached `stage`; `snow` starts a new build's count. */
  at: (stage: BuildStage) => void;
  /** Plant `level`'s forest a slice a frame, `rest` after each (false once
   * the build is superseded, and then null). */
  sow: (level: Level, rest: () => Promise<boolean>) => Promise<Planting | null>;
  /** A frame, then `rest`: the card shown the stage just reached. */
  shown: (rest: () => Promise<boolean>) => Promise<boolean>;
  /** What `WorldRenderer.building` answers. */
  read: () => { stage: BuildStage; planted: number; trees: number } | null;
};

export function createBuildCount(): BuildCount {
  let stage: BuildStage | null = null;
  let sowing: Planting | null = null;
  const shown = (rest: () => Promise<boolean>): Promise<boolean> => afterFrame().then(rest);
  return {
    at: (next) => {
      stage = next;
      if (next === "snow") sowing = null;
    },
    sow: async (level, rest) => {
      const plot = (sowing = plantForest(level));
      for (;;) {
        const until = performance.now() + PLANT_MS;
        if (!plot.step(() => performance.now() < until)) return plot;
        if (!(await shown(rest))) return null;
      }
    },
    shown,
    read: () =>
      stage === null ? null : { stage, planted: sowing?.planted() ?? 0, trees: sowing?.count ?? 0 },
  };
}
