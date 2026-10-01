// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MODELLED SKIER POSED AS THE GAME POSES ITS OWN. The game's skier has
// no clips: `skierPose` puts every joint in the pair's body frame off the
// engine's readings, and `skier-figure.ts` lays each part of him from one
// joint to the next. A skier made by `make blender KIND=skier` is one
// skinned figure whose BONES are those same spans, so the same pose drives
// it:
//
//   skierBones(pose)   every bone's frame for a pose — its head on a joint,
//                      its +y along the span to the next, its +z where the
//                      joint bends (a knee's front, an elbow's point), the
//                      head turned as `skier-figure.ts` turns it; the
//                      trunk in two (the pelvis and the chest), a HALF BONE
//                      at every hip, knee, shoulder and elbow turned half
//                      way between the two it joins, each HAND closed round
//                      its pole and each FOOT in its boot's frame.
//                      Three-free: the Blender driver binds the model in
//                      the standing pose off it and samples every clip
//                      through it.
//   STANDING           the pose the model is bound in: the athletic stance
//                      on the move, the skis flat and straight.
//   skierClips()       the clips a model carries, each SAMPLED off the
//                      game's own `skierPose` and `stepSkierSpring` over a
//                      program of engine readings — a carve each way, the
//                      tuck, a pole plant, a jump and its landing, the
//                      grabs — so a clip is the game's pose played, not
//                      another one.
//   rigSkier(root)     a loaded model's bones set to `skierBones(pose)`.
//
// The frame is the pair's body frame (x right, y up, z forward, the
// origin at the centre of gravity), which the model is exported in: the
// game's figure and the model stand in one place. The poles are the
// figure's own (`skier-figure.ts`), not the model's: a bone each would buy
// nothing a cylinder from the fist does not.

import * as THREE from "three";
import { SKIS, type TrickPose } from "@engine";

import {
  createSkierSpring,
  skierPose,
  stepSkierSpring,
  type SkierPose,
  type SkierPoseInput,
  type V3,
} from "./skier-pose.ts";

export const SKIER_BONES = [
  "pelvis",
  "chest",
  "head",
  "thigh_l",
  "shin_l",
  "boot_l",
  "thigh_r",
  "shin_r",
  "boot_r",
  "upperarm_l",
  "forearm_l",
  "upperarm_r",
  "forearm_r",
  "hip_l",
  "hip_r",
  "knee_l",
  "knee_r",
  "shoulder_l",
  "shoulder_r",
  "elbow_l",
  "elbow_r",
  "hand_l",
  "hand_r",
] as const;
export type SkierBone = (typeof SKIER_BONES)[number];

/** A bone's frame: its head, its axes (right-handed, x = y × z) and length. */
export type BoneFrame = { head: V3; x: V3; y: V3; z: V3; length: number };

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (a: V3): V3 => scale(a, 1 / (Math.sqrt(dot(a, a)) || 1));

type Quat = { x: number; y: number; z: number; w: number };

/** A frame's turn as a quaternion (its axes the matrix's columns). */
function quatOf(f: { x: V3; y: V3; z: V3 }): Quat {
  const [m00, m01, m02] = [f.x.x, f.y.x, f.z.x];
  const [m10, m11, m12] = [f.x.y, f.y.y, f.z.y];
  const [m20, m21, m22] = [f.x.z, f.y.z, f.z.z];
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    return { w: 0.25 / s, x: (m21 - m12) * s, y: (m02 - m20) * s, z: (m10 - m01) * s };
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return { w: (m21 - m12) / s, x: 0.25 * s, y: (m01 + m10) / s, z: (m02 + m20) / s };
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return { w: (m02 - m20) / s, x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s };
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return { w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: 0.25 * s };
}
const qmul = (a: Quat, b: Quat): Quat => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});
const qconj = (q: Quat): Quat => ({ w: q.w, x: -q.x, y: -q.y, z: -q.z });
/** Half way along the shorter arc from `a` to `b` (normalised lerp: at a
 * half the same as a slerp's). */
function qhalf(a: Quat, b: Quat): Quat {
  const k = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z < 0 ? -1 : 1;
  const q = { w: a.w + k * b.w, x: a.x + k * b.x, y: a.y + k * b.y, z: a.z + k * b.z };
  const l = Math.hypot(q.w, q.x, q.y, q.z) || 1;
  return { w: q.w / l, x: q.x / l, y: q.y / l, z: q.z / l };
}
function rotateBy(q: Quat, v: V3): V3 {
  const t = qmul(qmul(q, { w: 0, ...v }), qconj(q));
  return { x: t.x, y: t.y, z: t.z };
}

/** THE REST the half bones turn from: every bone in the pose the model is
 * bound in (`STANDING`), found once. */
let rest: Record<string, BoneFrame> | null = null;

