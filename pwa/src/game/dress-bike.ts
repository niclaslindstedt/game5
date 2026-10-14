// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FEET, AND THE FREERIDER'S LEGS — what is cut below the pants: his
// feet in the ski boots' padded liners (hidden in the shells while he
// stands on his skis, his own when he is thrown off them) or, in a
// freerider's kit on the downhill bike (`Outfit.bike`, `outfit.ts`'s
// `rideKit`), the legs a big-mountain rider shows under baggy shorts:
//
//   KNEE PADS  a long pad from the lower thigh over the knee to the top of
//              the shin, its hard cap bulging over the kneecap, a strap at
//              each end — worn UNDER the shorts' hem, as riders wear them
//   SOCKS      long, to the calf's top, two stripes round the cuff
//   SHOES      a flat-pedal shoe: a low skate-cut upper, a padded collar
//              round the ankle and a thick gum sole
//
// and the cut of the jersey (`JERSEY`, the race shell's panels hung loose
// and long) and the shorts' hem (`shortsOf`) that `dress-garments.ts`
// lays over them. Three-free, on the same loom.

import type { BodyMeasure } from "./dress-body.ts";
import type { JacketCut, PantsCut } from "./dress-garments.ts";
import { add, bindPose, dot, mul, rides, sub, type Loom, type Section } from "./dress-loft.ts";
import { RIDE_KIT, type Outfit } from "./outfit.ts";

const FRONT = Math.PI / 2;
const TAU = Math.PI * 2;
const gap = (a: number, b: number) => {
  const d = (((a - b) % TAU) + TAU) % TAU;
  return Math.min(d, TAU - d);
};

/** A FREERIDE JERSEY: loose and long over the shorts' waist, a low round
 * collar, roomy sleeves. */
export const JERSEY: JacketCut = {
  hem: -0.17,
  ease: 0.034,
  hemFlare: 0.008,
  collar: 0.045,
  square: 2.3,
  sleeve: 0.032,
  drape: 0.95,
};

/** BAGGY SHORTS: roomy over the thigh, but cut for pedalling, never a
 * park pant's dropped seat. */
export const SHORTS: PantsCut = { ease: 0.026, knee: 0.024, hem: 0.1, drop: 0.015, square: 2.3 };

/** How far past the knee the shorts' hem falls, m along the leg: to the
 * kneecap's top, the pad's cap out under it. */
export const SHORTS_HEM = 0.01;

/** A pair of pants' leg `sections` cut off as shorts: everything past the
 * knee dropped, a wide hem `SHORTS_HEM` past it. `r` is the leg's radius
 * at the knee with the cut's ease. */
export function shortsOf(sections: Section[], K: number, r: number): void {
  const kept = sections.filter((q) => q.s < K + SHORTS_HEM - 0.04);
  sections.length = 0;
  sections.push(
    ...kept,
    { s: K + SHORTS_HEM - 0.03, w: r + 0.008, f: r + 0.01, b: r + 0.014 },
    { s: K + SHORTS_HEM, w: r + 0.012, f: r + 0.012, b: r + 0.018 },
  );
}

/** HIS FEET: the ski boot's liners, or on the bike a flat-pedal shoe. */
export function cutFeet(loom: Loom, o: Outfit): void {
  const { pose: P } = bindPose();
  const shoe = !!o.bike;
  const S = RIDE_KIT.shoes;
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? "l" : "r";
    const bt = P.boots[i];
    const n = { x: bt.n.x, y: bt.n.y, z: bt.n.z };
    const f = { x: bt.f.x, y: bt.f.y, z: bt.f.z };
    const top = P.feet[i];
    const sole = add(top, mul(n, -0.275));
    if (!shoe) {
      loom.tube({
        path: [top, add(top, mul(n, -0.24))],
        face: [f, f],
        sections: [
          { s: 0, w: 0.05, f: 0.055, b: 0.052 },
          { s: 0.24, w: 0.046, f: 0.05, b: 0.05 },
        ],
        step: 0.12,
        segments: 8,
        colour: () => 0x26282c,
        weights: () => rides(`boot_${s}`),
      });
      loom.tube({
        path: [add(sole, mul(f, -0.11)), add(sole, mul(f, 0.16))],
        face: [n, n],
        sections: [
          { s: 0, w: 0.035, f: 0.03, b: 0.02 },
          { s: 0.06, w: 0.044, f: 0.045, b: 0.03 },
          { s: 0.2, w: 0.045, f: 0.035, b: 0.03 },
          { s: 0.27, w: 0.03, f: 0.015, b: 0.02 },
        ],
        step: 0.08,
        segments: 8,
        colour: () => 0x26282c,
        weights: () => rides(`boot_${s}`),
      });
      continue;
    }
    // THE COLLAR: padded, round the ankle a hand over the sole.
    const ankle = add(top, mul(n, -0.15));
    loom.tube({
      path: [ankle, add(top, mul(n, -0.25))],
      face: [f, f],
      sections: [
        { s: 0, w: 0.042, f: 0.046, b: 0.05 },
        { s: 0.02, w: 0.047, f: 0.05, b: 0.055 },
        { s: 0.1, w: 0.048, f: 0.06, b: 0.052 },
      ],
      step: 0.03,
      segments: 10,
      colour: (sl) => (sl < 0.02 ? S.lace : S.main),
      weights: () => rides(`boot_${s}`),
    });
    // THE UPPER: heel to toe, laced down its top.
    const foot = add(sole, mul(n, 0.035));
    loom.tube({
      path: [add(foot, mul(f, -0.115)), add(foot, mul(f, 0.17))],
      face: [n, n],
      round: 0.02,
      sections: [
        { s: 0, w: 0.036, f: 0.04, b: 0.02 },
        { s: 0.04, w: 0.045, f: 0.052, b: 0.022 },
        { s: 0.16, w: 0.05, f: 0.042, b: 0.022 },
        { s: 0.25, w: 0.044, f: 0.028, b: 0.022 },
        { s: 0.285, w: 0.026, f: 0.012, b: 0.02 },
      ],
      step: 0.04,
      segments: 10,
      square: 2.6,
      cap: [true, true],
      colour: (sl, t) => (gap(t, FRONT) < 0.35 && sl > 0.07 && sl < 0.19 ? S.lace : S.main),
      weights: () => rides(`boot_${s}`),
    });
    // THE SOLE: a thick, flat gum slab under it all.
    loom.tube({
      path: [add(sole, mul(f, -0.125)), add(sole, mul(f, 0.18))],
      face: [n, n],
      round: 0.02,
      sections: [
        { s: 0, w: 0.036, f: 0.012, b: 0.012 },
        { s: 0.03, w: 0.05, f: 0.014, b: 0.012 },
        { s: 0.27, w: 0.054, f: 0.014, b: 0.012 },
        { s: 0.305, w: 0.03, f: 0.01, b: 0.01 },
      ],
      step: 0.05,
      segments: 10,
      square: 3.2,
      cap: [true, true],
      colour: () => S.sole,
      weights: () => rides(`boot_${s}`),
    });
  }
}

