// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE (`engine/game/sled.ts`, its body `sled-body.ts`, its drive
// `sled-drive.ts`): a free ride's mountain sled parked at the bottom,
// boarded by skiing into it, ridden on the rider's own controls — the
// tuck the thumb, the skid the brake, the edge the bars, the lean his
// weight — hopped off on a double press, and thrown off. The physics on the
// drag strip (`flatLevel`: a grade of one's own, all packed or all
// powder), the parking and the boarding on one generated mountain.

import { describe, expect, it } from "vitest";
import {
  HOP_WINDOW,
  NEUTRAL_INPUT,
  SLED,
  createGame,
  helipadOf,
  sledDriveForce,
  sledMaxDrive,
  sledPowerShare,
  sledPilot,
  sledSpotOf,
  standSkier,
  standSled,
  step,
  type GameEvent,
  type GameState,
  type Level,
  type SkierInput,
} from "@engine";

import { levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...NEUTRAL_INPUT, ...o });

/** A free ride stood on the snowmobile's boards on `level`, at (x, z)
 * facing `heading` (+z by default), going `speed` m/s. */
function onSled(level: Level, at?: { x: number; z: number }, heading = 0, speed = 0): GameState {
  const s = createGame({ level, mode: "free", sled: true, crowd: 0, quiet: true });
  if (at) {
    standSled(s, s.sled!, at.x, at.z, heading);
    s.sled!.vx = Math.sin(heading) * speed;
    s.sled!.vz = Math.cos(heading) * speed;
    s.sled!.treadSpeed = speed;
  }
  return s;
}

/** Step `s` for `seconds` on `input`, every event kept. */
function ride(
  s: GameState,
  seconds: number,
  input: SkierInput,
  out: GameEvent[] = [],
): GameEvent[] {
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    step(s, input);
    out.push(...s.events);
  }
  return out;
}

const kmh = (s: GameState): number => s.sled!.speed * 3.6;
const packed = flatLevel({ packed: 1 });
const powder = flatLevel({ packed: 0 });
/** A powder face rising along +z from z = 350 at `grade`. */
const face = (grade: number): Level => flatLevel({ packed: 0, grade: -grade, slopeFrom: 350 });

describe("the snowmobile's engine and drive", () => {
  it("makes a two-stroke's power: little down low, its peak at 8,000 rpm", () => {
    expect(sledPowerShare(SLED.idleRpm)).toBeLessThan(0.2);
    expect(sledPowerShare(SLED.peakRpm)).toBeCloseTo(1, 5);
    expect(sledPowerShare(SLED.engageRpm)).toBeLessThan(0.75);
    expect(sledPowerShare(SLED.maxRpm)).toBeLessThan(1);
  });

  it("drives nothing below the clutch's engagement, and the most through the lowest ratio", () => {
    expect(sledDriveForce(SLED.idleRpm, 1, 0)).toBe(0);
    const launch = sledDriveForce(SLED.peakRpm, 1, 0);
    expect(launch).toBeGreaterThan(0);
    expect(launch).toBeLessThanOrEqual(sledMaxDrive() + 1e-6);
    // Flat power: the force falls as the belt gathers speed.
    expect(sledDriveForce(SLED.peakRpm, 1, 30)).toBeLessThan(launch / 2);
  });
});

