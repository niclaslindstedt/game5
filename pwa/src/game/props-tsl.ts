// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BUILDINGS AND THE PROPS ON THE NODE RENDERER (`docs/webgpu.md`, part
// 13): the classic materials WebGL draws with a GLSL graft of their own
// (`hazeMaterial`'s `extra`), flagged `nodeGraft(material, "props", kind)`
// (`gpu-backend.ts`). Three's library copies each field for field, and the
// dressing hands the copy here to be finished (`model-grafts-tsl.ts`,
// `gpu-dress.ts`), term for term with the GLSL:
//
//   facade      every building's painted stack (`facade-material.ts`'s
//               `graftFacade`): the layer's colour under the vertex colour,
//               its roughness, its relief bent in the surface's own frame
//               off the screen derivatives; a snow layer folded away in
//               summer; and the panes' glow after dark (`graftGlow`)
//   interiors   the rooms (`interiors-view.ts`): the stack, the sun kept
//               out (`userData.indoor`, read by the key's light node), and
//               the room's own warm light, a lamp's shade and a pane's day
//   print-bump  a printed board's bump read off its sRGB colour as stored
//               (`print-bump.ts`): the route signs, the run signs
//   slab-walls  a slab's crown and flanks (`avalanche-plates.ts`): a stretch
//               the crack has not reached folded under the snow, the rest
//               drawn a little nearer the lens than it stands
//   rock, talus the crags and the stones under them (`rock-tsl.ts`)
//   water       the lakes and the streams (`water-tsl.ts`)
//   grass       a summer's tufts (`grass-tsl.ts`)
//
// The flags and the avalanche's plates move their vertex before the
// instance's matrix, so they are figure twins instead (`propSpecs`, drawn
// by `figure-tsl.ts`'s machinery). A graft's vertex is set on the copy
// alone: WebGL's depth takes none of these grafts, so the shadows stay
// WebGL's.

import * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { LAMP, LAMP_BRIGHT } from "./cabins-view.ts";
import { FACADE } from "./facade-paint.ts";
import { facadeTextures } from "./facade-material.ts";
import { insideWall } from "./glow-tsl.ts";
import { grassGraft } from "./grass-tsl.ts";
import type { HazeUniforms } from "./haze.ts";
import { ROOM_LIGHT } from "./interiors-view.ts";
import { slot, type HazeFogOptions, type N } from "./haze-tsl.ts";
import { lightSlots } from "./lights-tsl.ts";
import { LUX_TO_LAMP } from "./piste-lights.ts";
import { rockGraft } from "./rock-tsl.ts";
import { SUMMER_UNIFORM } from "./season-look.ts";
import { waterGraft } from "./water-tsl.ts";

const {
  Fn,
  abs,
  attribute,
  bumpMap,
  cameraProjectionMatrix,
  clamp,
  cross,
  dFdx,
  dFdy,
  diffuseColor,
  dot,
  float,
  floor,
  inverseSqrt,
  length,
  materialColor,
  materialEmissive,
  materialReference,
  materialRoughness,
  max,
  min,
  mix,
  modelViewMatrix,
  normalView,
  normalize,
  positionGeometry,
  positionLocal,
  positionView,
  sRGBTransferOETF,
  select,
  step,
  texture,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** What a prop's finish is handed: the haze's uniforms and how it mixes. */
export type PropDressing = { haze: HazeUniforms; how: HazeFogOptions };

/** A number as the GLSL prints it, `toFixed(k)`. */
const fx = (x: number, k: number): number => Number(x.toFixed(k));

/** A `vec3(…)` GLSL literal as numbers. */
function rgbOf(glsl: string): [number, number, number] {
  const m = glsl.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0];
}

/** How far into the night the lamps are lit, 0 … 1 (`uPisteOn.x` over
 * `LUX_TO_LAMP`, as the panes and the rooms read it). */
