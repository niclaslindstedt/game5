// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER — a racer in his kit, hung on the points `skier-pose.ts` works
// out. Drawn after photographs of skiers seen from behind, which is where
// the chase camera sees him: a round ski helmet sat down on a tall collar
// with no neck showing, the goggles' strap round its back and a stripe
// over its crown, the goggles framed in the eye port (the head has its own
// lab sheet, `head`); a shell jacket that is one broad mass from the hem to
// the shoulders — gathered across the belly and hanging in folds down the
// back, the shoulders sloping into the collar under a contrasting YOKE;
// sleeves creased at the elbow and bunched into gloves; insulated pants
// round a real seat (two lobes, not a can), creased at the hip and the
// knee and gaitered over the boots' cuffs. The BOOTS are the skis' own,
// clamped in the bindings (`ski-gear.ts`): the figure's shins come down to
// their cuffs and stop. THE POLES hang from his fists — back along the
// hips standing, under the arms in a tuck, one reaching forward to the
// snow on a plant. Every part is cloth (`skier-cloth.ts`): shaped sections
// with their folds, so a limb tapers and creases and a torso has
// shoulders — a figure, not a stack of capsules. Every part is a fixed
// shape only ever turned and moved, never stretched, so the silhouette
// MOVES: tall at rest, folded into the tuck, hung inside a carve at the
// hips with the shoulders level, stood up in the air, folded on his knees
// by a landing.

import * as THREE from "three";

import { cloth, limbRings, shaped, torsoFold } from "./skier-cloth.ts";
import { buildHelmet } from "./skier-helmet.ts";
import { BODY, skierPose, type SkierPose, type SkierPoseInput, type V3 } from "./skier-pose.ts";

export type SkierStyle = {
  jacket: number;
  pants: number;
  helmet: number;
  visor: number;
  /** The jacket's yoke and cuffs — the kit's second colour; the jacket's
   * own when left out. */
  accent?: number;
  /** The helmet's peak, stripe and goggle frame; the helmet's own when
   * left out. */
  peak?: number;
  /** His face in the helmet's port. */
  skin?: number;
  /** The poles' shafts; alloy when left out. */
  pole?: number;
};

export type SkierFigure = {
  group: THREE.Group;
  pose(input: SkierPoseInput): void;
  /** Pose him THROWN, off the engine's ragdoll (`ragdollPose`): the poles
   * let go, every limb where the physics has it. The caller places and
   * turns the group. */
  sprawl(pose: SkierPose): void;
  /** Show or hide the BODY alone — every part but the poles — for a build
   * that draws a modelled skier in his place (`skier-models.ts`) and
   * keeps the code's poles in his hands, since the model carries none. */
  setBodyVisible(v: boolean): void;
  dispose(): void;
};

/** What the poles look like (`ski-looks.ts`'s `pole`): their length, m,
 * and the basket's radius, m. */
export type PoleLook = { length: number; basket: number };

const Y = new THREE.Vector3(0, 1, 0);

