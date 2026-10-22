// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WATER ON THE NODE RENDERER (`docs/webgpu.md`, part 13): `water-glsl.ts`
// restated in TSL on the copy of `water-view.ts`'s material, term for term
// with the GLSL — where the shore is, the ice and its snow, the wind's
// waves and a stream's run, the water's own colour, and the mirror of the
// sky and the hills by Fresnel added to the lit colour before the haze.
//
// Every texture is read in uniform control flow: the GLSL's early returns
// in `wMirror` are `select`s here, so the horizon and the sky are read for
// every pixel and the discard comes after them. The water's own uniforms
// are read off the material drawn (`userData.graftOwn`), its two maps
// re-pointed every draw (`ownTexture`).

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeBuilder, NodeMaterial } from "three/webgpu";

import { graftOwn, normalFromColour } from "./figure-tsl.ts";
import { hazeAmount } from "./air-tsl.ts";
import { hazeColour, hazeSlots, skyColour, slot, type N } from "./haze-tsl.ts";
import type { PropDressing } from "./props-tsl.ts";
import { HORIZON_REACH, SHORE_SCALE } from "./water-plan.ts";

const {
  Discard,
  Fn,
  If,
  abs,
  asin,
  atan,
  attribute,
  cameraPosition,
  cameraViewMatrix,
  clamp,
  cos,
  dot,
  float,
  floor,
  fract,
  fwidth,
  length,
  max,
  mix,
  normalize,
  positionWorld,
  pow,
  property,
  reflect,
  select,
  smoothstep,
  texture,
  vec2,
  vec3,
  vec4,
} = TSL as N;

const io = (name: string, type: string) => ({ name, type });

/** What the colour hands the roughness, the normal and the mirror. */
const ROUGH: N = property("float", "wRough");
const NORMAL: N = property("vec3", "wNormal");
const MIRROR: N = property("vec3", "wMirrorLight");

/** Texture `name` of the drawn material's own uniforms, re-pointed every
 * draw (one material a map, but a pipeline is shared by every material of
 * its key). */
function ownTexture(material: THREE.Material, name: string): N {
  const own = material.userData.graftOwn as Record<string, { value: THREE.Texture }>;
  return texture(own[name].value).onObjectUpdate(({ object }: { object: THREE.Mesh }) => {
    const m = object.material as THREE.Material;
    return (m.userData.graftOwn as Record<string, { value: THREE.Texture }>)[name].value;
  });
}

/** `wHash`. */
const wHash: N = Fn(([p]: N[]) => {
  const p3 = fract(vec3(p.xyx).mul(0.1031)).toVar();
  p3.addAssign(dot(p3, p3.yzx.add(33.33)));
  return fract(p3.x.add(p3.y).mul(p3.z));
}).setLayout({ name: "wHash", type: "float", inputs: [io("p", "vec2")] });

/** `wNoise`. */
const wNoise: N = Fn(([p]: N[]) => {
  const i = floor(p).toVar();
  const f = fract(p).toVar();
  const u = f
    .mul(f)
    .mul(float(3).sub(f.mul(2)))
    .toVar();
  return mix(
    mix(wHash(i), wHash(i.add(vec2(1, 0))), u.x),
    mix(wHash(i.add(vec2(0, 1))), wHash(i.add(vec2(1, 1))), u.x),
    u.y,
  );
}).setLayout({ name: "wNoise", type: "float", inputs: [io("p", "vec2")] });

/** `wFbm`. */
const wFbm = (p: N): N =>
  wNoise(p)
    .mul(0.55)
    .add(wNoise(p.mul(2.07).add(5.3)).mul(0.3))
    .add(wNoise(p.mul(4.13).add(1.7)).mul(0.15));

/** `wWave`: one wind wave's slope at `p`. */
const wWave = (p: N, dir: N, k: number, s: N, span: N, t: N): N => {
  const fade = clamp(float(1.5).sub(span.mul(k * 0.5)), 0, 1);
  const w = Math.sqrt(9.81 * k);
  return dir.mul(s.mul(fade).mul(cos(dot(p, dir).mul(k).sub(t.mul(w)))));
};

/** THE COLOUR (`WATER_FRAGMENT_COLOUR`), the mirror (`wMirror`,
 * `WATER_FRAGMENT_MIRROR`) and the discard. */
