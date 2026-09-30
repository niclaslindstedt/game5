// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEED'S CHART — the map a number makes, drawn beside the rows that
// pick it, and the place a free ride starts, picked by pointing at it.
//
// A seed is an opaque integer, and a row that offers one without showing
// what it means is not a choice at all: it is a lottery with arrows on it.
// So the whole map goes on the card — the hills hillshaded, the woods, the
// groomed piste, the start line, and every kicker, on the piste and off it — cut
// from the REAL generated map by the same bake the minimap's ground is, so
// the picture and the snow are never two opinions about one seed.
//
// THE CHART IS ALSO A CONTROL. A press on it is where the ride starts
// (`seed-chart.ts`'s `fromChart` is the one mapping back to the snow, and
// the engine's `freeSpawn` holds the point out of the trees and inside the
// edge); the start line's own mark is where it starts until then.
//
// THE WORK IS THE WORKER'S (`seed-preview-worker.ts`). What is left here is
// the DOM, and the rules about how the picture behaves while the worker is
// busy, which are game3's:
//
//   - THE LAST PICTURE STAYS UP while the next is being drawn, dimmed. A
//     box that emptied on every press would strobe through a walk down the
//     seeds.
//   - A SEED IS ASKED FOR ONCE. Answers are kept, so walking back up the
//     seeds is instant.
//   - ONLY THE SEED ON SCREEN IS DRAWN, and a press is only sent once the
//     arrows have been still for a moment, so a held key does not queue a
//     backlog of maps nobody will look at.
//   - THE BOX IS ALREADY THE SIZE IT WILL BE when the first chart lands:
//     the plate is a square the CARD sizes, so nothing moves under a press
//     already aimed at a button.

import type { RegionId } from "@engine";
import { useEffect, useRef, useState } from "preact/hooks";

import { MAP_QUALITY, MAP_TYPE } from "./minimap-bake.ts";
import { CHART_VIEW, degrees, fromChart, toChart } from "./seed-chart.ts";
import type { PreviewReply, PreviewRequest } from "./seed-preview-worker.ts";
import { STRINGS } from "./strings.ts";

/** How long the arrows have to be still before a map is built, ms. */
const SETTLE_MS = 220;

/** How many answers are kept — a chart is a small JPEG and a schematic of a
 * few kilobytes, and a skier walks tens of seeds, not thousands. */
const KEPT = 40;

/** An answer as the card keeps it: the reply, with its picture as a URL an
 * `<image>` takes. */
export type SeedAnswer =
  | (Extract<PreviewReply, { ok: true }> & { url: string | null })
  | Extract<PreviewReply, { ok: false }>;

/** The chart as the card holds it: the last answer that arrived, and
 * whether it is the answer for the seed on screen. */
export type SeedChart = { shown: SeedAnswer | null; fresh: boolean };

/** Raw pixels as a picture URL — for a worker with no canvas of its own. */
function pixelsToUrl(
  px: number,
  rgba: Uint8ClampedArray<ArrayBuffer>,
  done: (url: string) => void,
): void {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.putImageData(new ImageData(rgba, px, px), 0, 0);
  canvas.toBlob((blob) => blob && done(URL.createObjectURL(blob)), MAP_TYPE, MAP_QUALITY);
}

/** What names an answer: the seed, in its region (R21). */
const keyOf = (a: { seed: number; region: RegionId }): string => `${a.region}:${a.seed}`;

