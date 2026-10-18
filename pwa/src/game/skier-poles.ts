// THE POLES as posed (`skierPose`'s last word on them): each rod hung from
// its grip — hanging back, laid under the arms in a tuck, reaching the snow
// for a lone plant — and, working, planted ahead of the boots on the push
// and swept back behind him through it, then swung forward for the next;
// set in the start gate, planted for a turn's touch, put out for a gate's
// block and held on its basket up a sidestep — and a hung rod never run
// through him: swung clear of his trunk and thighs (`clearBody`). Split
// out of `skier-pose.ts`, which hands it everything already decided about
// the arms and the body.

import type { Gait } from "./skier-gait.ts";
import type { Mounts } from "./skier-mounts.ts";
import type { GateShape } from "./slalom-start.ts";
import type { HeldPush, Stroke } from "./skier-stroke.ts";
import {
  armAt,
  DOUBLE_ARM,
  DOUBLE_BASKET,
  plantPole,
  STRIDE_STROKE,
  strokeHand,
  strokePole,
} from "./skier-stroke.ts";
import { switchPole, type SwitchShape } from "./skier-switch.ts";
import { blockPole, underArmPole, type TechniquePose } from "./technique-pose.ts";
import { toward } from "./skier-sidestep.ts";
import { add, clamp01, dot, len, mix, norm, scale, sub, turnTo, type V3 } from "./skier-vec.ts";

/** How far back a hanging pole swings from the vertical, rad. */
const POLE_HANG = 0.75;
/** How far over the snow a pole the push cannot plant is held, m at none
 * of a plant — clear of the snow, never skimming along it. */
const POLE_SHY = 0.2;

/** WHAT A HUNG POLE PASSES OUTSIDE OF: the trunk and the thighs as
 * capsules round their bones, each radius the body and his clothes over it
 * (the metrics lab's, `skier-measure.mjs`) and the rod's own with a
 * finger's room to spare, m. A rod laid back under the arms in a tuck runs
 * past the hips on its own side — but with the hips swung in under the
 * inside fist in a turn, or the trunk folded down over it in the air, the
 * same rod held in the body's frame would run straight through them. */
const POLE_CLEAR = { trunk: 0.18, thigh: 0.09 };
/** How far down the rod from the fist the clearing starts, m — the grip
 * is in the fist, which the arm already holds clear of him. */
const CLEAR_FROM = 0.2;
/** How much further than a point's own depth a rod is swung: the swing
 * out to the side carries a point only partly away from the bone it was
 * in, so it is swung on past that, enough to leave it clear. */
const CLEAR_GAIN = 1.6;

/** The body a hung pole is swung clear of. */
export type PoleBody = {
  hips: V3;
  waist: V3;
  neck: V3;
  hipJoints: [V3, V3];
  knees: [V3, V3];
};

/** What the pose has decided that the poles hang off. */
export type PolesIn = {
  hands: [V3, V3];
  M: Mounts;
  S: TechniquePose;
  SW: SwitchShape;
  G: GateShape;
  gait: Gait;
  /** The snow under him in the body frame, m. */
  ground: number;
  crouch: number;
  working: number;
  lone: number;
  arms: number;
  armLength: number;
  double: { y: number; z: number };
  push: HeldPush | null;
  duty: number;
  stridePhase: number[];
  strideSwing: number[];
  strideDuty: number;
  ready: number;
  plant?: { side: number; w: number; u: number };
  block?: { hand: number; w: number };
  baskets: [V3, V3] | null;
  climbW: number;
  /** His trunk and thighs, which a hung pole is swung clear of; none
   * cleared when left out. */
  body?: PoleBody;
};

/** The point of segment `a`–`b` nearest `p`. */
function nearestOn(p: V3, a: V3, b: V3): V3 {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 > 1e-12 ? clamp01(dot(sub(p, a), ab) / l2) : 0;
  return add(a, scale(ab, t));
}

/** A HUNG ROD SWUNG CLEAR OF HIM: the direction `dir` of a pole of
 * `length` held in the fist at `hand` on `side` (−1 left), swung out about
 * the fist toward his own side by as far as it went into him — for every
 * point down it from `CLEAR_FROM`, the turn that would carry that point
 * out by its depth inside his trunk or a thigh, and the most of them. A
 * rod clear of him is handed back as it came, and the swing grows from
 * nothing as the body comes to it: it is the depth's own measure, never a
 * search for the least turn that clears, which jumps from one way out to
 * another as the body closes a gap between two of his parts. A capsule the
 * fist comes inside (a grab at the boot) reaches no further than the fist,
 * shrinking as the fist comes in rather than dropping out at once. */
export function clearBody(hand: V3, dir: V3, side: number, length: number, body: PoleBody): V3 {
  const gapTo = (p: V3, a: V3, b: V3): number => len(sub(p, nearestOn(p, a, b)));
  const all: [V3, V3, number][] = [
    [body.hips, body.waist, POLE_CLEAR.trunk],
    [body.waist, body.neck, POLE_CLEAR.trunk],
    [body.hipJoints[0], body.knees[0], POLE_CLEAR.thigh],
    [body.hipJoints[1], body.knees[1], POLE_CLEAR.thigh],
  ];
  let turn = 0;
  for (const [a, b, r0] of all) {
    const r = Math.min(r0, gapTo(hand, a, b));
    for (let s = CLEAR_FROM; s <= length + 1e-9; s += 0.05) {
      const deep = r - gapTo(add(hand, scale(dir, s)), a, b);
      if (deep > 0) turn = Math.max(turn, Math.asin(Math.min(1, deep / s)));
    }
  }
  if (turn === 0) return dir;
  const out: V3 = { x: side, y: 0, z: 0 };
  const apart = Math.acos(Math.max(-1, Math.min(1, dot(dir, out))));
  return apart > 1e-6 ? turnTo(dir, out, Math.min(1, (CLEAR_GAIN * turn) / apart)) : dir;
}

