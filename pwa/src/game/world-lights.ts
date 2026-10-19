// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD'S TWO LIGHTS AS CLASSES OF THEIR OWN: the key (`KeyLight`, the
// sun by day and the moon by night) and the sky over everything
// (`SkyLight`). On WebGL they are three's directional and hemisphere lights
// and nothing more — three reads a light by its `isDirectionalLight` /
// `isHemisphereLight` flags, so a subclass draws exactly as its parent, and
// the haze's GLSL (`haze.ts`) grafts what the key and the sky do beyond
// three's own on every hazed material. Their own flags must be words three
// does not read: `isSunLight` is three's cascaded sun, and a key flagged so
// is drawn by WebGL as one (and throws, its shadow having no cascades) —
// `tests/haze_tsl_test.ts` holds the flags to that.
//
// The node renderer finds a light's shading by its CLASS
// (`renderer.library.addLight`), so the classes are what lets the webgpu
// paths hang their own nodes on these two lights alone (`lights-tsl.ts`):
// the key taken down by the mountain's shadow and the cloud's, faded at the
// shadow box's rim and coloured by its height; the sky's light lifted in the
// mountain's shade. Each carries the shared haze uniforms those nodes read,
// set by `environment.ts`, which makes both on every back end.
//
// It imports nothing of three's node half, so the WebGL build carries it at
// no cost.

import * as THREE from "three";

import type { HazeUniforms } from "./haze.ts";

/** THE KEY LIGHT: a directional light that knows the haze it shines through. */
export class KeyLight extends THREE.DirectionalLight {
  readonly isKeyLight = true;
  /** The uniforms its node reads on the webgpu paths (`lights-tsl.ts`). */
  haze: HazeUniforms | null;

  constructor(haze: HazeUniforms | null = null, color?: THREE.ColorRepresentation, intensity = 1) {
    super(color, intensity);
    this.haze = haze;
  }
}

/** THE SKY'S LIGHT: a hemisphere light that knows the haze, for the lift
 * the low sun's shade takes (`uShadeLift`). */
export class SkyLight extends THREE.HemisphereLight {
  readonly isSkyLight = true;
  haze: HazeUniforms | null;

  constructor(
    haze: HazeUniforms | null = null,
    sky?: THREE.ColorRepresentation,
    ground?: THREE.ColorRepresentation,
    intensity = 1,
  ) {
    super(sky, ground, intensity);
    this.haze = haze;
  }
}
