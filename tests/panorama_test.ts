// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PANORAMA (`panorama.ts`) — the mountain painted from the valley as a
// piste map hangs, and the schematic laid over it: summit-up and runs
// falling down the picture, the viewer's left the world's +x, the fit
// holding the whole ski area, the runs cut into their seen and hidden
// stretches against the picture's own depth, and a tap on the picture
// turned back into the snow it shows.

import { describe, expect, it } from "vitest";
import { cabinsOf } from "@engine";

import {
  PANORAMA_VIEW,
  PICK_PX,
  fitPanorama,
  fromPanorama,
  panoramaSchematic,
  pickGrid,
  renderPanorama,
  spotInPanorama,
  toPanorama,
} from "../pwa/src/game/panorama.ts";
import { routeOf } from "../pwa/src/game/route-shape.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const SEEDS = LEVEL_SEEDS.slice(0, 2);

/** One painted map per seed, shared by every case in the file. */
const painted = new Map<number, ReturnType<typeof paint>>();
function paint(seed: number) {
  const level = levelFor(seed);
  const view = fitPanorama(level);
  const picture = renderPanorama(level, view);
  return {
    level,
    view,
    picture,
    schematic: panoramaSchematic(level, view, picture.depth, cabinsOf(level)),
    pick: pickGrid(view, picture.depth),
  };
}
const paintedFor = (seed: number) => {
  if (!painted.has(seed)) painted.set(seed, paint(seed));
  return painted.get(seed)!;
};

const inView = ([x, y]: [number, number]): boolean =>
  x >= 0 && x <= PANORAMA_VIEW && y >= 0 && y <= PANORAMA_VIEW;

describe("the panorama's view (fitPanorama)", () => {
  it.each(SEEDS)("hangs seed %i summit-up, the world's +x on the left", (seed) => {
    const { level, view } = paintedFor(seed);
    const { summit, base } = level.mountain;
    expect(toPanorama(view, summit.x, summit.y, summit.z)[1]).toBeLessThan(
      toPanorama(view, base.x, base.y, base.z)[1],
    );
    // A turn of the picture, not a mirror: the viewer faces up the fall
    // line (−z), so +x is on his left.
    expect(toPanorama(view, 100, 0, 500)[0]).toBeGreaterThan(toPanorama(view, 200, 0, 500)[0]);
  });

  it.each(SEEDS)("holds seed %i's whole ski area in the picture", (seed) => {
    const { level, view } = paintedFor(seed);
    for (const run of level.resort?.runs ?? []) {
      for (const p of [run.points[0], run.points[run.points.length - 1]]) {
        expect(inView(toPanorama(view, p.x, p.y, p.z))).toBe(true);
      }
    }
    for (const l of level.resort?.lifts ?? []) {
      expect(inView(toPanorama(view, l.bottom.x, l.bottom.y, l.bottom.z))).toBe(true);
      expect(inView(toPanorama(view, l.top.x, l.top.y, l.top.z))).toBe(true);
    }
  });
});

describe("the painted picture (renderPanorama)", () => {
  it("fills the square edge to edge: the ski area's slice under a blue sky, clear of the rim", () => {
    const { level, view, picture } = paintedFor(SEEDS[0]);
    const px = view.px;
    // Every pixel is painted; the top row is sky, and blue.
    for (let i = 0; i < px * px; i++) expect(picture.rgba[i * 4 + 3]).toBe(255);
    for (let c = 0; c < px; c++) {
      expect(Number.isNaN(picture.depth[c])).toBe(true);
      const k = c * 4;
      expect(picture.rgba[k + 2]).toBeGreaterThan(picture.rgba[k] + 40);
    }
    // The picture is exactly the slice it paints, cut hard at its sides,
    // and that slice keeps clear of the rim the map rises into.
    expect((view.clip[1] - view.clip[0]) * view.scale).toBeCloseTo(px, 6);
    expect(view.clip[0]).toBeGreaterThanOrEqual(level.size * 0.09 - 1e-6);
    expect(view.clip[1]).toBeLessThanOrEqual(level.size * 0.91 + 1e-6);
    // The ground behind the summit ridge's crest is never painted: the
    // summit's column shows no ground farther off than the summit's own row.
    const [sc, sr] = toPanorama(
      view,
      level.mountain.summit.x,
      level.mountain.summit.y,
      level.mountain.summit.z,
    );
    const col = Math.round((sc / PANORAMA_VIEW) * px);
    for (let r = 0; r < px; r++) {
      const z = picture.depth[r * px + col];
      if (!Number.isNaN(z)) expect(z).toBeGreaterThan(level.mountain.summit.z - 50);
    }
    // And the bottom row is ground — the valley floor runs on to the foot.
    for (let c = 0; c < px; c++) expect(Number.isNaN(picture.depth[(px - 1) * px + c])).toBe(false);
    expect(sr).toBeGreaterThan(0);
  });

  it("is a pure function of the map", () => {
    const { level, view, picture } = paintedFor(SEEDS[0]);
    const again = renderPanorama(level, view);
    expect(Buffer.from(again.rgba).equals(Buffer.from(picture.rgba))).toBe(true);
  });
});

