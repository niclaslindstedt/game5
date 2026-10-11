// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES AS THE START CARD FILES THEM — RANGE, then AREA, then PART:
// the range a face lies in (a country, or a range across borders), the
// place its ski area is known by, and the part of that area it is. EVERY
// face is offered, whatever colours its real ski area signs: the free ride
// has no GRADE row, and the slope is picked on the RUN row, of any colour.
// DOM-free: the card's rows and the WHERE steps' world map read it
// (`where-steps.ts`), and so does the suite. RANGE's last stop is GENERATED,
// the seed's own mountain (below).
//
// THE NEXT ONE IS THE NEXT ONE OVER. A range's areas are listed as a WALK:
// from its most northerly area (the most westerly of a tie) on to the
// nearest area not yet listed, and so on, each area at the middle of its
// parts — so stepping the AREA row moves to a neighbour, never back and
// forth across the range. An area's parts are walked the same way; it
// scales to as many areas as a range has.

import { REAL_FACE_IDS, REGION_IDS, realFacePlace, realFaceRegion, type RegionId } from "@engine";

import { STRINGS } from "./strings.ts";

/** One part on the PART row: its face and its place. */
export type FacePart = { id: string; part: string; region: RegionId };

/** Every face with its place, in the bake's order. */
export type PlacedFace = {
  id: string;
  range: string;
  area: string;
  part: string;
  lat: number;
  lon: number;
};
let every: PlacedFace[] | null = null;
export function placedFaces(): readonly PlacedFace[] {
  every ??= REAL_FACE_IDS.map((id) => ({ id, ...realFacePlace(id)! }));
  return every;
}

/** By name, `THE` read past, as a list of places is. */
const byName = (a: string, b: string): number =>
  a.replace(/^THE /, "").localeCompare(b.replace(/^THE /, ""));

/** Every range with a face, in the order of the names the card shows
 * them by. */
export function faceRanges(): string[] {
  const out = [...new Set(placedFaces().map((f) => f.range))];
  return out.sort((a, b) => byName(STRINGS.rangeName(a), STRINGS.rangeName(b)));
}

/** A point on the globe, °. */
type At = { lat: number; lon: number };

/** How far apart two points are, km (near enough for a walk's order). */
export function kmBetween(a: At, b: At): number {
  const k = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return 111.32 * Math.hypot(a.lat - b.lat, (a.lon - b.lon) * k);
}

/** `items` as a walk: the most northerly first (the most westerly of a
 * tie, then by name), then always the nearest not yet walked. */
export function walk<T extends At & { name: string }>(items: readonly T[]): T[] {
  const left = [...items].sort(
    (a, b) => b.lat - a.lat || a.lon - b.lon || a.name.localeCompare(b.name),
  );
  const out: T[] = [];
  let at = left.shift();
  while (at) {
    out.push(at);
    let best = -1;
    for (let i = 0; i < left.length; i++) {
      if (best < 0 || kmBetween(at, left[i]) < kmBetween(at, left[best])) best = i;
    }
    at = best < 0 ? undefined : left.splice(best, 1)[0];
  }
  return out;
}

export const mid = (pts: readonly At[]): At => ({
  lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
  lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length,
});

/** Every face's place in its range's walk (areas walked, then each area's
 * parts), once: id → rank. */
let ranks: Map<string, number> | null = null;
function rankOf(id: string): number {
  if (!ranks) {
    ranks = new Map();
    const all = placedFaces();
    for (const range of new Set(all.map((f) => f.range))) {
      const mine = all.filter((f) => f.range === range);
      const areas = [...new Set(mine.map((f) => f.area))].map((name) => ({
        name,
        ...mid(mine.filter((f) => f.area === name)),
      }));
      let n = 0;
      for (const area of walk(areas)) {
        const parts = mine.filter((f) => f.area === area.name).map((f) => ({ ...f, name: f.part }));
        for (const p of walk(parts)) ranks.set(p.id, n++);
      }
    }
  }
  return ranks.get(id) ?? 0;
}

/** A range's areas, neighbour after neighbour. */
export function rangeAreas(range: string): string[] {
  const mine = placedFaces()
    .filter((f) => f.range === range)
    .sort((a, b) => rankOf(a.id) - rankOf(b.id));
  return [...new Set(mine.map((f) => f.area))];
}

/** An area's parts, neighbour after neighbour. */
export function areaParts(range: string, area: string): FacePart[] {
  return placedFaces()
    .filter((f) => f.range === range && f.area === area)
    .sort((a, b) => rankOf(a.id) - rankOf(b.id))
    .map((f) => ({ id: f.id, part: f.part, region: realFaceRegion(f.id)! }));
}

/** The face a pick of `range` (and `area`) lands on: the first part of
 * the first area, or null where there is none. */
export function firstFace(range: string, area?: string): string | null {
  const a = area ?? rangeAreas(range)[0];
  return a === undefined ? null : (areaParts(range, a)[0]?.id ?? null);
}

// THE START CARD'S WHERE, AS THREE ROWS. The real ranges come first, by
// name, and RANGE's LAST stop is GENERATED — a mountain the generator
// raises off the seed. AREA is, under GENERATED, the kind of snow country it is raised
// in (R21's four regions), and under a real range its ski areas. The third
// row is, under GENERATED, the mountain's NUMBER (the seed itself), and
// under a real area its parts. A ride keeps no row of its own for any of
// it: `face` null is GENERATED, `region` its country and `seed` its number,
// so a ride stored by an older build reads straight back.

/** The RANGE row's last stop: the seed's own mountain. */
export const GENERATED = "generated";

/** The RANGE row's stops: every range with a face, then GENERATED. */
export function rangeIds(): string[] {
  return [...faceRanges(), GENERATED];
}

/** The range a ride's face lies in, GENERATED for none. */
export function rangeOf(face: string | null): string {
  return (face && realFacePlace(face)?.range) || GENERATED;
}

/** The AREA row's stops under `range`: the four countries under
 * GENERATED, the range's ski areas under a real one. */
export function areaIds(range: string): string[] {
  return range === GENERATED ? [...REGION_IDS] : rangeAreas(range);
}

/** The AREA row's reading: a generated ride's country, a real one's area. */
export function areaOf(face: string | null, region: RegionId): string {
  return (face && realFacePlace(face)?.area) || region;
}

/** Where a ride stands once RANGE (and AREA) are picked: GENERATED keeps
 * the ride's country (or takes the one picked); a real range lands on the
 * first part of its first area (or of the area picked), the face's own
 * country with it. Null where nothing is there. */
export function wherePicked(
  range: string,
  region: RegionId,
  area?: string,
): { face: string | null; region: RegionId } | null {
  if (range === GENERATED) {
    const picked = (REGION_IDS as readonly string[]).includes(area ?? "");
    return { face: null, region: picked ? (area as RegionId) : region };
  }
  const face = firstFace(range, area);
  return face === null ? null : { face, region: realFaceRegion(face)! };
}
