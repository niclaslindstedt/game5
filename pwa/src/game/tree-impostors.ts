// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FAR WOODS AS IMPOSTORS. Past the near band (`forest.ts`) every tree is
// one QUAD turned to the lens, drawn out of a picture of its variant baked
// at map load: the variant's full cut photographed from 8 × 8 directions
// over the upper hemisphere into a HEMI-OCTAHEDRAL ATLAS
// (`impostor-plan.ts`), its colour (snow and all, as the vertex colours
// paint it) and coverage in one picture, its normal and depth in another,
// a layer of a texture array a variant. Baked in ONE draw a layer — the
// variant instanced 64 times, each instance laid into its own frame by the
// vertex shader — into both pictures at once.
//
// The quad samples the FOUR frames nearest the direction it is seen from
// and blends them; each frame's sample is moved along the pixel's own ray
// to where its picture plane meets it, then once more to the surface its
// depth says (so the four agree on where a bough is and a blend does not
// ghost), and the depth is written, so a far tree stands IN the snow and
// behind the ridge in front of it as its geometry would. The blended normal
// is handed to the same physical material the near trees are lit by, under
// the same haze, sun, sky light, lamps and shadows — so a far tree is the
// near tree's brightness at every hour, and the dissolve between them
// (`tree-bands.ts`) is a dissolve and not a change of light.
//
// EVERY FAR TREE IS ONE DRAW TOGETHER: where each stands, its turn and
// lean, its stretch, its tint and its picture are a texel row of a float
// texture written once a map; a frame sends only each drawn tree's number
// and its dither window.

import * as THREE from "three";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createShadeDepth } from "./terrain-shade.ts";
import {
  FRAMES,
  FRAME_MARGIN,
  frameAxes,
  frameDir,
  hemiOctDecode,
  hemiOctEncode,
  type ImpostorLook,
} from "./impostor-plan.ts";

/** The float texture's width, texels: three a tree. */
const ROW = 1024;

/** A variant to picture: its full cut, the stretch across (`aspect`, the
 * trees' crown over their height) and the trunk's girth it is drawn at. */
export type ImpostorLayer = {
  geometry: THREE.BufferGeometry;
  aspect: number;
  girth: number;
};

/** One tree's place in the far woods. */
export type ImpostorTree = {
  /** The foot, as the forest stands the tree (sunk and leant). */
  x: number;
  y: number;
  z: number;
  /** Its turn and lean. */
  q: THREE.Quaternion;
  /** Its stretch: across, up, across (0: not drawn). */
  sx: number;
  sy: number;
  sz: number;
  tint: number;
  layer: number;
};

export type Impostors = {
  mesh: THREE.Mesh;
  /** Bake `layers` under `look` (a renderer to bake with: none, nothing is
   * pictured and the quads draw nothing — the processor's labs). */
  bake(layers: ImpostorLayer[], look: ImpostorLook): void;
  /** Every tree's row, written once (`setTree` each, then `commit`). */
  setTree(i: number, t: ImpostorTree): void;
  commit(): void;
  /** The drawn trees: their numbers and dither windows. */
  ids: Float32Array;
  fades: Float32Array;
  /** THE CASTERS: the trees whose shadows can reach the sun's circle, each
   * a quad turned to the sun and cut to its picture from there — one draw
   * into the shadow map for every tree. `casterIds` filled, `setCasters`
   * says how many, and whether they are read from a blurrier mip. */
  casters: THREE.Mesh;
  casterIds: Float32Array;
  setCasters(n: number, coarse: boolean): void;
  /** The atlas's bytes on the GPU. */
  bytes(): number;
  /** How long the last bake took, ms. */
  bakeMs(): number;
  dispose(): void;
};

/** The GLSL the bake and the quad share: the hemi-octahedral fold and a
 * frame's plane. */
