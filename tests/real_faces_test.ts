// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES (R25) — the baked mountainsides: every one decodes to a
// mountain standing over its own valley floor, is keyed by its region and a
// number and named by its place (range, area, part), carries its real woods
// by height, raises a resort in its own climate with its own tree line, and
// is asked for the way the app asks (a stored ride, a link, the start card's
// RANGE, AREA and PART rows).

import { beforeAll, describe, expect, it } from "vitest";

import {
  REAL_FACE_IDS,
  REGION_IDS,
  RUN_GRADES,
  HINT_TREES_BANDS,
  faceCoverAt,
  faceHeight,
  faceWoods,
  generateLevel,
  loadAllRealFaces,
  loadRealFace,
  leanLift,
  pisteAhead,
  realHints,
  type RealHints,
  realFace,
  realFaceGrades,
  realFaceLoaded,
  realFacePlace,
  realFaceRegion,
  realFaceTrees,
  type TerrainPlan,
} from "@engine";

import {
  areaParts,
  faceForGrade,
  faceHasGrade,
  faceRanges,
  firstFace,
  kmBetween,
  rangeAreas,
  walk,
} from "../pwa/src/game/face-picks.ts";
import { MOST_PIPS, pipWindow } from "../pwa/src/game/knob-pips.ts";
import { freshRide, mergeRide } from "../pwa/src/game/free-ride.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

describe("a real face unloaded", () => {
  // Before any face is loaded (this block runs first): a face is listed,
  // filed and filtered off the index alone, and READ only once loaded.
  it("is listed with its place and grades, and refuses to be read", async () => {
    const id = REAL_FACE_IDS.at(-1)!;
    expect(realFaceLoaded(id)).toBe(false);
    expect(realFacePlace(id)?.range).toMatch(/^[A-Z]{2,4}$/);
    expect(realFaceGrades(id)).toContain("orange");
    expect(() => realFace(id)).toThrow(/not loaded/);
    expect(() => realHints(id)).toThrow(/not loaded/);
    expect(await loadRealFace(id)).toBe(true);
    expect(realFaceLoaded(id)).toBe(true);
    expect(realFace(id)).not.toBeNull();
    expect(await loadRealFace("nowhere-1")).toBe(false);
  });
});

