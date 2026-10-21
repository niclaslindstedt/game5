// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW IN THE AIR ON THE NODE RENDERER (`docs/webgpu.md`, part 9): the
// node twins of `snowfall.ts`'s two draws, over their own uniforms by
// reference, term for term with the GLSL.
//
//   fallTwin     the FALL: one instanced quad a flake (already so on
//                WebGL), its place wrapped in the box about the lens, drawn
//                as the smear it sweeps over the shutter, a capsule of its
//                light; the lamps read once a flake.
//   driftStand   the SPINDRIFT: WebGL draws its grains as `gl_PointSize`
//                points, which WebGPU draws a pixel across. Here each grain
//                is a quad of its own — one instanced draw over the points'
//                own buffers (`glow-tsl.ts`'s stands) — as many device
//                pixels across as WebGL's point, so the look and the count
//                are the same.

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { airSlots, lampsAt, particleMaterial, sheltered } from "./air-tsl.ts";
import { perPoint } from "./glow-tsl.ts";
import type { HazeUniforms } from "./haze.ts";
import { slot, type N } from "./haze-tsl.ts";
import { FLAKE_PX, SMEAR_MAX, SMEAR_SPREAD, SMEAR_TAIL } from "./snowfall.ts";
import { BOX, MOTE_REACH, STREAKS } from "./snowfall-plan.ts";

