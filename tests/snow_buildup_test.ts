// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE THROUGH THE DAY (`engine/game/piste-day.ts`): a free ride's
// runs as the hour and the sky have left them since the night's grooming —
// the corduroy whole at the first chair, skied up through the day, a
// snowing sky's new snow on them, a spring sun's slush and its evening
// freeze — a pure function of the map, dealt only to a run whose rules have
// the ski area's machines, read by the physics through `snow.ts` and by the
// picture through `snowpack.ts`.

import { describe, expect, it } from "vitest";
import {
  CLEAR_WEATHER,
  NEUTRAL_INPUT,
  angleDiff,
  generateLevel,
  PISTE_DAY,
  TUNING,
  createGame,
  packedSnow,
  pisteDayOf,
  pisteIce,
  placeRun,
  step,
  type GameState,
  type Level,
  type Weather,
  type WeatherKind,
} from "@engine";

import { snowMix, snowpackOf } from "../pwa/src/game/snowpack.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const FALL: Partial<Record<WeatherKind, number>> = { flurries: 0.17, snow: 0.5, storm: 0.88 };

/** A map's day: `hour` on `dayOfYear` at `latitude` under `kind`. */
function dayOf(kind: WeatherKind, hour: number, dayOfYear = 30, latitude = 46) {
  const weather: Weather = { ...CLEAR_WEATHER, kind, snowfall: FALL[kind] ?? 0 };
  return pisteDayOf({ sun: { hour, dayOfYear, latitude }, weather });
}

describe("the runs through a day", () => {
  it("are the night's corduroy at the first chair, whatever the sky", () => {
    for (const kind of ["clear", "snow", "storm"] as const) {
      const p = dayOf(kind, PISTE_DAY.groomed);
      expect(p.worn).toBe(0);
      expect(p.fresh).toBe(0);
      expect(p.loose).toBe(0);
      expect(p.ice).toBe(0);
    }
  });

  it("are skied up through the day, and never back", () => {
    let last = -1;
    for (let h = 9; h <= 21; h += 0.5) {
      const p = dayOf("clear", h);
      expect(p.worn).toBeGreaterThanOrEqual(last);
      last = p.worn;
    }
    expect(dayOf("clear", 10).worn).toBeLessThan(0.3);
    expect(dayOf("clear", 15).worn).toBeGreaterThan(0.6);
  });

  it("carry more new snow the snowier the sky and the later the hour", () => {
    expect(dayOf("clear", 15).fresh).toBe(0);
    expect(dayOf("overcast", 15).fresh).toBe(0);
    const flurries = dayOf("flurries", 15).fresh;
    const snow = dayOf("snow", 15).fresh;
    const storm = dayOf("storm", 15).fresh;
    expect(flurries).toBeGreaterThan(0);
    expect(snow).toBeGreaterThan(flurries * 3);
    expect(storm).toBeGreaterThan(snow * 2);
    expect(dayOf("snow", 11).fresh).toBeLessThan(snow);
    // The traffic skis it in: a steady fall leaves centimetres, not the
    // whole day's fall.
    expect(snow).toBeLessThan(0.1);
    expect(storm).toBeLessThan(0.3);
  });

  it("go soft under a spring sun and freeze hard as it goes", () => {
    const noon = dayOf("clear", 13, 80);
    expect(noon.soft).toBeGreaterThan(0.6);
    expect(noon.hard).toBe(0);
    const evening = dayOf("clear", 19, 80);
    expect(evening.soft).toBeLessThan(0.1);
    expect(evening.hard).toBeGreaterThan(0.6);
    expect(evening.ice).toBeGreaterThan(0);
    // A lid over the sun, a snowing sky or a midwinter sun in the far north
    // keep the groomer cold.
    expect(dayOf("overcast", 13, 80).soft).toBeLessThan(noon.soft / 2);
    expect(dayOf("snow", 13, 80).soft).toBe(0);
    expect(dayOf("clear", 13, 30, 66).soft).toBe(0);
  });

  it("is the same deal every time it is asked", () => {
    expect(dayOf("storm", 14.3, 55)).toEqual(dayOf("storm", 14.3, 55));
  });
});

describe("dealt to a run", () => {
  const level = levelFor(LEVEL_SEEDS[0]);

  it("is a free ride's, and seeds its new snow", () => {
    const free = createGame({
      level,
      mode: "free",
      groomer: "off",
      sky: { weather: "snow", hour: 14 },
      crowd: 0,
      quiet: true,
    });
    expect(free.piste).toBeDefined();
    expect(free.piste!.worn).toBeGreaterThan(0);
    expect(free.fresh).toBe(free.piste!.fresh);
    expect(free.fresh).toBeGreaterThan(0);
  });

  it("is no race's, trial's or measurement's", () => {
    for (const mode of [undefined, "timeTrial", "slalom"] as const) {
      const s = createGame({ level, ...(mode ? { mode } : {}), quiet: true });
      expect(s.piste).toBeUndefined();
      expect(s.fresh).toBe(0);
    }
    const off = createGame({ level, mode: "free", piste: false, crowd: 0, quiet: true });
    expect(off.piste).toBeUndefined();
  });
});

