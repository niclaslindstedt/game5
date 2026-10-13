// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY LAB'S LOW DECK SHEET (`make sky ARGS=--sheet=lowdeck`): a run
// down the face through a LOW CLOUD DECK (`low-deck.ts`) lying part way
// down the mountain — its top at 55 % of the vertical, 320 m deep —
// photographed from a skier's chase lens at five heights (columns): well
// over its top on the upper piste, at its top, inside it, at its base and
// under it on the valley floor; and a SIXTH, the sea of cloud from the
// summit at sunset, the lens on the sun's bearing. The rows are the
// overcast's deck under every SKY tier, a fair day's under HIGH, and a
// valley fog (its own sea, on the floor) under HIGH.

import { sunAtRun, withSky, type SkyOverride } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { forceLowDeck } from "../game/cloud-field.ts";
import { forceCloudTier } from "../game/clouds.ts";
import { CLOUD_TIER, type Tier } from "../game/settings-video.ts";
import { forceSkyTier } from "../game/sky-gpu.ts";
import { cloudEval } from "./sky-eval.ts";
import type { CloudSheetHost } from "./sky-cloud-sheets.ts";
import type { SkyCell } from "./sky-harness.ts";

const LABEL_W = 96;
const HEAD_H = 34;

/** The deck the sheet lays: its top and its depth, shares of the vertical
 * and m. */
const DECK = { top: 0.55, depth: 320 } as const;

/** THE RUN DOWN THROUGH A LOW DECK, every tier, and the sea at sunset. */
export async function lowdeckSheet(
  host: CloudSheetHost,
): Promise<{ note: string; r: number; c: number; cells: SkyCell[] }> {
  const level = host.level();
  const m = level.mountain;
  const floorY = m ? m.base.y : 0;
  const vertical = m?.vertical ?? 1500;
  const top = vertical * DECK.top;
  const deck = { base: top - DECK.depth, top, fog: 0.85 };
  const rows: { label: string; weather: SkyOverride["weather"]; tier: Tier; forced: boolean }[] = [
    { label: "OVERCAST LOW", weather: "overcast", tier: "low", forced: true },
    { label: "OVERCAST MEDIUM", weather: "overcast", tier: "medium", forced: true },
    { label: "OVERCAST HIGH", weather: "overcast", tier: "high", forced: true },
    { label: "FAIR HIGH", weather: "fair", tier: "high", forced: true },
    { label: "FOG HIGH", weather: "fog", tier: "high", forced: false },
  ];
  // The way down: the straight line from the summit to the base (the
  // map's piste may be a short course low on the face), and the point on
  // it where the snow stands at a world height — the snow falls along it.
  const from = m ? m.summit : { x: level.size / 2, y: 0, z: level.size * 0.1 };
  const to = m ? m.base : { x: level.size / 2, y: 0, z: level.size * 0.9 };
  const along = (u: number): { x: number; z: number } => ({
    x: from.x + (to.x - from.x) * u,
    z: from.z + (to.z - from.z) * u,
  });
  const uAt = (y: number): number => {
    let lo = 0.02;
    let hi = 0.98;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const p = along(mid);
      if (level.groundAt(p.x, p.z) > y) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const set = host.horizonHour(false);
  const cols = [
    { label: "over it", y: floorY + top + 260 },
    { label: "at its top", y: floorY + top + 5 },
    { label: "inside", y: floorY + top - DECK.depth / 2 },
    { label: "at its base", y: floorY + deck.base - 5 },
    { label: "under it", y: floorY + Math.max(0, deck.base - 220) },
    { label: "sunset, from the summit", y: Infinity },
  ];
  const { cellW, cellH } = host;
  const ctx = host.frame(
    LABEL_W + 30 + cellW * cols.length,
    HEAD_H + cellH * rows.length,
    `a run down through a low deck · top ${Math.round(top)} m over the floor, ${DECK.depth} m deep · noon, and sunset ${host.fmtHour(set)}`,
  );
  cols.forEach((c, i) => ctx.fillText(c.label, LABEL_W + 30 + i * cellW + 6, 26));
  // A skier's lens 3 m over the snow at `u` down the line, looking down
  // it a little under level.
  const chase = (u: number): LensPose => {
    const p = along(u);
    const q = along(Math.min(1, u + 0.08));
    const ey = level.groundAt(p.x, p.z) + 3;
    const run = Math.hypot(q.x - p.x, q.z - p.z);
    return {
      eye: { x: p.x, y: ey, z: p.z },
      target: { x: q.x, y: ey - run * 0.1, z: q.z },
      fov: 70,
      roll: 0,
    };
  };
  const sunward = (): LensPose => {
    const t = host.ridgeTop();
    const az = sunAtRun(withSky(level, { hour: set })).azimuth;
    return {
      eye: { x: t.x, y: t.y + 8, z: t.z },
      target: { x: t.x + Math.sin(az) * 400, y: t.y + 8 - 400 * 0.05, z: t.z + Math.cos(az) * 400 },
      fov: 70,
      roll: 0,
    };
  };
  const cells: SkyCell[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(row.label, 8, HEAD_H + r * cellH + cellH / 2);
    forceLowDeck(row.forced ? deck : undefined);
    forceCloudTier(CLOUD_TIER[row.tier]);
    // The sky's own table held at MEDIUM on HIGH (the headless renderer
    // draws HIGH's black), as the other cloud sheets do.
    forceSkyTier(row.tier === "high" ? "medium" : row.tier);
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      const sunset = col.y === Infinity;
      host.setOverride(sunset ? sunward() : chase(uAt(col.y)));
      const x = LABEL_W + 30 + c * cellW;
      const y = HEAD_H + r * cellH;
      const id = `${row.label.toLowerCase().replace(/ /g, "-")}@${col.label.replace(/[^a-z]+/gi, "-")}`;
      const got = await host.cell(
        ctx,
        { weather: row.weather, hour: sunset ? set - 0.05 : 12 },
        x,
        y,
        id,
      );
      cells.push(
        Object.assign(got, cloudEval(ctx.getImageData(x, y, cellW, cellH).data, cellW, cellH)),
      );
    }
  }
  forceLowDeck(undefined);
  forceSkyTier(null);
  forceCloudTier(null);
  host.setOverride(null);
  return { note: `${rows.length} rows × ${cols.length}`, r: rows.length, c: cols.length, cells };
}
