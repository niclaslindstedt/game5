// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER AS SPRINGS ON THE BIKE (`rider-springs.ts`): the downhill
// rider's body driven as masses on springs over the bike — the hips thrown
// by the bike's changes of velocity, the neck holding its height, the head
// on a gimbal, the limbs soft, the cranks eased level as he coasts.
// Presentation only: the engine never reads it.
import { describe, expect, it } from "vitest";
import { bikeAim, bikePilot, RAGDOLL as R, step, TUNING, type GameState } from "@engine";

import { gripsAt, pedalsAt, bracketFromRider } from "../pwa/src/game/bike-look.ts";
import { rideStyleOf } from "../pwa/src/game/bike-ride-style.ts";
import { RIDER_SPRINGS, riderSpringsOf } from "../pwa/src/game/rider-springs.ts";
import { riderOnBike } from "../pwa/src/game/skier-bike.ts";
import { BODY } from "../pwa/src/game/skier-mounts.ts";
import { bikeRun, summerMap } from "./support/bike-bot.ts";

const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);

/** The bot down B1 for `seconds`, handing every frame to `frame`. */
function ride(seconds: number, frame: (s: GameState) => void): void {
  const s = bikeRun(summerMap(38), "B1");
  const aim = bikeAim(s, "B1");
  for (let t = 0; t < seconds; t += FRAME) {
    for (let i = 0; i < STEPS; i++) step(s, bikePilot(s, aim));
    frame(s);
  }
}

const at = (pts: number[], i: number) => ({ x: pts[3 * i], y: pts[3 * i + 1], z: pts[3 * i + 2] });
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("the rider as springs on the bike", () => {
  it("keeps his hands on the grips and his feet on the pedals as drawn", () => {
    let frames = 0;
    ride(8, (s) => {
      const b = s.bike!;
      if (!b.onIt || b.mode !== "ridden" || s.skier.thrown) return;
      const style = rideStyleOf(b, s.level, s.t);
      if (style.yaw !== 0 || style.roll !== 0) return;
      const { pose, points, style: ridden } = riderOnBike(b, s.t, style);
      const bb = bracketFromRider(pose);
      const grips = gripsAt(pose.steer);
      const pedals = pedalsAt(pose.crank);
      for (const i of [0, 1] as const) {
        const grip = { x: bb.x + grips[i].x, y: bb.y + grips[i].y, z: bb.z + grips[i].z };
        expect(dist(at(points, i ? R.handR : R.handL), grip)).toBeLessThan(0.02);
        if ((ridden?.footOut ?? 0) > 0) continue;
        const pedal = { x: bb.x + pedals[i].x, y: bb.y + pedals[i].y, z: bb.z + pedals[i].z };
        expect(dist(at(points, i ? R.footR : R.footL), pedal)).toBeLessThan(0.18);
      }
      frames++;
    });
    expect(frames).toBeGreaterThan(200);
  });

  it("holds every limb to its length and the trunk to a spine", () => {
    ride(6, (s) => {
      const b = s.bike!;
      if (!b.onIt || b.mode !== "ridden" || s.skier.thrown) return;
      const { points } = riderOnBike(b, s.t, rideStyleOf(b, s.level, s.t));
      const hips = [at(points, R.hipL), at(points, R.hipR)];
      const sh = [at(points, R.shoulderL), at(points, R.shoulderR)];
      const mid = (a: typeof hips) => ({
        x: (a[0].x + a[1].x) / 2,
        y: (a[0].y + a[1].y) / 2,
        z: (a[0].z + a[1].z) / 2,
      });
      expect(dist(mid(hips), mid(sh))).toBeCloseTo(BODY.spine, 3);
      for (const i of [0, 1] as const) {
        expect(dist(hips[i], at(points, i ? R.kneeR : R.kneeL))).toBeCloseTo(BODY.thigh, 3);
        expect(dist(sh[i], at(points, i ? R.elbowR : R.elbowL))).toBeCloseTo(BODY.upperArm, 3);
      }
    });
  });

  it("eases the cranks level as he coasts, and steps once a moment however often it is asked", () => {
    let coasting = 0;
    ride(20, (s) => {
      const b = s.bike!;
      if (!b.onIt || b.mode !== "ridden") return;
      const a = riderSpringsOf(b, s.t);
      const once = JSON.stringify(a.hips);
      expect(JSON.stringify(riderSpringsOf(b, s.t).hips)).toBe(once);
      if (b.cadence === 0 && a.level !== null) {
        coasting++;
        // The level is fore and aft (0 or π), and the drawn cranks near it
        // a moment after he stopped turning them.
        expect(Math.abs(Math.sin(a.level))).toBeLessThan(1e-9);
      }
    });
    expect(coasting).toBeGreaterThan(60);
  });

  it("is the same body for the same ride", () => {
    const run = (): string[] => {
      const out: string[] = [];
      ride(5, (s) => {
        const b = s.bike!;
        if (b.onIt)
          out.push(
            riderOnBike(b, s.t)
              .points.map((x) => x.toFixed(6))
              .join(","),
          );
      });
      return out;
    };
    expect(run()).toEqual(run());
  });

  it("states its springs as real ones", () => {
    for (const k of ["hips", "neck", "head", "limb", "crank", "foot"] as const) {
      expect(RIDER_SPRINGS[k].hz).toBeGreaterThan(0.3);
      expect(RIDER_SPRINGS[k].hz).toBeLessThan(15);
      expect(RIDER_SPRINGS[k].zeta).toBeGreaterThan(0.2);
    }
  });
});
