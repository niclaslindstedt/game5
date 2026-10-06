// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD GENERATOR, held to its rule book across a corpus of seeds: the
// map is a pure function of its seed, it publishes the Level contract every
// reader codes against, and every R-rule a skier would feel — the open
// descent that never climbs, its width, its grade, the packed snow, the
// kickers, the start line behind the start gate, the gates down to the
// finish, the clear corridor, the tree line — holds on every map, measured
// off what the map PUBLISHES.
//
// Every map the current generator builds is a ski area (R25–R30, held on
// its own in tests/resort_test.ts) raced on one COURSE down it (R28), and
// the course is the piste these rules hold — read as the analysis reads
// it: the course's own bands where R28 states them, and the snow beside it
// left to whichever run lies there, a run that joins it or a lane that
// leaves it, the hub it finishes in.
import { describe, expect, it } from "vitest";

import {
  GRADES,
  PISTE_GRADES,
  RESORT_RULES as RR,
  bermCrest,
  bermProfile,
  cliffFootprint,
  cliffProfile,
  dealDrifts,
  generateLevel,
  LEVEL_RULES as R,
  nearestRun,
  nearestTrackPoint,
  nearestWithin,
  gradeRowOf,
  outsideHub,
  pisteGradeOf,
  regionRow,
  scaleBand,
  scaleCount,
  verticalBand,
  REGIONS,
  startGateArc,
  subSeed,
  trackPointAt,
  trunkRadius,
  withinBand,
  type GeneratedLevel,
  sunsetOf,
  offRamp,
} from "@engine";

import { LEVEL_SEEDS, analysisFor, levelFor } from "./support/levels.ts";
import { runsCovering } from "./support/resort.ts";

const corpus = (): GeneratedLevel[] => LEVEL_SEEDS.map(levelFor);

/** The cliffs of the mountain (R22): neither a drop across the course nor
 * one across another run (R24). */
const mountainCliffs = (level: GeneratedLevel) =>
  level.cliffs.filter((c) => !c.onTrack && c.run === undefined);

/** How far past its surface another run reaches the course at a junction,
 * m: its bench and windrow (R8, R18) and the analysis's slack. */
const JUNCTION = R.track.shoulder.flat + R.berm.width + 12;

/** Whether a spot beside a resort's course is another run's snow: a run's
 * groomed band, the hub's (R29) or a lift's level pad (R26). */
function groomedBeside(level: GeneratedLevel, x: number, z: number): boolean {
  const resort = level.resort;
  if (!resort) return false;
  if (runsCovering(level, x, z, R.track.shoulder.packed + 2).size > 0) return true;
  if (resort.hub && outsideHub(resort.hub, x, z) <= RR.hub.fade) return true;
  return resort.lifts.some(
    (l) =>
      Math.hypot(l.top.x - x, l.top.z - z) < RR.lift.pad + R.track.shoulder.packed ||
      // A ramp off a top, groomed down to its run (R26).
      (l.ramps ?? []).some((r) => offRamp(r, x, z) < R.track.shoulder.packed),
  );
}

/** A cheap fingerprint of a float array. */
function digest(data: ArrayLike<number>): number {
  let h = 0;
  for (let i = 0; i < data.length; i += 7) h = (h * 31 + Math.round(data[i] * 1000)) | 0;
  return h;
}

describe("the generator is a pure function of its seed", () => {
  it("builds the same map twice from one seed, and a different map from another", () => {
    const a = generateLevel(1234);
    const b = generateLevel(1234);
    expect(digest(a.ground.data)).toBe(digest(b.ground.data));
    expect(digest(a.packed.data)).toBe(digest(b.packed.data));
    expect(a.track.points).toEqual(b.track.points);
    expect(a.trees).toEqual(b.trees);
    expect(a.checkpoints).toEqual(b.checkpoints);
    expect(a.spawn).toEqual(b.spawn);
    expect(a.grid).toEqual(b.grid);
    expect(a.kickers).toEqual(b.kickers);
    expect(a.sun).toEqual(b.sun);
    expect(a.mountain).toEqual(b.mountain);
    const c = generateLevel(1235);
    expect(digest(c.ground.data)).not.toBe(digest(a.ground.data));
  });

  it("builds a map in well under the budget a test suite can afford", () => {
    const t0 = performance.now();
    generateLevel(99);
    expect(performance.now() - t0).toBeLessThan(15_000);
  });
});

