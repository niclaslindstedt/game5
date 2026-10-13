// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER GROUND AS DRAWN — the terrain's shader in midsummer, grafted
// into the same `MeshStandardMaterial` the snow is (`terrain.ts` picks these
// chunks in place of the snow's on a summer run). What a point of the ground
// IS comes from the engine's own field (`summer-ground.ts`'s `summerFieldOf`:
// the snow patches, the bare scars, the cat tracks, the scree, the runs'
// grass, the scrub and the bog, uploaded byte for byte as `uSummerA` and
// `uSummerB`), the map's own ground (its slope, its forest) and the tree
// line; what it LOOKS like is the research's (`docs/summer.md`):
//
//   * THE GRASS BY ALTITUDE AND COUNTRY: a lush valley meadow, a darker,
//     flowering high meadow under the tree line, alpine turf or dwarf-shrub
//     heath above it — each country's own (`SUMMER_LOOKS`), a continental
//     summer's straw on the sunny faces, a fell's lichen;
//   * PATCHINESS WITHOUT TILING: three octaves of value noise from hundreds
//     of metres down to a few, the dry patches on the faces the sun stands
//     on, and the MOTTLE of a meadow a metre or two across, faded out before
//     a pixel spans it; past a hundred metres the colour is flat, as a
//     photograph's is;
//   * THE RUNS: a short-grass corridor a shade darker and more even than
//     the meadow, its BARE SCARS earth, the cat tracks gravel with two ruts;
//   * THE MEADOW'S PATCHES at ten to a hundred metres: lusher and thinner
//     grass, dry streaks, a faint lift where a field is in flower. (The
//     pasture's terracettes are not drawn: steps cut on the height's own
//     contours curl into rings round every hummock, which no grazed slope
//     shows — they wait for a stripe laid along the slope's own frame.)
//   * ROCK AND SCREE on the steep and high ground, and the SNOW PATCHES of
//     July, scalloped, dirty grey at the rim, a ring of wet green below.
//
// LIGHT is the material's: the sun and its shadow map, the hemisphere, the
// lamps (`haze.ts`'s `LAMP_FRAGMENT`, which a summer ground does not opt
// out of) and the haze — no glitter, no glare lobe and no wrap through the
// snow, which grass does not do. Nothing here restates the sky.

import type { RegionId } from "@engine";

type Tone = readonly [number, number, number];

/** A country's summer palette, linear albedo. */
export type SummerLook = {
  /** The valley meadow and the high meadow just under the tree line. */
  readonly low: Tone;
  readonly high: Tone;
  /** Above the tree line: alpine turf, or the fell's and the maritime's heath. */
  readonly top: Tone;
  /** The dry patches and their share of the open ground, 0..1. */
  readonly dry: Tone;
  readonly dryShare: number;
  /** The flowers' tint over a high meadow in bloom, and how much. */
  readonly bloom: Tone;
  readonly bloomShare: number;
  /** Bare rock and scree. */
  readonly rock: Tone;
  readonly scree: Tone;
};

// The research's medians (`docs/summer.md` § Colours), read off sunlit
// photographs; an albedo is the colour less the light on it, so each is
// taken down to about two thirds of its photographed value.
const K = 0.62;
const t = (r: number, g: number, b: number): Tone => [r * K, g * K, b * K];

