// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MINIMAP, DRAWN: a round plate in the top-right corner under the three
// presses, with the map turned heading-up about the skier at its middle.
//
// Two halves are owned elsewhere: `minimap-bake.ts` paints the ground once
// per map (in `minimap-worker.ts`), and `minimap-view.ts` decides the pose
// and every mark. This file is the DOM: a CANVAS the world is painted on —
// the picture, the resort's runs, lifts and wind tunnels, the piste, the
// gates and the field — posed by the payload's pose and TWEENED between two
// snapshots on the animation frame, so a map read twelve times a second
// turns and slides like one drawn every frame; and over it an SVG in the
// plate's own space for the two marks that never move with the world — the
// skier's own arrow, fixed at the middle and pointing up, and the owed
// gate's chevron on the rim.
//
// WHY A CANVAS. The world is three kilometres across and the plate a couple
// of hundred pixels: drawn as SVG under one CSS transform, it is a group of
// world-sized content scaled down a few hundred times, and a browser is free
// to give up on that — the baked ground and every world-wide stroke went
// missing in one, leaving only the hairlines. A 2D canvas draws the same
// picture the same way everywhere: the ground is one `drawImage` under the
// pose, and every hairline is stroked at a width in CSS pixels.
//
// AND IT IS THE PAUSE. The plate is the one thing in the corner a skier
// already looks at, so it is the press that holds the race (Escape on the
// keys) — one target fewer in the row under it, and the biggest target in
// the corner for the press made least in a hurry. It is pressed through the
// POINTER events like the discs under it (the framework's `input/hud-press`),
// because a skier steering with one thumb is handed no `click` for a second.
// The lever's glass starts below the whole cluster (`.hud-zone`), and a
// thumb already dragging the lever keeps its capture over the plate, so
// steering never pauses the race.

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Level } from "@engine";

import { createHudPress, pressHandlers } from "@niclaslindstedt/oss-game-framework/input/hud-press";

import { bakeMinimap, mapPxFor, minimapSource } from "./minimap-bake.ts";
import { VIEW, arrowAngle, rotorTurnMs, type HudMinimap, type SkierMark } from "./minimap-view.ts";
import type { BakeReply, BakeRequest } from "./minimap-worker.ts";
import { skierCss } from "./skier-colours.ts";
import { STRINGS } from "./strings.ts";

/** The baked ground as something a canvas draws: a bitmap the worker made,
 * or a canvas the raw pixels were put into. */
type Ground = ImageBitmap | HTMLCanvasElement;

/** THE PICTURE, one per map: the level it is of and its ground once baked.
 * Module state rather than component state, because the plate is unmounted
 * with the HUD at every pause and the map it would bake again is the same
 * map. The last map's ground is let go when the next one's is asked for —
 * a race is on one map at a time — and never closed by hand: the plate
 * may draw it for one more frame before the HUD's snapshot moves on. */
type Entry = { level: Level; ground: Ground | null; waiting: Array<(g: Ground) => void> };
let picture: Entry | null = null;
let worker: Worker | null = null;
/** Whether the worker has failed once: from then on every bake is made on
 * this thread, so a browser whose worker cannot run still gets its map. */
let workerFailed = false;
let asked = 0;

/** Raw pixels as a canvas a canvas can draw. */
function toCanvas(px: number, rgba: Uint8ClampedArray<ArrayBuffer>): Ground | null {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.putImageData(new ImageData(rgba, px, px), 0, 0);
  return canvas;
}

/** Hand a baked ground to the entry it was made for — or drop it, if the
 * plate has moved on to another map since it was asked for. */
function land(entry: Entry, ground: Ground): void {
  if (picture !== entry) return;
  entry.ground = ground;
  for (const w of entry.waiting.splice(0)) w(ground);
}

