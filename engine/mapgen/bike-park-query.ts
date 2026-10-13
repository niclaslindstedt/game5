// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE PARK ASKED (R44, R45): where a point is on the park, what its
// tread is there, the trails off a lift's top, the nearest point of a
// trail. Every reader — the summer ground, the bike, the lab, the renderer —
// asks here and nothing walks the trails a second way. A map with no park
// answers nothing.

import { bikeHit, nearestTrailPoint } from "./bike-surface.ts";
import type { BikeFeature, BikeTrail, BikeTrailHead, BikeTrailHit } from "./bike-park-types.ts";
import type { Level } from "./types.ts";

/** WHERE (x, z) IS ON THE PARK: the trail whose surface it stands most on
 * (`weight` 1 on the tread, falling to 0 across its shoulder), or null. */
export function bikeTrailAt(level: Level, x: number, z: number): BikeTrailHit | null {
  const park = level.bikePark;
  if (!park) return null;
  const hit = bikeHit(park, x, z, park.base.groundAt(x, z));
  if (!hit) return null;
  const { trail, index, s, lateral, half, weight } = hit;
  return { trail, index, s, lateral, half, weight };
}

/** What a trail's TREAD is at a point: a flow trail's gravel, a technical
 * trail's dirt, a rock or a root set in it, or the bare earth of its
 * cut-and-fill shoulder. */
export type BikeTread = "flow" | "trail" | "rocks" | "roots" | "shoulder";

/** THE TREAD at (x, z), or null off every trail. */
export function bikeTreadAt(level: Level, x: number, z: number): BikeTread | null {
  const hit = bikeTrailAt(level, x, z);
  if (!hit) return null;
  if (Math.abs(hit.lateral) > hit.half) return hit.weight > 0.35 ? "shoulder" : null;
  for (const f of featuresAt(hit.trail, hit.s)) {
    if (f.kind !== "rocks" && f.kind !== "roots") continue;
    if (onPiece(f, hit.s - f.from, hit.lateral)) return f.kind;
  }
  return hit.trail.tread === "gravel" ? "flow" : "trail";
}

/** The features of `trail` standing at arc `s`. */
export function featuresAt(trail: BikeTrail, s: number): BikeFeature[] {
  return trail.features.filter((f) => s >= f.from && s <= f.to);
}

/** Whether a garden's rock or root lies under (u, a) of its frame. */
function onPiece(f: BikeFeature, u: number, a: number): boolean {
  for (const p of f.pieces ?? []) {
    if (f.kind === "rocks") {
      if ((u - p.u) ** 2 + (a - p.a) ** 2 < p.r * p.r) return true;
      continue;
    }
    const ca = Math.cos(p.ang ?? 0);
    const sa = Math.sin(p.ang ?? 0);
    const du = u - p.u;
    const da = a - p.a;
    if (Math.abs(da * ca + du * sa) > (p.len ?? 2) / 2) continue;
    if (Math.abs(du * ca - da * sa) < p.r * 1.5) return true;
  }
  return false;
}

/** THE TRAIL HEADS of the park, or of the apron of lift `lift`. */
export function bikeTrailHeads(level: Level, lift?: string): BikeTrailHead[] {
  const park = level.bikePark;
  if (!park) return [];
  return park.aprons.filter((a) => lift === undefined || a.lift === lift).flatMap((a) => a.heads);
}

/** THE TRAIL WHOSE HEAD IS NEAREST (x, z) — a spot picked on the start
 * card — or null on a map with no park. */
export function nearestBikeHead(level: Level, x: number, z: number): string | null {
  let best: string | null = null;
  let near = Infinity;
  for (const h of bikeTrailHeads(level)) {
    const d = (h.x - x) * (h.x - x) + (h.z - z) * (h.z - z);
    if (d < near) {
      near = d;
      best = h.trail;
    }
  }
  return best;
}

/** A trail of the park by its id. */
export function bikeTrailById(level: Level, id: string): BikeTrail | null {
  return level.bikePark?.trails.find((t) => t.id === id) ?? null;
}

/** THE NEAREST POINT of any trail's centre line to (x, z) within `within`
 * m: the trail, its arc there, the distance and the point. */
export function nearestBikeTrailPoint(level: Level, x: number, z: number, within = 50) {
  const park = level.bikePark;
  return park ? nearestTrailPoint(park, x, z, within) : null;
}
