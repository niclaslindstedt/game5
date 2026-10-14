// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PEOPLE AT THE FIRES (`civilian-fires.ts`, dealt by `civilian-plan.ts`):
// a camp fire's two to five and a bonfire's four to ten, every one facing
// the fire, a sitter's hips on a bench's seat, nobody in a hearth or on a
// bench he does not sit on, a griller's sausage over the embers — and the
// rest of the free ride's people kept out of a fire's ring.

import { describe, expect, it } from "vitest";
import { FIRE_KINDS, firesOf } from "@engine";

import { civilianAt, civilianPlanFor, freshCivilianPose } from "../pwa/src/game/civilian-plan.ts";
import { civilianDials, CIVILIAN_POSES } from "../pwa/src/game/civilian-moves.ts";
import { FIRESIDE, fireKeepOut, heldHand, stickTip } from "../pwa/src/game/civilian-fires.ts";
import { FIRE_KIT, snowFloor } from "../pwa/src/game/fire-plan.ts";
import { levelFor } from "./support/levels.ts";

const SEEDS = [38, 7];

/** The way a heading points, and the bearing from a person to a fire. */
const turn = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

describe("the people at the fires", () => {
  for (const seed of SEEDS) {
    const level = levelFor(seed);
    const fires = firesOf(level);
    const plan = civilianPlanFor(level);
    const at = plan.people.map((c, i) => [c, i] as const).filter(([c]) => c.fire);

    it(`seed ${seed}: gathers round every fire, as many as its kind holds`, () => {
      expect(fires.length).toBeGreaterThan(0);
      for (const f of fires) {
        const n = at.filter(([c]) => c.fire!.id === f.id).length;
        const [lo, hi] = FIRESIDE.count[f.kind];
        expect(n, f.id).toBeGreaterThanOrEqual(Math.min(lo, 2));
        expect(n, f.id).toBeLessThanOrEqual(hi);
      }
    });

    it(`seed ${seed}: faces the fire, out of its hearth, a sitter on a bench`, () => {
      const pose = freshCivilianPose();
      for (const [c, i] of at) {
        const f = fires.find((g) => g.id === c.fire!.id)!;
        civilianAt(plan, i, 31, 12.5, pose);
        const d = Math.hypot(pose.x - f.x, pose.z - f.z);
        // Never in the hearth, nor its ring of stones; inside its ring.
        expect(d, c.id).toBeGreaterThan(f.radius + 0.6);
        expect(d, c.id).toBeLessThan(fireKeepOut(f));
        const bearing = Math.atan2(f.x - pose.x, f.z - pose.z);
        expect(Math.abs(turn(pose.heading - bearing)), c.id).toBeLessThan(1e-6);
        if (c.home.seat === null) {
          expect(pose.y).toBeCloseTo(snowFloor(level, pose.x, pose.z), 6);
          // A stander clear of every bench's seat.
          for (const s of f.seats) {
            const ax = Math.cos(s.heading);
            const az = -Math.sin(s.heading);
            const along = (pose.x - s.x) * ax + (pose.z - s.z) * az;
            const across = Math.hypot(pose.x - s.x - ax * along, pose.z - s.z - az * along);
            const onIt = Math.abs(along) < s.length / 2 + 0.2 && across < 0.4;
            expect(onIt, c.id).toBe(false);
          }
          continue;
        }
        // His hips on a bench's seat: on its line, within its length, and
        // drawn on the floor the bench pose sits at its height.
        const bench = f.seats.find((s) => {
          const ax = Math.cos(s.heading);
          const az = -Math.sin(s.heading);
          const along = (pose.x - s.x) * ax + (pose.z - s.z) * az;
          const across = Math.hypot(pose.x - s.x - ax * along, pose.z - s.z - az * along);
          return Math.abs(along) < s.length / 2 && across < 0.05;
        });
        expect(bench, c.id).toBeDefined();
        const top = snowFloor(level, bench!.x, bench!.z) + FIRE_KIT.bench.seat;
        expect(pose.y + 0.47).toBeCloseTo(top, 6);
      }
    });

    it(`seed ${seed}: holds a griller's sausage over the embers, from his hand`, () => {
      const pose = freshCivilianPose();
      const w = new Float32Array(CIVILIAN_POSES.length);
      const hand: [number, number, number] = [0, 0, 0];
      const tip = { x: 0, y: 0, z: 0 };
      let seen = 0;
      for (const [c, i] of at) {
        for (const t of [5, 60, 140, 260]) {
          civilianAt(plan, i, t, 12.5, pose);
          if (pose.activity !== "grill") continue;
          civilianDials(pose, t, i, w);
          heldHand(c.body, w, hand);
          const ch = Math.cos(pose.heading);
          const sh = Math.sin(pose.heading);
          const world = {
            x: pose.x + hand[0] * ch + hand[2] * sh,
            y: pose.y + hand[1],
            z: pose.z - hand[0] * sh + hand[2] * ch,
          };
          const f = c.fire!;
          stickTip(world, f.kind, f.x, f.y, f.z, tip);
          const r = Math.hypot(tip.x - f.x, tip.z - f.z);
          const fire = fires.find((g) => g.id === f.id)!;
          // Over the embers, a little over the hearth, a stick's length out.
          expect(r, c.id).toBeLessThan(fire.radius * 1.15);
          expect(tip.y - f.y, c.id).toBeGreaterThan(0.2);
          expect(tip.y - f.y, c.id).toBeLessThan(FIRE_KINDS[fire.kind].flames);
          const L = Math.hypot(tip.x - world.x, tip.y - world.y, tip.z - world.z);
          expect(L, c.id).toBeCloseTo(FIRESIDE.stick, 2);
          seen++;
        }
      }
      expect(seen).toBeGreaterThan(0);
    });

    it(`seed ${seed}: keeps everyone else out of a fire's ring`, () => {
      const pose = freshCivilianPose();
      for (let i = 0; i < plan.people.length; i++) {
        if (plan.people[i].fire) continue;
        for (const t of [0, 41, 333]) {
          civilianAt(plan, i, t, 12.5, pose);
          for (const f of fires) {
            expect(Math.hypot(pose.x - f.x, pose.z - f.z), plan.people[i].id).toBeGreaterThan(
              fireKeepOut(f) - 1e-6,
            );
          }
        }
      }
    });
  }

  it("fills a camp fire at lunch and a bonfire toward evening", () => {
    const level = levelFor(38);
    const plan = civilianPlanFor(level);
    const pose = freshCivilianPose();
    const out = (kind: string, hour: number): number =>
      plan.people.filter((c, i) => {
        if (!c.fire || !c.fire.id.startsWith(kind)) return false;
        return civilianAt(plan, i, 10, hour, pose).shown;
      }).length;
    expect(out("C", 12.5)).toBeGreaterThan(out("C", 9));
    expect(out("C", 12.5)).toBeGreaterThan(out("C", 23));
    expect(out("B", 18)).toBeGreaterThan(out("B", 12.5));
    expect(out("B", 18)).toBeGreaterThan(out("B", 6));
  });
});
