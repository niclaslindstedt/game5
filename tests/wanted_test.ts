// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WANTED LEVEL (`wanted.ts`): absent until an offence raises it; the
// hook (`raiseHeat`) and its floors; the heat climbing the longer he
// survives, faster in sight than out of it; the stars dropped once he has
// stayed out of every pursuer's sight long enough; the sight line over the
// ground; the arrest with SAFE FOR WORK on; the survival timer; the roster
// and the ground waves as data; and nothing of it moving a digest.

import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  TUNING,
  WANTED,
  arrestSkier,
  arrestedOf,
  createGame,
  groundWave,
  raiseHeat,
  rosterOf,
  seesQuarry,
  setWanted,
  step,
  survivedOf,
  wavesSent,
  type GameEvent,
  type GameState,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

function ride(extra: { wanted?: number; sfw?: boolean } = {}): GameState {
  return createGame({ level: flatLevel(), mode: "free", quiet: true, crowd: 0, ...extra });
}

/** Run `seconds` standing still, collecting the wanted events. */
function run(state: GameState, seconds: number): Extract<GameEvent, { kind: "wanted" }>[] {
  const out: Extract<GameEvent, { kind: "wanted" }>[] = [];
  const steps = Math.round(seconds / TUNING.dt);
  for (let i = 0; i < steps; i++) {
    step(state, NEUTRAL_INPUT);
    for (const e of state.events) if (e.kind === "wanted") out.push(e);
  }
  return out;
}

/** A helicopter hovering `up` m over the skier: it always sees him. */
function hover(state: GameState, up = 80): void {
  const c = state.skier;
  state.wanted!.pursuers = [{ id: 1, kind: "helicopter", x: c.x + 50, y: c.y + up, z: c.z }];
}

function trace(state: GameState, steps: number): number {
  let h = 0;
  for (let i = 0; i < steps; i++) {
    step(state, { ...NEUTRAL_INPUT, tuck: 0.4, steer: i % 400 < 200 ? 0.3 : -0.3 });
    const c = state.skier;
    h = (h * 31 + Math.round(c.x * 1000) + Math.round(c.z * 1000) * 7) % 2147483647;
  }
  return h;
}

