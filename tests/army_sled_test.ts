// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY ON SNOWMOBILES (`army-sled.ts`): absent below the roster's
// stars and on a run nobody hunts; called out of the village at four
// stars, two up, a driver and a gunner; driving the real map without
// sticking or meeting a trunk; the gunner's light machine gun fired from a
// short halt; SAFE FOR WORK never wounding him and the crew getting off to
// arrest him; the crew knocked off by the player, which is an offence; the
// machine left standing taken with the machine press, which is another;
// and the same hunt run the same twice, drawing nothing from the run's
// stream.

import { describe, expect, it } from "vitest";

import {
  ARMY_SLED,
  NEUTRAL_INPUT,
  TUNING,
  WANTED,
  WEAPONS,
  armySleds,
  arrestedOf,
  botInput,
  createGame,
  sledPad,
  sledPoint,
  setWanted,
  standSkier,
  stealWithin,
  step,
  type GameEvent,
  type GameState,
} from "@engine";
import { levelFor } from "./support/levels.ts";

const dt = TUNING.dt;
const level = levelFor(38);

function hunted(stars: number, sfw = false): GameState {
  const s = createGame({ level, seed: 38, mode: "free", quiet: true, crowd: 0, gore: !sfw, sfw });
  // Off the start and down the hill a little before the hunt is raised.
  for (let i = 0; i < 4 / dt; i++) step(s, botInput(s));
  setWanted(s, stars);
  return s;
}

/** Step `seconds` standing still, every event kept. */
function run(s: GameState, seconds: number, until?: (s: GameState) => boolean): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < seconds / dt; i++) {
    step(s, NEUTRAL_INPUT);
    out.push(...s.events);
    if (until?.(s)) break;
  }
  return out;
}

const sledEvents = (events: GameEvent[], change: string) =>
  events.filter((e) => e.kind === "army-sled" && e.change === change);

describe("the roster", () => {
  it("sends no snowmobile on a run nobody hunts, nor below three stars", () => {
    const quiet = createGame({ level, seed: 38, mode: "free", quiet: true, crowd: 0 });
    run(quiet, 30);
    expect(quiet.army).toBeUndefined();
    const two = hunted(2);
    run(two, 60);
    expect(two.army!.sleds.length).toBe(0);
    expect(armySleds(two).length).toBe(0);
  });

  it("calls them out of the village at four stars, each two up", () => {
    const s = hunted(4);
    const events = run(s, 60, (st) => armySleds(st).filter((m) => m.mode === "drive").length >= 2);
    const out = armySleds(s).filter((m) => m.mode === "drive");
    expect(out.length).toBe(WANTED.roster[4].snowmobiles);
    for (const m of out) {
      expect(m.driver && m.gunner).toBe(true);
      expect(m.body.running).toBe(true);
    }
    expect(sledEvents(events, "out").length).toBe(out.length);
    // Each from its own place in the village, apart from the others.
    const a = sledPad(level, 0);
    const b = sledPad(level, 1);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(ARMY_SLED.apart);
  });
});

describe("on the snow", () => {
  it("drives the real map after him without sticking or meeting a trunk", () => {
    const s = hunted(5, true);
    let closest = Infinity;
    let n = 0;
    const events = run(s, 120, (st) => {
      // Looked at every twentieth of a second (under a metre at its pace).
      if (n++ % 6 !== 0) return st.wanted!.ended !== null;
      for (const m of armySleds(st)) {
        if (m.mode !== "drive") continue;
        for (const t of st.level.trees) {
          const d = Math.hypot(t.x - m.body.x, t.z - m.body.z) - t.radius;
          if (d < closest) closest = d;
        }
      }
      return st.wanted!.ended !== null;
    });
    expect(sledEvents(events, "out").length).toBeGreaterThan(0);
    // Its middle never inside a trunk; dug out of the snow seldom if ever.
    expect(closest).toBeGreaterThan(0.3);
    expect(sledEvents(events, "dug").length).toBeLessThanOrEqual(1);
  });
});

describe("the gunner", () => {
  it("fires a light machine gun from a short halt, stopped", () => {
    expect(WEAPONS.lmg.range).toBeGreaterThan(ARMY_SLED.halt.range);
    // The snowmobiles alone: the roster's other men held back for the run.
    const row = WANTED.roster[3] as { gunners: number; soldiers: number; lifted: number };
    const kept = { ...row };
    row.gunners = row.soldiers = row.lifted = 0;
    let fired = -1;
    let events: GameEvent[] = [];
    try {
      const s = hunted(3);
      events = run(s, 180, (st) => {
        const shot = st.events.some(
          (e) => e.kind === "gunfire" && e.phase === "shot" && e.weapon === "lmg",
        );
        const m = armySleds(st).find((k) => k.mode === "halt");
        if (shot && m) fired = m.body.speed;
        return fired >= 0;
      });
    } finally {
      Object.assign(row, kept);
    }
    expect(sledEvents(events, "halt").length).toBeGreaterThan(0);
    expect(fired).toBeGreaterThanOrEqual(0);
    expect(fired).toBeLessThan(ARMY_SLED.halt.still);
  });
});