describe("the Level contract", () => {
  it("publishes every field, in its units", () => {
    for (const level of corpus()) {
      expect(level.size).toBe(R.world.size);
      expect(level.cell).toBe(R.world.cell);
      expect(level.ground.cols).toBe(R.world.size / R.world.cell + 1);
      expect(level.ground.rows).toBe(level.ground.cols);
      expect(level.packed.cols).toBe(level.ground.cols);
      expect(level.track.closed).toBe(false);
      expect(level.laps).toBe(R.race.laps);
      expect(level.laps).toBe(1);
      expect(level.grid).toHaveLength(R.grid.slots);
      expect(level.trees.length).toBeGreaterThan(1000);
      // A gate every spacing's most at least, the course's own on a resort.
      const gap = level.resort ? RR.course.gates.spacing : R.checkpoint.spacing;
      expect(level.checkpoints.length).toBeGreaterThanOrEqual(
        Math.floor(level.track.length / gap.max),
      );
      expect(level.region).toBe("alpine");
      for (const t of level.trees.slice(0, 200)) {
        expect(withinBand(t.height, R.forest.height)).toBe(true);
        // A trunk as thick as the tree is old (R14), never under the floor.
        expect(t.radius).toBeGreaterThan(R.forest.trunk.floor);
        expect(t.radius).toBeCloseTo(trunkRadius(t.age!), 9);
        expect(t.crown).toBeGreaterThan(t.radius);
        expect(t.y).toBeCloseTo(level.groundAt(t.x, t.z), 3);
      }
    }
  });

  it("publishes the mountain (R2): the summit on the ridge, the base at the finish, the vertical between", () => {
    for (const level of corpus()) {
      const M = level.mountain;
      // The grade's band (R23), with the region's share of its multiple —
      // on a resort the massif's (R25).
      const region = regionRow(level.region);
      const band = level.resort
        ? scaleBand(RR.massif.vertical, region.relief.vertical)
        : verticalBand(region, gradeRowOf(level));
      expect(withinBand(M.vertical, band, 1e-6)).toBe(true);
      expect(M.summit.y - M.base.y).toBeCloseTo(M.vertical, 6);
      expect(M.summit.z).toBeCloseTo(R.mountain.summit * level.size, 6);
      expect(M.base.z).toBeGreaterThanOrEqual(R.mountain.base * level.size - 1);
      const last = level.track.points[level.track.points.length - 1];
      expect(M.base.x).toBeCloseTo(last.x, 6);
      expect(M.base.y).toBeCloseTo(level.groundAt(last.x, last.z), 3);
      // The altitudes (R21): the valley floor and the tree line, m above the
      // sea, in the alpine's bands.
      expect(withinBand(M.altitude, REGIONS.alpine.altitude.base)).toBe(true);
      expect(withinBand(M.treeLine, REGIONS.alpine.altitude.treeLine)).toBe(true);
      // A green's few hundred metres (R23) may stand under the tree line
      // whole; a mountain of a red's vertical or more tops out over it.
      if (M.vertical > 600) expect(M.treeLine).toBeLessThan(M.altitude + M.vertical);
    }
  });

  it("answers groundAt, normalAt and packedAt off the baked grids", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    const n = { x: 0, y: 0, z: 0 };
    for (const p of level.track.points.filter((_, i) => i % 50 === 0)) {
      expect(level.groundAt(p.x, p.z)).toBeCloseTo(p.y, 4);
      level.normalAt(p.x, p.z, n);
      expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 6);
      expect(n.y).toBeGreaterThan(0.75);
    }
    // Off the map the grids clamp to their edge rather than reading a hole.
    expect(Number.isFinite(level.groundAt(-50, -50))).toBe(true);
    expect(level.packedAt(-50, -50)).toBe(0);
  });

  it("deals a winter day (R15), from sunset on an evening (R19)", () => {
    for (const level of corpus()) {
      expect(withinBand(level.sun.latitude, R.sun.latitude)).toBe(true);
      expect(withinBand(level.sun.dayOfYear, R.sun.dayOfYear)).toBe(true);
      if (level.weather.evening) {
        const late = level.sun.hour - sunsetOf(level.sun);
        expect(withinBand(late, R.sun.evening, 1e-3)).toBe(true);
        continue;
      }
      expect(withinBand(level.sun.hour, R.sun.hour)).toBe(true);
      expect(analysisFor(level.seed).stats.sunElevation).toBeGreaterThanOrEqual(
        R.sun.minElevation - 0.05,
      );
    }
  });

  it("passes its own analysis on every seed of the corpus", () => {
    for (const seed of LEVEL_SEEDS) {
      const a = analysisFor(seed);
      expect(
        a.findings.filter((f) => f.severity === "error"),
        `seed ${seed}`,
      ).toEqual([]);
    }
  });
});

