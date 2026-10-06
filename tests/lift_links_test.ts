// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NEXT LIFT'S QUEUE OFF A TOP (R26, generator v7): where the gondola
// tops out a skate from the peak's chair, the chair's boarding ring lies
// AHEAD of a rider walked out of the cabin and to his side — forward and
// sideways, never back — on snow that carries him to it. Held over many
// maps and every kind of country, the way a player meets it: let go at the
// top, he turns once toward the ring and slides into the queue without
// climbing, falling or turning round. `analyzeResort` refuses a map that
// breaks it (`analysis/lift-queue.ts`); `mapgen/lift-chain.ts` lays it.
import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  angleDiff,
  boardingRing,
  chainedLifts,
  createGame,
  generateLevel,
  liftPlans,
  queueFault,
  step,
  type GeneratedLevel,
} from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

/** The maps: the shared corpus's first three, and a spread of regions —
 * seed 2's alpine mountain the one whose queue once lay behind the rider. */
const MAPS: readonly { name: string; level: () => GeneratedLevel }[] = [
  ...LEVEL_SEEDS.slice(0, 3).map((seed) => ({ name: `seed ${seed}`, level: () => levelFor(seed) })),
  { name: "seed 2", level: once(() => generateLevel(2)) },
  { name: "seed 2, maritime", level: once(() => generateLevel(2, { region: "maritime" })) },
  { name: "seed 3, fell", level: once(() => generateLevel(3, { region: "fell" })) },
  { name: "seed 4, continental", level: once(() => generateLevel(4, { region: "continental" })) },
];

/** `make` built the first time it is asked for, and handed back after. */
function once<T>(make: () => T): () => T {
  let made: T | undefined;
  return () => (made ??= make());
}

/** What a rider let go at `upper`'s top who skis for `lower`'s ring does:
 * whether he boards it, how far he climbs over the lowest he came down
 * to (m), the most he turns off the way he was let go facing (rad), and
 * whether he is ever thrown. */
function rideOver(level: GeneratedLevel, upper: string, lower: string) {
  const plans = liftPlans(level);
  const next = plans.find((p) => p.lift.id === lower)!;
  const ring = boardingRing(next);
  const run = level.resort!.runs.find((r) => r.from === upper)!;
  const game = createGame({ level, mode: "free", byLift: true, run: run.id, quiet: true });
  for (let i = 0; i < 120 * 90 && game.skier.lift; i++) step(game, NEUTRAL_INPUT);
  const h0 = game.skier.heading;
  let low = Infinity;
  let climbed = 0;
  let turned = 0;
  let thrown = false;
  let boarded: string | null = null;
  for (let i = 0; i < 120 * 60; i++) {
    const c = game.skier;
    if (c.lift) {
      boarded = c.lift.id;
      break;
    }
    low = Math.min(low, c.y);
    climbed = Math.max(climbed, c.y - low);
    turned = Math.max(turned, Math.abs(angleDiff(h0, c.heading)));
    const off = angleDiff(c.heading, Math.atan2(ring.x - c.x, ring.z - c.z));
    step(game, {
      ...NEUTRAL_INPUT,
      steer: Math.max(-1, Math.min(1, off * 2.2)),
      tuck: c.speed < 5 ? 1 : 0,
      brake: Math.max(0, Math.min(1, c.speed - 8)),
    });
    if (game.events.some((e) => e.kind === "wipeout" || e.kind === "reset")) thrown = true;
  }
  return { boarded, climbed, turned, thrown };
}

describe("the next lift's queue off a top", () => {
  for (const map of MAPS) {
    it(`lies ahead of a rider out of the gondola and to his side on ${map.name}`, () => {
      const level = map.level();
      const pairs = chainedLifts(level);
      expect(pairs.map((p) => `${p.upper.id}>${p.lower.lift.id}`)).toContain("G1>C1");
      for (const { upper, lower } of pairs) expect(queueFault(level, upper, lower)).toBeNull();
    });

    it(`is skied into off the gondola's top, forward and sideways, on ${map.name}`, () => {
      const r = rideOver(map.level(), "G1", "C1");
      expect(r.boarded).toBe("C1");
      expect(r.thrown).toBe(false);
      expect(r.climbed).toBeLessThan(0.5);
      // He turns toward the ring once, and never round to face back up.
      expect(r.turned).toBeLessThan(Math.PI / 2 + 0.25);
    });
  }
});