const nightOf = (haze: HazeUniforms): N =>
  clamp(lightSlots(haze).pisteOn.x.div(fx(LUX_TO_LAMP, 6)), 0, 1);

// ---------------------------------------------------------------- facade

/** `facadePerturb`: the relief's normal `mapN` bent off `n` in the frame
 * the screen derivatives of the view position `eye` and the UV give. */
function perturb(eye: N, n: N, mapN: N, uv: N): N {
  const q0 = dFdx(eye);
  const q1 = dFdy(eye);
  const st0 = dFdx(uv);
  const st1 = dFdy(uv);
  const q1perp = cross(q1, n).toVar();
  const q0perp = cross(n, q0).toVar();
  const T = q1perp.mul(st0.x).add(q0perp.mul(st1.x)).toVar();
  const B = q1perp.mul(st0.y).add(q0perp.mul(st1.y)).toVar();
  const det = max(dot(T, T), dot(B, B)).toVar();
  const s = select(det.equal(0), float(0), inverseSqrt(det));
  return normalize(
    T.mul(mapN.x.mul(s))
      .add(B.mul(mapN.y.mul(s)))
      .add(n.mul(mapN.z)),
  );
}

/** THE PAINTED STACK on `copy` (`graftFacade`): returns the share of a
 * pane's glow its layer lets through (a cabin's casement lights only its
 * glass). */
function facade(copy: NodeMaterial): N {
  const stack = facadeTextures();
  const uv = attribute("facadeUv", "vec2");
  const layer = attribute("facadeLayer", "float");
  const L = floor(layer.add(0.5)).toVar();
  const albedo = texture(stack.albedo, uv).depth(L).setUpdateMatrix(false).toVar();
  const relief = texture(stack.normal, uv).depth(L).setUpdateMatrix(false).xyz.mul(2).sub(1);
  const c = copy as NodeMaterial & Record<string, N>;
  // IN SUMMER the snow layer is not there: its faces fold to a point.
  const summer = slot(SUMMER_UNIFORM, "float");
  const fold = summer.greaterThan(0.5).and(abs(layer.sub(FACADE.snow)).lessThan(0.5));
  c.positionNode = select(fold, vec3(0), positionLocal);
  c.colorNode = materialColor.mul(vec4(albedo.rgb, 1));
  c.roughnessNode = materialRoughness.mul(albedo.a);
  c.normalNode = perturb(positionView, normalView, relief, uv);
  return select(abs(L.sub(FACADE.casement)).lessThan(0.5), step(albedo.a, 0.2), float(1));
}

/** The panes' glow after dark (`graftGlow`). */
function glow(copy: NodeMaterial, haze: HazeUniforms, lit: N): void {
  const lamp = rgbOf(LAMP);
  const add = attribute("glow", "float")
    .mul(lit)
    .mul(vec3(...lamp))
    .mul(fx(LAMP_BRIGHT, 2))
    .mul(nightOf(haze));
  (copy as NodeMaterial & { emissiveNode: N }).emissiveNode = materialEmissive.add(add);
}

// ---------------------------------------------------------------- interiors

/** THE ROOMS: the stack, and the room's light in place of the panes'
 * glow; the key's light is kept out by `userData.indoor`. */
function interiors(copy: NodeMaterial, haze: HazeUniforms): void {
  const lit = facade(copy);
  const R = ROOM_LIGHT;
  const night = nightOf(haze).toVar();
  const g = attribute("glow", "float");
  const lamp = step(0.5, g).mul(step(g, 1.5));
  const pane = step(1.5, g);
  const warm = vec3(1.0, 0.86, 0.68);
  const albedo = diffuseColor.rgb;
  const room = float(1)
    .sub(pane)
    .mul(albedo)
    .mul(warm)
    .mul(mix(R.day, R.night, night));
  const shade = lamp.mul(albedo).mul(mix(R.lampDay, R.lampNight, night));
  const day = mix(slot(haze.uHorizon, "color"), slot(haze.uZenith, "color"), 0.35).mul(R.pane);
  const window = pane.mul(lit).mul(mix(day, vec3(0.01, 0.015, 0.035), night));
  (copy as NodeMaterial & { emissiveNode: N }).emissiveNode = materialEmissive
    .add(room)
    .add(shade)
    .add(window);
}

