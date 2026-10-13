// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE AND ITS RIDER POSED TOGETHER, three-free — the one
// place a `BikePose` becomes every node's transform (`bikeNodes`), so the
// code's bike (`bike-view.ts`'s `poseBike`), a modelled one and the Blender
// lab's baked clips are moved by the same arithmetic; and the CLIPS the
// modelled bike and rider carry (`bikeClips`): short programs of engine
// readings — pedalling, the attack stance, a corner, a pump, braking, a
// jump, a manual — each played frame by frame into the bike's nodes and the
// rider's bones (`skierBones` of `riderPose`), so the two are animated
// together off the game's own pose and never off a second one.
//
// Every transform is LOCAL to the node's parent, in the engine's body frame
// (x right, y up, z forward, metres), the frame node's parent being the
// bike's centre of mass. The rider's bones are stated in the same frame as
// the bike's nodes' root: the bike's centre of mass.

import { BIKE_BB, freshBike, placeBike, bikePose, type BikePose, type BikeWorld } from "@engine";

import {
  BIKE_LOOK,
  STEER_AT,
  STEER_AXIS,
  frontAxle,
  REAR_REST,
  shockAt,
  swingAt,
} from "./bike-look.ts";
import { riderPose } from "./skier-bike.ts";
import { skierBones, type BoneFrame, type SkierBone } from "./skier-rig.ts";

type V3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };
/** A node's transform in its parent's frame. */
export type NodeTransform = { p: V3; q: Quat; s: V3 };

/** THE NODES a drawn bike is posed by (`bike-view.ts` documents each). The
 * last three are a model's own and optional: the shock's BODY and its ROD,
 * held unstretched while the coil between them is squeezed (a code bike
 * stretches its whole shock), carried by the shock's node. */
export const BIKE_NODES = {
  frame: "bike_frame",
  bars: "bike_bars",
  fork: "bike_fork",
  wheelF: "bike_wheel_f",
  swingarm: "bike_swingarm",
  wheelR: "bike_wheel_r",
  shock: "bike_shock",
  shockBody: "bike_shock_body",
  shockRod: "bike_shock_rod",
  cranks: "bike_cranks",
  pedalL: "bike_pedal_l",
  pedalR: "bike_pedal_r",
} as const;
export type BikeNodeKey = keyof typeof BIKE_NODES;

const ONE: V3 = { x: 1, y: 1, z: 1 };
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const axisAngle = (a: V3, t: number): Quat => {
  const s = Math.sin(t / 2);
  return { x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(t / 2) };
};
const aboutX = (t: number): Quat => axisAngle({ x: 1, y: 0, z: 0 }, t);
/** The turn taking +z onto the unit vector `d`. */
function fromZ(d: V3): Quat {
  const w = 1 + d.z;
  if (w < 1e-9) return { x: 1, y: 0, z: 0, w: 0 };
  const n = Math.hypot(-d.y, d.x, w);
  return { x: -d.y / n, y: d.x / n, z: 0, w: w / n };
}

/** The shock's length built (extended), m. */
export const SHOCK_REST = shockAt(0).length;
const AXLE_F = frontAxle(0, 0);

/** Where each node stands at rest in its parent's frame (its pivot). */
export const BIKE_REST: Record<BikeNodeKey, V3> = {
  frame: { ...BIKE_BB },
  bars: { ...STEER_AT },
  fork: { x: 0, y: 0, z: 0 },
  wheelF: sub(AXLE_F, STEER_AT),
  swingarm: { ...BIKE_LOOK.pivot },
  wheelR: sub(REAR_REST, BIKE_LOOK.pivot),
  shock: { ...BIKE_LOOK.shockFront },
  shockBody: { x: 0, y: 0, z: 0 },
  shockRod: { x: 0, y: 0, z: SHOCK_REST },
  cranks: { x: 0, y: 0, z: 0 },
  pedalL: { x: -BIKE_LOOK.q, y: 0, z: BIKE_LOOK.crank },
  pedalR: { x: BIKE_LOOK.q, y: 0, z: -BIKE_LOOK.crank },
};

