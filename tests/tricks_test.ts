// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICKS: the strokes turn a flying skier only on a run that lets him
// (the free ride and tricks), a whole loop a tap on the lean and half a
// turn a tap on the edge, and only with the air left to turn them; a staged
// backflip, a front flip, a 180 ridden away switch, a 360 and a grab each
// score; the combo banks on a clean landing, banks at
// its base on a sketchy one and is lost to a wipeout or a landing taken in a
// grab; the buzzer pays what is in hand; the by-the-metre half of the air
// weighs what the by-the-second half does; and the terrain park (R20) is
// laid only on a map asked for one, graded, and passes its own analysis.

import { describe, expect, it } from "vitest";

import {
  GAME_MODES,
  LEVEL_RULES,
  LYNX,
  NEUTRAL_INPUT,
  TUNING,
  airPointsPerSecond,
  analyzeLevel,
  botInput,
  createGame,
  flipLean,
  generateLevel,
  landingGrade,
  lengthPointsPerMetre,
  placeRun,
  poseOf,
  spinSteer,
  nearestTrackPoint,
  step,
  trackPointAt,
  withSky,
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

/** ...and a landing slope under it — 24°, falling from where the flight
 * comes down, so a trick turned square meets the snow along it rather
 * than flat on the run-out, as a park kicker's built landing has it. */
const LANDING = { packed: 1, grade: 0.45, slopeFrom: 230 };

function staged(
  mode: GameMode = "tricks",
  moment: RunMoment = LAUNCH,
  ground: Parameters<typeof flatLevel>[0] = { packed: 1 },
): GameState {
  // Nobody else out on the snow: a free ride's crowd skis these strips too.
  const state = createGame({ level: flatLevel(ground), mode, countdown: 0, quiet: true, crowd: 0 });
  placeRun(state, moment);
  return state;
}

/** Ride `seconds` with the controls `at(t)` asks for; every event kept. */
function ride(
  state: GameState,
  seconds: number,
  at: (t: number, state: GameState) => Partial<SkierInput>,
) {
  const events: GameEvent[] = [];
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, { ...NEUTRAL_INPUT, tuck: 1, ...at(i * TUNING.dt, state) });
    events.push(...state.events);
  }
  return events;
}

const tricksOf = (events: GameEvent[]): string[] =>
  events.flatMap((e) => (e.kind === "trick" ? [e.trick] : []));
/** A loop held and let go in time to come round onto the skis. */
const BACKFLIP = (_t: number, s: GameState): Partial<SkierInput> => ({ lean: flipLean(s, 1, 1) });

/** The terrain park (R20) is laid on a map of ONE piste — the generator
 * the six trick maps stand on (`trick-maps.ts`); a resort (R25) lays none. */
const PARK = { version: 1 } as const;

