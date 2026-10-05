// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER ON THE SNOWMOBILE'S BOARDS (`sled.ts`), as a reshaping of the
// pose `skierPose` stood him in (`boardPose`) — three-free, so the suite
// reads it, and applied after the pose, as the chair's seat is
// (`skier-seat.ts`), so the stood pose the models are made from is
// untouched.
//
// A mountain rider rides STANDING: a boot on each running board, the knees
// bent to soak up the snow, the trunk leant forward over the bars and his
// hands on the grips, his weight moved across to hang off the uphill side
// on a sidehill and back to keep the nose up in deep snow. His skis and
// poles are on the rack (`sled-view.ts`), so his boots stand on the boards
// themselves (`Board.out`, the stand's spread) and his hands hold the bars,
// not poles. The figure's legs are solved to the boots the stand puts on
// the boards; this moves the TRUNK forward over the hips (rigid, as the
// chair's seat moves it back), takes the hands to the grips — turned with
// the bars — and solves the elbows bent and out to them.

import type { Mounts } from "./skier-mounts.ts";
import { BODY } from "./skier-mounts.ts";
import type { SkierPose } from "./skier-joints.ts";
import { solveLimb } from "./skier-limbs.ts";
import type { V3 } from "./skier-vec.ts";

/** THE BOARDS AND THE BARS in the skier's body frame (his origin): each
 * grip where the turned bars hold it, and how far forward his trunk leans
 * over them, rad. */
export type Board = { grips: readonly [V3, V3]; lean: number };

/** The most and the least lean over the bars, rad — a rider never folds
 * flat onto them, nor stands bolt upright on a moving machine. */
const LEAN_MOST = 0.75;
const LEAN_LEAST = 0.12;

function lerp(a: V3, b: V3, k: number): V3 {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
}

/** The pose `p` stood on the boards with his hands on `board`'s grips, by
 * `share` (blended in as he steps on or off). */
export function boardPose(p: SkierPose, board: Board, _M: Mounts, share = 1): SkierPose {
  const k = Math.max(0, Math.min(1, share));
  if (k <= 0) return p;
  // The trunk turned forward about the hips, rigid, to the lean asked.
  const lean = Math.max(LEAN_LEAST, Math.min(LEAN_MOST, board.lean));
  const turn = (lean - p.pitch) * k;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const carry = (q: V3): V3 => {
    const y = q.y - p.hips.y;
    const z = q.z - p.hips.z;
    // Forward pitch takes up toward forward: (y, z) turned by +turn about x.
    return { x: q.x, y: p.hips.y + y * cos - z * sin, z: p.hips.z + z * cos + y * sin };
  };
  const shoulders = [carry(p.shoulders[0]), carry(p.shoulders[1])] as [V3, V3];
  // The hands on the grips, held in reach of the shoulders.
  const reach = BODY.upperArm + BODY.forearm - 0.02;
  const hands = [0, 1].map((i) => {
    const g = board.grips[i];
    const s = shoulders[i];
    const d = Math.hypot(g.x - s.x, g.y - s.y, g.z - s.z);
    const held = d > reach ? lerp(s, g, reach / d) : g;
    return lerp(p.hands[i], held, k);
  }) as [V3, V3];
  const elbows = [0, 1].map((i) =>
    solveLimb(shoulders[i], hands[i], BODY.upperArm, BODY.forearm, {
      x: i ? 1 : -1,
      y: -0.3,
      z: -0.5,
    }),
  ) as [V3, V3];
  return {
    ...p,
    waist: carry(p.waist),
    neck: carry(p.neck),
    head: carry(p.head),
    pitch: p.pitch + turn,
    shoulders,
    elbows,
    hands,
    // On the rack.
    poles: null,
  };
}
