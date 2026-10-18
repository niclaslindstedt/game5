// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN ANIMAL RUN DOWN, AS DRAWN — what is left of one the rider met hard on a
// run with its injuries on (`engine/game/beast-hit.ts` kills it and says how
// CRUSHED, 0..1), stated three-free so the suite reads it: where on its
// body the blow landed, whether anything is left whole, how much blood it
// has to lose and the colours of what is inside it. `beasts.ts` breaks the
// body (`beast-crush.ts`'s shader), `beast-gore.ts` throws what comes out.
//
// WHAT A BODY MET AT SPEED DOES: a big one (a deer, a reindeer, a moose)
// takes the blow on its flank — the ribs stove in where the rider met it,
// the spine broken there so the body lies folded in a V, the legs flung
// every way, the head lolled, and the barrel opened: blood out of it in a
// sheet along the way it was thrown, the guts after, and a red slide on
// the snow where it went. A small one (a hare, a squirrel, a fox) met past
// `burst` has nothing left whole: it is gone into gobbets and fur.
//
// THE COLOURS are read off what is really there (sRGB). Game meat is far
// darker than a farm animal's — the muscle of a deer, a reindeer or a
// moose a deep maroon (#5c1814 cut, near black where it clots), with
// little fat on it in winter and that a dead white (#efe6d2), not the
// farmed yellow; arterial blood a bright red (#8c0606), on snow darkening
// to a brown-red as it dries. A RUMINANT (every hoofed animal here) carries
// a rumen of chewed browse and lichen, some tenth of its weight, an olive
// brown mash (#5e5a2c) that a burst barrel throws with the blood; a
// carnivore's gut is the pink-grey of the bowel (#c39a8a).

import { hash2, type BeastSpec, type StruckBeast } from "@engine";

/** The colours, sRGB. */
export const WRECK_COLOURS = {
  muscle: 0x5c1814,
  clot: 0x2e0605,
  fat: 0xefe6d2,
  blood: 0x8c0606,
  rumen: 0x5e5a2c,
  bowel: 0xc39a8a,
  bone: 0xeadfc4,
} as const;

export const WRECK = {
  /** A small animal met past this crush has nothing left whole (`burst`),
   * if it weighs under `burstMass`, kg. */
  burst: 0.45,
  burstMass: 15,
  /** A body's blood, L/kg — some 70 ml a kilogram in a mammal. */
  bloodPerKg: 0.07,
  /** The share of it out on the snow by a crush of 1: an opened barrel
   * empties most of what is in it. */
  shed: 0.55,
  /** How long the blood runs out of a carcass, s, a half-life. */
  bleed: 6,
  /** How far along the spine from its middle the blow may land, a share
   * of the body's length either way. */
  along: 0.18,
} as const;

/** WHERE THE BLOW LANDED on a struck animal, in its own frame (x its
 * right, z ahead): the SIDE it was met on (±1), how far along the spine
 * from the middle, m, a seed of its own for the wreck's rags, and whether
 * it BURST — nothing of it left whole. */
export type Wreck = { side: number; along: number; seed: number; burst: boolean };

export function wreckOf(hit: StruckBeast, spec: BeastSpec): Wreck {
  // It was flung AWAY from him: he met it on the side the fling left.
  const rx = Math.cos(hit.heading);
  const rz = -Math.sin(hit.heading);
  const right = hit.vx * rx + hit.vz * rz;
  const side = right > 0 ? -1 : 1;
  const seed = hash2(hit.group * 31 + hit.member, Math.round(hit.t * 120), 0x6a3) * 997;
  const along = (hash2(hit.group, hit.member, 0x41b) - 0.5) * 2 * WRECK.along * spec.length;
  const burst = hit.killed && spec.mass < WRECK.burstMass && hit.crush >= WRECK.burst;
  return { side, along, seed, burst };
}

/** The litres a struck animal of `spec` crushed `crush` puts out on the
 * snow, in all. */
export function bloodOut(spec: BeastSpec, crush: number): number {
  return spec.mass * WRECK.bloodPerKg * WRECK.shed * crush;
}

/** The litres run out between `a` and `b` s after the blow: the flow off a
 * body opened falls off by halves every `bleed` s. */
export function bledBetween(spec: BeastSpec, crush: number, a: number, b: number): number {
  const k = Math.LN2 / WRECK.bleed;
  const left = (u: number) => Math.exp(-k * Math.max(0, u));
  return bloodOut(spec, crush) * (left(a) - left(b));
}

/** Whether a hoofed animal — a rumen to throw. */
export function ruminant(spec: BeastSpec): boolean {
  return spec.prints.pattern === "pairs";
}
