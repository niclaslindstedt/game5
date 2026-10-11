// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ENGINE'S READINGS AS THE SNOWBOARDER'S POSE WANTS THEM, for one frame
// (`boardPose`): the board's own numbers off its spec, each foot's lift
// held on the one rigid deck, the inclination as drawn, his travel and the
// world's up in his body frame. Three-free, so the model (`board-model.ts`),
// the metrics lab (`make board-metrics`) and the suite build it alike.

import { unrotate, type SkiSpec, type SkierState } from "@engine";

import type { BoardPoseInput } from "./board-pose.ts";
import { gearLift } from "./ski-gear.ts";
import { inclineAt } from "./ski-stand.ts";
import { drawnSkiAngle, type SkierSpring } from "./skier-pose.ts";

/** The board's numbers as the pose and the look want them. */
export function boardOf(spec: SkiSpec): BoardPoseInput["board"] {
  const b = spec.board!;
  return {
    length: spec.length,
    waist: spec.waist,
    tipWidth: spec.tipWidth,
    tailWidth: spec.tailWidth,
    sidecut: spec.sidecut,
    stance: b.stance,
    front: b.front,
    back: b.back,
    lead: b.lead,
  };
}

/** EACH FOOT'S LIFT toward the body, m, the front foot first, held on the
 * snow: one rigid deck is under both, so a foot unloaded (the rear one out
 * of its binding, or light) never pulls the deck down under the snow — the
 * loaded foot carries it. */
export function boardLift(skier: SkierState): [number, number] {
  const raw = gearLift(skier);
  const free = skier.board?.free === true;
  const top = free ? raw[0] : Math.max(raw[0], raw[1]);
  // THE SINK DRAWN BY THE SNOW, NOT THE DECK: the engine's stations stand
  // a centimetre or two into even the groomer, which hides a deck lying
  // flat (a ski's narrow top hides little) — so the deck is drawn on the
  // surface and the groove the trail map stamps under it carries the sink.
  const sink = sinkOf(skier);
  return [
    Math.max(raw[0], top - 0.03, -0.01) + sink,
    Math.max(free ? raw[0] : raw[1], top - 0.03, -0.01) + sink,
  ];
}

/** The engine's stations' mean sink into the snow while they touch it, m. */
function sinkOf(skier: SkierState): number {
  let sum = 0;
  let n = 0;
  for (const c of skier.contacts) {
    if (!c.touching) continue;
    sum += c.sink;
    n++;
  }
  return n ? Math.min(0.08, sum / n) : 0;
}

/** How far his body is drawn on the snow, 0..1, off the view's spring. */
export function onSnowOf(skier: SkierState, legs: SkierSpring): number {
  if (skier.thrown) return 0;
  return Number.isNaN(legs.hip) ? (skier.airborne ? 0 : 1) : 1 - legs.air;
}

/** The pose's input for `skier` drawn at the orientation `q`, his legs'
 * spring `legs` stepped for this frame; and the inclination it is drawn
 * at, and the feet's lift (what the root is pivoted about). */
export function boardInputOf(
  skier: SkierState,
  legs: SkierSpring,
  q: { x: number; y: number; z: number; w: number },
): { input: BoardPoseInput; incline: number; lift: [number, number] } {
  const spec = skier.spec;
  const onSnow = onSnowOf(skier, legs);
  const incline = inclineAt(skier, q) * onSnow;
  const lift = boardLift(skier);
  const worldUp = unrotate(q, { x: 0, y: 1, z: 0 });
  const travel = unrotate(q, { x: skier.vx, y: skier.vy, z: skier.vz });
  const feet = skier.board;
  const still = Math.max(0, 1 - skier.speed / 1.5) * Math.max(0, 1 - skier.drive * 4);
  return {
    incline,
    lift,
    input: {
      board: boardOf(spec),
      ground: -spec.cogHeight,
      crouchDrop: spec.crouchDrop,
      edge: skier.edge,
      incline,
      angle: drawnSkiAngle(legs, skier),
      worldUp,
      lift,
      crouch: skier.crouch,
      lean: skier.lean,
      air: 1 - onSnow,
      bump: legs.bump,
      load: legs.load,
      carve: skier.carve,
      skid: skier.skid,
      travel,
      speed: skier.speed,
      switched: skier.switched === true,
      free: feet?.free ?? false,
      hop: feet?.hop ?? 0,
      drive: skier.drive,
      stride: skier.stride,
      idle: { t: legs.clock, still },
    },
  };
}