describe("the piste (R5–R8)", () => {
  it("is one open descent, evenly sampled from the start line, in its length band", () => {
    for (const level of corpus()) {
      const pts = level.track.points;
      const L = level.track.length;
      const resort = level.resort;
      // A course's length is R28's; it starts at its run's top station.
      expect(withinBand(L, resort ? RR.course.length : gradeRowOf(level).track.length)).toBe(true);
      expect(pts[0].s).toBe(0);
      if (!resort) expect(Math.abs(pts[0].z - R.track.start.z * level.size)).toBeLessThan(1);
      for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
        expect(pts[i].s).toBeGreaterThan(pts[i - 1].s);
        expect(d).toBeGreaterThan(R.track.step * 0.8);
        expect(d).toBeLessThan(R.track.step * 1.2);
        // Every station lower down the map than the one before it — a
        // course laid again every two metres across its junctions with a
        // hair of the resampling's rounding.
        expect(pts[i].z).toBeGreaterThan(pts[i - 1].z - (resort ? 0.05 : 0));
      }
      const last = pts[pts.length - 1];
      expect(last.s).toBe(L);
      expect(last.z).toBeGreaterThanOrEqual(R.track.finishZ * level.size - 1);
      // The start high, the finish on the valley floor — on a resort the
      // course's own drop, which a nursery's start stands far under the
      // peak.
      const course = resort?.courses.find((c) => c.id === resort.course);
      if (course) expect(pts[0].y - last.y).toBeCloseTo(course.drop, 0);
      else expect(pts[0].y - last.y).toBeGreaterThan(0.6 * level.mountain.vertical);
    }
  });

  it("never crosses itself, and no two stretches share a corridor", () => {
    for (const level of corpus()) {
      const a = analysisFor(level.seed);
      expect(a.findings.filter((f) => f.rule === "R5")).toEqual([]);
      expect(a.stats.minSeparation).toBeGreaterThanOrEqual(R.track.separation.plan - 0.5);
    }
  });

  it("bends no tighter than the rule, and stays in its width band, the arena widest", () => {
    for (const level of corpus()) {
      expect(analysisFor(level.seed).stats.minRadius).toBeGreaterThanOrEqual(
        R.track.minRadius - 0.5,
      );
      const pts = level.track.points;
      // The grade's band on the run (R23); the arena opens to R7's widest.
      // A resort's pistes are its own (R27): no narrower than a black's
      // neck, no wider than its widest, the arena at least R7's.
      const band = level.resort
        ? { min: Math.min(...Object.values(RR.piste.neck.width)), max: RR.piste.most }
        : { min: gradeRowOf(level).track.width.min, max: R.track.width.max };
      for (const p of pts) expect(withinBand(p.width, band, 0.5)).toBe(true);
      const arena = pts[pts.length - 1].width;
      if (level.resort) expect(arena).toBeGreaterThanOrEqual(R.track.width.max - 0.5);
      else expect(arena).toBeCloseTo(R.track.width.max, 1);
    }
  });

  it("is graded: NEVER CLIMBS, falls inside the rule along, and keeps its camber across", () => {
    for (const level of corpus()) {
      const s = analysisFor(level.seed).stats;
      expect(s.climb).toBeLessThanOrEqual(0.005);
      // A resort's course is measured by its colour (R23, R27) under the
      // rule book's own ceiling, as the analyzer holds it; a one-piste map
      // under its grade row's.
      const ceiling = level.resort ? R.track.maxGrade : gradeRowOf(level).track.maxGrade;
      expect(s.maxGrade).toBeLessThanOrEqual(ceiling + 0.01);
      expect(s.minGrade).toBeGreaterThanOrEqual(R.track.minGrade - 0.01);
      expect(s.maxCrossSlope).toBeLessThanOrEqual(R.track.camber + 0.03);
      // The finish straight is the one flat.
      expect(Math.abs(s.finishGrade)).toBeLessThan(0.03);
      // Its colour is read off its steepest hundred metres — and it is the
      // colour the map was built to (R23).
      expect(s.colour).toBe(pisteGradeOf(s.steepestSpan));
      expect(s.colour).toBe(level.grade);
    }
  });

  it("is packed on the centreline and powder a few metres past the edge (R10)", () => {
    for (const level of corpus()) {
      const F = R.drift.fade;
      const drifted = (s: number): boolean =>
        level.drifts.some((d) => s > d.from - F && s < d.to + F);
      for (const p of level.track.points.filter((_, i) => i % 7 === 0)) {
        // Where two runs' surfaces meet, the snow is the junction's.
        const meeting = runsCovering(level, p.x, p.z, 0).size > 1;
        if (!drifted(p.s) && !meeting) expect(level.packedAt(p.x, p.z)).toBeGreaterThan(0.98);
        const off = p.width / 2 + R.track.shoulder.packed + 3;
        const rx = Math.cos(p.heading);
        const rz = -Math.sin(p.heading);
        for (const side of [-1, 1]) {
          const x = p.x + rx * off * side;
          const z = p.z + rz * off * side;
          if (groomedBeside(level, x, z)) continue;
          expect(level.packedAt(x, z), `s ${p.s.toFixed(0)} on seed ${level.seed}`).toBeLessThan(
            0.1,
          );
        }
      }
    }
  });
});

