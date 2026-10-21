// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW GUNS' PLUMES ON THE NODE RENDERER (`docs/webgpu.md`, part 9): the
// node twin of `snow-gun-plume.ts`'s draw over its own uniforms by
// reference, term for term with the GLSL — every puff a pure function of
// the clock (the jet off the drum's aim as it stood when the puff left,
// slowed by the air toward the wind and its settling, swelling as it goes),
// lit by the key and the sky, brighter into a low sun, by the lamps after
// dark, and faded into the air. Already one instanced quad a puff on WebGL.

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { airSlots, lampsAt, particleMaterial } from "./air-tsl.ts";
import type { HazeUniforms } from "./haze.ts";
import { slot, type N } from "./haze-tsl.ts";

const {
  Discard,
  Fn,
  If,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  cos,
  dot,
  exp,
  float,
  floor,
  fract,
  length,
  max,
  mix,
  positionGeometry,
  pow,
  select,
  sin,
  smoothstep,
  sqrt,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

const TAU = 6.2831853;

/** The plumes' twin over their ShaderMaterial `m` (`createPlumes`). */
export function plumeTwin(m: THREE.ShaderMaterial, haze: HazeUniforms): NodeMaterial {
  const U = m.uniforms;
  const s = airSlots(haze);
  const time = slot(U.uTime, "float");
  const wind = slot(U.uWind, "vec3");
  const lit = slot(U.uLit, "color");
  const shadeC = slot(U.uShade, "color");
  const sun = slot(U.uSun, "vec3");
  const sunCol = slot(U.uSunCol, "color");
  const hazeK = slot(U.uHaze, "float");
  const mist = slot(U.uMist, "float");
  const period = slot(U.uPeriod, "float");
  const reachU = slot(U.uReach, "float");
  const vAt = varyingProperty("vec2", "vPlumeAt");
  const vAlpha = varyingProperty("float", "vPlumeAlpha");
  const vCol = varyingProperty("vec3", "vPlumeCol");

  const vertex = Fn(() => {
    const nozzle = attribute("aNozzle", "vec4");
    const ground = attribute("aGround", "vec4");
    const jet = attribute("aJet", "vec4");
    const puff = attribute("aPuff", "vec4");
    const seed = attribute("aSeed", "vec4");
    const foot = attribute("aFoot", "vec4");
    const drag = puff.x;
    const settle = puff.y;
    const life = puff.z;
    const spread = puff.w;
    // Its age (GLSL's `mod`), and the moment it left the nozzle.
    const x = time.add(seed.x.mul(life));
    const tau = x.sub(floor(x.div(life)).mul(life)).toVar();
    const left = time.sub(tau);
    // The aim as it stood then, scattered over the cone.
    const r = spread.mul(sqrt(seed.y)).toVar();
    const a = seed.z.mul(TAU).toVar();
    const yaw = nozzle.w
      .add(jet.z.mul(sin(left.mul(TAU).div(period).add(jet.w))))
      .add(r.mul(cos(a)))
      .toVar();
    const tilt = jet.y.add(r.mul(sin(a))).toVar();
    const dir = vec3(sin(yaw).mul(cos(tilt)), sin(tilt), cos(yaw).mul(cos(tilt)));
    const speed = jet.x.mul(fract(seed.w.mul(7.31)).mul(0.4).add(0.8));
    // Slowed toward the wind, falling at the speed it settles at.
    const slow = float(1)
      .sub(exp(drag.negate().mul(tau)))
      .div(drag);
    const term = wind.sub(vec3(0, settle.mul(seed.y.mul(0.4).add(0.8)), 0)).toVar();
    const p = nozzle.xyz.add(dir.mul(speed).sub(term).mul(slow)).add(term.mul(tau)).toVar();
    const floorY = ground.x.add(ground.y.mul(p.x.sub(foot.x))).add(ground.z.mul(p.z.sub(foot.y)));
    const above = p.y.sub(floorY);
    const grow = clamp(tau.div(life), 0, 1);
    const size = foot.z.add(foot.w.mul(tau).mul(seed.w.mul(0.6).add(0.7))).toVar();
    const eye = cameraPosition.sub(p).toVar();
    const dist = length(eye).toVar();
    const alpha = ground.w
      .mul(smoothstep(0, 0.04, tau))
      .mul(float(1).sub(grow))
      .div(size.mul(size).mul(0.18).add(1))
      .mul(smoothstep(0, 1.5, above))
      .mul(smoothstep(reachU, reachU.mul(0.7), dist))
      .mul(exp(dist.negate().mul(hazeK).mul(0.9)))
      .mul(select(mist.greaterThan(0), smoothstep(mist, mist.mul(0.8), dist), float(1)))
      // A puff right at the lens is not drawn into it.
      .mul(smoothstep(1, 4, dist))
      .toVar();
    vAlpha.assign(alpha);
    const core = exp(tau.mul(-0.9));
    // Lit by the key and the sky; brighter into the sun through it.
    const view = eye.negate().div(max(dist, 1e-3));
    const forward = pow(max(dot(view, sun), 0), 6);
    vCol.assign(
      mix(lit, shadeC, core.mul(0.12))
        .add(
          sunCol
            .mul(forward)
            .mul(0.35)
            .mul(smoothstep(0, 0.1, sun.y)),
        )
        .add(lampsAt(s, p, 5)),
    );
    const clip = vec4(2, 2, 2, 1).toVar();
    If(alpha.greaterThanEqual(0.002).and(dist.lessThanEqual(reachU)), () => {
      const mv = cameraViewMatrix.mul(vec4(p, 1)).toVar();
      // Turned a little each, so the puffs never line up.
      const spin = seed.w.mul(TAU).add(tau.mul(0.3)).toVar();
      const g = positionGeometry;
      const q = vec2(
        cos(spin).mul(g.x).sub(sin(spin).mul(g.y)),
        sin(spin).mul(g.x).add(cos(spin).mul(g.y)),
      );
      clip.assign(cameraProjectionMatrix.mul(vec4(mv.xy.add(q.mul(size)), mv.z, mv.w)));
      vAt.assign(g.xy);
    });
    return clip;
  })();

  const fragment = Fn(() => {
    const r = dot(vAt, vAt).toVar();
    If(r.greaterThan(1), () => {
      Discard();
    });
    // A soft puff with a little grain in it, so the cone reads as ice.
    const one = float(1).sub(r);
    const grain = fract(sin(dot(floor(vAt.mul(6)), vec2(12.9898, 78.233))).mul(43758.5))
      .mul(0.2)
      .add(0.8);
    return vec4(vCol, vAlpha.mul(one).mul(one).mul(grain));
  })();

  return particleMaterial("snow-gun-plumes", m, vertex, fragment);
}
