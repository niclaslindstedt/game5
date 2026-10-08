// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START'S AND THE FINISH ARENA'S BUILDINGS (`docs/buildings.md`): the
// start hut (`race-build.ts`) standing on its spot and down into the snow,
// the start house's walls, billboard and ramp, and the finish arena's
// grandstands, leader's platform and video wall tower (`arena-build.ts`)
// — every attribute filled, low-poly, and each terrace's treads where its
// fans stand.

import { describe, expect, it } from "vitest";

import type { Level } from "@engine";
import {
  buildGrandstand,
  buildLeaderPlatform,
  buildVideoTower,
} from "../pwa/src/game/arena-build.ts";
import { FacadeKit, type FacadeArrays } from "../pwa/src/game/facade-kit.ts";
import { FACADE, FACADE_LAYERS } from "../pwa/src/game/facade-paint.ts";
import { buildStartHouse, buildStartHut, HUT, startHutSpot } from "../pwa/src/game/race-build.ts";
import { planSpectators } from "../pwa/src/game/spectator-plan.ts";
import { HOUSE } from "../pwa/src/game/start-house-plan.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

function filled(a: FacadeArrays): void {
  const n = a.pos.length / 3;
  expect(n).toBeGreaterThan(0);
  expect(a.nrm.length).toBe(n * 3);
  expect(a.col.length).toBe(n * 3);
  expect(a.uv.length).toBe(n * 2);
  expect(a.layer.length).toBe(n);
  expect(a.glow.length).toBe(n);
  expect(a.layer.every((l) => Number.isInteger(l) && l >= 0 && l < FACADE_LAYERS)).toBe(true);
  expect(a.pos.every(Number.isFinite)).toBe(true);
}

const level = levelFor(LEVEL_SEEDS[0]) as Level;

describe("the start hut", () => {
  const spot = startHutSpot(level, false)!;
  const kit = new FacadeKit();
  buildStartHut(kit, level, spot);

  it("stands off the start gate, none where a race's house stands", () => {
    expect(spot).not.toBeNull();
    expect(startHutSpot(level, true)).toBeNull();
  });

  it("is built whole, low-poly, its footing down into the snow", () => {
    filled(kit.out);
    expect(kit.triangles).toBeLessThan(400);
    let low = Infinity;
    for (let i = 1; i < kit.out.pos.length; i += 3) low = Math.min(low, kit.out.pos[i]);
    const c = Math.cos(spot.heading);
    const s = Math.sin(spot.heading);
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        const x = spot.x + a * (HUT.width / 2) * c + b * (HUT.depth / 2) * s;
        const z = spot.z - a * (HUT.width / 2) * s + b * (HUT.depth / 2) * c;
        expect(low).toBeLessThan(level.groundAt(x, z));
      }
  });

  it("lights its windows after dark", () => {
    expect(kit.out.glow.some((g) => g > 0)).toBe(true);
  });
});

describe("the start house", () => {
  // On a slope falling 30 % down the course.
  const kit = new FacadeKit();
  buildStartHouse(kit, (_x, z) => -0.3 * z, HOUSE.height + 1, HOUSE.front.height + 0.5);

  it("is built whole and low-poly, its walls in timber and its front panelled", () => {
    filled(kit.out);
    expect(kit.triangles).toBeLessThan(900);
    expect(kit.out.layer).toContain(FACADE.boards);
    expect(kit.out.layer).toContain(FACADE.panel);
    expect(kit.out.layer).toContain(FACADE.steel);
  });

  it("keeps out of the doorway the racer stands in", () => {
    const door = HOUSE.door.width / 2 - 0.13;
    const { pos } = kit.out;
    for (let i = 0; i < pos.length; i += 9) {
      // A triangle wholly in the door's opening, under its lintel and
      // between the billboard and the house's back, would stand in him.
      const xs = [pos[i], pos[i + 3], pos[i + 6]];
      const ys = [pos[i + 1], pos[i + 4], pos[i + 7]];
      const zs = [pos[i + 2], pos[i + 5], pos[i + 8]];
      const inside =
        xs.every((x) => Math.abs(x) < door) &&
        ys.every((y) => y > 0.5 && y < HOUSE.door.height - 0.1) &&
        zs.every((z) => z < -0.2 && z > -HOUSE.depth + 0.2);
      expect(inside).toBe(false);
    }
  });
});

describe("the finish arena's structures", () => {
  const plan = planSpectators(level);

  it("stands every terrace's treads where its fans stand", () => {
    expect(plan.stands.length).toBeGreaterThan(0);
    for (const s of plan.stands) {
      const kit = new FacadeKit();
      buildGrandstand(kit, level, s);
      filled(kit.out);
      expect(kit.triangles / s.width).toBeLessThan(80);
      // A tread's top at every row's height, under the fans' feet.
      const { pos, nrm, layer } = kit.out;
      for (let r = 0; r < s.rows; r++) {
        const y = s.y + r * s.rise;
        let found = false;
        for (let i = 0; i < pos.length / 3 && !found; i++)
          found =
            layer[i] === FACADE.boards &&
            nrm[i * 3 + 1] > 0.99 &&
            Math.abs(pos[i * 3 + 1] - y) < 1e-4;
        expect(found, `row ${r}`).toBe(true);
      }
    }
  });

  it("builds the leader's platform and the video wall's tower low-poly", () => {
    const a = plan.arena!;
    expect(a).not.toBeNull();
    const kit = new FacadeKit();
    buildLeaderPlatform(kit, level, a, a.y + 0.1);
    buildVideoTower(kit, level, a.screen);
    filled(kit.out);
    expect(kit.triangles).toBeLessThan(2000);
  });
});
