// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD'S HAND-OFFS, EASED — what keeps an amateur from snapping
// between two frames when what draws him switches: a pose gated on or off
// (a turn's pole plant, the skate begun or stopped, the hockey stop), his
// place moved by the lift that takes or lets him go, his heading turned
// in a step by a queue that lines him up.
//
// The engine's amateur is rough on purpose (`crowd.ts`: a point along his
// line deciding four times a second), so the view is where he is made
// smooth. Each instance keeps what it was asked to be drawn at the last two
// frames — its morph weights, its place and its turn — and each frame the
// new ones are checked against the line through those two. Whatever a
// frame lands OFF that line past what honest motion moves in one frame is
// a JUMP, and the jump is not drawn: it goes into a GAP the figure is drawn
// off by, so where he is drawn runs on through it. The gap is a critically
// damped spring back to nothing (`CROWD_EASE.rate`), so it settles at an
// acceleration no bigger than the jump times the rate squared, and a
// second jump on top of the first only adds to it. Where the frame after
// shows the jump was a change of PACE rather than a step (pulled up dead,
// set off from a standstill, turned into a queue), the gap takes the pace
// too: the figure goes on at the pace he had and eases into the new one.
// Motion that stays on its line is never touched. A jump
// in place past `cut` m is a cut, never a glide across the snow, and an
// instance not drawn for a moment starts afresh. Presentation only;
// three-free, so the suite reads it.

import { mapPosed, type Posed, type V3 } from "./crowd-rig.ts";

/** How the hand-offs are judged and eased. */
export const CROWD_EASE = {
  /** How far off its line a frame may land before the rest is a jump: m of
   * the furthest joint for the weights and the place, rad for the turn. */
  weight: 0.015,
  place: 0.03,
  turn: 0.05,
  /** Up and down the place is judged this much looser, m: a landing's stop
   * on the snow is honest, and a figure carried on into the snow is not. */
  rise: 0.1,
  /** How fast a gap closes, 1/s, for the weights, the place and the turn:
   * the spring's natural rate (most of a gap gone in 4 / rate s). */
  rate: { weight: 13, place: 8, turn: 8 },
  /** A frame this long after the last starts the instance afresh, s. */
  gap: 0.25,
  /** A jump in place past this is a cut, m. */
  cut: 4,
};

/** Every instance's memory: what it was asked to be drawn at the last two
 * frames (`raw`, `raw0`) and the gap it is drawn off by, with how fast the
 * gap is closing — a weight a slot, then the place (three), then the turn
 * (three: a rotation vector). */
export type CrowdEase = {
  width: number;
  /** The channels an instance carries: its weights, the place, the turn. */
  stride: number;
  t: Float64Array;
  step: Float32Array;
  /** The channels (1 the weights, 2 the place, 4 the turn) whose line is
   * being learnt afresh — just after a jump, or a start — so the next
   * frame sets its pace rather than being judged by it. */
  learn: Uint8Array;
  /** The pace the place (three) and the turn (three) had before a jump,
   * per s — set beside the learn bit (8 the place, 16 the turn), so the
   * frame after can tell a step from a change of pace. */
  before: Float64Array;
  raw: Float64Array;
  raw0: Float64Array;
  rawQ: Float64Array;
  rawQ0: Float64Array;
  gap: Float64Array;
  pace: Float64Array;
};

export function createCrowdEase(count: number, width: number): CrowdEase {
  const stride = width + 6;
  return {
    width,
    stride,
    t: new Float64Array(count).fill(-Infinity),
    step: new Float32Array(count),
    learn: new Uint8Array(count),
    before: new Float64Array(count * 6),
    raw: new Float64Array(count * (width + 3)),
    raw0: new Float64Array(count * (width + 3)),
    rawQ: new Float64Array(count * 4),
    rawQ0: new Float64Array(count * 4),
    gap: new Float64Array(count * stride),
    pace: new Float64Array(count * stride),
  };
}

