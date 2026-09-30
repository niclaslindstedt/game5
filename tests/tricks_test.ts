// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICKS: the strokes turn a flying skier only on a run that counts
// tricks, and only from a flight going up; a staged backflip, a front flip,
// a 360 and a grab each score; the combo banks on a clean landing, banks at
// its base on a sketchy one and is lost to a wipeout or a landing taken in a
// grab; the buzzer pays what is in hand; the by-the-metre half of the air
// weighs what the by-the-second half does; and the terrain park (R20) is
// laid only on a map asked for one, graded, and passes its own analysis.

import { describe, expect, it } from "vitest";

import {
  LEVEL_RULES,
  NEUTRAL_INPUT,
  SKIS,
  TUNING,
  airPointsPerSecond,
  analyzeLevel,
  botInput,
  createGame,
  generateLevel,
  inertiaOf,
  landingGrade,
  lengthPointsPerMetre,
  placeRun,
  poseOf,
  nearestTrackPoint,
  step,
  trackPointAt,
  type GameEvent,
  type GameMode,
  type GameState,
  type RunMoment,
  type SkierInput,
} from "@engine";
import { snapInput } from "../pwa/src/game/ghost.ts";
import { createReplayRig, keepsReplay } from "../pwa/src/game/replay.ts";
import { comboLine } from "../pwa/src/game/strings.ts";
import { comboTile } from "../pwa/src/game/trick-tile.ts";
import { flatLevel, syntheticLevel } from "./support/synthetic.ts";

/** A flight a kicker would have thrown: 1.2 m up, climbing 8.5 m/s, at
 * 65 km/h over packed snow — about 1.9 s in the air. */
const LAUNCH: RunMoment = { x: 1500, z: 200, heading: 0, speed: 18, height: 1.2, vy: 8.5 };

function staged(mode: GameMode = "tricks", moment: RunMoment = LAUNCH): GameState {
  const state = createGame({ level: flatLevel({ packed: 1 }), mode, countdown: 0, quiet: true });
  placeRun(state, moment);
  return state;
}

/** Ride `seconds` with the controls `at(t)` asks for; every event kept. */
function ride(state: GameState, seconds: number, at: (t: number) => Partial<SkierInput>) {
  const events: GameEvent[] = [];
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, { ...NEUTRAL_INPUT, tuck: 1, ...at(i * TUNING.dt) });
    events.push(...state.events);
  }
  return events;
}

const tricksOf = (events: GameEvent[]): string[] =>
  events.flatMap((e) => (e.kind === "trick" ? [e.trick] : []));
const BACKFLIP = (t: number): Partial<SkierInput> => ({ lean: t < 1.2 ? 1 : 0 });

describe("a staged backflip", () => {
  it("scores: the flip, the air it was turned in, and the combo banked on a clean landing", () => {
    const state = staged();
    const events = ride(state, 4, BACKFLIP);
    expect(tricksOf(events)).toEqual(["air", "backflip", "landing"]);
    expect(events.some((e) => e.kind === "wipeout")).toBe(false);
    const land = events.find((e) => e.kind === "land");
    expect(land?.kind === "land" && land.harsh).toBe(false);
    const combo = events.find((e) => e.kind === "combo");
    // The air's rung, the flip's, and the clean landing's beside it.
    expect(combo?.kind === "combo" && combo.mult).toBe(4);
    expect(combo?.kind === "combo" && combo.sketchy).toBe(false);
    expect(state.tricks.score).toBeGreaterThan(1500);
    expect(state.tricks.score).toBe(combo?.kind === "combo" ? combo.points : -1);
  });

  it("replays to the same score", () => {
    const a = staged();
    const b = staged();
    ride(a, 4, BACKFLIP);
    ride(b, 4, BACKFLIP);
    expect(a.tricks.score).toBe(b.tricks.score);
    expect(a.skier.x).toBe(b.skier.x);
  });

  it("is not a stroke on a run that does not count tricks", () => {
    const state = staged("race");
    ride(state, 0.5, BACKFLIP);
    expect(state.tricks.pumped).toBe(0);
    // The lean's own torque still pitches it: it is the air control.
    expect(state.skier.wx).toBeLessThan(0);
    const tricked = staged();
    ride(tricked, 0.5, BACKFLIP);
    expect(tricked.skier.wx).toBeLessThan(state.skier.wx - 1.5);
  });

  it("cannot be opened on the way down", () => {
    const state = staged("tricks", { ...LAUNCH, height: 5, vy: -1 });
    ride(state, 0.6, () => ({ lean: 1 }));
    expect(state.tricks.pumped).toBe(0);
    expect(state.tricks.tricking).toBe(false);
  });

  it("takes one stroke a tap, out of the flight's budget", () => {
    const state = staged();
    const tap = (t: number): Partial<SkierInput> => ({
      lean: Math.floor(t / 0.05) % 2 === 0 ? 1 : 0,
    });
    ride(state, 1, tap);
    expect(state.tricks.pumped).toBeCloseTo(TUNING.tricks.flipCeiling, 6);
  });
});

