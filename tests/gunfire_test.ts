// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GUNFIRE (`gunfire.ts`): the rounds' flight off the weapons' numbers
// (the speed a bullet keeps, its time of flight and drop, the lead on a
// crossing target, a rocket's motor), its own stream (the same run fires
// the same rounds, and nothing draws from `state.rng`), the hits on his
// body part by part as penetrating wounds, death with the INJURIES switch
// on, SAFE FOR WORK never wounding him, a rocket's blast, the stolen
// helicopter shot down, and a run that never arms a gun left as it was.

import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  TUNING,
  WEAPONS,
  INJURIES,
  aimPoint,
  armGun,
  bodyHit,
  bodyPoints,
  createGame,
  energyAt,
  fireAt,
  flightTime,
  speedAt,
  step,
  type GameEvent,
  type GameState,
  type Gun,
  type SkierInput,
  type WeaponKind,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const level = flatLevel();

function ride(extra: { sfw?: boolean; gore?: boolean; wanted?: number } = {}): GameState {
  return createGame({ level, mode: "free", quiet: true, crowd: 0, ...extra });
}

/** A stand-in shooter `d` m in front of him (off to his right by `side`),
 * `up` m over the snow there. */
function shooter(s: GameState, weapon: WeaponKind, d: number, side = 0, up = 1.5, id = 1): Gun {
  const c = s.skier;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const x = c.x + fx * d + fz * side;
  const z = c.z + fz * d - fx * side;
  return armGun(s, id, weapon, x, level.groundAt(x, z) + up, z);
}

/** Step `seconds`, firing `gun` at him whenever it is ready, every event
 * kept. */
function fire(
  s: GameState,
  gun: Gun,
  seconds: number,
  input: SkierInput = NEUTRAL_INPUT,
  rules?: "warn" | "aim",
): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / TUNING.dt); i++) {
    fireAt(s, gun, { kind: "quarry" }, rules);
    step(s, input);
    out.push(...s.events);
  }
  return out;
}

const gunfire = (ev: GameEvent[], phase: string) =>
  ev.filter(
    (e): e is Extract<GameEvent, { kind: "gunfire" }> => e.kind === "gunfire" && e.phase === phase,
  );

describe("the rounds' flight", () => {
  it("keeps a rifle bullet's speed as its range table has it", () => {
    const rifle = WEAPONS.rifle;
    expect(speedAt(rifle, 0)).toBe(930);
    expect(speedAt(rifle, 300)).toBeGreaterThan(610);
    expect(speedAt(rifle, 300)).toBeLessThan(690);
    expect(speedAt(rifle, 500)).toBeGreaterThan(470);
    expect(speedAt(rifle, 500)).toBeLessThan(560);
    // ~1,700 J out of the muzzle, a door gun's twice that, a heavy gun's ten.
    expect(energyAt(rifle, 0)).toBeGreaterThan(1600);
    expect(energyAt(WEAPONS.doorGun, 0)).toBeGreaterThan(3000);
    expect(energyAt(WEAPONS.heavyGun, 0)).toBeGreaterThan(15000);
  });

  it("takes about a third of a second to 300 m, and a rocket about one and a half", () => {
    expect(flightTime(WEAPONS.rifle, 300)).toBeGreaterThan(0.36);
    expect(flightTime(WEAPONS.rifle, 300)).toBeLessThan(0.42);
    expect(flightTime(WEAPONS.rocket, 300)).toBeGreaterThan(1.2);
    expect(flightTime(WEAPONS.rocket, 300)).toBeLessThan(1.8);
  });

  it("leads a crossing target by its way over the time of flight, and holds over for the drop", () => {
    const tg = { x: 0, y: 0, z: 200, vx: 15, vy: 0, vz: 0 };
    const a = aimPoint(WEAPONS.rifle, 0, 0, 0, tg);
    expect(a.x).toBeCloseTo(15 * a.t, 1);
    expect(a.y).toBeCloseTo(0.5 * TUNING.g * a.t * a.t, 3);
    expect(a.y).toBeGreaterThan(0.2);
  });

  it("flies a round down a range into the snow, where it was aimed, and says so", () => {
    const s = ride();
    const c = s.skier;
    // From 60 m up, as off a ridge: the rounds come down steeply enough
    // that a mil of error is a metre or two on the snow, not tens.
    const gun = armGun(s, 1, "rifle", c.x - 5, level.groundAt(c.x, c.z) + 60, c.z + 5);
    const x = c.x + 150;
    const target = { kind: "point" as const, x, y: level.groundAt(x, c.z), z: c.z };
    const ev: GameEvent[] = [];
    expect(fireAt(s, gun, target, "aim")).toBe(true);
    for (let i = 0; i < 120; i++) {
      step(s, NEUTRAL_INPUT);
      ev.push(...s.events);
    }
    const shots = gunfire(ev, "shot");
    const hits = gunfire(ev, "impact");
    expect(shots.length).toBeGreaterThanOrEqual(1);
    expect(hits.length).toBe(shots.length);
    for (const h of hits) {
      expect(h.on).toBe("snow");
      // Within a few metres of the spot at 150 m (the hold's ~2 mil, the
      // climb of a three-round burst).
      expect(Math.hypot(h.x - x, h.z - c.z)).toBeLessThan(8);
    }
  });

  it("fires a door gun's burst at its cyclic rate, a tracer every fourth round", () => {
    const s = ride();
    const gun = shooter(s, "doorGun", 300, 0, 40);
    const ev = fire(s, gun, 0.8, NEUTRAL_INPUT, "warn");
    const shots = gunfire(ev, "shot");
    expect(shots.length).toBeGreaterThanOrEqual(6);
    const gaps = shots.slice(1).map((e, i) => e.t - shots[i].t);
    for (const g of gaps) expect(g).toBeCloseTo(60 / 750, 1);
    expect(shots.filter((e) => e.tracer).length).toBe(Math.floor(shots.length / 4));
  });
});

