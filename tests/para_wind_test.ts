// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR A PARAMOTOR FLIES IN (`engine/game/para-air.ts`) and what it does
// to the wing (`para.ts`'s folds and the launch): the wind grown with
// height, the air rising up a slope it blows onto and sinking off one it
// blows down, the eddies in it the stronger the harder it blows and the
// rougher the ground — and a wing that flies clean in calm air, folds in a
// storm and is launched off the summit only once the air meets it from
// ahead. The air on a hand-built flank; the flights on a generated mountain.

import { describe, expect, it } from "vitest";
import {
  PARA,
  createGame,
  paraAirAt,
  paraPilot,
  step,
  type GameState,
  type Level,
  type ParaAir,
  type SkyOverride,
} from "@engine";

import { levelFor } from "./support/levels.ts";
import { STILL_AIR, flatLevel } from "./support/synthetic.ts";

const fresh = (): ParaAir => ({ x: 0, y: 0, z: 0, mean: 0, lift: 0, rough: 0, lee: 0 });

/** A face falling along +z with a FLANK across it: the ground rising
 * along +x at `rise` (negative: falling), and a wind of `wind` m/s from
 * the −x side, blowing along +x onto it. */
function flank(rise: number, wind = 8): Level {
  const base = flatLevel({ grade: 0.3, slopeFrom: 0 });
  return {
    ...base,
    groundAt: (x: number, z: number) => -0.3 * z + rise * x,
    weather: { ...STILL_AIR, kind: "fair", wind, windFrom: -Math.PI / 2 },
  };
}

const MID = { x: 1500, z: 1500 };
const air = (level: Level, agl: number, t = 30): ParaAir =>
  paraAirAt(level, t, MID.x, level.groundAt(MID.x, MID.z) + agl, MID.z, fresh());

describe("the air over the mountain", () => {
  it("rises up a slope the wind blows onto — ridge lift — and the more the steeper", () => {
    const gentle = air(flank(0.1), 20);
    const steep = air(flank(0.4), 20);
    expect(gentle.lift).toBeGreaterThan(0);
    expect(steep.lift).toBeGreaterThan(gentle.lift);
    // Never more than the slope's share of the wind's own speed.
    expect(steep.lift).toBeLessThanOrEqual(steep.mean * PARA.air.steepest + 1e-9);
    expect(steep.lee).toBe(0);
  });

  it("sinks off a slope it blows down, into a lee that is rougher", () => {
    const up = air(flank(0.4), 20);
    const lee = air(flank(-0.4), 20);
    expect(lee.lift).toBeLessThan(0);
    expect(lee.lee).toBeGreaterThan(0);
    expect(lee.rough).toBeGreaterThan(up.rough);
  });

  it("dies away with height over the snow, and blows harder up high", () => {
    const low = air(flank(0.4), 20);
    const high = air(flank(0.4), 600);
    expect(high.lift).toBeLessThan(low.lift * 0.2);
    expect(high.mean).toBeGreaterThan(low.mean);
  });

  it("is still in still air", () => {
    const calm = air(flank(0.4, 0), 20);
    expect(calm.mean).toBe(0);
    expect(calm.lift).toBe(0);
    expect(calm.rough).toBe(0);
  });

  it("is rougher the harder it blows", () => {
    expect(air(flank(0.1, 12), 40).rough).toBeGreaterThan(air(flank(0.1, 4), 40).rough * 2);
  });

  it("is a pure function of the place and the clock", () => {
    const level = flank(0.2, 10);
    const a = air(level, 50, 12.5);
    air(level, 80, 40);
    const b = air(level, 50, 12.5);
    expect(b).toEqual(a);
  });
});

/** A free ride under the wing on seed 38 under `sky`, flown on the bot's
 * hands for `seconds`; the folds counted, and the moment the wing was let
 * fly. */
function flight(sky: SkyOverride, seconds: number) {
  const state: GameState = createGame({
    level: levelFor(38),
    mode: "free",
    para: true,
    crowd: 0,
    quiet: true,
    sky,
  });
  let folds = 0;
  let launchSpeed = -1;
  let heading = 0;
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    step(state, paraPilot(state));
    for (const e of state.events) {
      if (e.kind !== "para") continue;
      if (e.phase === "fold") folds++;
      if (e.phase === "launch") {
        const p = state.para!;
        const c = state.skier;
        launchSpeed = c.vx * Math.sin(p.heading) + c.vz * Math.cos(p.heading);
        heading = p.heading;
      }
    }
  }
  return { state, folds, launchSpeed, heading };
}

describe("the wing in the wind", () => {
  it("flies clean in calm air", () => {
    const { state, folds } = flight({ weather: { kind: "fair", wind: 0, windFrom: Math.PI } }, 45);
    expect(folds).toBe(0);
    expect(state.para!.mode).toBe("flown");
    expect(state.para!.flying).toBe(true);
  });

  it("folds in a storm", () => {
    const { folds } = flight({ weather: "storm" }, 45);
    expect(folds).toBeGreaterThanOrEqual(2);
  });

  it("is let fly in a tailwind only once he skis faster than the wind", () => {
    const calm = flight({ weather: { kind: "fair", wind: 0, windFrom: Math.PI } }, 12);
    // The wind from straight behind him as he skis off the summit.
    const behind = calm.heading + Math.PI;
    const tail = flight({ weather: { kind: "fair", wind: 9, windFrom: behind } }, 25);
    expect(tail.launchSpeed).toBeGreaterThan(calm.launchSpeed + 5);
    // And it flies, rather than being blown down onto him.
    expect(tail.state.para!.mode).toBe("flown");
  });

  it("flies the same flight twice", () => {
    const a = flight({ weather: "snow" }, 20).state;
    const b = flight({ weather: "snow" }, 20).state;
    expect(b.skier.x).toBe(a.skier.x);
    expect(b.skier.y).toBe(a.skier.y);
    expect(b.para!.fold).toBe(a.para!.fold);
  });
});
