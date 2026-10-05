// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON THE SNOWMOBILE (`camera-sled.ts`). The skier's ladder framed
// a rider on the boards put the TIPS lens inside the machine's hood; while
// he rides, the ladder is framed off the machine on rows of its own. These
// hold that no lens of those rows stands inside the machine, and that the
// pose they are framed from is the machine's.

import { describe, expect, it } from "vitest";
import { rotate, SLED, type SledState } from "@engine";
import { SLED_LOOK, sledFrame } from "../pwa/src/game/sled-look.ts";
import { SLED_RIGS, sledRigPose } from "../pwa/src/game/camera-sled.ts";
import {
  createBoomState,
  frameRig,
  freshRigPose,
  RIGS,
  type BoomRig,
  type Vec3,
} from "../pwa/src/game/camera-rigs.ts";

/** The skier's centre of gravity over his boot soles, m (the reference pair's). */
const RIDER_COG = 1.0;

/** The hood's traced side outline on the body frame, (z, y). */
const hood = SLED_LOOK.hood.map(sledFrame);
const inHood = (e: Vec3): boolean => {
  if (Math.abs(e.x) > SLED_LOOK.hoodWidth / 2) return false;
  let inside = false;
  for (let i = 0, j = hood.length - 1; i < hood.length; j = i++) {
    const [zi, yi] = hood[i];
    const [zj, yj] = hood[j];
    if (yi > e.y !== yj > e.y && e.z < ((zj - zi) * (e.y - yi)) / (yj - yi) + zi) inside = !inside;
  }
  return inside;
};
/** The machine's nose and the top of its bars, body frame, m. */
const nose = Math.max(...hood.map(([z]) => z));
const bars = SLED.grips.y;
/** Clear of the machine: ahead of its nose, or over its bars. */
const clearOfMachine = (e: Vec3): boolean => !inHood(e) && (e.z > nose || e.y > bars);

describe("the lens on the snowmobile", () => {
  it("would stand the skier's tips lens inside the hood — the fault the rows answer", () => {
    // The skier's origin on the boards, in the machine's frame (`riderFrame`).
    const rider = { x: 0, y: SLED.boards.y + RIDER_COG, z: SLED.boards.z };
    const tips = RIGS.tips;
    if (tips.kind !== "bolted") throw new Error("tips is bolted");
    const eye = { x: rider.x + tips.eye.x, y: rider.y + tips.eye.y, z: rider.z + tips.eye.z };
    expect(inHood(eye)).toBe(true);
  });

  it("bolts every worn lens clear of the machine: ahead of its nose or over its bars", () => {
    for (const rung of ["tips", "helmet"] as const) {
      const rig = SLED_RIGS[rung];
      if (rig.kind !== "bolted") throw new Error(`${rung} is bolted`);
      expect(clearOfMachine(rig.eye), rung).toBe(true);
    }
  });

  it("tips the rider's eye down far enough to show the hood at the foot of the frame", () => {
    const rig = SLED_RIGS.helmet;
    if (rig.kind !== "bolted") throw new Error("helmet is bolted");
    // The hood's nose, as far below the eye's look as the frame reaches.
    const [nz, ny] = hood.reduce((a, b) => (b[0] > a[0] ? b : a));
    const below = Math.atan2(rig.eye.y - ny, nz - rig.eye.z) - (rig.down ?? 0);
    expect(below).toBeLessThan(((rig.fov / 2) * Math.PI) / 180);
  });

  it("stands every boom behind the tunnel's end, over the rider's head", () => {
    const tail = SLED.trace.z;
    for (const rung of ["chase", "far", "high"] as const) {
      const rig = SLED_RIGS[rung] as BoomRig;
      const st = createBoomState();
      const pose = { ...freshRigPose(), y: SLED.cogHeight, speed: 20, vz: 20 };
      let lens = frameRig(rig, pose, st, 1 / 60, () => 0);
      for (let i = 0; i < 240; i++) {
        pose.z += pose.vz / 60;
        lens = frameRig(rig, pose, st, 1 / 60, () => 0);
      }
      expect(pose.z - lens.eye.z, rung).toBeGreaterThan(tail + 1.5);
      expect(lens.eye.y - pose.y, rung).toBeGreaterThan(SLED.boards.y + RIDER_COG + 0.8);
    }
  });

  it("frames the machine's centre, read back off the rider when it is not yet drawn", () => {
    const q = { x: 0.05, y: 0.3, z: -0.04, w: 0.95 };
    const n = Math.hypot(q.x, q.y, q.z, q.w);
    const qn = { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
    const s = {
      x: 10,
      y: 5,
      z: -3,
      riderRight: 0.2,
      riderAft: -0.1,
      heading: 0.6,
      pitch: 0.02,
      roll: -0.05,
      vx: 4,
      vy: 0,
      vz: 7,
      speed: Math.hypot(4, 7),
      airborne: true,
    } as unknown as SledState;
    const off = rotate(qn, {
      x: s.riderRight * 0.5,
      y: SLED.boards.y + RIDER_COG,
      z: SLED.boards.z - s.riderAft * 0.5,
    });
    const pose = { ...freshRigPose(), x: s.x + off.x, y: s.y + off.y, z: s.z + off.z, q: qn };
    sledRigPose(pose, s, null, RIDER_COG);
    expect(pose.x).toBeCloseTo(s.x, 9);
    expect(pose.y).toBeCloseTo(s.y, 9);
    expect(pose.z).toBeCloseTo(s.z, 9);
    expect(pose.airborne).toBe(true);
    expect(pose.heading).toBe(s.heading);
    // Drawn, the drawn machine is what is framed.
    sledRigPose(pose, s, { x: 1, y: 2, z: 3, q: qn }, RIDER_COG);
    expect([pose.x, pose.y, pose.z]).toEqual([1, 2, 3]);
  });
});
