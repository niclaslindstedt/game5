// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES, SHAPED ON THE CARD — the vertex shader every tree of the
// shader-shaped forest is built by (`forest.ts`). A template's corner
// (`tree-templates.ts`) says only what it is; this reads the tree's four
// texels (its matrix, girth, variant and exposure — `tree-table.ts`), its
// variant's row (its silhouette, its form's knobs, its kind's paint) and a
// HASH OF THE TREE ITSELF, and puts the corner where that tree has it. So
// no two trees on the mountain are the same tree: the tiers' count, every
// bough's angle, reach, droop and snow, the pads, the whorls, the sprays
// and the snow load are each tree's own, where a mesh a variant gave every
// tree of a variant one shape.
//
// It ports the code-built shapes (`tree-shapes.ts`) form for form — the
// conifer's drooping skirts with their white caps and dark undersides, the
// pine's pads on bare stems, the larch's and the snag's whorls of bare
// arms, the broadleaf's stems, limbs and sprays — and adds what a mesh a
// variant could not:
//
// - THE SNOW LOAD IS THE TREE'S: some laden and bowed (the boughs droop
//   the more the more snow they carry), some shaken nearly bare.
// - EXPOSURE: a tree near the tree line is flagged to the LEE of the
//   map's wind (its boughs on the side the air goes) and carries less snow.
// - THE WIND, in the same shader: the trunk bends with the gusts, the
//   tiers' rims bob — a laden bough the stiffer — and the casters bend
//   with it, so the shadows never swim off their trees.
//
// The face normals come from the fragment's own derivatives
// (`TREE_NORMAL`), blended with the shaper's volume normal by the part's
// facet share, as the code-built shapes blend them: no corner needs to know
// its triangle's other corners.
//
// THE FAR BAND (`FAR_VERTEX` / `FAR_FRAGMENT`) has no mesh at all: one quad
// stood up round each tree, bounding it from wherever the lens is — beside
// it or over it — and the tree RAY-CAST inside it against the same
// silhouette its variant has near (the tiers and their notches, the pine's
// crown on its stem, the larch's and the broadleaf's lattice), shaded
// with the same snow, so a far tree is two triangles and still a tree from
// the air.

import * as THREE from "three";

import { TREE_TEX_W } from "./tree-table.ts";
import { SNOW, SNOW_SHADE } from "./tree-shapes.ts";
import { BREAST, FLARE, TRUNK_REF } from "./tree-mesh.ts";

const vec3Of = (c: THREE.Color): string =>
  `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`;

/** What every tree shader — the bands', the casters', the far quads' —
 * reads: the tables, the wind, the hashes and the tree's frame. */
export const TREE_TABLES = /* glsl */ `
uniform highp sampler2D uTrees;
uniform highp sampler2D uVariants;
// Where the air goes (a unit vector in plan), its speed m/s and the clock.
uniform vec4 uTreeWind;
// Where the map's mean wind goes (a unit vector in plan): the lee every
// exposed tree is flagged toward, which never swings with the gusts.
uniform vec2 uTreeLee;
const int TREE_TEX_W = ${TREE_TEX_W};
const float TRUNK_REF = ${TRUNK_REF.toFixed(4)};
const float BREAST = ${BREAST.toFixed(4)};
const float FLARE = ${FLARE.toFixed(4)};
const float TAU = 6.2831853;
const vec3 SNOW = ${vec3Of(SNOW)};
const vec3 SNOW_SHADE = ${vec3Of(SNOW_SHADE)};

uint treeHashU(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u;
  return x;
}
/** A hash of the tree and a key, 0..1. */
float tj(uint s, int a) {
  return float(treeHashU(s ^ treeHashU(uint(a) * 0x9e3779b9u + 0x632be5abu)) >> 8u) * (1.0 / 16777216.0);
}
vec4 treeAt(int id, int k) {
  int t = id * 4 + k;
  return texelFetch(uTrees, ivec2(t % TREE_TEX_W, t / TREE_TEX_W), 0);
}
vec4 rowAt(int row, int k) { return texelFetch(uVariants, ivec2(k, row), 0); }
float trunkProfile(float y, float top, float tip) {
  if (y <= BREAST) return FLARE + (1.0 - FLARE) * (y / BREAST);
  float u = min(1.0, (y - BREAST) / max(1e-6, top - BREAST));
  return 1.0 + (tip - 1.0) * pow(u, 0.9);
}

// What the shaper says of the corner's SNOW, for the fragment to lay it
// (\`TREE_SNOW\`): x how far out along its part snow can lie (1 at the trunk,
// 0 at the tip), y how heavily the part is loaded (0 none).
vec2 tSnow;

struct TreeFrame {
  mat3 m;        // rotation × stretch: the unit frame to the world
  vec3 foot;
  vec2 girth;
  int row;
  float exposure;
  uint seed;
  float leeAngle; // the lee's bearing in the tree's own frame
  float height;
  float load;     // the tree's own share of the region's snow load
  float tone;     // its needles a shade lighter or darker
  float seedA;    // a turn of its own, rad
};

TreeFrame treeFrame(int id) {
  TreeFrame T;
  vec4 r0 = treeAt(id, 0);
  vec4 r1 = treeAt(id, 1);
  vec4 r2 = treeAt(id, 2);
  vec4 r3 = treeAt(id, 3);
  T.m = mat3(r0.x, r1.x, r2.x, r0.y, r1.y, r2.y, r0.z, r1.z, r2.z);
  T.foot = vec3(r0.w, r1.w, r2.w);
  T.girth = r3.xy;
  T.row = int(r3.z + 0.5);
  T.exposure = r3.w;
  T.seed = treeHashU(uint(int(floor(T.foot.x * 16.0)) * 73856093) ^ treeHashU(uint(int(floor(T.foot.z * 16.0)) * 19349663)));
  vec3 ax = normalize(T.m[0]);
  vec3 az = normalize(T.m[2]);
  vec3 w = vec3(uTreeLee.x, 0.0, uTreeLee.y);
  T.leeAngle = atan(dot(az, w), dot(ax, w));
  T.height = length(T.m[1]);
  // Some laden and bowed, some shaken nearly bare — and the exposed ones
  // stripped by the wind.
  float h = tj(T.seed, 90);
  T.load = clamp(0.25 + 1.15 * h * h * (3.0 - 2.0 * h), 0.12, 1.35) * (1.0 - 0.45 * T.exposure);
  T.tone = 0.84 + 0.3 * tj(T.seed, 91);
  T.seedA = tj(T.seed, 2) * TAU;
  return T;
}

/** The normal's way through a matrix: its cofactors (the inverse
 * transpose, up to a scale the normalising drops). */
mat3 treeCofactor(mat3 m) {
  return mat3(cross(m[1], m[2]), cross(m[2], m[0]), cross(m[0], m[1]));
}

/** The tree's corner out into the world, bent by the wind. \`bob\` is how
 * much the part flutters (a bough's rim; 0 the trunk). */
vec3 treeWorld(TreeFrame T, vec3 p, float bob) {
  vec3 world = T.m * p + T.foot;
  float H = max(1.0, T.height);
  float f = clamp(p.y, 0.0, 1.2);
  float bend = f * f;
  float ph = float(T.seed & 1023u) * 0.0061;
  float t = uTreeWind.w;
  float speed = uTreeWind.z;
  // A slow sway on the gusts, a laden tree the stiffer.
  float gust = 0.55 + 0.45 * sin(t * 0.83 + ph) * sin(t * 0.31 + ph * 1.7);
  float stiff = 1.0 - 0.45 * clamp(T.load, 0.0, 1.0);
  float amp = speed * 0.0022 * H * gust * stiff;
  world.xz += uTreeWind.xy * amp * bend;
  world.y -= amp * amp * bend * 0.5 / H;
  // The boughs' flutter, quicker and smaller.
  world.y += bob * sin(t * 2.6 + ph * 3.0 + p.y * 11.0) * speed * 0.004 * H * stiff;
  return world;
}

/** A tube's way round its axis, as \`Shape.tube\` turns it. */
vec3 tubeDir(vec3 w, float t) {
  vec3 u0 = abs(w.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 u = normalize(cross(w, u0));
  vec3 v = cross(w, u);
  return u * cos(t) + v * sin(t);
}

/** A two-sided fin's corner \`k\` (0 root-left, 1 root-right, 2 tip-left,
 * 3 tip-right; 4.. the same, the face beneath), as \`Shape.fin\` builds it. */
void finCorner(vec3 root, vec3 tip, float w, float fan, float roll, int k, out vec3 p, out vec3 n) {
  vec2 d = tip.xz - root.xz;
  float l = max(length(d), 1e-6);
  vec3 sv = vec3(-d.y / l * w * cos(roll), w * sin(roll) / 4.0, d.x / l * w * cos(roll));
  int c = k - (k / 4) * 4;
  p = c == 0 ? root + sv : c == 1 ? root - sv : c == 2 ? tip + sv * fan : tip - sv * fan - vec3(0.0, 0.004, 0.0);
  vec2 hd = d / l * 0.5;
  n = k >= 4 ? vec3(hd.x, -0.2, hd.y) : vec3(hd.x, 0.85, hd.y);
}

/** A crown in leaf's radius at share \`f\` of the height (\`crownAt\`). */
float leafRadius(vec4 v0, int form, float dome, float f) {
  if (f < v0.x || f > v0.y) return 0.0;
  float u = (f - v0.x) / max(1e-6, v0.y - v0.x);
  if (form == 3) return v0.z * pow(sin(3.14159 * min(1.0, u * 0.9 + 0.1)), 0.8 - 0.5 * dome);
  return v0.z * pow(max(0.0, 1.0 - u * 0.95), v0.w);
}
`;

