// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THINGS THAT GO WRONG ON THEIR OWN (`engine/game/mishaps.ts`, its numbers
// `defs/mishaps.ts`): a main canopy's line twists, a line over it and a hard
// opening; the paramotor's cravat and twists; the plane's engine coughing
// and stopping into a glide, and the helicopter's turbine stopping into
// AUTOROTATION — the rotor's rpm bled off under a collective held up, kept
// by one lowered at once. Dealt only on a free ride that asked, off a
// stream of their own. On the synthetic flat map and a generated mountain.

import { describe, expect, it } from "vitest";
import {
  AUTOROTATION,
  MISHAPS,
  NEUTRAL_INPUT,
  TUNING,
  createGame,
  pilotInput,
  planeAloft,
  skydiveAt,
  step,
  type ChuteEvent,
  type GameEvent,
  type GameState,
  type HeliControls,
  type MishapState,
  type SkierInput,
} from "@engine";

import { levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const dt = TUNING.dt;
const SIZE = 4000;
const N = NEUTRAL_INPUT;
const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...N, ...o });
const steps = (s: number): number => Math.round(s / dt);

/** A mishap stream that draws `draws` in turn (then 0.5s): the odds met
 * on the first, the kind and its shape on the rest. */
function rigged(draws: number[]): MishapState {
  let i = 0;
  const next = (): number => (i < draws.length ? draws[i++] : 0.5);
  return {
    rate: "often",
    rng: {
      next,
      range: (a, b) => a + (b - a) * next(),
      int: (a, b) => a + Math.floor(next() * (b - a + 1)),
      chance: (p) => next() < p,
      pick: (items) => items[Math.floor(next() * items.length)],
    },
  };
}

function run(
  s: GameState,
  seconds: number,
  input: SkierInput | ((s: GameState) => SkierInput),
  until: (s: GameState) => boolean = () => false,
): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < steps(seconds) && !until(s); i++) {
    step(s, typeof input === "function" ? input(s) : input);
    out.push(...s.events);
  }
  return out;
}

const chuteSaid = (events: GameEvent[], phase: ChuteEvent["phase"]): boolean =>
  events.some((e) => e.kind === "chute" && e.phase === phase);

describe("whether a ride is dealt mishaps", () => {
  it("deals none unless a free ride asks", () => {
    const level = flatLevel({ size: SIZE });
    expect(createGame({ level, mode: "free", plane: true, quiet: true }).mishaps).toBeUndefined();
    const ask = { rate: "rare", salt: 7 } as const;
    expect(createGame({ level, mishaps: ask, quiet: true }).mishaps).toBeUndefined();
    expect(createGame({ level, mode: "free", mishaps: ask, quiet: true }).mishaps?.rate).toBe(
      "rare",
    );
  });

  it("deals about the odds each rate names, the same way for the same seed and salt", () => {
    const level = flatLevel({ size: SIZE });
    const share = (rate: "rare" | "often", salt: number): number => {
      const s = createGame({ level, mode: "free", mishaps: { rate, salt }, quiet: true });
      let hit = 0;
      for (let i = 0; i < 4000; i++) if (s.mishaps!.rng.next() < MISHAPS.odds[rate].plane) hit++;
      return hit / 4000;
    };
    expect(share("rare", 3)).toBeCloseTo(MISHAPS.odds.rare.plane, 1);
    expect(share("often", 3)).toBeCloseTo(MISHAPS.odds.often.plane, 1);
    expect(share("rare", 3)).toBe(share("rare", 3));
  });
});

