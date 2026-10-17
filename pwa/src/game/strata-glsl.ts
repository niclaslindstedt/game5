// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK'S BEDS AS TONE, IN GLSL — the engine's beds (`engine/game/
// strata.ts`: `bedLevel`, `bedOf`, the fold of the dip plane, the treads'
// snow) written again for the shaders, so a far face can be PAINTED in the
// very bands its skin is built in: the rock's own shader carries them past
// the distance the skin is calmed over (`rocks.ts`), and the ground's
// (`snow-glsl.ts`) past the skin's reach, the same bed the same shade and
// the same snowy tread on both sides of the hand-over, so no seam shows.
//
// THE HASH IS THE ENGINE'S TO THE BIT: `rocks.ts`' `hashOf` / `unit` is a
// 32-bit integer mix (a multiply, two xor-shifts, a multiply, a xor-shift),
// written here in `uint` arithmetic, where a multiply wraps as `Math.imul`
// does and `>>` is `>>>`. A bed's level and draws are therefore the same
// numbers in TypeScript and on the GPU (`tests/strata_glsl_test.ts` holds
// the constants and the mix to the engine's). The value noise the fold is
// made of is the engine's to the float.
//
// THE BANDS ARE BOX-FILTERED over the pixel's own footprint on the bed
// coordinate (`fwidth`): a bed thinner than a pixel is averaged with its
// neighbours, not picked, and a face too far for a bed to span a few pixels
// fades to the beds' mean — the mean the calmed skin and the ground already
// paint — so the bands add tone and never a flicker.

import { ROCKS, strataOf, type Level } from "@engine";
import * as THREE from "three";
import { FAR_EVEN } from "./rock-shapes.ts";

export { FAR_EVEN };

const S = ROCKS.strata;
const f = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const u = (n: number): string => `0x${(n >>> 0).toString(16)}u`;

/** The engine's hash basis and mix constants (`rocks.ts`). */
export const STRATA_HASH = {
  basis: 0x811c9dc5,
  m1: 0x01000193,
  m2: 0x2c1b3c6d,
  s1: 15,
  s2: 12,
} as const;

/** The salts each draw is made off, as `strata.ts` and `rock-shapes.ts`
 * make them. */
export const STRATA_SALTS = {
  swell: 0x36,
  vary: 0x31,
  riser: 0x32,
  shade: 0x77,
  deal: 0x79,
  fold: 0x11,
  fold2: 0x12,
} as const;

/** The beds' mean snowy-tread share (`(1 − riser) × held`, over beds): what
 * a band's snow is laid about, so the bands move no face's mean. */
export const TREAD_MEAN = (1 - (S.riser[0] + S.riser[1]) / 2) * 0.35;

/** THE ROCK CALMED WITH DISTANCE, m off the lens: from here its facets ease
 * to the beds' tone (`rocks.ts`), and the ground under it takes the skin's
 * far colour on over the same span (`snow-glsl.ts`). */
export const CALM_FROM = 40;
export const CALM_TO = 300;

/** How much of a band's snowy tread is laid over a far face's even cover. */
export const BAND_SNOW = 0.35;

/** THE FAR FACE: dark rock with white ledges, never a pale wash. Of the
 * calmed face's even snow (`rock-shapes.ts`' `even`) this share is kept
 * spread over it (`FAR_EVEN`), and its own share again is laid on the
 * beds' snowy treads (`FAR_LEDGE`, on top of `BAND_SNOW`), the stone under
 * it darkened to `FAR_DARK` of its tone — `stFar`, which the skin's calm
 * and the ground under it (`snow-glsl.ts`) both paint with. */
export const FAR_LEDGE = 1.3;
export const FAR_DARK = 0.88;
/** Past the flicker's mid shots the bare stone darkens on to `FAR_DARKEST`
 * of its tone, over `FAR_DARK_FROM`–`FAR_DARK_TO` m: a face 400 m off and
 * more read pale blue-grey in the sky's light, and a darker stone at every
 * range flickered at 300 m, where a pixel still spans a bed's tread. */
export const FAR_DARKEST = 0.7;
export const FAR_DARK_FROM = 380;
export const FAR_DARK_TO = 500;
/** Over the same span the even snow spread over a far face falls to
 * `FAR_EVEN_FAR` of it and the ledges carry more (`FAR_LEDGE_FAR`): the
 * pale wash 400 m out was the even cover, the stone under it dark enough. */
