// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FAR TREES — the shader-shaped forest's far band (`forest.ts`) with no
// mesh at all: ONE QUAD a tree, stood up round it facing the lens, and the
// tree RAY-CAST inside it against its variant's own silhouette — the
// conifer's stacked tiers, notched at every tier with a white shelf on each
// and flagged to the lee where it stands exposed, the pine's crown on its
// bare stem, the larch's and the broadleaf's see-through lattice of twigs —
// lit by the scene's lights through a normal of its own. The quad bounds
// the tree's cylinder from wherever the lens is, beside it or over it, so a
// far tree seen from a lift or a helicopter is still a tree from above, not
// a card; and it is two triangles where the sketch it replaces was dozens.
//
// The march is done in the tree's OWN frame (its matrix's inverse): the
// lens and the corner are carried in, and a ray stays a ray under an affine
// map, so the cylinder is the variant's unit one whatever the tree's height,
// crown, oval and lean.

import * as THREE from "three";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { TREE_TABLES } from "./tree-glsl.ts";
import type { TreeUniforms } from "./tree-shader.ts";

/** How many steps a far ray takes through its tree's cylinder. */
const STEPS = 12;

const FAR_VERTEX_PARS = /* glsl */ `
attribute vec3 tree;
attribute vec4 tv;
${TREE_TABLES}
flat varying int vFarId;
varying vec3 vFarCam;
varying vec3 vFarPos;
varying vec2 vTreeFade;
`;

/** In place of \`beginnormal_vertex\`: the quad stood up round the tree. */
const FAR_SHAPE = /* glsl */ `
  int farId = int(tree.x + 0.5);
  TreeFrame T = treeFrame(farId);
  vec4 fv0 = rowAt(T.row, 0);
  float fLean = abs(rowAt(T.row, 1).y) * 4.0;
  float W = fv0.z * 1.35 + fLean + 0.05;
  vec3 camL = inverse(T.m) * (cameraPosition - T.foot);
  vec3 c0 = vec3(0.0, 0.5, 0.0);
  vec3 fw = normalize(camL - c0);
  vec3 rt = cross(vec3(0.0, 1.0, 0.0), fw);
  rt = length(rt) < 1e-3 ? vec3(1.0, 0.0, 0.0) : normalize(rt);
  vec3 upv = cross(fw, rt);
  // The cylinder's outline seen along \`fw\`, a little over for the lens's
  // perspective.
  float hu = (0.5 * abs(upv.y) + W * sqrt(max(0.0, 1.0 - upv.y * upv.y))) * 1.12;
  float hr = W * 1.12;
  vec2 kq = tv.xy * 2.0 - 1.0;
  vec3 pL = c0 + rt * kq.x * hr + upv * kq.y * hu;
  vFarId = farId;
  vFarCam = camL;
  vFarPos = pL;
  vTreeFade = tree.yz;
  vec3 tWorld = T.m * pL + T.foot;
  vec3 objectNormal = vec3(0.0, 1.0, 0.0);
`;

const FAR_FRAGMENT_PARS = /* glsl */ `
${TREE_TABLES}
flat varying int vFarId;
varying vec3 vFarCam;
varying vec3 vFarPos;
varying vec2 vTreeFade;
vec3 farTreeN;
vec3 farTreeTint;

float farHash(vec3 q) {
  return fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

/** Whether point \`q\` (the tree's frame, the lean taken out) is inside the
 * tree, and if so its normal there (\`n\`, the same frame) and its part:
 * 0 bark, 1 needles or twigs, 2 the snow on them, 3 leaves. */
bool farInside(TreeFrame T, vec4 v0, vec4 v2, vec4 v3, int form, float snow, vec3 q, out vec3 n, out int part) {
  float rho = length(q.xz);
  float y = q.y;
  float trunk = TRUNK_REF * max(T.girth.x, 1.0) * 1.4;
  float base = v0.x, top = v0.y, width = v0.z, taper = v0.w;
  float span = max(1e-3, top - base);
  vec2 d = rho > 1e-5 ? q.xz / rho : vec2(1.0, 0.0);
  float phi = atan(q.z, q.x);
  part = 1;
  if (form == 0) {
    if (y > top + 0.03 || y < 0.0) return false;
    if (y < base) {
      n = vec3(d.x, 0.1, d.y); part = 0;
      return rho < trunk;
    }
    float count = max(2.0, floor(v2.x * 0.6 + tj(T.seed, 3) * 1.4 - 0.2));
    float u = min(1.0, (y - base) / span);
    float tu = u * count;
    float k = floor(tu);
    float ft = tu - k;
    float Rb = width * pow(max(0.0, 1.0 - (k / count) * 0.95), taper) * (0.92 + 0.16 * tj(T.seed, 200 + int(k)));
    float flag = clamp(v3.y + T.exposure * 0.55, 0.0, 0.9);
    float lee = max(0.15, 1.0 + flag * cos(phi - T.leeAngle) * 0.9 - flag * 0.25);
    float jag = 1.0 + 0.12 * cos(v2.y * phi + k * 0.9 + T.seedA);
    float r = Rb * (1.0 - 0.62 * ft) * lee * jag * (1.0 - 0.22 * snow * snow);
    if (rho >= r) {
      // The stem inside the crown, never above its last tier.
      if (rho >= trunk || u > 0.85) return false;
      n = vec3(d.x, 0.1, d.y); part = 0;
      return true;
    }
    float slope = 0.62 * Rb * count / span;
    n = normalize(vec3(d.x, slope, d.y));
    // The white shelf along the top of every tier, out as far as its load.
    part = ft > 1.0 - snow * 0.95 && n.y > 0.3 ? 2 : 1;
    return true;
  }
  if (form == 1) {
    if (y < 0.0 || y > top + 0.05) return false;
    float c = base + span * 0.55;
    float ry = span * 0.55;
    float rr = width * v2.y * 0.95 + 0.05;
    float lump = 1.0 + 0.18 * sin(phi * 5.0 + T.seedA) * sin(y * 23.0 + T.seedA);
    vec3 e = vec3(q.x / rr, (y - c) / ry, q.z / rr);
    if (dot(e, e) < lump * lump && y > base) {
      n = normalize(vec3(e.x / rr, e.y / ry, e.z / rr));
      part = n.y > 0.45 && tj(T.seed, 9) < snow + 0.2 ? 2 : 1;
      return true;
    }
    n = vec3(d.x, 0.1, d.y); part = 0;
    return rho < trunk && y < top;
  }
  // A larch, a snag or a broadleaf: a see-through lattice inside its
  // envelope — or, in leaf, the envelope whole.
  if (y < 0.0 || y > top) return false;
  if (rho < trunk && y < top * 0.85) { n = vec3(d.x, 0.1, d.y); part = 0; return true; }
  float r = leafRadius(v0, form == 2 ? 2 : 3, rowAt(T.row, 4).x, y);
  if (rho >= r) return false;
  vec4 c11 = rowAt(T.row, 11);
  n = normalize(vec3(d.x, 0.6, d.y));
  if (c11.w > 0.5) { part = 3; return true; }
  float keep = 1.0 - pow(1.0 - clamp(rowAt(T.row, 1).z, 0.05, 0.95), 1.0 / 5.0);
  if (farHash(floor(q * vec3(28.0, 40.0, 28.0)) + float(T.seed & 255u)) > keep) return false;
  part = y < top * 0.7 && farHash(floor(q * 31.0)) < snow * 0.5 ? 2 : 1;
  return true;
}
`;

