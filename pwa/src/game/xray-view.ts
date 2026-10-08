// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY AS DRAWN: the skier's skin turned to glass and, inside it, his
// SKELETON AND ORGANS (`xray-model.ts` — one man's CT, thinned and fitted
// onto the rig) riding the very bone frames his dressed skin is posed by,
// so every bone is where the body round it is, on his skis or thrown.
//
// What the engine has done to him is drawn on them as it happens, off his
// body's own record (`fracturesOf`, `fractureEnergyOf`, `organsOf`):
//   * a HAIRLINE crack glows across the bone;
//   * a BREAK snaps the bone in two at its break — the pieces shoved past
//     each other the harder the energy that did it, the bone flashing white
//     as it goes and reddening from the break;
//   * a WEDGE knocks a butterfly fragment out of the side; a SHATTER
//     throws the pieces round the break apart, each its own way;
//   * a hurt ORGAN swells and throbs dark red on his heart's beat;
//   * the blood from a break or a torn organ pools inside him
//     (`xray-blood.ts`).
// A piece torn off him (`gore.ts`) takes its bones out of the skeleton.
//
// It is an X-RAY: nothing in the world hides him while it is on — the veil
// clears the depth behind it, so a trunk, a piste machine or the snow he is
// buried in never stands between the lens and his bones — and only his own
// skin, where it still stands, does (a depth-only MASK of the solid patches
// drawn just after the veil).
//
// The skin is never swapped for the glass in one frame: the glass is a
// second skin over it, and the skin itself DISSOLVES away in patches as the
// X-ray comes in and grows back over the bones as it goes, a glowing edge
// on the front, until he is solid again.
//
// The model is its own chunk, loaded the first time a run with injuries on
// is drawn; until it is in, nothing is drawn.

import * as THREE from "three";

import {
  BONES,
  ORGANS,
  fractureEnergyOf,
  fracturesOf,
  lostPiece,
  organsOf,
  type Bone,
  type GameState,
  type GorePiece,
  type Organ,
} from "@engine";

import type { SkierBone, BoneFrame } from "./skier-rig.ts";
import { BLEED, CAVITY, createXrayBlood, type Bleed } from "./xray-blood.ts";
import type { XrayLook } from "./xray-shots.ts";

/** What the view reads off the figure: his skin's bone frames, the group
 * that places them, and its meshes. */
export type XraySkin = {
  frames: Record<SkierBone, BoneFrame>;
  group: THREE.Object3D;
};

export type XrayView = {
  group: THREE.Group;
  /** Draw this frame: the look, the run, his skin. */
  update(look: XrayLook, state: GameState, skin: XraySkin, meshes: THREE.Mesh[]): void;
  /** Where a bone (or an organ) is, world frame, at the last update. */
  centreOf(name: Bone | Organ, out: THREE.Vector3): THREE.Vector3 | null;
  /** Where his trunk is. */
  bodyCentre(out: THREE.Vector3): THREE.Vector3 | null;
  dispose(): void;
};

/** THE LOOK of the glass and what is under it. */
export const XRAY_LOOK = {
  bone: 0xf2ecd8,
  rim: 0x9fe8ff,
  crack: 0xffb030,
  broken: 0xff2a14,
  glass: 0x0d2a44,
  glassRim: 0x7fd8ff,
  organ: {
    brain: 0xe8a0a8,
    heart: 0xc8202c,
    lung: 0xf07888,
    liver: 0x8a2018,
    spleen: 0x902038,
    stomach: 0xe08878,
    bowel: 0xe8a088,
    kidney: 0xa02818,
    bladder: 0xe8d070,
  } as Record<string, number>,
  hurt: 0x600008,
  veil: 0x02060c,
} as const;

