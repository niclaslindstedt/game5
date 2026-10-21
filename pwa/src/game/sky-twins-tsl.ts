// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NODE TWINS (`docs/webgpu.md`, parts 3 to 5): the node materials the webgpu
// paths draw in place of a ShaderMaterial flagged with one (`nodeTwin` in
// `gpu-backend.ts`). The renderer's library asks here first whenever it
// builds a pipeline for a material (`gpu-dress.ts`), and a twin is made
// once a material, over that material's own uniforms — so the code that
// makes and drives the ShaderMaterial drives both back ends, and WebGL
// never knows a twin exists.
//
//   dome     the sky dome (`sky-dome.ts` → `sky-dome-tsl.ts`)
//   far      the far ranges' rings and disc (`far-ranges.ts` → `far-ranges-tsl.ts`)
//   trans, ms, view, froxel
//            the GPU sky's passes (`sky-gpu.ts` → `sky-atmo-tsl.ts`)
//   ground   the clipmap's every level, plain and cutting, and the
//            deformable snow's mesh (`terrain.ts` → `terrain-tsl.ts`, part 4)
//   trail-stamp, trail-groom, trail-copy, trail-fill
//            the trail maps' passes (`trail-map.ts` → `trail-map-tsl.ts`, part 5)
//   deform-shade
//            the deformable snow's shade, a cell at a time (`deform-shade.ts`
//            → `trail-map-tsl.ts`, part 5)
//   spray, spray-gpu, snowfall, snow-cloud, cloud-shadow, billboards, plume
//            the particles and the air (`particle-twins-tsl.ts`, part 9)
//   cloud-map, cloud-slab
//            the clouds' shadow map and MEDIUM's slab (`clouds.ts` →
//            `cloud-pass-tsl.ts`, part 10)
//   cloud-march, cloud-carry
//            HIGH's volume, its marches and its carry (`cloud-volume.ts` →
//            `cloud-volume-tsl.ts`, part 10)
//   crowd, civilians, dogs, traffic, fans, bird, beast, gore-tree
//            the figures, each a classic material's copy with its graft's
//            vertex (`figure-twins-tsl.ts`, part 11)

import type * as THREE from "three";
import type { NodeMaterial } from "three/webgpu";

import { shadowPassTwin, slabTwin } from "./cloud-pass-tsl.ts";
import { carryTwin, marchTwin } from "./cloud-volume-tsl.ts";
import { farTwin } from "./far-ranges-tsl.ts";
import { figureTwinOf } from "./figure-twins-tsl.ts";
import { copyTwin, deformShadeTwin, fillTwin, groomTwin, stampTwin } from "./trail-map-tsl.ts";
import type { HazeUniforms } from "./haze.ts";
import type { HazeFogOptions } from "./haze-tsl.ts";
import { froxelTwin, msTwin, transTwin, viewTwin } from "./sky-atmo-tsl.ts";
import { groundSpecs } from "./terrain.ts";
import { groundTwin } from "./terrain-tsl.ts";
import { particleTwin } from "./particle-twins-tsl.ts";
import { domeTwin } from "./sky-dome-tsl.ts";

/** The twins a dressing makes (`twinOf`). */
export type Twins = {
  /** The twin `material` is drawn with here, or null for one with none. */
  of(material: THREE.Material): NodeMaterial | null;
};

export function createTwins(haze: HazeUniforms, how: HazeFogOptions): Twins {
  const made = new WeakMap<THREE.Material, NodeMaterial>();
  const make = (m: THREE.ShaderMaterial, kind: string): NodeMaterial | null => {
    switch (kind) {
      case "dome":
        return domeTwin(m, haze);
      case "far":
        return farTwin(m, haze, how);
      case "trans":
        return transTwin();
      case "ms":
        return msTwin(m.uniforms);
      case "view":
        return viewTwin(m.uniforms, Number(m.defines.STEPS));
      case "froxel":
        return froxelTwin(m.uniforms);
      case "ground":
        return groundTwin(m, groundSpecs.get(m), how);
      case "trail-stamp":
        return stampTwin(m);
      case "trail-groom":
        return groomTwin(m);
      case "trail-copy":
        return copyTwin(m);
      case "trail-fill":
        return fillTwin(m);
      case "deform-shade":
        return deformShadeTwin(m);
      case "cloud-map":
        return shadowPassTwin(m);
      case "cloud-slab":
        return slabTwin(m, haze);
      case "cloud-march":
        return marchTwin(m, haze);
      case "cloud-carry":
        return carryTwin(m);
      default:
        return figureTwinOf(m, kind, haze) ?? particleTwin(m, kind, haze, how);
    }
  };
  return {
    of(material) {
      const kind: unknown = material.userData.twin;
      if (typeof kind !== "string") return null;
      let twin = made.get(material);
      if (!twin) {
        const built = make(material as THREE.ShaderMaterial, kind);
        if (!built) return null;
        made.set(material, (twin = built));
      }
      return twin;
    },
  };
}
