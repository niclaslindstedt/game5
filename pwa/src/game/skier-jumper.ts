// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMPER AS POSED (R43, `GameState.jump`, drawn by `skis-body.ts`)
// — three-free, so the suite reads it. A jumper is not an alpine skier on
// long skis: he SITS on the bar, rides the in-run folded flat over his
// thighs with his arms back along his body, springs off the table in a
// third of a second, lays himself out over his skis spread in a V with his
// HEELS OFF THEM (the binding holds only the toe), and comes down in a
// TELEMARK. Every phase is a shape of his limbs stated as the joint angles
// the research measured, laid in the SKIS' frame (the engine's `q` is the
// skis' attitude in the tracks and in the air) and built joint by joint,
// the boots hinged at the toe and each ski yawed about its binding for the
// V (`JumperPose.yaw`, which the code's skis and the models both turn by).
//
// The angles, in the sagittal plane of the skis, measured from the ski's
// forward axis (`dir`): the SHIN's lean off the ski, the KNEE's and the
// HIP's inside angles, the HEEL's lift off the ski about the toe, the HEAD
// raised off the trunk's line — and the ARMS as a direction off the trunk.
//
// THE RESEARCH (`docs/freestyle.md` § *Ski jumping*, *What the game
// models*, in our own words; *(est.)* where it is ours):
//   * THE IN-RUN (a 2-D study of 267 top jumpers' in-run on a large hill):
//     the ankle at 54 ± 5° (the shin's lean off the ski), the knee at
//     67 ± 8°, the trunk 12 ± 4° off the track — folded flat over the
//     thighs — the shoulder at ~180° (the arms laid straight back along
//     the body) and the elbow at 166 ± 7°; the head up, looking down the
//     track;
//   * THE TAKE-OFF: an extension of 0.25–0.30 s; from the edge into the
//     early flight the hip opens from 86–109° and the knee from 136 to
//     171°, the arms kept back;
//   * THE FLIGHT (`docs/freestyle.md` § *Ski jumping*): the skis at 20–45°
//     to the air, the body 0–20° above them, the hips near 160°, the legs
//     stretched, the V opened 25–35° (30°), the arms back along the body a
//     little away from it; the heel lifted off the ski *(est. 35°)*, the
//     shin some 15–20° off the ski;
//   * THE LANDING: the head and trunk raised, the arms brought forward, the
//     skis parallel; the TELEMARK — one foot a foot's length ahead of the
//     other, the back knee deeper, its heel up, the arms out — held some
//     10–15 m; then he rises, and on a long jump raises his arms.
// The decision (`jumperShapeOf`) reads the engine's jump and its clock
// alone, so a frame is the same frame twice; nothing here is read by the
// physics, so no digest moves.

import { JUMP, type SkiJumpState } from "@engine";

