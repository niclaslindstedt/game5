// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT IS DRAWN ON THE SNOW IS SOLID (`pwa/src/game/drawn-solids.ts`,
// handed to the engine's `setDrawnSolids`): every station's house, booth,
// hut, mast, hood strut, canopy column, map board and corral pole, every
// sign's post, a wind tunnel's arches, a fire's benches and woodpile, the
// course's start hut or start house, a ski cross's start frame, the finish
// arch, its masts and the nets' posts, a ski jump's structure and the ski
// area's props stand in `solidsOf` after the map's own (`mapSolidsOf`),
// which no placement reads — so the map, its fires and its digest are what
// they were — and a skier sent at one of each kind meets it.

import { describe, expect, it } from "vitest";

import {
  firesOf,
  levelDigest,
  liftPlans,
  mapSolidsOf,
  setDrawnSolids,
  solidsOf,
  stationHouses,
} from "@engine";

import { drawnSolids } from "../pwa/src/game/drawn-solids.ts";
import { summitSigns } from "../pwa/src/game/run-sign-plan.ts";
import { meets } from "./support/drawn-hits.ts";
import { levelFor } from "./support/levels.ts";

describe("what is drawn on the snow is solid", () => {
  const level = levelFor(38);

  it("stands after the map's own solids, which it leaves as they were", () => {
    const digest = levelDigest(level);
    const fires = firesOf(level);
    const own = mapSolidsOf(level);
    const all = solidsOf(level);
    expect(all.length).toBeGreaterThan(own.length);
    for (let i = 0; i < own.length; i++) expect(all[i]).toBe(own[i]);
    expect(levelDigest(level)).toBe(digest);
    expect(firesOf(level)).toBe(fires);
  });

  it("is a post for every piece, each standing on the snow", () => {
    const list = drawnSolids(level);
    for (const s of list) {
      expect(Number.isFinite(s.x) && Number.isFinite(s.z) && Number.isFinite(s.y)).toBe(true);
      expect(s.radius).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
      expect(s.y).toBeLessThanOrEqual(level.groundAt(s.x, s.z));
      expect(s.y + s.height).toBeGreaterThanOrEqual(level.groundAt(s.x, s.z) + 0.1);
    }
  });

  it("walls every station's house, so nothing passes through its middle's edge", () => {
    const list = drawnSolids(level);
    for (const plan of liftPlans(level)) {
      for (const h of stationHouses(level, plan)) {
        // A point on the wall across the line's far side (along the line
        // for a gondola's hall, walked through): a post stands within a
        // body's half-width of it.
        const across = { x: plan.dz, z: -plan.dx };
        const x = h.x + across.x * h.halfWidth;
        const z = h.z + across.z * h.halfWidth;
        const near = Math.min(...list.map((s) => Math.hypot(s.x - x, s.z - z) - s.radius));
        expect(near, plan.lift.id).toBeLessThan(0.4);
      }
    }
  });

  it("stands every summit sign's post and keeps every hearth open", () => {
    const list = drawnSolids(level);
    for (const s of summitSigns(level)) {
      expect(list.some((p) => Math.hypot(p.x - s.x, p.z - s.z) < 1e-9)).toBe(true);
    }
    for (const f of firesOf(level)) {
      for (const s of list) {
        expect(Math.hypot(s.x - f.x, s.z - f.z)).toBeGreaterThan(0.3);
      }
    }
  });

  it("is nothing once no host draws", () => {
    const fresh = { ...level };
    setDrawnSolids(null);
    try {
      expect(solidsOf(fresh)).toBe(mapSolidsOf(fresh));
    } finally {
      setDrawnSolids(drawnSolids);
    }
  });
});

describe("what is drawn on the snow is met", () => {
  it("stops a skier sent at a station's hood, a corral, a sign, the course and the ski area's props", () => {
    const level = levelFor(38);
    for (const kind of [
      "station hood",
      "corral pole",
      "sign",
      "start hut",
      "finish arch",
      "finish mast",
      "net post",
      "props",
    ]) {
      expect(meets(level, kind), kind).toBe(true);
    }
  });
});
