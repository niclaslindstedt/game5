// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE DOG WALKERS AND THEIR DOGS ARE AT A MOMENT — read off a walk's
// timeline (`dog-walk.ts`): the owner (and the child alongside) as a
// civilian's pose (`CivilianPose`, drawn by `civilians-view.ts` with the
// lead in his right hand), and each dog as a `DogPose` — where it stands,
// the way it faces, what it is doing (walking or trotting at its stride,
// stood, sat at a kerb, sniffing, a leg lifted, squatting) and how far into
// it — drawn by `dogs-view.ts` off `dog-pose.ts`. Pure functions of the
// plan and the clock; three-free and DOM-free.

import type { CivilianPose } from "./civilian-plan.ts";
import { DOG_GAIT, DOG_SPECS } from "./dog-defs.ts";
import { footY } from "./dog-walk-net.ts";
import { pointAt, type LinePoint } from "./dog-walk-route.ts";
import {
  dogArc,
  householdOut,
  kerbHold,
  walkAt,
  walkerArc,
  type DogPlan,
  type Walk,
} from "./dog-walk.ts";

/** What a dog is doing: walking or trotting along (`walk`, its gait read
 * off `trot`), stood, sat, its nose down sniffing, a hind leg lifted to
 * mark (`lift` the side), squatting to pee, or hunched in the squat to
 * poop. */
export type DogAct = "walk" | "stand" | "sit" | "sniff" | "mark" | "pee" | "poop";

/** A dog at a moment: whether it is out, its middle on the snow (its
 * feet's height), the way it faces, what it does and how far into it
 * (`clock` of `span` s), how far it has gone in strides (`stride`), how
 * much of its gait is a trot (0 a walk … 1 a trot), its speed, m/s, and
 * the side a leg is lifted to. */
export type DogPose = {
  shown: boolean;
  x: number;
  y: number;
  z: number;
  heading: number;
  act: DogAct;
  clock: number;
  span: number;
  stride: number;
  trot: number;
  speed: number;
  lift: number;
};

export function freshDogPose(): DogPose {
  return {
    shown: false,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    act: "stand",
    clock: 0,
    span: 1,
    stride: 0,
    trot: 0,
    speed: 0,
    lift: 0,
  };
}

const ease = (u: number): number => {
  const c = Math.max(0, Math.min(1, u));
  return c * c * (3 - 2 * c);
};