/** At the fragment's top: the dither, then the ray through the tree. */
const FAR_MARCH = /* glsl */ `
  float lodDither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (lodDither < vTreeFade.x || lodDither >= vTreeFade.y) discard;
  TreeFrame T = treeFrame(vFarId);
  vec4 v0 = rowAt(T.row, 0);
  vec4 v2 = rowAt(T.row, 2);
  vec4 v3 = rowAt(T.row, 3);
  int form = int(rowAt(T.row, 1).x + 0.5);
  float L4 = rowAt(T.row, 1).y * 4.0;
  float snow = clamp(v2.w * rowAt(T.row, 6).a * T.load, 0.0, 1.0);
  vec3 ro = vFarCam;
  vec3 rd = vFarPos - vFarCam;
  // The lean taken out: the tree is drawn sheared, x by its height.
  ro.x -= ro.y * L4;
  rd.x -= rd.y * L4;
  float W = v0.z * 1.35 + 0.05;
  float a = dot(rd.xz, rd.xz);
  float b = 2.0 * dot(ro.xz, rd.xz);
  float cc = dot(ro.xz, ro.xz) - W * W;
  float disc = b * b - 4.0 * a * cc;
  if (disc < 0.0 || a < 1e-12) discard;
  float sq = sqrt(disc);
  float t0 = (-b - sq) / (2.0 * a);
  float t1 = (-b + sq) / (2.0 * a);
  float ya = (0.0 - ro.y) / rd.y;
  float yb = (1.08 - ro.y) / rd.y;
  t0 = max(max(t0, min(ya, yb)), 0.0);
  t1 = min(t1, max(ya, yb));
  if (t1 <= t0) discard;
  float dt = (t1 - t0) / float(${STEPS});
  float t = t0 + dt * lodDither;
  vec3 hn;
  int part = -1;
  for (int i = 0; i < ${STEPS}; i++) {
    vec3 q = ro + rd * t;
    vec3 nn; int pp;
    if (farInside(T, v0, v2, v3, form, snow, q, nn, pp)) { hn = nn; part = pp; break; }
    t += dt;
  }
  if (part < 0) discard;
  // The normal back out of the tree's frame (the lean put back in).
  hn.y -= hn.x * L4;
  farTreeN = normalize(treeCofactor(T.m) * hn);
  vec3 needle = rowAt(T.row, 6).rgb * T.tone;
  vec3 dark = rowAt(T.row, 7).rgb * T.tone;
  vec3 bark = rowAt(T.row, 8).rgb;
  vec3 twigs = rowAt(T.row, 10).rgb * T.tone;
  vec3 green = form <= 1 ? mix(dark, needle, smoothstep(-0.2, 0.6, farTreeN.y)) : twigs;
  farTreeTint = part == 0 ? bark : part == 2 ? mix(SNOW_SHADE, SNOW, smoothstep(0.2, 0.9, farTreeN.y))
    : part == 3 ? rowAt(T.row, 12).rgb : green;
`;

/** The far band's material: every far tree, of every family, one draw. */
export function farMaterial(haze: HazeUniforms, u: TreeUniforms): THREE.Material {
  return hazeMaterial(
    new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
    haze,
    "tree-far",
    (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${FAR_VERTEX_PARS}`)
        .replace("#include <beginnormal_vertex>", FAR_SHAPE)
        .replace("#include <begin_vertex>", "vec3 transformed = tWorld;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${FAR_FRAGMENT_PARS}`)
        .replace("void main() {", `void main() {\n${FAR_MARCH}`)
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\n  diffuseColor.rgb *= farTreeTint;",
        )
        .replace(
          "#include <normal_fragment_begin>",
          "#include <normal_fragment_begin>\n  normal = normalize((viewMatrix * vec4(farTreeN, 0.0)).xyz);",
        );
    },
  );
}
