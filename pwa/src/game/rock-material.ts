// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK'S OWN MATERIAL — the drops' rock (`rock-shapes.ts`) shaded AS
// ROCK in its shader, procedurally, with no texture: everything under the
// skin's four-metre lattice that makes a crag read as stone rather than as
// facets.
//
// WHAT A REAL CRAG IS MADE OF (RESEARCH, round 1 of the rock lab): BEDS —
// layers a metre or two thick dipping the same way across a whole wall,
// each its own shade, parted by a groove where a soft bed weathers back and
// holding a line of snow along its top; JOINTS — two sets of planes square
// to the beds, a few metres apart, that cut every bed into BLOCKS, each a
// shade and a tilt of its own, the cracks between them dark and, where the
// face lies back, full of snow; GRAIN under that; STREAKS of water and iron
// down the fall line; LICHEN in patches; RIME plastered on the windward
// side of every rib; and the new snow dusting the whole face.
//
// The beds' dip and the joints' strike are dealt off the map's seed and
// wander slowly across it (`dipOf`), so each wall has its own. Every term
// is a function of the world position, so a tile's seam never shows; and
// every term FADES with the size of a pixel on the rock (`fwidth`) and with
// the distance the skin is calmed over (`rocks.ts`' `CALM_*`) — a crack is
// gone before it is thinner than a pixel, a bed's tone before a bed is, so
// nothing twinkles as the lens moves. The bump is SHADING ONLY (a surface
// gradient off the procedural height, Mikkelsen's method — no tangents, no
// UVs): it moves no vertex, so the rock a body meets (`rock-ground.ts`) is
// still the rock drawn, to the few centimetres of the bump.
//
// THE SNOW is laid where the ridden skin is snow (the facet's own tilt,
// `RockMesh.snow`), and added on top where the detail holds it: along bed
// tops, in cracks on a face that lies back, on the windward side, dusted
// fresh — with a ragged, rounded edge, and the bump smoothed out under it.

import * as THREE from "three";
import { rockHash, rockDraw, windAt, type Level } from "@engine";

import { summerShown } from "./season-look.ts";

/** THE BEDS: their thickness, m, and the noise that warps a bed's edge, of
 * a bed. Bedding is "thick" at 0.3–1 m and massive past it; the game's
 * walls are seen from tens of metres, so a bed is the size that reads. */
const BED = 1.6;
const BED_WARP = 0.2;
/** The steepest the beds dip and the least, rad. */
const DIP_LEAST = (4 * Math.PI) / 180;
const DIP_MOST = (25 * Math.PI) / 180;
/** THE JOINTS: the first set's spacing, m (a bed's own, scaled by a draw
 * per bed), and the second's. */
const JOINT = 2.4;
const JOINT_CROSS = 5.5;

/** The uniforms the material reads, beyond the haze's. */
export type RockUniforms = {
  /** The beds' pole (a unit normal to the bedding) where the map's walls
   * start from, and the first joint set's strike (a unit vector along it),
   * both before the slow wander across the map. */
  uRockDip: { value: THREE.Vector3 };
  uRockStrike: { value: THREE.Vector3 };
  /** Where the wind blows toward, xz, its length how hard (0..1). */
  uRockWind: { value: THREE.Vector2 };
  /** 1 in summer: turf on the ledges, half covering, never snow. */
  uRockSummer: { value: number };
};

/** The map's bedding and wind, dealt off its seed. */
export function rockUniformsOf(level: Level): RockUniforms {
  const h = rockHash(level.seed, 0x62656473);
  const dip = DIP_LEAST + (DIP_MOST - DIP_LEAST) * rockDraw(h, 0);
  const toward = rockDraw(h, 1) * Math.PI * 2;
  const pole = new THREE.Vector3(
    Math.sin(dip) * Math.sin(toward),
    Math.cos(dip),
    Math.sin(dip) * Math.cos(toward),
  );
  // The first joint set strikes square-ish to the dip, turned a little off.
  const turn = toward + Math.PI / 2 + (rockDraw(h, 2) - 0.5) * 0.6;
  const strike = new THREE.Vector3(Math.sin(turn), 0, Math.cos(turn));
  strike.addScaledVector(pole, -strike.dot(pole)).normalize();
  const w = windAt(level, 0);
  const hard = Math.min(1, w.speed / 12);
  const l = Math.hypot(w.x, w.z) || 1;
  return {
    uRockDip: { value: pole },
    uRockStrike: { value: strike },
    uRockWind: { value: new THREE.Vector2((w.x / l) * hard, (w.z / l) * hard) },
    uRockSummer: { value: summerShown() ? 1 : 0 },
  };
}

