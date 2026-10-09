// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A RUN IS CALLED, AND WHERE ITS SIGN STANDS — the names dealt to
// every run of a ski area (`run-names.ts`, the words in
// `strings-run-names.ts`), the piste-head signs planned off them
// (`run-sign-plan.ts`) and the news line that greets a run as the skier is
// put on it (`run-watch.ts`). Two generated maps for the real thing, and
// every country's voice dealt over one map's runs re-badged.

import { describe, expect, it } from "vitest";

import {
  clearOfLifts,
  createGame,
  liftPlans,
  nearestTrackPoint,
  raceCourseOf,
  type GameState,
  type Level,
  type RegionId,
  type Run,
} from "@engine";

import {
  courseName,
  runById,
  runName,
  runNames,
  runNewsText,
  runNumber,
  runNumbers,
} from "../pwa/src/game/run-names.ts";
import { buildPinnedLevel } from "../pwa/src/game/pinned.ts";
import { RACE_MAPS } from "../pwa/src/game/race-maps.ts";
import { SIGN, onCourse, signPlan, summitSigns } from "../pwa/src/game/run-sign-plan.ts";
import { createRunWatch } from "../pwa/src/game/run-watch.ts";
import { RUN_NAMES, RUN_WORDS, type NameForm } from "../pwa/src/game/strings-run-names.ts";
import { levelFor } from "./support/levels.ts";

const SEEDS = [1, 38];
const REGIONS: readonly RegionId[] = ["alpine", "fell", "continental", "maritime"];

/** Every name a form can make. */
function namesOf(forms: readonly NameForm[]): Set<string> {
  const out = new Set<string>();
  for (const f of forms) {
    for (const h of f.heads) {
      if (!f.tails) out.add(h);
      else for (const t of f.tails) out.add(f.join ? f.join(h, t) : `${h} ${t}`);
    }
  }
  return out;
}

/** A real map's ski area under another country's voice and seed — the
 * names read nothing else. */
function rebadged(level: Level, region: RegionId, seed: number): Level {
  return { ...level, region, seed };
}

function resortOf(level: Level) {
  const resort = level.resort;
  if (!resort) throw new Error(`seed ${level.seed} built no ski area`);
  return resort;
}

describe("run names (run-names.ts)", () => {
  it("names every run, none empty, none twice within one ski area", () => {
    for (const seed of SEEDS) {
      const base = levelFor(seed);
      for (const region of REGIONS) {
        for (const s of [seed, seed + 1000, seed + 2000]) {
          const level = rebadged(base, region, s);
          const names = runNames(level);
          const runs = resortOf(level).runs;
          expect(names.size).toBe(runs.length);
          for (const run of runs) expect(runName(level, run).trim().length).toBeGreaterThan(0);
          expect(new Set(names.values()).size, `${region} ${s}`).toBe(runs.length);
        }
      }
    }
  });

  it("deals the same names to the same map, and other names to another seed", () => {
    const level = levelFor(SEEDS[0]);
    const again = rebadged(level, level.region ?? "alpine", level.seed);
    expect([...runNames(again)]).toEqual([...runNames(level)]);
    let moved = 0;
    for (let s = 1; s <= 8; s++) {
      const other = runNames(rebadged(level, level.region ?? "alpine", level.seed + s));
      for (const [id, name] of runNames(level)) if (other.get(id) !== name) moved++;
    }
    expect(moved).toBeGreaterThan(0);
  });

  it("names a piste from its colour's words and a lane as a way, in its country's voice", () => {
    for (const seed of SEEDS) {
      for (const region of REGIONS) {
        const level = rebadged(levelFor(seed), region, seed * 7 + 3);
        const voice = RUN_NAMES[region];
        for (const run of resortOf(level).runs) {
          const name = runName(level, run);
          if (run.kind === "road") {
            expect(namesOf(voice.lane).has(name), `${region} lane ${name}`).toBe(true);
            expect(
              voice.laneWords.some((w) => name.endsWith(` ${w}`)),
              name,
            ).toBe(true);
          } else {
            expect(namesOf(voice[run.grade]).has(name), `${region} ${run.grade} ${name}`).toBe(
              true,
            );
          }
        }
      }
    }
  });

  it("keeps the lane words to the lanes and the fearsome words off the greens", () => {
    for (const region of REGIONS) {
      const voice = RUN_NAMES[region];
      for (const grade of ["green", "blue", "red", "black"] as const) {
        for (const name of namesOf(voice[grade])) {
          expect(
            voice.laneWords.some((w) => name.endsWith(` ${w}`)),
            `${region} ${name}`,
          ).toBe(false);
        }
      }
      for (const name of namesOf(voice.green)) {
        expect(/Wall|Couloir|Chute|Face|Plunge|Gorge|Steep|Drop|Headwall/.test(name), name).toBe(
          false,
        );
      }
      // A ski area can hold more runs of a colour than any run of luck: every
      // pool deals at least a dozen.
      for (const forms of [voice.green, voice.blue, voice.red, voice.black, voice.lane]) {
        expect(namesOf(forms).size).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("names a course by its first run, or its first to its last", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      for (const course of resortOf(level).courses) {
        const first = runName(level, runById(level, course.runs[0])!);
        const last = runName(level, runById(level, course.runs[course.runs.length - 1])!);
        expect(courseName(level, course.id)).toBe(
          course.runs.length === 1 ? first : RUN_WORDS.courseChain(first, last),
        );
      }
      expect(courseName(level, "no such course")).toBe(null);
    }
  });

  it("bills a piste by its mark, number and name, and a lane by its mark and name", () => {
    const level = levelFor(SEEDS[0]);
    for (const run of resortOf(level).runs) {
      const text = runNewsText(level, run);
      expect(text.startsWith(RUN_WORDS.mark[run.grade])).toBe(true);
      expect(text.includes(runName(level, run).toUpperCase())).toBe(true);
      expect(text.includes(`RUN ${runNumber(level, run)} `)).toBe(run.kind === "piste");
    }
  });

  it("numbers the pistes 1 to P without a gap, in the plan's order, and the lanes after them", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const runs = resortOf(level).runs;
      const pistes = runs.filter((r) => r.kind === "piste");
      const lanes = runs.filter((r) => r.kind === "road");
      const of = (rs: typeof runs) =>
        [...rs].sort((a, b) => Number(a.id) - Number(b.id)).map((r) => runNumber(level, r));
      expect(of(pistes)).toEqual(pistes.map((_, i) => String(i + 1)));
      expect(of(lanes)).toEqual(lanes.map((_, i) => String(pistes.length + i + 1)));
      expect(new Set(runs.map((r) => runNumbers(level).get(r.id))).size).toBe(runs.length);
    }
  });
});

