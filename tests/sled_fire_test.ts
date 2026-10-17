// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SNOWMOBILE RIDDEN INTO A FIRE (`engine/game/sled-fire.ts`): it catches
// in a bonfire's bed and its rider with it, its tank goes up after its fuse
// and blows him off it, his clothes alight; the wreck is never taken again
// and a fresh machine waits at the bottom once it has burnt out — and safe
// for work, the machine is held off the hearth untouched.

import "../pwa/src/game/drawn-solids.ts";
import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  SLED_FIRE,
  TUNING,
  createGame,
  firesOf,
  sledBallAt,
  sledFireFlux,
  sledWithin,
  standSled,
  step,
  type Fire,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const GAS: SkierInput = { ...NEUTRAL_INPUT, tuck: 0.6 };

/** A free ride on the snowmobile stood `back` m short of a bonfire, aimed
 * at its middle and going `speed` m/s. */
function rideInto(opts: { gore?: boolean; sfw?: boolean } = {}): { s: GameState; fire: Fire } {
  const level = levelFor(LEVEL_SEEDS[0]);
  const fire = firesOf(level).find((f) => f.kind === "bonfire")!;
  const s = createGame({ level, mode: "free", sled: true, crowd: 0, quiet: true, ...opts });
  const seat = fire.seats[0];
  const heading = Math.atan2(fire.x - seat.x, fire.z - seat.z);
  const back = 9;
  standSled(
    s,
    s.sled!,
    fire.x - Math.sin(heading) * back,
    fire.z - Math.cos(heading) * back,
    heading,
  );
  const speed = 9;
  s.sled!.vx = Math.sin(heading) * speed;
  s.sled!.vz = Math.cos(heading) * speed;
  s.sled!.treadSpeed = speed;
  return { s, fire };
}

function ride(s: GameState, seconds: number, input = GAS, each?: () => void): GameEvent[] {
  const all: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / TUNING.dt); i++) {
    step(s, input);
    all.push(...s.events);
    each?.();
    if (s.gore && s.gore.dead >= 0) break;
  }
  return all;
}

const phase = (events: GameEvent[], p: string) =>
  events.find((e) => e.kind === "sled" && e.phase === p);

describe("a snowmobile ridden into a bonfire", () => {
  it("catches with its rider, goes up after its fuse and blows him off it alight", () => {
    const { s, fire } = rideInto();
    let ball = 0;
    let flux = 0;
    const events = ride(s, 4, GAS, () => {
      const b = sledBallAt(s);
      if (b) ball = Math.max(ball, b.radius);
      const t = s.skier.thrown;
      if (t) flux = Math.max(flux, sledFireFlux(s, t.x, t.y, t.z));
    });
    const alight = phase(events, "alight");
    const boom = phase(events, "boom");
    expect(alight).toBeDefined();
    expect(s.sled!.burn?.fire).toBe(fire.id);
    expect(events.some((e) => e.kind === "fire" && e.what === "caught")).toBe(true);
    expect(boom).toBeDefined();
    expect(boom!.t - alight!.t).toBeCloseTo(SLED_FIRE.fuse, 1);
    expect(events.some((e) => e.kind === "wipeout" && e.cause === "blast")).toBe(true);
    expect(s.skier.thrown?.cause).toBe("blast");
    expect(s.burn?.burning).toBe(true);
    // A ball some metres across, its heat on him while it burns.
    expect(ball).toBeGreaterThan(4);
    expect(flux).toBeGreaterThan(0);
    expect(s.sled!.running).toBe(false);
  });

  it("with his wounds carried he dies of fire", () => {
    const { s } = rideInto({ gore: true });
    const events = ride(s, 20);
    const death = events.find((e) => e.kind === "death");
    expect(death && death.kind === "death" && death.cause).toBe("fire");
  });

  it("the wreck is never taken again, and burnt out a fresh machine waits at the bottom", () => {
    const { s } = rideInto();
    ride(s, 4);
    // Stood up beside it, on his skis.
    const events = ride(s, 40, NEUTRAL_INPUT);
    expect(s.skier.thrown).toBeNull();
    expect(s.sled!.rider).toBe(false);
    expect(s.sled!.burn?.boom).toBeGreaterThan(0);
    // Stood right by it, with the machine press: not taken.
    s.skier.x = s.sled!.x + 1;
    s.skier.z = s.sled!.z;
    s.skier.vx = s.skier.vy = s.skier.vz = 0;
    expect(sledWithin(s)).toBe(false);
    expect(events.some((e) => e.kind === "sled" && e.phase === "right")).toBe(false);
    // Burnt out, and him far off: a fresh one.
    s.skier.x += SLED_FIRE.wreck.clear * 2;
    const later = ride(s, SLED_FIRE.wreck.lasts, NEUTRAL_INPUT);
    expect(phase(later, "fresh")).toBeDefined();
    expect(s.sled!.burn).toBeUndefined();
    expect(s.sled!.mode).toBe("parked");
  });

  it("safe for work, the machine is held off the hearth and nothing burns", () => {
    const { s, fire } = rideInto({ sfw: true, gore: true });
    let closest = Infinity;
    const events = ride(s, 4, GAS, () => {
      closest = Math.min(closest, Math.hypot(s.sled!.x - fire.x, s.sled!.z - fire.z));
    });
    expect(phase(events, "alight")).toBeUndefined();
    expect(phase(events, "boom")).toBeUndefined();
    expect(s.sled!.burn).toBeUndefined();
    expect(s.burn).toBeUndefined();
    expect(closest).toBeGreaterThan(fire.radius);
  });
});
