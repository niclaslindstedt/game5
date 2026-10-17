// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR AMBULANCE CALLED, KEPT AND MET — a call flown in after an injured
// run (`rescue-flight.ts`), kept from run to run and shared by a second
// casualty (`rescue-book.ts`), and the landed machine a solid to the
// engine (`rescue-call.ts`): in before it lands, sat on its skids, a
// skier held off it at a crawl and thrown met hard, and nothing before it
// lands or after it lifts.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  createGame,
  rescueBoxes,
  standSkier,
  step,
  type GameEvent,
  type GameState,
} from "@engine";

import { bookRun, createRescueBook } from "../pwa/src/game/rescue-book.ts";
import { canTake, flightAt, freshFlightFrame, planFlight } from "../pwa/src/game/rescue-flight.ts";
import { RESCUE } from "../pwa/src/game/rescue-plan.ts";
import { levelFor } from "./support/levels.ts";

const level = levelFor(38);
const pts = level.track.points;
const fell = pts[Math.floor(pts.length * 0.45)];

const fresh = (): GameState =>
  createGame({ level, seed: 38, mode: "free", gore: true, crowd: 0, quiet: true });

/** A run ended `t` s in, hurt (or not) at (`x`, `z`). */
function ended(x: number, z: number, t: number, hurt = true): GameState {
  const s = fresh();
  standSkier(s, x, z, fell.heading);
  s.t = t;
  if (hurt) s.gore!.injured = 0;
  return s;
}

describe("the call flown in", () => {
  const flight = planFlight(level, [{ x: fell.x, z: fell.z, known: 0 }]);
  const f = freshFlightFrame();

  it("comes in from far off and high, and sits on its site once down", () => {
    flightAt(level, flight, 0, f);
    const d0 = Math.hypot(f.heli.x - flight.site.x, f.heli.z - flight.site.z);
    expect(d0).toBeGreaterThan(150);
    expect(f.heli.y - level.groundAt(f.heli.x, f.heli.z)).toBeGreaterThan(20);
    expect(f.heli.shown).toBe(true);
    flightAt(level, flight, flight.down + 1, f);
    expect(Math.hypot(f.heli.x - flight.site.x, f.heli.z - flight.site.z)).toBeLessThan(0.05);
    expect(Math.abs(f.heli.y - flight.site.y)).toBeLessThan(0.05);
  });

  it("keeps the crew aboard until it is down, then walks them to him", () => {
    flightAt(level, flight, flight.down - 1, f);
    expect(f.active).toBe(-1);
    expect(f.crew.every((c) => !c.shown)).toBe(true);
    const tr = flight.trips[0];
    expect(tr.begin).toBeGreaterThan(flight.down);
    flightAt(level, flight, tr.begin + RESCUE.flight.gather + 1, f);
    expect(f.active).toBe(0);
    expect(f.crew.every((c) => c.shown)).toBe(true);
    expect(tr.offset).toBeGreaterThan(tr.begin);
    expect(flight.lift).toBeGreaterThan(tr.offset);
  });

  it("is moved no faster than a walk between the door and the scoop", () => {
    const tr = flight.trips[0];
    let last = flightAt(level, flight, tr.begin, freshFlightFrame()).crew.map((c) => ({ ...c }));
    for (let t = tr.begin + 0.05; t < tr.offset + 0.5; t += 0.05) {
      flightAt(level, flight, t, f);
      for (let j = 0; j < f.crew.length; j++) {
        const v = Math.hypot(f.crew[j].x - last[j].x, f.crew[j].z - last[j].z) / 0.05;
        expect(v).toBeLessThan(3.5);
      }
      last = f.crew.map((c) => ({ ...c }));
    }
  });

  it("is gone at the end", () => {
    flightAt(level, flight, flight.gone + 1, f);
    expect(f.heli.shown).toBe(false);
  });

  it("takes a second casualty near and in time, never a third", () => {
    expect(canTake(flight, fell.x + 20, fell.z, 30)).toBe(true);
    expect(canTake(flight, fell.x + 400, fell.z, 30)).toBe(false);
    expect(canTake(flight, fell.x + 20, fell.z, flight.lift)).toBe(false);
    const two = planFlight(level, [
      { x: fell.x, z: fell.z, known: 0 },
      { x: fell.x + 20, z: fell.z, known: 30 },
    ]);
    expect(two.trips).toHaveLength(2);
    expect(two.trips[1].begin).toBeGreaterThan(two.trips[0].offset);
    expect(two.lift).toBeGreaterThan(flight.lift);
    expect(canTake(two, fell.x + 20, fell.z, 40)).toBe(false);
  });
});

