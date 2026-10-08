// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE CIVILIANS WEAR AND HOLD — each person's kit as the figure's
// shader reads it (`civilian-shapes.ts`): the colours of his outfit, as
// indices into one palette (the crowd's, `CROWD_PALETTE`, with the staff's
// uniforms after it, `STAFF_DRESS`), and which of the figure's folded
// PARTS he shows — his head (a helmet with the goggles pushed up on it, a
// beanie, or his own hair), what is in his hands (skis on a shoulder, a mug,
// a beer, a shovel, a broom), a snowball, the patrol's cross. Three-free and
// DOM-free; dealt off the person's own numbers in the plan, so it moves
// nothing and is the same person every frame.

import type { CrowdBody } from "@engine";

import type { Civilian, CivilianPose } from "./civilian-plan.ts";
import { STAFF_DRESS, type Carry, type Dress } from "./civilian-roles.ts";
import { holdsSnowball } from "./civilian-moves.ts";
import { CROWD_PALETTE } from "./crowd-dress.ts";

/** The slots a civilian's vertex takes its colour from (`aSlot`): the
 * crowd's (`DRESS_SLOT`) and the VEST over the jacket's middle — the lift
 * crew's and the workers' high-visibility bib, a guest's own jacket. */
export const CIVILIAN_SLOT = {
  own: 0,
  jacket: 1,
  pants: 2,
  head: 3,
  skis: 4,
  accent: 5,
  skin: 6,
  hair: 7,
  vest: 8,
} as const;

/** The figure's parts an instance may fold away (`aPart`): 0 is the body,
 * always drawn; one head, one carry, one extra and one mark are shown. */
export const PART = {
  body: 0,
  helmet: 1,
  beanie: 2,
  hair: 3,
  skis: 11,
  mug: 12,
  beer: 13,
  shovel: 14,
  broom: 15,
  snowball: 21,
  cross: 31,
} as const;
export type Head = "helmet" | "beanie" | "hair";

const STAFF = ["lift", "patrol", "school", "worker", "host"] as const;

/** THE PALETTE: the crowd's, then each staff dress's jacket, mark, pants
 * and bib (its jacket when it wears none). */
export const CIVILIAN_PALETTE: readonly number[] = [
  ...CROWD_PALETTE,
  ...STAFF.flatMap((d) => {
    const s = STAFF_DRESS[d];
    return [s.jacket, s.mark, s.pants, s.bib ?? s.jacket];
  }),
];
const STAFF_AT = CROWD_PALETTE.length;

// The crowd's palette, laid out (`crowd-dress.ts`): jackets 16, pants 8,
// heads 8, skis 8, skins 4, hairs 4.
const P = { jacket: 0, pants: 16, head: 24, skis: 32, skin: 40, hair: 44 } as const;
const BRIGHT = [0, 1, 2, 3, 4, 5, 8, 9, 11, 12];
const MUTED = [1, 6, 10, 13, 14, 15, 3, 0];
const DARK = [6, 6, 10, 15, 11, 4, 8];
const EARTH = [4, 9, 14, 6, 13, 3, 2];

/** A small integer hash. */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/** A civilian's colours: eight indices into `CIVILIAN_PALETTE` — jacket,
 * pants, head, skis, accent, skin, hair, vest — and the head he wears. */
export type CivilianKit = { colours: number[]; head: Head; mark: number };

/** The heads a role's people wear, as shares of helmet, beanie and hair:
 * the patrol and the class going skiing in helmets, the crew and the
 * workers in beanies, the terrace mostly bare-headed. */
function headOf(c: Civilian, h: number): Head {
  const roll = (h % 1000) / 1000;
  const pick = (helmet: number, beanie: number): Head =>
    roll < helmet ? "helmet" : roll < helmet + beanie ? "beanie" : "hair";
  switch (c.role) {
    case "patrol":
    case "student":
    case "instructor":
      return "helmet";
    case "liftAttendant":
    case "topAttendant":
    case "worker":
      return "beanie";
    case "host":
      return pick(0, 0.5);
    case "walker":
      return pick(0.5, 0.35);
    case "partier":
      return pick(0.12, 0.33);
    case "terraceSitter":
    case "lounger":
      return pick(0.1, 0.35);
    case "rester":
      return pick(0.45, 0.35);
    case "cocoa":
      return pick(0.3, 0.45);
    default:
      return pick(0.3, 0.6);
  }
}

/** THE KIT a civilian is dealt: staff in their uniform, a guest in his
 * own colours off his `tint`, as the crowd is dressed. */
export function civilianKit(c: Civilian, seed: number): CivilianKit {
  const h = hash(Math.floor(c.tint * 0x7fffffff), seed);
  const at = (shift: number, n: number): number => (h >>> shift) % n;
  const skin = P.skin + at(20, 4);
  const hair = P.hair + (c.body === "oldMan" || c.body === "oldWoman" ? 3 : at(23, 3));
  const head = headOf(c, h);
  if (c.dress !== "guest") {
    const d = STAFF_AT + STAFF.indexOf(c.dress as Exclude<Dress, "guest">) * 4;
    // A helmet in the jacket's colour; a beanie dark.
    const cap = head === "helmet" ? d : P.head + 1;
    return {
      colours: [d, d + 2, cap, P.skis + at(17, 8), d + 1, skin, hair, d + 3],
      head,
      mark: c.dress === "patrol" ? PART.cross : 0,
    };
  }
  const body: CrowdBody = c.body;
  const pool =
    body === "oldMan" || body === "oldWoman"
      ? MUTED
      : body === "teen"
        ? DARK
        : body === "freerider"
          ? EARTH
          : BRIGHT;
  const jacket = pool[at(0, pool.length)];
  const pants =
    body === "retro" ? P.jacket + jacket : P.pants + (at(5, 3) === 0 ? at(7, 8) : at(7, 3));
  const accent = P.jacket + ((jacket + 1 + at(11, 5)) % 16);
  return {
    colours: [
      P.jacket + jacket,
      pants,
      P.head + at(14, 8),
      P.skis + at(17, 8),
      accent,
      skin,
      hair,
      P.jacket + jacket,
    ],
    head,
    mark: 0,
  };
}

const CARRY_PART: Readonly<Record<Carry, number>> = {
  none: 0,
  skis: PART.skis,
  mug: PART.mug,
  beer: PART.beer,
  shovel: PART.shovel,
  broom: PART.broom,
};
const HEAD_PART: Readonly<Record<Head, number>> = {
  helmet: PART.helmet,
  beanie: PART.beanie,
  hair: PART.hair,
};

/** The parts a civilian shows this moment, as the instance's `aKit`:
 * his head, what is in his hands, a snowball, his mark. */
export function kitParts(kit: CivilianKit, pose: CivilianPose, out: number[]): number[] {
  out[0] = HEAD_PART[kit.head];
  out[1] = CARRY_PART[pose.carry];
  out[2] = holdsSnowball(pose) ? PART.snowball : 0;
  out[3] = kit.mark;
  return out;
}
