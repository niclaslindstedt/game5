// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY LAB'S CLOUD SHEETS (`scripts/sky-preview.mjs --sheet=…`), drawn by
// the sky harness through the game's own renderer:
//
//   clouds       every weather (rows) under each SKY tier at noon and at the
//                golden hour (columns), from the summit ridge looking up
//                over the horizon — the cloud field per weather per tier.
//   cloudlapse   TWO HOURS OF GAME TIME a weather (`--weathers`, a group of
//                rows each), on the RUN'S OWN CLOCK (`--rate`, 12 by
//                default) every `--step` game minutes, ending half an hour
//                after sunset: the cloud drifting with its wind and the heaps
//                growing and going, frame to frame, into the sunset's light.
//                Every cell carries how far the picture moved from the cell
//                before (`dFrame`) and between two frames a thirtieth of a
//                second apart (`jitter` — a pop shows here).
//   sunclouds    THE SUNSET CLOSE-UP: a long lens on the sky over the
//                setting sun, the broken weathers (rows) from three quarters
//                of an hour before sunset to forty minutes after (columns) —
//                the sunward edges and the bases turning gold, orange, red
//                and pink, the bases lit from below after sunset.
//   cloudshadow  over the face from above the summit at noon, the broken
//                weathers (rows), three frames twenty run seconds apart
//                (columns): the clouds' shadows crossing the snow.
//
// Every cell is measured as the other sheets' are (`sky-eval.ts`), and with
// the cloud's own numbers: the key's pass through the cloud (`pass`), the
// drawn sky's warmth (`skyRB`, its mean red over blue; `warm`, the share of
// it warmer than 1.25) and its structure (`skySd`, the spread of its
// luminance).

import { SKY_CLOCK, sunAtRun, withSky, type Level, type SkyOverride } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { CLOUD_TIER, TIERS } from "../game/settings-video.ts";
import { forceCloudTier } from "../game/clouds.ts";
import { forceSkyTier } from "../game/sky-gpu.ts";
import { setSkyClock } from "../game/sky-clock.ts";
import { cloudEval, frameDiff } from "./sky-eval.ts";
import type { SkyCell } from "./sky-harness.ts";

/** What the harness lends the cloud sheets. */
export type CloudSheetHost = {
  level(): Level;
  state(): { t: number };
  setT(t: number): void;
  cellW: number;
  cellH: number;
  stepMin: number;
  rate: number;
  cols: number;
  only: string[];
  hoursAsked: number[];
  frame(w: number, h: number, title: string): CanvasRenderingContext2D;
  cell(
    ctx: CanvasRenderingContext2D,
    sky: SkyOverride | null,
    x: number,
    y: number,
    id: string,
    under?: SkyOverride,
  ): Promise<SkyCell>;
  standSky(sky: SkyOverride): Promise<void>;
  /** Draw a frame unseen at the run time the state holds. */
  tick(): void;
  /** Draw a frame into the stage and read its bytes. */
  grab(): Uint8ClampedArray;
  setOverride(view: LensPose | null): void;
  ridgeTop(): { x: number; y: number; z: number };
  horizonHour(rising: boolean): number;
  fmtHour(h: number): string;
};

type Sheet = { note: string; r: number; c: number; cells: SkyCell[] };

const LABEL_W = 96;
const HEAD_H = 34;

/** The weathers a cloud sheet takes by default, and the words they go by. */
const SKIES: Record<string, SkyOverride["weather"]> = {
  clear: "clear",
  fair: "fair",
  flurries: { kind: "flurries", snowfall: 0.25 },
  high: "high",
  overcast: "overcast",
  snow: { kind: "snow", snowfall: 0.4 },
  storm: { kind: "storm", snowfall: 0.85 },
  fog: "fog",
};

function pick(host: CloudSheetHost, fallback: string[]): string[] {
  const asked = host.only.filter((w) => w in SKIES);
  return asked.length ? asked : fallback;
}

/** From the summit ridge toward world heading `heading`, the lens tipped
 * `pitch` degrees up, a field of `fov` degrees. */
function skyward(host: CloudSheetHost, heading: number, pitch: number, fov: number): LensPose {
  const top = host.ridgeTop();
  const p = (pitch * Math.PI) / 180;
  return {
    eye: { x: top.x, y: top.y + 8, z: top.z },
    target: {
      x: top.x + Math.sin(heading) * Math.cos(p) * 400,
      y: top.y + 8 + Math.sin(p) * 400,
      z: top.z + Math.cos(heading) * Math.cos(p) * 400,
    },
    fov,
    roll: 0,
  };
}

