// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE (`engine/game/plane.ts`): a free ride begun in its door on
// the strip below the town, flown by hand off the strip, round the sky — a
// loop, a roll, a stall that breaks and is flown out — the skier out of the
// door, the pilot home and down on the strip, a crash and the ride begun
// again (the strip itself is `airstrip_test.ts`). The flight's physics on
// the flat synthetic map (fast); the pilot's way home on a generated
// mountain, built once and shared.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  PLANE,
  STRIP_LENGTH,
  TUNING,
  airstripOf,
  createGame,
  onStrip,
  planeAloft,
  planeHold,
  planeInput,
  step,
  type GameEvent,
  type GameState,
  type Level,
  type PlaneControls,
  type PlaneEvent,
  type SkierInput,
} from "@engine";

import { flatLevel } from "./support/synthetic.ts";
import { levelFor } from "./support/levels.ts";

const SIZE = 4000;
const flat = flatLevel({ size: SIZE });
const dt = TUNING.dt;

function ride(level: Level = flat): GameState {
  return createGame({ level, mode: "free", plane: true, crowd: 0, quiet: true });
}

const hands = (c: Partial<PlaneControls> = {}): SkierInput => ({
  ...NEUTRAL_INPUT,
  plane: { throttle: 0, pitch: 0, roll: 0, yaw: 0, flaps: 0, ...c },
});

/** Step `s` for `seconds`, the input asked every step; every plane event. */
function fly(s: GameState, seconds: number, input: (s: GameState) => SkierInput): PlaneEvent[] {
  const out: PlaneEvent[] = [];
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    step(s, input(s));
    for (const e of s.events as GameEvent[]) if (e.kind === "plane") out.push(e);
  }
  return out;
}

/** Up in the air over the flat map's middle, flying north. */
function aloft(s: GameState, speed = 45, power = 0.7, y = 900): void {
  planeAloft(s, { x: SIZE / 2, y, z: SIZE / 2 - 1200, heading: 0, speed, power });
}