/** `TREE_TABLES` with the instance's and the corner's attributes: what
 * every vertex shader of the bands and the casters reads. */
export const TREE_COMMON = /* glsl */ `
attribute vec3 tree;
attribute vec4 tv;
${TREE_TABLES}
`;

/** A conifer: a stack of drooping skirts. */
const CONIFER = /* glsl */ `
float jointY(int j, float top) {
#if TPL_JOINTS >= 4
  return j == 0 ? 0.0 : j == 1 ? BREAST : j == 2 ? BREAST + (top - BREAST) * 0.45 : top;
#elif TPL_JOINTS == 3
  return j == 0 ? 0.0 : j == 1 ? BREAST : top;
#else
  return j == 0 ? 0.0 : top;
#endif
}
void shapeTree(TreeFrame T, out vec3 p, out vec3 n, out vec3 c, out float facet, out float bob) {
  int row = T.row;
  vec4 v0 = rowAt(row, 0);
  vec4 v2 = rowAt(row, 2);
  vec4 v3 = rowAt(row, 3);
  vec4 v4 = rowAt(row, 4);
  float base = v0.x, top = v0.y, width = v0.z, taper = v0.w;
  float lean = rowAt(row, 1).y;
  float span = max(1e-3, top - base);
  float nod = v4.x;
  int role = int(tv.w + 0.5);
  bob = 0.0;
  tSnow = vec2(0.0);
  facet = 0.75;
  if (role == 0) {
    int j = int(tv.x + 0.5);
    int k = int(tv.y + 0.5);
    float trunkTop = min(0.8, base + 0.45);
    float y = jointY(j, trunkTop);
    float r = TRUNK_REF * trunkProfile(y, trunkTop, 0.35);
    float a = float(k) / float(TPL_TSIDES) * TAU;
    vec2 d = vec2(cos(a), -sin(a));
    float ox = nod * pow(max(0.0, (y - base) / span), 3.0);
    p = vec3(ox + d.x * r * T.girth.x, y, d.y * r * T.girth.y);
    n = vec3(d.x, 0.1, d.y);
    c = rowAt(row, 8).rgb * (0.75 + 0.35 * min(1.0, y * 3.0));
    facet = 0.25;
    p.x += p.y * lean * 4.0;
    return;
  }
#if TPL_FULL
  if (role == 7) {
    // The dead spire a broken top leaves.
    if (v4.w <= 0.0) { p = vec3(0.0); n = vec3(0.0, 1.0, 0.0); c = vec3(0.0); return; }
    int e = int(tv.z + 0.5);
    float a = float(int(tv.y + 0.5)) / 4.0 * TAU;
    vec3 a0 = vec3(0.0, top - 0.04, 0.0);
    vec3 a1 = vec3(0.01, top + v4.w, 0.0);
    vec3 dir = tubeDir(normalize(a1 - a0), a);
    p = (e == 0 ? a0 : a1) + dir * (e == 0 ? 0.018 : 0.004);
    n = dir + vec3(0.0, 0.1, 0.0);
    c = e == 0 ? rowAt(row, 8).rgb : rowAt(row, 9).rgb;
    facet = 0.25;
    p.x += p.y * lean * 4.0;
    return;
  }
#endif
  vec4 pn = rowAt(row, 6);
  vec3 needle = pn.rgb * T.tone;
  float load = pn.a;
  vec3 dark = rowAt(row, 7).rgb * T.tone;
  float snow = clamp(v2.w * load * T.load, 0.0, 1.0);
  int t = int(tv.x + 0.5);
  int pi = int(tv.y + 0.5);
  int fi = int(tv.z + 0.5);
  int count = clamp(int(floor(v2.x * TPL_SHARE + tj(T.seed, 3) * 1.4 - 0.2)), TPL_TIER_MIN, TPL_TIERS);
  bool gone = t >= count;
#if TPL_FULL
  float idx = floor(float(t) * v2.x / float(count) + 0.5);
  if (mod(floor(rowAt(row, 5).y / exp2(idx)), 2.0) > 0.5) gone = true;
#endif
  if (gone) { p = vec3(0.0); n = vec3(0.0, 1.0, 0.0); c = vec3(0.0); return; }
  float fc = float(count);
  float u = float(t) / fc;
  float bottom = base + span * u * 0.92;
  float ttop = min(top, bottom + span * (1.9 / fc));
  float radius = pow(max(0.0, 1.0 - u * 0.95), taper) * (1.0 - 0.08 * u) * width;
  if (t == 0) radius *= 1.0 + v3.w;
  if (v3.z > 0.0 && u > 0.55) radius = max(radius, v3.z * 0.55 * width);
  radius *= 1.0 + v4.y * 1.4 * smoothstep(0.62, 0.9, u);
  // Every tree a little broader or slimmer tier to tier.
  radius *= 0.92 + 0.16 * tj(T.seed, 200 + t);
  // A heavily laden tree folds its boughs down onto the ones below — a
  // closed umbrella, narrower than the same tree shaken bare.
  radius *= 1.0 - 0.22 * snow * snow;
  float twist = float(t) * 0.9 + T.seedA;
  float ox = nod * pow(max(0.0, (bottom - base) / span), 3.0);
  float S = float(TPL_SIDES);
  int key = (t * 17 + pi) * 8;
  float a = ((float(pi) + (tj(T.seed, key) - 0.5) * 0.5) / S) * TAU + twist;
  float jag = (pi - (pi / 2) * 2 == 0) ? 1.0 : 0.7 + tj(T.seed, key + 1) * 0.12;
  // Flagged to the lee of the map's wind, the more the more exposed.
  float flag = clamp(v3.y + T.exposure * 0.55, 0.0, 0.9);
  float lee = 1.0 + flag * cos(a - T.leeAngle) * 0.9 - flag * 0.25;
  float ragged = 1.0 + v4.z * (tj(T.seed, key + 2) - 0.5) * 0.9;
  float r = radius * jag * (0.9 + tj(T.seed, key + 3) * 0.2) * max(0.15, lee) * ragged;
  // A laden bough droops the further.
  float droop = (ttop - bottom) * (0.12 + 0.1 * tj(T.seed, key + 4)) * jag * v3.x * (0.65 + 0.7 * snow);
  vec2 d = vec2(cos(a), sin(a));
  vec3 q;
  float up;
  if (role == 1) { q = vec3(nod * pow(max(0.0, (ttop - base) / span), 3.0), ttop, 0.0); up = 1.0; }
  else if (role == 5) { q = vec3(ox, bottom + (ttop - bottom) * 0.15, 0.0); up = -0.3; }
  else if (role == 2 || role == 3) {
    q = vec3(ox + d.x * r * 0.55, bottom + (ttop - bottom) * 0.5, d.y * r * 0.55);
    up = role == 2 ? 0.9 : 0.6;
  } else {
    q = vec3(ox + d.x * r, bottom - droop, d.y * r);
    up = role == 4 ? 0.25 : -0.1;
    bob = r;
  }
  vec2 out2 = q.xz - vec2(ox, 0.0);
  float ol = length(out2);
  out2 = ol > 1e-6 ? out2 / ol * 0.65 : vec2(0.0);
  n = vec3(out2.x, up, out2.y);
  // FLAT COLOUR a face at a time: the snow on a tier's crown and along the
  // tops of some boughs, the rest needle green (every other bough a shade
  // darker), the underside the dark inside of the tree.
  float bough = snow * (0.7 + 0.6 * tj(T.seed, 6000 + t * 17 + fi));
  if (role == 1 || role == 2) {
    c = needle;
    tSnow = vec2(role == 1 ? 1.0 : 0.72, bough);
  } else if (role == 3 || role == 4) {
    c = fi - (fi / 2) * 2 == 0 ? needle : mix(dark, needle, 0.55);
    tSnow = vec2(role == 3 ? 0.72 : 0.0, bough);
  } else {
    c = dark;
  }
  p = q;
  p.x += p.y * lean * 4.0;
}
`;