describe("a stroke is a throw, not a snap", () => {
  const yawRate = (seconds: number, at: (t: number) => Partial<SkierInput>): number[] => {
    const state = staged();
    const rates: number[] = [];
    for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
      step(state, { ...NEUTRAL_INPUT, tuck: 1, ...at(i * TUNING.dt) });
      rates.push(state.skier.wy);
    }
    return rates;
  };
  const at = (rates: number[], t: number): number => rates[Math.round(t * TUNING.physicsHz) - 1];
  const bought = TUNING.tricks.spin / inertiaOf(SKIS).y;

  it("gathers the rate it bought over the wind-up rather than in the step", () => {
    const rates = yawRate(0.6, (t) => ({ steer: t < 0.1 ? 1 : 0 }));
    expect(rates[0]).toBeLessThan(bought * 0.1);
    expect(at(rates, 0.1)).toBeLessThan(bought * 0.5);
    // Still rising past the throw itself...
    expect(at(rates, 0.3)).toBeGreaterThan(at(rates, 0.15));
    // ...and at the rate the stroke bought once it has settled.
    expect(at(rates, 0.6)).toBeGreaterThan(bought * 0.85);
  });

  it("a 360 held keeps winding up; let go, it coasts down", () => {
    const held = yawRate(1.2, () => ({ steer: 1 }));
    expect(at(held, 1.2)).toBeGreaterThan(at(held, 0.6) + 1);
    expect(at(held, 1.2)).toBeGreaterThan(bought * 1.4);
    const loose = yawRate(1.2, (t) => ({ steer: t < 0.2 ? 1 : 0 }));
    expect(at(loose, 1.2)).toBeLessThan(at(loose, 0.6));
  });
});

describe("the other elements", () => {
  it("a front flip: the lean forward", () => {
    const state = staged();
    const events = ride(state, 4, (t) => ({
      lean: t < 1.2 ? -1 : 0,
      tuck: 0,
    }));
    expect(tricksOf(events)).toContain("frontflip");
    expect(state.tricks.score).toBeGreaterThan(0);
  });

  it("a 360: the edge thrown over", () => {
    const state = staged();
    const events = ride(state, 4, (t) => ({ steer: t < 0.4 ? 1 : 0 }));
    expect(tricksOf(events)).toContain("spin");
  });

  it("a grab held, let go before the snow: an element, and the combo kept", () => {
    const state = staged();
    const events = ride(state, 4, (t) => ({
      trick: t < 0.8,
      lean: t < 0.8 ? 1 : 0,
    }));
    expect(tricksOf(events)).toEqual(["air", "spread"]);
    expect(events.some((e) => e.kind === "combo")).toBe(true);
    expect(state.tricks.score).toBeGreaterThan(0);
  });

  it("a grab is picked by the lean and the edge", () => {
    const at = (steer: number, lean: number): string =>
      poseOf({ ...NEUTRAL_INPUT, steer, lean, trick: true });
    expect(at(1, 0)).toBe("daffy");
    expect(at(0, 1)).toBe("spread");
    expect(at(0, -1)).toBe("grab");
    expect(at(0, 0)).toBe("grab");
  });
});