const azimuthAt = (level: Level, hour: number): number =>
  sunAtRun(withSky(level, { hour })).azimuth;

/** The cloud's own numbers onto a measured cell. */
function withCloud(
  got: SkyCell,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): SkyCell {
  return Object.assign(got, cloudEval(ctx.getImageData(x, y, w, h).data, w, h));
}

/** EVERY WEATHER UNDER EVERY SKY TIER, at noon and the golden hour. */
export async function cloudsSheet(host: CloudSheetHost): Promise<Sheet> {
  const level = host.level();
  const set = host.horizonHour(false);
  const names = pick(host, Object.keys(SKIES));
  const moments = [
    { label: "noon", hour: 12 },
    { label: "golden", hour: set - 0.6 },
  ];
  const cols = moments.flatMap((m) => TIERS.map((t) => ({ ...m, tier: t })));
  const { cellW, cellH } = host;
  const ctx = host.frame(
    LABEL_W + cellW * cols.length,
    HEAD_H + cellH * names.length,
    "the cloud field · every weather × SKY tier",
  );
  cols.forEach((c, i) =>
    ctx.fillText(
      `${c.label} ${host.fmtHour(c.hour)} ${c.tier.toUpperCase()}`,
      LABEL_W + i * cellW + 6,
      26,
    ),
  );
  const cells: SkyCell[] = [];
  for (let r = 0; r < names.length; r++) {
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(names[r].toUpperCase(), 8, HEAD_H + r * cellH + cellH / 2);
    for (let c = 0; c < cols.length; c++) {
      // The cloud's tier is the column's; the sky's table is held at MEDIUM
      // on HIGH, whose table the headless renderer draws black.
      forceCloudTier(CLOUD_TIER[cols[c].tier]);
      forceSkyTier(cols[c].tier === "high" ? "medium" : cols[c].tier);
      // Away from the sun a little, so its disc does not fill the frame.
      host.setOverride(skyward(host, azimuthAt(level, cols[c].hour) + 0.9, 14, 78));
      const x = LABEL_W + c * cellW;
      const y = HEAD_H + r * cellH;
      const id = `${names[r]}@${cols[c].label}-${cols[c].tier}`;
      const got = await host.cell(ctx, { weather: SKIES[names[r]], hour: cols[c].hour }, x, y, id);
      cells.push(withCloud(got, ctx, x, y, cellW, cellH));
    }
  }
  forceSkyTier(null);
  forceCloudTier(null);
  return { note: `${names.join(", ")} × ${cols.length}`, r: names.length, c: cols.length, cells };
}

/** TWO HOURS OF GAME TIME a weather on the run's own clock. */
export async function cloudlapseSheet(host: CloudSheetHost): Promise<Sheet> {
  const level = host.level();
  const set = host.horizonHour(false);
  const names = pick(host, ["fair", "flurries", "high", "overcast", "snow", "fog"]);
  const rate = host.rate || SKY_CLOCK.rate;
  const from = host.hoursAsked[0] ?? set - 1.5;
  const frames = Math.floor(120 / host.stepMin) + 1;
  const cols = Math.max(1, host.cols);
  const bands = Math.ceil(frames / cols);
  const { cellW, cellH } = host;
  const band = cellH + 16;
  const ctx = host.frame(
    LABEL_W + cols * cellW,
    HEAD_H + names.length * bands * band,
    `two hours on the run's clock ×${rate} from ${host.fmtHour(from)} · every ${host.stepMin} game min · sunset ${host.fmtHour(set)}`,
  );
  const lens = skyward(host, azimuthAt(level, set) + 0.7, 12, 76);
  host.setOverride(lens);
  const cells: SkyCell[] = [];
  setSkyClock(rate);
  for (let r = 0; r < names.length; r++) {
    const start: SkyOverride = { weather: SKIES[names[r]], hour: from };
    host.setT(0);
    await host.standSky(start);
    const t0 = host.state().t;
    let last: Uint8ClampedArray | null = null;
    const top = HEAD_H + r * bands * band;
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(names[r].toUpperCase(), 8, top + band / 2 + 8);
    for (let i = 0; i < frames; i++) {
      const due = t0 + (i * host.stepMin * 60) / rate;
      while (host.state().t < due - 1e-6) {
        host.setT(Math.min(due, host.state().t + 2));
        host.tick();
        await new Promise((done) => setTimeout(done, 0));
      }
      const x = LABEL_W + (i % cols) * cellW;
      const y = top + Math.floor(i / cols) * band;
      const hour = from + (i * host.stepMin) / 60;
      const got = await host.cell(ctx, null, x, y + 16, `${names[r]}@${host.fmtHour(hour)}`, start);
      const bytes = ctx.getImageData(x, y + 16, cellW, cellH).data;
      withCloud(got, ctx, x, y + 16, cellW, cellH);
      if (last) got.dFrame = frameDiff(last, bytes, cellW, cellH).dE;
      last = bytes;
      // A thirtieth of a second on: the picture must barely move.
      host.setT(host.state().t + 1 / 30);
      const next = host.grab();
      got.jitter = frameDiff(bytes, next, cellW, cellH).dE95;
      ctx.fillStyle = "#e8eef4";
      ctx.fillText(`${host.fmtHour(hour)} ${got.elev.toFixed(1)}°`, x + 6, y + 8);
      cells.push(got);
    }
  }
  setSkyClock(0);
  host.setT(0);
  return {
    note: `${names.join(", ")}: ${frames} frames each`,
    r: names.length * bands,
    c: cols,
    cells,
  };
}

