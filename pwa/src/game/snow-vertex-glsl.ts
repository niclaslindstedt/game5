// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW'S VERTEX HALF: where a vertex of the clipmap stands — morphed
// toward the next level near its rim, lowered by the trail map's relief
// (low-passed to what the mesh can carry there), lifted by the loose cover,
// sunk into the tree wells and the avalanche's bed, kept under the player's
// skis (`ski-clear.ts`) and sunk under the finer level. Grafted into the
// ground's material by `terrain.ts` through `snow-glsl.ts`.

import { FAR_RIM_GLSL } from "./far-ranges-plan.ts";
import { SKI_CLEAR_GLSL } from "./ski-clear.ts";
import { TRAIL_GLSL } from "./trail-map.ts";
import { LOOSE } from "./trail-stamp.ts";
import { WELL_GLSL } from "./tree-wells.ts";
import { SLIDE_GLSL } from "./avalanche-glsl.ts";

/** The vertex half's declarations: the height field, the clipmap level, the
 * rim of mountains past the map. */
export const SNOW_VERTEX_PARS = /* glsl */ `
uniform sampler2D uHeight;
uniform vec2 uHeightOrigin;
uniform vec2 uHeightCount;
uniform float uCell;
uniform vec2 uLevelCentre;
uniform float uSpacing;
uniform float uGridHalf;
uniform float uBaseSpacing;
uniform vec4 uHole;
uniform sampler2D uGround;
// 1 on the deformable snow's own mesh (\`deform-snow.ts\`); the relief's
// filter is level 0's everywhere (\`uReliefHalf\`), so its rim meets it.
uniform float uDeformMesh;
uniform float uReliefHalf;
// The lens's focal length in the target's pixels (\`deformPatch\`'s
// \`onBeforeRender\`): how many pixels a metre spans a metre off.
uniform float uFocalPx;
varying vec3 vSnowWorld;
varying vec3 vSnowNormal;
${TRAIL_GLSL}
${SKI_CLEAR_GLSL}
${WELL_GLSL}
${SLIDE_GLSL}

float snowHash1(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float snowNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(snowHash1(i), snowHash1(i + vec2(1, 0)), u.x),
             mix(snowHash1(i + vec2(0, 1)), snowHash1(i + vec2(1, 1)), u.x), u.y);
}

// THE MOUNTAINS PAST THE MAP: the generator's world ends at its edge, the
// eye's does not — past it the ground is the far ranges' rim
// (far-ranges-plan.ts), so the clipmap's last ring meets them.
${FAR_RIM_GLSL}

// Whether a tool has touched the deformable snow over a block of its cells
// (\`SNOW_VERTEX_PLACE\`'s fold): n × n filtered taps from \`from\` cells past
// \`p\`, \`step\` cells apart, each the mean of the texels round it — 1 when
// any texel a tap reads has been touched.
float deformTouched(vec2 p, float from, float step, int n) {
  float most = 0.0;
  for (int j = 0; j < 3; j++) {
    if (j >= n) break;
    for (int i = 0; i < 3; i++) {
      if (i >= n) break;
      vec2 at = p + (vec2(float(i), float(j)) * step + from) * uSpacing;
      most = max(most, deformAt(at).y);
    }
  }
  return clamp(most * 4.0, 0.0, 1.0);
}

float heightTexel(ivec2 c) {
  ivec2 top = ivec2(uHeightCount) - 1;
  return texelFetch(uHeight, clamp(c, ivec2(0), top), 0).r;
}

float groundHeight(vec2 p) {
  vec2 lo = uHeightOrigin;
  vec2 hi = uHeightOrigin + (uHeightCount - 1.0) * uCell;
  vec2 q = clamp(p, lo, hi);
  vec2 f = (q - lo) / uCell;
  vec2 i = floor(f);
  vec2 t = f - i;
  ivec2 c = ivec2(i);
  float a = heightTexel(c);
  float b = heightTexel(c + ivec2(1, 0));
  float d = heightTexel(c + ivec2(0, 1));
  float e = heightTexel(c + ivec2(1, 1));
  return mix(mix(a, b, t.x), mix(d, e, t.x), t.y) + rimRise(p, q);
}
`;

