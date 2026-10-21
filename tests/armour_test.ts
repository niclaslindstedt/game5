// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S MACHINES TAKEN (`engine/game/armour.ts`, `army-steal.ts`): a
// carrier, a truck or a tank of the ground waves standing on the snow is
// taken with the machine press at its door — the heat raised, the vehicle
// out of the waves and his — driven on the vehicle's own body (its grade,
// its turn), a tank's turret traversed and its gun fired through the blast
// layer; left with the press and taken back; the hunt's eyes on it as the
// quarry; a round's energy and a burst knocking it out under him. And the
// army's helicopter set down on the snow taken and flown as the run's own
// machine in the army's livery.

import { describe, expect, it } from "vitest";

import {
  ARMOUR,
  ARMY_VEHICLE,
  NEUTRAL_INPUT,
  TUNING,
  WANTED,
  armourDoor,
  armyHeliDoor,
  callVehicles,
  createGame,
  damageMachine,
  freshGunfire,
  quarryOf,
  setWanted,
  standSkier,
  stealWithin,
  step,
  type ArmyVehicle,
  type GameEvent,
  type GameState,
  type GunfireEvent,
  type Level,
  type SkierInput,
  type WantedRoster,
  type WaveMix,
} from "@engine";
import { levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const dt = TUNING.dt;
const flat = flatLevel({ size: 1600 });
const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...NEUTRAL_INPUT, ...o });

/** `j` J of rounds' energy into the vehicle he drives. */
function rounds(s: GameState, j: number): void {
  const g = (s.gunfire ??= freshGunfire(s));
  damageMachine(s, g, "armour", j, false, "lmg", []);
}

/** THE ARMY HELD BACK: no door gunners, soldiers, lifts, snowmobiles, air
 * or waves of its own — only what a test brings. Put back as they were. */
function quiet<T>(fn: () => T): T {
  const rows = WANTED.roster as WantedRoster[];
  const kept = rows.map((r) => ({ ...r }));
  const waveRows = WANTED.waves as (typeof WANTED.waves)[number][];
  const keptWaves = waveRows.slice();
  for (const r of rows) {
    r.gunners = 0;
    r.soldiers = 0;
    r.lifted = 0;
    r.snowmobiles = 0;
    r.paramotors = 0;
    r.balloons = 0;
  }
  waveRows.fill(null);
  try {
    return fn();
  } finally {
    kept.forEach((r, i) => Object.assign(rows[i], r));
    keptWaves.forEach((r, i) => (waveRows[i] = r));
  }
}

function hunted(on: Level, stars: number, sfw = false): GameState {
  const s = createGame({ level: on, mode: "free", quiet: true, crowd: 0, gore: !sfw, sfw });
  setWanted(s, stars);
  step(s, NEUTRAL_INPUT);
  return s;
}

/** ONE VEHICLE of `kind` called and stood where it may be taken, `ahead`
 * m up the strip from him, facing `heading`. */
function standing(
  s: GameState,
  kind: ArmyVehicle["kind"],
  ahead = 30,
  heading = Math.PI / 2,
): ArmyVehicle {
  const c = s.skier;
  const mix: WaveMix = {
    snowmobiles: 0,
    foot: 0,
    tracked: kind === "carrier" ? 1 : 0,
    trucks: kind === "truck" ? 1 : 0,
    tanks: kind === "tank" ? 1 : 0,
  };
  const down = [
    { x: c.x, z: c.z + ahead, w: 12 },
    { x: c.x + 400, z: c.z + ahead, w: 12 },
  ];
  callVehicles(s, s.army!, s.wanted!, mix, 0, down, [0, 400], 0, []);
  const v = s.army!.vehicles.at(-1)!;
  Object.assign(v, {
    mode: kind === "tank" ? "halt" : "park",
    due: 0,
    t: 0,
    x: c.x,
    z: c.z + ahead,
    y: s.level.groundAt(c.x, c.z + ahead),
    heading,
    rear: heading,
    speed: 0,
    aboard: 0,
    next: Infinity,
  });
  return v;
}

/** Him stood at `v`'s door, still. */
function atDoor(s: GameState, v: ArmyVehicle): void {
  const d = armourDoor(v);
  standSkier(s, d.x, d.z, v.heading);
}

