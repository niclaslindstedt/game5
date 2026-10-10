// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHIMMER LAB's page (driven by `scripts/shimmer-preview.mjs`): how much
// of the far mountain FLICKERS as the lens moves. A still cannot show it —
// a flicker is a pixel that changes from one frame to the next when nothing
// it shows has moved by as much as a pixel — so the page slides a fixed lens
// sideways a few centimetres a frame past the far faces and reads every
// frame back.
//
// THE MEASURE, per pixel, over the frames: the mean SECOND difference of
// its brightness, |L(k+1) − 2 L(k) + L(k−1)|. A steady drift (the picture
// panning, a slope's shading sliding under the lens) is a first difference
// and drops out; what is left is a pixel that jumps and comes back — a
// texel the shading picks one frame and not the next, a noise finer than a
// pixel, a threshold crossed and uncrossed. The table's FLICKER is that
// mean over every pixel showing the ground (×1000), HOT the share of them
// past 0.02 of full white.
//
// THE SNOW THROUGH THE CRAGS: the rock skin (`rocks.ts`) stands a hand over
// the snow, and the snow under it is drawn coarser the further it is — the
// clipmap's rings — and told apart from it in depth ever more coarsely. A
// far face's snow poking up through its rock comes and goes as the lens
// moves and the rings morph under it. So each shot's first frame is drawn
// three times more: without the snow (the crags, over the sky), without the
// snow or the woods (the sky alone) and whole; a CRAG pixel is one the
// first two differ on, and THROUGH the share of them where the whole
// picture is brighter than the crag by a snow's worth — snow drawn in front
// of the rock. The third column of the sheet paints them: the crag grey,
// the snow through it red.
//
// THE SHOTS, each a lens set by hand (`renderer.setOverride`) high over
// the snow on the map's own mountain: ROCK-<m> (the rockiest face — the
// most of it clad in the rock skin, `rocks.ts` — from <m> metres out along
// the way it falls) and VALLEY (the base looking up at it). `?ground=1` draws the snow ALONE (the woods, the crags, the
// lifts, the field and the wildlife hidden — `setHidden`). The sheet is each shot's first frame beside its heat map
// (the second difference, brighter the worse).

import {
  createGame,
  isPisteGrade,
  rockShare,
  type GameState,
  type Level,
  type PisteGrade,
} from "@engine";

import { HIDEABLE, type Hideable } from "../game/benchmark-report.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

/** One shot's numbers. */
export type ShimmerRow = {
  shot: string;
  /** The mean second difference over the ground's pixels, ×1000. */
  flicker: number;
  /** The share of the ground's pixels past 0.02 of full white, %. */
  hot: number;
  /** The share of the frame the rock skin covers, %. */
  crag: number;
  /** The share of the crag's pixels the snow is drawn in front of, %. */
  through: number;
  /** The crag's pixels the snow blinks over (in front, behind, in front
   * again over three frames), %. */
  blink: number;
  /** How far the lens stood from what it looked at, m. */
  range: number;
};

declare global {
  interface Window {
    __shimmer?: {
      ready: Promise<void>;
      sheet(): Promise<{ rows: number; note: string }>;
      rows(): ShimmerRow[];
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
/** The piste grade (R23): a BLACK carries the most rock. */
const grade = isPisteGrade(params.get("grade")) ? (params.get("grade") as PisteGrade) : undefined;
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const cellW = Number(params.get("w") ?? 640);
const cellH = Number(params.get("h") ?? 360);
const frames = Math.max(3, Number(params.get("frames") ?? 12));
const slide = Number(params.get("step") ?? 0.01);
const shots = (params.get("shots") || "rock-150,rock-300,rock-600,rock-1200")
  .split(",")
  .map((s) => s.trim());
const bare = params.get("ground") === "1";
const along = params.get("along") === "1";
/** What every frame hides: the snow alone keeps the sky and the ground. */
const hidden: readonly Hideable[] = [
  ...(bare ? HIDEABLE.filter((h) => !["sky", "terrain", "shadow"].includes(h)) : []),
  ...((params.get("hide") ?? "")
    .split(",")
    .filter((h) => (HIDEABLE as readonly string[]).includes(h)) as Hideable[]),
];

const FRAME = 1 / 60;

const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheet = document.getElementById("sheet") as HTMLCanvasElement;
await loadModels();
const renderer = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(cellW, cellH, 1);
const state: GameState = createGame({
  seed,
  grade,
  ...(params.get("face") ? { face: params.get("face") ?? undefined } : {}),
  mode: "free",
  rivals: 0,
  quiet: true,
});
const level = state.level;
const read = document.createElement("canvas");
read.width = cellW;
read.height = cellH;
const readCtx = read.getContext("2d", { willReadFrequently: true })!;
let filled: ShimmerRow[] = [];

/** THE ROCKIEST FACE: the 60 m patch with the most of its ground in the
 * rock skin (`rockShare`, what `rocks.ts` clads), and the way it falls. */
function rockiest(lv: Level): { x: number; z: number; fx: number; fz: number } {
  const step = 12;
  const n = Math.floor(lv.size / step);
  const share = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++)
      share[j * n + i] = rockShare(lv, (i + 0.5) * step, (j + 0.5) * step);
  }
  let best = { i: n >> 1, j: n >> 1, sum: -1 };
  const r = 2;
  for (let j = r; j < n - r; j++) {
    for (let i = r; i < n - r; i++) {
      let sum = 0;
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) sum += share[(j + dj) * n + i + di];
      if (sum > best.sum) best = { i, j, sum };
    }
  }
  const x = (best.i + 0.5) * step;
  const z = (best.j + 0.5) * step;
  const nrm = { x: 0, y: 1, z: 0 };
  lv.normalAt(x, z, nrm);
  const len = Math.hypot(nrm.x, nrm.z) || 1;
  return { x, z, fx: nrm.x / len, fz: nrm.z / len };
}

