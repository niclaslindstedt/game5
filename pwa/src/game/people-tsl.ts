// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PEOPLE, THE DOGS AND THE TRAFFIC ON THE NODE RENDERER (`docs/webgpu.md`,
// part 11): the GLSL each material grafts on WebGL, restated as a figure's
// pose (`figure-tsl.ts`), term for term:
//
//   crowd       the free ride's amateurs (`crowd-shapes.ts`'s
//               `crowdMaterial`): every dressed vertex painted from the
//               instance's outfit, and a struck amateur's blood soaked in
//               off the vertex's own hash;
//   civilians   the people on foot (`civilian-shapes.ts`): the crowd's paint
//               over nine slots, and the parts an instance does not show
//               folded to his feet after the morphs — in his shadow too, as
//               WebGL's `civilianDepth` folds them;
//   dogs        the dogs (`dog-shapes.ts`): each slot an sRGB colour
//               unpacked off the instance's packed six, the coat folded
//               where it is not worn;
//   traffic     the vehicles (`traffic-view.ts`): the paint the instance's
//               colour where the vertex is painted, the parts its lamps do
//               not show folded, the roughness the vertex's own and the
//               lenses and the bus's windows lit;
//   steam       the dogs' steam over a fresh pile, a stand-in a quad a puff
//               for WebGL's `gl_PointSize` points (`steamStand`).

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { particleMaterial } from "./air-tsl.ts";
import {
  band,
  glslMod,
  interleave,
  notNear,
  ownValue,
  packed,
  type FigureSpec,
} from "./figure-tsl.ts";
import { perPoint } from "./glow-tsl.ts";
import { slot, type N } from "./haze-tsl.ts";

const {
  Fn,
  If,
  attribute,
  cameraProjectionMatrix,
  float,
  fract,
  floor,
  instancedBufferAttribute,
  int,
  length,
  materialEmissive,
  max,
  mix,
  modelViewMatrix,
  positionGeometry,
  pow,
  screenSize,
  select,
  sin,
  smoothstep,
  step,
  uniformArray,
  varying,
  varyingProperty,
  vec3,
  vec4,
  vertexIndex,
} = TSL as N;

/** A palette uniform's colours as a uniform array. */
const palette = (m: THREE.Material, name: string): N =>
  uniformArray(ownValue(m, name).value as THREE.Color[], "color");

/** `aSlot > 0.5`'s pick: the instance's `k`th colour index off its dress. */
const slotPick = (slots: N[], aSlot: N = attribute("aSlot", "float")): N => band(aSlot, 1.5, slots);

const dress = (): N[] => {
  const d = attribute("aDress", "vec4");
  const d2 = attribute("aDress2", "vec4");
  return [d.x, d.y, d.z, d.w, d2.x, d2.y, d2.z, d2.w];
};

/** THE CROWD (`crowdMaterial`). */
export function crowdSpec(m: THREE.Material): FigureSpec {
  const colours = palette(m, "uCrowdPalette");
  const blood = slot(ownValue(m, "uCrowdBlood"), "color");
  return {
    pose: {
      paint(colour, tint) {
        const aSlot = attribute("aSlot", "float");
        const d2w = attribute("aDress2", "vec4").w;
        const c = colour.mul(tint).toVar();
        If(aSlot.greaterThan(0.5), () => {
          const k = slotPick(dress().slice(0, 7));
          c.assign(colours.element(int(k.add(0.5))).mul(colour));
        });
        If(d2w.greaterThan(0), () => {
          const h = fract(sin(float(vertexIndex).mul(12.9898)).mul(43758.5453)).toVar();
          const isFace = aSlot.greaterThan(5.5).or(aSlot.greaterThan(2.5).and(aSlot.lessThan(3.5)));
          const face = select(isFace, float(1), float(0));
          const soak = step(float(1).sub(d2w.mul(face.mul(1.6).add(0.7))), h);
          const red = blood.mul(fract(h.mul(7.31)).mul(0.55).add(0.45));
          c.assign(mix(c, red, soak.mul(0.92)));
        });
        return c;
      },
    },
  };
}

/** The civilians' fold (`FOLD_GLSL`): a part none of the instance's kit
 * names is folded to the origin. */
const civilianFold = (p: N): N => {
  const part = packed("aPart", "float");
  const kit = attribute("aKit", "vec4");
  const folded = part
    .greaterThan(0.5)
    .and(notNear(part, kit.x))
    .and(notNear(part, kit.y))
    .and(notNear(part, kit.z))
    .and(notNear(part, kit.w));
  return select(folded, vec3(0), p);
};

/** The civilians' marks, read packed: with the instance's three and
 * three's own, nine buffers. */
const civilianMarks = (g: THREE.BufferGeometry): void => interleave(g, ["aSlot", "aPart"]);

/** THE CIVILIANS (`civilianMaterial`); their shadow folds as theirs does
 * (`civilianDepth`), and has no palette. */
