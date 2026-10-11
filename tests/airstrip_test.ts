// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S STRIP (`engine/game/airstrip.ts`): a rectangle of flat
// snow on the valley floor by the town, found once a map — inside the map,
// clear of the streets, the trees and every other machine's place, with no
// lip along it — on generated mountains and on a real mountainside.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  PLANE,
  STRIP_LENGTH,
  STRIP_SITE,
  airstripOf,
  balloonSiteOf,
  createGame,
  generateLevel,
  helipadOf,
  liftPlans,
  loadRealFace,
  onStrip,
  planeBoxes,
  sledSpotOf,
  standSkier,
  step,
  streetMaskAt,
  stripBoxes,
  stripFrame,
  stripSiteOf,
  villageBuildingsOf,
  villageOf,
  type GameEvent,
  type GameState,
  type Level,
} from "@engine";

import { levelFor } from "./support/levels.ts";

describe("the airstrip", () => {
  const seeds = [1, 38];

  /** Every check the strip is held to on `level`. */
  function holds(level: Level): void {
    const strip = airstripOf(level);
    expect(airstripOf(level)).toBe(strip);
    expect(strip.length).toBe(STRIP_LENGTH);
    const fx = Math.sin(strip.heading);
    const fz = Math.cos(strip.heading);
    const half = strip.length / 2;
    // Inside the map, all of it.
    for (const s of [-half, half]) {
      for (const w of [-strip.width / 2, strip.width / 2]) {
        const x = strip.x + fx * s + fz * w;
        const z = strip.z + fz * s - fx * w;
        expect(x).toBeGreaterThan(0);
        expect(z).toBeGreaterThan(0);
        expect(x).toBeLessThan(level.size);
        expect(z).toBeLessThan(level.size);
      }
    }
    // On the valley floor, no higher than the town it lies by.
    const village = villageOf(level);
    if (village) {
      const homeY = level.groundAt(village.centre.x, village.centre.z);
      expect(strip.y).toBeLessThan(homeY + 15);
    }
    // Clear of the town's streets, the trees and every other machine's place.
    const keep = [helipadOf(level), sledSpotOf(level), balloonSiteOf(level)];
    const inner = half - 0.01;
    const side = strip.width / 2 - 0.01;
    for (let s = -inner; s <= inner; s += 10) {
      for (const w of [-side, 0, side]) {
        const x = strip.x + fx * s + fz * w;
        const z = strip.z + fz * s - fx * w;
        expect(onStrip(level, x, z)).toBe(true);
        expect(streetMaskAt(level, x, z)).toBe(0);
        for (const k of keep) expect(Math.hypot(k.x - x, k.z - z)).toBeGreaterThan(10);
      }
    }
    for (const t of level.trees) {
      const dx = t.x - strip.x;
      const dz = t.z - strip.z;
      const along = dx * fx + dz * fz;
      const across = dx * fz - dz * fx;
      expect(Math.abs(along) <= half && Math.abs(across) <= strip.width / 2).toBe(false);
    }
    // Smooth enough to roll on: no lip along its centre line.
    if (!strip.fallback) {
      let last = level.groundAt(strip.x - fx * half, strip.z - fz * half);
      const mean = (level.groundAt(strip.x + fx * half, strip.z + fz * half) - last) / strip.length;
      for (let s = -half + 5; s <= half; s += 5) {
        const h = level.groundAt(strip.x + fx * s, strip.z + fz * s);
        expect(Math.abs((h - last) / 5 - mean)).toBeLessThan(PLANE.strip.step * 1.5 + 1e-6);
        last = h;
      }
    }
  }

  /** Every check the strip's site is held to on `level`. */
  function siteHolds(level: Level): void {
    const site = stripSiteOf(level);
    const strip = site.strip;
    expect(stripSiteOf(level)).toBe(site);
    const half = strip.length / 2;
    // THE MARKERS: both edges, never further apart than the rule, just
    // outside the packed edge; a row across each end.
    for (const sign of [-1, 1]) {
      const edge = site.markers
        .filter((m) => m.kind === "board" && Math.sign(stripFrame(strip, m.x, m.z).across) === sign)
        .map((m) => stripFrame(strip, m.x, m.z));
      expect(edge.length).toBeGreaterThan(strip.length / 100);
      edge.sort((a, b) => a.along - b.along);
      expect(edge[0].along).toBeLessThanOrEqual(-half + 1);
      expect(edge[edge.length - 1].along).toBeGreaterThanOrEqual(half - 1);
      for (let i = 1; i < edge.length; i++) {
        expect(edge[i].along - edge[i - 1].along).toBeLessThanOrEqual(100);
      }
      for (const m of edge) {
        expect(Math.abs(m.across)).toBeGreaterThan(strip.width / 2);
        expect(Math.abs(m.across)).toBeLessThan(strip.width / 2 + 3);
      }
    }
    const ends = site.markers.filter((m) => m.kind === "threshold");
    expect(ends.length).toBe(2 * STRIP_SITE.markers.across);
    // THE BUILDINGS: a hangar (or the lean-to) with a door wider than the
    // wing, beside the runway and never in its approach, outside its
    // clearance, inside the map and clear of every other place.
    const hangar = site.buildings.find((b) => b.kind === "hangar" || b.kind === "leanTo");
    expect(hangar).toBeDefined();
    const door = hangar!.kind === "hangar" ? STRIP_SITE.hangar.door : STRIP_SITE.leanTo.door;
    expect(door.width).toBeGreaterThanOrEqual(17);
    expect(door.width).toBeGreaterThan(PLANE.wing.span);
    expect(door.height).toBeGreaterThanOrEqual(4);
    const houses = villageBuildingsOf(level);
    const keep = [helipadOf(level), sledSpotOf(level), balloonSiteOf(level)];
    for (const b of site.buildings) {
      const f = stripFrame(strip, b.x, b.z);
      const reach = Math.hypot(b.width, b.depth) / 2;
      expect(Math.abs(f.along) + b.width / 2).toBeLessThanOrEqual(half + 0.01);
      expect(Math.abs(f.across) - b.depth / 2).toBeGreaterThanOrEqual(
        strip.width / 2 + PLANE.wing.span / 2,
      );
      expect(b.x - reach).toBeGreaterThan(0);
      expect(b.z - reach).toBeGreaterThan(0);
      expect(b.x + reach).toBeLessThan(level.size);
      expect(b.z + reach).toBeLessThan(level.size);
      expect(streetMaskAt(level, b.x, b.z)).toBe(0);
      for (const k of keep) expect(Math.hypot(k.x - b.x, k.z - b.z)).toBeGreaterThan(reach + 10);
      for (const h of houses) expect(Math.hypot(h.x - b.x, h.z - b.z)).toBeGreaterThan(reach);
      for (const t of level.trees) expect(Math.hypot(t.x - b.x, t.z - b.z)).toBeGreaterThan(reach);
      for (const p of liftPlans(level)) {
        const rx = b.x - p.lift.bottom.x;
        const rz = b.z - p.lift.bottom.z;
        const u = rx * p.dx + rz * p.dz;
        const v = rx * p.dz - rz * p.dx;
        expect(u > -reach && u < p.length + reach && Math.abs(v) < reach + 5).toBe(false);
      }
      for (const o of site.buildings) {
        if (o === b) continue;
        expect(Math.hypot(o.x - b.x, o.z - b.z)).toBeGreaterThan(reach);
      }
    }
    // THE SOCK off the packed runway.
    expect(onStrip(level, site.sock.x, site.sock.z)).toBe(false);
  }

  for (const seed of seeds) {
    it(`lies flat by the town, inside the map and clear of everything — seed ${seed}`, () => {
      holds(levelFor(seed));
    });
    it(`has its markers, hangar, fuel shed, hut and windsock laid out — seed ${seed}`, () => {
      siteHolds(levelFor(seed));
    });
  }

  it("is found on a real mountainside too", async () => {
    await loadRealFace("alpine-1");
    const level = generateLevel(1, { face: "alpine-1" });
    holds(level);
    siteHolds(level);
  });
});

