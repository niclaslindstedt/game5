// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI PATROL AT THE SCENE — the four of a rescue by snowmobile
// (`rescue-sleds-crew.ts`) held without a renderer: their work fits in the
// time the patrol stops for, nobody walks faster than a brisk walk or
// through a machine, the toboggan or him, he ends up in the toboggan and
// stays in it down the mountain, every rider sits on a machine that is
// there, and with a machine stolen the work goes on and he goes down
// behind the other.

import { describe, expect, it } from "vitest";
import { RESCUE_SLEDS, planSledRescue, type RescueSledPlan } from "@engine";

import {
  crewPlanOf,
  freshSledCrewFrame,
  sledCrewAt,
  type SledCrewFrame,
} from "../pwa/src/game/rescue-sleds-crew.ts";
import { levelFor } from "./support/levels.ts";

const level = levelFor(38);
const pts = level.track.points;
const fell = pts[Math.floor(pts.length * 0.45)];
const plan: RescueSledPlan = planSledRescue(level, fell)!;
const spot = { x: fell.x, z: fell.z };

const DT = 0.05;

/** Every frame of the call from its start to a little after the convoy
 * leaves, with `taken` stolen. */
function frames(taken: (number | null)[], until = plan.go + 60): SledCrewFrame[] {
  const out: SledCrewFrame[] = [];
  for (let t = 0; t <= until; t += DT) {
    out.push(sledCrewAt(level, plan, spot, taken, t, freshSledCrewFrame()));
  }
  return out;
}

/** Whether (x, z) is inside the box of length × width round `p`, grown by `m`. */
function inside(
  p: { x: number; z: number; heading: number },
  length: number,
  width: number,
  x: number,
  z: number,
  m: number,
): boolean {
  const dx = x - p.x;
  const dz = z - p.z;
  const along = dx * Math.sin(p.heading) + dz * Math.cos(p.heading);
  const across = dx * Math.cos(p.heading) - dz * Math.sin(p.heading);
  return Math.abs(along) < length / 2 + m && Math.abs(across) < width / 2 + m;
}

const free = frames([null, null]);
const cp = crewPlanOf(level, plan, spot);

describe("the patrol at the scene", () => {
  it("does its work in the time the patrol stops for", () => {
    const A = cp.at;
    const order = [A.take, A.lead, A.scoop, A.raise, A.lowered, A.lashed, A.up, A.done];
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
    expect(A.take).toBeGreaterThan(Math.min(...plan.parked));
    expect(A.done).toBeLessThanOrEqual(plan.go);
    expect(A.done - Math.max(...plan.parked)).toBeLessThanOrEqual(RESCUE_SLEDS.work);
  });

  it("walks no faster than a brisk walk, stood on the snow", () => {
    let most = 0;
    for (let i = 1; i < free.length; i++) {
      for (let j = 0; j < 4; j++) {
        const a = free[i - 1];
        const b = free[i];
        if (a.seats[j]?.on === 1 || b.seats[j]?.on === 1) continue;
        if (!a.crew[j].shown || !b.crew[j].shown) continue;
        const v = Math.hypot(b.crew[j].x - a.crew[j].x, b.crew[j].z - a.crew[j].z) / DT;
        most = Math.max(most, v);
        if (!b.seats[j]) {
          expect(Math.abs(b.crew[j].y - level.groundAt(b.crew[j].x, b.crew[j].z))).toBeLessThan(
            1e-6,
          );
        }
      }
    }
    expect(most).toBeLessThan(1.6);
  });

  it("walks round the machines, the toboggan and him, never through them", () => {
    const S = RESCUE_SLEDS;
    for (const f of free) {
      if (f.sleds.sleds.every((s) => s.doing !== "parked")) continue;
      for (let j = 0; j < 4; j++) {
        const c = f.crew[j];
        if (!c.shown || f.seats[j]) continue;
        for (const s of f.sleds.sleds) {
          if (s.shown && s.doing === "parked") {
            expect(inside(s, S.sled.length, S.sled.width, c.x, c.z, 0.15)).toBe(false);
          }
        }
        const b = f.sleds.toboggan;
        if (b.speed === 0) {
          expect(inside(b, S.toboggan.length, S.toboggan.width, c.x, c.z, 0.15)).toBe(false);
        }
      }
    }
    // Him, lying as he was found, until the scoop is joined.
    for (const f of free) {
      if (f.casualty.sprawl < 1) break;
      for (const c of f.crew) {
        if (!c.shown) continue;
        expect(inside(f.casualty, 1.9, 0.6, c.x, c.z, 0.15)).toBe(false);
      }
    }
  });

  it("lays him in the toboggan, and he stays in it all the way down", () => {
    const S = RESCUE_SLEDS;
    let towed = 0;
    for (let i = 0; i < free.length; i++) {
      const t = i * DT;
      const f = free[i];
      if (t < plan.go || !f.sleds.toboggan.shown) continue;
      const b = f.sleds.toboggan;
      const c = f.casualty;
      expect(c.shown).toBe(true);
      expect(inside(b, S.toboggan.length, S.toboggan.width, c.x, c.z, 0)).toBe(true);
      const up = c.y - level.groundAt(b.x, b.z);
      expect(up).toBeGreaterThan(0.2);
      expect(up).toBeLessThan(1);
      expect(f.lashed).toBe(3);
      if (b.speed > 0) towed++;
    }
    expect(towed).toBeGreaterThan(100);
  });

  it("seats every rider on a machine that is there, four of them when they go", () => {
    for (const f of free) {
      for (let j = 0; j < 4; j++) {
        const s = f.seats[j];
        if (!s || !f.crew[j].shown) continue;
        expect(f.sleds.sleds[s.sled].shown).toBe(true);
      }
    }
    const going = free[Math.ceil((plan.go + 5) / DT)];
    expect(going.seats.filter((s) => s && s.on === 1).length).toBe(4);
    const drivers = going.seats.filter((s) => s?.place === "driver").map((s) => s!.sled);
    expect(drivers.sort()).toEqual([0, 1]);
  });

  it("takes the board out of the toboggan, and has it under him for the carry", () => {
    const before = free[Math.floor(plan.parked[0] / DT) - 10];
    expect(
      inside(before.sleds.toboggan, 2.3, 0.62, before.stretcher.x, before.stretcher.z, 0),
    ).toBe(true);
    const walking = free[Math.floor((cp.at.lead + cp.at.scoop) / 2 / DT)];
    expect(
      Math.hypot(walking.stretcher.x - plan.toboggan.x, walking.stretcher.z - plan.toboggan.z),
    ).toBeGreaterThan(2);
    const carried = free[Math.floor((cp.at.raise - 2) / DT)];
    expect(carried.casualty.sprawl).toBe(0);
    expect(
      carried.stretcher.y - level.groundAt(carried.stretcher.x, carried.stretcher.z),
    ).toBeGreaterThan(0.4);
  });
});

