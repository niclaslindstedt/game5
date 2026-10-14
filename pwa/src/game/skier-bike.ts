// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER ON THE DOWNHILL BIKE (`bike.ts`) — his dressed figure laid on
// the bike as the engine has it (`bikePose`): his hands round the grips, the
// balls of his feet on the pedals as the cranks turn them, his body in the
// ATTACK STANCE — knees and elbows bent and out, hips back over the saddle,
// chest low over the stem, head up — moved where the engine's rider body
// moves on its springs: back off the rear for a steep and a landing, down
// for a pop, forward to weight the front, across into a turn, his trunk held
// more upright than the bike he lays over. Off it he walks (`walking`). The
// same keys a body off its skis is laid with (`party-pose.ts`), so the
// figure hangs on it as on any move: the skis put away, nothing in his hands.
//
// THE FRAME is the root his figure is hung in while he rides: the bike's
// own attitude, its origin his centre of mass as the engine has it — so a
// grip is the bike's grip less where he stands on the frame.
//
// Three-free, so the suite reads it.

import { BIKE, BIKE_BB, RAGDOLL as R, type BikePose, type GameState } from "@engine";

import { GRIPS, SADDLE_TOP, bracketFromRider, gripsAt, pedalsAt, type V3 } from "./bike-look.ts";
import type { AnimatedStyle } from "./bike-anim.ts";
import type { RideStyle } from "./bike-ride-style.ts";
import { ANKLE, STAND, blend, keyOf, keyPoints, type Key } from "./party-pose.ts";
import { drawnBikePose } from "./rider-follow.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import { BODY } from "./skier-mounts.ts";
import type { SkierPose } from "./skier-pose.ts";

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a: V3, k: number): V3 => v(a.x * k, a.y * k, a.z * k);
/** A smooth max(0, x) over a knee `w` wide. */
const softPlus = (x: number, w: number): number => w * Math.log1p(Math.exp(x / w));

/** THE ATTACK STANCE's numbers: the hip joints' middle from his centre of
 * mass (back and a little up — the knees and elbows bent near a right
 * angle's half, never folded flat), the trunk's bend, the head's lift and
 * its BOW (raised so his eyes are on the trail ten metres out, not on the
 * front wheel), and where the ankle stands off a pedal's middle (the ball
 * of the foot on the pedal, the heel dropped). */
export const ATTACK = {
  hips: v(0, 0.06, -0.17),
  pitch: 0.82,
  /** More bend as he folds for a pop, less hung off the back. */
  crouchPitch: 0.25,
  backPitch: 0.12,
  nod: -0.4,
  bow: -0.4,
  ankle: v(0, ANKLE + 0.012, -0.055),
  /** The share of the bike's lean his trunk does not follow: riders lay
   * the bike over under a body held nearer upright. */
  upright: 0.45,
};

/** The share of the leg's length a pedal may stand off the hip joint. */
const REACH = 0.94;

/** THE LEGS NEVER LOCKED: where the bike's travel, his own sway or a
 * pedal at the bottom of its stroke carries a foot further off its hip than
 * `REACH` of the leg, the hips `at` come down along the line to it (each leg
 * in turn, eased) — a rider's knee keeps some 30–40° of bend at the bottom
 * of the stroke, stood or sat, and a knee straightened onto the reach's end
 * is the kink a drawing snaps through. */
export function kneesKept(at: V3, feet: readonly [V3, V3]): V3 {
  let hips = at;
  const most = REACH * (BODY.thigh + BODY.shin);
  for (const [i, foot] of feet.entries()) {
    const d = sub(foot, add(hips, v(i === 0 ? -BODY.hip : BODY.hip, 0, 0)));
    const span = Math.hypot(d.x, d.y, d.z);
    const give = softPlus(span - most, 0.02);
    if (span > 1e-6) hips = add(hips, scale(d, give / span));
  }
  return hips;
}

