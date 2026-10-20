// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S PARAMOTORS AND BALLOONS (`engine/game/army-air.ts`,
// `army-para.ts`, `army-balloon.ts`, `army-burst.ts`): both flown in off the
// wanted level's roster and none below it, flown without one lost to the
// snow or a crown, the rockets fired and only warning bursts with SAFE FOR
// WORK on, a burst knocking out one of the army's own vehicles, a stolen
// helicopter's wash bringing a paramotor down and its soldier fighting on
// on foot — and nothing drawn from the run's stream.

import { describe, expect, it } from "vitest";

import {
  ARMY_AIR,
  ARMY_VEHICLE,
  NEUTRAL_INPUT,
  TUNING,
  WANTED,
  WEAPONS,
  airWanted,
  armyBalloons,
  armyParas,
  armyTroops,
  armyVehicles,
  burstOnArmy,
  callVehicles,
  createGame,
  setWanted,
  step,
  type ArmyAirEvent,
  type BlastDef,
  type GameEvent,
  type GameState,
  type GunfireEvent,
  type Level,
  type WantedRoster,
  type WaveMix,
} from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const dt = TUNING.dt;
const level = levelFor(LEVEL_SEEDS[1]);
const flat = flatLevel({ size: 2400 });

/** THE AIR ALONE: the roster's door gunners, soldiers, lifted men and
 * snowmobiles held and no ground wave sent. Put back as they were. */
function airAlone<T>(fn: () => T): T {
  const rows = WANTED.roster as WantedRoster[];
  const kept = rows.map((r) => ({ ...r }));
  const waveRows = WANTED.waves as (typeof WANTED.waves)[number][];
  const keptWaves = waveRows.slice();
  for (const r of rows) {
    r.gunners = 0;
    r.soldiers = 0;
    r.lifted = 0;
    r.snowmobiles = 0;
  }
  waveRows.fill(null);
  try {
    return fn();
  } finally {
    kept.forEach((r, i) => Object.assign(rows[i], r));
    keptWaves.forEach((r, i) => (waveRows[i] = r));
  }
}

function hunted(on: Level, stars: number, sfw = false, heli = false): GameState {
  const s = createGame({
    level: on,
    mode: "free",
    quiet: true,
    crowd: 0,
    gore: !sfw,
    sfw,
    ...(heli ? { heli: true } : {}),
  });
  setWanted(s, stars);
  step(s, NEUTRAL_INPUT);
  return s;
}

function run(s: GameState, seconds: number, each?: (s: GameState) => boolean | void): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < seconds / dt; i++) {
    step(s, NEUTRAL_INPUT);
    out.push(...s.events);
    if (each?.(s)) break;
  }
  return out;
}

const said = (events: GameEvent[], change: ArmyAirEvent["change"]) =>
  events.filter((e): e is ArmyAirEvent => e.kind === "army-air" && e.change === change);
const rocketBlasts = (events: GameEvent[]) =>
  events.filter(
    (e): e is GunfireEvent => e.kind === "gunfire" && e.phase === "blast" && e.weapon === "rocket",
  );

describe("the roster", () => {
  it("names both at five stars and neither below the stars that bring them", () => {
    const top = WANTED.roster[5]!;
    expect(top.paramotors).toBeGreaterThan(0);
    expect(top.balloons).toBeGreaterThan(0);
    expect(top.rocketeers).toBeGreaterThan(0);
    for (const n of [1, 2]) {
      expect(WANTED.roster[n]!.paramotors).toBe(0);
      expect(WANTED.roster[n]!.balloons).toBe(0);
    }
  });

  it("grows with the time he lasts, to its caps", () => {
    const s = hunted(flat, 5);
    const w = s.wanted!;
    const now = airWanted(s, w);
    w.reached[5] = s.t - ARMY_AIR.grow.every * 20;
    const later = airWanted(s, w);
    expect(later.paramotors).toBeGreaterThan(now.paramotors);
    expect(later.paramotors).toBeLessThanOrEqual(ARMY_AIR.grow.paramotors);
    expect(later.balloons).toBeLessThanOrEqual(ARMY_AIR.grow.balloons);
  });
});

