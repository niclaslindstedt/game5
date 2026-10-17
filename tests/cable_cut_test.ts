// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CUT BY A LIFT'S ROPE (`engine/game/cable-cut.ts`, `ski-cut.ts`): on a run
// that carries its injuries, a rope met faster than `CABLE.cut.speed` goes
// through the body like a wire — every bone it crosses cut there, the skis
// cut in two where it crosses them, and all of it carried on at the speed
// it was going. Slower, or with the injuries off, nothing is cut.

import { describe, expect, it } from "vitest";

import {
  CABLE,
  NEUTRAL_INPUT,
  createGame,
  liftPlans,
  ropeOver,
  standSkier,
  step,
  type GameEvent,
  type GameState,
} from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);
const chair = liftPlans(level).find((p) => p.lift.kind === "chair")!;

/** A free ride flying square across the chair's down rope half way up its
 * line at `speed` m/s, his feet `feet` m off the rope (negative under it) —
 * or, with `fall`, dropping onto it from above at `fall` m/s, skis across it. */
function shot(o: { speed?: number; feet?: number; fall?: number; gore?: boolean }): {
  run: GameState;
  events: GameEvent[];
} {
  const run = createGame({
    level,
    mode: "free",
    quiet: true,
    ...(o.gore === false ? {} : { gore: true }),
  });
  const p = ropeOver(chair, 1, chair.length * 0.5);
  const hx = chair.dz;
  const hz = -chair.dx;
  const back = o.fall ? 0 : 0.6;
  standSkier(run, p.x + hx * back, p.z + hz * back, Math.atan2(-hx, -hz));
  const c = run.skier;
  c.y = p.y + c.spec.cogHeight + (o.fall ? 0.6 : (o.feet ?? 0));
  const speed = o.fall ? 3 : (o.speed ?? 0);
  c.vx = -hx * speed;
  c.vz = -hz * speed;
  c.vy = -(o.fall ?? 0);
  c.airborne = true;
  const events: GameEvent[] = [];
  for (let i = 0; i < 30; i++) {
    step(run, NEUTRAL_INPUT);
    events.push(...run.events);
  }
  return { run, events };
}

const torn = (events: GameEvent[]): string[] =>
  events.flatMap((e) => (e.kind === "gore" && e.what === "torn" && e.piece ? [e.piece] : []));

describe("cut by a lift's rope (cable-cut.ts)", () => {
  it("cuts the body where the rope crosses it, at any height", () => {
    expect(torn(shot({ speed: 25, feet: -0.2 }).events).sort()).toEqual(["shinL", "shinR"]);
    expect(torn(shot({ speed: 25, feet: -0.5 }).events)).toEqual(
      expect.arrayContaining(["legL", "legR"]),
    );
    expect(torn(shot({ speed: 25, feet: -1.3 }).events)).toEqual(expect.arrayContaining(["lower"]));
    expect(torn(shot({ speed: 25, feet: -1.55 }).events)).toContain("head");
  });

  it("does not stop him: what is left goes on at the speed he met it", () => {
    const { run, events } = shot({ speed: 25, feet: -1.3 });
    const wipe = events.find((e) => e.kind === "wipeout");
    expect(wipe && wipe.kind === "wipeout" ? wipe.cause : null).toBe("wire");
    const b = run.skier.thrown!;
    expect(Math.hypot(b.vx, b.vz)).toBeGreaterThan(20);
  });

  it("cuts the skis in two where it crosses them", () => {
    const { run } = shot({ fall: 25 });
    const b = run.skier.thrown!;
    expect(b.halves?.length).toBe(2);
    for (const ski of b.skis) {
      // The binding's piece and its share of the whole ski.
      expect(ski.part).toBeDefined();
      const [lo, hi] = ski.part!;
      expect(hi - lo).toBeGreaterThan(0.05);
      expect(hi - lo).toBeLessThan(0.95);
    }
    // The two pieces of a ski make the whole of it.
    const all = [...b.skis, ...b.halves!].filter((s) => s.side === -1);
    expect(all.reduce((n, s) => n + (s.part![1] - s.part![0]), 0)).toBeCloseTo(1, 6);
  });

  it("cuts nothing met slower than its speed", () => {
    expect(CABLE.cut.speed).toBeGreaterThan(15);
    const { run, events } = shot({ speed: 15, feet: -1.3 });
    expect(torn(events)).toEqual([]);
    expect(run.skier.thrown?.halves ?? []).toEqual([]);
  });

  it("cuts nothing with the injuries off", () => {
    const { run, events } = shot({ speed: 25, feet: -1.3, gore: false });
    expect(torn(events)).toEqual([]);
    expect(events.some((e) => e.kind === "wipeout")).toBe(false);
    expect(run.skier.thrown).toBe(null);
  });

  it("is a pure function of the run: the same cut twice", () => {
    const a = shot({ fall: 25 }).run.skier.thrown!;
    const b = shot({ fall: 25 }).run.skier.thrown!;
    expect(a.points).toEqual(b.points);
    expect(a.halves).toEqual(b.halves);
  });
});