describe("the windrows (R18)", () => {
  it("stands a ridge along both edges the whole way down, no steeper than the grid can read", () => {
    for (const level of corpus()) {
      const s = analysisFor(level.seed).stats;
      expect(s.bermLow).toBeGreaterThan(0.4 * R.berm.height.min);
      expect(s.bermLow).toBeLessThan(R.berm.height.max + 0.3);
      expect(s.bermSteep).toBeLessThanOrEqual(R.berm.maxSlope + 0.25);
    }
  });

  it("wanders inside its band down the piste", () => {
    for (let s = 0; s < 4500; s += 7) expect(withinBand(bermCrest(s), R.berm.height)).toBe(true);
    expect(bermProfile(1, 0)).toBe(0);
    expect(bermProfile(1, R.berm.width / 2)).toBeCloseTo(1, 9);
    expect(bermProfile(1, R.berm.width)).toBe(0);
  });
});

describe("the kickers (R4, R9)", () => {
  it("puts its grade's count of kickers on every piste, each sized to its pitch", () => {
    for (const level of corpus()) {
      const G = gradeRowOf(level).kickers;
      const on = level.kickers.filter((k) => k.onTrack);
      // A resort's runs each carry their own share (R27): a course of
      // several runs carries theirs, sized to the colours they are.
      if (!level.resort) expect(withinBand(on.length, G.on)).toBe(true);
      const multiples = level.resort
        ? PISTE_GRADES.map((g) => GRADES[g].kickers.height)
        : [G.height];
      const lips = {
        min: R.kickers.on.height.min * Math.min(...multiples),
        max: R.kickers.on.height.max * Math.max(...multiples),
      };
      for (const k of on) expect(withinBand(k.height, lips)).toBe(true);
    }
  });

  it("makes every piste kicker a crest a skier leaves the snow over, off a pitch no steeper than a red's", () => {
    for (const level of corpus()) {
      for (const k of level.kickers.filter((k) => k.onTrack)) {
        const at = (u: number): number => {
          const p = trackPointAt(level, (k.s ?? 0) + u);
          return level.groundAt(p.x, p.z);
        };
        // The break in grade across the lip, over the three metres either
        // side the analysis reads it.
        const lip = at(0);
        expect((lip - at(-3)) / 3 - (at(3) - lip) / 3).toBeGreaterThan(0.15);
        const approach = (at(-k.ramp) - (lip - k.height)) / k.ramp;
        const most = level.resort
          ? GRADES.black.kickers.approachGrade
          : gradeRowOf(level).kickers.approachGrade;
        expect(approach).toBeLessThanOrEqual(most + 0.03);
        expect(R.kickers.on.approachGrade).toBeLessThanOrEqual(R.grade.bands.red);
      }
    }
  });

  it("keeps the kickers off the piste clear of it", () => {
    for (const level of corpus()) {
      // The mountain's own (R4) — a neighbouring run's kickers are on that
      // piste, which may run beside the course off a shared top (R27).
      for (const k of level.kickers.filter((k) => !k.onTrack && k.run === undefined)) {
        const reach = Math.max(k.ramp, k.landing) + k.width / 2;
        expect(nearestTrackPoint(level, k.x, k.z).distance - reach).toBeGreaterThan(
          R.kickers.off.clearance,
        );
      }
    }
  });
});

