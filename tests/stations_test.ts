// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STATIONS (`docs/summit-stations.md`): every lift's two stations laid
// out off the research (`pwa/src/game/station-plan.ts`), the carriers on
// the rope where the clock has them on every map (`carrierAt` — the lifts
// always run), the lens's summit at a top station's pad
// (`camera-summit.ts`) and the rider sat on a chair (`skier-seat.ts`).

import { describe, expect, it } from "vitest";

import {
  CHAIR_EXIT,
  angleDiff,
  carrierAt,
  carrierCount,
  carrierGripAt,
  carrierSpeedAt,
  carrierSwingAt,
  chairLane,
  LIFT_LOOK,
  liftPlans,
  rampHeight,
  rampLip,
  RESORT_RULES,
  ropeShortfall,
  runsOffTop,
  stationHouses,
  TUNING,
} from "@engine";
import { summitShare } from "../pwa/src/game/camera-summit.ts";
import { summitSigns } from "../pwa/src/game/run-sign-plan.ts";
import { MOUNTS, skierPose } from "../pwa/src/game/skier-pose.ts";
import { CHAIR_SEAT, seatedPose } from "../pwa/src/game/skier-seat.ts";
import { layStations, mapBoardOf } from "../pwa/src/game/station-plan.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);
const plans = liftPlans(level);
/** The first map of the corpus a top has a ramp off (R26) — a run that
 * starts on its top's contour right by the pad needs none, so not every
 * map lays one. */
const rampLevel =
  LEVEL_SEEDS.map(levelFor).find((l) =>
    liftPlans(l).some((p) => (p.lift.ramps ?? []).length > 0),
  ) ?? level;
const rampPlans = liftPlans(rampLevel);
const layout = layStations(level, plans);

describe("the stations laid out", () => {
  it("gives every chair a booth at both ends and a load line at its foot", () => {
    for (const p of plans.filter((q) => q.lift.kind === "chair")) {
      const near = (x: number, z: number, kind: string, r: number) =>
        layout.parts.filter((q) => q.kind === kind && Math.hypot(q.x - x, q.z - z) < r);
      expect(near(p.lift.top.x, p.lift.top.z, "booth", 20)).toHaveLength(1);
      expect(near(p.lift.bottom.x, p.lift.bottom.z, "booth", 20)).toHaveLength(1);
      expect(near(p.lift.top.x, p.lift.top.z, "hood", 4)).toHaveLength(1);
      const e = p.look.entry;
      const lx = p.lift.bottom.x + p.dx * e.at + p.dz * e.side;
      const lz = p.lift.bottom.z + p.dz * e.at - p.dx * e.side;
      expect(near(lx, lz, "load", 0.5)).toHaveLength(1);
    }
  });

  it("puts a gondola's door at the back of its station house, where it boards", () => {
    for (const p of plans.filter((q) => q.lift.kind === "gondola")) {
      const e = p.look.entry;
      const x = p.lift.bottom.x + p.dx * e.at;
      const z = p.lift.bottom.z + p.dz * e.at;
      expect(layout.parts.some((q) => q.kind === "door" && Math.hypot(q.x - x, q.z - z) < 1)).toBe(
        true,
      );
    }
  });

  it("stands a map board at every chair's and gondola's top, facing where its rider is let go", () => {
    const tops = plans.filter((p) => p.lift.kind !== "drag");
    const boards = layout.parts.filter((q) => q.kind === "board");
    expect(boards).toHaveLength(tops.length);
    for (const p of tops) {
      const board = boards.find(
        (q) => Math.hypot(q.x - p.lift.top.x, q.z - p.lift.top.z) < RESORT_RULES.lift.top.pad / 2,
      );
      expect(board).toBeDefined();
      // Its face turned to the pad's middle, not away from it.
      const toward = Math.atan2(p.lift.top.x - board!.x, p.lift.top.z - board!.z);
      expect(Math.abs(angleDiff(board!.yaw, toward))).toBeLessThan(Math.PI / 2);
    }
  });

  it("stands every piece on the snow it is over", () => {
    for (const q of layout.parts) {
      // A hood and a canopy are hung at the wheel.
      if (q.kind === "hood" || q.kind === "canopy") continue;
      expect(Math.abs(q.y - level.groundAt(q.x, q.z))).toBeLessThan(1e-6);
    }
  });
});