/** THE KEY that lays him on the bike posed `pose`, in the root's frame —
 * `look` the head's own turn on top of the stance's, rad (the neck taking
 * the bike's pitch, `holdRider`). */
export function riderKey(pose: BikePose, look = 0): Key {
  const bb = bracketFromRider(pose);
  const [g0, g1] = gripsAt(pose.steer);
  const [p0, p1] = pedalsAt(pose.crank);
  const back = Math.max(0, pose.shift);
  const feet: [V3, V3] = [add(add(bb, p0), ATTACK.ankle), add(add(bb, p1), ATTACK.ankle)];
  const hips = kneesKept(ATTACK.hips, feet);
  return {
    hipX: hips.x,
    hipY: hips.y,
    hipZ: hips.z,
    pitch:
      ATTACK.pitch +
      ATTACK.crouchPitch * pose.crouch +
      ATTACK.backPitch * back -
      0.1 * Math.max(0, -pose.shift),
    roll: -pose.roll * ATTACK.upright,
    twist: -pose.steer * 0.3,
    nod: ATTACK.nod - 0.2 * pose.crouch + look,
    feet,
    hands: [add(bb, g0), add(bb, g1)],
  };
}

/** A point of the bike turned under him by the style's `yaw` then `roll`
 * (`bike-ride-style.ts`) about his centre of mass — the root's origin. */
export function underHim(p: V3, yaw: number, roll: number): V3 {
  // Rolled about the bike's forward axis (−y toward +x), then yawed about
  // its up axis (+z toward +x).
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const x1 = p.x * cr - p.y * sr;
  const y1 = p.x * sr + p.y * cr;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return v(x1 * cy + p.z * sy, y1, -x1 * sy + p.z * cy);
}

/** THE FREERIDER'S STANCE (`bike-variant.ts`'s freeride look): the attack
 * stance ridden wider and lower — the knees and the elbows OUT, the hips
 * back and down over the saddle, the chest over the stem and the eyes up
 * the trail. */
export const FREERIDE = {
  kneesOut: 0.55,
  elbowsOut: 0.6,
  hips: v(0, -0.035, -0.08),
  pitch: 0.1,
  /** Off the attack stance's nod (the attack's head is raised by its bow,
   * which the freerider's animator does in its own way). */
  nod: -0.13,
  /** Under the levers: his weight further back and down. */
  brake: { back: 0.07, down: 0.04, pitch: -0.08 },
  /** How much of the bike's whip his hips follow (his shoulders and eyes
   * stay down the trail), and how far his knees draw up in a table. */
  follow: { twist: 0.35, roll: 0.3 },
  tuck: 0.12,
  /** His inside foot out of a slide, from the bottom bracket in the
   * bike's frame: out to the side, low over the dirt and ahead of the
   * cranks, the sole skimming it. */
  foot: v(0.5, -0.2, 0.45),
};

/** THE KEY that lays the FREERIDER on the bike posed `pose`, riding it as
 * `style` says: whipped, tabled, a foot out, on the brakes. */
