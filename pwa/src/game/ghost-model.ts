// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GHOST AS DRAWN: the recording's skier on his skis (`ghost-run.ts`),
// built by the very builder every pair on the start line is (`skis-body.ts`)
// off the recording's own spec, in a pale topsheet and SEE-THROUGH — every material
// the builder asks for is handed back translucent — casting no shadow, and
// leaving NO TRAIL: the renderer stamps the trail map from the runs it is
// racing and never from this one, since a picture of a run that already
// happened may not mark the snow of the one being ridden. It throws no
// spray for the same reason.
//
// Posed between two steps the way every skier is (`interp.ts`), off the
// ghost's own `GameState`, which the rig steps beside the player's.

import * as THREE from "three";
import type { GameState, SkiSpec } from "@engine";

import { createTrack, observe, sample, type Pose, type PoseTrack } from "./interp.ts";
import { DEFAULT_OUTFIT } from "./outfit.ts";
import { createSkisModel, type SkisModel, type SkiStyle } from "./skis-body.ts";

/** How much of the ghost is drawn: enough to read at chase range, little
 * enough that it never reads as a rival. */
export const GHOST_OPACITY = 0.38;

/** Pale skis and a pale skier: a ghost is a shape, not a topsheet or a
 * kit — the default kit's cut, every colour washed out. */
const GHOST_STYLE: SkiStyle = {
  body: 0xcfe6ff,
  accent: 0xffffff,
  skier: { outfit: DEFAULT_OUTFIT, ghost: true },
};

export type GhostModel = {
  /** Draw `run` at `alpha` of a step on — or nothing, for null. */
  draw(run: GameState | null, alpha: number): void;
  dispose(): void;
};

export function createGhostModel(
  scene: THREE.Scene,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
): GhostModel {
  let model: SkisModel | null = null;
  let spec: SkiSpec | null = null;
  let shown: GameState | null = null;
  let track: PoseTrack = createTrack();
  const drawn: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };

  const see = <M extends THREE.Material>(m: M, name: string): M => {
    m.transparent = true;
    m.opacity *= GHOST_OPACITY;
    return wrap(m, `ghost-${name}`);
  };

  const drop = (): void => {
    if (!model) return;
    scene.remove(model.root);
    model.dispose();
    model = null;
    spec = null;
  };

  return {
    draw(run, alpha) {
      if (!run) {
        if (model) model.root.visible = false;
        shown = null;
        return;
      }
      if (spec !== run.skier.spec) {
        drop();
        spec = run.skier.spec;
        model = createSkisModel(spec, GHOST_STYLE, see);
        model.root.name = "ghost";
        model.root.traverse((o) => {
          o.castShadow = false;
          o.receiveShadow = false;
        });
        scene.add(model.root);
      }
      if (run !== shown || run.tick === 0) track = createTrack();
      shown = run;
      const m = model!;
      m.root.visible = true;
      observe(track, run.skier, run.tick);
      sample(track, alpha, drawn);
      m.setRun(run);
      m.pose(run.skier, drawn, 0, null, 1 / 60);
    },
    dispose: drop,
  };
}