const OCT_GLSL = `
const float IMP_N = ${FRAMES}.0;
vec3 impDecode(vec2 uv) {
  vec2 ab = uv * 2.0 - 1.0;
  vec3 d = vec3((ab.x + ab.y) * 0.5, 0.0, (ab.x - ab.y) * 0.5);
  d.y = max(0.0, 1.0 - abs(d.x) - abs(d.z));
  return normalize(d);
}
vec2 impEncode(vec3 d) {
  d.y = max(0.0, d.y);
  vec2 p = d.xz / (abs(d.x) + d.y + abs(d.z));
  return vec2(p.x + p.y, p.x - p.y) * 0.5 + 0.5;
}
void impAxes(vec3 d, out vec3 r, out vec3 u) {
  vec3 hint = abs(d.y) > 0.999 ? vec3(0.0, 0.0, -1.0) : vec3(0.0, 1.0, 0.0);
  r = normalize(cross(hint, d));
  u = cross(d, r);
}
vec3 impRot(vec4 q, vec3 v) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}`;

const BAKE_VERTEX = `
in vec3 position;
in vec3 normal;
in vec3 color;
in vec3 stem;
uniform vec4 uSphere;
uniform float uAspect;
uniform float uGirth;
out vec3 vCol;
out vec3 vN;
out float vDepth;
${OCT_GLSL}
void main() {
  vec3 p = position;
  p.xz = stem.xy + (p.xz - stem.xy) * mix(1.0, uGirth, stem.z);
  vec3 b = vec3(p.x * uAspect, p.y, p.z * uAspect) - uSphere.xyz;
  int i = gl_InstanceID % ${FRAMES};
  int j = gl_InstanceID / ${FRAMES};
  vec3 d = impDecode(vec2(float(i), float(j)) / (IMP_N - 1.0));
  vec3 r, u;
  impAxes(d, r, u);
  vec2 xy = vec2(dot(b, r), dot(b, u)) / uSphere.w;
  float z = dot(b, d) / uSphere.w;
  vec2 tile = (vec2(float(i), float(j)) + 0.5 + 0.5 * xy) / IMP_N;
  gl_Position = vec4(tile * 2.0 - 1.0, -z * 0.5, 1.0);
  vN = normalize(vec3(normal.x / uAspect, normal.y, normal.z / uAspect));
  vCol = color;
  vDepth = z;
}`;

const BAKE_FRAGMENT = `
precision highp float;
in vec3 vCol;
in vec3 vN;
in float vDepth;
layout(location = 0) out vec4 oAlbedo;
layout(location = 1) out vec4 oNormal;
void main() {
  // The colour square-rooted, so the needles' near-black keeps its
  // gradations in eight bits.
  oAlbedo = vec4(sqrt(max(vCol, 0.0)), 1.0);
  oNormal = vec4(normalize(vN) * 0.5 + 0.5, vDepth * 0.5 + 0.5);
}`;

/** The quad's vertex half, grafted over the physical material's. */
const QUAD_VERTEX_PARS = `
attribute float aTree;
uniform highp sampler2D uTrees;
uniform vec4 uLayers[64];
uniform vec4 uBounds[64];
flat varying vec4 vImpQ;
flat varying vec3 vImpK;
flat varying vec3 vImpC;
flat varying vec2 vImpLayer;
varying vec3 vImpW;
${OCT_GLSL}
vec4 impTexel(int k) { return texelFetch(uTrees, ivec2(k % ${ROW}, k / ${ROW}), 0); }`;