/** A pine: bare stems under pads of needles. */
const PINE = /* glsl */ `
float kinkX(vec4 v3, float y) {
  return v3.x > 0.0 && y > v3.x ? min(1.0, (y - v3.x) / 0.12) * v3.y : 0.0;
}
vec2 stemX(vec4 v3, vec4 v4, int stems, int st, float seedA, float y) {
  if (stems == 1) return vec2(kinkX(v3, y), 0.0);
  float a = float(st) * 2.4 + seedA;
  float tilt = v4.x * (st == 0 ? 0.3 : 1.0) * 1.6 * y;
  return vec2(kinkX(v3, y) + cos(a) * tilt, sin(a) * tilt);
}
void shapeTree(TreeFrame T, out vec3 p, out vec3 n, out vec3 c, out float facet, out float bob) {
  int row = T.row;
  vec4 v0 = rowAt(row, 0);
  vec4 v2 = rowAt(row, 2);
  vec4 v3 = rowAt(row, 3);
  vec4 v4 = rowAt(row, 4);
  float base = v0.x, top = v0.y, width = v0.z;
  float lean = rowAt(row, 1).y;
  int role = int(tv.w + 0.5);
  int stems = clamp(int(v3.w + 0.5), 1, TPL_STEMS);
  vec3 bark = rowAt(row, 8).rgb;
  vec3 upper = rowAt(row, 9).rgb;
  bob = 0.0;
  tSnow = vec2(0.0);
  facet = 0.75;
  if (role == 0) {
    int j = int(tv.x + 0.5);
    int k = int(tv.y + 0.5);
    int st = int(tv.z + 0.5);
    if (st >= stems) { p = vec3(0.0); n = vec3(0.0, 1.0, 0.0); c = vec3(0.0); return; }
    float reach = st == 0 ? 0.95 : 0.8 + 0.1 * tj(T.seed, 40 + st);
    float fj = float(j);
#if TPL_JOINTS >= 4
    float y = j == 0 ? 0.0 : BREAST + (reach - BREAST) * (fj - 1.0) / float(TPL_JOINTS - 2);
#else
    float y = reach * fj / float(TPL_JOINTS - 1);
#endif
    float share = stems == 1 ? 1.0 : stems > 3 ? 0.6 : 0.75;
    float r = TRUNK_REF * share * trunkProfile(y, reach, 0.3);
    vec2 ax = stemX(v3, v4, stems, st, T.seedA, y);
    float slope = stems == 1 ? 0.0 : v4.x * (st == 0 ? 0.3 : 1.0) * 1.6;
    float gw = 1.0 / (1.0 + slope * slope);
    float a = float(k) / float(TPL_TSIDES) * TAU;
    vec2 d = vec2(cos(a), -sin(a)) * r;
    d *= mix(vec2(1.0), T.girth, gw);
    p = vec3(ax.x + d.x, y, ax.y + d.y);
    n = vec3(cos(a), 0.1, -sin(a));
    c = mix(bark, upper, clamp((y - 0.35) / 0.3, 0.0, 1.0));
    facet = 0.25;
    p.x += p.y * lean * 4.0;
    return;
  }
  vec4 pn = rowAt(row, 6);
  vec3 needle = pn.rgb * T.tone;
  float load = pn.a;
  vec3 dark = rowAt(row, 7).rgb * T.tone;
  float snow = clamp(v2.w * load * T.load, 0.0, 1.0);
  float thick = v2.z;
  float young = v3.z;
  float layers = v4.y;
  int i = int(tv.x + 0.5);
  int count = clamp(int(ceil(v2.x * TPL_SHARE + (tj(T.seed, 3) - 0.5) * 1.6)), min(3, TPL_PADS), TPL_PADS);
  if (i >= count) { p = vec3(0.0); n = vec3(0.0, 1.0, 0.0); c = vec3(0.0); return; }
  int st = i - (i / stems) * stems;
  float u = count == 1 ? 0.5 : float(i) / float(count - 1);
  int k = 100 + i * 13;
  float y = base + (top - base - thick) * (0.08 + 0.92 * u);
  float a = float(i) * 2.39996 + T.seedA;
  bool topPad = i == count - 1;
  float reach = topPad ? 0.05 : v2.y * width * (0.35 + 0.65 * tj(T.seed, k)) * (1.0 - young * u * 0.8);
  if (layers > 0.0 && !topPad) {
    float per = max(1.0, ceil(float(count - 1) / layers));
    float layer = floor(float(i) / per);
    float lu = layers <= 1.0 ? 0.5 : layer / (layers - 1.0);
    y = base + (top - base - thick) * (0.05 + 0.8 * lu);
    a = (mod(float(i), per) / per) * TAU + layer * 1.1 + T.seedA;
    reach = v2.y * width * (0.95 - 0.55 * lu) * (0.85 + 0.3 * tj(T.seed, k));
  }
  vec2 s = stemX(v3, v4, stems, st, T.seedA, y);
  vec2 cen = s + vec2(cos(a), sin(a)) * reach;
  float pr = (0.4 + 0.22 * tj(T.seed, k + 1)) * width * (1.0 - young * (u * 0.7 - 0.25)) *
    (stems > 1 ? 0.8 : 1.0) * sqrt(v2.x / float(count)) * 0.9;
#if TPL_FULL
  if (role == 7) {
    if (topPad) { p = vec3(0.0); n = vec3(0.0, 1.0, 0.0); c = vec3(0.0); return; }
    int e = int(tv.z + 0.5);
    vec3 a0 = vec3(s.x, y - thick * 0.6, s.y);
    vec3 a1 = vec3(cen.x, y, cen.y);
    vec3 dir = tubeDir(normalize(a1 - a0), float(int(tv.y + 0.5)) / 3.0 * TAU);
    p = (e == 0 ? a0 : a1) + dir * (e == 0 ? 0.02 : 0.01);
    n = dir + vec3(0.0, 0.1, 0.0);
    c = e == 0 ? bark : upper;
    facet = 0.25;
    p.x += p.y * lean * 4.0;
    return;
  }
#endif
  int j = int(tv.y + 0.5);
  int fi = int(tv.z + 0.5);
  float S = float(TPL_SIDES);
  float ta = (float(j) / S) * TAU + tj(T.seed, k + 20 + j) * 0.4;
  float r = pr * (0.75 + 0.35 * tj(T.seed, k + 40 + j));
  vec2 dd = vec2(cos(ta), sin(ta));
  vec3 rim = vec3(cen.x + dd.x * r, y + thick * 0.25 * tj(T.seed, k + 60 + j), cen.y + dd.y * r);
  vec3 inner = vec3(cen.x + dd.x * r * 0.45, y + thick * 0.9, cen.y + dd.y * r * 0.45);
  float padLoad = snow * (0.6 + 0.8 * tj(T.seed, k + 9));
  vec3 cap = needle;
  vec3 edge = fi - (fi / 2) * 2 == 1 ? needle : mix(dark, needle, 0.5);
  vec3 q;
  if (role == 1) { q = vec3(cen.x, y + thick, cen.y); n = vec3(0.0, 1.0, 0.0); c = cap; tSnow = vec2(1.0, padLoad); }
  else if (role == 2) { q = inner; n = vec3(q.x - cen.x, 1.2, q.z - cen.y); c = cap; tSnow = vec2(0.8, padLoad); }
  else if (role == 3) { q = inner; n = vec3(q.x - cen.x, 0.8, q.z - cen.y); c = edge; tSnow = vec2(0.6, padLoad); }
  else if (role == 4) {
    q = rim;
#if TPL_SKETCH
    n = vec3(q.x - cen.x, 0.6, q.z - cen.y); c = cap; tSnow = vec2(0.2, padLoad);
#else
    n = vec3(q.x - cen.x, 0.2, q.z - cen.y); c = edge;
#endif
    bob = r;
  }
  else if (role == 5) { q = vec3(cen.x, y - thick * 0.35, cen.y); n = vec3(0.0, -1.0, 0.0); c = dark; }
  else { q = rim; n = vec3(q.x - cen.x, -0.4, q.z - cen.y); c = dark; bob = r; }
  p = q;
  p.x += p.y * lean * 4.0;
}
`;