describe("under the skis", () => {
  // A packed schuss, ridden at a run's hour with the day's piste on it.
  const SCHUSS = flatLevel({ packed: 1, grade: 0.25, slopeFrom: 200, size: 3000 });

  function ridden(hour: number, dayOfYear = 30): GameState {
    const level: Level = { ...SCHUSS, sun: { ...SCHUSS.sun, hour, dayOfYear } };
    const s = createGame({ level, piste: true, rivals: 0, countdown: 0, quiet: true });
    placeRun(s, { x: level.size / 2, z: 210, heading: 0, speed: 2 });
    return s;
  }

  it("ski the packed share of the groomer the day has left", () => {
    const morning = ridden(9);
    const afternoon = ridden(16);
    const x = SCHUSS.size / 2;
    expect(packedSnow(morning, x, 400)).toBe(1);
    expect(packedSnow(afternoon, x, 400)).toBeCloseTo(1 - afternoon.piste!.loose, 9);
    expect(packedSnow(afternoon, x, 400)).toBeLessThan(0.9);
  });

  it("are slower to run on in the skied-up afternoon than on the morning's corduroy", () => {
    const speedAfter = (s: GameState): number => {
      const steps = Math.round(8 * TUNING.physicsHz);
      for (let i = 0; i < steps; i++) step(s, { ...NEUTRAL_INPUT, tuck: 1 });
      return s.skier.speed;
    };
    expect(speedAfter(ridden(16))).toBeLessThan(speedAfter(ridden(9)));
  });

  it("hold less edge on a spring evening's refrozen groomer", () => {
    const evening = ridden(19, 80);
    const morning = ridden(9, 80);
    const x = SCHUSS.size / 2;
    expect(pisteIce(evening, x, 400, 1)).toBeGreaterThan(0);
    expect(pisteIce(morning, x, 400, 1)).toBe(0);
  });
});

describe("the stations, kept clear", () => {
  // A storm over the maritime country: the day has laid a hand of loose
  // snow over every run by the time the ride starts. The ski area keeps its
  // stations and its cat tracks clear of it (`kept-ground.ts`) — the pads,
  // the decks, the ramps off a top, the load zones at a foot and the
  // transport lanes are the night's packed snow, carrying only what has
  // fallen since the ride began.
  const level = generateLevel(2, {
    region: "maritime",
    sky: { weather: { kind: "storm", snowfall: 1 } },
  });
  const ride = (): GameState =>
    createGame({ level, mode: "free", byLift: true, run: "3", crowd: 0, quiet: true });
  const lift = level.resort!.lifts.find((l) => l.id === "G1")!;

  it("are packed through under the day's new snow, where the runs are buried", () => {
    const s = ride();
    expect(s.piste!.fresh).toBeGreaterThan(TUNING.snow.freshBury);
    const ramp = lift.ramps!.find((r) => r.run === "3")!;
    expect(packedSnow(s, lift.top.x, lift.top.z)).toBe(1);
    expect(packedSnow(s, (ramp.from.x + ramp.to.x) / 2, (ramp.from.z + ramp.to.z) / 2)).toBe(1);
    expect(packedSnow(s, lift.bottom.x, lift.bottom.z)).toBe(1);
    expect(pisteIce(s, lift.top.x, lift.top.z, 1)).toBe(0);
    // ...and so are the transport lanes between the runs, the machines' roads.
    for (const lane of level.resort!.runs.filter((r) => r.kind === "road")) {
      const at = lane.points[Math.floor(lane.points.length / 2)];
      expect(packedSnow(s, at.x, at.z)).toBe(1);
    }
    // ...and the run itself still carries the whole of the day's fall.
    const run = level.resort!.runs.find((r) => r.id === "3")!;
    const mid = run.points[Math.floor(run.points.length / 2)];
    expect(packedSnow(s, mid.x, mid.z)).toBeLessThan(0.1);
  });

  it("let a rider off the gondola glide off its pad and down its ramp", () => {
    const s = ride();
    const ramp = lift.ramps!.find((r) => r.run === "3")!;
    const marks = [ramp.from, ramp.to];
    let k = 0;
    let resets = 0;
    for (let i = 0; i < 60 * TUNING.physicsHz && k < marks.length; i++) {
      const c = s.skier;
      const aim = marks[k];
      if (!c.lift && Math.hypot(aim.x - c.x, aim.z - c.z) < 4) {
        k++;
        continue;
      }
      const off = angleDiff(c.heading, Math.atan2(aim.x - c.x, aim.z - c.z));
      step(s, {
        ...NEUTRAL_INPUT,
        steer: c.lift ? 0 : Math.max(-1, Math.min(1, off * 2.2)),
        tuck: c.lift ? 0 : c.speed < 5 ? 1 : 0.25,
        brake: c.lift ? 0 : Math.max(0, Math.min(1, c.speed - 12)),
      });
      resets += s.events.filter((e) => e.kind === "reset").length;
    }
    expect(resets).toBe(0);
    expect(k).toBe(marks.length);
  });
});

describe("as drawn", () => {
  const level = levelFor(LEVEL_SEEDS[0]);

  it("turns a sun-softened groomer wet and a frozen one hard", () => {
    // A spot the map packed through.
    const at = level.track.points[Math.floor(level.track.points.length / 3)];
    const plain = snowMix(snowpackOf(level, { weather: CLEAR_WEATHER }), at.x, at.z);
    const slush = snowMix(
      snowpackOf(level, { weather: CLEAR_WEATHER, piste: { worn: 0.5, soft: 1, hard: 0 } }),
      at.x,
      at.z,
    );
    const froze = snowMix(
      snowpackOf(level, { weather: CLEAR_WEATHER, piste: { worn: 0.8, soft: 0, hard: 1 } }),
      at.x,
      at.z,
    );
    expect(slush.wet).toBeGreaterThan(plain.wet);
    expect(slush.groomed).toBeLessThan(plain.groomed);
    expect(froze.hard).toBeGreaterThan(plain.hard);
  });
});