/** A shot: the lens, and the way it slides (unit, in the ground's plane). */
function shotOf(name: string): { pose: LensPose; sx: number; sz: number } {
  const y = (x: number, z: number) => level.groundAt(x, z);
  const look = (ex: number, ez: number, high: number, tx: number, tz: number, fov: number) => {
    const len = Math.hypot(tx - ex, tz - ez) || 1;
    return {
      pose: {
        eye: { x: ex, y: y(ex, ez) + high, z: ez },
        target: { x: tx, y: y(tx, tz), z: tz },
        fov,
        roll: 0,
      },
      // Across the look, or (`?along=1`) toward what it looks at, as a
      // skier riding at the face.
      sx: along ? (tx - ex) / len : (tz - ez) / len,
      sz: along ? (tz - ez) / len : -(tx - ex) / len,
    };
  };
  const rock = rockiest(level);
  if (name === "valley") {
    const base = level.mountain?.base ?? { x: level.size / 2, z: level.size * 0.92 };
    return look(base.x, base.z, 40, rock.x, rock.z, 50);
  }
  const off = Number(/^rock-(\d+)$/.exec(name)?.[1] ?? 300);
  const ex = rock.x + rock.fx * off;
  const ez = rock.z + rock.fz * off;
  // Narrower the further out, so the face fills about as much of the frame.
  return look(ex, ez, 20, rock.x, rock.z, Math.max(10, Math.min(50, 9000 / off)));
}

