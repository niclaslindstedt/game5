// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE LIGHTS (`piste-light-plan.ts`): the floodlight masts along the
// runs are laid out as a lit piste is, and light it to the standard —
// the recreational class for alpine skiing, 20 lx on average and never
// under 4 — while the snow past the edge stays dark.

import { describe, expect, it } from "vitest";
import { trackPointAt, type Level, type TrackPoint } from "@engine";

import {
  bakePisteLight,
  BAKE,
  illuminanceAt,
  intensityOf,
  planPisteLights,
  PISTE_LIGHT,
  type PisteMast,
} from "../pwa/src/game/piste-light-plan.ts";
import { clearOfLifts } from "../pwa/src/game/run-sign-plan.ts";
import { levelFor, LEVEL_SEEDS } from "./support/levels.ts";
import { syntheticLevel } from "./support/synthetic.ts";

type Line = { points: TrackPoint[]; length: number };

/** The light across `line` every 5 m down it (clear of its two ends, where
 * a run meets a station or the finish's own floods), at eleven points
 * from edge to edge; and on the open snow `out` m past either edge. */
function survey(level: Level, masts: readonly PisteMast[], lines: Line[], out: number) {
  const on: number[] = [];
  const off: number[] = [];
  const p: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
  for (const line of lines) {
    const track = { track: { points: line.points, length: line.length } };
    for (let s = 60; s < line.length - 60; s += 5) {
      trackPointAt(track, s, p);
      for (let f = -0.5; f <= 0.501; f += 0.1) {
        const x = p.x + Math.cos(p.heading) * f * p.width;
        const z = p.z - Math.sin(p.heading) * f * p.width;
        on.push(illuminanceAt(masts, x, level.groundAt(x, z), z));
      }
      for (const side of [-1, 1]) {
        const o = p.width / 2 + out;
        const x = p.x + Math.cos(p.heading) * side * o;
        const z = p.z - Math.sin(p.heading) * side * o;
        // Another run's snow is lit on purpose.
        if (lines.length > 1 && level.packedAt(x, z) > 0.05) continue;
        off.push(illuminanceAt(masts, x, level.groundAt(x, z), z));
      }
    }
  }
  on.sort((a, b) => a - b);
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return { mean: mean(on), p5: on[Math.floor(on.length * 0.05)], off: mean(off) };
}

describe("a lamp's beam", () => {
  it("sends out its whole flux, and nothing behind the mast", () => {
    const level = syntheticLevel();
    const lamp = planPisteLights(level)[4].lamps[0];
    // ∫ I dΩ over the sphere round the light point.
    const n = 240;
    let flux = 0;
    for (let i = 0; i < n; i++) {
      const g = ((i + 0.5) / n) * Math.PI;
      for (let j = 0; j < n; j++) {
        const a = ((j + 0.5) / n) * 2 * Math.PI;
        const x = lamp.x + Math.sin(g) * Math.sin(a);
        const z = lamp.z + Math.sin(g) * Math.cos(a);
        const y = lamp.y - Math.cos(g);
        flux += intensityOf(lamp, x, y, z) * Math.sin(g) * (Math.PI / n) * ((2 * Math.PI) / n);
      }
    }
    expect(flux / lamp.lumens).toBeGreaterThan(0.97);
    expect(flux / lamp.lumens).toBeLessThan(1.03);
    // Straight back up the way it is aimed: dark.
    expect(intensityOf(lamp, lamp.x - lamp.dx, lamp.y - lamp.dy, lamp.z - lamp.dz)).toBe(0);
  });
});

