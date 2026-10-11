// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVER'S BODY AS POSED (`chute.ts`, drawn by `skis-body.ts`) —
// three-free, so the suite reads it. The skier keeps his skis on from the
// door to the snow; every stage of the jump is a shape his limbs take off
// the standing pose (`skierPose`), the boots carried round with his shins
// and the skis with the boots (`SkiSwing`, as the helicopter's dangling
// legs move theirs):
//
//   * POISED IN THE DOOR, crouched on the sill facing the nose, the hand on
//     the door's side up on the handrail over the doorway, the other on his
//     knee;
//   * THE EXIT, out into the slipstream presenting his chest to it, arms
//     opening into the box as the air turns up at him;
//   * BELLY TO EARTH — the box: the back arched, the upper arms out level
//     with the shoulders, the elbows bent, the hands up by his head, the
//     knees apart and bent so the shins stand up into the air (with his skis
//     on they lie flat over his calves); a TURN dips the arm on the side he
//     turns to; TRACKING the arms swept back to the hips and the legs
//     straightened; HEAD DOWN the arms out wide and the legs long;
//   * THE PULL: the arm on the main's side reaching back to the pilot
//     chute's pouch at the bottom of the container, the other forward over
//     his head for balance, then the throw out to the side at arm's length,
//     and back to the box;
//   * THE OPENING SHOCK at line stretch swinging his legs forward under
//     him, and again, softer, as the canopy fills;
//   * HANGING IN THE HARNESS under the canopy, the leg straps sitting him a
//     little, his hands up on the toggles — pulled down with the input, each
//     its own — or on the front risers; THE FLARE drawing both down and his
//     legs under him for the snow;
//   * THE CUT-AWAY: a hand on the red pad on his chest strap and the other
//     on the reserve's, the pad punched out and away;
//   * THE RESERVE: the left hand on the reserve's metal handle on the left
//     lift web, punched out forward at arm's length (the spring does the
//     rest — no throw), the right hand forward over his head, then the
//     opening's shock and the toggles as the main's;
//   * CAUGHT, hung on his risers, the hands up on them.
//
// The decision (`skydiveShapeOf`) reads the engine's skydive alone and its
// clock, so a frame is the same frame twice.

import { CHUTE, wingOf, type ChuteState } from "@engine";