describe("the calls kept from run to run", () => {
  it("calls one after an injured end, none after any other", () => {
    const book = createRescueBook();
    const s = bookRun(book, ended(fell.x, fell.z, 12, false), fresh());
    expect(s.rescue).toBeUndefined();
    const r = bookRun(book, ended(fell.x, fell.z, 9), fresh());
    expect(r.rescue).toHaveLength(1);
    const call = r.rescue![0];
    expect(call.start).toBe(0);
    expect(call.down).toBe(RESCUE.flight.arrive);
    expect(call.up).toBeGreaterThan(call.down);
  });

  it("finds it landed on the next run, and the same machine takes the second", () => {
    const book = createRescueBook();
    const a = bookRun(book, ended(fell.x, fell.z, 5), fresh());
    const b = bookRun(book, ended(fell.x + 15, fell.z + 5, 40), fresh());
    expect(b.rescue).toHaveLength(1);
    const call = b.rescue![0];
    expect(call.start).toBe(-40);
    expect(call.down).toBeLessThan(0);
    expect(call.casualties).toHaveLength(2);
    expect(call.casualties[1].known).toBe(40);
    expect(call.site).toEqual(a.rescue![0].site);
    // A third: a machine of its own.
    const c = bookRun(book, ended(fell.x - 10, fell.z, 10), fresh());
    expect(c.rescue).toHaveLength(2);
    expect(c.rescue![1].start).toBe(0);
  });

  it("drops a call once it is gone, and all of them on another map", () => {
    const book = createRescueBook();
    bookRun(book, ended(fell.x, fell.z, 5), fresh());
    const flight = planFlight(level, [{ x: fell.x, z: fell.z, known: 0 }]);
    const later = bookRun(book, ended(fell.x, fell.z, flight.gone + 10, false), fresh());
    expect(later.rescue).toBeUndefined();
    bookRun(book, ended(fell.x, fell.z, 5), fresh());
    const other = levelFor(1);
    const away = createGame({ level: other, seed: 1, mode: "free", gore: true, quiet: true });
    expect(
      bookRun(book, away, createGame({ level: other, seed: 1, mode: "free", quiet: true })).rescue,
    ).toBeUndefined();
  });
});

describe("the landed machine, a solid", () => {
  const book = createRescueBook();
  const call = bookRun(book, ended(fell.x, fell.z, 5), fresh()).rescue![0];
  const cabin = rescueBoxes(call.site, [])[0];

  /** A skier sent at the cabin's side from `back` m off at `speed`, at the
   * run's clock `t`. */
  function skiInto(t: number, back: number, speed: number) {
    const s = fresh();
    s.rescue = [{ ...call, site: { ...call.site }, casualties: [] }];
    s.t = t;
    const nx = cabin.dz;
    const nz = -cabin.dx;
    standSkier(
      s,
      cabin.x + nx * (cabin.halfWidth + back),
      cabin.z + nz * (cabin.halfWidth + back),
      Math.atan2(-nx, -nz),
    );
    s.skier.vx = -nx * speed;
    s.skier.vz = -nz * speed;
    const events: GameEvent[] = [];
    let passed = false;
    for (let i = 0; i < 240; i++) {
      step(s, NEUTRAL_INPUT);
      events.push(...s.events);
      const across = (s.skier.x - cabin.x) * nx + (s.skier.z - cabin.z) * nz;
      if (across < cabin.halfWidth - 0.6) passed = true;
    }
    return { s, events, passed };
  }

  it("throws a skier met hard on its skids", () => {
    const hard = skiInto(call.down + 2, 4, 11);
    expect(hard.passed).toBe(false);
    expect(hard.events.some((e) => e.kind === "hit" && e.stuff === "steel")).toBe(true);
    expect(hard.s.skier.thrown).not.toBeNull();
  });

  it("holds a skier off it at a crawl", () => {
    const slow = skiInto(call.down + 2, 1.2, 1);
    expect(slow.passed).toBe(false);
    expect(slow.s.skier.thrown).toBeNull();
  });

  it("is no solid before it lands", () => {
    const early = skiInto(call.down - 5, 4, 8);
    expect(early.events.some((e) => e.kind === "hit" && e.stuff === "steel")).toBe(false);
    expect(early.passed).toBe(true);
  });
});
