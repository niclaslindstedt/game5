// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER IN TOWN, AS DRAWN (`town.ts`): out of his bindings, the pair up
// onto his shoulder, walking the streets with it, and down and back in —
// keys on the moves' own body (`party-pose.ts`), with his HANDS ON THE
// SKIS wherever the engine has placed them and his POLES in his hands.
//
//   * OUT: stood on the bindings, the right pole's tip reached back onto
//     the right heel piece's lever and leant on till it pops, the boot
//     stepped out heel first and back; then the left; then a step back off
//     the pair. The feet are kept where they are on the snow while the
//     body steps back over them (`planted`).
//   * PICK: both poles in the left fist, bent for the pair at the bindings,
//     stood up with it on its tails and clapped, then swung up onto the
//     right shoulder — the right hand riding the pair to its grip well out
//     in front, the left hanging with the poles.
//   * WALK: the moves' walk with the right hand on the pair and the poles
//     swung in the left, the trunk held quiet under the load.
//   * DROP and CLIP: the same back the other way, and both boots stamped
//     into the bindings with a pole planted in each hand.
//
// Three-free, so the suite reads it.

import { TOWN, TOWN_KEYS, strideBob, stridePace, townEase, townShare } from "@engine";
import type { LoneSki, SkierState, TownWalk } from "@engine";

import type { Level } from "@engine";

import { footY } from "./dog-walk-net.ts";
import { ANKLE, STAND, blend, keyPoints, v, type Key } from "./party-pose.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import type { SkierPose } from "./skier-pose.ts";
import { add, dot, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** What the figure is handed for one frame in town: the beat and how far
 * into it, how far he has walked and how full a stride, and the pair where
 * the engine has it — each ski's boot middle (`b`), its tip's way (`d`) and
 * out of its topsheet (`u`) — in the body's own frame (x right, y up off
 * the snow, z ahead). */
export type TownMove = {
  phase: TownWalk["phase"];
  k: number;
  walked: number;
  pace: number;
  skis: { b: V3; d: V3; u: V3 }[];
};

/** How high the boot stands on its binding, m. */
const ON_SKI = 0.05;
/** Where a heel piece's lever is, behind the boot's middle, m. */
const HEEL = -0.2;

/** HOW FAR HE STANDS OVER THE ENGINE'S GROUND, as drawn, m: the street's
 * drawn surface (a road's, a sidewalk's on its kerb, the snow's — where a
 * walker's foot stands, `footY`), eased up onto it as he steps out of the
 * bindings and back down as he steps into them — the skier on his skis is
 * drawn on the engine's ground. */
export function townLift(w: TownWalk, level: Level, x: number, z: number): number {
  const over = streetOver(level, x, z);
  const k = townShare(w);
  const share =
    w.phase === "out"
      ? townEase(k, [0.05, 0.4])
      : w.phase === "clip"
        ? 1 - townEase(k, [0.7, 1])
        : 1;
  return over * share;
}

/** How far the street as drawn stands over the engine's ground, m. */
export function streetOver(level: Level, x: number, z: number): number {
  return Math.max(0, footY(level, x, z) - level.groundAt(x, z));
}

/** How far a ski of the pair is lifted onto the drawn street: laid on
 * it, onto its CROWN — the lanes are drawn cambered up to 4 cm over their
 * edges (`street-plan.ts`), and all of it from the first moment; in his
 * hands or on his shoulder, as far as his body is (`figure`), so the pair
 * never parts from the hand holding it. Between, by how far its lower end
 * is off the ground. */
export function skiLift(ski: LoneSki, level: Level, street: number, figure: number): number {
  const E = ski.ends;
  const low = Math.min(E[1] - level.groundAt(E[0], E[2]), E[4] - level.groundAt(E[3], E[5]));
  const laid = street > 0 ? street + 0.04 : 0;
  const held = Math.min(1, Math.max(0, low / 0.3));
  return laid + (figure - laid) * held;
}

