// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD'S BODIES, POSED — where an amateur's joints are for each of
// the few shapes his figure is drawn between (`CROWD_POSES`), for each of
// the eight people the crowd is made of (`CROWD_LOOKS`). Three-free, so the
// suite reads it (`tests/crowd_figure_test.ts`).
//
// THE PLAYER'S OWN POSE, NOT A SECOND ONE. Every shape here is the player's
// figure solved by `skierPose` (`skier-pose.ts`) for the moment it names —
// the athletic stance, the tuck, a carve's angulation, the wedge (his skis'
// splay, tips in), the hockey stop (the skid's pivot), both poles planted
// on a double pole, the compact body of a flight — and then sized to the
// amateur's body. So whatever is done to the player's stance, his tuck or
// his angulation moves the crowd with it: there is one skier's pose in the
// game, and an amateur is that skier, smaller or broader, on worse days.
// Lying in the snow is no shape at all: an amateur down is the player's
// own ragdoll, stepped by the engine and drawn off it (`crowd-fall.ts`).
//
// HIS ANIMATIONS, NOT JUST HIS STANCES. What makes the player read as
// alive between those shapes is what his body does on its own clock: a
// POLE PLANT on every turn he begins (`skier-spring.ts`' rule, the same
// window, the same length), and stood still, a skier who breathes, shifts
// his weight and looks about (`idle`). Each is the player's own pose at
// its moments — the plant's touch and its trail, either pole; the wait
// leant and looking one way and then the other — and `dialsOf` runs it
// through them on the same timing the player's view does.
//
// ONE SKELETON, MANY TARGETS. The player's figure is solved afresh every
// frame; three hundred cannot be. So each body is built ONCE at the stance
// and once at the far end of each motion, and the GPU blends the targets
// per instance by the weights the engine's amateur gives it
// (`crowd-view.ts`). Every target is built off the same joints by the same
// builder (`crowd-shapes.ts`), so each has the same triangles in the same
// order, and the blend between two is the figure moving between them.
//
// The frame is the amateur's: x right, y up, z forward, the origin on the
// snow between his feet.

import { TUNING, type Amateur, type CrowdBody } from "@engine";

import {
  MOUNTS,
  STILL_GAIT,
  skierPose,
  type SkierPose,
  type SkierPoseInput,
} from "./skier-pose.ts";
import { CHAIR_SEAT, seatedPose } from "./skier-seat.ts";
import { gaitOf } from "./skier-gait.ts";
import { PLANT, plantLength } from "./skier-spring.ts";
import { smooth, TURN_PLANT } from "./skier-stroke.ts";

export type V3 = [number, number, number];

/** What a person looks like, as measures and kit: height, half the
 * shoulders and the hips, the body's depth front to back, a belly, the
 * head's radius (all in m), the skis' length and width, whether he carries
 * poles, his headwear, his hair out of it, a pack on his back, a coat's
 * hem below the hips (m), and whether the suit is one piece. */
export type CrowdLook = {
  height: number;
  shoulder: number;
  hip: number;
  girth: number;
  belly: number;
  head: number;
  ski: number;
  skiWidth: number;
  poles: boolean;
  hat: "helmet" | "beanie" | "cap" | "pompom";
  hair?: "ponytail" | "bob";
  pack?: boolean;
  coat?: number;
  suit?: boolean;
};

