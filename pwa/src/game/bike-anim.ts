// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL RIDER ANIMATED — authored key poses and timed clips on a
// small STATE MACHINE, laid over the attack stance `skier-bike.ts` builds
// off the engine (`riderKey`). The engine's signals pick the state and the
// phase (on the ground or in the air, pedalling, on the levers, a foot out,
// the pop and the touchdown); the keys below make the shape, the way an
// animator times a move:
//
//   READY / ATTACK  the base stance: hips back and up off the saddle, chest
//                   low, elbows and knees bent and out, the cranks LEVEL —
//                   and the outside pedal dropped through a turn
//   PEDAL           the hips rocking over the cranks, twice a turn of them
//   PUMP            the chest folded to the bars as the bike is pushed into
//                   a compression, the arms bent
//   POP             the extension off a lip, then the legs drawn up
//   SPOT            the arms and legs reached for the landing in the last of
//                   the fall
//   LAND            the touchdown absorbed — down fast, held, rising slower
//                   than it fell, a little past the stance, settled
//   BRAKE           braced back and low under the levers, ahead of the stop
//   FOOT OUT        the inside foot lifted off its pedal, swung forward and
//                   down over the dirt, held through the slide, put back
//   WHIP / TABLE    the bike's own turn under him (`bike-ride-style.ts`),
//                   eased in and out, his hips following it late
//
// Every channel is driven to its target through a CRITICALLY DAMPED spring
// (no overshoot of its own: an overshoot is a key), so a state switched
// never pops — the curves ease, and the one-shot clips carry the
// anticipation and the follow-through. Feet and hands stay on the pedals and
// grips as drawn, by the limbs' own reach (`party-pose.ts`).
//
// THE MEMORY: an animator a bike (`animatedStyle` keeps one for each
// `BikeState` it sees), stepped by the run's own clock — so the same frames
// give the same drawing in the game, the labs and a replay. A clock that
// goes back or leaps starts it afresh. Presentation only: the engine is
// never told, so no digest moves.
//
// Three-free and DOM-free, so the suite and the motion lab read it.

import { RAGDOLL, type BikePose, type BikeState, type Level } from "@engine";

import { fallLeft, rideStyleOf, type RideStyle } from "./bike-ride-style.ts";
import { keyPoints } from "./party-pose.ts";
import { drawnBikePose } from "./rider-follow.ts";
import { ATTACK, freerideKey } from "./skier-bike.ts";

/** THE BODY CHANNELS the animator drives, laid onto the freerider's key
 * (`skier-bike.ts`'s `freerideKey`) as offsets: the hips in the bike's
 * frame (m: x his right, y up, z ahead), the trunk's bend, roll and twist
 * and the head's nod (rad), the knees and elbows out, and the foot out
 * (0..1, which foot). */
export type BodyAnim = {
  hipX: number;
  hipY: number;
  hipZ: number;
  pitch: number;
  roll: number;
  twist: number;
  nod: number;
  kneesOut: number;
  elbowsOut: number;
  /** The engine's pop crouch, eased (`riderKey` bends him by it). */
  crouch: number;
};

/** THE ANIMATED STYLE: the freerider's style with the bike's turn eased,
 * the foot out timed, the cranks as drawn and the body's offsets. */
export type AnimatedStyle = RideStyle & {
  body: BodyAnim;
  crank: number;
  /** How far the cranks are driven by his own stroke, 0..1. */
  pedal: number;
};

/** A key on a clip's timeline: its time, s, and the channels it sets. */
type ClipKey = [number, Partial<BodyAnim>];