/** Which rig bones a torn piece takes with it. */
const TORN: Record<GorePiece, readonly SkierBone[]> = {
  head: ["head"],
  armL: ["upperarm_l", "forearm_l", "hand_l"],
  armR: ["upperarm_r", "forearm_r", "hand_r"],
  forearmL: ["forearm_l", "hand_l"],
  forearmR: ["forearm_r", "hand_r"],
  legL: ["thigh_l", "shin_l", "boot_l"],
  legR: ["thigh_r", "shin_r", "boot_r"],
  shinL: ["shin_l", "boot_l"],
  shinR: ["shin_r", "boot_r"],
  lower: ["thigh_l", "shin_l", "boot_l", "thigh_r", "shin_r", "boot_r"],
};

const hash = (i: number, k: number): number => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const VERT = /* glsl */ `
uniform float uBreak;
uniform float uGrade;
uniform float uEnergy;
uniform float uOpen;
uniform float uSector;
uniform float uSwell;
uniform vec3 uAxis;
uniform vec3 uPerp;
uniform vec3 uMid;
attribute vec3 aCentre;
attribute float aAlong;
attribute float aAround;
attribute float aCell;
varying vec3 vNormal;
varying vec3 vView;
varying float vAlong;
varying float vShard;

float h1(float n) { return fract(sin(n * 91.3458) * 47453.5453); }

vec3 turn(vec3 v, vec3 axis, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}

void main() {
  vec3 p = position;
  vec3 n = normal;
  vec3 c = aCentre;
  vShard = 0.0;
  p += normal * uSwell;
  if (uGrade >= 2.0 && uOpen > 0.0) {
    float side = aAlong < uBreak ? -1.0 : 1.0;
    float e = uEnergy;
    // The two ends shoved past each other and apart.
    vec3 shove = uAxis * side * (0.004 + 0.006 * e) + uPerp * side * (0.006 + 0.012 * e);
    vec3 off = vec3(0.0);
    float near = abs(aAlong - uBreak);
    vec3 rc = c - uMid;
    vec3 radial = normalize(rc - uAxis * dot(rc, uAxis) + 1e-4 * uPerp);
    if (uGrade >= 4.0 && near < 0.16) {
      // SHATTERED: every shard its own way.
      float r = h1(aCell);
      off = radial * (0.008 + 0.018 * r) * e + uAxis * (h1(aCell + 7.0) - 0.5) * 0.02 * e;
      float a = (h1(aCell + 3.0) - 0.5) * 1.6;
      vec3 ax = normalize(vec3(h1(aCell + 1.0) - 0.5, h1(aCell + 2.0) - 0.5, h1(aCell + 5.0) - 0.5));
      p = c + turn(p - c, ax, a * uOpen);
      n = turn(n, ax, a * uOpen);
      vShard = 1.0;
    } else if (uGrade >= 3.0 && near < 0.09 && abs(mod(aAround - uSector + 3.14159, 6.28318) - 3.14159) < 0.9) {
      // A WEDGE: the butterfly knocked out of the side.
      off = radial * (0.018 + 0.02 * e);
      vShard = 1.0;
    }
    p += (shove + off) * uOpen;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * n);
  vView = -mv.xyz;
  vAlong = aAlong;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColour;
uniform vec3 uRim;
uniform vec3 uCrack;
uniform vec3 uBroken;
uniform float uBreak;
uniform float uGrade;
uniform float uFlash;
uniform float uHurt;
uniform float uAlpha;
varying vec3 vNormal;
varying vec3 vView;
varying float vAlong;
varying float vShard;

void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vView);
  float lit = 0.35 + 0.65 * max(0.0, dot(n, normalize(vec3(-0.35, 0.75, 0.55))));
  float rim = pow(1.0 - max(0.0, dot(n, v)), 2.0);
  vec3 col = uColour * lit + uRim * rim * 0.7;
  float near = abs(vAlong - uBreak);
  if (uGrade >= 1.0) {
    // The crack across the bone, glowing.
    float band = 1.0 - smoothstep(0.006, 0.02 + 0.01 * uGrade, near);
    col = mix(col, uCrack * 1.6, band * (uGrade >= 2.0 ? 0.5 : 1.0));
  }
  if (uGrade >= 2.0) {
    // A break reddens from the break out; a shard all red.
    float red = max(exp(-near * 9.0), vShard);
    col = mix(col, uBroken * (0.6 + 0.6 * lit), clamp(red, 0.0, 1.0) * 0.85);
  }
  col = mix(col, uBroken * 0.7 + uRim * rim * 0.3, uHurt);
  col = mix(col, vec3(1.6), uFlash);
  gl_FragColor = vec4(col, uAlpha);
  #include <colorspace_fragment>
}
`;

