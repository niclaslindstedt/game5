// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLALOM (R31): the course set over a map, the strict gates it is
// judged by, the start window, the field skied before the player, the two
// runs, and the flex poles a racer knocks.
import { describe, expect, it } from "vitest";

import {
  DISCIPLINE_RULES,
  FIELD,
  NEUTRAL_INPUT,
  SLALOM,
  TUNING,
  createGame,
  nearestTrackPoint,
  placeRun,
  polePlan,
  setSlalom,
  skisById,
  slalomLineAt,
  slalomPar,
  step,
  trackPointAt,
  type Checkpoint,
  type GameEvent,
  type GameState,
  type Level,
} from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

const S = DISCIPLINE_RULES.slalom;
const BASE = syntheticLevel();
const RUN1 = setSlalom(BASE, 1);
const RUN2 = setSlalom(BASE, 2);

/** How far right of the piste's centreline a point stands, m. */
function across(level: Level, x: number, z: number): number {
  const p = trackPointAt(level, nearestTrackPoint(level, x, z).s);
  return (x - p.x) * Math.cos(p.heading) - (z - p.z) * Math.sin(p.heading);
}

/** Where an open gate's turning pole stands, and which way its gate opens. */
function turningPole(cp: Checkpoint): { x: number; z: number; inward: number } {
  const rx = Math.cos(cp.heading);
  const rz = -Math.sin(cp.heading);
  const turn = cp.turn ?? -1;
  return {
    x: cp.x + rx * turn * (cp.width / 2),
    z: cp.z + rz * turn * (cp.width / 2),
    inward: -turn,
  };
}

describe("the slalom course (R31)", () => {
  const gates = RUN1.checkpoints.slice(1, -1);

  it("is a pure function of the map and the run: set again, the same course", () => {
    expect(setSlalom(BASE, 1).checkpoints).toEqual(RUN1.checkpoints);
    // ...and set over a map that already carries one, the same course again.
    expect(setSlalom(RUN2, 1).checkpoints).toEqual(RUN1.checkpoints);
    expect(RUN1.slalom?.base).toBe(BASE);
  });

  it("sets the second run afresh on the same stretch", () => {
    expect(RUN2.slalom?.from).toBe(RUN1.slalom?.from);
    expect(RUN2.slalom?.to).toBe(RUN1.slalom?.to);
    expect(RUN2.checkpoints).not.toEqual(RUN1.checkpoints);
  });

  it("drops a slalom's vertical over a stretch no longer than a slalom hill", () => {
    const sl = RUN1.slalom!;
    expect(sl.vertical).toBeGreaterThanOrEqual(S.drops[S.drops.length - 1] - 1);
    expect(sl.to - sl.from).toBeLessThanOrEqual(S.maxLength);
    // The start hut stands over the start gate, the finish on the line.
    expect(RUN1.checkpoints[0].s).toBeCloseTo(sl.from, 6);
    expect(RUN1.checkpoints[RUN1.checkpoints.length - 1].s).toBeCloseTo(sl.to, 6);
    expect(RUN1.grid).toHaveLength(1);
    expect(nearestTrackPoint(RUN1, RUN1.spawn.x, RUN1.spawn.z).s).toBeLessThan(sl.from);
  });

  it("sets pole gates only, red and blue in turn, every pole inside the piste", () => {
    for (const [i, g] of gates.entries()) {
      expect(g.pole).toBeDefined();
      expect(g.colour).toBe((i + 1) % 2 === 0 ? "red" : "blue");
      if (g.pole === "open") {
        expect(g.width).toBeGreaterThanOrEqual(S.width.min - 1e-9);
        expect(g.width).toBeLessThanOrEqual(S.width.max + 1e-9);
      } else {
        expect(g.width).toBeGreaterThanOrEqual(S.closed.min - 1e-9);
        expect(g.width).toBeLessThanOrEqual(S.closed.max + 1e-9);
      }
    }
    const plan = polePlan(RUN1);
    for (let k = 0; k < plan.count; k++) {
      const x = plan.xz[k * 2];
      const z = plan.xz[k * 2 + 1];
      const hit = nearestTrackPoint(RUN1, x, z);
      expect(hit.distance).toBeLessThanOrEqual(RUN1.track.points[hit.index].width / 2 + 0.05);
    }
  });

  it("keeps turning pole to turning pole within the rule's 6–13 m", () => {
    // Two open gates in a row — a delay's the longest, at its own rule.
    for (let i = 1; i < gates.length; i++) {
      if (gates[i].pole !== "open" || gates[i - 1].pole !== "open") continue;
      const a = turningPole(gates[i - 1]);
      const b = turningPole(gates[i]);
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      expect(d).toBeLessThanOrEqual(S.delayed.max + 0.5);
      expect(d).toBeGreaterThanOrEqual(S.turn.min - 0.5);
    }
  });

  it("carries the combinations the rules ask for, none at the start or the finish", () => {
    const sl = RUN1.slalom!;
    expect(sl.hairpins).toBeGreaterThanOrEqual(S.hairpins.min);
    expect(sl.verticals).toBeGreaterThanOrEqual(S.verticals.min);
    expect(sl.delays).toBeGreaterThanOrEqual(S.delays.min);
    for (const g of [...gates.slice(0, S.clean), ...gates.slice(-S.clean)]) {
      expect(g.pole).toBe("open");
    }
    // The last gate a fast one, well above the line.
    expect(sl.to - gates[gates.length - 1].s).toBeGreaterThanOrEqual(S.last - 4);
  });

  it("counts its direction changes off the vertical, where the spacing allows", () => {
    const sl = RUN1.slalom!;
    const most = Math.round(S.changes.max * sl.vertical) + S.changes.slack;
    const spaced = (sl.to - sl.from) / S.spacing.min;
    expect(gates.length).toBeLessThanOrEqual(Math.max(most, spaced) + 1);
  });

  it("draws a racing line that passes outside every turning pole", () => {
    for (const g of gates) {
      if (g.pole !== "open") continue;
      const tp = turningPole(g);
      const line = slalomLineAt(RUN1, g.s)!;
      expect((line.offset - across(RUN1, tp.x, tp.z)) * tp.inward).toBeGreaterThan(0.3);
    }
  });

  it("levels the piste's kickers on the stretch and clears the woods round the course", () => {
    const sl = RUN1.slalom!;
    for (const k of RUN1.kickers ?? []) {
      if (!k.onTrack || k.s === undefined) continue;
      expect(k.s + k.landing < sl.from - S.clearance || k.s - k.ramp > sl.to + S.clearance).toBe(
        true,
      );
    }
    for (const t of RUN1.trees) {
      const hit = nearestTrackPoint(RUN1, t.x, t.z);
      if (hit.s < sl.from || hit.s > sl.to) continue;
      expect(hit.distance).toBeGreaterThan(RUN1.track.points[hit.index].width / 2 + S.clear - 1);
    }
  });
});

