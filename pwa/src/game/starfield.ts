// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NIGHT SKY ITSELF — the stars, and the galaxy they are a near corner
// of. Nothing here owns a mesh: it is where the sphere of fixed stars has
// TURNED to on a map's night, where the Milky Way lies across it, and the
// GLSL the dome (`sky-dome.ts`) paints them with. The design is the sibling
// jet-ski game's, retyped for a winter basin: a clear night over the snow
// is the darkest, starriest sky this game has.
//
// Three ideas, and the whole module is them:
//
//   THE TURN     The stars are on a sphere that wheels once a day about a
//                pole standing due north at the map's own latitude (R15).
//                The hour spins it and the DAY OF THE YEAR offsets it, so a
//                January midnight and a March one look out at different
//                parts of the sky. The sun stands still over a run
//                (`clock.ts`), so the sphere does too.
//   THE GALAXY   A great circle tilted 63° to that pole, at the real
//                inclination, so the band rises steeply out of one horizon
//                instead of lying round the ridge like a ring — its core a
//                bulge, its arms mottled, and the Great Rift a dark lane of
//                dust down the brightest part.
//   THE WASH     Nothing here is seen against a black page. The air at the
//                horizon, the moon's own glare and the cloud in front take
//                the faint sky away — the first two here, the third the
//                dome's cloud drawn over it.
//
// Stars are SIZED IN PIXELS, not in radians: a star at an angular size is
// under a pixel on a phone and a blob on a desktop; sized off the ray's own
// derivative, every screen gets the same sky and the grid only decides how
// MANY there are.

import { SOUTH, type Level } from "@engine";

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** Where the sphere of fixed stars stands. */
export type SkyTurn = {
  /** The celestial pole's elevation, radians — the map's latitude. */
  pole: number;
  /** …and the heading it stands at: due north. */
  bearing: number;
  /** How far the sphere has turned about that pole, radians. */
  spin: number;
};

/** The turn a map's night is ridden under: its hour on its day at its
 * latitude. A whole turn a day, and a whole turn a year on top — so a
 * quarter of the year is a quarter of the sky. */
export function skyTurnOf(level: Pick<Level, "sun">): SkyTurn {
  const { hour, dayOfYear, latitude } = level.sun;
  return {
    pole: latitude * DEG,
    bearing: SOUTH + Math.PI,
    spin: -TAU * (hour / 24 + dayOfYear / 365),
  };
}

/** A turn for a sky with no map behind it (a unit test's, a card's). */
export const DEFAULT_TURN: SkyTurn = { pole: 60 * DEG, bearing: SOUTH + Math.PI, spin: 0 };

type V3 = { x: number; y: number; z: number };

const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (a: V3): V3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/** The turn as a change of basis, ROW-MAJOR in nine numbers: a WORLD
 * direction times it is the same direction in celestial coordinates —
 * what the dome carries as a uniform so each pixel's ray can be asked
 * where on the sphere it is looking. */
export function turnBasis(turn: SkyTurn, out: number[] = []): number[] {
  // Toward the pole: `sky.ts`'s `sunDirection`, restated so the colour
  // model and this file need not import each other.
  const cp = Math.cos(turn.pole);
  const pole = {
    x: Math.sin(turn.bearing) * cp,
    y: Math.sin(turn.pole),
    z: Math.cos(turn.bearing) * cp,
  };
  const seed = Math.abs(pole.y) > 0.9 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const a = norm(cross(seed, pole));
  const b = cross(pole, a);
  const c = Math.cos(turn.spin);
  const s = Math.sin(turn.spin);
  const e1 = { x: a.x * c + b.x * s, y: a.y * c + b.y * s, z: a.z * c + b.z * s };
  const e2 = { x: b.x * c - a.x * s, y: b.y * c - a.y * s, z: b.z * c - a.z * s };
  out.length = 0;
  out.push(e1.x, e1.y, e1.z, e2.x, e2.y, e2.z, pole.x, pole.y, pole.z);
  return out;
}