describe("the masts down a piste", () => {
  const level = syntheticLevel();
  const masts = planPisteLights(level);
  const line = { track: level.track };
  const p: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
  /** The arc down the piste a mast stands beside, and its gap to the line. */
  const placed = masts.map((m) => {
    let best = { s: 0, gap: Infinity, heading: 0, width: 0 };
    for (let s = 0; s <= level.track.length; s += 0.5) {
      trackPointAt(line, s, p);
      const gap = Math.hypot(p.x - m.x, p.z - m.z);
      if (gap < best.gap) best = { s, gap, heading: p.heading, width: p.width };
    }
    return { m, ...best };
  });

  it("stand some fifty metres apart, on one side, past the edge", () => {
    expect(masts.length).toBeGreaterThan(15);
    const sides = new Set(masts.map((m) => m.side));
    expect(sides.size).toBe(1);
    const order = [...placed].sort((a, b) => a.s - b.s);
    for (let i = 1; i < order.length; i++) {
      const gap = order[i].s - order[i - 1].s;
      expect(gap).toBeGreaterThan(PISTE_LIGHT.every - 12);
      expect(gap).toBeLessThan(PISTE_LIGHT.every + 12);
    }
    for (const { gap, width } of placed) expect(gap).toBeGreaterThan(width / 2 + 2);
  });

  it("carry their lamps at a light point of ten metres and up", () => {
    for (const m of masts) {
      expect(m.height).toBeGreaterThanOrEqual(10);
      expect(m.height).toBeLessThanOrEqual(18);
      for (const l of m.lamps) expect(l.y - m.y).toBeCloseTo(m.height, 6);
    }
  });

  it("aim every lamp down the run or across it, tipped down 15° and more", () => {
    for (const { m, heading } of placed) {
      for (const l of m.lamps) {
        expect(-l.dy).toBeGreaterThan(Math.sin((15 * Math.PI) / 180));
        // Never back up at a skier coming down.
        const along = l.dx * Math.sin(heading) + l.dz * Math.cos(heading);
        expect(along).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("light the piste to the recreational class, and leave the woods dark", () => {
    const lit = survey(level, masts, [level.track], 30);
    expect(lit.mean).toBeGreaterThanOrEqual(PISTE_LIGHT.lux.classIII.mean);
    expect(lit.mean).toBeLessThan(60);
    expect(lit.p5).toBeGreaterThanOrEqual(PISTE_LIGHT.lux.classIII.min);
    expect(lit.off).toBeLessThan(1);
  });

  it("bake the light the one-point sum gives, less what a crest shades", () => {
    const map = bakePisteLight(level, masts);
    let checked = 0;
    let same = 0;
    for (let s = 100; s < level.track.length - 100; s += 37) {
      trackPointAt(line, s, p);
      const i = Math.round(p.x / map.cell);
      const j = Math.round(p.z / map.cell);
      const x = i * map.cell;
      const z = j * map.cell;
      const want = illuminanceAt(masts, x, level.groundAt(x, z) + 0.3, z);
      const got = map.data[(j * map.cols + i) * 4 + 1];
      // A lamp over the break of a crest lights nothing below it.
      expect(got).toBeLessThanOrEqual(want + 1e-3);
      if (Math.abs(got - want) < 1e-3) same++;
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
    expect(same / checked).toBeGreaterThan(0.9);
    // Nothing lit past the reach of every mast.
    const corner = map.data[1];
    expect(corner).toBe(0);
    expect(BAKE.reach).toBeLessThan(level.size);
  });
});

describe("the masts of a ski area", () => {
  const level = levelFor(LEVEL_SEEDS[1]);
  const masts = planPisteLights(level);

  it("stand down every run, clear of the lifts and of each other", () => {
    expect(level.resort).toBeDefined();
    expect(masts.length).toBeGreaterThan(50);
    for (const m of masts) expect(clearOfLifts(level, m.x, m.z)).toBe(true);
    for (let i = 0; i < masts.length; i++) {
      for (let j = i + 1; j < masts.length; j++) {
        const gap = Math.hypot(masts[i].x - masts[j].x, masts[i].z - masts[j].z);
        expect(gap).toBeGreaterThanOrEqual(PISTE_LIGHT.clear.mast);
      }
    }
  });

  it("light its pistes to the class and leave the snow between them dark", () => {
    const runs = level.resort!.runs.filter((r) => r.kind === "piste");
    const lit = survey(level, masts, runs, 40);
    expect(lit.mean).toBeGreaterThanOrEqual(PISTE_LIGHT.lux.classIII.mean);
    expect(lit.p5).toBeGreaterThanOrEqual(PISTE_LIGHT.lux.classIII.min);
    expect(lit.off).toBeLessThan(1.5);
  });
});
