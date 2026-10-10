// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MAP ORDERED FOR THE LOADING CARD — what a load asks to have generated
// off the page's thread, and what it reads of the job meanwhile. Types
// alone, DOM-free, so the load's sequencing (`app-load.ts`) can name them
// without learning there is a worker (`map-build.ts`, `map-worker.ts`).

import type { CreateGameOptions, GenerateOptions, Level, PortableLevel } from "@engine";

/** WHAT TO BUILD: a map the generator is asked for directly (a pinned or a
 * trick map's row), or the map a run of a mode is skied on (`levelFor`). */
export type MapOrder =
  | { seed: number; generate: Omit<GenerateOptions, "progress"> }
  | { seed: number; game: Pick<CreateGameOptions, "mode" | "region" | "face" | "grade"> };

/** The order for the map a run with these options is skied on — only what
 * picks the map is posted, so nothing a worker cannot take is. */
export const gameOrder = (o: CreateGameOptions): MapOrder => ({
  seed: o.seed ?? 1,
  game: { mode: o.mode, region: o.region, face: o.face, grade: o.grade },
});

/** The real face an order raises its map on, if any — fetched before the
 * map is built (`loadRealFace`). */
export const faceOfOrder = (order: MapOrder): string | undefined =>
  "generate" in order ? order.generate.face : order.game.face;

/** A map being built. */
export type MapJob = {
  /** How far the generator has got, 0–1. */
  share: () => number;
  /** The map, once it is built. */
  level: () => Level | undefined;
  /** Why it could not be built, once it is known it cannot. */
  failed: () => string | null;
  /** Stop building it. */
  cancel: () => void;
};

/** What the worker posts back. */
export type MapWorkerReply =
  | { kind: "progress"; share: number }
  | { kind: "built"; level: PortableLevel }
  | { kind: "failed"; error: string };
