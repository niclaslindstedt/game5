// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT (`engine/game/wingsuit.ts`, its numbers `defs/wingsuit.ts`,
// the start `wingsuit-start.ts`, the bot `wingsuit-pilot.ts`, over the
// skydive's BASE canopy in `chute.ts`): the glide, the dive and the flare
// held to the class's bands, the exit off a generated mountain, the pull
// with no reserve, the landing on his boots with no skis, the snow met in
// flight thrown and begun again, and the bot's whole flight. On the
// synthetic flat map (`flatLevel`) and a generated mountain (`levelFor`).

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  PLANE,
  TUNING,
  WINGSUIT,
  createGame,
  planeAloft,
  skydiveAt,
  step,
  wingsuitExitOf,
  wingsuitInput,
  wingsuitOut,
  type GameState,
  type Level,
  type SkierInput,
} from "@engine";

import { levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const dt = TUNING.dt;
const SIZE = 8000;
const N = NEUTRAL_INPUT;
const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...N, ...o });
const steps = (s: number): number => Math.round(s / dt);

const game = (level: Level = flatLevel({ size: SIZE }), plane = true): GameState =>
  createGame({ level, mode: "free", plane, wingsuit: true, crowd: 0, quiet: true });

/** A flyer stood `agl` m over the flat map in the suit (its glide). */
function suit(agl: number, at: Partial<Parameters<typeof skydiveAt>[1]> = {}): GameState {
  const s = game();
  skydiveAt(s, { x: SIZE / 2, z: 1500, agl, suit: "wingsuit", ...at });
  return s;
}

const run = (
  s: GameState,
  seconds: number,
  input: SkierInput | ((s: GameState) => SkierInput),
): void => {
  for (let i = 0; i < steps(seconds); i++) step(s, typeof input === "function" ? input(s) : input);
};

describe("the wingsuit in the air", () => {
  it("glides hands off inside a large suit's band", () => {
    const s = suit(2500);
    run(s, 15, N);
    const c = s.skier;
    const [x0, y0, z0] = [c.x, c.y, c.z];
    run(s, 20, N);
    const across = Math.hypot(c.x - x0, c.z - z0) / 20;
    const sink = (y0 - c.y) / 20;
    expect(across / sink).toBeGreaterThanOrEqual(3);
    expect(across / sink).toBeLessThanOrEqual(3.5);
    expect(across * 3.6).toBeGreaterThanOrEqual(150);
    expect(across * 3.6).toBeLessThanOrEqual(190);
    expect(sink).toBeGreaterThanOrEqual(10);
    expect(sink).toBeLessThanOrEqual(14);
    expect(s.chute?.mode).toBe("freefall");
    expect(s.chute?.suit).toBe("wingsuit");
  });

  it("dives past 250 km/h with the arms swept and the lean forward", () => {
    const s = suit(3500);
    let top = 0;
    for (let i = 0; i < steps(40) && (s.chute?.agl ?? 0) > 300; i++) {
      step(s, ask({ tuck: 1, lean: -1 }));
      top = Math.max(top, s.chute?.airspeed ?? 0);
    }
    expect(top * 3.6).toBeGreaterThanOrEqual(250);
  });

  it("dives on down to straight down, head first, on the lean forward alone", () => {
    const s = suit(3500);
    let steep = 0;
    for (let i = 0; i < steps(30) && (s.chute?.agl ?? 0) > 300; i++) {
      step(s, ask({ lean: -1 }));
      const c = s.skier;
      steep = Math.max(steep, Math.atan2(-c.vy, Math.hypot(c.vx, c.vz)));
    }
    expect((steep * 180) / Math.PI).toBeGreaterThan(80);
    expect(s.skier.thrown).toBeNull();
  });

  it("flares out of a dive into a climb", () => {
    const s = suit(3000);
    run(s, 8, ask({ lean: -1 }));
    let least = Infinity;
    for (let i = 0; i < steps(8); i++) {
      step(s, ask({ lean: 1, brake: 1 }));
      least = Math.min(least, -s.skier.vy);
    }
    expect(least).toBeLessThan(0);
  });

  it("turns on the edge, banked", () => {
    const s = suit(2500);
    run(s, 10, N);
    const h0 = s.chute!.heading;
    run(s, 3, ask({ steer: 1 }));
    const turned = Math.atan2(Math.sin(s.chute!.heading - h0), Math.cos(s.chute!.heading - h0));
    // Some 70° in 3 s with the roll-in, the bank near square.
    expect(turned).toBeGreaterThan(1.2);
    expect(s.chute!.wing!.bank).toBeGreaterThan(1.3);
  });

  it("is turned back by the edge's wind, flown straight at it, high or low", () => {
    for (const [agl, x] of [
      [2500, SIZE - 1200],
      [300, SIZE - 350],
    ]) {
      for (const lean of [0, -1]) {
        const s = suit(agl, { x, z: SIZE / 2, heading: Math.PI / 2 });
        let far = 0;
        let turned = 1;
        for (let i = 0; i < steps(60) && s.chute?.mode === "freefall"; i++) {
          step(s, ask({ lean, tuck: -lean, steer: 0 }));
          far = Math.max(far, s.skier.x);
          turned = Math.min(turned, Math.sin(s.chute!.heading));
        }
        expect(far).toBeLessThan(SIZE);
        expect(turned).toBeLessThan(0.5);
      }
    }
  });

  it("flies with no skis on: nothing of the skis touches the snow", () => {
    const s = suit(800);
    run(s, 5, N);
    expect(s.skier.contacts.every((k) => !k.touching)).toBe(true);
    expect(s.wingsuit).toBeDefined();
  });

  it("is thrown by the snow met in flight, and begun again", () => {
    const s = suit(60);
    let cause = "";
    for (let i = 0; i < steps(15) && !cause; i++) {
      step(s, ask({ lean: -1, tuck: 1 }));
      for (const e of s.events) if (e.kind === "wipeout") cause = e.cause;
    }
    expect(cause).toBe("wingsuit");
    expect(s.skier.thrown).not.toBeNull();
    run(s, 1, ask({ reset: true }));
    expect(s.skier.thrown).toBeNull();
  });
});

