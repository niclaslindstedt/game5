// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MAP-FREE TEXTURES PAINTED OFF THE MAIN THREAD (`paint-jobs.ts`): the
// buildings' stack alone is a second of a phone's processor, and it would
// otherwise land while the rider and gear cards are up (`free-stage.ts`
// builds the ride's world behind them). Each is posted back as it is done,
// its bytes transferred, never copied.

import { buffersOf, PAINTS, type PaintName } from "./paint-jobs.ts";

self.onmessage = (e: MessageEvent<PaintName[]>) => {
  for (const name of e.data) {
    const value = PAINTS[name]();
    (self as unknown as Worker).postMessage({ name, value }, buffersOf(value));
  }
};
