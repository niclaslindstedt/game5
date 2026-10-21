// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOUDS' PASSES ON THE NODE RENDERER (`docs/webgpu.md`, part 10): the
// node twins of two of `clouds.ts`'s passes, and the read every lit
// material makes of the first:
//
//   * THE SHADOW MAP (`SHADOW_FRAGMENT`): every layer's columns over its box,
//     a channel a layer (`shadowPassTwin`);
//   * MEDIUM'S SLAB (`SLAB_FRAGMENT` over `CLOUD_SLAB_GLSL`): the layers
//     marched at half the picture's resolution, `STEPS` steps through each
//     and `LIGHT` reads toward the sun (`slabTwin`);
//   * THE SHADOW READ (`CLOUD_SHADOW_GLSL`'s `cloudShadow`): the key's share
//     at a world point against the field's mean, read off the map by the
//     key's light node (`lights-tsl.ts`) and by the light in the air
//     (`air-tsl.ts`).
//
// The GLSL is the authority, term for term, and every uniform is the
// ShaderMaterial's own, read by reference, so `clouds.ts` drives both back
// ends. HIGH's volume is `cloud-volume-tsl.ts`.
//
// THE LAYOUT. A pass reads its pixel off `screenCoordinate`, which on the
// node renderer is the texel a read at uv = coordinate / size finds — the
// relation WebGL's `gl_FragCoord` has to its own reads. So a pass's uv is
// that quotient wherever the GLSL takes `vUv` or `gl_FragCoord`, a read of
// the picture takes the GLSL's uv as it is, and the dithers land on the
// same texels as WebGL's. No row is flipped anywhere.

import * as THREE from "three";
import * as TSL from "three/tsl";
import { NodeMaterial } from "three/webgpu";

import { CLOUD_LAYERS } from "./cloud-field.ts";
import {
  cloudAir,
  cloudColumn,
  cloudLayerShell,
  cloudLit,
  cloudNoise,
  cloudOdColumn,
  cloudSlots,
  cloudStack,
  type CloudSlots,
} from "./cloud-shell-tsl.ts";
import type { CloudUniforms } from "./clouds.ts";
import type { HazeUniforms } from "./haze.ts";
import { hazeSlots, skyColour, slot, tap, type N } from "./haze-tsl.ts";

// Read untyped, as every node here is (`haze-tsl.ts`'s `N`).
const {
  Break,
  Continue,
  Fn,
  If,
  Loop,
  abs,
  clamp,
  dot,
  exp,
  float,
  floor,
  int,
  max,
  min,
  mix,
  mod,
  normalize,
  positionGeometry,
  screenCoordinate,
  screenSize,
  select,
  smoothstep,
  vec2,
  vec3,
  vec4,
} = TSL as N;

type U = Record<string, THREE.IUniform>;

/** A pass's twin: a full-screen quad, no depth, no fog, no lights, no
 * blending — as every one of `clouds.ts`'s ShaderMaterials is drawn. A
 * node is hung on the ShaderMaterial (`passNode`) so the renderer refreshes
 * its bindings every draw: the pictures it reads swap every frame. */
export function cloudPass(name: string, from: THREE.Material, fragment: N): NodeMaterial {
  const m = new NodeMaterial();
  m.name = name;
  m.depthTest = false;
  m.depthWrite = false;
  m.fog = false;
  m.lights = false;
  m.toneMapped = false;
  m.blending = THREE.NoBlending;
  m.vertexNode = vec4(positionGeometry.xy, 0, 1);
  m.fragmentNode = fragment;
  (from as unknown as { passNode: N }).passNode = fragment;
  return m;
}

/** The view through the pass's pixel at uv `uv` (`vUv` or the kept
 * picture's): the far plane put back through the lens, less the eye. */
export function viewAt(invViewProj: N, eye: N, uv: N): N {
  const far = invViewProj.mul(vec4(uv.mul(2).sub(1), 1, 1)).toVar();
  return normalize(far.xyz.div(far.w).sub(eye));
}

/** THE SHADOW MAP (`SHADOW_FRAGMENT`): a layer a channel, its columns'
 * share of the depth over its box. */