/** THE KEY POSES. Offsets from the engine's stance, m and rad. */
export const KEYS = {
  /** The attack stance the whole ride is built on: off the saddle, the
   * hips back and up so the legs are long but not locked, the chest low
   * but the arms long enough to steer (elbows ~120°). */
  attack: {
    hipX: 0,
    hipY: 0.09,
    hipZ: -0.12,
    pitch: -0.14,
    nod: 0.06,
    kneesOut: 0.05,
    elbowsOut: 0.1,
  },
  /** Stood still and ready: taller, the weight central. */
  ready: { hipY: 0.04, hipZ: -0.02, pitch: -0.08, nod: 0.06 },
  /** Through a turn: the hips dropped to the inside of the bike and low,
   * the outside elbow up. */
  turn: { hipY: 0.01, hipX: -0.08, kneesOut: 0.12, elbowsOut: 0.15 },
  /** Under the levers: back and down, the arms straighter. */
  brake: { hipY: -0.05, hipZ: -0.07, pitch: -0.02, nod: 0.12, elbowsOut: 0.05 },
  /** Pushed into a compression: the chest to the bars. */
  pump: { pitch: 0.08, elbowsOut: 0.2, kneesOut: 0.1 },
  /** In the air, floating: the legs a little drawn, the head up. */
  air: { hipY: -0.02, pitch: 0.04, nod: 0.08 },
  /** The last of the fall: reached for the ground. */
  spot: { hipY: 0.02, pitch: -0.03, nod: 0.06 },
};

/** THE CLIPS, timed as an animator times them (s). LAND is scaled by how
 * hard the touchdown was; POP and BRAKE IN are played whole. */
export const CLIPS = {
  land: [
    [0, {}],
    [0.1, { hipY: -0.11, pitch: 0.16, nod: 0.12, elbowsOut: 0.18, kneesOut: 0.1 }],
    [0.24, { hipY: -0.09, pitch: 0.12, nod: 0.08, elbowsOut: 0.12, kneesOut: 0.08 }],
    [0.52, { hipY: 0.018, pitch: -0.02 }],
    [0.8, {}],
  ] as ClipKey[],
  pop: [
    [0, {}],
    [0.09, { hipY: 0.04, pitch: -0.06, nod: 0.06 }],
    [0.28, { hipY: -0.04, pitch: 0.05, kneesOut: 0.08 }],
    [0.5, {}],
  ] as ClipKey[],
  brakeIn: [
    [0, {}],
    [0.12, { hipZ: -0.04, hipY: -0.02, pitch: -0.05 }],
    [0.45, {}],
  ] as ClipKey[],
};

/** THE TIMING: each channel's spring (rad/s — the higher the snappier),
 * the clips' scale, and the state machine's thresholds. */
