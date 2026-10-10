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
  cabinsOf,
  doorOf,
  generateLevel,
  gradeOf,
  helipadOf,
  balloonSiteOf,
  loadRealFace,
  lodgesOf,
  paraStartOf,
  sledSpotOf,
  portableLevel,
  type Level,
  type PisteGrade,
  type RunGrade,
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
  face: string | null;
  grade: RunGrade | null;
  paint: boolean;
  /** The map itself, where the page already had it: painted, not built. */
  level?: PortableLevel;
};

/** What the card is shown: everything but the map itself. */
export type PreviewPainted = {
  seed: number;
  region: RegionId;
  face: string | null;
  grade: RunGrade | null;
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
  /** Where the RUN row's machines wait on the valley floor — the
   * helicopter's pad (`helipadOf`) and the snowmobile's spot
   * (`sledSpotOf`) — and the summit the paramotor starts on
   * (`paraStartOf`) and the balloon's site (`balloonSiteOf`): the place the card marks when one is picked — and the
   * door of the valley's afterski lodge (`lodgesOf`), null on a map with
   * none, where the RUN row offers no afterski. */
  machines: Record<"heli" | "sled" | "para" | "balloon", { x: number; y: number; z: number }> & {
    afterski: { x: number; y: number; z: number } | null;
  };
};

/** A seed the generator refuses is an answer too: the card says so rather
 * than sitting on a spinner forever. */
export type PreviewRefused = {
  seed: number;
  region: RegionId;
  face: string | null;
  grade: RunGrade | null;
  ok: false;
  error: string;
};

/** What comes back: the pictures (null on a job that asked for none) and
 * the map, or the refusal. */
export type PreviewReply =
  | {
      seed: number;
      region: RegionId;
      face: string | null;
      grade: RunGrade | null;
      ok: true;
      painted: PreviewPainted | null;
      /** Null where the page handed the map in. */
      level: PortableLevel | null;
    }
  | PreviewRefused;

/** How far the map being built has got, 0–1 (`GenerateOptions.progress`),
 * posted as the generator reaches its landmarks — the start card's bar and
 * the loading card's, while a free ride waits on this map. */
export type PreviewProgress = {
  seed: number;
  region: RegionId;
  face: string | null;
  grade: RunGrade | null;
  share: number;
};

const post = (reply: PreviewReply | PreviewProgress, transfer: Transferable[] = []): void =>
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

const placeOf = ({ x, y, z }: { x: number; y: number; z: number }) => ({ x, y, z });
/** The summit the paramotor's ride is stood up on (`paraStartOf`). */
const summitOf = (level: Level) => {
  const { x, z } = paraStartOf(level);
  return { x, y: level.groundAt(x, z), z };
};

/** The door of the valley's afterski lodge a ride begun at the party
 * stands at (`lodgesOf`'s first), or null on a map with none. */
const lodgeDoorOf = (level: Level) => {
  const lodge = lodgesOf(level)[0];
  if (!lodge) return null;
  const { x, z } = doorOf(lodge);
  return { x, y: level.groundAt(x, z), z };
};

self.onmessage = async (e: MessageEvent<PreviewRequest>) => {
  const { seed, region, face, grade, paint, level: given } = e.data;
  try {
    // A real face is fetched before its map is raised or painted (the
    // panorama stands its real houses).
    if (face) await loadRealFace(face);
    const level = given
      ? boundLevel(given)
      : generateLevel(seed, {
          region,
          face: face ?? undefined,
          grade: grade ?? undefined,
          progress: (share) => post({ seed, region, face, grade, share }),
        });
    const transfer: Transferable[] = [];
    let painted: PreviewPainted | null = null;
    if (paint) {
      const picture = await encode(
        CHART_PX,
        bakeMinimap(minimapSource(level), CHART_PX, CHART_LIGHT),
        transfer,
      );
      const houses = cabinsOf(level);
      const view = fitPanorama(level);
      const drawn = renderPanorama(level, view);
      const pick = pickGrid(view, drawn.depth);
      transfer.push(pick.buffer);
      const panorama: PreviewPanorama = {
        picture: await encode(view.px, drawn.rgba, transfer),
        view,
        schematic: panoramaSchematic(level, view, drawn.depth, houses),
        pick,
      };
      painted = {
        seed,
        region,
        face,
        grade,
        ok: true,
        picture,
        schematic: seedSchematic(level, houses),
        panorama,
        length: level.track.length,
        vertical: level.mountain?.vertical ?? 0,
        colour: gradeOf(level),
        board: boardKey(level),
        ...freeRunList(level),
        machines: {
          heli: placeOf(helipadOf(level)),
          sled: placeOf(sledSpotOf(level)),
          para: summitOf(level),
          balloon: placeOf(balloonSiteOf(level)),
          afterski: lodgeDoorOf(level),
        },
      };
    }
    // The map is copied, not transferred: this worker's own last resort
    // (`buildResort`'s cache) holds the very same grids, and a grade
    // stepped on this seed is built off them.
    post(
      {
        seed,
        region,
        face,
        grade,
        ok: true,
        painted,
        level: given ? null : portableLevel(level),
      },
      transfer,
    );
  } catch (err) {
    post({
      seed,
      region,
      face,
      grade,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