export const SUMMER_LOOKS: Readonly<Record<RegionId, SummerLook>> = {
  // THE ALPINE: green hay meadows in the valley, darker flowering meadows
  // under the tree line, short alpine turf over it, grey limestone and
  // brown scree.
  alpine: {
    low: t(0.3, 0.42, 0.105),
    high: t(0.168, 0.283, 0.041),
    top: t(0.2, 0.235, 0.06),
    dry: t(0.323, 0.332, 0.156),
    dryShare: 0.25,
    bloom: t(0.62, 0.58, 0.42),
    bloomShare: 0.3,
    rock: t(0.36, 0.355, 0.37),
    scree: t(0.42, 0.37, 0.3),
  },
  // THE FELL: low rounded country, crowberry and bilberry heath, grey
  // lichen on the tops, peat in the hollows.
  fell: {
    low: t(0.21, 0.26, 0.08),
    high: t(0.16, 0.2, 0.06),
    top: t(0.3, 0.3, 0.2),
    dry: t(0.45, 0.45, 0.33),
    dryShare: 0.35,
    bloom: t(0.36, 0.2, 0.22),
    bloomShare: 0.12,
    rock: t(0.3, 0.3, 0.3),
    scree: t(0.36, 0.34, 0.3),
  },
  // THE CONTINENTAL: dry country — straw on the sunny faces by July, sage
  // greens, warm rock.
  continental: {
    low: t(0.33, 0.36, 0.14),
    high: t(0.2, 0.26, 0.08),
    top: t(0.26, 0.26, 0.12),
    dry: t(0.546, 0.332, 0.138),
    dryShare: 0.45,
    bloom: t(0.7, 0.6, 0.25),
    bloomShare: 0.15,
    rock: t(0.38, 0.35, 0.31),
    scree: t(0.45, 0.38, 0.3),
  },
  // THE MARITIME: the wettest and greenest, bamboo-grass and heath to the
  // tops, dark wet rock.
  maritime: {
    low: t(0.24, 0.4, 0.09),
    high: t(0.16, 0.3, 0.06),
    top: t(0.17, 0.22, 0.06),
    dry: t(0.27, 0.32, 0.12),
    dryShare: 0.12,
    bloom: t(0.55, 0.5, 0.45),
    bloomShare: 0.1,
    rock: t(0.24, 0.24, 0.25),
    scree: t(0.3, 0.29, 0.27),
  },
};

/** Every country's ground under the same colours of what is not grass. */
export const SUMMER_GROUND_TONES = {
  /** Short grass on a run, a shade darker and more even than the meadow. */
  piste: t(0.2, 0.3, 0.075),
  /** Bare earth: a run's scars. */
  earth: t(0.381, 0.314, 0.178),
  /** A cat track's gravel. */
  gravel: t(0.5, 0.42, 0.32),
  /** Loam and moss under the trees. */
  loam: t(0.16, 0.15, 0.08),
  /** Krummholz and shrub. */
  scrub: t(0.09, 0.115, 0.035),
  /** Peat and moor. */
  bog: t(0.2, 0.19, 0.085),
  /** A July snow patch, and its dirty rim. */
  snow: [0.6, 0.63, 0.67] as Tone,
  dirty: [0.5, 0.5, 0.5] as Tone,
};

const v3 = (c: Tone): string => `vec3(${c.map((x) => x.toFixed(4)).join(", ")})`;
const G = SUMMER_GROUND_TONES;

/** After `common`, beside the snow's own pars (whose state and noise this
 * reads). */