/** Each pole's basket, in the body frame. */
export function posePoles(p: PolesIn): [V3, V3] {
  const { hands, M, S, SW, G, gait, ground, crouch, arms, armLength, push } = p;
  return [-1, 1].map((side, i) => {
    const hangDir = norm({ x: side * 0.12, y: -Math.cos(POLE_HANG), z: -Math.sin(POLE_HANG) });
    const tuckDir = norm({ x: side * 0.06, y: 0.1, z: -1 });
    const hung = switchPole(norm(mix(hangDir, tuckDir, crouch)), side, SW);
    // A speed racer's bent poles carried under his arms, stood up too.
    const under =
      S.underArm > 0
        ? norm(mix(hung, underArmPole(side), S.underArm * (1 - crouch) * (1 - p.working)))
        : hung;
    // ...swung clear of him — but a pole the arms work is the stroke's, its
    // basket pinned where it bit (`holdPush`), so the swing gives way to it
    // as they take it up.
    const dir =
      p.body && p.working < 1
        ? turnTo(under, clearBody(hands[i], under, side, M.pole, p.body), 1 - p.working)
        : under;
    const free = add(hands[i], scale(dir, M.pole));
    const planted: V3 = { x: side * 0.4, y: ground, z: M.poleReach * 0.9 };
    let tip = mix(free, planted, p.lone * (side > 0 ? 1 : 0.35));
    // The fist at another point of a stroke, everything else held.
    const handIn = (st: Stroke, w: number, now: number) => (at: number) => {
      const a = strokeHand(st, now);
      const b = strokeHand(st, at);
      return { x: hands[i].x, y: hands[i].y + w * (b.y - a.y), z: hands[i].z + w * (b.z - a.z) };
    };
    if (gait.stride > 0) {
      const dir = strokePole(
        STRIDE_STROKE.basket,
        side,
        ground,
        p.stridePhase[i],
        p.strideDuty,
        handIn(STRIDE_STROKE, gait.stride, p.strideSwing[i]),
        M.pole,
        undefined,
        hands[i],
      );
      tip = add(hands[i], scale(norm(mix(norm(sub(tip, hands[i])), dir, gait.stride)), M.pole));
    }
    if (arms > 0) {
      // The fist at another point of the push, its shoulder held.
      const now = push ? push.arm[i] : p.double;
      const handAt = (at: number): V3 => {
        const b = armAt(DOUBLE_ARM, at, true);
        return {
          x: hands[i].x,
          y: hands[i].y + arms * armLength * (b.y - now.y),
          z: hands[i].z + arms * armLength * (b.z - now.z),
        };
      };
      const dir = strokePole(
        DOUBLE_BASKET,
        side,
        ground,
        gait.phase,
        p.duty,
        handAt,
        M.pole,
        push?.held[i],
        hands[i],
      );
      // Double-poling, a pole pushed on is IN the snow or it is not: half
      // a stroke blended with the hang lifts a planted basket and drags
      // it. Beside the diagonal stride it is shared by the arms as ever.
      const w = clamp01(2 * arms) + (arms - clamp01(2 * arms)) * clamp01(4 * gait.stride);
      tip = add(hands[i], scale(turnTo(norm(sub(tip, hands[i])), dir, w), M.pole));
      // A POLE THE PUSH CANNOT PLANT is held clear of the snow, never
      // skimming along it — the rod tipped up at the fist just enough,
      // its heading kept.
      const shy = POLE_SHY * (1 - gait.keep) * w;
      if (shy > 0) {
        const floor = ground + shy - hands[i].y;
        const d = norm(sub(tip, hands[i]));
        if (d.y * M.pole < floor) {
          const y = Math.max(-1, Math.min(1, floor / M.pole));
          const flat = Math.hypot(d.x, d.z);
          const k = flat > 1e-6 ? Math.sqrt(1 - y * y) / flat : 0;
          // ...as far as the stroke has the pole (a rod the stroke barely
          // holds is lifted barely: past a frame's worth it flicks).
          tip = mix(tip, add(hands[i], scale({ x: d.x * k, y, z: d.z * k }, M.pole)), w);
        }
      }
    }
    if (p.ready > 0) {
      // In the gate, planted ahead: the basket on the snow as far ahead of
      // the fist as the rod reaches, the pole leant forward to it.
      const h = hands[i];
      const x = side * G.basket;
      const reach = M.pole * M.pole - (h.y - ground) ** 2 - (x - h.x) ** 2;
      const ahead = norm(sub({ x, y: ground, z: h.z + Math.sqrt(Math.max(0, reach)) }, h));
      const w = p.ready * (1 - arms);
      tip = add(h, scale(norm(mix(norm(sub(tip, h)), ahead, w)), M.pole));
    }
    if (p.plant && p.plant.side === i && p.plant.w > 0) {
      const hang = norm(sub(tip, hands[i]));
      const dir = plantPole(hang, hands[i], ground, side, p.plant.u, M.pole);
      tip = add(hands[i], scale(norm(mix(hang, dir, p.plant.w)), M.pole));
    }
    if (p.block && p.block.w > 0 && i === p.block.hand) {
      const was = norm(sub(tip, hands[i]));
      tip = add(hands[i], scale(norm(mix(was, blockPole(i as 0 | 1), p.block.w)), M.pole));
    }
    if (p.baskets) {
      const was = norm(sub(tip, hands[i]));
      tip = add(hands[i], scale(toward(was, hands[i], p.baskets[i], p.climbW), M.pole));
    }
    return tip;
  }) as [V3, V3];
}
