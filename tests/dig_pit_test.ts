// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOLE DUG DOWN TO A BURIED SKIER AS DRAWN (`pwa/src/game/dig-pit.ts`):
// a slot cut in from downhill, down by the share dug through the drawn
// debris, its walls standing over the snow it is cut out of, and the
// ground's cut the same rectangle its rim is.

import { describe, expect, it } from "vitest";

import {
  PIT,
  PIT_TRIANGLES,
  PIT_VERTS,
  pitCut,
  pitShape,
  type PitCut,
} from "../pwa/src/game/dig-pit.ts";

/** A plane falling toward +z at 30 %, debris `lift` m over the ground. */
const surface = (_x: number, z: number): number => 100 - 0.3 * z;
const liftOf = (lift: number) => (): number => lift;

function shape(dug: number, depth = 1, lift = 1.2) {
  const pos = new Float32Array(PIT_VERTS * 3);
  const col = new Float32Array(PIT_VERTS * 3);
  const b = { x: 10, z: 20, depth, dug };
  pitShape(b, 0, 1, surface, liftOf(lift), pos, col);
  return { pos, col, b };
}

describe("the hole dug down to him", () => {
  it("is twenty triangles, every corner written", () => {
    expect(PIT_VERTS).toBe(PIT_TRIANGLES * 3);
    const { pos } = shape(0.5);
    expect(pos.every((v) => Number.isFinite(v) && v !== 0)).toBe(true);
  });

  it("goes down through the drawn debris by the share dug, to where he lies when out", () => {
    for (const [dug, lift] of [
      [0.5, 1.2],
      [1, 1.2],
      [1, 0.2],
    ] as const) {
      const { pos, b } = shape(dug, 1, lift);
      let lowest = Infinity;
      for (let i = 0; i < PIT_VERTS; i++) {
        const z = pos[i * 3 + 2];
        const y = pos[i * 3 + 1];
        lowest = Math.min(lowest, y - surface(0, z));
      }
      expect(lowest).toBeCloseTo(-(dug / b.depth) * Math.max(PIT.least, lift), 5);
    }
  });

  it("stands a lip over the snow at its rim, and its walls go deeper the bluer", () => {
    const { pos, col } = shape(0.8);
    let top = -Infinity;
    for (let i = 0; i < PIT_VERTS; i++) {
      top = Math.max(top, pos[i * 3 + 1] - surface(0, pos[i * 3 + 2]));
    }
    expect(top).toBeCloseTo(PIT.lip, 5);
    // The deepest corner is the darkest.
    let deepest = 0;
    for (let i = 0; i < PIT_VERTS; i++) {
      if (
        pos[i * 3 + 1] - surface(0, pos[i * 3 + 2]) <
        pos[deepest * 3 + 1] - surface(0, pos[deepest * 3 + 2])
      )
        deepest = i;
    }
    expect(col[deepest * 3 + 2]).toBeLessThan(PIT.wall[2]);
  });

  it("is cut out of the ground by the rectangle its rim is", () => {
    const { pos, b } = shape(0.8);
    const cut: PitCut = pitCut(b, 0, 1, { x: 0, z: 0, heading: 0, hw: 0, hd: 0 });
    expect(cut.heading).toBeCloseTo(0, 6);
    for (let i = 0; i < PIT_VERTS; i++) {
      const dx = pos[i * 3] - cut.x;
      const dz = pos[i * 3 + 2] - cut.z;
      expect(Math.abs(dx)).toBeLessThanOrEqual(cut.hw + 1e-4);
      expect(Math.abs(dz)).toBeLessThanOrEqual(cut.hd + 1e-4);
    }
    // ...the uphill wall behind the body, the ramp running out downhill.
    expect(cut.z - cut.hd).toBeCloseTo(b.z - PIT.behind, 5);
    expect(cut.z + cut.hd).toBeGreaterThan(b.z + PIT.floor);
  });
});