const GLASS_VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
varying vec3 vNormal;
varying vec3 vView;
void main() {
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vNormal = normalize(transformedNormal);
  vView = -mvPosition.xyz;
}
`;

const GLASS_FRAG = /* glsl */ `
uniform vec3 uGlass;
uniform vec3 uRim;
uniform float uAlpha;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 n = normalize(vNormal);
  float f = pow(1.0 - abs(dot(n, normalize(vView))), 2.2);
  vec3 col = mix(uGlass, uRim, f);
  gl_FragColor = vec4(col, uAlpha * (0.06 + 0.5 * f));
  #include <colorspace_fragment>
}
`;

/** THE VEIL: a dark sheet over the whole frame, drawn after the world and
 * before the glass, so the bones glow against a dimmed world as on a
 * radiograph, darkest at the corners. */
const VEIL_FRAG = /* glsl */ `
uniform float uAlpha;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  vec2 d = vUv - 0.5;
  float corner = smoothstep(0.25, 0.75, length(d) * 1.2);
  gl_FragColor = vec4(uTint, uAlpha * (0.72 + 0.26 * corner));
  #include <colorspace_fragment>
}
`;

/** The order the X-ray draws in, after every effect in the world. */
const ORDER = { veil: 20, mask: 20.5, glass: 21, organ: 22, bone: 23, blood: 24 } as const;

/** THE DISSOLVE, grafted onto the skin's own material: each fragment
 * dropped while a noise over the body's own (bind-pose) surface stands above
 * how solid he is, a glowing edge along the front. */
const DISSOLVE_VERT_PARS = "varying vec3 vXrBody;\n";
const DISSOLVE_VERT = "vXrBody = position;\n";
const DISSOLVE_PARS = /* glsl */ `
uniform float uXrSolid;
uniform vec3 uXrEdge;
varying vec3 vXrBody;
float xrHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float xrNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(xrHash(i), xrHash(i + vec3(1, 0, 0)), f.x), mix(xrHash(i + vec3(0, 1, 0)), xrHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(xrHash(i + vec3(0, 0, 1)), xrHash(i + vec3(1, 0, 1)), f.x), mix(xrHash(i + vec3(0, 1, 1)), xrHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float xrPatch() { return xrNoise(vXrBody * 9.0) * 0.65 + xrNoise(vXrBody * 23.0) * 0.35; }
`;
const DISSOLVE_MAIN = /* glsl */ `
  float xrCut = uXrSolid * 1.1 - 0.05;
  if (uXrSolid < 1.0 && xrPatch() > xrCut) discard;
`;
/** THE MASK: his skin's solid patches, depth only. */
const MASK_VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
varying vec3 vXrBody;
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  vXrBody = position;
  #include <skinning_vertex>
  #include <project_vertex>
}
`;
const MASK_FRAG = /* glsl */ `
${DISSOLVE_PARS}
void main() {
${DISSOLVE_MAIN}
  gl_FragColor = vec4(0.0);
}
`;
const DISSOLVE_EDGE = /* glsl */ `
  if (uXrSolid < 1.0) {
    float xrEdge = 1.0 - smoothstep(0.0, 0.05, xrCut - xrPatch());
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uXrEdge * 1.6, xrEdge);
  }
`;

type Piece = {
  name: Bone | Organ;
  organ: boolean;
  bone: SkierBone;
  bind: number;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  centre: THREE.Vector3;
  /** Where a bone breaks (its frame), and the axis it lies along. */
  breakAt: THREE.Vector3;
  axis: THREE.Vector3;
  /** Index in `BONES` or `ORGANS`. */
  slot: number;
};

/** A piece's corners and triangles, flat-shaded, with the attributes the
 * fracture is drawn by: each triangle's centre, where along the bone's
 * long axis it lies (0 … 1), round it, and its shard's number. */
function pieceGeometry(
  pos: Int16Array,
  idx: Uint16Array,
  unit: number,
): {
  geo: THREE.BufferGeometry;
  axis: THREE.Vector3;
  perp: THREE.Vector3;
  centre: THREE.Vector3;
  lo: number;
  span: number;
} {
  const nv = pos.length / 3;
  const v = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i++) v[i] = pos[i] * unit;
  // THE LONG AXIS: the corners' principal direction, by power iteration.
  const m = new THREE.Vector3();
  for (let i = 0; i < nv; i++) m.add(new THREE.Vector3(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]));
  m.multiplyScalar(1 / nv);
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < nv; i++) {
    const d = [v[i * 3] - m.x, v[i * 3 + 1] - m.y, v[i * 3 + 2] - m.z];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a * 3 + b] += d[a] * d[b];
  }
  const axis = new THREE.Vector3(0.1, 1, 0.05).normalize();
  for (let k = 0; k < 24; k++) {
    axis.set(
      C[0] * axis.x + C[1] * axis.y + C[2] * axis.z,
      C[3] * axis.x + C[4] * axis.y + C[5] * axis.z,
      C[6] * axis.x + C[7] * axis.y + C[8] * axis.z,
    );
    axis.normalize();
  }
  if (axis.y < 0) axis.negate();
  const perp = new THREE.Vector3(1, 0, 0).sub(axis.clone().multiplyScalar(axis.x));
  if (perp.lengthSq() < 1e-4) perp.set(0, 0, 1).sub(axis.clone().multiplyScalar(axis.z));
  perp.normalize();
  const third = new THREE.Vector3().crossVectors(axis, perp);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < nv; i++) {
    const s = axis.x * v[i * 3] + axis.y * v[i * 3 + 1] + axis.z * v[i * 3 + 2];
    lo = Math.min(lo, s);
    hi = Math.max(hi, s);
  }
  const span = hi - lo || 1;
  const nt = idx.length / 3;
  const position = new Float32Array(nt * 9);
  const centre = new Float32Array(nt * 9);
  const along = new Float32Array(nt * 3);
  const around = new Float32Array(nt * 3);
  const cell = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let k = 0; k < 3; k++) {
      const j = idx[t * 3 + k] * 3;
      position.set([v[j], v[j + 1], v[j + 2]], t * 9 + k * 3);
      cx += v[j] / 3;
      cy += v[j + 1] / 3;
      cz += v[j + 2] / 3;
    }
    const s = (axis.x * cx + axis.y * cy + axis.z * cz - lo) / span;
    const dx = cx - m.x;
    const dy = cy - m.y;
    const dz = cz - m.z;
    const a = Math.atan2(
      third.x * dx + third.y * dy + third.z * dz,
      perp.x * dx + perp.y * dy + perp.z * dz,
    );
    const id = Math.floor(s * 9) * 16 + Math.floor(((a + Math.PI) / (2 * Math.PI)) * 6);
    for (let k = 0; k < 3; k++) {
      centre.set([cx, cy, cz], t * 9 + k * 3);
      along[t * 3 + k] = s;
      around[t * 3 + k] = a;
      cell[t * 3 + k] = id;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geo.setAttribute("aCentre", new THREE.BufferAttribute(centre, 3));
  geo.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  geo.setAttribute("aAround", new THREE.BufferAttribute(around, 1));
  geo.setAttribute("aCell", new THREE.BufferAttribute(cell, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return { geo, axis, perp, centre: m, lo, span };
}

const decode = (b64: string): Uint8Array => {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

export function createXrayView(): XrayView {
  const group = new THREE.Group();
  group.name = "xray";
  group.visible = false;
  let pieces: Piece[] | null = null;
  let loading = false;
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const glass = new THREE.ShaderMaterial({
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
    uniforms: {
      uGlass: { value: new THREE.Color(XRAY_LOOK.glass) },
      uRim: { value: new THREE.Color(XRAY_LOOK.glassRim) },
      uAlpha: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    // Drawn over the skin where it still stands, at the skin's own depth.
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  mats.push(glass);
  /** The glass skin over each of his skin's meshes, and the mask of its
   * solid patches. */
  const shells = new Map<THREE.Mesh, THREE.SkinnedMesh[]>();
  /** How solid his skin is (1 whole, 0 gone), read by the dissolve. */
  const solid = { value: 1 };
  const edge = { value: new THREE.Color(XRAY_LOOK.glassRim) };
  const mask = new THREE.ShaderMaterial({
    vertexShader: MASK_VERT,
    fragmentShader: MASK_FRAG,
    uniforms: { uXrSolid: solid, uXrEdge: edge },
    transparent: true,
    colorWrite: false,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  mats.push(mask);
  const grafted = new WeakSet<THREE.Material>();
  const blood = createXrayBlood(ORDER.blood);

  const veilGeo = new THREE.PlaneGeometry(2, 2);
  geos.push(veilGeo);
  const veilMat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 }, uTint: { value: new THREE.Color(XRAY_LOOK.veil) } },
    vertexShader:
      "varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: VEIL_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  mats.push(veilMat);
  const veil = new THREE.Mesh(veilGeo, veilMat);
  veil.frustumCulled = false;
  veil.renderOrder = ORDER.veil;
  // Nothing in the world hides him under the X-ray.
  veil.onBeforeRender = (r) => r.clearDepth();
  group.add(veil);
  group.add(blood.group);

  const load = (): void => {
    if (loading) return;
    loading = true;
    void import("./xray-model.ts").then((m) => {
      const list: Piece[] = [];
      const add = (
        p: { name: Bone | Organ; bone: SkierBone; pos: string; idx: string },
        organ: boolean,
      ) => {
        const pos = new Int16Array(decode(p.pos).buffer);
        const idx = new Uint16Array(decode(p.idx).buffer);
        const g = pieceGeometry(pos, idx, m.XRAY_UNIT);
        geos.push(g.geo);
        const slot = organ ? ORGANS.indexOf(p.name as Organ) : BONES.indexOf(p.name as Bone);
        const kind = p.name.replace(/[LR]$/, "");
        const cut = organ ? 0.5 : 0.35 + 0.3 * hash(slot, 1);
        const onAxis = g.lo + cut * g.span - g.axis.dot(g.centre);
        const breakAt = g.centre.clone().addScaledVector(g.axis, onAxis);
        const mat = new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: FRAG,
          uniforms: {
            uBreak: { value: organ ? 2 : cut },
            uGrade: { value: 0 },
            uEnergy: { value: 0 },
            uOpen: { value: 0 },
            uSector: { value: (hash(slot, 2) - 0.5) * 2 * Math.PI },
            uSwell: { value: 0 },
            uAxis: { value: g.axis },
            uPerp: { value: g.perp },
            uMid: { value: g.centre },
            uColour: {
              value: new THREE.Color(organ ? (XRAY_LOOK.organ[kind] ?? 0xd06070) : XRAY_LOOK.bone),
            },
            uRim: { value: new THREE.Color(organ ? 0xffc0c0 : XRAY_LOOK.rim) },
            uCrack: { value: new THREE.Color(XRAY_LOOK.crack) },
            uBroken: { value: new THREE.Color(organ ? XRAY_LOOK.hurt : XRAY_LOOK.broken) },
            uFlash: { value: 0 },
            uHurt: { value: 0 },
            uAlpha: { value: 1 },
          },
          transparent: true,
          side: THREE.DoubleSide,
        });
        mats.push(mat);
        const mesh = new THREE.Mesh(g.geo, mat);
        mesh.matrixAutoUpdate = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = organ ? ORDER.organ : ORDER.bone;
        group.add(mesh);
        list.push({
          name: p.name,
          organ,
          bone: p.bone,
          bind: m.XRAY_BIND[p.bone] ?? 1,
          mesh,
          mat,
          centre: g.centre,
          breakAt,
          axis: g.axis,
          slot,
        });
      };
      for (const p of m.XRAY_BONES) add(p, false);
      for (const p of m.XRAY_ORGANS) add(p, true);
      pieces = list;
    });
  };

  const basis = new THREE.Matrix4();
  /** Graft the dissolve onto his skin's materials and hang a glass skin
   * over each mesh — once, as soon as a run that can show the X-ray is
   * drawn, so the program is linked long before the first blow. */
  const dress = (meshes: THREE.Mesh[]): void => {
    for (const m of meshes) {
      // The glass skins hang beside his own: never grafted, never shelled.
      if (m.material === glass || m.material === mask) continue;
      const mat = m.material as THREE.Material;
      if (!grafted.has(mat)) {
        grafted.add(mat);
        const before = mat.onBeforeCompile.bind(mat);
        const key = mat.customProgramCacheKey.bind(mat);
        mat.onBeforeCompile = (shader, r) => {
          before(shader, r);
          shader.uniforms.uXrSolid = solid;
          shader.uniforms.uXrEdge = edge;
          shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>\n${DISSOLVE_VERT_PARS}`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>\n${DISSOLVE_VERT}`);
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\n${DISSOLVE_PARS}`)
            .replace("void main() {", `void main() {\n${DISSOLVE_MAIN}`)
            .replace(
              "#include <dithering_fragment>",
              `#include <dithering_fragment>\n${DISSOLVE_EDGE}`,
            );
        };
        mat.customProgramCacheKey = (): string => `${key()}:xray`;
        mat.needsUpdate = true;
      }
      const sk = m as THREE.SkinnedMesh;
      if (!shells.has(m) && sk.isSkinnedMesh && m.parent) {
        const two = (
          [
            [glass, ORDER.glass],
            [mask, ORDER.mask],
          ] as const
        ).map(([mat, order]) => {
          const shell = new THREE.SkinnedMesh(m.geometry, mat);
          shell.bind(sk.skeleton, sk.bindMatrix);
          shell.frustumCulled = false;
          shell.renderOrder = order;
          shell.visible = false;
          m.parent!.add(shell);
          return shell;
        });
        shells.set(m, two);
      }
    }
  };
  const showGlass = (xray: number): void => {
    solid.value = 1 - xray;
    glass.uniforms.uAlpha.value = Math.min(1, xray * 1.2);
    for (const two of shells.values()) for (const shell of two) shell.visible = xray > 0.01;
  };

  /** Each bone's fracture, its energy and the game second it came. */
  const brokeAt = new Map<Bone, number>();
  const hurtAt = new Map<Organ, number>();
  const seenGrade: number[] = [];
  let lastState: GameState | null = null;

  /** A broken bone's bleed: round its break, or in the cavity it bounds. */
  const boneBleed = (p: Piece, grade: number, since: number): Bleed => {
    const kind = p.name.replace(/[LR]$/, "") as keyof typeof BLEED.bone;
    const radius = (BLEED.bone[kind] ?? 0.03) * (grade >= 2 ? 1 : BLEED.hairline);
    const into = CAVITY[kind];
    const room = into && pieces?.find((q) => q.name === into && q.mesh.visible);
    if (room)
      return { key: p.name, matrix: room.mesh.matrix, at: room.centre, axis: null, radius, since };
    return { key: p.name, matrix: p.mesh.matrix, at: p.breakAt, axis: p.axis, radius, since };
  };

  return {
    group,
    update(look, state, skin, meshes) {
      if (state !== lastState) {
        brokeAt.clear();
        hurtAt.clear();
        seenGrade.length = 0;
        blood.clear();
        lastState = state;
      }
      // The model is fetched, and his skin dressed for it, as soon as a run
      // with injuries on is drawn, so both are in long before the first blow.
      if (state.gore) {
        load();
        dress(meshes);
      }
      const on = look.active && look.xray > 0.01;
      showGlass(on ? look.xray : 0);
      if (!on) {
        group.visible = false;
        return;
      }
      if (!pieces) return;
      group.visible = true;
      veilMat.uniforms.uAlpha.value = Math.min(1, look.xray * 1.2);
      const body = state.skier.body;
      const grade = fracturesOf(body);
      const energy = fractureEnergyOf(body);
      const organ = organsOf(body);
      // A bone breaks (or breaks worse) the frame its grade rises.
      for (let i = 0; i < BONES.length; i++)
        if (grade[i] > (seenGrade[i] ?? 0)) {
          seenGrade[i] = grade[i];
          brokeAt.set(BONES[i], state.t);
        }
      for (let i = 0; i < ORGANS.length; i++)
        if (organ[i] > 0 && !hurtAt.has(ORGANS[i])) hurtAt.set(ORGANS[i], state.t);
      const gone = new Set<SkierBone>();
      if (state.gore)
        for (const p of Object.keys(TORN) as GorePiece[])
          if (lostPiece(state.gore, p)) for (const b of TORN[p]) gone.add(b);
      skin.group.updateWorldMatrix(true, false);
      const world = skin.group.matrixWorld;
      const beat = state.gore ? state.gore.pulse : 0.5 + 0.5 * Math.sin(state.t * 7.5);
      const alpha = Math.min(1, look.xray * 1.25);
      const bleeds: Bleed[] = [];
      for (const p of pieces) {
        const f = skin.frames[p.bone];
        p.mesh.visible = !!f && !gone.has(p.bone);
        if (!p.mesh.visible) continue;
        const k = f.length / p.bind;
        basis.set(
          f.x.x,
          f.y.x * k,
          f.z.x,
          f.head.x,
          f.x.y,
          f.y.y * k,
          f.z.y,
          f.head.y,
          f.x.z,
          f.y.z * k,
          f.z.z,
          f.head.z,
          0,
          0,
          0,
          1,
        );
        p.mesh.matrix.multiplyMatrices(world, basis);
        p.mesh.matrixWorldNeedsUpdate = true;
        const u = p.mat.uniforms;
        u.uAlpha.value = alpha;
        if (p.organ) {
          const ais = organ[p.slot];
          const age = ais > 0 ? state.t - (hurtAt.get(p.name as Organ) ?? state.t) : -1;
          u.uHurt.value = ais > 0 ? Math.min(1, 0.35 + 0.15 * ais) * (0.7 + 0.3 * beat) : 0;
          u.uSwell.value = ais > 0 ? 0.002 * ais * (0.6 + 0.4 * beat) : 0;
          u.uFlash.value = age >= 0 && age < 0.1 ? 0.6 * (1 - age / 0.1) : 0;
          // A torn organ bleeds into its cavity.
          if (ais >= 3)
            bleeds.push({
              key: p.name,
              matrix: p.mesh.matrix,
              at: p.centre,
              axis: null,
              radius: BLEED.organ[p.name.replace(/[LR]$/, "")] ?? 0.05,
              since: hurtAt.get(p.name as Organ) ?? state.t,
            });
        } else {
          const g = grade[p.slot];
          const age = g > 0 ? state.t - (brokeAt.get(p.name as Bone) ?? state.t) : -1;
          u.uGrade.value = g;
          u.uEnergy.value = Math.min(3, energy[p.slot]);
          // The break SNAPS open over a few hundredths of a second.
          u.uOpen.value = g >= 2 ? Math.min(1, Math.max(0, age) / 0.06) : 0;
          u.uFlash.value = age >= 0 && age < 0.08 ? 1 - age / 0.08 : 0;
          if (g > 0) bleeds.push(boneBleed(p, g, brokeAt.get(p.name as Bone) ?? state.t));
        }
      }
      blood.update(bleeds, state.t, alpha, beat);
    },
    centreOf(name, out) {
      const p = pieces?.find((q) => q.name === name);
      if (!p || !p.mesh.visible) return null;
      return out.copy(p.centre).applyMatrix4(p.mesh.matrix);
    },
    bodyCentre(out) {
      const p = pieces?.find((q) => q.name === "lumbar") ?? null;
      if (!p) return null;
      return out.copy(p.centre).applyMatrix4(p.mesh.matrix);
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const two of shells.values()) for (const shell of two) shell.parent?.remove(shell);
      shells.clear();
      blood.dispose();
    },
  };
}