describe("the way off a chair's top", () => {
  const chairs = plans.filter((p) => p.lift.kind === "chair");
  /** A plan point in a lift's frame: `u` m up the line from its bottom,
   * `v` m to the up rope's side. */
  const frame = (p: (typeof plans)[number], x: number, z: number) => ({
    u: (x - p.lift.bottom.x) * p.dx + (z - p.lift.bottom.z) * p.dz,
    v: (x - p.lift.bottom.x) * p.dz - (z - p.lift.bottom.z) * p.dx,
  });

  it("stands the top's house beside the lane, on its outer side, ending short of the parting", () => {
    for (const p of chairs) {
      const lane = chairLane(p);
      const h = stationHouses(level, p)[1];
      const c = frame(p, h.x, h.z);
      expect(c.v - h.halfWidth - lane.v).toBeCloseTo(CHAIR_EXIT.house, 6);
      expect(c.u + h.halfLength).toBeLessThan(lane.exit);
    }
  });

  it("leaves the lane clear from the unload to the parting: no piece and no fence in it", () => {
    for (const p of chairs) {
      const lane = chairLane(p);
      const from = p.length - p.look.off;
      for (const q of layout.parts) {
        if (q.kind === "hood") continue;
        const c = frame(p, q.x, q.z);
        if (c.u < from || c.u > lane.exit) continue;
        expect(Math.abs(c.v - lane.v)).toBeGreaterThan(2);
      }
      for (const f of layout.fences) {
        for (let k = 0; k <= 10; k++) {
          const c = frame(
            p,
            f.a.x + ((f.b.x - f.a.x) * k) / 10,
            f.a.z + ((f.b.z - f.a.z) * k) / 10,
          );
          if (c.u < from || c.u > lane.exit) continue;
          expect(Math.abs(c.v - lane.v)).toBeGreaterThan(0.8);
        }
      }
    }
  });

  it("fences nothing at the top: no netting and no stop gate across the way off", () => {
    for (const p of chairs) {
      for (const f of layout.fences) {
        const c = frame(p, f.a.x, f.a.z);
        expect(Math.hypot(c.u - p.length, c.v)).toBeGreaterThan(40);
      }
    }
  });

  it("signs every run off its top beside the map board, on the side its ramp leaves, turned to him", () => {
    for (const p of chairs) {
      const runs = runsOffTop(level, p).map((j) => level.resort!.runs[j.run]);
      const ramps = p.lift.ramps ?? [];
      expect(ramps.map((r) => r.run).sort()).toEqual(runs.map((r) => r.id).sort());
      // Every run joined lies below the pad.
      for (const r of runs) expect(r.points.some((q) => q.y < p.lift.top.y - 2)).toBe(true);
      const board = mapBoardOf(p)!;
      const look = Math.atan2(board.x - board.off.x, board.z - board.off.z);
      // The reader's right as the picture shows it, looking at the board.
      const right = (x: number, z: number) =>
        -(x - board.x) * Math.cos(look) + (z - board.z) * Math.sin(look);
      for (const ramp of ramps) {
        const post = summitSigns(level).find((q) => q.boards.some((b) => b.run === ramp.run));
        expect(post).toBeDefined();
        // Beside the board, a sign's breadth off it, on the ramp's side.
        const apart = Math.hypot(post!.x - board.x, post!.z - board.z);
        expect(apart).toBeGreaterThan(2.5);
        expect(apart).toBeLessThan(4);
        expect(Math.sign(right(post!.x, post!.z))).toBe(
          right(ramp.from.x, ramp.from.z) >= 0 ? 1 : -1,
        );
        // Turned to him where he comes off the chair, at the lane's parting:
        // read as he stands up, never edge on.
        const seen = Math.atan2(post!.x - board.off.x, post!.z - board.off.z);
        expect(Math.abs(angleDiff(post!.heading, seen))).toBeLessThan(1e-9);
      }
    }
  });
});