/** A summer crown in leaf, as \`leafCrown\` builds it. */
const LEAF = /* glsl */ `
#if TPL_LEAF
void leafCorner(TreeFrame T, vec4 v0, int form, float dome, float fill, out vec3 p, out vec3 n, out vec3 c) {
  int k = int(tv.x + 0.5 + 1.0) - 1;
  int j = int(tv.y + 0.5);
  int s = int(tv.z + 0.5);
  int rings = TPL_RINGS;
  float span = v0.y - v0.x;
  float lo = v0.x + span * 0.08;
  float hi = v0.y - span * 0.06;
  vec3 leaf = rowAt(T.row, 12).rgb;
  float shade = (0.72 + 0.3 * float(clamp(k, 0, rings)) / float(rings)) * (0.85 + 0.3 * tj(T.seed, 900 + k * 17 + s));
  if (k < 0) { p = vec3(0.0, v0.x, 0.0); n = vec3(0.0, -1.0, 0.0); c = leaf * 0.55; return; }
  if (k >= rings) { p = vec3(0.0, v0.y, 0.0); n = vec3(0.0, 1.0, 0.0); c = leaf * shade; return; }
  float f = lo + (hi - lo) * float(k) / float(rings - 1);
  float r = max(0.04, leafRadius(v0, form, dome, f)) * fill;
  float a = float(j) / float(TPL_RSIDES) * TAU + float(k) * 0.7 + T.seedA;
  float lump = 0.78 + 0.38 * tj(T.seed, 1000 + k * 13 + j);
  p = vec3(cos(a) * r * lump, f + (tj(T.seed, 1100 + k * 7 + j * 3) - 0.5) * span * 0.05, sin(a) * r * lump);
  n = s >= 200 ? vec3(0.0, -1.0, 0.0) : s >= 100 ? vec3(0.0, 1.0, 0.0) : vec3(p.x, 0.0, p.z);
  c = s >= 200 ? leaf * 0.55 : leaf * shade;
}
#endif
`;

