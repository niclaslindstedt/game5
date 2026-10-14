// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK'S SHAPE IN THE GROUND'S SHADERS — `engine/game/rock-relief.ts`'
// `reliefParts` written again in GLSL, line for line: the same integer hash
// to the bit (`uint` arithmetic), the same value noise, the same beds,
// joints and ribs, so a vertex of the ground lifted by it lands where the
// physics (`withRock`) puts the rock. `tests/rock_relief_test.ts` reads this
// source against the engine's numbers, so a constant moved on one side alone
// fails it.
//
// Also the rock's share at a vertex: the ground map carries it in its packed
// channel as a NEGATIVE value (`terrain.ts`' `groundTextures` — no sampler
// and no memory of its own), so the share at a node is `max(-b, 0)` and the
// packed snow `max(b, 0)`. The vertex blends the four nodes round it by hand
// (`texelFetch`) rather than by the hardware's filter, whose weights some
// GPUs keep to eight bits, so its blend is the engine's (`rockMask`) to the
// float.

import * as THREE from "three";
import {
  RELIEF,
  ROCK_MASK as MASK,
  ROCKS,
  regionOf,
  reliefParams,
  rockShareNodes,
  type Level,
} from "@engine";

const f = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** The rock's uniforms, functions and share reader, for both halves. */
export const ROCK_RELIEF_GLSL = /* glsl */ `
// The map's rock as dealt (\`reliefParams\`): (dipX, dipZ, bed, joint),
// (jointX, jointZ), the salt; and whether the rock is drawn at all (the
// labs hide the "rocks" group to price it).
uniform vec4 uRelief;
uniform vec2 uRelief2;
uniform uint uReliefSalt;
uniform float uRockOn;
// The vertex's rock share (eased) and its ground under the rock.
varying float vSnowRock;
varying float vSnowBase;
// The fragment's rock state, beside \`snowRock\`.
float snowRockBed; // the bed coordinate here (its whole part the bed)
float snowRockBlock; // the joint coordinate here (its whole part the block)
float snowRockFade; // 1 where a pixel can carry the beds, 0 where it cannot
float snowRockFoot; // m a pixel spans here
vec2 snowRockFall; // the fall line here, the way down

uint rrH32(uint v) {
  v ^= v >> 16u;
  v *= 0x7feb352du;
  v ^= v >> 15u;
  v *= 0x846ca68bu;
  v ^= v >> 16u;
  return v;
}
float rrHash(int i, int j, uint s) {
  uint h = rrH32(uint(i + 65536) ^ rrH32(uint(j + 65536) ^ rrH32(s)));
  return float(h >> 8u) / 16777216.0;
}
float rrNoise(vec2 q, uint s) {
  vec2 fl = floor(q);
  int i = int(fl.x);
  int j = int(fl.y);
  vec2 t = q - fl;
  vec2 u = t * t * (3.0 - 2.0 * t);
  float a = rrHash(i, j, s);
  float b = rrHash(i + 1, j, s);
  float c = rrHash(i, j + 1, s);
  float d = rrHash(i + 1, j + 1, s);
  return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}

// THE ROCK'S RELIEF at plan q over ground y, in its parts: x the beds and
// blocks, y the ribs, z the bed coordinate, w the block coordinate (the
// colour reads the last two).
vec4 rrParts(vec2 q, float y) {
  float T = uRelief.z;
  uint s = uReliefSalt;
  float u = dot(uRelief2, q) / uRelief.w + ${f(RELIEF.jointWarp)} * rrNoise(q / 11.0, s + 3u);
  float cf = floor(u);
  int c = int(cf);
  float fu = u - cf;
  float w = ${f(RELIEF.crack)};
  float across = smoothstep(1.0 - w, 1.0, fu);
  float h0 = rrHash(c, 0, s + 5u);
  float shift = ${f(RELIEF.shift)} * (h0 + (rrHash(c + 1, 0, s + 5u) - h0) * across);
  float warp = ${f(RELIEF.warp[0])} * (rrNoise(q / ${f(RELIEF.warpLength[0])}, s + 1u) - 0.5)
    + ${f(RELIEF.warp[1])} * (rrNoise(q / ${f(RELIEF.warpLength[1])}, s + 2u) - 0.5);
  float b = (y + uRelief.x * q.x + uRelief.y * q.y) / T + warp + shift;
  float kf = floor(b);
  int k = int(kf);
  float fb = b - kf;
  float r = ${f(RELIEF.riser[0])} + ${f(RELIEF.riser[1])} * rrHash(k, 1, s + 7u);
  float tau = ${f(RELIEF.tread[0])} + ${f(RELIEF.tread[1])} * rrHash(k, 2, s + 7u);
  float S;
  if (fb < 1.0 - r) {
    S = tau * fb / (1.0 - r);
  } else {
    float t = (fb - (1.0 - r)) / r;
    S = tau + (1.0 - tau) * t * t * (3.0 - 2.0 * t);
  }
  float inBlock = smoothstep(0.0, 0.12, fu) * (1.0 - smoothstep(1.0 - w - 0.1, 1.0 - w, fu));
  float inBed = smoothstep(0.04, 0.2, fb) * (1.0 - smoothstep(0.85, 0.98, fb));
  float bulge = ${f(RELIEF.bulge)} * (rrHash(c, k, s + 9u) - 0.35) * inBlock * inBed;
  float notch = fu > 1.0 - w ? ${f(RELIEF.notch)} * sin(3.14159265 * (fu - (1.0 - w)) / w) : 0.0;
  float rn = rrNoise(q / ${f(RELIEF.rib)}, s + 11u);
  return vec4(T * (S - fb) + bulge - notch, ${f(RELIEF.ribRelief)} * (0.5 - abs(2.0 * rn - 1.0)), b, u);
}

// The beds' mean lift, m.
float rrLift() { return ${f(RELIEF.lift)} * uRelief.z; }

// The share eased into the mask (\`rockMask\`'s \`ease\`).
float rrMask(float raw) {
  return raw > ${f(MASK[0])} ? smoothstep(${f(MASK[0])}, ${f(MASK[1])}, raw) : 0.0;
}
`;