/**
 * A HALF BONE between `parent` and `child`, its head at `at`: it turns from
 * its rest (the parent's own) by half the parent's turn from rest and half
 * the child's — the half-angle helper every skinned elbow is given, so the
 * skin across the joint goes half as far round with neither bone.
 */
function halfway(parent: string, child: string, out: Record<string, BoneFrame>, at: V3): BoneFrame {
  rest ??= skierBones(skierPose(STANDING), false);
  const r = quatOf(rest[parent]);
  const dp = qmul(quatOf(out[parent]), qconj(r));
  const dc = qmul(quatOf(out[child]), qconj(quatOf(rest[child])));
  const q = qmul(qhalf(dp, dc), r);
  return {
    head: at,
    x: rotateBy(q, { x: 1, y: 0, z: 0 }),
    y: rotateBy(q, { x: 0, y: 1, z: 0 }),
    z: rotateBy(q, { x: 0, y: 0, z: 1 }),
    length: 0.08,
  };
}

/** A frame from `head` along to `tail`, its +z turned toward `face`
 * (`fallback` where `face` runs along the bone). */
function span(head: V3, tail: V3, face: V3, fallback: V3): BoneFrame {
  const d = sub(tail, head);
  const y = norm(d);
  let z = sub(face, scale(y, dot(face, y)));
  if (dot(z, z) < 1e-8) z = sub(fallback, scale(y, dot(fallback, y)));
  z = norm(z);
  return { head, x: cross(y, z), y, z, length: Math.sqrt(dot(d, d)) };
}

/** The way a two-bone limb bends: its middle joint off the line from its
 * root to its tip. */
const bend = (root: V3, mid: V3, tip: V3): V3 => sub(mid, scale(add(root, tip), 0.5));

/** How the head is turned, as `skier-figure.ts` turns it: nearer level
 * than the shoulders and looking into the turn — three's "YXZ" Euler of
 * (−0.2 + pitch × 0.3, look × 0.5, −headRoll), as axes. */
function headAxes(p: SkierPose): { x: V3; y: V3; z: V3 } {
  const [a, b, c] = [-0.2 + p.pitch * 0.3, p.look * 0.5, -p.headRoll];
  const rx = (v: V3): V3 => ({
    x: v.x,
    y: v.y * Math.cos(a) - v.z * Math.sin(a),
    z: v.y * Math.sin(a) + v.z * Math.cos(a),
  });
  const ry = (v: V3): V3 => ({
    x: v.x * Math.cos(b) + v.z * Math.sin(b),
    y: v.y,
    z: -v.x * Math.sin(b) + v.z * Math.cos(b),
  });
  const rz = (v: V3): V3 => ({
    x: v.x * Math.cos(c) - v.y * Math.sin(c),
    y: v.x * Math.sin(c) + v.y * Math.cos(c),
    z: v.z,
  });
  const turn = (v: V3) => ry(rx(rz(v)));
  return {
    x: turn({ x: 1, y: 0, z: 0 }),
    y: turn({ x: 0, y: 1, z: 0 }),
    z: turn({ x: 0, y: 0, z: 1 }),
  };
}

/** EVERY BONE'S FRAME FOR A POSE (the half bones with them, unless
 * `halves` is false — the rest they turn from is found without them). */