/** A larch in winter, or a snag: whorls of bare arms on a trunk. */
const LARCH = /* glsl */ `
void shapeTree(TreeFrame T, out vec3 p, out vec3 n, out vec3 c, out float facet, out float bob) {
  int row = T.row;
  vec4 v0 = rowAt(row, 0);
  vec4 v2 = rowAt(row, 2);
  float base = v0.x, top = v0.y, width = v0.z, taper = v0.w;
  float lean = rowAt(row, 1).y;
  bool dead = rowAt(row, 3).x > 0.5;
  vec3 bark = rowAt(row, 8).rgb;
  vec3 twigs = rowAt(row, 10).rgb * T.tone;
  float load = rowAt(row, 6).a;
  int role = int(tv.w + 0.5);
  bob = 0.0;
  tSnow = vec2(0.0);
  facet = 0.4;
  if (role == 0) {
    int j = int(tv.x + 0.5);
    int k = int(tv.y + 0.5);
#if TPL_JOINTS >= 4
    float y = j == 0 ? 0.0 : j == 1 ? BREAST : j == 2 ? BREAST + (top - BREAST) * 0.45 : top;
#elif TPL_JOINTS == 3
    float y = j == 0 ? 0.0 : j == 1 ? BREAST : top;
#else
    float y = j == 0 ? 0.0 : top;
#endif
    float r = TRUNK_REF * (dead ? 1.1 : 1.0) * trunkProfile(y, top, dead ? 0.4 : 0.06);
    float a = float(k) / float(TPL_TSIDES) * TAU;
    vec2 d = vec2(cos(a), -sin(a));
    p = vec3(d.x * r * T.girth.x, y, d.y * r * T.girth.y);
    n = vec3(d.x, 0.1, d.y);
    c = mix(bark, twigs, min(1.0, y * 1.2));
    facet = 0.25;
    p.x += p.y * lean * 4.0;
    return;
  }
#if TPL_LEAF
  if (role == 4) {
    leafCorner(T, v0, 2, 0.0, 0.8, p, n, c);
    facet = 0.5;
    p.x += p.y * lean * 4.0;
    return;
  }
#endif
  int f = int(tv.x + 0.5);
  int kind = int(tv.z + 0.5);
  int w = f / TPL_ARMS;
  int arm = f - w * TPL_ARMS;
  int whorls = clamp(int(floor(v2.x * TPL_SHARE + tj(T.seed, 3) * 1.4 - 0.2)), min(TPL_WHORLS, 3), TPL_WHORLS);
  int arms = min(TPL_ARMS, int(v2.y + 0.5));
  int key = 300 + f * 11;
  bool gone = w >= whorls || arm >= arms || (dead && tj(T.seed, key + 9) < 0.3) || (kind == 1 && dead);
  if (gone) { p = vec3(0.0); n = vec3(0.0, 1.0, 0.0); c = vec3(0.0); return; }
  float droop = v2.z;
  float u = (float(w) + 0.5) / float(whorls);
  float y = base + (top - base) * u * 0.95;
  float r = width * pow(max(0.05, 1.0 - u * 0.95), taper);
  float t = float(arm) / float(arms) * TAU + float(w) * 1.3 + tj(T.seed, key) * 0.5 + T.seedA;
  float reach = r * (0.8 + 0.3 * tj(T.seed, key + 1)) * (dead ? 0.75 : 1.0);
  float tipY = y - droop * 0.06 - reach * 0.02 + (1.0 - droop) * 0.03;
  vec3 root = vec3(cos(t) * 0.02, y, sin(t) * 0.02);
  vec3 tip = vec3(cos(t) * reach, tipY, sin(t) * reach);
  float armLoad = u < 0.75 ? v2.w * load * T.load * (0.5 + tj(T.seed, key + 3)) : 0.0;
  vec3 topC = twigs;
  int k = int(tv.y + 0.5);
  int corner = k - (k / 4) * 4;
  if (kind == 0) {
    float full = TPL_FULL == 1 ? 1.2 : 1.5;
    finCorner(root, tip, (0.07 + 0.06 * (1.0 - u)) * (dead ? 1.3 : 1.0) * full, 0.3, 0.0, k, p, n);
    c = corner < 2 ? bark : (corner == 2 && k < 4 ? topC : twigs);
    if (k < 4) tSnow = vec2(corner < 2 ? 0.9 : 0.35, armLoad);
  } else {
    // A hanging spray off the arm: the larch's weeping twigs.
    vec3 mid = vec3(tip.x * 0.65, y + (tipY - y) * 0.65, tip.z * 0.65);
    float side = tj(T.seed, key + 6) - 0.5;
    vec3 hang = vec3(mid.x - mid.z * side * 0.8, mid.y - 0.03 - droop * 0.05, mid.z + mid.x * side * 0.8);
    finCorner(mid, hang, 0.008, 3.0, 0.0, k, p, n);
    c = corner == 2 && k < 4 ? topC : twigs;
  }
  bob = corner >= 2 ? reach : 0.0;
  p.x += p.y * lean * 4.0;
}
`;

