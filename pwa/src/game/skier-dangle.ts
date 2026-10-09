// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEGS DANGLING OFF A HELICOPTER'S SKID — the skier sat on the skid
// (`heli.ts`, posed by `skier-seat.ts`) with his skis on and his legs
// hanging, and those legs moved by everything the machine does to them.
// Three-free, so the suite reads it; presentation only.
//
// EACH LEG IS A DAMPED PENDULUM hung at the knee: the shank, the foot in
// its boot and the ski with its binding, swung fore and aft (`pitch`, the
// knee opening and closing) and to the side (`side`, the thigh rolled about
// its own length, which swings the hanging shin across). Two angles off the
// body's down, so the shin points along
//
//     d = (cos θ sin φ, −cos θ cos φ, sin θ)
//
// (θ the foot forward, φ to his right), and each is driven by Lagrange's
// generalised force of everything pulling on the leg, Q = L·(F·∂d/∂q):
//
//   * GRAVITY, AS THE LEG FEELS IT: g less the seat's own acceleration, in
//     his body frame (`Perch.gravity`). Hanging in the hover, the legs hang
//     plumb; the machine noses down or banks and they swing to stay hanging
//     down; it accelerates and they swing back, brakes and they swing
//     forward, climbs hard and they hang heavier.
//   * THE AIR past him (`Perch.air`: the weather's wind at his height and
//     the rotor's downwash, less his own velocity — and less the leg's own
//     swing, so the air damps it too), as a drag on three areas in the
//     leg's own frame: across it (the shin's side and the ski's edge), along
//     the shin (the ski's base and the boot's sole) and from ahead (the
//     shin's front, the boot and the ski's tip). At 150 km/h the dynamic
//     pressure is some 900 Pa and the push on a leg is about its weight:
//     the legs trail back 40° and more, the skis streaming edge-on.
//     TURBULENCE rides on it — a few slow, incommensurate waves off the
//     clock, a tenth of the flow at most, never `Math.random`.
//   * HIS OWN LEGS: a passive stiffness and a damping at the knee and the
//     hip (a relaxed leg's pendulum test settles in a couple of swings),
//     his idle — a slow swing of the feet, out of step — and, now and then,
//     a KICK off a hash of the clock.
//   * THE STOPS: the knee never opens past straight, the shins never swing
//     back through the skid tube behind them, the thigh's roll ends at the
//     hip's, and the two boots never pass through each other.
//
// THE ROTOR'S SHAKE is laid on at the end, never integrated: the blade
// passage (three blades at 390 rpm, 19.5 Hz at full spool) and the
// once-a-turn beat, read off the rotor's own angle, a few milliradians in
// the legs and a little more in each ski about its binding — as much as a
// pendulum 0.6 Hz slow would ever answer a 20 Hz shake with, which is
// nearly nothing, so it is drawn as the airframe's buzz carried into the
// skis rather than solved for.
//
// THE TWO LEGS ARE NOT TWINS: the right one is a little heavier in the
// swing (`DANGLE.detune`), so they drift out of phase and back.
//
// On the snow the skis rest on it: the whole dangle is weighted by how far
// they hang free (`Perch.hanging`, off the engine's `HeliState.hang`), so a
// machine settling onto its skids lays them down and one lifting off lets
// them go.
//
// A STILL (a screenshot draws at dt 0, so nothing steps) is skied too: the
// legs are run over the last few seconds before its clock at its perch, so
// a still at any moment shows the legs where that moment's swing has them.
//
// The swing reaches the figure and the skis through one function,
// `swingLegs`: the seated pose's lower legs turned about the knees (and the
// knees a little about the hips), and each ski moved and turned by as much
// as its boot (`SkiSwing`) — what `skis-body.ts` lays on the stand both the
// code's skis and the model's are posed off, and `skier-seat.ts` on the
// figure, so a boot never leaves its ski.