describe("the real faces", () => {
  beforeAll(loadAllRealFaces);

  it("are listed, each keyed by its region and a number", () => {
    expect(REAL_FACE_IDS).toHaveLength(40);
    for (const id of REAL_FACE_IDS) {
      const region = realFaceRegion(id);
      expect(region && REGION_IDS.includes(region)).toBe(true);
      expect(id).toMatch(new RegExp(`^${region}-\\d+$`));
    }
    expect(realFaceRegion("nowhere-1")).toBeNull();
    expect(realFace("nowhere-1")).toBeNull();
    expect(realFacePlace("nowhere-1")).toBeNull();
    expect(realFaceGrades("nowhere-1")).toEqual([]);
  });

  it("are placed by range, area and part, each range with its name", () => {
    for (const id of REAL_FACE_IDS) {
      const place = realFacePlace(id)!;
      expect(place.range, id).toMatch(/^[A-Z]{2,4}$/);
      expect(STRINGS.rangeName(place.range), id).not.toBe(place.range);
      expect(place.area.trim(), id).not.toBe("");
      expect(place.part.trim(), id).not.toBe("");
    }
    // No two faces are the same part of the same area.
    const parts = REAL_FACE_IDS.map((id) => {
      const p = realFacePlace(id)!;
      return `${p.range}/${p.area}/${p.part}`;
    });
    expect(new Set(parts).size).toBe(parts.length);
  });

  it("are graded by the pistes their ski area signs", () => {
    let filtered = 0;
    for (const id of REAL_FACE_IDS) {
      const grades = realFaceGrades(id);
      // Orange is the game's own ski route, found on every face (R42).
      expect(grades).toContain("orange");
      const signed = new Set(realHints(id)?.pistes.map((p) => p.grade) ?? []);
      for (const g of RUN_GRADES) {
        if (g !== "orange") expect(grades.includes(g)).toBe(signed.has(g));
      }
      if (grades.length < RUN_GRADES.length) filtered++;
    }
    // The GRADE row has faces to take away.
    expect(filtered).toBeGreaterThan(0);
  });

  it("decode to a mountain over its valley floor", () => {
    for (const id of REAL_FACE_IDS) {
      const face = realFace(id)!;
      expect(face.heights.every(Number.isFinite)).toBe(true);
      // The summit ridge's row (the map's top) stands well over the
      // valley floor's (its bottom) across the playable middle.
      let ridge = 0;
      let floor = 0;
      for (let x = 800; x <= 3200; x += 100) {
        ridge += faceHeight(face, x, 320);
        floor += faceHeight(face, x, 3800);
      }
      expect((ridge - floor) / 25, id).toBeGreaterThan(250);
    }
  });

  it("carry their real woods by height, the tree line within the relief", () => {
    let wooded = 0;
    for (const id of REAL_FACE_IDS) {
      const face = realFace(id)!;
      const trees = realFaceTrees(face);
      if (!trees) continue;
      wooded++;
      expect(trees!.bands, id).toHaveLength(HINT_TREES_BANDS);
      for (const b of trees!.bands) expect(b >= 0 && b <= 1, id).toBe(true);
      expect(trees!.line, id).toBeGreaterThanOrEqual(trees!.lo);
      expect(trees!.line, id).toBeLessThanOrEqual(trees!.hi);
      expect(Math.max(...trees!.bands), id).toBeGreaterThan(0);
      // The cover read between the bands stays within them.
      for (let h = trees!.lo; h <= trees!.hi; h += 25) {
        const c = faceCoverAt(trees!, h);
        expect(c >= 0 && c <= Math.max(...trees!.bands), id).toBe(true);
      }
    }
    // Most real faces' maps draw their woods; a bare one takes its region's.
    expect(wooded).toBeGreaterThan(REAL_FACE_IDS.length * 0.75);
    expect(wooded).toBeLessThan(REAL_FACE_IDS.length);
  });

  it("raise a resort in their own climate, wooded to their own tree line", () => {
    const level = generateLevel(1, { face: "fell-2" });
    expect(level.face).toBe("fell-2");
    expect(level.region).toBe("fell");
    expect(level.resort?.runs.length).toBeGreaterThan(5);
    // The dealt massif on the same seed is another mountain, with the
    // region's tree line rather than the face's.
    const dealt = generateLevel(1, { region: "fell" });
    expect(dealt.face).toBeUndefined();
    expect(dealt.groundAt(2000, 1500)).not.toBeCloseTo(level.groundAt(2000, 1500), 0);
    const M = level.mountain!;
    const D = dealt.mountain!;
    const share = (m: typeof M): number => (m.treeLine - m.altitude) / m.vertical;
    expect(share(M)).not.toBeCloseTo(share(D), 2);
    // The face's tree line is its real one, laid at the share of the real
    // face's drop it stands at: fell-2's birch reaches most of the way up.
    expect(share(M)).toBeGreaterThan(0.3);
    expect(share(M)).toBeLessThan(1);
    // No tree stands over it.
    const lineY = M.base.y + (M.treeLine - M.altitude);
    expect(level.trees.length).toBeGreaterThan(100);
    for (const t of level.trees) expect(t.y).toBeLessThanOrEqual(lineY + 0.01);
  });

  it("thin the woods where the real face is bare, and only on a face", () => {
    const cover = (): { keep: number; close: number } => ({ keep: 1, close: 1 });
    const trees = { lo: 0, hi: 800, line: 700, bands: [1, 1, 1, 1, 0, 0, 0, 0] };
    const face = { floor: 0, stretch: 1, trees } as unknown as NonNullable<TerrainPlan["face"]>;
    const woods = faceWoods({ face } as TerrainPlan, 0, cover);
    // Full in a wooded band, thinned (never emptied) in a bare one.
    expect(woods(150).keep).toBeCloseTo(1, 6);
    expect(woods(700).keep).toBeGreaterThan(0);
    expect(woods(700).keep).toBeLessThan(0.5);
    // A dealt massif, or a face with no woods of its own, is R14's alone.
    expect(faceWoods({} as TerrainPlan, 0, cover)).toBe(cover);
    const bare = { ...face, trees: null } as NonNullable<TerrainPlan["face"]>;
    expect(faceWoods({ face: bare } as TerrainPlan, 0, cover)).toBe(cover);
  });
});

