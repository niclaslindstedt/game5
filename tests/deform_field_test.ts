// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The deformable snow round the player (`deform-field.ts`): a cut moves snow
// rather than marking it — compacted, thrown or heaped, never made — the
// walls fall to their repose, and the window re-uses its cells cleanly.

import { describe, expect, it } from "vitest";

import { createDeformField, PACKED, type DeformEjecta } from "../pwa/src/game/deform-field.ts";
import { SNOW } from "../pwa/src/game/snowpack.ts";
import type { Stamp } from "../pwa/src/game/trail-stamp.ts";

const LOOK = { cell: 0.04, half: 3, snap: 1 };
const still = { vx: 0, vy: 0, vz: 5, slide: 0 };
const line = (depth: number, half = 0.06): Stamp => ({
  ax: 0,
  az: -1,
  bx: 0,
  bz: 1,
  half,
  depth,
  berm: 0,
  wall: 0.25,
});

describe("the deformable snow", () => {
  it("cuts a ski's line to its depth", () => {
    const f = createDeformField(LOOK);
    f.follow(0, 0);
    f.press(line(0.12), still, SNOW.soft, 0, []);
    expect(f.heightAt(0, 0)).toBeCloseTo(-0.12, 3);
    expect(f.heightAt(0.5, 0)).toBeCloseTo(0, 6);
  });

  it("loses no snow: what is cut is compacted, thrown or heaped", () => {
    for (const snow of [SNOW.soft, SNOW.new, SNOW.groomed, SNOW.wet]) {
      const f = createDeformField(LOOK);
      f.follow(0, 0);
      const out: DeformEjecta[] = [];
      const cut = f.press(line(0.1), { ...still, slide: 3 }, snow, 0, out);
      const { dug, heaped } = f.volume();
      const thrown = out.reduce((s, e) => s + e.volume, 0);
      const compact = Math.max(0, Math.min(0.85, 1 - snow.density / PACKED));
      expect(dug).toBeCloseTo(cut, 6);
      expect(heaped).toBeCloseTo((cut - thrown) * (1 - compact), 4);
    }
  });

  it("throws most of what a sliding edge shaves, and little of a clean carve", () => {
    const f = createDeformField(LOOK);
    f.follow(0, 0);
    const skid: DeformEjecta[] = [];
    const carve: DeformEjecta[] = [];
    const a = f.press(line(0.02), { ...still, slide: 8 }, SNOW.groomed, 0, skid);
    f.clear();
    const b = f.press(line(0.02), still, SNOW.groomed, 0, carve);
    const share = (o: DeformEjecta[], v: number) => o.reduce((s, e) => s + e.volume, 0) / v;
    expect(share(skid, a)).toBeGreaterThan(0.8);
    expect(carve.length === 0 || share(carve, b) < 0.1).toBe(true);
    // Flung the way the edge slides: to its right.
    expect(skid[0].vx).toBeGreaterThan(0);
  });

  it("slumps a deep cut in loose snow, and holds a packed one", () => {
    const after = (wall: number) => {
      const f = createDeformField(LOOK);
      f.follow(0, 0);
      f.press({ ...line(0.5, 0.1), wall }, still, SNOW.soft, 0, []);
      f.relax(80);
      return { floor: f.heightAt(0, 0), wall: f.heightAt(0.16, 0) };
    };
    // Loose walls fall in: the trench widens and its floor fills.
    const loose = after(0);
    expect(loose.floor).toBeGreaterThan(-0.3);
    expect(loose.wall).toBeLessThan(-0.05);
    // A slab's walls stand where they were cut.
    const slab = after(1);
    expect(slab.floor).toBeLessThan(loose.floor - 0.05);
  });

  it("clears the cells a moved window takes over", () => {
    const f = createDeformField(LOOK);
    f.follow(0, 0);
    f.press(line(0.2), still, SNOW.soft, 0, []);
    f.follow(4, 0);
    expect(f.heightAt(0.0, 0)).toBe(0);
    f.follow(0, 0);
    // The window came back, but the cells were re-used meanwhile.
    expect(f.heightAt(0, 0)).toBe(0);
    expect(f.inside(0, 0)).toBe(true);
    expect(f.inside(9, 0)).toBe(false);
  });
});

describe("the field's half floats", () => {
  it("round-trips through three's own decoder", async () => {
    const { DataUtils } = await import("three");
    const { toHalf } = await import("../pwa/src/game/deform-field.ts");
    for (const v of [0, -0.12, 0.5, 1, 0.0371, -1.2, 0.85]) {
      expect(DataUtils.fromHalfFloat(toHalf(v))).toBeCloseTo(v, 3);
    }
  });
});
