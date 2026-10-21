// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN ANIMAL'S BODY BROKEN, IN THE VERTEX SHADER — grafted after the gait's
// (`beast-shapes.ts`), so the one instanced mesh a species form draws the
// living and the dead alike. Per instance `aBroken` says how crushed it is
// (0: whole — the graft does nothing), where along its spine the blow
// landed, on which side (`beast-wreck.ts`'s `Wreck`) and a seed of its own:
//
//   * THE SPINE BROKEN where it was met: the body folded about its back
//     there, both ends dropped, so it lies in a V — on its side, a V on
//     the snow;
//   * THE FLANK STOVE IN round the blow, the ribs driven in by up to most
//     of the barrel's half-width, and ragged there;
//   * THE LEGS FLUNG every way, each by its own hash, and the HEAD lolled
//     over sideways off the neck;
//   * PAINTED: round the blow the coat gives way to what is under it — the
//     dark muscle, the clots and the white winter fat (`WRECK_COLOURS`) —
//     and the rest of it is spattered with its blood.
//
// The shadow's depth pass takes the same graft without the paint.

import * as THREE from "three";
import type { BeastSpec } from "@engine";

import type { BeastStyle } from "./beast-shapes.ts";
import { WRECK_COLOURS } from "./beast-wreck.ts";

const linear = (hex: number): THREE.Vector3 => {
  const c = new THREE.Color().setHex(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
};

/** The graft's uniforms: the body's frame for `spec` drawn as `style` (its
 * barrel's half-width, its length, the barrel's middle height and
 * half-depth, m) and the wreck's colours. */
export function crushUniforms(spec: BeastSpec, style: BeastStyle): Record<string, THREE.IUniform> {
  const H = spec.height;
  const depth = style.depth * H;
  return {
    uBody: {
      value: new THREE.Vector4((style.width * H) / 2, spec.length, H - depth / 2, depth / 2),
    },
    uMuscle: { value: linear(WRECK_COLOURS.muscle) },
    uClot: { value: linear(WRECK_COLOURS.clot) },
    uFat: { value: linear(WRECK_COLOURS.fat) },
    uBlood: { value: linear(WRECK_COLOURS.blood) },
  };
}

/** The graft over `uniforms` (`crushUniforms`), the paint only where
 * `paint` (the depth pass has no colour). */
export function crushGraft(
  uniforms: Record<string, THREE.IUniform>,
  paint: boolean,
): (shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }) => void {
  return (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `attribute vec4 aBroken;
uniform vec4 uBody;
uniform vec3 uMuscle;
uniform vec3 uClot;
uniform vec3 uFat;
uniform vec3 uBlood;
float wreckHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
${shader.vertexShader}`.replace(
      "#include <morphtarget_vertex>",
      `if (aBroken.x > 0.0) {
\tfloat c = aBroken.x;
\tfloat side = aBroken.z;
\tfloat dz = transformed.z - aBroken.y;
\tfloat near = exp(-pow(dz / (uBody.y * 0.26), 2.0));
\tfloat onSide = smoothstep(-0.35, 0.75, side * transformed.x / uBody.x);
\tfloat h = wreckHash(floor(position * 37.0) + aBroken.w);
\tif (aPart.x > 0.5) {
\t\tfloat a = (wreckHash(vec3(aPart.x, aBroken.w, 3.1)) - 0.5) * 2.2 * c;
\t\tfloat b = (wreckHash(vec3(aPart.x, aBroken.w, 7.7)) - 0.5) * 1.3 * c;
\t\tfloat dy = transformed.y - aPart.y;
\t\ttransformed.x += dy * sin(a);
\t\tfloat y1 = dy * cos(a);
\t\ttransformed.y = aPart.y + y1 * cos(b);
\t\ttransformed.z += y1 * sin(b);
\t} else {
\t\tfloat dent = c * 0.75 * uBody.x * near * onSide;
\t\ttransformed.x -= side * dent;
\t\ttransformed.y = uBody.z + (transformed.y - uBody.z) * (1.0 - 0.3 * c * near);
\t\ttransformed.y += (h - 0.5) * 0.5 * uBody.w * c * near * onSide;
\t}
\tif (aPart.z > 0.5) {
\t\tfloat a = -side * c * 1.2;
\t\tfloat hy = transformed.y - uHeadPivot.x;
\t\ttransformed.x += hy * sin(a);
\t\ttransformed.y = uHeadPivot.x + hy * cos(a) - 0.3 * c * max(0.0, transformed.z - uHeadPivot.y);
\t}
\tfloat th = c * 0.45 * clamp(dz / (uBody.y * 0.15), -1.0, 1.0);
\tfloat py = uBody.z + uBody.w;
\tfloat ry = transformed.y - py;
\ttransformed.y = py + ry * cos(th) - dz * sin(th);
\ttransformed.z = aBroken.y + ry * sin(th) + dz * cos(th);
${
  paint
    ? `\tfloat wound = clamp(c * 1.8 * near * onSide, 0.0, 1.0);
\tvec3 meat = h > 0.82 ? uFat : mix(uClot, uMuscle, h * 1.2);
\tfloat spat = c * step(0.62, wreckHash(floor(position * 23.0) + aBroken.w + 1.0));
\tvColor.rgb = mix(vColor.rgb, uBlood * (0.55 + 0.45 * h), min(1.0, spat));
\tvColor.rgb = mix(vColor.rgb, uClot, c * 0.5 * smoothstep(0.2, -0.6, side * transformed.x / uBody.x));
\tvColor.rgb = mix(vColor.rgb, meat, smoothstep(0.22, 0.55, wound));`
    : ""
}
}
#include <morphtarget_vertex>`,
    );
  };
}
