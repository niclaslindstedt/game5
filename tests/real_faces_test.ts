// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES (R25) — the twenty baked mountainsides: every one decodes
// to a mountain standing over its own valley floor, is named by its region
// and a number and nothing else, raises a resort in its own country, and is
// asked for the way the app asks (a stored ride, a link).

import { describe, expect, it } from "vitest";

import {
  REAL_FACE_IDS,
  REGION_IDS,
  faceHeight,
  generateLevel,
  realFace,
  realFaceRegion,
} from "@engine";

import { freshRide, mergeRide } from "../pwa/src/game/free-ride.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

describe("the real faces", () => {
  it("are twenty, each named by its region and a number", () => {
    expect(REAL_FACE_IDS).toHaveLength(20);
    for (const id of REAL_FACE_IDS) {
      const region = realFaceRegion(id);
      expect(region && REGION_IDS.includes(region)).toBe(true);
      expect(id).toMatch(new RegExp(`^${region}-\\d+$`));
    }
    expect(realFaceRegion("nowhere-1")).toBeNull();
    expect(realFace("nowhere-1")).toBeNull();
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
