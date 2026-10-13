// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CUTS a jacket and a pair of pants are lofted to (`dress-garments.ts`),
// and the two KITS a sport puts on a skier over his own colours: the ski
// jumper's one-piece suit (`Outfit.suit`) and the downhill rider's jersey
// and riding pants (`Outfit.bike`). Three-free.

import type { Outfit } from "./outfit.ts";

/** The cut of a jacket. */
export type JacketCut = {
  hem: number;
  ease: number;
  /** More ease at the hem (a shell's swing) or less (an elastic waist). */
  hemFlare: number;
  collar: number;
  square: number;
  sleeve: number;
  /** How straight it hangs from the chest to the hips (`drape`): a puffer
   * or a shell wholly, a fitted race shell much less. */
  drape: number;
  /** A quilt's baffles: their pitch, m along the cloth, and their bulge. */
  quilt?: { pitch: number; depth: number };
};

/** The cut of a pair of pants: the ease over the thigh and at the hem, the
 * hem's radius over the boot, how far the seat drops — and a knee PAD's
 * bulge in front of the knee and down the shin under the cloth, m. */
export type PantsCut = {
  ease: number;
  knee: number;
  hem: number;
  drop: number;
  square: number;
  pad?: number;
};

/** A SKI JUMPER'S ONE-PIECE SUIT (`Outfit.suit`): close over the body
 * with no swing at the hem and narrow sleeves, the legs as close, cut down
 * over the boot. */
const SUIT: { jacket: JacketCut; pants: PantsCut } = {
  jacket: {
    hem: -0.1,
    ease: 0.014,
    hemFlare: -0.008,
    collar: 0.07,
    square: 2.2,
    sleeve: 0.016,
    drape: 0.2,
  },
  pants: { ease: 0.012, knee: 0.01, hem: 0.074, drop: 0, square: 2.2 },
};

/** A DOWNHILL RIDER'S KIT (`Outfit.bike`), off photographs of riders on
 * the course: a JERSEY cut loose and long over the hips with a low crew
 * collar and roomy sleeves, hanging straight; RIDING PANTS cut slim at the
 * thigh and narrow to the ankle, roomy at the knee over its pad. */
const BIKE: { jacket: JacketCut; pants: PantsCut } = {
  jacket: {
    hem: -0.19,
    ease: 0.032,
    hemFlare: 0.006,
    collar: 0.045,
    square: 2.2,
    sleeve: 0.026,
    drape: 0.9,
  },
  pants: { ease: 0.02, knee: 0.028, hem: 0.058, drop: 0, square: 2.3, pad: 0.022 },
};

/** The jacket's cut a kit puts on him, or none. */
export const kitJacket = (o: Outfit): JacketCut | null =>
  o.suit ? SUIT.jacket : o.bike ? BIKE.jacket : null;

/** The pants' cut a kit puts on him, or none. */
export const kitPants = (o: Outfit): PantsCut | null =>
  o.suit ? SUIT.pants : o.bike ? BIKE.pants : null;