/** Declarations the vertex shader takes. */
export const ROCK_VERTEX_HEAD = /* glsl */ `
attribute float snow;
attribute float bare;
uniform vec3 uRockDip;
uniform vec3 uRockStrike;
varying vec3 vRockN;
varying vec3 vRockDip;
varying vec3 vRockStrike;
varying float vRockSnow;
varying float vRockBare;
varying vec3 vRockSoft;
varying float vRockCalm;
float rkVHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float rkVNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(rkVHash(i), rkVHash(i + vec3(1, 0, 0)), f.x),
        mix(rkVHash(i + vec3(0, 1, 0)), rkVHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(rkVHash(i + vec3(0, 0, 1)), rkVHash(i + vec3(1, 0, 1)), f.x),
        mix(rkVHash(i + vec3(0, 1, 1)), rkVHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
`;

/** After the normal is read (and calmed, `rocks.ts`): the world normal, the
 * snow, the calm share, and the bedding WANDERED over the map — a wall
 * every few hundred metres dips its own way. Per vertex: the wander is far
 * slower than a cell. */
export const ROCK_VERTEX_MAIN = /* glsl */ `
{
  vec3 rkW = (modelMatrix * vec4(position, 1.0)).xyz;
  vRockN = normalize(mat3(modelMatrix) * objectNormal);
  vRockSnow = snow;
  vRockBare = bare;
  vRockSoft = mat3(modelMatrix) * soft;
  vRockCalm = rockCalm;
  vec3 rkWander = vec3(rkVNoise(rkW / 380.0), rkVNoise(rkW / 380.0 + 17.0), rkVNoise(rkW / 380.0 + 41.0)) - 0.5;
  vRockDip = normalize(uRockDip + rkWander * 0.3);
  vec3 rkS = normalize(uRockStrike + rkWander.zxy * 0.6);
  vRockStrike = normalize(rkS - vRockDip * dot(rkS, vRockDip));
}
`;

/** The fragment's declarations: the uniforms, the varyings, the noise. */
export const ROCK_FRAGMENT_HEAD = /* glsl */ `
uniform vec2 uRockWind;
uniform float uRockSummer;
uniform float uFresh;
varying vec3 vRockN;
varying vec3 vRockDip;
varying vec3 vRockStrike;
varying float vRockSnow;
varying float vRockBare;
varying vec3 vRockSoft;
varying float vRockCalm;
float rkHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float rkHash2(vec2 p) { return rkHash(vec3(p, 7.13)); }
float rkNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(rkHash(i), rkHash(i + vec3(1, 0, 0)), f.x),
        mix(rkHash(i + vec3(0, 1, 0)), rkHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(rkHash(i + vec3(0, 0, 1)), rkHash(i + vec3(1, 0, 1)), f.x),
        mix(rkHash(i + vec3(0, 1, 1)), rkHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
// A groove's darkness and depth at distance d (m) from its line, w wide,
// smoothed over the pixel's own footprint px so it never aliases.
float rkLine(float d, float w, float px) {
  return 1.0 - smoothstep(w, w + 1.5 * px, d);
}
`;

/** The rock itself, at three's colour stage (world space, in `main`):
 * leaves the albedo in `diffuseColor` and the perturbed world normal in
 * `rkNormal` for the normal stage. */
