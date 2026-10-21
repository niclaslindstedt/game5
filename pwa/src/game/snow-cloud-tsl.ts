// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW CLOUD ON THE NODE RENDERER (`docs/webgpu.md`, part 9): the node
// twins of `snow-cloud-glsl.ts`'s puff and `snow-cloud-shadow.ts`'s blot on
// the slope, over their own uniforms by reference, term for term with the
// GLSL (what each is and why is in those files' headers).
//
//   cloudTwin    a puff: a camera-facing quad (instanced on every back end)
//                shaded as a small volume — the warped, eroded body off the
//                noise texture, the whole cloud's shadow on it, two lobes of
//                forward scatter, the glints, the lamps, the haze;
//   shadowTwin   its shadow laid in the plane of the snow, a MULTIPLY over
//                what is drawn (the ShaderMaterial's own blending), the key's
//                share of the snow's light taken and no more.
//
// The noise is read at its first level (`level(0)`): it has no mips, so
// that is the texel WebGL's implicit read finds, and it may then be read
// after a fragment is let go, outside uniform control flow.

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import {
  airHaze,
  airLight,
  airSky,
  airSlots,
  hazeAmount,
  lampsThrough,
  particleMaterial,
  sheltered,
} from "./air-tsl.ts";
import type { HazeUniforms } from "./haze.ts";
import { slot, tap, type HazeFogOptions, type N } from "./haze-tsl.ts";
import { keyAtHeight, terrainLit } from "./lights-tsl.ts";
import { DARK, FILL, STRETCH } from "./snow-cloud-shadow.ts";
import { skyIrradiance } from "./snow-light-tsl.ts";
import { snowHash1 } from "./snow-noise-tsl.ts";

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
  cross,
  dot,
  exp,
  float,
  floor,
  fract,
  length,
  max,
  min,
  mix,
  normalize,
  positionGeometry,
  pow,
  screenCoordinate,
  select,
  sin,
  smoothstep,
  sqrt,
  step,
  texture,
  transpose,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

const LUMA = vec3(0.2126, 0.7152, 0.0722);

/** The lens's right, up and forward in the world (`viewMatrix`'s rows). */
function lensAxes(): { R: N; Up: N; fwd: N } {
  const t = transpose(cameraViewMatrix);
  return {
    R: t.mul(vec4(1, 0, 0, 0)).xyz,
    Up: t.mul(vec4(0, 1, 0, 0)).xyz,
    fwd: t.mul(vec4(0, 0, 1, 0)).xyz.negate(),
  };
}

