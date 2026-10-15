// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANIMATION LAB'S MEASURE (`make anim`): everything a drawn rider's
// animation can be read for, frame by frame, off the SAMPLES the jolt lab's
// reader hands in (`jolt-rider.mjs`: `{ t, joints: { name: {x,y,z} },
// phase, axes?, bike? }`, every joint in his body frame — x his right, y
// up, z forward — so the physics' own turn and travel are not in it).
//
//   ANGLES     each joint's bend as a coach reads it, degrees: the knees,
//              hips, ankles, elbows and shoulders, the trunk's pitch and
//              roll, the shoulders' twist over the hips, the head's pitch
//              and yaw — and how fast each turns and how hard (deg/s,
//              deg/s²). An angle that jumps reads as a SNAP of its own.
//   JOLT       each joint's second difference as an acceleration, m/s²
//              (`jolt-measure.mjs`, the jolt lab's own verdict), and its
//              JERK, the third difference, m/s³ — how smooth a motion is.
//   STRETCH    each limb's span against its own middle length: a bone
//              that grows or shrinks between frames is a rig or a solver
//              pulling a joint where the limb cannot reach.
//   CLIPS      a limb through another or through the body: the knees or
//              the boots through each other, a hand or an elbow inside the
//              trunk.
//
// Pure: no drawing, no engine — numbers in, numbers out.

import { SNAP_MOST, joltVerdict } from "./jolt-measure.mjs";

const DEG = 180 / Math.PI;

/** The default line an angle's acceleration snaps past, deg/s². A knee
 * through a deep landing peaks near ten thousand; a pose switched for a
 * frame at 60 Hz is twenty degrees in a sixtieth, seventy thousand. */
export const ANGLE_SNAP = 25000;

/** A bone's span may wander this far off its middle length before it is
 * read as stretched, as a share. */
export const STRETCH_MOST = 0.03;

/** The skeleton as drawn: each span a pair of joints (the heads of the
 * dressed skin's bones and the far ends `.tip` the reader adds). */
export const SPANS = [
  ["pelvis", "chest", "spine"],
  ["chest", "head", "neck"],
  ["head", "head.tip", "head"],
  ["pelvis", "thigh_l", "hip_l"],
  ["pelvis", "thigh_r", "hip_r"],
  ["thigh_l", "shin_l", "thigh_l"],
  ["shin_l", "boot_l", "shin_l"],
  ["boot_l", "boot_l.tip", "foot_l"],
  ["thigh_r", "shin_r", "thigh_r"],
  ["shin_r", "boot_r", "shin_r"],
  ["boot_r", "boot_r.tip", "foot_r"],
  ["chest", "upperarm_l", "collar_l"],
  ["chest", "upperarm_r", "collar_r"],
  ["upperarm_l", "forearm_l", "upperarm_l"],
  ["forearm_l", "hand_l", "forearm_l"],
  ["hand_l", "hand_l.tip", "hand_l"],
  ["upperarm_r", "forearm_r", "upperarm_r"],
  ["forearm_r", "hand_r", "forearm_r"],
  ["hand_r", "hand_r.tip", "hand_r"],
  ["pole_l", "pole_l.top", "pole_l"],
  ["pole_r", "pole_r.top", "pole_r"],
];

/** The spans whose length is held (a pole and a collar may move with the
 * grip and the shrug, every limb's bone must not). */
const HELD = new Set([
  "thigh_l",
  "shin_l",
  "foot_l",
  "thigh_r",
  "shin_r",
  "foot_r",
  "upperarm_l",
  "forearm_l",
  "upperarm_r",
  "forearm_r",
  "head",
]);

/** Which side a joint or a span is on, for the picture's colour. */
export const sideOf = (name) => (/_l(\.|$)/.test(name) ? "l" : /_r(\.|$)/.test(name) ? "r" : "c");

/** The ends of him whose paths are traced. */
export const TIPS = ["head.tip", "hand_l.tip", "hand_r.tip", "boot_l.tip", "boot_r.tip"];

/** THE ANGLES, a group a chart: each `{ id, say, group, of(sample) }`, in
 * degrees, null where the joints it needs are not drawn. */