// Quaternions as [x, y, z, w].
type Q = [number, number, number, number];
const qAt = (a: Float64Array, o: number): Q => [a[o], a[o + 1], a[o + 2], a[o + 3]];
const qMul = (a: Q, b: Q): Q => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qInv = (a: Q): Q => [-a[0], -a[1], -a[2], a[3]];
/** The rotation vector of `a` (its axis times its angle), the short way. */
function qLog(a: Q): V3 {
  const s = a[3] < 0 ? -1 : 1;
  const half = Math.acos(Math.min(1, a[3] * s));
  const sin = Math.sin(half);
  if (sin < 1e-9) return [0, 0, 0];
  const f = (2 * half * s) / sin;
  return [a[0] * f, a[1] * f, a[2] * f];
}
/** The rotation of the rotation vector `v`. */
function qExp(v: V3): Q {
  const angle = Math.hypot(v[0], v[1], v[2]);
  if (angle < 1e-12) return [0, 0, 0, 1];
  const f = Math.sin(angle / 2) / angle;
  return [v[0] * f, v[1] * f, v[2] * f, Math.cos(angle / 2)];
}

/** One frame of a critically damped spring at `rate` for slot `j`. */
function settle(e: CrowdEase, j: number, rate: number, dt: number): void {
  const g = e.gap[j];
  const v = e.pace[j];
  if (g === 0 && v === 0) return;
  const k = Math.exp(-rate * dt);
  const b = v + rate * g;
  const ng = (g + b * dt) * k;
  const nv = (v - rate * b * dt) * k;
  const quiet = Math.abs(ng) < 1e-6 && Math.abs(nv) < 1e-5;
  e.gap[j] = quiet ? 0 : ng;
  e.pace[j] = quiet ? 0 : nv;
}

/** The frame after a jump, its line found to run at `change` per s more
 * than it ran before: a change of pace, not a step — the gap at slot `j`
 * takes it, so the figure goes on at the pace he had and eases into the
 * new one rather than changing pace in a frame. */
function carryPace(e: CrowdEase, j: number, change: number, dt: number): void {
  e.gap[j] -= change * dt;
  e.pace[j] -= change;
}

/**
 * Instance `i` drawn at `t`: `w` (its morph weights, `e.width` of them),
 * `p` (its place) and `q` (its turn, a unit quaternion) are what this
 * frame would draw him at, and are written over with what he IS drawn at —
 * every jump off their line carried in the gap. `reach` is how far each
 * weight's target moves his furthest joint, m.
 */