describe("the real faces on the start card", () => {
  it("are filed by range, the Nordic ones first, then by area and part", () => {
    const ranges = faceRanges(null);
    expect(ranges.slice(0, 3)).toEqual(["SE", "NO", "FI"]);
    for (const r of ranges) expect(STRINGS.rangeName(r)).not.toBe(r);
    const listed = ranges.flatMap((r) =>
      rangeAreas(r, null).flatMap((a) => areaParts(r, a, null).map((p) => p.id)),
    );
    expect([...listed].sort()).toEqual([...REAL_FACE_IDS].sort());
    // Some areas have more than one part: the PART row is shown for them.
    const many = ranges.flatMap((r) =>
      rangeAreas(r, null).filter((a) => areaParts(r, a, null).length > 1),
    );
    expect(many.length).toBeGreaterThan(0);
    // A range's first face is its first area's first part.
    for (const r of ranges) {
      const a = rangeAreas(r, null)[0];
      expect(firstFace(r, null)).toBe(areaParts(r, a, null)[0].id);
    }
  });

  it("are filtered by the GRADE row: parts, then areas, then ranges", () => {
    for (const grade of RUN_GRADES) {
      for (const r of faceRanges(null)) {
        const areas = rangeAreas(r, grade);
        for (const a of rangeAreas(r, null)) {
          const kept = areaParts(r, a, grade);
          for (const p of kept) expect(faceHasGrade(p.id, grade)).toBe(true);
          const whole = areaParts(r, a, null);
          expect(kept.length).toBe(whole.filter((p) => faceHasGrade(p.id, grade)).length);
          expect(areas.includes(a)).toBe(kept.length > 0);
        }
        expect(faceRanges(grade).includes(r)).toBe(areas.length > 0);
      }
    }
    // Orange takes nothing away: every face carries the game's ski routes.
    expect(faceRanges("orange")).toEqual(faceRanges(null));
    // Some grade does take something away.
    expect(
      RUN_GRADES.some(
        (g) =>
          faceRanges(g).length < faceRanges(null).length ||
          faceRanges(g).some((r) => rangeAreas(r, g).length < rangeAreas(r, null).length),
      ),
    ).toBe(true);
  });

  it("walk a range's areas neighbour after neighbour, never back and forth", () => {
    const at = (r: string, a: string) => {
      const ps = areaParts(r, a, null).map((p) => realFacePlace(p.id)!);
      return {
        name: a,
        lat: ps.reduce((s, p) => s + p.lat, 0) / ps.length,
        lon: ps.reduce((s, p) => s + p.lon, 0) / ps.length,
      };
    };
    // The walk itself: each next one is the nearest not yet walked.
    const pts = [
      { name: "c", lat: 60, lon: 12 },
      { name: "a", lat: 63, lon: 10 },
      { name: "b", lat: 62, lon: 10.5 },
    ];
    expect(walk(pts).map((p) => p.name)).toEqual(["a", "b", "c"]);
    expect(kmBetween(pts[1], pts[2])).toBeCloseTo(114, -1);
    for (const r of faceRanges(null)) {
      const areas = rangeAreas(r, null).map((a) => at(r, a));
      for (let i = 0; i + 1 < areas.length; i++) {
        const hop = kmBetween(areas[i], areas[i + 1]);
        for (const later of areas.slice(i + 1)) {
          expect(hop).toBeLessThanOrEqual(kmBetween(areas[i], later) + 1e-6);
        }
      }
      // The walk is no longer than the same areas taken by name.
      const length = (xs: typeof areas) =>
        xs.slice(1).reduce((s, x, i) => s + kmBetween(xs[i], x), 0);
      const byName = [...areas].sort((a, b) => a.name.localeCompare(b.name));
      expect(length(areas)).toBeLessThanOrEqual(length(byName) + 1e-6);
      // Hiding some faces never reorders the rest.
      for (const grade of RUN_GRADES) {
        const kept = rangeAreas(r, grade);
        expect(kept).toEqual(areas.map((a) => a.name).filter((a) => kept.includes(a)));
      }
    }
  });

  it("keep a row's pips to a window however many areas a range has", () => {
    expect(pipWindow(5, 2)).toEqual([0, 1, 2, 3, 4]);
    for (const n of [MOST_PIPS + 1, 30, 120]) {
      for (const at of [-1, 0, 7, n >> 1, n - 1]) {
        const shown = pipWindow(n, at);
        expect(shown.length).toBe(MOST_PIPS);
        expect(shown[0]).toBeGreaterThanOrEqual(0);
        expect(shown[shown.length - 1]).toBeLessThan(n);
        if (at >= 0) expect(shown).toContain(at);
      }
    }
  });

  it("give way to one of the area's or the range's with the grade, or the dealt massif", () => {
    const lacking = REAL_FACE_IDS.find((id) => !faceHasGrade(id, "green"))!;
    const moved = faceForGrade(lacking, "green");
    if (moved !== null) {
      expect(faceHasGrade(moved, "green")).toBe(true);
      expect(realFacePlace(moved)!.range).toBe(realFacePlace(lacking)!.range);
    }
    expect(faceForGrade(lacking, null)).toBe(lacking);
    expect(faceForGrade(null, "green")).toBeNull();
  });
});

describe("a real face asked for", () => {
  it("is kept on a stored ride only in its own country", () => {
    const ride = { ...freshRide(), region: "alpine", face: "alpine-3" };
    expect(mergeRide(ride).face).toBe("alpine-3");
    expect(mergeRide({ ...ride, region: "fell" }).face).toBeNull();
    expect(mergeRide({ ...ride, face: "alpine-99" }).face).toBeNull();
  });

  it("is read off a link only when there is one", () => {
    expect(readParams("?start=free&face=fell-2").face).toBe("fell-2");
    expect(readParams("?start=free&face=fell-99").face).toBeNull();
    expect(readParams("?start=free").face).toBeNull();
  });
});