/** A broadleaf in winter: stems, limbs, sprays. */
const BROAD = /* glsl */ `
struct Limb { vec3 root; vec3 elbow; vec3 tip; vec3 twig; float a; float bend; float side; float u; float reach; float r; };
vec3 along(vec2 dd, float y) { return vec3(dd.x * y * 0.25, y, dd.y * y * 0.25); }
Limb limbOf(TreeFrame T, vec4 v0, vec4 v3, vec4 v4, int stems, int st, int li, int limbs, float height, vec2 dd, float share) {
  Limb L;
  float u = (float(li) + 0.5) / float(limbs);
  int k = 400 + li * 3 + st * 101;
  float weep = v3.x, dome = v4.x;
  float a = float(li) * 2.39996 + T.seedA + float(st);
  float y = (v0.x + (0.78 - v0.x) * u) * height;
  float outline = pow(sin(3.14159 * min(1.0, u * 1.1 + 0.05)), 1.0 - 0.7 * dome);
  float reach = (0.5 + 0.6 * outline) * (0.85 + 0.3 * tj(T.seed, k)) * v0.z * (stems > 1 ? 0.75 : 1.0);
  float rise = (0.06 + 0.16 * u) * (1.0 - weep) * (1.0 - 0.4 * dome) - weep * 0.05 * (1.0 - u);
  vec3 root = along(dd, y);
  float out_ = reach * 0.72;
  float bend = 0.25 * (tj(T.seed, k + 1) - 0.5);
  L.root = root;
  L.elbow = vec3(root.x + cos(a) * out_ * 0.5, y + rise * 0.6, root.z + sin(a) * out_ * 0.5);
  L.tip = vec3(root.x + cos(a + bend) * out_, y + rise * (0.9 - 0.5 * weep), root.z + sin(a + bend) * out_);
  float side = a + (tj(T.seed, k + 2) < 0.5 ? -0.9 : 0.9);
  L.twig = vec3(L.elbow.x + cos(side) * out_ * 0.45, L.elbow.y + rise * 0.5 + 0.04 * (1.0 - weep), L.elbow.z + sin(side) * out_ * 0.45);
  L.a = a; L.bend = bend; L.side = side; L.u = u; L.reach = reach;
  L.r = TRUNK_REF * share * (0.55 - 0.25 * u) * max(0.7, v4.y * 0.8);
  return L;
}
void shapeTree(TreeFrame T, out vec3 p, out vec3 n, out vec3 c, out float facet, out float bob) {
  int row = T.row;
  vec4 v0 = rowAt(row, 0);
  vec4 v2 = rowAt(row, 2);
  vec4 v3 = rowAt(row, 3);
  vec4 v4 = rowAt(row, 4);
  float top = v0.y, width = v0.z;
  float lean = rowAt(row, 1).y;
  vec3 bark = rowAt(row, 8).rgb;
  vec3 twigs = rowAt(row, 10).rgb * T.tone;
  vec3 accent = rowAt(row, 11).rgb;
  float load = rowAt(row, 6).a;
  int role = int(tv.w + 0.5);
  int stems = clamp(int(v2.x + 0.5), 1, TPL_STEMS);
  float share = stems == 1 ? 1.0 : stems > 3 ? 0.6 : 0.75;
  bob = 0.0;
  tSnow = vec2(0.0);
  facet = 0.4;
#if TPL_LEAF
  if (role == 4) {
    leafCorner(T, v0, 3, v4.x, 0.95, p, n, c);
    facet = 0.5;
    p.x += p.y * lean * 4.0;
    return;
  }
#endif
  if (role == 0) {
    int j = int(tv.x + 0.5);
    int k = int(tv.y + 0.5);
    int z = int(tv.z + 0.5);
    int st = z - (z / 4) * 4;
    int sp = z / 4;
    if (st >= stems) { p = vec3(0.0); n = vec3(0.0, 1.0, 0.0); c = vec3(0.0); return; }
    float sa = float(st) * 2.4 + T.seedA;
    float tilt = stems == 1 ? 0.0 : v2.y * (st == 0 ? 0.4 : 1.0);
    vec2 dd = vec2(sin(tilt) * cos(sa), sin(tilt) * sin(sa)) * 4.0;
    float height = (st == 0 ? 1.0 : 0.8 + 0.15 * tj(T.seed, 40 + st)) * top;
    float crownTop = 0.82 * height;
    float y = j == 0 ? 0.0 : (j == 1 && TPL_SPANS > 2) ? BREAST : float(j) / float(TPL_SPANS) * crownTop;
    float r = TRUNK_REF * share * trunkProfile(y, crownTop, 0.3);
    float plumb = 1.0 / length(vec3(dd.x * 0.25, 1.0, dd.y * 0.25));
    float a = float(k) / float(TPL_TSIDES) * TAU;
    vec2 d = vec2(cos(a), -sin(a)) * r * mix(vec2(1.0), T.girth, plumb * plumb);
    vec3 ax = along(dd, y);
    p = vec3(ax.x + d.x, y, ax.z + d.y);
    n = vec3(cos(a), 0.1, -sin(a));
    c = tj(T.seed, 600 + sp * 7 + st) < v3.y ? bark * 0.25 : bark;
    facet = 0.25;
    p.x += p.y * lean * 4.0;
    return;
  }
  int allLimbs = clamp(int(floor(v2.z / 8.0 + 0.5)), 3, 8);
#if TPL_SEGS == 3
  int limbs = max(stems > 3 ? 1 : 2, int(floor(float(allLimbs) / float(stems) + 0.5)));
#elif TPL_FULL == 0 && TPL_LIMBS <= 2
  int limbs = 2;
#else
  int limbs = max(stems > 3 ? 1 : 2, int(floor(float(allLimbs) / float(stems) + 0.5)));
#endif
  limbs = min(limbs, TPL_LIMBS / stems);
  int piece = int(tv.x + 0.5);
  int kind = int(tv.z + 0.5);
  if (role == 3 || (role != 3 && kind == 2)) {
    // A limb, or (on the sketch) a fin standing in for one.
    int L = piece / TPL_SEGS;
    int seg = piece - L * TPL_SEGS;
    int st = L - (L / stems) * stems;
    int li = L / stems;
    if (li >= limbs || L >= TPL_LIMBS) { p = vec3(0.0); n = vec3(0.0, 1.0, 0.0); c = vec3(0.0); return; }
    float sa = float(st) * 2.4 + T.seedA;
    float tilt = stems == 1 ? 0.0 : v2.y * (st == 0 ? 0.4 : 1.0);
    vec2 dd = vec2(sin(tilt) * cos(sa), sin(tilt) * sin(sa)) * 4.0;
    float height = (st == 0 ? 1.0 : 0.8 + 0.15 * tj(T.seed, 40 + st)) * top;
    Limb B = limbOf(T, v0, v3, v4, stems, st, li, limbs, height, dd, share);
    int k = int(tv.y + 0.5);
    if (kind == 2) {
      finCorner(B.root, B.tip, B.r * 3.0, 2.5, 0.8, k, p, n);
      int corner = k - (k / 4) * 4;
      c = corner < 2 ? bark : twigs;
      facet = 0.4;
    } else {
      int e = int(tv.z + 0.5);
      vec3 a0, a1; float ra, rb; vec3 ca, cb; float turn = B.a;
#if TPL_SEGS == 3
      if (seg == 0) { a0 = B.root; a1 = B.elbow; ra = B.r; rb = B.r * 0.65; ca = bark; cb = bark; }
      else if (seg == 1) { a0 = B.elbow; a1 = B.tip; ra = B.r * 0.65; rb = B.r * 0.25; ca = bark; cb = twigs; }
      else { a0 = B.elbow; a1 = B.twig; ra = B.r * 0.45; rb = B.r * 0.15; ca = bark; cb = twigs; }
#else
      a0 = B.root; a1 = B.tip; ra = B.r; rb = B.r * 0.3; ca = bark; cb = twigs;
#endif
      vec3 dir = tubeDir(normalize(a1 - a0), float(k) / 3.0 * TAU + turn);
      p = (e == 0 ? a0 : a1) + dir * (e == 0 ? ra : rb);
      n = dir + vec3(0.0, 0.1, 0.0);
      c = e == 0 ? ca : cb;
      tSnow = vec2(e == 0 ? 0.9 : 0.5, v2.w * load * T.load * 0.8);
      facet = 0.3;
    }
    p.x += p.y * lean * 4.0;
    return;
  }
  // A SPRAY of twigs, or what the kind carries on it.
  int own = max(1, int(floor(floor(v2.z * TPL_SHARE + 0.5) / float(stems) + 0.5)));
#if TPL_FULL == 0 && TPL_SPRAYS <= 5
  own = max(1, 5 / stems);
#endif
  int st = piece - (piece / stems) * stems;
  int i = piece / stems;
  if (i >= own) { p = vec3(0.0); n = vec3(0.0, 1.0, 0.0); c = vec3(0.0); return; }
  float weep = v3.x, dome = v4.x, stiff = v4.y;
  float sa = float(st) * 2.4 + T.seedA;
  float tilt = stems == 1 ? 0.0 : v2.y * (st == 0 ? 0.4 : 1.0);
  vec2 dd = vec2(sin(tilt) * cos(sa), sin(tilt) * sin(sa)) * 4.0;
  float height = (st == 0 ? 1.0 : 0.8 + 0.15 * tj(T.seed, 40 + st)) * top;
  float crownTop = 0.82 * height;
  int k = 700 + i * 3 + st * 101;
  bool leader = i - (i / 7) * 7 == 6;
  vec3 root;
  float u, a, len;
  if (leader) {
    root = along(dd, crownTop * (0.9 + 0.1 * tj(T.seed, k)));
    u = 1.0;
    a = float(i) * 2.39996 + (tj(T.seed, k + 3) - 0.5) * 6.0;
    len = 0.4 * width * (0.7 + 0.5 * tj(T.seed, k + 4));
  } else {
    int spl = TPL_SEGS == 3 ? 3 : 2;
    int sp = (i * 5 + 1) - ((i * 5 + 1) / (limbs * spl)) * (limbs * spl);
    int li = sp / spl;
    int which = sp - li * spl;
    Limb B = limbOf(T, v0, v3, v4, stems, st, li, limbs, height, dd, share);
    vec3 from = which == 0 ? B.root : B.elbow;
    vec3 to = which == 0 ? B.elbow : which == 1 ? B.tip : B.twig;
    float sAng = which == 0 ? B.a : which == 1 ? B.a + B.bend : B.side;
    float sReach = which == 2 ? B.reach * 0.7 : B.reach;
    root = mix(from, to, 0.3 + 0.7 * tj(T.seed, k + 2));
    u = B.u;
    a = sAng + (tj(T.seed, k + 3) - 0.5) * 1.8;
    len = sReach * 0.5 * (0.7 + 0.5 * tj(T.seed, k + 4));
  }
  float rise = (0.05 + 0.09 * u) * (1.0 - weep) * (1.0 - 0.4 * dome) - weep * 0.07 * (1.0 - u * 0.5);
  vec3 tip = vec3(root.x + cos(a) * len, root.y + rise, root.z + sin(a) * len);
  float sprayLoad = u < 0.7 ? v2.w * load * T.load * (0.5 + tj(T.seed, k)) : 0.0;
  vec3 topC = twigs;
  int kc = int(tv.y + 0.5);
  int corner = kc - (kc / 4) * 4;
  if (kind == 0) {
    float w = (0.022 + 0.014 * (1.0 - u)) * stiff * (TPL_FULL == 1 ? 1.4 : TPL_SPRAYS > 5 ? 1.9 : 3.0);
    float roll = (tj(T.seed, k + 6) - 0.5) * 2.4;
    finCorner(root, tip, w, 4.5 / max(0.6, stiff), roll, kc, p, n);
    c = corner == 2 && kc < 4 ? topC : twigs;
    if (kc < 4) tSnow = vec2(corner < 2 ? 0.9 : 0.3, sprayLoad);
    bob = corner >= 2 ? len : 0.0;
  } else {
    // A berry cluster on the tip, or leaves, cones or keys along the spray.
    if (tj(T.seed, k + 5) < v3.z) {
      vec3 end = vec3(tip.x + (tip.x - root.x) * 0.12, tip.y - 0.025, tip.z + (tip.z - root.z) * 0.12);
      finCorner(tip, end, 0.09, 1.4, 0.0, kc, p, n);
    } else if (tj(T.seed, k + 7) < v3.w) {
      vec3 mid = mix(root, tip, 0.55 + 0.35 * tj(T.seed, k + 8));
      vec3 hang = vec3(mid.x + (tip.x - root.x) * 0.15, mid.y - 0.03, mid.z + (tip.z - root.z) * 0.15);
      finCorner(mid, hang, 0.07, 1.8, 0.0, kc, p, n);
    } else { p = vec3(0.0); n = vec3(0.0, 1.0, 0.0); c = vec3(0.0); return; }
    c = accent;
    bob = len;
  }
  p.x += p.y * lean * 4.0;
}
`;

