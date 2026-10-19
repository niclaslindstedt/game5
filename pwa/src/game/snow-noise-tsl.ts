// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW'S SMALL HELPERS ON THE NODE RENDERER (`docs/webgpu.md`, part 4):
// `snow-noise-glsl.ts`'s hashes, value noise, its analytic gradient and the
// glints, restated in TSL for the ground's node twin (`terrain-tsl.ts`).
// The GLSL is the authority, term for term. Each is a real function of the
// generated shader (a layout), since the micro-relief calls the gradient a
// dozen times a pixel and inlined it would be that many copies.

import * as TSL from "three/tsl";

import type { N } from "./haze-tsl.ts";

// Read untyped, as every node here is (`haze-tsl.ts`'s `N`).
const { Fn, dot, float, fract, length, max, mix, normalize, pow, select, smoothstep, vec2, vec3 } =
  TSL as N;

const v2 = (name: string) => ({ name, type: "vec2" });
const v3 = (name: string) => ({ name, type: "vec3" });
const f1 = (name: string) => ({ name, type: "float" });

/** `snowHash3`: three hashes of a 3D cell. */
export const snowHash3: N = Fn(([p0]: N[]) => {
  const p = fract(p0.mul(vec3(0.1031, 0.103, 0.0973))).toVar();
  p.addAssign(dot(p, p.yxz.add(33.33)));
  return fract(p.xxy.add(p.yxx).mul(p.zyx));
}).setLayout({ name: "snowHash3", type: "vec3", inputs: [v3("p")] });

/** `snowHash1`: one hash of a 2D cell. */
export const snowHash1: N = Fn(([p0]: N[]) => {
  const p = fract(p0.mul(vec2(123.34, 456.21))).toVar();
  p.addAssign(dot(p, p.add(45.32)));
  return fract(p.x.mul(p.y));
}).setLayout({ name: "snowHash1", type: "float", inputs: [v2("p")] });

/** `snowNoise`: value noise, 0..1. */
export const snowNoise: N = Fn(([p]: N[]) => {
  const i = p.floor().toVar();
  const f = fract(p).toVar();
  const u = f
    .mul(f)
    .mul(float(3).sub(f.mul(2)))
    .toVar();
  return mix(
    mix(snowHash1(i), snowHash1(i.add(vec2(1, 0))), u.x),
    mix(snowHash1(i.add(vec2(0, 1))), snowHash1(i.add(vec2(1, 1))), u.x),
    u.y,
  );
}).setLayout({ name: "snowNoise", type: "float", inputs: [v2("p")] });

/** `snowNoiseGrad`: the noise's gradient, analytic, softened by `e`. */
export const snowNoiseGrad: N = Fn(([p, e]: N[]) => {
  const i = p.floor().toVar();
  const f = fract(p).toVar();
  const u = f
    .mul(f)
    .mul(float(3).sub(f.mul(2)))
    .toVar();
  const du = f.mul(6).mul(float(1).sub(f)).toVar();
  const a = snowHash1(i).toVar();
  const b = snowHash1(i.add(vec2(1, 0))).toVar();
  const c = snowHash1(i.add(vec2(0, 1))).toVar();
  const d = snowHash1(i.add(vec2(1, 1))).toVar();
  const k = a.sub(b).sub(c).add(d).toVar();
  return du
    .mul(vec2(b.sub(a).add(k.mul(u.y)), c.sub(a).add(k.mul(u.x))))
    .mul(float(1).sub(e.mul(e).mul(2)));
}).setLayout({ name: "snowNoiseGrad", type: "vec2", inputs: [v2("p"), f1("e")] });

/** `snowGlints`: one layer of crystals (`SNOW_GLINTS_GLSL`), `fw` the
 * world point's own footprint (`length(fwidth(wp))`), taken by the caller
 * in uniform control flow: the cell's is `scale` times it. */
export function snowGlints(
  wp: N,
  scale: number,
  sharp: N,
  keep: N,
  n: N,
  h: N,
  seed: number,
  fw: N,
): N {
  const rad = max(0.14, fw.mul(scale * 0.75));
  return glintAt(wp.mul(scale), rad, sharp, keep, n, h, float(seed));
}

const glintAt: N = Fn(([q, rad, sharp, keep, n, h, seed]: N[]) => {
  const cell = q.floor().toVar();
  const r = snowHash3(cell.add(seed)).toVar();
  const facet = normalize(n.add(snowHash3(cell.add(seed).add(7.13)).mul(2).sub(1).mul(0.6)));
  const g = pow(max(dot(facet, h), 0), sharp);
  const f = fract(q).sub(r.mul(0.6).add(0.2));
  const spot = float(1).sub(smoothstep(rad.mul(0.45), rad, length(f)));
  const k = float(0.14).div(rad);
  return select(r.z.greaterThan(keep), float(0), g.mul(spot).mul(k).mul(k));
}).setLayout({
  name: "snowGlint",
  type: "float",
  inputs: [v3("q"), f1("rad"), f1("sharp"), f1("keep"), v3("n"), v3("h"), f1("seed")],
});