/** THE SUNSET CLOSE-UP: a long lens on the clouds over the setting sun. */
export async function suncloudsSheet(host: CloudSheetHost): Promise<Sheet> {
  const level = host.level();
  const set = host.horizonHour(false);
  const names = pick(host, ["fair", "flurries", "high", "overcast"]);
  const hours = host.hoursAsked.length
    ? host.hoursAsked
    : [set - 0.75, set - 0.33, set - 0.1, set + 0.08, set + 0.25, set + 0.42];
  const { cellW, cellH } = host;
  const ctx = host.frame(
    LABEL_W + cellW * hours.length,
    HEAD_H + cellH * names.length,
    `the sunset close-up · 40° lens on the sun's bearing · sunset ${host.fmtHour(set)}`,
  );
  hours.forEach((h, c) =>
    ctx.fillText(
      `${host.fmtHour(h)} (${Math.round((h - set) * 60)} min)`,
      LABEL_W + c * cellW + 6,
      26,
    ),
  );
  const cells: SkyCell[] = [];
  for (let r = 0; r < names.length; r++) {
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(names[r].toUpperCase(), 8, HEAD_H + r * cellH + cellH / 2);
    for (let c = 0; c < hours.length; c++) {
      host.setOverride(skyward(host, azimuthAt(level, set) + 0.25, 7, 40));
      const x = LABEL_W + c * cellW;
      const y = HEAD_H + r * cellH;
      const got = await host.cell(
        ctx,
        { weather: SKIES[names[r]], hour: hours[c] },
        x,
        y,
        `${names[r]}@${Math.round((hours[c] - set) * 60)}min`,
      );
      cells.push(withCloud(got, ctx, x, y, cellW, cellH));
    }
  }
  return { note: `${names.join(", ")} × ${hours.length}`, r: names.length, c: hours.length, cells };
}

/** THE CLOUDS' SHADOWS crossing the face at noon. */
export async function cloudshadowSheet(host: CloudSheetHost): Promise<Sheet> {
  const level = host.level();
  const names = pick(host, ["fair", "flurries", "overcast"]);
  const m = level.mountain;
  const top = host.ridgeTop();
  const base = m ? m.base : { x: level.size / 2, y: 0, z: level.size * 0.9 };
  const lens: LensPose = {
    eye: { x: top.x, y: top.y + 420, z: top.z - 250 },
    target: { x: (top.x + base.x) / 2, y: level.groundAt(base.x, base.z), z: base.z },
    fov: 60,
    roll: 0,
  };
  const gaps = [0, 20, 40];
  const { cellW, cellH } = host;
  const ctx = host.frame(
    LABEL_W + cellW * gaps.length,
    HEAD_H + cellH * names.length,
    "the clouds' shadows on the face · noon · run seconds apart",
  );
  gaps.forEach((g, c) => ctx.fillText(`+${g} s`, LABEL_W + c * cellW + 6, 26));
  host.setOverride(lens);
  const cells: SkyCell[] = [];
  for (let r = 0; r < names.length; r++) {
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(names[r].toUpperCase(), 8, HEAD_H + r * cellH + cellH / 2);
    const sky: SkyOverride = { weather: SKIES[names[r]], hour: 12 };
    for (let c = 0; c < gaps.length; c++) {
      host.setT(gaps[c]);
      const x = LABEL_W + c * cellW;
      const y = HEAD_H + r * cellH;
      const got = await host.cell(ctx, sky, x, y, `${names[r]}@+${gaps[c]}s`);
      cells.push(withCloud(got, ctx, x, y, cellW, cellH));
    }
  }
  host.setT(0);
  return { note: `${names.join(", ")} × ${gaps.length}`, r: names.length, c: gaps.length, cells };
}