import type { SkiSwing } from "./skier-dangle.ts";
import type { SkierPose } from "./skier-joints.ts";
import { BODY, SHIN_ABOVE_CUFF, type Mounts } from "./skier-mounts.ts";
import { solveLimb, type Boot } from "./skier-limbs.ts";
import { add, clamp01, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";
import { smooth } from "./skier-stroke.ts";

const D = Math.PI / 180;

/** A PHASE'S SHAPE: angles in degrees (sagittal, off the ski's forward
 * axis), each leg its own `[left, right]`; `fore` each boot moved along
 * its ski, m (a telemark's split); `arm` the arms' direction off the
 * trunk — `rho` from straight back along it (0) through out to the side
 * (90) to overhead (180), `phi` toward his front, `reach` the share of the
 * arm's length the fist stands from the shoulder; `round` the back's
 * rounding, m. */
export type JumperAngles = {
  shin: [number, number];
  knee: [number, number];
  hip: number;
  heel: [number, number];
  fore: [number, number];
  head: number;
  arm: { rho: number; phi: number; reach: number };
  round: number;
};

/** THE JUMPER'S NUMBERS (the research in the header; *(est.)* the rest). */
export const JUMPER = {
  /** SAT ON THE BAR, his hands on it beside his hips *(est.)*. */
  bar: {
    shin: [74, 74],
    knee: [82, 82],
    hip: 58,
    heel: [0, 0],
    fore: [0, 0],
    head: 30,
    arm: { rho: 22, phi: 34, reach: 0.82 },
    round: 0.03,
  } as JumperAngles,
  /** THE IN-RUN CROUCH: the ankle 54°, the knee 67°, the trunk ~15° off
   * the track (the hip what is left), the arms straight back. */
  crouch: {
    shin: [54, 54],
    knee: [67, 67],
    hip: 28,
    heel: [0, 0],
    fore: [0, 0],
    head: 62,
    arm: { rho: 8, phi: 20, reach: 0.97 },
    round: 0.04,
  } as JumperAngles,
  /** AT THE EDGE, the push done: the knee at 136–140°, the hip ~90°, the
   * body thrown forward, the arms still back. */
  takeOff: {
    shin: [62, 62],
    knee: [140, 140],
    hip: 95,
    heel: [6, 6],
    fore: [0, 0],
    head: 55,
    arm: { rho: 12, phi: 14, reach: 0.97 },
    round: 0.02,
  } as JumperAngles,
  /** THE V-STYLE: the shin ~15° off the ski, the knee 172°, the hips 160°,
   * the heel up 35° *(est.)*, the head raised to look down the hill, the
   * arms back along him a little out from his sides and below them. */
  flight: {
    shin: [15, 15],
    knee: [172, 172],
    hip: 160,
    heel: [35, 35],
    fore: [0, 0],
    head: 62,
    arm: { rho: 20, phi: 10, reach: 0.97 },
    round: 0,
  } as JumperAngles,
  /** THE LANDING MADE READY: up out of the V, the knees giving, the arms
   * forward and out *(est.)*. */
  prep: {
    shin: [42, 42],
    knee: [150, 150],
    hip: 140,
    heel: [10, 10],
    fore: [0, 0],
    head: 35,
    arm: { rho: 62, phi: 38, reach: 0.92 },
    round: 0.02,
  } as JumperAngles,
  /** THE TELEMARK: the LEFT foot ahead by a foot's length *(est.: his lead
   * foot)*, its knee at ~115°, the back knee deeper and low over its ski,
   * the back heel up; the trunk raised, the arms out to the sides, a little
   * forward and below the shoulders. */
  telemark: {
    shin: [66, 30],
    knee: [118, 96],
    hip: 128,
    heel: [0, 48],
    fore: [0.16, -0.16],
    head: 15,
    arm: { rho: 66, phi: 36, reach: 0.95 },
    round: 0.02,
  } as JumperAngles,
  /** DOWN ON BOTH FEET side by side, a judge's two points *(est.)*. */
  twoFooted: {
    shin: [60, 60],
    knee: [112, 112],
    hip: 118,
    heel: [0, 0],
    fore: [0, 0],
    head: 18,
    arm: { rho: 70, phi: 34, reach: 0.93 },
    round: 0.03,
  } as JumperAngles,
  /** RISEN on the out-run, riding to the fall line *(est.)*. */
  stand: {
    shin: [70, 70],
    knee: [152, 152],
    hip: 160,
    heel: [0, 0],
    fore: [0, 0],
    head: 4,
    arm: { rho: 30, phi: 22, reach: 0.9 },
    round: 0.02,
  } as JumperAngles,
  /** THE ARMS RAISED on a long jump, fists overhead *(est.)*. */
  cheer: { rho: 158, phi: 14, reach: 0.86 },
  /** THE V's whole opening, rad (25–35°, 30° — each ski half of it). */
  vee: 30 * D,
  /** The boot's toe ahead of its centre, m — the hinge the heel lifts off. */
  toe: 0.15,
  /** The ski behind its binding as a share of its length (the pair's
   * `mount`), and the gap the tails keep in the V, m: the feet are carried
   * apart so the tails close in to it rather than through each other. */
  tailGap: 0.02,
  /** THE CLOCK, s: off the bar into the crouch; the push's 0.28 (the
   * engine's `JUMP.takeOff.push`); the landing's readying; into the
   * telemark at the touch, held, risen; the arms raised and lowered; the
   * layer let go of to the skier's own pose on the out-run. */
  time: {
    settle: 0.55,
    prep: 0.35,
    touch: 0.14,
    hold: 0.9,
    rise: 1.1,
    cheerFrom: 1.6,
    cheerIn: 0.5,
    cheerFor: 3.2,
    fadeFrom: 2.6,
    fade: 1.0,
  },
};

/** WHAT HIS BODY IS DOING this frame: the shape his limbs take, how much of
 * the pose is his (`weight`, 0 the skier's own), the arms raised
 * (`cheer`), the V's half opening, rad, and where his soles stand under
 * his centre of mass in the skis' frame, m (null: where the skier's own
 * pose has them, on the snow). */
export type JumperShape = {
  angles: JumperAngles;
  weight: number;
  cheer: number;
  vee: number;
  soleY: number | null;
};

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const pair = (a: [number, number], b: [number, number], k: number): [number, number] => [
  lerp(a[0], b[0], k),
  lerp(a[1], b[1], k),
];

/** Two shapes mixed, `k` of the way from `a` to `b`. */
export function mixAngles(a: JumperAngles, b: JumperAngles, k: number): JumperAngles {
  return {
    shin: pair(a.shin, b.shin, k),
    knee: pair(a.knee, b.knee, k),
    hip: lerp(a.hip, b.hip, k),
    heel: pair(a.heel, b.heel, k),
    fore: pair(a.fore, b.fore, k),
    head: lerp(a.head, b.head, k),
    arm: {
      rho: lerp(a.arm.rho, b.arm.rho, k),
      phi: lerp(a.arm.phi, b.arm.phi, k),
      reach: lerp(a.arm.reach, b.arm.reach, k),
    },
    round: lerp(a.round, b.round, k),
  };
}

/** Eased share of `x` over `span` from `from`. */
const ease = (x: number, from: number, span: number): number =>
  smooth(clamp01((x - from) / Math.max(1e-6, span)));

/**
 * THE JUMPER'S SHAPE at run time `t` s, off the engine's jump `j` on a
 * hill whose K point is `k` m — or null once he is off his skis (a fall's
 * ragdoll is the crash's) or the layer has been let go of.
 */
export function jumperShapeOf(j: SkiJumpState, t: number, k: number): JumperShape | null {
  const J = JUMPER;
  const T = J.time;
  const push = JUMP.takeOff.push;
  const pushed = j.pressAt >= 0 ? ease(t, j.pressAt, push) : 0;
  const atEdge = mixAngles(J.crouch, J.takeOff, pushed);
  if (j.stage === "bar") {
    return { angles: J.bar, weight: 1, cheer: 0, vee: 0, soleY: -JUMP.bar.seat };
  }
  if (j.stage === "tracks") {
    const off = j.leftAt >= 0 ? ease(t, j.leftAt, T.settle) : 1;
    const angles = mixAngles(J.bar, atEdge, off);
    // The push lifts him off the tracks toward the release's height.
    const soleY = -lerp(JUMP.bar.seat, JUMP.takeOff.release, pushed);
    return { angles, weight: 1, cheer: 0, vee: 0, soleY };
  }
  if (j.stage === "air") {
    const lay = smooth(clamp01(j.lay));
    let angles = mixAngles(atEdge, J.flight, lay);
    // Readying the landing he brings the skis together out of the V (the
    // engine's V is the air's on them, held to the touch; drawn, it closes).
    const ready = j.prepAt >= 0 ? ease(t, j.prepAt, T.prep) : 0;
    angles = mixAngles(angles, J.prep, ready);
    const soleY = -lerp(JUMP.takeOff.release, JUMP.landing.feet, lay);
    const vee = (J.vee / 2) * clamp01(j.vee) * (1 - ready);
    return { angles, weight: 1, cheer: 0, vee, soleY };
  }
  // DOWN: the telemark (or both feet) at the touch, held, then risen.
  const r = j.record;
  if (r.landing === "fall" || r.outcome === "fall") return null;
  const touchAt = j.edgeAt + r.flightTime;
  const since = t - touchAt;
  const landed = r.landing === "twoFooted" ? J.twoFooted : J.telemark;
  const from = j.prepAt >= 0 ? J.prep : J.flight;
  let angles = mixAngles(from, landed, ease(since, 0, T.touch));
  angles = mixAngles(angles, J.stand, ease(since, T.hold, T.rise));
  const long = r.distance >= k && r.outcome !== "touch";
  const cheer = long
    ? ease(since, T.cheerFrom, T.cheerIn) * (1 - ease(since, T.cheerFrom + T.cheerFor, T.cheerIn))
    : 0;
  const weight = 1 - ease(since, T.fadeFrom, T.fade);
  if (weight <= 0 && cheer <= 0) return null;
  return { angles, weight, cheer, vee: 0, soleY: null };
}

/** The ski's forward axis turned `deg` up toward its normal. */
const dir = (deg: number): V3 => ({ x: 0, y: Math.sin(deg * D), z: Math.cos(deg * D) });
const turnY = (v: V3, a: number): V3 => ({
  x: v.x * Math.cos(a) + v.z * Math.sin(a),
  y: v.y,
  z: -v.x * Math.sin(a) + v.z * Math.cos(a),
});
const reach = BODY.upperArm + BODY.forearm;

/** THE POSE MADE OVER FOR THE JUMP: what the jumper's limbs do over `p`
 * (the skier's own pose this frame, the poles let go), each ski's move
 * with its boot (`SkiSwing`: the V's spread, a telemark's split, the soles
 * set where the engine has them) and each ski's yaw for the V, rad
 * (clockwise from above, so the right ski's tip out is positive). `tail`
 * is the ski behind its binding, m. */
export function jumperPose(
  p: SkierPose,
  s: JumperShape,
  M: Mounts,
  tail: number,
): { pose: SkierPose; skis: [SkiSwing, SkiSwing]; yaw: [number, number] } {
  const a = s.angles;
  const cuff = M.foot.y - M.ground;
  const w = clamp01(s.weight);
  const feet: [V3, V3] = [p.feet[0], p.feet[1]];
  const boots: [Boot, Boot] = [p.boots[0], p.boots[1]];
  const yaw: [number, number] = [0, 0];
  const skis = [0, 1].map((i) => {
    const side = i === 0 ? -1 : 1;
    const b = p.boots[i];
    // The sole under the boot's centre, where the skier's pose stood it.
    const base = sub(p.feet[i], add(scale(b.n, cuff), scale(b.f, M.foot.z)));
    const v = s.vee;
    // Spread so the tails close to the gap rather than cross.
    const half = Math.abs(base.x);
    const spread = Math.max(0, tail * Math.sin(v) + JUMPER.tailGap / 2 - half) * side;
    const lift = s.soleY === null ? 0 : s.soleY - base.y;
    const moved = { x: base.x + spread, y: base.y + lift, z: base.z + a.fore[i] };
    const turn = side * v;
    yaw[i] = turn;
    // THE HEEL OFF THE SKI about the toe in its binding.
    const h = a.heel[i] * D;
    const f = turnY({ x: 0, y: -Math.sin(h), z: Math.cos(h) }, turn);
    const n = turnY({ x: 0, y: Math.cos(h), z: Math.sin(h) }, turn);
    const toe = add(moved, turnY({ x: 0, y: 0, z: JUMPER.toe }, turn));
    const sole = sub(toe, scale(f, JUMPER.toe));
    feet[i] = add(sole, add(scale(n, cuff), scale(f, M.foot.z)));
    boots[i] = { f, n };
    return { dx: spread, dy: lift, dz: a.fore[i], pitch: 0, rock: 0 };
  }) as [SkiSwing, SkiSwing];

  // THE LEGS, up from each boot's cuff along the shape's angles.
  const knees0: V3[] = [];
  const hipAt: V3[] = [];
  const thighDeg: number[] = [];
  for (let i = 0; i < 2; i++) {
    const knee = add(feet[i], scale(dir(a.shin[i]), SHIN_ABOVE_CUFF));
    const th = a.shin[i] + 180 - a.knee[i];
    thighDeg.push(th);
    knees0.push(knee);
    hipAt.push(add(knee, scale(dir(th), BODY.thigh)));
  }
  const hips = { x: 0, y: (hipAt[0].y + hipAt[1].y) / 2, z: (hipAt[0].z + hipAt[1].z) / 2 };
  const across = { x: 1, y: 0, z: 0 };
  const hipJoints: [V3, V3] = [
    add(hips, scale(across, -BODY.hip)),
    add(hips, scale(across, BODY.hip)),
  ];
  const trunkDeg = (thighDeg[0] + thighDeg[1]) / 2 - 180 + a.hip;
  const up = dir(trunkDeg);
  const back = dir(trunkDeg + 90);
  const front = scale(back, -1);
  const waist = add(add(hips, scale(up, BODY.spine * 0.42)), scale(back, a.round));
  const neck = add(hips, scale(up, BODY.spine));
  const head = add(neck, scale(dir(trunkDeg + a.head), BODY.neck));
  const shoulderAt = add(sub(neck, scale(up, BODY.shoulderDrop)), scale(front, BODY.shoulderFore));
  const shoulders: [V3, V3] = [
    add(shoulderAt, scale(across, -BODY.shoulder)),
    add(shoulderAt, scale(across, BODY.shoulder)),
  ];
  const armAt = (side: number, arm: JumperAngles["arm"]): V3 => {
    const r = arm.rho * D;
    const f = arm.phi * D;
    const swing = add(scale(up, -Math.cos(r)), scale(across, side * Math.sin(r)));
    return norm(add(scale(swing, Math.cos(f)), scale(front, Math.sin(f))));
  };
  const hands: [V3, V3] = [p.hands[0], p.hands[1]];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    hands[i] = add(shoulders[i], scale(armAt(side, a.arm), reach * a.arm.reach));
  }
  // The head's tilt (the figure reads it off `pitch`, `skier-rig.ts`'s
  // `headAxes`): its crown along the neck's line to it, the face ahead.
  const tilt = (90 - (trunkDeg + a.head)) * D;
  const mine: SkierPose = {
    ...p,
    hips,
    hipJoints,
    waist,
    neck,
    head,
    pitch: (tilt + 0.2) / 0.3,
    roll: 0,
    headRoll: 0,
    knees: [knees0[0], knees0[1]],
    feet,
    boots,
    shoulders,
    elbows: p.elbows,
    hands,
    poles: null,
    look: 0,
    kinks: undefined,
    dropped: undefined,
    grips: undefined,
  };
  // Mixed with the skier's own pose as the layer is let go of — the feet
  // stay the boots' — and the knees and elbows solved between.
  const out: SkierPose =
    w >= 1
      ? mine
      : {
          ...mine,
          hips: mix(p.hips, hips, w),
          hipJoints: [mix(p.hipJoints[0], hipJoints[0], w), mix(p.hipJoints[1], hipJoints[1], w)],
          waist: mix(p.waist, waist, w),
          neck: mix(p.neck, neck, w),
          head: mix(p.head, head, w),
          pitch: lerp(p.pitch, mine.pitch, w),
          headRoll: lerp(p.headRoll, 0, w),
          roll: lerp(p.roll, 0, w),
          shoulders: [mix(p.shoulders[0], shoulders[0], w), mix(p.shoulders[1], shoulders[1], w)],
          hands: [mix(p.hands[0], hands[0], w), mix(p.hands[1], hands[1], w)],
        };
  // THE ARMS RAISED over whatever else he is doing.
  if (s.cheer > 0) {
    const t = norm(sub(out.neck, out.hips));
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const raised = add(
        out.shoulders[i],
        scale(
          norm(add(scale(t, -Math.cos(JUMPER.cheer.rho * D)), scale(across, side * 0.3))),
          reach * JUMPER.cheer.reach,
        ),
      );
      out.hands[i] = mix(out.hands[i], raised, smooth(clamp01(s.cheer)));
    }
  }
  const knees: [V3, V3] = [p.knees[0], p.knees[1]];
  const elbows: [V3, V3] = [p.elbows[0], p.elbows[1]];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    // The knee stands out ahead of the hip-to-cuff line where the shape
    // has it, and a little out over a ski opened into the V.
    const mid = mix(out.hipJoints[i], out.feet[i], 0.5);
    const pole = add(sub(knees0[i], mid), scale(across, side * 0.05));
    knees[i] = solveLimb(out.hipJoints[i], out.feet[i], BODY.thigh, SHIN_ABOVE_CUFF, pole);
    const bend = add(scale(across, side), scale(back, 0.4));
    elbows[i] = solveLimb(out.shoulders[i], out.hands[i], BODY.upperArm, BODY.forearm, bend);
  }
  return { pose: { ...out, knees, elbows }, skis, yaw };
}
