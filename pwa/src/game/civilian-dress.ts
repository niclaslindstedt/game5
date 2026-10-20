// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE CIVILIANS WEAR AND HOLD — each person's kit as the figure's
// shader reads it (`civilian-shapes.ts`): the colours of his outfit, as
// indices into one palette (the crowd's, `CROWD_PALETTE`, with the staff's
// uniforms after it, `STAFF_DRESS`), and which of the figure's folded
// PARTS he shows — his head (a helmet with the goggles pushed up on it, a
// beanie, or his own hair), what is in his hands (skis on a shoulder, a mug,
// a beer, a shovel, a broom), a snowball or a dog walker's bag, the
// patrol's cross. Three-free and DOM-free; dealt off the person's own
// numbers in the plan, so it moves nothing and is the same person every
// frame.

import type { CrowdBody } from "@engine";

import type { Civilian, CivilianPose } from "./civilian-plan.ts";
import { STAFF_DRESS, type Carry, type Dress } from "./civilian-roles.ts";
import { holdsSnowball } from "./civilian-moves.ts";
import { CROWD_PALETTE } from "./crowd-dress.ts";
import { SUMMER_COLOURS } from "./civilian-summer.ts";

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

/** The same slots as a SUMMER figure reads them (`civilian-summer-shapes.ts`):
 * no skis, so the skis' slot is the LOWER LEG (bare under shorts, the
 * trousers' own colour, a rider's pads) and the vest's the FOREARM (bare
 * under a t-shirt's sleeve, the shirt's colour in a long one). */
export const SUMMER_SLOT = { ...CIVILIAN_SLOT, shin: 4, forearm: 8 } as const;

/** The figure's parts an instance may fold away (`aPart`): 0 is the body,
 * always drawn; one head, one carry, one extra and one mark are shown. */
export const PART = {
  body: 0,
  helmet: 1,
  beanie: 2,
  hair: 3,
  // The summer's heads: a brimmed sun hat, a cap, a rider's full-face helmet.
  sunhat: 4,
  cap: 5,
  fullface: 6,
  skis: 11,
  mug: 12,
  beer: 13,
  shovel: 14,
  broom: 15,
  /** A summer hiker's two walking poles. */
  poles: 16,
  snowball: 21,
  bag: 22,
  /** Sunglasses. */
  glasses: 23,
  cross: 31,
  /** A day pack on his back. */
  pack: 32,
  /** Reflective bands round the sleeves and the lower legs (the rescue's
   * and the police's crews), in the accent's colour. */
  bands: 33,
} as const;
export type Head = "helmet" | "beanie" | "hair" | "sunhat" | "cap" | "fullface";

const STAFF = ["lift", "patrol", "school", "worker", "host"] as const;

/** THE PALETTE: the crowd's, then each staff dress's jacket, mark, pants
 * and bib (its jacket when it wears none), then the summer's shirts,
 * bottoms, hats and packs (`SUMMER_COLOURS`). */
export const CIVILIAN_PALETTE: readonly number[] = [
  ...CROWD_PALETTE,
  ...STAFF.flatMap((d) => {
    const s = STAFF_DRESS[d];
    return [s.jacket, s.mark, s.pants, s.bib ?? s.jacket];
  }),
  ...SUMMER_COLOURS.shirts,
  ...SUMMER_COLOURS.bottoms,
  ...SUMMER_COLOURS.hats,
  ...SUMMER_COLOURS.packs,
];
const STAFF_AT = CROWD_PALETTE.length;
const S_AT = STAFF_AT + STAFF.length * 4;
const S = {
  shirt: S_AT,
  bottom: S_AT + SUMMER_COLOURS.shirts.length,
  hat: S_AT + SUMMER_COLOURS.shirts.length + SUMMER_COLOURS.bottoms.length,
  pack:
    S_AT +
    SUMMER_COLOURS.shirts.length +
    SUMMER_COLOURS.bottoms.length +
    SUMMER_COLOURS.hats.length,
} as const;

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
 * pants, head, skis, accent, skin, hair, vest (in summer the shirt, the
 * bottoms, the hat, the lower leg, the accent and pack, skin, hair, the
 * forearm — `SUMMER_SLOT`) — the head he wears, his mark (the patrol's
 * cross, a day pack) and, in summer, his sunglasses. */
export type CivilianKit = { colours: number[]; head: Head; mark: number; glasses?: boolean };

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
    case "dogWalker":
    case "dogChild":
      // Out in the village with the dog, not skiing: a beanie or bare.
      return pick(0, 0.62);
    case "partier":
      return pick(0.12, 0.33);
    case "terraceSitter":
    case "terraceKnot":
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
 * own colours off his `tint`, as the crowd is dressed — in summer, the
 * summer's (`summerKit`). */