export const ROCK_FRAGMENT_COLOUR = /* glsl */ `
#include <color_fragment>
vec3 rkNormal;
{
  vec3 p = vHazeWorld;
  vec3 dpx = dFdx(p);
  vec3 dpy = dFdy(p);
  // The size of a pixel on the rock, m.
  float px = max(length(dpx), length(dpy)) + 1e-4;
  vec3 N = normalize(vRockN);
  // The DETAIL: whole close in, gone where the skin is calmed or a pixel
  // is the size of what it would draw.
  float far = 1.0 - vRockCalm;
  float fine = far * (1.0 - smoothstep(0.03, 0.1, px));
  float mid = far * (1.0 - smoothstep(0.07, 0.26, px));
  float broad = 1.0 - smoothstep(0.2, 0.7, px / ${BED.toFixed(2)});

  // THE BEDS: the height through the bedding, warped so a bed's edge
  // wanders, in beds.
  float warp = (rkNoise(p * 0.07) - 0.5) * 2.0 + (rkNoise(p * 0.31 + 9.0) - 0.5) * 0.4 * mid;
  float hb = dot(p, vRockDip) / ${BED.toFixed(2)} + warp * ${BED_WARP.toFixed(2)};
  float bed = floor(hb);
  float fb = hb - bed;
  float bedDraw = rkHash(vec3(bed, 3.7, 1.9));
  // Every third or so bed a soft one, weathered back and darker.
  float soft = step(0.68, bedDraw);
  // Coarse packages of beds: the bands that still read from far off.
  float pack = rkHash(vec3(floor(hb / 4.0 + 0.5 * warp), 8.1, 2.3));

  // THE JOINTS: two sets square to the beds, the first spaced by the bed,
  // shifted bed to bed so the blocks stagger.
  vec3 strike2 = cross(vRockDip, vRockStrike);
  float sp = ${JOINT.toFixed(2)} * (0.6 + 0.9 * bedDraw);
  float ju = dot(p, vRockStrike) / sp + bedDraw * 7.0 + warp * 0.05;
  float jcol = floor(ju);
  float fj = ju - jcol;
  float jv = dot(p, strike2) / ${JOINT_CROSS.toFixed(2)} + rkHash(vec3(bed, jcol, 5.0)) * 3.0 + warp * 0.06;
  float fv = fract(jv);
  // Not every joint runs through every bed.
  float runs = step(0.3, rkHash(vec3(bed, jcol, 2.0)));
  float runs2 = step(0.55, rkHash(vec3(bed, floor(jv), 4.0)));
  float block = rkHash(vec3(bed, jcol, floor(jv)));

  // Where the face lies along the bedding (a dip slope) it is one broad
  // slab, and its beds' edges wander into loops: the lines there go.
  float cuts = 1.0 - smoothstep(0.75, 0.97, abs(dot(N, vRockDip)));
  // Metres from each line.
  float dBed = min(fb, 1.0 - fb) * ${BED.toFixed(2)};
  float dJ = min(fj, 1.0 - fj) * sp;
  float dJ2 = min(fv, 1.0 - fv) * ${JOINT_CROSS.toFixed(2)};
  float parting = rkLine(dBed, 0.035 + 0.05 * soft, px) * fine * cuts;
  float crack = max(rkLine(dJ, 0.03, px) * runs, rkLine(dJ2, 0.025, px) * runs2) * fine;

  // THE BUMP, as the slope of a height (m) worked out ANALYTICALLY, never
  // off screen derivatives of a stepped field (those blink a 2×2 block at
  // every step): each bed's face leaning out from its parting toward its
  // top and rolled back over a bevel at the top, a soft bed rolled back
  // further, each block tilted its own way; and the fine grain, which is
  // small, off the derivatives. The gradient is turned into a normal tipped
  // off the smooth one (the surface gradient, Mikkelsen's method).
  float bevel = 0.2 + 0.25 * soft;
  float lean = 0.05 + 0.1 * (1.0 - smoothstep(0.0, 0.3, fb));
  float roll = -0.35 * smoothstep(1.0 - bevel, 1.0, fb) / bevel;
  vec3 gradH = vRockDip * ((lean + roll) / ${BED.toFixed(2)}) * mid;
  float tilt = (rkHash(vec3(bed, jcol, 9.0)) - 0.5) * 0.35;
  float tilt2 = (rkHash(vec3(bed, jcol, 6.0)) - 0.5) * 0.35;
  gradH += (vRockStrike * tilt + strike2 * tilt2) * fine;
  // A joint's arris rounded the same way, on both sides of its crack.
  float jEdge = (smoothstep(1.0 - 0.12, 1.0, fj) - smoothstep(0.12, 0.0, fj)) * runs;
  gradH -= vRockStrike * (jEdge * 0.25 / max(0.12 * sp, 0.05)) * 0.12 * fine;
  vec3 Nb = normalize(N - (gradH - N * dot(gradH, N)));
  {
    float grain = ((rkNoise(p * 2.7) - 0.5) * 0.02 + (rkNoise(p * 7.9) - 0.5) * 0.008) * fine;
    float hx = dFdx(grain);
    float hy = dFdy(grain);
    vec3 r1 = cross(dpy, Nb);
    vec3 r2 = cross(Nb, dpx);
    float det = dot(dpx, r1);
    Nb = normalize(abs(det) * Nb - sign(det) * (hx * r1 + hy * r2));
  }

  // THE COLOUR: the vertex's tone (the region's, its cavity and foot)
  // varied by the structure, never a facet's own shade.
  vec3 c = diffuseColor.rgb;
  float tone = 0.78
    + (bedDraw - 0.5) * 0.32 * broad * cuts
    + (pack - 0.5) * 0.24 * cuts
    + (block - 0.5) * 0.12 * fine
    - soft * 0.12 * broad
    + (rkNoise(p / 38.0) - 0.5) * 0.3;
  c *= tone;
  float steep = 1.0 - smoothstep(0.55, 0.85, N.y);
  // Wet streaks, dark, down the fall line under the ledges; iron, rusty.
  // Noise stretched up and down the world, so on any face, whichever way
  // it looks, a streak runs straight down it; a few metres wide, never a
  // line, and only where the stone is drawn at all.
  float wet = smoothstep(0.55, 0.85, rkNoise(vec3(p.x * 0.22, p.y * 0.025, p.z * 0.22))) * steep * (0.3 + 0.7 * mid);
  float rust = smoothstep(0.68, 0.9, rkNoise(vec3(p.x * 0.13 + 40.0, p.y * 0.03, p.z * 0.13))) * steep;
  c *= 1.0 - 0.3 * wet;
  c = mix(c, c * vec3(1.35, 1.0, 0.7), 0.4 * rust);
  // Lichen, grey-green or orange, on the old faces.
  float lichen = smoothstep(0.66, 0.8, rkNoise(p * 0.37 + 23.0)) * mid * (1.0 - wet);
  c = mix(c, c * mix(vec3(1.05, 1.2, 0.9), vec3(1.5, 1.05, 0.55), step(0.8, rkNoise(p * 0.11 + 5.0))), 0.6 * lichen);
  // The cracks and the partings dark: the sky does not get in.
  c *= 1.0 - 0.4 * crack - 0.2 * parting * (0.4 + 0.6 * soft);

  // THE SNOW: the facet's own (where the ridden rock is snow), a LINE
  // along the top of the beds where the face lies back enough to hold it
  // (the white bands a winter crag is drawn in, broken where the ledge
  // runs out), the cracks, the rime on the windward side, the new snow
  // dusted over it all, and the skin's edge where its ground stops being a
  // wall, so the rock goes into the snow. Far out, where a line is under a
  // pixel, the same snow as a share of the face.
  float lies = smoothstep(0.25, 0.6, N.y);
  float shelf = 0.08 + 0.1 * soft + 0.1 * lies;
  float runsOut = smoothstep(0.55, 0.78, rkNoise(vec3(dot(p, vRockStrike) * 0.09, bed * 1.7, 13.0)));
  float topOfBed = (1.0 - smoothstep(shelf, shelf + 0.08 + 2.0 * px / ${BED.toFixed(2)}, fb)) * cuts * runsOut;
  float ledge = smoothstep(0.55, 0.85, N.y) * 0.5 + topOfBed * lies * 0.95 + crack * lies * 0.7;
  float windward = clamp(-dot(N.xz, uRockWind), 0.0, 1.0);
  float rime = smoothstep(0.3, 0.8, windward) * smoothstep(0.45, 0.8, rkNoise(p * 0.6 + 2.0) * 0.6 + rkNoise(p * 0.15) * 0.6);
  float dust = clamp(uFresh * 8.0, 0.0, 0.6) * smoothstep(0.4, 0.75, rkNoise(p * 2.1 + 11.0) + 0.3 * lies) * (0.35 + 0.65 * lies);
  float edge = 1.0 - smoothstep(0.05, 0.22, vRockBare);
  float winter = 1.0 - uRockSummer;
  float cover = vRockSnow + (ledge + rime * 0.75 + dust + edge * 0.7) * winter;
  // A ragged, rounded edge: the cover pushed by noise, then squared off.
  cover += (rkNoise(p * 1.7 + 31.0) - 0.5) * 0.6 * mid;
  float near = smoothstep(0.42, 0.62, cover);
  float farCover = clamp(vRockSnow + (smoothstep(0.75, 0.95, N.y) * 0.3 + 0.04 * lies * cuts + dust * 0.4 + edge * 0.25) * winter, 0.0, 1.0);
  cover = mix(farCover, near, mid);
  vec3 coverCol = mix(vec3(0.86, 0.89, 0.94), vec3(0.15, 0.17, 0.1), uRockSummer);
  cover *= mix(1.0, 0.5, uRockSummer);
  diffuseColor.rgb = mix(c, coverCol, cover);
  // Under the snow the bump is gone and the cover rounds over toward the
  // ground's own lie, so the snow on the rock is lit as the snow round it.
  vec3 under = normalize(mix(N, normalize(vRockSoft), 0.6) + vec3(0.0, 0.4, 0.0));
  rkNormal = normalize(mix(Nb, under, cover * winter));
}
`;

/** At three's normal stage: the rock's perturbed normal, into view space. */
export const ROCK_FRAGMENT_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
normal = normalize((viewMatrix * vec4(rkNormal, 0.0)).xyz);
`;
