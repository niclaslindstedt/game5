// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPRAY ON THE NODE RENDERER (`docs/webgpu.md`, part 9): the node twin
// of `spray-glsl.ts`'s `sprayVertex` and `SPRAY_FRAGMENT`, over the spray
// material's own uniforms by reference, for both ways of flying it — the
// CPU pool's packed grains (`poolParcel`) and the GPU ring's parcels flown
// in the vertex stage (`ringParcel`, `spray-flight-tsl.ts`). From there a
// grain is drawn ONE way, as on WebGL: the streak over the shutter, the
// ragged lump or the little volume of grains, the sky's light on four faces
// and the key by height (`air-tsl.ts`), the forward scatter, the glints,
// the lamps and the haze. The GLSL is the authority, term for term; what a
// grain looks like and why is `spray.ts`'s header.
//
// Already one instanced quad a grain on WebGL (no `gl_PointSize`), so the
// count, the share and the draw are the same on every back end.

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import {
  airHaze,
  airLight,
  airSky,
  airSlots,
  lampsThrough,
  particleMaterial,
  sheltered,
} from "./air-tsl.ts";
import type { HazeUniforms } from "./haze.ts";
import { slot, type HazeFogOptions, type N } from "./haze-tsl.ts";
import { snowHash1, snowNoise } from "./snow-noise-tsl.ts";
import { poolParcel, ringParcel } from "./spray-flight-tsl.ts";