export const ANIM = {
  /** The body's springs: the hips and trunk carried, the head quick. */
  omega: { hip: 16, trunk: 14, head: 18, limbs: 12, crouch: 12 },
  /** The bike's turn in a trick eased in and out. */
  trickOmega: 20,
  /** What a trick still owes at touchdown decayed away, half-life s. */
  trickLand: 0.035,
  /** The hips' lead on the bike's turn in a whip, a share of it. */
  lead: 0.3,
  /** The cranks: brought level (or the outside one down, eased in with the
   * lean over `turn`, rad, by up to `drop`, and not until the legs have
   * taken a landing — `landed`, s after it) coasting; turned at the
   * engine's cadence while it pedals (`pedal` the rate's grip, 1/s) — never
   * chased to the engine's own angle, which a stroke of a frame or two would
   * spin them half a turn after. `cadence` the slow mean the rate is read
   * off, s; PEDALLING held on `hold` s after the engine's last stroke, so
   * strokes ratcheted a few frames apart read as one bout of pedalling. The
   * drive is let go on its own spring once he stops (`release`, rad/s), and
   * a stroke he is `finish` rad past level is finished forward to the next
   * level, never pedalled back: a rider stops a stroke with his cranks
   * level, so he never coasts into a turn or off a lip with one foot at
   * the top of the stroke. */
  crank: {
    coast: 7,
    air: 12,
    pedal: 10,
    turn: [0.18, 0.45] as const,
    drop: 0.55,
    landed: [0.35, 0.8] as const,
    cadence: 0.35,
    hold: 0.35,
    release: 18,
    finish: 0.5,
  },
  /** The pedalling's rock: the hips up and down twice a turn, side to side
   * once, the trunk twisting with the stroke. */
  pedal: { bob: 0.022, sway: 0.018, twist: 0.06, omega: 6 },
  /** THE FOOT OUT: in once the style asks past `on` for `hold` s, back
   * once it is under `off` for `hold` s; out over `outFor` s, back over
   * `inFor`. */
  foot: { on: 0.45, off: 0.2, hold: 0.12, outFor: 0.28, inFor: 0.34 },
  /** The touchdown's scale off the flight, s: a hop barely, a big air
   * whole. */
  land: { least: 0.15, full: 0.9, floor: 0.35 },
  /** The spot: begun this many seconds of fall from the ground. */
  spot: 0.32,
  /** The pump's depth off the suspension's squash (both shares summed). */
  pump: 0.9,
  /** The head held: a share of the body's rise and fall on its springs
   * taken back off the hips, against a slow mean of it (s). */
  pitch: { tau: 0.7, air: 0.7, ground: 0.5, most: 0.6, back: 0, up: 0 },
  head: { share: 0.3, tau: 0.6, hold: 0.7, most: 0.2, omega: 28, laid: [0.5, 0.8] as const },
  /** THE LIMBS' GUARDS: the band each knee and elbow is kept in (deg —
   * the knee's floor the motion lab's own 90, since a guard that acts
   * sooner jolts the hips through every pop; its ceiling and the elbow's
   * band inside the lab's 170 and 70..160), the hips' highest over the
   * bottom bracket the knee guard may raise them to (m), the trunk's bend
   * the arm guard holds between (rad, the key's whole), and each guard's
   * spring (rad/s: the knee's quick, the trunk's slow, since a pitched
   * trunk swings the hands' elbows about). */
  limbs: {
    knee: [93, 155] as const,
    elbow: [84, 150] as const,
    hipsMost: 0.835,
    pitch: [0.42, 1.18] as const,
    omega: 80,
    armOmega: 15,
  },
  /** A clock leap past this starts the animator afresh, s. */
  leap: 0.25,
};

const HEAD = RAGDOLL.head;

const CHANNELS = [
  "hipX",
  "hipY",
  "hipZ",
  "pitch",
  "roll",
  "twist",
  "nod",
  "kneesOut",
  "elbowsOut",
  "crouch",
] as const satisfies readonly (keyof BodyAnim)[];

const OMEGA: Record<(typeof CHANNELS)[number], number> = {
  hipX: ANIM.omega.hip,
  hipY: ANIM.omega.hip,
  hipZ: ANIM.omega.hip,
  pitch: ANIM.omega.trunk,
  roll: ANIM.omega.trunk,
  twist: ANIM.omega.trunk,
  nod: ANIM.omega.head,
  kneesOut: ANIM.omega.limbs,
  elbowsOut: ANIM.omega.limbs,
  crouch: ANIM.omega.crouch,
};

const zero = (): BodyAnim => ({
  hipX: 0,
  hipY: 0,
  hipZ: 0,
  pitch: 0,
  roll: 0,
  twist: 0,
  nod: 0,
  kneesOut: 0,
  elbowsOut: 0,
  crouch: 0,
});

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** The ease between two keys: slow out, slow in. */
const ease = (t: number): number => t * t * (3 - 2 * t);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** A CLIP read at `t` s: each channel eased between the keys either side
 * (a channel a key leaves out is 0 there). */
export function clipAt(clip: readonly ClipKey[], t: number, scale = 1): Partial<BodyAnim> {
  const out: Partial<BodyAnim> = {};
  if (t <= clip[0][0] || t >= clip[clip.length - 1][0]) return out;
  let i = 0;
  while (clip[i + 1][0] < t) i++;
  const [t0, a] = clip[i];
  const [t1, b] = clip[i + 1];
  const k = ease((t - t0) / (t1 - t0));
  for (const c of CHANNELS) {
    const va = a[c] ?? 0;
    const vb = b[c] ?? 0;
    if (va !== 0 || vb !== 0) out[c] = (va + (vb - va) * k) * scale;
  }
  return out;
}

const lay = (to: BodyAnim, from: Partial<BodyAnim>, k = 1): void => {
  for (const c of CHANNELS) if (from[c] !== undefined) to[c] += from[c]! * k;
};

