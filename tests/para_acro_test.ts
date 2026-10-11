// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR'S ACRO (`engine/game/para-acro.ts`, its numbers
// `PARA.acro`): the lean forward pitches the wing into a DIVE, the lean
// back at a dive's speed bends the pair's path up and — held from a big
// enough dive — round in a LOOP; without the speed for it the lines go
// slack at the top and he FALLS INTO THE WING, tangled, until he cuts it
// away or meets the snow. Flown on the long synthetic face (`flatLevel`).

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  createGame,
  step,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";

import { takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { flatLevel } from "./support/synthetic.ts";

const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...NEUTRAL_INPUT, ...o });

/** A paramotor ride on a long face, flown up on the throttle for `climb` s. */
function aloft(climb = 40): GameState {
  const level = flatLevel({
    grade: 0.3,
    slopeFrom: 120,
    runOut: { at: 3000, bend: 300 },
    packed: 1,
  });
  const s = createGame({ level, mode: "free", para: true, crowd: 0, quiet: true });
  fly(s, climb, ask({ tuck: 1 }));
  return s;
}

/** Step `s` for `seconds` on `input`, every event kept and the most of
 * `read` over the steps taken. */
function fly(
  s: GameState,
  seconds: number,
  input: SkierInput,
  out: GameEvent[] = [],
  read?: (s: GameState) => number,
): number {
  let most = -Infinity;
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    step(s, input);
    out.push(...s.events);
    if (read) most = Math.max(most, read(s));
  }
  return most;
}

const phases = (events: GameEvent[]): string[] =>
  events.flatMap((e) => (e.kind === "para" ? [e.phase] : []));

describe("the paramotor's acro (para-acro.ts)", () => {
  it("dives on the lean forward: steep, fast and still open", () => {
    const s = aloft();
    const events: GameEvent[] = [];
    fly(s, 4, ask({ lean: -1 }), events);
    const p = s.para!;
    expect(p.mode).toBe("flown");
    expect(-s.skier.vy).toBeGreaterThan(18);
    expect(p.airspeed * 3.6).toBeGreaterThan(85);
    expect(p.fold).toBe(0);
    expect(phases(events)).not.toContain("tangle");
  });

  it("only climbs on the lean back from a cruise, never falling into the wing", () => {
    const s = aloft();
    const events: GameEvent[] = [];
    fly(s, 8, ask({ lean: 1 }), events);
    expect(s.para!.mode).toBe("flown");
    expect(phases(events)).not.toContain("tangle");
    expect(s.para!.loops).toBe(0);
  });

  it("swings up and round in a loop off a big dive, and flies on once let go", () => {
    const s = aloft();
    const events: GameEvent[] = [];
    fly(s, 5, ask({ lean: -1 }), events);
    const g = fly(s, 3, ask({ lean: 1 }), events, (st) => st.para!.g);
    fly(s, 6, ask(), events);
    const seen = phases(events);
    expect(seen).toContain("loop");
    expect(seen).not.toContain("tangle");
    expect(s.para!.loops).toBe(1);
    expect(s.para!.mode).toBe("flown");
    // A tumble's load: hard, not a fighter's.
    expect(g).toBeGreaterThan(5);
    expect(g).toBeLessThan(12);
  });

  it("falls into the wing pulling up without the speed to go over", () => {
    const s = aloft();
    const events: GameEvent[] = [];
    fly(s, 2, ask({ lean: -1 }), events);
    fly(s, 4, ask({ lean: 1 }), events);
    expect(phases(events)).toContain("tangle");
    expect(s.para!.mode).toBe("tangled");
    expect(s.para!.loops).toBe(0);
    // The HUD reads it.
    expect(takeSnapshot(s).para?.kind).toBe("tangled");
  });

  it("cuts the tangled wing away on the machine press", () => {
    const s = aloft();
    const events: GameEvent[] = [];
    fly(s, 2, ask({ lean: -1 }), events);
    fly(s, 4, ask({ lean: 1 }), events);
    expect(s.para!.mode).toBe("tangled");
    fly(s, 1 / 120, ask({ machine: true }), events);
    expect(s.para!.mode).toBe("dropped");
    expect(phases(events)).toContain("drop");
  });

  it("falls tangled until the snow stops him", () => {
    const s = aloft();
    const events: GameEvent[] = [];
    fly(s, 2, ask({ lean: -1 }), events);
    fly(s, 4, ask({ lean: 1 }), events);
    expect(s.para!.mode).toBe("tangled");
    // He falls fast in the bundle.
    const sink = fly(s, 2, ask(), events, (st) => -st.skier.vy);
    expect(sink).toBeGreaterThan(12);
    fly(s, 20, ask(), events);
    expect(phases(events)).toContain("collapse");
    expect(events.some((e) => e.kind === "wipeout")).toBe(true);
  });

  it("is deterministic through a loop", () => {
    const run = () => {
      const s = aloft();
      fly(s, 5, ask({ lean: -1 }));
      fly(s, 3, ask({ lean: 1 }));
      return [s.skier.x, s.skier.y, s.skier.z, s.para!.x, s.para!.y, s.para!.z];
    };
    expect(run()).toEqual(run());
  });
});
