// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MAP BOARDS' PICTURE, handed from the start card to the game: the
// panorama the card's worker painted to show a map (`seed-preview-worker.ts`)
// kept by what names the map, so the boards at that map's lift tops
// (`map-board.ts`) are painted with the very picture the skier picked it
// on, never painted twice. Three-free and DOM-free: the worker names the
// map it built, and the card keeps its answer.

import type { PanoramaSchematic, PanoramaView } from "./panorama.ts";

/** The panorama as the card's worker painted it: the picture (a finished
 * one, or raw pixels), the view it was painted from and the schematic cut
 * against it. */
export type BoardPicture = {
  picture: Blob | { px: number; rgba: Uint8ClampedArray<ArrayBuffer> };
  view: PanoramaView;
  schematic: PanoramaSchematic;
};

/** What names a map's picture: its seed, its country, its grade, the
 * generator that built it and the length its piste came out — the card's
 * worker and the game name the same map alike. */
export function boardKey(level: {
  seed: number;
  region?: string;
  face?: string;
  grade?: string;
  version?: number;
  track: { length: number };
}): string {
  const length = level.track.length.toFixed(1);
  return `${level.seed}:${level.face ?? level.region ?? "alpine"}:${level.grade ?? "-"}:${level.version ?? 0}:${length}`;
}

/** The pictures kept, newest last: a skier walks tens of seeds on the
 * card, never thousands. */
const kept = new Map<string, BoardPicture>();
const KEPT = 12;

/** Keep a picture the card painted, for a board on that map. */
export function rememberBoard(key: string, picture: BoardPicture): void {
  kept.delete(key);
  kept.set(key, picture);
  if (kept.size > KEPT) kept.delete(kept.keys().next().value as string);
}

/** The picture kept for a map, if the card painted one. */
export function keptBoard(key: string): BoardPicture | undefined {
  return kept.get(key);
}