describe("what stands at the airstrip, as solids", () => {
  const level = levelFor(38);

  /** A skier stood `back` m off a box's face and sent at it at `speed`. */
  function skiInto(
    s: GameState,
    box: { x: number; z: number; dx: number; dz: number; halfWidth: number },
    back: number,
    speed: number,
  ): { events: GameEvent[]; passed: boolean } {
    // Straight at the box's side across its long axis.
    const nx = box.dz;
    const nz = -box.dx;
    const sx = box.x + nx * (box.halfWidth + back);
    const sz = box.z + nz * (box.halfWidth + back);
    standSkier(s, sx, sz, Math.atan2(-nx, -nz));
    s.skier.vx = -nx * speed;
    s.skier.vz = -nz * speed;
    const events: GameEvent[] = [];
    let passed = false;
    for (let i = 0; i < 240; i++) {
      step(s, NEUTRAL_INPUT);
      events.push(...s.events);
      const c = s.skier;
      const across = (c.x - box.x) * nx + (c.z - box.z) * nz;
      if (across < box.halfWidth - 1) passed = true;
    }
    return { events, passed };
  }

  it("holds a skier out of the hangar, and a run into it at speed is a blow", () => {
    const s = createGame({ level, mode: "free", crowd: 0, quiet: true });
    const hangar = stripBoxes(level)[0];
    const fast = skiInto(s, hangar, 4, 12);
    expect(fast.passed).toBe(false);
    expect(fast.events.some((e) => e.kind === "hit" && e.speed > 5)).toBe(true);
    expect(s.skier.thrown).not.toBeNull();
  });

  it("holds a skier off the parked plane at a crawl, and throws him met hard", () => {
    const slow = createGame({ level, mode: "free", plane: true, crowd: 0, quiet: true });
    slow.plane!.rider = false;
    const body = planeBoxes(slow.plane!, [])[0];
    const crawl = skiInto(slow, body, 1.5, 1.2);
    expect(crawl.passed).toBe(false);
    expect(slow.skier.thrown).toBeNull();
    const hard = createGame({ level, mode: "free", plane: true, crowd: 0, quiet: true });
    hard.plane!.rider = false;
    const met = skiInto(hard, planeBoxes(hard.plane!, [])[0], 4, 12);
    expect(met.passed).toBe(false);
    expect(met.events.some((e) => e.kind === "hit" && e.post)).toBe(true);
    expect(hard.skier.thrown).not.toBeNull();
  });

  it("is no solid on a race", () => {
    const s = createGame({ level, quiet: true });
    expect(s.rules.heli).toBe(false);
    s.phase = "racing";
    const hangar = stripBoxes(level)[0];
    const run = skiInto(s, hangar, 4, 8);
    expect(run.events.some((e) => e.kind === "hit" && e.post)).toBe(false);
    expect(run.passed).toBe(true);
  });
});