describe("the piste-head signs (run-sign-plan.ts)", () => {
  it("puts one board up for every run, its name on it, its boards clear of each other", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const posts = signPlan(level);
      const boards = posts.flatMap((p) => p.boards);
      const runs = resortOf(level).runs;
      expect(boards.map((b) => b.run).sort()).toEqual(runs.map((r) => r.id).sort());
      for (const b of boards) {
        const run = runById(level, b.run)!;
        expect(b.name).toBe(runName(level, run));
        expect(b.lane).toBe(run.kind === "road");
        expect(b.width).toBe(b.lane ? SIGN.lane.width : SIGN.board.width);
        // A sign down on the runs is a plain plank, never an arrow.
        expect(b.point).toBeUndefined();
      }
      // A lift top's are all arrows, pointing left or right.
      for (const b of summitSigns(level).flatMap((p) => p.boards)) {
        expect(["left", "right"]).toContain(b.point);
      }
      for (const p of posts) {
        expect(Number.isFinite(p.y)).toBe(true);
        for (let i = 1; i < p.boards.length; i++) {
          // Stacked top first: each board's foot over the next one's top.
          expect(p.boards[i - 1].y).toBeGreaterThan(p.boards[i].y + p.boards[i].height);
        }
        expect(p.boards[p.boards.length - 1].y).toBeCloseTo(SIGN.foot, 6);
      }
    }
  });

  it("stands a run's sign near its head, and a branching lane's above its junction", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const runs = resortOf(level).runs;
      for (const post of signPlan(level)) {
        for (const b of post.boards) {
          const run = runById(level, b.run)!;
          const parent = run.branch ? runById(level, run.branch.run) : undefined;
          const near = (r: Run) =>
            Math.min(...r.points.map((p) => Math.hypot(p.x - post.x, p.z - post.z)));
          // Within the run's own reach, or the run it leaves.
          const line = parent ?? run;
          // At the line's edge, or a sign tree's among the runs off one top.
          const half = Math.max(...line.points.map((p) => p.width / 2));
          expect(near(line), `${seed} sign of ${b.run}`).toBeLessThan(
            half + SIGN.edge + SIGN.shared / 2 + SIGN.cluster,
          );
        }
      }
      expect(runs.length).toBeGreaterThan(0);
    }
  });
});