describe("the snowmobile on the snow", () => {
  it("runs to the class's top speed on the groomer, and no further", () => {
    const s = onSled(packed, { x: packed.size / 2, z: 200 });
    ride(s, 8, ask({ tuck: 1 }));
    expect(kmh(s)).toBeGreaterThan(90);
    ride(s, 30, ask({ tuck: 1 }));
    expect(kmh(s)).toBeGreaterThan(SLED.topSpeed - 15);
    expect(kmh(s)).toBeLessThan(SLED.topSpeed + 15);
  });

  it("sits down into powder at rest and climbs out onto it as it gathers speed", () => {
    const s = onSled(powder, { x: powder.size / 2, z: 200 });
    ride(s, 1.5, ask());
    const deep = Math.max(...s.sled!.sinks);
    expect(deep).toBeGreaterThan(0.2);
    ride(s, 6, ask({ tuck: 1 }));
    expect(kmh(s)).toBeGreaterThan(50);
    expect(Math.max(...s.sled!.sinks)).toBeLessThan(deep / 3);
  });

  it("climbs a 24° powder face from a standing start", () => {
    const lv = face(0.45);
    const s = onSled(lv, { x: lv.size / 2, z: 420 });
    ride(s, 10, ask({ tuck: 1, lean: -0.5 }));
    expect(s.sled!.z).toBeGreaterThan(470);
    expect(s.sled!.way).toBeGreaterThan(4);
    expect(s.sled!.rider).toBe(true);
  });

  it("bogs and stalls on a 35° face it charged at 50 km/h — a high-mark", () => {
    const lv = face(0.7);
    const s = onSled(lv, { x: lv.size / 2, z: 420 }, 0, 14);
    ride(s, 1, ask({ tuck: 1, lean: -0.5 }));
    const early = s.sled!.way;
    ride(s, 4, ask({ tuck: 1, lean: -0.5 }));
    expect(s.sled!.way).toBeLessThan(early);
    expect(s.sled!.slip).toBeGreaterThan(5);
  });

  it("rolls onto its inside edge through a powder turn and turns that way", () => {
    for (const steer of [1, -1]) {
      const s = onSled(powder, { x: powder.size / 2, z: 200 }, 0, 14);
      ride(s, 2, ask({ tuck: 0.7, steer }));
      const k = s.sled!;
      // Steered to its right (+x of the body), the heading grows and the
      // machine rolls right side down.
      expect(Math.sign(k.heading)).toBe(steer);
      expect(Math.sign(k.roll)).toBe(steer);
      expect(Math.abs(k.roll)).toBeGreaterThan(0.15);
      expect(k.rider).toBe(true);
    }
  });

  it("throws the roost's slip: the belt spins over powder pinned from a crawl", () => {
    const s = onSled(powder, { x: powder.size / 2, z: 200 });
    ride(s, 1, ask({ tuck: 1 }));
    expect(s.sled!.slip).toBeGreaterThan(5);
    expect(s.sled!.treadSpeed).toBeGreaterThan(s.sled!.way);
  });
});

