// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START CARD'S WORKER — a whole map generated, its ground baked and its
// schematic cut, off the thread the snow is drawn on.
//
// IT IS A WORKER FOR ONE REASON. Generating a map is the most expensive
// thing this engine does — hundreds of milliseconds, and every rejected
// sub-seed another basin raised and thrown away — and the front door's whole
// design is that THE SNOW NEVER STOPS behind a card. A seed stepped on the
// main thread would freeze the race behind the card for a third of a second
// per press; here it does not miss a frame and the chart arrives when it
// arrives. The engine is framework-free and `minimap-bake.ts` and
// `seed-chart.ts` are DOM-free, so all three run here unchanged.

import { generateLevel, type RegionId } from "@engine";

import { MAP_QUALITY, MAP_TYPE, bakeMinimap, minimapSource } from "./minimap-bake.ts";
import { CHART_PX, seedSchematic, type SeedSchematic } from "./seed-chart.ts";

/** What the card asks for: one seed, in one kind of snow country (R21). */
export type PreviewRequest = { seed: number; region: RegionId };

/** What comes back. A seed the generator refuses is an answer too: the
 * card says so rather than sitting on a spinner forever. The picture is
 * finished where the worker has a canvas of its own, raw pixels where not. */
export type PreviewReply =
  | {
      seed: number;
      region: RegionId;
      ok: true;
      picture: Blob | { px: number; rgba: Uint8ClampedArray<ArrayBuffer> };
      schematic: SeedSchematic;
      /** The loop, m. */
      length: number;
      /** The mountain's vertical, m — the summit to the base (R2). */
      vertical: number;
    }
  | { seed: number; region: RegionId; ok: false; error: string };

const post = (reply: PreviewReply, transfer: Transferable[] = []): void =>
  (self as unknown as Worker).postMessage(reply, transfer);

self.onmessage = async (e: MessageEvent<PreviewRequest>) => {
  const { seed, region } = e.data;
  try {
    const level = generateLevel(seed, { region });
    const rgba = bakeMinimap(minimapSource(level), CHART_PX);
    const base = {
      seed,
      region,
      ok: true as const,
      schematic: seedSchematic(level),
      length: level.track.length,
      vertical: level.mountain?.vertical ?? 0,
    };
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(CHART_PX, CHART_PX);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.putImageData(new ImageData(rgba, CHART_PX, CHART_PX), 0, 0);
        const picture = await canvas.convertToBlob({ type: MAP_TYPE, quality: MAP_QUALITY });
        post({ ...base, picture });
        return;
      }
    }
    post({ ...base, picture: { px: CHART_PX, rgba } }, [rgba.buffer]);
  } catch (err) {
    post({ seed, region, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