describe("its own stream", () => {
  it("fires the same rounds on the same run, and draws nothing from the run's stream", () => {
    const go = () => {
      const s = ride();
      const gun = shooter(s, "rifle", 120, 30);
      const ev = fire(s, gun, 4, NEUTRAL_INPUT, "aim");
      return {
        s,
        ev: gunfire(ev, "impact").map((e) => [e.x, e.y, e.z].map((v) => v.toFixed(6)).join()),
      };
    };
    const a = go();
    const b = go();
    expect(a.ev.length).toBeGreaterThan(3);
    expect(a.ev).toEqual(b.ev);
    expect(a.s.gunfire!.stream).toBe(b.s.gunfire!.stream);
    // The run's own stream is where a run that never fired leaves it.
    const quiet = ride();
    for (let i = 0; i < Math.round(4 / TUNING.dt); i++) step(quiet, NEUTRAL_INPUT);
    expect(a.s.rng.next()).toBe(quiet.rng.next());
  });

  it("leaves a run that never arms a gun without one, and fire that misses him moves nothing", () => {
    const a = ride();
    const b = ride();
    const gun = shooter(b, "rifle", 100);
    const c = b.skier;
    const far = { kind: "point" as const, x: c.x + 200, y: level.groundAt(c.x + 200, c.z), z: c.z };
    for (let i = 0; i < 600; i++) {
      step(a, NEUTRAL_INPUT);
      fireAt(b, gun, far, "aim");
      step(b, NEUTRAL_INPUT);
    }
    expect(a.gunfire).toBeUndefined();
    expect(b.gunfire!.fired).toBeGreaterThan(5);
    expect([b.skier.x, b.skier.y, b.skier.z]).toEqual([a.skier.x, a.skier.y, a.skier.z]);
    // One star's rules hold their fire: nothing is fired.
    const held = ride({ wanted: 1 });
    const g = shooter(held, "rifle", 100);
    expect(fireAt(held, g, { kind: "quarry" })).toBe(false);
  });
});