/** The share at node c of the ground map, none off it (`rockMask`'s
 * `nodeOf`), and the vertex's rock: its share eased, and how far the
 * relief lifts it — the beds fading as the vertices thin out past where
 * they can carry a bed (the fragment paints them on there), the ribs
 * likewise. Reads `snowXZ`, `snowBaseY`, `snowGroundV` and `snowR`; sets
 * `vSnowRock` and `snowRockY`. */
export const ROCK_VERTEX = /* glsl */ `
float snowRockY = 0.0;
vSnowRock = 0.0;
if (uRockOn > 0.5) {
  vec2 rf = (snowXZ - uHeightOrigin) / uCell;
  vec2 ri = floor(rf);
  vec2 rt = rf - ri;
  ivec2 rc = ivec2(ri);
  ivec2 top = ivec2(uHeightCount) - 1;
  vec4 rn;
  for (int q = 0; q < 4; q++) {
    ivec2 at = rc + ivec2(q & 1, q >> 1);
    bool on = all(greaterThanEqual(at, ivec2(0))) && all(lessThanEqual(at, top));
    rn[q] = on ? max(-texelFetch(uGround, at, 0).b, 0.0) : 0.0;
  }
  float rlo = rn.x + (rn.y - rn.x) * rt.x;
  float raw = rlo + (rn.z + (rn.w - rn.z) * rt.x - rlo) * rt.y;
  vSnowRock = rrMask(raw);
  if (vSnowRock > 0.0) {
    vec4 rp = rrParts(snowXZ, snowBaseY);
    float rs = max(length(snowGroundV.rg), 0.3);
    float fb = smoothstep(2.0, 4.0, uRelief.z / (rs * snowR));
    float fr = smoothstep(2.0, 4.0, ${f(RELIEF.rib)} / snowR);
    snowRockY = vSnowRock * (rp.x * fb + rp.y * fr + rrLift());
  }
}
`;

/** In the fragment's sample, where `snowRock` is decided: the old paint on
 * any steep face, and on the rock the relief's own normal added to the
 * ground's — the beds differenced a pixel apart, faded as a pixel grows
 * past them — and the rock bare where its facet is too steep to hold the
 * snow, as the physics reads it (`ROCKS.skin.holds`, `.slides`). Reads
 * `p`, `g`, `grad`, `rockShareGrad`, `rockFoot`. */