/** The engine's walk read in the body's frame. */
export function townMove(w: TownWalk, skier: SkierState): TownMove {
  const h = skier.heading;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const ground = skier.y - skier.spec.cogHeight;
  const toBody = (x: number, y: number, z: number, at: boolean): V3 => {
    const dx = at ? x - skier.x : x;
    const dz = at ? z - skier.z : z;
    return v(dx * fz - dz * fx, at ? y - ground : y, dx * fx + dz * fz);
  };
  return {
    phase: w.phase,
    k: townShare(w),
    walked: w.walked,
    pace: stridePace(skier.speed),
    skis: w.skis.map((s) => {
      const E = s.ends;
      const m = s.mount;
      const d = toBody(E[0] - E[3], E[1] - E[4], E[2] - E[5], false);
      const n = Math.hypot(d.x, d.y, d.z) || 1;
      return {
        b: toBody(
          E[3] + (E[0] - E[3]) * m,
          E[4] + (E[1] - E[4]) * m,
          E[5] + (E[2] - E[5]) * m,
          true,
        ),
        d: scale(d, 1 / n),
        u: toBody(s.up[0], s.up[1], s.up[2], false),
      };
    }),
  };
}

/** Stood on the bindings: the knees a little bent, the poles held. */
const ON_SKIS: Key = {
  ...STAND,
  hipY: STAND.hipY - 0.04 + ON_SKI,
  pitch: 0.12,
  feet: [v(-0.13, ANKLE + ON_SKI, 0), v(0.13, ANKLE + ON_SKI, 0)],
  hands: [v(-0.3, 0.98, 0.16), v(0.3, 0.98, 0.16)],
};
/** Bent for the pair lying in front of him. */
const STOOP: Key = {
  ...STAND,
  hipY: 0.66,
  hipZ: -0.16,
  pitch: 1.15,
  nod: -0.35,
  feet: [v(-0.17, ANKLE, 0.02), v(0.16, ANKLE, 0.12)],
  hands: [v(-0.1, 0.12, 0.6), v(0.12, 0.12, 0.6)],
};
/** Stood with the pair on his shoulder. */
const CARRY: Key = { ...STAND, pitch: 0.06, hands: [v(-0.3, 0.9, 0.12), v(0.25, 1.3, 0.3)] };

const ease = (k: number): number => k * k * (3 - 2 * k);
const span = (k: number, a: number, b: number): number =>
  ease(Math.max(0, Math.min(1, (k - a) / (b - a))));
/** Up and down over [a, b]: 0, 1 at its middle, 0. */
const arc = (k: number, a: number, b: number): number =>
  Math.sin(Math.PI * Math.max(0, Math.min(1, (k - a) / (b - a))));

/** Where the hand grips the pair: on the UPPER ski's topsheet (the left
 * one), `along` m from its boot's middle toward its tip. */
function gripOn(m: TownMove, along: number): V3 {
  const s = m.skis[0];
  return add(add(s.b, scale(s.d, along)), scale(s.u, 0.05));
}

/** A ski's boot middle, a hand's width over its topsheet. */
function binding(m: TownMove, i: number): V3 {
  const s = m.skis[i];
  return add(s.b, scale(s.u, 0.06));
}

/** How far up off the snow the pair has come, 0 lying .. 1 on its tails. */
function raised(m: TownMove): number {
  const d = m.skis[0].d;
  return Math.max(0, Math.min(1, Math.abs(d.y)));
}

/** The grip out along the pair on the shoulder, m from the boot's middle. */
const GRIP = TOWN.carry.behind + 0.38;

/** THE KEY in town, and where the poles are: each pole's tip, and the hand
 * holding it (both in the left fist off the skis). */
export type TownKey = { key: Key; tips: [V3, V3]; grips: [V3, V3] };

/** A pole held in `hand`, hanging the way `down` points (its tip `pole` m
 * off). */
function hung(hand: V3, down: V3, pole: number): V3 {
  return add(hand, scale(norm(down), pole));
}