/** The shaper for a family. */
export function shaperOf(family: "conifer" | "pine" | "larch" | "broad"): string {
  switch (family) {
    case "conifer":
      return CONIFER;
    case "pine":
      return PINE;
    case "larch":
      return LEAF + LARCH;
    case "broad":
      return LEAF + BROAD;
  }
}

/** The vertex shader's own: the tree shaped, out into the world. */
export const TREE_VERTEX_PARS = /* glsl */ `
varying vec3 vTreeSnow;
varying vec3 vTreeColor;
varying float vTreeFacet;
varying vec2 vTreeFade;
`;

/** In place of three's \`beginnormal_vertex\`: shape the corner. */
export const TREE_SHAPE = /* glsl */ `
  TreeFrame T = treeFrame(int(tree.x + 0.5));
  vec3 tLocal; vec3 tNormal; vec3 tColour; float tFacet; float tBob;
  shapeTree(T, tLocal, tNormal, tColour, tFacet, tBob);
  vec3 tWorld = treeWorld(T, tLocal, tBob);
  vec3 objectNormal = normalize(treeCofactor(T.m) * tNormal);
  vTreeColor = tColour;
  vTreeSnow = vec3(tSnow, tSnow.y > 0.0 ? T.exposure : 0.0);
  vTreeFacet = tFacet;
  vTreeFade = tree.yz;
`;