describe("losing the combo", () => {
  it("a landing taken still in a grab loses it", () => {
    const state = staged();
    const events = ride(state, 3, () => ({ trick: true }));
    const bail = events.find((e) => e.kind === "bail");
    expect(bail?.kind === "bail" && bail.cause).toBe("pose");
    expect(state.tricks.score).toBe(0);
  });

  it("a wipeout loses it", () => {
    // A landing over the tips (the ride lab's), with a combo in hand.
    const state = staged("tricks", {
      x: 1500,
      z: 200,
      heading: 0,
      speed: 60 / 3.6,
      height: 2.5,
      vy: -3,
      pitch: -0.7,
    });
    state.tricks.base = 400;
    state.tricks.mult = 3;
    const events = ride(state, 2, () => ({ tuck: 0 }));
    const bail = events.find((e) => e.kind === "bail");
    expect(bail?.kind === "bail" && bail.cause).toBe("wipeout");
    // What was in hand, and the fall's own air besides.
    expect(bail?.kind === "bail" && bail.lost).toBeGreaterThanOrEqual(1200);
    expect(state.tricks.score).toBe(0);
  });

  it("a sketchy landing banks it at its base alone", () => {
    // Flat from high: the legs fold to the stop.
    const state = staged("tricks", { ...LAUNCH, height: 6, vy: 2 });
    state.tricks.base = 400;
    state.tricks.mult = 3;
    const events = ride(state, 3, () => ({ tuck: 0 }));
    const combo = events.find((e) => e.kind === "combo");
    expect(combo?.kind === "combo" && combo.sketchy).toBe(true);
    expect(combo?.kind === "combo" && combo.mult).toBe(1);
    expect(state.tricks.score).toBeLessThan(1200);
  });
});

describe("the tricks run", () => {
  it("ends at its buzzer and pays what is in hand", () => {
    const state = createGame({ level: flatLevel(), mode: "tricks", quiet: true });
    expect(state.rules.tricks).toBe(true);
    expect(state.rules.course).toBe(false);
    expect(state.rules.rivals).toBe(0);
    state.rules.limit = 1;
    state.tricks.base = 250;
    const events = ride(state, 5, () => ({}));
    expect(events.filter((e) => e.kind === "finish")).toHaveLength(1);
    expect(state.phase).toBe("finished");
    expect(state.tricks.score).toBe(250);
  });

  it("every other mode keeps no buzzer and turns no tricks", () => {
    for (const mode of ["race", "timeTrial", "free"] as const) {
      const state = createGame({ level: flatLevel(), mode, quiet: true });
      expect(state.rules.tricks).toBe(false);
      expect(state.rules.limit).toBe(0);
    }
  });
});

describe("the air's two halves", () => {
  it("weigh the same at the reference speed", () => {
    const T = TUNING.tricks;
    const v = T.lengthKnee / T.airKnee;
    const dt = 1e-3;
    let seconds = 0;
    let metres = 0;
    for (let t = 0; t < 3; t += dt) {
      seconds += airPointsPerSecond(t) * dt;
      metres += lengthPointsPerMetre(v * t) * v * dt;
    }
    expect(metres).toBeCloseTo(seconds, 6);
  });
});

