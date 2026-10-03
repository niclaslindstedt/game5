// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MINIMAP'S BAKE, OFF THE MAIN THREAD. A few million samples of the
// heightfield are a second or so on a phone, and they land while the lights
// are counting down — the one stretch of a race the frame rate is most
// visible in. Here the snow does not miss a frame and the map arrives when
// it arrives. `minimap-bake.ts` is DOM-free, so it runs here unchanged.
//
// The reply is the finished picture as a bitmap where the worker can make
// one, so the main thread only draws it; the raw pixels where it cannot,
// for the main thread to put into a canvas of its own. Either is
// transferred, never copied.

import { bakeMinimap, type MinimapSource } from "./minimap-bake.ts";

export type BakeRequest = { id: number; source: MinimapSource; px: number };
export type BakeReply =
  | { id: number; bitmap: ImageBitmap }
  | { id: number; px: number; rgba: Uint8ClampedArray<ArrayBuffer> };

const post = (reply: BakeReply, transfer: Transferable[]): void =>
  (self as unknown as Worker).postMessage(reply, transfer);

self.onmessage = async (e: MessageEvent<BakeRequest>) => {
  const { id, source, px } = e.data;
  const rgba = bakeMinimap(source, px);
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(new ImageData(rgba, px, px));
      post({ id, bitmap }, [bitmap]);
      return;
    } catch {
      // Raw pixels below: the main thread can always put those in a canvas.
    }
  }
  post({ id, px, rgba }, [rgba.buffer]);
};