describe("the piste-head signs stand at the edge, on the lift's side", () => {
  it("stands every sign at its run's edge, never out on the slope, a ramp's on the side it comes in from", () => {
    for (const seed of [2, ...SEEDS]) {
      const level = levelFor(seed);
      let ramps = 0;
      for (const post of signPlan(level)) {
        if (post.boards.length !== 1) continue;
        const run = runById(level, post.boards[0].run)!;
        const line = run.branch ? runById(level, run.branch.run)! : run;
        const hit = nearestTrackPoint({ track: line }, post.x, post.z);
        const p = line.points[hit.index];
        const name = `${seed} sign of ${run.id}`;
        // Just past the groomed snow, inside the stakes — not on the slope.
        expect(hit.distance, name).toBeGreaterThan(p.width / 2 - 0.5);
        expect(hit.distance, name).toBeLessThan(Math.max(SIGN.inner, p.width / 2 + SIGN.edge) + 1);
        const ramp = liftPlans(level)
          .find((q) => q.lift.id === run.from)
          ?.lift.ramps?.find((q) => q.run === run.id);
        if (!ramp || run.branch) continue;
        // On the side the ramp comes down from.
        const side = (x: number, z: number) =>
          Math.sign(-(x - p.x) * Math.cos(p.heading) + (z - p.z) * Math.sin(p.heading));
        expect(side(post.x, post.z), name).toBe(side(ramp.from.x, ramp.from.z));
        ramps++;
      }
      expect(ramps, `${seed}`).toBeGreaterThan(0);
    }
  });
});

describe("the piste-head signs keep off a race course", () => {
  it("takes down the lane's sign standing on the super-G's course (superG-5, seed 38)", () => {
    const map = RACE_MAPS.superG!.find((m) => m.id === "superG-5")!;
    const built = buildPinnedLevel(map);
    const level = createGame({ seed: map.seed, level: built, mode: map.mode, quiet: true }).level;
    const course = raceCourseOf(level)!;
    // The map unraced keeps it: the lane's junction sign at the piste's
    // edge, a couple of hundred metres down the course.
    const on = signPlan(built).filter((p) => {
      const hit = nearestTrackPoint(built, p.x, p.z);
      const width = built.track.points[hit.index].width;
      return hit.s > course.from && hit.s < course.to && hit.distance < width / 2 + SIGN.edge + 0.5;
    });
    expect(on.length).toBeGreaterThan(0);
    // Raced, no post stands inside the nets, and the rest still stand.
    const raced = [...signPlan(level), ...summitSigns(level)];
    for (const p of raced) expect(onCourse(level, p.x, p.z), p.boards[0].name).toBe(false);
    expect(raced.length).toBeGreaterThan(0);
    // The course itself is on the course, down its whole length.
    for (let s = course.from; s < course.to; s += 50) {
      const p = level.track.points[Math.round(s / 2)];
      expect(onCourse(level, p.x, p.z)).toBe(true);
    }
    // A map with no race set keeps every sign.
    expect(signPlan(built).some((p) => onCourse(built, p.x, p.z))).toBe(false);
  });
});

describe("the piste-head signs keep clear of the lifts", () => {
  it("stands no sign in a station house, under a line or on a drag track", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      for (const post of signPlan(level)) {
        expect(clearOfLifts(level, post.x, post.z), `${seed} ${post.boards[0].name}`).toBe(true);
      }
    }
  });

  it("calls a lift's top wheel and its station house not clear", () => {
    const level = levelFor(SEEDS[0]);
    for (const lift of resortOf(level).lifts) {
      expect(clearOfLifts(level, lift.top.x, lift.top.z)).toBe(false);
      expect(clearOfLifts(level, lift.bottom.x, lift.bottom.z)).toBe(false);
    }
  });
});

describe("the run the skier is put on (run-watch.ts)", () => {
  /** A stand-in for a run: the level, a clock and where the skier is. */
  function at(level: Level, x: number, z: number, t: number, base?: GameState): GameState {
    const state = base ?? ({ level, t, skier: { x, z }, events: [] } as unknown as GameState);
    state.t = t;
    (state.skier as { x: number; z: number }).x = x;
    (state.skier as { x: number; z: number }).z = z;
    return state;
  }

  it("names a run once as the skier is put on it, and the next one he moves to", () => {
    const level = levelFor(SEEDS[1]);
    const runs = resortOf(level).runs;
    const a = runs.find((r) => r.kind === "piste")!;
    const watch = createRunWatch();
    const pa = a.points[Math.floor(a.points.length / 2)];
    const state = at(level, pa.x, pa.z, 0);
    const first = watch.step(state);
    expect(first).not.toBe(null);
    // Staying on, or going off into the trees and back, is not news.
    expect(watch.step(at(level, pa.x, pa.z, 0.5, state))).toBe(null);
    expect(watch.step(at(level, -5000, -5000, 1, state))).toBe(null);
    expect(watch.step(at(level, pa.x, pa.z, 1.5, state))).toBe(null);
    // Another run, somewhere only it reaches, is.
    const other = runs.find((r) => r.id !== first!.id && r.kind === "piste")!;
    const po = other.points[Math.floor(other.points.length / 2)];
    const next = watch.step(at(level, po.x, po.z, 2, state));
    expect(next?.id === first!.id).toBe(false);
    expect(next).not.toBe(null);
    // A new run starts the watch over.
    const fresh = at(level, pa.x, pa.z, 0);
    expect(watch.step(fresh)).not.toBe(null);
  });
});