import type { SkierPose } from "./skier-joints.ts";
import { CUFF } from "./skier-limbs.ts";
import type { Mounts } from "./skier-mounts.ts";
import type { V3 } from "./skier-vec.ts";

/** WHAT THE DANGLE IS HANDED for a frame — the helicopter's skid and the
 * air about it, in the skier's own body frame (x right, y up, z forward). */
export type Perch = {
  /** The skid's top in his body frame, m (minus the engine's
   * `HeliState.hang`) — where the seated pose sits him. */
  y: number;
  /** The gravity his legs feel, m/s²: g less the seat's acceleration. */
  gravity: V3;
  /** The air past him, m/s: the wind and the downwash less his velocity. */
  air: V3;
  /** The rotor's share of its rpm, 0..1, and its turn, rad. */
  spool: number;
  rotor: number;
  /** How far his skis hang free, 0 (on the snow) … 1. */
  hanging: number;
  /** The engine's clock, s. */
  t: number;
  /** THE UPPER BODY'S (`skier-perch.ts`): the world's up in his body
   * frame, how far he hangs off the tube by his hands, 0..1, and the share
   * of his weight they carry — left out where nothing hangs him. */
  up?: V3;
  hung?: number;
  load?: number;
};

/** THE LEGS AS DRAWN, per leg: the shin's angles off his body's down, rad
 * (the foot forward, the foot to his right), how much of them is drawn
 * (0..1), and the rotor's shake on top — in the leg (`buzz`, fore-aft and
 * across, rad) and in the ski about its binding (`flap`, tips up, rad). */
export type LegSwing = {
  pitch: number;
  side: number;
  weight: number;
  buzz: { pitch: number; side: number };
  flap: number;
};

/** EACH SKI MOVED WITH ITS BOOT, body frame: its binding's base moved
 * (m) and the ski turned about it — `pitch` tips up, `rock` right edge down
 * (rad), taken in that order: R = Rz(−rock)·Rx(−pitch), the leg's roll
 * after its swing. */
export type SkiSwing = { dx: number; dy: number; dz: number; pitch: number; rock: number };

/** THE LEG AS A PENDULUM, and everything that moves it. */
export const DANGLE = {
  /** Below the knee — the shank (4.7 % of an 80 kg man), the foot (1.5 %),
   * the boot (1.8 kg) and the ski with its binding (2.5 kg): kg, and its
   * centre of mass from the knee, m. */
  mass: 9.2,
  reach: 0.36,
  /** Its moment about the knee, kg m²: swung fore and aft the ski's length
   * swings with it (its own m l²/12 over 1.75 m and more); swung across, the
   * ski turns about its length and adds little. */
  inertia: { pitch: 2.1, side: 1.5 },
  /** Where the air's push acts, m from the knee — the boot and the ski
   * carry most of the area. */
  press: 0.46,
  /** The drag areas, Cd·A, m², in the leg's own frame: across it (the
   * shin's side and the ski's edge), along the shin (the ski's base and the
   * boot's sole), from ahead (the shin, the boot and the ski's tip). */
  drag: { across: 0.1, along: 0.19, ahead: 0.09 },
  /** The air's density, kg/m³ (the helicopter's own, `docs/helicopter.md`). */
  rho: 1.0,
  /** A relaxed knee's and hip's passive stiffness toward plumb, N m/rad,
   * and the damping, N m s/rad (a damping ratio near 0.15 at the leg's
   * 0.65 Hz). */
  stiffness: 4,
  damping: 2.6,
  /** The right leg's moments over the left's — the two drift out of step. */
  detune: 1.09,
  /** THE STOPS, rad off his body's down: the foot forward to a near
   * straight knee; back until the shins meet the skid tube behind them;
   * across as far as the hip rolls the thigh; and how far the two feet may
   * close on each other across (the right's side less the left's) before
   * the boots touch. The stops' stiffness, N m/rad, damping, N m s/rad,
   * and how far past a stop they give before it is a wall, rad. */
  forward: 1.3,
  back: -0.32,
  across: 0.7,
  close: -0.16,
  stop: { stiffness: 260, damping: 16, give: 0.06 },
  /** The knee lifted by the thigh, as a share of the shin's swing forward. */
  thigh: 0.14,
  /** THE TURBULENCE: the waves' periods, s, and the most each moves the
   * flow, as a share of its speed. */
  gusts: { periods: [1.7, 0.83, 0.47, 0.29] as const, share: 0.1 },
  /** HIS IDLE: the slow swing's period, s, and its torque, N m — faded by
   * the wind (`idleWind`, m/s) — and the kick: a slot's length, s, the
   * share of slots with one, how long it lasts, s, and its torque, N m. */
  idle: { period: 3.1, torque: 3.2, idleWind: 18 },
  kick: { slot: 3.4, chance: 0.4, length: 0.45, torque: 15 },
  /** HUNG OFF HIS HANDS (`Perch.hung`), the legs STRUGGLE: his own torque
   * raised by `torque` times over and his idle and kicks run `pace` times
   * faster — kicking for a skid he cannot reach. */
  struggle: { torque: 4, pace: 2.5 },
  /** THE ROTOR'S SHAKE at full spool, rad: the blade passage in the leg
   * and in the ski about its binding, and the once-a-turn beat in the leg;
   * how far translational lift's buffet (around `buffetAt` m/s) adds. */
  shake: { leg: 0.006, ski: 0.018, rev: 0.004, buffet: 0.6, buffetAt: 14 },
  /** The longest substep the swing is integrated in, s, and the seconds a
   * still is skied over. */
  substep: 1 / 240,
  settle: 4,
};