const {
  Discard,
  Fn,
  If,
  atan,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  dot,
  float,
  floor,
  fract,
  length,
  max,
  min,
  mix,
  modelViewMatrix,
  normalize,
  positionGeometry,
  pow,
  screenCoordinate,
  select,
  smoothstep,
  sqrt,
  step,
  transpose,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** The spray's node twin over its ShaderMaterial `m`: `ring` the GPU's
 * flight (`gpu-spray.ts`), else the CPU pool's (`spray.ts`). */
export function sprayTwin(
  m: THREE.ShaderMaterial,
  haze: HazeUniforms,
  how: HazeFogOptions,
  ring: boolean,
): NodeMaterial {
  const U = m.uniforms;
  const s = airSlots(haze);
  const scale = slot(U.uScale, "float");
  const shutter = slot(U.uShutter, "float");
  const time = slot(U.uTime, "float");
  const keyCol = slot(U.uKeyCol, "color");
  const flat = slot(haze.uFlat, "float");
  const sunDir = s.light.sunDir;

  const v = {
    uv: varyingProperty("vec2", "vSprayUv"),
    alpha: varyingProperty("float", "vSprayAlpha"),
    hard: varyingProperty("float", "vSprayHard"),
    glint: varyingProperty("float", "vSprayGlint"),
    seed: varyingProperty("float", "vSpraySeed"),
    size: varyingProperty("float", "vSpraySize"),
    pix: varyingProperty("float", "vSprayPix"),
    sunSide: varyingProperty("vec2", "vSpraySunSide"),
    axisW: varyingProperty("vec3", "vSprayAxisW"),
    sideW: varyingProperty("vec3", "vSpraySideW"),
    world: varyingProperty("vec3", "vSprayWorld"),
  };
  const air = {
    key: varyingProperty("vec3", "vAirKey"),
    up: varyingProperty("vec3", "vAirUp"),
    down: varyingProperty("vec3", "vAirDown"),
    to: varyingProperty("vec3", "vAirTo"),
    from: varyingProperty("vec3", "vAirFrom"),
  };

  const vertex = Fn(() => {
    const P = ring ? ringParcel(slot(U.uNow, "float"), slot(U.uOldest, "float")) : poolParcel();
    // A dead slot: behind the lens, before any light is read for it.
    const clip = vec4(0, 0, 2, 1).toVar();
    v.alpha.assign(0);
    If(P.ok, () => {
      const head = modelViewMatrix.mul(vec4(P.world, 1)).toVar();
      // The streak: where it was a shutter ago, a clump streaked less.
      const back = P.world.sub(P.move.mul(shutter).mul(float(1).sub(P.hard.mul(0.75))));
      const tail = modelViewMatrix.mul(vec4(back, 1)).toVar();
      const depth = max(head.z.negate(), 0.1).toVar();
      const drawn = P.size.mul(float(1).sub(P.hard.mul(0.45)));
      const r = max(drawn.mul(0.5), depth.mul(0.9).div(scale)).toVar();
      const d = head.xy.sub(tail.xy).toVar();
      const len = length(d).toVar();
      const axis = select(len.greaterThan(1e-4), d.div(len), vec2(0, 1)).toVar();
      const side = vec2(axis.y.negate(), axis.x).toVar();
      const mid = head.xyz.add(tail.xyz).mul(0.5);
      const along = r.add(len.mul(0.5)).toVar();
      const g = positionGeometry;
      const at = mid.add(vec3(axis.mul(along).mul(g.x).add(side.mul(r).mul(g.y)), 0)).toVar();
      v.uv.assign(g.xy);
      v.alpha.assign(P.alpha.mul(sqrt(r.div(along))).mul(smoothstep(0.7, 2.2, depth)));
      v.hard.assign(P.hard);
      v.glint.assign(P.glint);
      v.seed.assign(P.seed);
      v.size.assign(P.size);
      v.pix.assign(r.mul(scale).div(depth));
      const sv = cameraViewMatrix.mul(vec4(normalize(sunDir), 0)).xy.toVar();
      const sl = length(sv);
      const sunView = select(sl.greaterThan(1e-3), sv.div(sl), vec2(0, 1)).toVar();
      v.sunSide.assign(vec2(dot(sunView, axis), dot(sunView, side)));
      const back3 = transpose(cameraViewMatrix);
      v.axisW.assign(back3.mul(vec4(axis, 0, 0)).xyz);
      v.sideW.assign(back3.mul(vec4(side, 0, 0)).xyz);
      v.world.assign(P.world);
      // The sky's light where the grain is (`snow-air-light.ts`).
      const a = airLight(s, keyCol, P.world);
      air.key.assign(a.key);
      air.up.assign(a.up);
      air.down.assign(a.down);
      air.to.assign(a.to);
      air.from.assign(a.from);
      If(P.alpha.lessThanEqual(0), () => {
        at.assign(vec3(0, 0, 1)); // dead: behind the lens
      });
      clip.assign(cameraProjectionMatrix.mul(vec4(at, 1)));
    });
    return clip;
  })();

  const fragment = Fn(() => {
    const uv = v.uv;
    const r = dot(uv, uv).toVar();
    If(r.greaterThan(1).or(sheltered(s, v.world)), () => {
      Discard();
    });
    const seed = v.seed;
    const hard = v.hard;
    const size = v.size;
    const o = vec2(seed.mul(17.3), seed.mul(41.9)).toVar();
    // THE SILHOUETTE: a clump's broken rim, a grain's speck, a big soft
    // one's wisp eroded by a noise.
    const ang = atan(uv.y, uv.x);
    const rim = snowNoise(vec2(ang.mul(1.1).add(o.x), o.y))
      .mul(0.28)
      .add(0.72)
      .add(snowNoise(vec2(ang.mul(2.6).sub(o.y), o.x)).mul(0.1))
      .toVar();
    const rc = r.div(rim.mul(rim));
    const wisp = smoothstep(0.08, 0.35, size).mul(float(1).sub(hard));
    const n = snowNoise(uv.mul(2.2).add(o))
      .mul(0.65)
      .add(snowNoise(uv.mul(5.3).sub(o)).mul(0.35))
      .toVar();
    const one = float(1).sub(r).toVar();
    const grain = one.mul(one);
    const puffy = clamp(one.mul(n.mul(1.1).add(0.35)).sub(0.28), 0, 1).toVar();
    // Only a true clump is one lump; softer, seen close, a little volume
    // of grains in a haze of the fines.
    const clumpy = smoothstep(0.72, 0.95, hard).toVar();
    const q = uv.mul(3.2).add(o);
    const ci = floor(q).toVar();
    const cf = fract(q).sub(0.5);
    const hr = snowHash1(ci.add(o)).toVar();
    const jit = vec2(snowHash1(ci.add(3.1)), snowHash1(ci.add(7.7))).sub(0.5);
    const dotR = hr.mul(0.2).add(0.12).toVar();
    const speck = smoothstep(dotR, dotR.mul(0.45), length(cf.sub(jit.mul(0.55)))).mul(
      step(0.3, hr),
    );
    const cluster = speck.mul(one).mul(hr.mul(0.35).add(0.75)).add(puffy.mul(0.22));
    const close = smoothstep(3, 9, v.pix).toVar();
    const soft = mix(grain, mix(cluster, puffy.mul(0.45), wisp.mul(0.6)), close);
    const body = mix(soft, smoothstep(1, 0.7, rc), clumpy).toVar();
    If(body.lessThanEqual(0.003), () => {
      Discard();
    });
    // Spread thin: a puff grown many times its first size.
    const thin = mix(
      float(1),
      clamp(float(0.09).div(max(size, 1e-3)), 0.4, 1),
      float(1).sub(clumpy),
    );
    const ray = v.world.sub(cameraPosition).toVar();
    const dist = length(ray).toVar();
    const view = ray.div(max(dist, 1e-3)).toVar();
    // THE LIGHT: a clump's facets, a grain's self-shaded volume.
    const facet = normalize(
      uv
        .add(
          vec2(snowNoise(uv.mul(3).add(o)), snowNoise(uv.mul(3).sub(o)))
            .sub(0.5)
            .mul(1.2),
        )
        .add(1e-4),
    ).toVar();
    const face = mix(uv, facet, clumpy);
    const N = normalize(
      v.axisW
        .mul(face.x)
        .add(v.sideW.mul(face.y))
        .sub(view.mul(float(0.7).sub(clumpy.mul(0.3)))),
    );
    const toSun = dot(facet, v.sunSide);
    const litClump = clamp(toSun.mul(0.55).add(0.5), 0, 1);
    const litSoft = clamp(mix(0.62, 0.42, close).add(dot(uv, v.sunSide).mul(0.3)), 0, 1);
    const lit = mix(litSoft, litClump, clumpy);
    const col = airSky(s, air, N)
      .mul(float(1).sub(hard.mul(0.25)))
      .add(
        air.key
          .mul(lit)
          .mul(1.35)
          .mul(float(1).sub(flat.mul(0.7))),
      )
      .toVar();
    // FORWARD SCATTER (Henyey–Greenstein, g 0.78), weighted to the thin.
    const mu = dot(view, normalize(sunDir));
    const gg = 0.78;
    const hg = float(1 - gg * gg)
      .div(pow(float(1 + gg * gg).sub(mu.mul(2 * gg)), 1.5))
      .toVar();
    const through = float(1)
      .sub(clumpy.mul(0.75))
      .mul(float(1).sub(body.mul(0.55)));
    const above = smoothstep(-0.02, 0.06, sunDir.y).toVar();
    col.addAssign(
      air.key
        .mul(hg)
        .mul(through)
        .mul(above)
        .mul(0.3)
        .mul(float(1).sub(flat.mul(0.8))),
    );
    // GLINTS: a crystal catching the sun as it turns, a pixel each.
    const gp = screenCoordinate.xy;
    const flick = snowHash1(
      floor(gp).add(vec2(seed.mul(97), floor(time.mul(14).add(seed.mul(31))))),
    );
    const odds = hard
      .mul(0.05)
      .add(0.03)
      .mul(v.glint)
      .mul(min(hg.div(12), 3).mul(0.4).add(0.4));
    col.addAssign(
      air.key
        .mul(step(float(1).sub(odds), flick))
        .mul(body)
        .mul(6)
        .mul(above),
    );
    // THE LAMPS after dark.
    col.addAssign(lampsThrough(s, v.world, view));
    const out = col.mul(0.96);
    return vec4(airHaze(haze, how, out, v.world), body.mul(v.alpha).mul(thin));
  })();

  return particleMaterial(ring ? "spray-gpu" : "spray", m, vertex, fragment);
}