// prettier-ignore
export const CROWD_LOOKS: Readonly<Record<CrowdBody, CrowdLook>> = {
  man: { height: 1.8, shoulder: 0.21, hip: 0.15, girth: 0.13, belly: 0, head: 0.115, ski: 1.72, skiWidth: 0.08, poles: true, hat: "helmet" },
  woman: { height: 1.68, shoulder: 0.18, hip: 0.16, girth: 0.12, belly: 0, head: 0.11, ski: 1.6, skiWidth: 0.075, poles: true, hat: "helmet", hair: "ponytail" },
  teen: { height: 1.66, shoulder: 0.18, hip: 0.14, girth: 0.12, belly: 0, head: 0.11, ski: 1.55, skiWidth: 0.09, poles: true, hat: "beanie" },
  child: { height: 1.18, shoulder: 0.14, hip: 0.11, girth: 0.1, belly: 0.01, head: 0.1, ski: 0.95, skiWidth: 0.07, poles: false, hat: "helmet" },
  oldMan: { height: 1.75, shoulder: 0.2, hip: 0.16, girth: 0.14, belly: 0.05, head: 0.112, ski: 1.65, skiWidth: 0.075, poles: true, hat: "cap" },
  oldWoman: { height: 1.62, shoulder: 0.17, hip: 0.17, girth: 0.13, belly: 0.03, head: 0.108, ski: 1.52, skiWidth: 0.072, poles: true, hat: "pompom", hair: "bob", coat: 0.14 },
  freerider: { height: 1.82, shoulder: 0.22, hip: 0.16, girth: 0.14, belly: 0, head: 0.116, ski: 1.84, skiWidth: 0.11, poles: true, hat: "helmet", pack: true },
  retro: { height: 1.72, shoulder: 0.19, hip: 0.15, girth: 0.12, belly: 0, head: 0.11, ski: 1.7, skiWidth: 0.07, poles: true, hat: "pompom", suit: true },
};

/** The shapes the figure is drawn between, each a morph target of its own
 * off the stance: in this order, which is the order the weights go in. */
export const CROWD_POSES = [
  "crouch",
  "lean",
  "leanLeft",
  "plough",
  "across",
  "skate0",
  "skate1",
  "skate2",
  "skate3",
  "skate4",
  "skate5",
  "pole0",
  "pole1",
  "pole2",
  "air",
  "plantLeft",
  "trailLeft",
  "plantRight",
  "trailRight",
  "idle",
  "idleAway",
  "seat",
] as const;
export type CrowdPose = (typeof CROWD_POSES)[number];

/** THE STRIDE AS KEYS: the player's own gait (`gaitOf`) at its moments, a
 * target each — the SKATE over its two strides (a push off each leg),
 * `SKATE_KEYS` moments of it, at a way he skates wholly at; the DOUBLE
 * POLE over its one, `POLE_KEYS` of it, at a walk on the flat, where he
 * poles wholly. `dialsOf` runs an amateur through them by his own stride
 * count, blending each moment into the next, so he skates and poles the
 * player's stroke on the player's timing. */
export const SKATE_KEYS = 6;
export const POLE_KEYS = 3;
const STRIDE_AT = { skate: 4, pole: 1 };
/** A ski as four points: its tail, its tip, its middle on the snow, and a
 * point off its right edge — enough to build it in any pose. */
export type SkiPoints = { tail: V3; tip: V3; mid: V3; side: V3 };

/** Every joint the builder hangs the figure on: the skis, the boots' cuffs
 * (`ankle`), the knees and the hip joints, the pelvis, the small of the
 * back, the neck and the head, the shoulders, elbows and fists, and the
 * poles' baskets (at the fists for a skier who carries none). */
export type Posed = {
  skiL: SkiPoints;
  skiR: SkiPoints;
  ankleL: V3;
  ankleR: V3;
  kneeL: V3;
  kneeR: V3;
  hipL: V3;
  hipR: V3;
  pelvis: V3;
  waist: V3;
  neck: V3;
  head: V3;
  shoulderL: V3;
  shoulderR: V3;
  elbowL: V3;
  elbowR: V3;
  handL: V3;
  handR: V3;
  basketL: V3;
  basketR: V3;
};

/** The player's figure is the reference man's, this tall in his boots and
 * helmet, m, and this wide at the shoulders' half, m. */
const REFERENCE = { height: 1.8, shoulder: 0.2 };

/** THE PLAYER'S POSE INPUT for each shape: the stance, then each target at
 * its full dial. The lean is a carve's — the pair rolled over (`LEAN_ROLL`,
 * which the crowd turns the whole figure by, as the player's own group is
 * turned) and his mass hung inside it; the wedge is the skis' splay tips
 * in; the stop is the skid's pivot thrown across; the poles are a double
 * pole at its plant. */
const LEAN_ROLL = 0.55;
/** Where in a turn's plant the basket trails back behind the touch, 0..1
 * of the plant — the second of its two shapes. */
const TRAIL = 0.7;
/** The two moments of the player's own wait (`idle.t`, s) his weight is
 * furthest over to one side and his look furthest round — and then the
 * other — and the period the crowd's wait swings between them on, s (the
 * player's weight shift's). */
