// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT MAKES SNOW LOOK LIKE SNOW — the terrain's shader, as the source
// grafted into a `MeshStandardMaterial` (`terrain.ts` does the grafting).
// The built-in material keeps what it is good at — the sun and its shadow
// map, the hemisphere light, a GGX sheen that brightens at a grazing angle
// the way a snowfield does looking toward the sun — and this adds what
// separates snow from white paint:
//
//   * THE GROUND IS READ PER PIXEL. The mesh (`terrain.ts`) is a camera-
//     centred clipmap, a quarter-metre a vertex at the lens and sixteen at
//     the ridge, but its SHADING never sees that: the slope comes from the
//     ground's own gradient texture, the furrows from the trail map's own
//     finite differences, and fine noise on top. A mesh that coarse lit by
//     its own normals would put the clipmap's rings on every hillside.
//   * WRAP LIGHTING — light goes INTO snow and comes back out somewhere
//     else, so the terminator is soft and tinted blue (`SSS`).
//   * THE GLITTER — a crystal is a tiny mirror at a random angle, so the
//     world is hashed into cells, each given a random facet, and a facet
//     that lines the sun up with the eye flares. World-space, so the glints
//     sit still on the snow and twinkle as the LENS moves; faded out with
//     distance before a cell is smaller than a pixel.
//   * THE GROOMED TRACK is packed snow: a touch greyer, a touch shinier, no
//     glitter to speak of (the loose crystals are crushed), and the comb's
//     CORDUROY running along it.
//   * THE BERMS are the plough's windrows along each edge (R18): snow that
//     was thrown, not combed — no corduroy, clods a hand across in the
//     normal, and the white of snow turned over rather than the grey of
//     snow worked. The ridge itself is the engine's ground; what this adds
//     is only what kind of snow is on it, so the edge of the track reads as
//     a white line with a shadowed side even from the chase camera.
//   * THE REGION'S OWN SNOW (R21, `region-look.ts`) — the wind crust and a
//     frozen river's ice, read per pixel off a SURFACE map of the engine's
//     own fields: the crust a touch greyer and glossier, carved into
//     SASTRUGI along the wind where the country is scoured; the ice a flat
//     blue mirror with no crystals on it; and, where the region says so,
//     rock showing through on every face too steep to hold snow. The
//     alpine lays none of it and paints nothing of it.
//   * THE NEW SNOW (`uFresh`, `GameState.fresh`) a fall lays over a run
//     buries the groomed track's look — its corduroy, its grey, its gloss —
//     under a few centimetres, and the trail map fills its furrows as it
//     lands (`trail-map.ts`'s `fill`).
//   * THE TRAIL — the depth the trail map holds lowers the snow in the
//     vertex shader (as far as the mesh can show it) and bends the normal
//     per pixel (all of it). Pressed snow is barely darker than fresh;
//     what makes a furrow read is its SHAPE — walls turned from the sun,
//     a floor that sees less sky — so the tint is small and the light does
//     the rest.
//
// SNOW IS BRIGHTER THAN ITS PAINT (`GLARE`): it returns nine tenths of
// what lands on it, and a white albedo under a low winter sun still arrives
// grey. So the tone is pushed past white and the tone mapper takes the lit
// side down to a bright, unclipped white.

import { LAMP_SLOTS } from "./haze.ts";
import { TRAIL_GLSL } from "./trail-map.ts";
import { FRESH_LOOK, LOOSE } from "./trail-stamp.ts";

/** How much brighter than white snow's albedo is painted. */
export const GLARE = 1.12;

// New snow that buries the groomed track's LOOK outright, m: stated
// three-free in `trail-stamp.ts`, where the trail map's fill reads it too.
export { FRESH_LOOK };

// How far loose powder stands over the groomed track: stated three-free in
// `trail-stamp.ts`, so what stands ON the snow (the wildlife's feet) reads
// the same surface this shader lifts.
export { LOOSE };

/** The vertex half's declarations: the height field, the clipmap level, the
 * rim of mountains past the map. */
