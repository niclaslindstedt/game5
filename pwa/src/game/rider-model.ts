// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BACKCOUNTRY FREERIDER, MODELLED: the player as a glTF made in Blender
// (`make models KIND=freerider`, `scripts/blender/freerider.py`) — a long
// baggy shell, bibs bunched over the boots, gauntlets, a helmet and an
// avalanche airbag pack — drawn in place of the code's cut outfit
// (`skier-dress.ts`), unless the build is switched back
// (`VITE_MODEL_RIDER=0`).
//
// IT IS NOT A SECOND ANIMATION. The model was bound in Blender in exactly
// the rig's bind pose (`bindPose`, the frame the loom cuts the code's
// outfit in), so its vertices are read back here in that pose, turned into
// the body frame and skinned onto the game's own bones by NAME — and every
// pose the game has (a carve, the tuck, a landing, a grab, thrown, a broken
// arm hanging) poses it as it poses the code's outfit, bone for bone.
//
// THE CLOTH FLAPS IN THE WIND (`flutterOf`): each vertex carries how free
// it hangs (`flap` — the shell's long hem the freest, the sleeves and the
// bibs' cuffs a little, the pack, the gloves and the helmet not at all),
// and the vertex shader blows it back along the air past him and ripples
// it along its normal, harder and faster the faster he goes.

import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { bindPose, type DressPart } from "./dress-loft.ts";
import { RIDER_KIT } from "./rider-kit.ts";
import { SKIER_BONES, type SkierBone } from "./skier-rig.ts";

/** One half of the model, as a dress part with its UVs and its `flap`. */
export type RiderPart = DressPart & { uv: number[]; flap: number[] };

export type RiderParts = {
  cloth: RiderPart;
  hard: RiderPart;
  /** The suit's baked shade (folds and seams) and its normal map. */
  map: THREE.Texture | null;
  normalMap: THREE.Texture | null;
};

/** The model's materials that shine: the helmet, its peak, the lens and
 * the metal buckles. Everything else is cloth. */
const HARD = new Set(["helmet", "peak", "lens", "buckle"]);

let parts: RiderParts | null = null;

/** The model's two halves, once `takeRider` has had the glTF. */
export const riderParts = (): RiderParts | null => parts;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** How freely a point of the model hangs in the wind, 0..1, by the
 * material it is and where it is in the bind pose (the body frame). */
export function flapOf(
  material: string,
  x: number,
  y: number,
  levels: { chest: number; hem: number; knee: number; ankle: number },
): number {
  if (material === "jacket" || material === "accent") {
    // The sleeves flutter a little; the shell more and more down to its hem.
    if (Math.abs(x) > 0.2 && y > levels.hem + 0.15) return 0.3;
    const t = clamp01((levels.chest - y) / (levels.chest - levels.hem));
    return 0.12 + 0.88 * t ** 1.4;
  }
  if (material === "pants") {
    // The bibs bag below the knee and flap at the cuff over the boot.
    const t = clamp01((levels.knee - y) / (levels.knee - levels.ankle));
    return 0.1 + 0.55 * t;
  }
  if (material === "liner") return 0.15; // the collar's fleece
  return 0;
}

const linear = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();

/** READ THE MODEL: every skinned mesh of the glTF, at its bind, into the
 * game's body frame and onto `SKIER_BONES` by name. */
