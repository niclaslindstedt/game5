// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR AS DRAWN (`para-canopy.ts`): the wing held to a speed wing's
// measured bands — its flat aspect ratio, its arc's projected span, its
// cells and its closed tips — the mesh finite, the line plan hung off the
// eight risers, and the paint the shader lays restated where the suite can
// read it.

import { describe, expect, it } from "vitest";

import {
  CANOPY,
  CANOPY_PAINT,
  canopyLayout,
  linePlan,
  paintAt,
  ribAt,
  shapeCanopy,
} from "../pwa/src/game/para-canopy.ts";

/** The flat area, m²: the chord summed along the flat span. */
function flatArea(): number {
  const n = 2000;
  let a = 0;
  for (let i = 0; i < n; i++) a += ribAt(-1 + (2 * (i + 0.5)) / n).chord;
  return (a * CANOPY.span) / n;
}

describe("the paramotor's wing", () => {
  it("is a speed wing's size and shape", () => {
    const area = flatArea();
    expect(area).toBeGreaterThan(13);
    expect(area).toBeLessThan(18);
    const aspect = CANOPY.span ** 2 / area;
    expect(aspect).toBeGreaterThanOrEqual(2.7);
    expect(aspect).toBeLessThanOrEqual(3.9);
    expect(CANOPY.cells).toBeGreaterThanOrEqual(17);
    expect(CANOPY.cells).toBeLessThanOrEqual(27);
  });

  it("arcs to about 0.83 of its flat span, its tips curled well down", () => {
    const projected = ribAt(1).x - ribAt(-1).x;
    expect(projected / CANOPY.span).toBeGreaterThan(0.76);
    expect(projected / CANOPY.span).toBeLessThan(0.9);
    const tip = ribAt(1);
    // The tip's rib tipped 60–80° off the vertical.
    const tilt = (Math.atan2(tip.nx, tip.ny) * 180) / Math.PI;
    expect(tilt).toBeGreaterThan(55);
    expect(tilt).toBeLessThan(85);
    expect(tip.y).toBeLessThan(-1);
  });

  it("builds a finite mesh, and keeps it finite under the brakes", () => {
    const { vertices, index, paint } = canopyLayout();
    expect(paint.length).toBe(vertices * 3);
    expect(paint.every(Number.isFinite)).toBe(true);
    expect(Math.max(...index)).toBeLessThan(vertices);
    for (const [left, right] of [
      [0, 0],
      [1, 0.3],
      [1, 1],
    ]) {
      const out = new Float32Array(vertices * 3);
      shapeCanopy(out, left, right);
      expect(out.every(Number.isFinite)).toBe(true);
    }
  });

  it("hangs every line off one of the eight risers", () => {
    const plan = linePlan();
    const tied = new Set<number>();
    plan.forEach((n) => n.children.forEach((c) => tied.add(c)));
    const mains = plan.filter((_, i) => !tied.has(i));
    for (const side of [-1, 1]) {
      for (const riser of ["A", "B", "C", "brake"] as const) {
        expect(mains.some((m) => m.side === side && m.riser === riser)).toBe(true);
      }
    }
    // Every knot after its children, on its own side.
    plan.forEach((n, i) =>
      n.children.forEach((c) => {
        expect(c).toBeLessThan(i);
        expect(plan[c].side).toBe(n.side);
      }),
    );
    // Both stabilizers carry a line.
    expect(plan.filter((n) => n.leaf?.stabilo).length).toBe(2);
  });

  it("paints the open cells' mouths under the nose, never the closed tips'", () => {
    const s = (CANOPY.mouth[0] + CANOPY.mouth[1]) / 2;
    expect(paintAt(0, s, -1, Math.floor(CANOPY.cells / 2))).toEqual(CANOPY_PAINT.mouth);
    expect(paintAt(-0.98, s, -1, 0)).not.toEqual(CANOPY_PAINT.mouth);
    expect(paintAt(0, s, 1, Math.floor(CANOPY.cells / 2))).not.toEqual(CANOPY_PAINT.mouth);
    expect(paintAt(0.95, 0.5, 1, CANOPY.cells - 1)).toEqual(CANOPY_PAINT.tips);
  });
});
