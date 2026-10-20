// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND WAVES' VEHICLES (`engine/game/army-vehicle.ts`): the carriers,
// trucks and tanks a wave brings — called with their wave and driven up the
// mountain without one stuck, their men put down to go after him, the tank's
// main gun fired through the blast layer (and only warning shots with SAFE
// FOR WORK on), the tank running a man down and over him with the INJURIES
// on, bounded in number, sent home once the hunt is over, and drawing
// nothing from the run's stream.

import { describe, expect, it } from "vitest";

import {
  ARMY_VEHICLE,
  NEUTRAL_INPUT,
  TUNING,
  VEHICLE_SQUAD,
  WANTED,
  armyTroops,
  armyVehicles,
  callVehicles,
  createGame,
  groundWave,
  setWanted,
  step,
  type ArmyVehicleEvent,
  type GameEvent,
  type GameState,
  type GunfireEvent,
  type WantedRoster,
  type WaveMix,
} from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const dt = TUNING.dt;
const level = levelFor(LEVEL_SEEDS[1]);
const flat = flatLevel({ size: 2400 });

/** THE ARMY HELD BACK but for what a test reads: the roster's door
 * gunners, soldiers, lifted men and snowmobiles held, its fire set to
 * `fire`, and — `waves` false — no ground wave sent on its own. Put back
 * as they were. */
function vehiclesAlone<T>(fn: () => T, fire: WantedRoster["fire"] = "aim", waves = true): T {
  const rows = WANTED.roster as WantedRoster[];
  const kept = rows.map((r) => ({ ...r }));
  const waveRows = WANTED.waves as (typeof WANTED.waves)[number][];
  const keptWaves = waveRows.slice();
  const keptSleds = waveRows.map((r) => (r ? { ...r.cap } : null));
  for (const r of rows) {
    r.gunners = 0;
    r.soldiers = 0;
    r.lifted = 0;
    r.snowmobiles = 0;
    if (r.fire !== "hold") r.fire = fire;
  }
  for (const r of waveRows) if (r) (r.cap as WaveMix).snowmobiles = 0;
  if (!waves) waveRows.fill(null);
  try {
    return fn();
  } finally {
    kept.forEach((r, i) => Object.assign(rows[i], r));
    keptWaves.forEach((r, i) => (waveRows[i] = r));
    keptSleds.forEach((c, i) => c && Object.assign(waveRows[i]!.cap, c));
  }
}

function hunted(on: typeof level, stars: number, sfw = false): GameState {
  const s = createGame({ level: on, mode: "free", quiet: true, crowd: 0, gore: !sfw, sfw });
  setWanted(s, stars);
  step(s, NEUTRAL_INPUT);
  return s;
}

/** Step `seconds` stood still, every event kept; `each` sees every step. */
function run(s: GameState, seconds: number, each?: (s: GameState) => void): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < seconds / dt; i++) {
    step(s, NEUTRAL_INPUT);
    out.push(...s.events);
    each?.(s);
  }
  return out;
}

const said = (events: GameEvent[], change: ArmyVehicleEvent["change"]) =>
  events.filter((e): e is ArmyVehicleEvent => e.kind === "army-vehicle" && e.change === change);
const blasts = (events: GameEvent[]) =>
  events.filter(
    (e): e is GunfireEvent => e.kind === "gunfire" && e.phase === "blast" && e.weapon === "tankGun",
  );

/** ONE VEHICLE of `kind` brought up a straight way out of him along +x on
 * the flat, `far` m long. */
function bring(s: GameState, kind: "carrier" | "truck" | "tank", far: number): void {
  const c = s.skier;
  const down = [];
  const path = [];
  for (let d = 0; d <= far; d += 8) {
    down.push({ x: c.x + d, z: c.z, w: 12 });
    path.push(d);
  }
  const mix: WaveMix = {
    snowmobiles: 0,
    foot: 0,
    tracked: kind === "carrier" ? 1 : 0,
    trucks: kind === "truck" ? 1 : 0,
    tanks: kind === "tank" ? 1 : 0,
  };
  callVehicles(s, s.army!, s.wanted!, mix, 0, down, path, 0, []);
}

describe("the call", () => {
  it("brings each wave's carriers, trucks and tanks up the way, and drives them without one stuck", () => {
    vehiclesAlone(() => {
      const s = hunted(level, 5);
      const row = WANTED.waves[5]!;
      let most = 0;
      const events = run(s, row.first + 150, (st) => {
        most = Math.max(most, armyVehicles(st).length);
      });
      const mix = groundWave(5, 0)!;
      const out = said(events, "out");
      const kinds = new Set(out.map((e) => e.vehicle));
      expect(said(events, "called").length).toBeGreaterThanOrEqual(
        mix.tracked + mix.trucks + mix.tanks,
      );
      expect(kinds).toEqual(new Set(["carrier", "truck", "tank"]));
      expect(most).toBeLessThanOrEqual(ARMY_VEHICLE.most[5]);
      // Nobody held three windows running.
      expect(said(events, "stuck")).toHaveLength(0);
      for (const v of armyVehicles(s)) {
        expect(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)).toBe(true);
        expect(v.x).toBeGreaterThan(0);
        expect(v.z).toBeLessThan(level.size);
      }
      // ...and their men down off them, after him as soldiers.
      expect(said(events, "drop").length).toBeGreaterThan(0);
      expect(armyTroops(s).some((m) => m.squad >= VEHICLE_SQUAD)).toBe(true);
    });
  });

  it("names none below the stars whose waves bring them", () => {
    for (let n = 0; n < 12; n++) {
      const mix = groundWave(2, n)!;
      expect(mix.tracked + mix.trucks + mix.tanks).toBe(0);
    }
    expect(groundWave(1, 0)).toBeNull();
  });
});