/** THE GALACTIC FRAME in celestial coordinates, at the real angles: the
 * north galactic pole 63° off the celestial one, the centre in the band 90°
 * from it, the third axis closing the set. */
const GAL_POLE = [-0.86767, -0.19807, 0.45598] as const;
const GAL_CENTRE = [-0.054878, -0.873439, -0.483831] as const;
const GAL_SIDE = [0.494103, -0.444829, 0.746987] as const;

const vec3 = (v: readonly number[]): string => `vec3(${v.map((n) => n.toFixed(6)).join(", ")})`;

/** The band's colours, linear: the cold blue-white of the arms' unresolved
 * stars, and the core reddened by the dust it is seen through. */
const GALAXY_ARM = [0.27, 0.37, 0.69] as const;
const GALAXY_CORE = [0.69, 0.46, 0.24] as const;

/** How much band there is at all — the one number to move when the Milky
 * Way is too much or not enough (`make sky`'s night columns). */
const BAND_GAIN = 0.6;

/** The band's field WRAPS round the galaxy's longitude, a whole number of
 * noise cells to the turn, or the arc tangent's cut rules a line down the
 * sky; across the band nothing comes back, so that pitch is free. */
const CLUMP_CELLS = 28;
const DUST_CELLS = 16;
const CLUMP_ACROSS = 12.35;
const DUST_ACROSS = 6.83;

/** THE NIGHT SKY AS GLSL. One function is left behind, `nightSky(sky, up,
 * glare, stars, galaxy, time)`: the ray in celestial coordinates, its world
 * elevation, how deep in the moon's glare it is (0..1), the two strengths
 * and the twinkle's clock; it returns the light to add. Its caller guards
 * it on the strengths, so by day none of it runs. */