export const ANGLES = [
  ...["l", "r"].flatMap((s) => [
    {
      id: `knee_${s}`,
      say: `knee ${s}`,
      group: "legs",
      pair: (j) => [sub(j[`shin_${s}`], j[`thigh_${s}`]), sub(j[`boot_${s}`], j[`shin_${s}`])],
    },
    {
      id: `hip_${s}`,
      say: `hip ${s}`,
      group: "legs",
      pair: (j) => [sub(j.pelvis, j.chest), sub(j[`shin_${s}`], j[`thigh_${s}`])],
    },
    {
      id: `ankle_${s}`,
      say: `ankle ${s}`,
      group: "legs",
      pair: (j) => [sub(j[`shin_${s}`], j[`boot_${s}`]), sub(j[`boot_${s}.tip`], j[`boot_${s}`])],
    },
  ]),
  ...["l", "r"].flatMap((s) => [
    {
      id: `elbow_${s}`,
      say: `elbow ${s}`,
      group: "arms",
      pair: (j) => [
        sub(j[`forearm_${s}`], j[`upperarm_${s}`]),
        sub(j[`hand_${s}`], j[`forearm_${s}`]),
      ],
    },
    {
      id: `shoulder_${s}`,
      say: `shoulder ${s}`,
      group: "arms",
      pair: (j) => [sub(j.pelvis, j.chest), sub(j[`forearm_${s}`], j[`upperarm_${s}`])],
    },
    {
      // The upper arm out to his side off the trunk's plane, deg: a coach's
      // "elbows in" — near 0 tucked to the ribs, 90 a wing held level.
      id: `abduct_${s}`,
      say: `elbow out ${s}`,
      group: "arms",
      of: (j) => {
        const sh = j[`upperarm_${s}`];
        const el = j[`forearm_${s}`];
        if (!sh || !el) return null;
        const d = sub(el, sh);
        const l = Math.hypot(d.x, d.y, d.z);
        const out = s === "r" ? d.x : -d.x;
        return l > 1e-6 ? Math.asin(Math.max(-1, Math.min(1, out / l))) * DEG : null;
      },
    },
    {
      id: `wrist_${s}`,
      say: `wrist ${s}`,
      group: "arms",
      pair: (j) => [
        sub(j[`hand_${s}`], j[`forearm_${s}`]),
        sub(j[`hand_${s}.tip`], j[`hand_${s}`]),
      ],
    },
  ]),
  {
    id: "trunk_pitch",
    say: "trunk pitch",
    group: "trunk",
    of: (j) => lean(j.pelvis, j.head, "z"),
  },
  {
    id: "trunk_roll",
    say: "trunk roll",
    group: "trunk",
    of: (j) => lean(j.pelvis, j.head, "x"),
  },
  {
    id: "twist",
    say: "shoulders over hips",
    group: "trunk",
    of: (j) => {
      const h = yawOf(j.thigh_l, j.thigh_r);
      const s = yawOf(j.upperarm_l, j.upperarm_r);
      return h === null || s === null ? null : wrap(s - h);
    },
  },
  {
    id: "hips_yaw",
    say: "hips yaw",
    group: "trunk",
    of: (j) => yawOf(j.thigh_l, j.thigh_r),
  },
  {
    id: "head_pitch",
    say: "head pitch",
    group: "head",
    of: (j, a) => (a?.head ? Math.atan2(a.head.y, Math.hypot(a.head.x, a.head.z)) * DEG : null),
  },
  {
    id: "head_yaw",
    say: "head yaw",
    group: "head",
    of: (j, a) => flatYaw(a?.head),
  },
  {
    id: "head_on_chest",
    say: "head off the chest",
    group: "head",
    of: (j, a) => {
      const h = flatYaw(a?.head);
      const c = flatYaw(a?.chest);
      return h === null || c === null ? null : wrap(h - c);
    },
  },
  {
    id: "hips_height",
    say: "hips height (cm)",
    group: "head",
    of: (j) =>
      j.pelvis && j["boot_l"] && j["boot_r"]
        ? (j.pelvis.y - (j.boot_l.y + j.boot_r.y) / 2) * 100
        : null,
  },
];