export function freerideKey(pose: BikePose, style: RideStyle | AnimatedStyle): Key {
  // ANIMATED (`bike-anim.ts`): the cranks as drawn, the pop's crouch eased,
  // and the key poses' offsets laid on below in place of the brake's.
  const body = "body" in style ? style.body : null;
  if ("crank" in style) pose = { ...pose, crank: style.crank, crouch: body!.crouch };
  const key = riderKey(pose);
  const F = FREERIDE;
  const bb = bracketFromRider(pose);
  key.kneesOut = F.kneesOut;
  key.elbowsOut = F.elbowsOut;
  key.hipX = F.hips.x;
  key.hipY = F.hips.y - (body ? 0 : F.brake.down * style.brake);
  key.hipZ = F.hips.z - (body ? 0 : F.brake.back * style.brake);
  key.pitch += F.pitch + (body ? 0 : F.brake.pitch * style.brake);
  key.nod += F.nod;
  if (body) {
    key.hipX += body.hipX;
    key.hipY += body.hipY;
    key.hipZ += body.hipZ;
    key.pitch += body.pitch;
    key.roll = body.roll;
    key.twist = body.twist;
    key.nod += body.nod;
    key.kneesOut += body.kneesOut;
    key.elbowsOut += body.elbowsOut;
  }
  // THE WHIP: the bike under him turned, his hands and feet with it, his
  // hips following a share of it and his shoulders kept square.
  const { yaw, roll } = style;
  if (yaw !== 0 || roll !== 0) {
    key.hands = [underHim(key.hands[0], yaw, roll), underHim(key.hands[1], yaw, roll)];
    key.feet = [underHim(key.feet[0], yaw, roll), underHim(key.feet[1], yaw, roll)];
    key.twist += yaw * F.follow.twist;
    key.roll += roll * F.follow.roll;
    if (style.trick === "table") key.hipY -= F.tuck * style.amount;
  }
  // THE FOOT OUT: the inside foot off its pedal toward the dirt.
  if (style.footOut > 0) {
    const i = style.foot;
    const side = i ? 1 : -1;
    const out = add(bb, v(side * F.foot.x, F.foot.y, F.foot.z));
    const k = style.footOut;
    const f = key.feet[i];
    key.feet[i] = v(f.x + (out.x - f.x) * k, f.y + (out.y - f.y) * k, f.z + (out.z - f.z) * k);
    // His weight onto the outside foot, the trunk dropped over it (the
    // animator lays its own, eased).
    if (!body) {
      key.hipY -= 0.03 * k;
      key.roll += side * 0.12 * k;
    }
  }
  // The freerider's hips are laid afresh above, so the legs are kept off
  // their lock again (the pedal start's knee snapped straight without it).
  const hips = kneesKept(v(key.hipX, key.hipY, key.hipZ), key.feet);
  key.hipX = hips.x;
  key.hipY = hips.y;
  key.hipZ = hips.z;
  return key;
}

/** THE RIDER'S BODY HELD between the engine's steps (a body, not a switch):
 * what the engine hands the drawing steps — the crouch a pop folds him for
 * is 0 or 1, and lets go in the air — so each channel the stance is laid
 * off is carried on a critically damped spring of its own, and the HEAD is
 * held near level in the world as a rider's is (the head stabilised in
 * space, the neck taking most of the bike's quick pitch: Pozzo, Berthoz
 * and Lefort's head-in-space finding). `w` each spring's natural
 * frequency, rad/s (a settle of about 4.7 / w s); `neck` the share of the
 * bike's pitch off its slow follower the neck takes, and `most` the
 * farthest it turns, rad. */
export const HOLD = {
  w: { crouch: 16, shift: 14, roll: 14, steer: 22, pitch: 2.5 },
  neck: 0.7,
  most: 0.6,
  /** A step longer than this, s, or the clock run backward, is a new ride:
   * the springs are set where the pose is. */
  gap: 0.5,
};

type Channel = { x: number; v: number };
const CHANNELS = ["crouch", "shift", "roll", "steer", "pitch"] as const;
type Quat = { x: number; y: number; z: number; w: number };
type Root = { x: number; y: number; z: number; q: Quat };
export type RiderHold = {
  t: number;
  set: boolean;
  /** The last walking key drawn and the root it was laid in (the snow at
   * `ground` in it), and the key he mounts from in the bike's frame with
   * the run time the mount began — or null. */
  beside: { key: Key; ground: number; root: Root } | null;
  mount: { from: Key; at: number } | null;
} & Record<(typeof CHANNELS)[number], Channel>;

export function createRiderHold(): RiderHold {
  const c = (): Channel => ({ x: 0, v: 0 });
  return {
    t: 0,
    set: false,
    beside: null,
    mount: null,
    crouch: c(),
    shift: c(),
    roll: c(),
    steer: c(),
    pitch: c(),
  };
}