function drive(s: GameState, seconds: number, input: SkierInput, out: GameEvent[] = []) {
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    step(s, input);
    out.push(...s.events);
  }
  return out;
}

/** A vehicle taken: the run, the events of the press. */
function taken(kind: ArmyVehicle["kind"], on: Level = flat, sfw = false) {
  const s = hunted(on, 3, sfw);
  const v = standing(s, kind);
  atDoor(s, v);
  const was = s.wanted!.heat;
  const events = drive(s, dt, ask({ machine: true }));
  return { s, v, events, was };
}

describe("the waves' vehicles, taken", () => {
  for (const kind of ["carrier", "truck", "tank"] as const) {
    it(`takes a standing ${kind} at its door with the press, and raises the heat`, () => {
      quiet(() => {
        const s = hunted(flat, 3);
        const v = standing(s, kind);
        // Away from the door, nothing offered.
        expect(stealWithin(s)?.kind).not.toBe(kind);
        atDoor(s, v);
        const offered = stealWithin(s);
        expect(offered?.kind).toBe(kind);
        expect(offered?.livery).toBe("army");
        const heat = s.wanted!.heat;
        const events = drive(s, dt, ask({ machine: true }));
        expect(events.some((e) => e.kind === "steal" && e.vehicle === kind)).toBe(true);
        expect(s.armour?.rider).toBe(true);
        expect(s.armour?.body.kind).toBe(kind);
        expect(s.wanted!.heat).toBeGreaterThan(heat);
        expect(s.wanted!.stars).toBeGreaterThanOrEqual(kind === "tank" ? 4 : 3);
        // Out of the waves: it is his now.
        drive(s, dt, NEUTRAL_INPUT);
        expect(s.army!.vehicles.some((o) => o.id === v.id)).toBe(false);
      });
    });
  }

  it("is not offered while it moves, nor with its men still aboard", () => {
    quiet(() => {
      const s = hunted(flat, 3);
      const v = standing(s, "carrier");
      atDoor(s, v);
      v.speed = 3;
      expect(stealWithin(s)).toBe(null);
      v.speed = 0;
      v.aboard = 4;
      expect(stealWithin(s)).toBe(null);
      v.aboard = 0;
      v.mode = "wreck";
      expect(stealWithin(s)).toBe(null);
    });
  });

  it("puts a halted tank's crew out onto the snow after him", () => {
    quiet(() => {
      const { s } = taken("tank");
      drive(s, dt, NEUTRAL_INPUT);
      expect(s.army!.troops.filter((t) => t.mode !== "dead").length).toBe(ARMOUR.tank.crew);
    });
  });

  for (const kind of ["carrier", "truck", "tank"] as const) {
    it(`drives the ${kind} a distance on its own body, and steers it`, () => {
      quiet(() => {
        const { s } = taken(kind);
        const b = s.armour!.body;
        const x0 = b.x;
        const z0 = b.z;
        drive(s, 20, ask({ tuck: 1 }));
        const far = Math.hypot(b.x - x0, b.z - z0);
        expect(far).toBeGreaterThan(150);
        // Never past his top pace.
        expect(Math.abs(b.speed)).toBeLessThanOrEqual(ARMOUR.top[kind] + 1e-6);
        // Held in the seat: his skis off the snow, with it.
        expect(Math.hypot(s.skier.x - b.x, s.skier.z - b.z)).toBeLessThan(5);
        // The edge turns it.
        const h0 = b.heading;
        drive(s, 3, ask({ tuck: 1, steer: 1 }));
        expect(Math.abs(b.heading - h0)).toBeGreaterThan(0.5);
        // The skid backs it.
        drive(s, 6, ask({ brake: 1 }));
        expect(b.speed).toBeLessThan(0);
      });
    });
  }

  it("holds each to its grade: the truck stopped where the tank climbs on", () => {
    quiet(() => {
      // A slope falling along +z at 45 % from z = 300: up it is −z.
      const steep = flatLevel({ size: 1600, grade: 0.45, slopeFrom: 300 });
      const climbed = (kind: "truck" | "tank"): number => {
        const s = hunted(steep, 3);
        standSkier(s, 800, 700, 0);
        const v = standing(s, kind, 30, Math.PI);
        atDoor(s, v);
        drive(s, dt, ask({ machine: true }));
        const b = s.armour!.body;
        const y0 = b.y;
        drive(s, 25, ask({ tuck: 1 }));
        return b.y - y0;
      };
      expect(ARMY_VEHICLE.kinds.truck.climb).toBeLessThan(0.45);
      expect(ARMY_VEHICLE.kinds.tank.climb).toBeGreaterThan(0.45);
      expect(climbed("truck")).toBeLessThan(2);
      expect(climbed("tank")).toBeGreaterThan(40);
    });
  });

  it("lets him out with the press at a crawl, stands, and takes him back", () => {
    quiet(() => {
      const { s } = taken("carrier");
      drive(s, 3, ask({ tuck: 1 }));
      drive(s, 4, NEUTRAL_INPUT);
      const out = drive(s, dt, ask({ machine: true }));
      expect(out.some((e) => e.kind === "armour" && e.change === "hop")).toBe(true);
      expect(s.armour!.rider).toBe(false);
      expect(s.skier.thrown).toBe(null);
      // The grace after stepping out, then the press at its door again.
      drive(s, 6, NEUTRAL_INPUT);
      atDoor(s, s.armour!.body);
      const back = drive(s, dt, ask({ machine: true }));
      expect(back.some((e) => e.kind === "armour" && e.change === "board")).toBe(true);
      expect(s.armour!.rider).toBe(true);
    });
  });

  it("is the quarry the hunt hunts while he drives it", () => {
    quiet(() => {
      const { s } = taken("truck");
      drive(s, 4, ask({ tuck: 1 }));
      const q = quarryOf(s);
      const b = s.armour!.body;
      expect(Math.hypot(q.x - b.x, q.z - b.z)).toBeLessThan(1e-6);
    });
  });

  it("traverses the tank's turret on the lean and fires its gun on the jump's press", () => {
    quiet(() => {
      const { s } = taken("tank");
      const b = s.armour!.body;
      drive(s, 1, ask({ lean: 1 }));
      expect(Math.abs(b.turret)).toBeGreaterThan(0.3);
      const events = drive(s, dt, ask({ jump: true }));
      drive(s, 4, NEUTRAL_INPUT, events);
      expect(events.some((e) => e.kind === "armour" && e.change === "fire")).toBe(true);
      expect(
        events.some((e) => e.kind === "gunfire" && e.phase === "blast" && e.weapon === "tankGun"),
      ).toBe(true);
      // Held, the key fires once; the gun reloads before the next.
      const more = drive(s, 1, ask({ jump: true }));
      expect(more.some((e) => e.kind === "armour" && e.change === "fire")).toBe(false);
      expect(s.armour!.shots).toBe(1);
    });
  });

  it("lays the tank's gun with the trick key held, and says it is laying", () => {
    quiet(() => {
      const { s } = taken("tank");
      const r = s.armour!;
      const b = r.body;
      drive(s, 0.5, ask({ lean: 1 }));
      expect(r.laying).toBe(false);
      const gun = b.gun;
      drive(s, 1, ask({ trick: true, lean: -1 }));
      expect(r.laying).toBe(true);
      expect(b.gun).toBeGreaterThan(gun);
      drive(s, 0.2, NEUTRAL_INPUT);
      expect(r.laying).toBe(false);
    });
  });

  it("knocks out a wave's vehicle with his shell, aimed down the sight's line", () => {
    quiet(() => {
      const { s } = taken("tank");
      const b = s.armour!.body;
      // A carrier 300 m off along the gun's line.
      const v = standing(s, "carrier", 0);
      v.x = b.x + Math.sin(b.heading) * 300;
      v.z = b.z + Math.cos(b.heading) * 300;
      v.y = s.level.groundAt(v.x, v.z);
      v.mode = "drive";
      v.speed = 0;
      const events = drive(s, dt, ask({ jump: true }));
      drive(s, 3, NEUTRAL_INPUT, events);
      expect(
        events.some((e) => e.kind === "army-vehicle" && e.change === "wreck" && e.id === v.id),
      ).toBe(true);
    });
  });

  it("fires his own gun where he lays it even with SAFE FOR WORK on", () => {
    quiet(() => {
      const { s } = taken("tank", flat, true);
      const b = s.armour!.body;
      b.gun = -0.05;
      const events = drive(s, dt, ask({ jump: true }));
      drive(s, 3, NEUTRAL_INPUT, events);
      const blast = events.find(
        (e): e is GunfireEvent =>
          e.kind === "gunfire" && e.phase === "blast" && e.weapon === "tankGun",
      );
      expect(blast).toBeDefined();
      // Down the line: near its bearing, not off to a warning shot's side.
      const bx = blast!.x - b.x;
      const bz = blast!.z - b.z;
      const off = Math.abs(Math.sin(Math.atan2(bx, bz) - (b.heading + b.turret)));
      expect(off).toBeLessThan(0.1);
    });
  });

  it("is knocked out under him by enough rounds — a carrier, never a tank", () => {
    quiet(() => {
      const c = taken("carrier").s;
      rounds(c, ARMOUR.damage.rounds.carrier * 1.1);
      expect(c.armour!.dead).toBe(true);
      expect(c.armour!.body.mode).toBe("wreck");
      const x0 = c.armour!.body.x;
      drive(c, 3, ask({ tuck: 1 }));
      expect(Math.abs(c.armour!.body.x - x0)).toBeLessThan(0.5);
      const t = taken("tank").s;
      rounds(t, 1e9);
      expect(t.armour!.dead).toBe(false);
    });
  });

  it("draws nothing from the run's stream", () => {
    quiet(() => {
      const { s } = taken("carrier");
      const rng = JSON.stringify(s.rng);
      drive(s, 5, ask({ tuck: 1, steer: 0.4 }));
      expect(JSON.stringify(s.rng)).toBe(rng);
    });
  });
});

