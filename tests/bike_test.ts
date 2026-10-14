// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE ON THE BENCH (`bike-body.ts`): every row
// `docs/downhill-bike.md`'s evals hold the physics to, ridden by the real
// bodies on grounds no generator built — the same rows `make bike-ride`
// prints (`tests/support/bike-rides.ts`) — and the keys mapped in their one
// place (`bikeControls`).
import { describe, expect, it } from "vitest";
import { bikeControls, bikeInput, bikePose, BIKE, freshBike, NEUTRAL_INPUT } from "@engine";
import { BIKE_ROWS, rowPasses } from "./support/bike-rides.ts";

describe("the bike on the bench", () => {
  for (const r of BIKE_ROWS) {
    it(`${r.id}: ${r.label}`, () => {
      const res = r.run();
      expect(Number.isFinite(res.value), `${r.id} read ${res.value}`).toBe(true);
      expect(
        rowPasses(r, res),
        `${r.id}: ${res.value} ${r.unit} (band ${r.band?.join("–") ?? "—"}) ${res.note ?? ""}`,
      ).toBe(true);
    });
  }
});

describe("the keys (bikeControls)", () => {
  it("maps the skier's keys onto the bike's hands and body", () => {
    const c = bikeControls({
      ...NEUTRAL_INPUT,
      tuck: 1,
      brake: 0.5,
      steer: -0.4,
      lean: 0.7,
      jump: true,
    });
    expect(c).toEqual({ pedal: 1, front: 0.5, rear: 0.5, steer: -0.4, lean: 0.7, crouch: 1 });
  });
  it("the trick key is the rear brake alone — a skid", () => {
    const c = bikeControls({ ...NEUTRAL_INPUT, trick: true });
    expect(c.front).toBe(0);
    expect(c.rear).toBe(1);
  });
  it("clamps what it is handed", () => {
    const c = bikeControls({ ...NEUTRAL_INPUT, tuck: 3, brake: -1, steer: 9, lean: -9 });
    expect(c).toMatchObject({ pedal: 1, front: 0, rear: 0, steer: 1, lean: -1 });
  });
  it("bikeInput is its inverse for every control the bot uses", () => {
    for (const ctl of [
      { pedal: 1, front: 0, rear: 0, steer: 0.3, lean: -0.5, crouch: 0 },
      { pedal: 0, front: 0.6, rear: 0.6, steer: -1, lean: 1, crouch: 1 },
      { pedal: 0, front: 0, rear: 1, steer: 0, lean: 0, crouch: 0 },
    ]) {
      expect(bikeControls(bikeInput(ctl))).toEqual(ctl);
    }
  });
});

describe("the pose the drawing reads (bikePose)", () => {
  it("is a plain record of the frame, the wheels, the ends and the rider", () => {
    const b = freshBike(BIKE.rider.mass);
    const p = bikePose(b);
    expect(p.mode).toBe(b.mode);
    expect(p.forkShare).toBeGreaterThanOrEqual(0);
    expect(p.forkShare).toBeLessThanOrEqual(1);
    expect(p.shockShare).toBeGreaterThanOrEqual(0);
    expect(p.shockShare).toBeLessThanOrEqual(1);
    expect(Number.isFinite(p.rider.y)).toBe(true);
    // A copy: the drawing may keep it without the engine's moving under it.
    expect(JSON.parse(JSON.stringify({ ...p, q: null }))).toBeTruthy();
  });
});