/** THE KEY a frame in town is at. */
export function townKey(m: TownMove, pole: number): TownKey {
  const k = m.k;
  let key: Key;
  let tips: [V3, V3];
  let grips: [V3, V3] | null = null;
  /** Both poles in the left fist, hanging back along his side. */
  const inLeft = (hand: V3): void => {
    tips = [hung(hand, v(-0.05, -0.75, -0.62), pole), hung(hand, v(-0.12, -0.72, -0.66), pole)];
    grips = [hand, add(hand, v(0.01, 0.02, 0.0))];
  };
  /** Each pole planted beside him from its own fist. */
  const planted = (key: Key): [V3, V3] => [
    hung(key.hands[0], v(-0.12, -1, 0.3), pole),
    hung(key.hands[1], v(0.12, -1, 0.3), pole),
  ];
  switch (m.phase) {
    case "out": {
      // The body steps back off the pair over its last beat; the feet are
      // kept where they stand on the snow while it does.
      const back = -TOWN.back * townEase(k, TOWN_KEYS.stepBack);
      key = blend(ON_SKIS, STAND, span(k, 0.3, 0.8));
      key.hands = [...ON_SKIS.hands] as [V3, V3];
      tips = planted(key);
      for (const [i, a, b] of [
        [1, 0.08, 0.42],
        [0, 0.42, 0.76],
      ] as const) {
        const side = i ? 1 : -1;
        // The pole's tip reached back onto the heel piece and leant on.
        const press = arc(k, a, b);
        const heel = v(side * 0.15, ON_SKI + 0.04, HEEL - back);
        const lean = add(heel, scale(norm(v(side * 0.15, 0.85, 0.55)), pole));
        key.hands[i] = mix(key.hands[i], lean, press);
        if (press > 0) tips[i] = mix(tips[i], heel, Math.min(1, press * 1.6));
        // ...the heel popped, the boot out heel first and set down behind.
        const out = span(k, a + (b - a) * 0.55, b);
        const lift = arc(k, a + (b - a) * 0.55, b) * 0.12;
        const from = v(side * 0.13, ANKLE + ON_SKI, 0);
        const to = v(side * 0.15, ANKLE, -TOWN.back);
        const at = mix(from, to, out);
        key.feet[i] = v(at.x, at.y + lift, at.z - back);
        key.hipX += side * 0.04 * arc(k, a, b);
      }
      key.hipZ -= 0.06 * arc(k, 0.74, 1);
      key.pitch += 0.12 * (arc(k, 0.08, 0.42) + arc(k, 0.42, 0.76));
      key.nod = -0.3;
      break;
    }
    case "pick": {
      const left = v(-0.3, 0.86, 0.1);
      if (k < TOWN_KEYS.lift[0]) {
        // Bent for it, the right pole handed to the left fist on the way.
        const down = span(k, 0, TOWN_KEYS.lift[0]);
        key = blend(STAND, STOOP, down);
        key.hands = [
          mix(v(-0.3, 0.86, 0.1), binding(m, 0), down),
          mix(v(0.3, 0.9, 0.12), binding(m, 1), down),
        ];
        inLeft(key.hands[0]);
      } else if (k < TOWN_KEYS.swing[0]) {
        // Up with the pair onto its tails, a hand at each binding.
        key = blend(STOOP, STAND, raised(m));
        key.hands = [binding(m, 0), binding(m, 1)];
        inLeft(key.hands[0]);
      } else {
        // Swung up onto the shoulder: the right hand riding it, sliding
        // out to the grip; the left let down with the poles.
        const up = span(k, TOWN_KEYS.swing[0], 1);
        key = blend(STAND, CARRY, up);
        const along = GRIP * span(k, TOWN_KEYS.swing[0] + 0.12, 1);
        key.hands = [
          mix(binding(m, 0), left, span(k, TOWN_KEYS.swing[0], TOWN_KEYS.swing[0] + 0.16)),
          gripOn(m, along),
        ];
        inLeft(key.hands[0]);
      }
      break;
    }
    case "drop": {
      const left = v(-0.3, 0.86, 0.1);
      const [u0, u1] = TOWN_KEYS.unswing;
      const [l0, l1] = TOWN_KEYS.lower;
      if (k < u1) {
        key = blend(CARRY, STAND, span(k, u0, u1));
        const along = GRIP * (1 - span(k, u0, u0 + (u1 - u0) * 0.7));
        key.hands = [mix(left, binding(m, 0), span(k, u1 - 0.12, u1)), gripOn(m, along)];
      } else {
        // Down with it onto the snow, then up again.
        const low = span(k, l0, l1);
        const rise = span(k, l1, 1);
        key = blend(blend(STAND, STOOP, low), STAND, rise);
        const held: [V3, V3] = [binding(m, 0), binding(m, 1)];
        key.hands = [mix(held[0], left, rise), mix(held[1], v(0.3, 0.98, 0.16), rise)];
      }
      inLeft(key.hands[0]);
      if (k > 0.86) {
        // The right pole taken back into its own hand.
        const back = span(k, 0.86, 1);
        const planted_ = planted(key);
        tips = [tips![0], mix(tips![1], planted_[1], back)];
        grips = [grips![0], mix(grips![1], key.hands[1], back)];
      }
      break;
    }
    case "clip": {
      // The step onto the pair, then each boot: the toe set in, the heel
      // stamped down.
      const on = townEase(k, TOWN_KEYS.stepOn);
      const shift = -TOWN.back * (1 - on);
      key = blend(STAND, ON_SKIS, span(k, 0.1, 0.4));
      key.hands = [v(-0.3, 0.98, 0.16), v(0.3, 0.98, 0.16)];
      for (const [i, a, b] of [
        [1, 0.0, 0.18],
        [0, 0.12, 0.3],
      ] as const) {
        const side = i ? 1 : -1;
        const step = span(k, a, b);
        const from = v(side * 0.15, ANKLE, 0);
        const to = v(side * 0.13, ANKLE + ON_SKI, -shift);
        const at = mix(from, to, step);
        key.feet[i] = v(at.x, at.y + arc(k, a, b) * 0.1, at.z + shift);
      }
      for (const [i, a] of [
        [1, 0.3],
        [0, 0.66],
      ] as const) {
        const s = arc(k, a, a + 0.24);
        key.feet[i] = add(key.feet[i], v(0, s * 0.1, 0.05 * s));
        key.hipX += (i ? -1 : 1) * 0.05 * s;
      }
      key.pitch = 0.28;
      key.nod = -0.35;
      tips = planted(key);
      break;
    }
    default: {
      // WALKING with the pair on his shoulder.
      key = { ...CARRY, feet: [...CARRY.feet] as [V3, V3], hands: [...CARRY.hands] as [V3, V3] };
      const pace = m.pace;
      const ph = (m.walked / TOWN.stride) * Math.PI * 2 * 0.85;
      const stride = 0.32 * pace;
      for (const i of [0, 1] as const) {
        const p = ph + i * Math.PI;
        key.feet[i] = add(
          key.feet[i],
          v(0, Math.max(0, Math.cos(p)) * 0.11 * pace, stride * Math.sin(p)),
        );
      }
      key.hipY += strideBob(m.walked, pace);
      key.pitch = 0.06 + 0.04 * pace;
      key.twist = 0.04 * pace * Math.sin(ph);
      key.hands[0] = add(
        v(-0.3, 0.86, 0.1),
        v(0, 0.03 * pace, 0.18 * pace * Math.sin(ph + Math.PI)),
      );
      key.hands[1] = gripOn(m, GRIP);
      inLeft(key.hands[0]);
    }
  }
  return { key, tips: tips!, grips: grips ?? [key.hands[0], key.hands[1]] };
}

/** THE POSE a frame in town puts him in, in the frame its trunk makes
 * (written into `frame`), with his poles: the snow at `ground`. */
export function townPose(m: TownMove, ground: number, frame: BodyFrame, pole: number): SkierPose {
  const { key, tips, grips } = townKey(m, pole);
  const p = ragdollPose(keyPoints(key, ground), frame);
  const local = (q: V3): V3 => {
    const d = sub(v(q.x, q.y + ground, q.z), frame.origin);
    return v(dot(d, frame.x), dot(d, frame.y), dot(d, frame.z));
  };
  p.poles = [local(tips[0]), local(tips[1])];
  p.grips = [local(grips[0]), local(grips[1])];
  return p;
}