/** A slalom run with nobody else in it, stood moving down the course just
 * above gate `gate`, `offset` m right of its turning pole's line. */
function stagedAbove(gate: number, offset: number): GameState {
  const state = createGame({ level: BASE, seed: 3, mode: "slalom", rivals: 0, quiet: true });
  const cp = state.level.checkpoints[gate];
  const tp = turningPole(cp);
  const fx = Math.sin(cp.heading);
  const fz = Math.cos(cp.heading);
  const rx = Math.cos(cp.heading);
  const rz = -Math.sin(cp.heading);
  const along = 1.2;
  placeRun(state, {
    x: tp.x - fx * along + rx * offset,
    z: tp.z - fz * along + rz * offset,
    heading: cp.heading,
    speed: 9,
    time: 5,
    nextCheckpoint: gate,
  });
  return state;
}

/** Ski `seconds` straight on, the events kept. */
function coast(state: GameState, seconds: number): GameEvent[] {
  const seen: GameEvent[] = [];
  for (let i = 0; i < seconds / TUNING.dt && !state.progress.finished; i++) {
    step(state, NEUTRAL_INPUT);
    seen.push(...state.events);
  }
  return seen;
}

describe("the strict gates", () => {
  const first = RUN1.checkpoints.findIndex((c, i) => i > 0 && c.pole === "open");
  const inward = turningPole(RUN1.checkpoints[first]).inward;

  it("credits a gate both feet pass between its poles", () => {
    const state = stagedAbove(first, inward * 1.2);
    coast(state, 0.5);
    expect(state.progress.out).toBeNull();
    expect(state.progress.nextCheckpoint).toBe(first + 1);
  });

  it("disqualifies a gate skied on the wrong side of its turning pole", () => {
    const state = stagedAbove(first, -inward * 1.2);
    const seen = coast(state, 0.5);
    expect(state.progress.out).toEqual({ status: "dsq", why: "missed", gate: first });
    expect(state.phase).toBe("finished");
    expect(seen.some((e) => e.kind === "out")).toBe(true);
  });

  it("disqualifies a straddle: the turning pole between the skis", () => {
    const state = stagedAbove(first, 0);
    coast(state, 0.5);
    expect(state.progress.out?.why).toBe("straddle");
  });

  it("starts the clock at the wand and disqualifies a racer not away in the window", () => {
    const state = createGame({ level: BASE, seed: 3, mode: "slalom", rivals: 0, quiet: true });
    expect(state.rules.countdown).toBe(SLALOM.countdown);
    // Held in the hut past GO, his skis across: the clock waits for him,
    // then he is out.
    for (let i = 0; i < (SLALOM.countdown + 2) / TUNING.dt; i++) {
      step(state, { ...NEUTRAL_INPUT, brake: 1 });
    }
    expect(state.phase).toBe("racing");
    expect(state.progress.time).toBe(0);
    for (let i = 0; i < (SLALOM.window + 1) / TUNING.dt; i++) {
      step(state, { ...NEUTRAL_INPUT, brake: 1 });
    }
    expect(state.progress.out).toEqual({ status: "dsq", why: "start", gate: 0 });
  });

  it("puts a racer who asks for the reset out of the race: nobody is stood back on", () => {
    const state = stagedAbove(first, inward * 1.2);
    step(state, { ...NEUTRAL_INPUT, reset: true });
    expect(state.progress.out).toEqual({ status: "dnf", why: "fall", gate: first });
  });
});

