// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY LAB's MOON sheet (`--sheet=moon`, `night-sky.ts`): the map's own
// mountain under a clear sky, the DAY moved through the nominal year so the
// moon goes through what it really does —
//
//   phases   one lunation on a long lens (the same zoom every cell), each
//            night at the hour the moon stands highest in the dark: the
//            crescent's bright limb toward the sun under the horizon, the
//            earthshine on its dark part, the gibbous, the full;
//   size     the full moon nearest its PERIGEE and the one nearest its
//            APOGEE side by side at that zoom, its drawn diameter measured
//            off the picture beside the true angle;
//   rise     the full moon rising (−0.5° to 25° up, a 6° lens toward it):
//            its colour through the air;
//   snow     the snow under a full, a quarter and no moon: the face from
//            the ridge, away from every lamp (the snow's luminance the
//            measured `litL` / `shadeL`), then behind the grid under the
//            start's floodlights and the headlamps;
//   sky      the same nights looking up from the ridge toward the moon.
//
// The map's day is the only thing moved; the place and the hour are the
// map's own reckoning (`moonAtRun`). Every cell measured as the sky lab's.

import { moonAtRun, sunAtRun, type Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { moonDistance, moonRadius } from "../game/night-sky.ts";
import { skyLookAt } from "../game/sky.ts";
import type { CloudSheetHost } from "./sky-cloud-sheets.ts";
import type { SkyCell } from "./sky-harness.ts";

const DEG = Math.PI / 180;
/** The long lens's field, degrees: a moon some seventy pixels across a
 * 180-pixel cell. */
const ZOOM = 1.25;

type Night = { day: number; hour: number; elevation: number; azimuth: number; lit: number };

/** `level` on day `day` at `hour`. */
function at(level: Level, day: number, hour: number): Level {
  return { ...level, sun: { ...level.sun, dayOfYear: day, hour } };
}

/** The night of `day` when the moon stands highest with the sun well down
 * (18° under, past the twilight; 6° or 2° when the moon is never 15° up
 * then), a quarter of an hour at a time. */
function bestHour(level: Level, day: number): Night {
  let best: Night | null = null;
  for (const under of [18, 6, 2]) {
    best = null;
    for (let h = 0; h < 24; h += 0.25) {
      const l = at(level, day, h);
      if (sunAtRun(l).elevation > -under * DEG) continue;
      const m = moonAtRun(l);
      if (!best || m.elevation > best.elevation)
        best = { day, hour: h, elevation: m.elevation, azimuth: m.azimuth, lit: m.lit };
    }
    if (best && best.elevation > (under > 6 ? 15 : 4) * DEG) break;
  }
  return best!;
}

/** The hour on `day` the moon rises through `el` rad, an evening's. */
function riseHour(level: Level, day: number, el: number): number {
  let was = moonAtRun(at(level, day, 12)).elevation;
  for (let h = 12 + 1 / 60; h < 36; h += 1 / 60) {
    const now = moonAtRun(at(level, day + Math.floor(h / 24), h % 24)).elevation;
    if (was < el && now >= el) return h;
    was = now;
  }
  return 18;
}

/** From the ridge toward the moon (or `pitch` degrees up its bearing). */
function toward(host: CloudSheetHost, n: Night, fov: number, pitch?: number): LensPose {
  const top = host.ridgeTop();
  const el = pitch === undefined ? n.elevation : pitch * DEG;
  const eye = { x: top.x, y: top.y + 8, z: top.z };
  return {
    eye,
    target: {
      x: eye.x + Math.sin(n.azimuth) * Math.cos(el) * 1000,
      y: eye.y + Math.sin(el) * 1000,
      z: eye.z + Math.cos(n.azimuth) * Math.cos(el) * 1000,
    },
    fov,
    roll: 0,
  };
}

/** The drawn disc's width across the cell's middle row and down its middle
 * column, px: the run of pixels over half the brightest. */
function drawnWidth(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const px = ctx.getImageData(x, y, w, h).data;
  const lumAt = (i: number): number => px[i] + px[i + 1] + px[i + 2];
  let peak = 0;
  for (let i = 0; i < px.length; i += 4) peak = Math.max(peak, lumAt(i));
  const run = (along: (k: number) => number, n: number): number => {
    let first = -1;
    let last = -1;
    for (let k = 0; k < n; k++)
      if (lumAt(along(k)) > peak / 2) {
        if (first < 0) first = k;
        last = k;
      }
    return first < 0 ? 0 : last - first + 1;
  };
  const row = run((k) => ((h >> 1) * w + k) * 4, w);
  const col = run((k) => (k * w + (w >> 1)) * 4, h);
  return Math.max(row, col);
}

/** The mean linear luminance of the lower two fifths of a cell — the snow
 * as a whole, lit and shaded alike. */
function snowMean(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const top = Math.floor(h * 0.6);
  const px = ctx.getImageData(x, y + top, w, h - top - 18).data;
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  let sum = 0;
  for (let i = 0; i < px.length; i += 4)
    sum += 0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]);
  return sum / Math.max(1, px.length / 4);
}