/** Bake on this thread, on a later task so the caller's frame is not held. */
function bakeHere(entry: Entry): void {
  setTimeout(() => {
    if (picture !== entry) return;
    const px = mapPxFor(entry.level.size);
    const ground = toCanvas(px, bakeMinimap(minimapSource(entry.level), px));
    if (ground) land(entry, ground);
  }, 0);
}

/** Ask for a map's picture: in the worker where there is one, here where
 * there is not or where it has failed. */
function bake(level: Level): void {
  const entry: Entry = { level, ground: null, waiting: [] };
  picture = entry;
  const id = ++asked;
  if (typeof Worker === "undefined" || workerFailed) {
    bakeHere(entry);
    return;
  }
  if (worker === null) {
    try {
      worker = new Worker(new URL("./minimap-worker.ts", import.meta.url), { type: "module" });
    } catch {
      workerFailed = true;
      bakeHere(entry);
      return;
    }
    worker.onmessage = (e: MessageEvent<BakeReply>) => {
      const reply = e.data;
      const ground = "bitmap" in reply ? reply.bitmap : toCanvas(reply.px, reply.rgba);
      if (ground && reply.id === asked && picture !== null) land(picture, ground);
    };
    // A worker that will not load or throws mid-bake answers nothing, and a
    // plate waiting on it would stay bare for the whole run.
    const fail = (): void => {
      workerFailed = true;
      worker?.terminate();
      worker = null;
      if (picture && !picture.ground) bakeHere(picture);
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
  }
  const ask: BakeRequest = { id, source: minimapSource(level), px: mapPxFor(level.size) };
  worker.postMessage(ask);
}

/** Start the picture of a map, if it is not the one already baked or
 * baking. The app asks as the map is put into the renderer, so the picture
 * is made behind the loading card rather than after the lights come up. */
export function prepareMinimap(level: Level): void {
  if (picture?.level !== level) bake(level);
}

/** The ground of this map, once it has been baked; null until then. */
function useGround(level: Level): Ground | null {
  const [ground, setGround] = useState<Ground | null>(
    picture?.level === level ? picture.ground : null,
  );
  useEffect(() => {
    prepareMinimap(level);
    const entry = picture!;
    if (entry.ground) {
      setGround(entry.ground);
      return;
    }
    setGround(null);
    const wait = (g: Ground) => setGround(g);
    entry.waiting.push(wait);
    return () => {
      const i = entry.waiting.indexOf(wait);
      if (i >= 0) entry.waiting.splice(i, 1);
    };
  }, [level]);
  return ground;
}

/** How long the plate takes to glide from one snapshot's pose to the next,
 * ms — a little longer than the HUD's own beat, so it never stands still
 * between two of them. */
const TWEEN_MS = 90;

/** THE PLATE'S PAINT. Hairline widths are CSS pixels, whatever the zoom;
 * the piste is as wide as it is on the snow. */
const PAINT = {
  track: "rgba(255, 255, 255, 0.55)",
  lane: "rgba(255, 255, 255, 0.75)",
  laneWidth: 1,
  runWidth: 1.5,
  runAlpha: 0.85,
  lift: "#1d2126",
  /** The helicopter and its pad: the pad's painted yellow. */
  heli: "#f2c418",
  /** The snowmobile left somewhere: a square in its own orange. */
  sled: "#ff7a1a",
  liftWidth: 0.8,
  tunnelWidth: 2.6,
  arrow: "#ffffff",
  arrowEdge: "rgba(0, 0, 0, 0.55)",
  arrowEdgeWidth: 0.5,
  rivalEdgeAlpha: 0.85,
  rivalEdgeWidth: 1.4,
  checkpointAlpha: 0.55,
  checkpoint: { other: 1.6, start: 2.4, owed: 4, missed: 4.5 },
} as const;

/** THE PLATE BY NIGHT — the night dressing's half of the map (`dark`, the
 * HUD's `--hud-dark`). The ground is multiplied down toward moonlit snow
 * and black woods as the lamps come up, so the brightest thing in the
 * corner of a night frame stops glaring at an eye used to the dark, and the
 * lines a skier steers by — the runs, the lanes, the piste — are left light
 * over it, as a night chart draws its roads. The lifts, dark lines by day,
 * go pale so they still show on the dark ground. Channels, 0..255: the
 * multiply at full dark, and the lifts' line at full dark. */
const NIGHT = {
  ground: [70, 86, 118],
  lift: [169, 182, 196],
} as const;

/** A channel triple `dark` of the way from `day` to `night`, as CSS. */
function dip(day: readonly number[], night: readonly number[], dark: number): string {
  const c = day.map((v, i) => Math.round(v + (night[i] - v) * dark));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** The lifts' day line as channels. */
const LIFT_DAY = [29, 33, 38];

/** The HUD's own colours, read off the plate's style once it is mounted,
 * so the plate's marks stay the HUD's. */
type HudColours = { ink: string; good: string; bad: string; plate: (alpha: number) => string };

function hudColours(el: Element): HudColours {
  const css = getComputedStyle(el);
  const read = (name: string, fallback: string): string =>
    css.getPropertyValue(name).trim() || fallback;
  const plate = read("--hud-plate", "13 34 51")
    .split(/[\s,]+/)
    .map(Number)
    .slice(0, 3);
  return {
    ink: read("--hud-ink", "#ffffff"),
    good: read("--hud-good", "#e8412c"),
    bad: read("--hud-bad", "#ff5a4e"),
    plate: (alpha) => `rgba(${plate[0]}, ${plate[1]}, ${plate[2]}, ${alpha})`,
  };
}

/** A tunnel's arrow, pointing up, in view units at the plate's scale — cut
 * on first use, so the module loads where there is no canvas. */
const TUNNEL_ARROW = "M 0 -3.2 L 2.6 1.6 L 0 0.4 L -2.6 1.6 Z";
let tunnelArrow: Path2D | null = null;
const arrowPath = (): Path2D => (tunnelArrow ??= new Path2D(TUNNEL_ARROW));

/** Every run's, lane's and tunnel's line as a Path2D, cut once per mark —
 * the marks are cut once per map, so the object is the key. */
const paths = new WeakMap<object, Path2D>();
function cut(mark: object, d: string): Path2D {
  let p = paths.get(mark);
  if (!p) {
    p = new Path2D(d);
    paths.set(mark, p);
  }
  return p;
}

type Pose = HudMinimap["pose"];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Paint the world under `pose`, the field at `rivals`. */
function paint(
  ctx: CanvasRenderingContext2D,
  device: number,
  dpr: number,
  map: HudMinimap,
  pose: Pose,
  rivals: readonly SkierMark[],
  ground: Ground | null,
  hud: HudColours,
  dark: number,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, device, device);
  const k = device / VIEW;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.translate(VIEW / 2, VIEW / 2);
  ctx.rotate((pose.angle * Math.PI) / 180);
  ctx.scale(pose.scale, pose.scale);
  ctx.translate(-pose.x, -pose.z);
  /** One CSS pixel in world metres at this pose. */
  const css = dpr / (k * pose.scale);
  const size = map.level.size;
  ctx.lineJoin = "round";

  if (ground) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(ground, 0, 0, size, size);
    if (dark > 0) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = dip([255, 255, 255], NIGHT.ground, dark);
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  // THE RESORT under the course: every run in its grade's paint, the lanes
  // light, the lifts as dark lines over them with a dot at each station.
  ctx.lineCap = "round";
  for (const r of map.runs) {
    ctx.globalAlpha = r.road ? 1 : PAINT.runAlpha;
    ctx.strokeStyle = r.road ? PAINT.lane : r.paint;
    ctx.lineWidth = (r.road ? PAINT.laneWidth : PAINT.runWidth) * css;
    ctx.stroke(cut(r, r.d));
  }
  ctx.globalAlpha = 1;
  const lift = dark > 0 ? dip(LIFT_DAY, NIGHT.lift, dark) : PAINT.lift;
  ctx.strokeStyle = lift;
  ctx.fillStyle = lift;
  ctx.lineWidth = PAINT.liftWidth * css;
  for (const l of map.lifts) {
    ctx.beginPath();
    ctx.moveTo(l.a[0], l.a[1]);
    ctx.lineTo(l.b[0], l.b[1]);
    ctx.stroke();
    for (const end of [l.a, l.b]) {
      ctx.beginPath();
      ctx.arc(end[0], end[1], map.dot * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // THE WIND TUNNELS: a broad line in each one's own colour with white
  // arrows down it the way it blows, sized to the plate like the dots.
  for (const t of map.tunnels) {
    ctx.strokeStyle = t.paint;
    ctx.lineWidth = PAINT.tunnelWidth * css;
    ctx.stroke(cut(t, t.d));
    const s = map.dot / 3.4;
    for (const a of t.arrows) {
      ctx.save();
      ctx.translate(a.x, a.z);
      ctx.rotate((a.angle * Math.PI) / 180);
      ctx.scale(s, s);
      ctx.fillStyle = PAINT.arrow;
      ctx.fill(arrowPath());
      ctx.strokeStyle = PAINT.arrowEdge;
      ctx.lineWidth = (PAINT.arrowEdgeWidth * css) / s;
      ctx.stroke(arrowPath());
      ctx.restore();
    }
  }

  // THE PISTE, as wide as it is (floored by the payload so it never thins
  // to a hair).
  ctx.lineCap = "butt";
  ctx.strokeStyle = PAINT.track;
  ctx.lineWidth = map.trackWidth;
  ctx.stroke(cut(map, map.track));

  // THE GATES: a bar across the piste, the owed one in the flag's red.
  ctx.lineCap = "round";
  for (const m of map.checkpoints) {
    ctx.strokeStyle =
      m.state === "owed"
        ? hud.good
        : m.state === "missed"
          ? hud.bad
          : m.state === "start"
            ? hud.ink
            : hud.plate(PAINT.checkpointAlpha);
    ctx.lineWidth = PAINT.checkpoint[m.state] * css;
    ctx.beginPath();
    ctx.moveTo(m.a[0], m.a[1]);
    ctx.lineTo(m.b[0], m.b[1]);
    ctx.stroke();
  }

  // THE HELIPAD and THE HELICOPTER: a ring where it is kept, and the
  // machine itself wherever it is — on its pad, or flying home — from
  // above, nose the way it points, its rotor a faint disc while it turns.
  // Flown by the player it is the mark at the plate's middle instead.
  if (map.heli) {
    ctx.strokeStyle = PAINT.heli;
    ctx.lineWidth = PAINT.liftWidth * 1.6 * css;
    ctx.beginPath();
    ctx.arc(map.heli.pad.x, map.heli.pad.z, map.dot * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    if (!map.flying) {
      const s = (map.dot / 3.4) * 0.8;
      ctx.save();
      ctx.translate(map.heli.x, map.heli.z);
      ctx.rotate((arrowAngle(map.heli.heading) * Math.PI) / 180);
      ctx.scale(s, s);
      if (map.heli.spool > 0.05) {
        ctx.globalAlpha = 0.35 * Math.min(1, map.heli.spool);
        ctx.fillStyle = PAINT.heli;
        ctx.beginPath();
        ctx.arc(0, 0, HELI_ROTOR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = PAINT.heli;
      ctx.fill(heliPaths().body);
      ctx.strokeStyle = hud.plate(PAINT.rivalEdgeAlpha);
      ctx.lineWidth = (PAINT.arrowEdgeWidth * 1.6 * css) / s;
      ctx.stroke(heliPaths().body);
      ctx.strokeStyle = PAINT.heli;
      ctx.lineWidth = 0.7;
      ctx.stroke(heliPaths().gear);
      ctx.restore();
    }
  }
  // THE SNOWMOBILE where it was left: a square, edged so it reads on snow.
  if (map.sled) {
    const r = map.dot * 1.1;
    ctx.fillStyle = PAINT.sled;
    ctx.strokeStyle = hud.plate(PAINT.rivalEdgeAlpha);
    ctx.lineWidth = PAINT.liftWidth * css;
    ctx.fillRect(map.sled.x - r, map.sled.z - r, 2 * r, 2 * r);
    ctx.strokeRect(map.sled.x - r, map.sled.z - r, 2 * r, 2 * r);
  }

  ctx.strokeStyle = hud.plate(PAINT.rivalEdgeAlpha);
  ctx.lineWidth = PAINT.rivalEdgeWidth * css;
  for (const r of rivals) {
    ctx.fillStyle = skierCss(r.slot);
    ctx.beginPath();
    ctx.arc(r.x, r.z, map.dot, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** THE SKIER, from above: an arrowhead pointing up the plate, on a dark
 * plinth so it survives every shade of snow under it. Drawn at the middle
 * and never turned — the map turns instead. */
const SKIER = "M 0 -6.4 L 4.4 5 L 0 2.6 L -4.4 5 Z";
const PLINTH = 7.4;

/** THE HELICOPTER, from above, nose up the plate, in view units — the
 * class's proportions (`HELI`: a 5.35 m rotor over a cabin and a boom of
 * about 7 m) at some 1.4 units a metre: the cabin and the boom with its
 * tailplane as one shape, the skids and the tail rotor (on the boom's
 * right) as strokes, and the three blades. */
const HELI_BODY =
  "M 0 -4.4 C 2.3 -4.4 2.3 2.6 0 2.6 C -2.3 2.6 -2.3 -4.4 0 -4.4 Z " +
  "M -0.55 1.6 L 0.55 1.6 L 0.4 9.8 L -0.4 9.8 Z " +
  "M -1.9 6.9 L 1.9 6.9 L 1.9 7.8 L -1.9 7.8 Z";
const HELI_GEAR = "M -2.5 -3.2 L -2.5 2.4 M 2.5 -3.2 L 2.5 2.4 M 0.95 7.3 L 0.95 9.9";
const HELI_ROTOR = 7.6;
/** The flown machine at the plate's middle is drawn this much larger than
 * the parked one, to stand where the skier's arrow stood. */
const HELI_MARK = 1.3;
const HELI_BLADES = [0, 120, 240]
  .map((a) => {
    const r = (a * Math.PI) / 180;
    return `M 0 0 L ${(Math.sin(r) * HELI_ROTOR).toFixed(2)} ${(-Math.cos(r) * HELI_ROTOR).toFixed(2)}`;
  })
  .join(" ");
let heliCut: { body: Path2D; gear: Path2D } | null = null;
const heliPaths = (): { body: Path2D; gear: Path2D } =>
  (heliCut ??= { body: new Path2D(HELI_BODY), gear: new Path2D(HELI_GEAR) });

/** The owed gate's chevron on the rim. */
const CHEVRON = "M 0 -4.4 L 3.6 2 L 0 0.4 L -3.6 2 Z";

export function Minimap({
  map,
  dark = 0,
  onPause,
}: {
  map: HudMinimap;
  dark?: number;
  onPause: () => void;
}) {
  const ground = useGround(map.level);
  const press = useMemo(createHudPress, []);
  const plateRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** What the canvas shows and where it is gliding to: the pose and the
   * field drawn last, the snapshot's own, and when the glide began. */
  const glide = useRef<{
    level: Level | null;
    from: Pose;
    rivalsFrom: readonly SkierMark[];
    shown: Pose;
    rivalsShown: readonly SkierMark[];
    t0: number;
    frame: number;
    hud: HudColours | null;
    dark: number;
  }>({
    level: null,
    from: map.pose,
    rivalsFrom: map.rivals,
    shown: map.pose,
    rivalsShown: map.rivals,
    t0: 0,
    frame: 0,
    hud: null,
    dark,
  });

  useEffect(() => {
    const g = glide.current;
    const canvas = canvasRef.current;
    const plate = plateRef.current;
    if (!canvas || !plate) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // The HUD's colours are read again as the night dressing moves them.
    if (g.hud === null || g.dark !== dark) g.hud = hudColours(plate);
    g.dark = dark;
    // A new map, or the first picture, lands where it is; a new snapshot
    // glides on from wherever the last glide has got to.
    const snap = g.level !== map.level;
    g.level = map.level;
    g.from = snap ? map.pose : g.shown;
    g.rivalsFrom = snap ? map.rivals : g.rivalsShown;
    g.t0 = performance.now();
    const draw = (): void => {
      g.frame = 0;
      const t = Math.min(1, (performance.now() - g.t0) / TWEEN_MS);
      const to = map.pose;
      const pose = {
        x: lerp(g.from.x, to.x, t),
        z: lerp(g.from.z, to.z, t),
        angle: lerp(g.from.angle, to.angle, t),
        scale: lerp(g.from.scale, to.scale, t),
      };
      const rivals = map.rivals.map((r) => {
        const was = g.rivalsFrom.find((w) => w.slot === r.slot) ?? r;
        return { slot: r.slot, x: lerp(was.x, r.x, t), z: lerp(was.z, r.z, t) };
      });
      g.shown = pose;
      g.rivalsShown = rivals;
      const dpr = window.devicePixelRatio || 1;
      const device = Math.max(1, Math.round(canvas.clientWidth * dpr));
      if (canvas.width !== device || canvas.height !== device) {
        canvas.width = device;
        canvas.height = device;
      }
      paint(ctx, device, dpr, map, pose, rivals, ground, g.hud!, dark);
      if (t < 1) g.frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (g.frame) cancelAnimationFrame(g.frame);
      g.frame = 0;
    };
  }, [map, ground, dark]);

  return (
    <button
      type="button"
      class="hud-minimap"
      ref={plateRef}
      title={STRINGS.pauseTitle}
      aria-label={STRINGS.pauseTitle}
      data-ground={ground ? "1" : undefined}
      {...pressHandlers(press, onPause)}
      onMouseUp={(e) => (e.currentTarget as HTMLButtonElement).blur()}
    >
      <canvas class="hud-minimap-world" ref={canvasRef} aria-hidden="true" />
      <svg class="hud-minimap-face" viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true">
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
          {map.flying ? (
            <HeliMark spool={map.flying.spool} />
          ) : (
            <>
              <circle class="hud-minimap-plinth" r={PLINTH} />
              <path class="hud-minimap-skier" d={SKIER} style={{ fill: skierCss(0) }} />
            </>
          )}
        </g>
      </svg>
    </button>
  );
}

/** THE HELICOPTER HE FLIES at the plate's middle: the machine from above on
 * the plinth, its rotor a disc that thickens as it spools and three blades
 * turning in it (held still where motion is asked to be reduced). */
function HeliMark({ spool }: { spool: number }) {
  const turn = rotorTurnMs(spool);
  return (
    <g transform={`scale(${HELI_MARK})`}>
      <circle class="hud-minimap-plinth" r={PLINTH * 1.15} />
      <path class="hud-minimap-heli" d={HELI_BODY} />
      <path class="hud-minimap-heli-gear" d={HELI_GEAR} />
      <g
        class={`hud-minimap-rotor${turn === null ? "" : " hud-minimap-rotor-on"}`}
        style={turn === null ? undefined : { animationDuration: `${turn}ms` }}
      >
        <circle r={HELI_ROTOR} style={{ opacity: 0.12 + 0.25 * Math.min(1, spool) }} />
        <path d={HELI_BLADES} />
      </g>
    </g>
  );
}
