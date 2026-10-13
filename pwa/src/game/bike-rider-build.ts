// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL RIDER BUILT IN CODE — the procedural-rig candidate's figure,
// in the kit the class's photographs show every downhill racer in: a
// FULL-FACE HELMET (a gloss shell, a chin bar with its vents, a peak, the
// goggles' tinted lens on its strap), a loose long-sleeved JERSEY with the
// team's panels and cuffs, baggy SHORTS over hard-capped KNEE PADS, long
// socks, flat-pedal SHOES with their sticky soles, full-finger GLOVES.
//
// It is RIGID PARTS ON A SOLVED SKELETON, not a skin: every limb's part is
// lofted along its own bone at the bone's own length (`RIDER`), and every
// frame each part is laid between the two joints the solve put it at
// (`bike-rider-ik.ts`'s `RiderJoints`), the loose cloth lapped over every
// joint so no gap opens as a knee folds or an elbow flares. Nothing is a
// clip and nothing is keyed: what the parts show is where the IK put them.
//
// The skeleton can come from three places, each a `RiderJoints`: the solve
// on the bike, the engine's ragdoll when he is thrown, and the walk's key
// when he pushes the bike (`jointsFromPoints`).

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { RiderJoints } from "./bike-rider-ik.ts";
import { RIDER } from "./bike-rider-ik.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { blob, brick, loft, rod } from "./loft-geo.ts";
import type { V3 } from "./bike-look.ts";

/** THE KIT'S COLOURS. */
export const RIDER_KIT = {
  jersey: 0x1d2b4f,
  panel: 0xf28a1a,
  trim: 0xeeeeea,
  shorts: 0x2b2e33,
  shortsTrim: 0x4a4f57,
  pad: 0x141414,
  padCap: 0x2f3236,
  sock: 0x1d2b4f,
  sockBand: 0xf28a1a,
  shoe: 0x1a1a1b,
  sole: 0x3a3b3d,
  glove: 0x1b1c1e,
  palm: 0x3c3f45,
  shell: 0xf2f2ee,
  shellStripe: 0xc0281e,
  shellDark: 0x1d2b4f,
  vent: 0x101010,
  goggleFrame: 0x101112,
  lens: 0xd86a1a,
  strap: 0xf28a1a,
  brace: 0x17181a,
};
const K = RIDER_KIT;

type Finish = "cloth" | "gloss" | "lens";
type Part = {
  mesh: THREE.Group;
  /** The joint it hangs from and the one it points at, read off the
   * skeleton each frame, and the across axis its sections are cut to. */
  from: (j: RiderJoints) => V3;
  to: (j: RiderJoints) => V3;
  across: (j: RiderJoints) => V3;
};

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const neg = (a: V3): V3 => v(-a.x, -a.y, -a.z);

/** A limb's part, built along +y from its joint (0) to the next (`length`). */
type Build = (put: (f: Finish, g: THREE.BufferGeometry) => void, length: number) => void;

export type RiderFigure = {
  group: THREE.Group;
  /** Lay the figure on skeleton `j` (in `group`'s parent's frame); `head`
   * false hides the head (a lens inside it). */
  pose(j: RiderJoints, head?: boolean): void;
  dispose(): void;
};

