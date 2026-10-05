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
// not poles. The figure is stood centred over his boots, so the legs the
// pose solves to them are a rider's at rest; this moves his weight where
// the engine has it (`Board.hang`) — the hips part of the way across and
// back, the knees solved again so the inside one bends and the outside one
// is let long, and the trunk leant into the turn for the rest — then turns
// the TRUNK forward over the hips (rigid, as the chair's seat moves it
// back), takes the hands to the grips — turned with the bars — and solves
// the elbows bent and out to them. Every one of those a smooth function of
// the hang: the hips are never handed to the pose's own fit of the legs to
// the boots, which lets a hip carried out past its knee go all at once.

import type { Mounts } from "./skier-mounts.ts";
import { BODY, SHIN_ABOVE_CUFF } from "./skier-mounts.ts";
import type { SkierPose } from "./skier-joints.ts";
import { solveLimb } from "./skier-limbs.ts";
import type { V3 } from "./skier-vec.ts";

/** THE BOARDS AND THE BARS in the skier's body frame, from the boards'
 * middle his figure is stood over: each grip where the turned bars hold
 * it, how far forward his trunk leans over them, rad, and where the engine
 * has his weight off the boards' middle (`riderFrame`), m — across (+x)
 * and along (+z, forward). */
export type Board = {
  grips: readonly [V3, V3];
  lean: number;
  hang: { x: number; z: number };
};

/** The most and the least lean over the bars, rad — a rider never folds
 * flat onto them, nor stands bolt upright on a moving machine. */
const LEAN_MOST = 0.75;
const LEAN_LEAST = 0.12;
/** How much of his weight's shift across and along the HIPS carry, the
 * rest the trunk's lean; and the trunk's lean into a turn a metre of shift
 * across, rad, as far as `ROLL_MOST`. A rider hanging off a sled moves his
 * hips a hand's breadth inside and puts his shoulders out over the inside
 * board. */
const HIPS_ACROSS = 0.45;
const HIPS_ALONG = 0.6;
const ROLL_PER_M = 1.6;
const ROLL_MOST = 0.38;
/** How much of the trunk's lean the head keeps — the eyes held nearer the
 * horizon. */
const HEAD_KEEP = 0.4;
/** How far a leg reaches from its hip joint to its boot's cuff, of the
 * thigh and the shin above the cuff — the hips let down so neither leg is
 * ever stood straight. */
const LEG_REACH = 0.96;

function lerp(a: V3, b: V3, k: number): V3 {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
}

/** The pose `p` stood on the boards with his hands on `board`'s grips, by
 * `share` (blended in as he steps on or off). */
export function boardPose(p: SkierPose, board: Board, _M: Mounts, share = 1): SkierPose {
  const k = Math.max(0, Math.min(1, share));
  if (k <= 0) return p;
  // THE HIPS where his weight is: carried across and along, then let down
  // as far as the longer leg needs to reach its boot.
  const shift = { x: board.hang.x * HIPS_ACROSS * k, z: board.hang.z * HIPS_ALONG * k };
  const reach = (BODY.thigh + SHIN_ABOVE_CUFF) * LEG_REACH;
  let drop = 0;
  for (let i = 0; i < 2; i++) {
    const h = p.hipJoints[i];
    const f = p.feet[i];
    const dx = h.x + shift.x - f.x;
    const dz = h.z + shift.z - f.z;
    const up = Math.sqrt(Math.max(0, reach * reach - dx * dx - dz * dz));
    drop = Math.max(drop, h.y - f.y - up);
  }
  const moved = (q: V3): V3 => ({ x: q.x + shift.x, y: q.y - drop, z: q.z + shift.z });
  const hips = moved(p.hips);
  const hipJoints = [moved(p.hipJoints[0]), moved(p.hipJoints[1])] as [V3, V3];
  // The knees solved again to the boots, bent forward and out.
  const knees = [0, 1].map((i) =>
    solveLimb(hipJoints[i], p.feet[i], BODY.thigh, SHIN_ABOVE_CUFF, {
      x: (i ? 1 : -1) * 0.15,
      y: 0,
      z: 1,
    }),
  ) as [V3, V3];
  // The trunk turned forward about the hips, rigid, to the lean asked, and
  // leant into the turn with what of his weight the hips do not carry.
  const lean = Math.max(LEAN_LEAST, Math.min(LEAN_MOST, board.lean));
  const turn = (lean - p.pitch) * k;
  const roll = Math.max(-ROLL_MOST, Math.min(ROLL_MOST, board.hang.x * ROLL_PER_M)) * k;
  const cp = Math.cos(turn);
  const sp = Math.sin(turn);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const carry = (q: V3): V3 => {
    const x0 = q.x - p.hips.x;
    const y0 = q.y - p.hips.y;
    const z0 = q.z - p.hips.z;
    // Forward pitch takes up toward forward: (y, z) turned by +turn about
    // x; then the roll takes up toward +x about the way he faces.
    const y1 = y0 * cp - z0 * sp;
    const z1 = z0 * cp + y0 * sp;
    return { x: hips.x + x0 * cr + y1 * sr, y: hips.y + y1 * cr - x0 * sr, z: hips.z + z1 };
  };
  const shoulders = [carry(p.shoulders[0]), carry(p.shoulders[1])] as [V3, V3];
  // The hands on the grips, held in reach of the shoulders.
  const arm = BODY.upperArm + BODY.forearm - 0.02;
  const hands = [0, 1].map((i) => {
    const g = board.grips[i];
    const s = shoulders[i];
    const d = Math.hypot(g.x - s.x, g.y - s.y, g.z - s.z);
    const held = d > arm ? lerp(s, g, arm / d) : g;
    return lerp(carry(p.hands[i]), held, k);
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
    hips,
    hipJoints,
    knees,
    waist: carry(p.waist),
    neck: carry(p.neck),
    head: carry(p.head),
    pitch: p.pitch + turn,
    roll: p.roll + roll,
    headRoll: p.headRoll + roll * HEAD_KEEP,
    shoulders,
    elbows,
    hands,
    // On the rack.
    poles: null,
  };
}