export const ANGLE_GROUPS = [
  { id: "legs", say: "legs: knee, hip and ankle bends (deg, 0 straight)" },
  {
    id: "arms",
    say: "arms: elbow, shoulder (arm off the trunk), elbow out (to the side) and wrist (deg)",
  },
  {
    id: "trunk",
    say: "trunk: pitch (+ forward), roll (+ right), the twist and the hips' yaw (deg)",
  },
  {
    id: "head",
    say: "head: pitch (+ up), yaw (+ right), off the chest (deg); the hips over the boots (cm)",
  },
];

/** Every number the lab reads off `samples`, and the scene's verdict. */
export function measure(samples, opts = {}) {
  const most = opts.most ?? SNAP_MOST;
  const angleMost = opts.angleMost ?? ANGLE_SNAP;
  const stretchMost = opts.stretchMost ?? STRETCH_MOST;
  const t = samples.map((s) => s.t);

  // ANGLES and how they move.
  const angles = {};
  for (const a of ANGLES) {
    const v = a.pair
      ? signedBends(samples.map((s) => a.pair(s.joints)))
      : samples.map((s) => {
          const x = a.of(s.joints, s.axes);
          return x === null || !Number.isFinite(x) ? null : x;
        });
    if (v.every((x) => x === null)) continue;
    // Every angle is read round its circle (a lean or a bend past 180°
    // comes back the other side, a turn of nothing) — all but the hips'
    // height, which is no angle.
    const rate = diff(t, a.id === "hips_height" ? v : unwrap(v));
    const accel = diff(t, rate);
    angles[a.id] = { id: a.id, say: a.say, group: a.group, v, rate, accel };
  }
  let angleWorst = { a: 0, id: "", t: 0 };
  const angleSnaps = [];
  for (const g of Object.values(angles)) {
    g.accel.forEach((x, k) => {
      if (x === null) return;
      const m = Math.abs(x);
      if (m > angleWorst.a) angleWorst = { a: m, id: g.id, t: t[k] };
      if (m > angleMost) angleSnaps.push({ a: m, id: g.id, t: t[k] });
    });
  }
  angleSnaps.sort((x, y) => y.a - x.a);

  // JOLT (the jolt lab's verdict) and each joint's jolt and jerk a frame.
  const jolt = joltVerdict(samples, most);
  const names = Object.keys(samples[0]?.joints ?? {});
  const perJoint = {};
  for (const n of names) perJoint[n] = jointSeries(samples, n);
  let jerkSum = 0;
  let jerkN = 0;
  for (const s of Object.values(perJoint)) {
    for (const x of s.jerk) {
      if (x === null) continue;
      jerkSum += x * x;
      jerkN++;
    }
  }

  // STRETCH: each held span's length against its middle.
  const stretch = {};
  let stretchWorst = { a: 0, id: "", t: 0 };
  for (const [a, b, id] of SPANS) {
    const len = samples.map((s) => {
      const p = s.joints[a];
      const q = s.joints[b];
      return p && q ? Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) : null;
    });
    const known = len.filter((x) => x !== null).sort((x, y) => x - y);
    if (known.length < 3) continue;
    const mid = known[known.length >> 1];
    const share = len.map((x) => (x === null || mid < 1e-6 ? null : x / mid - 1));
    stretch[id] = { id, held: HELD.has(id), mid, share };
    if (!HELD.has(id)) continue;
    share.forEach((x, k) => {
      if (x !== null && Math.abs(x) > stretchWorst.a)
        stretchWorst = { a: Math.abs(x), id, t: t[k] };
    });
  }

  // CLIPS: a limb through another or through the trunk.
  const clips = [];
  samples.forEach((s, k) => {
    const j = s.joints;
    for (const c of clipsOf(j)) clips.push({ ...c, t: t[k], phase: s.phase });
  });
  const clipKinds = {};
  for (const c of clips) clipKinds[c.kind] = (clipKinds[c.kind] ?? 0) + 1;

  // THE TIPS' speeds, m/s.
  const speeds = {};
  for (const n of TIPS) if (perJoint[n]) speeds[n] = perJoint[n].speed;

  return {
    t,
    phases: samples.map((s) => s.phase ?? ""),
    angles,
    angleWorst,
    angleSnaps,
    jolt,
    perJoint,
    jerkRms: jerkN ? Math.sqrt(jerkSum / jerkN) : 0,
    elbowOut: elbowOutOf(angles),
    stretch,
    stretchWorst,
    stretchMost,
    clips,
    clipKinds,
    speeds,
    most,
    angleMost,
  };
}

