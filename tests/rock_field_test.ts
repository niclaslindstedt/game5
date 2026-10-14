import { describe, expect, it } from "vitest";
import {
  ROCK_FIELD,
  noRockIn,
  rockFieldAt,
  rockFieldOf,
  rockLeaf,
  rockShare,
  rtinMesh,
  rtinStart,
  rtinStep,
} from "@engine";
import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";

import { levelFor } from "./support/levels.ts";

// THE ROCK FIELD (`engine/game/rock-field.ts`) and ITS ADAPTIVE MESH
// (`rock-rtin.ts`): one pure function says where the stone stands, and the
// mesh at a tolerance stands within it of the finest mesh — the surface the
// physics rides.

const level = levelFor(38);
const field = rockFieldOf(level);

/** Rocky spots of the map, a few dozen. */
const spots: { x: number; z: number }[] = [];
for (let z = 300; z < level.size - 300; z += 37) {
  for (let x = 300; x < level.size - 300; x += 37) {
    if (rockShare(level, x, z) > 0.6) spots.push({ x, z });
  }
}

describe("the rock field", () => {
  it("is a pure function of the map, the same on every ask", () => {
    expect(spots.length).toBeGreaterThan(20);
    for (const p of spots.slice(0, 20)) {
      const a = { ...rockFieldAt(field, p.x, p.z) };
      const b = rockFieldAt(rockFieldOf(level), p.x, p.z);
      expect(b).toEqual(a);
    }
  });

  it("stands out of the snow on the walls, and never deeper under it than a hair", () => {
    let out = 0;
    for (const p of spots) {
      const f = rockFieldAt(field, p.x, p.z);
      expect(f.y).toBeGreaterThanOrEqual(f.ground - ROCK_FIELD.under - 1e-9);
      if (f.y > f.ground) out++;
    }
    // The backs of the ledges are filled with snow, their lips out of it.
    expect(out / spots.length).toBeGreaterThan(0.5);
  });

  it("lies only where the walls are bare: none off them", () => {
    for (let z = 20; z < level.size; z += 53) {
      for (let x = 20; x < level.size; x += 53) {
        if (!noRockIn(field, x - 2, z - 2, x + 2, z + 2)) continue;
        const f = rockFieldAt(field, x, z);
        expect(f.rock).toBe(0);
        expect(f.y).toBeLessThan(f.ground);
      }
    }
  });

  it("steps into ledges: the beds' treads lie flatter than the wall, their risers steeper", () => {
    // Down the fall line of a few walls, a metre at a time.
    let flatter = 0;
    let steeper = 0;
    let walked = 0;
    const n = { x: 0, y: 1, z: 0 };
    for (const p of spots.slice(0, 12)) {
      level.normalAt(p.x, p.z, n);
      const l = Math.hypot(n.x, n.z);
      const wall = l / n.y;
      for (let d = -6; d < 6; d++) {
        const a = rockFieldAt(field, p.x + (n.x / l) * d, p.z + (n.z / l) * d).y;
        const b = rockFieldAt(field, p.x + (n.x / l) * (d + 1), p.z + (n.z / l) * (d + 1)).y;
        const slope = a - b;
        if (slope < 0.6 * wall) flatter++;
        if (slope > 1.4 * wall) steeper++;
        walked++;
      }
    }
    expect(flatter / walked).toBeGreaterThan(0.25);
    expect(steeper / walked).toBeGreaterThan(0.05);
  });
});

describe("the rock's adaptive mesh", () => {
  /** A tile of rough heights over a ground, n cells a side. */
  function tile(n: number, seed: number) {
    const rng = createRng(seed);
    const size = n + 1;
    const rock = new Float32Array(size * size);
    const ground = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const k = y * size + x;
        ground[k] = 0.3 * x + 0.1 * y;
        const step = Math.floor((0.3 * x + 0.1 * y) / 2) * 2 - (0.3 * x + 0.1 * y);
        rock[k] = Math.max(ground[k] - 0.01, ground[k] + 0.8 + step + 0.2 * rng.next());
      }
    }
    return { rock, ground, size };
  }

  it("stands within its tolerance of the finest mesh at every sample: a hair over, a little more under", () => {
    for (const seed of [1, 2, 3]) {
      const n = 32;
      const { rock, ground, size } = tile(n, seed);
      const b = rtinStart(n, rock, ground, 4);
      rtinStep(b, () => true);
      for (const tol of [0.02, 0.1, 0.5]) {
        let tris = 0;
        rtinMesh(b, tol, (ax, ay, bx, by, cx, cy) => {
          tris++;
          const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
          for (let y = Math.min(ay, by, cy); y <= Math.max(ay, by, cy); y++) {
            for (let x = Math.min(ax, bx, cx); x <= Math.max(ax, bx, cx); x++) {
              const w1 = ((x - ax) * (cy - ay) - (cx - ax) * (y - ay)) / det;
              const w2 = ((bx - ax) * (y - ay) - (x - ax) * (by - ay)) / det;
              const w0 = 1 - w1 - w2;
              if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
              const k = y * size + x;
              const h =
                w0 * rock[ay * size + ax] + w1 * rock[by * size + bx] + w2 * rock[cy * size + cx];
              if (h <= ground[k] && rock[k] <= ground[k]) continue;
              // Against the rock where it stands out, the snow where not.
              const met = Math.max(rock[k], ground[k]);
              expect(h - met).toBeLessThanOrEqual(tol + 1e-4);
              expect(met - h).toBeLessThanOrEqual(4 * tol + 1e-4);
            }
          }
        });
        // Coarser at a looser tolerance, and never the whole grid.
        expect(tris).toBeLessThan(2 * n * n);
      }
    }
  });

  it("is built a slice at a time to the same mesh as at once", () => {
    const n = 64;
    const { rock, ground } = tile(n, 7);
    const whole = rtinStart(n, rock, ground, 4);
    rtinStep(whole, () => true);
    const sliced = rtinStart(n, rock, ground, 4);
    let slices = 0;
    while (!rtinStep(sliced, () => false)) slices++;
    expect(slices).toBeGreaterThan(3);
    expect(sliced.errors).toEqual(whole.errors);
  });

  it("holds every point in one of its finest triangles", () => {
    const n = ROCK_FIELD.tile / ROCK_FIELD.fine;
    const out = new Int32Array(6);
    const rng = createRng(11);
    for (let i = 0; i < 500; i++) {
      const u = rng.next() * n;
      const v = rng.next() * n;
      rockLeaf(n, u, v, out);
      const [ax, ay, bx, by, cx, cy] = out;
      // A right triangle of unit legs, its right angle at c...
      expect(Math.abs(ax - cx) + Math.abs(ay - cy)).toBe(1);
      expect(Math.abs(bx - cx) + Math.abs(by - cy)).toBe(1);
      // ...holding the point.
      const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      const w1 = ((u - ax) * (cy - ay) - (cx - ax) * (v - ay)) / det;
      const w2 = ((bx - ax) * (v - ay) - (u - ax) * (by - ay)) / det;
      expect(w1).toBeGreaterThanOrEqual(-1e-9);
      expect(w2).toBeGreaterThanOrEqual(-1e-9);
      expect(1 - w1 - w2).toBeGreaterThanOrEqual(-1e-9);
    }
  });
});
