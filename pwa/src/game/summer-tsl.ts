// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER GROUND ON THE NODE RENDERER (`docs/webgpu.md`, part 4):
// `summer-glsl.ts`'s sample, colour and roughness restated in TSL for the
// ground's node twin (`terrain-tsl.ts`), the GLSL the authority term for
// term. Its light is the material's, as on WebGL — the sun, the sky's
// hemisphere, the lamps' own node — with the flat light's relief over it
// (`snow-light-tsl.ts`).

import type * as THREE from "three";
import * as TSL from "three/tsl";

import { slot, tap, type N } from "./haze-tsl.ts";
import { groundUv, type GroundSlots, type SnowState } from "./snow-sample-tsl.ts";
import { snowNoise, snowNoiseGrad } from "./snow-noise-tsl.ts";
import { SUMMER_GROUND_TONES } from "./summer-glsl.ts";

const {
  If,
  cameraPosition,
  clamp,
  dot,
  float,
  fwidth,
  length,
  max,
  mix,
  normalize,
  select,
  smoothstep,
  texture,
  vec3,
  vec4,
} = TSL as N;

const G = SUMMER_GROUND_TONES;
const tone = (c: readonly number[]): N => vec3(c[0], c[1], c[2]);

/** The summer's own uniforms (`summer-terrain.ts`), once a material. */
export function summerSlots(u: Record<string, THREE.IUniform>) {
  return {
    a: texture(u.uSummerA.value).setUpdateMatrix(false),
    b: texture(u.uSummerB.value).setUpdateMatrix(false),
    size: slot(u.uSummerSize, "vec2"),
    bands: slot(u.uSummerBands, "vec3"),
    low: slot(u.uSumLow, "vec3"),
    high: slot(u.uSumHigh, "vec3"),
    top: slot(u.uSumTop, "vec3"),
    dry: slot(u.uSumDry, "vec3"),
    bloom: slot(u.uSumBloom, "vec3"),
    rock: slot(u.uSumRock, "vec3"),
    scree: slot(u.uSumScree, "vec3"),
    shares: slot(u.uSumShares, "vec2"),
  };
}
type Summer = ReturnType<typeof summerSlots>;

/** The summer's state beside the snow's (`SnowState`), of which a summer's
 * ground fills what its colour, its light and its haze read. */
type SummerState = SnowState & { sumA: N; sumB: N; sumGrad: N };

/** `SUMMER_FRAGMENT_SAMPLE`: what this bit of ground is. */
export function summerSample(s: GroundSlots, m: Summer, world: N, vNormal: N): SummerState {
  const p = world.xz.toVar();
  const dist = length(world.sub(cameraPosition)).toVar();
  const g = tap(s.ground, groundUv(s, p)).toVar();
  const grad = g.rg.toVar();
  const inside = clamp(p, s.origin, s.origin.add(s.count.sub(1).mul(s.cell)));
  const past = length(p.sub(inside)).toVar();
  If(past.greaterThan(0), () => {
    const vn = normalize(vNormal).toVar();
    grad.assign(mix(grad, vn.xz.negate().div(max(vn.y, 0.2)), smoothstep(0, 30, past)));
  });
  const suv = p.div(m.size);
  const off = past.greaterThan(0);
  const sumA = select(off, vec4(0), tap(m.a, suv)).toVar();
  const sumB = select(off, vec4(0), tap(m.b, suv)).toVar();
  const nought = float(0);
  return {
    p,
    world,
    vNormal,
    dist,
    n: normalize(vec3(grad.x.negate(), 1, grad.y.negate())).toVar(),
    forest: g.a.toVar(),
    sumA,
    sumB,
    sumGrad: grad,
    hazeKeep: float(1),
    albedo: vec3(0).toVar(),
    rough: float(0.92).toVar(),
    ...Object.fromEntries(
      [
        "packed",
        "press",
        "wall",
        "berm",
        "crust",
        "ice",
        "rock",
        "foot",
        "skin",
        "skinCol",
        "groomed",
        "belt",
        "lug",
        "worked",
        "chop",
        "combed",
        "lane",
        "cord",
        "scuff",
        "slideWall",
        "newSnow",
        "old",
        "wind",
        "sunCrust",
        "hoar",
        "wet",
        "cup",
        "scour",
        "trackShade",
      ].map((k) => [k, nought]),
    ),
    self: float(1),
  } as SummerState;
}