/** How far out the elbows ride, deg: the 90th percentile over every frame
 * of the wider arm's `abduct` — a wing held for a stroke shows, a frame's
 * flick does not. */
function elbowOutOf(angles) {
  const l = angles.abduct_l?.v ?? [];
  const r = angles.abduct_r?.v ?? [];
  const wide = l
    .map((x, k) => Math.max(x ?? -Infinity, r[k] ?? -Infinity))
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b);
  return wide.length ? Math.round(wide[Math.floor(wide.length * 0.9)]) : 0;
}

/** The verdict a table row and the JSON carry. */
export function verdictOf(m) {
  return {
    frames: m.t.length,
    snapShare: m.jolt.share,
    worstJolt: Math.round(m.jolt.worst.a),
    worstJoint: m.jolt.worst.joint,
    worstAt: round2(m.jolt.worst.t),
    pops: m.jolt.pops,
    angleSnaps: m.angleSnaps.length,
    worstAngle: Math.round(m.angleWorst.a),
    worstAngleId: m.angleWorst.id,
    worstAngleAt: round2(m.angleWorst.t),
    stretch: Math.round(m.stretchWorst.a * 1000) / 10,
    stretchBone: m.stretchWorst.id,
    clips: m.clips.length,
    clipKinds: m.clipKinds,
    jerkRms: Math.round(m.jerkRms),
    elbowOut: m.elbowOut,
  };
}

/** Whether a scene's verdict is clean: no snaps, no pops, no angle snaps,
 * no stretched limb, no clip. */
export function cleanOf(v, m) {
  return (
    v.snapShare === 0 &&
    v.pops === 0 &&
    v.angleSnaps === 0 &&
    v.stretch <= m.stretchMost * 100 &&
    v.clips === 0
  );
}

// ---- the parts ----------------------------------------------------------

const round2 = (x) => Math.round(x * 100) / 100;
const sub = (a, b) => (a && b ? { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z } : null);
const len = (a) => Math.hypot(a.x, a.y, a.z);
/** A facing's yaw about his up, degrees — none while it points within 60°
 * of straight up or down (a chest folded over a flip), where the yaw of
 * what is left of it swings round in a frame and reads as a snap the
 * figure never made. */
const flatYaw = (v) => (v && Math.hypot(v.x, v.z) > 0.5 ? Math.atan2(v.x, v.z) * DEG : null);

const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

/** A joint's bend frame by frame, degrees, SIGNED: the angle between each
 * frame's two directions, its sign held to the side its bend first lay
 * to (the cross product of the two, tracked frame to frame). An unsigned
 * bend is a V wherever a joint swings through straight — a cusp of the
 * measure, not of the joint, which reads as a snap it never made; signed,
 * a joint through straight is a smooth curve through zero. */
function signedBends(pairs) {
  let n = null;
  return pairs.map((p) => {
    if (!p || !p[0] || !p[1]) return null;
    const x = between(p[0], p[1]);
    if (x === null) return null;
    const c = cross(p[0], p[1]);
    const lc = len(c) / (len(p[0]) * len(p[1]));
    if (!n) {
      if (lc > 1e-3) n = c;
      return x;
    }
    const sign = c.x * n.x + c.y * n.y + c.z * n.z < 0 ? -1 : 1;
    if (lc > 0.05) n = sign > 0 ? c : { x: -c.x, y: -c.y, z: -c.z };
    return sign * x;
  });
}

const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** The angle between two directions, degrees. */
function between(a, b) {
  if (!a || !b) return null;
  const la = len(a);
  const lb = len(b);
  if (la < 1e-6 || lb < 1e-6) return null;
  const c = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}

/** The trunk's lean from plumb toward +z (`axis` z) or +x, degrees. */
function lean(from, to, axis) {
  const v = sub(to, from);
  if (!v) return null;
  return Math.atan2(v[axis], v.y) * DEG;
}

/** The yaw of the line from a left joint to its right one, degrees (0
 * square to his travel). */
function yawOf(l, r) {
  const v = sub(r, l);
  if (!v || Math.hypot(v.x, v.z) < 1e-6) return null;
  return Math.atan2(-v.z, v.x) * DEG;
}

