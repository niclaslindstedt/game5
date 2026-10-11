// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT FLYER'S BODY AS POSED (`wingsuit.ts`, drawn by `skis-body.ts`
// and the suit by `wingsuit-figure.ts`) — three-free, so the suite reads it.
// He wears NO SKIS and carries no poles; every stage of the jump is a shape
// his limbs take, laid on the engine's attitude:
//
//   * READY, stood on the exit (a ledge, or a helicopter's skid held in a
//     hover — his left hand up on its door frame), the wings slack;
//   * THE EXIT, stepped off and the limbs opening into the wings as the
//     suit fills with air;
//   * FLYING: the arms out 80–90° from his sides, a little forward and
//     pushed down (the shoulders rolled forward), the elbows nearly
//     straight and the fists on the grips; the legs spread some 25° and
//     straight, the toes pointed to tension the leg wing; the head up,
//     looking ahead and down along his way; a TURN banks the whole body
//     and drops the inside arm; THE DIVE sweeps the arms back to the hips
//     and narrows the legs; THE FLARE spreads arms and legs wide, forward
//     and down;
//   * THE PULL: the right hand back to the pilot chute's pouch at the
//     bottom of the container, then out to the side at arm's length — the
//     throw — the left arm held out for symmetry; the opening's shock
//     swinging his legs down under him;
//   * UNDER THE CANOPY: the arm wings unzipped and hanging off the arms,
//     the hands up on the toggles, the flare drawing both down;
//   * LANDED, on his boots and walking (`party-pose.ts`'s walk).
//
// The decision (`wingsuitShapeOf`) reads the engine's skydive alone and its
// clock, so a frame is the same frame twice.

import { CHUTE, type ChuteState } from "@engine";

