// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE, ASKED (`engine/mapgen/query.ts`): the nearest point off the
// spatial hash agrees with walking every segment, the lateral offset is
// signed to the right of travel, and NOTHING WRAPS — the piste is open, so
// an arc past the finish is the finish, an arc before the start line is the
// start line, and "how far ahead" can be negative.
import { describe, expect, it } from "vitest";

import { LEVEL_RULES as R, arcAhead, arcBetween, nearestTrackPoint, trackPointAt } from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

describe("the piste queries", () => {
  it("nearestTrackPoint agrees with walking every segment", () => {
    const level = levelFor(LEVEL_SEEDS[1]);
    const pts = level.track.points;
    for (let k = 0; k < 60; k++) {
      const x = 100 + ((k * 397) % (level.size - 200));
      const z = 100 + ((k * 761) % (level.size - 200));
      let best = Infinity;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
        best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
      }
      expect(nearestTrackPoint(level, x, z).distance).toBeCloseTo(best, 6);
    }
  });

  it("signs the lateral offset positive to the right of travel", () => {
    const level = levelFor(LEVEL_SEEDS[2]);
    const p = level.track.points[100];
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    const right = nearestTrackPoint(level, p.x + rx * 4, p.z + rz * 4);
    const left = nearestTrackPoint(level, p.x - rx * 4, p.z - rz * 4);
    expect(right.lateral).toBeCloseTo(4, 1);
    expect(left.lateral).toBeCloseTo(-4, 1);
    expect(right.s).toBeCloseTo(p.s, 0);
  });

  it("trackPointAt interpolates the piste and clamps to its ends — nothing wraps", () => {
    const level = levelFor(LEVEL_SEEDS[3]);
    const L = level.track.length;
    const pts = level.track.points;
    const p = pts[37];
    const q = trackPointAt(level, p.s);
    expect(q.x).toBeCloseTo(p.x, 9);
    expect(q.z).toBeCloseTo(p.z, 9);
    const past = trackPointAt(level, L + 50);
    const last = pts[pts.length - 1];
    expect(past.x).toBeCloseTo(last.x, 9);
    expect(past.z).toBeCloseTo(last.z, 9);
    expect(past.s).toBe(L);
    const before = trackPointAt(level, -50);
    expect(before.x).toBeCloseTo(pts[0].x, 9);
    expect(before.s).toBe(0);
    // Halfway between two stations is halfway between them.
    const mid = trackPointAt(level, pts[10].s + R.track.step / 2);
    expect(mid.x).toBeCloseTo((pts[10].x + pts[11].x) / 2, 9);
  });

  it("measures arc down the piste, negative up it", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    expect(arcAhead(level, 100, 250)).toBe(150);
    expect(arcAhead(level, 250, 100)).toBe(-150);
    expect(arcBetween(level, 250, 100)).toBe(150);
  });
});
