// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK AS DRAWN — the drops' rock (`rock-shapes.ts`): the skin over
// every wall too steep for snow (the engine's `rockShare`) and every rocky
// cliff's wall (`cliffWalls`), built into static meshes a TILE of the map
// at a time: one draw a tile, culled by three against the lens like any
// mesh, and BUILT ONLY WHEN IT FIRST COMES WITHIN REACH, so a phone never
// holds the rock of a face it never sees. The building is SLICED: a strip
// of the tile's lattice at a time, for at most `SLICE` ms a frame, so
// riding toward a rocky face never hitches; only the tiles round the lens
// itself, on the run's first frame or after a jump (a reset, a lift's
// top), are built whole at once. The reach is the DISTANCE row's whole
// view, not the trees': a far or high lens looks at the walls from across
// the valley. Past it the snow shader's dark rock carries them to the rim.
//
// A TILE IS BUILT AT THE CUT ITS DISTANCE ASKS (`cutsOf`, the FOREST row's): the full lattice
// near the lens, the cheap one past the row's `near` and a coarse one past
// its `mid`, a face across the valley a ninth of its triangles in the
// same outline. A tile owed a finer or coarser cut keeps the one it has on
// screen until the new one is whole, and only swaps past a margin
// (`HYSTERESIS`), so riding to and fro across a band never rebuilds it.
//
// Near the lens the lattice is always the physics' own (`rock-ground.ts`),
// whatever the picture: a coarser one stands up to metres off the rock a
// body meets. The whole thing hangs off the forest (`forest.ts`), which
// owns the woods' reach.

import * as THREE from "three";
import {
  ROCKS,
  SKIN_SALT,
  cliffWalls,
  regionOf,
  rockHash,
  windAt,
  type CliffWall,
  type Level,
} from "@engine";

import { PAST_THE_WALL, hazeMaterial, type HazeUniforms } from "./haze.ts";
import { regionLookOf } from "./region-look.ts";
import { FOREST_LOOK, type RockLook } from "./settings-video.ts";
import { createTalus } from "./talus.ts";
import {
  ROCK_SNOW,
  buildSkin,
  buildWall,
  rockMesh,
  rockTone,
  smoothSkin,
  type RockMesh,
} from "./rock-shapes.ts";
import { summerShown } from "./season-look.ts";
import { CALM_FROM, CALM_TO, FAR_EVEN, STRATA_GLSL, strataUniforms } from "./strata-glsl.ts";

/** A tile's side, m. */
const TILE = 192;
/** A skin tile's attributes, in the order its part holds them, and their
 * sizes: the program is keyed by them, so its warm triangle carries the same. */
const SKIN_ATTRIBUTES: readonly (readonly [string, number])[] = [
  ["position", 3],
  ["normal", 3],
  ["color", 3],
  ["soft", 3],
  ["calm", 3],
  ["strata", 3],
];
/** The building's share of a frame, ms. */
const SLICE = 1.5;
/** Within this of the lens a tile is built whole at once, whatever it
 * costs, m: a crag appearing that close would be seen. */
const NOW = 110;
/** How far past the reach a built tile is kept, m, before it is let go. */
const KEEP = 2 * TILE;
/** A cut: out to `out` m off a tile's nearest corner its lattice is
 * `cell` m, its beds taken `every` at a time. */
export type Cut = { readonly out: number; readonly cell: number; readonly every: number };

/** The lattice by distance from the lens to a tile's nearest corner, as
 * the FOREST row has it (`ForestLook.rocks`): the physics' own lattice
 * near (the rock drawn is the rock met), then the row's cheap one, then
 * one twice as coarse, each taking more beds to a ledge. */
export function cutsOf(look: RockLook): readonly Cut[] {
  const every = look.cheap / ROCKS.skin.cheap;
  return [
    { out: look.near, cell: ROCKS.skin.cell, every: 1 },
    { out: look.mid, cell: look.cheap, every: 2 * every },
    { out: Infinity, cell: 2 * look.cheap, every: ROCKS.strata.coarse * every },
  ];
}
/** HIGH's cuts. */
export const CUTS = cutsOf(FOREST_LOOK.high.rocks);
/** How far past a band's edge a tile must be before it changes cut, m. */
const HYSTERESIS = 30;

