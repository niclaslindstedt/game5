// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE'S WHERE, AS STEPS — DOM-free, so the suite reads it.
//
// FREE RIDE opens on THE WORLD: a world map with a marker on every real
// ski area where it lies, flown onto the range the ride stands in; a
// marker tapped (or the RANGE and AREA rows stepped) picks the area, and
// the map flies onto its range. NEXT goes on to THE AREA — the area's
// mountainsides on a closer map, a marker each — where an area has more
// than one, and straight to the START CARD (the chart, the run, the day)
// where it has one, or where the ride is GENERATED (RANGE's last stop:
// the seed's own mountain, whose country and number are the start card's
// rows). Back walks the same steps the other way.
//
// What is picked is the ride's `face` and `region` and nothing of its own
// (`free-ride.ts`): the steps are another way to say what the start card's
// RANGE, AREA and PART rows say, so a stored ride, a `?face=` link and the
// rows all read the same answer. A marker's place is its parts' middle off
// the face index — the crop row's own middle, a hundredth of a degree —
// rough on purpose: near enough to tell two towns ten kilometres apart,
// never a lift's spot.

import { realFacePlace } from "@engine";

import { areaParts, mid, placedFaces, rangeAreas, rangeOf } from "./face-picks.ts";
import { type Camera, fitCamera, type LatLon, type View, worldCamera } from "./world-map.ts";

/** The steps a free ride is picked on, and the card before them. */
export type WhereStep = "play" | "world" | "area" | "start";

/** One ski area's marker on the world map. */
export type AreaMark = LatLon & {
  /** `range/area`: an area's name is its own only inside its range. */
  key: string;
  range: string;
  area: string;
  /** Its parts' faces, neighbour after neighbour. */
  faces: string[];
};

/** One mountainside's marker on the area step. */
export type PartMark = LatLon & { id: string; part: string };

export const areaKey = (range: string, area: string): string => `${range}/${area}`;

let marks: AreaMark[] | null = null;
/** Every real ski area's marker: its range's areas in their walk, the
 * ranges in the order RANGE lists them, each at its parts' middle. */
export function areaMarks(): readonly AreaMark[] {
  if (!marks) {
    const all = placedFaces();
    marks = [...new Set(all.map((f) => f.range))].flatMap((range) =>
      rangeAreas(range).map((area) => {
        const faces = areaParts(range, area).map((p) => p.id);
        const at = mid(all.filter((f) => faces.includes(f.id)));
        return { key: areaKey(range, area), range, area, faces, ...at };
      }),
    );
  }
  return marks;
}

/** The marker of the area a ride's face lies in, or null (GENERATED). */
export function markOf(face: string | null): AreaMark | null {
  const place = face ? realFacePlace(face) : null;
  if (!place) return null;
  return areaMarks().find((m) => m.key === areaKey(place.range, place.area)) ?? null;
}

/** A face's area's mountainsides as markers, neighbour after neighbour. */
export function partMarks(face: string | null): PartMark[] {
  const place = face ? realFacePlace(face) : null;
  if (!place) return [];
  return areaParts(place.range, place.area).map((p) => {
    const at = realFacePlace(p.id)!;
    return { id: p.id, part: p.part, lat: at.lat, lon: at.lon };
  });
}

/** Whether a ride standing on `face` has an AREA step to pick on. */
export function hasAreaStep(face: string | null): boolean {
  return partMarks(face).length > 1;
}

/** The step NEXT goes on to from `step`. */
export function stepAfter(step: WhereStep, face: string | null): WhereStep {
  if (step === "play") return "world";
  if (step === "world") return hasAreaStep(face) ? "area" : "start";
  return "start";
}

/** The step BACK goes to from `step`. */
export function stepBefore(step: WhereStep, face: string | null): WhereStep {
  if (step === "start") return hasAreaStep(face) ? "area" : "world";
  if (step === "area") return "world";
  return "play";
}

/** The world map's camera framing a whole range at the least this wide,
 * km — a range of one area shows its country round it. */
export const RANGE_KM = 520;
/** The area step's camera at the least this wide, km. */
export const AREA_KM = 34;
/** The room the markers and their labels keep from the view's edge, px. */
export const FRAME_PAD = 48;

/** WHERE THE WORLD MAP STANDS for a ride on `face`: framing its range's
 * every area, or the whole world for GENERATED. */
export function worldTarget(face: string | null, view: View): Camera {
  const range = rangeOf(face);
  const mine = areaMarks().filter((m) => m.range === range);
  if (mine.length === 0) return worldCamera(view);
  return fitCamera(mine, view, Math.min(FRAME_PAD, view.w / 6, view.h / 6), RANGE_KM);
}

/** WHERE THE AREA STEP STANDS: framing the area's every mountainside. */
export function areaTarget(face: string | null, view: View): Camera {
  const parts = partMarks(face);
  if (parts.length === 0) return worldTarget(face, view);
  return fitCamera(parts, view, Math.min(FRAME_PAD * 1.5, view.w / 5, view.h / 5), AREA_KM);
}

/** The marker nearest a screen point, if it is within `reach` px. */
export function nearestMark<T extends { x: number; y: number }>(
  at: { x: number; y: number },
  pts: readonly T[],
  reach: number,
): number {
  let best = -1;
  let d = reach;
  pts.forEach((p, i) => {
    const di = Math.hypot(p.x - at.x, p.y - at.y);
    if (di <= d) [best, d] = [i, di];
  });
  return best;
}