// ---------------------------------------------------------------- print-bump

/** A board's bump off its own sRGB map, read as the canvas stored it. */
function printBump(copy: NodeMaterial): void {
  const stored = sRGBTransferOETF(materialReference("bumpMap", "texture").rgb).x;
  (copy as NodeMaterial & { normalNode: N }).normalNode = bumpMap(
    stored,
    materialReference("bumpScale", "float"),
  );
}

// ---------------------------------------------------------------- the slab's walls

/** THE WALLS (`avalanche-plates.ts`'s `wallMaterial`): a stretch the crack
 * has not reached folded up to its top, and every vertex drawn a little
 * nearer the lens — a couple of percent of its distance, 2.5 m at the
 * most. The walls are in world space and drawn once, so the fold runs on
 * the point as built. */
function slabWalls(copy: NodeMaterial, haze: HazeUniforms): void {
  const slab0 = slot(haze.uSlab0, "vec4");
  const crack = slot(haze.uSlabCrack, "vec4");
  const p = positionGeometry;
  const wp = p.xz.sub(slab0.xy).toVar();
  const uv = vec2(
    wp.x.mul(slab0.w).sub(wp.y.mul(slab0.z)),
    wp.x.mul(slab0.z).add(wp.y.mul(slab0.w)),
  );
  const gone = clamp(crack.w.sub(length(uv.sub(crack.xy)).div(crack.z)).div(0.1), 0, 1);
  const GONE: N = varyingProperty("float", "vWallGone");
  const c = copy as NodeMaterial & Record<string, N>;
  c.positionNode = Fn(() => {
    GONE.assign(gone);
    const drop = attribute("aDrop", "float");
    return p.add(vec3(0, drop.sub(0.3).mul(float(1).sub(GONE)), 0));
  })();
  c.vertexNode = Fn(() => {
    const mv = modelViewMatrix.mul(vec4(positionLocal, 1)).toVar();
    const dist = length(mv.xyz).toVar();
    const pulled = max(0, dist.sub(min(2.5, dist.mul(0.025)).mul(GONE))).div(max(dist, 1e-3));
    return cameraProjectionMatrix.mul(vec4(mv.xyz.mul(pulled), 1));
  })();
}

// ---------------------------------------------------------------- the hook

/** Finish `copy` of `material` for prop graft `kind`; false for a kind
 * that is not a prop's. */
export function finishProp(
  copy: NodeMaterial,
  material: THREE.Material,
  kind: string,
  d: PropDressing,
): boolean {
  const c = copy as NodeMaterial & Record<string, N>;
  switch (kind) {
    case "facade":
      glow(copy, d.haze, facade(copy));
      // `graftGlow`'s mist wall.
      c.maskNode = insideWall(d.haze);
      break;
    case "interiors":
      interiors(copy, d.haze);
      c.maskNode = insideWall(d.haze);
      break;
    case "print-bump":
      printBump(copy);
      break;
    case "slab-walls":
      slabWalls(copy, d.haze);
      break;
    case "rock":
    case "talus":
      rockGraft(copy, material, kind === "talus", d);
      break;
    case "water":
      waterGraft(copy, material, d);
      break;
    case "grass":
      grassGraft(copy, material);
      break;
    default:
      return false;
  }
  // A draw's uniforms are refreshed in full only for a material with a node
  // of its own, and the material three checks is `material`.
  const held = material as unknown as { graftNode?: N };
  held.graftNode ??= c.colorNode ?? c.normalNode ?? c.positionNode ?? c.emissiveNode;
  return true;
}
