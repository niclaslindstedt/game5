// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAD GIVES: a lift tower's foam sleeve (`TOWER_PAD`) dented where a
// body meets it. The engine stands the body off the pad's surface as off
// any upright; the foam's give is drawn here. A blow drives the face in at
// once — by its share of the foam's 11 m/s (`GORE.smash.pad`), the whole of
// its usable depth at anything faster — a body lying against it holds a
// shallower dent, and the foam slowly comes back once he is off it.
//
// Drawn as the whole sleeve flattened along the way it was struck, the far
// side held where it stands: at a pad's depth the octagon reads as caved
// in on the face he hit, not moved. Presentation only, off the body's own
// record (`Thrown.struck`, its points); nothing is stepped but the dents.

import * as THREE from "three";
import { GORE, RAGDOLL, TOWER_PAD, type Thrown } from "@engine";

/** One pad as it stands: its foot, its turn, its radius and height, m. */
export type PadSpot = { x: number; y: number; z: number; yaw: number; r: number; h: number };

/** THE FOAM: the share of its thickness it crushes to, the speed it takes
 * whole, m/s (√(2·g·thick) at `GORE.smash.pad` g), the share of a full
 * dent a body leaning on it holds, how near a point's surface counts as on
 * it, m, how fast the face goes in, m/s, and the time it takes to come
 * back, s. */
export const PAD_GIVE = {
  depth: 0.8,
  full: Math.sqrt(2 * GORE.smash.pad * 9.81 * TOWER_PAD.thick),
  lean: 0.35,
  touch: 0.08,
  in: 6,
  back: 0.9,
} as const;

/** The radius of a ragdoll point, m: a hand's to the trunk's. */
const POINT = 0.12;

type Dent = { d: number; ux: number; uz: number };

export function createPadGive(
  mesh: THREE.InstancedMesh,
  pads: readonly PadSpot[],
): { update(t: number, body?: Thrown | null): void } {
  const dents: Dent[] = pads.map(() => ({ d: 0, ux: 0, uz: 1 }));
  const most = PAD_GIVE.depth * TOWER_PAD.thick;
  const m = new THREE.Matrix4();
  const a = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  let last = -1;
  let moved = false;

  const place = (i: number): void => {
    const p = pads[i];
    const { d, ux, uz } = dents[i];
    const k = d / (2 * p.r);
    // Squashed along (ux, uz) by `d`, its far side kept where it stands.
    a.set(
      1 - k * ux * ux,
      0,
      -k * ux * uz,
      p.x + (ux * d) / 2,
      0,
      1,
      0,
      p.y,
      -k * ux * uz,
      0,
      1 - k * uz * uz,
      p.z + (uz * d) / 2,
      0,
      0,
      0,
      1,
    );
    q.setFromAxisAngle(up, p.yaw);
    m.compose(at.set(0, 0, 0), q, size.set(p.r, p.h, p.r));
    mesh.setMatrixAt(i, a.multiply(m));
    moved = true;
  };

  return {
    update(t, body) {
      const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, t - last));
      last = t;
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i];
        const dent = dents[i];
        let want = 0;
        if (body) {
          const P = body.points;
          // Only a pad near him is looked at point by point.
          if (Math.hypot(P[0] - p.x, P[2] - p.z) < p.r + 3)
            for (let j = 0; j < RAGDOLL.count; j++) {
              const x = P[3 * j];
              const y = P[3 * j + 1];
              const z = P[3 * j + 2];
              if (y < p.y || y > p.y + p.h) continue;
              const dx = x - p.x;
              const dz = z - p.z;
              const dist = Math.hypot(dx, dz);
              if (dist - p.r - POINT > PAD_GIVE.touch) continue;
              const blow = Math.min(1, Math.max(PAD_GIVE.lean, body.struck[j] / PAD_GIVE.full));
              if (most * blow > want) {
                want = most * blow;
                dent.ux = -dx / (dist || 1);
                dent.uz = -dz / (dist || 1);
              }
            }
        }
        const before = dent.d;
        if (want > dent.d) dent.d = Math.min(want, dent.d + PAD_GIVE.in * dt);
        else if (dent.d > 0) dent.d = Math.max(want, dent.d - (dent.d * dt) / PAD_GIVE.back);
        if (dent.d < 1e-3) dent.d = 0;
        if (dent.d !== before) place(i);
      }
      if (moved) {
        mesh.instanceMatrix.needsUpdate = true;
        moved = false;
      }
    },
  };
}
