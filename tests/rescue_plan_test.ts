// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESCUE ON THE NEXT RUN — the air ambulance's landing and its crew's
// carry (`rescue-plan.ts` over `rescue-crew.ts`), held without a renderer:
// the same plan off the same map, a landing patch clear and near, the
// casualty brought to its right-hand door, the timeline in order, the
// stretcher carried level by bearers stood on the snow whose planted feet
// never slide, and the machine gone at the end.

import { describe, expect, it } from "vitest";
import { HELI, fromEuler, rotate, treesNear, type Vec3 } from "@engine";

import {
  CREW_JOINTS,
  CREW_POSES,
  RESCUE_STRIDE,
  crewDials,
  crewPoints,
} from "../pwa/src/game/rescue-crew.ts";
import {
  BEARERS,
  RESCUE,
  freshRescueFrame,
  planRescue,
  rescueAt,
  watchRescue,
} from "../pwa/src/game/rescue-plan.ts";
import { levelFor } from "./support/levels.ts";

const SEEDS = [1, 38];
const cases = SEEDS.flatMap((seed) =>
  [0.45, 0.6].map((share) => {
    const level = levelFor(seed);
    const pts = level.track.points;
    const spot = pts[Math.floor(pts.length * share)];
    return { name: `seed ${seed} at ${share}`, level, spot, plan: planRescue(level, spot) };
  }),
);

