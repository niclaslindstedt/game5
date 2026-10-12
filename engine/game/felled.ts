// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES GONE from a map: those felled for the village and the ski
// area's buildings (`village.ts`'s `villageFelled`) and those cleared for
// the jump plane's strip and its buildings (`airstrip-site.ts`'s
// `stripFelled`, where a strip is laid). The one set every reader asks —
// the trunks a skier or a craft meets, the woods as drawn, the minimap, the
// tree wells. Its own module so the village need not know the strip.

import type { Level } from "../mapgen/types.ts";
import { stripFelled, stripLaid } from "./airstrip-site.ts";
import { villageFelled } from "./village.ts";

const felled = new WeakMap<Level, Uint8Array>();

/** 1 for each of `level.trees` that is gone. */
export function felledTrees(level: Level): Uint8Array {
  let out = felled.get(level);
  if (out) return out;
  const own = villageFelled(level);
  if (!stripLaid(level)) out = own;
  else {
    out = Uint8Array.from(own);
    const strip = stripFelled(level);
    for (let i = 0; i < out.length; i++) out[i] |= strip[i];
  }
  felled.set(level, out);
  return out;
}
