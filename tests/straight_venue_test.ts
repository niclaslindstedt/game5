// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STRAIGHT VENUE (R37): the pen every freestyle venue's profile is
// drawn with, the height read back off it, the speed a tucked skier carries
// down an in-run to its lip, and the landing shaped to an equivalent fall
// height — on a reference jump drawn here (a 30° drop-in, a 32° kicker, a
// 15 m table), the numbers a championship-size kicker is built to.

import { describe, expect, it } from "vitest";

import { createPen, jumpHeightAt, lipSpeed, shapeLanding, type JumpProfile } from "@engine";

const RAD = Math.PI / 180;

/** The reference jump's rule: what `shapeLanding` and `lipSpeed` read. */
const R = {
  kick: 32,
  launch: 0.78,
  fall: 0.35,
  steepest: 38,
  fast: 1.12,
  past: 6,
  knuckle: 10,
  speed: 16.5,
  skier: { mass: 85, tuck: 0.5, air: 1.0, friction: 0.05, compression: 0.55 },
} as const;

/** The reference jump with `dropIn` m of 30° in-run: platform, roll,
 * drop-in, flat, kicker, table and the shaped landing. */
function reference(dropIn: number): JumpProfile & { knuckle: number; landing: number } {
  const pen = createPen();
  pen.straight(6, 0);
  const gate = pen.x;
  pen.bend(30 * RAD, 20);
  pen.straight(dropIn, 30 * RAD);
  pen.bend(0, 50);
  pen.straight(8, 0);
  pen.bend(-R.kick * RAD, 25);
  const lip = pen.x;
  const yLip = pen.y;
  pen.straight(15, 0);
  const knuckle = pen.x;
  shapeLanding(pen, R, lip, yLip);
  const landing = pen.x;
  pen.bend(5 * RAD, 45);
  pen.straight(70, 5 * RAD);
  const y = Float64Array.from(pen.ys);
  return { dx: pen.dx, y, finish: pen.x - 35, end: pen.x, gate, lip, knuckle, landing };
}

const slopeAt = (p: JumpProfile, x: number): number =>
  Math.atan2(jumpHeightAt(p, x - 0.25) - jumpHeightAt(p, x + 0.25), 0.5) / RAD;

describe("the straight venue's pen (R37)", () => {
  const p = reference(40);

  it("reads its heights back between the samples it drew", () => {
    expect(jumpHeightAt(p, 0)).toBe(0);
    expect(jumpHeightAt(p, 3)).toBeCloseTo(0, 9);
    expect(slopeAt(p, p.gate + 25)).toBeCloseTo(30, 0);
    for (let x = p.lip + 1; x < p.knuckle - 1; x += 2) {
      expect(Math.abs(slopeAt(p, x))).toBeLessThan(0.5);
    }
  });

  it("carries a tucked skier faster to the lip down a longer in-run", () => {
    const speeds = [20, 40, 80].map((m) => lipSpeed(reference(m), R));
    expect(speeds[0]).toBeGreaterThan(5);
    expect(speeds[1]).toBeGreaterThan(speeds[0]);
    expect(speeds[2]).toBeGreaterThan(speeds[1]);
  });

  it("lands at its steepest or under, and no harder than a short fall", () => {
    let most = 0;
    for (let x = p.knuckle; x < p.landing; x += 0.5) most = Math.max(most, slopeAt(p, x));
    expect(most).toBeLessThanOrEqual(R.steepest + 0.5);
    const kick = R.kick * R.launch * RAD;
    for (const share of [0.9, 1]) {
      const v0 = R.speed * share;
      const vx = v0 * Math.cos(kick);
      let met = false;
      for (let t = 0.05; t < 6 && !met; t += 0.002) {
        const x = p.lip + vx * t;
        const y = jumpHeightAt(p, p.lip) + v0 * Math.sin(kick) * t - 4.905 * t * t;
        if (x <= p.knuckle || y > jumpHeightAt(p, x)) continue;
        met = true;
        const vy = v0 * Math.sin(kick) - 9.81 * t;
        const slope = slopeAt(p, x) * RAD;
        const into = Math.abs(-vx * Math.sin(slope) - vy * Math.cos(slope));
        expect((into * into) / (2 * 9.81)).toBeLessThan(0.6);
      }
      expect(met).toBe(true);
    }
  });
});
