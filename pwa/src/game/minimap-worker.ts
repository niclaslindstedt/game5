// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MINIMAP'S BAKE, OFF THE MAIN THREAD. A million samples of the
// heightfield and a megapixel encoded are a few hundred milliseconds on a
// phone, and they land while the lights are counting down — the one stretch
// of a race the frame rate is most visible in. Here the snow does not miss a
// frame and the map arrives when it arrives. `minimap-bake.ts` is DOM-free,
// so it runs here unchanged.
//
// The reply is the finished picture where the worker has a canvas of its own
// (`OffscreenCanvas`), so the main thread only wraps a Blob in a URL; the
// raw pixels where it has not, for the main thread to encode.

import { MAP_QUALITY, MAP_TYPE, bakeMinimap, type MinimapSource } from "./minimap-bake.ts";

export type BakeRequest = { id: number; source: MinimapSource; px: number };
export type BakeReply =
  { id: number; picture: Blob } | { id: number; px: number; rgba: Uint8ClampedArray<ArrayBuffer> };

const post = (reply: BakeReply, transfer: Transferable[] = []): void =>
  (self as unknown as Worker).postMessage(reply, transfer);

self.onmessage = async (e: MessageEvent<BakeRequest>) => {
  const { id, source, px } = e.data;
  const rgba = bakeMinimap(source, px);
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(px, px);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.putImageData(new ImageData(rgba, px, px), 0, 0);
      post({ id, picture: await canvas.convertToBlob({ type: MAP_TYPE, quality: MAP_QUALITY }) });
      return;
    }
  }
  post({ id, px, rgba }, [rgba.buffer]);
};