/** One channel `dt` s on toward `aim`, critically damped, in steps no
 * longer than 1/240 s. */
function follow(c: Channel, aim: number, w: number, dt: number): void {
  const n = Math.max(1, Math.ceil(dt * 240));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    c.v += (w * w * (aim - c.x) - 2 * w * c.v) * h;
    c.x += c.v * h;
  }
}

/** THE POSE AS DRAWN at run time `t`: `pose` with its stance's channels
 * carried on `hold`'s springs, and the head's turn the neck makes. The
 * same `t` twice (a frame drawn again) moves nothing. */
export function holdRider(
  hold: RiderHold,
  pose: BikePose,
  t: number,
): { pose: BikePose; look: number } {
  const dt = t - hold.t;
  if (!hold.set || dt < 0 || dt > HOLD.gap) {
    for (const k of CHANNELS) {
      hold[k].x = pose[k];
      hold[k].v = 0;
    }
    hold.set = true;
  } else if (dt > 0) {
    for (const k of CHANNELS) follow(hold[k], pose[k], HOLD.w[k], dt);
  }
  hold.t = t;
  const turn = HOLD.neck * (hold.pitch.x - pose.pitch);
  return {
    pose: {
      ...pose,
      crouch: hold.crouch.x,
      shift: hold.shift.x,
      roll: hold.roll.x,
      steer: hold.steer.x,
    },
    look: Math.max(-HOLD.most, Math.min(HOLD.most, turn)),
  };
}

/** THE RIDER ON THE BIKE as a stood pose (`SkisModel.setStood`): the root's
 * frame is his own centre of mass on the bike's attitude, so the snow under
 * him is never read. With a `style`, the freerider (`freerideKey`, its body
 * carried by the animator, `bike-anim.ts`); without, the attack stance —
 * with a `hold` and the run's clock his body carried on its springs
 * (`holdRider`). Either way, with a `hold`, a remount off his feet is
 * stepped through (`mountKey`). */
export function riderPose(
  pose: BikePose,
  style?: RideStyle | AnimatedStyle,
  hold?: RiderHold,
  t = 0,
): (ground: number, frame: BodyFrame) => SkierPose {
  let key: Key;
  // The attack stance's head bow: raised to the trail, and turned against
  // the bike's quick pitch as the neck does (`look`). The animator holds
  // the freerider's head itself.
  let bow = 0;
  if (style) {
    key = freerideKey(pose, style);
    // The reach kept moves the key's hips, so the mount blends onto them.
    if ("body" in style) reachKept(key);
  } else {
    const held = hold ? holdRider(hold, pose, t) : { pose, look: 0 };
    key = riderKey(held.pose, held.look);
    bow = ATTACK.bow - held.look;
  }
  // Eased in over a remount from the walking head's.
  const m = hold?.mount;
  if (m) {
    const k = (t - m.at) / MOUNT.time;
    if (k >= 1 || k < 0) hold!.mount = null;
    else {
      key = mountKey(m.from, key, k, bracketFromRider(pose));
      bow *= smoother(k / MOUNT.body);
    }
  }
  const points = keyPoints(key, 0);
  if (bow === 0) return (_ground, frame) => ragdollPose(points, frame);
  return (_ground, frame) => ({ ...ragdollPose(points, frame), bow });
}

/** THE REMOUNT as a rider makes it (the engine puts him on in a step): his
 * hands onto the grips first, the foot on the bike's side onto its pedal,
 * then the far leg swung up over the back of the saddle and down onto the
 * other pedal as his hips come over the frame. `time` s the whole of it,
 * `hands` and `near` the shares by which the hands and the near foot are
 * home (the body over the frame by `body`), `swing` the share the far leg leaves the snow at, `over` how far
 * the swung foot clears the saddle's top, m. */
export const MOUNT = { time: 0.6, body: 0.8, hands: 0.7, near: 0.75, swing: 0.1, over: 0.14 };

