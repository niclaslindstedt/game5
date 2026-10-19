// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI PATROL ON SNOWMOBILES — the rescue sent where an air ambulance
// has nowhere to set down (`rescue-sled-route.ts` plans it,
// `rescue-sled.ts` places and meets it, `rescue-book.ts` calls it): the
// ways driven up and down, the two machines and the toboggan at every
// moment, the machine stolen and what the rescue does without it, and the
// machines solid to the skier.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  RESCUE_SLEDS,
  createGame,
  freshSledsFrame,
  onRoute,
  planSledRescue,
  rescueSledsAt,
  sledCallGone,
  standSkier,
  step,
  type GameEvent,
  type GameState,
  type RescueCall,
  type RescueSledPlan,
} from "@engine";

import { bookRun, createRescueBook } from "../pwa/src/game/rescue-book.ts";
import { fitToLand } from "../pwa/src/game/rescue-plan.ts";
import { levelFor } from "./support/levels.ts";

const level = levelFor(38);
const pts = level.track.points;
const fell = pts[Math.floor(pts.length * 0.45)];
const plan = planSledRescue(level, fell)!;

const fresh = (): GameState =>
  createGame({ level, seed: 38, mode: "free", gore: true, crowd: 0, quiet: true });

/** The call as a run carries it, made `ago` s before the run's 0. */
function callOf(p: RescueSledPlan, ago = 0, taken: (number | null)[] = [null, null]): RescueCall {
  return {
    start: -ago,
    site: { x: p.park[0].x, y: 0, z: p.park[0].z, heading: p.park[0].heading, pitch: 0, roll: 0 },
    down: 1e9,
    up: 1e9,
    casualties: [{ x: fell.x, z: fell.z, known: 0 }],
    kind: "sled",
    sleds: p,
    sledsTaken: [...taken],
  };
}

const d = (a: { x: number; z: number }, b: { x: number; z: number }): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

describe("the rescue planned", () => {
  it("finds a way up to him and down to the bottom", () => {
    expect(plan).not.toBeNull();
    expect(plan.arrive[0].length).toBeGreaterThan(20);
    expect(plan.down.length).toBeGreaterThan(50);
    expect(plan.parked[0]).toBeGreaterThan(0);
    expect(plan.go).toBeGreaterThanOrEqual(Math.max(...plan.parked) + RESCUE_SLEDS.work - 1e-6);
    expect(plan.gone).toBeGreaterThan(plan.go + plan.down.time);
  });

  it("parks beside him, the first machine on the way down, its toboggan to his side", () => {
    expect(d(plan.toboggan, fell)).toBeLessThan(10);
    expect(d(plan.toboggan, fell)).toBeGreaterThan(2);
    const a = plan.arrive[0];
    expect(d({ x: a.x[a.x.length - 1], z: a.z[a.z.length - 1] }, plan.park[0])).toBeLessThan(0.01);
    // The toboggan on its tow bar behind the first, on the way down's start.
    const tow = onRoute(plan.down, 0, { x: 0, z: 0, heading: 0, speed: 0 }, RESCUE_SLEDS.trail);
    expect(d(tow, plan.toboggan)).toBeLessThan(0.5);
    expect(d(plan.park[0], plan.park[1])).toBeGreaterThan(2.5);
  });

  it("is driven no faster than a patrol drives, and towed slowly down", () => {
    for (const r of [plan.arrive[0], plan.arrive[1], plan.follow]) {
      for (let i = 1; i < r.t.length; i++) {
        const v = (r.s[i] - r.s[i - 1]) / (r.t[i] - r.t[i - 1]);
        expect(v).toBeLessThanOrEqual(RESCUE_SLEDS.pace.up + 1e-6);
      }
    }
    for (let i = 1; i < plan.down.t.length; i++) {
      const v = (plan.down.s[i] - plan.down.s[i - 1]) / (plan.down.t[i] - plan.down.t[i - 1]);
      expect(v).toBeLessThanOrEqual(RESCUE_SLEDS.pace.tow + 1e-6);
    }
  });

  it("is a pure function of the map and the spot", () => {
    const again = planSledRescue(level, fell)!;
    expect(again.gone).toBe(plan.gone);
    expect(again.down.x).toEqual(plan.down.x);
  });
});

describe("the machines at a moment", () => {
  const f = freshSledsFrame();

  it("drive up, stop, wait out the work and go down, the toboggan in tow", () => {
    rescueSledsAt(plan, undefined, plan.parked[0] / 2, f);
    expect(f.sleds[0].doing).toBe("up");
    expect(f.sleds[0].speed).toBeGreaterThan(0);
    expect(d(f.toboggan, f.sleds[0])).toBeCloseTo(RESCUE_SLEDS.trail, 0);
    rescueSledsAt(plan, undefined, plan.go - 1, f);
    expect(f.sleds.every((s) => s.doing === "parked" && s.shown)).toBe(true);
    expect(d(f.toboggan, plan.toboggan)).toBeLessThan(1e-6);
    rescueSledsAt(plan, undefined, plan.go + plan.down.time / 2, f);
    expect(f.tow).toBe(0);
    expect(f.sleds[0].doing).toBe("down");
    expect(f.toboggan.hitched).toBe(1);
    rescueSledsAt(plan, undefined, plan.gone + 1, f);
    expect(f.sleds.some((s) => s.shown)).toBe(false);
    expect(f.toboggan.shown).toBe(false);
  });

  it("with the first stolen, the second drives round and tows him down", () => {
    const taken = [plan.go - 20, null];
    rescueSledsAt(plan, taken, plan.go - 10, f);
    expect(f.sleds[0].shown).toBe(false);
    expect(f.tow).toBe(1);
    rescueSledsAt(plan, taken, plan.go + plan.hitch.time, f);
    expect(d(f.sleds[1], plan.park[0])).toBeLessThan(0.01);
    expect(d(f.toboggan, plan.toboggan)).toBeLessThan(0.1);
    rescueSledsAt(plan, taken, plan.go + plan.hitch.time + 20, f);
    expect(f.toboggan.hitched).toBe(1);
    expect(d(f.toboggan, f.sleds[1])).toBeCloseTo(RESCUE_SLEDS.trail, 0);
    expect(sledCallGone(plan, taken)).toBeGreaterThan(plan.go + plan.hitch.time + plan.down.time);
  });

  it("with both stolen, the toboggan stays beside him", () => {
    const taken = [plan.go - 20, plan.go - 15];
    rescueSledsAt(plan, taken, plan.go + 100, f);
    expect(f.tow).toBe(-1);
    expect(f.sleds.some((s) => s.shown)).toBe(false);
    expect(d(f.toboggan, plan.toboggan)).toBeLessThan(1e-6);
  });
});