/** How many of the target's pixels a cell of the deformable snow's mesh
 * keeps under it before the mesh folds to a cell twice as wide. */
export const DEFORM_FINE_PX = 8;

/** Replaces `beginnormal_vertex`: place the vertex on the clipmap, morph it
 * toward the next level near this level's rim (so two levels meet with no
 * crack), and lift it onto the snow. */
export const SNOW_VERTEX_PLACE = /* glsl */ `
vec2 snowGrid = position.xz;
vec2 snowLocal = (snowGrid - uGridHalf) * uSpacing;
float snowEdge = max(abs(snowLocal.x), abs(snowLocal.y)) / (uGridHalf * uSpacing);
float snowMorph = clamp((snowEdge - 0.72) / 0.2, 0.0, 1.0) * (1.0 - uDeformMesh);
vec2 snowXZ = uLevelCentre + snowLocal - mod(snowGrid, 2.0) * uSpacing * snowMorph;
// THE DEFORMABLE SNOW'S MESH THINNED WHERE IT HAS NOTHING TO SHOW. A cell
// of the field's own size is a few pixels on screen, and a triangle that
// small is shaded at several times the price of its pixels (a GPU shades in
// quads of four, and the ground's pixel is the dearest there is). Only the
// snow a tool has TOUCHED has relief finer than the trail map's: so where
// none has, the odd vertices fold onto the even ones and the even onto
// every fourth — a cell four times as wide, finer still than level 0 round
// it — and where one has, the cells are kept until they are under
// ${DEFORM_FINE_PX} pixels, then folded the same way, every collapsed
// triangle of no area at all. The second fold is judged at the vertex it
// folds onto, so the vertices that meet there meet exactly.
float snowCellV = uSpacing;
if (uDeformMesh > 0.5 && uFocalPx > 0.0) {
  vec2 snowE = snowGrid - mod(snowGrid, 2.0);
  vec2 snowQ = snowE - mod(snowE, 4.0);
  vec2 xzE = uLevelCentre + (snowE - uGridHalf) * uSpacing;
  vec2 xzQ = uLevelCentre + (snowQ - uGridHalf) * uSpacing;
  float pxE = uSpacing * uFocalPx / max(distance(vec3(xzE.x, groundHeight(xzE), xzE.y), cameraPosition), 0.01);
  float pxQ = uSpacing * uFocalPx / max(distance(vec3(xzQ.x, groundHeight(xzQ), xzQ.y), cameraPosition), 0.01);
  float fold1 = max(1.0 - deformTouched(xzE, 0.5, 1.0, 2), clamp((${DEFORM_FINE_PX.toFixed(1)} - pxE) / ${(DEFORM_FINE_PX / 2).toFixed(1)}, 0.0, 1.0));
  float fold2 = max(1.0 - deformTouched(xzQ, 0.5, 1.5, 3), clamp((${(DEFORM_FINE_PX / 2).toFixed(1)} - pxQ) / ${(DEFORM_FINE_PX / 4).toFixed(1)}, 0.0, 1.0));
  snowXZ -= (mod(snowGrid, 2.0) * fold1 + mod(snowE, 4.0) * fold2) * uSpacing;
  snowCellV = uSpacing * (1.0 + fold1 + 2.0 * fold2);
}
// The furrow, low-passed to what the mesh can carry here. Close in, a tent
// filter over the fine map a vertex's spacing wide — enough for the skis's
// band to sink the mesh without the ski lines aliasing into a sawtooth;
// further out, the coarse map alone, which is already that blur. The
// per-pixel normal (fragment half) draws everything this leaves out. The
// filter's width is a function of the DISTANCE, not of the level, so two
// levels meeting at a vertex compute the same height there.
float snowR = max(uBaseSpacing, distance(snowXZ, cameraPosition.xz) / uReliefHalf);
float snowRelief;
{
  vec2 t = textureLod(uTrailCoarse, snowXZ / uMapSize, 0.0).rg * uTrailScale;
  float coarseRelief = -t.x + t.y * (1.0 - clamp(t.x / 0.03, 0.0, 1.0));
  float nearW = 1.0 - smoothstep(0.35, 0.7, snowR);
  float fineRelief = 0.0;
  if (nearW > 0.0) {
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        float w = (i == 0 ? 0.5 : 0.25) * (j == 0 ? 0.5 : 0.25);
        fineRelief += w * trailRelief(snowXZ + vec2(float(i), float(j)) * snowR);
      }
    }
  }
  snowRelief = mix(coarseRelief, fineRelief, nearW);
  // ON THE DEFORMABLE SNOW'S MESH: the field itself, a vertex a cell —
  // every cut, heap and crater as the geometry it is.
  if (uDeformMesh > 0.5) {
    float dwv = deformWeight(snowXZ);
    if (dwv > 0.0) snowRelief = mix(snowRelief, trailRelief(snowXZ), dwv);
  }
}
// THE LOOSE COVER: powder stands a hand higher than the groomed track, so
// the track's shoulders are a real edge the light picks out. (The engine's
// ground is the track's graded surface; the skier drawn in powder is lowered
// by as much in renderer.ts.)
vec4 snowGroundV = textureLod(uGround, (snowXZ - uHeightOrigin + 0.5 * uCell) / (uHeightCount * uCell), 0.0);
// The packed channel carries the rock's share below nought (\`terrain.ts\`).
float snowPackedV = max(snowGroundV.b, 0.0);
// THE TREE WELLS (\`tree-wells.ts\`): the hollows round the trunks in deep
// powder, off the engine's own wells.
float snowY = groundHeight(snowXZ) + snowRelief + ${LOOSE.toFixed(3)} * (1.0 - snowPackedV) - wellDepth(snowXZ)
  // THE AVALANCHE (\`avalanche-glsl.ts\`): its bed below, its debris above.
  + slideAt(snowXZ);
// Never over the player's skis, nor the nearest rivals' (\`ski-clear.ts\`).
snowY = skiClear(snowXZ, snowY, snowCellV);
// UNDER THE FINER LEVEL (\`uHole\`: its centre and half extent), the
// vertices it covers by a whole cell of this one are SUNK, so every
// triangle of this level the finer one draws over hinges down from where
// the two meet and lies under it — out of sight, and no pixel of it thrown
// away. Thrown away per pixel, as it was, the ground's shader held a
// \`discard\`, and a GPU that sorts what it draws before it shades it
// (a phone's tiles) cannot, for any draw that may discard: every
// fragment of the mountain behind a nearer one was shaded in full. The
// finer level is wholly morphed onto this one's cells within two of them
// of its edge (the morph's last 8 %), so the seam is one surface.
if (uHole.w > 0.5) {
  vec2 dh = abs(snowXZ - uHole.xy);
  // Sunk at least a metre and a half under the deformable snow's mesh
  // (\`uHole.w\` past 1: a crater goes deeper than two cells of level 0).
  if (max(dh.x, dh.y) <= uHole.z - uSpacing + 0.01 * uSpacing) snowY -= max(2.0 * uSpacing, uHole.w - 1.0);
}
// THE MESH'S NORMAL. The snow's shading never reads it — the fragment
// half lights every pixel by its own normal off the GROUND map's slope —
// so on the map it is that same slope, already read above (the shadow's
// normal bias is all it steers there); past the edge, where the rim's
// rise is noise of its own, the ground is differenced, four heights.
float snowE = max(uSpacing, uCell);
vec2 snowLo = uHeightOrigin + snowE;
vec2 snowHi = uHeightOrigin + (uHeightCount - 1.0) * uCell - snowE;
vec3 objectNormal;
if (all(greaterThanEqual(snowXZ, snowLo)) && all(lessThanEqual(snowXZ, snowHi))) {
  objectNormal = normalize(vec3(-snowGroundV.r, 1.0, -snowGroundV.g));
} else {
  objectNormal = normalize(vec3(
    groundHeight(snowXZ - vec2(snowE, 0.0)) - groundHeight(snowXZ + vec2(snowE, 0.0)),
    2.0 * snowE,
    groundHeight(snowXZ - vec2(0.0, snowE)) - groundHeight(snowXZ + vec2(0.0, snowE))));
}
`;

/** Replaces `begin_vertex`. */
export const SNOW_VERTEX_BEGIN = /* glsl */ `
vec3 transformed = vec3(snowXZ.x, snowY, snowXZ.y);
vSnowWorld = transformed;
vSnowNormal = objectNormal;
`;