describe("the lifts always run", () => {
  it("moves every carrier round its loop at the rope's speed, a pure function of the clock", () => {
    for (const p of plans) {
      const n = carrierCount(p);
      expect(n).toBeGreaterThan(1);
      for (const k of [0, Math.floor(n / 2), Math.floor(n / 3)]) {
        for (const t of [10, 37.25, 81.5]) {
          const a = carrierAt(p, k, t);
          const b = carrierAt(p, k, t + 0.5);
          expect(carrierAt(p, k, t)).toEqual(a);
          expect(a.u).toBeGreaterThanOrEqual(0);
          expect(a.u).toBeLessThanOrEqual(p.length);
          if (a.side !== b.side || !a.out || !b.out) continue;
          const run = Math.abs(b.u - a.u);
          // Out on the line at the rope's speed; slowed through a
          // detachable's terminals, never below their crawl.
          const lined = [a, b].every((c) => carrierSpeedAt(p, c.u, c.side) === p.look.speed);
          if (lined) expect(run).toBeCloseTo(p.look.speed * 0.5, 4);
          expect(run).toBeLessThanOrEqual(p.look.speed * 0.5 + 1e-6);
          expect(run).toBeGreaterThanOrEqual(Math.min(p.look.slow, p.look.speed) * 0.5 - 1e-3);
        }
      }
    }
  });

  it("slows a detachable's carriers to a crawl to load and unload them", () => {
    for (const p of plans.filter((q) => q.lift.kind === "chair")) {
      const load = p.look.entry.at;
      const off = p.length - p.look.off;
      expect(carrierSpeedAt(p, load, 0)).toBeCloseTo(p.look.slow, 6);
      expect(carrierSpeedAt(p, off, 0)).toBeCloseTo(p.look.slow, 6);
      expect(carrierSpeedAt(p, p.length / 2, 0)).toBe(p.look.speed);
      // Its grip on the station's rail there: the seat at a skier's knee
      // over the load line, and over the unload ramp's crest.
      const seat = TUNING.lift.seat + TUNING.lift.sit;
      expect(carrierGripAt(p, load) - p.supports[0].ground).toBeCloseTo(TUNING.lift.chair.rail, 6);
      expect(carrierGripAt(p, off) - p.ramp!).toBeGreaterThanOrEqual(seat - 1e-6);
      // And it swings on its hanger, never past its most.
      for (let u = 0; u <= p.length; u += 5)
        expect(Math.abs(carrierSwingAt(p, u, 0))).toBeLessThanOrEqual(TUNING.lift.swingMost);
    }
  });
});

describe("the summit as the lens reads it", () => {
  it("is whole on a top station's pad and nothing out on the face", () => {
    const top = plans.find((p) => p.lift.kind === "chair")!.lift.top;
    expect(summitShare(level, top.x, top.z)).toBeCloseTo(1, 6);
    expect(summitShare(level, level.spawn.x, level.size - 100)).toBe(0);
  });

  it("holds whole down a ramp off a top to its lip", () => {
    const ramps = rampPlans.flatMap((p) => p.lift.ramps ?? []);
    expect(ramps.length).toBeGreaterThan(0);
    for (const r of ramps) {
      const lip = rampLip(r);
      const k = (lip.at * 0.9) / lip.length;
      const x = r.from.x + (r.to.x - r.from.x) * k;
      const z = r.from.z + (r.to.z - r.from.z) * k;
      expect(summitShare(rampLevel, x, z)).toBeCloseTo(1, 6);
    }
  });
});

