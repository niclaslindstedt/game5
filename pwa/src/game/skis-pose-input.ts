// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ENGINE'S READINGS AS THE SKIER'S POSE WANTS THEM — what the drawn
// skier on his skis (`skis-body.ts`) hands `skier-pose.ts` every frame: the
// stand on the snow, the legs' spring as the view carries it, the gait, the
// plant, the save, the idle while he waits. Its own module so the model
// that hangs the figure stays inside the file cap.

import { TUNING, type SkierState, type TrickPose } from "@engine";

import { gearLift, skiTilt } from "./ski-gear.ts";
import { standOf, type Stand } from "./ski-stand.ts";
import { launchGait } from "./skier-gait.ts";
import { slalomStart } from "./slalom-start.ts";
import {
  drawnSkiAngle,
  gaitOf,
  leadOf,
  pitchHeld,
  type createSkierSpring,
  type Mounts,
  type SkierPoseInput,
} from "./skier-pose.ts";
import { flightShape } from "./skier-flight.ts";
import { lookBack } from "./skier-seat.ts";
import { type Riding } from "./technique-pose.ts";
import { revertRise } from "./skier-switch.ts";

/** Coming down off a hop into switch (`SkierState.hopHeld`): still in its
 * little flight or just down off it, round already — the look back held
 * through the landing, never let go for the frames the drawn air takes to
 * ease off the snow. */
export function hopLanding(skier: SkierState): boolean {
  return (skier.hopHeld ?? 0) > 0;
}

/** How far he stands on the snow as drawn, 0..1: the view's eased air, or
 * the engine's flag before the spring has read a ride. */
export function groundOf(skier: SkierState, legs: ReturnType<typeof createSkierSpring>): number {
  if (skier.thrown) return 0;
  return Number.isNaN(legs.hip) ? (skier.airborne ? 0 : 1) : 1 - legs.air;
}

/** The engine's readings as the pose wants them, for one frame —
 * `waiting` in the start gate under the lights (`"house"` in a slalom's
 * start house, and out of it on his one push); `stand` where the skis
 * stand on the snow (`ski-stand.ts`, worked out off `legs` when left
 * out); `riding` how he rides (`technique-pose.ts`'s `ridingOf`: the free
 * skier, at no gate, when left out). */
export function poseInputOf(
  skier: SkierState,
  legs: ReturnType<typeof createSkierSpring>,
  mounts: Mounts,
  trick: TrickPose | null,
  waiting: boolean | "house" = false,
  stand: Stand = standOf(
    skier,
    groundOf(skier, legs),
    undefined,
    skier.incline + (Number.isNaN(legs.hip) ? 0 : legs.hill),
    drawnSkiAngle(legs, skier),
  ),
  riding?: Riding,
): SkierPoseInput {
  // A slalom's start house: the slalom start clip, in it and out of it.
  const clip = slalomStart(waiting === "house", skier.launch);
  // The inclination the skis are tipped against beyond the world's roll —
  // carried onto the body's own eased roll.
  // On his platforms the body is drawn stood over the hill (`hillLean`):
  // a roll of its own on top of the engine's.
  const hill = Number.isNaN(legs.hip) ? 0 : legs.hill;
  const roll = skier.roll + hill;
  const onSnow = stand.incline - groundOf(skier, legs) * roll;
  return {
    roll,
    // The hips' shift as his body carries it (eased in the view's spring),
    // or the engine's own before the spring has read a ride.
    hipRight: Number.isNaN(legs.hip) ? skier.hipRight : legs.hip,
    hipAft: skier.hipAft,
    lean: skier.lean,
    steer: skier.steer,
    edge: stand.tilt,
    // The edge and the roll as his body above the boots carries them.
    body: Number.isNaN(legs.hip)
      ? undefined
      : {
          tilt: skiTilt({ edge: legs.edge, roll: legs.roll + hill + onSnow, speed: skier.speed }),
          roll: legs.roll + hill,
        },
    // The upper body's lead into a turn, ahead of the skis' edge.
    lead: leadOf(legs),
    // The skid's pivot as his body carries it (eased in the view's spring).
    skiAngle: drawnSkiAngle(legs, skier),
    crouch: skier.crouch,
    tuck: skier.tuck,
    drop: skier.spec.crouchDrop * skier.crouch,
    lift: stand.lift,
    spread: stand.out,
    fore: stand.fore,
    incline: stand.incline,
    sidestep: Number.isNaN(legs.hip) ? skier.sidestep : legs.platform,
    // RIDING SWITCH: looking back over the shoulder his body has turned to
    // — or, waiting for a chair or a T-bar, over his inside one for it.
    switched: legs.back * legs.backSide + lookBack(skier.lift),
    windUp: legs.wind,
    turningRound: skier.revert != null || hopLanding(skier),
    airborne: skier.airborne,
    landing: skier.landing,
    // ...lengthened a little through a revert, the skis light (`skier-switch.ts`).
    bump: legs.bump - (skier.revert ? revertRise(skier.revert.u) : 0),
    // THE POLE PLANT the view times on his turns (`skier-spring.ts`).
    plantAt:
      legs.plantT < legs.plantLength
        ? { side: legs.plantSide, t: legs.plantT / legs.plantLength, weight: legs.plantOk }
        : undefined,
    // THE GAIT at a crawl — the skate and the double pole — in time with
    // the engine's own push (`poles.ts`).
    // ...how much he works the poles as his arms carry it.
    // Out of a slalom's start house, his one push is the whole gait.
    gait:
      launchGait(skier.launch, TUNING.start.push) ??
      (Number.isNaN(legs.keep) ? gaitOf(skier) : { ...gaitOf(skier), keep: legs.keep }),
    // The snow passed since the stroke's plant, as the view kept it.
    poled: Number.isNaN(legs.poledStride) ? undefined : legs.poled,
    air: legs.air,
    jumpLoad: legs.load,
    popped: skier.popped,
    carve: skier.carve,
    skid: skier.skid,
    // THE SAVE his body is making, as the view's spring carries it.
    jolt: legs.jolt,
    // THE TRUNK HELD while the skis rock under him over a bump.
    pitchHeld: pitchHeld(legs, skier.pitch),
    // THE FALL his body is riding, by how far it is.
    flight: flightShape(legs.flight, legs.air),
    trick,
    // ...with his poles, or with nothing in his hands (the hard mode).
    poles: skier.poles,
    // HOW HE RIDES: his technique's row, the block at the gate he owes, and
    // how far he has been edging lately (what tells an edge change).
    style: riding?.style,
    block: riding?.block,
    swing: Number.isNaN(legs.swing) ? undefined : legs.swing,
    mounts,
    // IN THE START GATE under the lights, as his body has settled into it
    // — or, before the spring has read a ride, as the lights say.
    ready: clip ? clip.weight : Number.isNaN(legs.hip) ? (waiting ? 1 : 0) : legs.ready,
    house: clip?.shape,
    // STOOD STILL, he waits alive: his own clock, faded in below a walk.
    idle: {
      t: legs.clock,
      // ...but not while he steps his skis round on the spot.
      still:
        Math.max(0, 1 - skier.speed / 1.5) * Math.max(0, 1 - skier.drive * 4) * (1 - legs.stepping),
    },
  };
}

/** How far the drawn skis stand folded up toward him off the engine's
 * legs, m, the two skis' mean (`gearLift`) — what the body's spring is
 * handed so the legs never fold or stretch past their reach. */
export function legsLift(skier: SkierState): number {
  const lift = gearLift(skier);
  return (lift[0] + lift[1]) / 2;
}
