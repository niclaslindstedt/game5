// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER THROWN, as a pose: the engine's ragdoll read into the same
// joints `skierPose` places on the skis, so `skier-figure.ts` hangs the
// figure on either the same way. Three-free, so the suite reads it.

import { RAGDOLL as R } from "@engine";

import { BODY, LUMBAR, SHIN_ABOVE_CUFF, type SkierPose } from "./skier-pose.ts";
import { CUFF, keepLengths, type Boot } from "./skier-limbs.ts";
import { add, dot, len, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** A body's own frame in the world: the origin between the hips, `x`
 * across to his right, `y` up the spine, `z` out of his chest. */
export type BodyFrame = { origin: V3; x: V3; y: V3; z: V3 };

/**
 * THE SKIER THROWN — the engine's RAGDOLL (`Thrown.points`, in `RAGDOLL`'s
 * order, world frame) read as a pose: the frame of his trunk found off the
 * hips and the shoulders into `frame`, and every joint put in it, so the
 * figure is turned by the frame and hung on the joints exactly as it is on
 * the skis. Nothing is decided here — where every limb is, is the physics';
 * the lengths are the engine's, which are `BODY`'s. The poles are gone: a
 * thrown skier has let go of them.
 */
export function ragdollPose(points: readonly number[], frame: BodyFrame): SkierPose {
  const at = (i: number): V3 => ({ x: points[3 * i], y: points[3 * i + 1], z: points[3 * i + 2] });
  const hipL = at(R.hipL);
  const hipR = at(R.hipR);
  const shL = at(R.shoulderL);
  const shR = at(R.shoulderR);
  const origin = scale(add(hipL, hipR), 0.5);
  const neckW = scale(add(shL, shR), 0.5);
  const y = norm(sub(neckW, origin));
  const side = sub(shR, shL);
  const x = norm(sub(side, scale(y, dot(side, y))));
  const z = { x: x.y * y.z - x.z * y.y, y: x.z * y.x - x.x * y.z, z: x.x * y.y - x.y * y.x };
  frame.origin = origin;
  frame.x = x;
  frame.y = y;
  frame.z = z;
  const local = (p: V3): V3 => {
    const d = sub(p, origin);
    return { x: dot(d, x), y: dot(d, y), z: dot(d, z) };
  };
  // THE FEET, thrown: the ragdoll's foot is the ankle, a whole shin from
  // the knee; the figure's cloth stops at the boot's cuff up that shin, and
  // the foot below it is squared to the shin with the cuff's own forward
  // lean, the toes the way his chest faces.
  const hips: [V3, V3] = [local(hipL), local(hipR)];
  const shoulders: [V3, V3] = [local(shL), local(shR)];
  const legs = [0, 1].map((i) =>
    keepLengths(
      hips[i],
      local(at(i ? R.kneeR : R.kneeL)),
      local(at(i ? R.footR : R.footL)),
      BODY.thigh,
      BODY.shin,
    ),
  );
  const arms = [0, 1].map((i) =>
    keepLengths(
      shoulders[i],
      local(at(i ? R.elbowR : R.elbowL)),
      local(at(i ? R.handR : R.handL)),
      BODY.upperArm,
      BODY.forearm,
    ),
  );
  const knees: [V3, V3] = [legs[0].mid, legs[1].mid];
  const ankles = [legs[0].end, legs[1].end];
  const feet = [0, 1].map((i) => mix(knees[i], ankles[i], SHIN_ABOVE_CUFF / BODY.shin)) as [V3, V3];
  const boots = [0, 1].map((i) => {
    const up = norm(sub(knees[i], ankles[i]));
    let ahead = sub({ x: 0, y: 0, z: 1 }, scale(up, up.z));
    if (len(ahead) < 1e-4) ahead = sub({ x: 0, y: 1, z: 0 }, scale(up, up.y));
    ahead = norm(ahead);
    const k = CUFF.least;
    return {
      n: norm(sub(scale(up, Math.cos(k)), scale(ahead, Math.sin(k)))),
      f: norm(add(scale(ahead, Math.cos(k)), scale(up, Math.sin(k)))),
    };
  }) as [Boot, Boot];
  return {
    hips: { x: 0, y: 0, z: 0 },
    hipJoints: hips,
    waist: scale(local(neckW), LUMBAR),
    neck: local(neckW),
    head: local(at(R.head)),
    pitch: 0,
    roll: 0,
    headRoll: 0,
    knees,
    feet,
    boots,
    shoulders,
    elbows: [arms[0].mid, arms[1].mid],
    hands: [arms[0].end, arms[1].end],
    poles: null,
    look: 0,
  };
}