describe("the parachute's malfunctions", () => {
  /** In freefall high over the flat map, the main pulled, with `mal`. */
  function opened(draws: number[] | null): { s: GameState; events: GameEvent[] } {
    const s = createGame({
      level: flatLevel({ size: SIZE }),
      mode: "free",
      plane: true,
      crowd: 0,
      quiet: true,
    });
    if (draws) s.mishaps = rigged(draws);
    skydiveAt(s, { x: SIZE / 2, z: SIZE / 2 - 1000, agl: 1600, fall: 52 });
    const events = run(s, 1, N);
    events.push(...run(s, TUNING.dt, ask({ machine: true })));
    events.push(...run(s, 8, N, (r) => r.chute!.mode === "open"));
    return { s, events };
  }

  it("deals none to a ride that did not ask", () => {
    const { s } = opened(null);
    expect(s.chute!.mode).toBe("open");
    expect(s.chute!.mal).toBeUndefined();
  });

  it("twists the lines: the toggles out of reach, unwound slowly alone and faster kicked", () => {
    const untwist = (kick: boolean): number => {
      const { s, events } = opened([0, 0.1, 0.2, 0.5]);
      expect(s.chute!.mal).toBe("twist");
      expect(chuteSaid(events, "malfunction")).toBe(true);
      expect(Math.abs(s.chute!.twist!)).toBeGreaterThan(2 * Math.PI);
      const t0 = s.t;
      const out = run(s, 90, ask({ steer: kick ? 1 : 0 }), (r) => r.chute!.twist === undefined);
      expect(chuteSaid(out, "untwist")).toBe(true);
      return s.t - t0;
    };
    const alone = untwist(false);
    const kicked = untwist(true);
    expect(kicked).toBeLessThan(alone / 2.5);
    expect(kicked).toBeLessThan(12);
  });

  it("spirals under a line over the canopy, and the reserve flies after a cut-away", () => {
    const normal = opened(null).s;
    run(normal, 12, N);
    const fine = -normal.skier.vy;
    const { s } = opened([0, 0.95, 0.7]);
    expect(s.chute!.mal).toBe("lineover");
    run(s, 12, ask({ steer: -1 }));
    expect(-s.skier.vy).toBeGreaterThan(fine * 1.8);
    run(s, TUNING.dt, ask({ machine: true }));
    run(s, 0.3, N);
    const out = run(s, TUNING.dt, ask({ machine: true }));
    out.push(...run(s, 8, N, (r) => r.chute!.reserve && r.chute!.mode === "open"));
    expect(chuteSaid(out, "open")).toBe(true);
    expect(s.chute!.over).toBeUndefined();
    run(s, 10, N);
    expect(-s.skier.vy).toBeLessThan(fine * 1.6);
  });

  it("opens hard: the slider slammed down, past twice a normal opening's peak", () => {
    const normal = opened(null).s.chute!.peak;
    const { s } = opened([0, 0.6]);
    expect(s.chute!.mal).toBe("hard");
    expect(normal).toBeLessThan(MISHAPS.hard.hurt);
    expect(s.chute!.peak).toBeGreaterThan(2 * normal);
    expect(s.chute!.peak).toBeLessThan(20);
  });
});

describe("the paramotor's cravat and launch twists", () => {
  /** A paramotor ride on a long face, `draws` its mishap stream. */
  function rig(draws: number[] | null): GameState {
    const level = flatLevel({
      grade: 0.3,
      slopeFrom: 120,
      runOut: { at: 1500, bend: 300 },
      packed: 1,
    });
    const s = createGame({ level, mode: "free", para: true, crowd: 0, quiet: true });
    if (draws) s.mishaps = rigged(draws);
    return s;
  }
  const paraSaid = (events: GameEvent[], phase: string): boolean =>
    events.some((e) => e.kind === "para" && e.phase === phase);

  it("launches with its lines twisted when dealt, kicked out on the edge", () => {
    const clean = rig(null);
    run(clean, 12, ask({ tuck: 1 }));
    expect(clean.para!.twist).toBeUndefined();
    const s = rig([0, 0.2, 0.5]);
    const events = run(s, 6, ask({ tuck: 1 }), (r) => r.para!.mode === "flown");
    expect(paraSaid(events, "twist")).toBe(true);
    expect(Math.abs(s.para!.twist!)).toBeGreaterThan(2 * Math.PI);
    const out = run(s, 20, ask({ tuck: 1, steer: 1 }), (r) => r.para!.twist === undefined);
    expect(paraSaid(out, "untwist")).toBe(true);
  });

  it("drags round toward a cravat and sinks, and a sharp pump of the brakes frees it", () => {
    const climb = (cravat: boolean): { s: GameState; turn: number; sink: number } => {
      const s = rig([0.99, 0]);
      run(s, 14, ask({ tuck: 1 }));
      expect(s.para!.flying).toBe(true);
      if (cravat) s.para!.cravat = 1;
      run(s, 2, ask({ tuck: 0.4 }));
      const h0 = s.para!.heading;
      const y0 = s.para!.y;
      run(s, 4, ask({ tuck: 0.4 }));
      return { s, turn: s.para!.heading - h0, sink: y0 - s.para!.y };
    };
    const fine = climb(false);
    const caught = climb(true);
    expect(caught.turn - fine.turn).toBeGreaterThan(0.3);
    expect(caught.sink).toBeGreaterThan(fine.sink);
    // A slow squeeze does nothing; a sharp pump frees it.
    const s = caught.s;
    run(s, 0.3, ask({ tuck: 0.4 }));
    const t0 = s.t;
    run(s, 2, (r) => ask({ tuck: 0.4, brake: Math.min(1, (r.t - t0) / 1.5) }));
    expect(s.para!.cravat).toBe(1);
    run(s, 0.3, ask({ tuck: 0.4 }));
    const out = run(s, 0.3, ask({ tuck: 0.4, brake: 1 }));
    expect(paraSaid(out, "freed")).toBe(true);
    expect(s.para!.cravat).toBeUndefined();
  });
});