export async function moonSheet(
  host: CloudSheetHost,
): Promise<{ note: string; r: number; c: number; cells: SkyCell[] }> {
  const level = host.level();
  const sun = level.sun as { dayOfYear: number };
  const home = sun.dayOfYear;
  const { cellW, cellH } = host;
  const labelW = 96;
  const headH = 34;
  const cols = 8;
  const rowNames = ["PHASES", "SIZE", "RISE", "SNOW", "SKY"];
  const ctx = host.frame(labelW + cellW * cols, headH + cellH * rowNames.length, "moon");
  ctx.fillStyle = "#e8eef4";
  ctx.font = "12px monospace";
  rowNames.forEach((n, r) => ctx.fillText(n, 8, headH + cellH * r + cellH / 2));
  const cells: SkyCell[] = [];
  const notes: string[] = [];
  const label = (text: string, c: number, r: number): void => {
    const x = labelW + c * cellW;
    const y = headH + r * cellH;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y + cellH - 18, cellW, 18);
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(text, x + 6, y + cellH - 9);
  };
  const shoot = async (n: Night, pose: LensPose | null, c: number, r: number, id: string) => {
    sun.dayOfYear = n.day;
    host.setOverride(pose);
    const got = await host.cell(
      ctx,
      { hour: n.hour, weather: "clear" },
      labelW + c * cellW,
      headH + r * cellH,
      id,
    );
    const look = skyLookAt({ ...level, sun: { ...level.sun, hour: n.hour } });
    return { got, look };
  };

  // THE LUNATION: the new moon in the first month, then a night every few days.
  let newDay = 1;
  let least = 2;
  for (let d = 1; d <= 30; d++) {
    const lit = moonAtRun(at(level, d, 0)).lit;
    if (lit < least) [least, newDay] = [lit, d];
  }
  const ages = [2, 4, 7, 11, 15, 19, 22, 26];
  for (let c = 0; c < ages.length; c++) {
    const n = bestHour(level, newDay + ages[c]);
    const { got, look } = await shoot(n, toward(host, n, ZOOM), c, 0, `phase-${ages[c]}`);
    const arc = ((2 * look.moonDisc.radius) / DEG) * 60;
    label(
      `d${n.day} ${host.fmtHour(n.hour)} ${(n.lit * 100).toFixed(0)}% ${arc.toFixed(1)}′`,
      c,
      0,
    );
    cells.push({ ...got, id: `phase-${ages[c]}` });
  }

  // PERIGEE AGAINST APOGEE: the year's full moons, nearest and furthest.
  const fulls: { day: number; km: number }[] = [];
  for (let d = 1; d <= 365; d++) {
    const l = at(level, d, 0);
    const m = moonAtRun(l);
    if (m.lit > 0.985) fulls.push({ day: d, km: moonDistance(l, 0) });
  }
  fulls.sort((a, b) => a.km - b.km);
  const pair = [fulls[0], fulls[fulls.length - 1]];
  for (let c = 0; c < 2; c++) {
    const n = bestHour(level, pair[c].day);
    const { got, look } = await shoot(n, toward(host, n, ZOOM), c, 1, c ? "apogee" : "perigee");
    const px = drawnWidth(ctx, labelW + c * cellW, headH + cellH, cellW, cellH - 18);
    const arc = ((2 * look.moonDisc.radius) / DEG) * 60;
    const want = ((2 * look.moonDisc.radius) / (ZOOM * DEG)) * cellH;
    label(
      `${c ? "APOGEE" : "PERIGEE"} d${n.day} ${look.moonDisc.distance.toFixed(0)} km ${arc.toFixed(1)}′ ${px}/${want.toFixed(0)} px`,
      c,
      1,
    );
    notes.push(
      `${c ? "apogee" : "perigee"} ${arc.toFixed(1)}′ drawn ${px} px of ${want.toFixed(1)}`,
    );
    cells.push({ ...got, id: c ? "apogee" : "perigee" });
  }
  // The angle each would be, by the orbit alone, against the true radius.
  notes.push(
    `size ${(((2 * moonRadius(pair[0].km)) / DEG) * 60).toFixed(1)}′…${(((2 * moonRadius(pair[1].km)) / DEG) * 60).toFixed(1)}′ geocentric`,
  );

  // THE FULL MOON RISING.
  const fullDay = pair[0].day;
  const rises = [-0.5, 0.5, 2, 4, 8, 15, 25];
  for (let c = 0; c < rises.length; c++) {
    const h = riseHour(level, fullDay, rises[c] * DEG);
    const day = fullDay + Math.floor(h / 24);
    const m = moonAtRun(at(level, day, h % 24));
    const n: Night = { day, hour: h % 24, elevation: m.elevation, azimuth: m.azimuth, lit: m.lit };
    const { got, look } = await shoot(n, toward(host, n, 6), c, 2, `rise-${rises[c]}`);
    const t = look.moonDisc.tint;
    label(
      `${rises[c]}° pass ${look.moonDisc.pass.toFixed(2)} rgb ${t.map((v) => v.toFixed(2)).join(",")}`,
      c,
      2,
    );
    cells.push({ ...got, id: `rise-${rises[c]}` });
  }

  // THE SNOW UNDER A FULL, A QUARTER AND NO MOON — behind the grid, and
  // from the ridge looking up toward the moon.
  let quarterDay = newDay + 7;
  for (let d = newDay + 5; d <= newDay + 10; d++)
    if (
      Math.abs(moonAtRun(at(level, d, 0)).lit - 0.5) <
      Math.abs(moonAtRun(at(level, quarterDay, 0)).lit - 0.5)
    )
      quarterDay = d;
  const nights: [string, Night][] = [
    ["full", bestHour(level, newDay + 15)],
    ["quarter", bestHour(level, quarterDay)],
    ["new", { ...bestHour(level, newDay), hour: 23 }],
  ];
  const snow: Record<string, number> = {};
  for (let c = 0; c < nights.length; c++) {
    const [name, n] = nights[c];
    const heading = host.state().skier.heading;
    const face = toward(host, { ...n, azimuth: heading }, 60, -22);
    const { got, look } = await shoot(n, face, c, 3, `snow-${name}`);
    snow[name] = snowMean(ctx, labelW + c * cellW, headH + 3 * cellH, cellW, cellH);
    label(
      `${name.toUpperCase()} ${(n.lit * 100).toFixed(0)}% ${host.fmtHour(n.hour)} snow ${snow[name].toFixed(3)}`,
      c,
      3,
    );
    cells.push({ ...got, id: `snow-${name}` });
    const lamps = await shoot(n, null, c + 3, 3, `lamps-${name}`);
    label(`${name.toUpperCase()} under the lamps lit ${lamps.got.litL}`, c + 3, 3);
    cells.push({ ...lamps.got, id: `lamps-${name}` });
    const up = await shoot(
      n,
      toward(host, n, 70, Math.max(8, Math.min(40, n.elevation / DEG))),
      c,
      4,
      `sky-${name}`,
    );
    label(
      `${name.toUpperCase()} sky ${look.skyMagnitude.toFixed(1)} mag/″² limit ${look.starLimit.toFixed(1)}`,
      c,
      4,
    );
    cells.push({ ...up.got, id: `sky-${name}` });
  }
  notes.push(
    `snow mean full ${snow.full.toFixed(3)} quarter ${snow.quarter.toFixed(3)} new ${snow.new.toFixed(3)}: full/quarter ${(snow.full / Math.max(snow.quarter, 1e-4)).toFixed(2)} full/new ${(snow.full / Math.max(snow.new, 1e-4)).toFixed(2)}`,
  );
  sun.dayOfYear = home;
  host.setOverride(null);
  return { note: notes.join(" | "), r: rowNames.length, c: cols, cells };
}