export function civilianKit(c: Civilian, seed: number, summer = false): CivilianKit {
  const h = hash(Math.floor(c.tint * 0x7fffffff), seed);
  if (summer) return summerKit(c, h);
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

/** How a SUMMER's person dresses, by his role: the shares of a t-shirt
 * (else a long sleeve or a light shell), of shorts (else walking
 * trousers), of a sun hat and of a cap (else bare-headed), of sunglasses
 * and of a day pack. */
type SummerWear = {
  tee: number;
  shorts: number;
  sunhat: number;
  cap: number;
  glasses: number;
  pack: number;
};
const WEAR: Readonly<
  Record<"hiker" | "biker" | "guest" | "terrace" | "child" | "old", SummerWear>
> = {
  hiker: { tee: 0.7, shorts: 0.5, sunhat: 0.35, cap: 0.35, glasses: 0.6, pack: 0.9 },
  // Riders in their kit: a long jersey, baggy shorts over knee pads, a
  // full-face helmet on (`fullface` stands in the sun hat's share).
  biker: { tee: 0, shorts: 1, sunhat: 0.7, cap: 0.15, glasses: 0, pack: 0.45 },
  guest: { tee: 0.75, shorts: 0.5, sunhat: 0.15, cap: 0.25, glasses: 0.5, pack: 0.25 },
  terrace: { tee: 0.8, shorts: 0.45, sunhat: 0.12, cap: 0.15, glasses: 0.55, pack: 0.05 },
  child: { tee: 0.9, shorts: 0.8, sunhat: 0.35, cap: 0.4, glasses: 0.2, pack: 0.3 },
  old: { tee: 0.45, shorts: 0.25, sunhat: 0.5, cap: 0.25, glasses: 0.6, pack: 0.5 },
};

/** THE SUMMER KIT: staff in their shirts (the lift crew's and the host's in
 * the area's colour, the patrol's red with its cross, the trail crew's
 * high-visibility orange), every one in a cap; a guest in a t-shirt or a
 * long sleeve, shorts or walking trousers, a sun hat, a cap or his own
 * hair, sunglasses and a day pack by who he is — a rider in his jersey,
 * pads and full-face helmet. No skis, no ski boots, no beanie. */
function summerKit(c: Civilian, h: number): CivilianKit {
  const at = (shift: number, n: number): number => (h >>> shift) % n;
  const roll = (shift: number): number => ((h >>> shift) % 997) / 997;
  const skin = P.skin + at(20, 4);
  const hair = P.hair + (c.body === "oldMan" || c.body === "oldWoman" ? 3 : at(23, 3));
  if (c.dress !== "guest") {
    const d = STAFF_AT + STAFF.indexOf(c.dress as Exclude<Dress, "guest">) * 4;
    // Shorts on the trail crew and the lift crew now and then.
    const legs = roll(3) < 0.3 ? skin : d + 2;
    return {
      colours: [d, d + 2, d, legs, d + 1, skin, hair, skin],
      head: roll(9) < 0.8 ? "cap" : "hair",
      mark: c.dress === "patrol" ? PART.cross : 0,
      glasses: roll(13) < 0.4,
    };
  }
  const old = c.body === "oldMan" || c.body === "oldWoman";
  const wear =
    c.role === "biker"
      ? WEAR.biker
      : c.role === "hiker"
        ? old
          ? WEAR.old
          : WEAR.hiker
        : c.body === "child"
          ? WEAR.child
          : old
            ? WEAR.old
            : c.role === "terraceSitter" ||
                c.role === "terraceKnot" ||
                c.role === "partier" ||
                c.role === "lounger"
              ? WEAR.terrace
              : WEAR.guest;
  const shirt = S.shirt + at(0, SUMMER_COLOURS.shirts.length);
  const bottom = S.bottom + at(5, SUMMER_COLOURS.bottoms.length);
  const tee = roll(1) < wear.tee;
  const shorts = roll(4) < wear.shorts;
  const hat = roll(7);
  const biker = c.role === "biker";
  const head: Head =
    hat < wear.sunhat
      ? biker
        ? "fullface"
        : "sunhat"
      : hat < wear.sunhat + wear.cap
        ? "cap"
        : "hair";
  const hatColour = biker ? S.shirt + at(11, SUMMER_COLOURS.shirts.length) : S.hat + at(11, 6);
  // A rider's pads and long socks under his shorts: black.
  const shin = biker ? S.bottom + 3 : shorts ? skin : bottom;
  // The freerider's own pack is part of his body (`emitTrunk`).
  const pack = c.body !== "freerider" && roll(15) < wear.pack;
  const packColour = S.pack + at(17, SUMMER_COLOURS.packs.length);
  return {
    colours: [shirt, bottom, hatColour, shin, packColour, skin, hair, tee ? skin : shirt],
    head,
    mark: pack ? PART.pack : 0,
    glasses: roll(19) < wear.glasses,
  };
}

const CARRY_PART: Readonly<Record<Carry, number>> = {
  none: 0,
  skis: PART.skis,
  mug: PART.mug,
  beer: PART.beer,
  shovel: PART.shovel,
  broom: PART.broom,
  lead: 0,
  poles: PART.poles,
};
const HEAD_PART: Readonly<Record<Head, number>> = {
  helmet: PART.helmet,
  beanie: PART.beanie,
  hair: PART.hair,
  sunhat: PART.sunhat,
  cap: PART.cap,
  fullface: PART.fullface,
};

/** The parts a civilian shows this moment, as the instance's `aKit`:
 * his head, what is in his hands, a snowball, his mark. */
export function kitParts(kit: CivilianKit, pose: CivilianPose, out: number[]): number[] {
  out[0] = HEAD_PART[kit.head];
  out[1] = CARRY_PART[pose.carry];
  out[2] = holdsSnowball(pose)
    ? PART.snowball
    : pose.bag
      ? PART.bag
      : kit.glasses
        ? PART.glasses
        : 0;
  out[3] = kit.mark;
  return out;
}