export const SNOW_VERTEX_PARS = /* glsl */ `
uniform sampler2D uHeight;
uniform vec2 uHeightOrigin;
uniform vec2 uHeightCount;
uniform float uCell;
uniform vec2 uLevelCentre;
uniform float uSpacing;
uniform float uGridHalf;
uniform float uBaseSpacing;
uniform sampler2D uGround;
varying vec3 vSnowWorld;
varying vec3 vSnowNormal;
${TRAIL_GLSL}

float snowHash1(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float snowNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(snowHash1(i), snowHash1(i + vec2(1, 0)), u.x),
             mix(snowHash1(i + vec2(0, 1)), snowHash1(i + vec2(1, 1)), u.x), u.y);
}

// THE MOUNTAINS PAST THE MAP. The generator's world ends at its edge, but
// the eye does not: a rim that stopped dead would stand the whole basin on
// a table. So past the edge the ground keeps climbing on noise of its own,
// steeper the further out, into peaks the haze takes.
float rimRise(vec2 p, vec2 q) {
  float beyond = length(p - q);
  if (beyond <= 0.0) return 0.0;
  float big = snowNoise(p * 0.0021) * 0.65 + snowNoise(p * 0.0057) * 0.35;
  float ridge = 1.0 - abs(snowNoise(p * 0.009) * 2.0 - 1.0);
  // Climbs steeply off the edge and saturates: a range of peaks a couple
  // of hundred metres over the ridge, not a wall to the sky.
  float climb = 240.0 * (1.0 - exp(-beyond / 380.0)) * (0.45 + 0.9 * big);
  return climb + ridge * ridge * 45.0 * smoothstep(0.0, 250.0, beyond);
}

float heightTexel(ivec2 c) {
  ivec2 top = ivec2(uHeightCount) - 1;
  return texelFetch(uHeight, clamp(c, ivec2(0), top), 0).r;
}

float groundHeight(vec2 p) {
  vec2 lo = uHeightOrigin;
  vec2 hi = uHeightOrigin + (uHeightCount - 1.0) * uCell;
  vec2 q = clamp(p, lo, hi);
  vec2 f = (q - lo) / uCell;
  vec2 i = floor(f);
  vec2 t = f - i;
  ivec2 c = ivec2(i);
  float a = heightTexel(c);
  float b = heightTexel(c + ivec2(1, 0));
  float d = heightTexel(c + ivec2(0, 1));
  float e = heightTexel(c + ivec2(1, 1));
  return mix(mix(a, b, t.x), mix(d, e, t.x), t.y) + rimRise(p, q);
}
`;

/** Replaces `beginnormal_vertex`: place the vertex on the clipmap, morph it
 * toward the next level near this level's rim (so two levels meet with no
 * crack), and lift it onto the snow. */
export const SNOW_VERTEX_PLACE = /* glsl */ `
vec2 snowGrid = position.xz;
vec2 snowLocal = (snowGrid - uGridHalf) * uSpacing;
float snowEdge = max(abs(snowLocal.x), abs(snowLocal.y)) / (uGridHalf * uSpacing);
float snowMorph = clamp((snowEdge - 0.72) / 0.2, 0.0, 1.0);
vec2 snowXZ = uLevelCentre + snowLocal - mod(snowGrid, 2.0) * uSpacing * snowMorph;
// The furrow, low-passed to what the mesh can carry here. Close in, a tent
// filter over the fine map a vertex's spacing wide — enough for the skis's
// band to sink the mesh without the ski lines aliasing into a sawtooth;
// further out, the coarse map alone, which is already that blur. The
// per-pixel normal (fragment half) draws everything this leaves out. The
// filter's width is a function of the DISTANCE, not of the level, so two
// levels meeting at a vertex compute the same height there.
float snowR = max(uBaseSpacing, distance(snowXZ, cameraPosition.xz) / uGridHalf);
float snowRelief;
{
  vec2 t = textureLod(uTrailCoarse, snowXZ / uMapSize, 0.0).rg * uTrailScale;
  float coarseRelief = -t.x + t.y * (1.0 - clamp(t.x / 0.03, 0.0, 1.0));
  float nearW = 1.0 - smoothstep(0.35, 0.7, snowR);
  float fineRelief = 0.0;
  if (nearW > 0.0) {
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        float w = (i == 0 ? 0.5 : 0.25) * (j == 0 ? 0.5 : 0.25);
        fineRelief += w * trailRelief(snowXZ + vec2(float(i), float(j)) * snowR);
      }
    }
  }
  snowRelief = mix(coarseRelief, fineRelief, nearW);
}
// THE LOOSE COVER: powder stands a hand higher than the groomed track, so
// the track's shoulders are a real edge the light picks out. (The engine's
// ground is the track's graded surface; the skier drawn in powder is lowered
// by as much in renderer.ts.)
float snowPackedV = textureLod(uGround, (snowXZ - uHeightOrigin + 0.5 * uCell) / (uHeightCount * uCell), 0.0).b;
float snowY = groundHeight(snowXZ) + snowRelief + ${LOOSE.toFixed(3)} * (1.0 - snowPackedV);
float snowE = max(uSpacing, uCell);
vec3 objectNormal = normalize(vec3(
  groundHeight(snowXZ - vec2(snowE, 0.0)) - groundHeight(snowXZ + vec2(snowE, 0.0)),
  2.0 * snowE,
  groundHeight(snowXZ - vec2(0.0, snowE)) - groundHeight(snowXZ + vec2(0.0, snowE))));
`;

/** Replaces `begin_vertex`. */
export const SNOW_VERTEX_BEGIN = /* glsl */ `
vec3 transformed = vec3(snowXZ.x, snowY, snowXZ.y);
vSnowWorld = transformed;
vSnowNormal = objectNormal;
`;

