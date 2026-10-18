// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN ANIMAL'S BODY MET (`beast-hit.ts`), as `body.ts` doses it — stated here
// to keep that file under its cap. The blow is the speed the exchange took
// off him (`BeastEvent.taken`: a hare's nothing, a moose's all of it),
// stopped by its hide, muscle and ribs (`beastGive`: soft to a slow blow, crushed
// through by a hard one) on every part of
// him its body stood at the height of: a hare's at his boots, a deer's
// barrel at his thighs and hips, a moose's — its legs gone between his — at
// his chest and his head. Struck through the body's own hands, so the
// doses are judged with every other blow's and a hard one tears and opens
// him through the same ladders (`gore.ts`).

import { BEAST_HIT } from "./defs/beasts.ts";
import type { BodyPart } from "./defs/anatomy.ts";
import type { BeastEvent } from "./beast-hit.ts";
import type { BodyHands } from "./body-steel.ts";

/** His parts by the height they stand at off his boots, m: the band each
 * covers, on a rider of the medium's height. */
const BANDS: readonly (readonly [BodyPart | "sides", string, number, number])[] = [
  ["sides", "shin", 0, 0.48],
  ["sides", "knee", 0.42, 0.6],
  ["sides", "thigh", 0.55, 0.92],
  ["pelvis", "", 0.85, 1.02],
  ["abdomen", "", 0.98, 1.18],
  ["chest", "", 1.15, 1.45],
  ["sides", "shoulder", 1.38, 1.5],
  ["sides", "arm", 1.0, 1.45],
  ["neck", "", 1.48, 1.58],
  ["head", "", 1.55, 1.75],
];

/** Below this shoulder height an animal is all body; above it its legs
 * are long, and only the top of its height is a barrel to be stopped by,
 * as a share. */
const LEGGY = 0.8;
const BARREL = 0.45;

/** What the animal's body gives at a blow of `v` m/s, m. */
export function beastGive(v: number): number {
  const G = BEAST_HIT.give;
  const u = Math.min(1, Math.max(0, v / G.at));
  return G.soft + (G.hard - G.soft) * u;
}

export function beastBlow(h: BodyHands, e: BeastEvent): void {
  const give = beastGive(e.taken);
  const top = e.height;
  const bottom = top > LEGGY ? top * BARREL : 0;
  let most = 0;
  let worst: BodyPart = "shinL";
  for (const [part, sided, lo, hi] of BANDS) {
    if (hi < bottom || lo > top) continue;
    const names: BodyPart[] =
      part === "sides" ? [`${sided}L` as BodyPart, `${sided}R` as BodyPart] : [part];
    for (const name of names) {
      const g = h.blow(name, e.taken, give, false);
      h.strike(name, g, "front");
      if (g > most) {
        most = g;
        worst = name;
      }
    }
  }
  if (most > 0) h.offer(most, worst, "beast");
}