/** `SUMMER_FRAGMENT_COLOUR` and `SUMMER_FRAGMENT_ROUGHNESS`, into the state. */
export function summerColour(s: GroundSlots, m: Summer, st0: SnowState): void {
  const st = st0 as SummerState;
  const { p, dist, sumA, sumB, sumGrad } = st;
  const one = (x: N): N => float(1).sub(x);
  const y = st.world.y;
  const px = length(fwidth(p)).toVar();
  const slope = length(sumGrad).toVar();
  const valley = m.bands.x;
  const line = m.bands.y;
  const top = m.bands.z;
  const sumEdge = (share: N, n: N, soft: number): N =>
    smoothstep(0.5 - soft, 0.5 + soft, share.add(n.sub(0.5).mul(0.35)));
  const n1 = snowNoise(p.mul(0.0024))
    .mul(0.6)
    .add(snowNoise(p.mul(0.0103).add(17)).mul(0.4))
    .toVar();
  const n2 = snowNoise(p.mul(0.043).add(5)).toVar();
  const n3 = snowNoise(p.mul(0.21).add(11)).toVar();
  const edge = n1.sub(0.5).mul(60).add(n2.sub(0.5).mul(25));
  const above = smoothstep(line.sub(15), line.add(25), y.add(edge)).toVar();
  const band = clamp(y.sub(valley).div(max(line.sub(valley), 1)), 0, 1).toVar();
  const sunny = clamp(
    dot(sumGrad.negate().div(max(slope, 1e-3)), normalize(s.sunDir.xz.add(1e-4))),
    -1,
    1,
  ).mul(smoothstep(0.05, 0.4, slope));
  const grass = mix(m.low, m.high, smoothstep(0.15, 0.95, band.add(n1.sub(0.5).mul(0.35)))).toVar();
  const dry = m.shares.x.mul(
    smoothstep(0.42, 0.75, n1.add(sunny.mul(0.25))).add(smoothstep(0.55, 0.85, n2).mul(0.4)),
  );
  grass.assign(mix(grass, m.dry, clamp(dry, 0, 0.85)));
  const bloomAt = smoothstep(0.45, 0.9, band).mul(one(smoothstep(0.6, 1, above)));
  grass.assign(
    mix(
      grass,
      m.bloom,
      m.shares.y
        .mul(bloomAt)
        .mul(smoothstep(0.45, 0.8, n2))
        .mul(n3.mul(0.5).add(0.5)),
    ),
  );
  const alb = mix(grass, m.top.mul(mix(0.85, 1.15, n2)), above).toVar();
  // THE RUNS.
  const piste = sumEdge(sumB.r, n3, 0.15).toVar();
  alb.assign(
    mix(
      alb,
      tone(G.piste)
        .mul(mix(0.9, 1.1, n2))
        .mul(mix(vec3(1), m.top.div(max(m.high, vec3(0.01))), above.mul(0.5))),
      piste.mul(0.8),
    ),
  );
  // KRUMMHOLZ and shrub.
  const scrub = sumEdge(sumB.g, snowNoise(p.mul(0.6)), 0.2).mul(one(piste));
  alb.assign(mix(alb, tone(G.scrub).mul(mix(0.8, 1.2, snowNoise(p.mul(1.7).add(3)))), scrub));
  // THE BOG.
  const bog = sumEdge(sumB.b, n3, 0.3);
  const pool = smoothstep(0.62, 0.8, snowNoise(p.mul(0.35)));
  alb.assign(
    mix(
      alb,
      tone(G.bog)
        .mul(mix(0.95, 1.1, n2))
        .mul(mix(1, 0.6, pool)),
      bog.mul(0.7),
    ),
  );
  // UNDER THE TREES.
  alb.assign(
    mix(alb, tone(G.loam).mul(mix(0.8, 1.2, n3)), smoothstep(0.25, 0.75, st.forest).mul(0.85)),
  );
  alb.assign(mix(alb, s.forestTint.mul(0.45), st.forest.mul(0.5).mul(smoothstep(160, 520, dist))));
  // THE MOTTLE close in.
  {
    const mo = (k: number, o: number): N =>
      snowNoise(p.mul(k).add(o))
        .sub(0.5)
        .mul(one(smoothstep(0.3, 0.7, px.mul(k))));
    alb.mulAssign(
      mo(0.7, 0).mul(0.35).add(mo(2.3, 3.7).mul(0.3)).add(mo(7.9, 9.1).mul(0.35)).mul(0.55).add(1),
    );
    const tuft = snowNoiseGrad(p.mul(2.3).add(3.7), float(0.05)).mul(
      one(smoothstep(0.2, 0.6, px.mul(2.3))),
    );
    st.n.assign(normalize(st.n.add(vec3(tuft.x, 0, tuft.y).mul(0.12))));
  }
  // THE MEADOW'S PATCHES.
  {
    const grassy = one(above.mul(0.6))
      .mul(one(smoothstep(0.3, 0.7, st.forest)))
      .toVar();
    const lush = snowNoise(p.mul(0.021).add(13)).sub(0.5);
    const tn = snowNoise(p.mul(0.057).add(29)).sub(0.5).toVar();
    alb.mulAssign(lush.mul(0.42).add(tn.mul(0.22)).mul(grassy).add(1));
    alb.assign(
      mix(alb, alb.mul(vec3(1.12, 1.06, 0.78)), smoothstep(0.1, 0.35, tn).mul(0.5).mul(grassy)),
    );
    const blossom = smoothstep(
      0.55,
      0.9,
      snowNoise(p.mul(0.035).add(51))
        .mul(0.8)
        .add(snowNoise(p.mul(0.21).add(7)).mul(0.2)),
    )
      .mul(grassy)
      .mul(one(piste.mul(0.6)));
    alb.assign(
      mix(
        alb,
        alb.mul(vec3(1.25, 1.22, 1.0)).add(vec3(0.03, 0.03, 0.02)),
        blossom.mul(0.18).mul(smoothstep(8, 30, dist)),
      ),
    );
  }
  // THE BARE SCARS.
  const scar = sumEdge(sumA.g, snowNoise(p.mul(0.45).add(2)), 0.12);
  const earth = tone(G.earth)
    .mul(mix(0.8, 1.15, snowNoise(p.mul(0.9).add(7))))
    .toVar();
  earth.mulAssign(
    smoothstep(0.7, 0.9, snowNoise(p.mul(4).add(1)))
      .mul(0.25)
      .mul(one(smoothstep(0.3, 0.7, px.mul(4))))
      .add(1),
  );
  alb.assign(mix(alb, earth, scar));
  // THE CAT TRACKS.
  const road = smoothstep(0.35, 0.6, sumA.b).toVar();
  If(road.greaterThan(0), () => {
    const gravel = tone(G.gravel)
      .mul(mix(0.85, 1.1, snowNoise(p.mul(1.3))))
      .toVar();
    const crown = smoothstep(0.75, 0.95, sumA.b);
    gravel.assign(mix(gravel, alb.mul(0.9), crown.mul(0.35).mul(one(smoothstep(0.3, 0.8, px)))));
    alb.assign(mix(alb, gravel, road));
  });
  // ROCK and SCREE.
  const rocky = smoothstep(
    0.62,
    0.92,
    slope.add(n2.sub(0.5).mul(0.25)).add(above.mul(0.18).mul(smoothstep(0.4, 0.8, n3))),
  )
    .mul(one(road))
    .toVar();
  const scree = sumEdge(sumA.a, n3, 0.15).mul(one(road)).toVar();
  const stone = m.rock
    .mul(
      mix(
        0.65,
        1.25,
        snowNoise(p.mul(0.31))
          .mul(0.6)
          .add(snowNoise(p.mul(1.9)).mul(0.4)),
      ),
    )
    .toVar();
  const talus = m.scree.mul(mix(0.7, 1.2, snowNoise(p.mul(2.6))));
  alb.assign(mix(alb, talus, scree));
  alb.assign(mix(alb, stone, rocky));
  If(rocky.add(scree).greaterThan(0.05).and(dist.lessThan(120)), () => {
    const bump = snowNoiseGrad(p.mul(0.9), float(0.08))
      .mul(0.5)
      .add(snowNoiseGrad(p.mul(3.1).add(5), float(0.03)).mul(0.25));
    st.n.assign(
      normalize(
        st.n.add(
          vec3(bump.x, 0, bump.y)
            .mul(rocky.add(scree.mul(0.6)))
            .mul(one(smoothstep(60, 120, dist))),
        ),
      ),
    );
  });
  // THE SNOW PATCHES of July.
  const wet = smoothstep(0.18, 0.42, sumA.r).mul(one(smoothstep(0.42, 0.55, sumA.r)));
  alb.assign(mix(alb, alb.mul(vec3(0.8, 1.05, 0.75)), wet.mul(one(rocky)).mul(0.7)));
  const snow = sumEdge(sumA.r, snowNoise(p.mul(0.5).add(23)), 0.05);
  const rim = one(smoothstep(0.55, 0.8, sumA.r));
  const patchTone = mix(
    tone(G.snow),
    tone(G.dirty),
    rim.mul(0.7).add(snowNoise(p.mul(1.4)).mul(0.15)),
  ).toVar();
  patchTone.mulAssign(
    one(
      smoothstep(0.55, 0.85, snowNoise(p.mul(2.6).add(41)))
        .mul(0.14)
        .mul(one(smoothstep(0.3, 0.7, px.mul(2.6)))),
    ),
  );
  alb.assign(mix(alb, patchTone, snow));
  // Above the far summits past the map.
  const peak = smoothstep(top.add(60), top.add(360), y).mul(
    smoothstep(0.35, 0.65, slope.add(n1.sub(0.5).mul(0.4))),
  );
  const high = smoothstep(top.add(500), top.add(900), y)
    .mul(smoothstep(0.62, 0.8, n2))
    .toVar();
  alb.assign(mix(alb, stone, peak));
  alb.assign(mix(alb, tone(G.snow), high));
  st.albedo.assign(alb);
  st.rough!.assign(mix(0.92, 0.6, smoothstep(0.45, 0.6, max(sumA.r, high))));
}
