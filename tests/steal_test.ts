// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TAKING A MACHINE THAT IS NOT HIS (`engine/game/steal.ts`): the air
// ambulance landed for an earlier run's casualty, walked up to and taken
// with the machine press — the run's helicopter made the one on the snow in
// its livery, the call told it is gone, flown like his own, let go unflown,
// parked where it sets down — and the book calling another machine for the
// casualty it left (`rescue-book.ts`).

import { describe, expect, it } from "vitest";
import {
  HELI,
  NEUTRAL_INPUT,
  createGame,
  heliDoor,
  heliWithin,
  helipadOf,
  standSkier,
  stealWithin,
  step,
  type GameEvent,
  type GameState,
  type HeliControls,
  type RescueCall,
  type SkierInput,
} from "@engine";

import { bookRun, createRescueBook } from "../pwa/src/game/rescue-book.ts";
import { levelFor } from "./support/levels.ts";

const level = levelFor(38);
const pts = level.track.points;
const fell = pts[Math.floor(pts.length * 0.45)];

const fresh = (): GameState =>
  createGame({ level, seed: 38, mode: "free", gore: true, crowd: 0, quiet: true });

/** The call the run after an injured one is handed. */
const call: RescueCall = (() => {
  const ended = fresh();
  standSkier(ended, fell.x, fell.z, fell.heading);
  ended.t = 5;
  ended.gore!.injured = 0;
  return bookRun(createRescueBook(), ended, fresh()).rescue![0];
})();

const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...NEUTRAL_INPUT, ...o });
const hands = (o: Partial<HeliControls> = {}): SkierInput =>
  ask({ heli: { collective: 0, pitch: 0, roll: 0, pedal: 0, ...o } });

function fly(s: GameState, seconds: number, input: SkierInput, out: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    step(s, input);
    out.push(...s.events);
  }
  return out;
}

/** A run carrying the call, at clock `t`, the skier stood `off` m from its
 * door, facing away from the machine. */
function atDoor(t: number, off = 1): GameState {
  const s = fresh();
  s.rescue = [
    { ...call, site: { ...call.site }, casualties: call.casualties.map((c) => ({ ...c })) },
  ];
  s.t = t;
  const door = heliDoor(call.site);
  const ax = door.x - call.site.x;
  const az = door.z - call.site.z;
  const d = Math.hypot(ax, az) || 1;
  standSkier(s, door.x + (ax / d) * off, door.z + (az / d) * off, Math.atan2(ax, az));
  return s;
}

/** A run with the ambulance taken. */
function stolen(): { s: GameState; events: GameEvent[] } {
  const s = atDoor(call.down + 3);
  const events = fly(s, 1 / 120, ask({ machine: true }));
  return { s, events };
}

