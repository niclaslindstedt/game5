// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R21 — A REGION IS NAMED IN FIVE PLACES, and this is the test that holds
// them to one list: the engine's row (`mapgen/regions.ts`: what the country
// IS), the ground's and the trees' look (`region-look.ts`), the grade over
// the whole picture (`colour-grade.ts`), the start card's word for it
// (`strings.ts`), and the COUNTRY row that offers it. None can import the
// others' reason to exist, so a region added to one and not the rest is a
// map with no colour, or a card with no word.
//
// And it holds the three promises the regions were built on: the ALPINE is
// the map every seed always built (no digest moved for the table existing);
// every other region builds, clean, in its own character — the fell low,
// bare-topped and crusted, the continental tall and wooded high, the
// maritime wooded nearly to the summit; and a region is a KIND of country,
// never a place.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_REGION,
  LEVEL_RULES as R,
  REGIONS,
  REGION_IDS,
  analyzeLevel,
  generateLevel,
  levelDigest,
  nearestTrackPoint,
  regionOf,
  SURFACE_CLEAR as CLEAR,
  withinBand,
  type GeneratedLevel,
  type RegionId,
} from "@engine";
import { COLOUR_GRADES } from "../pwa/src/game/colour-grade.ts";
import { REGION_LOOKS } from "../pwa/src/game/region-look.ts";
import { freshRide, mergeRide } from "../pwa/src/game/free-ride.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";
import { levelFor } from "./support/levels.ts";

const ROOT = process.cwd();

/** Two seeds per region, built once and shared. */
const SEEDS = [5, 38];
const built = new Map<string, GeneratedLevel>();
function regionLevel(region: RegionId, seed: number): GeneratedLevel {
  const key = `${region}:${seed}`;
  let level = built.get(key);
  if (!level) {
    // On generator v1, the rule book's own numbers (the UNGRADED row): a
    // region's character is its row's multiples of them, whole — on the
    // graded generator a grade sets the vertical and keeps only a share of
    // the region's (R23), which mapgen_test holds.
    level = generateLevel(seed, { region, version: 1 });
    built.set(key, level);
  }
  return level;
}

/** The mean share of a field over the grid. */
function share(field: { data: Float32Array } | undefined): number {
  if (!field) return 0;
  let s = 0;
  for (const v of field.data) s += v;
  return s / field.data.length;
}

/** The tree line as a height on a map, m. */
function lineY(level: GeneratedLevel): number {
  const M = level.mountain;
  return M.base.y + (M.treeLine - M.altitude);
}

describe("a region is named in five places, and all five agree", () => {
  it("the engine's rows, the looks, the grades and the card's words are one list", () => {
    const ids = [...REGION_IDS].sort();
    expect(Object.keys(REGIONS).sort()).toEqual(ids);
    expect(Object.keys(REGION_LOOKS).sort()).toEqual(ids);
    expect(Object.keys(COLOUR_GRADES).sort()).toEqual(ids);
    expect(Object.keys(STRINGS.regionNames).sort()).toEqual(ids);
    for (const id of REGION_IDS) expect(REGIONS[id].id).toBe(id);
    expect(DEFAULT_REGION).toBe("alpine");
  });

  it("the alpine row is all ones and lays nothing", () => {
    const a = REGIONS.alpine;
    const ones = [
      a.relief.vertical,
      a.relief.flank,
      a.relief.crests,
      a.relief.hills,
      a.relief.ridges,
      a.relief.rollers,
      a.relief.bowls.count,
      a.relief.bowls.radius,
      a.relief.bowls.depth,
      a.relief.headwalls.count,
      a.relief.headwalls.drop,
      a.forest.density,
      a.forest.meadow,
      a.forest.height,
      a.kickers,
    ];
    expect(ones.every((v) => v === 1)).toBe(true);
    expect(a.forest.roster[0].kind).toBe("spruce");
    expect(a.forest.roster[0].share).toBeGreaterThan(0.25);
    expect(a.sun.latitude).toBe(R.sun.latitude);
    expect(a.sun.dayOfYear).toBe(R.sun.dayOfYear);
    expect(a.crust).toBeNull();
    expect(a.river).toBeNull();
    // Every region's grade is a grade of its own: the picture's, never the
    // engine's (`colour-grade.ts`), so only that each has one is held.
    for (const id of REGION_IDS) expect(COLOUR_GRADES[id], id).toBeDefined();
  });

  it("every roster's shares sum to one, and every altitude band is the research's", () => {
    for (const id of REGION_IDS) {
      const sum = REGIONS[id].forest.roster.reduce((a, r) => a + r.share, 0);
      expect(sum, id).toBeCloseTo(1, 9);
      const alt = REGIONS[id].altitude;
      expect(alt.treeLine.min).toBeGreaterThan(alt.base.max);
      expect(REGIONS[id].river).toBeNull();
    }
    // The tree lines by kind of country: the alpine's 1800–2200 m, the
    // fell's 600–1000 m, the continental's 3000–3500 m, the maritime's
    // about 1500 m.
    expect(REGIONS.alpine.altitude.treeLine).toEqual({ min: 1800, max: 2200 });
    expect(REGIONS.fell.altitude.treeLine).toEqual({ min: 600, max: 1000 });
    expect(REGIONS.continental.altitude.treeLine).toEqual({ min: 3000, max: 3500 });
    expect(REGIONS.maritime.altitude.treeLine.min).toBeGreaterThanOrEqual(1400);
    expect(REGIONS.maritime.altitude.treeLine.max).toBeLessThanOrEqual(1600);
  });
});

