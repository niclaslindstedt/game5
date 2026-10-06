// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MODELLED PAIR AS ONE DRAW. The pair's glTF is one skinned mesh with a
// primitive per material — the paint, the trim, the panel, the base, the
// binding's metal, the boot — and the loader makes each primitive a mesh of
// its own, with a skeleton of its own over the same bones. Every skier then
// paid six draws in the picture, six again in the sun's map (or his own),
// and six bone textures sent to the card every frame.
//
// So the primitives are merged into one skinned mesh over ONE skeleton, and
// what told the materials apart rides on the vertices instead: the colour
// as the vertex colour, and the metalness, the roughness and the clearcoat
// as an attribute the material reads in place of its uniforms. The
// materials differ in nothing else (they are checked: a pair whose do is
// left as it was), so every pixel is lit as its own material lit it. The
// primitives are laid in the order they were drawn in, so where two meet
// on one plane the same one is on top. The boot stays a mesh of its own:
// the pair racked on a snowmobile hides everything but the boots.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;
type Lit = THREE.MeshPhysicalMaterial;

/** What every merged material must share, besides what the vertices carry. */
const SHARED: (keyof Lit)[] = [
  "type",
  "side",
  "transparent",
  "opacity",
  "alphaTest",
  "flatShading",
  "fog",
  "toneMapped",
  "emissiveIntensity",
  "envMapIntensity",
  "clearcoatRoughness",
  "ior",
  "specularIntensity",
  "sheen",
  "transmission",
  "iridescence",
  "anisotropy",
  "dispersion",
  "thickness",
];

/** Maps any of the materials draws with: none may, for one to stand in. */
const MAPS: (keyof Lit)[] = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "emissiveMap",
  "aoMap",
  "alphaMap",
  "envMap",
  "lightMap",
  "bumpMap",
  "displacementMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
];

const PBR_VERTEX = /* glsl */ `
attribute vec3 pbr;
varying vec3 vPbr;`;

/** Can `parts` be drawn as one — one skeleton, one bind, one material but
 * for the colour, the metalness, the roughness and the clearcoat? */
function mergeable(parts: THREE.SkinnedMesh[]): boolean {
  const [a] = parts;
  const ma = a.material as Lit;
  if (!(ma instanceof THREE.MeshStandardMaterial)) return false;
  return parts.every((p) => {
    const m = p.material as Lit;
    return (
      !Array.isArray(p.material) &&
      p.skeleton.bones.length === a.skeleton.bones.length &&
      p.skeleton.bones.every((b, i) => b === a.skeleton.bones[i]) &&
      p.bindMatrix.equals(a.bindMatrix) &&
      p.bindMode === a.bindMode &&
      p.position.equals(a.position) &&
      p.quaternion.equals(a.quaternion) &&
      p.scale.equals(a.scale) &&
      p.parent === a.parent &&
      !p.geometry.morphAttributes.position &&
      SHARED.every((k) => m[k] === ma[k]) &&
      m.emissive.equals(ma.emissive) &&
      MAPS.every((k) => !m[k])
    );
  });
}

/** One part's geometry with its material's look laid on its vertices. */
function painted(p: THREE.SkinnedMesh): THREE.BufferGeometry {
  const m = p.material as Lit;
  const g = p.geometry.clone();
  for (const name of Object.keys(g.attributes)) {
    if (!["position", "normal", "skinIndex", "skinWeight"].includes(name)) g.deleteAttribute(name);
  }
  const n = g.getAttribute("position").count;
  const colour = new Float32Array(n * 3);
  const pbr = new Float32Array(n * 3);
  const coat = m instanceof THREE.MeshPhysicalMaterial ? m.clearcoat : 0;
  for (let i = 0; i < n; i++) {
    colour[i * 3] = m.color.r;
    colour[i * 3 + 1] = m.color.g;
    colour[i * 3 + 2] = m.color.b;
    pbr[i * 3] = m.metalness;
    pbr[i * 3 + 1] = m.roughness;
    pbr[i * 3 + 2] = coat;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colour, 3));
  g.setAttribute("pbr", new THREE.BufferAttribute(pbr, 3));
  return g;
}

/** THE MODEL'S MESHES with every one but those `keep` names merged into one
 * draw where they can be; the meshes now drawn, and what to dispose. */
export function mergeModel(
  meshes: THREE.Mesh[],
  keep: (material: THREE.Material) => boolean,
  wrap: Wrap,
): { meshes: THREE.Mesh[]; dispose(): void } {
  const parts = meshes.filter(
    (m): m is THREE.SkinnedMesh =>
      m instanceof THREE.SkinnedMesh && !Array.isArray(m.material) && !keep(m.material),
  );
  if (parts.length < 2 || !mergeable(parts)) return { meshes, dispose() {} };
  const geos = parts.map(painted);
  const geometry = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  if (!geometry) return { meshes, dispose() {} };

  const first = parts[0];
  const look = (first.material as Lit).clone();
  look.vertexColors = true;
  look.color.setRGB(1, 1, 1);
  look.metalness = 1;
  look.roughness = 1;
  const physical = look instanceof THREE.MeshPhysicalMaterial;
  // A clearcoat of 1 compiles the coat in; each vertex says how much.
  if (physical) look.clearcoat = 1;
  look.name = "model-merged";
  const material = wrap(look, "model-merged");
  const haze = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey();
  material.customProgramCacheKey = (): string => `${key}:pbr`;
  material.onBeforeCompile = (shader, renderer) => {
    haze(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${PBR_VERTEX}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vPbr = pbr;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPbr;")
      .replace(
        "#include <roughnessmap_fragment>",
        THREE.ShaderChunk.roughnessmap_fragment.replace(
          "float roughnessFactor = roughness;",
          "float roughnessFactor = vPbr.y;",
        ),
      )
      .replace(
        "#include <metalnessmap_fragment>",
        THREE.ShaderChunk.metalnessmap_fragment.replace(
          "float metalnessFactor = metalness;",
          "float metalnessFactor = vPbr.x;",
        ),
      )
      .replace(
        "#include <lights_physical_fragment>",
        THREE.ShaderChunk.lights_physical_fragment.replace(
          "material.clearcoat = clearcoat;",
          "material.clearcoat = vPbr.z;",
        ),
      );
  };

  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = "model-merged";
  mesh.bind(first.skeleton, first.bindMatrix);
  mesh.bindMode = first.bindMode;
  mesh.position.copy(first.position);
  mesh.quaternion.copy(first.quaternion);
  mesh.scale.copy(first.scale);
  mesh.castShadow = first.castShadow;
  mesh.receiveShadow = first.receiveShadow;
  mesh.frustumCulled = first.frustumCulled;
  // The rest pose's bound, so three never walks every vertex through the
  // bones to find one (it only wants the centre, to sort the draw).
  geometry.computeBoundingSphere();
  mesh.boundingSphere = geometry.boundingSphere!.clone();
  const parent = first.parent!;
  parent.add(mesh);
  for (const p of parts) parent.remove(p);
  return {
    meshes: [mesh, ...meshes.filter((m) => !parts.includes(m as THREE.SkinnedMesh))],
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
