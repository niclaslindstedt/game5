// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI AREA'S BUILDINGS AT TWO CUTS (`village-cuts.ts`): the blocks'
// near cuts are every triangle the village is built of, once; each far cut
// is the same block lighter, its lit panes all kept; a block takes its cut
// by its distance with a band either side, and the whole village is one
// draw from the mountain, a district a draw between — and the distant cars
// are lighter than the far.

import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { cabinsOf, resortBuildingsOf } from "@engine";
import { buildResortBuildings } from "../pwa/src/game/village-build.ts";
import {
  DISTANT_AREA,
  NEAR,
  blockDistance,
  createVillageBuildings,
  cutAt,
  districtsOf,
  villageBlocks,
} from "../pwa/src/game/village-cuts.ts";
import { createHazeUniforms } from "../pwa/src/game/haze.ts";
import { vehicleTriangles } from "../pwa/src/game/traffic-shapes.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const lit = (glow: number[]) => glow.filter((g) => g > 0).length;

describe("the ski area's buildings at two cuts", () => {
  const level = LEVEL_SEEDS.map(levelFor).find((l) => resortBuildingsOf(cabinsOf(l)).length > 6)!;
  const blocks = villageBlocks(level);

  it("lays every triangle of the village in exactly one block's near cut", () => {
    const whole = buildResortBuildings(level).out;
    const near = blocks.reduce((a, b) => a + b.near.pos.length, 0);
    expect(near).toBe(whole.pos.length);
    expect(blocks.reduce((a, b) => a + lit(b.near.glow), 0)).toBe(lit(whole.glow));
    expect(blocks.length).toBeGreaterThan(1);
  });

  it("cuts each block's far cut lighter, every lit pane kept", () => {
    let near = 0;
    let far = 0;
    for (const b of blocks) {
      expect(b.far.pos.length).toBeLessThanOrEqual(b.near.pos.length);
      expect(lit(b.far.glow)).toBe(lit(b.near.glow));
      near += b.near.pos.length;
      far += b.far.pos.length;
    }
    // The far cut is well under half the near.
    expect(far / near).toBeLessThan(0.5);
  });

  it("hands a block over at NEAR, holding its cut through the band", () => {
    expect(cutAt(NEAR - 1, -1)).toBe(0);
    expect(cutAt(NEAR + 1, -1)).toBe(1);
    expect(cutAt(NEAR + 5, 0)).toBe(0);
    expect(cutAt(NEAR - 5, 1)).toBe(1);
    expect(cutAt(NEAR + 100, 0)).toBe(1);
    expect(cutAt(NEAR - 100, 1)).toBe(0);
  });

  it("draws the whole village as one mesh from afar, blocks near it", () => {
    const view = createVillageBuildings(level, createHazeUniforms());
    const shown = () => view.group.children.filter((m) => m.visible).map((m) => m.name);
    const b = blocks[0];
    const far = new THREE.Vector3(b.max[0] + 5000, b.max[1], b.max[2]);
    view.update(far);
    expect(shown()).toEqual(["village-whole"]);
    const inside = new THREE.Vector3(
      (b.min[0] + b.max[0]) / 2,
      (b.min[1] + b.max[1]) / 2,
      (b.min[2] + b.max[2]) / 2,
    );
    expect(blockDistance(b, inside)).toBe(0);
    view.update(inside);
    const now = shown();
    expect(now).not.toContain("village-whole");
    expect(now).toContain("village-near");
    // Its district a block at a time, every other district one draw.
    const districts = districtsOf(blocks);
    const own = blocks.filter((o) => o.district === b.district).length;
    expect(now.length).toBe(own + districts.size - 1);
    view.dispose();
  });

  it("cuts each district's distant cut lighter still, every lit pane kept", () => {
    for (const d of districtsOf(blocks).values()) {
      expect(d.distant.pos.length).toBeLessThanOrEqual(d.far.pos.length);
      expect(lit(d.distant.glow)).toBe(lit(d.far.glow));
    }
    expect(DISTANT_AREA).toBeGreaterThan(0.3);
  });

  it("draws a distant car lighter than a far one", () => {
    for (const kind of ["hatch", "estate", "suv", "van", "bus"] as const) {
      expect(vehicleTriangles(kind, "distant"), kind).toBeLessThan(
        vehicleTriangles(kind, "far") * 0.75,
      );
    }
  });
});