const QUAD_VERTEX = `
  int impId = int(aTree + 0.5) * 3;
  vec4 T0 = impTexel(impId);
  vec4 T1 = impTexel(impId + 1);
  vec4 T2 = impTexel(impId + 2);
  vec3 impK = vec3(T2.x, T0.w, T2.y);
  int impL = int(T2.w + 0.5);
  vec4 impS = uLayers[impL];
  vec3 impC = T0.xyz + impRot(T1, impK * impS.xyz);
  // The quad hugs the tree's upright cylinder as seen from here: narrow
  // from the side, round from above — never the sphere's square, most of
  // which is air.
  vec4 impB = uBounds[impL];
  vec3 impA = impRot(T1, vec3(0.0, 1.0, 0.0));
  float impRc = impB.x * max(impK.x, impK.z);
  float impH = impB.y * impK.y;
  vec3 impTo = normalize(cameraPosition - impC);
  vec3 impX = abs(impTo.y) > 0.999 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), impTo));
  vec3 impY = cross(impTo, impX);
  float impAx = dot(impA, impX);
  float impAy = dot(impA, impY);
  float impEx = impH * abs(impAx) + impRc * sqrt(max(0.0, 1.0 - impAx * impAx));
  float impEy = impH * abs(impAy) + impRc * sqrt(max(0.0, 1.0 - impAy * impAy));
  vec3 impW = impC + impX * position.x * impEx * ${FRAME_MARGIN} + impY * position.y * impEy * ${FRAME_MARGIN};
  vImpQ = T1;
  vImpK = max(impK, vec3(1e-4));
  vImpC = impC;
  vImpLayer = vec2(float(impL), T2.z);
  vImpW = impW;
  vec3 objectNormal = impTo;`;

/** The quad's fragment half: the four frames, their colour, coverage,
 * normal and depth. */
const QUAD_FRAGMENT_PARS = `
uniform mat4 projectionMatrix;
uniform highp sampler2DArray uAlbedo;
uniform highp sampler2DArray uNormal;
uniform vec4 uLayers[64];
uniform float uFrame;
uniform float uCasterLod;
flat varying vec4 vImpQ;
flat varying vec3 vImpK;
flat varying vec3 vImpC;
flat varying vec2 vImpLayer;
varying vec3 vImpW;
${OCT_GLSL}
vec3 impUnrot(vec4 q, vec3 v) { return impRot(vec4(-q.xyz, q.w), v); }
vec2 impPlane(vec3 cam, vec3 ray, vec3 d, vec3 r, vec3 u, float rad, float depth) {
  float t = (depth - dot(cam, d)) / dot(ray, d);
  vec3 q = cam + t * ray;
  return vec2(dot(q, r), dot(q, u)) / rad * 0.5 + 0.5;
}
vec3 impTap(vec2 ij, vec2 uv) {
  float edge = 0.5 / uFrame;
  return vec3((ij + clamp(uv, edge, 1.0 - edge)) / IMP_N, vImpLayer.x);
}
// One frame: the colour (unpremultiplied, linear) and coverage, and the
// normal and the depth in the frame, all at the ray's surface.
vec3 impFrame(vec2 ij, vec3 cam, vec3 ray, float rad, float lod, out vec4 alb) {
  vec3 d = impDecode(ij / (IMP_N - 1.0));
  vec3 r, u;
  impAxes(d, r, u);
  vec2 uv = impPlane(cam, ray, d, r, u, rad, 0.0);
  // Near, the sample moved to the surface its depth says; far, where a
  // texel is a whole bough, the plane through the middle is as good.
  if (lod < 1.5) {
    float s = textureLod(uNormal, impTap(ij, uv), lod).a;
    uv = impPlane(cam, ray, d, r, u, rad, (s * 2.0 - 1.0) * rad);
  }
  vec3 tap = impTap(ij, uv);
  alb = textureLod(uAlbedo, tap, lod);
  vec2 off = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  alb.a *= off.x * off.y;
  alb.rgb = alb.rgb / max(alb.a, 1e-3);
  alb.rgb *= alb.rgb;
  return tap;
}
// The frame's normal and depth, read once the pixel is known to be on it.
vec4 impNd(vec3 tap, float rad, float lod) {
  vec4 nd = textureLod(uNormal, tap, lod);
  return vec4(nd.xyz * 2.0 - 1.0, (nd.w * 2.0 - 1.0) * rad);
}`;

