// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HAND ON THE DOOR, decided — where the skier's hand goes while he
// opens a door (`doorway.ts`'s move): up to the lever as he comes to a
// stop before it, the lever pressed down, then riding the leaf's latch edge
// as it swings — pushed through its first stretch and let go, or drawn
// toward him as he steps back and let go once it is past him; a roller
// door's bottom rail lifted to his shoulder. Off the engine's own move and
// the leaf's share, so the hand stays on the handle as the leaf is drawn.
// Three-free: `skis-body.ts` lays it on the pose (`reachPose`).

import {
  BUILDING_WALLS,
  DOOR,
  buildingDoors,
  doorFrame,
  doorPoint,
  leafShare,
  leavesOf,
  type GameState,
} from "@engine";

import type { SkierPose } from "./skier-joints.ts";
import { solveLimb } from "./skier-limbs.ts";
import { BODY } from "./skier-mounts.ts";
import { add, len, scale, sub, type V3 } from "./skier-vec.ts";

/** A hand's reach: the world point it goes to and how far it has gone
 * there, 0 at his side .. 1 on the handle. */
export type DoorReach = { x: number; y: number; z: number; weight: number };

const smooth = (u: number): number => {
  const k = Math.min(1, Math.max(0, u));
  return k * k * (3 - 2 * k);
};

/** How far the lever is pressed down, m. */
const LEVER_DROP = 0.045;
/** How far off the leaf's face the hand holds its handle, m. */
const GRIP_OFF = 0.08;
/** How long a hand takes back off the leaf, s. */
const LET_GO = 0.35;

/** Where `run`'s skier has his hand on a door now, or null. */
export function doorReach(run: GameState): DoorReach | null {
  const move = run.doorway?.move;
  if (!move) return null;
  const door = buildingDoors(run.level).find((d) => d.id === move.id);
  if (!door) return null;
  const T = DOOR.time;
  const t = run.t - move.start;
  const a = move.keys[1]?.t ?? 0;
  const L = leavesOf(door)[move.leaf];
  const f = doorFrame(door);
  const share = leafShare(run, door.id, move.leaf);
  const half = BUILDING_WALLS.wall / 2;
  // The handle's height as his hand meets it: the lever over the floor —
  // but a porch or a terrace drawn up to a door is no floor the engine
  // stands him on, so from the snow below one his hand goes no higher than
  // a step up would bring the lever to.
  const feet = run.skier.y - run.skier.spec.cogHeight;
  const floor = feet + Math.min(0.3, Math.max(0, door.y - feet));
  // In: from his stop to the handle over the reach.
  let weight = smooth((t - a) / T.reach);
  // Pressed: the lever going down over the press, held down until the
  // leaf moves and let up as it does.
  const press = smooth((t - a - T.reach) / T.press) * (1 - smooth((t - move.open) / 0.25));
  if (L.way === 0) {
    // A ROLLER DOOR: its bottom rail, lifted to the shoulder and let go.
    const lift = share * DOOR.leaf.roll * door.height;
    const y = Math.min(1.55, 0.35 + lift);
    if (lift + 0.35 > 1.55) weight *= 1 - smooth((t - move.open - 0.9) / LET_GO);
    const p = doorPoint(f, 0.15, move.side * (half + GRIP_OFF + 0.04));
    return weight > 0.001 ? { x: p.x, z: p.z, y: floor + y, weight } : null;
  }
  // THE HINGED LEAF at its angle: the handle on his side of it.
  const toLatch = Math.sign(L.latch - L.hinge) || 1;
  const th = share * DOOR.leaf.open;
  const du = toLatch * Math.cos(th);
  const dw = L.way * Math.sin(th);
  const r = L.width - DOOR.lever.inset;
  // The leaf's face toward him: square to it, on his side when shut.
  const nu = -toLatch * move.side * dw;
  const nw = toLatch * move.side * du;
  const u = L.hinge + du * r + nu * GRIP_OFF;
  const w = half + dw * r + nw * GRIP_OFF;
  // Let go: a pushed leaf past the hand's share of its swing; a drawn one
  // once it has come round past him.
  if (move.pull) weight *= 1 - smooth((t - move.open - 0.65) / LET_GO);
  else weight *= 1 - smooth((share - DOOR.leaf.hand) / 0.15);
  if (weight <= 0.001) return null;
  const p = doorPoint(f, u, w);
  return { x: p.x, z: p.z, y: floor + DOOR.lever.y - LEVER_DROP * press, weight };
}

/** THE POSE WITH A HAND ON THE DOOR: the hand nearer `at` (a point in his
 * body's frame — x right, y up, z forward) carried `weight` of the way to
 * it, its elbow solved down and out between, and its pole carried with the
 * hand; a little lean toward it. */
export function reachPose(p: SkierPose, at: V3, weight: number): SkierPose {
  const i = at.x >= 0 ? 1 : 0;
  const k = Math.min(1, Math.max(0, weight));
  const hand0 = p.hands[i];
  // No further than the arm reaches from its shoulder.
  const most = BODY.upperArm + BODY.forearm - 0.02;
  const from = sub(at, p.shoulders[i]);
  const far = len(from);
  const goal = far > most ? add(p.shoulders[i], scale(from, most / far)) : at;
  const hand = add(hand0, scale(sub(goal, hand0), k));
  const out = i === 1 ? 1 : -1;
  const elbow = solveLimb(p.shoulders[i], hand, BODY.upperArm, BODY.forearm, {
    x: out,
    y: -1,
    z: -0.3,
  });
  const moved = sub(hand, hand0);
  const hands: [V3, V3] = [...p.hands];
  const elbows: [V3, V3] = [...p.elbows];
  hands[i] = hand;
  elbows[i] = elbow;
  let poles = p.poles;
  if (poles) {
    poles = [...poles];
    poles[i] = add(poles[i], moved);
  }
  return { ...p, hands, elbows, poles, pitch: p.pitch + 0.1 * k * Math.min(1, far / most) };
}
