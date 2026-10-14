// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The deformable snow round the player (`deform-field.ts`): a press moves
// snow rather than marking it — compacted or heaped, never made or thrown —
// a take digs out exactly the snow the spray threw (`snow-takes.ts`, the one
// snow budget), the walls fall to their repose along a ragged line, and the
// window re-uses its cells cleanly.

import { describe, expect, it } from "vitest";

import { createGame, pairById, placeRun, step, TUNING } from "@engine";

import { cellHash, createDeformField, PACKED } from "../pwa/src/game/deform-field.ts";
import { deformLook } from "../pwa/src/game/deform-snow.ts";
import { holdInput } from "../pwa/src/game/hold-input.ts";
import { SNOW, type SnowKind } from "../pwa/src/game/snowpack.ts";
import { createMassPool } from "../pwa/src/game/spray-mass-pool.ts";
import { drainTakes, recordTakes, type SnowTake } from "../pwa/src/game/snow-takes.ts";
import type { Stamp } from "../pwa/src/game/trail-stamp.ts";
import { flatLevel } from "./support/synthetic.ts";

const LOOK = { cell: 0.04, half: 3, snap: 1 };
const still = { slide: 0 };
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
const take = (over: Partial<SnowTake>): SnowTake => ({
  ax: 0,
  az: -0.8,
  bx: 0,
  bz: 0.8,
  half: 0.05,
  ring: false,
  dirX: 1,
  dirZ: 0,
  kg: 1,
  dug: 1 / 400,
  bermKg: 0,
  berm: 0,
  ...over,
});

describe("the deformable snow", () => {
  it("cuts a ski's line to its depth", () => {
    const f = createDeformField(LOOK);
    f.follow(0, 0);
    f.press(line(0.12), still, SNOW.soft);
    expect(f.heightAt(0, 0)).toBeCloseTo(-0.12, 3);
    expect(f.heightAt(0.5, 0)).toBeCloseTo(0, 6);
  });

  it("loses no snow and throws none: what a press cuts is compacted or heaped", () => {
    for (const snow of [SNOW.soft, SNOW.new, SNOW.groomed, SNOW.wet]) {
      const f = createDeformField(LOOK);
      f.follow(0, 0);
      const cut = f.press(line(0.1), { slide: 3 }, snow);
      const { dug, heaped } = f.volume();
      const compact = Math.max(0, Math.min(0.85, 1 - snow.density / PACKED));
      expect(dug).toBeCloseTo(cut, 6);
      expect(heaped).toBeCloseTo(cut * (1 - compact), 4);
      expect(f.thrown()).toBe(0);
    }
  });

  it("digs a take's volume out and heaps its berm ahead of the edge", () => {
    const f = createDeformField(LOOK);
    f.follow(0, 0);
    const kg = f.take(take({ kg: 2, dug: 2 / 400, bermKg: 1, berm: 1 / 400 }));
    // (The field holds heights as 32-bit floats.)
    expect(kg).toBeCloseTo(2, 5);
    expect(f.thrown()).toBeCloseTo(kg, 9);
    const { dug, heaped } = f.volume();
    expect(dug).toBeCloseTo(3 / 400, 6);
    expect(heaped).toBeCloseTo(1 / 400, 6);
    // The berm lies ahead: the side the edge slid toward (+x).
    let ahead = 0;
    let behind = 0;
    for (let x = 0.06; x < 0.2; x += 0.04) {
      ahead += f.heightAt(x, 0);
      behind += f.heightAt(-x, 0);
    }
    expect(ahead).toBeGreaterThan(5 * Math.max(0, behind));
  });

  it("counts only the share of a take it could dig inside its window", () => {
    const f = createDeformField(LOOK);
    f.follow(0, 0);
    const kg = f.take(take({ ax: 2.9, az: 0, bx: 4.5, bz: 0 }));
    expect(kg).toBeGreaterThan(0);
    expect(kg).toBeLessThan(0.3);
    expect(f.thrown()).toBeCloseTo(kg, 9);
  });

  it("slumps a deep cut in loose snow, and holds a packed one", () => {
    const after = (wall: number) => {
      const f = createDeformField(LOOK);
      f.follow(0, 0);
      f.press({ ...line(0.5, 0.1), wall }, still, SNOW.soft);
      f.relax(80);
      return { floor: f.heightAt(0, 0), wall: f.heightAt(0.16, 0) };
    };
    const loose = after(0);
    expect(loose.floor).toBeGreaterThan(-0.3);
    expect(loose.wall).toBeLessThan(-0.05);
    const slab = after(1);
    expect(slab.floor).toBeLessThan(loose.floor - 0.05);
  });

  it("breaks a crater's rim along a ragged line, not the grid's straight steps", () => {
    const f = createDeformField(LOOK);
    f.follow(0, 0);
    const body: Stamp = { ax: 0, az: 0, bx: 0, bz: 0, half: 0.5, depth: 0.4, berm: 0, wall: 0.2 };
    f.press(body, { slide: 0, body: true }, SNOW.new);
    f.relax(40);
    // The rim's radius, read on many bearings: it wanders by more than a cell.
    const radii: number[] = [];
    for (let a = 0; a < 64; a++) {
      const ang = (a / 64) * Math.PI * 2;
      let r = 0;
      while (r < 1.2 && f.heightAt(Math.cos(ang) * r, Math.sin(ang) * r) < -0.1) r += 0.01;
      radii.push(r);
    }
    const spread = Math.max(...radii) - Math.min(...radii);
    expect(spread).toBeGreaterThan(2 * LOOK.cell);
    expect(cellHash(3, 4)).toBe(cellHash(3, 4));
  });

  it("clears the cells a moved window takes over", () => {
    const f = createDeformField(LOOK);
    f.follow(0, 0);
    f.press(line(0.2), still, SNOW.soft);
    f.follow(4, 0);
    expect(f.heightAt(0.0, 0)).toBe(0);
    f.follow(0, 0);
    expect(f.heightAt(0, 0)).toBe(0);
    expect(f.inside(0, 0)).toBe(true);
    expect(f.inside(9, 0)).toBe(false);
  });
});