const WAIT = { one: 95.48, other: 62.43, period: 7.3 };
const STAND: SkierPoseInput = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 10,
};
/** The player working at full drive at `speed` m/s on the flat, `stride`
 * strides in. */
function strideGait(speed: number, stride: number) {
  return gaitOf({
    drive: 1,
    stride,
    speed,
    way: speed,
    airborne: false,
    thrown: null,
    pitch: 0,
  });
}

/** `count` targets named `name0`… over `strides` strides of the gait at
 * `speed`. */
function keyed<N extends "skate" | "pole">(
  name: N,
  count: number,
  speed: number,
  strides: number,
): Record<`${N}${0 | 1 | 2 | 3 | 4 | 5}`, SkierPoseInput> {
  const out: Record<string, SkierPoseInput> = {};
  for (let k = 0; k < count; k++) {
    out[`${name}${k}`] = { ...STAND, gait: strideGait(speed, (k / count) * strides) };
  }
  return out as Record<`${N}${0 | 1 | 2 | 3 | 4 | 5}`, SkierPoseInput>;
}

const INPUTS: Readonly<Record<Exclude<CrowdPose, "seat">, SkierPoseInput>> = {
  crouch: { ...STAND, crouch: 1, tuck: 1 },
  lean: {
    ...STAND,
    hipRight: 0.3,
    steer: 1,
    edge: 0.1,
    roll: LEAN_ROLL,
    body: { tilt: 0.1, roll: LEAN_ROLL },
    carve: 0.4,
    crouch: 0.15,
    // The inside leg folded up the height the roll would sink its ski by —
    // the player's own stand on an inclined pair (`ski-stand.ts`).
    lift: [0, 2 * MOUNTS.foot.x * Math.sin(LEAN_ROLL)],
  },
  // A turn to the left is its own target, not the right one run backwards:
  // a morph blended past zero stretches the figure rather than mirroring it.
  leanLeft: {
    ...STAND,
    hipRight: -0.3,
    steer: -1,
    edge: -0.1,
    roll: -LEAN_ROLL,
    body: { tilt: -0.1, roll: -LEAN_ROLL },
    carve: 0.4,
    crouch: 0.15,
    lift: [2 * MOUNTS.foot.x * Math.sin(LEAN_ROLL), 0],
  },
  plough: {
    ...STAND,
    crouch: 0.2,
    gait: { ...STILL_GAIT, splay: [0.32, -0.32], out: [-0.14, 0.14] },
  },
  across: { ...STAND, skiAngle: 1.05, skid: 1, crouch: 0.2 },
  ...keyed("skate", SKATE_KEYS, STRIDE_AT.skate, 2),
  ...keyed("pole", POLE_KEYS, STRIDE_AT.pole, 1),
  air: { ...STAND, airborne: true, air: 1 },
  plantLeft: { ...STAND, plantAt: { side: 0, t: TURN_PLANT.touch, weight: 1 } },
  trailLeft: { ...STAND, plantAt: { side: 0, t: TRAIL, weight: 1 } },
  plantRight: { ...STAND, plantAt: { side: 1, t: TURN_PLANT.touch, weight: 1 } },
  trailRight: { ...STAND, plantAt: { side: 1, t: TRAIL, weight: 1 } },
  idle: { ...STAND, idle: { t: WAIT.one, still: 1 } },
  idleAway: { ...STAND, idle: { t: WAIT.other, still: 1 } },
};

/** Each target's place in `CROWD_POSES`, the weights' order. */
const POSE_AT = Object.fromEntries(CROWD_POSES.map((k, i) => [k, i])) as Record<CrowdPose, number>;

/** The pose's dials, each 0 (the stance) … 1 (all the way). Only one is
 * set for a target; the GPU sums them. */
export type PoseDials = Partial<Record<CrowdPose, number>>;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Turn `p` about the forward axis through `o` by `a` rad — positive takes
 * the top toward +x, a lean to the right. */
function rollAbout(p: V3, o: V3, a: number): V3 {
  const x = p[0] - o[0];
  const y = p[1] - o[1];
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [o[0] + x * c + y * s, o[1] - x * s + y * c, p[2]];
}

/** The player's pose turned into the crowd's joints: the snow under the
 * origin rather than his centre of gravity, the skis off his boots' own
 * frames, sized to `look` — every height by his, the arms out to his
 * shoulders. */