const smoother = (k: number): number => {
  const x = Math.max(0, Math.min(1, k));
  return x * x * x * (x * (6 * x - 15) + 10);
};
const lerp3 = (a: V3, b: V3, k: number): V3 =>
  v(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);

/** THE KEY `k` 0..1 into a remount from `from` (stood beside the bike, in
 * its frame) to `ride` (on it), the bottom bracket at `bb`. */
export function mountKey(from: Key, ride: Key, k: number, bb: V3): Key {
  const M = MOUNT;
  const body = smoother(k / M.body);
  const key = blend(from, ride, body);
  // The knees and elbows let out as he comes over the frame (`blend` keeps
  // neither, and the freerider rides with both out).
  const out = (a?: number, b?: number): number => (a ?? 0) + ((b ?? 0) - (a ?? 0)) * body;
  key.kneesOut = out(from.kneesOut, ride.kneesOut);
  key.elbowsOut = out(from.elbowsOut, ride.elbowsOut);
  // A little spring up off the near foot as the hips come over.
  key.hipY += 0.03 * Math.sin(Math.PI * Math.max(0, Math.min(1, k)));
  const near = BIKE.walk.push.across < 0 ? 0 : 1;
  const far = (1 - near) as 0 | 1;
  key.hands = [
    lerp3(from.hands[0], ride.hands[0], smoother(k / M.hands)),
    lerp3(from.hands[1], ride.hands[1], smoother(k / M.hands)),
  ];
  const n = smoother(k / M.near);
  const nf = lerp3(from.feet[near], ride.feet[near], n);
  key.feet[near] = v(nf.x, nf.y + 0.08 * Math.sin(Math.PI * n), nf.z);
  // The far leg: planted, then up over the saddle's back and down onto its
  // pedal along a curve through a point over the rear of the saddle.
  const sw = smoother((k - M.swing) / (1 - M.swing));
  const top = add(bb, v(0, SADDLE_TOP.y + M.over, SADDLE_TOP.z - 0.12));
  const a = lerp3(from.feet[far], top, sw);
  const b = lerp3(top, ride.feet[far], sw);
  key.feet[far] = lerp3(a, b, sw);
  return key;
}

/** `p` laid in root `a` (its frame) as seen from root `b`. */
function between(p: V3, a: Root, b: Root): V3 {
  const w = turn(p, a.q);
  return turn(v(w.x + a.x - b.x, w.y + a.y - b.y, w.z + a.z - b.z), conj(b.q));
}
const conj = (q: Quat): Quat => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
function turn(p: V3, q: Quat): V3 {
  // p + 2w(u×p) + 2u×(u×p), u the quaternion's vector part.
  const cx = q.y * p.z - q.z * p.y;
  const cy = q.z * p.x - q.x * p.z;
  const cz = q.x * p.y - q.y * p.x;
  return v(
    p.x + 2 * (q.w * cx + q.y * cz - q.z * cy),
    p.y + 2 * (q.w * cy + q.z * cx - q.x * cz),
    p.z + 2 * (q.w * cz + q.x * cy - q.y * cx),
  );
}

/** A walking `key` laid over the snow at `ground` in root `a`, restated in
 * root `b`'s frame with the snow at 0 (the way a rider's key is laid). */
export function keyBetween(key: Key, ground: number, a: Root, b: Root): Key {
  const at = (p: V3): V3 => between(v(p.x, p.y + ground, p.z), a, b);
  const hips = at(v(key.hipX, key.hipY, key.hipZ));
  const up0 = v(Math.sin(key.roll), Math.cos(key.pitch) * Math.cos(key.roll), Math.sin(key.pitch));
  const up = turn(turn(up0, a.q), conj(b.q));
  return {
    ...key,
    hipX: hips.x,
    hipY: hips.y,
    hipZ: hips.z,
    pitch: Math.atan2(up.z, up.y),
    roll: Math.asin(Math.max(-1, Math.min(1, up.x))),
    feet: [at(key.feet[0]), at(key.feet[1])],
    hands: [at(key.hands[0]), at(key.hands[1])],
  };
}