describe("absent until raised", () => {
  it("is not on a free ride or a race that raised nothing", () => {
    expect("wanted" in ride()).toBe(false);
    const race = createGame({ level: flatLevel(), quiet: true, wanted: 3 });
    expect(race.wanted).toBeUndefined();
  });

  it("moves no digest: a ride never raised skis exactly as before", () => {
    const a = ride();
    const b = createGame({ level: flatLevel(), mode: "free", quiet: true, crowd: 0 });
    expect(trace(a, 1200)).toBe(trace(b, 1200));
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it("draws nothing from the run's stream when raised", () => {
    const a = ride();
    const b = ride({ wanted: 4 });
    expect(trace(a, 1200)).toBe(trace(b, 1200));
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it("replays exactly: two hunted rides end on the same heat", () => {
    const a = ride({ wanted: 2 });
    const b = ride({ wanted: 2 });
    hover(a);
    hover(b);
    run(a, 30);
    run(b, 30);
    expect(a.wanted).toEqual(b.wanted);
  });
});

describe("the hook", () => {
  it("raises a stolen air ambulance to two stars and a police helicopter to three", () => {
    const a = ride();
    expect(raiseHeat(a, "stole-ambulance")).toBe(2);
    expect(a.wanted!.cause).toBe("stole-ambulance");
    expect(a.events.some((e) => e.kind === "wanted" && e.change === "raised")).toBe(true);
    const b = ride();
    expect(raiseHeat(b, "stole-police")).toBe(3);
  });

  it("adds a star on top of what he has, never past five", () => {
    const s = ride();
    raiseHeat(s, "stole-ambulance");
    raiseHeat(s, "stole-ambulance");
    expect(s.wanted!.stars).toBe(3);
    for (let i = 0; i < 6; i++) raiseHeat(s, "stole-police");
    expect(s.wanted!.stars).toBe(WANTED.maxStars);
  });

  it("starts a ride hunted on `wanted`, and the stars can be set by hand", () => {
    const s = ride({ wanted: 3 });
    expect(s.wanted!.stars).toBe(3);
    expect(s.wanted!.seen).toBe(true);
    setWanted(s, 1);
    expect(s.wanted!.stars).toBe(1);
    setWanted(s, 0);
    expect(s.wanted!.stars).toBe(0);
    expect(s.wanted!.ended).toBe("escaped");
  });
});

describe("the longer he survives, the worse it gets", () => {
  it("climbs a star after `climb` s in sight", () => {
    const s = ride({ wanted: 1 });
    hover(s);
    const events = run(s, WANTED.climb[1] + 1);
    expect(s.wanted!.stars).toBe(2);
    expect(events.some((e) => e.change === "raised" && e.stars === 2)).toBe(true);
  });

  it("reaches five stars and holds there", () => {
    const s = ride({ wanted: 1 });
    hover(s);
    run(s, WANTED.climb.slice(1, 5).reduce((a, b) => a + b, 0) + 5);
    expect(s.wanted!.stars).toBe(5);
    expect(s.wanted!.peak).toBe(5);
    run(s, 30);
    expect(s.wanted!.stars).toBe(5);
  });

  it("climbs slower out of sight than in it", () => {
    const seen = ride({ wanted: 4 });
    hover(seen);
    const hid = ride({ wanted: 4 });
    run(seen, WANTED.fix + 5);
    run(hid, WANTED.fix + 5);
    expect(seen.wanted!.heat).toBeGreaterThan(hid.wanted!.heat);
  });
});

describe("losing them", () => {
  it("flashes once out of sight and drops the stars after `lose` s", () => {
    const s = ride({ wanted: 2 });
    const searching = run(s, WANTED.fix + 1);
    expect(searching.some((e) => e.change === "searching")).toBe(true);
    expect(s.wanted!.seen).toBe(false);
    const lost = run(s, WANTED.lose[2] + 1);
    expect(lost.some((e) => e.change === "lost")).toBe(true);
    expect(s.wanted!.stars).toBe(0);
    expect(s.wanted!.ended).toBe("escaped");
  });

  it("never loses them while a pursuer keeps him in sight", () => {
    const s = ride({ wanted: 2 });
    hover(s);
    run(s, WANTED.fix + WANTED.lose[2] + 5);
    expect(s.wanted!.stars).toBeGreaterThan(0);
    expect(s.wanted!.seen).toBe(true);
  });

  it("is hidden by a ridge between the eyes and his chest, and seen across open snow", () => {
    const ridge = { groundAt: (x: number) => (x > 40 && x < 60 ? 30 : 0) };
    const man = { x: 100, y: 0, z: 0 };
    expect(seesQuarry(ridge, { kind: "soldier", x: 0, y: 1.6, z: 0 }, man)).toBe(false);
    expect(seesQuarry(ridge, { kind: "helicopter", x: 0, y: 200, z: 0 }, man)).toBe(true);
    const open = { groundAt: () => 0 };
    expect(seesQuarry(open, { kind: "soldier", x: 0, y: 1.6, z: 0 }, man)).toBe(true);
    // ...but not past his kind's sight, unless near enough to hear.
    const far = { x: WANTED.sight.soldier + 50, y: 0, z: 0 };
    expect(seesQuarry(open, { kind: "soldier", x: 0, y: 1.6, z: 0 }, far)).toBe(false);
    expect(seesQuarry(ridge, { kind: "soldier", x: 45, y: 0, z: 0 }, { x: 50, y: 0, z: 0 })).toBe(
      true,
    );
  });

  it("is raised again after an escape as a new hunt, its timer begun again", () => {
    const s = ride({ wanted: 1 });
    run(s, WANTED.fix + WANTED.lose[1] + 1);
    expect(s.wanted!.ended).toBe("escaped");
    const t = s.t;
    raiseHeat(s, "stole-police");
    expect(s.wanted!.ended).toBeNull();
    expect(s.wanted!.since).toBe(t);
    expect(s.wanted!.stars).toBe(3);
  });
});

describe("the survival timer and the endings", () => {
  it("counts from the raise and stops when the stars are lost", () => {
    const s = ride();
    run(s, 2);
    raiseHeat(s, "stole-ambulance");
    run(s, 5);
    expect(survivedOf(s.wanted!, s.t)).toBeCloseTo(5, 1);
    run(s, WANTED.fix + WANTED.lose[2]);
    const at = survivedOf(s.wanted!, s.t);
    run(s, 10);
    expect(survivedOf(s.wanted!, s.t)).toBe(at);
  });

  it("arrests him with SAFE FOR WORK on, and refuses where the army shoots to kill", () => {
    const lethal = ride({ wanted: 3 });
    expect(lethal.wanted!.lethal).toBe(true);
    expect(arrestSkier(lethal)).toBe(false);
    const sfw = ride({ wanted: 3, sfw: true });
    expect(sfw.wanted!.lethal).toBe(false);
    run(sfw, 4);
    expect(arrestSkier(sfw)).toBe(true);
    expect(sfw.events.some((e) => e.kind === "wanted" && e.change === "arrested")).toBe(true);
    expect(sfw.wanted!.ended).toBe("arrested");
    const stopped = survivedOf(sfw.wanted!, sfw.t);
    run(sfw, 3);
    expect(survivedOf(sfw.wanted!, sfw.t)).toBe(stopped);
    expect(arrestedOf(sfw)).toBeCloseTo(3, 1);
    // An arrest ends it: no offence raises it again on this run.
    expect(raiseHeat(sfw, "stole-police")).toBe(0);
  });

  it("ends `killed` on his death", () => {
    const s = createGame({
      level: flatLevel(),
      mode: "free",
      quiet: true,
      crowd: 0,
      gore: true,
      wanted: 2,
    });
    s.gore!.dead = s.t;
    run(s, 0.1);
    expect(s.wanted!.ended).toBe("killed");
  });
});

describe("the roster and the ground waves", () => {
  it("sends more of everything with every star, and more than one helicopter at the top", () => {
    for (let n = 1; n < WANTED.maxStars; n++) {
      const a = rosterOf(n);
      const b = rosterOf(n + 1);
      expect(b.helicopters).toBeGreaterThanOrEqual(a.helicopters);
      expect(b.gunners).toBeGreaterThanOrEqual(a.gunners);
      expect(b.soldiers).toBeGreaterThanOrEqual(a.soldiers);
      expect(b.snowmobiles).toBeGreaterThanOrEqual(a.snowmobiles);
      expect(b.lifted).toBeGreaterThanOrEqual(a.lifted);
      expect(b.balloons).toBeGreaterThanOrEqual(a.balloons);
    }
    expect(rosterOf(5).helicopters).toBeGreaterThan(1);
    // ...soldiers riding the lifts up from three stars, balloons with
    // rocketeers in their baskets from four.
    expect(rosterOf(2).lifted).toBe(0);
    expect(rosterOf(3).lifted).toBeGreaterThan(0);
    expect(rosterOf(3).balloons).toBe(0);
    expect(rosterOf(4).balloons).toBeGreaterThan(0);
    expect(rosterOf(5).rocketeers).toBeGreaterThan(rosterOf(4).rocketeers);
    expect(rosterOf(3).paramotors).toBe(0);
    expect(rosterOf(4).paramotors).toBeGreaterThan(0);
    expect(rosterOf(0).helicopters).toBe(0);
  });

  it("grows each star's waves of men on foot, up to its cap", () => {
    expect(groundWave(1, 0)).toBeNull();
    const first = groundWave(5, 0)!;
    const later = groundWave(5, 4)!;
    expect(later.foot).toBeGreaterThan(first.foot);
    expect(first.tanks).toBeGreaterThan(0);
    expect(groundWave(5, 1000)!.foot).toBe(WANTED.waves[5]!.cap.foot);
  });

  it("counts the waves sent from when the star was reached", () => {
    const s = ride({ wanted: 5 });
    const w = s.wanted!;
    const row = WANTED.waves[5]!;
    expect(wavesSent(w, s.t + row.first - 1)).toBe(0);
    expect(wavesSent(w, s.t + row.first + 1)).toBe(1);
    expect(wavesSent(w, s.t + row.first + row.every * 2 + 1)).toBe(3);
  });
});