/** Degrees laid end to end with no ±180 wrap, so a rate across it is true. */
function unwrap(v) {
  const out = [];
  let prev = null;
  let add = 0;
  for (const x of v) {
    if (x === null) {
      out.push(null);
      continue;
    }
    if (prev !== null) {
      const d = x + add - prev;
      if (d > 180) add -= 360;
      else if (d < -180) add += 360;
    }
    prev = x + add;
    out.push(prev);
  }
  return out;
}

/** A series' derivative by central differences, null where unknown or
 * where the samples are more than a tenth of a second apart. */
function diff(t, v) {
  return v.map((_, k) => {
    const a = v[k - 1];
    const b = v[k + 1];
    if (a === null || b === null || a === undefined || b === undefined) return null;
    const h = t[k + 1] - t[k - 1];
    return h > 0 && h < 0.2 ? (b - a) / h : null;
  });
}

/** A joint's speed (m/s), jolt (m/s²) and jerk (m/s³), a value a frame. */
function jointSeries(samples, name) {
  const p = samples.map((s) => s.joints[name] ?? null);
  const t = samples.map((s) => s.t);
  const vel = p.map((_, k) => {
    const a = p[k - 1];
    const b = p[k + 1];
    if (!a || !b) return null;
    const h = t[k + 1] - t[k - 1];
    return h > 0 && h < 0.2 ? { x: (b.x - a.x) / h, y: (b.y - a.y) / h, z: (b.z - a.z) / h } : null;
  });
  const acc = vel.map((_, k) => {
    const a = vel[k - 1];
    const b = vel[k + 1];
    if (!a || !b) return null;
    const h = t[k + 1] - t[k - 1];
    return h > 0 && h < 0.2 ? { x: (b.x - a.x) / h, y: (b.y - a.y) / h, z: (b.z - a.z) / h } : null;
  });
  const jerk = acc.map((_, k) => {
    const a = acc[k - 1];
    const b = acc[k + 1];
    if (!a || !b) return null;
    const h = t[k + 1] - t[k - 1];
    return h > 0 && h < 0.2 ? Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / h : null;
  });
  // The jolt as the jolt lab reads it: the second difference a frame.
  const jolt = p.map((_, k) => {
    const a = p[k - 1];
    const b = p[k];
    const c = p[k + 1];
    if (!a || !b || !c) return null;
    const h = (t[k + 1] - t[k - 1]) / 2;
    if (!(h > 0 && h < 0.1)) return null;
    return Math.hypot(a.x - 2 * b.x + c.x, a.y - 2 * b.y + c.y, a.z - 2 * b.z + c.z) / (h * h);
  });
  return {
    speed: vel.map((v) => (v ? len(v) : null)),
    jolt,
    jerk,
  };
}

/** How near two points may come before they are one through the other, m. */
const NEAR = { knees: 0.07, boots: 0.07, hand: 0.09, elbow: 0.09 };

/** The distance from `p` to the segment a → b, m. */
function toSegment(p, a, b) {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const l2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  const k = l2 > 0 ? Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y + ap.z * ab.z) / l2)) : 0;
  return Math.hypot(ap.x - ab.x * k, ap.y - ab.y * k, ap.z - ab.z * k);
}

/** The clips in one frame's joints. */
function clipsOf(j) {
  const out = [];
  const d = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : Infinity);
  if (d(j.shin_l, j.shin_r) < NEAR.knees) out.push({ kind: "knees", d: d(j.shin_l, j.shin_r) });
  if (d(j.boot_l, j.boot_r) < NEAR.boots) out.push({ kind: "boots", d: d(j.boot_l, j.boot_r) });
  if (j.pelvis && j.chest) {
    for (const s of ["l", "r"]) {
      const hand = j[`hand_${s}`];
      const elbow = j[`forearm_${s}`];
      if (hand && toSegment(hand, j.pelvis, j.chest) < NEAR.hand) {
        out.push({ kind: `hand ${s} in trunk`, d: toSegment(hand, j.pelvis, j.chest) });
      }
      if (elbow && toSegment(elbow, j.pelvis, j.chest) < NEAR.elbow) {
        out.push({ kind: `elbow ${s} in trunk`, d: toSegment(elbow, j.pelvis, j.chest) });
      }
    }
  }
  return out;
}