describe("the landing, judged", () => {
  /** A flight dropped onto the flat from `height` m climbing `vy` m/s, with
   * nothing turned in it; what it reported and what it won. */
  function drop(height: number, vy: number) {
    const state = staged("tricks", { ...LAUNCH, height, vy });
    const base = () => state.tricks.base;
    let land: Extract<GameEvent, { kind: "land" }> | null = null;
    const won: Extract<GameEvent, { kind: "trick" }>[] = [];
    let before = 0;
    for (let i = 0; i < 4 * TUNING.physicsHz && !land; i++) {
      before = base();
      step(state, { ...NEUTRAL_INPUT, tuck: 1 });
      for (const e of state.events) {
        if (e.kind === "land") land = e;
        if (e.kind === "trick") won.push(e);
      }
    }
    return { state, land, won, paid: base() - before };
  }

  it("grades a landing by the share of what the legs take", () => {
    const state = staged();
    const harsh = TUNING.air.harshSpeed;
    expect(landingGrade(state.skier, 0)).toBe(0);
    expect(landingGrade(state.skier, harsh)).toBeCloseTo(1, 6);
  });

  it("pays a clean one by how soft it was, a perfect one as its own tier, a hard one nothing", () => {
    const T = TUNING.tricks;
    const tiers = new Set<number>();
    for (const [height, vy] of [
      [1.2, 0],
      [1.4, 1],
      [2, 0],
      [3, 0],
      [1.2, 8.5],
    ]) {
      const { state, land, won, paid } = drop(height, vy);
      expect(land).not.toBeNull();
      const grade = landingGrade(state.skier, land?.impact ?? 0);
      const landing = won.find((e) => e.trick === "landing");
      if (land && land.airTime >= T.airElement && grade <= T.cleanLanding) {
        expect(landing?.spins).toBe(grade <= T.perfectLanding ? 2 : 1);
        expect(landing?.points).toBeCloseTo(T.landPoints * (1 - grade / T.cleanLanding), 6);
        expect(paid).toBeGreaterThanOrEqual((landing?.points ?? Infinity) - 1e-9);
        // Nothing turned in the flight: the landing multiplies nothing.
        expect(state.tricks.mult).toBe(1);
        tiers.add(landing?.spins ?? 0);
      } else {
        expect(landing).toBeUndefined();
        tiers.add(0);
      }
    }
    // The spread covers a landing that is clean and one that is not.
    expect(tiers.has(0)).toBe(true);
    expect(tiers.has(1) || tiers.has(2)).toBe(true);
  });

  it("is what the park's built landings are for: the high lip landed whole at speed", () => {
    const level = generateLevel(1, { tricks: true });
    const high = (level.kickers ?? []).find((k) => k.size === "high");
    expect(high).toBeDefined();
    const k = high as NonNullable<typeof high>;
    const fly = (kmh: number) => {
      const state = createGame({ level, mode: "tricks", countdown: 0, quiet: true });
      const at = trackPointAt(level, (k.s ?? 0) - k.ramp - 5);
      placeRun(state, { x: at.x, z: at.z, heading: at.heading, speed: kmh / 3.6 });
      for (let i = 0; i < 8 * TUNING.physicsHz; i++) {
        const c = state.skier;
        const v = c.speed * 3.6;
        step(state, {
          ...NEUTRAL_INPUT,
          tuck: c.airborne ? 0 : v < kmh ? 1 : 0,
          brake: !c.airborne && v > kmh + 4 ? 0.5 : 0,
        });
        for (const e of state.events) {
          const u = (c.x - k.x) * Math.sin(k.heading) + (c.z - k.z) * Math.cos(k.heading);
          if (e.kind === "land" && u > 0) return e;
        }
      }
      return null;
    };
    const ok = fly(70);
    expect(ok?.airTime).toBeGreaterThan(1.5);
    expect(ok?.harsh).toBe(false);
    // Taken far too fast it overshoots the slope onto the run-out.
    expect(fly(105)?.harsh).toBe(true);
  });
});