export function skierBones(p: SkierPose, halves = true): Record<SkierBone, BoneFrame> {
  const up = norm(sub(p.neck, p.hips));
  const across = norm(sub(p.shoulders[1], p.shoulders[0]));
  const chest = norm(cross(across, up));
  const out = {} as Record<SkierBone, BoneFrame>;
  // THE TRUNK IN TWO: the pelvis from the hips to the small of the back,
  // facing the way the hip joints' line says (turned with the skis), and
  // the chest from there to the neck, facing the way the shoulders do — so
  // the back rounds in the tuck and the shoulders turn over the hips.
  const pelvisAcross = norm(sub(p.hipJoints[1], p.hipJoints[0]));
  const lower = norm(sub(p.waist, p.hips));
  out.pelvis = span(p.hips, p.waist, cross(pelvisAcross, lower), chest);
  out.chest = span(p.waist, p.neck, chest, { x: 0, y: 0, z: 1 });
  const h = headAxes(p);
  out.head = { head: p.head, ...h, length: 0.15 };
  [-1, 1].forEach((side, i) => {
    const s = i === 0 ? "l" : "r";
    const hip = p.hipJoints[i];
    const knee = bend(hip, p.knees[i], p.feet[i]);
    out[`thigh_${s}`] = span(hip, p.knees[i], knee, chest);
    out[`shin_${s}`] = span(p.knees[i], p.feet[i], knee, chest);
    // The foot along its boot's sole, its instep up (`SkierPose.boots`).
    const boot = p.boots[i];
    out[`boot_${s}`] = span(p.feet[i], add(p.feet[i], scale(boot.f, 0.2)), boot.n, up);
    const elbow = bend(p.shoulders[i], p.elbows[i], p.hands[i]);
    out[`upperarm_${s}`] = span(p.shoulders[i], p.elbows[i], elbow, scale(chest, -1));
    out[`forearm_${s}`] = span(p.elbows[i], p.hands[i], elbow, scale(chest, -1));
    // THE HALF BONES: at every hip, knee, shoulder and elbow, a bone turned
    // half way between the two it joins — the skin across the joint rides
    // it, so a fold past a right angle spreads over the joint rather than
    // collapsing where the two bones' weights meet.
    // THE HAND, CLOSED ROUND THE POLE'S GRIP: its +z up the shaft (from the
    // basket to the fist), its +y the forearm's line squared to it — so the
    // pole runs through the fist whatever the stroke does to it, the wrist
    // turning to hold it. A thrown skier's hand has let go: it lies along
    // the forearm.
    const fore = out[`forearm_${s}`];
    const pole = p.poles?.[i];
    if (pole) {
      const zz = norm(sub(p.hands[i], pole));
      let yy = sub(fore.y, scale(zz, dot(fore.y, zz)));
      yy = dot(yy, yy) < 1e-8 ? fore.z : norm(yy);
      out[`hand_${s}`] = { head: p.hands[i], x: cross(yy, zz), y: yy, z: zz, length: 0.08 };
    } else {
      out[`hand_${s}`] = { ...fore, head: p.hands[i], length: 0.08 };
    }
    if (!halves) return;
    out[`hip_${s}`] = halfway("pelvis", `thigh_${s}`, out, hip);
    out[`knee_${s}`] = halfway(`thigh_${s}`, `shin_${s}`, out, p.knees[i]);
    out[`shoulder_${s}`] = halfway("chest", `upperarm_${s}`, out, p.shoulders[i]);
    out[`elbow_${s}`] = halfway(`upperarm_${s}`, `forearm_${s}`, out, p.elbows[i]);
  });
  return out;
}

/** The pose the model is bound in: the stance on the move, the skis flat
 * and straight, the poles hanging. */
export const STANDING: SkierPoseInput = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 5,
  bump: 0,
};
/** The bound pose, by the name the Blender driver and the lab read it. */
export const RIDING = STANDING;

/** What the engine reports at a moment of a clip's program. */
type Reading = {
  steer?: number;
  lean?: number;
  /** The tuck the body is in, 0..1. */
  crouch?: number;
  /** A pole plant in hand, 0..1. */
  plant?: number;
  airborne?: boolean;
  /** The pair's climb, m/s — what kicks the body on its legs. */
  vy?: number;
  trick?: TrickPose;
  /** How far into the trick's pose, 0..1. */
  blend?: number;
};

const ease = (u: number) => {
  const k = Math.max(0, Math.min(1, u));
  return k * k * (3 - 2 * k);
};
/** In over `a..b` s, out over `c..d` s. */
const held = (t: number, a: number, b: number, c: number, d: number) =>
  ease((t - a) / (b - a)) * (1 - ease((t - c) / (d - c)));

/** THE CLIPS' PROGRAMS: seconds, and the readings at `t`. The carve hangs
 * the hips as far inside as the reference pair lets them. */
const PROGRAMS: { name: string; seconds: number; at: (t: number) => Reading }[] = [
  {
    name: "ride",
    seconds: 2,
    at: (t) => ({
      vy: 0.35 * Math.sin(2 * Math.PI * 2.5 * t) + 0.2 * Math.sin(2 * Math.PI * 6 * t),
    }),
  },
  { name: "carve", seconds: 3, at: (t) => ({ steer: Math.sin((2 * Math.PI * t) / 3) }) },
  { name: "lean", seconds: 2, at: (t) => ({ lean: Math.sin(Math.PI * t) }) },
  { name: "tuck", seconds: 2.4, at: (t) => ({ crouch: held(t, 0.2, 0.7, 1.7, 2.2) }) },
  {
    name: "plant",
    seconds: 2,
    at: (t) => ({ plant: t % 1 < 0.5 ? 1 : 0, crouch: 0 }),
  },
  {
    name: "jump",
    seconds: 2.4,
    at: (t) =>
      t < 0.4 ? {} : t < 1.4 ? { airborne: true, vy: 3 - 9 * (t - 0.4), lean: 0.25 } : { vy: 0 },
  },
  ...(["daffy", "spread", "grab"] as TrickPose[]).map((trick) => ({
    name: trick,
    seconds: 1.6,
    at: (t: number): Reading => ({ airborne: true, trick, blend: held(t, 0.15, 0.4, 1.1, 1.35) }),
  })),
];