/** The fragment half's declarations. */
export const SNOW_FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uGround;
uniform sampler2D uTrackDir;
uniform vec2 uHeightOrigin;
uniform vec2 uHeightCount;
uniform float uCell;
uniform vec4 uHole;
uniform float uFlat;
uniform float uFresh;
uniform vec4 uPiste;
uniform float uGlitter;
uniform sampler2D uSurface;
uniform vec3 uForestTint;
uniform vec3 uCrustTone;
uniform vec3 uIceTone;
uniform vec4 uRock;
uniform vec2 uRockSlope;
uniform float uSastrugi;
uniform vec2 uWindDir;
varying vec3 vSnowWorld;
varying vec3 vSnowNormal;
${TRAIL_GLSL}

vec3 snowHash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float snowHash1(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float snowNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(snowHash1(i), snowHash1(i + vec2(1, 0)), u.x),
             mix(snowHash1(i + vec2(0, 1)), snowHash1(i + vec2(1, 1)), u.x), u.y);
}
// The gradient of value noise, by finite difference — cheap enough for the
// three octaves the micro-relief uses.
vec2 snowNoiseGrad(vec2 p, float e) {
  return vec2(snowNoise(p + vec2(e, 0.0)) - snowNoise(p - vec2(e, 0.0)),
              snowNoise(p + vec2(0.0, e)) - snowNoise(p - vec2(0.0, e))) / (2.0 * e);
}

// ONE LAYER OF CRYSTALS: a cell of world space holds at most one, at a
// random place in it with a random facet; it flares when that facet lines
// the sun up with the eye. Drawn as a POINT — a disc at least a pixel
// across, its brightness scaled down as it is widened — rather than as the
// whole cell, which reads as confetti.
float snowGlints(vec3 wp, float scale, float sharp, float keep, vec3 N, vec3 H, float seed) {
  vec3 q = wp * scale;
  vec3 cell = floor(q);
  vec3 r = snowHash3(cell + seed);
  if (r.z > keep) return 0.0;
  vec3 facet = normalize(N + (snowHash3(cell + seed + 7.13) * 2.0 - 1.0) * 0.6);
  float g = pow(max(dot(facet, H), 0.0), sharp);
  vec3 f = fract(q) - (0.2 + 0.6 * r);
  float rad = max(0.14, length(fwidth(q)) * 0.75);
  float spot = 1.0 - smoothstep(rad * 0.45, rad, length(f));
  float k = 0.14 / rad;
  return g * spot * k * k;
}