describe("a machine stolen", () => {
  it("goes on without the first: everyone posed, him towed down behind the second", () => {
    const taken = [plan.parked[0] + 5, null];
    const all = frames(taken, plan.go + plan.hitch.time + 40);
    for (let i = 0; i < all.length; i++) {
      const f = all[i];
      for (let j = 0; j < 4; j++) {
        const c = f.crew[j];
        for (const v of [c.x, c.y, c.z, c.heading]) expect(Number.isFinite(v)).toBe(true);
        const s = f.seats[j];
        if (s && c.shown && i * DT >= taken[0]!) expect(s.sled).toBe(1);
      }
    }
    const f = all[Math.floor((plan.go + plan.hitch.time + 20) / DT)];
    expect(f.sleds.tow).toBe(1);
    const m = f.sleds.sleds[1];
    expect(m.doing).toBe("down");
    const d = Math.hypot(f.casualty.x - m.x, f.casualty.z - m.z);
    expect(d).toBeGreaterThan(RESCUE_SLEDS.trail - 1.2);
    expect(d).toBeLessThan(RESCUE_SLEDS.trail + 1.2);
    // The two whose machine is gone stand by, watching, on the snow.
    const left = f.crew.filter((c, j) => c.shown && !f.seats[j]);
    expect(left.length).toBe(2);
    for (const c of left) expect(Math.abs(c.y - level.groundAt(c.x, c.z))).toBeLessThan(1e-6);
  });

  it("leaves all four by the toboggan with both gone", () => {
    const taken = [plan.parked[0] + 5, plan.parked[1] + 8];
    const f = sledCrewAt(level, plan, spot, taken, plan.go + 30, freshSledCrewFrame());
    expect(f.sleds.tow).toBe(-1);
    for (let j = 0; j < 4; j++) {
      expect(f.seats[j]).toBeNull();
      const c = f.crew[j];
      expect(c.shown).toBe(true);
      expect(Math.hypot(c.x - plan.toboggan.x, c.z - plan.toboggan.z)).toBeLessThan(8);
    }
    expect(Math.hypot(f.casualty.x - plan.toboggan.x, f.casualty.z - plan.toboggan.z)).toBeLessThan(
      0.5,
    );
  });
});
