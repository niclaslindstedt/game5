// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARK RIDER: the player modelled in Blender (`scripts/blender/park.py`,
// `make models KIND=park`) — an oversized tall hoodie over baggy pants, a
// knit beanie with the goggles worn backwards over it, short leather
// gloves — SKINNED HERE on the dressed skier's own rig, so he is posed by
// every pose the game has (a carve, the tuck, a grab, a landing, thrown,
// a broken arm, a piece torn off) bone for bone, as the loom's skier is.
//
// The model carries no weights of its own: every part rides one root bone
// in the file, and what the game needs is written into its UV instead —
// u how LOOSE the cloth is there (what the air past him moves), v a TAG
// naming what the vertex rides (`PARK_TAGS`). The cloth is weighted with
// the loom's own rule (`clothWeights`), so the half bones at the hips,
// knees, shoulders and elbows and the bones below an arm's break move it
// exactly as they move the dressed skin; the head, the hands and the boots
// ride their bones whole; the hoodie's long hem hangs off the pelvis with
// a share of each thigh, and the hood and the drawstrings off the chest.
//
// THE CLOTH IN THE AIR (`flapCloth`): the hem, the sleeves, the hood, the
// strings and the pants' legs are moved in the vertex shader after the
// skin, by the air past him in his own frame and a spring the hood swings
// on — streamed back and fluttering as he picks up speed, lifted from
// below in a fall, the hood bouncing on a landing. A drawing only: nothing
// is read back and nothing is stepped but one spring a figure.
//
// The model's frame: the builder lays the body frame (x right, y up, z
// forward) into Blender as (−x, z, y), so the glTF comes out a half turn
// about y — (−x, y, −z) is the game's.

import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  clothWeights,
  rides,
  type DressMesh,
  type DressPart,
  type Influence,
} from "./dress-loft.ts";
import type { V3 } from "./skier-pose.ts";
import { SKIER_BONES, type SkierBone } from "./skier-rig.ts";

/** What a vertex rides, by the tag `park.py` writes into its UV's v as
 * (tag + 0.5) / 32 — the two are stated twice and `tests/models_test.ts`
 * holds them together. */
export const PARK_TAGS = {
  cloth: 0,
  head: 1,
  hand_l: 2,
  hand_r: 3,
  forearm_l: 4,
  forearm_r: 5,
  skirt: 6,
  hood: 7,
  boot_l: 8,
  boot_r: 9,
  legs: 10,
  string: 11,
  chest: 12,
} as const;

/** The materials drawn HARD (a shine of their own); every other is cloth. */
export const PARK_HARD = new Set(["lens", "frame", "aglet"]);
/** The goggles, left off indoors (`SkierDress.bare`). */
export const PARK_GOGGLES = new Set(["lens", "frame", "strap", "webbing"]);

const boneIndex = (n: SkierBone): number => SKIER_BONES.indexOf(n);

/** The hoodie's hem: mostly the pelvis, the rest the leg it is over — so a
 * stride parts it a little and a crouch folds it over the thighs, never
 * stretching it between the knees as the pants are. */
function skirtWeights(p: V3): Influence[] {
  const legs = clothWeights(p, ["spine", "thigh_l", "thigh_r"]);
  const pelvis = boneIndex("pelvis");
  // Behind him it hangs off the seat; in front, more of it on the thigh.
  const lean = p.z > 0 ? 0.45 : 0.25;
  const out = new Map<number, number>([[pelvis, 1 - lean]]);
  for (const { bone, w } of legs) out.set(bone, (out.get(bone) ?? 0) + w * lean);
  return [...out.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([bone, w]) => ({ bone, w }));
}

/** The bones a vertex rides, by its tag and where it is in the bind pose. */
export function parkWeights(tag: number, p: V3): Influence[] {
  switch (tag) {
    case PARK_TAGS.head:
      return rides("head");
    case PARK_TAGS.hand_l:
      return rides("hand_l");
    case PARK_TAGS.hand_r:
      return rides("hand_r");
    case PARK_TAGS.forearm_l:
      return clothWeights(p, ["forearm_l"]);
    case PARK_TAGS.forearm_r:
      return clothWeights(p, ["forearm_r"]);
    case PARK_TAGS.skirt:
      return skirtWeights(p);
    case PARK_TAGS.hood:
    case PARK_TAGS.string:
    case PARK_TAGS.chest:
      return rides("chest");
    case PARK_TAGS.boot_l:
      return rides("boot_l");
    case PARK_TAGS.boot_r:
      return rides("boot_r");
    default:
      return clothWeights(p);
  }
}

