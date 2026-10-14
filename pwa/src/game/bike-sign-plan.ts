// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRAIL-HEAD SIGNS OF A BIKE PARK (R44, R45): a post at every trail's
// head on its lift's staging apron (`BikeTrailHead.sign`, on the head's
// left a metre off the tread), turned to the rider rolling up to it, one
// board on it — the trail's grade painted as a ski area paints a run's
// (`grade-look.ts`: the green circle, the blue square, the red rectangle,
// the black diamond), its number in white on the mark and its name burned
// beside it. Drawn by `run-signs.ts` with the piste-head signs, so a summer
// sign is the same plank a winter one is. Three-free and DOM-free.

import type { Level } from "@engine";

import { SIGN, type SignPost } from "./run-sign-plan.ts";
import { BIKE_RACE_NAME, BIKE_TRAIL_NAMES } from "./strings-bike.ts";

/** A small hash of the map's seed and a trail's id: which name it gets. */
function pick(seed: number, id: string, n: number): number {
  let h = (seed ^ 0x6b1e) >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return h % n;
}

/** The posts at every trail head of `level`'s bike park; none off one. */
export function bikeSigns(level: Level): SignPost[] {
  const park = level.bikePark;
  if (!park) return [];
  const used = new Set<string>();
  const posts: SignPost[] = [];
  for (const apron of park.aprons) {
    for (const head of apron.heads) {
      const trail = park.trails.find((t) => t.id === head.trail);
      if (!trail) continue;
      let name = BIKE_RACE_NAME;
      if (trail.kind === "trail") {
        const names = BIKE_TRAIL_NAMES[trail.grade];
        let k = pick(level.seed, trail.id, names.length);
        for (let i = 0; i < names.length && used.has(names[k]); i++) k = (k + 1) % names.length;
        name = names[k];
        used.add(name);
      }
      posts.push({
        x: head.sign.x,
        z: head.sign.z,
        y: level.groundAt(head.sign.x, head.sign.z),
        heading: head.heading,
        boards: [
          {
            run: trail.id,
            number: trail.kind === "race" ? "DH" : trail.id.slice(1),
            name,
            grade: trail.grade,
            lane: false,
            arrow: "ahead",
            width: SIGN.board.width,
            height: SIGN.board.height,
            y: SIGN.foot,
          },
        ],
      });
    }
  }
  return posts;
}

const NAMES = new WeakMap<Level, Map<string, string>>();

/** The name burned on trail `id`'s sign on `level` (the HUD's word for the
 * trail ridden), or the id itself off a park. Memoized a map. */
export function bikeTrailName(level: Level, id: string): string {
  let names = NAMES.get(level);
  if (!names) {
    names = new Map();
    for (const post of bikeSigns(level)) for (const b of post.boards) names.set(b.run, b.name);
    NAMES.set(level, names);
  }
  return names.get(id) ?? id;
}
