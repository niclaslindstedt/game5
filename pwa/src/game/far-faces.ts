// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL COUNTRY ROUND A REAL FACE — the far ranges' heights off the
// elevation model, baked coarse round each face by `make far-faces`
// (`scripts/far-faces.mjs`) into a generated file a face
// (`far-faces/far-<id>.ts`, its format `far-face-codec.ts`), FETCHED ONLY
// WHEN A MAP IS RAISED ON THAT FACE. A face with no file (or a dealt map)
// gets null, and the far ranges deal its region's country instead
// (`far-ranges-field.ts`).

import type { Level } from "@engine";

import { decodeFarFace, type FarFaceData } from "./far-face-codec.ts";
import { FAR_LOADERS } from "./far-faces-index.ts";
import type { FarGrid } from "./far-ranges-field.ts";

/** The baked faces' ids, for the suite. */
export function farFaceIds(): string[] {
  return Object.keys(FAR_LOADERS);
}

/** Load face `id`'s file, or null when none is baked. */
export async function loadFarFace(id: string): Promise<FarFaceData | null> {
  const load = FAR_LOADERS[id];
  return load ? (await load()).FAR : null;
}

/** The real country round `level`'s face in its map's frame, or null. */
export async function farFaceGrid(
  level: Pick<Level, "face" | "mountain">,
): Promise<FarGrid | null> {
  if (!level.face || !level.mountain) return null;
  const far = await loadFarFace(level.face);
  if (!far) return null;
  const heights = decodeFarFace(far);
  const sea = level.mountain.sea;
  for (let k = 0; k < heights.length; k++) heights[k] += sea;
  return {
    bearings: far.bearings,
    rows: far.rows,
    inner: far.inner,
    outer: far.outer,
    heights,
    source: "real",
  };
}
