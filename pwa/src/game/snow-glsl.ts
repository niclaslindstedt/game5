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
//   * THE SNOW'S AGE (`uSnowAge`, `uSnowAge2`, `snow-age.ts`): the loose
//     snow off the groomer as the days since the fall have left it — NEW
//     snow the whitest, smoothest and finest-glittering; OLD snow a shade
//     greyer and coarser-grained (fewer, bigger glints); the WIND's slab
//     smoothed and rippled across its way on exposed ground; a SUN CRUST
//     glazed on the faces the noon sun stands on; SURFACE HOAR flashing like
//     sequins on the shaded snow; and the thaw's WET snow grey, glossy and
//     dimpled into sun cups.
//   * THE GLARE: snow scatters the sun FORWARD, so looking into a low sun a
//     snowfield shines — a broad sheen on powder, a hard streak off a crust,
//     wet snow, ice or a polished groomer. Its own lobe, over the material's.
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

import { ROCKS } from "@engine";

import { DEFORM_SHADE_GLSL } from "./deform-glsl.ts";
import { SNOW_GLINTS_GLSL, SNOW_NOISE_GLSL } from "./snow-noise-glsl.ts";
import { FRESH_LOOK, LOOSE, TRAIL } from "./trail-stamp.ts";
import { TRAIL_GLSL } from "./trail-map.ts";
import { WELL_GLSL } from "./tree-wells.ts";
import { SKI_GROOVE_GLSL } from "./ski-clear.ts";
import { PISTE_TRACKS_GLSL } from "./piste-tracks.ts";
import { SNOW_SKY_LIGHT, SNOW_SKY_PARS } from "./snow-sky-glsl.ts";
import { SLIDE_ALBEDO, SLIDE_GLSL, SLIDE_LUMPS, SLIDE_NORMAL } from "./avalanche-glsl.ts";
import { SNOW_LAMPS_LIGHT } from "./snow-lamps-glsl.ts";
import { SNOW_RELIEF_SAMPLE } from "./snow-relief-glsl.ts";
import { SNOW_SUN_LIGHT, SUN_GLARE } from "./snow-sun-glsl.ts";
import { SNOW_TRAIL_ALBEDO, SNOW_TRAIL_LIGHT, SNOW_TRAIL_SAMPLE } from "./snow-trail-glsl.ts";
import { CALM_FROM, CALM_TO, ROCK_HAZE, STRATA_GLSL } from "./strata-glsl.ts";
import { CALM_HELD, ROCK_SNOW } from "./rock-shapes.ts";

// The vertex half (`snow-vertex-glsl.ts`), grafted beside the fragment's.
export { SNOW_VERTEX_BEGIN, SNOW_VERTEX_PARS, SNOW_VERTEX_PLACE } from "./snow-vertex-glsl.ts";

/** How much brighter than white snow's albedo is painted. */
export const GLARE = 1.12;

export { SUN_GLARE };

// New snow that buries the groomed track's LOOK outright, m: stated
// three-free in `trail-stamp.ts`, where the trail map's fill reads it too.
export { FRESH_LOOK };

// How far loose powder stands over the groomed track: stated three-free in
// `trail-stamp.ts`, so what stands ON the snow (the wildlife's feet) reads
// the same surface this shader lifts.
export { LOOSE };

/** The fragment half's declarations. */
export const SNOW_FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uGround;
uniform sampler2D uTrackDir;
uniform vec2 uHeightOrigin;
uniform vec2 uHeightCount;
uniform float uCell;
uniform float uFlat;
uniform float uFresh;
uniform vec4 uPiste;
uniform vec4 uSnowAge;
uniform vec4 uSnowAge2;
uniform float uGlitter;
uniform vec3 uForestTint;
uniform vec3 uCrustTone;
uniform vec3 uIceTone;
uniform vec4 uRock;
uniform vec2 uRockSlope;
uniform vec3 uRockStone;
${STRATA_GLSL}
uniform float uSastrugi;
uniform vec2 uWindDir;
varying vec3 vSnowWorld;
varying vec3 vSnowNormal;
${TRAIL_GLSL}
${SKI_GROOVE_GLSL}
${DEFORM_SHADE_GLSL}
${WELL_GLSL}
${SLIDE_GLSL}

${SNOW_NOISE_GLSL}
${SLIDE_LUMPS}

