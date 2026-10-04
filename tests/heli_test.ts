// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER (`engine/game/heli.ts`): a free ride's machine on its pad,
// flown by the player with the skier on its skid, pushed off, flown home by
// its pilot, crashed and stood up again — and the rotor's wash on the snow
// (`heli-wash.ts`). One generated mountain, built once and shared.

import { describe, expect, it } from "vitest";
import {
  HELI,
  NEUTRAL_INPUT,
  createGame,
  helipadOf,
  standSkier,
  step,
  thrustMost,
  washAt,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";

import { levelFor } from "./support/levels.ts";

const level = levelFor(1);
const W = HELI.mass * 9.81;
const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...NEUTRAL_INPUT, ...o });

function ride(): GameState {
  return createGame({ level, mode: "free", heli: true, crowd: 0, quiet: true });
}

/** Step `s` for `seconds` on `input`, every event kept. */
function fly(s: GameState, seconds: number, input: SkierInput, out: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    step(s, input);
    out.push(...s.events);
  }
  return out;
}

const height = (s: GameState): number => s.heli!.y - s.level.groundAt(s.heli!.x, s.heli!.z);

describe("the helicopter", () => {
  it("waits on its pad on a free ride and on no other run", () => {
    const free = createGame({ level, mode: "free", crowd: 0, quiet: true });
    expect(free.heli?.mode).toBe("parked");
    expect(free.heli?.rider).toBe(false);
    const pad = helipadOf(level);
    expect(free.heli!.x).toBeCloseTo(pad.x);
    expect(free.heli!.y).toBeCloseTo(level.groundAt(pad.x, pad.z));
    expect(createGame({ level, mode: "slalom", rivals: 0, quiet: true }).heli).toBeUndefined();
    expect(createGame({ level, mode: "timeTrial", quiet: true }).heli).toBeUndefined();
  });

  it("starts with the skier sat on its skid, the rotor at speed", () => {
    const s = ride();
    expect(s.heli!.rider).toBe(true);
    expect(s.heli!.mode).toBe("flown");
    expect(s.heli!.spool).toBe(1);
    expect(s.heli!.grounded).toBe(true);
    // The skier on the skid on its own right — the body frame's −x, the
    // renderer's frame mirroring the map.
    const h = s.heli!;
    const left = { x: -Math.cos(h.heading), z: Math.sin(h.heading) };
    expect((s.skier.x - h.x) * left.x + (s.skier.z - h.z) * left.z).toBeGreaterThan(0.8);
  });

  it("gives the thrust momentum theory says the power buys", () => {
    const hover = thrustMost(0, 0, 100);
    expect(hover / W).toBeGreaterThan(1.25);
    expect(hover / W).toBeLessThan(1.6);
    // More in ground effect, more again with translational lift, less climbing.
    expect(thrustMost(0, 0, HELI.rotor.hub)).toBeGreaterThan(hover * 1.1);
    expect(thrustMost(30, 0, 100)).toBeGreaterThan(hover);
    expect(thrustMost(0, 8, 100)).toBeLessThan(hover);
    // At the top of its climb it lifts its own weight and no more.
    expect(thrustMost(0, 11, 100) / W).toBeLessThan(1.1);
  });

  it("climbs on the lean forward, holds its height let go, and has no ceiling", () => {
    const s = ride();
    fly(s, 8, ask({ lean: -1 }));
    expect(s.heli!.grounded).toBe(false);
    expect(height(s)).toBeGreaterThan(50);
    expect(s.heli!.vy).toBeGreaterThan(7);
    fly(s, 3, ask());
    const held = height(s);
    fly(s, 4, ask());
    expect(Math.abs(height(s) - held)).toBeLessThan(2);
    // Up and up: the rotor never runs out of air.
    fly(s, 120, ask({ lean: -1 }));
    expect(s.heli!.y - level.groundAt(s.heli!.x, s.heli!.z)).toBeGreaterThan(900);
  });

  it("hangs toward the skier on his skid", () => {
    const s = ride();
    fly(s, 5, ask({ lean: -1 }));
    fly(s, 3, ask());
    expect(s.heli!.roll).toBeLessThan(-0.01);
    expect(s.heli!.roll).toBeGreaterThan(-0.12);
  });

  it("noses down and flies away on the tuck, and turns banked on the steer", () => {
    const s = ride();
    fly(s, 6, ask({ lean: -1 }));
    fly(s, 8, ask({ tuck: 1 }));
    const h = s.heli!;
    expect(h.pitch).toBeLessThan(-0.2);
    const fwd = Math.sin(h.heading) * h.vx + Math.cos(h.heading) * h.vz;
    expect(fwd).toBeGreaterThan(18);
    const was = h.heading;
    fly(s, 2, ask({ tuck: 1, steer: 1 }));
    expect(s.heli!.roll).toBeGreaterThan(0.2);
    expect(Math.sin(s.heli!.heading - was)).toBeGreaterThan(0.3);
  });

  it("lets the skier go on the jump with its way, and lurches up lighter", () => {
    const s = ride();
    fly(s, 7, ask({ lean: -1 }));
    fly(s, 4, ask({ tuck: 0.5 }));
    const h = s.heli!;
    const v = { x: h.vx, z: h.vz };
    const events = fly(s, 1 / 120, ask({ jump: true }));
    expect(events.some((e) => e.kind === "heli" && e.phase === "drop")).toBe(true);
    expect(h.rider).toBe(false);
    expect(h.mode).toBe("home");
    expect(s.skier.airborne).toBe(true);
    expect(Math.hypot(s.skier.vx - v.x, s.skier.vz - v.z)).toBeLessThan(HELI.drop.out + 0.5);
    // The skier falls; the machine, his weight gone from under a collective
    // still lifting it, lurches up and rolls back off his side.
    const vy0 = h.vy;
    const roll0 = h.roll;
    const y0 = s.skier.y;
    fly(s, 0.25, ask());
    expect(h.vy).toBeGreaterThan(vy0 + 0.05);
    expect(h.roll).toBeGreaterThan(roll0);
    expect(s.skier.y).toBeLessThan(y0);
  });

  it("is flown home and set down on its pad by its pilot", () => {
    const s = ride();
    fly(s, 7, ask({ lean: -1 }));
    fly(s, 6, ask({ tuck: 1 }));
    fly(s, 1 / 120, ask({ jump: true }));
    const events: GameEvent[] = [];
    for (let i = 0; i < 150 * 120 && s.heli!.mode !== "parked"; i++) {
      step(s, NEUTRAL_INPUT);
      events.push(...s.events);
    }
    expect(s.heli!.mode).toBe("parked");
    expect(events.some((e) => e.kind === "heli" && e.phase === "home")).toBe(true);
    const pad = helipadOf(level);
    expect(Math.hypot(s.heli!.x - pad.x, s.heli!.z - pad.z)).toBeLessThan(10);
  });

  it("takes a skier on who rides in beside its skid", () => {
    const s = createGame({ level, mode: "free", crowd: 0, quiet: true });
    const h = s.heli!;
    const side = { x: -Math.cos(h.heading), z: Math.sin(h.heading) };
    standSkier(s, h.x + side.x * 2.2, h.z + side.z * 2.2, h.heading);
    const events = fly(s, 0.1, ask());
    expect(events.some((e) => e.kind === "heli" && e.phase === "board")).toBe(true);
    expect(h.rider).toBe(true);
    expect(h.mode).toBe("flown");
  });

  it("crashes flown into the snow, throws the skier, and starts again on the pad", () => {
    const s = ride();
    fly(s, 4, ask({ lean: -1 }));
    const events: GameEvent[] = [];
    for (let i = 0; i < 40 * 120 && s.heli!.mode !== "wreck"; i++) {
      step(s, ask({ tuck: 1, lean: 1 }));
      events.push(...s.events);
    }
    expect(s.heli!.mode).toBe("wreck");
    expect(events.some((e) => e.kind === "heli" && e.phase === "crash")).toBe(true);
    expect(events.some((e) => e.kind === "wipeout" && e.cause === "heli")).toBe(true);
    expect(s.skier.thrown).not.toBeNull();
    fly(s, HELI.crash.wreck + 0.1, ask(), events);
    expect(events.some((e) => e.kind === "heli" && e.phase === "restart")).toBe(true);
    expect(s.heli!.rider).toBe(true);
    expect(s.heli!.grounded).toBe(true);
    expect(s.skier.thrown).toBeNull();
  });

  it("crashes on a touchdown faster than the skids take", () => {
    const s = ride();
    fly(s, 4, ask({ lean: -1 }));
    // Cut the climb and let it fall: the collective's descent is held slow,
    // so throw it down by hand.
    s.heli!.vy = -9;
    const events: GameEvent[] = [];
    for (let i = 0; i < 20 * 120 && s.heli!.mode !== "wreck" && !s.heli!.grounded; i++) {
      step(s, ask({ lean: 1 }));
      s.heli!.vy = Math.min(s.heli!.vy, -9);
      events.push(...s.events);
    }
    expect(s.heli!.mode).toBe("wreck");
  });

  it("sets the skier back on the pad on the reset", () => {
    const s = ride();
    fly(s, 6, ask({ lean: -1 }));
    const events = fly(s, 1 / 120, ask({ reset: true }));
    expect(events.some((e) => e.kind === "heli" && e.phase === "restart")).toBe(true);
    expect(s.heli!.grounded).toBe(true);
    expect(s.heli!.rider).toBe(true);
  });

  it("drives its wash down and out along the snow, and nowhere far off", () => {
    const s = ride();
    fly(s, 1.5, ask({ lean: -1 }));
    fly(s, 2, ask());
    const h = s.heli!;
    expect(height(s)).toBeLessThan(2 * HELI.rotor.radius * HELI.wash.reach);
    const out = { x: 0, y: 0, z: 0 };
    const r = HELI.rotor.radius * HELI.wash.core;
    const px = h.x + r;
    washAt(level, h, px, level.groundAt(px, h.z) + 0.3, h.z, out);
    expect(out.x).toBeGreaterThan(5);
    washAt(level, h, h.x + 300, level.groundAt(h.x + 300, h.z) + 1, h.z, out);
    expect(Math.hypot(out.x, out.y, out.z)).toBeLessThan(0.5);
  });

  it("flies the same twice on the same controls", () => {
    const a = ride();
    const b = ride();
    for (const s of [a, b]) {
      fly(s, 4, ask({ lean: -1 }));
      fly(s, 4, ask({ tuck: 1, steer: 0.5 }));
    }
    expect(b.heli).toEqual(a.heli);
  });
});