const {
  Discard,
  Fn,
  If,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  cos,
  float,
  floor,
  instancedBufferAttribute,
  attribute,
  length,
  max,
  min,
  mix,
  modelViewMatrix,
  modelWorldMatrix,
  positionGeometry,
  pow,
  select,
  sin,
  smoothstep,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** A constant as the GLSL prints it (`toFixed`). */
const fixed = (n: number, d: number): number => Number(n.toFixed(d));

/** GLSL's `mod`: `x − y·floor(x / y)`, whatever the back end's `%` does. */
const wrap = (x: N, y: number): N => x.sub(floor(x.div(y)).mul(y));

/** THE FALL's twin over its ShaderMaterial `m` (`snowfall.ts`). */
export function fallTwin(m: THREE.ShaderMaterial, haze: HazeUniforms): NodeMaterial {
  const U = m.uniforms;
  const s = airSlots(haze);
  const shift = slot(U.uShift, "vec3");
  const cam = slot(U.uCam, "vec3");
  const time = slot(U.uTime, "float");
  const scale = slot(U.uScale, "float");
  const size0 = slot(U.uSize, "float");
  const mote = slot(U.uMote, "float");
  const lit = slot(U.uLit, "color");
  const airV = slot(U.uAir, "vec3");
  const shutter = slot(U.uShutter, "float");
  const pace = slot(U.uPace, "float");

  const vAlpha = varyingProperty("float", "vFlakeAlpha");
  const vCol = varyingProperty("vec3", "vFlakeCol");
  const vAt = varyingProperty("vec2", "vFlakeAt");
  const vLen = varyingProperty("float", "vFlakeLen");
  const vRad = varyingProperty("float", "vFlakeRad");

  const vertex = Fn(() => {
    const seed = attribute("aSeed", "vec4");
    const ph = seed.w.mul(43).toVar();
    // `flakeAt`: its seed in the box, carried, fluttering, wrapped.
    const p0 = seed.xyz.mul(BOX).add(shift).toVar();
    const p = vec3(
      p0.x.add(sin(time.mul(seed.w.add(0.8)).add(ph)).mul(0.35)),
      p0.y,
      p0.z.add(cos(time.mul(seed.w.add(0.7)).add(ph.mul(1.3))).mul(0.35)),
    );
    const head = wrap(p.sub(cam).add(BOX / 2), BOX)
      .sub(BOX / 2)
      .add(cam)
      .toVar();
    const vp = cameraProjectionMatrix.mul(cameraViewMatrix);
    const ch = vp.mul(vec4(head, 1)).toVar();
    const clip = vec4(2, 2, 2, 1).toVar();
    vAlpha.assign(0);
    // Behind the lens, or inside the cabin it is in: nothing to draw.
    If(ch.w.greaterThanEqual(0.05).and(sheltered(s, head).not()), () => {
      // `flutterOf`: how fast its flutter moves it.
      const flutter = vec3(
        cos(time.mul(seed.w.add(0.8)).add(ph))
          .mul(seed.w.add(0.8))
          .mul(0.35),
        0,
        sin(time.mul(seed.w.add(0.7)).add(ph.mul(1.3)))
          .negate()
          .mul(seed.w.add(0.7))
          .mul(0.35),
      );
      const tail = head.sub(airV.add(flutter).mul(shutter));
      const ct = vp.mul(vec4(tail, 1)).toVar();
      If(ct.w.lessThan(0.05), () => {
        ct.assign(mix(ch, ct, ch.w.sub(0.05).div(max(ch.w.sub(ct.w), 1e-4))));
      });
      // The picture in pixels, the same scale both ways.
      const px0 = cameraProjectionMatrix.mul(vec4(1, 0, 0, 0)).x;
      const py0 = cameraProjectionMatrix.mul(vec4(0, 1, 0, 0)).y;
      const halfPx = vec2(scale.div(px0), scale.div(py0)).toVar();
      const sh = ch.xy.div(ch.w).mul(halfPx).toVar();
      const smear = ct.xy.div(ct.w).mul(halfPx).sub(sh).toVar();
      const len0 = length(smear).toVar();
      const dir = select(len0.greaterThan(1e-3), smear.div(len0), vec2(1, 0)).toVar();
      const len = min(len0, halfPx.y.mul(2 * fixed(SMEAR_MAX, 2))).toVar();
      const depth = ch.w;
      const streak = pace.mul(mote).toVar();
      const size = seed.w
        .mul(0.05)
        .add(0.035)
        .mul(size0)
        .mul(mix(1, 0.35, mote))
        .mul(streak.mul(fixed(STREAKS.size, 2)).add(1));
      const px = size.mul(scale).div(depth).toVar();
      const wide = clamp(px, 1, fixed(FLAKE_PX.max, 1)).toVar();
      const rad = max(wide, fixed(FLAKE_PX.quad, 1)).mul(0.5).toVar();
      const along = mix(rad.negate(), len.add(rad), positionGeometry.x);
      const across = positionGeometry.y.mul(rad);
      const at = sh.add(dir.mul(along)).add(vec2(dir.y.negate(), dir.x).mul(across));
      clip.assign(vec4(at.div(halfPx).mul(ch.w), ch.z, ch.w));
      vAt.assign(vec2(along, across));
      vLen.assign(len);
      vRad.assign(rad);
      const dist = length(head.sub(cam));
      // Faint under a pixel, the box's edge faded, the air's crystals near
      // the lens only, a smear's light spread along it.
      const reach = mix(fixed(BOX / 2, 1), fixed(MOTE_REACH, 1), mote).toVar();
      vAlpha.assign(
        min(px, 1)
          .mul(smoothstep(reach, reach.mul(0.6), dist))
          .mul(smoothstep(0.25, 1, dist))
          .mul(mix(1, 0.6, mote))
          .mul(
            max(
              pow(wide.div(len.add(wide)), fixed(SMEAR_SPREAD, 2)),
              mix(0.15, fixed(STREAKS.floor, 2), streak),
            ),
          )
          .mul(streak.mul(fixed(STREAKS.light, 2)).add(1)),
      );
      vCol.assign(lit.add(lampsAt(s, head, 7)));
    });
    return clip;
  })();

  const fragment = Fn(() => {
    // A capsule: the flake's round head swept back along its smear.
    const q = clamp(vAt.x, 0, vLen).toVar();
    const r = length(vec2(vAt.x.sub(q), vAt.y))
      .div(vRad)
      .toVar();
    If(r.greaterThan(1), () => {
      Discard();
    });
    const soft = float(1).sub(r.mul(r));
    const tail = select(vLen.greaterThan(0), q.div(vLen), float(0));
    return vec4(
      vCol.mul(1.15),
      vAlpha
        .mul(soft)
        .mul(soft)
        .mul(mix(1, fixed(SMEAR_TAIL, 2), tail)),
    );
  })();

  return particleMaterial("snowfall", m, vertex, fragment);
}

/** THE SPINDRIFT's stand over its points `points` (`snowfall.ts`'s drift):
 * a quad a grain over the points' own buffers, `clamp(px, 1, 64)` device
 * pixels across as `gl_PointSize` is, its soft disc as `gl_PointCoord` cut
 * it. The mesh drawing it is a unit quad instanced once a grain. */
export function driftStand(points: THREE.Points, haze: HazeUniforms): NodeMaterial {
  const m = points.material as THREE.ShaderMaterial;
  const U = m.uniforms;
  const s = airSlots(haze);
  const scale = slot(U.uScale, "float");
  const lit = slot(U.uLit, "color");
  const geo = points.geometry;
  const position = instancedBufferAttribute(perPoint(geo.getAttribute("position") as never));
  const alpha = instancedBufferAttribute(perPoint(geo.getAttribute("aAlpha") as never));
  const vAlpha = varyingProperty("float", "vDriftAlpha");
  const vQ = varyingProperty("vec2", "vDriftQ");

  const vertex = Fn(() => {
    const clip = vec4(2, 2, 2, 1).toVar();
    vAlpha.assign(0);
    If(sheltered(s, modelWorldMatrix.mul(vec4(position, 1)).xyz).not(), () => {
      const mv = modelViewMatrix.mul(vec4(position, 1)).toVar();
      const px = scale.mul(0.22).div(max(mv.z.negate(), 0.1)).toVar();
      const across = clamp(px, 1, 64);
      vAlpha.assign(alpha.mul(min(px, 1)));
      const c = cameraProjectionMatrix.mul(mv).toVar();
      // The point's square, `across` device pixels on a side, in the
      // picture's own pixels as the fall counts them (`halfPx`): half the
      // picture's width and height, off the lens and `uScale`.
      const halfPx = vec2(
        scale.div(cameraProjectionMatrix.mul(vec4(1, 0, 0, 0)).x),
        scale.div(cameraProjectionMatrix.mul(vec4(0, 1, 0, 0)).y),
      );
      const off = positionGeometry.xy.mul(across.mul(0.5)).div(halfPx).mul(c.w);
      clip.assign(vec4(c.xy.add(off), c.z, c.w));
      vQ.assign(positionGeometry.xy);
    });
    return clip;
  })();

  const fragment = Fn(() => {
    const r = vQ.dot(vQ).toVar();
    If(r.greaterThan(1), () => {
      Discard();
    });
    const one = float(1).sub(r);
    return vec4(lit, vAlpha.mul(one).mul(one).mul(0.35));
  })();

  return particleMaterial("spindrift", m, vertex, fragment);
}