${SNOW_GLINTS_GLSL}
// Per-fragment state the later grafts read.
vec3 snowN;          // world normal
float snowDist;      // metres from the lens
float snowPacked;    // 0 powder .. 1 groomed
float snowPress;     // 0 untouched .. 1 a full furrow
float snowWall;      // how steep the furrow's wall is here
vec2 snowWallUp;     // the furrow's own slope here, pointing up its wall
float snowForest;    // how wooded the ground round here is
float snowBerm;      // 0 off the plough's berm .. 1 on its crest
float snowCrust;     // 0 powder .. 1 a wind slab (R21)
float snowIce;       // 0 snow .. 1 a frozen river's bare ice (R21)
float snowRock;      // 0 snow .. 1 rock showing through a steep face
float snowFoot;      // m a pixel spans on the ground
float snowSkin;      // 0 .. 1 where the rock's skin lies (\`rockShare\`)
vec3 snowSkinCol;    // the skin's own far colour there, beds and all
float snowHazeKeep = 1.0; // the air laid thinner over the skin's bare stone
#define HAZE_KEEP snowHazeKeep
float snowGroomed;   // 0 .. 1 a piste machine's fresh swath (trailPackAt)
float snowSelf;      // 0 .. 1 the sun let through by the deformable snow's own relief
float snowBelt;      // 0 .. 1 a snowmobile's belt-packed floor (trailPackAt)
float snowLug;       // 0 .. 1 down in a paddle's imprint across that floor
float snowWorked;    // 0 .. 1 the day's skied-up piste (the hour's, or a night they groom)
float snowSoft;      // 0 .. 1 the groomer gone to slush under a spring sun
float snowHard;      // 0 .. 1 ...and frozen hard and glassy since
float snowChop;      // 0 .. 1 new snow on a piste in use, skied into heaps
float snowCombed;    // 0 .. 1 the night's corduroy still whole (the day's morning)
float snowLane;      // -1 .. 1 the night's passes: this one's shade, by its strength
float snowCord;      // -1 .. 1 the comb's ridge (+) or furrow (−) here, by its strength
float snowWell;      // m: how deep a tree well lowers the snow here
float snowSlide;     // m: the avalanche's bed (−) or debris (+) off the old surface
float snowBed;       // 0 .. 1 the bed surface a slab slid off
float snowDebris;    // m: the avalanche's debris lying here
float snowSlideWall; // 0 .. 1 on the crown's or a flank's wall
float snowScuff;     // 0 .. 1 THE SHALLOW BAND: a groomer's or a crust's pressed line
float snowTrough;    // 0 .. 1 THE MIDDLE BAND: powder's soft trough a boot deep
float snowTrench;    // 0 .. 1 THE DEEP BAND: a trench in deep snow
float snowHollow;    // 0 .. 1 how far down in a trench, out of the sky's light
float snowSpill;     // 0 .. 1 the clods a trench has thrown out over its rim
float snowNew;       // 0 .. 1 new snow's look, off the groomer
float snowOld;       // 0 .. 1 old snow's: greyer, coarser
float snowWind;      // 0 .. 1 the wind's slab, smoothed and rippled
float snowSunCrust;  // 0 .. 1 a sun crust's glaze on a face turned to the noon sun
float snowHoar;      // 0 .. 1 surface hoar on the shaded snow
float snowWet;       // 0 .. 1 thawed snow: grey, glossy, sun-cupped
float snowCup;       // 0 .. 1 down in a sun cup's hollow
float snowScour;     // 0 .. 1 a patch the wind has scoured to its slab
${PISTE_TRACKS_GLSL}
${SNOW_SKY_PARS}`;

/** Straight after `clipping_planes_fragment`: throw away what the finer
 * level already covers, and work out everything about this bit of snow. */
export const SNOW_FRAGMENT_SAMPLE = /* glsl */ `
{
  vec2 p = vSnowWorld.xz;
  vec3 eye = vSnowWorld - cameraPosition;
  snowDist = length(eye);
  vec2 guv = (p - uHeightOrigin + 0.5 * uCell) / (uHeightCount * uCell);
  vec4 g = texture2D(uGround, guv);
  // New snow over the groomer (\`uFresh\`) buries its look — the comb's
  // corduroy first, the grey of worked snow by a few centimetres — while
  // the physics still feels the hard base under it (\`packedUnder\`).
  // The packed share, and below nought the rock's (\`terrain.ts\`).
  snowPacked = max(g.b, 0.0) * (1.0 - smoothstep(0.0, ${FRESH_LOOK.toFixed(3)}, uFresh));
  // A PISTE MACHINE'S SWATH (\`groomer.ts\`): packed through wherever the
  // tiller went, on the piste or off it, and only the snow since on it. On
  // a night the machines work, the rest of the piste is the day's: skied
  // up, scraped and heaped, the comb long gone (\`snowWorked\`).
  vec3 groom = uWorked + uBelted > 0.0 ? trailPackAt(p) : vec3(0.0);
  // Ramped over half the mark, so the filtered edge of a swath is a soft
  // line rather than the trail map's texel stairs.
  snowGroomed = smoothstep(0.0, 0.45, groom.x);
  // A SNOWMOBILE'S BELT: its floor packed hard under the paddles, and only
  // the snow fallen since on it (\`trailPackAt\`'s y, buried as a swath is).
  snowBelt = smoothstep(0.0, 0.45, groom.y);
  snowLug = 0.0;
  if (snowBelt > 0.0) {
    float since = (1.0 - groom.y) * ${FRESH_LOOK.toFixed(3)};
    snowPacked = mix(snowPacked, 0.85 * (1.0 - smoothstep(0.0, ${FRESH_LOOK.toFixed(3)}, since)), snowBelt);
  }
  if (snowGroomed > 0.0) {
    float since = (1.0 - groom.x) * ${FRESH_LOOK.toFixed(3)};
    snowPacked = mix(snowPacked, 1.0 - smoothstep(0.0, ${FRESH_LOOK.toFixed(3)}, since), snowGroomed);
  }
  // THE PISTE THROUGH THE DAY (\`uPiste\`, \`piste-day.ts\`): skied up
  // since the first chair, softened by the sun and frozen again — all of it
  // on the groomer the machines have not been over since.
  float notSwath = (1.0 - snowGroomed) * (1.0 - snowBelt) * snowPacked;
  snowCord = 0.0;
  snowTrackShade = 0.0;
  snowLane = 0.0;
  snowWorked = max(uWorked, uPiste.x) * notSwath;
  snowSoft = uPiste.y * notSwath;
  snowHard = uPiste.z * notSwath;
  // Before the first chair the night's corduroy is as whole as a swath.
  float untouched = 1.0 - uPiste.x;
  snowCombed = uPiste.w * untouched * untouched * notSwath;
  // The new snow a busy piste has taken: not a smooth blanket but skied
  // into heaps and troughs as it lands.
  snowChop = uPiste.x * max(g.b, 0.0) * smoothstep(0.0, ${FRESH_LOOK.toFixed(3)}, uFresh) * (1.0 - snowGroomed);
  snowForest = g.a;
  vec2 grad = g.rg;
  // The crust and the ice, one signed share in the track map's alpha
  // (\`terrain.ts\`'s \`foldSurface\`): above a half the crust, below it the ice.
  float surf = (texture2D(uTrackDir, guv).a * 255.0 - 128.0) / 127.0;
  snowCrust = max(surf, 0.0);
  snowIce = max(-surf, 0.0);
  // The loose cover's step at the track's shoulders.
  {
    vec2 du = vec2(0.5 / uHeightCount.x, 0.0);
    vec2 dv = vec2(0.0, 0.5 / uHeightCount.y);
    vec4 nb = max(vec4(texture2D(uGround, guv + du).b, texture2D(uGround, guv - du).b,
                       texture2D(uGround, guv + dv).b, texture2D(uGround, guv - dv).b), 0.0);
    vec2 pg = vec2(nb.x - nb.y, nb.z - nb.w) / uCell;
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
  // WHERE THE SKIN LIES (\`rockShare\`, carried below nought in the packed
  // channel): the rock there is the skin's own as it is calmed far out
  // (\`strata-glsl.ts\`), so the ground carries its beds past its reach and
  // shows the same rock where it pokes through it.
  // Near, the skin itself is drawn and the ground under it is left as it
  // was; it takes the skin's colour on as the skin is calmed, so where it
  // pokes through the skin it is the skin's colour.
  snowSkin = uStrata.w * smoothstep(${ROCKS.skin.from.toFixed(3)}, 0.45, -g.b)
    * smoothstep(${CALM_FROM.toFixed(1)}, ${CALM_TO.toFixed(1)}, snowDist);
  snowRock = max(snowRock, snowSkin * uRock.w);
  snowSkinCol = vec3(0.0);
  {
    // Its beds as tone (\`stBands\`), over the pixel's footprint on the bed
    // coordinate (worked out off the slope: no derivative is taken in a
    // branch), and its snow as the calmed skin's even cover (\`rock-shapes.ts\`).
    vec2 slopeW = grad - uStrata.xy;
    snowFoot = length(fwidth(p));
    float fwW = sqrt(1.0 + dot(slopeW, slopeW)) * snowFoot;
    if (snowSkin > 0.0) {
      float ny = inversesqrt(1.0 + dot(grad, grad));
      float even = clamp((ny + ${CALM_HELD.toFixed(3)} - ${ROCKS.skin.slides.toFixed(3)}) / ${(ROCKS.skin.holds - ROCKS.skin.slides).toFixed(3)}, 0.0, 1.0);
      vec3 b = stBands(stCoord(p, vSnowWorld.y), fwW);
      snowSkinCol = stFar(uRockStone, vec3(${ROCK_SNOW.map((v) => v.toFixed(3)).join(", ")}), even, b, 1.0) / ${GLARE.toFixed(3)};
    }
  }

  // THE SNOW'S AGE, here: only the loose snow (the groomer is the night's,
  // the ice and the rock are not snow), the run's own fall making it new
  // again, and which way the ground faces the noon sun — a crust on the
  // faces it stands on, hoar in the shade.
  {
    float loose = (1.0 - snowPacked) * (1.0 - snowIce) * (1.0 - snowRock);
    float runNew = smoothstep(0.0, ${FRESH_LOOK.toFixed(3)}, uFresh);
    float aged = uSnowAge.y * (1.0 - runNew) * loose;
    float steep = length(g.rg);
    float face = dot(-g.rg / max(steep, 1e-4), uSnowAge2.zw) * smoothstep(0.04, 0.3, steep);
    float exposed = 1.0 - snowForest;
    snowNew = max(uSnowAge.x, runNew) * loose;
    snowOld = aged;
    snowWind = uSnowAge.z * aged * exposed;
    snowSunCrust = uSnowAge.w * aged * clamp(0.35 + 0.9 * face, 0.0, 1.0) * (1.0 - 0.5 * snowForest);
    snowHoar = uSnowAge2.x * (1.0 - runNew) * loose * clamp(0.85 - 0.8 * face, 0.25, 1.0)
      * (1.0 - 0.6 * uSnowAge.z * exposed);
    snowWet = uSnowAge2.y * (1.0 - runNew) * loose * clamp(0.55 + 0.6 * face, 0.0, 1.0);
    snowCup = 0.0;
    snowScour = 0.0;
  }
${SNOW_TRAIL_SAMPLE}

  // THE PADDLES' PRINT across a belt's floor: a lug's imprint every pitch
  // along the belt, the paddles in staggered rows across it a half pitch
  // apart, each imprint a sharp trough between flat pressed ridges — faded
  // out before it aliases. The way the belt ran is the map's (\`groom.z\`).
  if (snowBelt > 0.01 && snowDist < 70.0) {
    float th = groom.z * 3.14159265;
    vec2 alg = vec2(sin(th), cos(th));
    vec2 acr = vec2(cos(th), -sin(th));
    float row = floor(dot(p, acr) / ${TRAIL.lug.row.toFixed(3)});
    float ph = dot(p, alg) / ${TRAIL.lug.pitch.toFixed(3)} + 0.5 * mod(row, 2.0);
    float aa = 1.0 - smoothstep(0.3, 0.8, fwidth(ph));
    float c = 0.5 + 0.5 * cos(6.2831853 * ph);
    float c2 = c * c;
    // A row's ends rounded off, as a paddle's are, and the odd one broken.
    float ac = fract(dot(p, acr) / ${TRAIL.lug.row.toFixed(3)});
    float ends = smoothstep(0.0, 0.12, ac) * smoothstep(1.0, 0.88, ac);
    float k = snowBelt * aa * ends * (1.0 - smoothstep(35.0, 70.0, snowDist));
    k *= mix(0.6, 1.0, snowNoise(p * 3.0 + row * 1.7));
    snowLug = c2 * c * k;
    // h = −depth · c³; its slope along the belt.
    float dh = 3.0 * ${TRAIL.lug.depth.toFixed(3)} * 3.14159265 * c2 * sin(6.2831853 * ph) / ${TRAIL.lug.pitch.toFixed(3)};
    grad += alg * dh * k;
  }

  // THE TREE WELLS: the hollow's own slope, off the same map the mesh is
  // lowered by.
  snowWell = wellDepth(p);
  if (uWellFrame.w > 0.0 && snowDist < 90.0) {
    float we = 0.3;
    vec2 wg = vec2(wellDepth(p + vec2(we, 0.0)) - wellDepth(p - vec2(we, 0.0)),
                   wellDepth(p + vec2(0.0, we)) - wellDepth(p - vec2(0.0, we))) / (2.0 * we);
    grad -= wg;
  }
  // THE AVALANCHE: its bed, its walls and its debris (\`avalanche-glsl.ts\`).
${SLIDE_NORMAL}
${SNOW_RELIEF_SAMPLE}

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
  // THE SNOW'S AGE (\`snow-age.ts\`): new snow the cleanest white, its
  // drifts' shade filled in; old snow a settled, faintly warmer grey; the
  // wind's scoured slab a polished blue-grey; a crust a touch darker under
  // its glaze; wet snow grey, the most in its cups' hollows, where the dirt
  // of the season gathers; and hoar a fur of crystals, whiter than the snow.
  alb = mix(alb, vec3(0.975, 0.99, 1.0), 0.75 * snowNew);
  alb *= mix(vec3(1.0), vec3(0.85, 0.855, 0.84), snowOld);
  alb *= mix(vec3(1.0), vec3(0.8, 0.86, 0.94), snowScour * 0.9);
  alb *= mix(vec3(1.0), vec3(0.93, 0.945, 0.965), snowSunCrust);
  alb *= mix(vec3(1.0), vec3(0.72, 0.74, 0.74) * (1.0 - 0.12 * snowCup), snowWet);
  alb = mix(alb, vec3(0.97, 0.985, 1.0), 0.35 * snowHoar);
  // Groomed: greyer and a touch warmer — worked snow on its way to ice.
  alb = mix(alb, vec3(0.7, 0.75, 0.82), snowPacked * 0.9);
  // Fresh off the tiller: milled snow, a brighter, even sugar-white.
  alb = mix(alb, vec3(0.86, 0.9, 0.95), max(snowGroomed * 0.65, snowCombed * 0.5));
  // The comb's furrows hold a little shade, its ridges catch the light.
  alb *= 1.0 + 0.07 * snowCord + 0.07 * snowLane + 0.3 * snowTrackShade;
  // A belt's floor: pressed smooth, a shade greyer than the loose snow it
  // was, each paddle's imprint holding a little shadow.
  alb = mix(alb, vec3(0.8, 0.85, 0.92), snowBelt * 0.35);
  alb *= 1.0 - 0.08 * snowLug;
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
    // New snow is the evener, old and wet snow the patchier.
    float patchy = mix(0.22, 0.32, snowPacked) * (1.0 - 0.55 * snowNew) * (1.0 + 0.5 * snowOld + 0.5 * snowWet);
    alb *= 1.0 + (m1 * 0.45 + m2 * 0.4 + m3 * 0.3) * patchy * (1.0 - snowIce);
  }
  // A TREE WELL: the hollow under the boughs is out of the sky's light and
  // its snow is older and coarser — a cooler, shadier grey-blue the deeper
  // in — and on its floor lies what the tree sheds: needles, twigs, flakes
  // of bark and lichen, in clots.
  if (snowWell > 0.02) {
    float k = smoothstep(0.0, 1.0, snowWell);
    alb = mix(alb, vec3(0.62, 0.7, 0.84), 0.55 * k);
    // Under the boughs the pit sees little of the sky: the deeper, the
    // darker, as the photographs of open wells show their walls.
    alb *= mix(vec3(1.0), vec3(0.66, 0.72, 0.82), smoothstep(0.25, 1.3, snowWell));
    float floorK = smoothstep(0.55, 1.2, snowWell) * (1.0 - smoothstep(0.3, 0.7, length(fwidth(p)) * 6.0));
    float clot = smoothstep(0.55, 0.85, snowNoise(p * 6.0 + 41.0));
    float needle = smoothstep(0.7, 0.95, snowNoise(p * 23.0 + 7.0));
    alb = mix(alb, vec3(0.3, 0.25, 0.19), (clot * 0.5 + needle * 0.35) * floorK);
  }
${SLIDE_ALBEDO}
  // The berm is snow turned over by the plough: back to fresh white, with
  // the shade of its clods in it.
  if (snowBerm > 0.0) {
    float clod = snowNoise(p * 2.2);
    alb = mix(alb, fresh * mix(1.0, 0.88, clod), smoothstep(0.0, 0.35, snowBerm));
  }${SNOW_TRAIL_ALBEDO}
  // A wood seen from afar is a darker, greener ground — the trees past the
  // draw distance are still there in its colour.
  alb = mix(alb, uForestTint, snowForest * 0.55 * smoothstep(160.0, 520.0, snowDist));
  // THE REGION'S OWN SNOW: the wind slab, the river's bare ice, the rock.
  alb = mix(alb, alb * uCrustTone, snowCrust * (1.0 - snowPacked * 0.5));
  if (snowIce > 0.0) {
    alb = mix(alb, uIceTone * mix(0.9, 1.05, snowNoise(p * 0.05)), snowIce * (1.0 - snowPress * 0.6));
  }
  if (snowRock > 0.0) {
    // The rock showing through, its grain gone to its mean where a pixel
    // spans it; and where the skin lies, the skin's own far colour.
    float grain = mix(0.5, snowNoise(p * 0.6), 1.0 - smoothstep(0.5, 1.4, snowFoot * 0.6));
    vec3 rockAlb = mix(uRock.rgb * mix(0.7, 1.2, grain), snowSkinCol, snowSkin);
    alb = mix(alb, rockAlb, snowRock);
    snowHazeKeep = mix(1.0, ${ROCK_HAZE.toFixed(2)}, snowRock * snowSkin);
  }
  diffuseColor.rgb = alb * ${GLARE.toFixed(3)};
}
`;

/** After `roughnessmap_fragment`: groomed snow is glossier. */
export const SNOW_FRAGMENT_ROUGHNESS = /* glsl */ `
roughnessFactor = mix(mix(0.85, 0.55, snowPacked), 0.92, snowBerm) - 0.1 * snowPress - 0.22 * snowScuff;
roughnessFactor = mix(roughnessFactor, 0.72, snowGroomed);
roughnessFactor -= 0.15 * snowWorked;
roughnessFactor = mix(roughnessFactor, 0.4, 0.6 * snowSoft);
roughnessFactor = mix(roughnessFactor, 0.28, 0.7 * snowHard);
roughnessFactor = mix(roughnessFactor, 0.94, 0.7 * snowNew);
roughnessFactor = mix(roughnessFactor, 0.62, snowWind * (0.3 + 0.5 * snowScour));
roughnessFactor = mix(roughnessFactor, 0.34, 0.85 * snowSunCrust);
roughnessFactor = mix(roughnessFactor, 0.3, 0.8 * snowWet);
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
// The sun the deformable snow's relief hides (\`snowSelf\`): only the key
// has been gathered into the direct terms yet.
reflectedLight.directDiffuse *= snowSelf;
reflectedLight.directSpecular *= snowSelf;
${SNOW_SKY_LIGHT}
{
  vec3 lidDir = normalize(vec3(uSunPos.x, 2.2, uSunPos.z));
  float facing = clamp(dot(snowN, lidDir) / lidDir.y, 0.0, 1.3);
  reflectedLight.indirectDiffuse *= mix(1.0, 0.55 + 0.45 * facing, uFlat);
  // ...and FORM under the lid: a bump's sides, tilted off the slope it
  // stands on, see less of a lid whose zenith is the brightest of it (an
  // overcast's sky is some three times as bright overhead as at its rim),
  // so every swell, track and clod is rimmed a shade darker — the faint
  // modelling a skier finds in flat light up close, gone by the middle
  // distance, where the eye finds none.
  float rel = max(dot(snowN, normalize(vSnowNormal)), 0.0);
  float rel2 = rel * rel;
  float rel8 = rel2 * rel2 * rel2 * rel2;
  reflectedLight.indirectDiffuse *= mix(1.0, 0.68 + 0.32 * rel8 * rel2, uFlat * (1.0 - smoothstep(40.0, 160.0, snowDist)));${SNOW_TRAIL_LIGHT}
}${SNOW_LAMPS_LIGHT}${SNOW_SUN_LIGHT}
`;
