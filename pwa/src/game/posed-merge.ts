// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A POSED FIGURE AS ONE DRAW. A skier and his skis are built as a tree of
// small meshes — a capsule a limb, a box a boot, a group for the bars and
// one for each ski — because that is how a figure is POSED: every part hangs
// off its parent and the pose only turns joints. But a mesh is a draw call,
// and a draw call is paid again in the shadow pass, so four skiers of forty
// parts each were most of a frame's draws.
//
// So the tree is kept for the posing and taken out of the picture: every
// part is switched off every layer (it still updates its matrices, it is
// just never drawn), and what IS drawn is one vertex-coloured mesh per
// mesh holding every part's vertices in the part's OWN frame. The colour
// of each part is its old material's colour, carried as a vertex attribute,
// so one material draws them all.
//
// THE GPU LAYS THE PARTS, as RIGID SKINNING: every part is a bone whose
// matrix is the part's matrix in the root's frame, and every vertex is bound
// to its own part's bone alone, so a frame's posing is one matrix a part set
// into the skeleton — a few hundred — rather than every vertex of four skiers
// and their skiers re-laid on the processor and re-sent to the card (a
// hundred and fifty thousand vertices a figure, which was half of the
// benchmark's frame on a desktop). Three skins in every pass it draws the
// mesh in — the picture, the sun's map, the skiers' own — so the shadows
// follow the pose with nothing more said. A part whose ancestors are hidden
// (the skier in the cockpit views) gets a zero matrix: its vertices collapse
// onto a point, which draws nothing.
//
// The bones are the ROOT's, not the world's, and the mesh is bound DETACHED:
// the mesh's own model matrix — the root's — puts the skier in the world.
// So what moves the root or anything above it (the skier card's turntable
// spinning a pivot over a skier posed once) moves the whole draw with no
// re-pose; world bones froze every part where the last pose left it and only
// the windshield, a mesh of its own, turned.
//
// Three skins a normal through the bone's matrix itself, which bends it on a
// part scaled unevenly (a stretched strut, a helmet's shell); the material
// is grafted to take it through the inverse transpose instead, as the part's
// own normal matrix would.

import * as THREE from "three";

type Part = {
  mesh: THREE.Mesh;
  bone: THREE.Bone;
};

export type PosedMerge = {
  mesh: THREE.SkinnedMesh;
  /** Lay every part under `root` from its current matrices. */
  update(): void;
  dispose(): void;
};

function colourOf(mesh: THREE.Mesh): THREE.Color {
  const m = mesh.material as THREE.MeshStandardMaterial;
  const c = m.color ? m.color.clone() : new THREE.Color(1, 1, 1);
  // What glowed keeps a little of its glow: a lamp is still the brightest
  // thing on the skier without a material of its own.
  if (m.emissive && m.emissiveIntensity > 0) {
    c.r = Math.min(1, c.r + m.emissive.r * m.emissiveIntensity);
    c.g = Math.min(1, c.g + m.emissive.g * m.emissiveIntensity);
    c.b = Math.min(1, c.b + m.emissive.b * m.emissiveIntensity);
  }
  return c;
}

/** Every vertex has one bone: fetch its matrix once, not four times. */
const RIGID_BONE = /* glsl */ `
#ifdef USE_SKINNING
  mat4 boneMatX = getBoneMatrix( skinIndex.x );
  mat4 boneMatY = boneMatX;
  mat4 boneMatZ = boneMatX;
  mat4 boneMatW = boneMatX;
#endif
`;

/** The normal through the part's normal matrix — the inverse transpose of
 * its matrix — not through the matrix itself. */
const RIGID_NORMAL = /* glsl */ `
#ifdef USE_SKINNING
  mat4 skinMatrix = bindMatrixInverse * boneMatX * bindMatrix;
  objectNormal = transpose( inverse( mat3( skinMatrix ) ) ) * objectNormal;
#endif
`;

/** Merge `parts` (meshes somewhere under `root`) into one mesh drawn with
 * `material`, parented to `root`. */