describe("the field of an interval start", () => {
  const state = createGame({ level: BASE, seed: 5, mode: "slalom", quiet: true });

  it("is a board, never skied: the start list's times about the course's par, the player last", () => {
    expect(state.rivals).toHaveLength(0);
    expect(state.field?.run).toBe(1);
    expect(state.field?.runs).toHaveLength(SLALOM.field);
    expect(state.field?.slot).toBe(SLALOM.field);
    const par = slalomPar(state.level, skisById(SLALOM.skis))!;
    for (const r of state.field!.runs) {
      expect(r.skis).toBe(SLALOM.skis);
      expect(r.time === null).toBe(r.out !== null);
      if (r.time !== null) {
        expect(r.time).toBeGreaterThan(par.time * (1 + FIELD.best - FIELD.noise) - 1e-6);
        expect(r.time).toBeLessThan(par.time * (1 + FIELD.spread + FIELD.noise) + 1e-6);
        // The clock at every gate, in order.
        for (let i = 1; i < r.splits.length; i++)
          expect(r.splits[i]).toBeGreaterThan(r.splits[i - 1]);
      } else {
        expect(r.splits[r.out!.gate]).toBeNaN();
      }
    }
  });

  it("deals the same field off the same seed", () => {
    const again = createGame({ level: BASE, seed: 5, mode: "slalom", quiet: true });
    expect(again.field).toEqual(state.field);
  });

  it("starts the second run with the first run's finishers, the leader last, the player in his place", () => {
    const home = state.field!.runs.filter((r) => r.time !== null);
    const ranked = [...home].sort((a, b) => a.time! - b.time!);
    // The player home third.
    const mine = (ranked[1].time! + ranked[2].time!) / 2;
    const second = createGame({
      level: state.level,
      seed: 5,
      mode: "slalom",
      quiet: true,
      heat: { run: 2, player: mine, field: state.field!.runs },
    });
    expect(second.level.slalom?.run).toBe(2);
    expect(second.field?.run).toBe(2);
    expect(second.field?.before).toBe(mine);
    const order = second.field!.runs.map((r) => r.id);
    expect(order).toHaveLength(home.length);
    // The best thirty reversed: the player third, so two go after him.
    const ids = ranked.map((r) => r.id);
    const go = [...ids.slice(0, 2), null, ...ids.slice(2)].slice(0, SLALOM.qualify).reverse();
    const rest = [...ids.slice(0, 2), null, ...ids.slice(2)].slice(SLALOM.qualify);
    const all = [...go, ...rest];
    expect(second.field!.slot).toBe(all.indexOf(null));
    expect(order).toEqual(all.filter((id) => id !== null));
    for (const r of second.field!.runs) {
      expect(r.before).toBe(home.find((h) => h.id === r.id)!.time);
    }
  });
});

describe("the flex poles", () => {
  it("knock over when the body meets one, cost a little speed and stand back up", () => {
    const first = RUN1.checkpoints.findIndex((c, i) => i > 0 && c.pole === "open");
    const cp = RUN1.checkpoints[first];
    // Square onto the turning pole.
    const state = stagedAbove(first, 0);
    const before = Math.hypot(state.skier.vx, state.skier.vz);
    const plan = polePlan(state.level);
    const pole = Array.from({ length: plan.count }, (_, k) => k).find(
      (k) =>
        plan.gate[k] === first &&
        Math.hypot(plan.xz[k * 2] - turningPole(cp).x, plan.xz[k * 2 + 1] - turningPole(cp).z) <
          0.01,
    )!;
    let knocked: GameEvent | undefined;
    let most = 0;
    for (let i = 0; i < 0.4 / TUNING.dt; i++) {
      step(state, NEUTRAL_INPUT);
      knocked ??= state.events.find((e) => e.kind === "pole");
      most = Math.max(most, state.gatePoles!.tilt[pole]);
    }
    expect(knocked).toMatchObject({ kind: "pole", gate: first });
    expect(most).toBeGreaterThan(0.2);
    expect(most).toBeLessThanOrEqual(TUNING.flex.most + 1e-6);
    // Lost no more than a knock costs on top of what the snow took.
    expect(Math.hypot(state.skier.vx, state.skier.vz)).toBeLessThan(before + 1);
    // Left alone, the hinge stands it back up.
    for (let i = 0; i < 3 / TUNING.dt; i++) step(state, NEUTRAL_INPUT);
    expect(Math.abs(state.gatePoles!.tilt[pole])).toBeLessThan(0.02);
  });
});
