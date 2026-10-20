// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTERS IN FLIGHT (`army.ts`): absent until a hunt sends
// them, called in from the map's edge after the crew's scramble, the
// pylon turn held off a man standing still with the gunner's door toward
// him, never under the snow or the crowns, written into the wanted
// level's pursuers, the search round where he was last seen and the way
// home once the stars are lost, SAFE FOR WORK never wounding him, a ram
// bringing one down, and the same run flown the same twice.

import { describe, expect, it } from "vitest";

import {
  ARMY,
  ARMY_HELI,
  NEUTRAL_INPUT,
  TUNING,
  WANTED,
  armyHelis,
  botInput,
  createGame,
  pilotInput,
  setWanted,
  step,
  treesNear,
  type ArmyHeli,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

const level = syntheticLevel();
const dt = TUNING.dt;

function hunted(
  stars: number,
  extra: { sfw?: boolean; gore?: boolean; heli?: boolean } = {},
): GameState {
  const s = createGame({ level, mode: "free", quiet: true, crowd: 0, ...extra });
  if (!extra.heli) setWanted(s, stars);
  return s;
}

/** Step `seconds`, the input from `drive`, every event kept. */
function run(
  s: GameState,
  seconds: number,
  drive: (s: GameState) => SkierInput = () => NEUTRAL_INPUT,
): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < seconds / dt; i++) {
    step(s, drive(s));
    out.push(...s.events);
  }
  return out;
}

const hunting = (s: GameState): ArmyHeli[] => armyHelis(s).filter((h) => h.phase === "hunt");

/** The machines called with nobody aboard to put down, so a hunt whose heat
 * climbs past one star keeps them in the air (the landings are
 * `army_ground_test.ts`'s). */
function noMen(s: GameState): GameState {
  step(s, NEUTRAL_INPUT);
  // Every machine called, the ones still on their way in included.
  for (const h of s.army!.helis) h.aboard = 0;
  return s;
}

describe("absent until a hunt sends them", () => {
  it("never makes the army's air on a run nobody hunts", () => {
    const s = createGame({ level, mode: "free", quiet: true, crowd: 0 });
    run(s, 20, botInput);
    expect(s.army).toBeUndefined();
    expect(s.gunfire).toBeUndefined();
  });
});

describe("the call", () => {
  it("comes in over the map's edge after the crew's scramble, more machines for more stars", () => {
    for (const stars of [1, 4, 5]) {
      const s = hunted(stars);
      const events = run(s, ARMY.respond + ARMY.stagger * 3 + 1);
      const army = events.flatMap((e) => (e.kind === "army" ? [e] : []));
      const called = army.filter((e) => e.change === "called");
      const arrived = army.filter((e) => e.change === "arrived");
      const want = WANTED.roster[stars].helicopters;
      expect(called.length).toBe(want);
      expect(arrived.length).toBe(want);
      for (const e of arrived) {
        expect(e.t).toBeGreaterThanOrEqual(ARMY.respond);
        // On the edge, the inset in from it.
        const edge = Math.min(e.x, e.z, level.size - e.x, level.size - e.z);
        expect(edge).toBeCloseTo(ARMY.inset, 0);
      }
    }
  });
});

