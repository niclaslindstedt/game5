// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER GROUND and THE SUMMER SEASON (`summer-ground.ts`, `summer.ts`):
// the classifier is a pure function of the map, its kinds lie where the
// research puts them, every surface sits in its band, and a summer run is
// stood up with no snow, no machine and no snowing sky — while a run that
// did not ask for summer carries no trace of it.
import { describe, expect, it } from "vitest";
import {
  KIND_SURFACE,
  SUMMER_GROUND,
  SUMMER_KINDS,
  SURFACES,
  createGame,
  generateLevel,
  packedSnow,
  summerFieldOf,
  summerGroundAt,
  summerSurfaceAt,
  treeLineY,
  waterOn,
  weatherOf,
  withSky,
  type SummerKind,
} from "@engine";
import { levelFor } from "./support/levels.ts";

const SEED = 1;
const STEP = 20;

/** Every kind on a 20 m lattice over the map, with the height it stood at. */
function census(level: ReturnType<typeof levelFor>) {
  const out: { kind: SummerKind; y: number; x: number; z: number }[] = [];
  for (let z = STEP / 2; z < level.size; z += STEP) {
    for (let x = STEP / 2; x < level.size; x += STEP) {
      out.push({ kind: summerGroundAt(level, x, z), y: level.groundAt(x, z), x, z });
    }
  }
  return out;
}

describe("the summer ground", () => {
  const level = levelFor(SEED);
  const seen = census(level);

  it("is a pure function of the map", () => {
    const again = generateLevel(SEED);
    const a = summerFieldOf(level);
    const b = summerFieldOf(again);
    expect(b.cols).toBe(a.cols);
    expect(Buffer.from(b.a).equals(Buffer.from(a.a))).toBe(true);
    expect(Buffer.from(b.b).equals(Buffer.from(a.b))).toBe(true);
    for (let i = 0; i < seen.length; i += 97) {
      expect(summerGroundAt(again, seen[i].x, seen[i].z)).toBe(seen[i].kind);
    }
  }, 60_000);

  it("lays its kinds by height: turf, scree and snow above the tree line, meadow, pasture and scrub below", () => {
    const line = treeLineY(level);
    for (const p of seen) {
      if (p.kind === "turf" || p.kind === "heath" || p.kind === "scree" || p.kind === "snow") {
        expect(p.y).toBeGreaterThan(line - SUMMER_GROUND.cell * 2);
      }
      if (p.kind === "meadow" || p.kind === "pasture" || p.kind === "scrub" || p.kind === "bog") {
        expect(p.y).toBeLessThanOrEqual(line + 1);
      }
    }
    for (const kind of ["meadow", "turf", "rock", "snow", "piste", "forest"] as const) {
      expect(
        seen.some((p) => p.kind === kind),
        kind,
      ).toBe(true);
    }
  });

  it("leaves snow patches on a few per cent of the ground above the tree line", () => {
    const line = treeLineY(level);
    const high = seen.filter((p) => p.y > line);
    const snow = high.filter((p) => p.kind === "snow").length / high.length;
    expect(snow).toBeGreaterThan(0.01);
    expect(snow).toBeLessThan(0.08);
  });

  it("scars the runs barer above the tree line than below", () => {
    const line = treeLineY(level);
    const share = (above: boolean) => {
      const on = seen.filter(
        (p) => (p.kind === "piste" || p.kind === "dirt") && p.y > line === above,
      );
      return on.filter((p) => p.kind === "dirt").length / Math.max(1, on.length);
    };
    expect(share(true)).toBeGreaterThan(share(false));
  });

  it("gives every kind a surface inside the physics' sense", () => {
    for (const kind of SUMMER_KINDS) {
      const s = SURFACES[KIND_SURFACE[kind]];
      expect(s.slide).toBeLessThan(s.grip);
      expect(s.grip).toBeGreaterThan(0);
      expect(s.roll).toBeGreaterThan(0);
    }
    // Snow the slipperiest ground a wheel meets, loam the grippiest.
    expect(SURFACES.snow.grip).toBeLessThan(SURFACES.grass.grip);
    expect(SURFACES.loam.grip).toBeGreaterThan(SURFACES.grass.grip);
    const p = seen.find((q) => q.kind === "snow")!;
    expect(summerSurfaceAt(level, p.x, p.z)).toBe(SURFACES.snow);
  });
});

describe("the summer season", () => {
  const level = levelFor(SEED);

  it("stands a free ride up with no loose snow, no machines and no crowd", () => {
    const s = createGame({
      level,
      mode: "free",
      summer: true,
      groomer: "on",
      avalanche: true,
      quiet: true,
    });
    expect(s.summer).toBe(true);
    expect(s.fresh).toBe(0);
    expect(s.piste).toBeUndefined();
    expect(s.groomers).toBeUndefined();
    expect(s.machineSnow).toBeUndefined();
    expect(s.avalanche).toBeUndefined();
    expect(s.rules.crowd).toBe(0);
    expect(s.rules.sled).toBe(false);
    expect(s.crowd).toBeUndefined();
    // Off the piste and on it, the ground is hard.
    expect(packedSnow(s, level.size * 0.3, level.size * 0.3)).toBe(1);
  });

  it("sends no keen skiers out after dark", () => {
    const night = withSky(level, { hour: 22 });
    const winter = createGame({ level: night, mode: "free", quiet: true });
    const s = createGame({ level: night, mode: "free", summer: true, quiet: true });
    expect(winter.rivals.length).toBeGreaterThan(0);
    expect(s.rivals).toHaveLength(0);
  });

  it("never snows", () => {
    const storm = withSky(level, { weather: "storm" });
    const s = createGame({ level: storm, mode: "free", summer: true, quiet: true });
    expect(weatherOf(s.level).kind).toBe("overcast");
    const flurries = withSky(level, { weather: "flurries" });
    const f = createGame({ level: flurries, mode: "free", summer: true, quiet: true });
    expect(weatherOf(f.level).kind).toBe("fair");
  });

  it("leaves no trace on a run that did not ask for it", () => {
    const s = createGame({ level, mode: "free", quiet: true });
    expect("summer" in s).toBe(false);
    // ...and a race asked for summer is no summer: a free ride's alone.
    const r = createGame({ level, summer: true, quiet: true });
    expect("summer" in r).toBe(false);
  });

  it("finds the lakes open on midsummer's day", () => {
    // The lake-ice model (`lake-ice.ts`) at the SUMMER stop's day, over the
    // ski countries' real heights: every pond, lake and river open.
    const regions = ["alpine", "fell", "continental", "maritime"] as const;
    for (const region of regions)
      for (const [latitude, top] of [
        [36, 2300],
        [46, 2300],
        [63, 1500],
      ] as const)
        for (const altitude of [400, top])
          for (const area of [1e3, 5e5])
            for (const running of [false, true])
              expect(
                waterOn(SUMMER_GROUND.day, latitude, altitude, area, running, region).phase,
              ).toBe("open");
  });
});
