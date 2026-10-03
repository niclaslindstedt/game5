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
// The one shape the player has no pose for is lying in the snow (his is a
// ragdoll, stepped by the engine), so DOWN is his half-crouch laid over on
// its side.
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

import type { Amateur, CrowdBody } from "@engine";

import {
  MOUNTS,
  STILL_GAIT,
  skierPose,
  type SkierPose,
  type SkierPoseInput,
} from "./skier-pose.ts";

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
  "down",
  "pole",
  "air",
] as const;
export type CrowdPose = (typeof CROWD_POSES)[number];

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
const STAND: SkierPoseInput = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 10,
};
const INPUTS: Readonly<Record<Exclude<CrowdPose, "down">, SkierPoseInput>> = {
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
  pole: { ...STAND, gait: { ...STILL_GAIT, pole: 1, phase: 0, keep: 1 } },
  air: { ...STAND, airborne: true, air: 1 },
};

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
function fromPlayer(pose: SkierPose, look: CrowdLook): Posed {
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
function mapPosed(p: Posed, f: (q: V3) => V3): Posed {
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
  const down = dials.down ?? 0;
  if (down > 0) {
    // His half-crouch laid over onto his right side and dropped onto the
    // snow, his skis still on.
    const crouched = grounded(fromPlayer(skierPose({ ...STAND, crouch: 0.5 }), look));
    const fallen = mapPosed(crouched, (p) => rollAbout(p, [0, 0, 0], 1.45 * down));
    // ...lying on his hip, his shoulder and his head.
    let low = Infinity;
    for (const key of ["pelvis", "hipR", "shoulderR", "head"] as const) {
      low = Math.min(low, fallen[key][1]);
    }
    const drop = (low - look.girth) * down;
    return mapPosed(fallen, (p) => [p[0] - 0.25 * look.height * down, p[1] - drop, p[2]]);
  }
  const key = (Object.keys(dials) as CrowdPose[]).find((k) => (dials[k] ?? 0) !== 0);
  const share = key ? (dials[key] ?? 0) : 0;
  const input = key && key !== "down" ? blend(INPUTS[key], share) : STAND;
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

/** THE WEIGHTS an amateur is drawn at this moment, one a target in
 * `CROWD_POSES`' order, into `out` — off the numbers the engine keeps for
 * the picture (`Amateur.crouch` … `push`) — and which way his figure is
 * mirrored (−1 left): a fall goes down on his own side, and the lean and
 * the stop are turned with it. Lying in the snow, nothing else shows. */
export function dialsOf(
  a: Pick<
    Amateur,
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
  >,
  out: Float32Array | number[],
): number {
  const mirror = a.fallSide < 0 ? -1 : 1;
  const up = 1 - a.fall;
  const air =
    a.mode === "air" && a.airT > 0 ? Math.sqrt(Math.sin((Math.PI * a.airAt) / a.airT)) : 0;
  const lean = Math.max(-1.3, Math.min(1.3, a.lean / LEAN_ROLL)) * mirror * up;
  out[0] = Math.max(0, a.crouch - 0.15) * 1.15 * up;
  out[1] = Math.max(0, lean);
  out[2] = Math.max(0, -lean);
  out[3] = a.plough * up;
  out[4] = a.across * up;
  out[5] = a.fall;
  out[6] = a.push * (0.5 + 0.5 * Math.sin(a.pole)) * up;
  out[7] = (air || 0) * up;
  return mirror;
}