describe("the jump plane on a free ride", () => {
  it("is there only on a free ride that asks for it", () => {
    expect(createGame({ level: flat, mode: "free", crowd: 0, quiet: true }).plane).toBeUndefined();
    expect(createGame({ level: flat, plane: true, quiet: true }).plane).toBeUndefined();
    expect(ride().plane).toBeDefined();
  });

  it("starts with the skier in its door on the strip's start, the engine idling", () => {
    const s = ride();
    const p = s.plane!;
    const strip = airstripOf(flat);
    expect(p.mode).toBe("flown");
    expect(p.rider).toBe(true);
    expect(p.grounded).toBe(true);
    expect(Math.hypot(p.x - strip.start.x, p.z - strip.start.z)).toBeLessThan(1);
    // The skier stands in the right-hand door, a metre or so off the datum.
    const c = s.skier;
    expect(Math.hypot(c.x - p.x, c.z - p.z)).toBeLessThan(2.5);
    expect(c.y).toBeGreaterThan(p.y);
    // Held there, still in it a few seconds on.
    fly(s, 3, () => hands());
    expect(p.rider).toBe(true);
    expect(Math.hypot(s.skier.x - p.x, s.skier.z - p.z)).toBeLessThan(2.5);
  });

  it("lifts off within the strip on the bot's hands, near the class's speed", () => {
    const s = ride();
    const strip = airstripOf(flat);
    const off = fly(s, 30, planeInput).find((e) => e.phase === "liftoff");
    expect(off).toBeDefined();
    const roll = Math.hypot(off!.x - strip.start.x, off!.z - strip.start.z);
    expect(roll).toBeLessThan(STRIP_LENGTH - PLANE.strip.overrun);
    expect(roll).toBeGreaterThan(150);
    expect(off!.speed).toBeGreaterThan(26);
    expect(off!.speed).toBeLessThan(35);
  });

  it("climbs away from the strip", () => {
    const s = ride();
    const events = fly(s, 70, planeInput);
    expect(events.some((e) => e.phase === "crash")).toBe(false);
    expect(s.plane!.agl).toBeGreaterThan(150);
  });

  it("flies a loop from the physics alone", () => {
    const s = ride();
    aloft(s, 62, 1);
    const p = s.plane!;
    const y0 = p.y;
    let turned = 0;
    let top = p.y;
    let crashed = false;
    for (let i = 0; i < Math.round(25 / dt) && turned < 2 * Math.PI; i++) {
      // A pilot's pull to the buffet, wings level.
      const pull = Math.max(-1, Math.min(1, 6 * (p.aoa - 0.19)));
      step(s, hands({ throttle: 1, pitch: pull, roll: 1.5 * p.wz }));
      turned += -p.wx * dt;
      top = Math.max(top, p.y);
      crashed ||= s.events.some((e) => e.kind === "plane" && e.phase === "crash");
    }
    expect(turned).toBeGreaterThanOrEqual(2 * Math.PI);
    expect(top - y0).toBeGreaterThan(100);
    expect(crashed).toBe(false);
  });

  it("rolls all the way round on the ailerons", () => {
    const s = ride();
    aloft(s, 58, 1);
    const p = s.plane!;
    fly(s, 3, () =>
      hands({ throttle: 1, pitch: p.pitch < 0.35 ? Math.max(-1, 6 * (p.aoa - 0.16)) : 0 }),
    );
    let turned = 0;
    let fastest = 0;
    for (let i = 0; i < Math.round(16 / dt) && turned < 2 * Math.PI; i++) {
      step(s, hands({ throttle: 1, roll: 1, yaw: 0.3 }));
      turned += -p.wz * dt;
      fastest = Math.max(fastest, -p.wz);
    }
    expect(turned).toBeGreaterThanOrEqual(2 * Math.PI);
    // The class's roll rate: tens of degrees a second, not a fighter's.
    expect((fastest * 180) / Math.PI).toBeGreaterThan(30);
    expect((fastest * 180) / Math.PI).toBeLessThan(90);
  });

  it("stalls when slowed past its wing, breaks, and is flown out", () => {
    const s = ride();
    aloft(s, 40, 0.4, 1200);
    const p = s.plane!;
    // Trimmed on the bot's hand, then the power off and the stick eased back.
    let stick = 0;
    fly(s, 12, (g) => {
      const c = planeHold(g, { heading: 0, height: 1200, speed: 38, flaps: 0 });
      stick = c.pitch;
      return { ...NEUTRAL_INPUT, plane: c };
    });
    let slowest = p.airspeed;
    let stalled = false;
    for (let i = 0; i < Math.round(90 / dt) && !stalled; i++) {
      stick = Math.max(-1, stick - 0.02 * dt);
      const c = planeHold(s, { heading: 0, height: 1200, speed: 30, flaps: 0 });
      step(s, hands({ pitch: stick, roll: c.roll, yaw: c.yaw }));
      slowest = Math.min(slowest, p.airspeed);
      stalled = s.events.some((e) => e.kind === "plane" && e.phase === "stall");
    }
    expect(stalled, "stalled").toBe(true);
    // The class's clean stall, 52–58 kt.
    expect(slowest).toBeGreaterThan(52 / 1.944);
    expect(slowest).toBeLessThan(58 / 1.944);
    const y0 = p.y;
    let back = false;
    for (let i = 0; i < Math.round(25 / dt) && !back; i++) {
      step(s, {
        ...NEUTRAL_INPUT,
        plane: planeHold(s, { heading: p.heading, height: p.y + 30, speed: 40, flaps: 0 }),
      });
      back = p.stalled < 0.05 && p.vy > 0;
    }
    expect(back, "flown out").toBe(true);
    expect(y0 - p.y).toBeLessThan(400);
  });

  it("lets the skier out of the door with the plane's own way on the machine press", () => {
    const s = ride();
    aloft(s, 40, 0.5);
    fly(s, 1, (g) => ({
      ...NEUTRAL_INPUT,
      plane: planeHold(g, { heading: 0, height: 900, speed: 40, flaps: 0.25 }),
    }));
    const p = s.plane!;
    const v = { x: p.vx, y: p.vy, z: p.vz };
    step(s, { ...NEUTRAL_INPUT, machine: true });
    expect(s.events.some((e) => e.kind === "plane" && e.phase === "jump")).toBe(true);
    expect(p.rider).toBe(false);
    expect(p.mode).toBe("home");
    const c = s.skier;
    expect(c.airborne).toBe(true);
    expect(c.thrown).toBeNull();
    // Carried out at the plane's speed, give or take the push and a step's
    // gravity.
    expect(Math.hypot(c.vx - v.x, c.vy - v.y, c.vz - v.z)).toBeLessThan(4);
    // The plane flies on, his own body now falling under it.
    fly(s, 2, () => NEUTRAL_INPUT);
    expect(c.y).toBeLessThan(p.y);
  });

  it("steps him off beside it on the machine press when it is stopped on the snow", () => {
    const s = ride();
    step(s, { ...NEUTRAL_INPUT, machine: true });
    // On the snow and stopped, the press steps him out beside it instead.
    expect(s.plane!.rider).toBe(false);
    expect(s.events.some((e) => e.kind === "plane" && e.phase === "stepoff")).toBe(true);
    expect(s.heli?.rider ?? false).toBe(false);
    expect(s.sled?.rider ?? false).toBe(false);
  });

  it("crashes into the snow, throws the skier, and starts the ride again on the strip", () => {
    const s = ride();
    planeAloft(s, {
      x: SIZE / 2,
      y: 40,
      z: SIZE / 2,
      heading: 0,
      speed: 50,
      pitch: -0.5,
      power: 1,
    });
    const events = fly(s, 5, () => hands({ throttle: 1, pitch: 1 }));
    expect(events.some((e) => e.phase === "crash")).toBe(true);
    expect(s.plane!.mode).toBe("wreck");
    expect(s.plane!.rider).toBe(false);
    expect(s.skier.thrown?.cause).toBe("plane");
    const again = fly(s, PLANE.crash.wreck + 1, () => NEUTRAL_INPUT);
    expect(again.some((e) => e.phase === "restart")).toBe(true);
    const strip = airstripOf(flat);
    expect(s.plane!.rider).toBe(true);
    expect(Math.hypot(s.plane!.x - strip.start.x, s.plane!.z - strip.start.z)).toBeLessThan(3);
  });

  it("is set back on the strip by the reset", () => {
    const s = ride();
    aloft(s);
    fly(s, 2, () => hands({ throttle: 0.6 }));
    step(s, { ...NEUTRAL_INPUT, reset: true });
    const strip = airstripOf(flat);
    expect(s.plane!.grounded).toBe(true);
    expect(s.plane!.rider).toBe(true);
    expect(Math.hypot(s.plane!.x - strip.start.x, s.plane!.z - strip.start.z)).toBeLessThan(1);
  });

  it("flies the same twice", () => {
    const a = ride();
    const b = ride();
    fly(a, 40, planeInput);
    fly(b, 40, planeInput);
    const pa = a.plane!;
    const pb = b.plane!;
    expect([pa.x, pa.y, pa.z, pa.q.x, pa.q.w]).toEqual([pb.x, pb.y, pb.z, pb.q.x, pb.q.w]);
  });
});

describe("the pilot flying it home", () => {
  it("flies the plane home after the jump and lands it on the strip", () => {
    const level = levelFor(1);
    const s = ride(level);
    const strip = airstripOf(level);
    // Off the strip and up on the bot's hands, then the jump.
    fly(s, 70, planeInput);
    expect(s.plane!.agl).toBeGreaterThan(150);
    step(s, { ...NEUTRAL_INPUT, machine: true });
    expect(s.plane!.mode).toBe("home");
    let home: PlaneEvent | undefined;
    let crash = false;
    for (let i = 0; i < Math.round(300 / dt) && !home; i++) {
      step(s, NEUTRAL_INPUT);
      for (const e of s.events) {
        if (e.kind !== "plane") continue;
        if (e.phase === "home") home = e;
        if (e.phase === "crash") crash = true;
      }
    }
    expect(crash).toBe(false);
    expect(home).toBeDefined();
    expect(s.plane!.mode).toBe("parked");
    expect(onStrip(level, s.plane!.x, s.plane!.z)).toBe(true);
    expect(Math.abs(s.plane!.y - level.groundAt(s.plane!.x, s.plane!.z))).toBeLessThan(0.5);
    void strip;
  });
});
