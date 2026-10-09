// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S HOLD ON THE SKID AND THE ROTOR OVER HIM (`heli-grip.ts`): a
// bank his hands carry, a machine turned over past them that he lets go of,
// and a loop that drops him through the disc — struck, and on an injuries
// run torn apart by it. One generated mountain, built once and shared.

import { describe, expect, it } from "vitest";
import {
  HELI,
  HELI_GRIP,
  NEUTRAL_INPUT,
  HELI_SEAT as SEAT,
  heliPoint,
  createGame,
  fallsIntoRotor,
  gripLoad,
  pilotInput,
  step,
  type GameEvent,
  type GameState,
  type HeliControls,
  type SkierInput,
} from "@engine";
import { fromEuler, rotate } from "@niclaslindstedt/oss-game-framework/core/quat";

import { levelFor } from "./support/levels.ts";

const level = levelFor(1);
const hands = (o: Partial<HeliControls> = {}): SkierInput => ({
  ...NEUTRAL_INPUT,
  heli: { collective: 0, pitch: 0, roll: 0, pedal: 0, ...o },
});

function ride(gore = false): GameState {
  return createGame({ level, mode: "free", heli: true, crowd: 0, quiet: true, gore });
}

/** Up to `height` over its pad on the bot's hands. */
function climb(s: GameState, height: number): void {
  const aim = { x: s.heli!.x, z: s.heli!.z, height };
  for (let i = 0; i < 40 * 120; i++) step(s, pilotInput(s, aim));
}

/** Step `s` for up to `seconds` on `input`, every event kept, until `stop`. */
function fly(s: GameState, seconds: number, input: SkierInput, stop?: () => boolean): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 120) && !stop?.(); i++) {
    step(s, input);
    out.push(...s.events);
  }
  return out;
}

const said = (events: GameEvent[], phase: string): boolean =>
  events.some((e) => e.kind === "heli" && e.phase === phase);

describe("the skier's hold on the skid", () => {
  it("carries nothing in his hands sat level, and all of him hung upside down", () => {
    expect(gripLoad(fromEuler(0, 0, 0))).toBe(0);
    expect(gripLoad(fromEuler(0, 0, Math.PI))).toBeCloseTo(1, 5);
    // A bank the seat's friction carries most of.
    expect(gripLoad(fromEuler(0, 0, 0.5))).toBeLessThan(HELI_GRIP.hold);
  });

  it("holds on through hard flying, and never lets go on the pad", () => {
    const s = ride();
    const events = fly(s, 4, hands());
    climb(s, 120);
    events.push(...fly(s, 3, hands({ collective: 0.6, roll: 0.4 })));
    expect(said(events, "slip")).toBe(false);
    expect(s.heli!.rider).toBe(true);
  });

  it("lets go of a machine rolled onto its back", () => {
    const s = ride();
    climb(s, 400);
    const events = fly(s, 12, hands({ collective: 0.8, roll: 1 }), () => !s.heli!.rider);
    expect(said(events, "slip")).toBe(true);
    expect(s.heli!.rider).toBe(false);
    expect(s.heli!.mode).toBe("home");
    expect(s.skier.thrown).not.toBeNull();
    expect(Math.abs(s.heli!.roll)).toBeGreaterThan(1.6);
  });
});

describe("the rotor over him", () => {
  it("falls a skier let go of in a loop down into the disc", () => {
    const s = ride();
    climb(s, 400);
    fly(s, 12, hands({ collective: 0.8, pitch: -1 }), () => !s.heli!.rider);
    expect(s.heli!.shed).toBeGreaterThanOrEqual(0);
    const events = fly(s, 2, hands());
    expect(said(events, "rotor")).toBe(true);
    expect(s.heli!.bladed).toBeGreaterThan(0);
    expect(s.heli!.taken).not.toBe(0);
  });

  it("tears him apart on an injuries run, and he dies of the rotor", () => {
    const s = ride(true);
    climb(s, 400);
    fly(s, 12, hands({ collective: 0.8, pitch: -1 }), () => !s.heli!.rider);
    const events = fly(s, 2, hands());
    const torn = events.filter((e) => e.kind === "gore");
    expect(torn.length).toBeGreaterThan(3);
    const death = events.find((e) => e.kind === "death");
    expect(death && death.kind === "death" ? death.cause : null).toBe("rotor");
  });

  it("reads the fall into the disc off the machine's attitude", () => {
    const s = ride();
    const h = s.heli!;
    const seat = { x: HELI.seat.x, y: HELI.seat.y + 1, z: HELI.seat.z };
    expect(fallsIntoRotor(h, seat)).toBe(false);
    h.pitch = Math.PI;
    expect(fallsIntoRotor(h, seat)).toBe(true);
  });

  it("strikes the same on the same controls", () => {
    const run = (): string => {
      const s = ride(true);
      climb(s, 400);
      fly(s, 14, hands({ collective: 0.8, pitch: -1 }));
      return `${s.heli!.taken} ${s.heli!.bladed} ${s.skier.thrown?.x}`;
    };
    expect(run()).toBe(run());
  });
});

describe("hung off his hands", () => {
  it("sits on the seat through hard flying, and comes off it onto his hands as it turns over", () => {
    const s = ride();
    climb(s, 120);
    fly(s, 3, hands({ collective: 0.6, roll: 0.4 }));
    expect(s.heli!.hung).toBe(0);
    climb(s, 400);
    fly(s, 12, hands({ collective: 0.8, roll: -1 }), () => s.heli!.hung >= 1);
    expect(s.heli!.rider).toBe(true);
    // As the hang comes on he is UNDER the tube, never stood on his head
    // (later the inverted machine dives faster than he falls, and he
    // trails above it, as a pendulum on a falling pivot does).
    expect(s.skier.y).toBeLessThan(heliPoint(s.heli!, SEAT).y);
    // A beat on, hung straight off the tube: his hands over his head.
    fly(s, 0.4, hands({ collective: 0.8, roll: -1 }));
    const h = s.heli!;
    const c = s.skier;
    const up = rotate(c.q, { x: 0, y: 1, z: 0 });
    const grip = heliPoint(h, SEAT);
    const toGrip = { x: grip.x - c.x, y: grip.y - c.y, z: grip.z - c.z };
    const n = Math.hypot(toGrip.x, toGrip.y, toGrip.z);
    expect(n).toBeCloseTo(HELI_GRIP.hang.reach, 2);
    expect((up.x * toGrip.x + up.y * toGrip.y + up.z * toGrip.z) / n).toBeGreaterThan(0.99);
  });
});