describe("a staged backflip", () => {
  it("scores: the flip, the air it was turned in, and the combo banked on a clean landing", () => {
    const state = staged("tricks", LAUNCH, LANDING);
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

  it("is not a stroke on a race", () => {
    const state = staged("timeTrial");
    ride(state, 0.5, BACKFLIP);
    expect(state.tricks.flipGoal).toBe(0);
    // The lean's own torque still pitches it: it is the air control.
    expect(state.skier.wx).toBeLessThan(0);
    const tricked = staged();
    ride(tricked, 0.5, BACKFLIP);
    expect(tricked.skier.wx).toBeLessThan(state.skier.wx - 1.5);
  });

  it("is not taken without the air left to turn it", () => {
    // Half a metre over the snow and falling: no loop comes round in that.
    const state = staged("tricks", { ...LAUNCH, height: 0.5, vy: -1 });
    ride(state, 0.2, () => ({ lean: 1 }));
    expect(state.tricks.flipGoal).toBe(0);
  });

  it("is set in the take-off's window: thrown late, the lean only trims him", () => {
    const set = staged("tricks", { ...LAUNCH, height: 30, vy: 6 });
    ride(set, 0.45, () => ({ lean: 1 }));
    expect(set.tricks.flipSpeed).toBeGreaterThan(TUNING.tricks.flipRate * 0.35);
    // Past the window, the same lean starts nothing.
    const late = staged("tricks", { ...LAUNCH, height: 30, vy: 6 });
    ride(late, 0.5, () => ({}));
    ride(late, 0.5, () => ({ lean: 1 }));
    expect(late.tricks.flipGoal).toBe(0);
    expect(-late.skier.wx).toBeLessThan(2);
  });

  it("turns on once set, the lean let go or not: nothing stands him up on his feet", () => {
    const held = staged("tricks", { ...LAUNCH, height: 30, vy: 6 });
    ride(held, 0.45, () => ({ lean: 1 }));
    const rate = held.tricks.flipSpeed;
    ride(held, 1.5, () => ({}));
    expect(held.tricks.rotation).toBeGreaterThan(2 * Math.PI + 0.5);
    expect(held.tricks.flipSpeed).toBeCloseTo(rate, 6);
  });

  it("is turned faster tucked and slower laid out, and never past the rate it was set at", () => {
    const after = (lean: number) => {
      const state = staged("tricks", { ...LAUNCH, height: 30, vy: 6 });
      ride(state, 0.45, () => ({ lean: 1 }));
      const from = state.tricks.flipDone;
      ride(state, 0.6, () => ({ lean }));
      return { turned: state.tricks.flipDone - from, speed: state.tricks.flipSpeed };
    };
    const tucked = after(1);
    const neutral = after(0);
    const open = after(-1);
    expect(tucked.turned).toBeGreaterThan(neutral.turned * 1.2);
    expect(open.turned).toBeLessThan(neutral.turned * 0.8);
    expect(open.turned).toBeGreaterThan(0);
    // The shape changes the rate, not what was set.
    expect(tucked.speed).toBeCloseTo(neutral.speed, 6);
    expect(neutral.speed).toBeLessThanOrEqual(TUNING.tricks.flipRate);
  });

  it("gathers its rate smoothly, never a snap", () => {
    const state = staged("tricks", { ...LAUNCH, height: 30, vy: 6 });
    const rates: number[] = [];
    ride(state, 1.6, (t, s) => {
      rates.push(-s.skier.wx);
      return { lean: t < 0.7 ? 1 : 0 };
    });
    const jumps = rates.slice(1).map((r, i) => Math.abs(r - rates[i]));
    // No step changes the rate by more than the throw's own pull and the
    // body's change of shape allow (the lean's torque before the gate aside).
    const T = TUNING.tricks;
    const most = (T.flipSet + T.flipRate * T.formRate * (T.tuckForm - 1)) * TUNING.dt;
    expect(Math.max(...jumps.slice(4))).toBeLessThan(most * 1.2);
  });

  it("lands only if it is set right: too little or too much off the lip is a fall", () => {
    /** The lean held `hold` s from the lip, then left alone. */
    const wiped = (hold: number) => {
      const state = staged("tricks", LAUNCH, LANDING);
      const events = ride(state, 4, (t) => ({ lean: t < hold ? 1 : 0 }));
      return events.some((e) => e.kind === "wipeout");
    };
    const holds = [0.16, 0.18, 0.2, 0.22, 0.24, 0.26, 0.28, 0.3, 0.35, 0.4, 0.45];
    const landed = holds.filter((hold) => !wiped(hold));
    expect(landed.length).toBeGreaterThan(0);
    expect(landed.length).toBeLessThan(holds.length / 2);
    expect(wiped(0.45)).toBe(true);
  });
});

describe("a free ride's flight that was never meant", () => {
  /** On the groomer at 65 km/h. */
  const ROLLING: RunMoment = { x: 1500, z: 200, heading: 0, speed: 18 };
  /** The edge tapped across its gate once he has been up a while. */
  const tapAloft = (state: GameState) => (): Partial<SkierInput> => ({
    steer: state.skier.airborne && state.skier.airTime > 0.25 ? 1 : 0,
  });

  it("throws nothing off a crest he never jumped: the edge he steers in the air is steering", () => {
    // Thrown off a roller's crest climbing — the flight a kicker would
    // have thrown, but nothing set it up.
    const state = staged("free", LAUNCH, LANDING);
    const events = ride(state, 3, tapAloft(state));
    expect(tricksOf(events)).not.toContain("half");
    expect(state.tricks.spinGoal).toBe(0);
    expect(state.skier.switched).toBe(false);
  });

  it("throws a loop on the lean in a BIG one, off a crest or a drop he never jumped", () => {
    // Off the crest: the lean held once he is up is a backflip, not the
    // lean's slow topple.
    const crest = staged("free", LAUNCH, LANDING);
    const lean = (state: GameState) => (): Partial<SkierInput> => ({
      lean: state.skier.airborne && state.skier.airTime > 0.25 ? flipLean(state, 1, 1) : 0,
    });
    const events = ride(crest, 3, lean(crest));
    expect(events.some((e) => e.kind === "wipeout")).toBe(false);
    expect(Math.abs(crest.skier.pitch)).toBeLessThan(0.6);
    expect(tricksOf(events)).toContain("backflip");
    // Off a drop: 14 m over the snow and not climbing at all.
    const drop = staged("free", { ...ROLLING, height: 14, vy: 0 });
    const rates: number[] = [];
    for (let i = 0; i < 1.6 * TUNING.physicsHz; i++) {
      step(drop, { ...NEUTRAL_INPUT, tuck: 1, ...lean(drop)() });
      rates.push(-drop.skier.wx);
    }
    // One loop turned, held and let go to come round, in about a second.
    const turned = rates.reduce((a, r) => a + r * TUNING.dt, 0);
    expect(turned).toBeGreaterThan(2 * Math.PI - 0.3);
    expect(turned).toBeLessThan(2 * Math.PI + 0.3);
    expect(rates.filter((r) => r > 1).length * TUNING.dt).toBeLessThan(1.8);
    expect(Math.max(...rates)).toBeGreaterThan(TUNING.tricks.flipRate * 0.5);
  });

  it("throws a snowboarder's loop the same way, back and forward", () => {
    for (const lean of [1, -1]) {
      const board = createGame({
        level: flatLevel({ packed: 1 }),
        spec: LYNX,
        mode: "free",
        countdown: 0,
        quiet: true,
        crowd: 0,
      });
      placeRun(board, { ...ROLLING, height: 14, vy: 0 });
      let turned = 0;
      for (let i = 0; i < 1.6 * TUNING.physicsHz; i++) {
        const held = board.skier.airTime > 0.25 ? flipLean(board, 1, lean) : 0;
        step(board, { ...NEUTRAL_INPUT, lean: held });
        turned -= board.skier.wx * TUNING.dt;
      }
      expect(board.skier.board).toBeTruthy();
      expect(Math.abs(turned)).toBeGreaterThan(2 * Math.PI - 0.3);
      expect(Math.sign(turned)).toBe(lean);
    }
  });

  it("leaves the lean the air control in a flight too short for a loop", () => {
    const hop = staged("free", { ...ROLLING, height: 0.6, vy: 3 });
    ride(hop, 0.4, () => ({ lean: hop.skier.airborne && hop.skier.airTime > 0.1 ? 1 : 0 }));
    expect(hop.tricks.flipGoal).toBe(0);
  });

  it("throws a 180 in a flight he popped himself", () => {
    const state = staged("free", ROLLING);
    // The jump held to its full load and let go: an ollie off the flat.
    const full = TUNING.jump.full;
    const events = ride(state, full + 2.5, (t) => ({
      jump: t < full,
      steer: state.skier.airborne && state.skier.airTime > 0.25 && t < full + 0.6 ? 1 : 0,
    }));
    expect(events.some((e) => e.kind === "jump")).toBe(true);
    expect(tricksOf(events)).toContain("half");
  });
});

describe("a spin is set off the lip, not snapped", () => {
  const spun = (seconds: number, at: (t: number, s: GameState) => Partial<SkierInput>) => {
    const state = staged("tricks", { ...LAUNCH, height: 30, vy: 6 });
    const rates: number[] = [];
    for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
      step(state, { ...NEUTRAL_INPUT, tuck: 1, ...at(i * TUNING.dt, state) });
      rates.push(state.skier.wy);
    }
    return { state, rates, yaw: state.tricks.yaw };
  };

  it("gathers its rate over the window and turns on at it", () => {
    const { rates, state } = spun(1.2, (t) => ({ steer: t < 0.45 ? 1 : 0 }));
    expect(Math.abs(rates[0])).toBeLessThan(2);
    expect(Math.max(...rates)).toBeGreaterThan(TUNING.tricks.spinRate * 0.5);
    // Let go, it neither stops nor settles: it is still turning.
    expect(rates[rates.length - 1]).toBeCloseTo(state.tricks.spinSpeed, 6);
    expect(state.tricks.spinSpeed).toBeGreaterThan(3);
  });

  it("a 180 comes down switch and rides away backward, clean", () => {
    const state = staged("tricks", LAUNCH, LANDING);
    const events = ride(state, 4, (_t, s) => ({ steer: spinSteer(s, 1, 1) }));
    expect(tricksOf(events)).toEqual(["air", "half", "landing"]);
    expect(events.some((e) => e.kind === "wipeout")).toBe(false);
    expect(state.skier.switched).toBe(true);
    expect(state.skier.way).toBeLessThan(-5);
  });

  it("the edge pushed further over winds it harder; across after the window it opens him out, never back", () => {
    const soft = spun(0.5, () => ({ steer: 0.62 }));
    const hard = spun(0.5, () => ({ steer: 1 }));
    expect(soft.state.tricks.spinSpeed).toBeLessThan(hard.state.tricks.spinSpeed * 0.8);
    const opened = spun(1.2, (t) => ({ steer: t < 0.45 ? 1 : t > 0.6 ? -1 : 0 }));
    const kept = spun(1.2, (t) => ({ steer: t < 0.45 ? 1 : 0 }));
    expect(opened.yaw).toBeLessThan(kept.yaw);
    expect(Math.min(...opened.rates.slice(60))).toBeGreaterThan(0);
  });

  it("let go of in the wrong place, it comes down crooked", () => {
    // Wound up for a share of the window and left: whatever comes round.
    const wiped = [0.1, 0.15, 0.2, 0.25, 0.3].filter((hold) => {
      const state = staged("tricks", LAUNCH, LANDING);
      const events = ride(state, 4, (t) => ({ steer: t < hold ? 1 : 0 }));
      return events.some((e) => e.kind === "wipeout");
    });
    expect(wiped.length).toBeGreaterThan(0);
  });
});

describe("the other elements", () => {
  it("a front flip: the lean forward", () => {
    const state = staged();
    const events = ride(state, 4, (_t, s) => ({
      lean: flipLean(s, 1, -1),
      tuck: 0,
    }));
    expect(tricksOf(events)).toContain("frontflip");
    expect(state.tricks.score).toBeGreaterThan(0);
  });

  it("a 360: the edge thrown harder", () => {
    const state = staged();
    const events = ride(state, 4, (_t, s) => ({ steer: spinSteer(s, 2, 1) }));
    expect(tricksOf(events)).toContain("spin");
    expect(tricksOf(events)).not.toContain("half");
    expect(state.skier.switched).toBe(false);
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
    // A landing over the tips steep enough to spear the snow (the ride
    // lab's `nose-in`), with a combo in hand.
    const state = staged("tricks", {
      x: 1500,
      z: 200,
      heading: 0,
      speed: 60 / 3.6,
      height: 2.5,
      vy: -3,
      pitch: -1,
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
    for (const mode of ["slalom", "timeTrial", "free"] as const) {
      const state = createGame({ level: flatLevel(), mode, quiet: true });
      expect(state.rules.tricks).toBe(false);
      expect(state.rules.limit).toBe(0);
    }
  });

  it("the strokes and riding switch are the free ride's, the tricks run's and the contests' alone", () => {
    for (const mode of GAME_MODES) {
      const rules = createGame({ level: flatLevel(), mode, quiet: true }).rules;
      expect(rules.stunts).toBe(
        mode === "free" ||
          mode === "tricks" ||
          mode === "slopestyle" ||
          mode === "halfpipe" ||
          mode === "moguls",
      );
    }
    expect(createGame({ level: flatLevel(), quiet: true }).rules.stunts).toBe(false);
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
    // Skied in STILL AIR: the landing's shape is the subject, and the storm
    // this seed deals would carry a flight past it (or short of it) by its
    // own bearing.
    const level = withSky(generateLevel(1, { tricks: true, ...PARK }), {
      weather: { kind: "clear", wind: 0 },
    });
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
  const race = generateLevel(seed, PARK);
  const tricks = generateLevel(seed, { tricks: true, ...PARK });
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
      expect(generateLevel(s, { tricks: true, ...PARK }).attempt).toBe(
        generateLevel(s, PARK).attempt,
      );
    }
  });

  it("passes its own analysis", () => {
    const errors = analyzeLevel(tricks).findings.filter((f) => f.severity === "error");
    expect(errors).toEqual([]);
  });

  it("is what a tricks run is skied on: the park down a ski area's course", () => {
    // Today's generator lays it down the first of the seed's courses that
    // carries one (`resort-park.ts`), the course's gates set round it.
    const state = createGame({ seed: 18, mode: "tricks", quiet: true });
    const park = (state.level.kickers ?? []).filter((k) => k.trick);
    expect(state.level.resort).toBeDefined();
    expect(park.length).toBeGreaterThanOrEqual(F.count.min);
    expect(new Set(park.map((k) => k.size))).toEqual(new Set(F.order));
    for (const k of park) {
      const from = k.s! - k.ramp - F.gateClear.before;
      const to = k.s! + k.landing + F.gateClear.after;
      expect(state.level.checkpoints.some((c) => c.s > from + 1 && c.s < to - 1)).toBe(false);
    }
    const errors = analyzeLevel(state.level, { network: false }).findings;
    expect(errors.filter((f) => f.severity === "error")).toEqual([]);
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
    // A half turn landed over a flight's 360 is read into it.
    expect(
      comboLine([
        { kind: "spin", spins: 1, flight: 1 },
        { kind: "half", spins: 1, flight: 1 },
        { kind: "half", spins: 1, flight: 2 },
      ]),
    ).toBe("540 + 180");
    expect(comboLine([{ kind: "landing", spins: 2, flight: 1 }])).toBe("PERFECT LANDING");
  });

  it("is up on a tricks run only, with the combo in hand and then what it paid", () => {
    expect(comboTile(staged("timeTrial"))).toBeNull();
    const state = staged("tricks", LAUNCH, LANDING);
    // To the step he lands on.
    let landed = false;
    for (let i = 0; i < 4 * TUNING.physicsHz && !landed; i++) {
      step(state, { ...NEUTRAL_INPUT, tuck: 1, ...BACKFLIP(0, state) });
      landed = state.events.some((e) => e.kind === "land");
    }
    ride(state, 0.1, () => ({}));
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