/** A PUFF'S twin over the cloud's ShaderMaterial `m` (`snow-cloud.ts`). */
export function cloudTwin(
  m: THREE.ShaderMaterial,
  haze: HazeUniforms,
  how: HazeFogOptions,
): NodeMaterial {
  const U = m.uniforms;
  const s = airSlots(haze);
  const keyCol = slot(U.uKeyCol, "color");
  const near = slot(U.uNear, "float");
  const focus = slot(U.uFocus, "vec4");
  const uKey = slot(U.uKey, "vec3");
  const glintU = slot(U.uGlint, "float");
  const time = slot(U.uTime, "float");
  const night = slot(U.uNight, "float");
  const flat = slot(haze.uFlat, "float");
  const noise = texture(U.uNoise.value as THREE.Texture);
  const tex = (uv: N): N => tap(noise, uv).level(0);

  const v = {
    uv: varyingProperty("vec2", "vPuffUv"),
    spin: varyingProperty("vec2", "vPuffSpin"),
    look: varyingProperty("vec4", "vPuffLook"),
    snow: varyingProperty("vec4", "vPuffSnow"),
    world: varyingProperty("vec3", "vPuffWorld"),
    right: varyingProperty("vec3", "vPuffRight"),
    up: varyingProperty("vec3", "vPuffUp"),
    radius: varyingProperty("float", "vPuffRadius"),
  };
  const air = {
    key: varyingProperty("vec3", "vAirKey"),
    up: varyingProperty("vec3", "vAirUp"),
    down: varyingProperty("vec3", "vAirDown"),
    to: varyingProperty("vec3", "vAirTo"),
    from: varyingProperty("vec3", "vAirFrom"),
  };

  const vertex = Fn(() => {
    const iPos = attribute("iPos", "vec4");
    const iLook = attribute("iLook", "vec4");
    const iSnow = attribute("iSnow", "vec4");
    const { R, Up, fwd } = lensAxes();
    const Rv = R.toVar();
    const Uv = Up.toVar();
    const dist = length(iPos.xyz.sub(cameraPosition));
    // Away close to the lens: a chase camera rides in its own skier's plume.
    const nearK = smoothstep(near.mul(0.35).add(iPos.w.mul(0.2)), near.add(iPos.w.mul(0.9)), dist);
    // THE VEIL: the lens's own skier seen through his plume.
    const fw = fwd.toVar();
    const toF = focus.xyz.sub(cameraPosition).toVar();
    const toP = iPos.xyz.sub(cameraPosition).toVar();
    const before = smoothstep(dot(toF, fw).add(1), dot(toF, fw).sub(1.5), dot(toP, fw));
    const dirF = toF.div(max(length(toF), 1e-3)).toVar();
    const lat = length(toP.sub(dirF.mul(dot(toP, dirF))));
    const onLine = float(1).sub(smoothstep(iPos.w.mul(0.6).add(1.2), iPos.w.mul(1.4).add(3), lat));
    const lookX = iLook.x
      .mul(nearK)
      .mul(mix(1, focus.w, before.mul(onLine)))
      .toVar();
    v.look.assign(vec4(lookX, iLook.yzw));
    const g = positionGeometry;
    v.uv.assign(g.xy);
    const c = cos(iSnow.z).toVar();
    const sn = sin(iSnow.z).toVar();
    v.spin.assign(vec2(c.mul(g.x).sub(sn.mul(g.y)), sn.mul(g.x).add(c.mul(g.y))));
    v.snow.assign(iSnow);
    v.right.assign(Rv);
    v.up.assign(Uv);
    // Drawn a fifth wider than it flies: a row of them is one veil.
    const radius = iPos.w.mul(1.2).toVar();
    v.radius.assign(radius);
    const w = iPos.xyz.add(Rv.mul(g.x).add(Uv.mul(g.y)).mul(radius)).toVar();
    const a = airLight(s, keyCol, iPos.xyz);
    air.key.assign(a.key);
    air.up.assign(a.up);
    air.down.assign(a.down);
    air.to.assign(a.to);
    air.from.assign(a.from);
    v.world.assign(w);
    // A puff too faint to see is not drawn at all.
    return select(
      lookX.greaterThan(0.025),
      cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(w, 1)),
      vec4(2, 2, 2, 1),
    );
  })();

  /** `density`: a ball eroded by the noise, warped before it is measured. */
  const density = (uv: N, spin: N, o: N, age: N): N => {
    const r2 = dot(uv, uv);
    const n1 = tex(
      spin
        .mul(0.38)
        .add(o)
        .add(vec2(age.mul(0.22), age.mul(-0.31))),
    ).r.toVar();
    const n2 = tex(
      spin
        .mul(0.8)
        .add(o.yx)
        .add(vec2(age.mul(-0.15), age.mul(0.5))),
    ).g.toVar();
    const n3 = tex(
      spin
        .mul(2.3)
        .sub(o)
        .add(vec2(age.mul(0.7), age.mul(0.2))),
    ).b;
    const n = n1.mul(0.52).add(n2.mul(0.3)).add(n3.mul(0.18)).toVar();
    const w = uv.add(vec2(n1, n2).sub(0.5).mul(age.mul(0.35).add(0.55)));
    const rw = dot(w, w).toVar();
    const body = float(1).sub(rw);
    const erode = age.mul(0.55).add(0.15);
    const val = body.mul(n.mul(1.15).add(0.5)).sub(erode.mul(float(1).sub(n)));
    return smoothstep(-0.05, float(0.62).sub(age.mul(0.27)), val)
      .mul(exp(rw.mul(-2.6)))
      .mul(float(1).sub(r2.mul(r2)));
  };

  const fragment = Fn(() => {
    const uv = v.uv;
    const r2 = dot(uv, uv).toVar();
    If(r2.greaterThan(1).or(sheltered(s, v.world)), () => {
      Discard();
    });
    const age = v.look.z;
    const seed = v.look.y;
    const o = vec2(fract(seed.mul(7.13)), fract(seed.mul(3.71))).toVar();
    const d = density(uv, v.spin, o, age).toVar();
    const toEye = normalize(cameraPosition.sub(v.world)).toVar();
    const z = sqrt(max(0, float(1).sub(r2))).toVar();
    // Into the snow, measured on the ball's front surface.
    const surface = v.world.add(toEye.mul(z).mul(v.radius));
    const ground = smoothstep(v.look.w.sub(0.02), v.look.w.add(v.radius.mul(0.3)), surface.y);
    const alpha = d.mul(v.look.x).mul(ground).mul(0.9).toVar();
    If(alpha.lessThan(0.004), () => {
      Discard();
    });
    // A normal off the ball, bent by the noise.
    const bx = tex(v.spin.mul(0.6).add(o).add(0.13)).b.sub(0.5);
    const by = tex(v.spin.mul(0.6).add(o.yx).add(0.41)).b.sub(0.5);
    const deep = clamp(v.snow.y.sub(1.2), 0, 1.5).toVar();
    const deep1 = min(deep, 1).toVar();
    const rounder = mix(0.6, 1, deep1);
    const N = normalize(
      v.right
        .mul(uv.x.mul(rounder).add(bx.mul(1.2)))
        .add(v.up.mul(uv.y.mul(rounder).add(by.mul(1.2))))
        .add(toEye.mul(z.add(0.4))),
    ).toVar();
    // SELF-SHADOW: a step toward the key across the sprite, and the whole
    // cloud's shadow on it.
    const lp = vec2(dot(uKey, v.right), dot(uKey, v.up)).toVar();
    const toward = density(uv.add(lp.mul(0.45)), v.spin.add(lp.mul(0.45)), o, age);
    const thick = v.snow.y;
    const shade = v.snow.w.mul(exp(toward.mul(0.35).add(d.mul(0.15)).mul(thick).negate())).toVar();
    const wrap = mix(0.45, 0.2, deep1).toVar();
    const lambert = clamp(dot(N, uKey).add(wrap).div(wrap.add(1)), 0, 1).toVar();
    // FORWARD SCATTER, two lobes of Henyey–Greenstein.
    const mu = dot(toEye.negate(), uKey).toVar();
    const lobe = (g: number): N =>
      float(1 - g * g).div(pow(float(1 + g * g).sub(mu.mul(2 * g)), 1.5));
    const hg1 = lobe(0.86).toVar();
    const hg2 = lobe(0.45).toVar();
    const hg = hg1.mul(0.35).add(hg2.mul(0.65)).toVar();
    const thin = float(1).sub(d.mul(0.3));
    const forward = hg1
      .mul(0.06)
      .add(hg2.mul(0.25))
      .mul(thin)
      .mul(mix(0.35, 1.25, shade));
    const direct = lambert
      .mul(shade)
      .mul(float(1).sub(flat.mul(0.7)))
      .add(forward.mul(float(1).sub(flat.mul(0.8))))
      .toVar();
    // MANY SCATTERINGS: what does not come straight through is bounced on.
    direct.addAssign(
      float(1)
        .sub(shade)
        .mul(0.22)
        .mul(lambert.mul(0.5).add(0.5))
        .mul(float(1).sub(flat.mul(0.7))),
    );
    // THE SKY round it, on the bent normal.
    const amb = airSky(s, air, N)
      .mul(mix(float(0.6).sub(deep.mul(0.12)), 1, shade))
      .mul(mix(1, smoothstep(-0.9, 0.3, uv.y).mul(0.22).add(0.78), deep1));
    const col = amb
      .add(air.key.mul(direct))
      .mul(float(1).sub(night.mul(0.15)))
      .mul(0.96)
      .toVar();
    // GLINTS: single crystals on the screen's own grid.
    const gp = screenCoordinate.xy.div(2).toVar();
    const h = snowHash1(floor(gp).add(vec2(seed.mul(97), floor(time.mul(15).add(seed.mul(40))))));
    const spot = smoothstep(0.55, 0.1, length(fract(gp).sub(0.5)));
    const odds = v.snow.x.mul(0.004).mul(hg.mul(0.35).add(0.4));
    const glint = step(float(1).sub(odds), h)
      .mul(spot)
      .mul(glintU)
      .mul(smoothstep(0.1, 0.5, d))
      .mul(shade);
    col.addAssign(air.key.mul(glint).mul(hg.add(3)));
    // THE LAMPS through it.
    col.addAssign(lampsThrough(s, v.world, toEye.negate()));
    return vec4(airHaze(haze, how, col, v.world), alpha);
  })();

  return particleMaterial("snow-cloud", m, vertex, fragment);
}

