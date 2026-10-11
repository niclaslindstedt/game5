// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT OUT OF EVERY CRAFT (`chute.ts`'s `craftFreefall` over
// `wingsuit-start.ts`'s `suitExit`): a ride in the suit up the helicopter,
// the balloon, the paramotor or the plane leaves each on the suit's start
// arc — at any height, there being no skis to fall onto — flies it, and a
// restart puts him back in the craft he left, never on the cliff exit. On a
// generated mountain for the helicopter (its pad and its flight) and the
// synthetic flat map for the rest.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  PLANE,
  createGame,
  pilotInput,
  planeAloft,
  step,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";

import { levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const N = NEUTRAL_INPUT;
const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...N, ...o });

/** Step `s` for `seconds` on `input` (or a function of the state), every
 * event kept. */
function fly(
  s: GameState,
  seconds: number,
  input: SkierInput | ((s: GameState) => SkierInput),
  out: GameEvent[] = [],
): GameEvent[] {
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    step(s, typeof input === "function" ? input(s) : input);
    out.push(...s.events);
  }
  return out;
}

/** The suit flying: out of the exit, the suit's own flight state. */
function flying(s: GameState): void {
  expect(s.chute?.suit).toBe("wingsuit");
  expect(s.chute?.wing).toBeDefined();
  expect(s.skier.thrown).toBeNull();
}

describe("the wingsuit out of a craft", () => {
  it("is a ride up the craft, never the cliff exit", () => {
    const level = flatLevel({ size: 8000 });
    const s = createGame({ level, mode: "free", balloon: true, wingsuit: true, quiet: true });
    expect(s.wingsuit?.from).toBe("craft");
    expect(s.balloon?.aboard).toBe(true);
    expect(s.chute).toBeUndefined();
    const own = createGame({ level, mode: "free", wingsuit: true, quiet: true });
    expect(own.wingsuit?.from).toBe("cliff");
    expect(own.chute?.mode).toBe("ready");
  });

  it("goes over the balloon's side on the suit's start arc, and begins again in the basket", () => {
    const level = flatLevel({ size: 8000 });
    const s = createGame({
      level,
      mode: "free",
      balloon: true,
      wingsuit: true,
      crowd: 0,
      quiet: true,
    });
    const b = s.balloon!;
    b.mode = "flown";
    b.grounded = false;
    b.y = s.level.groundAt(b.x, b.z) + 800;
    b.vx = b.vy = b.vz = 0;
    const out = fly(s, 1 / 120, ask({ machine: true }));
    expect(out.some((e) => e.kind === "chute" && e.phase === "exit")).toBe(true);
    expect(s.chute?.from).toBe("balloon");
    expect(s.chute?.mode).toBe("exit");
    flying(s);
    // Off a standstill the suit fills as he falls, and flies.
    fly(s, 8, N);
    expect(s.chute?.mode).toBe("freefall");
    expect(s.chute!.wing!.pressure).toBeGreaterThan(0.9);
    // The restart is the balloon's, in the suit still.
    fly(s, 1 / 120, ask({ reset: true }));
    expect(s.chute).toBeUndefined();
    expect(s.balloon!.aboard).toBe(true);
    expect(s.wingsuit?.from).toBe("craft");
  });

  it("is taken into the suit even under the skydive's least height: no skis to fall onto", () => {
    const level = flatLevel({ size: 8000 });
    const s = createGame({ level, mode: "free", balloon: true, wingsuit: true, quiet: true });
    const b = s.balloon!;
    b.mode = "flown";
    b.grounded = false;
    b.y = s.level.groundAt(b.x, b.z) + 60;
    b.vx = b.vy = b.vz = 0;
    fly(s, 1 / 120, ask({ machine: true }));
    expect(s.chute?.from).toBe("balloon");
    flying(s);
  });

  it("drops off the paramotor into the suit with the wing's way, and begins again under it", () => {
    const level = flatLevel({ grade: 0.3, slopeFrom: 120, runOut: { at: 1500, bend: 300 } });
    const s = createGame({
      level,
      mode: "free",
      para: true,
      wingsuit: true,
      crowd: 0,
      quiet: true,
    });
    expect(s.para?.mode).toBe("ready");
    fly(s, 30, ask({ tuck: 1 }));
    const speed = s.skier.speed;
    expect(s.para!.agl).toBeGreaterThan(50);
    fly(s, 1 / 120, ask({ machine: true }));
    expect(s.chute?.from).toBe("para");
    flying(s);
    // Out with the wing's own way: already moving through the air.
    expect(s.chute!.airspeed).toBeGreaterThan(speed * 0.5);
    fly(s, 1 / 120, ask({ reset: true }));
    expect(s.chute).toBeUndefined();
    expect(s.para?.mode).toBe("ready");
  });

  it("is pushed off the helicopter's skid into the suit, and begins again on it", () => {
    const level = levelFor(1);
    const s = createGame({
      level,
      mode: "free",
      heli: true,
      wingsuit: true,
      crowd: 0,
      quiet: true,
    });
    expect(s.heli?.rider).toBe(true);
    expect(s.chute).toBeUndefined();
    const h = s.heli!;
    fly(s, 25, (r) => pilotInput(r, { x: h.x, z: h.z - 300, height: 220 }));
    fly(s, 1 / 120, (r) => ({ ...pilotInput(r), machine: true }));
    expect(s.heli!.rider).toBe(false);
    expect(s.chute?.from).toBe("heli");
    flying(s);
    // The suit filling off the skid's standstill, flying on.
    fly(s, 3, N);
    expect(s.skier.thrown).toBeNull();
    expect(s.chute!.wing!.pressure).toBeGreaterThan(0.5);
    const events = fly(s, 1 / 120, ask({ reset: true }));
    expect(events.some((e) => e.kind === "heli" && e.phase === "restart")).toBe(true);
    expect(s.heli!.rider).toBe(true);
    expect(s.chute).toBeUndefined();
  });

  it("jumps out of the plane's door into the suit, and begins again in the door", () => {
    const level = flatLevel({ size: 8000 });
    const s = createGame({
      level,
      mode: "free",
      plane: true,
      wingsuit: true,
      crowd: 0,
      quiet: true,
    });
    expect(s.wingsuit?.from).toBe("craft");
    planeAloft(s, {
      x: 4000,
      y: 3000,
      z: 1500,
      heading: 0,
      speed: PLANE.pilot.jumpRun,
      power: 0.5,
    });
    fly(s, 1 / 120, ask({ machine: true }));
    expect(s.chute?.from).toBe("plane");
    flying(s);
    fly(s, 1 / 120, ask({ reset: true }));
    expect(s.plane?.rider).toBe(true);
    expect(s.chute).toBeUndefined();
  });
});