describe("the army's helicopter, taken off the snow", () => {
  it("is taken at the pilot's door once it is set down, and flown as the run's own", () => {
    quiet(() => {
      const level = levelFor(38);
      const s = createGame({ level, mode: "free", quiet: true, crowd: 0, gore: true });
      setWanted(s, 3);
      step(s, NEUTRAL_INPUT);
      // One of the hunt's machines set down near him.
      const c = s.skier;
      const m = s.army!.helis[0];
      expect(m).toBeDefined();
      const x = c.x + 30;
      const z = c.z;
      Object.assign(m, { phase: "set", x, z, y: level.groundAt(x, z), vx: 0, vy: 0, vz: 0 });
      Object.assign(m, { pitch: 0, roll: 0, spool: 1 });
      const door = armyHeliDoor(m);
      standSkier(s, door.x, door.z, m.heading);
      const offered = stealWithin(s);
      expect(offered?.kind).toBe("heli");
      expect(offered?.livery).toBe("army");
      const heat = s.wanted!.heat;
      const events = drive(s, dt, ask({ machine: true }));
      expect(events.some((e) => e.kind === "steal" && e.livery === "army")).toBe(true);
      expect(s.heli?.livery).toBe("army");
      expect(s.heli?.rider).toBe(true);
      expect(s.wanted!.stars).toBeGreaterThanOrEqual(4);
      expect(s.wanted!.heat).toBeGreaterThan(heat);
      drive(s, dt, NEUTRAL_INPUT);
      expect(s.army!.helis.some((o) => o.id === m.id)).toBe(false);
      // Flown: the collective up lifts it.
      const y0 = s.heli!.y;
      drive(s, 6, ask({ heli: { collective: 0.9, pitch: 0, roll: 0, pedal: 0 } }));
      expect(s.heli!.y).toBeGreaterThan(y0 + 3);
      // Strapped into the pilot's seat, not sat on a skid: the nose pushed
      // far down puts no load on his hands and never throws him out.
      drive(s, 1.5, ask({ heli: { collective: 1, pitch: 1, roll: 0, pedal: 0 } }));
      expect(s.heli!.pitch).toBeLessThan(-0.5);
      expect(s.heli!.rider).toBe(true);
      expect(s.heli!.load).toBe(0);
    });
  });
});
