// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK'S BEDS AS TONE ON THE NODE RENDERER (`docs/webgpu.md`, part 4):
// `strata-glsl.ts`'s functions restated in TSL for the ground's node twin
// (`terrain-tsl.ts`), the GLSL the authority term for term. The hash is the
// engine's to the bit here too: a `u32` multiply wraps as `Math.imul` does
// and its shift is `>>>`, on WGSL and on GLSL alike; the constants are
// `strata-glsl.ts`' own (`STRATA_HASH`, `STRATA_SALTS`), held to the
// engine's by `tests/strata_glsl_test.ts`.

import { ROCKS } from "@engine";
import * as TSL from "three/tsl";

import type { N } from "./haze-tsl.ts";
import {
  BAND_SNOW,
  FAR_DARK,
  FAR_DARKEST,
  FAR_DARK_FROM,
  FAR_DARK_TO,
  FAR_EVEN,
  FAR_EVEN_FAR,
  FAR_LEDGE,
  FAR_LEDGE_FAR,
  ROCK_HAZE,
  ROCK_HAZE_FROM,
  ROCK_HAZE_IN,
  ROCK_HAZE_TO,
  STRATA_HASH,
  STRATA_SALTS,
  TREAD_MEAN,
} from "./strata-glsl.ts";

const { Fn, If, clamp, float, int, mix, smoothstep, uint, vec2, vec3 } = TSL as N;

const S = ROCKS.strata;
const H = STRATA_HASH;

const io = (name: string, type: string) => ({ name, type });

/** `stMix`: one round of the engine's 32-bit mix. */
const stMix: N = Fn(([h0, v]: N[]) => {
  const h = h0.bitXor(v).mul(uint(H.m1)).toVar();
  h.assign(h.bitXor(h.shiftRight(uint(H.s1))));
  h.assign(h.mul(uint(H.m2)));
  return h.bitXor(h.shiftRight(uint(H.s2)));
}).setLayout({ name: "stMix", type: "uint", inputs: [io("h", "uint"), io("v", "uint")] });

/** `stHash(seed, salt, k)`: the engine's `hashOf`. */
const stHash: N = Fn(([seed, salt, k]: N[]) =>
  stMix(stMix(stMix(uint(H.basis), seed), salt), uint(k)),
).setLayout({
  name: "stHash",
  type: "uint",
  inputs: [io("seed", "uint"), io("salt", "uint"), io("k", "int")],
});

/** `stUnit(h)`: the engine's `unit`, 0..1. */
const stUnit: N = Fn(([h]: N[]) =>
  float(stMix(stMix(uint(H.basis), h), uint(0))).mul(1 / 4294967296),
).setLayout({ name: "stUnit", type: "float", inputs: [io("h", "uint")] });

/** `stDraw(salt, k)` off the map's seed. */
const stDraw = (seed: N, salt: number, k: N): N => stUnit(stHash(seed, uint(salt), k));

/** `stNoise`: the engine's value noise, −1..1. */
const stNoise: N = Fn(([seed, q]: N[]) => {
  const fl = q.floor().toVar();
  const i = int(fl.x).toVar();
  const j = int(fl.y).toVar();
  const t0 = q.sub(fl);
  const t = t0
    .mul(t0)
    .mul(float(3).sub(t0.mul(2)))
    .toVar();
  const a = stUnit(stHash(seed, uint(i), j)).toVar();
  const b = stUnit(stHash(seed, uint(i.add(1)), j)).toVar();
  const c = stUnit(stHash(seed, uint(i), j.add(1))).toVar();
  const d = stUnit(stHash(seed, uint(i.add(1)), j.add(1))).toVar();
  return a
    .add(b.sub(a).mul(t.x))
    .add(c.sub(a).mul(t.y))
    .add(a.sub(b).sub(c).add(d).mul(t.x).mul(t.y))
    .mul(2)
    .sub(1);
}).setLayout({ name: "stNoise", type: "float", inputs: [io("seed", "uint"), io("q", "vec2")] });

/** `stCoord(q, y)`: the bed coordinate of ground at height `y` over `q`. */
export const stCoord: N = Fn(([seed, strata, q, y]: N[]) => {
  const fo = S.foldOver;
  const fold = stNoise(seed.bitXor(uint(STRATA_SALTS.fold)), q.div(fo))
    .add(stNoise(seed.bitXor(uint(STRATA_SALTS.fold2)), q.div(fo * 0.37)).mul(0.4))
    .mul(S.fold);
  return y.sub(strata.x.mul(q.x)).sub(strata.y.mul(q.y)).sub(fold);
}).setLayout({
  name: "stCoord",
  type: "float",
  inputs: [io("seed", "uint"), io("strata", "vec4"), io("q", "vec2"), io("y", "float")],
});