/** The park rider's two meshes off the loaded glTF, with each cloth
 * vertex's looseness and tag (`flap`) beside them. */
export type ParkMesh = DressMesh & { flap: number[] };

const kept = new Map<string, ParkMesh>();

/** THE PARK RIDER cut from `gltf`: the cloth and the hard goods as the
 * loom's two meshes, `bare` without the goggles. Kept once per glTF and
 * bareness; nothing the caller does with the arrays may write them. */
export function parkDress(gltf: GLTF, bare = false): ParkMesh {
  const key = `${gltf.scene.uuid}:${bare}`;
  const known = kept.get(key);
  if (known) return known;
  const empty = (): DressPart => ({
    position: [],
    normal: [],
    color: [],
    skinIndex: [],
    skinWeight: [],
    index: [],
  });
  const out: ParkMesh = { cloth: empty(), hard: empty(), flap: [] };
  gltf.scene.updateMatrixWorld(true);
  const at = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const turn = new THREE.Matrix3();
  const weights = new Map<string, Influence[]>();
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
      THREE.MeshStandardMaterial | undefined;
    const name = material?.name ?? "";
    if (bare && PARK_GOGGLES.has(name)) return;
    const part = PARK_HARD.has(name) ? out.hard : out.cloth;
    const g = mesh.geometry;
    const pos = g.getAttribute("position");
    const nor = g.getAttribute("normal");
    const uv = g.getAttribute("uv");
    const colour = material?.color ?? new THREE.Color(0.5, 0.5, 0.5);
    turn.getNormalMatrix(mesh.matrixWorld);
    const base = part.position.length / 3;
    for (let i = 0; i < pos.count; i++) {
      at.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      // The half turn about y back into the game's frame.
      const p: V3 = { x: -at.x, y: at.y, z: -at.z };
      if (nor) nrm.fromBufferAttribute(nor, i).applyMatrix3(turn).normalize();
      else nrm.set(0, 1, 0);
      // glTF's v runs down from the top: Blender's (tag + 0.5) / 32 is
      // 1 − v here.
      const loose = uv ? uv.getX(i) : 0;
      const tag = uv ? Math.max(0, Math.round((1 - uv.getY(i)) * 32 - 0.5)) : 0;
      part.position.push(p.x, p.y, p.z);
      part.normal.push(-nrm.x, nrm.y, -nrm.z);
      part.color.push(colour.r, colour.g, colour.b);
      const wkey = `${tag}:${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`;
      let w = weights.get(wkey);
      if (!w) {
        w = parkWeights(tag, p);
        weights.set(wkey, w);
      }
      for (let j = 0; j < 4; j++) {
        part.skinIndex.push(w[j]?.bone ?? 0);
        part.skinWeight.push(w[j]?.w ?? 0);
      }
      if (part === out.cloth) out.flap.push(loose, tag);
    }
    const idx = g.getIndex();
    if (idx) for (let i = 0; i < idx.count; i++) part.index.push(base + idx.getX(i));
    else for (let i = 0; i < pos.count; i++) part.index.push(base + i);
  });
  kept.set(key, out);
  return out;
}

// ---------------------------------------------------------------- the cloth in the air

/** How the cloth answers the air: the most the stream lays it back, m; the
 * flutter's height, m, at its fastest; the speed, m/s, they are full at;
 * the flutter's fastest beat, Hz (held under what a frame can show); the
 * hood's spring (Hz, damping ratio) and the most it swings, m. */
export const FLAP = {
  stream: 0.07,
  flutter: 0.02,
  full: 22,
  beat: 7,
  hood: { hz: 2.2, zeta: 0.22, most: 0.07, gain: 0.0015 },
} as const;

const FLAP_VERT = /* glsl */ `
attribute vec2 flap;
uniform vec3 uFlow;
uniform vec3 uLag;
uniform float uFlapTime;
`;