export function fromPlayer(pose: SkierPose, look: CrowdLook): Posed {
  const ground = MOUNTS.ground;
  const k = look.height / REFERENCE.height;
  const wide = look.shoulder / REFERENCE.shoulder;
  const at = (v: { x: number; y: number; z: number }, broad = 1): V3 => [
    v.x * k * broad,
    (v.y - ground) * k,
    v.z * k,
  ];
  // The cuff stands this far up the boot from the ski's top.
  const cuff = (MOUNTS.foot.y - ground) * k;
  const ski = (i: number): SkiPoints => {
    const boot = pose.boots[i];
    const f: V3 = [boot.f.x, boot.f.y, boot.f.z];
    const n: V3 = [boot.n.x, boot.n.y, boot.n.z];
    const r = cross(n, f);
    const mid = sub(at(pose.feet[i]), mul(n, cuff));
    return {
      tail: add(mid, mul(f, -look.ski * 0.45)),
      tip: add(mid, mul(f, look.ski * 0.55)),
      mid,
      side: add(mid, mul(r, look.skiWidth / 2)),
    };
  };
  const hands = pose.hands;
  const poles = pose.poles;
  return {
    skiL: ski(0),
    skiR: ski(1),
    ankleL: at(pose.feet[0]),
    ankleR: at(pose.feet[1]),
    kneeL: at(pose.knees[0]),
    kneeR: at(pose.knees[1]),
    hipL: at(pose.hipJoints[0]),
    hipR: at(pose.hipJoints[1]),
    pelvis: at(pose.hips),
    waist: at(pose.waist),
    neck: at(pose.neck),
    head: at(pose.head),
    shoulderL: at(pose.shoulders[0], wide),
    shoulderR: at(pose.shoulders[1], wide),
    elbowL: at(pose.elbows[0], wide),
    elbowR: at(pose.elbows[1], wide),
    handL: at(hands[0], wide),
    handR: at(hands[1], wide),
    basketL: at(poles ? poles[0] : hands[0], wide),
    basketR: at(poles ? poles[1] : hands[1], wide),
  };
}

const SKI_KEYS = ["skiL", "skiR"] as const;
const POINT_KEYS = [
  "ankleL",
  "ankleR",
  "kneeL",
  "kneeR",
  "hipL",
  "hipR",
  "pelvis",
  "waist",
  "neck",
  "head",
  "shoulderL",
  "shoulderR",
  "elbowL",
  "elbowR",
  "handL",
  "handR",
  "basketL",
  "basketR",
] as const;

/** Every point of a pose moved by `f`. */
export function mapPosed(p: Posed, f: (q: V3) => V3): Posed {
  const out = { ...p };
  for (const key of POINT_KEYS) out[key] = f(p[key]);
  for (const key of SKI_KEYS) {
    const s = p[key];
    out[key] = { tail: f(s.tail), tip: f(s.tip), mid: f(s.mid), side: f(s.side) };
  }
  return out;
}

/** THE SKELETON for one shape: the stance with no dial, or the target its
 * one dial names, at that dial's share of the way (the player's own pose
 * solved at the share). */
export function poseCrowd(look: CrowdLook, dials: PoseDials = {}): Posed {
  const key = (Object.keys(dials) as CrowdPose[]).find((k) => (dials[k] ?? 0) !== 0);
  const share = key ? (dials[key] ?? 0) : 0;
  if (key === "seat") {
    // ON A CHAIR: the player's own seated pose (`skier-seat.ts`).
    return grounded(fromPlayer(seatedPose(STAND, { share, y: SEAT_Y }), look));
  }
  const input = key ? blend(INPUTS[key], share) : STAND;
  const posed = grounded(fromPlayer(skierPose(input), look));
  // The lean's roll is the player's group's, turned about the outside
  // ski's edge — the left, in a turn to the right.
  const roll = key === "lean" ? LEAN_ROLL * share : key === "leanLeft" ? -LEAN_ROLL * share : 0;
  const edge = roll > 0 ? posed.skiL.mid : posed.skiR.mid;
  return roll === 0 ? posed : mapPosed(posed, (p) => rollAbout(p, edge, roll));
}

/** Stood on the snow: the player's frame folds his feet up toward his
 * centre of gravity in a tuck, and the crowd's stands on its skis. */