const QUAD_FRAGMENT = `
  vec4 impS = uLayers[int(vImpLayer.x + 0.5)];
  vec3 impCam = impUnrot(vImpQ, cameraPosition - vImpC) / vImpK;
  vec3 impPix = impUnrot(vImpQ, vImpW - vImpC) / vImpK;
  vec3 impRay = impPix - impCam;
  vec3 impView = normalize(impCam);
  vec2 impG = impEncode(impView) * (IMP_N - 1.0);
  vec2 impI = clamp(floor(impG), vec2(0.0), vec2(IMP_N - 2.0));
  vec2 impF = clamp(impG - impI, 0.0, 1.0);
  // The mip: the atlas's texels a pixel spans, held to frames of 8 texels.
  vec3 impR0, impU0;
  vec3 impD0 = impDecode(impI / (IMP_N - 1.0));
  impAxes(impD0, impR0, impU0);
  vec2 impUv0 = impPlane(impCam, impRay, impD0, impR0, impU0, impS.w, 0.0) * uFrame;
  vec2 impDu = max(abs(dFdx(impUv0)), abs(dFdy(impUv0)));
  float impLod = clamp(log2(max(max(impDu.x, impDu.y), 1.0)), 0.0, log2(uFrame) - 3.0);
  vec4 a00, a10, a01, a11;
  vec3 t00 = impFrame(impI, impCam, impRay, impS.w, impLod, a00);
  vec3 t10 = impFrame(impI + vec2(1.0, 0.0), impCam, impRay, impS.w, impLod, a10);
  vec3 t01 = impFrame(impI + vec2(0.0, 1.0), impCam, impRay, impS.w, impLod, a01);
  vec3 t11 = impFrame(impI + vec2(1.0, 1.0), impCam, impRay, impS.w, impLod, a11);
  vec4 impW4 = vec4((1.0 - impF.x) * (1.0 - impF.y), impF.x * (1.0 - impF.y), (1.0 - impF.x) * impF.y, impF.x * impF.y);
  vec4 impA = impW4 * vec4(a00.a, a10.a, a01.a, a11.a);
  float impCover = impA.x + impA.y + impA.z + impA.w;
  // A far tree keeps its coverage as its mips thin it: a mip averages a
  // crown's snowy rim with the air round it, and a fixed half would eat the
  // rim away and leave the dark heart.
  if (impCover < mix(0.5, 0.16, sqrt(impLod / max(1.0, log2(uFrame) - 3.0)))) discard;
  vec4 n00 = impNd(t00, impS.w, impLod);
  vec4 n10 = impNd(t10, impS.w, impLod);
  vec4 n01 = impNd(t01, impS.w, impLod);
  vec4 n11 = impNd(t11, impS.w, impLod);
  vec3 impCol = (a00.rgb * impA.x + a10.rgb * impA.y + a01.rgb * impA.z + a11.rgb * impA.w) / impCover;
  vec3 impN = n00.xyz * impA.x + n10.xyz * impA.y + n01.xyz * impA.z + n11.xyz * impA.w;
  diffuseColor.rgb = impCol * vImpLayer.y;
  vec3 impNormalV = normalize(mat3(viewMatrix) * impRot(vImpQ, normalize(impN) / vImpK));
#ifdef IMP_DEPTH
  float impDepth = (n00.w * impA.x + n10.w * impA.y + n01.w * impA.z + n11.w * impA.w) / impCover;
  // Where the surface is along the pixel's ray, for the depth.
  float impT = (impDepth - dot(impCam, impView)) / dot(impRay, impView);
  vec3 impSurf = vImpC + impRot(vImpQ, vImpK * (impCam + impT * impRay));
  vec4 impClip = projectionMatrix * viewMatrix * vec4(impSurf, 1.0);
  gl_FragDepth = clamp(impClip.z / impClip.w * 0.5 + 0.5, 0.0, 1.0);
#endif`;

const NORMAL_BEGIN = `
float faceDirection = 1.0;
vec3 normal = impNormalV;
vec3 nonPerturbedNormal = normal;`;

/** The caster's vertex: the quad as the far band's, turned to the sun. */
const CASTER_VERTEX = QUAD_VERTEX.replace(
  "vec3 impTo = normalize(cameraPosition - impC);",
  "vec3 impTo = normalize(uSunDir);",
).replace("vec3 objectNormal = impTo;", "vec3 transformed = impW;");

/** The caster's fragment: the four frames nearest the sun's way, their
 * coverage alone, along the sun's parallel rays. */
