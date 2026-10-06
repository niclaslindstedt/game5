// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DEPTH MATERIAL FOR EACH KIND OF CASTER in the sun's shadow map. Three
// draws every caster that brings none of its own (`customDepthMaterial`)
// with ONE depth material, and that material's program is keyed by what
// the mesh it draws is: instanced or not, with a colour per instance or
// not, skinned or not, morphed or not. The sun's map draws them all in
// turn — the gates' instanced poles, the arena's plain meshes, the skiers'
// skinned figures, the crowd's morphed instances — so the one material's
// program changed at nearly every draw, and three re-derived it each time
// (its parameters, its cache key, a lookup of the program it already had):
// the dearest thing in the shadow pass on the processor.
//
// So each caster is handed, once, a depth material of its own KIND, shared
// by every caster of that kind: the same `MeshDepthMaterial` three would
// have used, so the map holds the same depths, and a program that never
// changes between draws. A caster whose own material asks three for a
// depth material of ITS own (a texture cut out by an alpha test, a
// displacement, clipping planes) keeps three's way, which already gives it
// one.

import * as THREE from "three";

type ShadowRender = (lights: THREE.Light[], scene: THREE.Scene, camera: THREE.Camera) => void;

/** Whether three builds `material` a depth material of its own
 * (`WebGLShadowMap`'s `getDepthMaterial`), which must not be replaced. */
function ownVariant(material: THREE.Material): boolean {
  const m = material as THREE.MeshStandardMaterial;
  return (
    (m.clipShadows === true && Array.isArray(m.clippingPlanes) && m.clippingPlanes.length > 0) ||
    (!!m.displacementMap && m.displacementScale !== 0) ||
    (!!m.alphaMap && m.alphaTest > 0) ||
    (!!m.map && m.alphaTest > 0) ||
    m.alphaToCoverage === true
  );
}

/** What a depth program is keyed by that differs from caster to caster. */
function kindOf(mesh: THREE.Mesh): string {
  const inst = mesh as THREE.Mesh & {
    isInstancedMesh?: boolean;
    instanceColor?: unknown;
    morphTexture?: unknown;
    isSkinnedMesh?: boolean;
    isBatchedMesh?: boolean;
  };
  const morph = mesh.geometry.morphAttributes;
  return [
    inst.isInstancedMesh ? "i" : "-",
    inst.instanceColor ? "c" : "-",
    inst.morphTexture ? "m" : "-",
    inst.isSkinnedMesh ? "s" : "-",
    morph.position?.length ?? 0,
    morph.normal ? "n" : "-",
    morph.color ? "k" : "-",
  ].join("");
}

/** `render` (three's own shadow pass) with every caster first handed its
 * kind's depth material. */
export function depthByKind(render: ShadowRender): ShadowRender {
  const kinds = new Map<string, THREE.MeshDepthMaterial>();
  const handled = new WeakSet<THREE.Object3D>();
  const hand = (o: THREE.Object3D): void => {
    if (handled.has(o)) return;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.castShadow) return;
    handled.add(o);
    if (o.customDepthMaterial !== undefined || (o as { isBatchedMesh?: boolean }).isBatchedMesh)
      return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (mats.some(ownVariant)) return;
    const key = kindOf(mesh);
    let depth = kinds.get(key);
    if (!depth) kinds.set(key, (depth = new THREE.MeshDepthMaterial()));
    o.customDepthMaterial = depth;
  };
  return (lights, scene, camera) => {
    scene.traverseVisible(hand);
    render(lights, scene, camera);
  };
}

/** A material's running number (three's own, missing from its types). */
const idOf = (m: THREE.Material): number => (m as THREE.Material & { id: number }).id;

/** THE OPAQUE DRAWS GROUPED BY MATERIAL. Three orders the opaque list
 * nearest first and nothing else, so neighbouring draws are of different
 * materials and every draw refreshed its material's uniforms — the haze's,
 * the lamps', the shadows' — and as often its program. Grouped by material,
 * and nearest first within a material, a material's uniforms are sent once
 * a frame. Depth testing decides what is seen whatever the order. */
export function byMaterial(a: THREE.RenderItem, b: THREE.RenderItem): number {
  return (
    a.groupOrder - b.groupOrder ||
    a.renderOrder - b.renderOrder ||
    idOf(a.material) - idOf(b.material) ||
    a.z - b.z ||
    a.id - b.id
  );
}