/** A critically damped spring a step: `x` toward `target` at `omega`. */
function spring(x: number, v: number, target: number, omega: number, dt: number): [number, number] {
  const n = Math.max(1, Math.ceil(dt * 240));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = omega * omega * (target - x) - 2 * omega * v;
    v += a * h;
    x += v * h;
  }
  return [x, v];
}

/** An OFFSET `x` moving at `vel` decayed toward nothing over `dt` on a
 * critically damped spring of half-life `hl` s: an inertialized blend's
 * every channel (it leaves at the speed it had and settles without
 * overshoot). */
function decay(x: number, vel: number, hl: number, dt: number): [number, number] {
  const y = (2 * Math.LN2) / hl;
  const j = vel + x * y;
  const e = Math.exp(-y * dt);
  return [e * (x + j * dt), e * (vel - j * y * dt)];
}

const SIDES = [
  [RAGDOLL.hipL, RAGDOLL.kneeL, RAGDOLL.footL, RAGDOLL.shoulderL, RAGDOLL.elbowL, RAGDOLL.handL],
  [RAGDOLL.hipR, RAGDOLL.kneeR, RAGDOLL.footR, RAGDOLL.shoulderR, RAGDOLL.elbowR, RAGDOLL.handR],
] as const;

/** The inside angle at joint `b` of the points `p`, deg. */
function angleAt(p: readonly number[], a: number, b: number, c: number): number {
  const ux = p[3 * a] - p[3 * b];
  const uy = p[3 * a + 1] - p[3 * b + 1];
  const uz = p[3 * a + 2] - p[3 * b + 2];
  const wx = p[3 * c] - p[3 * b];
  const wy = p[3 * c + 1] - p[3 * b + 1];
  const wz = p[3 * c + 2] - p[3 * b + 2];
  const d = (ux * wx + uy * wy + uz * wz) / (Math.hypot(ux, uy, uz) * Math.hypot(wx, wy, wz) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
}

/** The joints of the rider laid as `style` says on the bike posed `pose`
 * (the key alone, as the guards read it). */
const pointsOf = (pose: BikePose, style: AnimatedStyle): number[] =>
  keyPoints(freerideKey(pose, style), 0);

/** `style` with its body moved by `d` on channel `c`. */
const moved = (style: AnimatedStyle, c: "hipY" | "pitch", d: number): AnimatedStyle => ({
  ...style,
  body: { ...style.body, [c]: style.body[c] + d },
});

/** The least `d` in [lo, hi] for which `ok(d)` holds, `ok` turning true
 * once and staying so (bisected). */
function least(lo: number, hi: number, ok: (d: number) => boolean): number {
  if (ok(lo)) return lo;
  if (!ok(hi)) return hi;
  for (let n = 0; n < 14; n++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** THE KNEE GUARD: how far the hips must rise (m, positive) for the
 * tighter knee to open to the band, or sink (negative) for the straighter
 * to bend back into it — a foot off its pedal (the foot out) not counted. */
function kneeGuard(pose: BikePose, style: AnimatedStyle): number {
  const [lo, hi] = ANIM.limbs.knee;
  const legs = (d: number): number[] => {
    const p = pointsOf(pose, moved(style, "hipY", d));
    return SIDES.filter((_, i) => !(style.footOut > 0.2 && style.foot === i)).map(([h, k, f]) =>
      angleAt(p, h, k, f),
    );
  };
  const now = legs(0);
  if (!now.length) return 0;
  const p0 = pointsOf(pose, style);
  const hipsOver = (p0[3 * RAGDOLL.hipL + 1] + p0[3 * RAGDOLL.hipR + 1]) / 2 + pose.rider.y;
  const room = Math.max(0, ANIM.limbs.hipsMost - hipsOver);
  // A LOCKED knee first (a leg straight through reads stiff, and a knee
  // near straight swings wildly for a centimetre of hip): sunk until the
  // straighter bends, whatever that folds the other. Then raised for the
  // tighter, only as far as the straighter stays bent.
  let d = 0;
  if (Math.max(...now) > hi) d = -least(0, 0.25, (x) => Math.max(...legs(-x)) <= hi);
  if (Math.min(...legs(d)) < lo) {
    const open = least(0, Math.min(0.2, room - d), (x) => Math.min(...legs(d + x)) >= lo);
    const lock = least(0, 0.2, (x) => Math.max(...legs(d + x)) > hi);
    d += Math.min(open, lock);
  }
  return d;
}

/** THE ARM GUARD (the trunk-pitch solve): how far the trunk must bend
 * (rad, positive forward) for the straighter elbow to come back into the
 * band, or rise (negative) for the tighter to open to it — held to the
 * trunk's own band. */
function armGuard(pose: BikePose, style: AnimatedStyle): number {
  const [lo, hi] = ANIM.limbs.elbow;
  const [p0, p1] = ANIM.limbs.pitch;
  const pitch = freerideKey(pose, style).pitch;
  const arms = (d: number): number[] => {
    const p = pointsOf(pose, moved(style, "pitch", d));
    return SIDES.map(([, , , sh, e, h]) => angleAt(p, sh, e, h));
  };
  const now = arms(0);
  // More bend brings the shoulders toward the grips: the elbows close.
  if (Math.min(...now) < lo) {
    const room = Math.max(0, pitch - p0);
    const open = least(0, room, (d) => Math.min(...arms(-d)) >= lo);
    const lock = least(0, room, (d) => Math.max(...arms(-d)) > hi);
    return -Math.min(open, lock);
  }
  if (Math.max(...now) > hi) {
    const room = Math.max(0, p1 - pitch);
    const bend = least(0, room, (d) => Math.max(...arms(d)) <= hi);
    const fold = least(0, room, (d) => Math.min(...arms(d)) < lo);
    return Math.min(bend, fold);
  }
  return 0;
}

/** THE ANIMATOR of one bike: its springs, its clips' clocks, its states. */
export class BikeAnimator {
  private t = -1;
  private body = zero();
  private vel = zero();
  private trick = { yaw: 0, roll: 0, vyaw: 0, vroll: 0 };
  private crank = 0;
  private crankV = 0;
  /** The level the cranks come back to coasting (0 or π), kept until the
   * cranks are well past the other's side. */
  private crankBase = 0;
  /** The engine's cadence, rpm, a slow mean, and how long since it last
   * pedalled, s. */
  private cadence = 0;
  private sincePedal = Infinity;
  private pedal = 0;
  private pedalV = 0;
  /** The cranks' drive at the engine's cadence, 0..1. */
  private drive = 0;
  private driveV = 0;
  private wasAir = false;
  private landAt = -1;
  private landScale = 1;
  private popAt = -1;
  private braked = false;
  private brakeAt = -1;
  private footOn = false;
  private footFor = 0;
  private footSide: 0 | 1 = 0;
  /** The foot out's share, eased by its own clock. */
  private foot = 0;
  private riderMean = 0;
  private headMean = 0;
  private pitchMean = 0;
  private headFix = 0;
  private headFixV = 0;
  private kneeFix = 0;
  private kneeFixV = 0;
  private armFix = 0;
  private armFixV = 0;
  private last: AnimatedStyle | null = null;

  /** THE STYLE at the run's time `t`: stepped from the last call. */
  step(b: BikeState, level: Level, t: number): AnimatedStyle {
    if (this.last && t === this.t) return this.last;
    const pose = drawnBikePose(b, t);
    const raw = rideStyleOf(b, level, t);
    const fresh = this.t < 0 || t < this.t || t - this.t > ANIM.leap;
    const dt = fresh ? 0 : t - this.t;
    this.t = t;
    const ridden = b.onIt && b.mode === "ridden";
    const air = ridden && b.airborne;

    // ── THE STATES and their clocks ──────────────────────────────────────
    if (fresh) {
      this.crank = pose.crank;
      this.crankV = 0;
      this.cadence = b.cadence;
      this.sincePedal = pose.pedalling ? 0 : Infinity;
      this.crankBase = Math.abs(wrap(this.crank)) < Math.PI / 2 ? 0 : Math.PI;
      this.riderMean = pose.rider.y;
      this.wasAir = air;
      this.footSide = raw.foot;
    }
    if (!fresh && air && !this.wasAir) this.popAt = t;
    if (!fresh && !air && this.wasAir && ridden) {
      this.landAt = t;
      const flight = b.landing?.air ?? b.airTime;
      this.landScale = Math.max(
        ANIM.land.floor * smooth(0.05, ANIM.land.least, flight),
        smooth(ANIM.land.least, ANIM.land.full, flight),
      );
    }
    this.wasAir = air;
    const braking = ridden && !air && raw.brake > 0.3;
    if (braking && !this.braked) this.brakeAt = t;
    this.braked = braking;

    // The foot out, with hysteresis: a slide that flickers keeps it out.
    const F = ANIM.foot;
    const asks = ridden && !air ? raw.footOut : 0;
    if (this.footOn ? asks < F.off : asks > F.on) this.footFor += dt;
    else this.footFor = 0;
    if (this.footFor >= F.hold) {
      this.footOn = !this.footOn;
      this.footFor = 0;
      if (this.footOn) this.footSide = raw.foot;
    }
    if (this.foot === 0 && !this.footOn) this.footSide = raw.foot;
    this.foot = clamp01(this.foot + (this.footOn ? dt / F.outFor : -dt / F.inFor));

    // ── THE TARGET POSE, layered ─────────────────────────────────────────
    const target = zero();
    lay(target, KEYS.attack);
    const ready = 1 - smooth(0.5, 3, b.speed);
    lay(target, KEYS.ready, ready * (air ? 0 : 1));
    if (ridden && !air) {
      const lean = smooth(0.08, 0.6, Math.abs(b.roll));
      const side = Math.sign(b.roll) || 1;
      target.hipY += KEYS.turn.hipY * lean;
      // To the inside of the turn: the bike's +x side is inside a lean to +x.
      target.hipX += -KEYS.turn.hipX * side * lean;
      target.kneesOut += KEYS.turn.kneesOut * lean;
      target.elbowsOut += KEYS.turn.elbowsOut * lean;
      lay(target, KEYS.brake, raw.brake);
      const squash = smooth(0.4, 1.6, pose.forkShare + pose.shockShare);
      lay(
        target,
        KEYS.pump,
        squash * ANIM.pump * (this.landAt >= 0 && t - this.landAt < 0.8 ? 0 : 1),
      );
    }
    if (air) {
      lay(target, KEYS.air, smooth(0.15, 0.4, b.airTime));
      const left = fallLeft(b, level, t);
      lay(target, KEYS.spot, (1 - smooth(0.05, ANIM.spot, left)) * smooth(0.25, 0.5, b.airTime));
      // THE WHIP IS THROWN FROM THE HIPS: they turn ahead of the bike (the
      // trick's own target, which the drawn bike chases on its spring) and
      // turn back first, before the landing, the shoulders kept square.
      target.twist += ANIM.lead * raw.yaw;
      target.hipX += ANIM.lead * 0.2 * raw.yaw;
    }
    if (this.popAt >= 0) lay(target, clipAt(CLIPS.pop, t - this.popAt));
    if (this.landAt >= 0) lay(target, clipAt(CLIPS.land, t - this.landAt, this.landScale));
    if (this.brakeAt >= 0) lay(target, clipAt(CLIPS.brakeIn, t - this.brakeAt));
    // The foot out drops his weight onto the outside foot.
    target.hipY -= 0.03 * ease(this.foot);
    target.roll += (this.footSide ? 0.12 : -0.12) * ease(this.foot);
    target.crouch = pose.crouch;
    // The trunk held more upright than the bike is laid, and turned with the
    // bars — the engine's stance, eased.
    target.roll += -pose.roll * ATTACK.upright;
    target.twist += -pose.steer * 0.3;
    // THE BODY HELD IN THE WORLD while the bike pitches under him: a share
    // of the bike's pitch off a slow mean of it (the slope he rides) taken
    // back off his trunk's bend, so his chest stays where it was and the
    // bike rocks between his hands and feet.
    if (fresh) this.pitchMean = pose.pitch;
    this.pitchMean += (pose.pitch - this.pitchMean) * (dt / (ANIM.pitch.tau + dt));
    const rock = Math.max(-ANIM.pitch.most, Math.min(ANIM.pitch.most, pose.pitch - this.pitchMean));
    const held = rock * (air ? ANIM.pitch.air : ANIM.pitch.ground);
    target.pitch += held;
    // Nose down, he is behind it: the hips back and up over the rear.
    target.hipZ += ANIM.pitch.back * held;
    target.hipY -= ANIM.pitch.up * held;

    // THE PEDALLING: rocked over the cranks as they turn — held on through
    // the engine's strokes ratcheted a few frames apart.
    const C = ANIM.crank;
    this.sincePedal = pose.pedalling ? 0 : this.sincePedal + dt;
    this.cadence += (b.cadence - this.cadence) * (dt / (C.cadence + dt));
    const pedalling = ridden && !air && this.sincePedal < C.hold;
    [this.pedal, this.pedalV] = spring(
      this.pedal,
      this.pedalV,
      pedalling ? 1 : 0,
      ANIM.pedal.omega,
      dt,
    );
    const P = ANIM.pedal;
    target.hipY += this.pedal * P.bob * Math.sin(this.crank) ** 2;
    target.hipX += this.pedal * P.sway * Math.sin(this.crank);
    target.twist += this.pedal * P.twist * Math.sin(this.crank);

    // THE HEAD HELD: a share of the body's rise and fall on the engine's
    // springs taken back off the hips (a slow mean of it is the stance).
    const dev = pose.rider.y - this.riderMean;
    this.riderMean += dev * (dt / (ANIM.head.tau + dt));
    target.hipY -= ANIM.head.share * dev;

    // ── THE SPRINGS ──────────────────────────────────────────────────────
    for (const c of CHANNELS) {
      if (fresh) {
        this.body[c] = target[c];
        this.vel[c] = 0;
      } else
        [this.body[c], this.vel[c]] = spring(this.body[c], this.vel[c], target[c], OMEGA[c], dt);
    }
    // Back on the ground the bike is the bike: whatever the spring still
    // owes of a trick is INERTIALIZED away — the offset left at touchdown
    // decayed to nothing at the speed it had (`ANIM.trickLand`), never cut
    // by a share a frame (which pops, and pops harder the higher the frame
    // rate).
    const landing = !air && ridden && !fresh;
    const turn = (x: number, v: number, to: number): [number, number] =>
      fresh
        ? [to, 0]
        : landing
          ? decay(x, v, ANIM.trickLand, dt)
          : spring(x, v, to, ANIM.trickOmega, dt);
    [this.trick.yaw, this.trick.vyaw] = turn(this.trick.yaw, this.trick.vyaw, raw.yaw);
    [this.trick.roll, this.trick.vroll] = turn(this.trick.roll, this.trick.vroll, raw.roll);

    // THE CRANKS: turned at the engine's cadence while it pedals; level
    // coasting and in the air, the outside one dropped through a turn (the
    // foot nearer the inside forward) by as much as he is laid over, and not
    // until the legs have taken a landing on level feet — the two blended
    // by the pedalling's share, so a stroke begun or let go never kicks them.
    [this.drive, this.driveV] = fresh
      ? [pedalling ? 1 : 0, 0]
      : spring(this.drive, this.driveV, pedalling ? 1 : 0, C.release, dt);
    const past = wrap(this.crank - this.crankBase);
    const finishing = !pedalling && this.crankV > 1 && past > C.finish;
    if (finishing || Math.abs(past) > Math.PI / 2 + 0.3)
      this.crankBase = this.crankBase === 0 ? Math.PI : 0;
    const settled = this.landAt < 0 ? 1 : smooth(C.landed[0], C.landed[1], t - this.landAt);
    const lean = air
      ? 0
      : smooth(C.turn[0], C.turn[1], Math.abs(b.roll)) * Math.sign(b.roll) * settled;
    const aim = this.crankBase + (this.crankBase === 0 ? 1 : -1) * C.drop * lean;
    if (!fresh) {
      const w = air ? C.air : C.coast;
      const rate = (this.cadence / 60) * 2 * Math.PI;
      const share = clamp01(this.drive);
      const n = Math.max(1, Math.ceil(dt * 240));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const off = wrap(aim - this.crank);
        const a =
          share * C.pedal * (rate - this.crankV) +
          (1 - share) * (w * w * off - 2 * w * this.crankV);
        this.crankV += a * h;
        this.crank += this.crankV * h;
      }
      this.crank = wrap(this.crank);
    }

    // THE HEAD HELD: where the head stands over the bike's middle (the
    // motion lab's own measure), a slow mean of it the eye line; a share of
    // the difference taken off the hips, quickly but eased.
    const draft: AnimatedStyle = {
      ...raw,
      body: this.body,
      crank: this.crank,
      pedal: clamp01(this.drive),
    };
    const pts = keyPoints(freerideKey(pose, draft), 0);
    const q = pose.q;
    const [hx, hy, hz] = [pts[3 * HEAD], pts[3 * HEAD + 1], pts[3 * HEAD + 2]];
    const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
    const head =
      b.rider.y -
      pose.y +
      2 * (q.x * q.y + q.w * q.z) * hx +
      upY * hy +
      2 * (q.y * q.z - q.w * q.x) * hz;
    if (fresh) this.headMean = head;
    this.headMean += (head - this.headMean) * (dt / (ANIM.head.tau + dt));
    const H = ANIM.head;
    // Held only while the bike stands up under him: laid flat (a crash, a
    // tip-over) the bike's own up is no longer the world's, and lifting his
    // hips along it would throw him sideways.
    const want = ridden
      ? (Math.max(-H.most, Math.min(H.most, this.headMean - head)) *
          H.hold *
          smooth(H.laid[0], H.laid[1], upY)) /
        Math.max(0.5, upY)
      : 0;
    [this.headFix, this.headFixV] = fresh
      ? [want, 0]
      : spring(this.headFix, this.headFixV, want, H.omega, dt);

    // THE LIMBS KEPT IN A RIDER'S BAND, solved off the pose as drawn: the
    // hips raised where a knee would fold shut over its pedal (or lowered
    // where both legs would lock), then the trunk bent or raised until the
    // elbows stand inside theirs — the trunk-pitch solve, a guard that is
    // nothing while the keys keep him in band. Each through a quick spring.
    const out: AnimatedStyle = {
      ...raw,
      yaw: this.trick.yaw,
      roll: this.trick.roll,
      footOut: ease(this.foot),
      foot: this.footSide,
      body: { ...this.body, hipY: this.body.hipY + this.headFix },
      crank: this.crank,
      pedal: clamp01(this.drive),
    };
    const L = ANIM.limbs;
    const kneeWant = ridden ? kneeGuard(pose, out) : 0;
    [this.kneeFix, this.kneeFixV] = fresh
      ? [kneeWant, 0]
      : spring(this.kneeFix, this.kneeFixV, kneeWant, L.omega, dt);
    out.body.hipY += this.kneeFix;
    // Through a trick the arms are the trick's (the bike turned under him).
    const armWant = ridden && !air ? armGuard(pose, out) * (1 - clamp01(out.amount)) : 0;
    [this.armFix, this.armFixV] = fresh
      ? [armWant, 0]
      : spring(this.armFix, this.armFixV, armWant, L.armOmega, dt);
    out.body.pitch += this.armFix;
    this.last = out;
    return out;
  }
}

const animators = new WeakMap<BikeState, BikeAnimator>();

/** THE ANIMATED STYLE of bike `b` at the run's time `t` — its animator kept
 * for it, stepped once a time (every reader of a frame gets the same). */
export function animatedStyle(b: BikeState, level: Level, t: number): AnimatedStyle {
  let a = animators.get(b);
  if (!a) {
    a = new BikeAnimator();
    animators.set(b, a);
  }
  return a.step(b, level, t);
}