export const FAR_EVEN_FAR = 0.45;
export const FAR_LEDGE_FAR = 2.2;

/** THE AIR OVER BARE ROCK: the share of the haze and the DISTANCE row's
 * mist (`haze.ts`' `HAZE_KEEP`) laid over the bare stone of the skin, and
 * of the ground where it carries the skin's far face. The mist stood at
 * over half the way to the sky's colour 400 m out and washed a dark face
 * pale; the snow round it keeps the whole share, so the face reads darker
 * than the snow at range, as a real one does. */
export const ROCK_HAZE = 0.7;
/** Laid on over `ROCK_HAZE_IN`–`ROCK_HAZE_FROM` m (nearer, the mist is
 * thin and the flicker's 300 m shot paid for it) and given back over
 * `ROCK_HAZE_FROM`–`ROCK_HAZE_TO` m: out there the skin's
 * coarse cut and the ground under it trade pixels as the lens moves, and
 * only the whole mist makes the two the same colour (the thinner air made
 * 600 m flicker three times as much). */
export const ROCK_HAZE_IN = 340;
export const ROCK_HAZE_FROM = 420;
export const ROCK_HAZE_TO = 600;

/** The uniforms: the map's strata seed, and (dipX, dipZ, bed, on). */
export type StrataUniforms = {
  uStSeed: { value: number };
  uStrata: { value: THREE.Vector4 };
};

/** `level`'s beds as the shaders read them; off where its region lays no
 * rock. */
export function strataUniforms(level: Level, on: boolean): StrataUniforms {
  const st = strataOf(level);
  return {
    uStSeed: { value: st.seed >>> 0 },
    uStrata: { value: new THREE.Vector4(st.dipX, st.dipZ, st.bed, on ? 1 : 0) },
  };
}