describe("the ramps off a top (R26)", () => {
  const RT = RESORT_RULES.lift.top;
  it("leave the pad's rim and come down to their run's snow, on the ground they were cut to", () => {
    for (const p of rampPlans) {
      for (const r of p.lift.ramps ?? []) {
        const run = rampLevel.resort!.runs.find((q) => q.id === r.run)!;
        expect(run.from).toBe(p.lift.id);
        // A pad's rim; a drag's, round where it lets its rider go.
        const drag = p.lift.kind === "drag";
        const back = drag ? RESORT_RULES.lift.drag.letGo : 0;
        const mx = p.lift.top.x - p.dx * back;
        const mz = p.lift.top.z - p.dz * back;
        expect(Math.hypot(r.from.x - mx, r.from.z - mz)).toBeCloseTo(
          drag ? RESORT_RULES.lift.drag.rim : RT.pad / 2,
          3,
        );
        expect(r.to.y).toBeLessThan(r.from.y);
        expect(rampHeight(r, 0)).toBeCloseTo(r.from.y, 6);
        expect(rampHeight(r, 1)).toBeCloseTo(r.to.y, 6);
        // The ground down its line is its own profile.
        for (const t of [0.2, 0.4, 0.6, 0.8]) {
          const x = r.from.x + (r.to.x - r.from.x) * t;
          const z = r.from.z + (r.to.z - r.from.z) * t;
          expect(
            Math.abs(rampLevel.groundAt(x, z) - rampHeight(r, t)),
            `${p.lift.id} ${r.run} ${t}`,
          ).toBeLessThan(0.3);
        }
        // Never steeper than its even fall's steepest.
        const lip = rampLip(r);
        for (let t = 0; t < 1; t += 0.05) {
          const fall = (rampHeight(r, t) - rampHeight(r, t + 0.05)) / (0.05 * lip.length);
          expect(fall).toBeLessThan(RT.ramp.steep / (1 - RT.ramp.ease / 2) + 0.05);
        }
      }
    }
  });

  it("are what a rider stood off the top skis down and the signs point to", () => {
    for (const p of rampPlans) {
      for (const r of p.lift.ramps ?? []) {
        const off = runsOffTop(rampLevel, p).find(
          (j) => rampLevel.resort!.runs[j.run].id === r.run,
        );
        expect(off).toBeDefined();
        expect(off!.at.x).toBeCloseTo(r.from.x, 6);
        expect(off!.at.s).toBeCloseTo(r.to.s, 6);
      }
    }
  });
});

describe("the rope over the snow (R26)", () => {
  it("carries every chair and cabin clear of the snow out of its load and unload zones", () => {
    for (const p of plans) expect(ropeShortfall(level, p).lack, p.lift.id).toBeLessThan(0.3);
  });

  it("cuts a top's approach to the lift's own measures (its restated copy of LIFT_LOOK)", () => {
    const A = RESORT_RULES.lift.top.approach;
    for (const k of ["chair", "gondola"] as const) {
      expect(A.wheel[k]).toBe(LIFT_LOOK[k].wheel);
      // Cut under a rope no higher than the lift hangs its own, so deep
      // enough: the towers have grown since the cut was ruled (v6), and
      // the last one before a top stands tall over it (`LiftLook.in`).
      expect(A.tower[k]).toBeLessThanOrEqual(LIFT_LOOK[k].tower);
      expect(A.hang[k]).toBe(LIFT_LOOK[k].hang);
    }
  });
});

describe("a rider sat on a chair", () => {
  const stood = {
    hipRight: 0,
    hipAft: 0,
    lean: 0,
    steer: 0,
    crouch: 0,
    airborne: false,
    landing: 10,
  };
  const y = TUNING.lift.seat - CHAIR_SEAT;

  it("is the stood pose with no share of the seat", () => {
    expect(seatedPose(stood, { share: 0, y })).toEqual(skierPose(stood));
  });

  it("sits his hips on the seat, his knees forward of them over the boots", () => {
    const p = seatedPose({ ...stood, mounts: MOUNTS }, { share: 1, y });
    expect(p.hips.y).toBeCloseTo(y + 0.11, 6);
    for (const i of [0, 1]) {
      expect(p.knees[i].z).toBeGreaterThan(p.hips.z + 0.2);
      expect(p.knees[i].y).toBeGreaterThan(p.feet[i].y);
      // The thigh and the shin keep their lengths.
      expect(
        Math.hypot(
          p.knees[i].x - p.hipJoints[i].x,
          p.knees[i].y - p.hipJoints[i].y,
          p.knees[i].z - p.hipJoints[i].z,
        ),
      ).toBeCloseTo(0.44, 2);
    }
    // Sat up off his lean.
    expect(p.pitch).toBeLessThan(0.05);
  });
});