export function civilianSpec(m: THREE.Material): FigureSpec {
  if (m.userData.figureDepth !== undefined)
    return { pose: { prepare: civilianMarks, late: civilianFold } };
  const colours = palette(m, "uCivilianPalette");
  return {
    pose: {
      prepare: civilianMarks,
      late: civilianFold,
      paint(colour, tint) {
        const c = colour.mul(tint).toVar();
        const aSlot = packed("aSlot", "float");
        If(aSlot.greaterThan(0.5), () => {
          const k = slotPick(dress(), aSlot);
          c.assign(colours.element(int(k.add(0.5))).mul(colour));
        });
        return c;
      },
    },
  };
}

/** THE DOGS (`dogMaterial`). */
export function dogSpec(): FigureSpec {
  return {
    pose: {
      late(p) {
        const folded = attribute("aPart", "float")
          .greaterThan(0.5)
          .and(attribute("aCoat2", "vec4").z.lessThan(0.5));
        return select(folded, vec3(0), p);
      },
      paint(colour, tint) {
        const coat = attribute("aCoat", "vec4");
        const coat2 = attribute("aCoat2", "vec4");
        const out = colour.mul(tint).toVar();
        If(attribute("aSlot", "float").greaterThan(0.5), () => {
          const c = slotPick([coat.x, coat.y, coat.z, coat.w, coat2.x, coat2.y]);
          const srgb = vec3(
            floor(c.div(65536)),
            glslMod(floor(c.div(256)), 256),
            glslMod(c, 256),
          ).div(255);
          out.assign(pow(srgb, vec3(2.2)).mul(colour));
        });
        return out;
      },
    },
  };
}

/** THE TRAFFIC (`trafficMaterial`). */
export function trafficSpec(m: THREE.Material): FigureSpec {
  const interior = slot(ownValue(m, "uInterior"), "float");
  return {
    pose: {
      // Five marks a vertex, with the instance's lamps and three's own:
      // ten buffers, read as six.
      prepare: (g) => interleave(g, ["aPaint", "aLamp", "aRough", "aFold", "aGlass"]),
      early(p) {
        const folded = packed("aFold", "float")
          .greaterThan(0.5)
          .and(attribute("aLevel", "vec4").x.lessThan(0.5));
        return select(folded, vec3(0), p);
      },
      paint(colour, tint) {
        return colour.mul(mix(vec3(1), tint, packed("aPaint", "float")));
      },
    },
    dress(twin) {
      const lamp = packed("aLamp", "vec4");
      const hue = vec3(1, 0.93, 0.82)
        .mul(lamp.x)
        .add(vec3(1, 0.03, 0.015).mul(lamp.y))
        .add(vec3(1, 0.4, 0.02).mul(lamp.z.add(lamp.w)));
      const glow = hue
        .mul(lamp.dot(attribute("aLevel", "vec4")))
        .mul(5)
        .add(vec3(1, 0.82, 0.58).mul(packed("aGlass", "float").mul(interior)));
      const t = twin as unknown as { roughnessNode: N; emissiveNode: N };
      t.roughnessNode = varying(packed("aRough", "float"));
      t.emissiveNode = materialEmissive.add(varying(glow));
    },
  };
}

/** THE DOGS' STEAM (`dogs-view.ts`'s `steamMaterial`): WebGL draws its
 * puffs as `gl_PointSize` points, which WebGPU draws a pixel across. Here
 * each puff is a quad of its own over the points' own buffers
 * (`glow-tsl.ts`'s stands), as many pixels across as WebGL's point:
 * `aSize · uScale` over the depth. */
export function steamStand(points: THREE.Points): NodeMaterial {
  const m = points.material as THREE.ShaderMaterial;
  const scale = slot(m.uniforms.uScale, "float");
  const geo = points.geometry;
  const each = (name: string): N =>
    instancedBufferAttribute(perPoint(geo.getAttribute(name) as THREE.BufferAttribute) as never);
  const position = each("position");
  const alpha = each("aAlpha");
  const size = each("aSize");
  const vAlpha = varyingProperty("float", "vSteamAlpha");
  const vQ = varyingProperty("vec2", "vSteamQ");
  const vertex = Fn(() => {
    const mv = modelViewMatrix.mul(vec4(position, 1)).toVar();
    const px = size.mul(scale).div(max(mv.z.negate(), 0.1));
    const c = cameraProjectionMatrix.mul(mv).toVar();
    // The point's square, `px` pixels on a side, in clip space.
    const off = positionGeometry.xy.mul(px).div(screenSize).mul(c.w);
    vAlpha.assign(alpha);
    vQ.assign(positionGeometry.xy);
    return vec4(c.xy.add(off), c.z, c.w);
  })();
  const fragment = Fn(() => {
    const a = smoothstep(0.5, 0.1, length(vQ.mul(0.5))).mul(vAlpha);
    return vec4(0.92, 0.94, 0.96, a);
  })();
  return particleMaterial("dog-steam", m, vertex, fragment);
}