describe("riding it", () => {
  const level = levelFor(1);

  it("waits parked at the bottom on a free ride, engine off, clear of the helipad", () => {
    const s = createGame({ level, mode: "free", crowd: 0, quiet: true });
    const k = s.sled!;
    expect(k.mode).toBe("parked");
    expect(k.rider).toBe(false);
    expect(k.running).toBe(false);
    const spot = sledSpotOf(level);
    expect(Math.hypot(k.x - spot.x, k.z - spot.z)).toBeLessThan(0.01);
    const pad = helipadOf(level);
    expect(Math.hypot(k.x - pad.x, k.z - pad.z)).toBeGreaterThan(30);
    ride(s, 3, ask());
    expect(s.sled!.rpm).toBe(0);
    expect(createGame({ level, mode: "slalom", rivals: 0, quiet: true }).sled).toBeUndefined();
    expect(createGame({ level, mode: "timeTrial", quiet: true }).sled).toBeUndefined();
  });

  it("starts with the skier on its boards, the engine idling", () => {
    const s = createGame({ level, mode: "free", sled: true, crowd: 0, quiet: true });
    const k = s.sled!;
    expect(k.rider).toBe(true);
    expect(k.running).toBe(true);
    ride(s, 1, ask());
    expect(s.sled!.rpm).toBeGreaterThan(SLED.idleRpm * 0.7);
    // He stands over it, on its boards — never on the snow.
    expect(Math.hypot(s.skier.x - k.x, s.skier.z - k.z)).toBeLessThan(0.6);
    expect(s.skier.y).toBeGreaterThan(k.y);
  });

  it("is taken by skiing into it slowly, never at speed", () => {
    const s = createGame({ level, mode: "free", crowd: 0, quiet: true });
    const k = s.sled!;
    const events: GameEvent[] = [];
    // Stood a few metres off, coasting at a walk: taken on.
    standSkier(s, k.x + 1.6, k.z, k.heading);
    ride(s, 0.5, ask(), events);
    expect(s.sled!.rider).toBe(true);
    expect(events.some((e) => e.kind === "sled" && e.phase === "board")).toBe(true);
    // Fast past it, nothing.
    const t = createGame({ level, mode: "free", crowd: 0, quiet: true });
    standSkier(t, t.sled!.x + 1.6, t.sled!.z, t.sled!.heading);
    t.skier.vx = SLED.board.fastest + 4;
    step(t, ask());
    expect(t.sled!.rider).toBe(false);
  });

  it("is hopped off on a DOUBLE press of the jump — a single press does nothing", () => {
    const s = createGame({ level, mode: "free", sled: true, crowd: 0, quiet: true });
    ride(s, 0.5, ask());
    ride(s, 0.05, ask({ jump: true }));
    ride(s, HOP_WINDOW + 0.2, ask());
    expect(s.sled!.rider).toBe(true);
    const events: GameEvent[] = [];
    ride(s, 0.05, ask({ jump: true }), events);
    ride(s, 0.1, ask(), events);
    ride(s, 0.05, ask({ jump: true }), events);
    expect(s.sled!.rider).toBe(false);
    expect(events.some((e) => e.kind === "sled" && e.phase === "hop")).toBe(true);
    // On his skis beside it, and not straight back on.
    ride(s, 1, ask());
    expect(s.sled!.rider).toBe(false);
    expect(Math.hypot(s.skier.x - s.sled!.x, s.skier.z - s.sled!.z)).toBeGreaterThan(0.6);
  });

  it("is hopped off on the app's double tap too", () => {
    const s = createGame({ level, mode: "free", sled: true, crowd: 0, quiet: true });
    ride(s, 0.5, ask());
    step(s, ask({ sledOff: true }));
    expect(s.sled!.rider).toBe(false);
  });

  it("throws its rider off into a trunk at speed, and puts him back on when he stands", () => {
    const s = createGame({ level, mode: "free", sled: true, crowd: 0, quiet: true });
    const tree = level.trees[Math.floor(level.trees.length / 2)];
    const heading = 0.3;
    standSled(s, s.sled!, tree.x - Math.sin(heading) * 8, tree.z - Math.cos(heading) * 8, heading);
    const k = s.sled!;
    k.vx = Math.sin(heading) * 16;
    k.vz = Math.cos(heading) * 16;
    k.treadSpeed = 16;
    const events = ride(s, 1.5, ask({ tuck: 1 }));
    expect(events.some((e) => e.kind === "sled" && e.phase === "crash")).toBe(true);
    expect(events.some((e) => e.kind === "wipeout" && e.cause === "sled")).toBe(true);
    expect(s.sled!.rider).toBe(false);
    // Stood up again (the reset), he is back on the machine.
    ride(s, 12, ask());
    step(s, ask({ reset: true }));
    ride(s, 0.5, ask());
    expect(s.skier.thrown).toBe(null);
    expect(s.sled!.rider).toBe(true);
  });

  it("is ridden up the mountain by the bot's hands, round the trunks", () => {
    const lv = levelFor(38);
    const s = createGame({ level: lv, mode: "free", sled: true, crowd: 0, quiet: true });
    const y0 = s.sled!.y;
    const z0 = s.sled!.z;
    const events: GameEvent[] = [];
    for (let i = 0; i < 120 * 30; i++) {
      step(s, sledPilot(s));
      events.push(...s.events);
    }
    // Up the fall line (−z is uphill) and up the mountain, never thrown.
    expect(s.sled!.z).toBeLessThan(z0 - 200);
    expect(s.sled!.y).toBeGreaterThan(y0 + 30);
    expect(events.some((e) => e.kind === "sled" && e.phase === "crash")).toBe(false);
    expect(s.sled!.rider).toBe(true);
  });

  it("is deterministic", () => {
    const run = (): string => {
      const s = createGame({ level, mode: "free", sled: true, crowd: 0, quiet: true });
      for (let i = 0; i < 900; i++) step(s, ask({ tuck: 1, steer: Math.sin(i / 90) }));
      const k = s.sled!;
      return [k.x, k.y, k.z, k.rpm, k.treadSpeed, s.skier.x].map((v) => v.toFixed(9)).join(",");
    };
    expect(run()).toBe(run());
  });
});
