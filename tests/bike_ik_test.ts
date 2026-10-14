// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER SOLVED FROM HIS CONTACTS (`bike-ik.ts`): every limb reached to
// the bike from hips placed by balance, solved continuously. Held here: his
// hands stay on the grips and his ankles over the pedals as the bot rides a
// trail, his knees never lock or fold shut, and no joint jumps between two
// frames. Presentation only: the engine never reads any of it.
import { describe, expect, it } from "vitest";
import { bikeAim, bikePilot, bikePose, step } from "@engine";

import { drawnCrank, ikMemory } from "../pwa/src/game/bike-ik.ts";
import { bracketFromRider, gripsAt, pedalsAt } from "../pwa/src/game/bike-look.ts";
import { rideStyleOf } from "../pwa/src/game/bike-ride-style.ts";
import { riderPoints } from "../pwa/src/game/skier-bike.ts";
import { bikeRun, parkTrails, summerMap } from "./support/bike-bot.ts";

type P = { x: number; y: number; z: number };
const at = (pts: number[], i: number): P => ({
  x: pts[i * 3],
  y: pts[i * 3 + 1],
  z: pts[i * 3 + 2],
});
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const angle = (a: P, b: P, c: P) => {
  const u = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const w = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const d =
    (u.x * w.x + u.y * w.y + u.z * w.z) / (Math.hypot(u.x, u.y, u.z) * Math.hypot(w.x, w.y, w.z));
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
};

describe("the rider solved from his contacts (bike-ik.ts)", () => {
  it("rides a trail with his hands on the grips, his feet on the pedals and no joint jumping", () => {
    const level = summerMap(38);
    const trail = parkTrails(38)[0].id;
    let s = bikeRun(level, trail);
    const aim = bikeAim(s, trail);
    const memory = ikMemory();
    let last: number[] | undefined;
    let frames = 0;
    let worstHand = 0;
    let worstFoot = 0;
    let worstStep = 0;
    let kneeLeast = 180;
    let kneeMost = 0;
    for (let i = 0; i < 120 * 20; i++) {
      s = step(s, bikePilot(s, aim));
      if (i % 4) continue;
      const b = s.bike!;
      if (!b.onIt) {
        last = undefined;
        continue;
      }
      const pose = bikePose(b);
      const style = rideStyleOf(b, s.level, s.t);
      const pts = riderPoints(pose, style, memory, s.t);
      frames++;
      // Riding plainly — no trick turning the bike under him, no foot out
      // (nor one still coming back to its pedal).
      const plain = style.amount === 0 && Math.max(...memory.out) < 0.01;
      if (plain) {
        const bb = bracketFromRider(pose);
        const grips = gripsAt(pose.steer).map((g) => ({
          x: bb.x + g.x,
          y: bb.y + g.y,
          z: bb.z + g.z,
        }));
        for (const h of [11, 12]) {
          worstHand = Math.max(worstHand, Math.min(...grips.map((g) => dist(at(pts, h), g))));
        }
        const pedals = pedalsAt(drawnCrank(memory, pose, s.t)).map((p) => ({
          x: bb.x + p.x,
          y: bb.y + p.y,
          z: bb.z + p.z,
        }));
        for (const f of [7, 8]) {
          worstFoot = Math.max(worstFoot, Math.min(...pedals.map((p) => dist(at(pts, f), p))));
        }
      }
      for (const [hip, knee, foot] of !plain
        ? []
        : [
            [0, 5, 7],
            [1, 6, 8],
          ]) {
        const a = angle(at(pts, hip), at(pts, knee), at(pts, foot));
        kneeLeast = Math.min(kneeLeast, a);
        kneeMost = Math.max(kneeMost, a);
      }
      if (last) {
        for (let j = 0; j < 13; j++) worstStep = Math.max(worstStep, dist(at(pts, j), at(last, j)));
      }
      last = pts;
    }
    expect(frames).toBeGreaterThan(300);
    expect(worstHand).toBeLessThan(0.02);
    // The ankle stands a few centimetres off the pedal's middle (the ball
    // of the foot on it, the heel dropped).
    expect(worstFoot).toBeLessThan(0.15);
    expect(kneeLeast).toBeGreaterThan(65);
    expect(kneeMost).toBeLessThan(170);
    // A thirtieth of a second apart, no joint moves 15 cm on the bike.
    expect(worstStep).toBeLessThan(0.15);
  });

  it("is a pure function of the bike with no memory", () => {
    const level = summerMap(38);
    const s = bikeRun(level, parkTrails(38)[0].id);
    for (let i = 0; i < 60; i++) step(s, bikePilot(s, bikeAim(s, parkTrails(38)[0].id)));
    const pose = bikePose(s.bike!);
    expect(riderPoints(pose)).toEqual(riderPoints(pose));
  });
});
