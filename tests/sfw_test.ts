// SAFE FOR WORK (`RunRules.sfw`, the INJURIES switch off): nobody collides
// with anybody, the afterski's doors stay shut, the helicopter is flown
// through a steadying hand and cannot crash, and the hot air balloon never
// catches fire and cannot crash.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  balloonTrim,
  createGame,
  lodgesOf,
  step,
  weatherFor,
  type GameEvent,
  type GameState,
  type HeliControls,
  type SkierInput,
} from "@engine";

import { freeGameOptions, freshRide, AFTERSKI_RUN } from "../pwa/src/game/free-ride.ts";
import { levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const level = levelFor(1);
const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...NEUTRAL_INPUT, ...o });
const hands = (o: Partial<HeliControls> = {}): SkierInput => ({
  ...NEUTRAL_INPUT,
  heli: { collective: 0, pitch: 0, roll: 0, pedal: 0, ...o },
});

function fly(s: GameState, seconds: number, input: SkierInput, out: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    step(s, input);
    out.push(...s.events);
  }
  return out;
}

const said = (events: GameEvent[], kind: "heli" | "balloon", phase: string): boolean =>
  events.some((e) => e.kind === kind && e.phase === phase);

describe("safe for work (RunRules.sfw)", () => {
  it("turns contact and the afterski off, and leaves every other run as it was", () => {
    const sfw = createGame({ level, mode: "free", crowd: 0, quiet: true, sfw: true });
    expect(sfw.rules.sfw).toBe(true);
    expect(sfw.rules.contact).toBe(false);
    expect(sfw.rules.afterski).toBe(false);
    expect(sfw.afterski).toBeUndefined();
    const plain = createGame({ level, mode: "free", crowd: 0, quiet: true });
    expect(plain.rules.sfw).toBeUndefined();
    expect(plain.rules.afterski).toBe(true);
    // A race's field leans on nobody either.
    const race = createGame({ level, quiet: true, sfw: true });
    expect(race.rules.contact).toBe(false);
  });

  it("never begins a ride inside a lodge, and the start card's ask is dropped", () => {
    const s = createGame({ level, mode: "free", crowd: 0, quiet: true, sfw: true, inLodge: true });
    expect(s.afterski).toBeUndefined();
    const ride = {
      ...freshRide(),
      run: { seed: level.seed, region: freshRide().region, id: AFTERSKI_RUN },
    };
    const opts = freeGameOptions(ride, level.seed, {
      spec: s.skier.spec,
      assist: s.assist,
      sfw: true,
    });
    expect(opts.inLodge).toBe(false);
    expect(opts.sfw).toBe(true);
    if (lodgesOf(level).length > 0) {
      const party = freeGameOptions(ride, level.seed, { spec: s.skier.spec, assist: s.assist });
      expect(party.inLodge).toBe(true);
    }
  });

  it("flies the helicopter on a steadying hand: the lever climbs, the stick goes", () => {
    const s = createGame({ level, mode: "free", heli: true, crowd: 0, quiet: true, sfw: true });
    const h = s.heli!;
    const y0 = h.y;
    // Lever down: it sits on its pad.
    fly(s, 2, hands({ collective: 0 }));
    expect(h.grounded).toBe(true);
    // Lever up: it climbs, level.
    fly(s, 6, hands({ collective: 1 }));
    expect(h.y).toBeGreaterThan(y0 + 15);
    expect(Math.abs(h.disc.roll)).toBeLessThan(0.5);
    // The middle holds the height.
    fly(s, 4, hands({ collective: 0.5 }));
    const held = h.y;
    fly(s, 4, hands({ collective: 0.5 }));
    expect(Math.abs(h.y - held)).toBeLessThan(3);
    // The stick forward: it goes the way it faces.
    const fx = Math.sin(h.heading);
    const fz = Math.cos(h.heading);
    fly(s, 6, hands({ collective: 0.5, pitch: 1 }));
    expect(h.vx * fx + h.vz * fz).toBeGreaterThan(15);
  });

  it("cannot crash the helicopter, whatever is asked of it", () => {
    const s = createGame({ level, mode: "free", heli: true, crowd: 0, quiet: true, sfw: true });
    const events: GameEvent[] = [];
    fly(s, 6, hands({ collective: 1 }), events);
    // Every way it can be thrown at the mountain: dropped, flown hard
    // across the face, round and round on the pedals.
    fly(s, 20, hands({ collective: 0 }), events);
    fly(s, 30, hands({ collective: 0.4, pitch: 1, roll: 1 }), events);
    fly(s, 30, hands({ collective: 0, pitch: -1, roll: -1, pedal: 1 }), events);
    fly(s, 30, hands({ collective: 0.2, pitch: 1, pedal: -1 }), events);
    expect(said(events, "heli", "crash")).toBe(false);
    expect(s.heli!.mode).not.toBe("wreck");
    expect(s.heli!.rider).toBe(true);
    expect(s.skier.thrown).toBeNull();
  });

  function balloonRide(storm: boolean): GameState {
    const flat = flatLevel({ grade: 0.3, slopeFrom: 300, runOut: { at: 2600, bend: 150 } });
    if (storm) flat.weather = weatherFor("storm");
    return createGame({
      level: flat,
      mode: "free",
      balloon: true,
      crowd: 0,
      quiet: true,
      sfw: true,
    });
  }

  it("never sets the balloon alight, burnt in a gale or cooked", () => {
    const s = balloonRide(true);
    const events = fly(s, 40, ask({ tuck: 1 }));
    expect(said(events, "balloon", "fire")).toBe(false);
    expect(s.balloon!.burning).toBe(false);
    expect(s.balloon!.scorch).toBe(0);
  });

  it("cannot crash the balloon: let cool from altitude it only comes down", () => {
    const s = balloonRide(false);
    const b = s.balloon!;
    b.mode = "flown";
    b.grounded = false;
    b.y = s.level.groundAt(b.x, b.z) + 150;
    b.vx = b.vy = b.vz = 0;
    b.temp = balloonTrim(s, b) - 25;
    const events = fly(s, 120, ask());
    expect(said(events, "balloon", "touch")).toBe(true);
    expect(said(events, "balloon", "crash")).toBe(false);
    expect(s.skier.thrown).toBeNull();
    expect(b.aboard).toBe(true);
  });
});
