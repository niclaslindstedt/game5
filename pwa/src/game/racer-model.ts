// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD CUP RACER, MODELLED: the one skier the game draws as a Blender
// model rather than cut in code (`make blender KIND=racer`, `racer.py`) —
// a printed one-piece race suit over a back protector, the bib, the shin,
// arm and hand guards and a slalom helmet with its chin guard. He is worn
// as the BODY row's RACER on the DRESS card (`outfit.ts`), and drawn by
// `skier-dress.ts` in place of the code's cloth on the very skeleton the
// code's dress is skinned on: his skin was laid in the same bind pose
// (`dress-loft.ts`' `bindPose`) and is weighted to the same bones, by
// name, so every pose, clip and animation the game plays moves him bone
// for bone, unchanged.
//
// WHAT THE AIR DOES TO HIM is the shader's (`graftWind`): his bib is a
// tabard open at the sides, so its hem and free edges stream back in the
// air past him and flutter, the faster he goes; his suit is skin tight, so
// all it does is RIPPLE in a fine shiver on its lee side, where the flow
// leaves it. Both read his airflow — his own motion through still air,
// taken off the skeleton's world place frame by frame — turned into the
// frame his chest was bound in, so the bib streams back whichever way he
// is folded.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { bindPose } from "./dress-loft.ts";
import { SKIER_BONES, type BoneFrame } from "./skier-rig.ts";

/** THE WIND'S NUMBERS: how the bib and the suit answer the air. */
export const RACER_WIND = {
  /** The airflow, m/s, at which the bib streams fully back. */
  full: 22,
  /** How far its hem streams back at full stream, m, and flutters off the
   * suit along its normal. */
  stream: 0.06,
  flutter: 0.022,
  /** The flutter's beat, rad/s, at rest and gained per m/s of air. */
  beat: 8,
  beatPerMs: 0.42,
  /** The suit's lee-side ripple, m at full stream, and its beat's gain. */
  ripple: 0.0018,
  /** How quickly the airflow read off his motion settles, 1/s. */
  settle: 6,
} as const;

/** One part of the model: its geometry in the body frame's bind pose,
 * skinned on `SKIER_BONES`, and its material as the model made it. */
export type RacerPart = {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  /** Whether the air moves it (the bib's flutter, the suit's ripple). */
  wind: "bib" | "suit" | null;
};

let loaded: RacerPart[] | null = null;
let loading: Promise<void> | null = null;

/** The model's parts once `loadRacer` has fetched them, else `null` (the
 * RACER body is then the code's dressed skier). */
export function racerParts(): RacerPart[] | null {
  return loaded;
}

/** Fetch the racer once from `url` (`skier-models.ts`'s `racerModelUrl`,
 * `null` when the build packs none); resolves when he is in (or given up on). */
export function loadRacer(url: string | null): Promise<void> {
  if (loading) return loading;
  if (!url) return (loading = Promise.resolve());
  loading = new GLTFLoader().loadAsync(url).then(
    (g) => {
      loaded = racerFrom(g.scene);
    },
    () => undefined,
  );
  return loading;
}

const smoothstep = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** HOW FREE A POINT OF THE BIB IS (0 pinned, 1 its loose hem's corner):
 * the bib hangs off his shoulders and lies on his chest and back, so it is
 * held at the top and free toward its hem, freest at its open sides. */
export function bibFreedom(p: THREE.Vector3, chest: BoneFrame, pelvis: BoneFrame): number {
  const top = chest.head.y + chest.y.y * chest.length * 0.75;
  const hem = pelvis.head.y + 0.02;
  const down = smoothstep((top - p.y) / Math.max(0.1, top - hem));
  const across = Math.min(1, Math.abs(p.x) / 0.16);
  return down ** 1.4 * (0.55 + 0.45 * across * across);
}

/** The model's skinned meshes, read off its glTF scene into the body
 * frame (the glTF's frame turned half round about y) and its joints
 * renamed to `SKIER_BONES`' order. */
export function racerFrom(scene: THREE.Object3D): RacerPart[] {
  scene.updateMatrixWorld(true);
  const bind = bindPose().frames;
  const flip = new THREE.Matrix4().makeRotationY(Math.PI);
  const parts: RacerPart[] = [];
  const v = new THREE.Vector3();
  scene.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const src = o.geometry as THREE.BufferGeometry;
    const g = new THREE.BufferGeometry();
    const toBody = flip.clone().multiply(o.bindMatrix);
    const pos = src.getAttribute("position").clone() as THREE.BufferAttribute;
    pos.applyMatrix4(toBody);
    g.setAttribute("position", pos);
    const nrm = src.getAttribute("normal").clone() as THREE.BufferAttribute;
    nrm.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(toBody));
    g.setAttribute("normal", nrm);
    const uv = src.getAttribute("uv");
    if (uv) g.setAttribute("uv", uv.clone());
    // The joints by name: the model's skeleton to the game's.
    const names = o.skeleton.bones.map((b) => b.name);
    const index = names.map((n) => (SKIER_BONES as readonly string[]).indexOf(n));
    const si = src.getAttribute("skinIndex");
    const sw = src.getAttribute("skinWeight");
    const idx = new Uint16Array(si.count * 4);
    const wts = new Float32Array(si.count * 4);
    for (let i = 0; i < si.count; i++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        const j = index[si.getComponent(i, k)] ?? -1;
        const w = j < 0 ? 0 : sw.getComponent(i, k);
        idx[i * 4 + k] = Math.max(0, j);
        wts[i * 4 + k] = w;
        sum += w;
      }
      for (let k = 0; k < 4; k++) wts[i * 4 + k] /= sum || 1;
      if (!sum) wts[i * 4] = 1;
    }
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(wts, 4));
    if (src.index) g.setIndex(src.index.clone());
    const material = (o.material as THREE.MeshStandardMaterial).clone();
    const name = material.name;
    const wind = name === "bib" ? "bib" : name === "suit" ? "suit" : null;
    // A white vertex colour under the print, so blood soaks into the suit as
    // into the code's cloth (`gore-soak.ts`).
    const white = new Float32Array(pos.count * 3).fill(1);
    g.setAttribute("color", new THREE.BufferAttribute(white, 3));
    material.vertexColors = true;
    // How free each point is in the air.
    const free = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      free[i] = wind === "bib" ? bibFreedom(v, bind.chest, bind.pelvis) : wind === "suit" ? 1 : 0;
    }
    g.setAttribute("flap", new THREE.BufferAttribute(free, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2.2);
    if (name === "bib") material.side = THREE.DoubleSide;
    parts.push({ name, geometry: g, material, wind });
  });
  return parts;
}

