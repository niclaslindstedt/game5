// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TEXTURES PAINTED IN CODE THAT NO MAP CHANGES — the buildings' stack
// (`facade-paint.ts`: thirty layers of colour, roughness and relief) and the
// village's streets in both seasons (`street-paint.ts`,
// `street-paint-summer.ts`) — named once, so the painter off the main
// thread (`paint-worker.ts`) and the fallback on it (`paint-ahead.ts`) paint
// exactly the same bytes. Three-free and DOM-free.

import { paintFacades } from "./facade-paint.ts";
import { paintArea, paintRoad, paintWalk, type Paint } from "./street-paint.ts";
import { paintSummerArea, paintSummerRoad, paintSummerWalk } from "./street-paint-summer.ts";
import { TILE } from "./street-plan.ts";

/** Every texture painted ahead, by name. */
export type Painted = {
  facades: { albedo: Uint8Array; normal: Uint8Array };
  road: Paint;
  area: Paint;
  walk: Paint;
  square: Paint;
  summerRoad: Paint;
  summerArea: Paint;
  summerWalk: Paint;
  summerSquare: Paint;
};
export type PaintName = keyof Painted;

/** How each is painted — the facades first, the heaviest by far. */
export const PAINTS: { [K in PaintName]: () => Painted[K] } = {
  facades: () => paintFacades(),
  road: () => paintRoad(),
  area: () => paintArea(),
  walk: () => paintWalk(),
  square: () => paintWalk(512, TILE.square, 0.62),
  summerRoad: () => paintSummerRoad(),
  summerArea: () => paintSummerArea(),
  summerWalk: () => paintSummerWalk(),
  summerSquare: () => paintSummerWalk(512, TILE.square),
};

/** The buffers a painted value holds, to be handed over rather than copied. */
export function buffersOf(value: Painted[PaintName]): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const v of Object.values(value)) {
    if (v instanceof Uint8Array) out.push(v.buffer as ArrayBuffer);
  }
  return out;
}