export function mergePosed(
  root: THREE.Object3D,
  parts: THREE.Mesh[],
  material: THREE.Material,
): PosedMerge {
  const list: Part[] = [];
  const sources: {
    pos: ArrayLike<number>;
    nrm: ArrayLike<number>;
    count: number;
    index: ArrayLike<number> | null;
  }[] = [];
  let total = 0;
  let indices = 0;
  for (const mesh of parts) {
    // A part keeps its own index, so a vertex its triangles share is skinned
    // once. One with no normals of its own is taken apart first, so that
    // `computeVertexNormals` gives it the faceted look it was drawn with.
    const bare = !mesh.geometry.getAttribute("normal");
    const src = bare && mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    if (bare) src.computeVertexNormals();
    const p = src.getAttribute("position");
    const n = src.getAttribute("normal");
    const count = p.count;
    const own = src.index;
    const index = own ? Array.from(own.array) : null;
    const pos = new Float32Array(count * 3);
    const nrm = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < 3; j++) {
        pos[i * 3 + j] = p.getComponent(i, j);
        nrm[i * 3 + j] = n.getComponent(i, j);
      }
    }
    sources.push({ pos, nrm, count, index });
    if (src !== mesh.geometry) src.dispose();
    total += count;
    indices += index ? index.length : count;
    // Out of every pass, but still posed.
    mesh.layers.disableAll();
    const bone = new THREE.Bone();
    bone.matrixAutoUpdate = false;
    bone.matrixWorldAutoUpdate = false;
    list.push({ mesh, bone });
  }
  const pos = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const index = new Uint16Array(total * 4);
  const weight = new Float32Array(total * 4);
  const tris = total > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  let at = 0;
  let t = 0;
  for (let k = 0; k < list.length; k++) {
    const c = colourOf(list[k].mesh);
    const { pos: sp, nrm: sn, count, index: own } = sources[k];
    const drawn = own ? own.length : count;
    for (let i = 0; i < drawn; i++) tris[t++] = at + (own ? own[i] : i);
    for (let i = 0; i < count; i++, at++) {
      for (let j = 0; j < 3; j++) {
        pos[at * 3 + j] = sp[i * 3 + j];
        nrm[at * 3 + j] = sn[i * 3 + j];
      }
      col[at * 3] = c.r;
      col[at * 3 + 1] = c.g;
      col[at * 3 + 2] = c.b;
      index[at * 4] = k;
      weight[at * 4] = 1;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(index, 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(weight, 4));
  geo.setIndex(new THREE.BufferAttribute(tris, 1));
  // The skier and his skis stand inside a few metres of the root, at any
  // pose the rig can put them in; a fixed sphere spares a recompute a frame.
  // The mesh culls by its own sphere, which is this one object.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.3, 0), 3.2);

  const key = material.customProgramCacheKey.bind(material);
  const before = material.onBeforeCompile.bind(material);
  material.customProgramCacheKey = (): string => `${key()}:rigid`;
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <skinbase_vertex>", RIGID_BONE)
      .replace("#include <skinnormal_vertex>", RIGID_NORMAL);
  };

  const mesh = new THREE.SkinnedMesh(geo, material);
  const bones = list.map((p) => p.bone);
  mesh.bind(
    new THREE.Skeleton(
      bones,
      bones.map(() => new THREE.Matrix4()),
    ),
    new THREE.Matrix4(),
  );
  mesh.bindMode = THREE.DetachedBindMode;
  mesh.boundingSphere = geo.boundingSphere;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  root.add(mesh);

  const collapsed = new THREE.Matrix4().makeScale(0, 0, 0);

  /** Whether the part and every ancestor below the root is shown. */
  const shown = (o: THREE.Object3D): boolean => {
    for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) {
      if (!p.visible) return false;
    }
    return true;
  };

  const toRoot = new THREE.Matrix4();
  const update = (): void => {
    root.updateMatrixWorld(true);
    toRoot.copy(root.matrixWorld).invert();
    for (const part of list) {
      if (shown(part.mesh)) part.bone.matrixWorld.multiplyMatrices(toRoot, part.mesh.matrixWorld);
      else part.bone.matrixWorld.copy(collapsed);
    }
  };
  update();

  return {
    mesh,
    update,
    dispose() {
      geo.dispose();
      mesh.skeleton.dispose();
    },
  };
}
