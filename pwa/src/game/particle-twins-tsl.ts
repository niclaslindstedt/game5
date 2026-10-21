// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARTICLES' NODE TWINS (`docs/webgpu.md`, part 9), in the `particles`
// family of the register: what `sky-twins-tsl.ts` hands for a flag it does
// not know itself.
//
//   spray, spray-gpu   the spray, the CPU pool's and the GPU ring's
//                      (`spray.ts`, `gpu-spray.ts` → `spray-tsl.ts`)
//   snowfall           the fall's flakes (`snowfall.ts` → `snowfall-tsl.ts`)
//   snow-cloud         the cloud's puffs (`snow-cloud.ts` → `snow-cloud-tsl.ts`)
//   cloud-shadow       its shadow on the slope (`snow-cloud-shadow.ts`)
//   billboards         a batch of fire, smoke and glows (`billboards.ts` →
//                      `billboards-tsl.ts`)
//   plume              the snow guns' plumes (`snow-gun-plume.ts` → `plume-tsl.ts`)
//
// The points WebGL draws with `gl_PointSize` (the spindrift, the sparks'
// heads) have no twin: they are drawn by stand-ins (`glow-tsl.ts`'s
// stands, `pointStand`), a quad a point.

import type * as THREE from "three";
import type { NodeMaterial } from "three/webgpu";

import { billboardTwin } from "./billboards-tsl.ts";
import type { HazeUniforms } from "./haze.ts";
import type { HazeFogOptions } from "./haze-tsl.ts";
import { plumeTwin } from "./plume-tsl.ts";
import { cloudTwin, shadowTwin } from "./snow-cloud-tsl.ts";
import { driftStand, fallTwin } from "./snowfall-tsl.ts";
import { sprayTwin } from "./spray-tsl.ts";

/** The twin for flag `kind` over `m`, or null for one not a particle's. */
export function particleTwin(
  m: THREE.ShaderMaterial,
  kind: string,
  haze: HazeUniforms,
  how: HazeFogOptions,
): NodeMaterial | null {
  switch (kind) {
    case "spray":
      return sprayTwin(m, haze, how, false);
    case "spray-gpu":
      return sprayTwin(m, haze, how, true);
    case "snowfall":
      return fallTwin(m, haze);
    case "snow-cloud":
      return cloudTwin(m, haze, how);
    case "cloud-shadow":
      return shadowTwin(m, haze);
    case "billboards":
      return billboardTwin(m);
    case "plume":
      return plumeTwin(m, haze);
    default:
      return null;
  }
}

/** The stand-in's material for points flagged `userData.sprite` with a
 * kind of their own, or null (`glow-tsl.ts` draws the plain ones). */
export function pointStand(points: THREE.Points, haze: HazeUniforms): NodeMaterial | null {
  const kind: unknown = (points.material as THREE.Material).userData.sprite;
  return kind === "spindrift" ? driftStand(points, haze) : null;
}
