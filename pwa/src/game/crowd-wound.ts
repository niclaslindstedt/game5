// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE A PERSON STRUCK BLEEDS FROM — the wound on his body that the blood
// of a meeting (`crowd-gore.ts`) comes out of, read off his ragdoll
// (`Thrown.points`, `RAGDOLL` order) so it goes with him as he is flung.
// DOM-free and three-free (`tests/crowd_wound_test.ts`).
//
// At the blow (`woundOf`) the struck spot is put in his TRUNK'S own frame:
// how far up the trunk from his hips to his shoulders the blow came (the
// struck event's height, kept to the chest and the belly), and which way
// round his trunk the player came from (the event's spot lies between the
// two middles, so the way from his middle to it is the way to the player),
// on the torso's front a `DEPTH` out from its middle line. Every frame
// after (`woundAt`) the same spot is found on the trunk as it now lies —
// tumbled, turned over, slid — so what runs out of it runs out of HIM, not
// out of the air where the two met.

import { RAGDOLL } from "@engine";

type V3 = { x: number; y: number; z: number };

/** The struck spot in his trunk's frame: `up`, the share of the way from
 * his hips' middle to his shoulders' (0..1); `right` and `fwd`, the way
 * round his trunk to the player, a unit pair across it. */
export type Wound = { up: number; right: number; fwd: number };

/** Half a torso's depth, m: how far out from the trunk's middle line its
 * surface lies, where the blow lands. */
export const DEPTH = 0.12;

/** How far up the trunk a wound may lie: the belly to the top of the
 * chest — a blow at a body's middle height never bleeds from the hips. */
const UP: readonly [number, number] = [0.3, 0.85];

const hips: V3 = { x: 0, y: 0, z: 0 };
const up: V3 = { x: 0, y: 0, z: 0 };
const right: V3 = { x: 0, y: 0, z: 0 };
const fwd: V3 = { x: 0, y: 0, z: 0 };

/** His trunk's frame off the ragdoll's points into the scratch vectors:
 * `hips` its foot, `up` from it to the shoulders' middle (its length the
 * trunk's), `right` across the shoulders square to it, `fwd` square to
 * both. Whether the trunk could be read. */
function trunk(p: readonly number[]): boolean {
  const hl = 3 * RAGDOLL.hipL;
  const hr = 3 * RAGDOLL.hipR;
  const sl = 3 * RAGDOLL.shoulderL;
  const sr = 3 * RAGDOLL.shoulderR;
  if (p.length < 3 * RAGDOLL.count) return false;
  hips.x = (p[hl] + p[hr]) / 2;
  hips.y = (p[hl + 1] + p[hr + 1]) / 2;
  hips.z = (p[hl + 2] + p[hr + 2]) / 2;
  up.x = (p[sl] + p[sr]) / 2 - hips.x;
  up.y = (p[sl + 1] + p[sr + 1]) / 2 - hips.y;
  up.z = (p[sl + 2] + p[sr + 2]) / 2 - hips.z;
  const ul = Math.hypot(up.x, up.y, up.z);
  if (ul < 1e-6) return false;
  const ux = up.x / ul;
  const uy = up.y / ul;
  const uz = up.z / ul;
  right.x = p[sr] - p[sl];
  right.y = p[sr + 1] - p[sl + 1];
  right.z = p[sr + 2] - p[sl + 2];
  const along = right.x * ux + right.y * uy + right.z * uz;
  right.x -= along * ux;
  right.y -= along * uy;
  right.z -= along * uz;
  const rl = Math.hypot(right.x, right.y, right.z);
  if (rl < 1e-6) return false;
  right.x /= rl;
  right.y /= rl;
  right.z /= rl;
  fwd.x = uy * right.z - uz * right.y;
  fwd.y = uz * right.x - ux * right.z;
  fwd.z = ux * right.y - uy * right.x;
  return true;
}

/** THE WOUND AT THE BLOW: his ragdoll's points `p` as he is struck, and
 * the struck event's spot `at` (between the two, at a body's middle
 * height). Null when his trunk cannot be read. */
export function woundOf(p: readonly number[], at: V3): Wound | null {
  if (!trunk(p)) return null;
  const tall = up.y;
  const share = tall > 1e-6 ? (at.y - hips.y) / tall : 0.5;
  const u = Math.min(UP[1], Math.max(UP[0], share));
  // The way to the player, from his trunk's middle line at that height.
  const dx = at.x - (hips.x + up.x * u);
  const dz = at.z - (hips.z + up.z * u);
  let r = dx * right.x + dz * right.z;
  let f = dx * fwd.x + dz * fwd.z;
  const l = Math.hypot(r, f);
  if (l < 1e-6) {
    r = 0;
    f = 1;
  } else {
    r /= l;
    f /= l;
  }
  return { up: u, right: r, fwd: f };
}

/** THE WOUND NOW, on his trunk as it lies in `p`, into `out` (world, m);
 * false when the trunk cannot be read. */
export function woundAt(p: readonly number[], w: Wound, out: V3): boolean {
  if (!trunk(p)) return false;
  out.x = hips.x + up.x * w.up + (right.x * w.right + fwd.x * w.fwd) * DEPTH;
  out.y = hips.y + up.y * w.up + (right.y * w.right + fwd.y * w.fwd) * DEPTH;
  out.z = hips.z + up.z * w.up + (right.z * w.right + fwd.z * w.fwd) * DEPTH;
  return true;
}

/** The way out of the wound now, a unit vector into `out`: the side of
 * his trunk it is on. False when the trunk cannot be read. */
export function woundFacing(p: readonly number[], w: Wound, out: V3): boolean {
  if (!trunk(p)) return false;
  out.x = right.x * w.right + fwd.x * w.fwd;
  out.y = right.y * w.right + fwd.y * w.fwd;
  out.z = right.z * w.right + fwd.z * w.fwd;
  return true;
}