/** The fragment's own: the colour, the band's dither, the faceted normal. */
export const TREE_FRAGMENT_PARS = /* glsl */ `
uniform vec2 uTreeLee;
const vec3 TREE_SNOW_LIT = ${vec3Of(SNOW)};
const vec3 TREE_SNOW_SHADE = ${vec3Of(SNOW_SHADE)};
varying vec3 vTreeSnow;
float treeCover;
varying vec3 vTreeColor;
varying float vTreeFacet;
varying vec2 vTreeFade;
`;

export const TREE_DITHER = /* glsl */ `
  float lodDither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (lodDither < vTreeFade.x || lodDither >= vTreeFade.y) discard;
`;

export const TREE_NORMAL = /* glsl */ `
  {
    vec3 fN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    if (dot(fN, normal) < 0.0) fN = -fN;
    normal = normalize(mix(normal, fN, vTreeFacet));
  }
`;

/** THE SNOW, laid per pixel on whatever part of a tree faces up: out along
 * the part as far as its load reaches (`vTreeSnow`), with a ragged edge —
 * so every tier carries a white shelf and a laden tree is white further
 * out — and, on an EXPOSED tree, RIME plastered on its windward faces. */
export const TREE_SNOW = /* glsl */ `
  treeCover = 0.0;
  if (vTreeSnow.y > 0.0) {
    // The face's normal off the VIEW position's derivatives (small numbers
    // near the lens, so no float noise speckles it), turned into the world.
    vec3 vN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    if (dot(vN, vViewPosition) < 0.0) vN = -vN;
    vec3 wN = (vec4(vN, 0.0) * viewMatrix).xyz;
    // A ragged edge a hand's breadth to a metre across, smooth, so it never
    // sparkles on a far tree.
    float rag = 0.5 + 0.5 * sin(dot(vHazeWorld, vec3(2.3, 1.7, 2.9))) * sin(dot(vHazeWorld, vec3(-1.9, 2.6, 1.3)));
    float line = 1.0 - sqrt(min(1.0, vTreeSnow.y)) * 1.25 + (rag - 0.5) * 0.2;
    treeCover = step(line, vTreeSnow.x) * smoothstep(0.12, 0.4, wN.y);
    float wind = -dot(wN.xz, uTreeLee);
    float rime = smoothstep(0.35, 0.9, vTreeSnow.z) * smoothstep(0.0, 0.45, wind) * smoothstep(0.25, 0.4, rag);
    treeCover = max(treeCover, rime);
    vec3 snowC = mix(TREE_SNOW_SHADE, TREE_SNOW_LIT, smoothstep(0.1, 0.85, max(wN.y, wind * 0.7)));
    diffuseColor.rgb = mix(diffuseColor.rgb, snowC, treeCover);
  }
`;

/** BACKLIT: the snow on a tree glows along its rims against a low sun. */
export const TREE_BACKLIGHT = /* glsl */ `
  {
    vec3 tV = normalize(vHazeWorld - cameraPosition);
    float back = pow(max(0.0, dot(tV, uSunDir)), 8.0) * (1.0 - smoothstep(0.15, 0.6, uSunDir.y));
    totalEmissiveRadiance += uSunCol * back * treeCover * 0.35;
  }
`;