describe("the start and the gates (R11–R13)", () => {
  it("opens on a straight run out of the start gate at its grade's pitch, clear of every kicker (R12)", () => {
    for (const level of corpus()) {
      const S = gradeRowOf(level).spawn;
      const gateArc = startGateArc();
      const gate = trackPointAt(level, gateArc);
      for (let u = 0; u <= R.spawn.run; u += 2) {
        const p = trackPointAt(level, gateArc + u);
        const turn = Math.atan2(
          Math.sin(p.heading - gate.heading),
          Math.cos(p.heading - gate.heading),
        );
        expect(Math.abs(turn)).toBeLessThanOrEqual(R.spawn.straight + 0.02);
        if (u + R.track.gradeWindow > R.spawn.run) continue;
        const q = trackPointAt(level, gateArc + u + R.track.gradeWindow);
        expect((p.y - q.y) / R.track.gradeWindow).toBeLessThanOrEqual(S.maxSlope + 0.02);
      }
      for (const k of level.kickers.filter((kk) => kk.onTrack)) {
        expect((k.s ?? 0) - gateArc).toBeGreaterThanOrEqual(R.spawn.kickerGap - 1);
      }
    }
  });

  it("stands the gates from the start gate to the finish line, in order, alternating red and blue (R11)", () => {
    for (const level of corpus()) {
      const cps = level.checkpoints;
      const L = level.track.length;
      expect(cps[0].s).toBeCloseTo(startGateArc(), 6);
      expect(cps[cps.length - 1].s).toBeCloseTo(L, 6);
      // A course's gates are R28's: spaced its own way, and every one
      // between the start gate and the finish a SLALOM GATE standing its
      // offset off the line (tests/resort_test.ts holds the weave).
      const gap = level.resort ? RR.course.gates.spacing : R.checkpoint.spacing;
      for (let i = 0; i < cps.length; i++) {
        expect(cps[i].colour).toBe(i % 2 === 0 ? "red" : "blue");
        if (i + 1 < cps.length) {
          expect(withinBand(cps[i + 1].s - cps[i].s, gap, 0.5)).toBe(true);
        }
        const off = Math.abs(cps[i].offset ?? 0);
        expect(nearestTrackPoint(level, cps[i].x, cps[i].z).distance).toBeCloseTo(off, 0);
        const p = trackPointAt(level, cps[i].s);
        if (cps[i].offset === undefined) {
          expect(cps[i].width).toBeCloseTo(p.width + 2 * R.checkpoint.margin, 6);
        } else {
          expect(level.resort).toBeDefined();
          expect(cps[i].width).toBeLessThan(p.width);
        }
      }
    }
  });

  it("stands the skiers four abreast on the start line, the player leftmost (R13)", () => {
    for (const level of corpus()) {
      expect(level.grid).toHaveLength(R.grid.slots);
      const first = level.track.points[0];
      for (const g of [level.spawn, ...level.grid]) {
        const hit = nearestTrackPoint(level, g.x, g.z);
        expect(hit.distance).toBeLessThan(first.width / 2 - 1);
        expect(level.packedAt(g.x, g.z)).toBeGreaterThan(0.98);
        expect(hit.s).toBeLessThanOrEqual(R.track.step);
        expect(Math.abs(Math.sin(g.heading - first.heading))).toBeLessThan(0.05);
      }
      // The spawn is the row's centreline point; the start gate stands
      // `grid.back` and a station ahead of it.
      expect(nearestTrackPoint(level, level.spawn.x, level.spawn.z).distance).toBeLessThan(0.1);
      expect(level.checkpoints[0].s - 0).toBeCloseTo(R.grid.back + R.track.step, 6);
      // The player's slot is the leftmost: the most negative lateral.
      const laterals = level.grid.map((g) => nearestTrackPoint(level, g.x, g.z).lateral);
      expect(laterals[0]).toBeCloseTo(Math.min(...laterals), 6);
      for (let a = 0; a < level.grid.length; a++) {
        for (let b = a + 1; b < level.grid.length; b++) {
          const d = Math.hypot(
            level.grid[a].x - level.grid[b].x,
            level.grid[a].z - level.grid[b].z,
          );
          expect(d).toBeGreaterThanOrEqual(R.grid.spacing - 0.05);
        }
      }
    }
  });
});

