// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NIGHT SKY ON THE NODE RENDERER: the stars and the Milky Way
// (`starfield.ts`'s `STARFIELD_GLSL`) and the moon's disc and corona
// (`moon-glsl.ts`'s `MOON_GLSL`) restated as TSL for the dome's node twin
// (`sky-dome-tsl.ts`, `docs/webgpu.md` part 3). The GLSL is the authority:
// each function here is its namesake there, term for term, with the same
// constants read off the same modules, and a change to one is a change to
// both.
//
// The derivatives (`fwidth`: a pixel's angle, the disc's rim) are taken by
// the caller where the control flow is uniform and handed in.

import * as TSL from "three/tsl";

import type { N } from "./haze-tsl.ts";
import { DISC } from "./night-sky.ts";
import {
  BAND_GAIN,
  CLUMP_ACROSS,
  CLUMP_CELLS,
  DUST_ACROSS,
  DUST_CELLS,
  GALAXY_ARM,
  GALAXY_CORE,
  GAL_CENTRE,
  GAL_POLE,
  GAL_SIDE,
  STAR_COUNT,
  STAR_EXTINCTION,
  STAR_GAIN,
  starCount,
} from "./starfield.ts";

// Read untyped, as every node here is (`haze-tsl.ts`'s `N`).
const {
  asin,
  atan,
  clamp,
  cos,
  cross,
  degrees,
  dot,
  exp,
  float,
  floor,
  fract,
  length,
  log2,
  max,
  min,
  mix,
  mod,
  normalize,
  pow,
  select,
  sin,
  smoothstep,
  sqrt,
  vec2,
  vec3,
  vec4,
} = TSL as N;

const TAU = Math.PI * 2;
const v3 = (c: readonly number[]): N => vec3(c[0], c[1], c[2]);

/** A star's own hash, three in and one out (`sfHash3`). */
function sfHash3(p: N, salt: number): N {
  const p3 = fract(p.add(salt).mul(0.1031)).toVar();
  p3.addAssign(dot(p3, p3.zyx.add(31.32)));
  return fract(p3.x.add(p3.y).mul(p3.z));
}
function sfHash2(p: N): N {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar();
  p3.addAssign(dot(p3, p3.yzx.add(33.33)));
  return fract(p3.x.add(p3.y).mul(p3.z));
}