/** THE ROCK CALMED WITH DISTANCE: from `CALM_FROM` m to `CALM_TO` m off
 * the lens every corner eases from its facet's flat normal and own shade
 * to the ground's smooth normal and the rock's mean paint (`RockMesh`'s
 * `soft` and `calm`). A facet is a few metres; far out it is a few
 * pixels, and a field of them each lit and shaded its own way, snow on one
 * and bare stone on the next, twinkles as the lens moves — the far crags
 * flicker. Calmed, the face keeps its shape and its snow and loses only
 * the detail no pixel can hold. Close in nothing changes. */
const CALM_HEAD = /* glsl */ `
attribute vec3 soft;
attribute vec3 calm;
attribute vec3 strata;
varying vec3 vStrata;
varying float vCalm;
`;
// Three's vertex shader colours before it reads the normal, so the share
// is reckoned with the colour.
const CALM_COLOUR = /* glsl */ `
#include <color_vertex>
float rockCalm = smoothstep(${CALM_FROM.toFixed(1)}, ${CALM_TO.toFixed(1)},
  distance((modelMatrix * vec4(position, 1.0)).xyz, cameraPosition));
vColor.xyz = mix(color.xyz, calm, rockCalm);
vStrata = strata;
vCalm = rockCalm;
`;

/** THE ROCK'S OWN MATERIAL, in its shader (no texture, no sampler): what
 * the skin's beds and a cliff's wall are made of under their facets.
 *
 * - THE LAMINAE: each bed the skin lays (`strata.ts`, metres thick) drawn
 *   as the thin layers it is made of, every `LAYER` m along its bed
 *   coordinate, each a shade of its own and rounded in the light — its
 *   bump an ANALYTIC height (a lamina's profile, differentiated by hand and
 *   carried by the screen derivatives of the smooth coordinate alone), never
 *   the screen derivatives of a stepped field, which blink a 2×2 block at
 *   every step.
 * - THE JOINTS: cracks across the layers, NO GRID — a run of a layer or
 *   few shares its set, the next run's are dealt afresh (they JOG at a
 *   parting), a joint now and then skips a run (two blocks one) and a
 *   second set falls between at its own spacing. On the skin the main set
 *   stands where the skin's own blocks jog (`jointOf`'s whole numbers).
 * - STREAKS of wet and iron down the fall line (noise stretched up the
 *   world, so they run straight down any face), LICHEN in patches, RIME
 *   plastered on the windward side of every facet (`uRockWind`, read off
 *   the facet's own normal), and the NEW SNOW dusted over what lies back
 *   (`uFresh`).
 * - THE BEDS AS TONE past the calm (`strata-glsl.ts`): where the skin's
 *   facets are eased away with distance its beds are painted back on, the
 *   ground's own far bands, box-filtered over the pixel.
 *
 * Every term fades with the pixel's footprint on the rock (`fwidth`): a
 * line goes before it is thinner than a pixel, a patch to its mean before
 * it is the size of one, so nothing twinkles as the lens moves. Only on
 * the rock, never the snow lying on it. */
const LAYER = 0.9;
/** The snow on the rock and the rime's white, linear (`rock-shapes.ts`'
 * snow), as GLSL. */