describe("the drifts (R17)", () => {
  it("lays every drift in its band, apart, clear of the start and the finish and of every kicker", () => {
    for (const level of corpus()) {
      const L = level.track.length;
      const F = R.drift.fade;
      level.drifts.forEach((d, i) => {
        expect(d.to - d.from).toBeGreaterThanOrEqual(R.drift.length.min - 1);
        expect(d.to - d.from).toBeLessThanOrEqual(R.drift.length.max + 1);
        expect(d.from - F).toBeGreaterThanOrEqual(R.drift.clear - 1);
        expect(d.to + F).toBeLessThanOrEqual(L - R.drift.clear + 1);
        const next = level.drifts[i + 1];
        if (next) expect(next.from - d.to).toBeGreaterThanOrEqual(R.drift.gap + 2 * F - 1);
        for (const k of level.kickers.filter((kk) => kk.onTrack)) {
          const s0 = k.s ?? 0;
          expect(d.from - F >= s0 + k.landing || d.to + F <= s0 - k.ramp).toBe(true);
        }
      });
    }
  });

  it("drifts the piste's whole width over the core of every stretch", () => {
    for (const level of corpus()) {
      for (const d of level.drifts) {
        for (let s = d.from; s <= d.to; s += 10) {
          const p = trackPointAt(level, s);
          const rx = Math.cos(p.heading);
          const rz = -Math.sin(p.heading);
          for (const u of [-0.45, 0, 0.45]) {
            const x = p.x + rx * u * p.width;
            const z = p.z + rz * u * p.width;
            // Where another run meets the course — joins it, or a lane
            // leaves it, its bench and windrow opened — the snow is the
            // junction's, drawn onto the course's (R27).
            if (runsCovering(level, x, z, JUNCTION).size > 1) continue;
            expect(level.packedAt(x, z), `seed ${level.seed} at s ${s.toFixed(0)}`).toBeLessThan(
              R.drift.packed + 0.05,
            );
          }
        }
      }
    }
  });

  it("deals some maps a groomer and some a powder run", () => {
    const L = 3600;
    const shares = Array.from(
      { length: 64 },
      (_, i) => dealDrifts(subSeed(i + 1, 0), L, []).reduce((a, d) => a + d.to - d.from, 0) / L,
    );
    for (const share of shares) {
      expect(share).toBeLessThanOrEqual(R.drift.share.max + R.drift.length.min / L + 0.01);
    }
    expect(Math.min(...shares)).toBeLessThan(0.08);
    expect(Math.max(...shares)).toBeGreaterThan(0.35);
    for (const level of corpus()) {
      const lvl = level.drifts.reduce((a, d) => a + d.to - d.from, 0) / level.track.length;
      expect(lvl).toBeLessThanOrEqual(gradeRowOf(level).drift.max + 0.08);
    }
  });
});