/** HOW THE RIDER OF A BIKE RIDE IS STOOD this frame (what the renderer's
 * seat hands the model, `machines.ts`, and the animation lab's): on the
 * bike, walking beside it, or neither (thrown, on a lift) — with the way's
 * name, so a change of way is eased over (`pose-handoff.ts`), and a
 * remount off his feet stepped through (`mountKey`). `style` the
 * freerider's ride (`animatedStyle`), handed in by the caller. */
export function bikeStood(
  s: GameState,
  hold: RiderHold,
  style?: RideStyle | AnimatedStyle,
): { pose: (ground: number, frame: BodyFrame) => SkierPose; way: string } | null {
  const b = s.bike;
  if (!b) return null;
  const c = s.skier;
  const root: Root = { x: c.x, y: c.y, z: c.z, q: c.q };
  const thrown = !!c.thrown;
  if (b.onIt && !thrown) {
    const was = hold.beside;
    hold.beside = null;
    if (was) {
      hold.mount = { from: keyBetween(was.key, was.ground, was.root, root), at: s.t };
    }
    return { pose: riderPose(drawnBikePose(b, s.t), style, hold, s.t), way: "bike" };
  }
  hold.set = false;
  hold.mount = null;
  if (b.afoot && !c.lift && !thrown) {
    const key = walkingKey(b.afoot);
    return {
      pose: (ground, frame) => {
        hold.beside = { key, ground, root };
        return ragdollPose(keyPoints(key, ground), frame);
      },
      way: "afoot",
    };
  }
  hold.beside = null;
  return null;
}

/** THE RIDER'S JOINTS on the bike posed `pose` (the ragdoll's thirteen
 * points, `RAGDOLL`'s order, in the root's frame — the bike's attitude about
 * his centre of mass): what `riderPose` hangs the figure on, and what the
 * bike motion lab (`make bike-motion`) measures against the grips and the
 * pedals. */
export function riderPoints(pose: BikePose, style?: RideStyle | AnimatedStyle): number[] {
  if (!style) return keyPoints(riderKey(pose), 0);
  const key = freerideKey(pose, style);
  return "body" in style ? reachKept(key) : keyPoints(key, 0);
}

/** The share of the arm's length a grip may stand off the shoulder: past
 * it the elbow nears its lock (a rider rides with them bent, never locked —
 * about 150° at the most here), so the trunk comes toward the grip. */
const ARM_REACH = 0.965;
const ARM_MOST = ARM_REACH * (BODY.upperArm + BODY.forearm);

/** THE REACH KEPT: a key pose an animator laid that would pull a hand off
 * its grip, lock an elbow straight, or a foot off its pedal (the limb straight and still short) is
 * eased toward them — the hips brought forward and the chest down for a
 * hand, the hips down for a foot — a few times over, the joints of the
 * last. */
export function reachKept(key: Key): number[] {
  let pts = keyPoints(key, 0);
  const at = (i: number): V3 => v(pts[3 * i], pts[3 * i + 1], pts[3 * i + 2]);
  for (let n = 0; n < 8; n++) {
    // Each hand's grip off its shoulder past `ARM_REACH` of the arm: the
    // arm left short, or about to lock its elbow straight.
    const hands = [R.shoulderL, R.shoulderR].map((j, i) => {
      const d = sub(key.hands[i], at(j));
      const span = Math.hypot(d.x, d.y, d.z);
      return span > 1e-6 ? scale(d, softPlus(span - ARM_MOST, 0.012) / span) : v(0, 0, 0);
    });
    const feet = [R.footL, R.footR].map((j, i) => {
      const p = at(j);
      const to = key.feet[i];
      return Math.hypot(to.x - p.x, to.y - p.y, to.z - p.z);
    });
    const [hl, hr] = hands.map((d) => Math.hypot(d.x, d.y, d.z));
    const foot = Math.max(feet[0], feet[1]);
    if (Math.max(hl, hr) < 0.003 && foot < 0.003) break;
    // The whole trunk moved toward the hand left short (the shoulders go
    // with the hips), the hips lowered for a foot left short.
    const d = hl > hr ? hands[0] : hands[1];
    key.hipX += d.x * 0.8;
    key.hipY += d.y * 0.8 - foot * 1.1;
    key.hipZ += d.z * 0.8;
    pts = keyPoints(key, 0);
  }
  return pts;
}

