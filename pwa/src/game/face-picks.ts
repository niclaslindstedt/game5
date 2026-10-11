// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES AS THE START CARD FILES THEM — RANGE, then AREA, then PART:
// the range a face lies in (a country, or a range across borders), the
// place its ski area is known by, and the part of that area it is — and
// only the faces whose real ski area signs a piste of the GRADE asked for.
// DOM-free: the card's RANGE, AREA and PART rows read it, and so does the
// suite. RANGE's last stop is GENERATED, the seed's own mountain (below).
//
// The GRADE row hides a part whose ski area has no piste of its colour,
// then an area with no part left, then a range with no area left. ORANGE
// hides nothing — the game finds its own ski routes on every face (R42).
//
// THE NEXT ONE IS THE NEXT ONE OVER. A range's areas are listed as a WALK:
// from its most northerly area (the most westerly of a tie) on to the
// nearest area not yet listed, and so on, each area at the middle of its
// parts — so stepping the AREA row moves to a neighbour, never back and
// forth across the range. An area's parts are walked the same way. The
// walk is taken over every face, whatever the GRADE, so hiding some never
// reorders the rest; it scales to as many areas as a range has.

import {
  REAL_FACE_IDS,
  REGION_IDS,
  realFaceGrades,
  realFacePlace,
  realFaceRegion,
  type RegionId,
  type RunGrade,
} from "@engine";

import { STRINGS } from "./strings.ts";

/** One part on the PART row: its face and its place. */
export type FacePart = { id: string; part: string; region: RegionId };

/** Whether a face's real ski area has a piste of `grade` (any, for none). */
export function faceHasGrade(id: string, grade: RunGrade | null): boolean {
  return grade === null || realFaceGrades(id).includes(grade);
}

/** Every face of `grade` with its place, in the bake's order. */
function placed(
  grade: RunGrade | null,
): { id: string; range: string; area: string; part: string; lat: number; lon: number }[] {
  return REAL_FACE_IDS.filter((id) => faceHasGrade(id, grade)).map((id) => ({
    id,
    ...realFacePlace(id)!,
  }));
}

/** By name, `THE` read past, as a list of places is. */
const byName = (a: string, b: string): number =>
  a.replace(/^THE /, "").localeCompare(b.replace(/^THE /, ""));

/** Every range with a face of `grade`, in the order of the names the
 * card shows them by. */
export function faceRanges(grade: RunGrade | null): string[] {
  const out = [...new Set(placed(grade).map((f) => f.range))];
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

const mid = (pts: readonly At[]): At => ({
  lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
  lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length,
});

/** Every face's place in its range's walk (areas walked, then each area's
 * parts), once: id → rank. */
let ranks: Map<string, number> | null = null;
function rankOf(id: string): number {
  if (!ranks) {
    ranks = new Map();
    const all = placed(null);
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

/** A range's areas with a face of `grade`, neighbour after neighbour. */
export function rangeAreas(range: string, grade: RunGrade | null): string[] {
  const mine = placed(grade)
    .filter((f) => f.range === range)
    .sort((a, b) => rankOf(a.id) - rankOf(b.id));
  return [...new Set(mine.map((f) => f.area))];
}

/** An area's parts of `grade`, neighbour after neighbour. */
export function areaParts(range: string, area: string, grade: RunGrade | null): FacePart[] {
  return placed(grade)
    .filter((f) => f.range === range && f.area === area)
    .sort((a, b) => rankOf(a.id) - rankOf(b.id))
    .map((f) => ({ id: f.id, part: f.part, region: realFaceRegion(f.id)! }));
}

/** The face a pick of `range` (and `area`) lands on: the first part of
 * the first area of `grade`, or null where there is none. */
export function firstFace(range: string, grade: RunGrade | null, area?: string): string | null {
  const a = area ?? rangeAreas(range, grade)[0];
  return a === undefined ? null : (areaParts(range, a, grade)[0]?.id ?? null);
}

/** The face a ride keeps once its GRADE row reads `grade`: itself if its
 * ski area has that grade, else the first part of its own area that has,
 * else the first of its range's, else none — the seed's own massif. */
export function faceForGrade(face: string | null, grade: RunGrade | null): string | null {
  if (face === null || faceHasGrade(face, grade)) return face;
  const place = realFacePlace(face);
  if (!place) return null;
  return firstFace(place.range, grade, place.area) ?? firstFace(place.range, grade);
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

/** The RANGE row's stops: every range with a face of `grade`, then
 * GENERATED. */
export function rangeIds(grade: RunGrade | null): string[] {
  return [...faceRanges(grade), GENERATED];
}

/** The range a ride's face lies in, GENERATED for none. */
export function rangeOf(face: string | null): string {
  return (face && realFacePlace(face)?.range) || GENERATED;
}

/** The AREA row's stops under `range`: the four countries under
 * GENERATED, the range's ski areas of `grade` under a real one. */
export function areaIds(range: string, grade: RunGrade | null): string[] {
  return range === GENERATED ? [...REGION_IDS] : rangeAreas(range, grade);
}

/** The AREA row's reading: a generated ride's country, a real one's area. */
export function areaOf(face: string | null, region: RegionId): string {
  return (face && realFacePlace(face)?.area) || region;
}

/** Where a ride stands once RANGE (and AREA) are picked: GENERATED keeps
 * the ride's country (or takes the one picked); a real range lands on the
 * first part of its first area of `grade` (or of the area picked), the
 * face's own country with it. Null where nothing of `grade` is there. */
export function wherePicked(
  range: string,
  grade: RunGrade | null,
  region: RegionId,
  area?: string,
): { face: string | null; region: RegionId } | null {
  if (range === GENERATED) {
    const picked = (REGION_IDS as readonly string[]).includes(area ?? "");
    return { face: null, region: picked ? (area as RegionId) : region };
  }
  const face = firstFace(range, grade, area);
  return face === null ? null : { face, region: realFaceRegion(face)! };
}