describe("the hunt", () => {
  it("flies both in at five stars and loses none to the snow or a crown", () => {
    airAlone(() => {
      const s = hunted(level, 5);
      let paras = 0;
      let balloons = 0;
      const events = run(s, 110, (st) => {
        paras = Math.max(paras, armyParas(st).filter((p) => p.mode === "fly").length);
        balloons = Math.max(balloons, armyBalloons(st).filter((m) => m.mode === "fly").length);
        for (const p of armyParas(st))
          if (p.mode === "fly") expect(p.y - level.groundAt(p.x, p.z)).toBeGreaterThan(0);
      });
      expect(paras).toBeGreaterThan(0);
      expect(balloons).toBeGreaterThan(0);
      expect(said(events, "crash")).toHaveLength(0);
      const air = s.army!.air!;
      expect(air.parasLost + air.balloonsLost).toBe(0);
      expect(air.rockets).toBeGreaterThan(0);
      expect(said(events, "fire").length).toBeGreaterThan(0);
    });
  });

  it("calls none below the stars that bring them", () => {
    airAlone(() => {
      const s = hunted(flat, 2);
      run(s, 40);
      expect(armyParas(s)).toHaveLength(0);
      expect(armyBalloons(s)).toHaveLength(0);
    });
  });

  it("bursts its rockets only wide of him with SAFE FOR WORK on, and never throws him", () => {
    airAlone(() => {
      const s = hunted(level, 5, true);
      let near = 0;
      const events = run(s, 110, (st) => {
        for (const b of rocketBlasts(st.events))
          if (Math.hypot(b.x - st.skier.x, b.z - st.skier.z) < (WEAPONS.rocket as BlastDef).throw)
            near++;
      });
      expect(rocketBlasts(events).length).toBeGreaterThan(0);
      expect(near).toBe(0);
      expect(events.some((e) => e.kind === "wipeout" && e.cause === "blast")).toBe(false);
      // Not a round in him either: warning fire only.
      expect(s.gunfire?.hits ?? 0).toBe(0);
    });
  });
});

describe("a burst among the army's own", () => {
  it("knocks out a vehicle near it, which burns and is gone", () => {
    airAlone(() => {
      const s = hunted(flat, 5);
      const c = s.skier;
      const down = [];
      const path = [];
      for (let d = 0; d <= 400; d += 8) {
        down.push({ x: c.x + d, z: c.z, w: 12 });
        path.push(d);
      }
      const mix: WaveMix = { snowmobiles: 0, foot: 0, tracked: 1, trucks: 0, tanks: 0 };
      callVehicles(s, s.army!, s.wanted!, mix, 0, down, path, 0, []);
      run(s, 8);
      const v = armyVehicles(s)[0];
      expect(v.mode).not.toBe("wreck");
      const events: GameEvent[] = [];
      burstOnArmy(s, v.x + 2, v.y + 1, v.z, events);
      expect(v.mode).toBe("wreck");
      expect(s.army!.air!.knocked).toBe(1);
      expect(events.some((e) => e.kind === "army-vehicle" && e.change === "wreck")).toBe(true);
      run(s, ARMY_VEHICLE.wreck + 1);
      expect(armyVehicles(s).some((x) => x.id === v.id && x.mode !== "gone")).toBe(false);
    });
  });
});

describe("the stolen helicopter", () => {
  it("brings a paramotor down in its wash, and its soldier fights on on foot", () => {
    airAlone(() => {
      const s = hunted(level, 5, true, true);
      run(s, 60, (st) => armyParas(st).some((p) => p.mode === "fly" && p.t > 5));
      const p = armyParas(s).find((x) => x.mode === "fly")!;
      expect(p).toBeDefined();
      const h = s.heli!;
      expect(h.rider).toBe(true);
      // Hold the helicopter over the wing, its wash down on it.
      const events = run(s, 3, () => {
        const w = p.wing;
        h.x = w.x;
        h.z = w.z;
        h.y = w.y + 6;
        h.vx = h.vy = h.vz = 0;
        return p.mode !== "fly";
      });
      expect(p.mode).toBe("fall");
      expect(said(events, "downed")).toHaveLength(1);
      expect(p.reserve).toBe(true);
      // Under the reserve to the snow, then a soldier on his feet.
      h.y = level.groundAt(h.x, h.z) + 400;
      run(s, 60, () => p.mode === "gone");
      expect(armyTroops(s).some((m) => m.from === "air")).toBe(true);
    });
  });
});

describe("determinism", () => {
  it("flies the same the same twice, and draws nothing from the run's stream", () => {
    airAlone(() => {
      const go = (stars: number) => {
        const s = hunted(flat, stars);
        run(s, 50);
        return s;
      };
      const a = go(5);
      const b = go(5);
      const sig = (s: GameState) =>
        [
          ...armyParas(s).map(
            (p) => `p${p.id}:${p.mode}:${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`,
          ),
          ...armyBalloons(s).map(
            (m) => `b${m.id}:${m.mode}:${m.body.x.toFixed(4)},${m.body.y.toFixed(4)}`,
          ),
        ].join("|");
      expect(sig(a).length).toBeGreaterThan(0);
      expect(sig(a)).toBe(sig(b));
      // Two stars fly none of it; the stream is where it would have been.
      const none = go(2);
      expect(a.rng.next()).toBe(none.rng.next());
    });
  });
});
