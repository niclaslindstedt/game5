// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A CIVILIAN KNOCKED (`civilian-knock.ts`, `civilian-hits.ts`): a light
// push is swayed or stepped out of, a hard one puts him down, a vehicle's
// flies him, a person sat tips over without standing, and a hitter driven
// through a person on foot strikes him through `collide`.

import { describe, expect, it } from "vitest";
import { TUNING, createGame } from "@engine";

import {
  collide,
  createKnocks,
  stepKnocks,
  type Hitter,
  type Person,
} from "../pwa/src/game/civilian-hits.ts";
import { knockOf, stepKnock, strike, type Knock } from "../pwa/src/game/civilian-knock.ts";
import { freshCivilianPose } from "../pwa/src/game/civilian-plan.ts";
import { flatLevel } from "./support/synthetic.ts";

const level = flatLevel({ packed: 1 });
const state = createGame({ level, quiet: true });
const X = 1500;
const Z = 1500;

/** Struck from behind by `dv` m/s at `high` m, followed until home or
 * `secs` s. */
function knocked(
  dv: number,
  high = 1.2,
  lift = 0,
  sat = false,
  secs = 20,
): { k: Knock; peak: number; down: boolean } {
  const k = knockOf(state, X, Z, 0, sat ? "snow" : "stand", false);
  const y0 = k.rag.y;
  strike(k, 0, dv, high, lift);
  let peak = 0;
  let down = false;
  for (let s = 0; s < secs * 120; s++) {
    if (!stepKnock(state, k, { x: k.ox, z: k.oz })) break;
    if (k.phase === "stagger" || k.phase === "down") peak = Math.max(peak, k.rag.y - y0);
    if (k.phase === "down") down = true;
  }
  return { k, peak, down };
}

describe("a person on foot pushed", () => {
  it("sways under a light push and keeps his feet", () => {
    const { k, down } = knocked(0.3);
    expect(down).toBe(false);
    expect(k.how).toBe("sway");
  });

  it("steps out of a firmer one", () => {
    const { k, down } = knocked(1);
    expect(down).toBe(false);
    expect(["step", "stagger"]).toContain(k.how);
    expect(k.steps).toBeGreaterThan(0);
  });

  it("goes down under a hard one, and gets up again", () => {
    const { k, down } = knocked(3.2);
    expect(down).toBe(true);
    expect(["fall", "fly"]).toContain(k.how);
    expect(k.phase).toBe("back");
  });

  it("is flown by a vehicle's blow, thrown off the snow and far", () => {
    const { k, peak } = knocked(12, 0.6, 0.4);
    expect(k.how).toBe("fly");
    expect(peak).toBeGreaterThan(0.3);
    expect(Math.hypot(k.rag.x - X, k.rag.z - Z)).toBeGreaterThan(6);
  });

  it("sat on the snow, tips over without being stood up", () => {
    const { peak, down } = knocked(2, 0.6, 0.22, true);
    expect(down).toBe(true);
    expect(peak).toBeLessThan(0.4);
  });
});

describe("a hitter driven through a person", () => {
  it("knocks him through `collide`, the push along the way it went", () => {
    const y = level.groundAt(X, Z);
    const people: Person[] = [
      {
        key: 0,
        body: "man",
        skis: false,
        rx: X,
        rz: Z,
        rr: 1,
        at: (_t, o) =>
          Object.assign(o, {
            ...freshCivilianPose(),
            x: X,
            y,
            z: Z,
            heading: 0,
            activity: "stand",
            seat: null,
            shown: true,
          }),
      },
    ];
    const knocks = createKnocks();
    knocks.t = 0;
    let hz = Z - 2;
    for (let s = 0; s < 240; s++) {
      state.t = s * TUNING.dt;
      const h: Hitter = {
        x: X,
        y: y - 0.2,
        z: hz,
        vx: 0,
        vz: 2,
        heading: 0,
        r: 0.36,
        front: 0,
        back: 0,
        half: 0,
        height: 1.6,
        mass: 86,
        high: 1.05,
        lift: 0.22,
        from: -1,
      };
      collide(knocks, state, people, [h], TUNING.dt);
      stepKnocks(knocks, state, people, 1);
      hz += 2 * TUNING.dt;
    }
    const k = knocks.map.get(0);
    expect(k).toBeDefined();
    expect(k!.rag.z).toBeGreaterThan(Z + 0.3);
  });
});