function grounded(p: Posed): Posed {
  const low = Math.min(p.skiL.mid[1], p.skiR.mid[1]);
  return low === 0 ? p : mapPosed(p, (q) => [q[0], q[1] - low, q[2]]);
}

/** A target's input at `share` of the way from the stance: its numbers
 * scaled, its flags kept. */
function blend(input: SkierPoseInput, share: number): SkierPoseInput {
  if (share === 1) return input;
  const out: SkierPoseInput = { ...input };
  for (const k of [
    "hipRight",
    "steer",
    "edge",
    "roll",
    "crouch",
    "tuck",
    "skiAngle",
    "skid",
    "carve",
    "air",
  ] as const) {
    const v = input[k];
    if (typeof v === "number") out[k] = v * share;
  }
  if (input.body) out.body = { tilt: input.body.tilt * share, roll: input.body.roll * share };
  if (input.plantAt) out.plantAt = { ...input.plantAt, weight: input.plantAt.weight * share };
  if (input.idle) out.idle = { ...input.idle, still: input.idle.still * share };
  if (input.gait) {
    const g = input.gait;
    out.gait = {
      ...g,
      pole: g.pole * share,
      splay: [g.splay[0] * share, g.splay[1] * share],
      out: [g.out[0] * share, g.out[1] * share],
    };
  }
  return out;
}

/** The skeleton for each of the shapes: the stance first, then every
 * target at its full dial, in `CROWD_POSES`' order. */
export function crowdTargets(look: CrowdLook): Posed[] {
  return [poseCrowd(look), ...CROWD_POSES.map((k) => poseCrowd(look, { [k]: 1 }))];
}

/** THE TURN'S POLE PLANT an amateur is in, by the player's own rule
 * (`skier-spring.ts`): planted on a turn begun after one that held, between
 * the speeds a plant is made at and for as long as one takes at his — and
 * as much of it as his riding allows (his crouch, his poling, the wedge,
 * which plants nothing). The pole is the inside one of the turn begun (0
 * left), `t` 0..1 through the plant. */
export function plantOf(
  a: Pick<
    Amateur,
    "mode" | "speed" | "crouch" | "push" | "plough" | "turnSide" | "turnT" | "turnHeld"
  >,
): { side: 0 | 1; t: number; weight: number } | null {
  if (a.mode !== "ski" || a.turnSide === 0 || a.turnHeld <= PLANT.held) return null;
  if (a.speed < PLANT.slow || a.speed > PLANT.fast) return null;
  const t = a.turnT / plantLength(a.speed);
  if (t >= 1) return null;
  const ok =
    Math.max(0, 1 - crouchDial(a.crouch) * 1.6) * Math.max(0, 1 - a.push * 6) * (1 - a.plough);
  if (ok <= 0.5) return null;
  return { side: a.turnSide > 0 ? 1 : 0, t, weight: ok };
}

/** The crouch target's dial off the engine's crouch: his stance's own
 * bend is the target's zero. */
const crouchDial = (crouch: number): number => Math.max(0, crouch - 0.15) * 1.15;

/** THE WEIGHTS an amateur is drawn at this moment, one a target in
 * `CROWD_POSES`' order, into `out` — off the numbers the engine keeps for
 * the picture (`Amateur.crouch` … `turnHeld`) and the run's clock `t`, s —
 * and which way his figure is mirrored (−1 left): a fall goes down on his
 * own side, and the lean, the stop and the plant are turned with it; down
 * in the snow, every weight fades (he is drawn off his ragdoll then, never
 * by these); sat on a chair (`seat`, how far he is
 * sat, which only the view knows — a T-bar's rider rides stood), his own
 * seat, and neither a plant nor a stood skier's wait. */