export function shadowPassTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const u = m.uniforms as U;
  const c = cloudSlots(u as unknown as CloudUniforms);
  const boxes = slot(u.uBoxes, "vec4");
  const frag = Fn(() => {
    const uv = screenCoordinate.div(screenSize).toVar();
    const here = (i: number): N => {
      const box = boxes.element(i);
      const xz = box.xy.add(uv.div(box.z));
      const col = cloudColumn(c, int(i), cloudNoise(c, int(i), xz));
      return select(float(i).greaterThanEqual(c.on.x), float(0), col.y.sub(col.x));
    };
    return vec4(here(0), here(1), here(2), 1);
  })();
  return cloudPass("cloud-shadow-map", m, frag);
}
if (CLOUD_LAYERS !== 3) throw new Error("cloud-pass-tsl.ts: the shadow map holds three layers");

/** Where in its step each pixel reads (`cloudJitter`): a 2 × 2 ordered
 * dither the dome's tent averages away. */
const slabJitter = (px: N): N => {
  const q = mod(floor(px), 2);
  return abs(q.x.sub(q.y)).mul(2).add(q.y).mul(0.25).add(0.125);
};

/** ONE LAYER THROUGH THE SLAB (`cloudLayerSlab`). */
function cloudLayerSlab(
  c: CloudSlots,
  steps: number,
  light: number,
  i: N,
  e: N,
  d: N,
  L: N,
  sky: N,
  jit: N,
): N {
  const out = vec4(0).toVar();
  const A = c.A.element(i);
  const yb = A.x.toVar();
  const depth = A.y.toVar();
  const yt = yb.add(depth);
  const t0 = float(0).toVar();
  const t1 = float(-1).toVar();
  If(abs(d.y).lessThan(1e-4), () => {
    If(e.y.greaterThanEqual(yb).and(e.y.lessThanEqual(yt)), () => {
      t0.assign(0);
      t1.assign(140000);
    });
  }).Else(() => {
    const ta = yb.sub(e.y).div(d.y);
    const tb = yt.sub(e.y).div(d.y);
    t0.assign(max(min(ta, tb), 0));
    t1.assign(min(max(ta, tb), 140000));
  });
  If(t1.greaterThan(t0), () => {
    t1.assign(min(t1, t0.add(depth.mul(12).div(max(abs(d.y), 0.02))).add(4000)));
    const dt = t1.sub(t0).div(steps).toVar();
    const B = c.B.element(i);
    const cell = float(0.25).div(max(B.z, B.w));
    const near = smoothstep(cell.mul(0.5), cell.mul(0.2), dt).toVar();
    const shell = vec4(0).toVar();
    If(near.lessThan(1), () => {
      shell.assign(cloudLayerShell(c, i, e, d, L, sky));
    });
    out.assign(shell);
    If(near.greaterThan(0), () => {
      const sigma = A.w.div(depth).toVar();
      const mu = dot(d, L).toVar();
      const acc = vec3(0).toVar();
      const T = float(1).toVar();
      Loop({ start: 0, end: steps, type: "int", name: "k" }, ({ k }: { k: N }) => {
        const t = t0.add(float(k).add(jit).mul(dt)).toVar();
        const p = e.add(d.mul(t)).toVar();
        const col = cloudColumn(c, i, cloudNoise(c, i, p.xz)).toVar();
        const hm = p.y.sub(yb).div(depth).toVar();
        const hs = abs(d.y).mul(0.5).mul(dt).div(depth).add(0.03);
        const lo = hm.sub(hs);
        const hi = hm.add(hs);
        const fill = max(0, min(hi, col.y).sub(max(lo, col.x)))
          .div(hi.sub(lo))
          .toVar();
        If(fill.lessThanEqual(0), () => {
          Continue();
        });
        const h = clamp(hm, col.x, col.y).toVar();
        const od = cloudOdColumn(c, i, h, col, L).toVar();
        if (light > 0) {
          const run = depth.div(max(abs(L.y), 0.12)).toVar();
          for (let j = 1; j <= light; j++) {
            const q = p.add(L.mul(run).mul(j / (light + 1))).toVar();
            const cq = cloudColumn(c, i, cloudNoise(c, i, q.xz)).toVar();
            const hq = q.y.sub(yb).div(depth);
            const inq = smoothstep(cq.x.sub(0.04), cq.x.add(0.03), hq).mul(
              smoothstep(cq.y.add(0.04), cq.y.sub(0.03), hq),
            );
            od.addAssign(
              vec2(
                sigma
                  .mul(0.12)
                  .mul(inq)
                  .mul(run)
                  .div(light + 1),
              ),
            );
          }
          od.mulAssign(0.6);
        }
        const a = float(1)
          .sub(exp(sigma.negate().mul(fill).mul(dt)))
          .toVar();
        const lit = cloudLit(c, i, h, col, L, mu, od);
        const air = cloudAir(c, t, e.y.sub(c.seaLevel), p.y.sub(c.seaLevel)).toVar();
        acc.addAssign(T.mul(a).mul(lit.mul(air).add(sky.mul(vec3(1).sub(air)))));
        T.mulAssign(float(1).sub(a));
        If(T.lessThan(0.02), () => {
          Break();
        });
      });
      const fade = smoothstep(140000, 60000, t0);
      out.assign(mix(shell, vec4(acc.mul(fade), float(1).sub(T).mul(fade)), near));
    });
  });
  return out;
}