/** EVERY NODE'S TRANSFORM for `pose`, in its parent's frame. */
export function bikeNodes(pose: BikePose): Record<BikeNodeKey, NodeTransform> {
  const s = shockAt(pose.shock);
  const len = Math.hypot(s.rear.y - s.front.y, s.rear.z - s.front.z);
  const stretch = s.length / SHOCK_REST;
  const at = (k: BikeNodeKey, q: Quat, sc: V3 = ONE, p: V3 = BIKE_REST[k]): NodeTransform => ({
    p: { ...p },
    q,
    s: sc,
  });
  const I: Quat = { x: 0, y: 0, z: 0, w: 1 };
  return {
    frame: at("frame", I),
    bars: at("bars", axisAngle(STEER_AXIS, pose.steer)),
    fork: at("fork", I, ONE, {
      x: STEER_AXIS.x * pose.fork,
      y: STEER_AXIS.y * pose.fork,
      z: STEER_AXIS.z * pose.fork,
    }),
    wheelF: at("wheelF", aboutX(pose.frontSpin)),
    swingarm: at("swingarm", aboutX(swingAt(pose.shock))),
    wheelR: at("wheelR", aboutX(pose.rearSpin)),
    shock: at(
      "shock",
      fromZ({ x: 0, y: (s.rear.y - s.front.y) / len, z: (s.rear.z - s.front.z) / len }),
      { x: 1, y: 1, z: stretch },
    ),
    shockBody: at("shockBody", I, { x: 1, y: 1, z: 1 / stretch }),
    shockRod: at("shockRod", I, { x: 1, y: 1, z: 1 / stretch }),
    cranks: at("cranks", aboutX(pose.crank)),
    pedalL: at("pedalL", aboutX(-pose.crank)),
    pedalR: at("pedalR", aboutX(-pose.crank)),
  };
}

/** The ground a clip's bike is stood on: flat, firm, still air. */
const FLAT: BikeWorld = {
  groundAt: () => 0,
  normalAt: (_x, _z, out) => {
    out.x = 0;
    out.y = 1;
    out.z = 0;
  },
  surfaceAt: () => ({ grip: 1, slide: 1, roll: 0.02 }),
  wind: { x: 0, z: 0 },
  rho: 1.1,
};

/** THE RIDDEN BIKE AT REST on flat ground: the suspension at sag, the
 * rider settled in his stance — the pose every clip starts from. */
