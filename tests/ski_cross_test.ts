// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI CROSS (R35): the course built over a generated map — its line
// weaving down the piste's corridor, its profile, its start ramp, its berms
// banked, its features on the straights, its gates and its start gate's
// lanes — the rules it is raced under (a timed qualification against a
// board, then heats of four out of the start gate, the field skied), the
// start gate's doors and its dealt release, contact that puts a racer down
// and the red card for it, and the bot down the course.
import { describe, expect, it } from "vitest";

import {
  CROSS_HEAT,
  DISCIPLINES,
  DISCIPLINE_RULES,
  JURY,
  MODE_RULES,
  SKI_CROSS,
  TUNING,
  WOLVERINE,
  botInput,
  createGame,
  crossCountdown,
  generateLevel,
  heatResult,
  nearestTrackPoint,
  raceParOf,
  setSkiCross,
  skiCrossCourseOf,
  step,
  stepDrafts,
  type CrossHeat,
  type GameState,
} from "@engine";

const K = DISCIPLINE_RULES.skiCross;
const SEED = 38;
/** The seed's ski area, built on the course a ski cross is built on — by
 * generator v6, the rules this course was read off (v7 moved the peak's
 * chair, and with it which course the seed's ski cross is set on). */
const VERSION = 6;
const BASE = generateLevel(SEED, {
  version: VERSION,
  course: skiCrossCourseOf(generateLevel(SEED, { version: VERSION })) ?? undefined,
});
const COURSE = setSkiCross(BASE);
const HEAT: CrossHeat = {
  round: "quarter",
  index: 1,
  racers: [
    { id: 3, rank: 4 },
    { id: null, rank: 5 },
    { id: 7, rank: 12 },
    { id: 11, rank: 13 },
  ],
};

/** The bot down `state` until every racer on it is home or out. */
function race(state: GameState): GameState {
  for (let i = 0; i < 200 * TUNING.physicsHz; i++) {
    step(state, botInput(state));
    if (state.progress.finished && state.rivals.every((r) => r.run.progress.finished)) break;
  }
  return state;
}