describe("the TRAILS row's field", () => {
  it("is none at OFF and LOW, and lies on level 0's grid at every TERRAIN stop", () => {
    for (const spacing of [0.4, 0.3, 0.25]) {
      expect(deformLook("off", spacing)).toBeNull();
      expect(deformLook("low", spacing)).toBeNull();
      for (const trails of ["medium", "high"] as const) {
        const look = deformLook(trails, spacing)!;
        const step = 2 * spacing;
        expect(Math.abs(look.half / step - Math.round(look.half / step))).toBeLessThan(1e-9);
        expect(look.snap).toBeCloseTo(step, 9);
        expect(Math.abs(step / look.cell - Math.round(step / look.cell))).toBeLessThan(1e-9);
      }
      expect(deformLook("high", spacing)!.half).toBeGreaterThan(
        deformLook("medium", spacing)!.half,
      );
      expect(deformLook("high", spacing)!.march).toBeGreaterThan(
        deformLook("medium", spacing)!.march,
      );
    }
  });
});

describe("one snow budget", () => {
  /** A stop on `kind` snow with the spray weighed and its takes dug into a
   * field round him: the kilograms the spray threw and the field dug. */
  function budget(kind: SnowKind) {
    const packed = ["groomed", "hard", "ice"].includes(kind) ? 1 : 0;
    const level = flatLevel({ packed });
    const state = createGame({
      level,
      spec: pairById("chamois"),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 40 / 3.6 });
    const pool = createMassPool(30000);
    const field = createDeformField({ cell: 0.05, half: 6, snap: 0.5 });
    let thrown = 0;
    const t0 = state.t;
    for (let i = 0; i < 2.4 * TUNING.physicsHz; i++) {
      step(state, holdInput(state, 40, 0, "stop", state.t - t0));
      if (i % 2) continue;
      field.follow(state.skier.x, state.skier.z);
      recordTakes(state.skier);
      pool.emit(state.skier, level, 1 / 60, 0, SNOW[kind]);
      drainTakes((takes, n) => {
        for (let k = 0; k < n; k++) field.take(takes[k]);
      });
      recordTakes(null);
      pool.step(1 / 60, level);
      thrown += pool.weighed().taken;
      field.relax();
    }
    return { thrown, dug: field.thrown() };
  }

  it("the field digs out what the spray threw, to the per cent", () => {
    for (const kind of ["groomed", "soft", "new"] as const) {
      const { thrown, dug } = budget(kind);
      expect(thrown).toBeGreaterThan(0.05);
      expect(Math.abs(dug - thrown) / thrown).toBeLessThan(0.01);
    }
  });
});
