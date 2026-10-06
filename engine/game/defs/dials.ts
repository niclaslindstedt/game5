// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RUN DIALS: numbers a run is created with that shape no rule — how deep
// the loose snow lies, and how much a skier takes before he is thrown —
// each held to its range on the way in. Re-exported by `modes.ts`, where
// the run's rules are.

/** THE SNOW'S DEPTH, a RUN DIAL: how deep the loose snow lies, as a
 * multiple of the ordinary snow's — `TUNING.snow.cover` of it, which a
 * standing skier sinks `TUNING.snow.powderSink` into (`snow.ts`). One is
 * the snow every race is skied on; a free ride may ask for a dusting over a
 * crust or a metre of bottomless fresh snow (2.5, `snow.deep.full`). It is
 * read, never written, during a run and draws nothing from the stream, so a
 * run replays the same at any depth and a run that names none moves no
 * digest. */
export const SNOW_DIAL = { min: 0.25, max: 2.5, step: 0.25 } as const;

/** A depth held inside {@link SNOW_DIAL}; anything that is not a number is
 * the ordinary snow. */
export function clampSnowDepth(depth: number | undefined): number {
  if (depth === undefined || !Number.isFinite(depth)) return 1;
  return Math.min(SNOW_DIAL.max, Math.max(SNOW_DIAL.min, depth));
}

/** A resilience held to 0..1 (`SkierState.resilience`); anything that is
 * not a number is the professional's. */
export function clampResilience(r: number | undefined): number {
  if (r === undefined || !Number.isFinite(r)) return 1;
  return Math.min(1, Math.max(0, r));
}