describe("the terrain park (R20)", () => {
  const seed = 3;
  const race = generateLevel(seed);
  const tricks = generateLevel(seed, { tricks: true });
  const field = (tricks.kickers ?? []).filter((k) => k.trick);
  const F = LEVEL_RULES.trick;

  it("is laid only on a map asked for one, on the seed's own piste", () => {
    expect((race.kickers ?? []).some((k) => k.trick)).toBe(false);
    expect(field.length).toBeGreaterThanOrEqual(F.count.min);
    expect(field.length).toBeLessThanOrEqual(F.count.max);
    expect(tricks.attempt).toBe(race.attempt);
    expect(tricks.track.length).toBe(race.track.length);
    expect(tricks.checkpoints.map((c) => c.s)).toEqual(race.checkpoints.map((c) => c.s));
  });

  it("comes in three sizes, each built to its row, spaced and clear of the start gate", () => {
    expect(new Set(field.map((k) => k.size))).toEqual(new Set(F.order));
    field.forEach((k, i) => {
      const z = F.sizes[k.size ?? "low"];
      expect(k.height).toBe(z.height);
      expect(k.shape).toEqual({ deck: z.deck, fall: z.fall, dig: z.dig });
      expect(k.landing).toBe(z.deck + z.fall + z.runout);
      expect((k.s ?? 0) - k.ramp).toBeGreaterThanOrEqual(F.lead - 1e-6);
      expect((k.s ?? 0) + k.landing).toBeLessThanOrEqual(tricks.track.length - F.lead + 1e-6);
      const next = field[i + 1];
      if (next)
        expect((next.s ?? 0) - next.ramp - ((k.s ?? 0) + k.landing)).toBeGreaterThan(F.gap - 1e-6);
      // Stamped AGAINST THE HORIZONTAL: the lip stands its height over the
      // altitude of the ramp's foot (less what the two-metre grid shaves off
      // a kink) — so over the line it stands that plus the line's own fall
      // under the ramp — the deck is level at the lip's altitude, and the
      // landing slope's foot lies dug under the line the race rides.
      const lift = (u: number): number => {
        const p = trackPointAt(tricks, (k.s ?? 0) + u);
        return tricks.groundAt(p.x, p.z) - race.groundAt(p.x, p.z);
      };
      const altitude = (u: number): number => {
        const p = trackPointAt(tricks, (k.s ?? 0) + u);
        return tricks.groundAt(p.x, p.z);
      };
      const fallUnderRamp = altitude(-k.ramp) - trackPointAt(race, k.s ?? 0).y;
      // The grid rounds a tenth or so off the whole kink, the line's fall included.
      expect(altitude(0) - altitude(-k.ramp)).toBeGreaterThan(
        k.height - 0.12 * (k.height + fallUnderRamp),
      );
      expect(lift(0)).toBeLessThan(k.height + fallUnderRamp + 0.01);
      if (z.deck > 0) expect(altitude(z.deck / 2)).toBeCloseTo(altitude(0), 0);
      expect(lift(z.deck + z.fall)).toBeLessThan(-z.dig * 0.85);
      expect(Math.abs(lift(k.landing + 2))).toBeLessThan(0.05);
    });
  });

  it("changes the track and nothing else of the country", () => {
    expect(tricks.spawn).toEqual(race.spawn);
    expect((tricks.kickers ?? []).filter((k) => !k.trick)).toEqual(race.kickers);
    // The woods are the race map's, less a few trees on the ground the park
    // was shaped out of beside the piste — and where one stands, it stands
    // on the ground as it now lies.
    const key = (t: { x: number; z: number }): string => `${t.x},${t.z}`;
    const kept = new Set(tricks.trees.map(key));
    const stood = new Set(race.trees.map(key));
    const gone = race.trees.filter((t) => !kept.has(key(t)));
    expect(tricks.trees.every((t) => stood.has(key(t)))).toBe(true);
    expect(gone.length).toBeLessThan(race.trees.length * 0.02);
    const reach = LEVEL_RULES.track.width.max / 2 + LEVEL_RULES.track.shoulder.flat + 40;
    for (const t of gone) expect(nearestTrackPoint(race, t.x, t.z).distance).toBeLessThan(reach);
    for (const t of tricks.trees) expect(t.y).toBeCloseTo(tricks.groundAt(t.x, t.z), 3);
    // Far from the piste the ground is the race map's to the millimetre.
    for (const t of race.trees.slice(0, 300)) {
      if (nearestTrackPoint(race, t.x, t.z).distance > reach) {
        expect(tricks.groundAt(t.x, t.z)).toBeCloseTo(race.groundAt(t.x, t.z), 3);
      }
    }
  });

  it("stands every map of a spread on the race map's own attempt", () => {
    for (const s of [1, 2, 4, 6, 7]) {
      expect(generateLevel(s, { tricks: true }).attempt).toBe(generateLevel(s).attempt);
    }
  });

  it("passes its own analysis", () => {
    const errors = analyzeLevel(tricks).findings.filter((f) => f.severity === "error");
    expect(errors).toEqual([]);
  });

  it("is what a tricks run is skied on", () => {
    const state = createGame({ seed, mode: "tricks", quiet: true });
    expect((state.level.kickers ?? []).filter((k) => k.trick)).toHaveLength(field.length);
  });
});