function waterColour(material: THREE.Material, d: PropDressing): N {
  const s = hazeSlots(d.haze);
  const shore = ownTexture(material, "uShore");
  const horizon = ownTexture(material, "uLakeHorizon");
  return Fn(() => {
    const vIce = attribute("aIce", "vec4");
    const vWater = attribute("aWater", "vec4");
    const vFlow = attribute("aFlow", "vec4");
    const T = graftOwn("uWaterT", "float");
    const wind = graftOwn("uWaterWind", "vec2");
    const box = graftOwn("uShoreBox", "vec4");
    const wp = positionWorld.xz.toVar();
    const view = positionWorld.sub(cameraPosition).toVar();
    const dist = length(view).toVar();
    const span = max(length(fwidth(wp)), 1e-3).toVar();
    const mapped = shore
      .sample(wp.sub(box.xy).mul(box.zw).add(graftOwn("uShoreHalf", "vec2")))
      .setUpdateMatrix(false).r;
    const wShore = select(
      vFlow.w.greaterThanEqual(0),
      vFlow.w,
      mapped.mul(Number((255 / SHORE_SCALE).toFixed(2))),
    ).toVar();
    const edge = wShore.add(wFbm(wp.mul(0.05)).sub(0.5).mul(14)).toVar();
    const ice = max(
      float(1).sub(smoothstep(vIce.x.sub(1.5), vIce.x.add(1.5), edge)),
      smoothstep(vIce.y.sub(1.5), vIce.y.add(1.5), edge),
    ).toVar();

    // THE WIND'S WAVES (and a stream's run), their slopes summed.
    const at = wp.sub(vFlow.xy.mul(vFlow.z).mul(T)).toVar();
    const wl = length(wind).toVar();
    const wd = select(wl.greaterThan(0.01), wind.div(max(wl, 1e-6)), vec2(0, 1)).toVar();
    const wq = vec2(wd.y.negate(), wd.x).toVar();
    const rough = clamp(wl.div(9), 0, 1).add(vFlow.z.mul(0.6)).toVar();
    const slope = rough.mul(0.09).add(0.006).toVar();
    const grad = wWave(at, wd, 2.1, slope, span, T)
      .add(wWave(at, normalize(wd.add(wq.mul(0.6))), 3.4, slope.mul(0.7), span, T))
      .add(wWave(at, normalize(wd.sub(wq.mul(0.7))), 5.3, slope.mul(0.5), span, T))
      .add(wWave(at, normalize(wd.add(wq.mul(0.25))), 8.9, slope.mul(0.35), span, T))
      .toVar();
    const drift = wd.mul(T).mul(0.6);
    const n0 = wNoise(at.mul(1.3).sub(drift)).toVar();
    const n1 = wNoise(at.add(vec2(0.3, 0)).mul(1.3).sub(drift));
    const n2 = wNoise(at.add(vec2(0, 0.3)).mul(1.3).sub(drift));
    const fine = clamp(float(1.5).sub(span.mul(2)), 0, 1)
      .mul(slope)
      .mul(1.2);
    grad.addAssign(vec2(n1.sub(n0), n2.sub(n0)).div(0.3).mul(fine));
    const water = normalize(vec3(grad.x.negate(), 1, grad.y.negate()));

    // THE WATER'S OWN COLOUR.
    const open = mix(
      graftOwn("uShallow", "color"),
      graftOwn("uDeep", "color"),
      smoothstep(0.5, 22, wShore),
    );

    // THE ICE.
    const cp = wp
      .mul(0.07)
      .add(vec2(wNoise(wp.mul(0.02)), wNoise(wp.mul(0.02).add(7))).mul(1.5))
      .toVar();
    const crack = float(1)
      .sub(smoothstep(0, span.mul(0.004).add(0.012), abs(wNoise(cp).sub(0.5))))
      .toVar();
    crack.assign(
      max(
        crack,
        float(1)
          .sub(smoothstep(0, span.mul(0.004).add(0.008), abs(wNoise(cp.mul(3.1).add(9)).sub(0.5))))
          .mul(0.45),
      ),
    );
    crack.mulAssign(clamp(float(1.4).sub(span.mul(2)), 0, 1));
    const black = vec3(0.012, 0.02, 0.026).add(vec3(0.5, 0.56, 0.6).mul(crack).mul(0.45));
    const grey = vec3(0.5, 0.57, 0.61).mul(wNoise(wp.mul(0.4)).mul(0.2).add(0.9));
    const rot = vec3(0.16, 0.18, 0.185).mul(wFbm(wp.mul(0.2)).mul(0.4).add(0.8));
    const pool = smoothstep(0.55, 0.62, wFbm(wp.mul(0.07).add(3))).mul(vIce.w);
    const iceCol = mix(mix(grey, black, vWater.y), rot, vIce.w);
    const iceRough = mix(mix(0.35, 0.07, vWater.y), 0.3, vIce.w);
    const iceMirror = mix(mix(0.12, 0.8, vWater.y), 0.35, vIce.w);
    const scour = smoothstep(0.5, 0.62, wFbm(vec2(dot(wp, wd).mul(0.006), dot(wp, wq).mul(0.03))));
    const snowed = vIce.z.mul(float(1).sub(scour));
    ice.mulAssign(float(1).sub(pool));

    const surface = mix(open, iceCol, ice);
    const mirrorShare = mix(1, iceMirror, ice);
    ROUGH.assign(mix(mix(0.04, 0.12, rough), iceRough, ice));
    const n = normalize(mix(water, vec3(0, 1, 0), ice)).toVar();
    NORMAL.assign(n);
    const alpha = smoothstep(0, 1.2, wShore)
      .mul(float(1).sub(snowed.mul(ice)))
      .toVar();

    // THE MIRROR, by Fresnel: the sky over the lake's skyline and the
    // hills under it.
    const v = view.div(max(dist, 1e-3));
    const r0 = reflect(v, n).toVar();
    r0.y.assign(max(r0.y, 0.002));
    const r = normalize(r0).toVar();
    const cosT = clamp(dot(n, v.negate()), 0, 1);
    const fres = pow(float(1).sub(cosT), 5).mul(0.98).add(0.02);
    const sky = skyColour(s, r).toVar();
    const row = vWater.x;
    const az = atan(r.x, r.z).div(6.28318530718);
    const rows = graftOwn("uLakeHorizonRows", "float");
    const hz = horizon
      .sample(vec2(fract(az), row.add(0.5).div(rows)))
      .setUpdateMatrix(false)
      .toVar();
    const up = asin(clamp(r.y, 0, 1))
      .div(1.57079632679)
      .toVar();
    const under = float(1)
      .sub(smoothstep(hz.r.sub(0.004), hz.r.add(0.004), up))
      .toVar();
    const wood = mix(hz.g, hz.b, clamp(up.div(max(hz.r, 1e-3)), 0, 1));
    const sun = max(s.sunDir.y, 0).toVar();
    const horizonCol = slot(d.haze.uHorizon, "color");
    const zenith = slot(d.haze.uZenith, "color");
    const sunCol = slot(d.haze.uSunCol, "color");
    const snow = horizonCol.mul(0.6).add(sunCol.mul(0.55).mul(sun));
    const woods = zenith
      .mul(0.1)
      .add(sunCol.mul(0.04).mul(sun))
      .mul(vec3(0.5, 0.72, 0.58));
    const hill0 = mix(snow, woods, smoothstep(0, 0.6, wood));
    const h = normalize(vec3(r.x, 0.02, r.z));
    const hill = mix(
      hill0,
      hazeColour(s, h),
      hazeAmount(d.haze, hz.a.mul(HORIZON_REACH), float(0)),
    );
    const seen = select(row.lessThan(0).or(under.lessThanEqual(0)), sky, mix(sky, hill, under));
    MIRROR.assign(seen.mul(fres).mul(mirrorShare));
    If(alpha.lessThan(0.004), () => {
      Discard();
    });
    return vec4(surface, alpha);
  })();
}

/** Finish the copy of the water's material. */
export function waterGraft(copy: NodeMaterial, material: THREE.Material, d: PropDressing): void {
  const c = copy as NodeMaterial & Record<string, unknown>;
  c.colorNode = waterColour(material, d);
  c.roughnessNode = ROUGH;
  const base = Object.getPrototypeOf(copy) as { setupLighting(builder: NodeBuilder): N };
  c.setupLighting = function (this: NodeMaterial, builder: NodeBuilder): N {
    return base.setupLighting.call(this, builder).add(MIRROR);
  };
  normalFromColour(c, normalize(cameraViewMatrix.mul(vec4(NORMAL, 0)).xyz));
  (material as unknown as { graftNode: N }).graftNode = c.colorNode;
}