describe("the air ambulance, taken", () => {
  it("is offered to the press only at its door, once it is down", () => {
    expect(stealWithin(atDoor(call.down + 3))).not.toBeNull();
    expect(stealWithin(atDoor(call.down + 3))!.livery).toBe("rescue");
    expect(stealWithin(atDoor(call.down - 3))).toBeNull();
    expect(stealWithin(atDoor(call.up + 1))).toBeNull();
    expect(stealWithin(atDoor(call.down + 3, HELI.board.reach + 2))).toBeNull();
    // Going too fast to climb aboard.
    const quick = atDoor(call.down + 3);
    quick.skier.speed = HELI.board.fastest + 1;
    expect(stealWithin(quick)).toBeNull();
  });

  it("is taken with the machine press: his to fly, its call told", () => {
    const { s, events } = stolen();
    const h = s.heli!;
    expect(h.rider).toBe(true);
    expect(h.mode).toBe("flown");
    expect(h.livery).toBe("rescue");
    expect(Math.hypot(h.x - call.site.x, h.z - call.site.z)).toBeLessThan(0.5);
    // On its skids on the snow, never let down off a slope's uphill skid.
    expect(h.y).toBeCloseTo(level.groundAt(h.x, h.z), 6);
    // Its crew leave the rotor turning: taken at speed.
    expect(h.spool).toBe(1);
    expect(s.rescue![0].stolen).toBeCloseTo(call.down + 3, 1);
    expect(events.some((e) => e.kind === "steal" && e.livery === "rescue")).toBe(true);
    expect(events.some((e) => e.kind === "heli" && e.phase === "board")).toBe(true);
    // The press was spent taking it, never read as the drop.
    fly(s, 0.5, hands());
    expect(s.heli!.rider).toBe(true);
    // ...and it is not offered again.
    expect(stealWithin(s)).toBeNull();
  });

  it("flies like his own, and let go in the air comes down unflown", () => {
    const { s } = stolen();
    fly(s, 6, hands({ collective: 0.9 }));
    const h = s.heli!;
    expect(h.grounded).toBe(false);
    expect(h.y - level.groundAt(h.x, h.z)).toBeGreaterThan(8);
    fly(s, 1 / 120, hands({ collective: 0.9 }), []);
    fly(s, 1 / 120, { ...hands({ collective: 0.9 }), machine: true });
    expect(s.heli!.rider).toBe(false);
    fly(s, 0.5, ask());
    // Nobody aboard flies it home: the collective is down.
    expect(s.heli!.controls.collective).toBe(0);
    const events = fly(s, 20, ask());
    expect(
      s.heli!.mode === "parked" ||
        s.heli!.mode === "wreck" ||
        events.some((e) => e.kind === "heli" && (e.phase === "crash" || e.phase === "restart")),
    ).toBe(true);
    const pad = helipadOf(level);
    if (s.heli!.mode === "parked" && s.heli!.livery)
      expect(Math.hypot(s.heli!.x - pad.x, s.heli!.z - pad.z)).toBeGreaterThan(15);
  });

  it("stepped off where it stands, it parks there and takes him back", () => {
    const { s } = stolen();
    fly(s, 1, hands());
    expect(s.heli!.grounded).toBe(true);
    fly(s, 1 / 120, ask({ machine: true }));
    expect(s.heli!.rider).toBe(false);
    expect(s.heli!.mode).toBe("parked");
    expect(s.heli!.livery).toBe("rescue");
    expect(Math.hypot(s.heli!.x - call.site.x, s.heli!.z - call.site.z)).toBeLessThan(1);
    // Past the grace after stepping off, the press sits him on it again.
    s.leftMachine = s.t - 10;
    const seat = heliDoor(s.heli!);
    standSkier(s, seat.x, seat.z, s.heli!.heading);
    expect(heliWithin(s)).toBe(true);
  });

  it("leaves no solid machine on the snow behind it", () => {
    const { s } = stolen();
    fly(s, 4, hands({ collective: 0.9 }));
    const back = atDoor(s.t);
    back.rescue![0].stolen = s.rescue![0].stolen;
    expect(stealWithin(back)).toBeNull();
  });

  it("has its crew call another machine for the casualty it left", () => {
    const book = createRescueBook();
    const ended = fresh();
    standSkier(ended, fell.x, fell.z, fell.heading);
    ended.t = 5;
    ended.gore!.injured = 0;
    const next = bookRun(book, ended, fresh());
    const first = next.rescue![0];
    // Stolen 4 s after it touched down, the run ending a minute later.
    next.rescue![0].stolen = first.down + 4;
    next.t = first.down + 64;
    const after = bookRun(book, next, fresh()).rescue!;
    expect(after).toHaveLength(1);
    expect(after[0].stolen).toBeUndefined();
    // A new machine, sent from the moment of the theft: a minute ago.
    expect(after[0].start).toBeCloseTo(-60, 6);
    expect(after[0].casualties[0]).toMatchObject({ x: fell.x, z: fell.z, known: 0 });
  });
});