import type { SkiSwing } from "./skier-dangle.ts";
import type { SkierPose } from "./skier-joints.ts";
import type { SkierPoseInput } from "./skier-pose-input.ts";
import type { Stand } from "./ski-stand.ts";
import { BODY, type Mounts } from "./skier-mounts.ts";
import { solveLimb } from "./skier-limbs.ts";
import { add, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** WHAT HIS BODY IS DOING, each a weight 0..1 (`skydiveShapeOf`): poised in
 * the door; in the box, tracking, head down (the freefall's bodies, summing
 * to the share of him in freefall); the turn, −1..1, right positive; the
 * reach back for the pilot chute and the throw; hanging in the harness;
 * the toggles, left and right; the risers −1..1 (forward the fronts); the
 * opening's shock; the flare (his legs brought under him for the snow);
 * the cut-away's two moves (the hands on the pads, the punch); the
 * reserve's pull (the left hand to its handle and out); and the attitude
 * he is drawn at, rad (0 upright .. π/2 belly to earth .. π head
 * down), past what his skier's frame can say. */
export type SkydiveShape = {
  door: number;
  box: number;
  track: number;
  head: number;
  turn: number;
  reach: number;
  throw: number;
  hang: number;
  toggles: [number, number];
  riser: number;
  shock: number;
  flare: number;
  pads: number;
  punch: number;
  reserve: number;
  attitude: number;
};

const NONE: SkydiveShape = {
  door: 0,
  box: 0,
  track: 0,
  head: 0,
  turn: 0,
  reach: 0,
  throw: 0,
  hang: 0,
  toggles: [0, 0],
  riser: 0,
  shock: 0,
  flare: 0,
  pads: 0,
  punch: 0,
  reserve: 0,
  attitude: 0,
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (v: number): number => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
/** Up over `a` s from `from`, held, and down over `b` s from `to`. */
const window = (t: number, from: number, a: number, to: number, b: number): number =>
  Math.min(smooth((t - from) / a), 1 - smooth((t - to) / b));

/** How long the step from the door into the slipstream takes, s: a poised
 * exit is in the arch within half a second. */
const LEAVE = 0.4;
/** THE PULL, s after the press (the pilot chute's stage is 0.45 s): the
 * hand at the pouch, the throw out, back in the box. */
const PULL = { at: 0.14, out: 0.42, back: 0.9 };
/** The shock's decay at line stretch and at full inflation, s, and the
 * second one's share. */
const SHOCK = { decay: 0.55, full: 0.45 };
/** How long the cut-away's two moves take, s: the hands to the pads, the
 * punch, and the pose let go. */
const CUT = { pads: 0.25, punch: 0.55, done: 1.3 };
/** THE RESERVE'S PULL, s after the press: the left hand on the handle, out
 * at arm's length, and back to the box (the pilot chute is sprung). */
const RESERVE_PULL = { at: 0.1, out: 0.3, back: 0.7 };

/** WHAT HIS BODY IS DOING THIS FRAME, off the run's skydive (`ch`) — or in
 * the plane's door (`inDoor`), or nothing (null: the pose is his own). */
export function skydiveShapeOf(ch: ChuteState | null, inDoor: boolean): SkydiveShape | null {
  if (inDoor && !ch) return { ...NONE, door: 1 };
  if (!ch || ch.done || ch.fell || ch.mode === "landed") return null;
  const out = { ...NONE, toggles: [0, 0] as [number, number] };
  out.attitude = ch.attitude;
  const head = clamp01((ch.attitude - Math.PI / 2) / (Math.PI * 0.45));
  const falling = (share: number): void => {
    const track = clamp01(ch.track) * (1 - head);
    out.track = track * share;
    out.head = head * share;
    out.box = Math.max(0, 1 - track - head) * share;
    out.turn = Math.max(-1, Math.min(1, ch.turn / CHUTE.freefall.turn));
  };
  if (ch.mode === "exit") {
    const away = smooth(ch.since / LEAVE);
    out.door = 1 - away;
    falling(away);
    return out;
  }
  if (ch.mode === "freefall") {
    falling(1);
    return out;
  }
  if (ch.mode === "deploying" && ch.deploy) {
    const t = ch.deploy.t;
    const stages = wingOf(ch.reserve).deploy.stages;
    const stretch = stages[2].end;
    const full = stages[4].end;
    const hang = smooth((t - stretch) / 0.45);
    falling(1 - hang);
    if (ch.reserve) {
      // Up to a half the hand is on its way to the handle, past it the
      // handle is pulled out; back down, the arm returns to the box.
      const R = RESERVE_PULL;
      out.reserve =
        t < R.out
          ? 0.5 * smooth(t / R.at) + 0.5 * smooth((t - R.at) / (R.out - R.at))
          : 1 - smooth((t - R.out) / (R.back - R.out));
    } else {
      out.reach = window(t, 0, PULL.at, PULL.at + 0.04, 0.12);
      out.throw = window(t, PULL.at, PULL.out - PULL.at, PULL.out + 0.05, PULL.back - PULL.out);
    }
    out.hang = hang;
    const kick = (from: number, size: number): number =>
      t < from ? 0 : size * smooth((t - from) / 0.12) * Math.exp(-(t - from) / SHOCK.decay);
    out.shock = Math.min(1, kick(stretch, 1) + kick(full, SHOCK.full));
    return out;
  }
  if (ch.mode === "open" || ch.mode === "snagged") {
    out.hang = 1;
    const k = ch.controls;
    const caught = ch.mode === "snagged";
    out.toggles = caught
      ? [0.15, 0.15]
      : [clamp01(k.brake + Math.max(0, -k.steer)), clamp01(k.brake + Math.max(0, k.steer))];
    out.riser = caught ? 0 : Math.max(-1, Math.min(1, k.riser));
    out.shock = ch.mode === "open" ? SHOCK.full * Math.exp(-ch.t / SHOCK.decay) * 0.6 : 0;
    if (!caught) {
      const F = CHUTE.flare;
      out.flare = smooth((F.stand - ch.agl) / (F.stand - F.square));
    }
    return out;
  }
  if (ch.mode === "released" && ch.t < CUT.done) {
    const fade = 1 - smooth((ch.t - CUT.punch) / (CUT.done - CUT.punch));
    out.hang = fade;
    out.pads = smooth(ch.t / CUT.pads) * fade;
    out.punch = smooth((ch.t - CUT.pads) / (CUT.punch - CUT.pads)) * fade;
    return out;
  }
  return null;
}

/** The turn his drawing is pitched forward by past his skier's frame, rad
 * (that frame stops short of straight down, `CHUTE.freefall.pitchMost`). */
export function pitchPast(shape: SkydiveShape): number {
  return Math.max(0, shape.attitude - CHUTE.freefall.pitchMost);
}

/** `v` turned by `a` about x (+y toward +z). */
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

/** A LEG's turn off the standing pose: the thigh turned about the hip, the
 * shin (and the boot with it) about the knee, each by a pitch (+ the foot
 * toward his front) and a swing out to his side (+ away from the middle),
 * rad. */
type LegTurn = { thigh: number; out: number; shin: number; shinOut: number };

const BOX_LEG: LegTurn = { thigh: 0.62, out: 0.3, shin: 1.45, shinOut: 0.1 };
const TRACK_LEG: LegTurn = { thigh: 0.5, out: 0.1, shin: 0.25, shinOut: 0 };
const HEAD_LEG: LegTurn = { thigh: 0.42, out: 0.14, shin: 0.4, shinOut: 0.05 };
const DOOR_LEG: LegTurn = { thigh: 0, out: 0.05, shin: 0, shinOut: 0 };
/** Hung in the leg straps, sat a little, the skis hanging. */
const HANG_LEG: LegTurn = { thigh: -0.28, out: 0.06, shin: 0.2, shinOut: 0.02 };
/** What the opening's shock adds: the legs swung forward and up. */
const SHOCK_LEG: LegTurn = { thigh: -0.85, out: 0.12, shin: -0.35, shinOut: 0 };

/** The legs' turn this frame — the weighted sum of the stage's shapes; the
 * flare hands them back to the standing pose for the snow. */
function legTurn(s: SkydiveShape): LegTurn {
  const parts: [LegTurn, number][] = [
    [BOX_LEG, s.box],
    [TRACK_LEG, s.track],
    [HEAD_LEG, s.head],
    [DOOR_LEG, s.door],
    [HANG_LEG, s.hang * (1 - s.flare)],
    [SHOCK_LEG, s.shock],
  ];
  const t: LegTurn = { thigh: 0, out: 0, shin: 0, shinOut: 0 };
  for (const [p, w] of parts) {
    t.thigh += p.thigh * w;
    t.out += p.out * w;
    t.shin += p.shin * w;
    t.shinOut += p.shinOut * w;
  }
  return t;
}

/** Where the hands go, in his body frame (x right, y up, z his front), off
 * the pose's joints: each side's, and how much of the hand the stage owns
 * (the rest the standing pose's), and the elbow's pole. */
function handsOf(p: SkierPose, s: SkydiveShape): { at: [V3, V3]; weight: number; pole: [V3, V3] } {
  const at: [V3, V3] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
  const pole: [V3, V3] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
  let total = 0;
  const put = (i: number, v: V3, w: number, e: V3): void => {
    at[i] = add(at[i], scale(v, w));
    pole[i] = add(pole[i], scale(e, w));
  };
  const ws = [s.door, s.box, s.track, s.head, s.hang * (1 - s.pads), s.pads];
  for (const w of ws) total += w;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const sh = p.shoulders[i];
    const rel = (x: number, y: number, z: number): V3 => add(sh, { x: side * x, y, z });
    // The door: the door's side (his left, −x) up on the handrail over the
    // doorway, the other hand on his knee.
    put(
      i,
      side < 0
        ? add(p.hips, { x: -0.16, y: 0.47, z: 0.24 })
        : add(p.knees[i], { x: 0, y: 0.06, z: 0.1 }),
      s.door,
      { x: side, y: -0.4, z: -0.3 },
    );
    // The box, the arm on the side he turns to dipped toward the earth
    // (his front) and the other lifted.
    const dip = s.turn * side * 0.16;
    put(i, rel(0.34, 0.26, -0.06 + dip), s.box, { x: side, y: -0.3, z: -0.5 });
    put(i, rel(0.24, -0.5, -0.14), s.track, { x: side, y: 0, z: -1 });
    put(i, rel(0.62, 0.04, 0), s.head, { x: 0, y: 1, z: 0 });
    // On the toggles (a toggle drawn down to his hip) or the front risers.
    const pulled = s.toggles[i] * (1 - Math.max(0, s.riser));
    const front = Math.max(0, s.riser);
    const toggle = rel(0.06, 0.4 - 0.72 * pulled, -0.05 + 0.08 * pulled);
    const riser = rel(0.1, 0.36 - 0.18 * front, 0.1);
    put(i, mix(toggle, riser, front), s.hang * (1 - s.pads), { x: side, y: -0.5, z: -0.2 });
    // The cut-away: the main's side on the red pad on his chest strap, the
    // other on the reserve's handle — then the pad punched out and away.
    const pad = add(p.neck, { x: side * 0.1, y: -0.2, z: 0.14 });
    const punched = rel(0.2, -0.12, 0.55);
    put(i, side > 0 ? mix(pad, punched, s.punch) : pad, s.pads, { x: side, y: -1, z: 0 });
  }
  const weight = Math.min(1, total);
  if (total > 1e-6) {
    for (let i = 0; i < 2; i++) {
      at[i] = scale(at[i], 1 / total);
      pole[i] = norm(pole[i]);
    }
  }
  // THE PULL over the rest: the main's side (his right) back to the pouch
  // at the foot of the container and out at arm's length; the other
  // forward over his head.
  const reach = Math.max(s.reach, s.throw);
  if (reach > 0) {
    const pouch = add(p.hips, { x: 0.12, y: -0.08, z: -0.24 });
    const thrown = add(p.shoulders[1], { x: 0.62, y: -0.02, z: -0.12 });
    const right = s.throw > s.reach ? thrown : pouch;
    at[1] = mix(at[1], right, reach);
    pole[1] = norm(mix(pole[1], { x: 0.4, y: 0.3, z: -1 }, reach));
    at[0] = mix(at[0], add(p.shoulders[0], { x: -0.12, y: 0.56, z: 0.04 }), reach);
  }
  // THE RESERVE'S PULL over the rest: the left hand on its handle on the
  // left lift web and punched out forward; the right forward over his head.
  if (s.reserve > 0) {
    const handle = add(p.neck, { x: -0.1, y: -0.2, z: 0.14 });
    const pulled = add(p.shoulders[0], { x: -0.18, y: -0.08, z: 0.55 });
    const w = Math.min(1, s.reserve * 2);
    const pull = smooth((s.reserve - 0.5) * 2);
    at[0] = mix(at[0], mix(handle, pulled, pull), w);
    pole[0] = norm(mix(pole[0], { x: -1, y: -0.6, z: 0 }, w));
    at[1] = mix(at[1], add(p.shoulders[1], { x: 0.12, y: 0.56, z: 0.04 }), w);
  }
  return { at, weight: Math.max(weight, reach, Math.min(1, s.reserve * 2)), pole };
}

/** THE POSE MADE OVER FOR THE SKYDIVE: `p` (the standing pose, his skis on)
 * with its limbs laid as `s` has them, and how each ski moves with its
 * boot (`SkiSwing`, as `swingLegs`). */
export function skydivePose(
  p: SkierPose,
  s: SkydiveShape,
  M: Mounts,
): { pose: SkierPose; skis: [SkiSwing, SkiSwing] } {
  const cuff = M.foot.y - M.ground;
  const knees = [...p.knees] as [V3, V3];
  const feet = [...p.feet] as [V3, V3];
  const boots = [...p.boots] as SkierPose["boots"];
  const leg = legTurn(s);
  const skis = [0, 1].map((i) => {
    const side = i === 0 ? -1 : 1;
    const H = p.hipJoints[i];
    const K = p.knees[i];
    const F = p.feet[i];
    const b = p.boots[i];
    const turnThigh = (v: V3): V3 => rz(side * leg.out, rx(leg.thigh, v));
    const turnShin = (v: V3): V3 => rz(side * (leg.out + leg.shinOut), rx(leg.thigh + leg.shin, v));
    const K2 = add(H, turnThigh(sub(K, H)));
    const F2 = add(K2, turnShin(sub(F, K)));
    const f2 = turnShin(b.f);
    const n2 = turnShin(b.n);
    const sole = add(scale(b.n, cuff), scale(b.f, M.foot.z));
    const base = sub(F, sole);
    const base2 = sub(F2, add(scale(n2, cuff), scale(f2, M.foot.z)));
    knees[i] = K2;
    feet[i] = F2;
    boots[i] = { f: f2, n: n2 };
    // The ski turned as the boot: about its across by the shin's pitch,
    // then about the body's forward by its swing out — `SkiSwing`'s pitch
    // is tips up, its rock the other way round.
    return {
      dx: base2.x - base.x,
      dy: base2.y - base.y,
      dz: base2.z - base.z,
      pitch: -(leg.thigh + leg.shin),
      rock: -side * (leg.out + leg.shinOut),
    };
  }) as [SkiSwing, SkiSwing];
  // THE ARMS: each hand where the stage has it, the elbow solved between.
  const hands = [...p.hands] as [V3, V3];
  const elbows = [...p.elbows] as [V3, V3];
  const plan = handsOf({ ...p, knees }, s);
  if (plan.weight > 0) {
    for (let i = 0; i < 2; i++) {
      const sh = p.shoulders[i];
      const want = mix(p.hands[i], plan.at[i], plan.weight);
      // Never past the arm's reach.
      const reach = BODY.upperArm + BODY.forearm - 0.01;
      const d = sub(want, sh);
      const l = Math.hypot(d.x, d.y, d.z);
      hands[i] = l > reach ? add(sh, scale(d, reach / l)) : want;
      elbows[i] = solveLimb(sh, hands[i], BODY.upperArm, BODY.forearm, plan.pole[i]);
    }
  }
  // THE ARCH: the hips pressed toward the earth (his front) under the box.
  const arch = s.box * 0.06;
  const waist = arch > 0 ? add(p.waist, { x: 0, y: 0, z: arch }) : p.waist;
  return {
    pose: { ...p, knees, feet, boots, hands, elbows, waist, poles: null },
    skis,
  };
}

/** THE STAND A SKYDIVE'S BODY IS LAID FROM: `input` squared up — no turn,
 * edge, skid, fall, trick or gait in it, the skis side by side — so the
 * stage's limbs (`skydivePose`) are laid on a body standing square, never
 * on whatever a long flight's fall clock or a held key would make of him. */
export function squareStand<T extends SkierPoseInput>(input: T): T {
  return {
    ...input,
    roll: 0,
    hipRight: 0,
    hipAft: 0,
    lean: 0,
    steer: 0,
    edge: 0,
    skiAngle: 0,
    body: undefined,
    lead: 0,
    lift: [0, 0],
    spread: [0, 0],
    fore: [0, 0],
    incline: 0,
    carve: 0,
    skid: 0,
    gait: undefined,
    flight: undefined,
    trick: null,
    jolt: undefined,
    plant: 0,
    plantAt: undefined,
  };
}

/** ...and the skis under him squared the same way: side by side, level
 * and still, each leg's compression shared out evenly — in the air the
 * engine's last readings of the snow (an edge, a pivot, one leg loaded)
 * would otherwise turn one leg out of the box and leave the other. */
export function squareSkis(stand: Stand): void {
  const lift = (stand.lift[0] + stand.lift[1]) / 2;
  stand.incline = 0;
  stand.tilt = 0;
  stand.lift = [lift, lift];
  stand.out = [0, 0];
  stand.fore = [0, 0];
  stand.pivot = { x: 0, y: 0 };
  stand.pitch = [0, 0];
  stand.rock = [0, 0];
}