/** A FREERIDER'S KNEE PADS AND LONG SOCKS, under the shorts' hem. */
export function cutPadsAndSocks(loom: Loom, m: BodyMeasure): void {
  const { frames: F, pose: P } = bindPose();
  const pads = RIDE_KIT.pads;
  const socks = RIDE_KIT.socks;
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? "l" : "r";
    const th = F[`thigh_${s}`];
    const sh = F[`shin_${s}`];
    const K = th.length;
    const C = K + sh.length;
    // THE PAD: from the lower thigh over the knee to the top of the shin,
    // the hard cap bulging out over the kneecap.
    const r0 = m.lowerThigh + 0.014;
    const r1 = m.calf + 0.012;
    loom.tube({
      path: [P.hipJoints[i], P.knees[i], P.feet[i]],
      face: [th.z, th.z, sh.z],
      round: 0.07,
      sections: [
        { s: K - 0.12, w: r0 - 0.002, f: r0 + 0.002, b: r0 - 0.004 },
        { s: K - 0.06, w: r0 + 0.002, f: r0 + 0.008, b: r0 },
        { s: K, w: r0 + 0.008, f: r0 + 0.03, b: r0 },
        { s: K + 0.05, w: r1 + 0.008, f: r1 + 0.036, b: r1 },
        { s: K + 0.14, w: r1 + 0.004, f: r1 + 0.018, b: r1 - 0.002 },
        { s: K + 0.18, w: r1, f: r1 + 0.006, b: r1 - 0.004 },
      ],
      step: 0.025,
      cuts: [K - 0.1, K - 0.08, K + 0.15, K + 0.165],
      segments: 14,
      angles: [FRONT - 0.85, FRONT + 0.85],
      square: 2.5,
      fold: (sl, t) =>
        // Ribbed across the cap, a pad's sewn segments.
        gap(t, FRONT) < 0.85 && sl > K - 0.03 && sl < K + 0.13
          ? 0.003 * Math.cos(((sl - K) / 0.045) * TAU)
          : 0,
      colour: (sl, t) => {
        if ((sl > K - 0.1 && sl < K - 0.08) || (sl > K + 0.15 && sl < K + 0.165)) {
          return pads.strap;
        }
        return gap(t, FRONT) < 0.85 && sl > K - 0.03 && sl < K + 0.13 ? pads.cap : pads.main;
      },
      cap: [false, false],
      among: [`thigh_${s}`, `shin_${s}`],
    });
    // THE SOCK: from under the pad down the calf into the shoe's collar.
    const n = P.boots[i].n;
    const into = add(P.feet[i], mul({ x: n.x, y: n.y, z: n.z }, -0.17));
    const c = m.calf + 0.006;
    const a = m.ankle + 0.01;
    const top = K + 0.14;
    loom.tube({
      path: [P.knees[i], P.feet[i], into],
      face: [sh.z, sh.z, sh.z],
      round: 0.06,
      sections: [
        { s: top - K, w: c - 0.004, f: c - 0.006, b: c },
        { s: 0.2, w: c, f: c - 0.004, b: c + 0.008 },
        { s: 0.28, w: c - 0.004, f: c - 0.008, b: c + 0.002 },
        { s: C - K - 0.06, w: a + 0.004, f: a + 0.002, b: a + 0.006 },
        { s: C - K + 0.17, w: a + 0.004, f: a + 0.006, b: a + 0.008 },
      ],
      step: 0.04,
      cuts: [0.19, 0.205, 0.215, 0.23],
      segments: 12,
      colour: (sl) =>
        (sl > 0.19 && sl < 0.205) || (sl > 0.215 && sl < 0.23) ? socks.stripe : socks.main,
      cap: [false, false],
      weights: (p) =>
        dot(sub(p, P.feet[i]), { x: n.x, y: n.y, z: n.z }) < -0.03
          ? rides(`boot_${s}`)
          : rides(`shin_${s}`),
    });
  }
}
