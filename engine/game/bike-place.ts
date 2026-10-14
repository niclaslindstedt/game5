// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BIKE MADE AND STOOD (`bike-body.ts`): a fresh one with its rider aboard,
// and one stood on its wheels on a world at rest or rolling — its
// suspension at sag, its rider settled in his stance.

import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { BIKE } from "./defs/bike.ts";
import { BB, WHEELBASE } from "./bike-geometry.ts";
import { derive, matrixOf, stanceOf, toWorld, v3 } from "./bike-frame.ts";
import type { BikeWorld } from "./bike-body.ts";
import type { BikeControls, BikeState, BikeWheel } from "./bike-state.ts";

const G = 9.81;
const R = BIKE.rider;
const tmp = v3();

const wheel = (): BikeWheel => ({
  comp: 0,
  compRate: 0,
  load: 0,
  x: 0,
  y: 0,
  z: 0,
  touching: false,
  slip: 0,
  over: 0,
  locked: false,
  spinning: false,
  turn: 0,
  spin: 0,
  peak: 0,
});

/** A BIKE stood nowhere yet, its rider of `riderMass` kg on it. */
export function freshBike(riderMass: number = R.mass): BikeState {
  return {
    mode: "parked",
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    q: { x: 0, y: 0, z: 0, w: 1 },
    wx: 0,
    wy: 0,
    wz: 0,
    steer: 0,
    steerRate: 0,
    feel: 0,
    turn: 0,
    aimLean: 0,
    pastKnee: 0,
    shift: 0,
    rider: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
    front: wheel(),
    rear: wheel(),
    crank: 0,
    cadence: 0,
    reserve: BIKE.pedal.reserve,
    riderMass,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    way: 0,
    g: 1,
    controls: { pedal: 0, front: 0, rear: 0, steer: 0, lean: 0, crouch: 0 },
    airborne: false,
    airTime: 0,
    landing: null,
    pop: 0,
    tuck: 0,
    legs: R.legs.most,
    loaded: 0,
    leanFor: 0,
    slideFor: 0,
    onIt: false,
    t: 0,
    thrown: false,
    hitCooldown: 0,
    lift: null,
    afoot: null,
    trail: null,
    ridden: null,
  };
}

const neutral: BikeControls = { pedal: 0, front: 0, rear: 0, steer: 0, lean: 0, crouch: 0 };

/** THE BIKE STOOD on its wheels at (x, z) facing `heading`, upright, its
 * suspension at sag and its rider in his stance, rolling at `speed` m/s
 * along the ground — pitched to the slope between its wheels. */
export function placeBike(
  b: BikeState,
  world: BikeWorld,
  x: number,
  z: number,
  heading: number,
  speed = 0,
): BikeState {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const gr = world.groundAt(x + fx * BIKE.rearAxle.z, z + fz * BIKE.rearAxle.z);
  const gf = world.groundAt(x + fx * BIKE.frontAxle.z, z + fz * BIKE.frontAxle.z);
  const pitch = Math.atan2(gf - gr, WHEELBASE);
  b.q = fromEuler(heading, pitch, 0);
  matrixOf(b.q);
  // The rear axle at sag over its patch, the frame hung from it.
  const rs = toWorld({ x: 0, y: BB.y + BIKE.rearAxle.y, z: BB.z + BIKE.rearAxle.z }, v3());
  const rxp = x + fx * BIKE.rearAxle.z;
  const rzp = z + fz * BIKE.rearAxle.z;
  world.normalAt(rxp, rzp, tmp);
  b.x = rxp + tmp.x * BIKE.rear.radius - rs.x;
  b.y = gr + tmp.y * BIKE.rear.radius - rs.y;
  b.z = rzp + tmp.z * BIKE.rear.radius - rs.z;
  const dir = toWorld({ x: 0, y: 0, z: 1 }, v3());
  b.vx = dir.x * speed;
  b.vy = dir.y * speed;
  b.vz = dir.z * speed;
  b.wx = 0;
  b.wy = 0;
  b.wz = 0;
  b.steer = 0;
  b.steerRate = 0;
  b.feel = 0;
  b.turn = 0;
  b.pastKnee = 0;
  b.aimLean = 0;
  b.shift = 0;
  const stance = toWorld(stanceOf(b, neutral, v3()), v3());
  // Settled: his legs carry his weight where he stands.
  const settle = toWorld({ x: 0, y: -(b.riderMass * G) / R.rate.up, z: 0 }, v3());
  b.rider.x = b.x + stance.x + settle.x;
  b.rider.y = b.y + stance.y + settle.y;
  b.rider.z = b.z + stance.z + settle.z;
  b.rider.vx = b.vx;
  b.rider.vy = b.vy;
  b.rider.vz = b.vz;
  for (const w of [b.front, b.rear]) {
    w.slip = 0;
    w.locked = false;
    w.spinning = false;
    w.touching = true;
    w.spin = speed / (w === b.front ? BIKE.front.radius : BIKE.rear.radius);
  }
  b.front.comp = BIKE.frontEnd.sag * BIKE.frontEnd.travel;
  b.rear.comp = BIKE.rearEnd.sag * BIKE.rearEnd.travel;
  b.airborne = false;
  b.airTime = 0;
  b.landing = null;
  b.pop = 0;
  b.tuck = 0;
  b.loaded = 0;
  b.legs = R.legs.most;
  b.leanFor = 0;
  b.slideFor = 0;
  b.g = 1;
  derive(b);
  return b;
}
