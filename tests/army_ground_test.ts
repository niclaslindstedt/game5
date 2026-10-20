// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY ON THE GROUND (`army-ground.ts`): absent until a hunt asks for
// soldiers; the landing zone flat and clear (or a fast rope where there is
// none); the squad out of the doors and knelt until the machine lifts; the
// chase reaching a man who stands still and the soldiers firing at him;
// the lifts' squads riding a real map's lifts up; SAFE FOR WORK never
// wounding him and ending the run in an arrest that holds him; the player
// knocking a soldier down; and the same hunt run the same twice.

import { describe, expect, it } from "vitest";

import {
  ARMY_GROUND,
  ARMY_HELI,
  NEUTRAL_INPUT,
  TUNING,
  WANTED,
  armyHelis,
  armyTroops,
  arrestedOf,
  createGame,
  placeRun,
  landingSpot,
  leanOver,
  liftPlans,
  setWanted,
  solidsNear,
  step,
  type GameEvent,
  type GameState,
  type Level,
  type TreeDef,
} from "@engine";
import { flatLevel, shapedLevel } from "./support/synthetic.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";
import { withoutWaves } from "./support/waves.ts";

const dt = TUNING.dt;

/** A field of snow, level, nothing standing on it. */
const field = flatLevel({ size: 2000 });

/** The same field with its middle a forest — a trunk every 10 m, too close
 * to set a machine down between, wide enough for a man down a rope. */
function forest(): Level {
  const trees: TreeDef[] = [];
  for (let x = 700; x <= 1300; x += 10)
    for (let z = 100; z <= 1000; z += 10)
      trees.push({ x: x + ((z * 13) % 3), z, y: 0, height: 18, radius: 0.35, crown: 2.5 });
  return shapedLevel(() => 0, { size: 2000, cell: 4, trees });
}

function hunted(level: Level, stars: number, extra: { sfw?: boolean } = {}): GameState {
  const s = createGame({
    level,
    mode: "free",
    quiet: true,
    crowd: 0,
    gore: !extra.sfw,
    sfw: !!extra.sfw,
  });
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

describe("absent until a hunt asks for soldiers", () => {
  it("puts nobody on the ground on a run nobody hunts, nor at one star", () => {
    const quiet = createGame({ level: field, mode: "free", quiet: true, crowd: 0 });
    run(quiet, 30);
    expect(quiet.army).toBeUndefined();
    // One star's machine shadows him and lands nobody — for as long as the
    // heat holds at one star (seen, it climbs to two).
    const one = hunted(field, 1);
    let held = 0;
    run(one, 60, (st) => {
      if (st.wanted!.stars > 1) return true;
      held++;
      expect(armyTroops(st).length).toBe(0);
      expect(armyHelis(st).every((h) => h.task === null)).toBe(true);
      return false;
    });
    expect(held * dt).toBeGreaterThan(10);
  });
});

describe("the landing zone", () => {
  it("is flat enough to set down on and clear of every solid under the disc", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    const s = createGame({ level, mode: "free", quiet: true, crowd: 0 });
    const room = ARMY_HELI.rotor.radius + ARMY_GROUND.land.room;
    let found = 0;
    for (const p of level.track.points.filter((_, i) => i % 150 === 0)) {
      const spot = landingSpot(s, p.x, p.y, p.z, 0, 0, []);
      if (!spot) continue;
      const d = Math.hypot(spot.x - p.x, spot.z - p.z);
      expect(d).toBeGreaterThanOrEqual(ARMY_GROUND.land.near - 1);
      expect(d).toBeLessThanOrEqual(ARMY_GROUND.land.far + 1);
      if (spot.rope) {
        expect(solidsNear(level, spot.x, spot.z, ARMY_GROUND.rope.clear, []).length).toBe(0);
        continue;
      }
      found++;
      expect(leanOver(level, spot.x, spot.z, room)).toBeLessThanOrEqual(ARMY_GROUND.land.slope);
      expect(solidsNear(level, spot.x, spot.z, room, []).length).toBe(0);
    }
    expect(found).toBeGreaterThan(0);
  });

  it("is a fast rope's where the woods leave nowhere to set down", () => {
    const level = forest();
    const s = createGame({ level, mode: "free", quiet: true, crowd: 0 });
    const spot = landingSpot(s, 1000, 0, 550, 0, 0, [], { near: 20, far: 120, prefer: 60 });
    expect(spot).not.toBeNull();
    expect(spot!.rope).toBe(true);
  });
});

describe("the squad out", () => {
  it("lands, puts the roster's men out of the doors, knelt facing out until it lifts", () => {
    const s = hunted(field, 2);
    let knelt = false;
    const events = run(s, 90, (st) => {
      const h = armyHelis(st)[0];
      if (h?.phase === "set" && armyTroops(st).some((m) => m.mode === "out" && m.kneel)) {
        knelt = true;
        // Knelt out of the disc's reach, facing away from the machine.
        for (const m of armyTroops(st).filter((t) => t.kneel)) {
          expect(Math.hypot(m.x - h.x, m.z - h.z)).toBeGreaterThan(ARMY_HELI.body.width / 2 + 3);
          const out = Math.atan2(m.x - h.x, m.z - h.z);
          expect(Math.cos(out - m.heading)).toBeGreaterThan(0.7);
        }
      }
      return st.army!.dropped >= WANTED.roster[2].soldiers && knelt && h?.phase === "hunt";
    });
    expect(knelt).toBe(true);
    const landed = events.filter((e) => e.kind === "army" && e.change === "landed");
    const lifted = events.filter((e) => e.kind === "army" && e.change === "lifted");
    expect(landed.length).toBeGreaterThanOrEqual(1);
    expect(lifted.length).toBeGreaterThanOrEqual(1);
    expect(s.army!.dropped).toBe(WANTED.roster[2].soldiers);
    expect(events.filter((e) => e.kind === "soldier" && e.change === "out").length).toBe(
      WANTED.roster[2].soldiers,
    );
  });

  it("comes down a fast rope over the woods", () => {
    const level = forest();
    const s = createGame({ level, mode: "free", quiet: true, crowd: 0, gore: true });
    // Stood still in the middle of the forest, between its trunks.
    placeRun(s, { x: 1005, z: 555, heading: 0, speed: 0 });
    setWanted(s, 2);
    let roped = false;
    run(s, 120, (st) => {
      if (armyTroops(st).some((m) => m.mode === "rope")) roped = true;
      // Down the rope and onto the snow.
      return roped && armyTroops(st).some((m) => m.mode !== "rope");
    });
    expect(roped).toBe(true);
    const h = armyHelis(s)[0];
    expect(h.task?.rope ?? true).toBe(true);
  });
});