describe("the helicopter's engine failure and autorotation", () => {
  const level = levelFor(1);
  const hands = (o: Partial<HeliControls>): SkierInput => ({
    ...N,
    heli: { collective: 0, pitch: 0, roll: 0, pedal: 0, ...o },
  });
  /** Flown up by the bot, then lifted high over the middle of the map and
   * held there a moment on its own collective. */
  function up(): GameState {
    const s = createGame({ level, mode: "free", heli: true, crowd: 0, quiet: true });
    const h = s.heli!;
    const aim = { x: s.level.size / 2, z: s.level.size / 2, height: 300 };
    run(s, 25, (r) => pilotInput(r, aim));
    h.y += 500;
    h.vy = 0;
    run(s, 3, hands({ collective: h.controls.collective }));
    return s;
  }

  it("deals a stoppage at the lift-off of a ride whose odds it meets, and none otherwise", () => {
    const s = createGame({ level, mode: "free", heli: true, crowd: 0, quiet: true });
    s.mishaps = rigged([0, 0]);
    const aim = { x: s.level.size / 2, z: s.level.size / 2, height: 300 };
    run(s, 3, (r) => pilotInput(r, aim));
    expect(s.heli!.engine?.due).toBeGreaterThan(MISHAPS.engine.heli.after[0] - 4);
    s.heli!.y += 500;
    s.heli!.vy = 0;
    const events = run(
      s,
      30,
      hands({ collective: s.heli!.controls.collective }),
      (r) => r.heli!.engine?.out === true,
    );
    expect(s.heli!.engine?.out).toBe(true);
    expect(events.some((e) => e.kind === "heli" && e.phase === "engine")).toBe(true);
    expect(up().heli!.engine).toBeUndefined();
  });

  it("bleeds the rotor's rpm into a stall under a collective held up", () => {
    const s = up();
    const h = s.heli!;
    h.engine = { due: 0, cough: 0, out: true };
    run(s, 3, hands({ collective: h.controls.collective }));
    expect(h.spool).toBeLessThan(AUTOROTATION.stall);
  });

  it("keeps the rpm in a steady autorotation with the collective lowered at once", () => {
    const s = up();
    const h = s.heli!;
    h.engine = { due: 0, cough: 0, out: true };
    const levelled = (r: GameState): SkierInput => {
      const d = r.heli!.disc;
      const spd = Math.hypot(r.heli!.vx, r.heli!.vz);
      const target = Math.max(-0.35, Math.min(0.1, -0.08 - 0.02 * (30 - spd)));
      const clip = (v: number): number => Math.max(-1, Math.min(1, v));
      return hands({
        collective: 0.08,
        pitch: clip(3 * (d.pitch - target) + 0.8 * d.pitchRate),
        roll: clip(-3 * d.roll - 0.8 * d.rollRate),
        pedal: clip(-2 * r.heli!.yawRate),
      });
    };
    run(s, 15, levelled);
    expect(h.spool).toBeGreaterThan(0.85);
    expect(-h.vy).toBeGreaterThan(5);
    expect(-h.vy).toBeLessThan(13);
  }, 30000);
});

describe("the plane's engine failure", () => {
  it("coughs, stops, windmills and glides near nine to one", () => {
    const s = createGame({
      level: flatLevel({ size: SIZE }),
      mode: "free",
      plane: true,
      crowd: 0,
      quiet: true,
    });
    planeAloft(s, { x: SIZE / 2, y: 900, z: SIZE / 2 - 1500, heading: 0, speed: 45, power: 0.7 });
    const p = s.plane!;
    p.engine = { due: 1e-6, cough: MISHAPS.engine.plane.cough, out: false };
    const y0 = p.y;
    const z0 = p.z;
    const events = run(s, 50, (r) => {
      const q = r.plane!;
      const pitch = Math.max(-1, Math.min(1, 0.08 * (q.airspeed - 36)));
      return {
        ...N,
        plane: { throttle: 1, pitch: -pitch, roll: -2 * q.roll, yaw: 0, flaps: 0, brake: 0 },
      };
    });
    const said = events.flatMap((e) => (e.kind === "plane" ? [e.phase] : []));
    expect(said.indexOf("cough")).toBeGreaterThanOrEqual(0);
    expect(said.indexOf("engine")).toBeGreaterThan(said.indexOf("cough"));
    expect(p.power).toBeLessThan(0.01);
    expect(p.spin).toBeGreaterThan(0.1);
    expect((p.z - z0) / (y0 - p.y)).toBeGreaterThan(7);
  }, 30000);
});