/** THE CLOUD'S SHADOW's twin over its ShaderMaterial `m`
 * (`snow-cloud-shadow.ts`). */
export function shadowTwin(m: THREE.ShaderMaterial, haze: HazeUniforms): NodeMaterial {
  const U = m.uniforms;
  const s = airSlots(haze);
  const keyCol = slot(U.uKeyCol, "color");
  const sunDir = s.light.sunDir;
  const vUv = varyingProperty("vec2", "vBlotUv");
  const vTake = varyingProperty("float", "vBlotTake");
  const vOpacity = varyingProperty("float", "vBlotOpacity");
  const vStack = varyingProperty("float", "vBlotStack");
  const vWorld = varyingProperty("vec3", "vBlotWorld");

  const vertex = Fn(() => {
    const spot = attribute("iSpot", "vec4");
    const face = attribute("iFace", "vec4");
    const stack = attribute("iStack", "float");
    const n = face.xyz.toVar();
    const nk = max(dot(n, sunDir), 0.05).toVar();
    // Two axes in the snow's plane: along the key's lean, and across it.
    const t0 = sunDir.sub(n.mul(dot(n, sunDir))).toVar();
    const l1 = length(t0);
    const t1 = select(l1.greaterThan(1e-3), t0.div(l1), normalize(cross(n, vec3(0, 0, 1)))).toVar();
    const t2 = cross(n, t1);
    const r = spot.w;
    const g = positionGeometry;
    const w = spot.xyz
      .add(
        t1
          .mul(g.x)
          .mul(r)
          .mul(min(float(1).div(nk), fixed(STRETCH, 1))),
      )
      .add(t2.mul(g.y).mul(r))
      .toVar();
    vUv.assign(g.xy);
    vWorld.assign(w);
    // THE KEY'S SHARE of the snow's light here: what the shadow takes away.
    const l = s.light;
    const keyAir = keyCol.mul(keyAtHeight(l, spot.y)).mul(terrainLit(l, spot.xyz));
    const key = dot(keyAir, LUMA).mul(nk).toVar();
    const sky = dot(skyIrradiance(s.skySh, n).mul(0.31831), LUMA);
    vTake.assign(key.div(max(key.add(sky), 1e-4)));
    vOpacity.assign(face.w);
    vStack.assign(max(stack, 1));
    return cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(w, 1));
  })();

  const fragment = Fn(() => {
    const r2 = dot(vUv, vUv).toVar();
    If(r2.greaterThan(1), () => {
      Discard();
    });
    // The light let through: Beer–Lambert on the puff's soft profile.
    const through = float(1).sub(
      vOpacity.mul(float(1).sub(exp(exp(r2.mul(-2.6)).mul(float(1).sub(r2)).mul(-fixed(DARK, 2))))),
    );
    // This puff lays the vStack-th root of the stack's shadow.
    const keep0 = pow(
      float(1).sub(vTake.mul(fixed(1 - FILL, 2)).mul(float(1).sub(pow(through, vStack)))),
      float(1).div(vStack),
    );
    const ray = vWorld.sub(cameraPosition).toVar();
    const keep = mix(keep0, 1, hazeAmount(haze, length(ray), ray.y));
    return vec4(vec3(keep), 1);
  })();

  return particleMaterial("snow-cloud-shadow", m, vertex, fragment);
}

/** A constant as the GLSL prints it (`toFixed`). */
function fixed(n: number, d: number): number {
  return Number(n.toFixed(d));
}
