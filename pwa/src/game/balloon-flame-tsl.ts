// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BURNER'S FLAME ON THE NODE RENDERER (`docs/webgpu.md`, part 12): the
// node twin of `balloon-flame.ts`'s jets and pilots, over each jet's own
// uniforms by reference, term for term with its GLSL — the tube shaped in
// the vertex (the jet's profile, its wobble, its top laid over), the fire
// in the fragment (the blue root, the yellow heart, the torn orange tongues
// off a climbing noise). Linear light out, as WebGL's is before its tone
// map; the frame's own pass tone maps it on every back end.

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { particleMaterial } from "./air-tsl.ts";
import { shaderOwn } from "./figure-tsl.ts";
import type { N } from "./haze-tsl.ts";

const {
  Discard,
  Fn,
  If,
  abs,
  cameraProjectionMatrix,
  clamp,
  cos,
  dot,
  float,
  floor,
  fract,
  length,
  max,
  min,
  mix,
  highpModelNormalViewMatrix,
  modelViewMatrix,
  normalize,
  positionGeometry,
  pow,
  sin,
  smoothstep,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

const fHash = (q: N): N => {
  const p = fract(q.mul(0.3183099).add(0.1)).mul(17).toVar();
  return fract(p.x.mul(p.y).mul(p.z).mul(p.x.add(p.y).add(p.z)));
};

/** The flame's value noise (`fNoise`): trilinear over hashed corners. */
const fNoise = Fn(([x]: N[]) => {
  const i = floor(x).toVar();
  const f0 = fract(x);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3)).toVar();
  const h = (dx: number, dy: number, dz: number): N => fHash(i.add(vec3(dx, dy, dz)));
  return mix(
    mix(mix(h(0, 0, 0), h(1, 0, 0), f.x), mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y),
    mix(mix(h(0, 0, 1), h(1, 0, 1), f.x), mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y),
    f.z,
  );
}).setLayout({ name: "flameNoise", type: "float", inputs: [{ name: "x", type: "vec3" }] });

