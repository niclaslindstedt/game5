// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER — the dressed figure (`skier-dress.ts`: his outfit cut on the
// loom and skinned on the rig) posed on the points `skier-pose.ts` works
// out, with his POLES in his fists and the frame his HEAD is in (what the
// headlamp is strapped to).
//
// He is his clothes: every garment is cut to his body's measure plus its
// own ease (`dress-garments.ts`), so the silhouette the chase camera reads
// — the helmet, the shoulders, the jacket against the snow, the pants over
// the boots — is the kit itself, and nothing is drawn under it. The BOOTS
// are the skis' own, clamped in the bindings (`ski-gear.ts`); the pants
// gaiter down over their cuffs. THE POLES hang from his fists — back along
// the hips standing, under the arms in a tuck, one reaching forward to the
// snow on a plant — each the outfit's own pair (`outfit.ts`' `POLES`): an
// alloy shaft, a slim carbon one, a downhill racer's bent round the body,
// or a powder pole's big basket.

import * as THREE from "three";

import { gearOf } from "./outfit.ts";
import { createDressed, type SkierDress } from "./skier-dress.ts";
import { skierPose, type SkierPose, type SkierPoseInput, type V3 } from "./skier-pose.ts";
import { seatedPose, type Seat } from "./skier-seat.ts";

export type { SkierDress } from "./skier-dress.ts";

export type SkierFigure = {
  group: THREE.Group;
  /** The head's frame (z forward, y up, the origin at the middle of the
   * head), posed with him — what the helmet and its lamp hang on. */
  head: THREE.Group;
  /** The dressed skin's meshes — what casts, drawn apart from the merged
   * pair (`posed-merge.ts` takes only the poles). */
  skin: THREE.SkinnedMesh[];
  /** Posed for `input`, sat on a chair's `seat` when one is handed in
   * (`skier-seat.ts`). */
  pose(input: SkierPoseInput, seat?: Seat | null): void;
  /** Pose him THROWN, off the engine's ragdoll (`ragdollPose`): the poles
   * let go, every limb where the physics has it. The caller places and
   * turns the group. */
  sprawl(pose: SkierPose): void;
  dispose(): void;
};

/** What the poles look like (`ski-looks.ts`'s `pole`): their length, m,
 * and the basket's radius, m — the class's own, which the outfit's pair
 * keeps the length of. */
export type PoleLook = { length: number; basket: number };

const Y = new THREE.Vector3(0, 1, 0);

/** A SPEED POLE's shaft: straight from the basket for half its length, then
 * bent out round the body and back to the grip — so it lies along him in
 * the tuck. The curve's bulge, m, along the pole's +z. */
const SPEED_BEND = 0.07;

