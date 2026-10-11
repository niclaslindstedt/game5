// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIRSTRIP'S SNOW AS DRAWN — the runway and the apron laid on the
// ground's own grids (`terrain.ts`'s `layGround`) as the snow shader reads
// a groomed piste: packed through, combed ALONG the runway (the groomer
// works it end to end), and a WINDROW thrown up along both edges where the
// machine's blade left it — the darker, smoother band a packed ski strip
// reads as from the air, its edges plain beside the floor's loose snow.
// The apron off one edge is packed and combed the same way and joins the
// runway with no windrow between. The physics reads the runway packed for
// the plane's skis on its own (`plane.ts`'s `onStrip`).
//
// Three-free: a pure function of the strip's site (`stripSiteOf`).

import { bermProfile, stripFrame, stripPoint, type StripSite } from "@engine";

import type { GroundStamp } from "./terrain.ts";

/** How far the packed edge is feathered, m; where the windrow starts
 * outside it, m. */
const FEATHER = 1.5;
const WINDROW = 0.6;

/** The strip's runway and apron as a stamp on the ground. */
export function stripStamp(site: StripSite): GroundStamp {
  const s = site.strip;
  const half = s.length / 2;
  const w = s.width / 2;
  const a = site.apron;
  // The plan box round the runway, the apron and the windrows.
  const reach = Math.max(w + 6, a.across1 + 2);
  const corners = [
    stripPoint(s, -half - 6, -reach),
    stripPoint(s, half + 6, -reach),
    stripPoint(s, half + 6, reach),
    stripPoint(s, -half - 6, reach),
  ];
  const xs = corners.map((p) => p.x);
  const zs = corners.map((p) => p.z);
  const ramp = (d: number): number => Math.min(1, Math.max(0, d / FEATHER));
  return {
    x0: Math.min(...xs),
    z0: Math.min(...zs),
    x1: Math.max(...xs),
    z1: Math.max(...zs),
    at(x, z, out) {
      const f = stripFrame(s, x, z);
      const along = f.along;
      const across = f.across * site.side;
      // The runway, feathered at its sides and its ends.
      const run = ramp(w - Math.abs(f.across)) * ramp(half + 2 - Math.abs(along));
      // The apron on its side, feathered all round.
      const apron =
        across > 0 ? ramp(a.across1 - across) * ramp(along - a.along0) * ramp(a.along1 - along) : 0;
      const packed = Math.max(run, apron);
      // The windrows: outside each edge, broken where the apron joins.
      const onApronSide = across > 0 && along > a.along0 - 2 && along < a.along1 + 2;
      const berm =
        Math.abs(along) <= half + 1 && !onApronSide
          ? bermProfile(1, Math.abs(f.across) - w - WINDROW)
          : 0;
      if (packed <= 0 && berm <= 0) return false;
      out.packed = packed;
      out.heading = s.heading;
      out.berm = berm;
      return true;
    },
  };
}