/** A jet's or a pilot's twin over its ShaderMaterial `m`. */
export function flameTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const len = shaderOwn("uLen", "float");
  const rad = shaderOwn("uRad", "float");
  const cut = shaderOwn("uCut", "float");
  const burst = shaderOwn("uBurst", "float");
  const bright = shaderOwn("uBright", "float");
  const time = shaderOwn("uTime", "float");
  const seed = shaderOwn("uSeed", "float");
  const bend = shaderOwn("uBend", "vec2");
  const blueU = shaderOwn("uBlue", "float");
  const rise = shaderOwn("uRise", "float");
  const pilot = shaderOwn("uPilot", "float");
  const vH = varyingProperty("float", "vFlameH");
  const vFacing = varyingProperty("float", "vFlameFacing");
  const vLocal = varyingProperty("vec3", "vFlameLocal");

  const vertex = Fn(() => {
    const position = positionGeometry;
    const h = position.y.toVar();
    const d = h.mul(len).toVar();
    // THE SHAPE: narrow at the coil, swelling a third of the way up.
    const s = pow(h, 0.62);
    const prof = max(0.08, pow(sin(min(s, 1).mul(3.14159)), 0.75))
      .mul(mix(0.75, 1, smoothstep(0.02, 0.16, h)))
      .toVar();
    prof.assign(mix(prof, 1, burst.mul(smoothstep(0.25, 0.95, h)).mul(0.6)));
    const r = rad.mul(prof).mul(burst.mul(0.5).add(1));
    const w1 = sin(d.mul(1.7).sub(time.mul(11)).add(seed)).add(
      sin(d.mul(3.1).sub(time.mul(17)).add(seed.mul(2))).mul(0.5),
    );
    const w2 = cos(d.mul(1.3).sub(time.mul(9)).add(seed.mul(3))).add(
      sin(d.mul(2.7).sub(time.mul(15))).mul(0.5),
    );
    const wob = vec2(w1, w2).mul(rad).mul(0.2).mul(h);
    const xz = position.xz.mul(r).add(wob).add(bend.mul(h).mul(h)).toVar();
    const p = vec3(xz.x, d.add(cut.mul(0.4)), xz.y);
    vLocal.assign(vec3(position.x, d, position.z));
    vH.assign(h);
    const mv = modelViewMatrix.mul(vec4(p, 1)).toVar();
    // How much flame the eye looks through here.
    const n = normalize(highpModelNormalViewMatrix.mul(vec3(position.x, 0, position.z)));
    const ax = normalize(highpModelNormalViewMatrix.mul(vec3(0, 1, 0))).toVar();
    const v = normalize(mv.xyz.negate()).toVar();
    const along = abs(dot(v, ax));
    const across = v.sub(ax.mul(dot(v, ax))).toVar();
    const fac = abs(dot(n, across.div(max(length(across), 1e-4))));
    vFacing.assign(mix(fac, 1, pow(along, 3)));
    return cameraProjectionMatrix.mul(mv);
  })();

  const fragment = Fn(() => {
    const d = vLocal.y.toVar();
    If(d.lessThan(cut), () => {
      Discard();
    });
    // TURBULENCE streaming up it.
    const q = vec3(vLocal.x.mul(2), d.mul(3.6).sub(time.mul(rise).mul(2.4)), vLocal.z.mul(2))
      .add(seed)
      .toVar();
    const warp = fNoise(q.mul(0.55).add(vec3(0, time.mul(-3), 0))).toVar();
    const n = fNoise(q.add(warp.mul(2.2)))
      .mul(0.55)
      .add(fNoise(q.mul(2.2).add(warp)).mul(0.3))
      .add(fNoise(q.mul(4.7)).mul(0.15))
      .toVar();
    const core = pow(vFacing, 2.2).toVar();
    const body = pow(vFacing, 0.45);
    const thr = mix(0.02, 0.62, smoothstep(0.22, 1, vH))
      .sub(core.mul(0.2))
      .toVar();
    const tongue = smoothstep(thr, thr.add(0.09), n);
    const blue = float(1)
      .sub(smoothstep(blueU.mul(0.55), blueU.mul(1.15), d.sub(cut)))
      .mul(float(1).sub(smoothstep(0, 0.1, cut)))
      .toVar();
    const a = body
      .mul(mix(tongue.mul(n.mul(0.4).add(0.6)), core.mul(0.3).add(0.7), blue))
      .mul(smoothstep(0, 0.04, vH))
      .mul(smoothstep(0, 0.1, d.sub(cut).add(0.03)));
    const lum = n.mul(n).mul(1.1).add(0.55);
    const heart = core.mul(smoothstep(0.85, 0.12, vH));
    const hot = mix(vec3(2.2, 0.85, 0.12), vec3(3.4, 2.45, 0.7), heart).toVar();
    hot.assign(mix(hot, vec3(1.05, 0.22, 0.03), smoothstep(0.45, 1, vH)).mul(lum));
    const cold = vec3(0.2, 0.42, 2.2).mul(core.mul(0.8).add(0.75));
    const col = mix(hot, cold, blue).toVar();
    const alpha = a.mul(bright).toVar();
    If(pilot.greaterThan(0.5), () => {
      // The pilot: a small blue cone, its inner cone brighter, a yellow tip.
      col.assign(
        mix(
          vec3(0.12, 0.3, 1.6).mul(core.mul(0.9).add(0.6)),
          vec3(1.8, 0.85, 0.18),
          smoothstep(0.62, 1, vH),
        ),
      );
      alpha.assign(
        core
          .mul(0.6)
          .add(0.15)
          .mul(smoothstep(0, 0.12, vH))
          .mul(float(1).sub(smoothstep(0.75, 1, vH)))
          .mul(bright),
      );
    });
    return vec4(col, clamp(alpha, 0, 1));
  })();

  return particleMaterial("balloon-flame", m, vertex, fragment);
}
