// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOOM ON A STEEP FACE, and the springs it is hung on. A boom that
// aimed level whatever the snow under it stood the skier at the foot of the
// frame on a steep pitch with half the picture sky; the chase now leans
// with the fall line — a share of it — and composes the skier at one place
// in the frame on every pitch (`camera-rigs.ts`), on second-order springs
// whose poles the rows place (`camera-spring.ts`).

import { describe, expect, it } from "vitest";
import {
  createBoomState,
  FRAME_AT,
  frameRig,
  RIGS,
  type BoomRig,
  type LensPose,
  type RigPose,
} from "../pwa/src/game/camera-rigs.ts";
import { createSpring, follow, followAngle } from "../pwa/src/game/camera-spring.ts";

const DT = 1 / 60;
const deg = (d: number) => (d * Math.PI) / 180;

/** The look's pitch, rad, positive up. */
const aimOf = (l: LensPose) =>
  Math.atan2(l.target.y - l.eye.y, Math.hypot(l.target.x - l.eye.x, l.target.z - l.eye.z));
/** Where a direction `a` rad above level stands in the frame, as a share of
 * the vertical half-fov from the axis (1 the top edge). */
const onScreen = (l: LensPose, a: number) =>
  Math.tan(a - aimOf(l)) / Math.tan((l.fov * Math.PI) / 360);
const skierAt = (l: LensPose, p: RigPose) =>
  onScreen(l, Math.atan2(p.y + FRAME_AT - l.eye.y, Math.hypot(p.x - l.eye.x, p.z - l.eye.z)));

/** Schuss straight down a face of `ground` along +z at `v` m/s for `secs`,
 * the skier's centre of gravity a metre over the snow. */
function schuss(
  rig: BoomRig,
  ground: (x: number, z: number) => number,
  v: number,
  secs = 4,
  from = 0,
) {
  const st = createBoomState();
  let z = from;
  const frames: { lens: LensPose; pose: RigPose }[] = [];
  for (let i = 0; i < secs / DT; i++) {
    const dz = 0.5;
    const pitch = Math.atan2(ground(0, z) - ground(0, z + dz), dz);
    const vz = v * Math.cos(pitch);
    z += vz * DT;
    const pose: RigPose = {
      x: 0,
      y: ground(0, z) + 1,
      z,
      heading: 0,
      pitch,
      roll: 0,
      vx: 0,
      vy: -v * Math.sin(pitch),
      vz,
      speed: v,
      airborne: false,
      packed: 1,
      q: { x: 0, y: 0, z: 0, w: 1 },
    };
    frames.push({ lens: frameRig(rig, pose, st, DT, ground), pose });
  }
  return frames;
}
const face = (d: number) => (_x: number, z: number) => 600 - z * Math.tan(deg(d));

describe("the chase on a steep face", () => {
  const chase = RIGS.chase as BoomRig;
  const settled = (d: number, v = 28) => schuss(chase, face(d), v).at(-1)!;

  it("tips the look down the fall line by a share of the pitch, never all of it", () => {
    const level = aimOf(settled(0).lens);
    for (const d of [15, 30, 38]) {
      const tipped = level - aimOf(settled(d).lens);
      expect(tipped).toBeGreaterThan(deg(d) * chase.incline * 0.8);
      expect(tipped).toBeLessThan(deg(d) * 0.95);
    }
  });

  it("stands the skier at the same place in the frame on every pitch", () => {
    for (const d of [0, 15, 30, 38]) {
      const { lens, pose } = settled(d);
      expect(Math.abs(skierAt(lens, pose) + chase.place)).toBeLessThan(0.02);
    }
  });

  it("keeps the horizon in the frame and the piste ahead above the skier", () => {
    // Up to a red's steepest and well past it the horizon stays in; at R8's
    // 78 % (38°), the steepest any piste is graded, it reaches the top edge.
    for (const d of [15, 25, 30]) {
      const horizon = onScreen(settled(d).lens, 0);
      expect(horizon).toBeGreaterThan(0.3);
      expect(horizon).toBeLessThan(1);
    }
    expect(onScreen(settled(38).lens, 0)).toBeLessThan(1.15);
    for (const d of [15, 30, 38]) {
      const { lens, pose } = settled(d);
      // The fall line's far reach (its vanishing direction) sits over him.
      expect(onScreen(lens, -deg(d))).toBeGreaterThan(skierAt(lens, pose) + 0.25);
    }
  });

  it("keeps the skier his size at speed, and the lens off the snow behind him", () => {
    for (const d of [0, 30, 38]) {
      const slow = settled(d, 6);
      const fast = settled(d, 30);
      const size = (f: typeof slow) =>
        1 /
        (Math.hypot(f.lens.eye.x - f.pose.x, f.lens.eye.y - f.pose.y, f.lens.eye.z - f.pose.z) *
          Math.tan((f.lens.fov * Math.PI) / 360));
      expect(size(fast) / size(slow)).toBeGreaterThan(0.8);
      const over = fast.lens.eye.y - face(d)(fast.lens.eye.x, fast.lens.eye.z);
      expect(over).toBeGreaterThan(chase.clearance);
    }
  });

  it("starts to tip before the skier reaches the edge of a drop", () => {
    // Level snow to z = 200, then a 35° face.
    const brink = (_x: number, z: number) => (z < 200 ? 300 : 300 - (z - 200) * Math.tan(deg(35)));
    const run = schuss(chase, brink, 25, 8, 120);
    const level = aimOf(run[0].lens);
    const atEdge = run.find((f) => f.pose.z >= 200)!;
    expect(level - aimOf(atEdge.lens)).toBeGreaterThan(deg(3));
  });
});