describe("the forest (R14)", () => {
  it("leaves room to ski between any two trees", () => {
    for (const level of corpus()) {
      expect(analysisFor(level.seed).stats.treeGap).toBeGreaterThanOrEqual(R.forest.gap - 0.01);
      for (const t of level.trees) expect(t.crown).toBeLessThanOrEqual(R.forest.crownMax);
      expect(R.forest.gap - 2 * R.forest.crownMax).toBeGreaterThan(2);
    }
  });

  it("stands no tree on the piste's corridor — on a resort, on any run's", () => {
    const reach = R.track.width.max / 2 + R.forest.corridor;
    const hit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
    for (const level of corpus()) {
      if (level.resort) {
        const on = level.trees.filter(
          (t) => runsCovering(level, t.x, t.z, R.forest.corridor - 0.5).size > 0,
        );
        expect(on, `seed ${level.seed}`).toEqual([]);
        continue;
      }
      for (const t of level.trees) {
        nearestWithin(level, t.x, t.z, reach, hit);
        if (hit.distance === Infinity) continue;
        const edge = level.track.points[hit.index].width / 2;
        expect(hit.distance).toBeGreaterThanOrEqual(edge + R.forest.corridor - 0.5);
      }
    }
  });

  it("stops at the tree line — an altitude — with krummholz under it and tall woods low down", () => {
    for (const level of corpus()) {
      const M = level.mountain;
      // Its height over the valley floor: a resort's is its village's.
      const floor = level.resort ? level.resort.village.y : M.base.y;
      const lineY = floor + (M.treeLine - M.altitude);
      expect(analysisFor(level.seed).stats.aboveTreeLine).toBe(0);
      expect(analysisFor(level.seed).stats.treeLineY).toBeCloseTo(lineY, 6);
      for (const t of level.trees) expect(t.y).toBeLessThanOrEqual(lineY + 0.01);
      const mean = (ts: typeof level.trees): number =>
        ts.reduce((a, t) => a + t.height, 0) / Math.max(1, ts.length);
      const stunted = level.trees.filter((t) => t.y > lineY - R.forest.krummholz * 0.5);
      const low = level.trees.filter((t) => t.y < lineY - R.forest.krummholz * 2);
      if (stunted.length > 20 && low.length > 20) {
        expect(mean(stunted)).toBeLessThan(mean(low) * 0.8);
      }
      // The summit ridge stands bare where it tops the tree line: nothing
      // within the top of the vertical.
      if (lineY < M.summit.y - 20) {
        for (const t of level.trees) expect(t.y).toBeLessThan(M.summit.y - 20);
      }
    }
  });
});

