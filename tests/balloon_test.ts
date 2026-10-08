// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON (`engine/game/balloon.ts`, its numbers
// `defs/balloon.ts`, its air `balloon-air.ts`): a free ride begun in the
// basket of a balloon tethered on the valley floor — burnt light and let go,
// carried up the mountain on the day's up-valley wind, climbing on the
// burner after a real lag and sinking with the valve or without heat,
// crashing into the slope when it is let cool, catching fire in a gale,
// jumped out of and stepped out of, walked about in. The flight on the long
// synthetic face (`flatLevel`: down +z, so up the mountain is −z), the site
// and the start card on generated mountains.

import { describe, expect, it } from "vitest";
import {
  BALLOON,
  NEUTRAL_INPUT,
  SKIS,
  balloonPilot,
  balloonTrim,
  balloonWalkMostX,
  balloonWalkMostZ,
  balloonWindAt,
  createGame,
  step,
  weatherFor,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";

import { BALLOON_RUN, balloonOn, freeGameOptions, freshRide } from "../pwa/src/game/free-ride.ts";
import { readParams } from "../pwa/src/game/url-params.ts";
import { levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...NEUTRAL_INPUT, ...o });

/** A balloon ride on a long face: flat valley floor at the far (+z) end,
 * the face rising toward −z; under a storm when asked. */
function ride(storm = false): GameState {
  const level = flatLevel({ grade: 0.3, slopeFrom: 300, runOut: { at: 2600, bend: 150 } });
  if (storm) level.weather = weatherFor("storm");
  return createGame({ level, mode: "free", balloon: true, crowd: 0, quiet: true });
}

/** Step `s` for `seconds` on `input` (or a function of the state), every
 * event kept. */
function fly(
  s: GameState,
  seconds: number,
  input: SkierInput | ((s: GameState) => SkierInput),
  out: GameEvent[] = [],
): GameEvent[] {
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    step(s, typeof input === "function" ? input(s) : input);
    out.push(...s.events);
  }
  return out;
}

const said = (events: GameEvent[], phase: string): boolean =>
  events.some((e) => e.kind === "balloon" && e.phase === phase);

/** The balloon let go and set `agl` m over the snow, at its trim (plus
 * `warm` K), drifting with the wind there. */
function aloft(s: GameState, agl: number, warm = 0): void {
  const b = s.balloon!;
  b.mode = "flown";
  b.grounded = false;
  b.y = s.level.groundAt(b.x, b.z) + agl;
  const w = balloonWindAt(s.level, s.t, b.x, b.y + 14, b.z, {
    x: 0,
    z: 0,
    speed: 0,
    gust: 0,
  });
  b.vx = w.x;
  b.vz = w.z;
  b.vy = 0;
  b.temp = balloonTrim(s, b) + warm;
}