describe("the ski-cross course (R35)", () => {
  const sx = COURSE.skiCross!;
  const pts = COURSE.track.points;

  it("is built over the map once, its own line the map's track", () => {
    expect(setSkiCross(BASE)).toBe(COURSE);
    expect(setSkiCross(COURSE)).toBe(COURSE);
    expect(sx.base).toBe(BASE);
    expect(COURSE.track).not.toBe(BASE.track);
    expect(COURSE.slalom ?? COURSE.downhill ?? COURSE.superG ?? COURSE.speedSki).toBeUndefined();
  });

  it("is a course's length and vertical, at a ski cross's mean grade", () => {
    const length = sx.to - sx.from;
    expect(length).toBeGreaterThan(600);
    expect(length).toBeLessThanOrEqual(K.length.max);
    expect(sx.vertical).toBeGreaterThanOrEqual(K.vertical.min * 0.8);
    expect(sx.vertical).toBeLessThanOrEqual(K.vertical.max);
    const grade = sx.vertical / length;
    expect(grade).toBeGreaterThan(K.grade.min * 0.8);
    expect(grade).toBeLessThan(K.grade.max * 1.1);
  });

  it("weaves: its berms turn it far off the piste's way, either side in turn", () => {
    const berms = sx.features.filter((f) => f.kind === "berm");
    expect(berms.length).toBeGreaterThanOrEqual(4);
    expect(new Set(berms.map((b) => b.side)).size).toBe(2);
    let turned = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.atan2(
        Math.sin(pts[i].heading - pts[i - 1].heading),
        Math.cos(pts[i].heading - pts[i - 1].heading),
      );
      turned += Math.abs(d);
    }
    expect((turned * 180) / Math.PI).toBeGreaterThan(berms.length * K.turn.least);
  });

  it("carries rollers, jumps or step-downs on its straights, none in a turn", () => {
    const built = sx.features.filter((f) => f.kind !== "berm");
    expect(
      built.filter((f) => f.kind === "jump" || f.kind === "step").length,
    ).toBeGreaterThanOrEqual(2);
    for (const f of built) {
      for (const b of sx.features.filter((x) => x.kind === "berm")) {
        expect(f.to <= b.from || f.from >= b.to, `${f.kind}@${f.from} in a berm`).toBe(true);
      }
    }
    // Every jump and step-down is a kicker on the course the bot reads.
    const lips = (COURSE.kickers ?? []).filter((k) => k.onTrack);
    for (const f of built.filter((x) => x.lip !== undefined)) {
      expect(lips.some((k) => Math.abs((k.s ?? -1) - (f.lip ?? 0)) < 0.5)).toBe(true);
    }
  });

  it("banks a berm's outside up into a wall", () => {
    const berm = sx.features.find((f) => f.kind === "berm")!;
    const mid = (berm.from + berm.to) / 2;
    const p = pts[Math.round(mid / (pts[1].s - pts[0].s))];
    const half = K.width / 2 - 1;
    // Right of the way, into the turn's inside for a right-hand berm.
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    const inside = COURSE.groundAt(p.x + rx * half * berm.side!, p.z + rz * half * berm.side!);
    const outside = COURSE.groundAt(p.x - rx * half * berm.side!, p.z - rz * half * berm.side!);
    // At least half the rule's bank: a sweeping berm is banked less.
    expect(outside - inside).toBeGreaterThan(Math.tan(((K.turn.bank / 2) * Math.PI) / 180) * half);
  });

  it("opens with a level platform under the doors and a start ramp below them", () => {
    const at = (s: number) => pts[Math.round(s / (pts[1].s - pts[0].s))];
    expect(Math.abs(at(0).y - at(K.start.platform).y)).toBeLessThan(0.05);
    const R = K.start.ramp;
    let steepest = 0;
    for (let s = K.start.platform; s < K.start.platform + R.length; s += 2) {
      steepest = Math.max(steepest, (at(s).y - at(s + 2).y) / 2);
    }
    expect(steepest).toBeGreaterThan(R.grade * 0.85);
    expect(at(1).width).toBe(K.start.width);
  });

  it("stands four lanes abreast behind the doors, the first turn's inside chosen first", () => {
    expect(COURSE.grid).toHaveLength(K.start.lanes);
    const first = sx.features.find((f) => f.kind === "berm")!;
    const lat = COURSE.grid.map((g) => nearestTrackPoint(COURSE, g.x, g.z).lateral);
    expect(lat[0] * first.side!).toBeGreaterThan(0);
    for (let i = 1; i < lat.length; i++) {
      expect(lat[i] * first.side!).toBeLessThan(lat[i - 1] * first.side!);
    }
    const sorted = [...lat].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++)
      expect(sorted[i] - sorted[i - 1]).toBeCloseTo(K.start.lane, 1);
  });

  it("flags a turning gate on every berm's inside and a corridor before every feature", () => {
    const cps = COURSE.checkpoints;
    const gates = cps.slice(1, -1);
    expect(cps[0].s).toBeCloseTo(sx.from, 0);
    expect(cps[cps.length - 1].s).toBeCloseTo(sx.to, 0);
    for (const g of gates) expect(g.flags).toBe(true);
    const turns = gates.filter((g) => g.pole === "open");
    expect(turns).toHaveLength(sx.features.filter((f) => f.kind === "berm").length);
    expect(gates.length - turns.length).toBe(sx.features.filter((f) => f.kind !== "berm").length);
    for (let i = 1; i < gates.length; i++) {
      expect(gates[i].s).toBeGreaterThan(gates[i - 1].s);
      expect(gates[i].colour).not.toBe(gates[i - 1].colour);
    }
  });

  it("is groomed, fenced and cleared of trees", () => {
    for (const p of pts) expect(COURSE.packedAt(p.x, p.z)).toBeGreaterThan(0.95);
    expect(sx.nets.gap).toBe(K.fence.gap);
    for (const t of COURSE.trees) {
      const hit = nearestTrackPoint(COURSE, t.x, t.z);
      expect(hit.distance).toBeGreaterThan(K.width / 2 + K.clearTrees - 0.01);
    }
  });
});

