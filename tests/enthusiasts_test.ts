// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ENTHUSIASTS (`engine/game/enthusiasts.ts`): a free ride after dark has
// no crowd — only `ENTHUSIASTS.count` keen skiers, each a whole run on the
// player's own physics, dealt off a stream of their own, lapping the runs
// and the lifts — and each drawn in a kit dealt off his look
// (`outfit.ts`'s `dealtOutfit`).

import { describe, expect, it } from "vitest";
import { ENTHUSIASTS, NEUTRAL_INPUT, createGame, nightOver, step, withSky } from "@engine";

import { dealtOutfit } from "../pwa/src/game/outfit.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);
const night = { hour: 21 };
const day = { hour: 13 };

describe("the night's skiers", () => {
  it("a free ride after dark has no crowd and the enthusiasts instead", () => {
    expect(nightOver(withSky(level, night))).toBe(true);
    const s = createGame({ level, mode: "free", sky: night, quiet: true });
    expect(s.crowd).toBeUndefined();
    expect(s.rivals).toHaveLength(ENTHUSIASTS.count);
    for (const r of s.rivals) {
      expect(r.free).toBeDefined();
      // Their own run, never the player's machines or rides.
      expect(r.run).not.toBe(s);
      expect(r.run.skier).not.toBe(s.skier);
      expect(r.run.heli).toBeUndefined();
      expect(r.run.groomers).toBeUndefined();
    }
  });

  it("by day the crowd is out and nobody else", () => {
    expect(nightOver(withSky(level, day))).toBe(false);
    const s = createGame({ level, mode: "free", sky: day, quiet: true });
    expect(s.crowd?.amateurs.length ?? 0).toBeGreaterThan(0);
    expect(s.rivals).toHaveLength(0);
  });

  it("a crowd asked for is out whatever the hour, and no enthusiast with it", () => {
    const s = createGame({ level, mode: "free", sky: night, crowd: 20, quiet: true });
    expect(s.crowd?.amateurs.length).toBe(20);
    expect(s.rivals).toHaveLength(0);
  });

  it("no other mode deals them", () => {
    const s = createGame({ level, mode: "timeTrial", sky: night, quiet: true });
    expect(s.rivals.some((r) => r.free)).toBe(false);
  });

  it("deals them off a stream of their own: the run's stream is untouched", () => {
    const a = createGame({ level, mode: "free", sky: night, quiet: true });
    const b = createGame({ level, mode: "free", sky: night, enthusiasts: 0, quiet: true });
    expect(b.rivals).toHaveLength(0);
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it("deals the same skiers off the same seed, on pairs and builds of the catalog", () => {
    const a = createGame({ level, mode: "free", sky: night, quiet: true });
    const b = createGame({ level, mode: "free", sky: night, quiet: true });
    expect(a.rivals.map((r) => [r.free, r.run.skier.spec.id])).toEqual(
      b.rivals.map((r) => [r.free, r.run.skier.spec.id]),
    );
    for (const r of a.rivals) expect(ENTHUSIASTS.skis).toContain(r.run.skier.spec.id);
  });

  it("ski their runs: every one under way, none lost to a NaN", () => {
    const s = createGame({ level, mode: "free", sky: night, quiet: true });
    const from = s.rivals.map((r) => ({ x: r.run.skier.x, z: r.run.skier.z }));
    for (let i = 0; i < 120 * 45; i++) step(s, NEUTRAL_INPUT);
    s.rivals.forEach((r, i) => {
      const c = r.run.skier;
      expect(Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z)).toBe(true);
      const moved = Math.hypot(c.x - from[i].x, c.z - from[i].z);
      expect(moved > 100 || c.lift !== null).toBe(true);
    });
  });

  it("a run with them replays to the bit", () => {
    const ride = () => {
      const s = createGame({ level, mode: "free", sky: night, quiet: true });
      for (let i = 0; i < 120 * 10; i++) step(s, NEUTRAL_INPUT);
      return s.rivals.map((r) => [r.run.skier.x, r.run.skier.z, r.run.skier.speed]);
    };
    expect(ride()).toEqual(ride());
  });
});

describe("an enthusiast's kit", () => {
  it("is dealt off his look: the same look the same skier, at the build he skis", () => {
    expect(dealtOutfit(1234, "solid")).toEqual(dealtOutfit(1234, "solid"));
    expect(dealtOutfit(1234, "heavy").weight).toBe("heavy");
  });

  it("varies from look to look, and always carries poles", () => {
    const kits = Array.from({ length: 40 }, (_, i) => dealtOutfit(i * 7919 + 13, "medium"));
    expect(new Set(kits.map((k) => k.jacket)).size).toBeGreaterThan(2);
    expect(new Set(kits.map((k) => k.body)).size).toBe(2);
    expect(new Set(kits.map((k) => k.tone)).size).toBeGreaterThan(2);
    for (const k of kits) expect(k.poles).not.toBe("none");
  });
});