function mix(a: SkierPose, b: SkierPose, k: number): SkierPose {
  const v = (p: V3, q: V3): V3 => ({
    x: p.x + (q.x - p.x) * k,
    y: p.y + (q.y - p.y) * k,
    z: p.z + (q.z - p.z) * k,
  });
  const pair = (p: [V3, V3], q: [V3, V3]): [V3, V3] => [v(p[0], q[0]), v(p[1], q[1])];
  const n = (p: number, q: number) => p + (q - p) * k;
  return {
    hips: v(a.hips, b.hips),
    hipJoints: pair(a.hipJoints, b.hipJoints),
    waist: v(a.waist, b.waist),
    neck: v(a.neck, b.neck),
    head: v(a.head, b.head),
    pitch: n(a.pitch, b.pitch),
    roll: n(a.roll, b.roll),
    headRoll: n(a.headRoll, b.headRoll),
    knees: pair(a.knees, b.knees),
    feet: pair(a.feet, b.feet),
    boots: [0, 1].map((i) => ({
      f: norm(v(a.boots[i].f, b.boots[i].f)),
      n: norm(v(a.boots[i].n, b.boots[i].n)),
    })) as SkierPose["boots"],
    shoulders: pair(a.shoulders, b.shoulders),
    elbows: pair(a.elbows, b.elbows),
    hands: pair(a.hands, b.hands),
    poles: a.poles && b.poles ? pair(a.poles, b.poles) : (b.poles ?? a.poles),
    look: n(a.look, b.look),
  };
}

/** Every clip's poses, `fps` a second, off the game's own pose and spring. */
export function skierClips(fps = 30): { name: string; seconds: number; poses: SkierPose[] }[] {
  return PROGRAMS.map(({ name, seconds, at }) => {
    const legs = createSkierSpring();
    const first = at(0);
    // Settled on the first moment before the clip starts.
    for (let i = 0; i < 2 * fps; i++) {
      stepSkierSpring(legs, first.vy ?? 0, !!first.airborne, 1 / fps);
    }
    const poses: SkierPose[] = [];
    for (let f = 0; f <= Math.round(seconds * fps); f++) {
      const r = at(f / fps);
      stepSkierSpring(legs, r.vy ?? 0, !!r.airborne, 1 / fps);
      const steer = r.steer ?? 0;
      const lean = r.lean ?? 0;
      const input: SkierPoseInput = {
        hipRight: steer * SKIS.hipReach,
        hipAft: lean * 0.2,
        lean,
        steer,
        edge: steer * 0.8,
        crouch: r.crouch ?? 0,
        plant: r.plant ?? 0,
        airborne: !!r.airborne,
        landing: 5,
        bump: legs.bump,
      };
      const plain = skierPose(input);
      poses.push(
        r.trick ? mix(plain, skierPose({ ...input, trick: r.trick }), r.blend ?? 1) : plain,
      );
    }
    return { name, seconds, poses };
  });
}
/** The clips by the name the Blender driver reads them. */
export const riderClips = skierClips;

export type SkierRig = {
  pose(p: SkierPose): void;
  play(name: string, t: number): void;
  clips: string[];
  /** A clip's length, s. */
  seconds(name: string): number;
};

/** A loaded model's bones set to the game's pose, or its clips played. */
export function rigSkier(root: THREE.Object3D, animations: THREE.AnimationClip[]): SkierRig {
  const bones = new Map<string, THREE.Object3D>();
  root.traverse((o) => {
    if ((SKIER_BONES as readonly string[]).includes(o.name)) bones.set(o.name, o);
  });
  const mixer = new THREE.AnimationMixer(root);
  const m = new THREE.Matrix4();
  const parentInv = new THREE.Matrix4();
  const v = (a: V3) => new THREE.Vector3(a.x, a.y, a.z);
  return {
    clips: animations.map((c) => c.name),
    seconds: (name) => animations.find((c) => c.name === name)?.duration ?? 0,
    pose(p) {
      mixer.stopAllAction();
      root.updateMatrixWorld(true);
      const frames = skierBones(p);
      // Stated in the model's root frame: the root's world matrix carries it.
      for (const name of SKIER_BONES) {
        const node = bones.get(name);
        if (!node?.parent) continue;
        const f = frames[name];
        m.makeBasis(v(f.x), v(f.y), v(f.z)).setPosition(v(f.head));
        m.premultiply(root.matrixWorld);
        parentInv.copy(node.parent.matrixWorld).invert();
        m.premultiply(parentInv).decompose(node.position, node.quaternion, node.scale);
        node.updateMatrixWorld(true);
      }
    },
    play(name, t) {
      mixer.stopAllAction();
      const clip = animations.find((c) => c.name === name);
      if (!clip) return;
      const action = mixer.clipAction(clip).reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      mixer.setTime(t);
      root.updateMatrixWorld(true);
    },
  };
}