describe("the hunt", () => {
  it("holds a pylon turn off a man standing still, the gunner's door toward him", () => {
    const s = noMen(hunted(1));
    run(s, 40);
    const R = ARMY.orbit.radius;
    let samples = 0;
    let onCircle = 0;
    let doorToward = 0;
    for (let i = 0; i < 20 / dt; i++) {
      step(s, NEUTRAL_INPUT);
      if (i % 12) continue;
      const h = hunting(s)[0];
      const c = s.skier;
      const d = Math.hypot(h.x - c.x, h.z - c.z);
      samples++;
      if (d > 0.75 * R && d < 1.25 * R) onCircle++;
      // The bearing to him off the nose: square out of the inward door.
      const off = Math.atan2(c.x - h.x, c.z - h.z) - h.heading;
      const side = Math.sin(off);
      if (side * h.dir > 0.85) doorToward++;
    }
    expect(onCircle / samples).toBeGreaterThan(0.9);
    expect(doorToward / samples).toBeGreaterThan(0.8);
  });

  it("is never under the floor over the snow, nor into the crowns, hunting a skier at five stars", () => {
    const s = hunted(5);
    const trunks: number[] = [];
    let flown = 0;
    for (let i = 0; i < 120 / dt; i++) {
      step(s, botInput(s));
      for (const h of hunting(s)) {
        flown++;
        expect(h.y - level.groundAt(h.x, h.z)).toBeGreaterThanOrEqual(ARMY.terrain.floor - 1e-6);
        for (const k of treesNear(level, h.x, h.z, ARMY_HELI.rotor.radius, trunks)) {
          const t = level.trees[k];
          expect(h.y).toBeGreaterThan(t.y + t.height);
        }
      }
    }
    expect(flown).toBeGreaterThan(1000);
  });

  it("writes every machine and every gunner in an open door into the pursuers", () => {
    const s = noMen(hunted(2));
    run(s, 45);
    const w = s.wanted!;
    const helis = hunting(s);
    expect(helis.length).toBe(1);
    const h = helis[0];
    const mine = w.pursuers.filter((p) => p.id >= ARMY.ids.pursuer);
    expect(mine.find((p) => p.kind === "helicopter")).toMatchObject({ x: h.x, z: h.z });
    const open = (h.doors.r > 0.5 ? 1 : 0) + (h.doors.l > 0.5 ? 1 : 0);
    expect(open).toBeGreaterThan(0);
    expect(mine.filter((p) => p.kind === "gunner").length).toBe(open);
  });

  it("searches round where he was last seen, then turns for home once the stars are lost", () => {
    const s = hunted(3);
    run(s, 40);
    const w = s.wanted!;
    // Out of every eye from here: the look put off, the fix spent.
    const at = { x: s.skier.x + 150, y: s.skier.y, z: s.skier.z - 100 };
    w.seen = false;
    w.fix = 0;
    w.look = 1e9;
    w.lastSeen = at;
    const r = ARMY.search.share * WANTED.searchRadius[3];
    const events: GameEvent[] = [];
    let near = 0;
    let n = 0;
    for (let i = 0; i < (WANTED.lose[3] + 1) / dt; i++) {
      step(s, NEUTRAL_INPUT);
      events.push(...s.events);
      const h = armyHelis(s)[0];
      if (i > 12 / dt && h.phase === "hunt") {
        n++;
        if (Math.abs(Math.hypot(h.x - at.x, h.z - at.z) - r) < 0.35 * r) near++;
      }
    }
    expect(n).toBeGreaterThan(0);
    expect(near / n).toBeGreaterThan(0.7);
    expect(events.some((e) => e.kind === "wanted" && e.change === "lost")).toBe(true);
    expect(events.some((e) => e.kind === "army" && e.change === "leaving")).toBe(true);
    // Doors shut, guns put away, and gone over the edge.
    const left = run(s, 120);
    expect(left.some((e) => e.kind === "army" && e.change === "gone")).toBe(true);
    expect(armyHelis(s)).toHaveLength(0);
  });

  it("does not let a search run out before the first machine has reached it", () => {
    const s = hunted(1);
    const events = run(s, ARMY.respond + 2);
    expect(events.some((e) => e.kind === "wanted" && e.change === "lost")).toBe(false);
    expect(s.wanted!.stars).toBe(1);
  });
});

describe("the guns", () => {
  it("fires at a man with SAFE FOR WORK on and never wounds him", () => {
    const s = hunted(5, { sfw: true });
    run(s, 90, botInput);
    expect(s.gunfire!.fired).toBeGreaterThan(20);
    expect(s.gunfire!.hits).toBe(0);
    expect(s.skier.body.injuries).toHaveLength(0);
  });

  it("holds its fire at one star", () => {
    const s = hunted(1);
    run(s, 40);
    expect(s.gunfire?.fired ?? 0).toBe(0);
  });

  it("shoots to kill from three stars with the INJURIES switch on", () => {
    const s = hunted(3, { gore: true });
    run(s, 90);
    expect(s.gunfire!.fired).toBeGreaterThan(0);
    expect(s.gunfire!.hits).toBeGreaterThan(0);
  });
});

describe("the ram", () => {
  it("brings theirs down and his with it, and is an offence", () => {
    const s = createGame({ level, mode: "free", quiet: true, crowd: 0, heli: true, gore: true });
    run(s, 4, (r) => pilotInput(r, { x: r.heli!.x, z: r.heli!.z, height: 60 }));
    setWanted(s, 2);
    run(s, 40, (r) => pilotInput(r, { x: r.heli!.x, z: r.heli!.z, height: 60 }));
    const h = hunting(s)[0];
    const p = s.heli!;
    // Into its disc.
    p.x = h.x + 3;
    p.z = h.z;
    p.y = h.y + ARMY_HELI.rotor.hub - 3;
    const events = run(s, 20);
    expect(events.some((e) => e.kind === "army" && e.change === "rammed")).toBe(true);
    expect(events.some((e) => e.kind === "army" && e.change === "down")).toBe(true);
    expect(events.some((e) => e.kind === "heli" && e.phase === "crash")).toBe(true);
    expect(s.army!.downed).toBe(1);
    expect(s.wanted!.peak).toBeGreaterThanOrEqual(3);
  });
});

describe("determinism", () => {
  it("flies the same hunt the same twice, off a stream of its own", () => {
    const a = hunted(4, { gore: true });
    const b = hunted(4, { gore: true });
    const rngA = a.rng;
    run(a, 60, botInput);
    run(b, 60, botInput);
    expect(JSON.stringify(a.army)).toBe(JSON.stringify(b.army));
    expect(a.gunfire!.fired).toBe(b.gunfire!.fired);
    expect(a.rng).toBe(rngA);
  });
});