export function createSkier(
  dress: SkierDress,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
  poles: PoleLook = { length: 1.2, basket: 0.045 },
): SkierFigure {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const pole = gearOf("poles", dress.outfit.poles);
  const pale = (c: number) => (dress.ghost ? 0xdcecff : c);
  const mat = (colour: number, rough = 0.8, metal = 0) => {
    const m = wrap(
      new THREE.MeshStandardMaterial({ color: pale(colour), roughness: rough, metalness: metal }),
      "skier",
    );
    mats.push(m);
    return m;
  };
  const shaft = mat(pole.shaft, 0.35, pole.id === "alloy" ? 0.8 : 0.2);
  const grip = mat(pole.grip, 0.75);
  const basket = mat(pole.basket, 0.7);

  const part = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D) => {
    geos.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // THE DRESSED SKIN, bones and all.
  const dressed = createDressed(dress, wrap);
  group.add(dressed.group);

  // THE POLES: a shaft from the basket up to the fist, drawn along +y from
  // the basket end so it hangs like a limb; the grip in the fist and the
  // basket at its foot.
  const L = poles.length;
  const [rGrip, rTip] = pole.radius;
  const shaftGeo =
    pole.id === "speed"
      ? new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(
            [0, 0.3, 0.5, 0.6, 0.7, 0.8, 0.88, 0.94, 1].map(
              (u) =>
                new THREE.Vector3(
                  0,
                  u * L,
                  SPEED_BEND *
                    Math.sin(Math.PI * Math.max(0, Math.min(1, (u - 0.5) / 0.47))) ** 1.5,
                ),
            ),
          ),
          16,
          (rGrip + rTip) / 2,
          6,
          false,
        )
      : new THREE.CylinderGeometry(rGrip, rTip, L, 6).translate(0, L / 2, 0);
  const gripGeo = new THREE.CylinderGeometry(0.015, 0.013, 0.13, 8).translate(0, L - 0.07, 0);
  // A powder basket is a FLOWER: its rim cut into petals that spread the
  // load in deep snow; every other a plain disc.
  const basketGeo = new THREE.CylinderGeometry(
    pole.basketRadius,
    pole.basketRadius * 0.8,
    0.012,
    20,
  );
  if (pole.id === "powder") {
    const at = basketGeo.getAttribute("position");
    for (let i = 0; i < at.count; i++) {
      const x = at.getX(i);
      const z = at.getZ(i);
      const a = Math.atan2(z, x);
      const k = 0.72 + 0.28 * Math.abs(Math.cos(a * 5));
      at.setXYZ(i, x * k, at.getY(i), z * k);
    }
    basketGeo.computeVertexNormals();
  }
  const poleMeshes = [0, 1].map(() => {
    const g = new THREE.Group();
    group.add(g);
    part(shaftGeo.clone(), shaft, g);
    part(gripGeo.clone(), grip, g);
    part(basketGeo.clone(), basket, g).position.set(0, 0.06, 0);
    return g;
  });
  for (const g of [shaftGeo, gripGeo, basketGeo]) g.dispose();

  // THE HEAD'S FRAME, posed as the rig turns the head bone.
  const headGroup = new THREE.Group();
  group.add(headGroup);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const out = new THREE.Vector3();
  const side = new THREE.Vector3();
  const limb = new THREE.Matrix4();
  /** Hang a part whose origin is a joint and whose +y runs to the next,
   * turned about its length so its +z faces `face`. */
  const hang = (mesh: THREE.Object3D, from: V3, to: V3, face: THREE.Vector3) => {
    a.set(from.x, from.y, from.z);
    b.set(to.x, to.y, to.z);
    mesh.position.copy(a);
    dir.copy(b).sub(a).normalize();
    out.copy(face).addScaledVector(dir, -face.dot(dir));
    if (out.lengthSq() < 1e-8) {
      mesh.quaternion.setFromUnitVectors(Y, dir);
      return;
    }
    out.normalize();
    side.crossVectors(dir, out);
    limb.makeBasis(side, dir, out);
    mesh.quaternion.setFromRotationMatrix(limb);
  };
  const outward = new THREE.Vector3();

  /** Hang the figure on a pose's points — `free`, off the skis, with the
   * poles let go. */
  function lay(p: SkierPose, free = false): void {
    dressed.pose(p);
    for (let i = 0; i < 2; i++) {
      const at = p.poles?.[i] ?? null;
      poleMeshes[i].visible = !free && at !== null;
      if (at) {
        // A bent pole bows out from the body and back; a straight one
        // turns nowhere about its length.
        outward.set(i === 0 ? -1 : 1, 0, -0.4);
        hang(poleMeshes[i], at, p.hands[i], outward);
      }
    }
    headGroup.position.set(p.head.x, p.head.y, p.head.z);
    // The head held nearer level than the shoulders — a skier looks down
    // the hill out of a tuck — and turned a little into the turn (as the
    // rig's head bone is: `skier-rig.ts`'s `headAxes`).
    headGroup.rotation.set(-0.2 + p.pitch * 0.3, p.look * 0.5, -p.headRoll, "YXZ");
  }

  return {
    group,
    head: headGroup,
    skin: dressed.meshes,
    pose(input, seat = null) {
      lay(seat ? seatedPose(input, seat) : skierPose(input));
    },
    sprawl(pose) {
      lay(pose, true);
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      dressed.dispose();
    },
  };
}