export function easeCrowd(
  e: CrowdEase,
  i: number,
  t: number,
  w: Float32Array,
  reach: Float32Array,
  p: number[],
  q: number[],
): void {
  const W = e.width;
  const ro = i * (W + 3);
  const go = i * e.stride;
  const qo = i * 4;
  const dt = t - e.t[i];
  if (!(dt >= 0 && dt <= CROWD_EASE.gap)) {
    // Afresh: nothing carried, and a line standing still.
    for (let k = 0; k < W; k++) e.raw[ro + k] = e.raw0[ro + k] = w[k];
    for (let k = 0; k < 3; k++) e.raw[ro + W + k] = e.raw0[ro + W + k] = p[k];
    for (let k = 0; k < 4; k++) e.rawQ[qo + k] = e.rawQ0[qo + k] = q[k];
    e.gap.fill(0, go, go + e.stride);
    e.pace.fill(0, go, go + e.stride);
    e.step[i] = 0;
    e.learn[i] = 7;
    e.t[i] = t;
    return;
  }
  const on = dt > 0 && e.step[i] > 0 ? dt / e.step[i] : 0;
  const R = CROWD_EASE.rate;
  if (dt > 0)
    for (let k = 0; k < e.stride; k++) {
      settle(e, go + k, k < W ? R.weight : k < W + 3 ? R.place : R.turn, dt);
    }
  const learn = e.learn[i];
  if (dt > 0) e.learn[i] = 0;
  /** How far slot `j` asked for `now` lands off its line — or, while the
   * line is learnt, off where it last was (`still`). */
  const line = (j: number, now: number, still = false): number => {
    const r = e.raw[ro + j];
    return now - (still ? r : r + (r - e.raw0[ro + j]) * on);
  };
  // THE WEIGHTS: how far off its line the frame lands, as the joints move.
  if (dt > 0) {
    let off = 0;
    // A pose's line is mostly still: just after a jump it is judged
    // against where it was, so a switch hard on another is still caught.
    const still = (learn & 1) !== 0;
    for (let k = 0; k < W; k++) off += Math.abs(line(k, w[k], still)) * reach[k];
    const jump = off > CROWD_EASE.weight;
    if (jump) e.learn[i] |= 1;
    for (let k = 0; k < W; k++) {
      const d = jump ? line(k, w[k], still) : 0;
      e.gap[go + k] -= d;
      // After a jump the line stands where he is asked to be.
      const was = e.raw[ro + k];
      e.raw[ro + k] = w[k];
      e.raw0[ro + k] = jump ? w[k] : was;
    }
  }
  for (let k = 0; k < W; k++) w[k] = Math.max(0, w[k] + e.gap[go + k]);

  // THE PLACE.
  if (dt > 0) {
    const d = [0, 1, 2].map((k) => line(W + k, p[k]));
    const off = Math.hypot(d[0], d[1], d[2]);
    const jump =
      (learn & 2) === 0 &&
      (Math.hypot(d[0], d[2]) > CROWD_EASE.place || Math.abs(d[1]) > CROWD_EASE.rise) &&
      off < CROWD_EASE.cut;
    if (off >= CROWD_EASE.cut) for (let k = 0; k < 3; k++) e.gap[go + W + k] = 0;
    for (let k = 0; k < 3; k++) {
      const j = ro + W + k;
      const was = e.raw[j];
      if (jump) {
        e.gap[go + W + k] -= d[k];
        e.before[i * 6 + k] = e.step[i] > 0 ? (was - e.raw0[j]) / e.step[i] : 0;
      } else if (learn & 8) carryPace(e, go + W + k, (p[k] - was) / dt - e.before[i * 6 + k], dt);
      e.raw[j] = p[k];
      e.raw0[j] = was;
    }
    if (jump) e.learn[i] |= 2 | 8;
  }
  for (let k = 0; k < 3; k++) p[k] += e.gap[go + W + k];

  // THE TURN: the same, with rotation vectors for the jumps and the gap.
  let raw: Q = [q[0], q[1], q[2], q[3]];
  if (dt > 0) {
    const last = qAt(e.rawQ, qo);
    // Kept on one hemisphere, so the line is the short way round.
    const dot = raw[0] * last[0] + raw[1] * last[1] + raw[2] * last[2] + raw[3] * last[3];
    if (dot < 0) raw = [-raw[0], -raw[1], -raw[2], -raw[3]];
    const per = qLog(qMul(last, qInv(qAt(e.rawQ0, qo))));
    const pace = qExp([per[0] * on, per[1] * on, per[2] * on]);
    const d = qLog(qMul(raw, qInv(qMul(pace, last))));
    const jump = (learn & 4) === 0 && Math.hypot(d[0], d[1], d[2]) > CROWD_EASE.turn;
    if (jump) {
      for (let k = 0; k < 3; k++) {
        e.gap[go + W + 3 + k] -= d[k];
        e.before[i * 6 + 3 + k] = e.step[i] > 0 ? per[k] / e.step[i] : 0;
      }
      e.learn[i] |= 4 | 16;
    } else if (learn & 16) {
      const now = qLog(qMul(raw, qInv(last)));
      for (let k = 0; k < 3; k++)
        carryPace(e, go + W + 3 + k, now[k] / dt - e.before[i * 6 + 3 + k], dt);
    }
    for (let k = 0; k < 4; k++) {
      e.rawQ0[qo + k] = last[k];
      e.rawQ[qo + k] = raw[k];
    }
  }
  const g: V3 = [e.gap[go + W + 3], e.gap[go + W + 4], e.gap[go + W + 5]];
  const drawn = qMul(qExp(g), raw);
  for (let k = 0; k < 4; k++) q[k] = drawn[k];

  if (dt > 0) e.step[i] = dt;
  e.t[i] = t;
}

