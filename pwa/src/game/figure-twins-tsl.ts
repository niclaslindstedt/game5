// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIGURES' TWINS BY KIND (`docs/webgpu.md`, part 11), in the `figures`
// family of the register: what `sky-twins-tsl.ts` hands for a figure's flag
// (`nodeTwin(material, "figures", kind)`), and the shadow material the
// key's shadow node draws a caster with whose WebGL depth carries the
// figure's graft (`userData.figureDepth`).
//
//   crowd       the free ride's amateurs (`people-tsl.ts`)
//   civilians   the people on foot, the cyclists (`people-tsl.ts`)
//   dogs        the dogs (`people-tsl.ts`)
//   traffic     the cars, the bus and the bicycles (`people-tsl.ts`)
//   fans        a race's spectators (`fans-tsl.ts`)
//   bird        every species of bird (`wildlife-tsl.ts`)
//   beast       every species of animal (`wildlife-tsl.ts`)
//   gore-tree   the tree he is run through (`gore-tree.ts`), below

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { fanSpec } from "./fans-tsl.ts";
import { figureShadow, figureTwin, type FigureSpec } from "./figure-tsl.ts";
import { BLOOD_TREE } from "./gore-tree.ts";
import type { HazeUniforms } from "./haze.ts";
import type { N } from "./haze-tsl.ts";
import { civilianSpec, crowdSpec, dogSpec, trafficSpec } from "./people-tsl.ts";
import { beastSpec, birdSpec } from "./wildlife-tsl.ts";

const {
  Discard,
  If,
  attribute,
  diffuseColor,
  dot,
  floor,
  fract,
  mix,
  sin,
  smoothstep,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** Where on the tree a point was built, for the blood (`vBloodAt`). */
const BLOOD_AT: N = varyingProperty("vec3", "vBloodAt");

/** THE BLOODED TREE (`gore-tree.ts`): the trunk pushed out to its girth
 * (`GIRTH_VERTEX`), and above the blood's ragged front the tree's own
 * colours painted as blood, nothing drawn below it (`BLOOD_GLSL`). */
function goreTreeSpec(): FigureSpec {
  return {
    pose: {
      early(p) {
        BLOOD_AT.assign(p);
        const stem = attribute("stem", "vec3");
        const girth = attribute("girth", "vec2");
        const xz = stem.xy.add(p.xz.sub(stem.xy).mul(mix(vec2(1), girth, stem.z)));
        return vec3(xz.x, p.y, xz.y);
      },
    },
    diffuse(own) {
      const at = BLOOD_AT;
      const drip = fract(sin(dot(floor(at.xz.mul(7)), vec2(12.9898, 78.233))).mul(43758.5453));
      const wave = sin(at.x.mul(23).add(at.z.mul(17)))
        .mul(0.5)
        .add(0.5)
        .toVar();
      const ragged = Number(BLOOD_TREE.ragged.toFixed(3));
      const left = own("uBloodFront", "float")
        .add(drip.add(wave.mul(0.6)).sub(0.8).mul(ragged))
        .sub(at.y.oneMinus())
        .toVar();
      If(left.lessThan(0), () => {
        Discard();
      });
      const light = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      const red = mix(
        vec3(0.05, 0.003, 0.004),
        vec3(0.4, 0.012, 0.018),
        smoothstep(0.04, 0.8, light),
      ).toVar();
      const cell = floor(at.xz.mul(31).add(at.y.mul(3)));
      const streak = fract(sin(dot(cell, vec2(39.3468, 11.135))).mul(24634.6345));
      red.mulAssign(mix(0.55, 1.15, streak.mul(0.6).add(wave.mul(0.4))));
      red.mulAssign(mix(0.62, 1.0, smoothstep(0, 0.05, left)));
      diffuseColor.assign(vec4(red, diffuseColor.a));
    },
  };
}

/** Each kind's spec, over the material (or the depth material) drawn. */
const KINDS: Record<string, (m: THREE.Material) => FigureSpec> = {
  crowd: crowdSpec,
  civilians: civilianSpec,
  dogs: dogSpec,
  traffic: trafficSpec,
  fans: fanSpec,
  bird: birdSpec,
  beast: beastSpec,
  "gore-tree": goreTreeSpec,
};

/** The twin for figure flag `kind` over `m`, or null for a kind that is
 * not a figure's. */
export function figureTwinOf(
  m: THREE.Material,
  kind: string,
  haze: HazeUniforms,
): NodeMaterial | null {
  const spec = KINDS[kind];
  return spec ? figureTwin(m, spec(m), haze) : null;
}

/** The shadow material for a caster drawn on WebGL by depth material
 * `depth`, once a depth material — null where its depth is no figure's. */
const shadows = new WeakMap<THREE.Material, NodeMaterial>();
export function figureShadowOf(depth: THREE.Material | undefined): NodeMaterial | null {
  const kind: unknown = depth?.userData.figureDepth;
  if (!depth || typeof kind !== "string" || !KINDS[kind]) return null;
  let shadow = shadows.get(depth);
  if (!shadow) shadows.set(depth, (shadow = figureShadow(depth, KINDS[kind](depth).pose)));
  return shadow;
}