export function createSkier(
  style: SkierStyle,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
  poles: PoleLook = { length: 1.2, basket: 0.045 },
): SkierFigure {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const mat = (colour: number, rough = 0.8, metal = 0, name = "skier") => {
    const m = wrap(
      new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness: metal }),
      name,
    );
    mats.push(m);
    return m;
  };
  const jacket = mat(style.jacket, 0.7);
  const accent = mat(style.accent ?? style.jacket, 0.6);
  const pants = mat(style.pants, 0.85);
  const glove = mat(0x17191d, 0.75);
  const boot = mat(0x121316, 0.7);
  const shaft = mat(style.pole ?? 0x9aa1a9, 0.35, style.pole === undefined ? 0.8 : 0.2);
  const helmet = mat(style.helmet, 0.3);
  const peakMat = mat(style.peak ?? style.helmet, 0.35);
  const lens = mat(style.visor, 0.12, 0.6);
  const strap = mat(0x101114, 0.6);
  const liner = mat(0x26282c, 0.9);
  const skin = mat(style.skin ?? 0xd9a07e, 0.7);

  const geo = <G extends THREE.BufferGeometry>(g: G): G => {
    geos.push(g);
    return g;
  };
  const part = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = group) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // THE LEGS: insulated pants, baggy at the thigh, creased where the leg
  // comes out of the seat and behind the knee, and flared at the foot of
  // the shin over the boot's cuff — the gaiter every ski pant has.
  const { thigh: TH, shin: SH } = BODY;
  // Each limb is turned so its +z is where the joint's bend points: the top
  // of the thigh and the front of the shin, toward the knee.
  const thighGeo = geo(
    shaped(
      limbRings(TH, [0.108, 0.11, 0.104, 0.096, 0.088], 0.92),
      cloth(
        8,
        [
          { at: 0.03, reach: 0.1, pitch: 0.08, amp: 0.08, side: 1 },
          { at: TH, reach: 0.15, pitch: 0.08, amp: 0.14, side: -1 },
        ],
        [
          { at: TH - 0.01, reach: 0.09, amp: 0.12, side: 1 },
          { at: 0.12, reach: 0.12, amp: 0.07, side: -1 },
        ],
      ),
    ),
  );
  const shinGeo = geo(
    shaped(
      [
        { y: -0.06, w: 0.045, d: 0.045 },
        { y: -0.035, w: 0.075, d: 0.075 },
        { y: 0, w: 0.088, d: 0.086 },
        { y: 0.1, w: 0.084, d: 0.082 },
        { y: SH - 0.25, w: 0.082, d: 0.082 },
        { y: SH - 0.18, w: 0.098, d: 0.1 },
        { y: SH - 0.14, w: 0.104, d: 0.106 },
        { y: SH - 0.13, w: 0.1, d: 0.102 },
      ],
      cloth(
        8,
        [
          { at: 0, reach: 0.12, pitch: 0.08, amp: 0.12, side: -1 },
          { at: SH - 0.22, reach: 0.07, pitch: 0.06, amp: 0.05 },
        ],
        [{ at: 0, reach: 0.08, amp: 0.12, side: 1 }],
      ),
    ),
  );
  const thighs = [0, 1].map(() => part(thighGeo, pants));
  const shins = [0, 1].map(() => part(shinGeo, pants));
  // The gaiter: the pants' padded shaft down over the boot's cuff — the
  // boot itself is the ski's, clamped in the binding (`ski-gear.ts`).
  const shaftGeo = geo(
    shaped(
      [
        { y: 0, w: 0.074, d: 0.08 },
        { y: 0.14, w: 0.08, d: 0.085 },
        { y: 0.18, w: 0.078, d: 0.082 },
        { y: 0.2, w: 0.066, d: 0.07 },
      ],
      { segments: 8, boxy: 2.4 },
    ),
  );
  const shafts = [0, 1].map(() => part(shaftGeo, boot));

  // THE ARMS: jacket sleeves, bulky at the shoulder and tapering to the
  // wrist, gathered in creases on both sides of the elbow and bunched where
  // the sleeve goes into the gauntlet, whose cuff flares over its end.
  // +z is the point of the elbow; the crook, where they crease, is −z.
  const UA = BODY.upperArm;
  const upperGeo = geo(
    shaped(
      limbRings(UA, [0.088, 0.09, 0.086, 0.08, 0.074]),
      cloth(
        8,
        [
          { at: 0.04, reach: 0.08, pitch: 0.07, amp: 0.06, side: -1 },
          { at: UA, reach: 0.12, pitch: 0.075, amp: 0.14, side: -1 },
        ],
        [{ at: UA - 0.03, reach: 0.1, amp: 0.1, side: 1 }],
      ),
    ),
  );
  const foreGeo = geo(
    shaped(
      [
        { y: -0.05, w: 0.04, d: 0.04 },
        { y: -0.025, w: 0.066, d: 0.066 },
        { y: 0, w: 0.076, d: 0.076 },
        { y: 0.08, w: 0.07, d: 0.068 },
        { y: 0.15, w: 0.07, d: 0.068 },
        { y: 0.2, w: 0.076, d: 0.074 },
        { y: 0.215, w: 0.06, d: 0.058 },
      ],
      cloth(
        8,
        [
          { at: 0, reach: 0.11, pitch: 0.07, amp: 0.14, side: -1 },
          { at: 0.16, reach: 0.06, pitch: 0.05, amp: 0.06 },
        ],
        [{ at: 0.02, reach: 0.08, amp: 0.08, side: 1 }],
      ),
    ),
  );
  const upper = [0, 1].map(() => part(upperGeo, jacket));
  const fore = [0, 1].map(() => part(foreGeo, jacket));
  // The gauntlet: the flared cuff, then the fist closed round the grip —
  // along the forearm, the grip's middle at the forearm's end.
  const cuffGeo = geo(
    shaped(
      [
        { y: -0.15, w: 0.086, d: 0.086 },
        { y: -0.13, w: 0.09, d: 0.09 },
        { y: -0.07, w: 0.056, d: 0.052 },
        { y: -0.04, w: 0.048, d: 0.052 },
        { y: 0.0, w: 0.052, d: 0.06 },
        { y: 0.04, w: 0.05, d: 0.058 },
        { y: 0.06, w: 0.036, d: 0.04 },
      ],
      { segments: 8, boxy: 2.4 },
    ),
  );
  const hands = [0, 1].map(() => part(cuffGeo, glove));

  // THE POLES: a shaft from the fist to the basket, drawn along +y from
  // the basket end so it is hung like a limb, and the basket at its foot.
  const poleGeo = geo(new THREE.CylinderGeometry(0.007, 0.009, poles.length, 6));
  const basketGeo = geo(new THREE.CylinderGeometry(poles.basket, poles.basket, 0.008, 10));
  const poleMeshes = [0, 1].map(() => {
    const g = new THREE.Group();
    group.add(g);
    part(poleGeo, shaft, g).position.set(0, poles.length / 2, 0);
    part(basketGeo, glove, g).position.set(0, 0.05, 0);
    return g;
  });

  // THE TORSO, in its own frame: y up the spine from the hips, z out of
  // the chest. A wind jacket, one boxy mass from the hem to the shoulders,
  // sloping into a tall collar, with its folds (`torsoFold`); the yoke over
  // the shoulders and the hem band carry the same folds, sat just proud.
  const sp = BODY.spine;
  const top = sp - BODY.shoulderDrop;
  // Rings every 1.8 cm where the jacket gathers and folds, 4 cm above.
  const jacketCloth = {
    segments: 16,
    fold: torsoFold(top),
    step: (y: number) => (y < 0.3 ? 0.018 : 0.04),
  };
  const torso = new THREE.Group();
  group.add(torso);
  part(
    geo(
      shaped(
        [
          { y: -0.07, w: 0.19, d: 0.138, z: -0.01 },
          { y: 0.0, w: 0.194, d: 0.144, z: -0.005 },
          { y: 0.12, w: 0.19, d: 0.14 },
          { y: 0.24, w: 0.206, d: 0.146, z: 0.005 },
          { y: top - 0.06, w: 0.238, d: 0.15, z: 0.01 },
          { y: top, w: 0.244, d: 0.142, z: 0.02 },
          { y: top + 0.04, w: 0.21, d: 0.12, z: 0.015 },
          { y: sp - 0.005, w: 0.13, d: 0.1, z: 0.005 },
          { y: sp + 0.01, w: 0.09, d: 0.088 },
        ],
        jacketCloth,
      ),
    ),
    jacket,
    torso,
  );
  part(
    geo(
      shaped(
        [
          { y: top - 0.1, w: 0.234, d: 0.151, z: 0.01 },
          { y: top - 0.06, w: 0.243, d: 0.155, z: 0.01 },
          { y: top, w: 0.249, d: 0.147, z: 0.02 },
          { y: top + 0.04, w: 0.215, d: 0.125, z: 0.015 },
          { y: sp - 0.005, w: 0.135, d: 0.105, z: 0.005 },
          { y: sp + 0.012, w: 0.095, d: 0.092 },
        ],
        jacketCloth,
      ),
    ),
    accent,
    torso,
  );
  part(
    geo(
      shaped(
        [
          { y: -0.075, w: 0.195, d: 0.143, z: -0.01 },
          { y: -0.045, w: 0.198, d: 0.147, z: -0.008 },
          { y: -0.02, w: 0.199, d: 0.149, z: -0.006 },
        ],
        jacketCloth,
      ),
    ),
    accent,
    torso,
  );
  // The collar, standing up round the back of the neck — set back, since
  // the torso leans forward and a collar square to it juts under the chin.
  part(
    geo(
      shaped(
        [
          { y: sp - 0.02, w: 0.095, d: 0.09, z: -0.01 },
          { y: sp + 0.05, w: 0.085, d: 0.075, z: -0.03 },
          { y: sp + 0.065, w: 0.07, d: 0.06, z: -0.035 },
        ],
        { segments: 10, boxy: 2.1 },
      ),
    ),
    accent,
    torso,
  );
  // THE SEAT OF THE PANTS: the hips, narrowing to the crotch under them,
  // and the two lobes of his backside behind, a cleft between them — what
  // a skier stood tall shows the camera behind him.
  part(
    geo(
      shaped(
        [
          { y: -0.16, w: 0.07, d: 0.07, z: 0.01 },
          { y: -0.13, w: 0.14, d: 0.11, z: 0.0 },
          { y: -0.06, w: 0.178, d: 0.122, z: 0.005 },
          { y: 0.0, w: 0.184, d: 0.126, z: 0.005 },
          { y: 0.05, w: 0.178, d: 0.124, z: 0.005 },
        ],
        { segments: 12, step: 0.035 },
      ),
    ),
    pants,
    torso,
  );
  const lobeGeo = geo(
    shaped(
      [
        { y: -0.1, w: 0.03, d: 0.03 },
        { y: -0.085, w: 0.07, d: 0.06 },
        { y: -0.04, w: 0.094, d: 0.082 },
        { y: 0.02, w: 0.096, d: 0.084 },
        { y: 0.07, w: 0.082, d: 0.07 },
        { y: 0.1, w: 0.04, d: 0.035 },
      ],
      { segments: 10, boxy: 2.1, step: 0.03 },
    ),
  );
  for (const side of [-1, 1]) {
    const lobe = part(lobeGeo, pants, torso);
    lobe.position.set(side * 0.074, -0.07, -0.052);
    // Tipped back at the foot and splayed out a little, so they round
    // under into the seat and part at the cleft.
    lobe.rotation.set(0.35, 0, side * 0.12);
  }

  // THE HEAD IN HIS HELMET, a model of its own (`skier-helmet.ts`) in the
  // head's frame: z forward, y up.
  const headGroup = new THREE.Group();
  group.add(headGroup);
  buildHelmet(headGroup, { shell: helmet, liner, trim: peakMat, lens, strap, skin }, geo);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const out = new THREE.Vector3();
  const side = new THREE.Vector3();
  const limb = new THREE.Matrix4();
  /** Hang a part whose origin is a joint and whose +y runs to the next,
   * turned about its length so its +z faces `face` — where the joint's
   * bend points, so the cloth's knee pad sits on the knee. */
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
  const knee = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  /** Where a bend points: the middle joint off the line between the ends,
   * or `lean` (small) when the limb is straight. */
  const bendOf = (into: THREE.Vector3, root: V3, mid: V3, tip: V3, lean: V3) =>
    into.set(
      mid.x - (root.x + tip.x) / 2 + lean.x,
      mid.y - (root.y + tip.y) / 2 + lean.y,
      mid.z - (root.z + tip.z) / 2 + lean.z,
    );
  const spineUp = new THREE.Vector3();
  const chestOut = new THREE.Vector3();
  const across = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const poleUp = new THREE.Vector3();

  return {
    group,
    pose(input) {
      lay(skierPose(input));
    },
    sprawl(pose) {
      lay(pose, true);
    },
    setBodyVisible(v) {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh && !poleMeshes.some((g) => isUnder(o, g))) o.visible = v;
      });
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };

  /** Whether `o` hangs anywhere under `group`. */
  function isUnder(o: THREE.Object3D, group: THREE.Object3D): boolean {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === group) return true;
    return false;
  }

  /** Hang the figure on a pose's points — `free`, off the skis, with the
   * poles let go. */
  function lay(p: SkierPose, free = false): void {
    for (let i = 0; i < 2; i++) {
      const hip = {
        x: p.hips.x + (i === 0 ? -1 : 1) * BODY.hip * Math.cos(p.roll),
        y: p.hips.y - (i === 0 ? -1 : 1) * BODY.hip * Math.sin(p.roll),
        z: p.hips.z,
      };
      const sd = i === 0 ? -1 : 1;
      bendOf(knee, hip, p.knees[i], p.feet[i], { x: 0, y: 0, z: 0.01 });
      bendOf(elbow, p.shoulders[i], p.elbows[i], p.hands[i], { x: sd * 0.01, y: -0.005, z: 0 });
      hang(thighs[i], hip, p.knees[i], knee);
      hang(shins[i], p.knees[i], p.feet[i], knee);
      // The gaiter stands on the boot's cuff, up the shin toward the knee.
      hang(shafts[i], p.feet[i], p.knees[i], knee);
      hang(upper[i], p.shoulders[i], p.elbows[i], elbow);
      hang(fore[i], p.elbows[i], p.hands[i], elbow);
      // The glove turned along the forearm, closed round the grip.
      hang(hands[i], p.elbows[i], p.hands[i], elbow);
      hands[i].position.set(p.hands[i].x, p.hands[i].y, p.hands[i].z);
      // The pole from its basket up to the fist; gone when he has let go.
      const pole = p.poles?.[i] ?? null;
      poleMeshes[i].visible = !free && pole !== null;
      if (pole) {
        poleUp.set(0, 0, 0);
        hang(poleMeshes[i], pole, p.hands[i], poleUp);
      }
    }
    // The torso's frame: up the spine, across the shoulders, out of the
    // chest — so the jacket turns with the angulation as well as the pitch.
    spineUp.set(p.neck.x - p.hips.x, p.neck.y - p.hips.y, p.neck.z - p.hips.z).normalize();
    across
      .set(
        p.shoulders[1].x - p.shoulders[0].x,
        p.shoulders[1].y - p.shoulders[0].y,
        p.shoulders[1].z - p.shoulders[0].z,
      )
      .normalize();
    chestOut.crossVectors(across, spineUp).normalize();
    across.crossVectors(spineUp, chestOut).normalize();
    basis.makeBasis(across, spineUp, chestOut);
    torso.quaternion.setFromRotationMatrix(basis);
    torso.position.set(p.hips.x, p.hips.y, p.hips.z);
    headGroup.position.set(p.head.x, p.head.y, p.head.z);
    // The head held nearer level than the shoulders — a skier looks down
    // the hill out of a tuck — and turned a little into the turn.
    headGroup.rotation.set(-0.2 + p.pitch * 0.3, p.look * 0.5, -p.roll * 0.35, "YXZ");
  }
}