/** MEDIUM'S SLAB (`SLAB_FRAGMENT`), `STEPS` and `LIGHT` its material's. */
export function slabTwin(m: THREE.ShaderMaterial, haze: HazeUniforms): NodeMaterial {
  const u = m.uniforms as U;
  const steps = Number(m.defines.STEPS);
  const light = Number(m.defines.LIGHT);
  const c = cloudSlots(u as unknown as CloudUniforms);
  const s = hazeSlots(haze);
  const invViewProj = slot(u.uInvViewProj, "mat4");
  const eye = slot(u.uEye, "vec3");
  const frag = Fn(() => {
    const px = screenCoordinate.toVar();
    const d = viewAt(invViewProj, eye, px.div(screenSize)).toVar();
    const L = s.sunPos;
    const sky = skyColour(s, d).toVar();
    const jit = slabJitter(px).toVar();
    return cloudStack(c, eye, d, L, sky, (i) =>
      cloudLayerSlab(c, steps, light, i, eye, d, L, sky, jit),
    );
  })();
  return cloudPass(`cloud-slab-${steps}`, m, frag);
}

/** The shadow read's slots: the map, every layer's box, its optical depth
 * and the field's mean (`CLOUD_SHADOW_GLSL`'s uniforms). */
export type CloudShadowSlots = { map: N; box: N; tau: N; mean: N; sunDir: N };
export function cloudShadowSlots(u: HazeUniforms, map: N): CloudShadowSlots {
  return {
    map,
    box: slot(u.uCloudBox, "vec4"),
    tau: slot(u.uCloudTau, "vec4"),
    mean: slot(u.uCloudMean, "vec4"),
    sunDir: slot(u.uSunDir, "vec3"),
  };
}

const XYZ = ["x", "y", "z"] as const;

/** THE CLOUDS' SHADOW at world point `p` (`cloudShadow`): the key's share
 * against the field's mean, 1 with no field or the sun on the horizon.
 * Every read is taken whatever the branches say and at the map's first
 * level (it has no other), so the flow stays uniform. A function of its
 * own, so its variables have a stack to stand on wherever a light builds
 * it. */
export function cloudShadow(s: CloudShadowSlots, p: N): N {
  return Fn(() => cloudShadowAt(s, p))();
}

function cloudShadowAt(s: CloudShadowSlots, p: N): N {
  const L = s.sunDir;
  const Ly = max(L.y, 0.02).toVar();
  const layer = (k: number, ch: "r" | "g" | "b"): N => {
    const box = s.box.element(k);
    const q = p.xz.add(L.xz.mul(box.w.sub(p.y)).div(Ly));
    const uv = q.sub(box.xy).mul(box.z).toVar();
    const F = tap(s.map, uv).level(0)[ch];
    // A vec4 slot's `.element(k)` is the whole vector: its components by name.
    const tau = s.tau[XYZ[k]];
    const mean = s.mean[XYZ[k]];
    const out1 = smoothstep(box.w.sub(60), box.w.add(60), p.y);
    const outside = uv.x
      .lessThanEqual(0)
      .or(uv.y.lessThanEqual(0))
      .or(uv.x.greaterThanEqual(1))
      .or(uv.y.greaterThanEqual(1));
    const inside = mix(exp(F.negate().mul(tau).div(max(L.y, 0.08))), 1, out1);
    const shaded = select(outside, mix(mean, 1, out1), inside);
    return select(tau.lessThanEqual(0).or(out1.greaterThanEqual(1)), float(1), shaded);
  };
  const T = layer(0, "r").mul(layer(1, "g")).mul(layer(2, "b"));
  const off = s.tau.w.lessThan(0.5).or(L.y.lessThanEqual(0.02));
  return select(off, float(1), T.div(max(s.mean.w, 1e-3)));
}