/** WHERE HIS NEAR HAND HOLDS THE BIKE HE PUSHES, in his own frame (x his
 * right, y up off the ground, z ahead), m: the bike's near grip, the bike
 * stood `BIKE.walk.push` from him with nobody on its springs — the bottom
 * bracket at its static 0.355 m, the grips `GRIPS` over it. */
export function pushGrip(): V3 {
  const P = BIKE.walk.push;
  const side = Math.sign(P.across) || -1;
  // The grip on his side of the bike: the bike's own −x when it stands to
  // his right, +x to his left.
  const grip = GRIPS[side < 0 ? 1 : 0];
  return v(P.across + grip.x, 0.355 + grip.y, P.ahead + grip.z + BIKE_BB.z);
}

/** THE WALK BESIDE THE BIKE, as a gait rather than a sway: each foot
 * PLANTED for `stance` of a stride (moving back under him at the ground's
 * speed, so it never slides), then SWUNG through with its heel lifted and
 * set down ahead, its velocity and acceleration continuous across both —
 * so the knee bends and straightens as a walker's does (some 15° on the
 * planted leg, 60° at the swing's peak: Perry and Burnfield's normal gait)
 * and is never driven straight and bounced. `stride` the ground a stride
 * covers, m (heel strike to heel strike of one foot; ~1.4 m walking free,
 * shorter beside a bike), `step` the planted foot's travel under the hips,
 * m (the stride's stance share, a little short where his heel and toe roll
 * it on), `lift` the ankle's peak over the snow in the swing and `heel` its
 * rise at the end of the stance, m; the hips as high as legs `reach` long
 * (the hip to the ankle with the knee bent 10°) let them, under `top`. */
export const GAIT = {
  stride: 1.25,
  stance: 0.6,
  step: 0.72,
  lift: 0.15,
  heel: 0.05,
  reach: 0.884,
  top: 0.975,
  /** Feet apart, m, and the free arm's swing fore and aft, m. */
  track: 0.12,
  swing: 0.2,
};

/** One foot's place through the stride, `u` 0..1 from its heel strike:
 * fore and aft as a share of its step (+0.5 ahead … −0.5 behind) and its
 * height off the snow, m. */
export function gaitFoot(u: number): { z: number; y: number } {
  const w = ((u % 1) + 1) % 1;
  return { z: (footTravel(w) - GAIT_MID) / GAIT_SPAN, y: footLift(w) };
}

// The planted foot goes back at one speed; the swing's speed rises from
// that as sin² and back, so the foot's velocity is one curve round the
// stride. Its travel, un-scaled:
function footTravel(w: number): number {
  const b = GAIT.stance;
  if (w < b) return -w;
  const s = (w - b) / (1 - b);
  return -w + s - Math.sin(2 * Math.PI * s) / (2 * Math.PI);
}
function footLift(w: number): number {
  const G = GAIT;
  const b = G.stance;
  let y = 0;
  if (w >= b) {
    // The swing's lift, peaked early (the toe cleared as the knee folds).
    const s = (w - b) / (1 - b);
    y += G.lift * Math.sin(Math.PI * Math.pow(s, 0.75)) ** 2;
  }
  // The heel coming up through the stance's end into the swing.
  const h0 = b - 0.22;
  const h = (w - h0) / 0.34;
  if (h > 0 && h < 1) y += G.heel * Math.sin(Math.PI * h) ** 2;
  return y;
}
// The travel's middle and span, read once round the stride.
const [GAIT_MID, GAIT_SPAN] = (() => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= 400; i++) {
    const z = footTravel(i / 400);
    lo = Math.min(lo, z);
    hi = Math.max(hi, z);
  }
  return [(lo + hi) / 2, hi - lo];
})();