export function ridingPose(): BikePose {
  const b = placeBike(freshBike(), FLAT, 0, 0, 0, 0);
  b.mode = "ridden";
  b.onIt = true;
  const p = bikePose(b);
  return { ...p, x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
}

/** What a clip's program says at a moment, over the riding pose. */
type Reading = {
  /** Speed, m/s — what turns the wheels. */
  speed?: number;
  steer?: number;
  /** Travel used, m at the wheel. */
  fork?: number;
  shock?: number;
  /** The cranks' angle, rad (absolute — a pedalling program turns it). */
  crank?: number;
  shift?: number;
  crouch?: number;
  /** The bike's own pitch (nose up) and roll (right side down), rad — the
   * whole pair's root, which the rider's trunk partly does not follow. */
  pitch?: number;
  roll?: number;
  /** The rider moved on the frame, m (up, forward). */
  up?: number;
  ahead?: number;
  front?: number;
  rear?: number;
  airborne?: boolean;
};

const ease = (u: number): number => {
  const k = Math.max(0, Math.min(1, u));
  return k * k * (3 - 2 * k);
};
/** In over `a..b` s, out over `c..d` s. */
const held = (t: number, a: number, b: number, c: number, d: number): number =>
  ease((t - a) / (b - a)) * (1 - ease((t - c) / (d - c)));

const SAG = 0.06;
/** THE PROGRAMS: seconds, and the readings at `t`. */
const PROGRAMS: { name: string; seconds: number; at: (t: number) => Reading }[] = [
  {
    // Out of the gate: standing pedal strokes at ~80 rpm, the bike rocked
    // under him a little each stroke.
    name: "pedal",
    seconds: 1.5,
    at: (t) => ({
      speed: 4,
      crank: 2 * Math.PI * (80 / 60) * t,
      roll: 0.05 * Math.sin(2 * Math.PI * (80 / 60) * t),
      steer: 0.02 * Math.sin(2 * Math.PI * (80 / 60) * t),
      up: 0.03 * Math.sin(4 * Math.PI * (80 / 60) * t),
      shock: SAG + 0.01 * Math.sin(4 * Math.PI * (80 / 60) * t),
    }),
  },
  {
    // The attack stance at speed: cranks level, the bike chattering under
    // him over the roots while his body floats.
    name: "attack",
    seconds: 2,
    at: (t) => ({
      speed: 10,
      fork: SAG + 0.03 * Math.sin(2 * Math.PI * 3.1 * t) + 0.015 * Math.sin(2 * Math.PI * 7.3 * t),
      shock: SAG + 0.025 * Math.sin(2 * Math.PI * 2.7 * t + 1),
      steer: 0.03 * Math.sin(2 * Math.PI * 0.9 * t),
    }),
  },
  {
    // A berm: the bike laid over, the outside pedal down, his body more
    // upright than the bike and the suspension loaded through the apex.
    name: "corner",
    seconds: 3,
    at: (t) => {
      const k = Math.sin((2 * Math.PI * t) / 3);
      return {
        speed: 8,
        roll: 0.7 * k,
        steer: 0.08 * k,
        crank: k > 0 ? Math.PI / 2 : -Math.PI / 2,
        fork: SAG + 0.07 * Math.abs(k),
        shock: SAG + 0.08 * Math.abs(k),
        crouch: 0.4 * Math.abs(k),
      };
    },
  },
  {
    // A pump through a roller: down into the bike, then let it come up.
    name: "pump",
    seconds: 1.6,
    at: (t) => {
      const k = held(t, 0.1, 0.6, 0.8, 1.4);
      return {
        speed: 7,
        crouch: k,
        up: -0.05 * k,
        fork: SAG + 0.09 * k,
        shock: SAG + 0.1 * k,
      };
    },
  },
  {
    // Hard on both brakes: the fork dives, he hangs back off the saddle.
    name: "brake",
    seconds: 1.8,
    at: (t) => {
      const k = held(t, 0.1, 0.4, 1.3, 1.7);
      return {
        speed: 9 - 4 * Math.min(1, t / 1.3),
        front: k,
        rear: k,
        fork: SAG + 0.11 * k,
        shock: SAG - 0.03 * k,
        shift: 0.8 * k,
        pitch: -0.05 * k,
      };
    },
  },
  {
    // A tabletop: loaded into the lip, popped, the bike lifted and tucked
    // under him in the air, suspension topped out, and a two-wheeled
    // landing taken on the legs.
    name: "jump",
    seconds: 2.6,
    at: (t) => {
      const load = held(t, 0.1, 0.45, 0.5, 0.65);
      const air = t > 0.6 && t < 1.9;
      const land = held(t, 1.85, 1.95, 2.15, 2.5);
      const u = (t - 0.6) / 1.3;
      return {
        speed: 9,
        crouch: Math.max(load, air ? 0.45 * Math.sin(Math.PI * u) : 0, land),
        up: -0.06 * load + (air ? 0.04 * Math.sin(Math.PI * u) : 0) - 0.07 * land,
        fork: air ? 0 : SAG + 0.08 * load + 0.14 * land,
        shock: air ? 0 : SAG + 0.09 * load + 0.15 * land,
        pitch: air ? 0.18 * Math.cos(Math.PI * u) : 0,
        shift: air ? -0.2 * Math.sin(Math.PI * u) : 0.2 * land,
        airborne: air,
      };
    },
  },
  {
    // A manual: hips back, the front lifted and held on the balance point.
    name: "manual",
    seconds: 2,
    at: (t) => {
      const k = held(t, 0.15, 0.6, 1.4, 1.85);
      return {
        speed: 6,
        shift: k,
        pitch: 0.35 * k,
        fork: SAG * (1 - k),
        shock: SAG + 0.04 * k,
        ahead: -0.06 * k,
      };
    },
  },
];

/** One frame of a clip: the pose, every node, every bone, and the root's
 * pitch and roll. */
export type ClipFrame = {
  pose: BikePose;
  nodes: Record<BikeNodeKey, NodeTransform>;
  bones: Record<SkierBone, BoneFrame>;
  root: { pitch: number; roll: number };
};

/** THE RIDER'S BONES on the bike posed `pose`, in the bike's centre of
 * mass's frame — `riderPose`'s solve, carried off his own centre of mass. */
export function riderBones(pose: BikePose): Record<SkierBone, BoneFrame> {
  // The solve states him in his trunk's own frame, which it hands back.
  const trunk = {
    origin: { x: 0, y: 0, z: 0 },
    x: { x: 1, y: 0, z: 0 },
    y: { x: 0, y: 1, z: 0 },
    z: { x: 0, y: 0, z: 1 },
  };
  const bones = skierBones(riderPose(pose)(0, trunk));
  const off = {
    x: pose.rider.x + BIKE_BB.x + trunk.origin.x,
    y: pose.rider.y + BIKE_BB.y + trunk.origin.y,
    z: pose.rider.z + BIKE_BB.z + trunk.origin.z,
  };
  const turn = (a: V3): V3 => ({
    x: trunk.x.x * a.x + trunk.y.x * a.y + trunk.z.x * a.z,
    y: trunk.x.y * a.x + trunk.y.y * a.y + trunk.z.y * a.z,
    z: trunk.x.z * a.x + trunk.y.z * a.y + trunk.z.z * a.z,
  });
  for (const k of Object.keys(bones) as SkierBone[]) {
    const f = bones[k];
    const h = turn(f.head);
    bones[k] = {
      head: { x: h.x + off.x, y: h.y + off.y, z: h.z + off.z },
      x: turn(f.x),
      y: turn(f.y),
      z: turn(f.z),
      length: f.length,
    };
  }
  return bones;
}

/** EVERY CLIP, `fps` frames a second, the bike and the rider together. */
export function bikeClips(fps = 30): { name: string; seconds: number; frames: ClipFrame[] }[] {
  const base = ridingPose();
  return PROGRAMS.map(({ name, seconds, at }) => {
    const frames: ClipFrame[] = [];
    let travelled = 0;
    for (let f = 0; f <= Math.round(seconds * fps); f++) {
      const r = at(f / fps);
      travelled += (r.speed ?? 0) / fps;
      const pose: BikePose = {
        ...base,
        steer: r.steer ?? 0,
        fork: r.fork ?? SAG,
        shock: r.shock ?? SAG,
        crank: r.crank ?? 0,
        shift: r.shift ?? 0,
        crouch: r.crouch ?? 0,
        roll: r.roll ?? 0,
        pitch: r.pitch ?? 0,
        front: r.front ?? 0,
        rear: r.rear ?? 0,
        airborne: !!r.airborne,
        pedalling: r.crank !== undefined && name === "pedal",
        frontSpin: travelled / 0.375,
        rearSpin: travelled / 0.36,
        rider: {
          x: base.rider.x,
          y: base.rider.y + (r.up ?? 0) - 0.12 * (r.crouch ?? 0),
          z: base.rider.z + (r.ahead ?? 0) - 0.18 * Math.max(0, r.shift ?? 0),
        },
      };
      frames.push({
        pose,
        nodes: bikeNodes(pose),
        bones: riderBones(pose),
        root: { pitch: pose.pitch, roll: pose.roll },
      });
    }
    return { name, seconds, frames };
  });
}