describe("a machine stolen", () => {
  /** A run at the call's clock `t`, the skier stood `off` m beside the
   * first machine. */
  function beside(t: number, off = -2.2): GameState {
    const s = fresh();
    s.rescue = [callOf(plan, t)];
    const p = plan.park[0];
    standSkier(s, p.x + Math.cos(p.heading) * off, p.z - Math.sin(p.heading) * off, p.heading);
    return s;
  }
  const press = { ...NEUTRAL_INPUT, machine: true };

  it("is taken with the machine press while it stands there", () => {
    const s = beside(plan.parked[0] + 5);
    const own = s.sled!;
    step(s, press);
    expect(s.sled).not.toBe(own);
    expect(s.sled!.livery).toBe("patrol");
    expect(s.sled!.rider).toBe(true);
    expect(s.sledsLeft).toEqual([own]);
    expect(s.rescue![0].sledsTaken![0]).toBeCloseTo(plan.parked[0] + 5, 1);
    expect(s.events.some((e) => e.kind === "steal" && e.livery === "patrol")).toBe(true);
  });

  it("is not taken while it is driven", () => {
    const s = beside(plan.parked[0] - 3, -1);
    const own = s.sled!;
    step(s, press);
    expect(s.sled).toBe(own);
    expect(s.rescue![0].sledsTaken![0]).toBeNull();
  });

  it("leaves his own where it stood, to be taken back", () => {
    const s = beside(plan.parked[0] + 5);
    step(s, press);
    // Off it, back to his own (stood beside it), and on it again.
    for (let i = 0; i < 160; i++) step(s, NEUTRAL_INPUT);
    step(s, press);
    expect(s.sled!.rider).toBe(false);
    // Past the grace a machine just left keeps him off any other.
    for (let i = 0; i < 6 * 120; i++) step(s, NEUTRAL_INPUT);
    const mine = s.sledsLeft![0];
    standSkier(s, mine.x + 2, mine.z, 0);
    step(s, press);
    expect(s.sled).toBe(mine);
    expect(s.sled!.livery).toBeUndefined();
    expect(s.sledsLeft!.length).toBe(1);
    expect(s.sledsLeft![0].livery).toBe("patrol");
  });
});

describe("the machines, solid", () => {
  it("throw a skier met hard and hold off one at a crawl", () => {
    const at = plan.park[1];
    const t = plan.parked[1] + 5;
    const go = (speed: number, back: number) => {
      const s = fresh();
      s.rescue = [callOf(plan, t)];
      const rx = Math.cos(at.heading);
      const rz = -Math.sin(at.heading);
      const w = RESCUE_SLEDS.sled.width / 2;
      standSkier(s, at.x + rx * (w + back), at.z + rz * (w + back), Math.atan2(-rx, -rz));
      s.skier.vx = -rx * speed;
      s.skier.vz = -rz * speed;
      const events: GameEvent[] = [];
      let passed = false;
      for (let i = 0; i < 200; i++) {
        step(s, NEUTRAL_INPUT);
        events.push(...s.events);
        if ((s.skier.x - at.x) * rx + (s.skier.z - at.z) * rz < w - 0.6) passed = true;
      }
      return { s, events, passed };
    };
    const hard = go(11, 4);
    expect(hard.passed).toBe(false);
    expect(hard.events.some((e) => e.kind === "hit" && e.stuff === "steel")).toBe(true);
    const slow = go(1, 1.2);
    expect(slow.passed).toBe(false);
    expect(slow.s.skier.thrown).toBeNull();
  });
});

describe("the call booked", () => {
  /** A spot near the piste no machine can set down near, that the patrol
   * can still reach. */
  const spot = (() => {
    for (let z = 200; z < level.size - 200; z += 90) {
      for (let x = 200; x < level.size - 200; x += 90) {
        const p = { x, z };
        if (!fitToLand(level, p) && planSledRescue(level, p)) return p;
      }
    }
    return null;
  })();

  it("sends the snowmobiles where no machine can land, and keeps them stolen", () => {
    expect(spot).not.toBeNull();
    const book = createRescueBook();
    const end = fresh();
    standSkier(end, spot!.x, spot!.z, 0);
    end.t = 5;
    end.gore!.injured = 0;
    const next = bookRun(book, end, fresh());
    const call = next.rescue![0];
    expect(call.kind).toBe("sled");
    expect(call.sledsTaken).toEqual([null, null]);
    // Stolen on that run: still stolen on the one after.
    next.t = 10;
    call.sledsTaken![1] = 3;
    const after = bookRun(book, next, fresh());
    expect(after.rescue![0].sledsTaken).toEqual([null, 3]);
  });
});
