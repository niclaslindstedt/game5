// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW'S OWN A/B PARTS (`?ab=1`, `benchmark-report.ts`'s `HIDEABLE`):
// the terrain's pixel is most of a phone's frame, so the benchmark can draw
// a frame with one of the snow shader's costly parts left out, to bill each
// on the device's own card. Each is a branch on one uniform the whole frame
// shares, so it costs nothing when nothing is skipped and needs no second
// program.
//
//   snow-bumps    the swells' and grooves' shadows marched toward the sun
//                 (`snow-sky-glsl.ts`'s `snowBumpLit`)
//   snow-relief   the micro-relief bent into the normal: swells, grain, the
//                 day's piste, sastrugi, the wind's ripples, the corduroy
//                 and the berm's clods (`snow-relief-glsl.ts`)
//   snow-glitter  the crystals and the forward glare (`snow-sun-glsl.ts`)
//   snow-furrows  the trail map's walls read per pixel and the trench's
//                 ring (`snow-trail-glsl.ts`)

import * as THREE from "three";

import { SNOW_PARTS, type Hideable } from "./benchmark-report.ts";

/** 1 where the part is left out this frame. Shared by every ground material. */
export const SNOW_SKIP = { value: new THREE.Vector4() };

/** The frame's parts left out, in the uniform's order (x, y, z, w), off the A/B's hidden set. */
export function setSnowSkip(hidden: ReadonlySet<Hideable>): void {
  const [a, b, c, d] = SNOW_PARTS.map((p) => (hidden.has(p) ? 1 : 0));
  SNOW_SKIP.value.set(a, b, c, d);
}
