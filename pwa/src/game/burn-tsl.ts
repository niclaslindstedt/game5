// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKIER BURNING ON THE NODE RENDERER (`docs/webgpu.md`, part 12): the node
// twins of `burn-view.ts`'s four draws, over their shared uniforms by
// reference, each vertex half term for term with its GLSL and its fragment
// the fire's own (`fire-tsl.ts`):
//
//   burn-flames   two tongues a patch of him alight, turned to the lens
//   burn-glow     the soft glow round him, wide at night
//   burn-sparks   the sparks and the embers, additive
//   burn-smoke    the smoke off his melting clothes

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { particleMaterial } from "./air-tsl.ts";
import { PROUD } from "./burn-view.ts";
import { fadeAt, fireVaryings, flameFragment, smokeFragment, sparkFragment } from "./fire-tsl.ts";
import { shaderOwn } from "./figure-tsl.ts";
import type { N } from "./haze-tsl.ts";

const {
  Discard,
  Fn,
  If,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  cos,
  fract,
  length,
  max,
  min,
  mix,
  normalize,
  positionGeometry,
  sin,
  smoothstep,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** The twin for burn flag `kind` over `m`, or null for one not a burn's. */
export function burnTwin(m: THREE.ShaderMaterial, kind: string): NodeMaterial | null {
  const time = shaderOwn("uTime", "float");
  const reach = shaderOwn("uReach", "float");
  const haze = shaderOwn("uHaze", "float");
  const fade = (dist: N): N => fadeAt(dist, reach, haze);
  const V = fireVaryings();
  const position = positionGeometry;
  switch (kind) {
    case "burn-flames": {
      const wind = shaderOwn("uWind", "vec3");
      const vertex = Fn(() => {
        const base = attribute("aBase", "vec4");
        const size = attribute("aSize", "vec3");
        const s = base.w;
        const breathe = sin(time.mul(6.1).add(s.mul(17.3)))
          .mul(0.16)
          .add(0.78)
          .add(sin(time.mul(13.3).add(s.mul(31.1))).mul(0.1));
        const h = size.y.mul(breathe).toVar();
        const toEye = cameraPosition.sub(base.xyz).toVar();
        const far = length(toEye).toVar();
        const side = normalize(vec2(toEye.z, toEye.x.negate()).add(vec2(1e-5, 0))).toVar();
        const v = position.y;
        const p = base.xyz.add(toEye.div(max(far, 1e-3)).mul(Number(PROUD.toFixed(2)))).toVar();
        p.addAssign(vec3(side.x, 0, side.y).mul(position.x).mul(size.x).mul(0.5));
        p.addAssign(vec3(0, v.sub(0.12).mul(h), 0));
        const lay = wind.xz.mul(0.06).toVar();
        lay.divAssign(max(1, length(lay).div(0.7)));
        const off = lay.mul(h).mul(v).mul(v);
        p.addAssign(vec3(off.x, 0, off.y));
        V.uv.assign(vec2(position.x, v));
        V.seed.assign(s);
        V.fade.assign(size.z.mul(fade(far)).mul(smoothstep(0.3, 1, far)));
        return cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(p, 1));
      })();
      return particleMaterial("burn-flames", m, vertex, flameFragment(time));
    }
    case "burn-glow": {
      const night = shaderOwn("uNight", "float");
      const glow = shaderOwn("uGlow", "float");
      const vAlpha = varyingProperty("float", "vBurnGlow");
      const vertex = Fn(() => {
        const g = attribute("aGlow", "vec4");
        const size = g.w.mul(mix(0.8, 1.25, night)).toVar();
        const mv = cameraViewMatrix.mul(vec4(g.xyz, 1)).toVar();
        const dist = length(mv.xyz).toVar();
        mv.assign(
          vec4(mv.xyz.add(normalize(mv.xyz.negate()).mul(min(size.mul(0.5), dist.mul(0.5)))), mv.w),
        );
        mv.assign(vec4(mv.xy.add(position.xy.mul(size)), mv.z, mv.w));
        V.uv.assign(position.xy);
        const flick = sin(time.mul(7.3))
          .mul(0.1)
          .add(0.9)
          .add(sin(time.mul(15.1)).mul(0.06));
        vAlpha.assign(
          glow
            .mul(mix(0.3, 0.42, night))
            .mul(flick)
            .mul(fade(dist))
            .mul(smoothstep(0.6, 2.5, dist)),
        );
        return cameraProjectionMatrix.mul(mv);
      })();
      const fragment = Fn(() => {
        const r = length(V.uv).toVar();
        If(r.greaterThan(1), () => {
          Discard();
        });
        const g0 = r.oneMinus();
        return vec4(vec3(1, 0.45, 0.12).mul(g0.mul(g0).mul(g0)).mul(vAlpha), 1);
      })();
      return particleMaterial("burn-glow", m, vertex, fragment);
    }
    case "burn-sparks": {
      const vertex = Fn(() => {
        const spark = attribute("aSpark", "vec4");
        const life = attribute("aSparkLife", "vec2");
        const mv = cameraViewMatrix.mul(vec4(spark.xyz, 1)).toVar();
        const dist = length(mv.xyz).toVar();
        mv.assign(vec4(mv.xy.add(position.xy.mul(max(spark.w, dist.mul(0.0016)))), mv.z, mv.w));
        V.uv.assign(position.xy);
        V.heat.assign(life.y);
        V.alpha.assign(life.x.mul(fade(dist)).mul(smoothstep(250, 120, dist)));
        return cameraProjectionMatrix.mul(mv);
      })();
      return particleMaterial("burn-sparks", m, vertex, sparkFragment());
    }
    case "burn-smoke": {
      const night = shaderOwn("uNight", "float");
      const lit = shaderOwn("uLit", "color");
      const vertex = Fn(() => {
        const puff = attribute("aPuff", "vec4");
        const life = attribute("aPuffLife", "vec4");
        const mv = cameraViewMatrix.mul(vec4(puff.xyz, 1)).toVar();
        const dist = length(mv.xyz).toVar();
        const spin = life.y.toVar();
        const q = vec2(
          cos(spin).mul(position.x).sub(sin(spin).mul(position.y)),
          sin(spin).mul(position.x).add(cos(spin).mul(position.y)),
        );
        mv.assign(vec4(mv.xy.add(q.mul(puff.w)), mv.z, mv.w));
        V.uv.assign(position.xy);
        V.seed.assign(fract(life.y.mul(0.159)));
        V.alpha.assign(life.x.mul(fade(dist)).mul(smoothstep(0.4, 1.5, dist)));
        V.col.assign(lit.mul(life.z).add(vec3(1, 0.4, 0.1).mul(night).mul(0.16).mul(life.w)));
        return cameraProjectionMatrix.mul(mv);
      })();
      return particleMaterial("burn-smoke", m, vertex, smokeFragment());
    }
    default:
      return null;
  }
}