const CASTER_FRAGMENT = `
  vec4 impS = uLayers[int(vImpLayer.x + 0.5)];
  vec3 impL = normalize(impUnrot(vImpQ, uSunDir) / vImpK);
  vec3 impPix = impUnrot(vImpQ, vImpW - vImpC) / vImpK;
  vec3 impCam = impPix + impL * impS.w * 4.0;
  // The one frame nearest the sun's way: a shadow is a silhouette, and the
  // next frame's differs from it by less than the map's own texel.
  vec2 impI = clamp(floor(impEncode(impL) * (IMP_N - 1.0) + 0.5), vec2(0.0), vec2(IMP_N - 1.0));
  vec3 impR0, impU0;
  vec3 impD0 = impDecode(impI / (IMP_N - 1.0));
  impAxes(impD0, impR0, impU0);
  vec2 impUv0 = impPlane(impCam, -impL, impD0, impR0, impU0, impS.w, 0.0) * uFrame;
  vec2 impDu = max(abs(dFdx(impUv0)), abs(dFdy(impUv0)));
  float impLod = clamp(log2(max(max(impDu.x, impDu.y), 1.0)), uCasterLod, log2(uFrame) - 3.0);
  vec4 a00;
  impFrame(impI, impCam, -impL, impS.w, max(impLod, 1.5), a00);
  // A bare larch's twigs and a dead stem's trunk are thin: a mip thins
  // their coverage, and the shadow keeps them at a quarter.
  if (a00.a < 0.25) discard;`;