export const SUMMER_FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uSummerA;
uniform sampler2D uSummerB;
uniform vec2 uSummerSize;
uniform vec3 uSummerBands;
uniform vec3 uSumLow;
uniform vec3 uSumHigh;
uniform vec3 uSumTop;
uniform vec3 uSumDry;
uniform vec3 uSumBloom;
uniform vec3 uSumRock;
uniform vec3 uSumScree;
uniform vec2 uSumShares;
vec4 sumA;
vec4 sumB;
vec2 sumGrad;
// A share read with its edge broken by noise, so a patch's rim is ragged.
float sumEdge(float share, float n, float soft) {
  return smoothstep(0.5 - soft, 0.5 + soft, share + (n - 0.5) * 0.35);
}
`;

/** After `clipping_planes_fragment`: what this bit of ground is. */
export const SUMMER_FRAGMENT_SAMPLE = /* glsl */ `
{
  vec2 p = vSnowWorld.xz;
  snowDist = length(vSnowWorld - cameraPosition);
  vec2 guv = (p - uHeightOrigin + 0.5 * uCell) / (uHeightCount * uCell);
  vec4 g = texture2D(uGround, guv);
  snowForest = g.a;
  vec2 grad = g.rg;
  vec2 inside = clamp(p, uHeightOrigin, uHeightOrigin + (uHeightCount - 1.0) * uCell);
  float past = length(p - inside);
  if (past > 0.0) {
    vec3 vn = normalize(vSnowNormal);
    grad = mix(grad, -vn.xz / max(vn.y, 0.2), smoothstep(0.0, 30.0, past));
  }
  vec2 suv = p / uSummerSize;
  sumA = past > 0.0 ? vec4(0.0) : texture2D(uSummerA, suv);
  sumB = past > 0.0 ? vec4(0.0) : texture2D(uSummerB, suv);
  sumGrad = grad;
  snowN = normalize(vec3(-grad.x, 1.0, -grad.y));
}
`;

/** After `color_fragment`: the albedo, and the fine relief in the normal. */
export const SUMMER_FRAGMENT_COLOUR = /* glsl */ `
{
  vec2 p = vSnowWorld.xz;
  float y = vSnowWorld.y;
  float px = length(fwidth(p));
  float slope = length(sumGrad);
  float valley = uSummerBands.x;
  float line = uSummerBands.y;
  float top = uSummerBands.z;
  // THE NOISE THAT KEEPS IT FROM TILING: hundreds of metres, tens, a few.
  float n1 = snowNoise(p * 0.0024) * 0.6 + snowNoise(p * 0.0103 + 17.0) * 0.4;
  float n2 = snowNoise(p * 0.043 + 5.0);
  float n3 = snowNoise(p * 0.21 + 11.0);
  // The tree line is ragged: a band, not a contour.
  float edge = (n1 - 0.5) * 60.0 + (n2 - 0.5) * 25.0;
  float above = smoothstep(line - 15.0, line + 25.0, y + edge);
  float band = clamp((y - valley) / max(line - valley, 1.0), 0.0, 1.0);
  // THE SUN'S FACES dry first: the downhill way against the sun's.
  float sunny = clamp(dot(-sumGrad / max(slope, 1e-3), normalize(uSunDir.xz + 1e-4)), -1.0, 1.0)
    * smoothstep(0.05, 0.4, slope);
  vec3 grass = mix(uSumLow, uSumHigh, smoothstep(0.15, 0.95, band + (n1 - 0.5) * 0.35));
  float dry = uSumShares.x * (smoothstep(0.42, 0.75, n1 + 0.25 * sunny) + 0.4 * smoothstep(0.55, 0.85, n2));
  grass = mix(grass, uSumDry, clamp(dry, 0.0, 0.85));
  // A high meadow in bloom, just under the tree line and over it.
  float bloomAt = smoothstep(0.45, 0.9, band) * (1.0 - smoothstep(0.6, 1.0, above));
  grass = mix(grass, uSumBloom, uSumShares.y * bloomAt * smoothstep(0.45, 0.8, n2) * (0.5 + 0.5 * n3));
  vec3 alb = mix(grass, uSumTop * mix(0.85, 1.15, n2), above);
  // THE RUNS: short grass, darker and more even.
  float piste = sumEdge(sumB.r, n3, 0.15);
  alb = mix(alb, ${v3(G.piste)} * mix(0.9, 1.1, n2) * mix(vec3(1.0), uSumTop / max(uSumHigh, vec3(0.01)), above * 0.5), piste * 0.8);
  // KRUMMHOLZ and shrub, in dark clumps under the tree line.
  float scrub = sumEdge(sumB.g, snowNoise(p * 0.6), 0.2) * (1.0 - piste);
  alb = mix(alb, ${v3(G.scrub)} * mix(0.8, 1.2, snowNoise(p * 1.7 + 3.0)), scrub);
  // THE BOG: a moor's sedge and cotton grass, browner and duller than the
  // meadow with the grass still through it — the odd pool darker, never a
  // pool-black blot across a whole mire.
  float bog = sumEdge(sumB.b, n3, 0.3);
  float pool = smoothstep(0.62, 0.8, snowNoise(p * 0.35));
  alb = mix(alb, ${v3(G.bog)} * mix(0.95, 1.1, n2) * mix(1.0, 0.6, pool), bog * 0.7);
  // UNDER THE TREES: needles, loam and moss; and a wood from afar, darker.
  alb = mix(alb, ${v3(G.loam)} * mix(0.8, 1.2, n3), smoothstep(0.25, 0.75, snowForest) * 0.85);
  alb = mix(alb, uForestTint * 0.45, snowForest * 0.5 * smoothstep(160.0, 520.0, snowDist));
  // THE MOTTLE close in: a meadow's tufts and the light through them, a
  // metre or two across, gone before a pixel spans it.
  {
    float m1 = (snowNoise(p * 0.7) - 0.5) * (1.0 - smoothstep(0.3, 0.7, px * 0.7));
    float m2 = (snowNoise(p * 2.3 + 3.7) - 0.5) * (1.0 - smoothstep(0.3, 0.7, px * 2.3));
    float m3 = (snowNoise(p * 7.9 + 9.1) - 0.5) * (1.0 - smoothstep(0.3, 0.7, px * 7.9));
    alb *= 1.0 + (m1 * 0.35 + m2 * 0.3 + m3 * 0.35) * 0.55;
    vec2 tuft = snowNoiseGrad(p * 2.3 + 3.7, 0.05) * (1.0 - smoothstep(0.2, 0.6, px * 2.3));
    snowN = normalize(snowN + vec3(tuft.x, 0.0, tuft.y) * 0.12);
  }
  // THE MEADOW'S PATCHES at ten to a hundred metres: lusher and thinner
  // grass, a yellower dry streak, and the pale wash of a field in flower —
  // what a grassland reads as past the reach of its own blades.
  {
    float grassy = (1.0 - above * 0.6) * (1.0 - smoothstep(0.3, 0.7, snowForest));
    float lush = snowNoise(p * 0.021 + 13.0) - 0.5;
    float tone = snowNoise(p * 0.057 + 29.0) - 0.5;
    alb *= 1.0 + (lush * 0.42 + tone * 0.22) * grassy;
    alb = mix(alb, alb * vec3(1.12, 1.06, 0.78), smoothstep(0.1, 0.35, tone) * 0.5 * grassy);
    float blossom = smoothstep(0.55, 0.9, snowNoise(p * 0.035 + 51.0) * 0.8 + snowNoise(p * 0.21 + 7.0) * 0.2)
      * grassy * (1.0 - piste * 0.6);
    alb = mix(alb, alb * vec3(1.25, 1.22, 1.0) + vec3(0.03, 0.03, 0.02), blossom * 0.18 * smoothstep(8.0, 30.0, snowDist));
  }
  // THE BARE SCARS: earth, stony.
  float scar = sumEdge(sumA.g, snowNoise(p * 0.45 + 2.0), 0.12);
  vec3 earth = ${v3(G.earth)} * mix(0.8, 1.15, snowNoise(p * 0.9 + 7.0));
  earth *= 1.0 + 0.25 * smoothstep(0.7, 0.9, snowNoise(p * 4.0 + 1.0)) * (1.0 - smoothstep(0.3, 0.7, px * 4.0));
  alb = mix(alb, earth, scar);
  // THE CAT TRACKS: gravel, its two ruts and the grass down the middle.
  float road = smoothstep(0.35, 0.6, sumA.b);
  if (road > 0.0) {
    vec3 gravel = ${v3(G.gravel)} * mix(0.85, 1.1, snowNoise(p * 1.3));
    float crown = smoothstep(0.75, 0.95, sumA.b);
    gravel = mix(gravel, alb * 0.9, crown * 0.35 * (1.0 - smoothstep(0.3, 0.8, px)));
    alb = mix(alb, gravel, road);
  }
  // ROCK on the steep and high ground, and SCREE under it.
  float rocky = smoothstep(0.62, 0.92, slope + (n2 - 0.5) * 0.25 + above * 0.18 * smoothstep(0.4, 0.8, n3))
    * (1.0 - road);
  float scree = sumEdge(sumA.a, n3, 0.15) * (1.0 - road);
  vec3 stone = uSumRock * mix(0.65, 1.25, snowNoise(p * 0.31) * 0.6 + snowNoise(p * 1.9) * 0.4);
  vec3 talus = uSumScree * mix(0.7, 1.2, snowNoise(p * 2.6));
  alb = mix(alb, talus, scree);
  alb = mix(alb, stone, rocky);
  if (rocky + scree > 0.05 && snowDist < 120.0) {
    vec2 bump = snowNoiseGrad(p * 0.9, 0.08) * 0.5 + snowNoiseGrad(p * 3.1 + 5.0, 0.03) * 0.25;
    snowN = normalize(snowN + vec3(bump.x, 0.0, bump.y) * (rocky + 0.6 * scree) * (1.0 - smoothstep(60.0, 120.0, snowDist)));
  }
  // THE SNOW PATCHES of July: a scalloped white gone grey at its rim, the
  // grass wet and greener in a ring below.
  float wet = smoothstep(0.18, 0.42, sumA.r) * (1.0 - smoothstep(0.42, 0.55, sumA.r));
  alb = mix(alb, alb * vec3(0.8, 1.05, 0.75), wet * (1.0 - rocky) * 0.7);
  float snow = sumEdge(sumA.r, snowNoise(p * 0.5 + 23.0), 0.05);
  float rim = 1.0 - smoothstep(0.55, 0.8, sumA.r);
  vec3 patchTone = mix(${v3(G.snow)}, ${v3(G.dirty)}, rim * 0.7 + 0.15 * snowNoise(p * 1.4));
  // Old snow is cupped by the sun and dusted with what blew onto it.
  patchTone *= 1.0 - 0.14 * smoothstep(0.55, 0.85, snowNoise(p * 2.6 + 41.0)) * (1.0 - smoothstep(0.3, 0.7, px * 2.6));
  alb = mix(alb, patchTone, snow);
  // Above the far summits past the map, where nothing is baked: the high
  // rock and the old snow on it.
  // Turf and rock up to a few hundred metres over the summit; old snow only
  // in the hollows of what stands far higher still.
  float peak = smoothstep(top + 60.0, top + 360.0, y) * smoothstep(0.35, 0.65, slope + (n1 - 0.5) * 0.4);
  float high = smoothstep(top + 500.0, top + 900.0, y) * smoothstep(0.62, 0.8, n2);
  alb = mix(alb, stone, peak);
  alb = mix(alb, ${v3(G.snow)}, high);
  sumA.r = max(sumA.r, high);
  diffuseColor.rgb = alb;
}
`;

/** After `roughnessmap_fragment`: grass and earth are matt, wet snow less so. */
export const SUMMER_FRAGMENT_ROUGHNESS = /* glsl */ `
roughnessFactor = mix(0.92, 0.6, smoothstep(0.45, 0.6, sumA.r));
`;

/** After `lights_fragment_end`: the flat light's last relief, as the
 * snow's has it (a lid brighter over where the sun is). */
export const SUMMER_FRAGMENT_LIGHT = /* glsl */ `
{
  vec3 lidDir = normalize(vec3(uSunPos.x, 2.2, uSunPos.z));
  float facing = clamp(dot(snowN, lidDir) / lidDir.y, 0.0, 1.3);
  reflectedLight.indirectDiffuse *= mix(1.0, 0.55 + 0.45 * facing, uFlat);
}
`;