import type { SkierPose } from "./skier-joints.ts";
import { BODY, SHIN_ABOVE_CUFF } from "./skier-mounts.ts";
import { solveLimb } from "./skier-limbs.ts";
import { add, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** WHAT HIS BODY IS DOING (`wingsuitShapeOf`): `foot` stood (on the exit)
 * or walking (landed) on his feet, else in the air; on a helicopter's skid
 * (`hover`); how far into the wings he has opened `fly` (0 stood … 1
 * flying); the hands after their lag — `lean` −1 dive … 1 flare, `sweep`
 * the arms swept back, `spread` the wings spread full; the bank, rad
 * (right side down positive); the pull's reach and throw; how far hung in
 * the harness; the toggles; the landing's flare; the opening's shock; how
 * full of air the suit is; how far the arm wings are unzipped; the walk's
 * strides and pace; and the attitude he is drawn at, rad (0 upright … π/2
 * belly to earth). */
export type WingsuitShape = {
  foot: "stand" | "walk" | null;
  hover: boolean;
  fly: number;
  lean: number;
  sweep: number;
  spread: number;
  bank: number;
  reach: number;
  throw: number;
  hang: number;
  toggles: [number, number];
  flare: number;
  shock: number;
  pressure: number;
  unzip: number;
  strides: number;
  pace: number;
  attitude: number;
};

const NONE: WingsuitShape = {
  foot: null,
  hover: false,
  fly: 0,
  lean: 0,
  sweep: 0,
  spread: 0,
  bank: 0,
  reach: 0,
  throw: 0,
  hang: 0,
  toggles: [0, 0],
  flare: 0,
  shock: 0,
  pressure: 0,
  unzip: 0,
  strides: 0,
  pace: 0,
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

/** How long the limbs take to open into the wings off the exit, s. */
export const OPEN = 0.9;
/** THE PULL, s after the press — the skydive's (`skier-skydive.ts`), so the
 * pilot chute leaves his fist when the scene lets it go: the hand at the
 * pouch, the throw out, back. */
const PULL = { at: 0.14, out: 0.42, back: 0.9 };
/** The shock's decay at line stretch and at full inflation, s, and the
 * second one's share. */
const SHOCK = { decay: 0.55, full: 0.45 };
/** The arm wings unzipped once the canopy is flying: s after it is open,
 * and how long the zips take. */
const UNZIP = { after: 1.2, take: 1.6 };
/** His strides walking, a metre of way: a short, hobbled step in a leg
 * wing. */
const STRIDE = 1.15;

/** WHAT HIS BODY IS DOING THIS FRAME in a wingsuit, off the run's skydive
 * (`ch`), or in a plane's door in the suit (`inDoor`); null when the jump
 * is not a wingsuit's (or he lies thrown). */
export function wingsuitShapeOf(
  ch: ChuteState | null | undefined,
  inDoor: boolean,
  hover = false,
): WingsuitShape | null {
  if (!ch) return inDoor ? { ...NONE, foot: "stand" } : null;
  if (ch.suit !== "wingsuit" || ch.done || ch.fell) return null;
  const out: WingsuitShape = { ...NONE, toggles: [0, 0], attitude: ch.attitude };
  const w = ch.wing;
  const flown = (share: number): void => {
    out.fly = share;
    if (!w) return;
    out.lean = w.lean;
    out.sweep = w.sweep;
    out.spread = w.spread;
    out.bank = w.bank;
    out.pressure = w.pressure;
  };
  switch (ch.mode) {
    case "ready":
      return { ...out, foot: "stand", hover, attitude: 0 };
    case "exit":
      flown(smooth(ch.since / OPEN));
      return out;
    case "freefall":
      flown(1);
      return out;
    case "deploying": {
      const d = ch.deploy;
      const t = d?.t ?? 0;
      const stages = CHUTE.base.deploy.stages;
      const stretch = stages[2].end;
      const full = stages[4].end;
      const hang = smooth((t - stretch) / 0.6);
      flown(1 - hang);
      out.pressure = (w?.pressure ?? 1) * (1 - 0.6 * hang);
      out.hang = hang;
      out.reach = window(t, 0, PULL.at, PULL.at + 0.04, 0.12);
      out.throw = window(t, PULL.at, PULL.out - PULL.at, PULL.out + 0.05, PULL.back - PULL.out);
      const kick = (from: number, size: number): number =>
        t < from ? 0 : size * smooth((t - from) / 0.12) * Math.exp(-(t - from) / SHOCK.decay);
      out.shock = Math.min(1, kick(stretch, 1) + kick(full, SHOCK.full));
      return out;
    }
    case "open":
    case "snagged": {
      out.hang = 1;
      out.pressure = 0.25;
      const caught = ch.mode === "snagged";
      const k = ch.controls;
      out.toggles = caught
        ? [0.15, 0.15]
        : [clamp01(k.brake + Math.max(0, -k.steer)), clamp01(k.brake + Math.max(0, k.steer))];
      out.unzip = caught ? 1 : smooth((ch.t - UNZIP.after) / UNZIP.take);
      out.shock = caught ? 0 : SHOCK.full * Math.exp(-ch.t / SHOCK.decay) * 0.6;
      if (!caught) {
        const F = CHUTE.flare;
        out.flare = smooth((F.stand - ch.agl) / (F.stand - F.square));
      }
      return out;
    }
    case "landed":
      return {
        ...out,
        foot: "walk",
        unzip: 1,
        attitude: 0,
        pace: clamp01(ch.airspeed / 1.4),
        strides: ch.since / STRIDE,
      };
    default:
      return null;
  }
}

/** The turn his drawing is pitched forward by past his skier's frame, rad
 * (that frame stops short of belly to earth, `CHUTE.freefall.pitchMost`),
 * and the bank it is rolled by. */
export function wingsuitTilt(s: WingsuitShape): { pitch: number; bank: number } {
  if (s.foot) return { pitch: 0, bank: 0 };
  const air = 1 - s.hang;
  return {
    pitch: Math.max(0, s.attitude - CHUTE.freefall.pitchMost),
    bank: s.bank * air,
  };
}

/** A LEG laid straight off its hip: turned `out` rad from straight down
 * (+ away from the middle) and `fore` rad toward his front, the knee bent
 * `knee` rad (the shin swung back), the toes pointed `point` rad. */
type LegLay = { out: number; fore: number; knee: number; point: number };

const STAND_LEG: LegLay = { out: 0.02, fore: 0, knee: 0.05, point: 0 };
/** Flying: some 25° between the legs, straight, a little down toward the
 * earth (his front), the toes pointed. */
const FLY_LEG: LegLay = { out: 0.21, fore: 0.06, knee: 0.04, point: 1.05 };
/** The dive: the legs closed to narrow the leg wing. */
const DIVE_LEG: LegLay = { out: 0.1, fore: 0, knee: 0.02, point: 1.2 };
/** The flare: wide, pushed open and down. */
const FLARE_LEG: LegLay = { out: 0.3, fore: 0.3, knee: 0.1, point: 0.8 };
/** Hung in the harness: the legs together and a little forward, the knees
 * soft; the shock swings them forward under him. */
const HANG_LEG: LegLay = { out: 0.07, fore: 0.18, knee: 0.15, point: 0.3 };
const SHOCK_LEG: LegLay = { out: 0.03, fore: 0.55, knee: 0.25, point: 0 };
/** The landing's flare: the legs brought under him for the snow. */
const LAND_LEG: LegLay = { out: 0.06, fore: 0.25, knee: 0.35, point: -0.1 };

function legLay(s: WingsuitShape): LegLay {
  const air = s.fly;
  const fly = air * (1 - s.sweep * 0.7) * (1 - s.spread * 0.8);
  const parts: [LegLay, number][] = [
    [STAND_LEG, 1 - air - s.hang],
    [FLY_LEG, fly],
    [DIVE_LEG, air * s.sweep * 0.7],
    [FLARE_LEG, air * s.spread * 0.8 * (1 - s.sweep * 0.7)],
    [HANG_LEG, s.hang * (1 - s.flare)],
    [LAND_LEG, s.hang * s.flare],
  ];
  const t: LegLay = { out: 0, fore: 0, knee: 0, point: 0 };
  let total = 0;
  for (const [p, w0] of parts) {
    const w = Math.max(0, w0);
    total += w;
    t.out += p.out * w;
    t.fore += p.fore * w;
    t.knee += p.knee * w;
    t.point += p.point * w;
  }
  if (total > 1e-6) {
    t.out /= total;
    t.fore /= total;
    t.knee /= total;
    t.point /= total;
  }
  t.fore += SHOCK_LEG.fore * s.shock;
  t.knee += SHOCK_LEG.knee * s.shock;
  // A dive's lean forward (the legs a little higher) and a flare's back
  // (pushed down) beyond the shapes.
  t.fore += 0.08 * s.lean * air;
  return t;
}

/** Where the hands go in his body frame (x right, y up his spine — the way
 * he flies — z out of his chest, toward the earth flying), off the
 * shoulders: each side's, and the elbow's pole. */
function handsOf(p: SkierPose, s: WingsuitShape): { at: [V3, V3]; pole: [V3, V3] } {
  const at: [V3, V3] = [p.hands[0], p.hands[1]];
  const pole: [V3, V3] = [
    { x: -1, y: -0.4, z: -0.3 },
    { x: 1, y: -0.4, z: -0.3 },
  ];
  const reach = BODY.upperArm + BODY.forearm - 0.003;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const sh = p.shoulders[i];
    const along = (x: number, y: number, z: number, k = reach): V3 =>
      add(sh, scale(norm({ x: side * x, y, z }), k));
    // FLYING: out from his sides, a little forward and pushed down; the
    // dive sweeps them back toward the hips, the flare forward and wide; a
    // turn drops the inside arm toward the earth.
    const inside = Math.max(0, s.bank * side);
    const flying = along(0.95, 0.12 + 0.1 * s.lean, 0.26 + 0.18 * inside);
    const dive = along(0.5, -0.82, 0.22);
    const flare = along(0.86, 0.42, 0.3);
    const wing = mix(mix(flying, flare, s.spread * (1 - s.sweep)), dive, s.sweep);
    // STOOD: the arms down his sides in the slack wings, held a little out.
    const stood = add(sh, { x: side * 0.1, y: -0.56, z: 0.08 });
    let hand = mix(stood, wing, s.fly);
    // HUNG: on the toggles (a toggle drawn down to his hip).
    const pulled = s.toggles[i];
    const toggle = add(sh, { x: side * 0.06, y: 0.42 - 0.72 * pulled, z: -0.04 + 0.1 * pulled });
    hand = mix(hand, toggle, s.hang);
    at[i] = hand;
    const flyPole = { x: side, y: -0.2, z: -1 };
    const hangPole = { x: side, y: -0.5, z: -0.2 };
    pole[i] = norm(mix(mix(pole[i], flyPole, s.fly), hangPole, s.hang));
  }
  // ON THE SKID: his left hand up on the helicopter's door frame beside him.
  if (s.hover && s.foot) at[0] = add(p.shoulders[0], { x: -0.22, y: 0.36, z: 0.06 });
  // THE PULL: his right hand back to the pouch at the foot of the container
  // and out at arm's length; his left held out in the wing.
  const pull = Math.max(s.reach, s.throw);
  if (pull > 0) {
    const pouch = add(p.hips, { x: 0.1, y: -0.06, z: -0.2 });
    const thrown = add(p.shoulders[1], { x: 0.6, y: -0.06, z: -0.2 });
    at[1] = mix(at[1], s.throw > s.reach ? thrown : pouch, pull);
    pole[1] = norm(mix(pole[1], { x: 0.4, y: 0.3, z: -1 }, pull));
  }
  return { at, pole };
}

/** THE POSE MADE OVER FOR THE WINGSUIT: `p` (a square stand, `squareStand`)
 * with the legs laid straight off the hips, the toes pointed, the arms where
 * the stage has them, the trunk straightened and the head lifted to look
 * along his way. The poles are gone. */
export function wingsuitPose(p: SkierPose, s: WingsuitShape): SkierPose {
  // WALKING, the walk's own pose: the arm wings unzipped and hanging.
  if (s.foot === "walk") return { ...p, poles: null };
  const lay = legLay(s);
  const knees = [...p.knees] as [V3, V3];
  const feet = [...p.feet] as [V3, V3];
  const boots = [...p.boots] as SkierPose["boots"];
  // THE HIPS pushed a little toward the earth flying (a mild de-arch), the
  // hip joints carried with them.
  const hips = add(p.hips, { x: 0, y: 0, z: 0.03 * s.fly });
  const shift = sub(hips, p.hips);
  const hipJoints = p.hipJoints.map((h) => add(h, shift)) as [V3, V3];
  // Stood, on the legs the stand put under him.
  for (let i = 0; i < 2 && !s.foot; i++) {
    const side = i === 0 ? -1 : 1;
    const H = hipJoints[i];
    const down: V3 = {
      x: side * Math.sin(lay.out),
      y: -Math.cos(lay.out) * Math.cos(lay.fore),
      z: Math.cos(lay.out) * Math.sin(lay.fore),
    };
    const K = add(H, scale(down, BODY.thigh));
    // The shin swung back by the knee's bend, about the leg's across.
    const front = norm({ x: 0, y: down.z, z: -down.y });
    const shin = norm(add(scale(down, Math.cos(lay.knee)), scale(front, -Math.sin(lay.knee))));
    const F = add(K, scale(shin, SHIN_ABOVE_CUFF));
    // The foot: its sole square to the shin and the toes ahead, turned down
    // the shin's line by the point.
    const fFront = norm(
      sub(front, scale(shin, front.x * shin.x + front.y * shin.y + front.z * shin.z)),
    );
    const c = Math.cos(lay.point);
    const sn = Math.sin(lay.point);
    boots[i] = {
      f: norm(add(scale(fFront, c), scale(shin, sn))),
      n: norm(add(scale(shin, -c), scale(fFront, sn))),
    };
    knees[i] = K;
    feet[i] = F;
  }
  // THE SHOULDERS rolled forward and down flying.
  const roll = { x: 0, y: -0.01 * s.fly, z: 0.03 * s.fly };
  const shoulders = p.shoulders.map((q) => add(q, roll)) as [V3, V3];
  const waist = add(p.waist, scale(shift, 0.5));
  const neck = add(p.neck, roll);
  const head = add(p.head, roll);
  const plan = handsOf({ ...p, hips, shoulders }, s);
  const hands = [...p.hands] as [V3, V3];
  const elbows = [...p.elbows] as [V3, V3];
  for (let i = 0; i < 2; i++) {
    const sh = shoulders[i];
    const d = sub(plan.at[i], sh);
    const l = Math.hypot(d.x, d.y, d.z);
    const most = BODY.upperArm + BODY.forearm - 0.003;
    hands[i] = l > most ? add(sh, scale(d, most / l)) : plan.at[i];
    elbows[i] = solveLimb(sh, hands[i], BODY.upperArm, BODY.forearm, plan.pole[i]);
  }
  // THE HEAD: flying, lifted to look along his way and down some 30° below
  // the horizon — the rig's head turn (`skier-rig.ts`'s `headAxes`) is
  // −0.2 + 0.3 × pitch about his across, so the pitch is written for it.
  const look = -0.2 - (Math.PI / 2 - 0.62) * s.fly * (1 - s.hang);
  return {
    ...p,
    hips,
    hipJoints,
    waist,
    neck,
    head,
    shoulders,
    knees,
    feet,
    boots,
    hands,
    elbows,
    poles: null,
    pitch: (look + 0.2) / 0.3 + p.pitch * (1 - s.fly),
    look: 0,
    headRoll: -s.bank * 0.4 * s.fly,
  };
}