const SNOW_GLSL = `vec3(${ROCK_SNOW.map((v) => v.toFixed(3)).join(", ")})`;
const RIME_GLSL = "vec3(0.9, 0.93, 0.97)";
const STRATA_FRAG_HEAD = /* glsl */ `
varying vec3 vStrata;
varying float vCalm;
uniform vec2 uRockWind;
uniform float uRockSummer;
uniform float uFresh;
// The air laid thinner over the bare stone (\`ROCK_HAZE\`, \`haze.ts\`).
float rkHazeKeep = 1.0;
#define HAZE_KEEP rkHazeKeep
${STRATA_GLSL}
float rkHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float rkHash3(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float rkNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(rkHash3(i), rkHash3(i + vec3(1, 0, 0)), f.x),
        mix(rkHash3(i + vec3(0, 1, 0)), rkHash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(rkHash3(i + vec3(0, 0, 1)), rkHash3(i + vec3(1, 0, 1)), f.x),
        mix(rkHash3(i + vec3(0, 1, 1)), rkHash3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
// A noise faded to its mean where its wave is under a few pixels (px m).
float rkSoft(vec3 p, float wave, float px) {
  return mix(0.5, rkNoise(p / wave), 1.0 - smoothstep(0.15, 0.4, px / wave));
}
// The distance, in joint units, from u to the nearest joint of a run:
// the main set at the run's dealt places (or at the whole numbers, lead
// 1), some of them skipped, and a second set between, sparser.
// \`keep\` names the stretch a joint is kept or skipped over (a skipped
// share \`skip\`), \`second\` the share of cells with a joint of the second set.
float rkJoint(float u, float run, float lead, float keep, float skip, float second) {
  float c = floor(u);
  float d = 4.0;
  for (int i = -1; i <= 1; i++) {
    float cc = c + float(i);
    float h1 = rkHash(vec2(cc, run));
    float a = cc + mix(0.1 + 0.8 * h1, 0.0, lead);
    if (rkHash(vec2(cc + 31.7, keep)) > skip) d = min(d, abs(u - a));
    float h2 = rkHash(vec2(cc + 57.1, run + 0.5));
    if (h2 > 1.0 - second) d = min(d, abs(u - (cc + 0.25 + 0.5 * rkHash(vec2(run, cc + 9.3)))));
  }
  return d;
}
vec2 rkSlope;
float rkRock;
uniform vec3 uRockStone;
`;
const STRATA_COLOUR = /* glsl */ `
#include <color_fragment>
rkSlope = vec2(0.0);
{
  vec3 P = vHazeWorld;
  vec3 dpx = dFdx(P);
  vec3 dpy = dFdy(P);
  // The size of a pixel on the rock, m, and the facet's own normal (the
  // position is never stepped, so its derivatives are the facet's).
  float px = max(length(dpx), length(dpy)) + 1e-4;
  vec3 F = normalize(cross(dpx, dpy));
  F *= sign(dot(F, cameraPosition - P) + 1e-6);
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  rkRock = 1.0 - smoothstep(0.3, 0.55, lum);
  bool wall = vStrata.z < -0.5;
  float fine = 1.0 - smoothstep(0.03, 0.1, px);
  float mid = 1.0 - smoothstep(0.08, 0.3, px);
  float winter = 1.0 - uRockSummer;

  // THE SNOW DECIDED BY THE FACET where the corners' paint is smeared
  // between a snowy tread and its bare riser: the facet that lies back
  // holds it, the one that stands up sheds it, so a tread reads as a tread
  // and not a white wash down the riser below it. Near only; calmed, the
  // corners' even paint stands.
  //
  // DUSTED, NEVER SHEETED: a tread is a ledge with the snow lying on it,
  // the rock poking through in patches and its back eaten into, not a flat
  // white sheet the size of the facet — the snow broken by a noise a few
  // metres across, near only (calmed, the beds' tone carries it).
  float patchy = smoothstep(0.3, 0.72,
    0.6 * rkSoft(P * vec3(1.0, 2.2, 1.0) + 3.0, 3.1, px) + 0.4 * rkSoft(P + 17.0, 1.1, px));
  float near = (1.0 - vCalm) * winter;
  if (wall) {
    // A wall's ledges and the shelf behind its lip, dusted the same way.
    float s0 = 1.0 - rkRock;
    float eat = near * smoothstep(0.35, 0.8, s0) * 0.5 * (1.0 - patchy);
    diffuseColor.rgb = mix(diffuseColor.rgb, uRockStone * (0.7 + 0.4 * patchy), eat);
    rkRock = max(rkRock, eat);
  } else {
    float s0 = 1.0 - rkRock;
    float smear = clamp(4.0 * s0 * (1.0 - s0), 0.0, 1.0) * near;
    float want = smoothstep(0.7, 0.92, F.y);
    // Only ever taken off: a riser sheds its tread's snow, but no facet
    // is whitened past its corners' paint (that drew flat sheets).
    float s1 = mix(s0, min(s0, want), 0.7 * smear);
    float eat = near * smoothstep(0.35, 0.8, s0) * 0.75 * smoothstep(0.75, 0.15, patchy);
    s1 *= 1.0 - eat;
    vec3 bare = clamp((diffuseColor.rgb - ${SNOW_GLSL} * s0) / max(1.0 - s0, 0.25), 0.0, 1.0);
    bare = mix(bare, uRockStone * (0.75 + 0.35 * patchy), smoothstep(0.55, 0.9, s0));
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(bare, ${SNOW_GLSL}, s1), min(1.0, max(smear, eat * 2.0)));
    rkRock = 1.0 - s1;
  }

  // THE LAMINAE, and their analytic bump.
  float t = vStrata.x / ${LAYER.toFixed(2)} + 0.18 * sin(vStrata.y * 9.42);
  vec2 dt = vec2(dFdx(t), dFdy(t));
  float fwT = abs(dt.x) + abs(dt.y);
  float lam = 1.0 - smoothstep(0.04, 0.14, fwT);
  float L = floor(t);
  float fl = t - L;
  float layer = rkHash(vec2(L, 3.1));
  // A lamina's rounded face, its height 0.035 sin(pi f) m (none at a
  // parting), and its slope along t by hand.
  float dh = 0.035 * 3.14159 * cos(3.14159 * fl) * lam * lam * rkRock;
  rkSlope = dh * dt;

  // THE JOINTS: no grid.
  float run = floor(L * 0.41 + 0.3 * sin(L * 1.7));
  // On a wall: wide apart, each kept or skipped a lamina at a time (a
  // crack runs a layer or three and stops, then jogs), the second set
  // rare, and a soft groove a few cm wide rather than a pen line.
  float u = vStrata.y * (wall ? 1.9 : 2.0);
  float fwU = abs(dFdx(u)) + abs(dFdy(u)) + 1e-6;
  float jd = wall
    ? rkJoint(u, run, 0.0, L, 0.65, 0.12)
    : rkJoint(u, run, 1.0, floor(run / 3.0), 0.22, 0.38);
  float jw = wall ? 0.012 : 0.0;
  float crack = (1.0 - smoothstep(jw * 0.4, jw + 1.6 * fwU, jd)) * mid;
  float parting = (1.0 - smoothstep(0.0, 0.05 + fwT, min(fl, 1.0 - fl)))
    * step(wall ? 0.72 : 0.3, rkHash(vec2(L + 0.5, 5.3)));

  float tone = mix(1.0, (0.86 + 0.28 * layer) * (1.0 - 0.2 * parting), lam);
  tone *= 1.0 - (wall ? 0.3 : 0.38) * crack;
  // UNDERCUT: a facet facing down is the underside of a bed jutting over
  // the one below, in its own shadow — darker than the sky's light leaves it.
  tone *= 1.0 - 0.42 * smoothstep(-0.04, -0.45, F.y) * (1.0 - vCalm);

  // STREAKS down the fall line, RUST, LICHEN — on the steep facets.
  float steep = (1.0 - smoothstep(0.55, 0.85, F.y)) * (1.0 - vCalm);
  // A streak is a hand or two across and tens of metres down.
  float wet = smoothstep(0.6, 0.85, rkSoft(vec3(P.x, P.y * 0.06, P.z), 1.6, px)) * steep;
  float rust = smoothstep(0.62, 0.9, rkSoft(vec3(P.x + 40.0, P.y * 0.23, P.z), 7.7, px)) * steep;
  // Two scales across each other, so no patch reads as the noise's cube.
  float lichen = smoothstep(0.6, 0.78, 0.6 * rkSoft(P + 23.0, 2.7, px) + 0.4 * rkSoft(P.zxy * 1.3 + 7.0, 1.1, px))
    * (1.0 - wet);
  float orange = smoothstep(0.55, 0.75, rkNoise(P * 0.11 + 5.0));
  vec3 c = diffuseColor.rgb;
  vec3 rk = c * tone * (1.0 - 0.22 * wet);
  rk = mix(rk, rk * vec3(1.25, 1.0, 0.78), 0.3 * rust);
  rk = mix(rk, rk * mix(vec3(1.0, 1.1, 0.9), vec3(1.3, 1.02, 0.7), orange), 0.3 * lichen);
  c = mix(c, rk, rkRock);

  // THE BEDS AS TONE where the facets are calmed away (the skin alone).
  float fwW = abs(dFdx(vStrata.x)) + abs(dFdy(vStrata.x));
  if (!wall && uStrata.w > 0.5 && vCalm > 0.0) {
    vec3 b = stBands(vStrata.x, fwW);
    float even = vStrata.z;
    vec3 snowC = ${SNOW_GLSL};
    float spread = ${FAR_EVEN.toFixed(2)} * even;
    vec3 stone = clamp((c - snowC * spread) / max(1.0 - spread, 0.08), 0.0, 1.0);
    vec3 banded = stFar(stone, snowC, even, b, winter, distance(P, cameraPosition));
    c = mix(c, banded, vCalm);
  }

  // RIME on the windward facets and the NEW SNOW dusting what lies back.
  float windward = clamp(-dot(F.xz, uRockWind), 0.0, 1.0);
  // Rime grows out into the wind off edges and ledges: a windward wall's
  // ledges (its beds' tops and the facets lying back) carry the most.
  float ledgeTop = wall ? smoothstep(0.78, 0.98, fl) * lam + smoothstep(0.15, 0.6, F.y) : 0.0;
  float rime = smoothstep(0.5, 0.9, windward + 0.25 * ledgeTop)
    * smoothstep(0.42, 0.78, 0.6 * rkSoft(P + 2.0, 1.7, px) + 0.6 * rkSoft(P, 6.7, px) + 0.25 * ledgeTop)
    * winter;
  float lies = smoothstep(0.25, 0.6, F.y);
  float dust = clamp(uFresh * 5.0, 0.0, 0.4) * (0.3 + 0.7 * patchy) * smoothstep(0.4, 0.75, rkSoft(P + 11.0, 0.48, px) + 0.3 * lies)
    * (0.35 + 0.65 * lies) * winter;
  // Read off a facet's own normal, so faded as the facets are calmed: one
  // facet in a few pixels white and the next bare would twinkle.
  // Dusted, never sheeted: broken where the rock pokes through.
  float cover2 = clamp((wall ? 0.6 : 0.45) * rime + dust, 0.0, 0.7) * (0.45 + 0.55 * patchy)
    * rkRock * (1.0 - 0.8 * vCalm);
  diffuseColor.rgb = mix(c, ${RIME_GLSL}, cover2);
  rkSlope *= 1.0 - cover2;
  rkHazeKeep = stHazeKeep(distance(P, cameraPosition));
}
`;
const STRATA_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  // The surface gradient (no tangents): the height's screen slope
  // \`rkSlope\` (worked out by hand) turned into a normal tipped off the
  // facet's.
  vec3 sp = -vViewPosition;
  vec3 sx = dFdx(sp);
  vec3 sy = dFdy(sp);
  vec3 r1 = cross(sy, normal);
  vec3 r2 = cross(normal, sx);
  float det = dot(sx, r1) * faceDirection;
  vec3 grad = sign(det) * (rkSlope.x * r1 + rkSlope.y * r2);
  normal = normalize(abs(det) * normal - grad);
}
`;
const CALM_NORMAL = /* glsl */ `
vec3 objectNormal = normalize(mix(normal, soft, rockCalm));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`;

/** THE TALUS'S STONES SUNK (`talus.ts`): each stone (`stone`: the
 * ground under it and its height, m) buried by the run's loose snow past
 * the ordinary (`uSnowDial`) and its new snow (`uFresh`), and sunk into
 * the snow over the last quarter of its reach (`uTalus.x`), so none pops
 * in or out as the lens comes and goes. */
const TALUS_HEAD = /* glsl */ `
attribute vec4 stone;
uniform vec4 uTalus;
uniform float uSnowDial;
uniform float uFresh;
`;
const TALUS_SINK = /* glsl */ `
#include <begin_vertex>
{
  float tlD = distance(stone.xyz, cameraPosition);
  // Sunk out over the reach's last two fifths, and wherever the stone is
  // under three pixels across (its radius at the frame's scale, a 720-line
  // screen's): a stone a pixel wide only twinkles.
  float tlPx = stone.w * projectionMatrix[1][1] * 360.0 / max(tlD, 1.0);
  float tlGone = max(smoothstep(uTalus.x * 0.6, uTalus.x, tlD), 1.0 - smoothstep(1.5, 3.0, tlPx));
  float tlSnow = clamp(0.3 * (uSnowDial - 1.0) + uFresh, -0.1 * stone.w, 1.5);
  transformed.y -= tlSnow + tlGone * stone.w * 1.2;
}
`;

/** AND PULLED TOWARD THE LENS, IN DEPTH ALONE: `PULL` m for every metre
 * past `PULL_FROM` it stands off, out to `PULL_MOST` m. The skin stands a
 * hand proud of the snow, but the depth buffer tells two surfaces apart
 * ever more coarsely the further they are (a step is about d² over the
 * near plane's 2²⁴: half a metre at a kilometre) and the snow under it is
 * drawn coarser too, so far out the two fight over the same pixels. Moved
 * along the ray to the eye, a corner stays on its pixel; only the depth
 * test changes, and the rock wins it against snow that close behind. */
const PULL = 0.004;
const PULL_FROM = 30;
const PULL_MOST = 12;
const PULL_GLSL = /* glsl */ `
#include <project_vertex>
{
  float rockD = length(mvPosition.xyz);
  float rockPull = clamp((rockD - ${PULL_FROM.toFixed(1)}) * ${PULL.toFixed(4)}, 0.0, ${PULL_MOST.toFixed(1)});
  gl_Position = projectionMatrix * vec4(mvPosition.xyz * (1.0 - rockPull / max(rockD, 1.0)), 1.0);
}
`;

/** The cut a tile `d` m off wants, given the one it has (`had`, or -1). */
export function cutOf(d: number, had: number, cuts: readonly Cut[] = CUTS): number {
  let k = cuts.findIndex((c) => d < c.out);
  if (had >= 0 && k !== had) {
    // Only past the margin: a coarser cut once `HYSTERESIS` beyond the
    // edge, a finer one once as far inside it.
    const edge = k > had ? cuts[had].out + HYSTERESIS : cuts[k].out - HYSTERESIS;
    if (k > had ? d < edge : d > edge) k = had;
  }
  return k;
}

export type Rocks = {
  readonly group: THREE.Group;
  /** Show what is within `reach` m of the lens, building what is new. */
  update(eye: THREE.Vector3, reach: number): void;
  /** The FOREST row moved: every tile is built again at the new cuts. */
  setLook(look: RockLook): void;
  dispose(): void;
};

type Tile = {
  readonly cx: number;
  readonly cz: number;
  /** Its first lattice column and row (`TILE` m a side). */
  readonly i: number;
  readonly j: number;
  /** The cliffs' rock walls whose middle is on it, built first. */
  readonly walls: CliffWall[];
  /** The rows of its lattice its building has reached, and the triangles
   * so far, at the cut `building`. */
  done: number;
  part: RockMesh | null;
  building: number;
  /** What is on screen, and its cut (-1 for none). */
  mesh: THREE.Mesh | null;
  cut: number;
  /** Built at `cut`, and nothing stands on it. */
  empty: boolean;
};

export function createRocks(level: Level, haze: HazeUniforms, look: RockLook): Rocks {
  let cuts = cutsOf(look);
  const group = new THREE.Group();
  group.name = "rocks";
  // WHAT THE ROCK HOLDS, for the rock eval lab (`make rock-eval`): every ms
  // spent building it, the tiles in reach still owed their cut, and the
  // triangles and bytes built. An instrument: nothing draws off it.
  const stats = { buildMs: 0, owed: 0, triangles: 0, bytes: 0 };
  group.userData.rockStats = stats;
  // And, for the same lab, every tile owed at the last lens built whole at
  // once, so a still is taken of the rock as it settles, never mid-build.
  let lastEye: THREE.Vector3 | null = null;
  let lastReach = 0;
  const band = regionLookOf(regionOf(level).id).rock;
  // The material's own uniforms: the beds (`strata-glsl.ts`), the wind the
  // rime is plastered by (where it blows toward, its length how hard) and
  // the summer.
  const wind = windAt(level, 0);
  const wl = Math.hypot(wind.x, wind.z) || 1;
  // Rime is a storm's, laid on whichever day: half of it on a calm one.
  const hard = 0.5 + 0.5 * Math.min(1, wind.speed / 12);
  const rockU = {
    ...strataUniforms(level, !!band),
    uRockWind: { value: new THREE.Vector2((wind.x / wl) * hard, (wind.z / wl) * hard) },
    uRockSummer: { value: summerShown() ? 1 : 0 },
    uRockStone: { value: new THREE.Vector3(...rockTone(band?.tone ?? [0.3, 0.3, 0.3])) },
  };
  const patch =
    (talus: boolean) =>
    (shader: THREE.WebGLProgramParametersWithUniforms): void => {
      PAST_THE_WALL(shader);
      Object.assign(shader.uniforms, rockU, talus ? talusU : {});
      let vs = (CALM_HEAD + (talus ? TALUS_HEAD : "") + shader.vertexShader)
        .replace("#include <beginnormal_vertex>", CALM_NORMAL)
        .replace("#include <color_vertex>", CALM_COLOUR)
        .replace("#include <project_vertex>", PULL_GLSL);
      if (talus) vs = vs.replace("#include <begin_vertex>", TALUS_SINK);
      shader.vertexShader = vs;
      shader.fragmentShader = (STRATA_FRAG_HEAD + shader.fragmentShader)
        .replace("#include <color_fragment>", STRATA_COLOUR)
        .replace("#include <normal_fragment_maps>", STRATA_NORMAL);
    };
  const stone = (): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const material = hazeMaterial(stone(), haze, "rock", patch(false));
  // THE TALUS under the walls (`talus.ts`): the same material, its stones
  // sunk by the snow and with the distance.
  const talusU = { uTalus: { value: new THREE.Vector4(look.talus.reach, 0, 0, 0) } };
  const talusMaterial = band ? hazeMaterial(stone(), haze, "talus", patch(true)) : null;
  const talus =
    band && talusMaterial
      ? createTalus(level, band.tone, talusMaterial, talusU.uTalus, look)
      : null;
  if (talus) group.add(talus.mesh);
  group.userData.talusStats = talus?.stats;
  // THE SKIN'S PROGRAM, LINKED BEHIND THE CARD: its tiles are built as the
  // lens nears a wall, and the first one linked the program then, a frame
  // stalled mid-run. A triangle of no area carrying the tiles' attributes,
  // bound far under the map so the frustum always drops it, is what the
  // load's compile and warm draw meet instead.
  let warm: THREE.Mesh | null = null;
  if (band) {
    const g = new THREE.BufferGeometry();
    for (const [name, size] of SKIN_ATTRIBUTES) {
      g.setAttribute(name, new THREE.Float32BufferAttribute(new Float32Array(3 * size), size));
    }
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -1e7, 0), 1);
    warm = new THREE.Mesh(g, material);
    warm.matrixAutoUpdate = false;
    warm.name = "rock-warm";
    group.add(warm);
  }
  const cols = band ? Math.ceil(level.size / TILE) : 0;
  const tiles: Tile[] = [];
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      tiles.push({
        cx: (i + 0.5) * TILE,
        cz: (j + 0.5) * TILE,
        i,
        j,
        walls: [],
        done: 0,
        part: null,
        building: -1,
        mesh: null,
        cut: -1,
        empty: false,
      });
    }
  }
  const seed = rockHash(level.seed, SKIN_SALT);
  if (band) {
    for (const w of cliffWalls(level)) {
      const i = Math.min(cols - 1, Math.max(0, Math.floor(w.x / TILE)));
      const j = Math.min(cols - 1, Math.max(0, Math.floor(w.z / TILE)));
      tiles[j * cols + i].walls.push(w);
    }
  }
  /** The lattice rows a step builds before it looks at the clock. */
  const BATCH = 4;
  // Near the lens always the physics' own lattice (`cutsOf`): the rock a
  // body meets is the rock drawn, whatever the picture costs (a cheaper
  // lattice stands up to metres off it).
  const cellOf = (k: number): number => cuts[k].cell;

  /** Build a few more rows of `t` at cut `k`; true when it is whole. */
  const step = (t: Tile, k: number): boolean => {
    const t0 = performance.now();
    const whole = build(t, k);
    stats.buildMs += performance.now() - t0;
    return whole;
  };
  const build = (t: Tile, k: number): boolean => {
    if (!t.part || t.building !== k) {
      t.part = rockMesh();
      t.building = k;
      t.done = 0;
      for (const w of t.walls) buildWall(t.part, w, band!.tone, level);
    }
    const part = t.part;
    const cell = cellOf(k);
    const n = Math.round(TILE / cell);
    const end = Math.min(n, t.done + BATCH);
    const i0 = t.i * n;
    buildSkin(
      part,
      level,
      band!.tone,
      seed,
      cell,
      i0,
      t.j * n + t.done,
      i0 + n,
      t.j * n + end,
      cuts[k].every,
    );
    t.done = end;
    if (t.done < n) return false;
    smoothSkin(part);
    t.part = null;
    t.done = 0;
    // The cut it replaces goes as the new one arrives.
    const old = t.mesh;
    if (old) {
      forget(old);
      group.remove(old);
      old.geometry.dispose();
      t.mesh = null;
    }
    t.cut = k;
    t.empty = part.pos.length === 0;
    if (t.empty) return true;
    const g = new THREE.BufferGeometry();
    const arrays = [part.pos, part.nrm, part.col, part.soft, part.calm, part.bed];
    SKIN_ATTRIBUTES.forEach(([name, size], i) => {
      g.setAttribute(name, new THREE.Float32BufferAttribute(arrays[i], size));
    });
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.userData.bytes =
      (part.pos.length +
        part.nrm.length +
        part.col.length +
        part.soft.length +
        part.calm.length +
        part.bed.length) *
      4;
    stats.triangles += part.pos.length / 9;
    stats.bytes += mesh.userData.bytes;
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    t.mesh = mesh;
    return true;
  };
  const forget = (m: THREE.Mesh): void => {
    stats.triangles -= (m.geometry.getAttribute("position")?.count ?? 0) / 3;
    stats.bytes -= (m.userData.bytes as number | undefined) ?? 0;
  };
  const drop = (t: Tile): void => {
    t.empty = false;
    t.done = 0;
    t.part = null;
    t.building = -1;
    t.cut = -1;
    if (!t.mesh) return;
    forget(t.mesh);
    group.remove(t.mesh);
    t.mesh.geometry.dispose();
    t.mesh = null;
  };

  group.userData.rockSettle = (): void => {
    if (!lastEye) return;
    const half = TILE / 2;
    for (const t of tiles) {
      const dx = Math.max(0, Math.abs(lastEye.x - t.cx) - half);
      const dz = Math.max(0, Math.abs(lastEye.z - t.cz) - half);
      const d2 = dx * dx + dz * dz;
      if (d2 >= lastReach * lastReach) continue;
      const k = cutOf(Math.sqrt(d2), t.cut, cuts);
      if (k === t.cut) continue;
      while (!step(t, k));
      if (t.mesh) t.mesh.visible = true;
    }
    talus?.settle();
    stats.owed = 0;
  };

  return {
    group,
    update(eye, reach) {
      lastEye = eye.clone();
      lastReach = reach;
      // The tile's corner nearest the lens, so a tile is shown as soon as
      // any of it is in reach.
      const half = TILE / 2;
      let next: Tile | null = null;
      let nextK = 0;
      let nextD2 = Infinity;
      let owed = 0;
      for (const t of tiles) {
        const dx = Math.max(0, Math.abs(eye.x - t.cx) - half);
        const dz = Math.max(0, Math.abs(eye.z - t.cz) - half);
        const d2 = dx * dx + dz * dz;
        const near = d2 < reach * reach;
        const k = near ? cutOf(Math.sqrt(d2), t.cut, cuts) : -1;
        if (near && k !== t.cut) {
          owed++;
          // A tile with nothing on screen yet, or one that close, is built
          // whole now; one changing cut keeps its old one meanwhile.
          if (d2 < NOW * NOW && (t.cut < 0 || k < t.cut)) while (!step(t, k));
          else if (d2 < nextD2) {
            next = t;
            nextK = k;
            nextD2 = d2;
          }
        }
        if (t.mesh) t.mesh.visible = near;
        // Well out of reach, its triangles are let go, so a long ride never
        // holds the whole mountain's rock.
        if ((t.mesh || t.part) && d2 > (reach + KEEP) ** 2) drop(t);
      }
      // The nearest tile still owed, a slice of a frame's worth of it.
      if (next) {
        const until = performance.now() + SLICE;
        while (!step(next, nextK) && performance.now() < until);
        if (next.mesh) next.mesh.visible = true;
      }
      stats.owed = owed;
      talus?.update(eye);
    },
    setLook(next) {
      talus?.setLook(next);
      const was = cuts;
      cuts = cutsOf(next);
      if (cuts.every((c, k) => c.out === was[k].out && c.cell === was[k].cell)) return;
      for (const t of tiles) drop(t);
    },
    dispose() {
      warm?.geometry.dispose();
      for (const t of tiles) drop(t);
      material.dispose();
      talus?.dispose();
      talusMaterial?.dispose();
    },
  };
}