describe("the score as read (strings.ts, trick-tile.ts)", () => {
  it("names a combo in the order it was won, a revolution read into its first", () => {
    expect(
      comboLine([
        { kind: "air", spins: 1, flight: 1 },
        { kind: "backflip", spins: 1, flight: 1 },
        { kind: "backflip", spins: 2, flight: 1 },
        { kind: "spin", spins: 1, flight: 1 },
        { kind: "twist", spins: 1, flight: 1 },
        { kind: "spread", spins: 1, flight: 2 },
      ]),
    ).toBe("BIG AIR + DOUBLE BACKFLIP + 360 + TWIST + SPREAD EAGLE");
    expect(comboLine([{ kind: "spin", spins: 2, flight: 1 }])).toBe("720");
    expect(comboLine([{ kind: "landing", spins: 2, flight: 1 }])).toBe("PERFECT LANDING");
  });

  it("is up on a tricks run only, with the combo in hand and then what it paid", () => {
    expect(comboTile(staged("race"))).toBeNull();
    const state = staged();
    ride(state, 1.8, BACKFLIP);
    const inAir = comboTile(state);
    expect(inAir?.combo?.line).toBe("BIG AIR + BACKFLIP + CLEAN LANDING");
    expect(inAir?.combo?.mult).toBe(4);
    ride(state, 1.6, () => ({}));
    const after = comboTile(state);
    expect(after?.combo).toBeNull();
    expect(after?.last?.points).toBe(state.tricks.score);
    expect(after?.left).toBeCloseTo(state.rules.limit - state.progress.time, 6);
  });
});

describe("a tricks run watched back", () => {
  it("is recorded, the trick button with it, and replays to the same score", () => {
    expect(keepsReplay("tricks")).toBe(true);
    const state = createGame({ level: syntheticLevel(), mode: "tricks", quiet: true });
    const rig = createReplayRig();
    rig.arm(state, "tricks");
    let posed = 0;
    for (let i = 0; i < 130 * TUNING.physicsHz && state.phase !== "finished"; i++) {
      // The bot's run, with the trick button held through the first half
      // second of every flight: a grab, let go before the landing.
      const c = state.skier;
      const input = snapInput({ ...botInput(state), trick: c.airborne && c.airTime < 0.5 });
      if (input.trick) posed += 1;
      step(state, input);
      rig.step(input, state);
    }
    expect(state.phase).toBe("finished");
    expect(posed).toBeGreaterThan(0);
    const replay = rig.open();
    expect(replay).not.toBeNull();
    while (!replay!.over()) step(replay!.state, replay!.input());
    expect(replay!.state.tricks.score).toBe(state.tricks.score);
    expect(state.tricks.score).toBeGreaterThan(0);
  });
});