describe("the carrier", () => {
  it("drives at him and puts its section down out of its back", () => {
    vehiclesAlone(
      () => {
        const s = hunted(flat, 5);
        bring(s, "carrier", 400);
        const events = run(s, 60);
        expect(said(events, "drop")).toHaveLength(1);
        const men = armyTroops(s).filter((m) => m.squad >= VEHICLE_SQUAD);
        expect(men.length).toBe(ARMY_VEHICLE.kinds.carrier.seats);
        const v = armyVehicles(s)[0];
        expect(v.mode).toBe("park");
        expect(Math.hypot(v.x - s.skier.x, v.z - s.skier.z)).toBeLessThan(
          ARMY_VEHICLE.drop.carrier + 5,
        );
      },
      "hold",
      false,
    );
  });
});

describe("the tank", () => {
  it("halts and fires its main gun at him, its burst the blast's", () => {
    vehiclesAlone(
      () => {
        const s = hunted(flat, 5);
        bring(s, "tank", 500);
        const events = run(s, 40);
        expect(said(events, "halt").length).toBeGreaterThan(0);
        expect(said(events, "fire").length).toBeGreaterThan(0);
        expect(blasts(events).length).toBeGreaterThan(0);
        // The shell met him: thrown by the blast, or worse.
        expect(s.skier.thrown).toBeTruthy();
      },
      "aim",
      false,
    );
  });

  it("fires only warning shots with SAFE FOR WORK on, well clear of him", () => {
    vehiclesAlone(
      () => {
        const s = hunted(flat, 5, true);
        bring(s, "tank", 500);
        const q = { x: s.skier.x, z: s.skier.z };
        const events = run(s, 40);
        const b = blasts(events);
        expect(b.length).toBeGreaterThan(0);
        for (const e of b)
          expect(Math.hypot(e.x - q.x, e.z - q.z)).toBeGreaterThan(ARMY_VEHICLE.tank.warn.near - 1);
        expect(events.some((e) => e.kind === "gunfire" && e.phase === "hit")).toBe(false);
        expect(s.skier.thrown).toBeFalsy();
      },
      "aim",
      false,
    );
  });

  it("runs a man down near it and goes over him with the INJURIES on", () => {
    vehiclesAlone(
      () => {
        const s = hunted(flat, 5);
        bring(s, "tank", 40);
        const events = run(s, 25);
        expect(said(events, "strike")).toHaveLength(1);
        expect(s.skier.thrown?.cause).toBe("armour");
        expect(s.gore!.mortal).toBeGreaterThanOrEqual(0);
      },
      "hold",
      false,
    );
  });

  it("never runs a man down with SAFE FOR WORK on", () => {
    vehiclesAlone(
      () => {
        const s = hunted(flat, 5, true);
        bring(s, "tank", 40);
        const events = run(s, 25);
        expect(said(events, "strike")).toHaveLength(0);
        expect(s.skier.thrown).toBeFalsy();
      },
      "hold",
      false,
    );
  });
});

describe("home", () => {
  it("drives back down and off the map once the hunt is over", () => {
    vehiclesAlone(
      () => {
        const s = hunted(flat, 5);
        bring(s, "carrier", 300);
        run(s, 40);
        expect(armyVehicles(s)[0]?.mode).toBe("park");
        setWanted(s, 0);
        run(s, ARMY_VEHICLE.leave + 2);
        expect(armyVehicles(s)).toHaveLength(0);
      },
      "hold",
      false,
    );
  });
});

describe("determinism", () => {
  it("drives the same the same twice, and draws nothing from the run's stream", () => {
    vehiclesAlone(
      () => {
        const go = (with_: boolean) => {
          const s = hunted(flat, 5);
          if (with_) {
            bring(s, "tank", 500);
            bring(s, "carrier", 300);
          }
          run(s, 30);
          return s;
        };
        const a = go(true);
        const b = go(true);
        const sig = (s: GameState) =>
          armyVehicles(s)
            .map((v) => `${v.id}:${v.mode}:${v.x.toFixed(4)},${v.z.toFixed(4)},${v.turret.toFixed(4)}`)
            .join("|");
        expect(sig(a).length).toBeGreaterThan(0);
        expect(sig(a)).toBe(sig(b));
        const none = go(false);
        expect(a.rng.next()).toBe(none.rng.next());
      },
      "hold",
      false,
    );
  });
});
