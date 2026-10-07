// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE RUNS MEET (R27, generator v8): a lane leaving a piste and a run
// merging into another leave no step on the groomed snow. A lane graded
// under the surface of the piste it left — which the stamp never touches —
// stood a lip where that piste's core ended, and a wide run merging into a
// narrower one levelled its whole width to its own last station, a terrace
// the other fell away under in a wall. `make junctions` is the lab.

import { describe, expect, it } from "vitest";
import { generateLevel, type Level, type Run } from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

/** Whether a point stands on a piste's surface (its width and the flat
 * shoulder pressed beside it — on it a lane rides the piste as it lies, and
 * a lane walked up across one is the walk's, not the grading's). */
function onPiste(level: Level, x: number, z: number): boolean {
  return (level.resort?.runs ?? []).some(
    (r) =>
      r.kind === "piste" && r.points.some((p) => Math.hypot(p.x - x, p.z - z) < p.width / 2 + 16),
  );
}

/** The worst fall and climb between two stations of a lane, m a step, read
 * on the ground as it lies — wherever either station is off a piste (on one
 * it falls as the piste does). */
function laneSteps(level: Level, lane: Run): { fall: number; climb: number } {
  let fall = 0;
  let climb = 0;
  const pts = lane.points;
  const off = pts.map((p) => !onPiste(level, p.x, p.z));
  for (let i = 1; i < pts.length; i++) {
    if (!off[i] && !off[i - 1]) continue;
    const d = pts[i - 1].y - pts[i].y;
    fall = Math.max(fall, d / (pts[i].s - pts[i - 1].s));
    climb = Math.max(climb, -d);
  }
  return { fall, climb };
}

describe("where runs meet (R27)", () => {
  it("a lane never steps down or climbs off the piste it leaves", () => {
    let lanes = 0;
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      for (const lane of level.resort?.runs ?? []) {
        if (lane.kind !== "road") continue;
        lanes++;
        const { fall, climb } = laneSteps(level, lane);
        // A lane's ceiling is 12 %; a lip was 50–75 % in a stride.
        expect(fall, `seed ${seed} lane ${lane.id}`).toBeLessThan(0.3);
        expect(climb, `seed ${seed} lane ${lane.id}`).toBeLessThan(0.3);
      }
    }
    expect(lanes).toBeGreaterThan(0);
  });

  it("the black merging into the red on seed 3 leaves no wall beside it", () => {
    // The reported spot: run 8 (a black, 49 m wide) merging into run 2 (a red,
    // 18 m wide) — a 9 m wall stood on the red's downhill side past the end.
    const level = generateLevel(3, { region: "continental" });
    const n = { x: 0, y: 0, z: 0 };
    let worst = 0;
    for (let z = 1690; z <= 1740; z += 2) {
      for (let x = 1700; x <= 1760; x += 2) {
        if (level.packedAt(x, z) < 0.8) continue;
        level.normalAt(x, z, n);
        const across = Math.hypot(n.x, n.z);
        if (across < 0.02) continue;
        const fx = n.x / across;
        const fz = n.z / across;
        const h0 = level.groundAt(x - fx * 3, z - fz * 3);
        const h1 = level.groundAt(x, z);
        const h2 = level.groundAt(x + fx * 3, z + fz * 3);
        worst = Math.max(worst, (h1 - h2) / 3 - (h0 - h1) / 3);
      }
    }
    expect(worst).toBeLessThan(0.5);
  });
});