/** The wind's uniforms, one set a dressed racer. */
export type RacerWind = {
  uniforms: { uAir: { value: THREE.Vector3 }; uTime: { value: number } };
  /** Read his airflow off the skeleton's world place: call once a frame
   * after the pose is laid. */
  update(group: THREE.Object3D, chest: THREE.Bone, now: number): void;
};

/** THE AIRFLOW past him, taken off his own motion: the chest bone's world
 * velocity, smoothed, turned into the frame his chest was bound in. */
export function createRacerWind(): RacerWind {
  const uniforms = { uAir: { value: new THREE.Vector3() }, uTime: { value: 0 } };
  const last = new THREE.Vector3();
  const now3 = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const air = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const bindQ = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const c = bindPose().frames.chest;
  basis.makeBasis(
    new THREE.Vector3(c.x.x, c.x.y, c.x.z),
    new THREE.Vector3(c.y.x, c.y.y, c.y.z),
    new THREE.Vector3(c.z.x, c.z.y, c.z.z),
  );
  bindQ.setFromRotationMatrix(basis);
  let at = -1;
  return {
    uniforms,
    update(group, chest, now) {
      if (now === at) return;
      chest.getWorldPosition(now3);
      const dt = at < 0 ? 0 : (now - at) / 1000;
      at = now;
      uniforms.uTime.value = (now / 1000) % 1000;
      if (dt <= 0 || dt > 0.25) {
        last.copy(now3);
        return;
      }
      vel.copy(now3).sub(last).divideScalar(dt);
      last.copy(now3);
      if (vel.lengthSq() > 120 * 120) vel.set(0, 0, 0);
      // The air past him is his motion reversed, smoothed over a few frames.
      const k = 1 - Math.exp(-RACER_WIND.settle * dt);
      air.lerp(vel.negate(), k);
      // Into the group's frame, then out of the chest's present turn into
      // the turn it was bound in.
      group.getWorldQuaternion(q).invert();
      const local = uniforms.uAir.value.copy(air).applyQuaternion(q);
      local.applyQuaternion(q.copy(chest.quaternion).invert()).applyQuaternion(bindQ);
    },
  };
}

/** The wind's graft on a part's material, after the world's own wrap: the
 * bib streamed back and fluttering, the suit rippling on its lee side. */
export function graftWind(material: THREE.Material, kind: "bib" | "suit", wind: RacerWind): void {
  const inner = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}:racer-${kind}`;
  const W = RACER_WIND;
  const f = (n: number) => n.toFixed(5);
  material.onBeforeCompile = (shader, renderer) => {
    inner(shader, renderer);
    shader.uniforms.uAir = wind.uniforms.uAir;
    shader.uniforms.uTime = wind.uniforms.uTime;
    const body =
      kind === "bib"
        ? `
  float air = length(uAir);
  vec3 wd = air > 0.05 ? uAir / air : vec3(0.0);
  // The windward cloth is pressed onto him and keeps still; the lee side
  // lifts off and streams with the air, and only OUT, never into the suit.
  float lee = smoothstep(-0.2, 0.6, dot(objectNormal, wd));
  float a = flap * lee * smoothstep(0.0, ${f(W.full)}, air);
  float ph = uTime * (${f(W.beat)} + air * ${f(W.beatPerMs)}) + position.y * 21.0 + position.x * 13.0;
  transformed += wd * a * ${f(W.stream)} * (0.75 + 0.25 * sin(ph * 0.47));
  transformed += objectNormal * a * ${f(W.flutter)} * (0.5 + 0.5 * sin(ph)) * (0.4 + 0.6 * a);`
        : `
  float air = length(uAir);
  vec3 wd = air > 0.05 ? uAir / air : vec3(0.0);
  float lee = max(0.0, dot(objectNormal, wd));
  float a = flap * lee * smoothstep(4.0, ${f(W.full * 1.6)}, air);
  float ph = uTime * (${f(W.beat * 3)} + air * ${f(W.beatPerMs * 2)}) + dot(position, vec3(31.0, 47.0, 23.0));
  transformed += objectNormal * a * ${f(W.ripple)} * sin(ph);`;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float flap;\nuniform vec3 uAir;\nuniform float uTime;",
      )
      .replace("#include <begin_vertex>", `#include <begin_vertex>${body}`);
  };
  material.needsUpdate = true;
}

/** The parts' ghost: every colour washed pale, as the code's ghost is. */
export function paleRacer(m: THREE.MeshStandardMaterial): void {
  m.map = null;
  m.color.set(0xdcecff);
}