export function takeRider(gltf: GLTF): void {
  gltf.scene.updateMatrixWorld(true);
  const bind = bindPose().frames;
  const levels = {
    chest: bind.chest.head.y,
    hem: bind.pelvis.head.y - 0.2,
    knee: bind.shin_l.head.y,
    ankle: bind.boot_l.head.y,
  };
  const empty = (): RiderPart => ({
    position: [],
    normal: [],
    color: [],
    skinIndex: [],
    skinWeight: [],
    index: [],
    uv: [],
    flap: [],
  });
  const out = { cloth: empty(), hard: empty() };
  let map: THREE.Texture | null = null;
  let normalMap: THREE.Texture | null = null;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const normalBind = new THREE.Matrix3();
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const mat = o.material as THREE.MeshStandardMaterial;
    const name = mat.name;
    if (mat.map && name === "jacket") {
      map = mat.map;
      normalMap = mat.normalMap;
    }
    const into = HARD.has(name) ? out.hard : out.cloth;
    const colour = name === "lens" ? linear(RIDER_KIT.visor) : mat.color;
    // The skin's joints by name, onto the game's bones.
    // The armature's root (`body`) carries no skin of its own; the pelvis
    // stands for it.
    const joint = o.skeleton.bones.map((b) => {
      const k = SKIER_BONES.indexOf((b.name === "body" ? "pelvis" : b.name) as SkierBone);
      if (k < 0) throw new Error(`rider model: no bone ${b.name} on the rig`);
      return k;
    });
    const g = o.geometry;
    const pos = g.getAttribute("position");
    const nor = g.getAttribute("normal");
    const uv = g.getAttribute("uv");
    const si = g.getAttribute("skinIndex");
    const sw = g.getAttribute("skinWeight");
    normalBind.getNormalMatrix(o.bindMatrix);
    const base = into.position.length / 3;
    for (let i = 0; i < pos.count; i++) {
      // glTF's world is Blender's turned, and Blender's is the body frame
      // laid (−x, z, y): the body frame is glTF's (−x, y, −z).
      p.fromBufferAttribute(pos, i).applyMatrix4(o.bindMatrix);
      n.fromBufferAttribute(nor, i).applyMatrix3(normalBind).normalize();
      into.position.push(-p.x, p.y, -p.z);
      into.normal.push(-n.x, n.y, -n.z);
      into.color.push(colour.r, colour.g, colour.b);
      // Every part but the suit sits on the detail map's plain corner.
      if (uv) into.uv.push(uv.getX(i), uv.getY(i));
      else into.uv.push(0.99, 0.01);
      for (let k = 0; k < 4; k++) {
        into.skinIndex.push(joint[si.getComponent(i, k)]);
        into.skinWeight.push(sw.getComponent(i, k));
      }
      into.flap.push(flapOf(name, -p.x, p.y, levels));
    }
    const idx = g.getIndex();
    if (idx) for (let i = 0; i < idx.count; i++) into.index.push(base + idx.getX(i));
    else for (let i = 0; i < pos.count; i++) into.index.push(base + i);
  });
  parts = { ...out, map, normalMap };
}

/** The wind on the cloth, handed over each frame: the air past him in the
 * figure's own frame and his speed through it. */
export type Flutter = {
  /** `air` the air's direction past him in the figure's frame (unit, or
   * zero when he stands), `speed` m/s. */
  set(ax: number, ay: number, az: number, speed: number): void;
  /** A lab's still: the ripple held at this phase (null lets it run). */
  hold(phase: number | null): void;
  dispose(): void;
};

/** GRAFT THE FLUTTER onto the cloth's material, after whatever the world's
 * wrap put there (the haze), and clock it off the frames it is drawn in. */
export function flutterOf(material: THREE.Material, mesh: THREE.Object3D): Flutter {
  const u = {
    uFlapPhase: { value: 0 },
    uAir: { value: new THREE.Vector4(0, 0, -1, 0.15) },
  };
  let freq = 5;
  let last = -1;
  let held: number | null = null;
  mesh.onBeforeRender = () => {
    const now = performance.now() / 1000;
    if (held !== null) u.uFlapPhase.value = held;
    else if (last >= 0) u.uFlapPhase.value += Math.min(0.1, Math.max(0, now - last)) * freq;
    last = now;
  };
  const prev = material.onBeforeCompile.bind(material);
  const prevKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${prevKey()}|rider-flap`;
  material.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    shader.uniforms.uFlapPhase = u.uFlapPhase;
    shader.uniforms.uAir = u.uAir;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float flap;\nuniform float uFlapPhase;\nuniform vec4 uAir;",
      )
      .replace(
        "#include <skinning_vertex>",
        `#include <skinning_vertex>
        {
          // A travelling ripple: its phase runs along the garment, so a hem
          // waves rather than pumping as one.
          float ph = uFlapPhase + dot(position, vec3(11.0, 17.0, 7.0));
          float w = 0.6 * sin(ph) + 0.4 * sin(2.3 * ph + 1.7);
          // ...and the gusts: the whole garment's flogging swells and eases.
          float gust = 0.8 + 0.2 * sin(0.37 * uFlapPhase);
          float s = flap * uAir.w * gust;
          transformed += uAir.xyz * s * (0.045 + 0.018 * w)
            + normalize(objectNormal) * s * w * 0.018;
        }`,
      );
  };
  material.needsUpdate = true;
  return {
    set(ax, ay, az, speed) {
      // Blown back from a jog; flogging by 80 km/h. A breeze stirs it still.
      const k = THREE.MathUtils.smoothstep(speed, 2, 22);
      const len = Math.hypot(ax, ay, az);
      if (len > 1e-3) u.uAir.value.set(ax / len, ay / len, az / len, 0.15 + 0.85 * k);
      else u.uAir.value.set(0, 0, -1, 0.15);
      freq = 5 + 0.55 * Math.min(speed, 40);
    },
    hold(phase) {
      held = phase;
    },
    dispose() {
      mesh.onBeforeRender = () => {};
    },
  };
}