export const ROCK_FRAGMENT_SAMPLE = /* glsl */ `
  snowRock = uRock.w * smoothstep(uRockSlope.x, uRockSlope.y, length(grad)) * (1.0 - snowPacked);
  snowRockBed = 0.0;
  snowRockBlock = 0.0;
  snowRockFade = 0.0;
  snowRockFoot = rockFoot;
  snowRockFall = -g.rg / max(length(g.rg), 1e-4);
  float rockM = uRockOn > 0.5 ? vSnowRock : 0.0;
  if (rockM > 0.0) {
    float d = clamp(rockFoot * 0.75, 0.04, 2.0);
    float yb = vSnowBase;
    vec4 c0 = rrParts(p, yb);
    vec4 cx = rrParts(p + vec2(d, 0.0), yb + g.r * d);
    vec4 cz = rrParts(p + vec2(0.0, d), yb + g.g * d);
    float rs = max(length(g.rg), 0.3);
    float fb = 1.0 - smoothstep(0.1, 0.3, rockFoot * rs / uRelief.z);
    vec2 rg = vec2(cx.x - c0.x, cz.x - c0.x) / d * fb + vec2(cx.y - c0.y, cz.y - c0.y) / d;
    float rel = c0.x * fb + c0.y + rrLift();
    float raw = max(-g.b, 0.0);
    float t = clamp((raw - ${f(MASK[0])}) / ${f(MASK[1] - MASK[0])}, 0.0, 1.0);
    vec2 dm = raw > ${f(MASK[0])} ? 6.0 * t * (1.0 - t) / ${f(MASK[1] - MASK[0])} * rockShareGrad : vec2(0.0);
    grad += rockM * rg + rel * dm;
    snowRockBed = c0.z;
    snowRockBlock = c0.w;
    snowRockFade = fb;
    // Bare where the facet sheds the snow; its edge ragged, as snow lies.
    vec3 rn = normalize(vec3(-grad.x, 1.0, -grad.y));
    float ny = rn.y + 0.07 * (snowNoise(p * 1.9 + 5.0) - 0.5) + 0.04 * (snowNoise(p * 6.1) - 0.5);
    float bare = 1.0 - clamp((ny - ${f(ROCKS.skin.slides)}) / ${f(ROCKS.skin.holds - ROCKS.skin.slides)}, 0.0, 1.0);
    snowRock = mix(snowRock, bare, rockM);
    // The stone's own grain, a hand across, on the bare rock.
    float grain = (1.0 - smoothstep(0.2, 0.6, rockFoot * 2.3)) * snowRock;
    grad += snowNoiseGrad(p * 2.3 + 17.0, 0.1) * 2.3 * 0.06 * grain;
    grad += snowNoiseGrad(p * 7.9 + 3.0, 0.1) * 7.9 * 0.012 * grain;
  }
`;

/** In the fragment's colour: the rock's albedo — each bed its own stone,
 * laminae in it, the joints' cracks and the riser's foot in shade, its lip
 * worn pale, streaks down the fall line, lichen, and rime on the windward
 * faces. Mixed over the snow by `snowRock`. */