describe("the chase", () => {
  it("reaches a man stood still and fires at him from a stop", () => {
    const s = hunted(field, 3);
    const events = run(s, 150, (st) => (st.gore?.dead ?? -1) >= 0);
    const aims = events.filter((e) => e.kind === "soldier" && e.change === "aim");
    expect(aims.length).toBeGreaterThan(0);
    const shots = events.filter(
      (e) => e.kind === "gunfire" && e.phase === "shot" && e.weapon === "rifle",
    );
    expect(shots.length).toBeGreaterThan(0);
    // Every man still on his feet has closed on him, and none is stuck.
    for (const m of armyTroops(s)) expect(m.slow).toBeLessThan(3);
  });
});

describe("safe for work", () => {
  it("never wounds him, and the soldier who reaches him arrests him and holds him", () => {
    const s = hunted(field, 3, { sfw: true });
    const events = run(s, 200, (st) => (arrestedOf(st) ?? 0) > 3);
    expect(events.filter((e) => e.kind === "gunfire" && e.phase === "hit").length).toBe(0);
    expect(s.wanted!.ended).toBe("arrested");
    expect(events.some((e) => e.kind === "soldier" && e.change === "arrest")).toBe(true);
    // Face down and held: his body still, his hands at the small of his back.
    const b = s.skier.thrown!;
    expect(b).toBeTruthy();
    const at = { x: b.points[0], y: b.points[1], z: b.points[2] };
    const p = b.points;
    const hand = { x: p[3 * 12], y: p[3 * 12 + 1], z: p[3 * 12 + 2] };
    expect(Math.hypot(hand.x - at.x, hand.z - at.z)).toBeLessThan(0.5);
    expect(hand.y - field.groundAt(hand.x, hand.z)).toBeGreaterThan(0.2);
    const held = { x: b.x, z: b.z };
    run(s, 2);
    expect(Math.hypot(s.skier.thrown!.x - held.x, s.skier.thrown!.z - held.z)).toBeLessThan(0.01);
    // ...and the rest closed round him.
    expect(armyTroops(s).some((m) => m.mode === "cover")).toBe(true);
  });
});

describe("body on body", () => {
  it("knocks a soldier down when the player skis into him, and raises the heat", () => {
    const s = hunted(field, 2);
    run(s, 120, (st) => armyTroops(st).some((m) => m.mode === "chase"));
    const m = armyTroops(s).find((t) => t.mode === "chase")!;
    expect(m).toBeTruthy();
    // The player put square onto him at speed.
    const c = s.skier;
    c.x = m.x;
    c.z = m.z - 1.2;
    c.y = field.groundAt(c.x, c.z) + c.spec.cogHeight;
    c.vx = 0;
    c.vz = 12;
    c.vy = 0;
    const heat = s.wanted!.heat;
    const events = run(s, 0.2);
    expect(events.some((e) => e.kind === "soldier" && e.change === "down")).toBe(true);
    expect(s.wanted!.heat).toBeGreaterThan(heat);
  });
});

describe("up the lifts", () => {
  it("sends a squad up a real map's lift that rides a carrier and is let go at its top", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    if (liftPlans(level).length === 0) return;
    const s = createGame({ level, mode: "free", quiet: true, crowd: 0, gore: true });
    setWanted(s, 3);
    let rode = -1;
    let off = false;
    run(s, 400, (st) => {
      for (const m of armyTroops(st)) {
        if (m.from !== "lift") continue;
        if (m.mode === "ride") rode = m.id;
        if (m.id === rode && m.mode === "chase") off = true;
      }
      return off;
    });
    expect(rode).toBeGreaterThanOrEqual(0);
    expect(off).toBe(true);
  });
});

describe("determinism", () => {
  it("runs the same hunt the same twice, and draws nothing from the run's stream", () => {
    const a = hunted(field, 4, { sfw: true });
    const b = hunted(field, 4, { sfw: true });
    // The same hunt with nobody aboard to put down: no soldier on the snow.
    const air = hunted(field, 4, { sfw: true });
    step(air, NEUTRAL_INPUT);
    for (const h of air.army!.helis) h.aboard = 0;
    run(a, 100);
    run(b, 100);
    // ...and no ground wave up the mountain either.
    withoutWaves(() => run(air, 100 - dt));
    const sig = (s: GameState) =>
      armyTroops(s)
        .map((m) => `${m.id}:${m.mode}:${m.x.toFixed(4)},${m.z.toFixed(4)}`)
        .join("|");
    expect(sig(a)).toBe(sig(b));
    expect(sig(a).length).toBeGreaterThan(0);
    expect(armyTroops(air).length).toBe(0);
    // The run's own stream where it would be with no soldier at all.
    expect(a.rng.next()).toBe(air.rng.next());
  });
});