/** `stLevel(k)`: bed k's foot. */
const stLevel: N = Fn(([seed, bed, k]: N[]) => {
  const t = float(k).div(S.packet).toVar();
  const ti = t.floor().toVar();
  const fr0 = t.sub(ti);
  const fr = fr0
    .mul(fr0)
    .mul(float(3).sub(fr0.mul(2)))
    .toVar();
  const i = int(ti).toVar();
  const a = stDraw(seed, STRATA_SALTS.swell, i).toVar();
  const b = stDraw(seed, STRATA_SALTS.swell, i.add(1)).toVar();
  const swell = a.add(b.sub(a).mul(fr)).mul(2).sub(1);
  const vary = stDraw(seed, STRATA_SALTS.vary, k).sub(0.5).mul(2);
  return bed.mul(float(k).add(swell.mul(S.swell)).add(vary.mul(S.vary)));
}).setLayout({
  name: "stLevel",
  type: "float",
  inputs: [io("seed", "uint"), io("bed", "float"), io("k", "int")],
});

/** `stTone(k)`: a bed's shade, and its snowy tread less the mean. */
const stTone: N = Fn(([seed, k]: N[]) => {
  const shade = stDraw(seed, STRATA_SALTS.shade, k).sub(0.5).mul(0.4);
  const riser = float(S.riser[0]).add(
    stDraw(seed, STRATA_SALTS.riser, k).mul(S.riser[1] - S.riser[0]),
  );
  const held = stDraw(seed, STRATA_SALTS.deal, k).sub(0.3).div(0.7).max(0);
  return vec2(shade, float(1).sub(riser).mul(held).sub(TREAD_MEAN));
}).setLayout({ name: "stTone", type: "vec2", inputs: [io("seed", "uint"), io("k", "int")] });

/** `stBands(w, fw)`: the beds' tone box-filtered over the pixel; z the fade. */
export const stBands: N = Fn(([seed, bed, w, fw]: N[]) => {
  const amp = float(1)
    .sub(smoothstep(0.18, 0.5, fw.div(bed)))
    .toVar();
  const out = vec3(0).toVar();
  If(amp.greaterThan(0), () => {
    const k = int(w.div(bed).floor()).toVar();
    const l0 = stLevel(seed, bed, k).toVar();
    const l1 = float(0).toVar();
    If(l0.greaterThan(w), () => {
      l1.assign(l0);
      k.subAssign(1);
      l0.assign(stLevel(seed, bed, k));
      If(l0.greaterThan(w), () => {
        l1.assign(l0);
        k.subAssign(1);
        l0.assign(stLevel(seed, bed, k));
      });
    }).Else(() => {
      l1.assign(stLevel(seed, bed, k.add(1)));
      If(l1.lessThanEqual(w), () => {
        k.addAssign(1);
        l0.assign(l1);
        l1.assign(stLevel(seed, bed, k.add(1)));
      });
      If(l1.lessThanEqual(w), () => {
        k.addAssign(1);
        l0.assign(l1);
        l1.assign(stLevel(seed, bed, k.add(1)));
      });
    });
    const h = fw.mul(0.75).add(bed.mul(0.06)).toVar();
    const up = clamp(w.add(h).sub(l1).div(h.mul(2)), 0, 1).toVar();
    const down = clamp(l0.sub(w.sub(h)).div(h.mul(2)), 0, 1).toVar();
    const t = stTone(seed, k).mul(float(1).sub(up).sub(down)).toVar();
    If(up.greaterThan(0), () => {
      t.addAssign(stTone(seed, k.add(1)).mul(up));
    });
    If(down.greaterThan(0), () => {
      t.addAssign(stTone(seed, k.sub(1)).mul(down));
    });
    out.assign(vec3(t.mul(amp), amp));
  });
  return out;
}).setLayout({
  name: "stBands",
  type: "vec3",
  inputs: [io("seed", "uint"), io("bed", "float"), io("w", "float"), io("fw", "float")],
});

/** `stHazeKeep(dist)`: the share of the air over far stone. */
export function stHazeKeep(dist: N): N {
  const on = smoothstep(ROCK_HAZE_IN, ROCK_HAZE_FROM, dist);
  return mix(1, ROCK_HAZE, on.mul(float(1).sub(smoothstep(ROCK_HAZE_FROM, ROCK_HAZE_TO, dist))));
}

/** `stFar(stone, snow, even, b, ledge, dist)`: the far face's colour. */
export function stFar(stone: N, snowC: N, even: N, b: N, ledge: number, dist: N): N {
  const far = smoothstep(FAR_DARK_FROM, FAR_DARK_TO, dist).toVar();
  const cover = clamp(
    mix(FAR_EVEN, FAR_EVEN_FAR, far)
      .mul(even)
      .add(mix(FAR_LEDGE, FAR_LEDGE_FAR, far).mul(even).add(BAND_SNOW).mul(b.y).mul(ledge)),
    0,
    1,
  );
  const dark = mix(FAR_DARK, FAR_DARKEST, far);
  return mix(stone.mul(dark).mul(b.x.add(1)), snowC, cover);
}