describe("the schematic (panoramaSchematic)", () => {
  it.each(SEEDS)("draws seed %i's runs falling down the picture", (seed) => {
    const { level, view, schematic } = paintedFor(seed);
    const runs = level.resort?.runs ?? [];
    // Every run, then the ski routes (R42) after them.
    const routes = level.resort?.routes ?? [];
    expect(schematic.runs).toHaveLength(runs.length + routes.length);
    expect(schematic.runs.filter((r) => r.kind === "route")).toHaveLength(routes.length);
    for (const run of runs) {
      const top = run.points[0];
      const foot = run.points[run.points.length - 1];
      expect(toPanorama(view, top.x, top.y, top.z)[1]).toBeLessThan(
        toPanorama(view, foot.x, foot.y, foot.z)[1],
      );
    }
    // Most of every map's ski area is in plain sight.
    const seen = schematic.runs.filter((r) => r.seen.length > 0).length;
    expect(seen).toBeGreaterThan(runs.length * 0.8);
  });

  it.each(SEEDS)("marks seed %i's houses seen from the valley", (seed) => {
    const { level, view, schematic } = paintedFor(seed);
    const houses = cabinsOf(level);
    // Most of them in sight, and each at its own foot in the picture.
    expect(schematic.houses.length).toBeGreaterThan(houses.length * 0.5);
    for (const h of schematic.houses) {
      const cabin = houses.find((c) => c.id === h.id)!;
      expect(h.kind).toBe(cabin.kind);
      const [x, y] = toPanorama(view, cabin.x, level.groundAt(cabin.x, cabin.z), cabin.z);
      expect(h.x).toBeCloseTo(x, 0);
      expect(h.y).toBeCloseTo(y, 0);
    }
  });

  it.each(SEEDS)("marks seed %i's raced course and its two ends", (seed) => {
    const { level, schematic } = paintedFor(seed);
    const course = level.resort?.courses.find((c) => c.id === level.resort?.course);
    expect(schematic.runs.filter((r) => r.raced).map((r) => r.id)).toEqual(
      level.resort?.runs.filter((r) => course?.runs.includes(r.id)).map((r) => r.id),
    );
    expect(schematic.finish).not.toBeNull();
    // Every piste carries its number, the one its sign reads, and no two
    // runs share one.
    for (const r of schematic.runs) {
      if (r.kind === "piste") expect(r.badge).not.toBeNull();
    }
    expect(new Set(schematic.runs.map((r) => r.number)).size).toBe(schematic.runs.length);
  });
});

describe("a tap on the panorama (fromPanorama, spotInPanorama)", () => {
  it.each(SEEDS)("turns a seen point of seed %i's piste back into the snow", (seed) => {
    const { level, view, schematic, pick } = paintedFor(seed);
    // A pick cell's span of the world: a column's width across, and along
    // the fall line what a cell's rows reach on the flattest snow.
    const across = view.px / PICK_PX / view.scale;
    const along = (3 * view.px) / PICK_PX / (view.scale * Math.sin(view.tilt));
    let tried = 0;
    const pts = level.track.points;
    for (let i = 0; i < pts.length; i += 50) {
      const p = pts[i];
      const at = toPanorama(view, p.x, p.y, p.z);
      const back = fromPanorama(view, pick, at[0], at[1]);
      if (!back || Math.abs(back.z - p.z) > along * 4) continue; // behind a crest
      tried++;
      expect(Math.abs(back.x - p.x)).toBeLessThan(across);
      expect(Math.abs(back.z - p.z)).toBeLessThan(along);
      const spot = spotInPanorama(view, pick, p.x, p.z);
      expect(spot).not.toBeNull();
      expect(Math.hypot(spot![0] - at[0], spot![1] - at[1])).toBeLessThan(3);
    }
    expect(tried).toBeGreaterThan(pts.length / 50 / 2);
    expect(schematic.start).not.toBeNull();
  });

  it("picks nothing on the sky", () => {
    const { view, pick } = paintedFor(SEEDS[0]);
    expect(fromPanorama(view, pick, 1, 1)).toBeNull();
    expect(fromPanorama(view, pick, -5, 50)).toBeNull();
  });
});

describe("a piste's line on a card (route-shape.ts)", () => {
  it("is open and falls down the box, seen from the valley", () => {
    const level = levelFor(SEEDS[0]);
    const d = routeOf(level);
    expect(d.includes("Z")).toBe(false);
    const nums = d
      .slice(1)
      .split(/[ML]/)
      .map((p) => p.split(" ").map(Number));
    const first = nums[0];
    const last = nums[nums.length - 1];
    const a = level.track.points[0];
    const b = level.track.points[level.track.points.length - 1];
    expect(first[1] < last[1]).toBe(a.z < b.z);
    expect(first[0] > last[0]).toBe(a.x < b.x);
  });
});