/** Every point of a pose, in a fixed order. */
function pointsOfPosed(p: Posed): V3[] {
  const out: V3[] = [];
  mapPosed(p, (q) => {
    out.push(q);
    return q;
  });
  return out;
}

/** HOW FAR EACH TARGET MOVES THE FIGURE: for each target after the stance
 * (`targets[0]`), the furthest any of its joints stands from the stance's,
 * m — what a weight's change is judged by. */
export function targetReach(targets: readonly Posed[], width: number): Float32Array {
  const out = new Float32Array(width);
  const base = pointsOfPosed(targets[0]);
  for (let k = 1; k < targets.length && k <= width; k++) {
    let most = 0;
    pointsOfPosed(targets[k]).forEach((q, j) => {
      const b = base[j];
      most = Math.max(most, Math.hypot(q[0] - b[0], q[1] - b[1], q[2] - b[2]));
    });
    out[k - 1] = most;
  }
  return out;
}

/** THE FIGURE AT ITS WEIGHTS as joints: the stance and each target blended
 * as the GPU blends them (`targets[0]` the stance, then one a weight). */
export function posedAt(targets: readonly Posed[], w: ArrayLike<number>): Posed {
  const base = targets[0];
  const all = targets.map(pointsOfPosed);
  let j = 0;
  return mapPosed(base, (q) => {
    const out: V3 = [q[0], q[1], q[2]];
    for (let k = 1; k < all.length; k++) {
      const s = w[k - 1];
      if (s === 0) continue;
      const t = all[k][j];
      out[0] += (t[0] - q[0]) * s;
      out[1] += (t[1] - q[1]) * s;
      out[2] += (t[2] - q[2]) * s;
    }
    j++;
    return out;
  });
}

/** A pose in a figure's own frame put in the world: turned by `q` (a unit
 * quaternion [x, y, z, w]), mirrored across his own x by `mirror`, at `p`. */
export function placePosed(
  pose: Posed,
  p: ArrayLike<number>,
  q: ArrayLike<number>,
  mirror: number,
): Posed {
  const [x, y, z, w] = [q[0], q[1], q[2], q[3]];
  return mapPosed(pose, (v) => {
    const vx = v[0] * mirror;
    const vy = v[1];
    const vz = v[2];
    // v + 2w(q×v) + 2q×(q×v)
    const tx = 2 * (y * vz - z * vy);
    const ty = 2 * (z * vx - x * vz);
    const tz = 2 * (x * vy - y * vx);
    return [
      p[0] + vx + w * tx + (y * tz - z * ty),
      p[1] + vy + w * ty + (z * tx - x * tz),
      p[2] + vz + w * tz + (x * ty - y * tx),
    ];
  });
}

/** Every point of `a` against the same point of `b` (and `c`), by `f`. */
export function zipPosed(a: Posed, b: Posed, f: (p: V3, q: V3, r: V3) => V3, c: Posed = b): Posed {
  const bs = pointsOfPosed(b);
  const cs = pointsOfPosed(c);
  let j = 0;
  return mapPosed(a, (p) => {
    const out = f(p, bs[j], cs[j]);
    j++;
    return out;
  });
}

/** The furthest any point of a gap reaches, m. */
export function widestOf(gap: Posed): number {
  return Math.max(...pointsOfPosed(gap).map((v) => Math.hypot(v[0], v[1], v[2])));
}