export function useSeedPreview(seed: number, region: RegionId): SeedChart {
  const [shown, setShown] = useState<SeedAnswer | null>(null);
  const cache = useRef(new Map<string, SeedAnswer>());
  const worker = useRef<Worker | null>(null);
  /** The map on screen RIGHT NOW, for the reply handler — a ref, because
   * the handler outlives the render it was created in. */
  const wanted = useRef(keyOf({ seed, region }));
  wanted.current = keyOf({ seed, region });

  useEffect(() => {
    const kept = cache.current;
    const w = new Worker(new URL("./seed-preview-worker.ts", import.meta.url), {
      type: "module",
    });
    const keep = (answer: SeedAnswer): void => {
      if (kept.size >= KEPT) {
        const oldest = kept.keys().next().value as string;
        const out = kept.get(oldest);
        if (out?.ok && out.url) URL.revokeObjectURL(out.url);
        kept.delete(oldest);
      }
      kept.set(keyOf(answer), answer);
      if (keyOf(answer) === wanted.current) setShown(answer);
    };
    w.onmessage = (e: MessageEvent<PreviewReply>) => {
      const reply = e.data;
      if (!reply.ok) {
        keep(reply);
        return;
      }
      const { picture } = reply;
      if (picture instanceof Blob) {
        keep({ ...reply, url: URL.createObjectURL(picture) });
      } else {
        // The pixels are turned into a picture on this thread: keep the
        // schematic at once, and the picture when it lands.
        const answer: SeedAnswer = { ...reply, url: null };
        keep(answer);
        pixelsToUrl(picture.px, picture.rgba, (url) => {
          if (kept.get(keyOf(reply)) === answer) keep({ ...answer, url });
          else URL.revokeObjectURL(url);
        });
      }
    };
    worker.current = w;
    return () => {
      w.terminate();
      worker.current = null;
      for (const a of kept.values()) if (a.ok && a.url) URL.revokeObjectURL(a.url);
      kept.clear();
    };
  }, []);

  useEffect(() => {
    const kept = cache.current.get(keyOf({ seed, region }));
    if (kept) {
      setShown(kept);
      return;
    }
    const ask: PreviewRequest = { seed, region };
    const timer = window.setTimeout(() => worker.current?.postMessage(ask), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [seed, region]);

  return {
    shown,
    fresh: shown !== null && keyOf(shown) === keyOf({ seed, region }),
  };
}

/** A kicker's mark: a chevron pointing the way it throws, at its lip. */
const KICKER_MARK = "M 0 -2.6 L 2 1.6 L 0 0.6 L -2 1.6 Z";

export function SeedPreview({
  chart,
  spot,
  onSpot,
}: {
  chart: SeedChart;
  /** The picked start, m on the snow; null is the start line. */
  spot: { x: number; z: number } | null;
  onSpot: (spot: { x: number; z: number }) => void;
}) {
  const { shown, fresh } = chart;
  const drawn = shown !== null && shown.ok ? shown : null;
  const pick = (e: MouseEvent): void => {
    if (!drawn || !fresh) return;
    const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const cx = ((e.clientX - box.left) / box.width) * CHART_VIEW;
    const cy = ((e.clientY - box.top) / box.height) * CHART_VIEW;
    onSpot(fromChart(drawn.schematic.size, cx, cy));
  };
  const at = drawn && spot ? toChart(drawn.schematic.size, spot.x, spot.z) : null;
  return (
    <div class={`seed-preview${fresh ? "" : " seed-preview-waiting"}`}>
      <div class="seed-preview-plate">
        {drawn ? (
          <svg
            class="seed-preview-map"
            viewBox={`0 0 ${CHART_VIEW} ${CHART_VIEW}`}
            role="img"
            aria-label={STRINGS.seedChart(drawn.seed, drawn.schematic.kickers.length)}
            onClick={pick}
          >
            {/* THE GROUND, baked with its rows along +z and flipped here
                once so north is up (`seed-chart.ts`). */}
            {drawn.url && (
              <image
                href={drawn.url}
                x={0}
                y={0}
                width={CHART_VIEW}
                height={CHART_VIEW}
                preserveAspectRatio="none"
                transform={`matrix(1 0 0 -1 0 ${CHART_VIEW})`}
              />
            )}
            <path class="seed-preview-route" d={drawn.schematic.track} fill="none" />
            {drawn.schematic.kickers.map((k) => (
              <path
                key={k.id}
                class={`seed-preview-kicker${k.onTrack ? "" : " seed-preview-kicker-off"}`}
                d={KICKER_MARK}
                transform={`translate(${k.x.toFixed(1)} ${k.y.toFixed(1)}) rotate(${degrees(k.angle).toFixed(0)})`}
              />
            ))}
            <path
              class={`seed-preview-grid${at ? " seed-preview-grid-off" : ""}`}
              d="M 0 -3 L 2.4 2 L -2.4 2 Z"
              transform={`translate(${drawn.schematic.grid.x.toFixed(1)} ${drawn.schematic.grid.y.toFixed(1)}) rotate(${degrees(drawn.schematic.grid.angle).toFixed(0)})`}
            />
            {at && (
              <g
                class="seed-preview-spot"
                transform={`translate(${at[0].toFixed(1)} ${at[1].toFixed(1)})`}
              >
                <circle r={3.2} />
                <circle r={1.1} />
              </g>
            )}
          </svg>
        ) : (
          <p class="seed-preview-word">
            {shown === null ? STRINGS.seedReading : STRINGS.seedRefused}
          </p>
        )}
      </div>
      {/* Always rendered, empty until there is a reading: the line holds its
          own height, so the chart's arrival adds nothing under the plate. */}
      <p class="seed-preview-read">
        {drawn
          ? STRINGS.seedRead(drawn.length, drawn.vertical, drawn.schematic.kickers.length)
          : ""}
      </p>
    </div>
  );
}