/** The frame's brightness a pixel. */
function readFrame(): Float32Array {
  readCtx.drawImage(stage, 0, 0, cellW, cellH);
  const px = readCtx.getImageData(0, 0, cellW, cellH).data;
  const lum = new Float32Array(cellW * cellH);
  for (let i = 0; i < lum.length; i++) {
    lum[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
  }
  return lum;
}

/** The frame drawn with `hide` hidden as well, read back. */
function drawnWithout(hide: readonly Hideable[]): Float32Array {
  renderer.setHidden([...hidden, ...hide]);
  renderer.draw(state, 0, 0, true);
  renderer.setHidden(hidden);
  return readFrame();
}

window.__shimmer = {
  ready: (async () => {
    await renderer.load(state);
    renderer.setSky({ weather: "clear", hour: 12 });
    renderer.setHidden(hidden);
  })(),
  rows: () => filled,
  async sheet() {
    const labelW = 120;
    const headH = 22;
    sheet.width = labelW + cellW * 3;
    sheet.height = headH + cellH * shots.length;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#0b1116";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = "#e8eef4";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `SHIMMER · seed ${seed}${grade ? ` ${grade}` : ""}${params.get("face") ? ` · ${params.get("face")}` : ""} · ${tier} · ${bare ? "the ground alone" : "everything"} · ${frames} frames, the lens slid ${slide} m a frame · the first frame · the flicker (second difference) · the crags grey, the snow through them red`,
      8,
      11,
    );
    filled = [];
    for (let r = 0; r < shots.length; r++) {
      const shot = shotOf(shots[r]);
      const y0 = headH + r * cellH;
      // The shot drawn a few times before it is read, so every map the
      // renderer fills round the lens is filled.
      const at = (k: number): LensPose => ({
        ...shot.pose,
        eye: {
          x: shot.pose.eye.x + shot.sx * slide * k,
          y: shot.pose.eye.y,
          z: shot.pose.eye.z + shot.sz * slide * k,
        },
        target: {
          x: shot.pose.target.x + shot.sx * slide * k,
          y: shot.pose.target.y,
          z: shot.pose.target.z + shot.sz * slide * k,
        },
      });
      renderer.setOverride(at(0));
      for (let i = 0; i < 4; i++) renderer.draw(state, 0, FRAME, false);
      await renderer.shadeSettled();
      const seen: Float32Array[] = [];
      const bare: Float32Array[] = [];
      let crags: Float32Array = new Float32Array(0);
      let empty: Float32Array = new Float32Array(0);
      for (let k = 0; k < frames; k++) {
        renderer.setOverride(at(k));
        // No time passes between the frames (`dt` 0): the woods' sway, the
        // wildlife and the sparkle stand still, and only the lens moves.
        renderer.draw(state, 0, 0, true);
        seen.push(readFrame());
        // The same frame without the snow: where the two agree, the rock
        // is in front.
        bare.push(drawnWithout(["terrain"]));
        if (k === 0) {
          ctx.drawImage(stage, labelW, y0, cellW, cellH);
          crags = drawnWithout(["terrain"]);
          empty = drawnWithout(["terrain", "forest"]);
        }
      }
      const heat = readCtx.createImageData(cellW, cellH);
      let sum = 0;
      let hot = 0;
      let ground = 0;
      let cragN = 0;
      let through = 0;
      let blink = 0;
      const paint = readCtx.createImageData(cellW, cellH);
      for (let i = 0; i < cellW * cellH; i++) {
        let d = 0;
        for (let k = 1; k < frames - 1; k++) {
          d += Math.abs(seen[k + 1][i] - 2 * seen[k][i] + seen[k - 1][i]);
        }
        d /= frames - 2;
        // The sky is the same in every frame; the ground is what is read.
        const still = seen.every((f) => f[i] === seen[0][i]);
        if (!still) {
          ground++;
          sum += d;
          if (d > 0.02) hot++;
        }
        const v = Math.min(255, Math.round(d * 255 * 12));
        heat.data[i * 4] = v;
        heat.data[i * 4 + 1] = Math.round(v * 0.35);
        heat.data[i * 4 + 2] = Math.round(seen[0][i] * 40);
        heat.data[i * 4 + 3] = 255;
        // The crag, and the snow drawn in front of it.
        const crag = Math.abs(crags[i] - empty[i]) > 0.01;
        const snow = crag && seen[0][i] - crags[i] > 0.15;
        if (crag) cragN++;
        if (snow) through++;
        // A BLINK: the snow in front of the rock in one frame and behind it
        // in the next and in front again (or the other way round) — what a
        // steady slide of the lens cannot do to an edge, only the snow and
        // the rock fighting.
        if (crag) {
          for (let k = 1; k < frames - 1; k++) {
            const was = seen[k - 1][i] - bare[k - 1][i] > 0.1;
            const is = seen[k][i] - bare[k][i] > 0.1;
            const then = seen[k + 1][i] - bare[k + 1][i] > 0.1;
            if (was !== is && then === was) {
              blink++;
              break;
            }
          }
        }
        const g = Math.round(seen[0][i] * 90);
        paint.data[i * 4] = snow ? 255 : crag ? 150 : g;
        paint.data[i * 4 + 1] = snow ? 40 : crag ? 150 : g;
        paint.data[i * 4 + 2] = snow ? 40 : crag ? 150 : g;
        paint.data[i * 4 + 3] = 255;
      }
      readCtx.putImageData(heat, 0, 0);
      ctx.drawImage(read, labelW + cellW, y0);
      readCtx.putImageData(paint, 0, 0);
      ctx.drawImage(read, labelW + cellW * 2, y0);
      const row: ShimmerRow = {
        shot: shots[r],
        flicker: ground ? (sum / ground) * 1000 : 0,
        hot: ground ? (hot / ground) * 100 : 0,
        crag: (cragN / (cellW * cellH)) * 100,
        through: cragN ? (through / cragN) * 100 : 0,
        blink: cragN ? (blink / cragN) * 100 : 0,
        range: Math.hypot(
          shot.pose.target.x - shot.pose.eye.x,
          shot.pose.target.z - shot.pose.eye.z,
        ),
      };
      filled.push(row);
      ctx.fillStyle = "#e8eef4";
      [
        shots[r].toUpperCase(),
        `${row.range.toFixed(0)} M`,
        `FLICKER ${row.flicker.toFixed(2)}`,
        `HOT ${row.hot.toFixed(2)} %`,
        `CRAG ${row.crag.toFixed(1)} %`,
        `THROUGH ${row.through.toFixed(1)} %`,
        `BLINK ${row.blink.toFixed(2)} %`,
      ].forEach((l, i) => ctx.fillText(l, 8, y0 + cellH / 2 - 32 + i * 16));
      await new Promise((done) => setTimeout(done, 0));
    }
    renderer.setOverride(null);
    return { rows: shots.length, note: shots.join(", ") };
  },
};
