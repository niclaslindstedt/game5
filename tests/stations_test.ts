// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STATIONS (`docs/summit-stations.md`): every lift's two stations laid
// out off the research (`pwa/src/game/station-plan.ts`), the carriers on
// the rope where the clock has them on every map (`carrierAt` — the lifts
// always run), the lens's summit at a top station's pad
// (`camera-summit.ts`) and the rider sat on a chair (`skier-seat.ts`).

import { describe, expect, it } from "vitest";

import {
  CHAIR_EXIT,
  carrierAt,
  carrierCount,
  chairLane,
  liftPlans,
  runsOffTop,
  stationHouses,
  TUNING,
} from "@engine";
import { summitShare } from "../pwa/src/game/camera-summit.ts";
import { summitSigns } from "../pwa/src/game/run-sign-plan.ts";
import { MOUNTS, skierPose } from "../pwa/src/game/skier-pose.ts";
import { CHAIR_SEAT, seatedPose } from "../pwa/src/game/skier-seat.ts";
import { layStations, signsOf } from "../pwa/src/game/station-plan.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);
const plans = liftPlans(level);
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

  it("stands the patrol's hut and the map board on the highest top alone", () => {
    expect(layout.parts.filter((q) => q.kind === "patrol")).toHaveLength(1);
    expect(layout.parts.filter((q) => q.kind === "board")).toHaveLength(1);
    const peak = plans.reduce((a, b) => (b.lift.top.y > a.lift.top.y ? b : a));
    const hut = layout.parts.find((q) => q.kind === "patrol")!;
    expect(Math.hypot(hut.x - peak.lift.top.x, hut.z - peak.lift.top.z)).toBeLessThan(30);
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

  it("signs every run the pad drops onto, on wooden arrow boards pointing the way it leaves", () => {
    for (const p of chairs) {
      const lane = chairLane(p);
      const runs = runsOffTop(level, p).map((j) => level.resort!.runs[j.run]);
      const signs = signsOf(level, p);
      expect(signs.map((s) => s.run).sort()).toEqual(runs.map((r) => r.id).sort());
      // Every run joined lies below the pad.
      for (const r of runs) expect(r.points.some((q) => q.y < p.lift.top.y - 2)).toBe(true);
      if (signs.length === 0) continue;
      const post = summitSigns(level).find(
        (q) => Math.hypot(frame(p, q.x, q.z).u - lane.signs, frame(p, q.x, q.z).v - lane.v) < 0.01,
      );
      expect(post).toBeDefined();
      expect(post!.boards.map((b) => b.run)).toEqual(signs.map((s) => s.run));
      signs.forEach((s, i) => {
        expect(post!.boards[i].grade).toBe(s.grade);
        // The lane's side (+v) is the reader's left as the picture shows it.
        expect(post!.boards[i].point).toBe(s.way === 1 ? "left" : "right");
      });
    }
  });
});

describe("the lifts always run", () => {
  it("moves every carrier round its loop at the rope's speed, a pure function of the clock", () => {
    for (const p of plans) {
      const n = carrierCount(p);
      expect(n).toBeGreaterThan(1);
      for (const k of [0, Math.floor(n / 2)]) {
        const a = carrierAt(p, k, 10);
        const b = carrierAt(p, k, 10.5);
        expect(carrierAt(p, k, 10)).toEqual(a);
        expect(a.u).toBeGreaterThanOrEqual(0);
        expect(a.u).toBeLessThanOrEqual(p.length);
        if (a.side === b.side && a.out && b.out)
          expect(Math.abs(b.u - a.u)).toBeCloseTo(p.look.speed * 0.5, 6);
      }
    }
  });
});

describe("the summit as the lens reads it", () => {
  it("is whole on a top station's pad and nothing out on the face", () => {
    const top = plans.find((p) => p.lift.kind === "chair")!.lift.top;
    expect(summitShare(level, top.x, top.z)).toBeCloseTo(1, 6);
    expect(summitShare(level, level.spawn.x, level.size - 100)).toBe(0);
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
