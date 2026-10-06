// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR (`engine/game/para.ts`, its numbers `defs/para.ts`): a free
// ride begun on the summit with a speed wing held overhead and a motor on
// the skier's back — skied off until the wing flies, flown on the throttle,
// the brakes and the toggles, landed on the skis, and the whole rig dropped
// on the machine press to ski on. The flight on the long synthetic face
// (`flatLevel`), the summit and the start card on generated mountains.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  PARA,
  createGame,
  heliWithin,
  paraControls,
  paraPilot,
  paraRigged,
  paraStartOf,
  sledWithin,
  step,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";

import {
  PARA_RUN,
  freeGameOptions,
  freshRide,
  heliOn,
  paraOn,
  sledOn,
} from "../pwa/src/game/free-ride.ts";
import { SKIS } from "@engine";
import { takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { readParams } from "../pwa/src/game/url-params.ts";
import { levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...NEUTRAL_INPUT, ...o });

/** A paramotor ride on a long face of `grade`. */
function rig(grade = 0.3): GameState {
  const level = flatLevel({ grade, slopeFrom: 120, runOut: { at: 1500, bend: 300 }, packed: 1 });
  return createGame({ level, mode: "free", para: true, crowd: 0, quiet: true });
}

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

const phases = (events: GameEvent[]): string[] =>
  events.flatMap((e) => (e.kind === "para" ? [e.phase] : []));

describe("the paramotor's flight (para.ts)", () => {
  it("stands him on the summit with the wing held overhead", () => {
    const s = rig();
    const p = s.para!;
    expect(p.mode).toBe("ready");
    expect(paraRigged(s)).toBe(true);
    // Overhead: up his lines, about their length.
    const c = s.skier;
    const d = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
    expect(d).toBeGreaterThan(PARA.wing.lines * 0.8);
    expect(p.y - c.y).toBeGreaterThan(PARA.wing.lines * 0.8);
  });

  it("lets the wing fly once he skis off fast enough, and lifts him off the snow", () => {
    const s = rig();
    const events = fly(s, 12, ask({ tuck: 1 }));
    const seen = phases(events);
    expect(seen).toContain("launch");
    expect(seen).toContain("takeoff");
    expect(seen.indexOf("launch")).toBeLessThan(seen.indexOf("takeoff"));
    const p = s.para!;
    expect(p.mode).toBe("flown");
    expect(p.flying).toBe(true);
    expect(s.skier.thrown).toBeNull();
  });

  it("climbs on the throttle and glides at a speed wing's speed with it off", () => {
    const s = rig();
    fly(s, 25, ask({ tuck: 1 }));
    const p = s.para!;
    expect(p.flying).toBe(true);
    // Full power: a climb, at a wing's trim speed.
    expect(p.climb).toBeGreaterThan(0.5);
    // Power off: a glide — sinking, the air through it 40–75 km/h.
    fly(s, 8, ask());
    expect(p.climb).toBeLessThan(0);
    expect(p.airspeed * 3.6).toBeGreaterThan(40);
    expect(p.airspeed * 3.6).toBeLessThan(75);
    const glide = Math.hypot(s.skier.vx, s.skier.vz) / -p.climb;
    expect(glide).toBeGreaterThan(2.5);
    expect(glide).toBeLessThan(6);
  });

  it("turns toward the toggle pulled", () => {
    const s = rig();
    fly(s, 20, ask({ tuck: 1 }));
    const before = s.para!.heading;
    fly(s, 3, ask({ tuck: 0.6, steer: 1 }));
    const turned = Math.atan2(
      Math.sin(s.para!.heading - before),
      Math.cos(s.para!.heading - before),
    );
    expect(turned).toBeGreaterThan(0.3);
  });

  it("stalls on the brakes held down, and flies again once they are let up", () => {
    const s = rig();
    fly(s, 25, ask({ tuck: 1 }));
    let stalled = false;
    fly(s, 6, (st) => {
      stalled ||= st.para!.stalled;
      return ask({ brake: 1 });
    });
    expect(stalled).toBe(true);
    fly(s, 6, ask({ tuck: 1 }));
    expect(s.para!.stalled).toBe(false);
    expect(s.skier.thrown).toBeNull();
  });

  it("drops the whole rig on the machine press and leaves him skiing", () => {
    const s = rig();
    // Skied off under the wing, his skis still on the snow.
    const events = fly(s, 2, ask({ tuck: 1 }));
    expect(s.para!.flying).toBe(false);
    fly(s, 1 / 120, ask({ machine: true }), events);
    expect(phases(events)).toContain("drop");
    const p = s.para!;
    expect(p.mode).toBe("dropped");
    expect(paraRigged(s)).toBe(false);
    expect(p.canopy).not.toBeNull();
    expect(p.motor).not.toBeNull();
    fly(s, 10, ask({ tuck: 1 }));
    expect(s.skier.thrown).toBeNull();
    expect(s.skier.speed).toBeGreaterThan(5);
    // The pieces came down and lie on the snow.
    expect(p.canopy!.down).toBe(true);
    expect(p.motor!.down).toBe(true);
  });

  it("starts again on the summit on a reset while rigged", () => {
    const s = rig();
    const start = { x: s.skier.x, z: s.skier.z };
    const events = fly(s, 15, ask({ tuck: 1 }));
    fly(s, 1 / 120, ask({ reset: true }), events);
    expect(phases(events)).toContain("restart");
    expect(s.para!.mode).toBe("ready");
    expect(Math.hypot(s.skier.x - start.x, s.skier.z - start.z)).toBeLessThan(1);
  });

  it("keeps the helicopter and the snowmobile off while the rig is on him", () => {
    const s = rig();
    expect(heliWithin(s)).toBe(false);
    expect(sledWithin(s)).toBe(false);
  });

  it("is deterministic", () => {
    const run = () => {
      const s = rig();
      fly(s, 30, (st) => paraPilot(st));
      return [s.skier.x, s.skier.y, s.skier.z, s.para!.x, s.para!.y, s.para!.z];
    };
    expect(run()).toEqual(run());
  });

  it("reads the pilot's controls off his own keys", () => {
    expect(paraControls(ask({ tuck: 1, brake: 0.5, steer: -1, lean: 1 }))).toEqual({
      throttle: 1,
      brake: 0.5,
      steer: -1,
      bar: -1,
    });
  });

  it("starts on the summit of a generated mountain", () => {
    const level = levelFor(7);
    const at = paraStartOf(level);
    const top = level.track.points[0];
    expect(level.groundAt(at.x, at.z)).toBeGreaterThanOrEqual(level.groundAt(top.x, top.z) - 1);
    const s = createGame({ level, mode: "free", para: true, crowd: 0, quiet: true });
    expect(s.para?.mode).toBe("ready");
    expect(s.heli?.rider ?? false).toBe(false);
  });
});