export const STARFIELD_GLSL = /* glsl */ `
const vec3 GAL_POLE = ${vec3(GAL_POLE)};
const vec3 GAL_CENTRE = ${vec3(GAL_CENTRE)};
const vec3 GAL_SIDE = ${vec3(GAL_SIDE)};

// A star's own hash, three in and one out — a flattened vec2 hash repeats
// whole bands of the sky along the circles its collisions lie on.
float sfHash3(vec3 p, float salt) {
  vec3 p3 = fract((p + salt) * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float sfHash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Value noise that wraps in x at a whole number of cells.
float galNoise(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, period);
  float x1 = mod(i.x + 1.0, period);
  float a = sfHash2(vec2(x0, i.y));
  float b = sfHash2(vec2(x1, i.y));
  float c = sfHash2(vec2(x0, i.y + 1.0));
  float d = sfHash2(vec2(x1, i.y + 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float galField(vec2 p, float period) {
  float v = 0.0;
  float a = 0.5;
  float total = 0.0;
  for (int i = 0; i < 3; i++) {
    v += a * galNoise(p, period);
    total += a;
    a *= 0.5;
    p = p * 2.0 + vec2(0.0, 19.3);
    period *= 2.0;
  }
  return v / total;
}

// A star's colour from its spectral roll: blue-white through white to
// amber, skewed warm, which is the faint sky's own census.
vec3 starTone(float t) {
  vec3 hot = vec3(0.70, 0.80, 1.00);
  vec3 mid = vec3(1.00, 0.98, 0.94);
  vec3 warm = vec3(1.00, 0.78, 0.58);
  return t < 0.5 ? mix(hot, mid, t * 2.0) : mix(mid, warm, (t - 0.5) * 2.0);
}

// ONE SHELL OF STARS: the sphere cut into cells, one star to a cell that
// rolls high enough, jittered off its middle, a pixel and a bit across for
// the faintest and two and a half for the brightest.
vec3 starShell(vec3 sky, float cells, float thresh, float pixel, float time, float scint) {
  vec3 sd = sky * cells;
  vec3 cell = floor(sd);
  float h = sfHash3(cell, 0.0);
  if (h < thresh) return vec3(0.0);
  float rank = (h - thresh) / max(1.0 - thresh, 1e-4);
  float g = sfHash3(cell, 37.0);
  vec3 jitter = vec3(fract(g * 13.0), fract(g * 71.0), fract(g * 191.0));
  float mag = pow(rank, 2.1);
  float d = length(fract(sd) - mix(vec3(0.28), vec3(0.72), jitter));
  float radius = min(pixel * cells * (1.15 + 1.35 * mag), 0.42);
  float disc = smoothstep(radius, 0.0, d);
  if (disc <= 0.0) return vec3(0.0);
  // SCINTILLATION: the air, not the star — its own rate each, stronger
  // toward the horizon.
  float rate = 2.0 + fract(h * 53.0) * 6.0;
  float twinkle = 1.0 + scint * sin(time * rate + g * 40.0);
  return starTone(pow(fract(g * 29.0), 0.7)) * disc * (0.55 + 1.15 * mag) * twinkle;
}

// THE BAND: how much galaxy is behind this ray, and its colour.
vec3 milkyWay(vec3 sky) {
  float lat = dot(sky, GAL_POLE);
  float along = dot(sky, GAL_CENTRE);
  float across = dot(sky, GAL_SIDE);
  float lon = atan(across, along);
  float band = 0.72 * exp(-lat * lat * 22.0) + 0.28 * exp(-lat * lat * 5.5);
  band -= 0.004;
  if (band <= 0.0) return vec3(0.0);
  float bulge = pow(max(along, 0.0), 4.0);
  band *= 0.42 + 0.58 * pow(max(along * 0.5 + 0.5, 0.0), 1.6) + 0.55 * bulge;
  vec2 cu = vec2(lon * ${(CLUMP_CELLS / TAU).toFixed(6)}, lat * ${CLUMP_ACROSS.toFixed(2)});
  vec2 du = vec2(lon * ${(DUST_CELLS / TAU).toFixed(6)}, lat * ${DUST_ACROSS.toFixed(2)});
  float clumps = galField(cu + vec2(0.0, 1.3), ${CLUMP_CELLS.toFixed(1)});
  float dust = galField(du + vec2(0.0, 7.0), ${DUST_CELLS.toFixed(1)});
  band *= 0.42 + 1.05 * clumps;
  // THE GREAT RIFT down the brightest part of the band.
  float off = lat - 0.02 * (1.0 + 2.0 * dust);
  float lane = exp(-off * off * 676.0);
  band *= 1.0 - 0.62 * lane * smoothstep(0.0, 0.55, bulge + 0.25);
  vec3 tone = mix(${vec3(GALAXY_ARM)}, ${vec3(GALAXY_CORE)}, clamp(bulge * 0.9 + 0.1 * clumps, 0.0, 1.0));
  return tone * band * ${BAND_GAIN.toFixed(2)};
}

vec3 nightSky(vec3 sky, vec3 ray, float up, float glare, float stars, float galaxy, float time) {
  // How big a pixel is, rad — off the ray, so every screen gets one sky.
  float pixel = max(length(fwidth(ray)), 1e-5);
  // The air at the ridge takes most of a star and all of the band.
  float air = smoothstep(-0.005, 0.10, up);
  air *= 0.42 + 0.58 * smoothstep(0.03, 0.42, up);
  if (air <= 0.0) return vec3(0.0);
  // The moon's own sky glow: the faint sky does not survive it.
  float wash = 1.0 - 0.85 * glare;
  float scint = 0.14 + 0.55 * pow(1.0 - min(up, 1.0), 7.0);
  vec3 col = vec3(0.0);
  if (galaxy > 0.0) col += milkyWay(sky) * galaxy * air * wash * wash;
  if (stars > 0.0) {
    // Two shells: a naked eye's few hundred bright stars, and the
    // thousands of faint ones the band thickens.
    float lat = dot(sky, GAL_POLE);
    float crowd = exp(-lat * lat * 9.0);
    col += starShell(sky, 70.0, 0.9925, pixel, time, scint) * stars * air;
    col += starShell(sky, 150.0, 0.9790 - 0.0120 * crowd, pixel, time, scint)
         * stars * air * wash * (0.50 + 0.30 * crowd);
  }
  return col;
}
`;