describe("rescue plan", () => {
  it("is the same plan twice off the same map", () => {
    const { level, spot, plan } = cases[0];
    expect(JSON.stringify(planRescue(level, spot))).toBe(JSON.stringify(plan));
  });

  for (const { name, level, plan } of cases) {
    describe(name, () => {
      it("lands near him, on a gentle patch, its disc clear of the trunks", () => {
        const d = Math.hypot(plan.site.x - plan.spot.x, plan.site.z - plan.spot.z);
        expect(d).toBeGreaterThanOrEqual(17);
        expect(d).toBeLessThanOrEqual(61);
        const most = Math.atan(RESCUE.site.slopeMost) + 1e-9;
        expect(Math.abs(plan.site.pitch)).toBeLessThanOrEqual(most);
        expect(Math.abs(plan.site.roll)).toBeLessThanOrEqual(most);
        const near: never[] = [];
        expect(treesNear(level, plan.site.x, plan.site.z, HELI.rotor.radius, near)).toHaveLength(0);
      });

      it("has him on its right, the door's side, and the carry ending outside it", () => {
        const h = plan.site.heading;
        const rx = Math.cos(h);
        const rz = -Math.sin(h);
        expect((plan.spot.x - plan.site.x) * rx + (plan.spot.z - plan.site.z) * rz).toBeGreaterThan(
          0,
        );
        expect(plan.out.x * rx + plan.out.z * rz).toBeCloseTo(1, 5);
        const last = plan.path.pts[plan.path.pts.length - 1];
        expect(Math.hypot(last.x - plan.end.x, last.z - plan.end.z)).toBeLessThan(0.05);
      });

      it("runs its parts in order", () => {
        const a = plan.at;
        const order = [a.rise, a.carry, a.raise, a.inch, a.climb, a.slide, a.clear, a.lift, a.gone];
        for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
        expect(a.raise - a.carry).toBeCloseTo(plan.path.length / RESCUE.walk, 5);
      });

      it("waits stood off with the board before it starts, and is gone at the end", () => {
        const f = rescueAt(level, plan, -1, freshRescueFrame());
        for (const c of f.crew) {
          expect(c.move.rise).toBe(1);
          expect(c.move.walking).toBe(0);
          expect(Math.hypot(c.x - plan.spot.x, c.z - plan.spot.z)).toBeGreaterThan(5);
        }
        expect(f.casualty.sprawl).toBe(1);
        expect(f.heli.shown).toBe(true);
        rescueAt(level, plan, plan.at.gone + 1, f);
        expect(f.heli.shown).toBe(false);
        expect(f.stretcher.shown).toBe(false);
      });

      it("carries the stretcher level, its bearers stood on the snow", () => {
        const f = freshRescueFrame();
        for (let t = plan.at.carry; t < plan.at.raise; t += 0.25) {
          rescueAt(level, plan, t, f);
          expect(Math.abs(f.stretcher.pitch)).toBeLessThan(0.1);
          expect(Math.abs(f.stretcher.roll)).toBeLessThan(0.1);
          for (const c of f.crew) {
            expect(Math.abs(c.y - level.groundAt(c.x, c.z))).toBeLessThan(0.02);
            expect(c.move.hand).not.toBeNull();
          }
        }
      });

      it("strides as far as he walks, so a planted foot never slides", () => {
        const f = freshRescueFrame();
        const t0 = plan.at.carry + 2;
        const t1 = plan.at.raise - 2;
        rescueAt(level, plan, t0, f);
        const from = f.crew.map((c) => ({ x: c.x, z: c.z, stride: c.move.stride }));
        let walked = from.map(() => 0);
        let prev = from.map((p) => ({ ...p }));
        for (let t = t0; t <= t1; t += 0.05) {
          rescueAt(level, plan, t, f);
          walked = walked.map(
            (w, j) => w + Math.hypot(f.crew[j].x - prev[j].x, f.crew[j].z - prev[j].z),
          );
          prev = f.crew.map((c) => ({ x: c.x, z: c.z, stride: c.move.stride }));
        }
        for (let j = 0; j < BEARERS.length; j++) {
          const strode = (prev[j].stride - from[j].stride) * RESCUE_STRIDE;
          expect(Math.abs(strode - walked[j]) / walked[j]).toBeLessThan(0.08);
        }
      });
    });
  }

  for (const { name, level, plan } of cases) {
    it(`${name}: nobody kneels, stands or reaches into the board, at any moment`, () => {
      const f = freshRescueFrame();
      const worst: string[] = [];
      for (let t = -1; t < plan.at.clear + 1; t += 0.1) {
        rescueAt(level, plan, t, f);
        const st = f.stretcher;
        if (!st.shown) continue;
        const q = fromEuler(st.heading, st.pitch, st.roll);
        const ax = rotate(q, { x: 1, y: 0, z: 0 });
        const ay = rotate(q, { x: 0, y: 1, z: 0 });
        const az = rotate(q, { x: 0, y: 0, z: 1 });
        for (let j = 0; j < BEARERS.length; j++) {
          const c = f.crew[j];
          if (!c.shown) continue;
          const pts = crewPoints(BEARERS[j].body, c.move);
          for (const joint of CREW_JOINTS) {
            const [x, y, z] = pts[joint];
            const w: Vec3 = {
              x: c.x + x * Math.cos(c.heading) + z * Math.sin(c.heading) - st.x,
              y: c.y + y - st.y,
              z: c.z - x * Math.sin(c.heading) + z * Math.cos(c.heading) - st.z,
            };
            const dot = (a: Vec3) => w.x * a.x + w.y * a.y + w.z * a.z;
            const lx = dot(ax);
            const ly = dot(ay);
            const lz = dot(az);
            // The board's solid — frame and mattress — less a few cm.
            const inside = Math.abs(lx) < 0.25 && ly > -0.04 && ly < 0.1 && Math.abs(lz) < 0.97;
            if (inside && worst.length < 5)
              worst.push(
                `t ${t.toFixed(1)} ${BEARERS[j].role}#${j} ${joint} at ${lx.toFixed(2)},${ly.toFixed(2)},${lz.toFixed(2)}`,
              );
          }
        }
      }
      expect(worst).toEqual([]);
    });

    it(`${name}: he lies on the board's top from the strapping to the cabin`, () => {
      const f = freshRescueFrame();
      for (let t = plan.at.scoop.strap; t < plan.at.clear; t += 0.25) {
        rescueAt(level, plan, t, f);
        const st = f.stretcher;
        const q = fromEuler(st.heading, st.pitch, st.roll);
        const d = { x: f.casualty.x - st.x, y: f.casualty.y - st.y, z: f.casualty.z - st.z };
        const ax = rotate(q, { x: 1, y: 0, z: 0 });
        const ay = rotate(q, { x: 0, y: 1, z: 0 });
        expect(Math.abs(d.x * ax.x + d.y * ax.y + d.z * ax.z)).toBeLessThan(0.03);
        expect(Math.abs(d.x * ay.x + d.y * ay.y + d.z * ay.z - RESCUE.lies.up)).toBeLessThan(0.03);
        expect(f.casualty.roll).toBeCloseTo(st.roll, 5);
      }
    });

    it(`${name}: he is rolled onto his side and back as the board goes under`, () => {
      const f = freshRescueFrame();
      const S = plan.at.scoop;
      rescueAt(level, plan, S.slide + 0.1, f);
      expect(f.casualty.roll).toBeLessThan(-1);
      rescueAt(level, plan, S.strap, f);
      expect(Math.abs(f.casualty.roll - f.stretcher.roll)).toBeLessThan(1e-6);
      expect(f.casualty.sprawl).toBe(0);
    });
  }

  it("starts the clock the first time he comes within reach", () => {
    const { plan } = cases[0];
    const clock = { started: null as number | null };
    expect(watchRescue(plan, clock, plan.spot.x + RESCUE.reach + 5, plan.spot.z, 3)).toBe(-1);
    expect(watchRescue(plan, clock, plan.spot.x + RESCUE.reach - 5, plan.spot.z, 4)).toBe(0);
    expect(watchRescue(plan, clock, plan.spot.x + 500, plan.spot.z, 10)).toBe(6);
  });
});

describe("rescue crew dials", () => {
  it("weighs whole bodies that never sum past one, the raise laid over them", () => {
    const out = new Float32Array(CREW_POSES.length);
    const raises = CREW_POSES.map((p, i) => (p.startsWith("raise") ? i : -1)).filter((i) => i >= 0);
    for (const hand of ["L", "R", null] as const) {
      for (let k = 0; k < 40; k++) {
        const m = {
          rise: (k % 5) / 4,
          stride: k * 0.137,
          walking: (k % 3) / 2,
          hand,
          raise: ((k % 7) - 3) / 3,
        };
        crewDials(m, out);
        let sum = 0;
        for (let i = 0; i < out.length; i++) {
          expect(Number.isFinite(out[i])).toBe(true);
          if (!raises.includes(i)) sum += out[i];
          else
            expect(out[i]).toBeCloseTo(
              hand && CREW_POSES[i].endsWith(hand) ? m.raise * m.rise : 0,
              5,
            );
        }
        // The hold carries the raise's negative, so the sum without the
        // raise rows is the body's share less the raise.
        expect(sum + (hand ? m.raise * m.rise : 0)).toBeLessThanOrEqual(1 + 1e-5);
        expect(sum + (hand ? m.raise * m.rise : 0)).toBeGreaterThanOrEqual(-1e-5);
      }
    }
  });
});