/** THE KEY of a walk `walked` m into it at `pace` 0 (stood) … 1, the
 * stride's phase off the ground covered. */
export function gaitKey(walked: number, pace: number): Key {
  const G = GAIT;
  const k = Math.max(0, Math.min(1, pace));
  const u = walked / G.stride;
  const key = keyOf({ kind: "walk", t: 0, pace: 0 });
  let soft = 0;
  for (const i of [0, 1] as const) {
    const f = gaitFoot(u + i * 0.5);
    const z = f.z * G.step * k;
    const y = ANKLE + f.y * k;
    key.feet[i] = { x: (i ? 1 : -1) * G.track, y, z: z + 0.02 };
    // How high the hips may stand over this foot with its knee still bent.
    const room = Math.sqrt(Math.max(0, G.reach * G.reach - z * z));
    soft += Math.exp(-(y + room) / 0.012);
    // The free arm against the opposite leg.
    const a = 2 * f.z * k;
    key.hands[i] = { x: (i ? 1 : -1) * 0.29, y: 0.83 + 0.04 * a * a, z: 0.08 - G.swing * a };
  }
  const hip = -0.012 * Math.log(soft);
  key.hipY = Math.min(G.top, hip) * k + STAND.hipY * (1 - k);
  key.pitch = 0.1 + 0.06 * k;
  // The shoulders turned against the hips with the stride.
  key.twist = -0.08 * k * gaitFoot(u).z * 2;
  return key;
}

/** OFF THE BIKE, WALKING beside it (`BikeState.afoot`): the gait
 * (`gaitKey`) paced to his; stood still, stood. PUSHING it, his near hand
 * is on its near grip (`pushGrip`), his head turned a little to it and his
 * shoulders held square by it; the other arm swings with his stride. */
export function walkingPose(walk: {
  walked: number;
  pace: number;
  push?: boolean;
}): (ground: number, frame: BodyFrame) => SkierPose {
  const key = walkingKey(walk);
  return (ground, frame) => ragdollPose(keyPoints(key, ground), frame);
}

/** THE KEY of the walk beside the bike (`walkingPose`). */
export function walkingKey(walk: { walked: number; pace: number; push?: boolean }): Key {
  const pace = Math.min(1, Math.abs(walk.pace) / BIKE.walk.speed);
  const key = gaitKey(walk.walked, pace);
  if (walk.push) {
    const near = BIKE.walk.push.across < 0 ? 0 : 1;
    key.twist = key.twist * 0.4 + 0.12 * Math.sign(BIKE.walk.push.across);
    key.pitch += 0.08;
    // The grip held with the elbow a little bent, never locked: where the
    // stride carries his shoulder past the arm's reach of it, the hand
    // comes in along the line to it (the bike swung a touch nearer).
    const grip = pushGrip();
    const at = keyPoints(key, 0);
    const sh = near ? R.shoulderR : R.shoulderL;
    const s0 = { x: at[3 * sh], y: at[3 * sh + 1], z: at[3 * sh + 2] };
    const d = { x: grip.x - s0.x, y: grip.y - s0.y, z: grip.z - s0.z };
    const span = Math.hypot(d.x, d.y, d.z);
    const most = 0.97 * (BODY.upperArm + BODY.forearm);
    // A soft cap: the span eased onto `most`, never past it.
    const kept = span - softPlus(span - most, 0.02);
    const k = span > 1e-6 ? kept / span : 1;
    key.hands[near] = { x: s0.x + d.x * k, y: s0.y + d.y * k, z: s0.z + d.z * k };
  }
  return key;
}