describe("the hot air balloon (balloon.ts)", () => {
  it("stands him in the basket on the valley floor, tethered and a little heavy", () => {
    const s = ride();
    const b = s.balloon!;
    expect(b.mode).toBe("tethered");
    expect(b.aboard).toBe(true);
    // The valley floor: the far, flat end of the face.
    expect(b.z).toBeGreaterThan(2300);
    expect(b.lift).toBeLessThanOrEqual(0);
    expect(b.temp).toBeLessThan(balloonTrim(s, b));
    expect(Math.abs(s.skier.x - b.x)).toBeLessThan(1);
    expect(s.skier.y).toBeGreaterThan(b.y);
    // Left alone it never leaves the snow.
    fly(s, 20, ask());
    expect(s.balloon!.mode).toBe("tethered");
  });

  it("is let go on the first burns, and the wind carries it up the mountain", () => {
    const s = ride();
    const z0 = s.balloon!.z;
    const events = fly(s, 180, (st) => balloonPilot(st));
    expect(said(events, "launch")).toBe(true);
    const b = s.balloon!;
    expect(b.mode).toBe("flown");
    expect(b.agl).toBeGreaterThan(40);
    // Up the face: toward −z, over higher snow.
    expect(z0 - b.z).toBeGreaterThan(200);
    expect(s.level.groundAt(b.x, b.z)).toBeGreaterThan(s.level.groundAt(b.start.x, b.start.z) + 10);
    expect(said(events, "fire")).toBe(false);
  });

  it("hovers at its trim, climbs on a burn only after a lag, and sinks with the valve", () => {
    const s = ride();
    aloft(s, 200);
    fly(s, 10, ask());
    expect(Math.abs(s.balloon!.climb)).toBeLessThan(0.4);
    // A five-second burn: the climb comes, but seconds after the burn began.
    let t = 0;
    let climbing = -1;
    for (; t < 60; t += 1 / 120) {
      step(s, ask({ tuck: t < 5 ? 1 : 0 }));
      if (climbing < 0 && s.balloon!.climb > 0.5) climbing = t;
    }
    expect(climbing).toBeGreaterThan(4);
    expect(climbing).toBeLessThan(40);
    expect(s.balloon!.fuel).toBeLessThan(BALLOON.mass.fuel);
    // The valve held open dumps the heat: it sinks.
    aloft(s, 200);
    const hot = s.balloon!.temp;
    fly(s, 20, ask({ brake: 1 }));
    expect(s.balloon!.temp).toBeLessThan(hot - 5);
    expect(s.balloon!.climb).toBeLessThan(-0.8);
  });

  it("sinks unheated, and let cool from altitude it crashes into the slope", () => {
    const s = ride();
    aloft(s, 150);
    fly(s, 60, ask());
    expect(s.balloon!.climb).toBeLessThan(0);
    // Cooled well under its trim, nothing burnt: down it comes, hard.
    aloft(s, 150, -25);
    const events: GameEvent[] = [];
    for (let i = 0; i < 120 * 120 && !said(events, "crash"); i++) {
      step(s, ask());
      events.push(...s.events);
    }
    expect(said(events, "crash")).toBe(true);
    expect(events.some((e) => e.kind === "wipeout" && e.cause === "balloon")).toBe(true);
    expect(s.skier.thrown).not.toBeNull();
    // ...and once he has lain, the ride starts again at the bottom.
    const more = fly(s, BALLOON.crash.lieFor + 1, ask());
    expect(said(more, "restart")).toBe(true);
    expect(s.balloon!.aboard).toBe(true);
    expect(s.balloon!.mode).toBe("tethered");
    expect(s.skier.thrown).toBeNull();
  });

  it("catches fire burning in a gale, and falls", () => {
    const s = ride(true);
    // Burnt on its tether in a storm's wind: the mouth pushed over the flame.
    const lit = fly(s, 10, ask({ tuck: 1 }));
    expect(said(lit, "fire")).toBe(true);
    // Alight at altitude, it loses its lift and comes down.
    const t = ride(true);
    aloft(t, 120);
    t.balloon!.burning = true;
    t.balloon!.scorch = 1;
    const events = fly(t, 90, ask({ tuck: 1 }));
    expect(t.balloon!.burnt).toBe(1);
    expect(said(events, "crash")).toBe(true);
  });

  it("burning a calm day never lights it", () => {
    const s = ride();
    const events = fly(s, 60, (st) => balloonPilot(st));
    expect(said(events, "fire")).toBe(false);
    expect(s.balloon!.scorch).toBe(0);
  });

  it("jumps him over the side onto his own body, and flies on without him", () => {
    const s = ride();
    aloft(s, 60);
    fly(s, 2, ask());
    const b = s.balloon!;
    const events = fly(s, 1 / 120, ask({ machine: true }));
    expect(said(events, "jump")).toBe(true);
    expect(b.aboard).toBe(false);
    expect(b.mode).toBe("adrift");
    expect(s.skier.airborne).toBe(true);
    const y0 = b.y;
    const after = fly(s, 8, ask());
    // His own fall: he comes down onto the snow, on his skis or thrown.
    expect(after.some((e) => e.kind === "land" || e.kind === "wipeout")).toBe(true);
    // ...and the balloon, his weight gone, flies on.
    expect(b.y).not.toBe(y0);
    expect(b.mode).toBe("adrift");
  });

  it("walks him about the basket and never through its wicker", () => {
    const s = ride();
    aloft(s, 100);
    fly(s, 8, ask({ steer: 1, lean: -1 }));
    const b = s.balloon!;
    expect(b.walkX).toBeCloseTo(balloonWalkMostX(), 5);
    expect(b.walkZ).toBeCloseTo(balloonWalkMostZ(), 5);
    // His weight to the right and forward leans the basket that way.
    expect(b.roll).toBeGreaterThan(0);
    expect(b.pitch).toBeLessThan(0);
    // He stands inside the basket's floor.
    const dx = s.skier.x - b.x;
    const dz = s.skier.z - b.z;
    expect(Math.hypot(dx, dz)).toBeLessThan(
      Math.hypot(BALLOON.basket.width, BALLOON.basket.length) / 2,
    );
    fly(s, 8, ask({ steer: -1, lean: 1 }));
    expect(b.walkX).toBeCloseTo(-balloonWalkMostX(), 5);
    expect(b.walkZ).toBeCloseTo(-balloonWalkMostZ(), 5);
  });

  it("steps him out onto the snow once it stands still there", () => {
    const s = ride();
    const events = fly(s, 1 / 120, ask({ machine: true }));
    expect(said(events, "step")).toBe(true);
    expect(s.balloon!.aboard).toBe(false);
    expect(s.balloon!.mode).toBe("down");
    expect(s.skier.thrown).toBeNull();
    fly(s, BALLOON.land.deflate + 1, ask());
    expect(s.balloon!.deflate).toBe(1);
  });

  it("starts again at the bottom on a reset in the basket", () => {
    const s = ride();
    aloft(s, 80);
    const events = fly(s, 1 / 120, ask({ reset: true }));
    expect(said(events, "restart")).toBe(true);
    expect(s.balloon!.mode).toBe("tethered");
  });

  it("is deterministic", () => {
    const run = () => {
      const s = createGame({
        level: levelFor(7),
        mode: "free",
        balloon: true,
        crowd: 0,
        quiet: true,
      });
      fly(s, 40, (st) => balloonPilot(st));
      const b = s.balloon!;
      return [b.x, b.y, b.z, b.temp, b.fuel, s.skier.x, s.skier.y, s.skier.z];
    };
    expect(run()).toEqual(run());
  });

  it("stands up on open snow on a generated valley floor, kept off the helicopter's pad", () => {
    const level = levelFor(7);
    const s = createGame({ level, mode: "free", balloon: true, crowd: 0, quiet: true });
    const b = s.balloon!;
    const m = level.mountain!;
    expect(b.y - m.base.y).toBeLessThan(0.25 * m.vertical);
    if (s.heli) expect(Math.hypot(s.heli.x - b.x, s.heli.z - b.z)).toBeGreaterThan(30);
    // No other free ride carries one.
    expect(createGame({ level, mode: "free", crowd: 0, quiet: true }).balloon).toBeUndefined();
  });
});

describe("the RUN row's balloon (free-ride.ts)", () => {
  it("stands the ride up in the basket, never by lift or at a spot, and is a link's too", () => {
    const r = {
      ...freshRide(),
      run: { seed: 7, region: freshRide().region, id: BALLOON_RUN },
      spot: { seed: 7, x: 100, z: 100 },
    };
    expect(balloonOn(r, 7)).toBe(true);
    const options = freeGameOptions(r, 7, { spec: SKIS, assist: { yaw: 1, air: 1 } });
    expect(options.balloon).toBe(true);
    expect(options.byLift).toBe(false);
    expect(options.spawn).toBeUndefined();
    expect(readParams("?start=free&balloon=1").balloon).toBe(true);
    expect(readParams("?start=free").balloon).toBe(false);
  });
});