// Per-fragment state the later grafts read.
vec3 snowN;          // world normal
float snowDist;      // metres from the lens
float snowPacked;    // 0 powder .. 1 groomed
float snowPress;     // 0 untouched .. 1 a full furrow
float snowWall;      // how steep the furrow's wall is here
float snowForest;    // how wooded the ground round here is
float snowBerm;      // 0 off the plough's berm .. 1 on its crest
float snowCrust;     // 0 powder .. 1 a wind slab (R21)
float snowIce;       // 0 snow .. 1 a frozen river's bare ice (R21)
float snowRock;      // 0 snow .. 1 rock showing through a steep face
float snowGroomed;   // 0 .. 1 a piste machine's fresh swath (trailGroomAt)
float snowWorked;    // 0 .. 1 the day's skied-up piste (the hour's, or a night they groom)
float snowSoft;      // 0 .. 1 the groomer gone to slush under a spring sun
float snowHard;      // 0 .. 1 ...and frozen hard and glassy since
float snowChop;      // 0 .. 1 new snow on a piste in use, skied into heaps
float snowCombed;    // 0 .. 1 the night's corduroy still whole (the day's morning)
float snowLane;      // -1 .. 1 the night's passes: this one's shade, by its strength
float snowCord;      // -1 .. 1 the comb's ridge (+) or furrow (−) here, by its strength
`;

/** Straight after `clipping_planes_fragment`: throw away what the finer
 * level already covers, and work out everything about this bit of snow. */
export const SNOW_FRAGMENT_SAMPLE = /* glsl */ `
{
  vec2 p = vSnowWorld.xz;
  if (uHole.w > 0.5) {
    vec2 dh = abs(p - uHole.xy);
    if (max(dh.x, dh.y) < uHole.z) discard;
  }
  vec3 eye = vSnowWorld - cameraPosition;
  snowDist = length(eye);
  vec2 guv = (p - uHeightOrigin + 0.5 * uCell) / (uHeightCount * uCell);
  vec4 g = texture2D(uGround, guv);
  // New snow over the groomer (\`uFresh\`) buries its look — the comb's
  // corduroy first, the grey of worked snow by a few centimetres — while
  // the physics still feels the hard base under it (\`packedUnder\`).
  snowPacked = g.b * (1.0 - smoothstep(0.0, ${FRESH_LOOK.toFixed(3)}, uFresh));
  // A PISTE MACHINE'S SWATH (\`groomer.ts\`): packed through wherever the
  // tiller went, on the piste or off it, and only the snow since on it. On
  // a night the machines work, the rest of the piste is the day's: skied
  // up, scraped and heaped, the comb long gone (\`snowWorked\`).
  vec2 groom = uWorked > 0.0 ? trailGroomAt(p) : vec2(0.0);
  // Ramped over half the mark, so the filtered edge of a swath is a soft
  // line rather than the trail map's texel stairs.
  snowGroomed = smoothstep(0.0, 0.45, groom.x);
  if (snowGroomed > 0.0) {
    float since = (1.0 - groom.x) * ${FRESH_LOOK.toFixed(3)};
    snowPacked = mix(snowPacked, 1.0 - smoothstep(0.0, ${FRESH_LOOK.toFixed(3)}, since), snowGroomed);
  }
  // THE PISTE THROUGH THE DAY (\`uPiste\`, \`piste-day.ts\`): skied up
  // since the first chair, softened by the sun and frozen again — all of it
  // on the groomer the machines have not been over since.
  float notSwath = (1.0 - snowGroomed) * snowPacked;
  snowCord = 0.0;
  snowLane = 0.0;
  snowWorked = max(uWorked, uPiste.x) * notSwath;
  snowSoft = uPiste.y * notSwath;
  snowHard = uPiste.z * notSwath;
  // Before the first chair the night's corduroy is as whole as a swath.
  float untouched = 1.0 - uPiste.x;
  snowCombed = uPiste.w * untouched * untouched * notSwath;
  // The new snow a busy piste has taken: not a smooth blanket but skied
  // into heaps and troughs as it lands.
  snowChop = uPiste.x * g.b * smoothstep(0.0, ${FRESH_LOOK.toFixed(3)}, uFresh) * (1.0 - snowGroomed);
  snowForest = g.a;
  vec2 grad = g.rg;
  vec2 surf = texture2D(uSurface, guv).rg;
  snowCrust = surf.r;
  snowIce = surf.g;
  // The loose cover's step at the track's shoulders.
  {
    vec2 du = vec2(0.5 / uHeightCount.x, 0.0);
    vec2 dv = vec2(0.0, 0.5 / uHeightCount.y);
    vec2 pg = vec2(texture2D(uGround, guv + du).b - texture2D(uGround, guv - du).b,
                   texture2D(uGround, guv + dv).b - texture2D(uGround, guv - dv).b) / uCell;
    grad -= ${LOOSE.toFixed(3)} * pg;
  }
  // Past the map the ground's texture is clamped; the ridge's slope is
  // steep and the lighting the vertex normal gives it is enough.
  vec2 inside = clamp(p, uHeightOrigin, uHeightOrigin + (uHeightCount - 1.0) * uCell);
  float past = length(p - inside);
  if (past > 0.0) {
    vec3 vn = normalize(vSnowNormal);
    grad = mix(grad, -vn.xz / max(vn.y, 0.2), smoothstep(0.0, 30.0, past));
  }
  snowRock = uRock.w * smoothstep(uRockSlope.x, uRockSlope.y, length(grad)) * (1.0 - snowPacked);

  // THE FURROWS, per pixel.
  vec2 tr = trailAt(p);
  snowPress = clamp(tr.x / 0.14, 0.0, 1.0);
  snowWall = 0.0;
  if (snowDist < 220.0) {
    float fineW = trailFineWeight(p);
    float e = mix(uCoarseTexel, uFineTexel * 1.25, fineW);
    vec2 tg = vec2(trailRelief(p + vec2(e, 0.0)) - trailRelief(p - vec2(e, 0.0)),
                   trailRelief(p + vec2(0.0, e)) - trailRelief(p - vec2(0.0, e))) / (2.0 * e);
    tg *= 1.0 - smoothstep(120.0, 220.0, snowDist);
    snowWall = clamp(length(tg), 0.0, 1.0);
    grad += tg;
  }

  // THE MICRO-RELIEF: wind-packed swells a few metres long, and a finer
  // grain, both faded out before they alias.
  float nearFade = 1.0 - smoothstep(20.0, 90.0, snowDist);
  float midFade = 1.0 - smoothstep(60.0, 400.0, snowDist);
  // Every term below is skipped outright where its weight is nought — the
  // far band, the groomer, off the berm — rather than computed and zeroed:
  // the answer is the same and most of the screen is far snow.
  if (midFade > 0.0 && snowPacked < 1.0) {
    grad += snowNoiseGrad(p * 0.23, 0.35) * 0.23 * 0.35 * midFade * (1.0 - snowPacked);
  }
  // THE DAY'S PISTE (\`snowWorked\`): scraped swells where the turns have
  // shoved the snow, heaps of it pushed up between, and the scratches of a
  // thousand edges along the way.
  if (snowWorked > 0.01 && midFade > 0.0) {
    vec4 tw = texture2D(uTrackDir, guv);
    vec2 dw = tw.xy * 2.0 - 1.0;
    float tht = 0.5 * atan(dw.y, dw.x);
    vec2 acr = vec2(cos(tht), -sin(tht));
    vec2 alg = vec2(acr.y, -acr.x);
    float k = snowWorked * midFade;
    // Slush heaps the higher; frozen, they keep the shape they had.
    grad += snowNoiseGrad(p * 0.55 + 3.1, 0.3) * 0.55 * 0.16 * k * (1.0 + 0.8 * snowSoft);
    grad += snowNoiseGrad(p * 1.4 + 8.3, 0.25) * 1.4 * 0.05 * k * nearFade;
    vec2 q = vec2(dot(p, acr) * 5.0, dot(p, alg) * 0.22);
    vec2 sg = snowNoiseGrad(q, 0.3);
    grad += (acr * sg.x * 5.0 + alg * sg.y * 0.22) * 0.006 * k * nearFade;
    // ...and, by the afternoon, the start of bumps: the turns' heaps a few
    // metres apart, longer across the piste than down it.
    vec2 bq = vec2(dot(p, acr) * 0.2, dot(p, alg) * 0.32) + 17.0;
    vec2 bg = snowNoiseGrad(bq, 0.3);
    grad += (acr * bg.x * 0.2 + alg * bg.y * 0.32) * 0.55 * k * k;
    // The tracks themselves: a thousand skiers' grooves along the way.
    vec2 tq = vec2(dot(p, acr) * 2.4, dot(p, alg) * 0.06);
    vec2 tg2 = snowNoiseGrad(tq, 0.2);
    grad += (acr * tg2.x * 2.4 + alg * tg2.y * 0.06) * 0.02 * k * nearFade;
  }
  // THE SKIED-IN NEW SNOW: soft heaps a few metres apart where the turns
  // have shoved it, the troughs between scraped through.
  if (snowChop > 0.01 && midFade > 0.0) {
    float k = snowChop * midFade;
    grad += snowNoiseGrad(p * 0.38 + 13.7, 0.3) * 0.38 * 0.32 * k;
    grad += snowNoiseGrad(p * 1.1 + 2.9, 0.25) * 1.1 * 0.07 * k * nearFade;
  }
  // SASTRUGI: the crust carved into ridges across the wind, a few metres
  // apart and a hand high, broken up along their length.
  if (uSastrugi > 0.0 && snowCrust > 0.01) {
    float sFade = 1.0 - smoothstep(40.0, 260.0, snowDist);
    vec2 across = vec2(-uWindDir.y, uWindDir.x);
    float warp = snowNoise(p * 0.08) * 6.0;
    float ph = dot(p, across) * 1.9 + warp;
    float breakUp = smoothstep(0.3, 0.7, snowNoise(p * vec2(0.35, 0.35) + 7.0));
    float k = uSastrugi * snowCrust * sFade * breakUp * (1.0 - snowPress);
    grad += across * cos(ph) * 1.9 * 0.07 * k;
  }
  if (nearFade > 0.0) {
    grad += snowNoiseGrad(p * 1.7, 0.3) * 1.7 * 0.035 * nearFade;
    grad += snowNoiseGrad(p * 7.0, 0.3) * 7.0 * 0.007 * nearFade * (1.0 - snowPress);
  }

  // THE CORDUROY: the groomer's comb, running along the track — and WORN
  // along it, in patches a few metres long where skis have scraped it
  // flat and chips a hand across where it has crumbled. A comb running
  // unbroken along the way looks the same however fast it is skied; its
  // wear is what streams past.
  vec4 td = texture2D(uTrackDir, guv);
  snowBerm = td.b * (1.0 - snowGroomed);
  float along = max(length(td.xy * 2.0 - 1.0), snowGroomed);
  if (snowPacked > 0.05 && along > 0.05 && snowWorked < 0.98) {
    vec2 dd = td.xy * 2.0 - 1.0;
    float th = 0.5 * atan(dd.y, dd.x);
    // In a swath the comb runs the way the machine went.
    th = mix(th, groom.y * 3.14159265, step(0.5, snowGroomed));
    vec2 across = vec2(cos(th), -sin(th));
    float phase = dot(p, across) * 6.2831853 / 0.14;
    float aa = 1.0 - smoothstep(0.35, 0.9, fwidth(phase));
    float k = snowPacked * min(along * 2.0, 1.0) * aa * (1.0 - snowPress * 0.7);

    k *= 1.0 - smoothstep(0.0, 0.25, snowBerm);
    float worn = smoothstep(0.3, 0.7, snowNoise(p * 0.42 + 11.0));
    float chip = snowNoise(p * 2.6 + 5.0);
    // Fresh off the comb it is whole — no wear, no chips — and a touch
    // deeper; the day's piste has none left.
    k *= mix(mix(0.3, 1.0, worn) * mix(0.55, 1.0, chip), 1.25, max(snowGroomed, snowCombed));
    k *= 1.0 - snowWorked;
    // The night's comb, untouched, stands the sharper.
    k *= 1.0 + 0.6 * snowCombed;
    grad += across * cos(phase) * 0.14 * k;
    snowCord = sin(phase) * min(k, 1.0);
    // THE NIGHT'S PASSES, seen from further than the comb: the machine's
    // lanes a swath wide side by side, each a shade of its own, a low
    // ridge where the finisher's flaps left the seam between two.
    float kl = snowPacked * min(along * 2.0, 1.0) * (1.0 - snowWorked) * (1.0 - snowPress * 0.7);
    kl *= 1.0 - smoothstep(0.0, 0.25, snowBerm);
    kl *= mix(0.35, 1.0, max(snowCombed, snowGroomed)) * midFade;
    if (kl > 0.01) {
      float lane = dot(p, across) / 5.2;
      float seam = 1.0 - smoothstep(0.0, 0.035, abs(fract(lane) - 0.5));
      float laa = 1.0 - smoothstep(0.3, 0.8, fwidth(lane) * 12.0);
      grad += across * sign(fract(lane) - 0.5) * seam * 0.08 * kl * laa;
      snowLane = ((snowHash1(vec2(floor(lane), 7.0)) * 2.0 - 1.0) * 0.6 - seam * laa) * kl;
    }
  }

  // THE PLOUGH'S CLODS on the berm: lumps a hand to a forearm across,
  // faded out before they alias.
  if (snowBerm > 0.01 && snowDist < 140.0) {
    float clodFade = 1.0 - smoothstep(30.0, 140.0, snowDist);
    float b = smoothstep(0.0, 0.3, snowBerm);
    grad += snowNoiseGrad(p * 2.2, 0.15) * 2.2 * 0.09 * b * clodFade;
    grad += snowNoiseGrad(p * 6.5, 0.1) * 6.5 * 0.025 * b * clodFade;
  }

  // Ice is flat: the swells and the grain are the snow's, not the ice's.
  grad = mix(grad, g.rg, snowIce * 0.85);
  snowN = normalize(vec3(-grad.x, 1.0, -grad.y));
}
`;

/** After `color_fragment`: the albedo. */
export const SNOW_FRAGMENT_COLOUR = /* glsl */ `
{
  vec2 p = vSnowWorld.xz;
  vec3 fresh = vec3(0.95, 0.975, 1.0);
  vec3 shade = vec3(0.84, 0.9, 0.98);
  float drift = snowNoise(p * 0.018) * 0.6 + snowNoise(p * 0.07) * 0.4;
  vec3 alb = mix(fresh, shade, drift * 0.32);
  // Groomed: greyer and a touch warmer — worked snow on its way to ice.
  alb = mix(alb, vec3(0.7, 0.75, 0.82), snowPacked * 0.9);
  // Fresh off the tiller: milled snow, a brighter, even sugar-white.
  alb = mix(alb, vec3(0.86, 0.9, 0.95), max(snowGroomed * 0.65, snowCombed * 0.5));
  // The comb's furrows hold a little shade, its ridges catch the light.
  alb *= 1.0 + 0.07 * snowCord + 0.07 * snowLane;
  // The day's piste: polished grey-blue where it is scraped, white where
  // the loose snow is heaped.
  if (snowWorked > 0.01) {
    float scrape = smoothstep(0.45, 0.75, snowNoise(p * 0.5 + 21.0));
    float heap = smoothstep(0.55, 0.85, snowNoise(p * 1.1 + 4.0));
    alb = mix(alb, vec3(0.62, 0.68, 0.78), scrape * 0.45 * snowWorked);
    alb = mix(alb, vec3(0.93, 0.96, 1.0), heap * 0.5 * snowWorked);
    // The tracks' streaks along the way: pressed snow a shade darker.
    vec2 tuv = (p - uHeightOrigin + 0.5 * uCell) / (uHeightCount * uCell);
    vec4 tw = texture2D(uTrackDir, tuv);
    vec2 dw = tw.xy * 2.0 - 1.0;
    float tht = 0.5 * atan(dw.y, dw.x);
    vec2 acr = vec2(cos(tht), -sin(tht));
    vec2 alg = vec2(acr.y, -acr.x);
    float streak = snowNoise(vec2(dot(p, acr) * 2.4, dot(p, alg) * 0.06));
    float aaS = 1.0 - smoothstep(0.3, 0.8, length(fwidth(p)) * 2.4);
    alb *= 1.0 - 0.1 * smoothstep(0.4, 0.8, streak) * snowWorked * aaS;
  }
  // Slush is wet snow: darker and a dirtier grey; frozen again, a polished
  // blue-grey glaze over the scrapes.
  if (snowSoft > 0.01) {
    float wet = 0.75 + 0.25 * snowNoise(p * 0.7 + 31.0);
    alb = mix(alb, vec3(0.64, 0.67, 0.71) * wet, 0.6 * snowSoft);
  }
  // Skied-in new snow: white heaps over troughs scraped back to the grey
  // of the groomer under them.
  if (snowChop > 0.01) {
    float trough = 1.0 - smoothstep(0.3, 0.6, snowNoise(p * 0.38 + 13.7));
    alb = mix(alb, vec3(0.74, 0.79, 0.86), trough * 0.4 * snowChop);
  }
  alb = mix(alb, vec3(0.58, 0.66, 0.78), 0.4 * snowHard);
  // THE GRAIN THAT STREAMS PAST: patches of wind-worked and polished snow
  // a hand to a couple of metres across, a few percent either way — too
  // fine to see from afar, and the thing close in the eye reads pace off.
  // Worked snow is the patchier. Each octave fades before it aliases.
  {
    float px = length(fwidth(p));
    float m1 = (snowNoise(p * 0.85) - 0.5) * (1.0 - smoothstep(0.3, 0.7, px * 0.85));
    float m2 = (snowNoise(p * 2.9 + 3.7) - 0.5) * (1.0 - smoothstep(0.3, 0.7, px * 2.9));
    float m3 = (snowNoise(p * 8.5 + 9.1) - 0.5) * (1.0 - smoothstep(0.3, 0.7, px * 8.5));
    alb *= 1.0 + (m1 * 0.45 + m2 * 0.4 + m3 * 0.3) * mix(0.22, 0.32, snowPacked) * (1.0 - snowIce);
  }
  // The berm is snow turned over by the plough: back to fresh white, with
  // the shade of its clods in it.
  if (snowBerm > 0.0) {
    float clod = snowNoise(p * 2.2);
    alb = mix(alb, fresh * mix(1.0, 0.88, clod), smoothstep(0.0, 0.35, snowBerm));
  }
  // Pressed snow is on its way to ice: a little less comes back.
  alb *= mix(vec3(1.0), vec3(0.9, 0.93, 0.97), snowPress);
  // The walls see less sky; a blue-grey the shading alone would not give.
  alb *= mix(vec3(1.0), vec3(0.8, 0.86, 0.95), snowWall * 0.8);
  // A wood seen from afar is a darker, greener ground — the trees past the
  // draw distance are still there in its colour.
  alb = mix(alb, uForestTint, snowForest * 0.55 * smoothstep(160.0, 520.0, snowDist));
  // THE REGION'S OWN SNOW: the wind slab, the river's bare ice, the rock.
  alb = mix(alb, alb * uCrustTone, snowCrust * (1.0 - snowPacked * 0.5));
  if (snowIce > 0.0) {
    alb = mix(alb, uIceTone * mix(0.9, 1.05, snowNoise(p * 0.05)), snowIce * (1.0 - snowPress * 0.6));
  }
  if (snowRock > 0.0) alb = mix(alb, uRock.rgb * mix(0.7, 1.2, snowNoise(p * 0.6)), snowRock);
  diffuseColor.rgb = alb * ${GLARE.toFixed(3)};
}
`;

/** After `roughnessmap_fragment`: groomed snow is glossier. */
export const SNOW_FRAGMENT_ROUGHNESS = /* glsl */ `
roughnessFactor = mix(mix(0.85, 0.55, snowPacked), 0.92, snowBerm) - 0.1 * snowPress;
roughnessFactor = mix(roughnessFactor, 0.72, snowGroomed);
roughnessFactor -= 0.15 * snowWorked;
roughnessFactor = mix(roughnessFactor, 0.4, 0.6 * snowSoft);
roughnessFactor = mix(roughnessFactor, 0.28, 0.7 * snowHard);
roughnessFactor = mix(roughnessFactor, 0.62, snowCrust * 0.6);
roughnessFactor = mix(roughnessFactor, 0.18, snowIce);
roughnessFactor = mix(roughnessFactor, 0.95, snowRock);
`;

/** After `normal_fragment_maps`: the per-pixel normal replaces the mesh's. */
export const SNOW_FRAGMENT_NORMAL = /* glsl */ `
normal = normalize((viewMatrix * vec4(snowN, 0.0)).xyz);
`;

/** After `lights_fragment_end`: the light that went in and came back out,
 * the crystals, the flat light's last relief and the arena's floods.
 * `directLight` still holds the key as the loop left it — shadowed —
 * because there is one directional light and it is last.
 *
 * FLAT LIGHT (`uFlat`, `sky.ts`): under a lid the key is a glow and the
 * hemisphere is the same white above and below, so the snow loses its
 * shading and a bump reads as nothing — which is the weather, and is kept.
 * What is left is what a skier really sees in flat light: the lid is
 * brighter over where the sun is, so a slope facing it is a touch lighter
 * than one turned away. That is the one cue drawn, at a tenth of the
 * contrast a sun gives: readable, but hard.
 *
 * THE LAMPS (`uLamp*`, `haze.ts`'s `lampReach`): a floodlight's cone
 * from its mast, a skier's headlamp's spot and the wide flood round it,
 * each falling off with the square of the distance in its own colour, and
 * the piste lights' baked light (`pisteLight`) on the runs they stand by; the
 * snow in a beam glitters toward the lamp as it does toward the sun, which
 * is what makes a lit pool of snow read as snow at night. */
export const SNOW_FRAGMENT_LIGHT = /* glsl */ `
{
  vec3 lidDir = normalize(vec3(uSunPos.x, 2.2, uSunPos.z));
  float facing = clamp(dot(snowN, lidDir) / lidDir.y, 0.0, 1.3);
  reflectedLight.indirectDiffuse *= mix(1.0, 0.55 + 0.45 * facing, uFlat);
}
{
  vec3 V = normalize(cameraPosition - vSnowWorld);
  float loose = (1.0 - snowPacked * 0.8) * (1.0 - snowPress * 0.6) * (1.0 - snowIce) * (1.0 - snowRock);
  vec3 lampLit = vec3(0.0);
  vec3 lampGlint = vec3(0.0);
  // THE LAMPS' CRYSTALS: every lamp glints off the same cells (one seed),
  // so a cell's facet and its spot are found once, and each lamp pays only
  // its own highlight — \`snowGlints\` lamp by lamp, without its hashes
  // done six times over a pixel. The footprint is read out here, where
  // every pixel of the quad still runs it. LAMPS LOW draws none of them
  // (\`uLampGlint\`): the beams light the snow and no crystal flares.
  vec3 lgQ = vSnowWorld * 7.0;
  float lgRad = max(0.14, length(fwidth(lgQ)) * 0.75);
  float lgK = 0.14 / lgRad;
  vec3 lgFacet = vec3(0.0);
  float lgSpot = 0.0;
  if (uLampOn[0] > 0.0 && uLampGlint > 0.0 && snowDist < 40.0) {
    vec3 lgCell = floor(lgQ);
    vec3 lgR = snowHash3(lgCell + 57.0);
    if (lgR.z <= 0.6) {
      lgFacet = normalize(snowN + (snowHash3(lgCell + 57.0 + 7.13) * 2.0 - 1.0) * 0.6);
      vec3 f = fract(lgQ) - (0.2 + 0.6 * lgR);
      lgSpot = 1.0 - smoothstep(lgRad * 0.45, lgRad, length(f));
    }
  }
  for (int i = 0; i < ${LAMP_SLOTS}; i++) {
    if (uLampOn[i] <= 0.0) break;
    if (uLampOn[i] <= 0.001) continue;
    vec3 L = uLampPos[i] - vSnowWorld;
    float d = length(L);
    L /= max(d, 1e-3);
    float e = lampReach(i, L, d);
    // Outside its beam a lamp adds nothing, and is not asked to.
    if (e <= 0.0) continue;
    lampLit += uLampCol[i] * (e * max(dot(snowN, L), 0.0));
    if (lgSpot > 0.0) {
      vec3 H = normalize(L + V);
      float g = pow(max(dot(lgFacet, H), 0.0), 600.0);
      lampGlint += uLampCol[i] * (e * (g * lgSpot * lgK * lgK));
    }
  }
  // THE PISTE LIGHTS, baked: a lit run's snow glitters toward its masts.
  if (uPisteOn.x > 0.0) {
    vec3 pv = pisteLight(vSnowWorld);
    float pe = length(pv);
    if (pe > 1e-4) {
      lampLit += uPisteCol * max(dot(snowN, pv), 0.0);
      if (snowDist < 40.0 && uLampGlint > 0.0) {
        vec3 H = normalize(pv / pe + V);
        lampGlint += uPisteCol * (pe * snowGlints(vSnowWorld, 7.0, 600.0, 0.6, snowN, H, 83.0));
      }
    }
  }
  reflectedLight.directDiffuse += BRDF_Lambert(diffuseColor.rgb) * lampLit * 9.0;
  reflectedLight.directSpecular += lampGlint * loose
    * (1.0 - smoothstep(12.0, 40.0, snowDist)) * 12.0;
}
#if NUM_DIR_LIGHTS > 0
{
  vec3 sunLit = directLight.color;
  float ndl = dot(snowN, uSunDir);
  // Wrap: what the terminator gains, tinted the blue of light that has been
  // through a few centimetres of ice.
  float wrap = (max(0.0, (ndl + 0.45) / 1.45) - max(ndl, 0.0)) * (1.0 - 0.7 * uFlat);
  reflectedLight.directDiffuse +=
    BRDF_Lambert(diffuseColor.rgb) * sunLit * wrap * vec3(0.55, 0.78, 1.0) * 0.9;

  // THE GLITTER, two sizes of crystal cell: the fine one close in, a
  // sparser, larger one carrying it a little further out.
  // No crystal is drawn past 140 m, nor on a sky that does not glitter.
  if (snowDist < 140.0 && uGlitter > 0.0) {
    vec3 V = normalize(cameraPosition - vSnowWorld);
    vec3 H = normalize(uSunDir + V);
    float loose = (1.0 - snowPacked * 0.8) * (1.0 - snowPress * 0.6) * (1.0 - snowIce) * (1.0 - snowRock);
    float glint = 0.0;
    if (snowDist < 45.0) {
      glint += snowGlints(vSnowWorld, 7.0, 600.0, 0.6, snowN, H, 0.0)
        * (1.0 - smoothstep(15.0, 45.0, snowDist));
    }
    if (snowDist > 8.0) {
      glint += snowGlints(vSnowWorld, 2.5, 900.0, 0.35, snowN, H, 31.0)
        * smoothstep(8.0, 25.0, snowDist) * (1.0 - smoothstep(50.0, 140.0, snowDist));
    }
    reflectedLight.directSpecular += sunLit * glint * loose * 18.0 * uGlitter;
  }
}
#endif
`;
