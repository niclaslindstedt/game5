// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER ON HIS BIKE AS DRAWN, HELD THROUGH A JOLT. The engine's rider is
// a body of his own on his legs and arms over the frame (`bike-body.ts`), and
// where the frame is jolted — the fork and shock topping out as the bike
// leaves a lip, a stop met — his place on it changes speed in a step: in his
// own frame (the root his figure hangs in) the grips and pedals jump, and the
// hands and feet on them with it. Arms and legs are springs; they take such a
// jolt over a few hundredths of a second, not in a frame.
//
// So the drawing reads his place on the frame through a follower that takes
// the engine's every move up to `most` m/s² as it comes and soaks up any
// harder one into an offset that dies away on a critically damped spring
// (an INERTIALIZED blend: the drawn velocity never jumps). The drawn bike is
// moved by the same offset (`riderSlack`), so his hands and feet stay on it;
// the lens and the physics never see it. A few centimetres for a tenth of a
// second, and nothing at all while he rides smoothly.
//
// Kept a follower a `BikeState`, stepped by the run's clock (the same `t`
// twice returns the same pose), afresh on a clock that goes back or leaps
// or a place that jumps (a remount). Three-free and DOM-free.

import { bikePose, type BikePose, type BikeState } from "@engine";

type V3 = { x: number; y: number; z: number };

/** `most` the hardest move of his place on the frame passed through as it
 * comes, m/s²; `omega` the spring the rest dies away on, rad/s (it settles
 * in about 4.7 / omega s); `far` the most the drawn place strays, m; `leap`
 * a clock step, s, and `jump` a move of his place in a step, m, past which
 * the follower starts afresh. */
export const FOLLOW = { most: 60, omega: 18, far: 0.08, leap: 0.25, jump: 0.3 };

type Follower = {
  t: number;
  r: V3;
  rv: V3;
  e: V3;
  ev: V3;
  pose: BikePose | null;
};

const followers = new WeakMap<BikeState, Follower>();
const AXES = ["x", "y", "z"] as const;

/** THE BIKE'S POSE AS THE RIDER IS DRAWN ON IT at run time `t`: the
 * engine's, with his place on the frame (`rider`) held through a jolt. */
export function drawnBikePose(b: BikeState, t: number): BikePose {
  const pose = bikePose(b);
  let f = followers.get(b);
  if (!f) {
    f = { t: -1, r: { ...pose.rider }, rv: zero(), e: zero(), ev: zero(), pose: null };
    followers.set(b, f);
  }
  if (f.pose && t === f.t) return f.pose;
  const r = pose.rider;
  const dt = t - f.t;
  const moved = Math.hypot(r.x - f.r.x, r.y - f.r.y, r.z - f.r.z);
  if (f.t < 0 || dt <= 0 || dt > FOLLOW.leap || moved > FOLLOW.jump || !b.onIt) {
    f.r = { ...r };
    f.rv = zero();
    f.e = zero();
    f.ev = zero();
  } else {
    const w = FOLLOW.omega;
    for (const k of AXES) {
      const rv = (r[k] - f.r[k]) / dt;
      // The engine's move this step past what a limb takes as it comes is
      // soaked into the offset's speed (the drawn speed carries on).
      const acc = (rv - f.rv[k]) / dt;
      const over = acc - Math.max(-FOLLOW.most, Math.min(FOLLOW.most, acc));
      let ev = f.ev[k] - over * dt;
      let e = f.e[k];
      const n = Math.max(1, Math.ceil(dt * 240));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        ev += (-w * w * e - 2 * w * ev) * h;
        e += ev * h;
      }
      if (Math.abs(e) > FOLLOW.far) {
        e = Math.sign(e) * FOLLOW.far;
        ev = 0;
      }
      f.e[k] = e;
      f.ev[k] = ev;
      f.rv[k] = rv;
    }
    f.r = { ...r };
  }
  f.t = t;
  f.pose = {
    ...pose,
    rider: { x: r.x + f.e.x, y: r.y + f.e.y, z: r.z + f.e.z },
  };
  return f.pose;
}

/** HOW FAR THE DRAWN BIKE IS MOVED from the engine's, body frame, m: where
 * the engine has him on it less where he is drawn (`drawnBikePose`'s), so
 * his hands and feet stay on its grips and pedals. */
export function riderSlack(engine: Pick<BikePose, "rider">, drawn: Pick<BikePose, "rider">): V3 {
  return {
    x: engine.rider.x - drawn.rider.x,
    y: engine.rider.y - drawn.rider.y,
    z: engine.rider.z - drawn.rider.z,
  };
}

function zero(): V3 {
  return { x: 0, y: 0, z: 0 };
}