/** The shortest turn from `a` to `b`, rad. */
const turn = (a: number, b: number): number => {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

const AT: LinePoint = { x: 0, z: 0, heading: 0 };

/** How far to the right of the line a dog walks at `t`: its own side,
 * eased out to a stop's place as it comes to it and back after. */
function dogSide(w: Walk, d: number, side: number, t: number): number {
  for (const st of w.stops) {
    if (st.dog !== d || t < st.te - 1.4 || t > st.tr + 1.6) continue;
    const k =
      t < st.te ? ease((t - (st.te - 1.4)) / 1.4) : t > st.tr ? 1 - ease((t - st.tr) / 1.6) : 1;
    return side + (st.lat - side) * k;
  }
  return side;
}

/**
 * THE OWNER (`member` 0) OR THE CHILD (1) of household `h` at `t`, into a
 * civilian's pose: walking the line at his pace, stood at a stop, at a
 * kerb or for a chat, or bent to bag a pile; the lead in his hand.
 */
export function dogWalkerAt(
  plan: DogPlan,
  h: number,
  member: 0 | 1,
  t: number,
  hour: number,
  out: CivilianPose,
): CivilianPose {
  const w = walkAt(plan, h, t);
  out.shown = w !== null && householdOut(plan, h, hour);
  out.seat = null;
  out.bag = false;
  if (!w) return out;
  const hh = plan.households[h];
  const arc = walkerArc(w.legs, t);
  const leg = w.legs.find((g) => t >= g.t0 && t < g.t1) ?? w.legs[w.legs.length - 1];
  // The child walks a step ahead on the side away from the dog.
  const side = member === 0 ? 0 : -Math.sign(hh.dogs[0].side || 1) * 0.62;
  pointAt(w.line, arc + (member === 1 ? 0.15 : 0), side, AT);
  out.x = AT.x;
  out.z = AT.z;
  out.y = footY(plan.level, AT.x, AT.z);
  out.heading = AT.heading;
  out.walked = arc;
  out.carry = member === 0 ? "lead" : "none";
  out.bag = member === 0 && t >= w.bag;
  if (leg.act === "walk") {
    out.activity = "walk";
    out.clock = t - w.t0;
    out.span = w.t1 - w.t0;
    return out;
  }
  out.activity = member === 0 && leg.act === "stoop" ? "stoop" : "stand";
  out.clock = t - leg.t0;
  out.span = leg.t1 - leg.t0;
  return out;
}

/**
 * DOG `d` OF HOUSEHOLD `h` AT `t`, into `out`: where it is along the line
 * and beside it, the way it faces, and what it does.
 */
export function dogAt(
  plan: DogPlan,
  h: number,
  d: number,
  t: number,
  hour: number,
  out: DogPose,
): DogPose {
  const w = walkAt(plan, h, t);
  out.shown = w !== null && householdOut(plan, h, hour);
  if (!w) return out;
  const hh = plan.households[h];
  const dog = hh.dogs[d];
  const spec = DOG_SPECS[dog.kind];
  const L = w.line.length;
  const now = dogArc(w, dog, d, t);
  const arc = Math.max(0, Math.min(L, now.arc));
  const dt = 0.1;
  const ahead = Math.max(0, Math.min(L, dogArc(w, dog, d, t + dt).arc));
  const behind = Math.max(0, Math.min(L, dogArc(w, dog, d, t - dt).arc));
  const speed = Math.max(0, (ahead - behind) / (2 * dt));
  const lat = dogSide(w, d, dog.side, t);
  pointAt(w.line, arc, lat, AT);
  out.x = AT.x;
  out.z = AT.z;
  out.y = footY(plan.level, AT.x, AT.z);
  // Turned the way it moves (its sidestep to a stop's place in), else the
  // way the line runs.
  const dLat = (dogSide(w, d, dog.side, t + dt) - dogSide(w, d, dog.side, t - dt)) / (2 * dt);
  out.heading = AT.heading + (speed > 0.15 ? Math.atan2(dLat, speed) : 0);
  out.speed = speed;
  out.lift = 0;
  // Its stride off how far along it is; a trot past the gait's change.
  const h0 = spec.height * dog.scale;
  const fr = (speed * speed) / (9.81 * h0);
  out.trot = ease((fr - DOG_GAIT.trotAt * 0.7) / (DOG_GAIT.trotAt * 0.6));
  const stride =
    h0 * (DOG_GAIT.walkStride + (DOG_GAIT.trotStride - DOG_GAIT.walkStride) * out.trot);
  out.stride = arc / stride + d * 0.37;
  // At a stop: turned to it, and doing it.
  const st = w.stops.find((s) => s.dog === d && t >= s.te - 0.3 && t < s.tr + 0.8);
  if (st) {
    const into = ease((t - st.te) / 0.6) * (1 - ease((t - st.tr) / 0.8));
    // Circling before a squat: once round on the spot.
    const circle =
      st.circle > 0
        ? 2 * Math.PI * ease((t - st.te) / st.circle) * (1 - ease((t - st.tr) / 0.8))
        : 0;
    out.heading = AT.heading + turn(0, st.yaw) * into + circle;
    if (now.stop) {
      const squat = st.act === "poop" && t >= st.te + st.circle;
      out.act = st.act === "sniff" || (st.act === "poop" && !squat) ? "sniff" : st.act;
      out.clock = t - (squat ? st.te + st.circle : st.te);
      out.span = st.tr - (squat ? st.te + st.circle : st.te);
      out.lift = st.act === "mark" ? st.lift : 0;
      return out;
    }
  }
  if (speed > 0.12) {
    out.act = "walk";
    out.clock = t - w.t0;
    out.span = w.t1 - w.t0;
    return out;
  }
  // Stood with its owner: sat at a kerb (a trained dog), sat or nosing
  // about while he talks, else stood.
  const kerb = w.kerbs.find((k) => t >= k.t0 && t < k.t1);
  const leg = w.legs.find((g) => t >= g.t0 && t < g.t1);
  if (kerb && kerb.sit && kerbHold(w.kerbs, t) > 0.9) {
    out.act = "sit";
    out.clock = t - kerb.t0;
    out.span = kerb.t1 - kerb.t0;
    return out;
  }
  if (leg && leg.act === "chat") {
    out.act = (dog.id + Math.floor(leg.t0)) % 3 === 0 ? "sniff" : "sit";
    out.clock = t - leg.t0;
    out.span = leg.t1 - leg.t0;
    return out;
  }
  out.act = "stand";
  out.clock = leg ? t - leg.t0 : 0;
  out.span = leg ? leg.t1 - leg.t0 : 1;
  return out;
}
