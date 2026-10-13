// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER GROUND'S PLUMBING for the terrain (`terrain.ts`): the engine's
// summer field uploaded byte for byte (`summerFieldOf` — the shader and the
// physics read one answer), the country's palette and the heights it is
// banded by as uniforms, the grass on the same uniforms, and the grafts that
// swap the snow's chunks for the summer's.

import * as THREE from "three";
import { regionOf, summerFieldOf, treeLineY, weatherOf, windFromOf, type Level } from "@engine";
import type { HazeUniforms } from "./haze.ts";
import { FOREST_LOOK, type TerrainLook, type VideoSettings } from "./settings-video.ts";
import { summerShown } from "./season-look.ts";
export { setSummerLook, summerShown } from "./season-look.ts";
import { createGrass, type Grass, type GrassLook } from "./summer-grass.ts";
import {
  SUMMER_FRAGMENT_COLOUR,
  SUMMER_FRAGMENT_LIGHT,
  SUMMER_FRAGMENT_PARS,
  SUMMER_FRAGMENT_ROUGHNESS,
  SUMMER_FRAGMENT_SAMPLE,
  SUMMER_LOOKS,
} from "./summer-glsl.ts";

export type SummerTerrain = {
  /** The ground's summer uniforms, to be added to its shared ones. */
  readonly uniforms: Record<string, THREE.IUniform>;
  /** Make the grass on `ground` (the terrain's shared uniforms with these). */
  grass(haze: HazeUniforms, ground: Record<string, THREE.IUniform>, look: GrassLook): Grass;
  dispose(): void;
};

/** The summer chunks the ground's material takes in place of the snow's
 * sample, colour, roughness and light (`terrain.ts`'s graft). */
export const SUMMER_CHUNKS = {
  pars: SUMMER_FRAGMENT_PARS,
  sample: SUMMER_FRAGMENT_SAMPLE,
  colour: SUMMER_FRAGMENT_COLOUR,
  roughness: SUMMER_FRAGMENT_ROUGHNESS,
  light: SUMMER_FRAGMENT_LIGHT,
} as const;

function byteTexture(data: Uint8Array, cols: number, rows: number): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** The summer ground of `level`. */
export function summerTerrain(level: Level): SummerTerrain {
  const field = summerFieldOf(level);
  const a = byteTexture(field.a, field.cols, field.rows);
  const b = byteTexture(field.b, field.cols, field.rows);
  const look = SUMMER_LOOKS[regionOf(level).id];
  const m = level.mountain;
  const valley = m ? m.base.y : 0;
  const line = Math.min(treeLineY(level), 1e6);
  const top = m ? m.summit.y : 1e6;
  const v = (c: readonly number[]): THREE.Vector3 => new THREE.Vector3(c[0], c[1], c[2]);
  // The wind the grass leans in: the way it blows and how hard, 0..1 at a
  // fresh breeze (8 m/s) — never a gale's flattening.
  const from = windFromOf(level);
  const blow = Math.min(1, weatherOf(level).wind / 8);
  const uniforms: Record<string, THREE.IUniform> = {
    uSummerA: { value: a },
    uSummerB: { value: b },
    uSummerSize: { value: new THREE.Vector2(field.cols * field.cell, field.rows * field.cell) },
    uSummerBands: { value: new THREE.Vector3(valley, line, top) },
    uSumLow: { value: v(look.low) },
    uSumHigh: { value: v(look.high) },
    uSumTop: { value: v(look.top) },
    uSumDry: { value: v(look.dry) },
    uSumBloom: { value: v(look.bloom) },
    uSumRock: { value: v(look.rock) },
    uSumScree: { value: v(look.scree) },
    uSumShares: { value: new THREE.Vector2(look.dryShare, look.bloomShare) },
    uGrassWind: {
      value: new THREE.Vector4(-Math.sin(from), -Math.cos(from), 0.25 + 0.75 * blow, 0),
    },
  };
  return {
    uniforms,
    grass: (haze, ground, grassLook) => createGrass(haze, ground, grassLook),
    dispose() {
      a.dispose();
      b.dispose();
    },
  };
}

/** The terrain's options for a map: in summer (`season-look.ts`) its ground
 * and grass beside the picture's own look. */
export function summerOptions(
  look: TerrainLook,
  level: Level,
  video: Pick<VideoSettings, "forest">,
): TerrainLook & { summer?: SummerTerrain; grass?: GrassLook } {
  if (!summerShown()) return look;
  return { ...look, summer: summerTerrain(level), grass: FOREST_LOOK[video.forest].grass };
}