describe("a real face's hints", () => {
  it("decode onto the face's map: lifts, pistes and houses", () => {
    for (const id of REAL_FACE_IDS) {
      const h = realHints(id)!;
      expect(h, id).not.toBeNull();
      const on = (p: { x: number; z: number }): boolean =>
        p.x >= 0 && p.x <= 4000 && p.z >= 0 && p.z <= 4000;
      for (const l of h.lifts) expect(on(l.bottom) && on(l.top), id).toBe(true);
      for (const p of h.pistes) {
        expect(p.points.length, id).toBeGreaterThanOrEqual(2);
        expect(["green", "blue", "red", "black", "orange"]).toContain(p.grade);
      }
      expect(h.houses.length, id).toBeLessThanOrEqual(4000);
      for (const o of h.houses) {
        expect(on(o) && o.size >= 3 && o.turn >= 0 && o.turn < Math.PI, id).toBe(true);
      }
    }
    // A face with a ski area on it carries it.
    const one = realHints("alpine-1")!;
    expect(one.lifts.length).toBeGreaterThan(10);
    expect(one.pistes.length).toBeGreaterThan(40);
    expect(realHints("nowhere-1")).toBeNull();
  });

  it("carry the town roughly: its streets on the map, a middle and a radius, a few KB at most", () => {
    for (const id of REAL_FACE_IDS) {
      const h = realHints(id)!;
      const on = (p: { x: number; z: number }): boolean =>
        p.x >= -1 && p.x <= 4001 && p.z >= -1 && p.z <= 4001;
      // Every face has a town by the bake's measure, kept to its budget.
      expect(h.streets.length, id).toBeGreaterThan(0);
      expect(h.streets.length, id).toBeLessThanOrEqual(90);
      expect(h.town, id).not.toBeNull();
      expect(on(h.town!) && h.town!.r > 0 && h.town!.r <= 4000, id).toBe(true);
      // About 1.8 KB of varints: a few hundred points, never thousands.
      const points = h.streets.reduce((n, s) => n + s.points.length, 0);
      expect(points, id).toBeLessThanOrEqual(1000);
      for (const s of h.streets) {
        expect(s.points.length, id).toBeGreaterThanOrEqual(2);
        for (const p of s.points) expect(on(p), id).toBe(true);
        // Kept at 2 m, never under the bake's shortest.
        let length = 0;
        for (let i = 1; i < s.points.length; i++) {
          length += Math.hypot(
            s.points[i].x - s.points[i - 1].x,
            s.points[i].z - s.points[i - 1].z,
          );
        }
        expect(length, id).toBeGreaterThan(35);
      }
    }
  });

  const hints: RealHints = {
    lifts: [
      { kind: "chair", bottom: { x: 1500, z: 2600 }, top: { x: 1700, z: 1600 } },
      { kind: "drag", bottom: { x: 1100, z: 3500 }, top: { x: 1150, z: 3200 } },
    ],
    pistes: [
      {
        grade: "red",
        points: [
          { x: 1700, z: 1600 },
          { x: 1300, z: 2200 },
          { x: 1600, z: 3000 },
        ],
        widths: [0, 0, 0],
      },
    ],
    houses: [],
    streets: [],
    town: null,
  };

  it("lean a lift along the real one's line, its floor station carried down to its row", () => {
    const r = { reach: 700, rise: 300, carry: 1600 };
    const leant = leanLift(
      hints,
      new Set(),
      { x: 1400, z: 3600 },
      { x: 1800, z: 1700 },
      ["chair", "gondola"],
      r,
      { bottom: true, top: false },
    )!;
    // The top onto the real top; the bottom kept on the floor row, on the
    // real line carried down to it (x = 1700 − 200 × 2000/1000).
    expect(leant.top).toEqual({ x: 1700, z: 1600 });
    expect(leant.bottom.z).toBe(3600);
    expect(leant.bottom.x).toBeCloseTo(1300, 6);
    // A chair never takes a drag's line, and nothing is near a far lift.
    const far = leanLift(
      hints,
      new Set(),
      { x: 3500, z: 3600 },
      { x: 3500, z: 1700 },
      ["chair"],
      r,
      {
        bottom: true,
        top: false,
      },
    );
    expect(far).toBeNull();
  });

  it("steer a run for the real piste ahead of it", () => {
    const ahead = pisteAhead(hints, "red", { ahead: { min: 80, max: 260 }, aside: 260, same: 80 });
    const p = ahead(1500, 1800)!;
    expect(p.z).toBeGreaterThanOrEqual(1880);
    expect(p.z).toBeLessThanOrEqual(2060);
    // Nothing that far across.
    expect(ahead(3500, 1800)).toBeNull();
  });
});