describe("the face (R3)", () => {
  it("falls from the summit ridge to the valley floor on a concave profile", () => {
    for (const level of corpus()) {
      const M = level.mountain;
      const x = M.summit.x;
      const top = level.groundAt(x, M.summit.z + 30);
      const mid = level.groundAt(x, (M.summit.z + M.base.z) / 2);
      const foot = level.groundAt(x, M.base.z);
      expect(top).toBeGreaterThan(mid);
      expect(mid).toBeGreaterThan(foot);
      // Concave: more than half the drop is above the middle.
      expect(top - mid).toBeGreaterThan(0.5 * (top - foot));
      // The valley floor is nearly flat across.
      const a = level.groundAt(x - 200, M.base.z + 100);
      const b = level.groundAt(x + 200, M.base.z + 100);
      expect(Math.abs(a - b) / 400).toBeLessThan(0.12);
    }
  });

  it("folds the face into rollers a skier at speed leaves the snow over", () => {
    // Crests along lines down the face sharp enough to throw a skier at
    // 70 km/h (curvature over g/v²), per km, well clear of the piste.
    const v = 70 / 3.6;
    const need = 9.81 / (v * v);
    let crests = 0;
    let km = 0;
    for (const level of corpus()) {
      for (const dx of [-450, -300, 300, 450]) {
        const x = level.size / 2 + dx;
        let inCrest = false;
        for (let z = 0.25 * level.size; z < 0.85 * level.size; z += 1) {
          const y0 = level.groundAt(x, z - 3);
          const y1 = level.groundAt(x, z);
          const y2 = level.groundAt(x, z + 3);
          const launch = -(y0 - 2 * y1 + y2) / 9 > need;
          if (launch && !inCrest) crests++;
          inCrest = launch;
        }
        km += 0.6 * (level.size / 1000);
      }
    }
    expect(crests / km).toBeGreaterThan(2);
  });
});

describe("the cliffs (R22)", () => {
  it("stands cliffs on nearly every map, each a drop clear of the piste", () => {
    let withCliffs = 0;
    for (const level of corpus()) {
      // On a resort the cliffs are the mountain's, clear of every run at
      // the rule book's own clearance.
      const G = level.resort
        ? { count: 1, clearance: R.cliff.clearance }
        : gradeRowOf(level).cliffs;
      const clear = R.track.width.max / 2 + G.clearance;
      const cliffs = mountainCliffs(level);
      const distance = (x: number, z: number): number =>
        level.resort ? nearestRun(level, x, z, 400) : nearestTrackPoint(level, x, z).distance;
      if (cliffs.length >= scaleCount(R.cliff.count, G.count).min) withCliffs++;
      for (const c of cliffs) {
        expect(withinBand(c.drop, R.cliff.drop)).toBe(true);
        expect(withinBand(c.shelf, R.cliff.shelf)).toBe(true);
        expect(withinBand(c.width, R.cliff.width)).toBe(true);
        for (const p of cliffFootprint(c)) expect(distance(p.x, p.z)).toBeGreaterThan(clear - 1);
        const fx = Math.sin(c.heading);
        const fz = Math.cos(c.heading);
        const top = level.groundAt(c.x - fx, c.z - fz);
        const foot = level.groundAt(c.x + fx * (c.face + 1), c.z + fz * (c.face + 1));
        expect(top - foot).toBeGreaterThan(c.drop * 0.75);
        for (const t of level.trees) {
          const u = (t.x - c.x) * fx + (t.z - c.z) * fz;
          const w = Math.abs((t.x - c.x) * fz - (t.z - c.z) * fx);
          const onIt = u > -c.shelf && u < c.face + c.landing && w < c.width / 2;
          expect(onIt, `a tree on ${c.id} of seed ${level.seed}`).toBe(false);
        }
      }
    }
    expect(withCliffs).toBeGreaterThanOrEqual(Math.ceil(LEVEL_SEEDS.length * 0.75));
  });

  it("shapes a level shelf, a sheer face and a landing falling away below it", () => {
    const c = { drop: 8, shelf: 80, face: 3.2, apron: 4, landing: 24 };
    expect(cliffProfile(c, -c.shelf)).toBe(0);
    expect(cliffProfile(c, 0)).toBeCloseTo(c.drop + c.apron, 9);
    expect(cliffProfile(c, 0) - cliffProfile(c, -1)).toBeLessThan(0.05);
    expect(cliffProfile(c, 0) - cliffProfile(c, c.face)).toBeCloseTo(c.drop, 9);
    expect(c.drop / c.face).toBeGreaterThan(2);
    const at = (u: number): number => cliffProfile(c, c.face + u);
    expect(at(0) - at(2)).toBeGreaterThan(at(c.landing - 2) - at(c.landing));
    expect(at(c.landing)).toBe(0);
  });
});