/** How far a hanging boot's sole is tipped up off square to the shin, rad
 * — the cuff's least forward lean (`CUFF`), which a relaxed foot in a stiff
 * boot sits at. */
export const BOOT_LEAN = CUFF.least;

type Leg = { pitch: number; side: number; vp: number; vs: number };

/** The dangle's state between frames. */
export type Dangle = {
  legs: [Leg, Leg];
  /** The clock it was last stepped to, s; NaN until it has been. */
  t: number;
};

const freshLeg = (): Leg => ({ pitch: 0, side: 0, vp: 0, vs: 0 });

export function createDangle(): Dangle {
  return { legs: [freshLeg(), freshLeg()], t: Number.NaN };
}

/** Back to hanging still — off the skid, ready for the next ride. */
export function resetDangle(d: Dangle): void {
  d.legs[0] = freshLeg();
  d.legs[1] = freshLeg();
  d.t = Number.NaN;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A small integer hash, 0..1 — the kicks' dice, off the clock's slot. */
function hash01(n: number, salt: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** The turbulence on axis `axis` of leg `leg` at `t`, −1..1. */
function gust(t: number, leg: number, axis: number): number {
  const P = DANGLE.gusts.periods;
  let sum = 0;
  for (let k = 0; k < P.length; k++) {
    const phase = (leg * 2.399 + axis * 1.618 + k * 0.937) * Math.PI;
    sum += Math.sin((2 * Math.PI * t) / P[k] + phase) / (k + 1.5);
  }
  return sum;
}

/** HIS OWN TORQUE on leg `leg` at `t`, N m, fore-aft: the idle swing,
 * faded by the wind `wind` (m/s), and any kick. */
export function idleTorque(t: number, leg: number, wind: number): number {
  const I = DANGLE.idle;
  const K = DANGLE.kick;
  const fade = 1 / (1 + (wind / I.idleWind) ** 2);
  let tau = I.torque * fade * Math.sin((2 * Math.PI * t) / I.period + leg * 2.2);
  // A kick: one slot in a few, on one leg, at a moment in the slot.
  const slot = Math.floor(t / K.slot);
  if (hash01(slot, 1) < K.chance && (hash01(slot, 2) < 0.5 ? 0 : 1) === leg) {
    const at = hash01(slot, 3) * (K.slot - K.length);
    const u = (t - slot * K.slot - at) / K.length;
    if (u > 0 && u < 1) tau += K.torque * Math.sin(Math.PI * u) ** 2;
  }
  return tau;
}

/** One substep of `h` s for leg `i` at clock `t`. */
function stepLeg(L: Leg, i: number, p: Perch, t: number, h: number): void {
  const D = DANGLE;
  const tune = i === 1 ? D.detune : 1;
  const Ip = D.inertia.pitch * tune;
  const Is = D.inertia.side * tune;
  const ct = Math.cos(L.pitch);
  const st = Math.sin(L.pitch);
  const cs = Math.cos(L.side);
  const ss = Math.sin(L.side);
  // The shin's way down, and its derivatives: ∂d/∂θ is also the ski's
  // forward, ∂d/∂φ / cos θ its across.
  const dx = ct * ss;
  const dy = -ct * cs;
  const dz = st;
  const px = -st * ss;
  const py = st * cs;
  const pz = ct;
  const sx = ct * cs;
  const sy = ct * ss;
  // The air past the boot and the ski, less the leg's own swing there,
  // with the turbulence on it.
  const flow = Math.hypot(p.air.x, p.air.y, p.air.z);
  const g = D.gusts.share * flow;
  const ax = p.air.x + g * gust(t, i, 0) - D.press * (px * L.vp + sx * L.vs);
  const ay = p.air.y + g * gust(t, i, 1) - D.press * (py * L.vp + sy * L.vs);
  const az = p.air.z + g * gust(t, i, 2) - D.press * (pz * L.vp);
  const speed = Math.hypot(ax, ay, az);
  const ex = cs;
  const ey = ss;
  const k = 0.5 * D.rho * speed;
  const uAcross = ax * ex + ay * ey;
  const uAlong = ax * dx + ay * dy + az * dz;
  const uAhead = ax * px + ay * py + az * pz;
  const fx =
    k * (D.drag.across * uAcross * ex + D.drag.along * uAlong * dx + D.drag.ahead * uAhead * px);
  const fy =
    k * (D.drag.across * uAcross * ey + D.drag.along * uAlong * dy + D.drag.ahead * uAhead * py);
  const fz = k * (D.drag.along * uAlong * dz + D.drag.ahead * uAhead * pz);
  // Weight and air as generalised forces about the knee.
  const w = D.mass * D.reach;
  let qp = w * (p.gravity.x * px + p.gravity.y * py + p.gravity.z * pz);
  qp += D.press * (fx * px + fy * py + fz * pz);
  let qs = w * (p.gravity.x * sx + p.gravity.y * sy);
  qs += D.press * (fx * sx + fy * sy);
  // Hung off his hands, he kicks for the skid (`DANGLE.struggle`).
  const fight = 1 + D.struggle.torque * (p.hung ?? 0);
  qp += idleTorque(t * (1 + D.struggle.pace * (p.hung ?? 0)), i, flow) * fight;
  qp += -D.stiffness * L.pitch - D.damping * L.vp;
  qs += -D.stiffness * L.side - D.damping * L.vs;
  // The stops.
  const S = D.stop;
  if (L.pitch > D.forward) qp -= S.stiffness * (L.pitch - D.forward) + S.damping * L.vp;
  if (L.pitch < D.back) qp -= S.stiffness * (L.pitch - D.back) + S.damping * L.vp;
  if (Math.abs(L.side) > D.across) {
    qs -= S.stiffness * (L.side - Math.sign(L.side) * D.across) + S.damping * L.vs;
  }
  L.vp += (qp / Ip) * h;
  L.vs += (qs / Is) * h;
  L.pitch += L.vp * h;
  L.side += L.vs * h;
  // ...and past the stops' give, a hard wall: the tube and the knee do not
  // bend however hard the air pushes.
  const give = S.give;
  if (L.pitch < D.back - give) {
    L.pitch = D.back - give;
    L.vp = Math.max(0, L.vp);
  } else if (L.pitch > D.forward + give) {
    L.pitch = D.forward + give;
    L.vp = Math.min(0, L.vp);
  }
  if (Math.abs(L.side) > D.across + give) {
    L.side = Math.sign(L.side) * (D.across + give);
    L.vs = L.side > 0 ? Math.min(0, L.vs) : Math.max(0, L.vs);
  }
}

/** The two boots kept off each other: the right's swing across less the
 * left's never closes past `DANGLE.close`. */
function keepApart(d: Dangle, h: number): void {
  const [l, r] = d.legs;
  const gap = r.side - l.side - DANGLE.close;
  if (gap >= 0) return;
  const S = DANGLE.stop;
  const push = (-S.stiffness * gap - S.damping * Math.min(0, r.vs - l.vs)) * h;
  r.vs += push / (DANGLE.inertia.side * DANGLE.detune);
  l.vs -= push / DANGLE.inertia.side;
}

/** Run the legs from `from` to `to` s at the perch `p`. */
function run(d: Dangle, p: Perch, from: number, to: number): void {
  const n = Math.max(1, Math.ceil((to - from) / DANGLE.substep));
  const h = (to - from) / n;
  for (let k = 0; k < n; k++) {
    const t = from + (k + 1) * h;
    stepLeg(d.legs[0], 0, p, t, h);
    stepLeg(d.legs[1], 1, p, t, h);
    keepApart(d, h);
  }
}

/** STEP THE LEGS by a frame of `dt` s at the perch `p`. Never stepped (a
 * still), they are skied over the seconds before `p.t` from hanging still,
 * so the still shows that moment's swing. */
export function stepDangle(d: Dangle, p: Perch, dt: number): void {
  if (dt > 0) {
    if (Number.isNaN(d.t)) resetDangle(d);
    run(d, p, p.t - Math.min(dt, 0.1), p.t);
    d.t = p.t;
    return;
  }
  // A still: held where the live swing left it, or skied up to its clock.
  if (!Number.isNaN(d.t)) return;
  resetDangle(d);
  run(d, p, p.t - DANGLE.settle, p.t);
}

/** THE SWING AS DRAWN for the frame: the legs' angles, how much of them
 * the hanging allows, and the rotor's shake on top. */
export function swingOf(d: Dangle, p: Perch): [LegSwing, LegSwing] {
  const S = DANGLE.shake;
  const flow = Math.hypot(p.air.x, p.air.y, p.air.z);
  const buffet = 1 + S.buffet * Math.exp(-(((flow - S.buffetAt) / 6) ** 2));
  const amp = p.spool * p.spool * buffet;
  const w = clamp(p.hanging, 0, 1);
  return d.legs.map((L, i) => {
    const blade = 3 * p.rotor;
    return {
      pitch: L.pitch,
      side: L.side,
      weight: w,
      buzz: {
        pitch: amp * (S.leg * Math.sin(blade + i * 1.9) + S.rev * Math.sin(p.rotor + i)),
        side: amp * S.leg * 0.7 * Math.sin(blade + 0.8 + i * 2.6),
      },
      flap: amp * S.ski * Math.sin(blade + 0.4 + i * 1.3),
    };
  }) as [LegSwing, LegSwing];
}

/** The angles of a shin pointing along `d` (unit), rad. */
function anglesOf(d: V3): { pitch: number; side: number } {
  return { pitch: Math.asin(clamp(d.z, -1, 1)), side: Math.atan2(d.x, -d.y) };
}

/** `v` turned by `a` about x (+y toward +z is negative). */
function rx(a: number, v: V3): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

/** `v` turned by `a` about z (+x toward +y). */
function rz(a: number, v: V3): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}

const plus = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const minus = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const times = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });

