// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VOLUME'S NOISE, MADE OFF THE MAIN THREAD. The shape texture is a
// quarter of a million texels of gradient and cellular noise — most of a
// second on a desktop — and HIGH may be picked mid-run on OPTIONS, so it is
// made here and the slab stands in until it lands (`cloud-volume.ts`).

import { cloudDetailNoise, cloudShapeNoise } from "./cloud-volume-noise.ts";

export type NoiseReply = { shape: Uint8Array; detail: Uint8Array };

self.onmessage = () => {
  // Copies: the module keeps its own, and the buffers are handed over.
  const shape = cloudShapeNoise().slice();
  const detail = cloudDetailNoise().slice();
  (self as unknown as Worker).postMessage({ shape, detail } satisfies NoiseReply, [
    shape.buffer,
    detail.buffer,
  ]);
};