describe("hits on his body", () => {
  it("finds the part a round goes through", () => {
    const s = ride();
    const P = bodyPoints(s);
    const head = [P[12], P[13], P[14]];
    const p = [head[0] - 5, head[1], head[2]];
    const q = [head[0] + 5, head[1], head[2]];
    expect(bodyHit(P, p, q)?.part).toBe("head");
    // The trunk's lower half is the belly; a shin's middle the shin.
    const hips = [(P[0] + P[3]) / 2, (P[1] + P[4]) / 2, (P[2] + P[5]) / 2];
    const sh = [(P[6] + P[9]) / 2, (P[7] + P[10]) / 2, (P[8] + P[11]) / 2];
    const belly = hips.map((v, k) => v + (sh[k] - v) * 0.2);
    expect(
      bodyHit(P, [belly[0] - 5, belly[1], belly[2]], [belly[0] + 5, belly[1], belly[2]])?.part,
    ).toBe("abdomen");
    const knee = [P[15], P[16], P[17]];
    const foot = [P[21], P[22], P[23]];
    const shin = knee.map((v, k) => (v + foot[k]) / 2);
    expect(bodyHit(P, [shin[0] - 5, shin[1], shin[2]], [shin[0] + 5, shin[1], shin[2]])?.part).toBe(
      "shinL",
    );
    // Wide of him, nothing.
    expect(bodyHit(P, [p[0], p[1] + 3, p[2]], [q[0], q[1] + 3, q[2]])).toBe(null);
  });

  it("wounds the part struck with a penetrating wound, the trunk most", () => {
    const s = ride();
    const gun = shooter(s, "rifle", 40);
    const ev = fire(s, gun, 20, NEUTRAL_INPUT, "aim");
    const hits = gunfire(ev, "hit");
    expect(hits.length).toBeGreaterThan(5);
    const injuries = ev.filter((e) => e.kind === "injury");
    expect(injuries.length).toBeGreaterThan(0);
    for (const e of injuries)
      if (e.kind === "injury") expect(INJURIES[e.injury].mech).toBe("pierce");
    const trunk = hits.filter((e) =>
      ["chest", "abdomen", "back", "pelvis"].includes(e.part!),
    ).length;
    expect(trunk / hits.length).toBeGreaterThan(0.3);
  });

  it("kills with the INJURIES switch on: enough hits, and the death is a shooting", () => {
    const s = ride({ gore: true });
    const gun = shooter(s, "doorGun", 60, 0, 10);
    fire(s, gun, 30, NEUTRAL_INPUT, "aim");
    expect(s.gore!.dead).toBeGreaterThanOrEqual(0);
    expect(s.gore!.cause).toBe("shot");
  });

  it("never wounds him with SAFE FOR WORK on: warning fire only, and no rocket at a man on foot", () => {
    const s = ride({ sfw: true, wanted: 5 });
    const gun = shooter(s, "doorGun", 60, 0, 10);
    const ev = fire(s, gun, 20);
    expect(gunfire(ev, "shot").length).toBeGreaterThan(20);
    expect(gunfire(ev, "hit")).toHaveLength(0);
    expect(ev.filter((e) => e.kind === "injury")).toHaveLength(0);
    // Every round went into the snow beside him, never at him.
    const c = s.skier;
    for (const e of gunfire(ev, "impact"))
      expect(Math.hypot(e.x - c.x, e.z - c.z)).toBeGreaterThan(2);
    const tube = shooter(s, "rocket", 80, 0, 1.5, 2);
    expect(fireAt(s, tube, { kind: "quarry" })).toBe(false);
  });

  it("throws him off his feet with a rocket's blast, and tears him apart close in", () => {
    const s = ride({ gore: true });
    const c = s.skier;
    // Fired down from a balloon's basket 40 m up, 120 m off.
    const tube = armGun(s, 3, "rocket", c.x + 120, level.groundAt(c.x + 120, c.z) + 40, c.z);
    const at = { kind: "point" as const, x: c.x, y: level.groundAt(c.x, c.z), z: c.z };
    expect(fireAt(s, tube, at, "aim")).toBe(true);
    const ev: GameEvent[] = [];
    for (let i = 0; i < 4 * 120; i++) {
      step(s, NEUTRAL_INPUT);
      ev.push(...s.events);
    }
    expect(gunfire(ev, "blast")).toHaveLength(1);
    expect(ev.some((e) => e.kind === "wipeout" && e.cause === "blast")).toBe(true);
    expect(s.gore!.lost | s.gore!.open).not.toBe(0);
    expect(s.gore!.mortal).toBeGreaterThanOrEqual(0);
  });
});

describe("the machine he rides", () => {
  it("shoots the stolen helicopter down: smoke, the engine failing, lost, and its own crash", () => {
    const s = createGame({ level, mode: "free", heli: true, crowd: 0, quiet: true, gore: false });
    const hands = (collective: number): SkierInput => ({
      ...NEUTRAL_INPUT,
      heli: { collective, pitch: 0, roll: 0, pedal: 0 },
    });
    for (let i = 0; i < 4 * 120; i++) step(s, hands(0.95));
    expect(s.heli!.rider).toBe(true);
    const h = s.heli!;
    const gun = armGun(s, 9, "doorGun", h.x + 120, h.y + 30, h.z);
    const stages: string[] = [];
    for (let i = 0; i < 90 * 120 && s.heli!.mode !== "wreck"; i++) {
      fireAt(s, gun, { kind: "quarry" }, "aim");
      step(s, hands(0.62));
      for (const e of s.events)
        if (e.kind === "gunfire" && e.phase === "machine" && e.stage !== "hit")
          stages.push(e.stage!);
    }
    expect(stages).toEqual(["smoke", "fail", "lost"]);
    expect(s.heli!.mode).toBe("wreck");
  });
});
