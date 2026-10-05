// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START CARD'S WORKER — a whole map generated, its ground baked and its
// schematic cut, its PANORAMA painted (`panorama.ts`) and the courses cut
// against it, off the thread the snow is drawn on.
//
// IT IS A WORKER FOR ONE REASON. Generating a map is the most expensive
// thing this engine does — seconds, and every rejected sub-seed another
// basin raised and thrown away — and the front door's whole design is that
// THE SNOW NEVER STOPS behind a card. A seed stepped on the main thread
// would freeze the race behind the card while it builds; here it does not
// miss a frame and the chart arrives when it arrives. The engine is
// framework-free and `minimap-bake.ts`, `seed-chart.ts` and `panorama.ts`
// are DOM-free, so all of them run here unchanged.
//
// THE MAP COMES BACK TOO (`portableLevel`): the page keeps it, and a free
// ride stood up on that seed rides it rather than building it again on the
// loading card (`seed-maps.ts`). A job whose pictures the page already has
// (`paint` off) builds the map alone, and one the page already had is
// handed in (`level`) to be painted and never built.

import {
  boundLevel,
  generateLevel,
  gradeOf,
  portableLevel,
  type PisteGrade,
  type PortableLevel,
  type RegionId,
} from "@engine";

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
 * one grade (R23) — null the one the seed deals — and whether its pictures
 * are wanted, or only the map. */
export type PreviewRequest = {
  seed: number;
  region: RegionId;
  grade: PisteGrade | null;
  paint: boolean;
  /** The map itself, where the page already had it: painted, not built. */
  level?: PortableLevel;
};

/** What the card is shown: everything but the map itself. */
export type PreviewPainted = {
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
};

/** A seed the generator refuses is an answer too: the card says so rather
 * than sitting on a spinner forever. */
export type PreviewRefused = {
  seed: number;
  region: RegionId;
  grade: PisteGrade | null;
  ok: false;
  error: string;
};

/** What comes back: the pictures (null on a job that asked for none) and
 * the map, or the refusal. */
export type PreviewReply =
  | {
      seed: number;
      region: RegionId;
      grade: PisteGrade | null;
      ok: true;
      painted: PreviewPainted | null;
      /** Null where the page handed the map in. */
      level: PortableLevel | null;
    }
  | PreviewRefused;

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
  const { seed, region, grade, paint, level: given } = e.data;
  try {
    const level = given
      ? boundLevel(given)
      : generateLevel(seed, { region, grade: grade ?? undefined });
    const transfer: Transferable[] = [];
    let painted: PreviewPainted | null = null;
    if (paint) {
      const picture = await encode(
        CHART_PX,
        bakeMinimap(minimapSource(level), CHART_PX, CHART_LIGHT),
        transfer,
      );
      const view = fitPanorama(level);
      const drawn = renderPanorama(level, view);
      const pick = pickGrid(view, drawn.depth);
      transfer.push(pick.buffer);
      const panorama: PreviewPanorama = {
        picture: await encode(view.px, drawn.rgba, transfer),
        view,
        schematic: panoramaSchematic(level, view, drawn.depth),
        pick,
      };
      painted = {
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
      };
    }
    // The map is copied, not transferred: this worker's own last resort
    // (`buildResort`'s cache) holds the very same grids, and a grade
    // stepped on this seed is built off them.
    post(
      { seed, region, grade, ok: true, painted, level: given ? null : portableLevel(level) },
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