/** The functions, for any stage. */
export const STRATA_GLSL = /* glsl */ `
uniform uint uStSeed;
uniform vec4 uStrata;
uint stMix(uint h, uint v) {
  h = (h ^ v) * ${u(STRATA_HASH.m1)};
  h ^= h >> ${STRATA_HASH.s1}u;
  h *= ${u(STRATA_HASH.m2)};
  return h ^ (h >> ${STRATA_HASH.s2}u);
}
// hashOf(seed', salt, k) and unit(hash, 0).
uint stHash(uint seed, uint salt, int k) {
  return stMix(stMix(stMix(${u(STRATA_HASH.basis)}, seed), salt), uint(k));
}
float stUnit(uint h) {
  return float(stMix(stMix(${u(STRATA_HASH.basis)}, h), 0u)) * (1.0 / 4294967296.0);
}
float stDraw(uint salt, int k) { return stUnit(stHash(uStSeed, salt, k)); }
// The engine's value noise, -1..1 (\`strata.ts\`' \`noise\`).
float stNoise(uint seed, vec2 q) {
  vec2 fl = floor(q);
  int i = int(fl.x);
  int j = int(fl.y);
  vec2 t = q - fl;
  t = t * t * (3.0 - 2.0 * t);
  float a = stUnit(stHash(seed, uint(i), j));
  float b = stUnit(stHash(seed, uint(i + 1), j));
  float c = stUnit(stHash(seed, uint(i), j + 1));
  float d = stUnit(stHash(seed, uint(i + 1), j + 1));
  return 2.0 * (a + (b - a) * t.x + (c - a) * t.y + (a - b - c + d) * t.x * t.y) - 1.0;
}
// THE BED COORDINATE of ground at height y over plan q, with no joint jog
// (\`bedCoord\` at soft 0, as a far cut lays it).
float stCoord(vec2 q, float y) {
  float fo = ${f(S.foldOver)};
  float fold = ${f(S.fold)} * (stNoise(uStSeed ^ ${u(STRATA_SALTS.fold)}, q / fo)
    + 0.4 * stNoise(uStSeed ^ ${u(STRATA_SALTS.fold2)}, q / (fo * 0.37)));
  return y - uStrata.x * q.x - uStrata.y * q.y - fold;
}
// Bed k's foot (\`bedLevel\`, a bed at a time).
float stLevel(int k) {
  float t = float(k) / ${f(S.packet)};
  float ti = floor(t);
  float fr = t - ti;
  fr = fr * fr * (3.0 - 2.0 * fr);
  int i = int(ti);
  float a = stDraw(${u(STRATA_SALTS.swell)}, i);
  float b = stDraw(${u(STRATA_SALTS.swell)}, i + 1);
  float swell = 2.0 * (a + (b - a) * fr) - 1.0;
  float vary = 2.0 * (stDraw(${u(STRATA_SALTS.vary)}, k) - 0.5);
  return uStrata.z * (float(k) + ${f(S.swell)} * swell + ${f(S.vary)} * vary);
}
// A bed's tone about the beds' mean: x its shade (\`rock-shapes.ts\`' bed
// shade, 0.8..1.2), y its snowy tread's share of it less the mean.
vec2 stTone(int k) {
  float shade = 0.4 * (stDraw(${u(STRATA_SALTS.shade)}, k) - 0.5);
  float riser = ${f(S.riser[0])} + ${f(S.riser[1] - S.riser[0])} * stDraw(${u(STRATA_SALTS.riser)}, k);
  float held = max(0.0, (stDraw(${u(STRATA_SALTS.deal)}, k) - 0.3) / 0.7);
  return vec2(shade, (1.0 - riser) * held - ${TREAD_MEAN.toFixed(4)});
}
// THE BANDS at bed coordinate w over a pixel spanning fw of it: the bed's
// tone (\`stTone\`) box-filtered with its neighbours over the pixel, faded
// to nothing (the mean) where a bed is under a few pixels. z the fade.
vec3 stBands(float w, float fw) {
  float bed = uStrata.z;
  float amp = 1.0 - smoothstep(0.18, 0.5, fw / bed);
  if (amp <= 0.0) return vec3(0.0);
  int k = int(floor(w / bed));
  float l0 = stLevel(k);
  float l1;
  if (l0 > w) {
    l1 = l0;
    k -= 1;
    l0 = stLevel(k);
    if (l0 > w) { l1 = l0; k -= 1; l0 = stLevel(k); }
  } else {
    l1 = stLevel(k + 1);
    if (l1 <= w) { k += 1; l0 = l1; l1 = stLevel(k + 1); }
    if (l1 <= w) { k += 1; l0 = l1; l1 = stLevel(k + 1); }
  }
  // Never a hard edge: a bed's foot is a few per cent of a bed soft even
  // where the pixel is finer, so a sliding lens moves no stair along it.
  float h = 0.75 * fw + 0.06 * bed;
  float up = clamp((w + h - l1) / (2.0 * h), 0.0, 1.0);
  float down = clamp((l0 - (w - h)) / (2.0 * h), 0.0, 1.0);
  vec2 t = stTone(k) * (1.0 - up - down);
  if (up > 0.0) t += stTone(k + 1) * up;
  if (down > 0.0) t += stTone(k - 1) * down;
  return vec3(t * amp, amp);
}
// THE FAR FACE'S COLOUR (\`FAR_EVEN\`): the stone, its even snow and its
// bands (\`stBands\`), the ledges' snow scaled by \`ledge\` (none in summer).
// The share of the air over the far stone (\`ROCK_HAZE\`), \`dist\` m off.
float stHazeKeep(float dist) {
  float on = smoothstep(${ROCK_HAZE_IN.toFixed(1)}, ${ROCK_HAZE_FROM.toFixed(1)}, dist);
  return mix(1.0, ${ROCK_HAZE.toFixed(2)}, on * (1.0 - smoothstep(${ROCK_HAZE_FROM.toFixed(1)}, ${ROCK_HAZE_TO.toFixed(1)}, dist)));
}
// The stone darker on past the mid band, \`dist\` m off (\`FAR_DARKEST\`).
vec3 stFar(vec3 stone, vec3 snowC, float even, vec3 b, float ledge, float dist) {
  float far = smoothstep(${FAR_DARK_FROM.toFixed(1)}, ${FAR_DARK_TO.toFixed(1)}, dist);
  float cover = clamp(mix(${FAR_EVEN.toFixed(2)}, ${FAR_EVEN_FAR.toFixed(2)}, far) * even
    + (${BAND_SNOW.toFixed(2)} + mix(${FAR_LEDGE.toFixed(2)}, ${FAR_LEDGE_FAR.toFixed(2)}, far) * even) * b.y * ledge, 0.0, 1.0);
  float dark = mix(${FAR_DARK.toFixed(2)}, ${FAR_DARKEST.toFixed(2)}, far);
  return mix(stone * dark * (1.0 + b.x), snowC, cover);
}
`;