describe("safe for work", () => {
  it("never wounds him; the crew get off and arrest him", () => {
    const s = hunted(3, true);
    const events = run(s, 240, (st) => (arrestedOf(st) ?? 0) > 2);
    expect(events.filter((e) => e.kind === "gunfire" && e.phase === "hit").length).toBe(0);
    expect(s.wanted!.ended).toBe("arrested");
    expect(s.army!.sleds.some((m) => m.mode === "empty" || !m.driver || !m.gunner)).toBe(true);
  });
});

describe("body on machine", () => {
  it("knocks the crew off when the player skis into them, raising the heat; the machine left empty", () => {
    const s = hunted(4, true);
    run(s, 60, (st) => armySleds(st).some((m) => m.mode === "drive" && m.t > 2));
    const m = armySleds(s).find((k) => k.mode === "drive")!;
    const at = sledPoint(m.body, ARMY_SLED.seats.driver);
    const c = s.skier;
    const fx = Math.sin(m.body.heading + Math.PI / 2);
    const fz = Math.cos(m.body.heading + Math.PI / 2);
    c.x = at.x - fx * 1.2;
    c.z = at.z - fz * 1.2;
    c.y = level.groundAt(c.x, c.z) + c.spec.cogHeight;
    c.vx = fx * 12 + m.body.vx;
    c.vz = fz * 12 + m.body.vz;
    c.vy = 0;
    const heat = s.wanted!.heat;
    const events = run(s, 0.3);
    expect(sledEvents(events, "knocked").length).toBe(1);
    expect(s.army!.crewsDown).toBeGreaterThan(0);
    expect(s.wanted!.heat).toBeGreaterThan(heat);
    expect(s.army!.sleds.find((k) => k.id === m.id)!.mode).toBe("empty");
  });
});

describe("taken", () => {
  it("is his with the machine press, in the army's livery, and raises the heat", () => {
    const s = hunted(3, true);
    run(s, 60, (st) => armySleds(st).some((m) => m.mode === "drive"));
    const m = s.army!.sleds.find((k) => k.mode === "drive")!;
    // Left standing where it is, its crew gone off it.
    m.mode = "empty";
    m.driver = false;
    m.gunner = false;
    m.body.vx = m.body.vy = m.body.vz = 0;
    m.body.speed = 0;
    m.body.running = false;
    m.body.rider = false;
    s.wanted!.ended = null;
    standSkier(s, m.body.x + 1.2 * Math.cos(m.body.heading), m.body.z - 1.2 * Math.sin(m.body.heading), m.body.heading);
    expect(stealWithin(s)?.livery).toBe("army");
    const heat = s.wanted!.heat;
    const events = run(s, dt, undefined);
    step(s, { ...NEUTRAL_INPUT, machine: true });
    events.push(...s.events);
    expect(s.sled!.livery).toBe("army");
    expect(s.sled!.rider).toBe(true);
    expect(s.army!.sleds.some((k) => k.id === m.id && k.mode !== "gone")).toBe(false);
    expect(s.army!.sledsTaken).toBe(1);
    expect(s.wanted!.heat).toBeGreaterThan(heat);
    expect(sledEvents(events, "stolen").length).toBe(1);
  });
});

describe("determinism", () => {
  it("runs the same hunt the same twice, and draws nothing from the run's stream", () => {
    const a = hunted(4, true);
    const b = hunted(4, true);
    // The same hunt with its snowmobiles never called.
    const none = hunted(4, true);
    step(none, NEUTRAL_INPUT);
    none.army!.sleds.length = 0;
    const r4 = WANTED.roster[4].snowmobiles;
    (WANTED.roster[4] as { snowmobiles: number }).snowmobiles = 0;
    run(none, 60 - dt);
    (WANTED.roster[4] as { snowmobiles: number }).snowmobiles = r4;
    run(a, 60);
    run(b, 60);
    const sig = (s: GameState) =>
      armySleds(s)
        .map((m) => `${m.id}:${m.mode}:${m.body.x.toFixed(4)},${m.body.z.toFixed(4)}`)
        .join("|");
    expect(sig(a)).toBe(sig(b));
    expect(sig(a).length).toBeGreaterThan(0);
    expect(armySleds(none).length).toBe(0);
    expect(a.rng.next()).toBe(none.rng.next());
  });
});