describe("the ski cross's rules", () => {
  it("is a built discipline with a mode, raced in a speed race's weather", () => {
    expect(DISCIPLINES.find((d) => d.id === "skiCross")?.mode).toBe("skiCross");
    const q = MODE_RULES.skiCross(1);
    expect(q.start).toBe("gate");
    expect(q.dealt).toBe(true);
    expect(q.gates).toBe("strict");
    expect(q.technique).toBe("skiCross");
    expect(q.jury).toBe(JURY.skiCross);
    expect(q.rivals).toBe(SKI_CROSS.field);
  });

  it("qualifies alone against a board dealt about par", () => {
    const state = createGame({
      seed: SEED,
      level: BASE,
      mode: "skiCross",
      spec: WOLVERINE,
      quiet: true,
    });
    expect(state.rivals).toHaveLength(0);
    expect(state.field?.runs).toHaveLength(SKI_CROSS.field);
    expect(state.field?.runs.every((r) => r.skis === SKI_CROSS.skis)).toBe(true);
    expect(raceParOf(state.level)?.time).toBeGreaterThan(30);
  });

  it("stands a heat four abreast in seed order, behind doors that drop at a dealt moment", () => {
    const state = createGame({
      seed: SEED,
      level: BASE,
      mode: "skiCross",
      spec: WOLVERINE,
      cross: HEAT,
      quiet: true,
    });
    expect(state.rules.start).toBe("gate");
    expect(state.rules.knock).toBe(true);
    expect(state.rules.contact).toBe(true);
    expect(state.rivals.map((r) => r.id)).toEqual([3, 7, 11]);
    const countdown = crossCountdown(SEED, HEAT);
    expect(state.rules.countdown).toBe(countdown);
    expect(countdown).toBeGreaterThanOrEqual(SKI_CROSS.ready + SKI_CROSS.release.min);
    expect(countdown).toBeLessThanOrEqual(SKI_CROSS.ready + SKI_CROSS.release.max);
    // The player behind the second door — the fifth seed of four chooses second.
    const g = state.level.grid;
    expect(Math.hypot(state.skier.x - g[1].x, state.skier.z - g[1].z)).toBeLessThan(0.01);
    expect(
      Math.hypot(state.rivals[0].run.skier.x - g[0].x, state.rivals[0].run.skier.z - g[0].z),
    ).toBeLessThan(0.01);
    // The doors hold every racer until they drop.
    const at = { x: state.skier.x, z: state.skier.z };
    for (let i = 0; i < Math.floor((countdown - 0.1) * TUNING.physicsHz); i++)
      step(state, botInput(state));
    expect(state.phase).toBe("countdown");
    expect(Math.hypot(state.skier.x - at.x, state.skier.z - at.z)).toBeLessThan(0.01);
    for (const r of state.rivals) expect(r.run.skier.speed).toBeLessThan(0.1);
    // The same heat, the same field: its draws are the heat's own.
    const again = createGame({
      seed: SEED,
      level: BASE,
      mode: "skiCross",
      spec: WOLVERINE,
      cross: HEAT,
      quiet: true,
    });
    expect(again.rivals.map((r) => [r.pace, r.react])).toEqual(
      state.rivals.map((r) => [r.pace, r.react]),
    );
    expect(
      state.rivals.every((r) => r.pace >= CROSS_HEAT.pace.min && r.pace <= CROSS_HEAT.pace.max),
    ).toBe(true);
  });
});

describe("a heat raced", () => {
  const state = race(
    createGame({
      seed: SEED,
      level: BASE,
      mode: "skiCross",
      spec: WOLVERINE,
      cross: HEAT,
      quiet: true,
    }),
  );

  it("brings the four down the course together, and orders them over the line", () => {
    const result = heatResult(state)!;
    expect(result.order).toHaveLength(4);
    const home = result.order.filter((p) => p.time !== null);
    expect(home.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < home.length; i++)
      expect(home[i].time!).toBeGreaterThanOrEqual(home[i - 1].time!);
    // A pack: the last one home within a few seconds of the first.
    expect(home[home.length - 1].time! - home[0].time!).toBeLessThan(8);
  });
});

describe("the draft in a heat", () => {
  it("takes a share of the drag off a racer tucked in behind a rival, and nothing anywhere else", () => {
    const state = createGame({
      seed: SEED,
      level: BASE,
      mode: "skiCross",
      spec: WOLVERINE,
      cross: HEAT,
      countdown: 0,
      quiet: true,
    });
    for (let i = 0; i < 4 * TUNING.physicsHz; i++) step(state, botInput(state));
    const lead = state.rivals[0].run.skier;
    const me = state.skier;
    const fx = Math.sin(lead.heading);
    const fz = Math.cos(lead.heading);
    me.x = lead.x - fx * 1.5;
    me.z = lead.z - fz * 1.5;
    stepDrafts(state);
    expect(me.draft).toBeGreaterThan(CROSS_HEAT.draft.most * 0.8);
    expect(lead.draft).toBe(0);
    // Far behind, no draft.
    me.x = lead.x - fx * 20;
    me.z = lead.z - fz * 20;
    stepDrafts(state);
    expect(me.draft).toBe(0);
    // A run that is not a heat never drafts.
    const alone = createGame({
      seed: SEED,
      level: BASE,
      mode: "skiCross",
      spec: WOLVERINE,
      quiet: true,
    });
    step(alone, botInput(alone));
    expect(alone.skier.draft).toBeUndefined();
  });
});

describe("contact in a heat", () => {
  it("puts a racer struck hard from behind down, and shows the striker the red card", () => {
    const state = createGame({
      seed: SEED,
      level: BASE,
      mode: "skiCross",
      spec: WOLVERINE,
      cross: HEAT,
      countdown: 0,
      quiet: true,
    });
    // Four seconds down the course, then the player driven into the back of
    // the rival just ahead of him at a closing speed past the knock.
    for (let i = 0; i < 4 * TUNING.physicsHz; i++) step(state, botInput(state));
    const victim = state.rivals[0].run.skier;
    const me = state.skier;
    const fx = Math.sin(victim.heading);
    const fz = Math.cos(victim.heading);
    me.x = victim.x - fx * 1.1;
    me.z = victim.z - fz * 1.1;
    me.y = victim.y;
    me.vx = victim.vx + fx * 5;
    me.vz = victim.vz + fz * 5;
    me.heading = victim.heading;
    step(state, botInput(state));
    expect(victim.thrown).not.toBeNull();
    expect(state.progress.out).toEqual(expect.objectContaining({ status: "dsq", why: "contact" }));
  });
});
