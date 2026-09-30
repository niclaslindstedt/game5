// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MINIMAP, DRAWN: a round plate in the top-right corner under the three
// presses, with the map turned heading-up about the skier at its middle.
//
// Two halves are owned elsewhere: `minimap-bake.ts` paints the ground once
// per map (in `minimap-worker.ts`), and `minimap-view.ts` decides the pose
// and every mark. This file is the DOM: one world group carrying the
// picture, the piste, the gates and the field, posed by one CSS
// transform that is TWEENED between two snapshots — so a map read twelve
// times a second turns and slides like one drawn every frame — and the
// skier's own arrow, fixed at the middle and pointing up, over it.
//
// Not a button: nothing is pressed here, and the lever's thumb may land on
// the plate on a phone held sideways, so it takes no pointer at all.

import { useEffect, useState } from "preact/hooks";
import type { Level } from "@engine";

import { MAP_PX, MAP_QUALITY, MAP_TYPE, bakeMinimap, minimapSource } from "./minimap-bake.ts";
import { VIEW, type CheckpointMark, type HudMinimap } from "./minimap-view.ts";
import type { BakeReply, BakeRequest } from "./minimap-worker.ts";
import { skierCss } from "./skier-colours.ts";

/** THE PICTURE, one per map: the level it is of and the object URL of its
 * picture. Module state rather than component state, because the plate is
 * unmounted with the HUD at every pause and the map it would bake again is
 * the same map. The last map's picture is released when the next one's is
 * asked for — a race is on one map at a time. */
let picture: { level: Level; url: string | null; waiting: Array<(url: string) => void> } | null =
  null;
let worker: Worker | null = null;
let asked = 0;

/** Turn baked pixels into a URL an `<image>` can take — the path for a
 * browser whose worker has no canvas of its own. */
function toUrl(
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
  canvas.toBlob(
    (blob) => {
      if (blob) done(URL.createObjectURL(blob));
    },
    MAP_TYPE,
    MAP_QUALITY,
  );
}

/** Ask for a map's picture: in the worker where there is one, inline on a
 * later task where there is not. */
function bake(level: Level): void {
  if (picture?.url) URL.revokeObjectURL(picture.url);
  const entry = { level, url: null as string | null, waiting: [] as Array<(url: string) => void> };
  picture = entry;
  const landed = (url: string) => {
    if (picture !== entry) {
      URL.revokeObjectURL(url);
      return;
    }
    entry.url = url;
    for (const w of entry.waiting.splice(0)) w(url);
  };
  const id = ++asked;
  const source = minimapSource(level);
  if (typeof Worker === "undefined") {
    setTimeout(() => toUrl(MAP_PX, bakeMinimap(source, MAP_PX), landed), 0);
    return;
  }
  if (worker === null) {
    worker = new Worker(new URL("./minimap-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<BakeReply>) => {
      const reply = e.data;
      if (reply.id !== asked) return;
      if ("picture" in reply) landed(URL.createObjectURL(reply.picture));
      else toUrl(reply.px, reply.rgba, landed);
    };
  }
  const ask: BakeRequest = { id, source, px: MAP_PX };
  worker.postMessage(ask);
}

/** Start the picture of a map, if it is not the one already baked or
 * baking. The app asks as the map is put into the renderer, so the picture
 * is made behind the loading card rather than after the lights come up. */
export function prepareMinimap(level: Level): void {
  if (picture?.level !== level) bake(level);
}

/** The picture of this map, once it has been baked; null until then. */
function usePicture(level: Level): string | null {
  const [url, setUrl] = useState<string | null>(picture?.level === level ? picture.url : null);
  useEffect(() => {
    prepareMinimap(level);
    const entry = picture!;
    if (entry.url) {
      setUrl(entry.url);
      return;
    }
    setUrl(null);
    const wait = (u: string) => setUrl(u);
    entry.waiting.push(wait);
    return () => {
      const i = entry.waiting.indexOf(wait);
      if (i >= 0) entry.waiting.splice(i, 1);
    };
  }, [level]);
  return url;
}

/** The world group's pose: the skier's point to the plate's middle, turned,
 * scaled. The list is written out whole — `transform-origin` left at the
 * SVG default of 0 0 — so a tween interpolates each step on its own. */
function pose(p: HudMinimap["pose"]): string {
  return (
    `translate(${VIEW / 2}px, ${VIEW / 2}px) rotate(${p.angle.toFixed(2)}deg) ` +
    `scale(${p.scale.toFixed(5)}) translate(${(-p.x).toFixed(2)}px, ${(-p.z).toFixed(2)}px)`
  );
}

/** THE SKIER, from above: an arrowhead pointing up the plate, on a dark
 * plinth so it survives every shade of snow under it. Drawn at the middle
 * and never turned — the map turns instead. */
const SKIER = "M 0 -6.4 L 4.4 5 L 0 2.6 L -4.4 5 Z";
const PLINTH = 7.4;

/** The owed gate's chevron on the rim. */
const CHEVRON = "M 0 -4.4 L 3.6 2 L 0 0.4 L -3.6 2 Z";

function Checkpoint({ mark }: { mark: CheckpointMark }) {
  return (
    <path
      class={`hud-minimap-checkpoint hud-minimap-checkpoint-${mark.state}`}
      d={`M ${mark.a[0].toFixed(1)} ${mark.a[1].toFixed(1)} L ${mark.b[0].toFixed(1)} ${mark.b[1].toFixed(1)}`}
    />
  );
}

export function Minimap({ map }: { map: HudMinimap }) {
  const url = usePicture(map.level);
  const size = map.level.size;
  return (
    <div class="hud-minimap" aria-hidden="true">
      <svg class="hud-minimap-face" viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <g class="hud-minimap-world" style={{ transform: pose(map.pose) }}>
          {url !== null && (
            <image href={url} x={0} y={0} width={size} height={size} preserveAspectRatio="none" />
          )}
          <path class="hud-minimap-track" d={map.track} stroke-width={map.trackWidth} />
          {map.checkpoints.map((m) => (
            <Checkpoint key={m.index} mark={m} />
          ))}
          {map.rivals.map((r) => (
            <circle
              key={r.slot}
              class="hud-minimap-rival"
              cx={r.x}
              cy={r.z}
              r={map.dot}
              style={{ fill: skierCss(r.slot) }}
            />
          ))}
        </g>
        {map.chevron !== null && (
          <path
            class={`hud-minimap-chevron${map.chevron.missed ? " hud-minimap-chevron-missed" : ""}`}
            d={CHEVRON}
            style={{
              transform: `translate(${map.chevron.x.toFixed(2)}px, ${map.chevron.y.toFixed(2)}px) rotate(${map.chevron.angle.toFixed(1)}deg)`,
            }}
          />
        )}
        <g style={{ transform: `translate(${VIEW / 2}px, ${VIEW / 2}px)` }}>
          <circle class="hud-minimap-plinth" r={PLINTH} />
          <path class="hud-minimap-skier" d={SKIER} style={{ fill: skierCss(0) }} />
        </g>
      </svg>
    </div>
  );
}
