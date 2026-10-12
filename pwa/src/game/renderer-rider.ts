// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE WORLD RENDERER KEEPS PER SKIER (`renderer.ts`): a rider's model
// and the memories its drawing runs on, the runs a frame draws, and the GPU
// timer's slice for each named group of the scene.

import type { GameState, Level, SkiSpec, SkierState } from "@engine";

import type { GpuSlice, Hideable } from "./benchmark-report.ts";
import type { BodyTrack, Pose, PoseTrack } from "./interp.ts";
import type { SkisModel } from "./skis-body.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import type { SnowProps } from "./snowpack.ts";
import type { Spray } from "./spray.ts";
import { bodyStampOf, type SnowSampler, type Stamp, type TrailPen } from "./trail-stamp.ts";

export type Rider = {
  model: SkisModel;
  /** The pair the model was built off: a run on another one is a new
   * model, even on the same map and in the same slot. */
  spec: SkiSpec;
  /** The outfit the skier was dressed in (`outfitKey`). */
  kit: string;
  track: PoseTrack;
  pen: TrailPen;
  drawn: Pose;
  /** The drawn furrow's depth past the physics' own, smoothed, m. */
  sink: number;
  wasAirborne: boolean;
  vy: number;
  airTime: number;
  /** The skier thrown (`thrownEffects`): whether he was off at the last
   * frame, whether his body was on the snow, the seconds of slide since the
   * last plume, and the pen his gouge is drawn with. */
  wasThrown: boolean;
  bodyDown: boolean;
  plume: number;
  bodyPen: TrailPen;
  /** The thrown body between two steps (`interp.ts`). */
  body: BodyTrack;
};

/** The GPU timer's slice for each named group the scene is built of
 * (`gpu-timer.ts`); anything under none of them is the scene's own. */
export const SLICE_OF_GROUP: Readonly<Record<string, GpuSlice & Hideable>> = {
  sky: "sky",
  terrain: "terrain",
  water: "water",
  forest: "forest",
  field: "field",
  ghost: "field",
  checkpoints: "checkpoints",
  "snow-cloud": "cloud",
  spray: "spray",
  snowfall: "snowfall",
  wildlife: "wildlife",
  crowd: "field",
};

/** The runs a frame draws: the player's first, then the field's. */
export function runsOf(state: GameState): GameState[] {
  return [state, ...state.rivals.map((r) => r.run)];
}

/** THE WIPEOUT, as it reads in the snow (`crash.ts`): the burst the
 * moment he leaves his skis, a puff every time his body comes down on
 * the snow and a plume while it slides, and the gouge it leaves
 * (`bodyStampOf`, into `stamps` — none with the trails off). Presentation
 * only: every figure is the engine's. */
export function thrownEffects(
  r: Rider,
  skier: SkierState,
  simDt: number,
  fx: {
    level: Level;
    spray: Spray;
    cloud: SnowCloud;
    /** The snow where he is. */
    snow: SnowProps;
    stamps: Stamp[] | null;
    sampleSnow: SnowSampler;
  },
): void {
  const off = skier.thrown;
  if (!off) {
    r.wasThrown = false;
    r.bodyPen.down[0] = 0;
    return;
  }
  const puff = (y: number, size: number) => {
    fx.spray.burst(off.x, off.y - y, off.z, off.vx, off.vz, size, fx.snow);
    fx.cloud.burst(off.x, off.y - y, off.z, off.vx, off.vz, size, fx.snow);
  };
  if (!r.wasThrown) puff(0.4, 1);
  const sliding = Math.hypot(off.vx, off.vz);
  if (off.touching && !r.bodyDown && sliding > 2) puff(0.3, Math.min(0.6, sliding / 20));
  r.plume = off.touching && sliding > 3 ? r.plume + simDt : 0;
  if (r.plume > 0.15) {
    r.plume = 0;
    puff(0.3, 0.02);
  }
  r.bodyDown = off.touching;
  r.wasThrown = true;
  if (fx.stamps)
    bodyStampOf(off, r.bodyPen, fx.level.packedAt, fx.stamps, fx.sampleSnow, fx.level.groundAt);
}