describe("the alpine is the map every seed always built", () => {
  it("asking for it by name builds the very map asking for nothing does", () => {
    const plain = levelFor(38);
    const named = generateLevel(38, { region: "alpine" });
    expect(levelDigest(named)).toBe(levelDigest(plain));
    expect(plain.region).toBe("alpine");
    expect(plain.crust).toBeUndefined();
    expect(plain.ice).toBeUndefined();
    expect(plain.iceAt).toBeUndefined();
    plain.trees.forEach((t, i) => expect(named.trees[i].kind).toBe(t.kind));
  });

  it("a hand-built map without a region reads as the alpine", () => {
    expect(regionOf({}).id).toBe("alpine");
  });
});

describe("every region builds, clean, in its own character", () => {
  for (const id of REGION_IDS.filter((r) => r !== "alpine")) {
    for (const seed of SEEDS) {
      it(`${id} seed ${seed} builds clean, in its own bands of latitude and altitude`, () => {
        const level = regionLevel(id, seed);
        expect(level.region).toBe(id);
        const a = analyzeLevel(level);
        expect(
          a.findings.filter((f) => f.severity === "error"),
          `${id} ${seed}`,
        ).toEqual([]);
        expect(withinBand(level.sun.latitude, REGIONS[id].sun.latitude)).toBe(true);
        expect(withinBand(level.sun.dayOfYear, REGIONS[id].sun.dayOfYear)).toBe(true);
        expect(withinBand(level.mountain.altitude, REGIONS[id].altitude.base)).toBe(true);
        expect(withinBand(level.mountain.treeLine, REGIONS[id].altitude.treeLine)).toBe(true);
        expect(
          withinBand(level.mountain.vertical, {
            min: R.mountain.vertical.min * REGIONS[id].relief.vertical,
            max: R.mountain.vertical.max * REGIONS[id].relief.vertical,
          }),
        ).toBe(true);
        // A region's map is another map: its digest names it.
        expect(levelDigest(level)).not.toBe(levelDigest(levelFor(seed)));
        // No frozen water on a mountain.
        expect(level.ice).toBeUndefined();
      });
    }
  }

  it("the fell is low and rounded, bare of all but birch on its top, crusted over much of it", () => {
    for (const seed of SEEDS) {
      const fell = regionLevel("fell", seed);
      const alpine = regionLevel("alpine", seed);
      expect(fell.mountain.vertical).toBeLessThan(alpine.mountain.vertical * 0.7);
      const mean = (ts: GeneratedLevel["trees"]): number =>
        ts.reduce((a, t) => a + t.height, 0) / Math.max(1, ts.length);
      expect(mean(fell.trees)).toBeLessThan(mean(alpine.trees) * 0.85);
      const birches = fell.trees.filter((t) => t.kind === "birch").length;
      expect(birches / fell.trees.length).toBeGreaterThan(0.4);
      expect(share(fell.crust)).toBeGreaterThan(0.15);
      // The top of the fell stands bare: the tree line under the summit.
      expect(lineY(fell)).toBeLessThan(fell.mountain.summit.y);
    }
  });

  it("the continental stands tallest, its woods climbing high, a thin crust on the crests", () => {
    for (const seed of SEEDS) {
      const cont = regionLevel("continental", seed);
      const alpine = regionLevel("alpine", seed);
      expect(cont.mountain.vertical).toBeGreaterThan(alpine.mountain.vertical);
      const lodgepoles = cont.trees.filter((t) => t.kind === "lodgepole").length;
      expect(lodgepoles / cont.trees.length).toBeGreaterThan(0.1);
      expect(share(cont.crust)).toBeGreaterThan(0);
      expect(share(cont.crust)).toBeLessThan(share(regionLevel("fell", seed).crust));
    }
  });

  it("the maritime is wooded nearly to the summit, fir and birch, and lays no crust", () => {
    for (const seed of SEEDS) {
      const mar = regionLevel("maritime", seed);
      const alpine = regionLevel("alpine", seed);
      expect(mar.trees.length).toBeGreaterThan(alpine.trees.length);
      const firs = mar.trees.filter((t) => t.kind === "fir").length;
      expect(firs / mar.trees.length).toBeGreaterThan(0.25);
      expect(mar.crust).toBeUndefined();
      expect(lineY(mar) - mar.mountain.base.y).toBeGreaterThan(0.8 * mar.mountain.vertical);
    }
  });

  it("the region's own snow keeps off the piste (R10 holds)", () => {
    for (const id of ["fell", "continental"] as const) {
      const level = regionLevel(id, 38);
      const f = level.ground;
      for (let k = 0; k < f.data.length; k += 97) {
        const x = f.originX + (k % f.cols) * f.cell;
        const z = f.originZ + Math.floor(k / f.cols) * f.cell;
        const wild = level.crust?.data[k] ?? 0;
        if (wild === 0) continue;
        expect(nearestTrackPoint(level, x, z).distance).toBeGreaterThanOrEqual(CLEAR - 0.5);
      }
    }
  });
});

