// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFTS' HARDWARE AS BUILT (`lift-shapes.ts`, `lift-carriers.ts`):
// every part filled (positions, normals, colours) and inside its triangle
// budget at both cuts, the chair built round the seat the rider's pose
// sits on (`CHAIR_SEAT`, `CHAIR_BACK`), the cabin to its bands, and a
// tower's head clear of the carriers that pass it.

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { COLUMN_TAPER, DRAG_ARM, LIFT_LOOK } from "@engine";

import {
  CABIN_HALF,
  CABIN_Y,
  bullwheelGeometry,
  cabinFarGeometry,
  cabinGeometry,
  CHAIR_BAR,
  chairBarFarGeometry,
  chairBarGeometry,
  chairFarGeometry,
  chairGeometry,
  springBoxFarGeometry,
  springBoxGeometry,
  teeFarGeometry,
  teeGeometry,
} from "../pwa/src/game/lift-carriers.ts";
import {
  columnGeometry,
  ladderGeometry,
  towerHeadFarGeometry,
  towerHeadGeometry,
  type HeadKind,
} from "../pwa/src/game/lift-shapes.ts";
import { CHAIR_BACK, CHAIR_SEAT } from "../pwa/src/game/skier-seat.ts";

const tris = (g: THREE.BufferGeometry) => g.getAttribute("position").count / 3;
const bounds = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox as THREE.Box3;
};
const head = (kind: HeadKind, far = false) =>
  (far ? towerHeadFarGeometry : towerHeadGeometry)(
    kind,
    LIFT_LOOK[kind].gauge,
    LIFT_LOOK[kind].column,
    COLUMN_TAPER,
    DRAG_ARM,
  );

describe("the lifts' hardware as built", () => {
  // [near, far, the near cut's budget, the far cut's]
  const parts: Record<string, [THREE.BufferGeometry, THREE.BufferGeometry | null, number, number]> =
    {
      chair: [chairGeometry(), chairFarGeometry(), 700, 160],
      chairBar: [chairBarGeometry(), chairBarFarGeometry(), 400, 24],
      cabin: [cabinGeometry(), cabinFarGeometry(), 700, 200],
      spring: [springBoxGeometry(), springBoxFarGeometry(), 150, 12],
      tee: [teeGeometry(), teeFarGeometry(), 120, 24],
      chairHead: [head("chair"), head("chair", true), 1500, 160],
      gondolaHead: [head("gondola"), head("gondola", true), 1800, 160],
      dragHead: [head("drag"), head("drag", true), 450, 40],
      column: [columnGeometry(COLUMN_TAPER), null, 40, 0],
      ladder: [ladderGeometry(), null, 500, 0],
      bullwheel: [bullwheelGeometry(), null, 300, 0],
    };

  it("fills every attribute, with unit normals", () => {
    for (const [near, far] of Object.values(parts)) {
      for (const g of far ? [near, far] : [near]) {
        const n = g.getAttribute("position").count;
        expect(n).toBeGreaterThan(0);
        expect(n % 3).toBe(0);
        expect(g.getAttribute("normal").count).toBe(n);
        expect(g.getAttribute("color").count).toBe(n);
        const nor = g.getAttribute("normal");
        for (let i = 0; i < n; i += 7) {
          expect(Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i))).toBeCloseTo(1, 3);
        }
      }
    }
  });

  it("keeps each cut inside its triangle budget", () => {
    for (const [name, [near, far, nearMost, farMost]] of Object.entries(parts)) {
      expect(tris(near), name).toBeLessThanOrEqual(nearMost);
      if (far) expect(tris(far), `${name} far`).toBeLessThanOrEqual(farMost);
    }
  });

  it("builds the chair round the seat its rider sits on", () => {
    const b = bounds(chairGeometry());
    // A quad's seat is 2.2–2.4 m across with its frame.
    expect(b.max.x - b.min.x).toBeGreaterThan(2.2);
    expect(b.max.x - b.min.x).toBeLessThan(2.5);
    // Nothing of it stands behind the hanger's sweep past the backrest.
    expect(b.min.z).toBeGreaterThan(CHAIR_BACK - 0.35);
    // Its safety bar, lowered about its pivot: the footrest hangs about
    // half a metre under the seat's top, the bar across the laps ahead.
    const bar = chairBarGeometry().translate(0, CHAIR_BAR.y, CHAIR_BAR.z);
    const lowered = bounds(bar);
    expect(lowered.min.y).toBeGreaterThan(-CHAIR_SEAT - 0.6);
    expect(lowered.min.y).toBeLessThan(-CHAIR_SEAT - 0.3);
    expect(lowered.max.z).toBeGreaterThan(0.4);
    // Raised, it stands over the riders' heads, clear of the seat ahead.
    const up = bounds(
      chairBarGeometry().rotateX(CHAIR_BAR.up).translate(0, CHAIR_BAR.y, CHAIR_BAR.z),
    );
    expect(up.min.y).toBeGreaterThan(CHAIR_BAR.y - 0.1);
    expect(up.max.z).toBeLessThan(CHAIR_BAR.z + 0.4);
  });

  it("builds the cabin to its bands", () => {
    const b = bounds(cabinGeometry());
    expect(b.min.y).toBeCloseTo(CABIN_Y.floor, 1);
    expect(b.max.x).toBeLessThan(CABIN_HALF.w + 0.1);
    expect(b.min.x).toBeGreaterThan(-CABIN_HALF.w - 0.1);
  });

  it("keeps a tower's head inboard of the carriers under the rope", () => {
    for (const kind of ["chair", "gondola"] as const) {
      const g = head(kind);
      const pos = g.getAttribute("position");
      const rope = LIFT_LOOK[kind].gauge / 2;
      // Under the sheaves, nothing reaches out to where a hanger comes
      // down from its grip outboard of the rope.
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) < -0.5 && pos.getY(i) > -2) {
          expect(Math.abs(pos.getX(i)), kind).toBeLessThan(rope + 0.1);
        }
      }
    }
  });
});
