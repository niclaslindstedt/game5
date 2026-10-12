// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE HOT AIR BALLOON STANDS on a map, apart from its flight
// (`balloon.ts`) so that what only asks where it is (the airstrip's search,
// the start card) need not load the flight.

import { BALLOON } from "./defs/balloon.ts";
import { helipadOf, openSpotNear, type Helipad } from "./heli-pad.ts";
import { sledSpotOf } from "./sled-pad.ts";
import type { Level } from "../mapgen/types.ts";

const B = BALLOON;
const sites = new WeakMap<Level, Helipad>();

/** WHERE THE BALLOON IS STOOD UP: open, level snow on the valley floor near
 * the village (or the finish) — room for the envelope's sweep, clear of
 * trunks, lifts and tunnels, and kept off the helicopter's pad and the
 * snowmobile's spot — faced to the summit. Worked out once a map. */
export function balloonSiteOf(level: Level): Helipad {
  let site = sites.get(level);
  if (!site) {
    const pad = helipadOf(level);
    const sled = sledSpotOf(level);
    site = openSpotNear(level, B.site.room, B.site.slope, [
      { x: pad.x, z: pad.z, r: B.site.fromPad },
      { x: sled.x, z: sled.z, r: B.site.fromPad },
    ]);
    sites.set(level, site);
  }
  return site;
}