export const ROCK_FRAGMENT_COLOUR = /* glsl */ `
  if (snowRock > 0.0) {
    vec3 rc = uRock.rgb * mix(0.7, 1.2, snowNoise(p * 0.6));
    if (snowRockFade > 0.0) {
      float bed = snowRockBed;
      float kf = floor(bed);
      int k = int(kf);
      float fbd = bed - kf;
      uint s = uReliefSalt + 13u;
      float aa = snowRockFade;
      vec3 bc = uRock.rgb * mix(0.7, 1.3, rrHash(k, 3, s));
      float kind = rrHash(k, 4, s);
      bc *= kind > 0.82 ? vec3(1.2, 1.0, 0.8) : kind < 0.14 ? vec3(1.3, 1.28, 1.24) : vec3(1.0);
      float lam = 1.0 - smoothstep(0.15, 0.4, snowRockFoot * 9.0 / uRelief.z);
      bc *= 1.0 + 0.16 * lam * (snowNoise(vec2(bed * 9.0, snowRockBlock * 0.6)) - 0.5) * 2.0;
      // The riser's foot in shade, its lip worn pale.
      float r = ${f(RELIEF.riser[0])} + ${f(RELIEF.riser[1])} * rrHash(k, 1, uReliefSalt + 7u);
      float foot = smoothstep(0.0, 0.03, fbd - (1.0 - r)) * (1.0 - smoothstep(0.03, 0.12, fbd - (1.0 - r)));
      float lip = smoothstep(0.93, 0.99, fbd);
      bc *= 1.0 - 0.45 * foot;
      bc = mix(bc, bc * 1.35 + 0.03, 0.5 * lip);
      // The joints' cracks.
      float jc = fract(snowRockBlock);
      float w = ${f(RELIEF.crack)};
      float crack = smoothstep(1.0 - w, 1.0 - w * 0.6, jc) * (1.0 - smoothstep(1.0 - w * 0.4, 1.0, jc));
      bc *= 1.0 - 0.6 * crack;
      rc = mix(rc, bc, aa);
    }
    // Streaks down the fall line, where water runs and lichen follows it.
    vec2 fl = snowRockFall;
    float sa = 1.0 - smoothstep(0.2, 0.6, snowRockFoot * 1.3);
    float streak = snowNoise(vec2(dot(p, vec2(-fl.y, fl.x)) * 1.3, dot(p, fl) * 0.05));
    rc *= 1.0 - 0.3 * smoothstep(0.5, 0.85, streak) * sa;
    float lich = smoothstep(0.62, 0.8, snowNoise(p * 0.9 + 7.0)) * (1.0 - smoothstep(0.3, 0.8, snowRockFoot * 0.9));
    rc = mix(rc, vec3(0.3, 0.31, 0.2) * 1.3, 0.35 * lich);
    float rust = smoothstep(0.66, 0.85, snowNoise(p * 0.37 + 2.0));
    rc *= mix(vec3(1.0), vec3(1.15, 0.95, 0.78), 0.5 * rust);
    // Rime plastered on the faces the wind comes at.
    float windward = dot(normalize(snowN.xz + vec2(1e-5)), uWindDir) * length(snowN.xz);
    float rime = smoothstep(0.25, 0.7, windward) * smoothstep(0.4, 0.7, snowNoise(p * 1.6 + 11.0));
    rc = mix(rc, vec3(0.86, 0.9, 0.95), 0.55 * rime);
    alb = mix(alb, rc, snowRock);
  }
`;

/** THE ROCK'S UNIFORMS for a map, one set shared by every material that
 * draws its ground (so one switch, `uRockOn`, hides it from every one). */
export type ReliefUniforms = {
  uRelief: { value: THREE.Vector4 };
  uRelief2: { value: THREE.Vector2 };
  uReliefSalt: { value: number };
  uRockOn: { value: number };
};

const uniformsOf = new WeakMap<Level, ReliefUniforms>();

/** The rock's uniforms for `level` — off where its region lays no rock. */
export function reliefUniforms(level: Level): ReliefUniforms {
  const had = uniformsOf.get(level);
  if (had) return had;
  const p = reliefParams(level);
  const made: ReliefUniforms = {
    uRelief: { value: new THREE.Vector4(p.dipX, p.dipZ, p.bed, p.joint) },
    uRelief2: { value: new THREE.Vector2(p.jointX, p.jointZ) },
    uReliefSalt: { value: p.salt >>> 0 },
    uRockOn: { value: regionOf(level).rock ? 1 : 0 },
  };
  uniformsOf.set(level, made);
  return made;
}

/** How long the rock's share took to read at every node, ms — the bake the
 * ground map is written with (`terrain.ts`), counted as the rock's own. */
const bakes = new WeakMap<Level, number>();

/** The share at every node of `level`'s heightfield, none where its region
 * lays no rock; the time it took kept for `rockBakeMs`. */
export function rockShareBake(level: Level): Float32Array | null {
  if (!regionOf(level).rock) return null;
  const t0 = performance.now();
  const nodes = rockShareNodes(level);
  bakes.set(level, (bakes.get(level) ?? 0) + performance.now() - t0);
  return nodes;
}

/** What `rockShareBake` has cost `level` so far, ms. */
export function rockBakeMs(level: Level): number {
  return bakes.get(level) ?? 0;
}