/** Value noise that wraps in x at a whole number of cells (`galNoise`). */
function galNoise(p: N, period: N): N {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  const x0 = mod(i.x, period);
  const x1 = mod(i.x.add(1), period);
  const a = sfHash2(vec2(x0, i.y));
  const b = sfHash2(vec2(x1, i.y));
  const c = sfHash2(vec2(x0, i.y.add(1)));
  const d = sfHash2(vec2(x1, i.y.add(1)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
/** Three octaves of it (`galField`), unrolled. */
function galField(p0: N, period0: number): N {
  let v: N = float(0);
  let a = 0.5;
  let total = 0;
  let p: N = p0;
  let period = period0;
  for (let i = 0; i < 3; i++) {
    v = v.add(galNoise(p, float(period)).mul(a));
    total += a;
    a *= 0.5;
    p = p.mul(2).add(vec2(0, 19.3));
    period *= 2;
  }
  return v.div(total);
}

/** A star's colour from its spectral roll (`starTone`). */
function starTone(t: N): N {
  const hot = vec3(0.7, 0.8, 1.0);
  const mid = vec3(1.0, 0.98, 0.94);
  const warm = vec3(1.0, 0.78, 0.58);
  return select(t.lessThan(0.5), mix(hot, mid, t.mul(2)), mix(mid, warm, t.sub(0.5).mul(2)));
}

/** ONE SHELL OF STARS (`starShell`). */
function starShell(
  sky: N,
  cells: number,
  thresh: N,
  n: [number, number],
  pixel: N,
  time: N,
  limit: N,
  air: N,
): N {
  const sd = sky.mul(cells).toVar();
  const cell = floor(sd).toVar();
  const h = sfHash3(cell, 0).toVar();
  const rank = h.sub(thresh).div(max(float(1).sub(thresh), 1e-4));
  const m = max(
    log2(mix(n[0], n[1], rank))
      .mul(0.30103)
      .sub(STAR_COUNT.a)
      .div(STAR_COUNT.b),
    -1.5,
  );
  const over = limit.sub(m).sub(air.x).toVar();
  const g = sfHash3(cell, 37).toVar();
  const jitter = vec3(fract(g.mul(13)), fract(g.mul(71)), fract(g.mul(191)));
  const d = length(fract(sd).sub(mix(vec3(0.28), vec3(0.72), jitter)));
  const radius = min(pixel.mul(cells).mul(min(over.mul(0.2).add(1), 2.6)), 0.42);
  const disc = smoothstep(radius, 0, d);
  const rate = fract(h.mul(53)).mul(6).add(2);
  const twinkle = air.y
    .mul(
      sin(
        time
          .mul(rate)
          .add(g.mul(40))
          .add(vec3(0, 1.7, 3.4).mul(air.z)),
      ),
    )
    .add(1);
  const redden = exp(vec3(0, 0.05, 0.14).negate().mul(0.921).mul(air.x).div(STAR_EXTINCTION));
  const bright = over.mul(STAR_GAIN).mul(smoothstep(0, 0.7, over));
  const star = starTone(pow(fract(g.mul(29)), 0.7))
    .mul(redden)
    .mul(disc)
    .mul(bright)
    .mul(max(twinkle, 0));
  return select(h.lessThan(thresh).or(over.lessThanEqual(0)), vec3(0), star);
}

/** THE BAND: how much galaxy is behind this ray, and its colour (`milkyWay`). */
function milkyWay(sky: N): N {
  const lat = dot(sky, v3(GAL_POLE)).toVar();
  const along = dot(sky, v3(GAL_CENTRE)).toVar();
  const across = dot(sky, v3(GAL_SIDE));
  const lon = atan(across, along);
  const band0 = exp(lat.mul(lat).mul(-22))
    .mul(0.72)
    .add(exp(lat.mul(lat).mul(-5.5)).mul(0.28))
    .sub(0.004)
    .toVar();
  const bulge = pow(max(along, 0), 4).toVar();
  const cu = vec2(lon.mul(CLUMP_CELLS / TAU), lat.mul(CLUMP_ACROSS));
  const du = vec2(lon.mul(DUST_CELLS / TAU), lat.mul(DUST_ACROSS));
  const clumps = galField(cu.add(vec2(0, 1.3)), CLUMP_CELLS).toVar();
  const dust = galField(du.add(vec2(0, 7)), DUST_CELLS);
  const off = lat.sub(dust.mul(2).add(1).mul(0.02));
  const lane = exp(off.mul(off).mul(-676));
  const band = band0
    .mul(
      pow(max(along.mul(0.5).add(0.5), 0), 1.6)
        .mul(0.58)
        .add(0.42)
        .add(bulge.mul(0.55)),
    )
    .mul(clumps.mul(1.05).add(0.42))
    .mul(float(1).sub(lane.mul(0.62).mul(smoothstep(0, 0.55, bulge.add(0.25)))));
  const tone = mix(
    v3(GALAXY_ARM),
    v3(GALAXY_CORE),
    clamp(bulge.mul(0.9).add(clumps.mul(0.1)), 0, 1),
  );
  return select(band0.lessThanEqual(0), vec3(0), tone.mul(band).mul(BAND_GAIN));
}

/** THE NIGHT SKY behind a ray (`nightSky`): `sky` the ray in celestial
 * coordinates, `up` its world elevation's sine, `glare` how deep in the
 * moon's glare it is, the two strengths, the twinkle's clock, the faintest
 * star the sky lets through, and `pixel` the ray's angle across a pixel
 * (`length(fwidth(ray))`, the caller's). */
export function nightSky(
  sky: N,
  up: N,
  glare: N,
  stars: N,
  galaxy: N,
  time: N,
  limit: N,
  pixel: N,
): N {
  const el = degrees(asin(clamp(up, 0, 1)));
  const X = float(1).div(max(up, 0).add(pow(el.add(6.07995), -1.6364).mul(0.50572)));
  const air = vec3(
    X.sub(1).mul(STAR_EXTINCTION),
    min(0.85, X.mul(0.07)),
    smoothstep(3, 10, X),
  ).toVar();
  const band = exp(air.x.mul(-0.921)).mul(smoothstep(-0.005, 0.06, up));
  const wash = float(1).sub(glare.mul(0.85));
  const lat = dot(sky, v3(GAL_POLE));
  const crowd = exp(lat.mul(lat).mul(-9));
  const way = milkyWay(sky).mul(galaxy).mul(band).mul(wash).mul(wash);
  const bright = starShell(sky, 70, float(0.9925), [1, starCount(4)], pixel, time, limit, air);
  const faint = starShell(
    sky,
    150,
    float(0.979).sub(crowd.mul(0.012)),
    [starCount(4), starCount(6.6)],
    pixel,
    time,
    limit,
    air,
  );
  const col = select(galaxy.greaterThan(0), way, vec3(0)).add(
    select(stars.greaterThan(0), bright.add(faint).mul(stars), vec3(0)),
  );
  return select(up.lessThan(-0.01), vec3(0), col);
}

/** The seas by where they lie on the face (`moonSeas`). */
function moonSeas(p: N): N {
  const patch = (x: number, y: number, w: number, k: number): N => {
    const q = p.sub(vec2(x, y));
    return exp(dot(q, q).negate().div(k)).mul(w);
  };
  const s = patch(-0.3, 0.42, 0.9, 0.045)
    .add(patch(0.12, 0.45, 0.8, 0.018))
    .add(patch(0.3, 0.15, 0.8, 0.025))
    .add(patch(0.7, 0.32, 0.9, 0.008))
    .add(patch(0.55, -0.15, 0.6, 0.015))
    .add(patch(0.33, -0.33, 0.6, 0.008))
    .add(patch(-0.62, 0.08, 0.7, 0.06))
    .add(patch(-0.2, -0.38, 0.5, 0.015))
    .add(patch(-0.55, -0.4, 0.6, 0.006));
  const tycho = patch(-0.12, -0.72, 1, 0.0015);
  return clamp(float(1).sub(min(s, 1).mul(0.38)), 0, 1).add(tycho.mul(0.25));
}

/** How far across the moon's disc the view `d` is, its radius 1 (`l` in
 * `moonDisc`) — what the caller takes the rim's derivative of. */
export function moonReach(d: N, M: N, disc: N): N {
  const q = d.sub(M.mul(dot(d, M)));
  return select(dot(d, M).greaterThan(0), length(q).div(disc.x), float(4));
}

/** THE MOON over the view `d` (`moonDisc`): rgb premultiplied, a its
 * coverage; `l` is `moonReach` and `aa` its rim's width (the caller's
 * `fwidth`). */
export function moonDisc(d: N, M: N, sunPos: N, pole: N, disc: N, col: N, l: N, aa: N): N {
  const a = float(1)
    .sub(smoothstep(float(1).sub(aa), aa.add(1), l))
    .toVar();
  const r = disc.x;
  const q = d.sub(M.mul(dot(d, M))).toVar();
  const n0 = pole.sub(M.mul(dot(pole, M)));
  const north = select(dot(n0, n0).greaterThan(1e-8), normalize(n0), vec3(0, 1, 0)).toVar();
  const right = normalize(cross(M, north));
  const s = sunPos.sub(M.mul(dot(sunPos, M)));
  const ex = select(dot(s, s).greaterThan(1e-10), normalize(s), right).toVar();
  const ey = cross(M, ex);
  const p = vec2(dot(q, ex), dot(q, ey)).div(r).toVar();
  const r2 = min(dot(p, p), 1);
  const n = vec3(p, sqrt(float(1).sub(r2)));
  const L = vec3(sin(disc.y), 0, cos(disc.y));
  const mu0 = dot(n, L).toVar();
  const mu = max(n.z, 1e-3).toVar();
  const ls = max(mu0, 0).mul(2).div(max(mu0, 0).add(mu));
  const lit = smoothstep(-0.015, 0.025, mu0);
  const alb = moonSeas(vec2(dot(q, right), dot(q, north)).div(r));
  const day = col
    .mul(pow(max(ls, 1e-4), DISC.span))
    .mul(disc.z)
    .mul(lit);
  const earth = col
    .mul(disc.w)
    .mul(vec3(0.8, 0.9, 1.0))
    .mul(float(1).sub(lit))
    .mul(pow(mu, 0.3));
  return select(a.lessThanEqual(0), vec4(0), vec4(day.add(earth).mul(alb).mul(a), a));
}

/** The corona where thin cloud stands `th` rad off the moon (`moonCorona`). */
export function moonCorona(th: N, hide: N, glow: N): N {
  const thin = clamp(hide.mul(float(1).sub(hide)).mul(4), 0, 1);
  const ring = th.sub(0.045).div(0.009);
  return glow.mul(thin).mul(
    vec3(0.85, 0.92, 1.0)
      .mul(exp(th.negate().div(0.02)).mul(0.55))
      .add(vec3(1.0, 0.72, 0.55).mul(exp(ring.mul(ring).negate()).mul(0.22))),
  );
}
