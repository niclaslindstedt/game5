// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PERSON'S BODY MET (`person-hit.ts`), as `body.ts` doses it — stated
// here to keep that file under its cap. The blow is the change of speed
// the collision made in the player (`StruckPerson.taken`: about half the
// closing speed against a grown man, a third against a child), stopped by
// the other body's give (`personGive`: soft to a slow blow, crushed through
// by a hard one) on every part of him the other's body stood at the
// height of — a man's from the boots to the head, a child's to the chest.
// The player's own front meets him: the chest, the belly and the pelvis
// whole, the limbs and the head a share each; the arms flung up in front
// take the first of it. A step after the meeting (the crowd moves after
// the player's run), so `gore.ts` reads the doses on the step they land.

import { PERSON_HIT } from "./defs/person-hit.ts";
import type { BodyPart } from "./defs/anatomy.ts";
import type { BodyHands } from "./body-steel.ts";
import type { GameState } from "./state.ts";
import type { StruckPerson } from "./person-hit.ts";

/** His parts by the height they stand at off his boots, m (the band each
 * covers, on a rider of the medium's height), and the share of the blow
 * each takes — the trunk all of it, the head and the limbs less. */
const BANDS: readonly (readonly [BodyPart | "sides", string, number, number, number])[] = [
  ["sides", "shin", 0, 0.48, 0.7],
  ["sides", "knee", 0.42, 0.6, 0.7],
  ["sides", "thigh", 0.55, 0.92, 0.85],
  ["pelvis", "", 0.85, 1.02, 1],
  ["abdomen", "", 0.98, 1.18, 1],
  ["chest", "", 1.15, 1.45, 1],
  ["sides", "shoulder", 1.38, 1.5, 0.9],
  ["sides", "arm", 1.0, 1.45, 0.9],
  ["neck", "", 1.48, 1.58, 0.5],
  ["head", "", 1.55, 1.75, 1],
];

/** As many blows' worth of injuries as one collision may do him. */
export const PERSON_CAP = PERSON_HIT.blows;

/** Whether a meeting at `speed` m/s is a collision's, not a shoulder's. */
export const struckHard = (speed: number): boolean => speed >= PERSON_HIT.strike;

/** What a person's body gives at a blow of `v` m/s, m. */
export function personGive(v: number): number {
  const G = PERSON_HIT.give;
  const u = Math.min(1, Math.max(0, v / G.at));
  return G.soft + (G.hard - G.soft) * u;
}

/** THE PEOPLE MET a step ago and not yet felt — the crowd's amateurs and
 * the people on foot (`foot.ts`) — each struck on the parts of him its
 * body stood against. Whether any was. */
export function personBlows(h: BodyHands, state: GameState): boolean {
  let any = false;
  for (const all of [state.crowd?.struck, state.foot?.struck]) {
    if (all && meetBlows(h, all)) any = true;
  }
  return any;
}

function meetBlows(h: BodyHands, all: readonly StruckPerson[]): boolean {
  let any = false;
  for (const e of all) {
    if (e.dosed) continue;
    e.dosed = true;
    any = true;
    const give = personGive(e.taken);
    let most = 0;
    let worst: BodyPart = "chest";
    for (const [part, sided, lo, hi, share] of BANDS) {
      if (lo > e.height) continue;
      // A band only partly under his height takes that part of its share.
      const s = share * Math.min(1, (e.height - lo) / Math.max(0.01, hi - lo));
      const names: BodyPart[] =
        part === "sides" ? [`${sided}L` as BodyPart, `${sided}R` as BodyPart] : [part];
      for (const name of names) {
        const g = h.blow(name, e.taken, give, false, s);
        h.strike(name, g, "front");
        if (g > most) {
          most = g;
          worst = name;
        }
      }
    }
    if (most > 0) h.offer(most, worst, "skier", -1, e.amateur);
  }
  return any;
}
