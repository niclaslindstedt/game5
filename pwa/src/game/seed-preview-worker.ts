// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START CARD'S WORKER — a whole map generated, its ground baked and its
// schematic cut, its PANORAMA painted (`panorama.ts`) and the courses cut
// against it, off the thread the snow is drawn on.
//
// IT IS A WORKER FOR ONE REASON. Generating a map is the most expensive
// thing this engine does — hundreds of milliseconds, and every rejected
// sub-seed another basin raised and thrown away — and the front door's whole
// design is that THE SNOW NEVER STOPS behind a card. A seed stepped on the
// main thread would freeze the race behind the card for a third of a second
// per press; here it does not miss a frame and the chart arrives when it
// arrives. The engine is framework-free and `minimap-bake.ts`,
// `seed-chart.ts` and `panorama.ts` are DOM-free, so all of them run here
// unchanged.

import { generateLevel, gradeOf, type PisteGrade, type RegionId } from "@engine";

import { freeRunList, type FreeRunInfo } from "./free-ride.ts";
import { boardKey } from "./map-board-picture.ts";
import { MAP_QUALITY, MAP_TYPE, bakeMinimap, minimapSource } from "./minimap-bake.ts";
import {
  fitPanorama,
  panoramaSchematic,
  pickGrid,
  renderPanorama,
  type PanoramaSchematic,
  type PanoramaView,
} from "./panorama.ts";
import { CHART_LIGHT, CHART_PX, seedSchematic, type SeedSchematic } from "./seed-chart.ts";

/** A picture as the worker hands it back: finished where it has a canvas
 * of its own, raw pixels where not. */
export type PreviewPicture = Blob | { px: number; rgba: Uint8ClampedArray<ArrayBuffer> };

/** The mountain painted from the valley, and what the card needs to draw
 * over it and to turn a tap on it back into the snow. */
export type PreviewPanorama = {
  picture: PreviewPicture;
  view: PanoramaView;
  schematic: PanoramaSchematic;
  /** `pickGrid`'s world z behind each cell (NaN on the sky). */
  pick: Float32Array<ArrayBuffer>;
};

/** What the card asks for: one seed, in one kind of snow country (R21), to
 * one grade (R23) — null the one the seed deals. */
export type PreviewRequest = { seed: number; region: RegionId; grade: PisteGrade | null };

/** What comes back. A seed the generator refuses is an answer too: the
 * card says so rather than sitting on a spinner forever. */
export type PreviewReply =
  | {
      seed: number;
      region: RegionId;
      grade: PisteGrade | null;
      ok: true;
      /** The plan's ground. */
      picture: PreviewPicture;
      schematic: SeedSchematic;
      panorama: PreviewPanorama;
      /** The loop, m. */
      length: number;
      /** The mountain's vertical, m — the summit to the base (R2). */
      vertical: number;
      /** The colour the piste came out (R23, `gradeOf`). */
      colour: PisteGrade;
      /** What names the map built (`boardKey`): the boards at its lifts'
       * tops are painted with this panorama. */
      board: string;
      /** The runs a ride by lift can start down, and the map's own. */
      runs: FreeRunInfo[];
      fallback: string | null;
    }
  | { seed: number; region: RegionId; grade: PisteGrade | null; ok: false; error: string };

const post = (reply: PreviewReply, transfer: Transferable[] = []): void =>
  (self as unknown as Worker).postMessage(reply, transfer);

/** Raw pixels as a finished picture where this worker has a canvas, as
 * themselves (to be transferred) where it does not. */
async function encode(
  px: number,
  rgba: Uint8ClampedArray<ArrayBuffer>,
  transfer: Transferable[],
): Promise<PreviewPicture> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(px, px);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.putImageData(new ImageData(rgba, px, px), 0, 0);
      return canvas.convertToBlob({ type: MAP_TYPE, quality: MAP_QUALITY });
    }
  }
  transfer.push(rgba.buffer);
  return { px, rgba };
}

self.onmessage = async (e: MessageEvent<PreviewRequest>) => {
  const { seed, region, grade } = e.data;
  try {
    const level = generateLevel(seed, { region, grade: grade ?? undefined });
    const transfer: Transferable[] = [];
    const picture = await encode(
      CHART_PX,
      bakeMinimap(minimapSource(level), CHART_PX, CHART_LIGHT),
      transfer,
    );
    const view = fitPanorama(level);
    const painted = renderPanorama(level, view);
    const pick = pickGrid(view, painted.depth);
    transfer.push(pick.buffer);
    const panorama: PreviewPanorama = {
      picture: await encode(view.px, painted.rgba, transfer),
      view,
      schematic: panoramaSchematic(level, view, painted.depth),
      pick,
    };
    post(
      {
        seed,
        region,
        grade,
        ok: true,
        picture,
        schematic: seedSchematic(level),
        panorama,
        length: level.track.length,
        vertical: level.mountain?.vertical ?? 0,
        colour: gradeOf(level),
        board: boardKey(level),
        ...freeRunList(level),
      },
      transfer,
    );
  } catch (err) {
    post({
      seed,
      region,
      grade,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
