// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES (R25) — the twenty baked mountainsides: every one decodes
// to a mountain standing over its own valley floor, is named by its region
// and a number and nothing else, raises a resort in its own country, and is
// asked for the way the app asks (a stored ride, a link).

import { beforeAll, describe, expect, it } from "vitest";

import {
  REAL_FACE_IDS,
  REGION_IDS,
  RUN_GRADES,
  faceHeight,
  generateLevel,
  loadAllRealFaces,
  loadRealFace,
  leanLift,
  pisteAhead,
  realHints,
  type RealHints,
  realFace,
  realFaceCountry,
  realFaceGrades,
  realFaceLoaded,
  realFaceRegion,
} from "@engine";

import {
  countryFaces,
  faceCountries,
  faceForGrade,
  faceHasGrade,
} from "../pwa/src/game/face-picks.ts";
import { freshRide, mergeRide } from "../pwa/src/game/free-ride.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

describe("a real face unloaded", () => {
  // Before any face is loaded (this block runs first): a face is listed,
  // filed and filtered off the index alone, and READ only once loaded.
  it("is listed with its country and grades, and refuses to be read", async () => {
    const id = REAL_FACE_IDS.at(-1)!;
    expect(realFaceLoaded(id)).toBe(false);
    expect(realFaceCountry(id)).toMatch(/^[A-Z]{2}$/);
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

  it("are listed, each named by its region and a number", () => {
    expect(REAL_FACE_IDS).toHaveLength(20);
    for (const id of REAL_FACE_IDS) {
      const region = realFaceRegion(id);
      expect(region && REGION_IDS.includes(region)).toBe(true);
      expect(id).toMatch(new RegExp(`^${region}-\\d+$`));
    }
    expect(realFaceRegion("nowhere-1")).toBeNull();
    expect(realFace("nowhere-1")).toBeNull();
    expect(realFaceCountry("nowhere-1")).toBeNull();
    expect(realFaceGrades("nowhere-1")).toEqual([]);
  });

  it("are filed under a country, and graded by the pistes their ski area signs", () => {
    let filtered = 0;
    for (const id of REAL_FACE_IDS) {
      expect(realFaceCountry(id)).toMatch(/^[A-Z]{2}$/);
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

  it("raise a resort in their own country", () => {
    const level = generateLevel(1, { face: "fell-2" });
    expect(level.face).toBe("fell-2");
    expect(level.region).toBe("fell");
    expect(level.resort?.runs.length).toBeGreaterThan(5);
    // The dealt massif on the same seed is another mountain.
    const dealt = generateLevel(1, { region: "fell" });
    expect(dealt.face).toBeUndefined();
    expect(dealt.groundAt(2000, 1500)).not.toBeCloseTo(level.groundAt(2000, 1500), 0);
  });
});

describe("the real faces on the start card", () => {
  it("are filed by country, the first ones first, each with its name", () => {
    const all = faceCountries(null);
    expect(all[0]).toBe("SE");
    for (const c of all) expect(STRINGS.countryName(c)).not.toBe(c);
    const listed = all.flatMap((c) => countryFaces(c, null).map((f) => f.id));
    expect([...listed].sort()).toEqual([...REAL_FACE_IDS].sort());
  });

  it("are filtered by the GRADE row, each keeping its number in its country", () => {
    for (const grade of RUN_GRADES) {
      for (const c of faceCountries(null)) {
        const kept = countryFaces(c, grade);
        const whole = countryFaces(c, null);
        for (const f of kept) {
          expect(faceHasGrade(f.id, grade)).toBe(true);
          expect(whole.find((w) => w.id === f.id)!.n).toBe(f.n);
        }
        expect(faceCountries(grade).includes(c)).toBe(kept.length > 0);
      }
    }
    // Orange takes nothing away: every face carries the game's ski routes.
    expect(faceCountries("orange")).toEqual(faceCountries(null));
  });

  it("give way to one of the country's with the grade, or to the dealt massif", () => {
    const lacking = REAL_FACE_IDS.find((id) => !faceHasGrade(id, "green"))!;
    const moved = faceForGrade(lacking, "green");
    if (moved !== null) {
      expect(faceHasGrade(moved, "green")).toBe(true);
      expect(realFaceCountry(moved)).toBe(realFaceCountry(lacking));
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
    expect(readParams("?start=free&face=fell-9").face).toBeNull();
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