const FLAP_MOVE = /* glsl */ `
{
  float loose = flap.x;
  float tg = flap.y;
  if (loose > 0.0) {
    float s = length(uFlow);
    vec3 d = s > 0.01 ? uFlow / s : vec3(0.0);
    float k = smoothstep(2.0, ${FLAP.full.toFixed(1)}, s);
    vec3 n = normalize(objectNormal);
    // Laid back along the stream where the cloth faces down it, pressed
    // a little on where it faces into it.
    float face = dot(n, d);
    vec3 stream = d * ${FLAP.stream.toFixed(3)} * k * loose * mix(0.25, 1.0, smoothstep(-0.2, 0.6, face));
    // A ripple running down the cloth with the air, quicker the faster.
    float beat = mix(2.0, ${FLAP.beat.toFixed(1)}, k);
    float wave = sin(6.2832 * beat * uFlapTime - dot(transformed, d) * 22.0 + transformed.y * 9.0)
               + 0.5 * sin(6.2832 * beat * 1.7 * uFlapTime + transformed.x * 31.0);
    vec3 side = n - d * face;
    float flutter = ${FLAP.flutter.toFixed(4)} * k * loose * wave;
    vec3 move = stream + side * flutter;
    // The hood and the drawstrings swing on their spring.
    if (abs(tg - 7.0) < 0.5) move += uLag * loose;
    if (abs(tg - 11.0) < 0.5) move += uLag * 1.3 + d * 0.03 * k;
    transformed += move;
  }
}
`;

/** Every park rider's cloth now drawn, stepped by `tickPark`. */
const live = new Set<(dt: number) => void>();

/** Step every park rider's cloth by a drawn frame's `dt`, s — the
 * renderer's own frame (so a lab that draws a run at its own pace sees the
 * cloth as the game would); read off where each figure was last drawn. */
export function tickPark(dt: number): void {
  if (!(dt > 0 && dt < 1)) return;
  for (const step of live) step(dt);
}

/** The spring's own step, s: the hood is stepped in as many as a frame
 * holds, so a long frame never throws it off. */
const SUB = 1 / 120;

/** Hang THE CLOTH IN THE AIR on a park rider's cloth mesh: `geo` takes the
 * `flap` attribute, `material` the shader's lines (after the world's own
 * `onBeforeCompile`), and the mesh's motion as last drawn feeds them each
 * `tickPark`. Returns the call that lets it go. */
export function flapCloth(
  mesh: THREE.SkinnedMesh,
  material: THREE.MeshStandardMaterial,
  flap: number[],
): () => void {
  mesh.geometry.setAttribute("flap", new THREE.Float32BufferAttribute(flap, 2));
  const uniforms = {
    uFlow: { value: new THREE.Vector3() },
    uLag: { value: new THREE.Vector3() },
    uFlapTime: { value: 0 },
  };
  const before = material.onBeforeCompile.bind(material);
  const keyBefore = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `${FLAP_VERT}\n${shader.vertexShader}`.replace(
      "#include <skinning_vertex>",
      `#include <skinning_vertex>\n${FLAP_MOVE}`,
    );
  };
  material.customProgramCacheKey = () => `${keyBefore()}|park-flap`;

  let seen = false;
  const last = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const lag = new THREE.Vector3();
  const lagV = new THREE.Vector3();
  const now = new THREE.Vector3();
  const v = new THREE.Vector3();
  const accel = new THREE.Vector3();
  const rest = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const { hz, zeta, most, gain } = FLAP.hood;
  const w = 2 * Math.PI * hz;
  const step = (dt: number): void => {
    mesh.matrixWorld.decompose(now, turn, scale);
    if (!seen || now.distanceTo(last) > 8) {
      seen = true;
      last.copy(now);
      vel.set(0, 0, 0);
      lag.set(0, 0, 0);
      lagV.set(0, 0, 0);
      return;
    }
    v.copy(now).sub(last).divideScalar(dt);
    if (v.length() > 80) v.setLength(80);
    last.copy(now);
    accel.copy(v).sub(vel).divideScalar(dt);
    vel.lerp(v, Math.min(1, dt * 12));
    turn.invert();
    // The air past him in his own frame: his own way, the other way.
    const flow = uniforms.uFlow.value.copy(vel).negate().applyQuaternion(turn);
    // THE HOOD'S SPRING, thrown about by how he is (its rest laid back a
    // little in the air past him).
    accel.applyQuaternion(turn).multiplyScalar(-gain);
    rest.copy(flow).multiplyScalar(0.0012);
    const n = Math.max(1, Math.ceil(dt / SUB));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      lagV.x += (-w * w * (lag.x - rest.x - accel.x) - 2 * zeta * w * lagV.x) * h;
      lagV.y += (-w * w * (lag.y - rest.y - accel.y) - 2 * zeta * w * lagV.y) * h;
      lagV.z += (-w * w * (lag.z - rest.z - accel.z) - 2 * zeta * w * lagV.z) * h;
      lag.addScaledVector(lagV, h);
    }
    if (lag.length() > most) lag.setLength(most);
    uniforms.uLag.value.copy(lag);
    uniforms.uFlapTime.value = (uniforms.uFlapTime.value + dt) % 600;
  };
  live.add(step);
  return () => live.delete(step);
}