describe("the start card's COUNTRY row and the link", () => {
  it("a ride keeps its region, and reads it back", () => {
    expect(freshRide().region).toBe("alpine");
    expect(mergeRide({ region: "fell" }).region).toBe("fell");
    expect(mergeRide({ region: "somewhere" }).region).toBe("alpine");
  });

  it("?region= names a region, and nothing else", () => {
    expect(readParams("?region=maritime").region).toBe("maritime");
    expect(readParams("?region=elsewhere").region).toBeNull();
    expect(readParams("").region).toBeNull();
  });
});

describe("a region is a kind of country, never a place", () => {
  /** The source and the docs, minus what may name a place: the spec (a copy
   * of the sibling's), the changelog, the licence, this file, and the three
   * that name a real face's range, area and part — its crop rows
   * (`real-face-crops.mjs`), the face index the bake writes off them
   * (`real-faces-index.ts`) and the table its range is named in
   * (`strings-ranges.ts`). */
  function sources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".") || name === "node_modules" || name === "dist") continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (["previews", "tauri", "native"].includes(name)) continue;
        sources(path, out);
      } else if (
        /\.(ts|tsx|mjs|md)$/.test(name) &&
        !/CHANGELOG|OSS_GAME_SPEC|LICENSE|region_test|identity_test|real-face-crops\.mjs|real-faces-index\.ts|strings-ranges\.ts/.test(
          name,
        )
      ) {
        out.push(path);
      }
    }
    return out;
  }

  it("names no range, country, valley, resort or race anywhere in the tree", () => {
    const places =
      /\b(Alps|Rockies|Rocky Mountains|Himalaya\w*|Andes|Pyrenee\w*|Dolomit\w+|Carpathian\w*|Tatra|Caucasus|Urals?\b|Lapland|Sápmi|Siberia\w*|Yukon|Alaska\w*|Canad\w+|Scandinavi\w+|Sweden|Swedish|Finland|Finnish|Norway|Norwegian|Iceland\w*|Greenland|Svalbard|Kamchatka|Hokkaido|Honsh\w+|Nagano|Patagonia\w*|Tyrol\w*|Chamonix|Zermatt|Whistler|Colorado|Utah|Montana|Wyoming|Quebec|Ontario|Kitzb\w+|Wengen|Streif|Lauberhorn|Hahnenkamm|Mausefalle|Hundschopf|Harakiri|Mayrhofen|Sarenne|Hakuba|Zao|Åre|Jackson Hole|Revelstoke)\b/;
    const hits: string[] = [];
    for (const path of sources(ROOT)) {
      const text = readFileSync(path, "utf8");
      const m = places.exec(text);
      if (m) hits.push(`${path.slice(ROOT.length + 1)}: "${m[0]}"`);
    }
    expect(hits).toEqual([]);
  });
});