export function dialsOf(
  a: Pick<
    Amateur,
    | "id"
    | "body"
    | "crouch"
    | "lean"
    | "plough"
    | "across"
    | "fall"
    | "fallSide"
    | "push"
    | "pole"
    | "mode"
    | "airAt"
    | "airT"
    | "speed"
    | "turnSide"
    | "turnT"
    | "turnHeld"
  >,
  out: Float32Array | number[],
  t = 0,
  seat = 0,
): number {
  const mirror = a.fallSide < 0 ? -1 : 1;
  const up = 1 - a.fall;
  const air =
    a.mode === "air" && a.airT > 0 ? Math.sqrt(Math.sin((Math.PI * a.airAt) / a.airT)) : 0;
  const lean = Math.max(-1.3, Math.min(1.3, a.lean / LEAN_ROLL)) * mirror * up;
  const at = (k: CrowdPose, w: number): void => {
    out[POSE_AT[k]] = w;
  };
  at("crouch", crouchDial(a.crouch) * up);
  at("lean", Math.max(0, lean));
  at("leanLeft", Math.max(0, -lean));
  at("plough", a.plough * up);
  at("across", a.across * up);
  at("air", (air || 0) * up);
  // WORKING: the player's own gait at his way and his drive, and how much
  // of it is a skate and how much a double pole (`gaitOf`) — run through
  // the keys of each at his own place in the stride. The crowd is drawn on
  // no rise, so the one stride `gaitOf` gives is a skier with no poles
  // walking off a standstill: he is drawn skating it.
  for (let k = 0; k < SKATE_KEYS; k++) at(`skate${k}` as CrowdPose, 0);
  for (let k = 0; k < POLE_KEYS; k++) at(`pole${k}` as CrowdPose, 0);
  if (a.push > 0 && a.mode !== "air" && seat === 0) {
    const g = gaitOf({
      drive: a.push,
      stride: a.pole,
      speed: a.speed,
      way: a.speed,
      airborne: false,
      thrown: null,
      pitch: 0,
      poles: CROWD_LOOKS[a.body].poles,
    });
    const keys = (name: "skate" | "pole", count: number, u: number, w: number): void => {
      const x = (((u % 1) + 1) % 1) * count;
      const k = Math.floor(x) % count;
      const f = x - Math.floor(x);
      at(`${name}${k}` as CrowdPose, (1 - f) * w * up);
      at(`${name}${(k + 1) % count}` as CrowdPose, f * w * up);
    };
    keys("skate", SKATE_KEYS, a.pole / 2, g.skate + g.stride);
    keys("pole", POLE_KEYS, a.pole, g.pole);
  }
  // THE PLANT through its two shapes: swung forward to the touch, trailed
  // back behind it, and home to the stance — on the pole the mirror puts
  // inside his turn.
  const plant = plantOf(a);
  const PLANTS = ["plantLeft", "trailLeft", "plantRight", "trailRight"] as const;
  for (const k of PLANTS) at(k, 0);
  if (plant) {
    const u = plant.t;
    const touch = TURN_PLANT.touch;
    const w = plant.weight * up * (1 - seat);
    const toTrail = smooth((u - touch) / (TRAIL - touch));
    const touchW = u < touch ? smooth(u / touch) : u < TRAIL ? 1 - toTrail : 0;
    const trailW = u < touch ? 0 : u < TRAIL ? toTrail : 1 - smooth((u - TRAIL) / (1 - TRAIL));
    const side = mirror > 0 ? plant.side : 1 - plant.side;
    at(PLANTS[2 * side], touchW * w);
    at(PLANTS[2 * side + 1], trailW * w);
  }
  // STOOD STILL, alive: the player's own wait, faded in below a walk and
  // swung from one side to the other on his own clock.
  const still =
    Math.max(0, 1 - a.speed / 1.5) * (1 - a.push) * (a.mode === "air" ? 0 : up) * (1 - seat);
  const wave = Math.sin((2 * Math.PI * t) / WAIT.period + a.id * 2.39);
  at("idle", still * Math.max(0, wave));
  at("idleAway", still * Math.max(0, -wave));
  at("seat", seat * up);
  return mirror;
}

/** The player's seat in his own frame (`skier-seat.ts`): the chair's seat
 * top under his body's origin, as the engine hangs him (`TUNING.lift`). */
const SEAT_Y = TUNING.lift.seat - CHAIR_SEAT;

/** HOW HIGH A BODY SITS: its seat's top over its skis in the seated target,
 * m — what a rider's figure is dropped by under the chair's seat. */
export function seatHeight(look: CrowdLook): number {
  const sat = poseCrowd(look, { seat: 1 });
  return sat.pelvis[1] - PELVIS_OVER_SEAT * (look.height / REFERENCE.height);
}

/** The player's hips over his seat when sat (`skier-seat.ts`), m. */
const PELVIS_OVER_SEAT = 0.11;
