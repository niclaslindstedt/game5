// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES AS THE START CARD FILES THEM — by the country each lies
// in, and only those whose real ski area signs a piste of the GRADE asked
// for. DOM-free: the card's SHAPE and PEAK rows read it, and so does the
// suite.
//
// A face is filed under its COUNTRY and numbered in it (REAL 1, REAL 2, …,
// in the bake's order), never named: the number a face carries in its
// country does not move when the GRADE row hides its neighbours. ORANGE
// hides nothing — the game finds its own ski routes on every face (R42).

import {
  REAL_FACE_IDS,
  realFaceCountry,
  realFaceGrades,
  realFaceRegion,
  type RegionId,
  type RunGrade,
} from "@engine";

/** The countries listed first, in this order; the rest follow by code. */
const FIRST: readonly string[] = ["SE", "NO", "FI"];

/** Whether a face's real ski area has a piste of `grade` (any, for none). */
export function faceHasGrade(id: string, grade: RunGrade | null): boolean {
  return grade === null || realFaceGrades(id).includes(grade);
}

/** Every country with a face of `grade`, the first ones first. */
export function faceCountries(grade: RunGrade | null): string[] {
  const out = new Set<string>();
  for (const id of REAL_FACE_IDS) {
    const country = realFaceCountry(id);
    if (country && faceHasGrade(id, grade)) out.add(country);
  }
  const rank = (c: string): number => {
    const i = FIRST.indexOf(c);
    return i < 0 ? FIRST.length : i;
  };
  return [...out].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** A country's faces of `grade`, each with its number in the country. */
export function countryFaces(
  country: string,
  grade: RunGrade | null,
): { id: string; n: number; region: RegionId }[] {
  const all = REAL_FACE_IDS.filter((id) => realFaceCountry(id) === country);
  return all
    .map((id, i) => ({ id, n: i + 1, region: realFaceRegion(id)! }))
    .filter(({ id }) => faceHasGrade(id, grade));
}

/** The face a ride keeps once its GRADE row reads `grade`: itself if its
 * ski area has that grade, else the first of its country's that has, else
 * none — the seed's own massif. */
export function faceForGrade(face: string | null, grade: RunGrade | null): string | null {
  if (face === null || faceHasGrade(face, grade)) return face;
  const country = realFaceCountry(face);
  return (country && countryFaces(country, grade)[0]?.id) ?? null;
}