describe("the RUN row's paramotor (free-ride.ts)", () => {
  it("stands the ride up under the wing, never by lift or at a spot", () => {
    const ride = {
      ...freshRide(),
      run: { seed: 7, region: freshRide().region, id: PARA_RUN },
      spot: { seed: 7, x: 100, z: 100 },
    };
    expect(paraOn(ride, 7)).toBe(true);
    expect(paraOn(ride, 8)).toBe(false);
    expect(sledOn(ride, 7)).toBe(false);
    expect(heliOn(ride, 7)).toBe(false);
    const options = freeGameOptions(ride, 7, { spec: SKIS, assist: { yaw: 1, air: 1 } });
    expect(options.para).toBe(true);
    expect(options.byLift).toBe(false);
    expect(options.spawn).toBeUndefined();
  });

  it("is a link's too, and the HUD reads the flight", () => {
    expect(readParams("?start=free&para=1").para).toBe(true);
    expect(readParams("?start=free").para).toBe(false);
    const s = rig();
    expect(takeSnapshot(s).para?.kind).toBe("ready");
    fly(s, 15, ask({ tuck: 1 }));
    const up = takeSnapshot(s).para;
    expect(up?.kind).toBe("flying");
    expect(up!.height).toBeGreaterThan(1);
    expect(up!.throttle).toBeGreaterThan(0.9);
    fly(s, 1 / 120, ask({ machine: true }));
    expect(takeSnapshot(s).para).toBeNull();
  });
});