describe("the springs a boom hangs on", () => {
  const settleOn = (zeta: number, r = 0, dt = DT) => {
    const s = createSpring();
    let peak = 0;
    for (let i = 0; i < 6 / dt; i++) peak = Math.max(peak, follow(s, { f: 1, zeta, r }, 1, dt));
    return { s, peak };
  };

  it("settles critically damped with no overshoot, and swings past when underdamped", () => {
    const crit = settleOn(1);
    expect(crit.peak).toBeLessThanOrEqual(1 + 1e-6);
    expect(crit.s.y).toBeCloseTo(1, 3);
    expect(settleOn(0.4).peak).toBeGreaterThan(1.1);
  });

  it("gathers into a move rather than jumping, unless the response asks it to", () => {
    const s = createSpring();
    for (let i = 0; i < 2; i++) follow(s, { f: 1, zeta: 1, r: 0 }, 1, DT);
    expect(s.y).toBeLessThan(0.02);
    const lead = createSpring();
    for (let i = 0; i < 2; i++) follow(lead, { f: 1, zeta: 1, r: 1 }, 1, DT);
    expect(lead.y).toBeGreaterThan(s.y * 10);
  });

  it("stays stable on a long frame", () => {
    const { s } = settleOn(0.7, 0, 0.1);
    expect(Number.isFinite(s.y)).toBe(true);
    expect(s.y).toBeCloseTo(1, 2);
    const fast = createSpring();
    for (let i = 0; i < 100; i++) follow(fast, { f: 8, zeta: 0.5, r: 0 }, 1, 0.1);
    expect(Math.abs(fast.y - 1)).toBeLessThan(1e-3);
  });

  it("tracks a steady ramp with no lag when told its trend, and trails it when not", () => {
    const ramp = (r: number) => {
      const s = createSpring();
      let x = 0;
      for (let i = 0; i < 300; i++) {
        x -= 10 * DT;
        follow(s, { f: 1.8, zeta: 0.7, r }, x, DT, -10);
      }
      return Math.abs(s.y - x);
    };
    expect(ramp(2)).toBeLessThan(0.01);
    expect(ramp(0)).toBeGreaterThan(1);
  });

  it("turns the short way round past ±π", () => {
    const s = createSpring(3);
    for (let i = 0; i < 600; i++) followAngle(s, { f: 1, zeta: 1, r: 0 }, -3, DT);
    expect(Math.cos(s.y)).toBeCloseTo(Math.cos(-3), 3);
    expect(s.y).toBeGreaterThan(3);
  });
});

describe("the chase behind a skier riding switch", () => {
  const chase = RIGS.chase as BoomRig;
  /** Down a flat run along +z at 12 m/s for two seconds, the skis pointing
   * `heading`, read as `switched` or not. */
  const run = (heading: number, switched: boolean) => {
    const st = createBoomState();
    let lens: LensPose | null = null;
    for (let i = 0; i < 2 / DT; i++) {
      const pose: RigPose = {
        x: 0,
        y: 1,
        z: 12 * i * DT,
        heading,
        pitch: 0,
        roll: 0,
        vx: 0,
        vy: 0,
        vz: 12,
        speed: 12,
        airborne: false,
        switched,
        packed: 1,
        q: { x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) },
      };
      lens = frameRig(chase, pose, st, DT, () => 0);
    }
    return lens!;
  };

  it("stands behind the way he is going, so he is seen skiing backward at the lens", () => {
    const forward = run(0, false);
    const back = run(Math.PI, true);
    // Both lenses up the hill behind him, looking down it.
    expect(forward.eye.z).toBeLessThan(forward.target.z);
    expect(back.eye.z).toBeLessThan(back.target.z);
    expect(back.eye.z).toBeCloseTo(forward.eye.z, 1);
    expect(back.eye.x).toBeCloseTo(forward.eye.x, 1);
  });
});