export function createImpostors(
  haze: HazeUniforms,
  room: number,
  renderer: THREE.WebGLRenderer | null,
  graftFade: (shader: { vertexShader: string; fragmentShader: string }) => void,
): Impostors {
  const rows = Math.max(1, Math.ceil((room * 3) / ROW));
  const data = new Float32Array(ROW * rows * 4);
  const trees = new THREE.DataTexture(data, ROW, rows, THREE.RGBAFormat, THREE.FloatType);
  trees.minFilter = THREE.NearestFilter;
  trees.magFilter = THREE.NearestFilter;
  trees.generateMipmaps = false;
  const layers = Array.from({ length: 64 }, () => new THREE.Vector4());
  /** Each layer's upright cylinder round its sphere's middle, in the
   * impostor space: its radius and half its height. */
  const bounds = Array.from({ length: 64 }, () => new THREE.Vector4());
  const uniforms = {
    uTrees: { value: trees },
    uLayers: { value: layers },
    uBounds: { value: bounds },
    uAlbedo: { value: null as THREE.Texture | null },
    uNormal: { value: null as THREE.Texture | null },
    uFrame: { value: 64 },
    uCasterLod: { value: 1 },
  };
  const material = hazeMaterial(
    new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }),
    haze,
    "impostor",
    (shader) => {
      Object.assign(shader.uniforms, uniforms);
      graftFade(shader);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${QUAD_VERTEX_PARS}`)
        .replace("#include <beginnormal_vertex>", QUAD_VERTEX)
        .replace("#include <begin_vertex>", "vec3 transformed = impW;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${QUAD_FRAGMENT_PARS}`)
        .replace("#include <color_fragment>", QUAD_FRAGMENT)
        .replace("#include <normal_fragment_begin>", NORMAL_BEGIN);
    },
  );

  const quad = new THREE.PlaneGeometry(2, 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex(quad.getIndex());
  geometry.setAttribute("position", quad.getAttribute("position"));
  const ids = new Float32Array(Math.max(1, room));
  const fades = new Float32Array(Math.max(1, room) * 2);
  const idAttr = new THREE.InstancedBufferAttribute(ids, 1);
  idAttr.setUsage(THREE.DynamicDrawUsage);
  const fadeAttr = new THREE.InstancedBufferAttribute(fades, 2);
  fadeAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aTree", idAttr);
  geometry.setAttribute("fade", fadeAttr);
  geometry.instanceCount = 0;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.visible = false;
  mesh.name = "impostors";

  const casterGeometry = new THREE.InstancedBufferGeometry();
  casterGeometry.setIndex(quad.getIndex());
  casterGeometry.setAttribute("position", quad.getAttribute("position"));
  const casterIds = new Float32Array(Math.max(1, room));
  const casterAttr = new THREE.InstancedBufferAttribute(casterIds, 1);
  casterAttr.setUsage(THREE.DynamicDrawUsage);
  casterGeometry.setAttribute("aTree", casterAttr);
  casterGeometry.instanceCount = 0;
  // Drawn into the shadow map and nowhere else: its own material puts every
  // vertex outside the clip volume, and the shadow pass draws it with the
  // depth material below, which never runs that one.
  const casterMaterial = new THREE.ShaderMaterial({
    vertexShader: "void main() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }",
    fragmentShader: "void main() { gl_FragColor = vec4(0.0); }",
  });
  casterMaterial.shadowSide = THREE.DoubleSide;
  // The mountain's shade first (a tree it already shades casts nothing).
  const casterDepth = createShadeDepth(haze);
  const shadeCompile = casterDepth.onBeforeCompile.bind(casterDepth);
  casterDepth.customProgramCacheKey = (): string => "terrain-shade-depth-impostor";
  casterDepth.onBeforeCompile = (shader, gl) => {
    shadeCompile(shader, gl);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nuniform vec3 uSunDir;\n${QUAD_VERTEX_PARS}`)
      .replace("#include <begin_vertex>", CASTER_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${QUAD_FRAGMENT_PARS}`)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>\n${CASTER_FRAGMENT}`,
      );
  };
  const casters = new THREE.Mesh(casterGeometry, casterMaterial);
  casters.customDepthMaterial = casterDepth;
  casters.frustumCulled = false;
  casters.castShadow = true;
  casters.receiveShadow = false;
  casters.visible = false;
  casters.name = "impostor-casters";

  let target: THREE.WebGLArrayRenderTarget | null = null;
  let held = 0;
  let took = 0;
  const aspects: number[] = [];

  function bake(list: ImpostorLayer[], look: ImpostorLook): void {
    target?.dispose();
    target = null;
    held = 0;
    aspects.length = 0;
    uniforms.uFrame.value = look.frame;
    list.forEach((l, k) => {
      // The variant's bounding sphere in the impostor space.
      const pos = l.geometry.getAttribute("position");
      const box = new THREE.Box3();
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        box.expandByPoint(v.set(pos.getX(i) * l.aspect, pos.getY(i), pos.getZ(i) * l.aspect));
      }
      const c = box.getCenter(new THREE.Vector3());
      let r = 0;
      for (let i = 0; i < pos.count; i++) {
        r = Math.max(
          r,
          v.set(pos.getX(i) * l.aspect, pos.getY(i), pos.getZ(i) * l.aspect).distanceTo(c),
        );
      }
      layers[k].set(c.x, c.y, c.z, r * FRAME_MARGIN);
      let rc = 0;
      for (let i = 0; i < pos.count; i++) {
        rc = Math.max(rc, Math.hypot(pos.getX(i) * l.aspect - c.x, pos.getZ(i) * l.aspect - c.z));
      }
      bounds[k].set(rc, (box.max.y - box.min.y) / 2, 0, 0);
      aspects[k] = l.aspect;
    });
    if (!renderer || list.length === 0) return;
    const t0 = performance.now();
    const side = look.frame * FRAMES;
    const rt = new THREE.WebGLArrayRenderTarget(side, side, list.length, {
      count: 2,
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
    });
    // Storage with its mips, then the mips made once at the end, not after
    // every layer.
    renderer.initRenderTarget(rt);
    for (const t of rt.textures) t.generateMipmaps = false;
    const bakeMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BAKE_VERTEX,
      fragmentShader: BAKE_FRAGMENT,
      uniforms: {
        uSphere: { value: new THREE.Vector4() },
        uAspect: { value: 1 },
        uGirth: { value: 1 },
      },
    });
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const was = {
      target: renderer.getRenderTarget(),
      clear: renderer.getClearColor(new THREE.Color()),
      alpha: renderer.getClearAlpha(),
      auto: renderer.autoClear,
    };
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    const ctx = renderer.getContext() as WebGL2RenderingContext;
    list.forEach((l, k) => {
      const g = new THREE.InstancedBufferGeometry();
      g.setIndex(l.geometry.getIndex());
      for (const name of ["position", "normal", "color", "stem"]) {
        const a = l.geometry.getAttribute(name);
        if (a) g.setAttribute(name, a);
      }
      g.instanceCount = FRAMES * FRAMES;
      const m = new THREE.Mesh(g, bakeMaterial);
      m.frustumCulled = false;
      bakeMaterial.uniforms.uSphere.value.copy(layers[k]);
      bakeMaterial.uniforms.uAspect.value = l.aspect;
      bakeMaterial.uniforms.uGirth.value = l.girth;
      bakeMaterial.uniformsNeedUpdate = true;
      scene.add(m);
      renderer.setRenderTarget(rt, k);
      // The colour cleared to nothing, the normal and depth to the frame's
      // middle — so a texel half on the tree filters toward the plane, not
      // toward a normal pointing nowhere.
      renderer.clear(false, true, false);
      ctx.clearBufferfv(ctx.COLOR, 0, [0, 0, 0, 0]);
      ctx.clearBufferfv(ctx.COLOR, 1, [0.5, 0.5, 0.5, 0.5]);
      renderer.render(scene, camera);
      scene.remove(m);
    });
    for (const t of rt.textures) t.generateMipmaps = true;
    renderer.setRenderTarget(rt, 0);
    renderer.render(new THREE.Scene(), camera);
    renderer.setRenderTarget(was.target);
    renderer.setClearColor(was.clear, was.alpha);
    renderer.autoClear = was.auto;
    bakeMaterial.dispose();
    target = rt;
    uniforms.uAlbedo.value = rt.textures[0];
    uniforms.uNormal.value = rt.textures[1];
    held = Math.round(side * side * 4 * 2 * list.length * (4 / 3));
    took = performance.now() - t0;
    // For the labs: what the atlas holds and what it took to bake.
    mesh.userData.textureBytes = held;
    mesh.userData.bakeMs = took;
  }

  function setTree(i: number, t: ImpostorTree): void {
    const k = i * 12;
    const a = aspects[t.layer] ?? 1;
    data[k] = t.x;
    data[k + 1] = t.y;
    data[k + 2] = t.z;
    data[k + 3] = t.sy;
    data[k + 4] = t.q.x;
    data[k + 5] = t.q.y;
    data[k + 6] = t.q.z;
    data[k + 7] = t.q.w;
    data[k + 8] = t.sx / a;
    data[k + 9] = t.sz / a;
    data[k + 10] = t.tint;
    data[k + 11] = t.layer;
  }

  return {
    mesh,
    bake,
    setTree,
    commit() {
      trees.needsUpdate = true;
    },
    ids,
    fades,
    casters,
    casterIds,
    setCasters(n, coarse) {
      // A coarse caster reads its picture a mip blurrier: a softer shadow,
      // and a quarter of the texels a sample.
      uniforms.uCasterLod.value = coarse ? 2 : 1;
      casterGeometry.instanceCount = n;
      casters.visible = n > 0 && target !== null;
      if (n === 0) return;
      casterAttr.clearUpdateRanges();
      casterAttr.addUpdateRange(0, n);
      casterAttr.needsUpdate = true;
    },
    bytes: () => held,
    bakeMs: () => took,
    dispose() {
      target?.dispose();
      trees.dispose();
      geometry.dispose();
      casterGeometry.dispose();
      quad.dispose();
      material.dispose();
      casterMaterial.dispose();
      casterDepth.dispose();
    },
  };
}

/** The hemi-octahedral fold's GLSL, for the test that holds it to
 * `impostor-plan.ts`'s. */
export const IMPOSTOR_GLSL = OCT_GLSL;
export { frameAxes, frameDir, hemiOctDecode, hemiOctEncode };
