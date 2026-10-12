// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JOLT LAB'S MEASURE (`make jolt`): how hard a drawn figure's joints
// are flung between frames. A figure is handed in as SAMPLES — one a frame,
// each its time and every joint's place (`{ t, joints: { name: {x,y,z} },
// phase }`) in the frame its family names — and each joint's JOLT is its
// second difference over the samples read as an acceleration, m/s²:
//
//   a = |p(t−h) − 2·p(t) + p(t+h)| / h²
//
// A body moving as a body does stays well under a hundred: a pole swung
// through a plant, a fist through a skate's push, a knee folding into a
// landing. A joint that JUMPS between two frames — a pose switched rather
// than blended, an elbow flipping, a hand-off from one way of drawing him
// to another — reads as thousands: at the engine's 120 Hz a centimetre's
// jump in one frame is 144 m/s². Over `most` (150 by default) a frame is a
// SNAP; the lab's answer is the snaps going away.

/** The default line a frame's worst joint must stay under, m/s². */
export const SNAP_MOST = 150;

/** A POP: a joint thrown out of line for a frame and back — two jolts past
 * the line one after the other, the second turned back against the first
 * by more than this cosine. A swing however fast bends its path the same
 * way frame after frame, and a landing's stop is one jolt and done; only a
 * point drawn somewhere for a frame (or a step and back) reads both ways at
 * once. */
const POP_TURN = -0.5;

/** Frames closer than this apart are one SNAP event, s. */
const EVENT_GAP = 0.06;

/** Every frame's worst joint, its jolt and the phase it was drawn in.
 * Frames more than `gap` s apart (a cut, a reset of the clock) are not
 * read across. */
export function joltsOf(samples, gap = 0.1, most = SNAP_MOST) {
  const out = [];
  /** Each joint's last second difference, to read a pop against. */
  let was = null;
  for (let k = 1; k + 1 < samples.length; k++) {
    const [p, q, r] = [samples[k - 1], samples[k], samples[k + 1]];
    const h = (r.t - p.t) / 2;
    if (h <= 0 || h > gap) {
      was = null;
      continue;
    }
    let top = 0;
    let at = "";
    let pop = 0;
    let popAt = "";
    const now = {};
    for (const j of Object.keys(q.joints)) {
      const a = p.joints[j];
      const b = q.joints[j];
      const c = r.joints[j];
      if (!a || !c) continue;
      const d = {
        x: (a.x - 2 * b.x + c.x) / (h * h),
        y: (a.y - 2 * b.y + c.y) / (h * h),
        z: (a.z - 2 * b.z + c.z) / (h * h),
      };
      now[j] = d;
      const v = Math.hypot(d.x, d.y, d.z);
      if (v > top) [top, at] = [v, j];
      const e = was?.[j];
      if (!e || v <= most) continue;
      const u = Math.hypot(e.x, e.y, e.z);
      if (u <= most || (d.x * e.x + d.y * e.y + d.z * e.z) / (u * v) > POP_TURN) continue;
      if (Math.min(u, v) > pop) [pop, popAt] = [Math.min(u, v), j];
    }
    was = now;
    out.push({ t: q.t, a: top, joint: at, phase: q.phase ?? "", pop, popAt });
  }
  return out;
}

/** A scene's verdict: the share of frames over `most`, the worst frame,
 * the POPS (frames a joint is flung out of line and back) and the worst,
 * each joint's worst, and the SNAP EVENTS — runs of frames over the line
 * merged, each its peak — worst first. */
export function joltVerdict(samples, most = SNAP_MOST) {
  const jolts = joltsOf(samples, 0.1, most);
  let pops = 0;
  let worstPop = { a: 0, joint: "", t: 0, phase: "" };
  let bad = 0;
  let worst = { a: 0, joint: "", t: 0, phase: "" };
  const byJoint = {};
  const events = [];
  let open = null;
  for (const f of jolts) {
    if (f.a > worst.a) worst = f;
    if (f.pop > 0) pops++;
    if (f.pop > worstPop.a) worstPop = { a: f.pop, joint: f.popAt, t: f.t, phase: f.phase };
    byJoint[f.joint] = Math.max(byJoint[f.joint] ?? 0, f.a);
    if (f.a <= most) continue;
    bad++;
    if (open && f.t - open.end <= EVENT_GAP) {
      open.end = f.t;
      open.frames++;
      if (f.a > open.a) Object.assign(open, { a: f.a, joint: f.joint, t: f.t, phase: f.phase });
    } else {
      open = { ...f, start: f.t, end: f.t, frames: 1 };
      events.push(open);
    }
  }
  events.sort((x, y) => y.a - x.a);
  return {
    frames: samples.length,
    share: jolts.length ? bad / jolts.length : 0,
    worst,
    pops,
    worstPop,
    events,
    byJoint,
    jolts,
  };
}

/** Joints out of a pose's named points: every value with x, y and z (an
 * array of them named `name0`, `name1`, …) — what a family hands in when
 * its figure is a plain object of points. */
export function pointsOf(pose, skip = []) {
  const out = {};
  for (const [k, v] of Object.entries(pose)) {
    if (skip.includes(k) || v === null || typeof v !== "object") continue;
    if (Array.isArray(v)) {
      v.forEach((p, i) => {
        if (p && typeof p.x === "number") out[`${k}${i}`] = p;
      });
    } else if (typeof v.x === "number" && typeof v.y === "number") out[k] = v;
  }
  return out;
}
