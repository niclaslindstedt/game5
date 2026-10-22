// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT'S WINGS AS DRAWN: the cloth `wingsuit-cloth.ts` lofts off
// the figure's pose, one mesh of two skins a wing, painted in the shader in
// the suit's colourway (`wingsuit-look.ts`'s `suitPaintGlsl`) so its
// panels, ribs and mouths are crisp at any distance. Hung on the figure's
// group, in the pose's own frame, so it moves with the dressed skin.

import * as THREE from "three";

import { nodeGraft } from "./gpu-backend.ts";
import type { SkierPose } from "./skier-joints.ts";
import { shapeSuit, suitLayout, type SuitDrive } from "./wingsuit-cloth.ts";
import { colourwayOf, suitPaintGlsl } from "./wingsuit-look.ts";

export type WingsuitWings = {
  mesh: THREE.Mesh;
  /** Loft the wings off pose `p` (in the figure group's frame). */
  pose(p: SkierPose, drive: SuitDrive): void;
  dispose(): void;
};

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;

/** THE WINGS of a suit in colourway `suit`, hung on `parent`. */
export function createWingsuitWings(
  suit: number,
  parent: THREE.Object3D,
  wrap: Wrap,
  ghost = false,
): WingsuitWings {
  const layout = suitLayout();
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(layout.vertices * 3);
  const attr = new THREE.BufferAttribute(pos, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", attr);
  geo.setAttribute("aWing", new THREE.BufferAttribute(layout.paint, 4));
  geo.setIndex(new THREE.BufferAttribute(layout.index, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.4);
  const glsl = suitPaintGlsl(colourwayOf(suit));
  const mat = wrap(
    new THREE.MeshStandardMaterial({
      color: ghost ? 0xdcecff : 0xffffff,
      roughness: 0.62,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
    "wingsuit",
  );
  // Painted by the graft below, and on the node renderer by its nodes
  // (`model-grafts-tsl.ts`).
  nodeGraft(mat, "wingsuit", "wingsuit").userData.suit = suit;
  // The paint laid over whatever the wrap compiles (the haze, the lamps).
  const before = mat.onBeforeCompile.bind(mat);
  const key = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${key()}:wingsuit:${suit}`;
  mat.onBeforeCompile = (shader, gl) => {
    before(shader, gl);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aWing;\nvarying vec4 vWing;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWing = aWing;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec4 vWing;\n${glsl}`)
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb *= suitPaint(vWing);",
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "wingsuit";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  parent.add(mesh);
  return {
    mesh,
    pose(p, drive) {
      shapeSuit(pos, layout, p, drive);
      attr.needsUpdate = true;
      geo.computeVertexNormals();
    },
    dispose() {
      parent.remove(mesh);
      geo.dispose();
      mat.dispose();
    },
  };
}
