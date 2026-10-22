// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIRE'S SHADERS ON THE NODE RENDERER (`docs/webgpu.md`, part 12): the
// fragment halves `fire-glsl.ts` shares between everything that burns,
// restated term for term — a tongue of fire, a spark, a puff of smoke — and
// the haze's fade with distance (`FADE`). Each reads the varyings its
// vertex half writes (`fireVaryings`). Linear light out, as WebGL's is
// before its tone map; the frame's own pass tone maps it on every back end.

import * as TSL from "three/tsl";

import { FIRE_COLOURS } from "./fireball.ts";
import type { N } from "./haze-tsl.ts";

const {
  Discard,
  Fn,
  If,
  abs,
  clamp,
  dot,
  exp,
  float,
  floor,
  fract,
  mix,
  pow,
  sin,
  smoothstep,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** A colour as the GLSL writes it (three decimals). */
const v3 = (c: readonly number[]): N => vec3(...c.map((x) => Number(x.toFixed(3))));

/** The varyings a fire's vertex half writes and its fragment reads. */
export const fireVaryings = () => ({
  uv: varyingProperty("vec2", "vFireUv") as N,
  seed: varyingProperty("float", "vFireSeed") as N,
  fade: varyingProperty("float", "vFireFade") as N,
  alpha: varyingProperty("float", "vFireAlpha") as N,
  heat: varyingProperty("float", "vFireHeat") as N,
  col: varyingProperty("vec3", "vFireCol") as N,
});

const fHash = (q: N): N => {
  const p = fract(q.mul(vec2(123.34, 456.21))).toVar();
  p.addAssign(dot(p, p.add(45.32)));
  return fract(p.x.mul(p.y));
};

/** The fire's value noise (`fNoise`). */
export const fireNoise = Fn(([p]: N[]) => {
  const i = floor(p).toVar();
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3)).toVar();
  return mix(
    mix(fHash(i), fHash(i.add(vec2(1, 0))), f.x),
    mix(fHash(i.add(vec2(0, 1))), fHash(i.add(vec2(1, 1))), f.x),
    f.y,
  );
}).setLayout({ name: "fireNoise", type: "float", inputs: [{ name: "p", type: "vec2" }] });

/** Four octaves of it (`fFbm`). */
export const fireFbm = Fn(([p0]: N[]) => {
  const p = vec2(p0).toVar();
  let s: N = float(0);
  let a = 0.5;
  for (let i = 0; i < 4; i++) {
    s = s.add(fireNoise(p).mul(a));
    p.mulAssign(2.03);
    a *= 0.5;
  }
  return s;
}).setLayout({ name: "fireFbm", type: "float", inputs: [{ name: "p0", type: "vec2" }] });

/** The haze's fade at distance `dist` (`fadeAt`). */
export const fadeAt = (dist: N, reach: N, haze: N): N =>
  smoothstep(reach, reach.mul(0.7), dist).mul(exp(dist.negate().mul(haze).mul(0.6)));

/** A TONGUE OF FIRE (`FLAME_FRAGMENT`) at the clock `time`. */
export function flameFragment(time: N): N {
  const V = fireVaryings();
  return Fn(() => {
    const v = V.uv.y.toVar();
    const t = time;
    const n = fireFbm(
      vec2(V.uv.x.mul(1.8).add(V.seed.mul(7)), v.mul(2.6).sub(t.mul(3)).add(V.seed.mul(3))),
    ).toVar();
    const n2 = fireNoise(vec2(V.uv.x.mul(5).add(V.seed.mul(13)), v.mul(7).sub(t.mul(6))));
    const u = V.uv.x.add(n.sub(0.5).mul(v)).add(
      sin(v.mul(7).sub(t.mul(8)).add(V.seed.mul(20)))
        .mul(0.18)
        .mul(v),
    );
    const prof = float(1)
      .sub(pow(v, 1.15))
      .mul(mix(0.65, 1, smoothstep(0, 0.15, v)));
    const d = prof
      .sub(abs(u))
      .add(n2.sub(0.5).mul(0.55).mul(v).mul(v))
      .add(n.sub(0.5).mul(0.35))
      .toVar();
    const a = smoothstep(0, 0.1, d).toVar();
    If(a.lessThan(0.01), () => {
      Discard();
    });
    const heat = clamp(d.mul(2.4).mul(float(1.2).sub(v)), 0, 1).toVar();
    const col = mix(
      v3(FIRE_COLOURS.red),
      v3(FIRE_COLOURS.orange),
      smoothstep(0.04, 0.4, heat),
    ).toVar();
    col.assign(mix(col, v3(FIRE_COLOURS.white), smoothstep(0.5, 0.95, heat)));
    const alpha = a
      .mul(mix(0.55, 1, heat))
      .mul(smoothstep(0, 0.05, v))
      .mul(V.fade);
    return vec4(col, alpha);
  })();
}

/** A SPARK, drawn additively (`SPARK_FRAGMENT`). */
export function sparkFragment(): N {
  const V = fireVaryings();
  return Fn(() => {
    const r = dot(V.uv, V.uv).toVar();
    If(r.greaterThan(1), () => {
      Discard();
    });
    const col = mix(
      v3(FIRE_COLOURS.red).mul(2.2),
      v3(FIRE_COLOURS.orange).mul(1.6),
      V.heat,
    ).toVar();
    col.assign(mix(col, v3(FIRE_COLOURS.white).mul(1.3), smoothstep(0.85, 1, V.heat)));
    return vec4(col.mul(float(1).sub(r)).mul(V.alpha), 1);
  })();
}

/** A PUFF OF SMOKE (`SMOKE_FRAGMENT`). */
export function smokeFragment(): N {
  const V = fireVaryings();
  return Fn(() => {
    const r = dot(V.uv, V.uv).toVar();
    If(r.greaterThan(1), () => {
      Discard();
    });
    const one = float(1).sub(r);
    const wisp = fireNoise(V.uv.mul(2.5).add(V.seed.mul(30)))
      .mul(0.6)
      .add(0.55);
    return vec4(V.col, V.alpha.mul(one).mul(one).mul(wisp));
  })();
}
