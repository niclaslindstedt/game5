// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PRINTED BOARD'S BUMP OFF ITS OWN COLOUR TEXTURE. The signs paint one
// canvas and read it twice: as the albedo (sRGB) and, by its red channel,
// as the height the letters and the grain are cut to (raw, as stored). Two
// textures of the one canvas are two uploads and two mip chains of the
// same pixels — a ski area's sign atlas is 2048 × 1024, some 11 MB a copy
// on the GPU. So the one sRGB texture is handed to both slots, and the bump
// reads its red channel encoded back to sRGB: the stored value again, but
// for a texel blended across an edge, which is blended in linear light
// before it is re-encoded (a hair's difference in the slope of a stroke's
// rim, never in its place or its depth).

import * as THREE from "three";

/** The bump chunk reading an sRGB `bumpMap` as the values stored in it. */
const STORED_BUMP = THREE.ShaderChunk.bumpmap_pars_fragment.replace(
  /texture2D\( bumpMap, ([^)]*)\)\.x/g,
  "sRGBTransferOETF( texture2D( bumpMap, $1) ).x",
);

/** Graft for a material whose `bumpMap` is its sRGB `map`: the height read
 * as the canvas stored it. Pass to `hazeMaterial`'s `extra`. */
export function storedBump(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <bumpmap_pars_fragment>",
    STORED_BUMP,
  );
}
