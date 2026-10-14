// THE POLES as posed (`skierPose`'s last word on them): each rod hung from
// its grip — hanging back, laid under the arms in a tuck, reaching the snow
// for a lone plant — and, working, planted ahead of the boots on the push
// and swept back behind him through it, then swung forward for the next;
// set in the start gate, planted for a turn's touch, put out for a gate's
// block and held on its basket up a sidestep. Split out of `skier-pose.ts`,
// which hands it everything already decided about the arms.

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
import { add, clamp01, mix, norm, scale, sub, turnTo, type V3 } from "./skier-vec.ts";

/** How far back a hanging pole swings from the vertical, rad. */
const POLE_HANG = 0.75;
/** How far over the snow a pole the push cannot plant is held, m at none
 * of a plant — clear of the snow, never skimming along it. */
const POLE_SHY = 0.2;

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
};

/** Each pole's basket, in the body frame. */
export function posePoles(p: PolesIn): [V3, V3] {
  const { hands, M, S, SW, G, gait, ground, crouch, arms, armLength, push } = p;
  return [-1, 1].map((side, i) => {
    const hangDir = norm({ x: side * 0.12, y: -Math.cos(POLE_HANG), z: -Math.sin(POLE_HANG) });
    const tuckDir = norm({ x: side * 0.06, y: 0.1, z: -1 });
    const hung = switchPole(norm(mix(hangDir, tuckDir, crouch)), side, SW);
    // A speed racer's bent poles carried under his arms, stood up too.
    const dir =
      S.underArm > 0
        ? norm(mix(hung, underArmPole(side), S.underArm * (1 - crouch) * (1 - p.working)))
        : hung;
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
          tip = add(hands[i], scale({ x: d.x * k, y, z: d.z * k }, M.pole));
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
