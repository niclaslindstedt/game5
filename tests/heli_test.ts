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
  heliWithin,
  pilotInput,
  standSkier,
  step,
  thrustMost,
  washAt,
  type GameEvent,
  type GameState,
  type HeliAim,
  type HeliControls,
  type SkierInput,
} from "@engine";

import { levelFor } from "./support/levels.ts";

const level = levelFor(1);
const W = HELI.mass * 9.81;
const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...NEUTRAL_INPUT, ...o });
/** The helicopter's four controls, by hand. */
const hands = (o: Partial<HeliControls> = {}): SkierInput => ({
  ...NEUTRAL_INPUT,
  heli: { collective: 0, pitch: 0, roll: 0, pedal: 0, ...o },
});

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

/** Step `s` for `seconds` on the bot's hands, asked every step. */
function pilot(s: GameState, seconds: number, aim?: HeliAim, out: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    step(s, pilotInput(s, aim));
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

  it("sits on its pad with the collective down, and lifts on the lever alone", () => {
    const s = ride();
    fly(s, 3, hands());
    expect(s.heli!.grounded).toBe(true);
    // The lever up and left there: it climbs, and keeps climbing — nothing
    // holds a height for it.
    fly(s, 6, hands({ collective: 0.95 }));
    expect(s.heli!.grounded).toBe(false);
    const a = height(s);
    fly(s, 3, hands({ collective: 0.95 }));
    expect(height(s)).toBeGreaterThan(a + 10);
    // Down, and it falls.
    fly(s, 2, hands({ collective: 0 }));
    expect(s.heli!.vy).toBeLessThan(-3);
  });

  it("has no ceiling", () => {
    const s = ride();
    fly(s, 120, hands({ collective: 1 }));
    expect(height(s)).toBeGreaterThan(900);
  });

  it("leaves the disc where the cyclic left it, and flies off along it", () => {
    const s = ride();
    pilot(s, 6, { x: s.heli!.x, z: s.heli!.z, height: 40 });
    const hover = s.heli!.controls.collective;
    fly(s, 0.4, hands({ collective: hover, pitch: 1 }));
    const tilted = s.heli!.disc.pitch;
    expect(tilted).toBeLessThan(-0.1);
    // Let go: no hand puts it back — it stays tilted (but for the air's
    // flapback, nose up a little as the speed comes) and the machine goes.
    fly(s, 1.5, hands({ collective: hover }));
    expect(s.heli!.disc.pitch).toBeLessThan(tilted * 0.5);
    const h = s.heli!;
    expect(Math.sin(h.heading) * h.vx + Math.cos(h.heading) * h.vz).toBeGreaterThan(3);
  });

  it("swings its nose left as the collective comes up, unless the pedals hold it", () => {
    const s = ride();
    pilot(s, 14, { x: s.heli!.x, z: s.heli!.z, height: 40 });
    const was = s.heli!.heading;
    fly(s, 2, hands({ collective: 1 }));
    expect(Math.sin(s.heli!.heading - was)).toBeLessThan(-0.05);
  });

  it("hangs toward the skier on his skid", () => {
    const s = ride();
    pilot(s, 8, { x: s.heli!.x, z: s.heli!.z, height: 30 });
    expect(s.heli!.roll - s.heli!.disc.roll).toBeLessThan(-0.01);
    expect(s.heli!.roll - s.heli!.disc.roll).toBeGreaterThan(-0.08);
  });

  it("is flown by the bot's hands on the same controls — out, and back down onto its pad", () => {
    const s = ride();
    const pad = helipadOf(level);
    pilot(s, 16);
    expect(height(s)).toBeGreaterThan(25);
    expect(Math.hypot(s.heli!.x - pad.x, s.heli!.z - pad.z)).toBeGreaterThan(200);
    for (let i = 0; i < 90 * 120 && !(s.heli!.grounded && s.t > 30); i++) {
      step(s, pilotInput(s, { x: pad.x, z: pad.z, height: 30, land: true }));
    }
    expect(s.heli!.mode).toBe("flown");
    expect(s.heli!.grounded).toBe(true);
    expect(Math.hypot(s.heli!.x - pad.x, s.heli!.z - pad.z)).toBeLessThan(3);
  });

  it("lets the skier step off where it has landed, and shuts down there", () => {
    const s = ride();
    const events = fly(s, 1 / 120, { ...hands(), machine: true });
    expect(events.some((e) => e.kind === "heli" && e.phase === "drop")).toBe(true);
    expect(s.skier.airborne).toBe(false);
    expect(s.heli!.mode).toBe("parked");
    // Stood beside the skid he stepped off, he stays off it until he asks;
    // the same press sits him back on.
    fly(s, 1, ask());
    expect(s.heli!.rider).toBe(false);
    const again = fly(s, 1 / 120, ask({ machine: true }));
    expect(again.some((e) => e.kind === "heli" && e.phase === "board")).toBe(true);
    expect(s.heli!.rider).toBe(true);
  });

  it("lets the skier go on the machine press with its way, and lurches up lighter", () => {
    const s = ride();
    pilot(s, 7, { x: s.heli!.x, z: s.heli!.z - 300, height: 50 });
    const h = s.heli!;
    const v = { x: h.vx, z: h.vz };
    const events = fly(s, 1 / 120, { ...pilotInput(s), machine: true });
    expect(events.some((e) => e.kind === "heli" && e.phase === "drop")).toBe(true);
    expect(h.rider).toBe(false);
    expect(h.mode).toBe("home");
    expect(s.skier.airborne).toBe(true);
    expect(Math.hypot(s.skier.vx - v.x, s.skier.vz - v.z)).toBeLessThan(HELI.drop.out + 0.5);
    // The skier falls; the machine, his weight gone from under a collective
    // still lifting it, lurches up and swings back off his side.
    const vy0 = h.vy;
    const hang0 = h.roll - h.disc.roll;
    const fall0 = s.skier.vy;
    fly(s, 0.25, ask());
    expect(h.vy).toBeGreaterThan(vy0 + 0.05);
    expect(h.roll - h.disc.roll).toBeGreaterThan(hang0);
    expect(s.skier.vy).toBeLessThan(fall0 - 1);
  });

  it("is flown home and set down on its pad by its pilot", () => {
    const s = ride();
    pilot(s, 12);
    fly(s, 1 / 120, { ...pilotInput(s), machine: true });
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

  it("takes a skier on who gives the machine press beside its skid, never one who skis past", () => {
    const s = createGame({ level, mode: "free", crowd: 0, quiet: true });
    const h = s.heli!;
    const side = { x: -Math.cos(h.heading), z: Math.sin(h.heading) };
    standSkier(s, h.x + side.x * 2.2, h.z + side.z * 2.2, h.heading);
    // Stood beside it, nothing: the press is the player's to make.
    fly(s, 0.5, ask());
    expect(h.rider).toBe(false);
    expect(heliWithin(s)).toBe(true);
    const events = fly(s, 1 / 120, ask({ machine: true }));
    expect(events.some((e) => e.kind === "heli" && e.phase === "board")).toBe(true);
    expect(h.rider).toBe(true);
    expect(h.mode).toBe("flown");
  });

  it("crashes flown into the snow, throws the skier, and starts again on the pad", () => {
    const s = ride();
    fly(s, 6, hands({ collective: 0.95 }));
    const events: GameEvent[] = [];
    for (let i = 0; i < 40 * 120 && s.heli!.mode !== "wreck"; i++) {
      step(s, hands({ collective: 0.1 }));
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

  it("sets the skier back on the pad on the reset", () => {
    const s = ride();
    fly(s, 6, hands({ collective: 0.9 }));
    const events = fly(s, 1 / 120, { ...ask(), reset: true });
    expect(events.some((e) => e.kind === "heli" && e.phase === "restart")).toBe(true);
    expect(s.heli!.grounded).toBe(true);
    expect(s.heli!.rider).toBe(true);
  });

  it("drives its wash down and out along the snow, and nowhere far off", () => {
    const s = ride();
    pilot(s, 4, { x: s.heli!.x, z: s.heli!.z, height: 6 });
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
      fly(s, 4, hands({ collective: 0.9 }));
      fly(s, 4, hands({ collective: 0.8, pitch: 0.3, roll: 0.2, pedal: 0.4 }));
    }
    expect(b.heli).toEqual(a.heli);
  });
});