describe("the pull, the canopy and the landing", () => {
  it("opens the BASE canopy in 3–5 s, and the press under it does nothing (no reserve)", () => {
    const s = suit(800);
    run(s, 2, N);
    step(s, ask({ machine: true }));
    let full = NaN;
    for (let i = 0; i < steps(8) && Number.isNaN(full); i++) {
      step(s, N);
      if (s.events.some((e) => e.kind === "chute" && e.phase === "open")) full = s.chute!.deploy!.t;
    }
    expect(full).toBeGreaterThanOrEqual(3);
    expect(full).toBeLessThanOrEqual(5);
    run(s, 1, N);
    run(s, 0.5, ask({ machine: true }));
    expect(s.chute?.mode).toBe("open");
    expect(s.chute?.reserve).toBe(false);
  });

  it("lands on his boots under the bot's flare", () => {
    const s = suit(300, { mode: "open" });
    for (let i = 0; i < steps(200) && s.chute?.mode !== "landed" && !s.skier.thrown; i++) {
      step(s, wingsuitInput(s));
    }
    expect(s.skier.thrown).toBeNull();
    expect(s.chute?.mode).toBe("landed");
  });
});

describe("the exits", () => {
  const level = levelFor(38);

  it("finds the same exit on a mountain every time, high on it, its start arc clear", () => {
    const a = wingsuitExitOf(level);
    expect(wingsuitExitOf(level)).toBe(a);
    expect(a.clear).toBeGreaterThanOrEqual(WINGSUIT.search.clear);
    const m = level.mountain!;
    expect(a.y).toBeGreaterThan(m.base.y + 0.5 * m.vertical);
    // A hover leaves room to fly before the pull, over the least that clears.
    if (a.hover > 0)
      expect(a.hover).toBeGreaterThanOrEqual(
        WINGSUIT.search.hoverRoom + WINGSUIT.search.hoverLeast,
      );
  });

  it("stands him ready on it, then off it on the press, flying within 7 s", () => {
    const s = game(level, false);
    expect(s.chute?.mode).toBe("ready");
    expect(s.wingsuit?.from).toBe("cliff");
    const y0 = s.skier.y;
    run(s, 1, N);
    expect(s.skier.y).toBeCloseTo(y0, 3);
    step(s, ask({ machine: true }));
    expect(s.chute?.mode).toBe("exit");
    let t = NaN;
    for (let i = 0; i < steps(10) && Number.isNaN(t); i++) {
      step(s, N);
      if (s.chute?.mode === "freefall") t = s.chute.since;
    }
    // Off the hover, 675 m up in the wind aloft, the air past him is already
    // near level when his hands come free; never before they do.
    expect(t).toBeGreaterThanOrEqual(WINGSUIT.exit.clear);
    expect(t).toBeLessThanOrEqual(7);
    expect(s.skier.thrown).toBeNull();
  });

  it("goes out of the plane's door in the suit", () => {
    const s = game();
    planeAloft(s, {
      x: SIZE / 2,
      y: 3000,
      z: 1500,
      heading: 0,
      speed: PLANE.pilot.jumpRun,
      power: 0.5,
    });
    step(s, ask({ machine: true }));
    expect(s.chute?.suit).toBe("wingsuit");
    run(s, 4, N);
    expect(s.chute?.mode).toBe("freefall");
  });

  it("takes a flyer out of any craft at its velocity (the hook)", () => {
    const s = game(flatLevel({ size: SIZE }), false);
    wingsuitOut(s, { x: SIZE / 2, y: 2000, z: 1500, vx: 0, vy: -2, vz: 30, heading: 0 }, []);
    expect(s.chute?.mode).toBe("exit");
    expect(s.skier.vz).toBe(30);
    run(s, 6, N);
    expect(s.chute?.mode).toBe("freefall");
  });

  it("is flown by the bot from the exit down under its canopy, deterministically", () => {
    // Down is the canopy brought to the snow on his boots or hung up in a
    // crown short of the piste — the bot's canopy pattern does not yet keep
    // clear of the woods beside a piste; never the flyer thrown in the suit.
    const down = (s: GameState): boolean =>
      s.chute?.mode === "landed" || s.chute?.mode === "snagged";
    const fly = (): GameState => {
      const s = game(level, false);
      for (let i = 0; i < steps(400) && !down(s); i++) step(s, wingsuitInput(s));
      return s;
    };
    const a = fly();
    expect(a.skier.thrown).toBeNull();
    expect(down(a)).toBe(true);
    const b = fly();
    expect(b.skier.x).toBe(a.skier.x);
    expect(b.skier.z).toBe(a.skier.z);
    expect(b.t).toBe(a.t);
  });

  it("leaves a ride with no wingsuit without one", () => {
    const s = createGame({ level, mode: "free", crowd: 0, quiet: true });
    expect(s.wingsuit).toBeUndefined();
  });
});