/**
 * THE SEATED POSE WITH ITS LEGS SWUNG: each lower leg — the shin, the
 * boot and the ski on it — hung from its knee at the swing's angles (as
 * far as `weight` draws it off the seated pose's own, plus the rotor's
 * buzz), the boot held to the shin at its cuff's forward lean (`lean`, the
 * least the boot allows — a relaxed foot in a stiff boot), so a plumb shin
 * hangs its ski a little tips up; the knee carried up and down a little
 * about the hip (`DANGLE.thigh`), the hands resting on the thighs carried
 * with it. Each ski's move with its boot comes back beside the pose
 * (`skis`): its binding moved by as much as the boot's sole, the ski
 * turned by as much as the boot, and the rotor's flap on the ski alone.
 */
export function swingLegs(
  p: SkierPose,
  swing: readonly [LegSwing, LegSwing],
  M: Mounts,
  lean = BOOT_LEAN,
): { pose: SkierPose; skis: [SkiSwing, SkiSwing] } {
  const cuff = M.foot.y - M.ground;
  const knees = [...p.knees] as [V3, V3];
  const feet = [...p.feet] as [V3, V3];
  const boots = [...p.boots] as SkierPose["boots"];
  const hands = [...p.hands] as [V3, V3];
  const elbows = [...p.elbows] as [V3, V3];
  const poles = p.poles ? ([...p.poles] as [V3, V3]) : null;
  const skis = [0, 1].map((i) => {
    const s = swing[i];
    const w = clamp(s.weight, 0, 1);
    const H = p.hipJoints[i];
    const K = p.knees[i];
    const F = p.feet[i];
    const b = p.boots[i];
    const shin = minus(F, K);
    const length = Math.hypot(shin.x, shin.y, shin.z) || 1;
    const rest = anglesOf(times(shin, 1 / length));
    // The shin's angles as drawn: the seated pose's, swung toward the
    // pendulum's as far as the skis hang free, and buzzing.
    const pitch = rest.pitch + w * (s.pitch - rest.pitch + s.buzz.pitch);
    const side = rest.side + w * (s.side - rest.side + s.buzz.side);
    // The knee about the hip, lifted as the foot swings forward.
    const K2 = plus(H, rx(-DANGLE.thigh * (pitch - rest.pitch), minus(K, H)));
    const way = {
      x: Math.cos(pitch) * Math.sin(side),
      y: -Math.cos(pitch) * Math.cos(side),
      z: Math.sin(pitch),
    };
    // The boot turned off the seated pose's (stood on its ski) to hang off
    // the shin: tipped up with the shin's swing forward and the cuff's
    // lean, rolled with its swing across.
    const tip = w * (s.pitch + s.buzz.pitch + lean);
    const roll = w * (s.side + s.buzz.side);
    const turn = (v: V3): V3 => rz(roll, rx(-tip, v));
    const sole = plus(times(b.n, cuff), times(b.f, M.foot.z));
    const base = minus(F, sole);
    knees[i] = K2;
    feet[i] = plus(K2, times(way, length));
    boots[i] = { f: turn(b.f), n: turn(b.n) };
    const base2 = minus(feet[i], turn(sole));
    // The hands on the thigh ride its lift.
    const lift = minus(K2, K);
    hands[i] = plus(hands[i], times(lift, 0.7));
    elbows[i] = plus(elbows[i], times(lift, 0.35));
    if (poles) poles[i] = plus(poles[i], times(lift, 0.7));
    return {
      dx: base2.x - base.x,
      dy: base2.y - base.y,
      dz: base2.z - base.z,
      pitch: tip + w * s.flap,
      rock: -roll,
    };
  }) as [SkiSwing, SkiSwing];
  return { pose: { ...p, knees, feet, boots, hands, elbows, poles }, skis };
}