export function buildRiderFigure(haze: HazeUniforms): RiderFigure {
  const mats: THREE.Material[] = [];
  const make = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(
      new THREE.MeshStandardMaterial({ vertexColors: true, ...p }),
      haze,
      "rider",
    );
    mats.push(m);
    return m;
  };
  const M: Record<Finish, THREE.MeshStandardMaterial> = {
    cloth: make({ roughness: 0.86, metalness: 0 }),
    gloss: make({ roughness: 0.22, metalness: 0.05 }),
    lens: make({ roughness: 0.08, metalness: 0.75 }),
  };
  const geos: THREE.BufferGeometry[] = [];
  const group = new THREE.Group();
  group.name = "bike-rider";
  const parts: Part[] = [];

  const part = (
    build: Build,
    length: number,
    from: Part["from"],
    to: Part["to"],
    across: Part["across"],
  ): THREE.Group => {
    const by = new Map<Finish, THREE.BufferGeometry[]>();
    build((f, g) => {
      const l = by.get(f) ?? [];
      l.push(g.index ? g.toNonIndexed() : g);
      by.set(f, l);
    }, length);
    const mesh = new THREE.Group();
    for (const [f, list] of by) {
      const g = mergeGeometries(list, false);
      for (const l of list) l.dispose();
      if (!g) continue;
      geos.push(g);
      const m = new THREE.Mesh(g, M[f]);
      m.castShadow = true;
      mesh.add(m);
    }
    group.add(mesh);
    parts.push({ mesh, from, to, across });
    return mesh;
  };

  // A limb's loose sleeve: a sweep up +y with a section `r0`→`r1`, flattened
  // `squash` across, and a little bag in the middle (cloth hangs).
  const sleeve = (
    put: (f: Finish, g: THREE.BufferGeometry) => void,
    a: number,
    b: number,
    r0: number,
    r1: number,
    colour: number,
    squash = 1,
    bag = 0.08,
  ): void => {
    put(
      "cloth",
      loft(
        [v(0, a, 0), v(0, (a + b) / 2, 0), v(0, b, 0)],
        (t) => {
          const r = (r0 + (r1 - r0) * t) * (1 + bag * Math.sin(t * Math.PI));
          return [r * squash, r];
        },
        colour,
        { sides: 14, steps: 5, across: v(1, 0, 0) },
      ),
    );
  };

  for (const i of [0, 1] as const) {
    const side = i ? 1 : -1;
    // The legs' parts are cut with −right across, so their +z is forward
    // down a leg that points down; the arms' too, so their +z is the back
    // of the hand, up.
    const across = (j: RiderJoints): V3 => neg(j.trunk.right);
    // THE THIGH in the shorts: baggy, cut just over the knee, a hem.
    part(
      (put, L) => {
        sleeve(put, -0.06, L * 0.86, 0.084, 0.07, K.shorts, 1, 0.06);
        sleeve(put, L * 0.8, L * 0.87, 0.073, 0.073, K.shortsTrim, 1, 0);
        // A side panel down the outside of the leg.
        put(
          "cloth",
          loft(
            [v(-side * 0.083, 0.05, 0), v(-side * 0.074, L * 0.75, 0)],
            () => [0.006, 0.03],
            K.shortsTrim,
            { sides: 6, across: v(0, 0, 1) },
          ),
        );
      },
      RIDER.thigh,
      (j) => j.hips[i],
      (j) => j.knees[i],
      across,
    );
    // THE SHIN: the knee pad's shell and cap over the knee, the long sock
    // down to the shoe's collar.
    part(
      (put, L) => {
        sleeve(put, 0.02, L * 0.85, 0.055, 0.04, K.sock, 1, 0.04);
        sleeve(put, L * 0.52, L * 0.58, 0.05, 0.048, K.sockBand, 1, 0);
        // The pad: a shell over the front of the knee and the top of the shin.
        put(
          "cloth",
          loft(
            [v(0, -0.06, 0.005), v(0, 0.06, 0.012), v(0, 0.2, 0.01)],
            (t) => [0.068 - 0.012 * t, 0.064 - 0.01 * t],
            K.pad,
            {
              sides: 14,
              steps: 4,
              across: v(1, 0, 0),
              outline: (a) => (Math.sin(a) > 0 ? 1.0 : 0.8),
            },
          ),
        );
        put("gloss", blob(v(0, 0.0, 0.05), v(0.05, 0.065, 0.03), K.padCap, 12, 8));
        put(
          "cloth",
          loft([v(0, 0.16, 0.0), v(0, 0.19, 0.0)], () => [0.056, 0.052], K.padCap, { sides: 12 }),
        );
      },
      RIDER.shin,
      (j) => j.knees[i],
      (j) => j.ankles[i],
      across,
    );
    // THE SHOE, from the heel to the toe: a flat-pedal shoe's chunky last,
    // a thick flat sole, the laces' tongue.
    part(
      (put, L) => {
        put(
          "cloth",
          loft(
            [v(0, -0.02, 0.02), v(0, L * 0.5, 0.025), v(0, L + 0.02, 0.012)],
            (t) => [0.045 - 0.006 * t, 0.042 - 0.016 * t],
            K.shoe,
            {
              sides: 12,
              steps: 4,
              across: v(1, 0, 0),
              outline: (a) => (Math.sin(a) < 0 ? 1.1 : 1),
            },
          ),
        );
        put(
          "cloth",
          loft([v(0, -0.035, -0.022), v(0, L + 0.04, -0.016)], () => [0.048, 0.011], K.sole, {
            sides: 8,
            across: v(1, 0, 0),
            outline: (a) => 1 / Math.max(Math.abs(Math.cos(a)) * 0.95, Math.abs(Math.sin(a))),
          }),
        );
        // The collar round the ankle.
        put("cloth", rod(v(0, -0.02, 0.03), v(0, -0.02, 0.1), 0.044, K.shoe, 12, 0.04));
      },
      RIDER.foot.heel + RIDER.foot.toe,
      (j) => heelOf(j, i),
      (j) => j.toes[i],
      across,
    );
    // THE UPPER ARM in the jersey's loose sleeve.
    part(
      (put, L) => {
        sleeve(put, -0.03, L + 0.02, 0.06, 0.05, K.jersey, 1, 0.08);
        sleeve(put, -0.035, L * 0.45, 0.064, 0.058, K.panel, 1, 0.05);
      },
      RIDER.upperArm,
      (j) => j.shoulders[i],
      (j) => j.elbows[i],
      across,
    );
    // THE FOREARM, the cuff, and the GLOVED FIST closed round the grip.
    part(
      (put, L) => {
        sleeve(put, -0.02, L - 0.07, 0.05, 0.04, K.jersey, 1, 0.06);
        sleeve(put, L - 0.11, L - 0.07, 0.042, 0.042, K.trim, 1, 0);
        put("cloth", rod(v(0, L - 0.075, 0), v(0, L - 0.04, 0), 0.034, K.glove, 12, 0.036));
        // The fist: the back of the hand and the fingers wrapped forward
        // round a bar across it, the thumb under.
        put("cloth", blob(v(0, L - 0.005, 0.008), v(0.045, 0.05, 0.034), K.glove, 12, 8));
        put(
          "cloth",
          loft(
            [v(-0.04, L + 0.015, -0.022), v(0, L + 0.028, -0.03), v(0.04, L + 0.015, -0.022)],
            () => [0.022, 0.022],
            K.palm,
            { sides: 10, across: v(0, 0, 1) },
          ),
        );
        put("cloth", blob(v(side * 0.03, L - 0.02, -0.025), v(0.016, 0.03, 0.016), K.glove, 8, 6));
      },
      RIDER.forearm,
      (j) => j.elbows[i],
      (j) => j.hands[i],
      across,
    );
  }

  // THE TRUNK, built up +y from the pelvis to the neck, its across axis the
  // trunk's right, +z out of the chest.
  part(
    (put, L) => {
      // The jersey: loose at the hem, filled at the chest, the shoulders
      // squared, the back rounded (a section a little deeper behind).
      const prof = (t: number): [number, number] => {
        const w =
          0.165 +
          0.035 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5) -
          0.02 * Math.max(0, t - 0.82) * 5;
        const d = 0.112 + 0.02 * Math.sin(t * Math.PI);
        return [w, d];
      };
      put(
        "cloth",
        loft(
          [
            v(0, -0.1, -0.005),
            v(0, L * 0.35, 0.0),
            v(0, L * 0.75, -0.005),
            v(0, L + 0.015, -0.015),
          ],
          prof,
          K.jersey,
          { sides: 18, steps: 6, across: v(1, 0, 0) },
        ),
      );
      // The panels over the shoulders, the chest band and the collar.
      put(
        "cloth",
        loft(
          [v(0, L * 0.62, -0.005), v(0, L * 0.98, -0.014)],
          (t) => {
            const p = prof(0.62 + 0.36 * t);
            return [p[0] + 0.006, p[1] + 0.006];
          },
          K.panel,
          { sides: 18, steps: 4, across: v(1, 0, 0) },
        ),
      );
      put(
        "cloth",
        loft(
          [v(0, L * 0.4, -0.004), v(0, L * 0.47, -0.004)],
          () => {
            const p = prof(0.43);
            return [p[0] + 0.005, p[1] + 0.005];
          },
          K.trim,
          { sides: 18, across: v(1, 0, 0) },
        ),
      );
      put("cloth", rod(v(0, L - 0.01, -0.01), v(0, L + 0.04, -0.005), 0.062, K.trim, 14, 0.055));
      // The shorts' waist and seat under the jersey's hem.
      put("cloth", blob(v(0, -0.05, -0.02), v(0.16, 0.1, 0.115), K.shorts, 16, 10));
      put(
        "cloth",
        loft([v(0, -0.1, -0.005), v(0, -0.06, -0.005)], () => [0.16, 0.112], K.shortsTrim, {
          sides: 18,
        }),
      );
      // The neck brace over the collar, and the neck up into the helmet.
      put("cloth", rod(v(0, L - 0.005, -0.01), v(0, L + 0.05, 0.0), 0.095, K.brace, 16, 0.08));
      put("cloth", rod(v(0, L + 0.04, 0.0), v(0, L + 0.11, 0.02), 0.05, K.shellDark, 10, 0.047));
    },
    RIDER.spine,
    (j) => j.pelvis,
    (j) => j.neck,
    (j) => j.trunk.right,
  );

  // THE HEAD in its FULL-FACE HELMET, built about the head's centre: +y the
  // crown, +z the face.
  const head = part(
    (put) => {
      // The shell, longer front to back than across, a little over the
      // head's centre; its stripe and its dark lower rim.
      put("gloss", blob(v(0, 0.025, -0.012), v(0.128, 0.138, 0.152), K.shell, 22, 14));
      put(
        "gloss",
        loft(
          [v(0, 0.16, 0.08), v(0, 0.17, -0.02), v(0, 0.12, -0.14)],
          () => [0.032, 0.012],
          K.shellStripe,
          { sides: 8, steps: 6, across: v(1, 0, 0) },
        ),
      );
      put(
        "gloss",
        loft(
          [
            v(-0.126, -0.05, -0.08),
            v(-0.13, -0.075, 0.04),
            v(0, -0.105, 0.155),
            v(0.13, -0.075, 0.04),
            v(0.126, -0.05, -0.08),
          ],
          () => [0.022, 0.03],
          K.shellDark,
          { sides: 10, steps: 5, across: v(0, 1, 0) },
        ),
      );
      // The chin bar: swept round the jaw, its vents.
      put(
        "gloss",
        loft(
          [
            v(-0.11, -0.02, 0.06),
            v(-0.075, -0.09, 0.14),
            v(0, -0.11, 0.175),
            v(0.075, -0.09, 0.14),
            v(0.11, -0.02, 0.06),
          ],
          (t) => [0.032 + 0.008 * Math.sin(t * Math.PI), 0.034],
          K.shell,
          { sides: 12, steps: 6, across: v(0, 1, 0) },
        ),
      );
      for (const x of [-0.025, 0, 0.025])
        put("gloss", brick(v(x, -0.104, 0.205), 0.012, 0.03, 0.01, K.vent));
      // The peak over the brow.
      put(
        "gloss",
        loft(
          [v(-0.1, 0.1, 0.12), v(0, 0.115, 0.2), v(0.1, 0.1, 0.12)],
          () => [0.05, 0.006],
          K.shellStripe,
          { sides: 8, steps: 6, across: v(0, 0, 1) },
        ),
      );
      // The goggles in the eye port: frame, tinted lens, the strap round
      // the shell.
      put(
        "gloss",
        loft(
          [
            v(-0.085, 0.035, 0.115),
            v(-0.04, 0.03, 0.155),
            v(0.04, 0.03, 0.155),
            v(0.085, 0.035, 0.115),
          ],
          () => [0.03, 0.017],
          K.goggleFrame,
          { sides: 10, steps: 4, across: v(0, 1, 0) },
        ),
      );
      put(
        "lens",
        loft(
          [
            v(-0.075, 0.035, 0.13),
            v(-0.035, 0.03, 0.169),
            v(0.035, 0.03, 0.169),
            v(0.075, 0.035, 0.13),
          ],
          () => [0.022, 0.006],
          K.lens,
          { sides: 8, steps: 4, across: v(0, 1, 0) },
        ),
      );
      put(
        "cloth",
        loft(
          [
            v(-0.1, 0.04, 0.09),
            v(-0.14, 0.045, -0.02),
            v(0, 0.05, -0.17),
            v(0.14, 0.045, -0.02),
            v(0.1, 0.04, 0.09),
          ],
          () => [0.018, 0.004],
          K.strap,
          { sides: 6, steps: 6, across: v(0, 1, 0) },
        ),
      );
      // The dark of the face port under the goggles.
      put("cloth", blob(v(0, -0.03, 0.115), v(0.07, 0.045, 0.04), K.vent, 10, 6));
    },
    0,
    (j) => j.head,
    (j) => j.head,
    (j) => j.face,
  );

  const m = new THREE.Matrix4();
  const X = new THREE.Vector3();
  const Y = new THREE.Vector3();
  const Z = new THREE.Vector3();
  return {
    group,
    pose(j, showHead = true) {
      for (const p of parts) {
        const a = p.from(j);
        const b = p.to(j);
        if (p.mesh === head) {
          // The helmet: +y the crown, +z the face.
          Y.set(j.crown.x, j.crown.y, j.crown.z).normalize();
          Z.set(j.face.x, j.face.y, j.face.z);
          Z.addScaledVector(Y, -Z.dot(Y)).normalize();
          X.crossVectors(Y, Z);
          m.makeBasis(X, Y, Z);
          p.mesh.quaternion.setFromRotationMatrix(m);
          p.mesh.position.set(a.x, a.y, a.z);
          p.mesh.visible = showHead;
          continue;
        }
        Y.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
        const c = p.across(j);
        X.set(c.x, c.y, c.z);
        X.addScaledVector(Y, -X.dot(Y));
        if (X.lengthSq() < 1e-8) X.set(1, 0, 0).addScaledVector(Y, -Y.x);
        X.normalize();
        Z.crossVectors(X, Y);
        m.makeBasis(X, Y, Z);
        p.mesh.quaternion.setFromRotationMatrix(m);
        p.mesh.position.set(a.x, a.y, a.z);
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const x of mats) x.dispose();
    },
  };
}

/** The heel's end of a shoe: back of the ankle along the foot, down to the
 * sole's top — so the shoe's part runs heel to toe. */
function heelOf(j: RiderJoints, i: 0 | 1): V3 {
  const b = j.balls[i];
  const t = j.toes[i];
  const d = { x: t.x - b.x, y: t.y - b.y, z: t.z - b.z };
  const n = Math.hypot(d.x, d.y, d.z) || 1;
  const k = RIDER.foot.heel / n;
  return { x: b.x - d.x * k, y: b.y - d.y * k, z: b.z - d.z * k };
}
