// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOARD KEPT ON A THROWN RIDER'S FEET — and on any pose whose feet are
// set by something other than the board (the ragdoll, the skydive, the
// crowd's falls): the deck laid back under them. Three-free.

import type { SkierPose } from "./skier-pose.ts";
import { add, dot, len, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";
import {
  bindingsOf,
  cuffOver,
  frontIndex,
  type BoardFrame,
  type BoardPoseInput,
} from "./board-pose.ts";

const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/**
 * THE BOARD UNDER A THROWN RIDER'S FEET (`board-crash.ts` keeps it on):
 * the deck laid along the line from his back foot to his front one, its
 * top square to his shins, the soles in its bindings — and his boots turned
 * to the bindings' angles, so the figure's feet stand in them. Made over
 * in place: `pose.boots` and `pose.feet` are the bindings'.
 */
export function boardUnderFeet(pose: SkierPose, board: BoardPoseInput["board"]): BoardFrame {
  const fi = frontIndex(board.lead);
  const ri = 1 - fi;
  const along0 = sub(pose.feet[fi], pose.feet[ri]);
  const along = len(along0) > 1e-4 ? norm(along0) : { x: 0, y: 0, z: 1 };
  // The shins' mean up, squared to the board's length.
  const shin = (i: number) => norm(sub(pose.knees[i], pose.feet[i]));
  let up = add(shin(0), shin(1));
  up = sub(up, scale(along, dot(up, along)));
  const normal = len(up) > 1e-4 ? norm(up) : norm(cross(along, { x: 1, y: 0, z: 0 }));
  const right = norm(cross(normal, along));
  const frame: BoardFrame = { centre: { x: 0, y: 0, z: 0 }, along, normal, right, bend: 0 };
  const { sole, boot } = bindingsOf(frame, { board });
  // The deck's middle under the feet' middle, the soles' height under the
  // cuffs.
  const mid = mix(pose.feet[0], pose.feet[1], 0.5);
  const soleMid = mix(sole[0], sole[1], 0.5);
  const cuffMid = mix(cuffOver(sole[0], boot[0]), cuffOver(sole[1], boot[1]), 0.5);
  frame.centre = add(sub(mid, cuffMid), soleMid);
  const placed = bindingsOf(frame, { board });
  for (let i = 0; i < 2; i++) {
    pose.boots[i] = placed.boot[i];
    pose.feet[i] = cuffOver(placed.sole[i], placed.boot[i]);
  }
  return frame;
}
