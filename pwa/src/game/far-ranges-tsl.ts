// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FAR RANGES ON THE NODE RENDERER (`docs/webgpu.md`, part 3): the node
// twin the webgpu paths draw `far-ranges.ts`'s ShaderMaterials with — the
// rings pinned in front of the far plane and the map's own disc at its
// depth, each vertex let down by the Earth's curve, lit by the key at the
// face's own height (`uBand`, cut under its horizon `aHorizon`) and the
// sky's hemisphere, then hazed as `HAZE_FRAGMENT` hazes them with the far
// country's thinner air and the mist let go past its wall (`farAir`,
// `farMist`). Every uniform is the ShaderMaterial's own, read by
// reference; the GLSL is the authority, term for term.
//
// And `farRimAt` / `rimRise` (`FAR_RIM_GLSL`): the rim the clipmap carries
// past the map's edge, for the terrain's own twin (part 4).

import type * as THREE from "three";
import * as TSL from "three/tsl";
import { NodeMaterial } from "three/webgpu";

import { FAR_AIR, FAR_MIST_FADE } from "./far-ranges-plan.ts";
import type { HazeUniforms } from "./haze.ts";
import { hazeMist, hazeOver, hazeSlots, slot, type HazeFogOptions, type N } from "./haze-tsl.ts";
import { FAR_RADIUS } from "./horizon.ts";

// Read untyped, as every node here is (`haze-tsl.ts`'s `N`).
const {
  Discard,
  Fn,
  If,
  asin,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  dot,
  exp,
  float,
  int,
  ivec2,
  length,
  max,
  min,
  mix,
  normalize,
  positionGeometry,
  select,
  smoothstep,
  textureLoad,
  varying,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** The far ranges' node twin over one of their ShaderMaterials `m` (the
 * rings' or the disc's: `uBackdrop` tells them apart); `how` is where the
 * haze is mixed (`gpu-dress.ts`). */
export function farTwin(
  m: THREE.ShaderMaterial,
  haze: HazeUniforms,
  how: HazeFogOptions,
): NodeMaterial {
  const U = m.uniforms;
  const s = hazeSlots(haze);
  const bandY = slot(U.uBandY, "vec4");
  const band = slot(U.uBand, "vec3");
  const keyDir = slot(U.uKeyDir, "vec3");
  const skyLight = slot(U.uSkyLight, "vec3");
  const groundLight = slot(U.uGroundLight, "vec3");
  const ambient = slot(U.uAmbient, "float");
  const backdrop = slot(U.uBackdrop, "float");
  const near = slot(U.uNear, "float");
  const drop = 1 / (2 * FAR_RADIUS);

  // The Earth's curve, refracted: the ground falls away under the lens with
  // the square of the distance.
  const curved = Fn(() => {
    const w = positionGeometry.toVar();
    const off = w.xz.sub(cameraPosition.xz);
    return vec3(w.x, w.y.sub(dot(off, off).mul(drop)), w.z);
  })();
  const world = varying(curved, "vFarWorld");
  const albedo = varying(attribute("aAlbedo", "vec3"), "vFarAlbedo");
  const horizon = varying(attribute("aHorizon", "float"), "vFarHorizon");
  const normal = varying(attribute("normal", "vec3"), "vFarNormal");

  /** The key at height `y`: between the bands it was reckoned at (`keyAt`). */
  const keyAt = (y: N): N => {
    const b0 = band.element(0);
    const b1 = band.element(1);
    const b2 = band.element(2);
    const b3 = band.element(3);
    const k = mix(b2, b3, clamp(y.sub(bandY.z).div(bandY.w.sub(bandY.z)), 0, 1)).toVar();
    If(y.lessThanEqual(bandY.z), () => {
      k.assign(mix(b1, b2, y.sub(bandY.y).div(bandY.z.sub(bandY.y))));
    });
    If(y.lessThanEqual(bandY.y), () => {
      k.assign(mix(b0, b1, y.sub(bandY.x).div(bandY.y.sub(bandY.x))));
    });
    If(y.lessThanEqual(bandY.x), () => {
      k.assign(b0);
    });
    return k;
  };

  const twin = new NodeMaterial();
  twin.name = "far-ranges";
  twin.depthWrite = m.depthWrite;
  twin.depthTest = m.depthTest;
  twin.fog = false;
  twin.lights = false;
  twin.vertexNode = Fn(() => {
    const clip = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(curved, 1)).toVar();
    // The rings stand just in front of the far plane, behind everything.
    return select(
      backdrop.greaterThan(0.5),
      vec4(clip.x, clip.y, clip.w.mul(0.9999999), clip.w),
      clip,
    );
  })();
  twin.fragmentNode = Fn(() => {
    const ray0 = world.sub(cameraPosition).toVar();
    // The disc stands only where the clipmap does not.
    If(near.greaterThan(0).and(length(ray0.xz).lessThan(near)), () => {
      Discard();
    });
    const n = normalize(normal).toVar();
    const up = asin(clamp(keyDir.y, -1, 1));
    const lit = smoothstep(-0.006, 0.006, up.sub(horizon));
    // The height the key is read at is the ground's own, the curve's drop
    // given back.
    const y = world.y.add(dot(ray0.xz, ray0.xz).mul(drop));
    const key = keyAt(y)
      .mul(max(dot(n, keyDir), 0))
      .mul(lit);
    const hemi = mix(groundLight, skyLight, n.y.mul(0.5).add(0.5)).mul(ambient);
    const col = albedo.mul(key.add(hemi)).div(Math.PI);
    // The air between the ranges: the game's haze over the map's scale,
    // the clear air's past it; and the mist let go again past its wall.
    const air = (dist: N): N =>
      min(dist, FAR_AIR.near).add(max(dist.sub(FAR_AIR.near), 0).mul(FAR_AIR.thin));
    const mist = (dist: N, rise: N): N => {
      const go = exp(max(dist.sub(s.mist), 0).negate().div(FAR_MIST_FADE));
      return hazeMist(s, dist, rise).mul(mix(go, float(1), s.mistOpen));
    };
    return vec4(hazeOver(haze, how, col, world, { air, mist }), 1);
  })();
  return twin;
}

/** THE RIM past the map's edge (`FAR_RIM_GLSL`'s `farRimAt`): the rim's
 * height at plan point `p`, read with four exact fetches off `rim` (the
 * float texture `far-ranges.ts` writes into `uFarRim`) laid out by `box`. */
export function farRimAt(rim: N, box: N, p: N): N {
  const f = clamp(p.sub(box.xy).div(box.z), vec2(0), vec2(box.w.sub(1.001))).toVar();
  const cx = int(f.x.floor()).toVar();
  const cy = int(f.y.floor()).toVar();
  const t = f.sub(vec2(float(cx), float(cy)));
  const at = (dx: number, dy: number): N => textureLoad(rim, ivec2(cx.add(dx), cy.add(dy))).r;
  return mix(mix(at(0, 0), at(1, 0), t.x), mix(at(0, 1), at(1, 1), t.x), t.y);
}

/** The rim's rise from `q` (the edge) to `p` (`rimRise`); none off. */
export function rimRise(rim: N, box: N, p: N, q: N): N {
  return select(
    box.w.lessThan(2).or(length(p.sub(q)).lessThanEqual(0)),
    float(0),
    farRimAt(rim, box, p).sub(farRimAt(rim, box, q)),
  );
}
