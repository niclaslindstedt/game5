// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DRESSED SKIER AS DRAWN: an outfit's two meshes (`dress.ts`) skinned
// on the skier's own rig (`skier-rig.ts`'s bones, bound in `STANDING`) and
// posed every frame by the game's pose, bone for bone — `skierBones` of
// the very `SkierPose` the poles and the headlamp hang on. So the cloth
// bends at the knee, the hip, the elbow and the small of the back as one
// skin, and every pose the game has (a carve, the tuck, a landing, a grab,
// thrown) is the rig's arithmetic, never a second animation.
//
// Two draws a skier: the CLOTH (matt) and the HARD goods (the helmet, the
// goggles or the visor, the chin guard: a shine of their own). Each
// vertex carries its colour; a ghost's are washed pale.

import * as THREE from "three";

import { dressOutfit } from "./dress.ts";
import { bindPose, type DressPart } from "./dress-loft.ts";
import type { Outfit } from "./outfit.ts";
import type { SkierPose } from "./skier-pose.ts";
import { SKIER_BONES, skierBones, type BoneFrame, type SkierBone } from "./skier-rig.ts";
import type { Collapse } from "./gore-cut.ts";

export type Dressed = {
  /** What the figure's group carries: the bones and the two meshes. */
  group: THREE.Group;
  meshes: THREE.SkinnedMesh[];
  pose(p: SkierPose, cut?: Collapse | null): void;
  /** Posed off bone frames handed in whole (a piece torn off,
   * `gore-view.ts`), each in the group's frame. */
  frames(f: Record<SkierBone, BoneFrame>, cut?: Collapse | null): void;
  /** The frames of the last pose, in the group's frame. */
  last(): Record<SkierBone, BoneFrame>;
  /** The cloth's vertex colours, the bind pose's positions and its weights
   * — what a wound soaks red (`gore-view.ts`). */
  cloth: THREE.BufferGeometry;
  dispose(): void;
};

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;

/** What the skier is dressed in: the outfit, his skin's own tone, and
 * whether he is a GHOST (every colour washed pale). */
export type SkierDress = {
  outfit: Outfit;
  tone?: number;
  ghost?: boolean;
  /** Indoors: no helmet and no goggles (`cutHead`). */
  bare?: boolean;
};

/** A ghost's colours: the kit's own light, lifted toward a pale ice blue. */
const PALE = new THREE.Color(0xdcecff).convertSRGBToLinear();

function geometryOf(part: DressPart, ghost: boolean): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(part.position, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(part.normal, 3));
  const colour = Float32Array.from(part.color);
  if (ghost) {
    for (let i = 0; i < colour.length; i += 3) {
      const l = 0.3 * colour[i] + 0.55 * colour[i + 1] + 0.15 * colour[i + 2];
      colour[i] = PALE.r * (0.55 + 0.45 * l);
      colour[i + 1] = PALE.g * (0.55 + 0.45 * l);
      colour[i + 2] = PALE.b * (0.55 + 0.45 * l);
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(colour, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(part.skinIndex, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(part.skinWeight, 4));
  g.setIndex(part.index);
  // The skier stands inside a couple of metres of his root at any pose.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2.2);
  return g;
}

const ax = new THREE.Vector3();
const ay = new THREE.Vector3();
const az = new THREE.Vector3();
const basis = new THREE.Matrix4();
function setBone(bone: THREE.Bone, f: BoneFrame): void {
  basis.makeBasis(
    ax.set(f.x.x, f.x.y, f.x.z),
    ay.set(f.y.x, f.y.y, f.y.z),
    az.set(f.z.x, f.z.y, f.z.z),
  );
  bone.quaternion.setFromRotationMatrix(basis);
  bone.position.set(f.head.x, f.head.y, f.head.z);
}

/** THE SKIER IN HIS OUTFIT, skinned and ready to pose. */
export function createDressed(dress: SkierDress, wrap: Wrap): Dressed {
  const group = new THREE.Group();
  group.name = "dressed";
  const bones = SKIER_BONES.map((name) => {
    const b = new THREE.Bone();
    b.name = name;
    group.add(b);
    return b;
  });
  // Bound in the rig's own standing pose, the frame the loom cut him in.
  const bind = bindPose().frames;
  SKIER_BONES.forEach((name, i) => setBone(bones[i], bind[name]));
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  const cut = dressOutfit(dress.outfit, dress.tone, dress.bare);
  const ghost = !!dress.ghost;
  const geos = [geometryOf(cut.cloth, ghost), geometryOf(cut.hard, ghost)];
  const mats = [
    wrap(
      // Both sides of the cloth: a hem, a cuff and a collar are open, and
      // a lens under one sees the inside of the garment, not the snow
      // through it.
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.78,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      "skier-cloth",
    ),
    wrap(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.15 }),
      "skier-hard",
    ),
  ];
  const meshes = geos.map((g, i) => {
    const m = new THREE.SkinnedMesh(g, mats[i]);
    m.name = i === 0 ? "skier-cloth" : "skier-hard";
    m.bind(skeleton, new THREE.Matrix4());
    m.castShadow = true;
    m.receiveShadow = true;
    // A skinned mesh's bound is its bind pose's; the skier is small and on
    // screen whenever he matters.
    m.frustumCulled = false;
    group.add(m);
    return m;
  });

  let lastFrames = bind;
  const lay = (frames: Record<SkierBone, BoneFrame>, cut: Collapse | null | undefined): void => {
    lastFrames = frames;
    SKIER_BONES.forEach((name, i) => {
      const b = bones[i];
      setBone(b, frames[name]);
      const at = cut?.bones.get(name);
      if (at) {
        b.position.set(at.x, at.y, at.z);
        b.scale.setScalar(1e-4);
      } else if (name === "head" && cut?.crush) {
        const k = cut.crush;
        b.scale.set(1 + 0.35 * k, 1 - 0.45 * k, 1 + 0.25 * k);
      } else b.scale.setScalar(1);
    });
  };

  return {
    group,
    meshes,
    pose(p, cut) {
      lay(skierBones(p), cut);
    },
    frames(f, cut) {
      lay(f, cut);
    },
    last: () => lastFrames,
    cloth: geos[0],
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      skeleton.dispose();
    },
  };
}
