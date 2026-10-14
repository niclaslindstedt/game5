// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FILM CAMERA (`cinema-director.ts`, `camera-cinema.ts`, `cinema-ahead.ts`):
// the edit cuts every two to four seconds and never on the same framing
// twice running; a flight known ahead gets its lens planted before the
// take-off and is cut as two shots; the lens keeps him in the frame and stays
// over the snow; the menu's slow motion is the hang of a long flight alone;
// and the run read ahead finds the jump before the run gets there without
// moving the run itself by a hair.

import { describe, expect, it } from "vitest";

import {
  createGame,
  generateLevel,
  showcaseSkis,
  step,
  trackPointAt,
  TUNING,
  type GameState,
} from "@engine";

import { backdropInput } from "../pwa/src/game/backdrop-run.ts";
import { createCinemaCamera, filmTake } from "../pwa/src/game/camera-cinema.ts";
import { createLineClear } from "../pwa/src/game/camera-clear.ts";
import { freshRigPose } from "../pwa/src/game/camera-rigs.ts";
import { createLookAhead } from "../pwa/src/game/cinema-ahead.ts";
import {
  CINEMA_SLOW,
  cinemaRate,
  createDirector,
  DIRECTOR,
  type Framing,
  type Situation,
  type Take,
} from "../pwa/src/game/cinema-director.ts";
import type { ReplayShot } from "../pwa/src/game/replay-shots.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const HZ = TUNING.physicsHz;

/** A cruise down a groomer at `speed`, `turn` rad/s of yaw. */
const cruise = (stepAt: number, speed = 14, turn = 0.2): Situation => ({
  step: stepAt,
  speed,
  packed: 1,
  turn,
  airborne: false,
  thrown: false,
});

/** A flight at `at` of `runs` steps, straight down +z. */
const flight = (at: number, runs: number): ReplayShot => ({
  kind: "air",
  at,
  runs,
  weight: 1,
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  speed: 18,
});

/** The edit over `seconds`, as one row a take: framing and steps held. */
function edit(
  seconds: number,
  shots: readonly ReplayShot[] = [],
  sit = cruise,
): { framing: Framing; from: number; to: number; take: Take }[] {
  const dir = createDirector();
  const takes: { framing: Framing; from: number; to: number; take: Take }[] = [];
  for (let k = 0; k < seconds * HZ; k += 2) {
    const t = dir.call(sit(k), shots);
    const last = takes[takes.length - 1];
    if (!last || last.take !== t) takes.push({ framing: t.framing, from: k, to: k, take: t });
    else last.to = k;
  }
  return takes;
}

describe("the film director (cinema-director.ts)", () => {
  it("cuts every two to four seconds and never on the same framing twice running", () => {
    for (const sit of [
      cruise,
      (k: number) => cruise(k, 25, 0.05),
      (k: number) => ({ ...cruise(k), packed: 0.2 }),
      (k: number) => cruise(k, 12, 0.9),
    ]) {
      const takes = edit(90, [], sit);
      expect(takes.length).toBeGreaterThan(20);
      for (let i = 1; i < takes.length; i++) {
        expect(takes[i].framing, `take ${i}`).not.toBe(takes[i - 1].framing);
      }
      // Every take but the one still running when the edit stops.
      for (const t of takes.slice(0, -1)) {
        const held = (t.to - t.from + 2) / HZ;
        expect(held, t.framing).toBeGreaterThanOrEqual(DIRECTOR.least - 0.05);
        expect(held, t.framing).toBeLessThanOrEqual(DIRECTOR.most + 0.05);
      }
      // The first is the wide one: the mountain before the man.
      expect(takes[0].framing).toBe("establish");
    }
  });

  it("uses many framings, not a favourite", () => {
    const kinds = new Set(edit(120).map((t) => t.framing));
    expect(kinds.size).toBeGreaterThanOrEqual(5);
  });

  it("plants a long flight's lens before the take-off and cuts it lip then landing", () => {
    const at = 20 * HZ;
    const big = flight(at, Math.round(1.6 * HZ));
    const takes = edit(30, [big]);
    const lip = takes.find((t) => t.framing === "lip");
    const hero = takes.find((t) => t.framing === "hero");
    expect(lip).toBeDefined();
    expect(hero).toBeDefined();
    // Standing by before he gets there, and the cut on the action.
    expect(lip!.from).toBeLessThanOrEqual(at - Math.round(DIRECTOR.lead * HZ) + 2);
    expect(hero!.from).toBeGreaterThan(at);
    expect(hero!.from).toBeLessThan(at + big.runs / 2);
    // The 180° rule: both on the same side of his line.
    expect(hero!.take.side).toBe(lip!.take.side);
    // Never a flash: no take shorter than a second around the moment.
    for (const t of takes.slice(0, -1)) expect((t.to - t.from + 2) / HZ).toBeGreaterThan(1);
  });

  it("frames a crash on the crash zoom", () => {
    const at = 15 * HZ;
    const crash: ReplayShot = { ...flight(at, HZ), kind: "wipeout" };
    const takes = edit(25, [crash]);
    const on = takes.find((t) => t.from <= at && t.to >= at);
    expect(on?.framing).toBe("crash");
  });
});

describe("the menu's slow motion (cinemaRate)", () => {
  it("slows the hang of a long flight and nothing else", () => {
    const at = 1000;
    const long = flight(at, Math.round(1.6 * HZ));
    const short = flight(3000, Math.round(0.5 * HZ));
    const plan = [long, short];
    expect(cinemaRate(plan, at - 10)).toBe(1);
    expect(cinemaRate(plan, at + 1)).toBeGreaterThan(0.9);
    expect(cinemaRate(plan, at + Math.round(long.runs / 2))).toBeCloseTo(CINEMA_SLOW.rate, 5);
    expect(cinemaRate(plan, at + long.runs + 1)).toBe(1);
    for (let k = short.at; k < short.at + short.runs; k++) expect(cinemaRate(plan, k)).toBe(1);
  });
});

describe("the film lens (camera-cinema.ts)", () => {
  it("keeps him in the frame and stays over the snow down the slope and over its kicker", () => {
    const level = syntheticLevel();
    const clear = createLineClear(level);
    const cam = createCinemaCamera(() => ({ level, clear }));
    const speed = 18;
    const kick = level.track.points.find((p) => p.z >= 560)!;
    const lift = Math.round((kick.s / speed) * HZ);
    const plan = [
      {
        ...flight(lift, Math.round(1.4 * HZ)),
        x: kick.x,
        y: kick.y,
        z: kick.z,
        heading: kick.heading,
      },
    ];
    let inFrame = 0;
    let frames = 0;
    let planted = -1;
    for (let wall = 0; wall < (level.track.length - 40) / speed; wall += 1 / 60) {
      const stepAt = Math.round(wall * HZ);
      const p = trackPointAt(level, wall * speed);
      const rig = freshRigPose();
      const f = (stepAt - lift) / plan[0].runs;
      const up = f > 0 && f < 1 ? 4 * 3 * f * (1 - f) : 0;
      rig.x = p.x;
      rig.y = level.groundAt(p.x, p.z) + 0.9 + up;
      rig.z = p.z;
      rig.heading = p.heading;
      rig.vx = Math.sin(p.heading) * speed;
      rig.vz = Math.cos(p.heading) * speed;
      rig.speed = speed;
      rig.airborne = up > 0;
      const view = { angle: "film" as const, shot: null, plan, step: stepAt };
      const pose = cam.update(view, rig, null, wall, 1 / 60)!;
      expect(pose).not.toBeNull();
      const take = filmTake()!;
      if (planted < 0 && take.framing === "lip") planted = stepAt;
      // Over the snow, always.
      expect(pose.eye.y, `${take.framing} at ${wall.toFixed(2)} s`).toBeGreaterThan(
        level.groundAt(pose.eye.x, pose.eye.z),
      );
      // In the frame: inside the vertical half-field of the look.
      const lx = pose.target.x - pose.eye.x;
      const ly = pose.target.y - pose.eye.y;
      const lz = pose.target.z - pose.eye.z;
      const sx = rig.x - pose.eye.x;
      const sy = rig.y - pose.eye.y;
      const sz = rig.z - pose.eye.z;
      const cos =
        (lx * sx + ly * sy + lz * sz) / (Math.hypot(lx, ly, lz) * Math.hypot(sx, sy, sz) || 1);
      const off = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
      frames++;
      if (off < pose.fov / 2) inFrame++;
    }
    expect(inFrame / frames).toBeGreaterThan(0.9);
    // The lip's lens was standing before he took off.
    expect(planted).toBeGreaterThan(0);
    expect(planted).toBeLessThan(lift);
  });
});

describe("the run read ahead (cinema-ahead.ts)", () => {
  const level = generateLevel(7);
  const fresh = (): GameState =>
    createGame({ level, seed: 7, showcase: 0, spec: showcaseSkis(), quiet: true });
  const print = (s: GameState): string => {
    const c = s.skier;
    return [s.tick, c.x, c.y, c.z, c.vx, c.vy, c.vz, c.q.w, c.edge, c.crouch].join(",");
  };

  it("finds a flight before the run takes off, and leaves the run exactly as it was", () => {
    const alone = fresh();
    const read = fresh();
    const ahead = createLookAhead((s) => backdropInput(s));
    let knownAt = -1;
    let at = -1;
    let flew = false;
    for (let k = 0; k < 14 * HZ; k++) {
      step(alone, backdropInput(alone));
      step(read, backdropInput(read));
      let n = 0;
      ahead.frame(read, () => n++ < 48);
      const m = ahead.shots().find((x) => x.kind === "air" && x.runs >= 0.5 * HZ);
      if (knownAt < 0 && m && m.at > read.tick) {
        knownAt = read.tick;
        at = m.at;
      }
      // The run itself in the air where the read said it would be.
      if (at > 0 && Math.abs(read.tick - at) < 0.3 * HZ && read.skier.airborne) flew = true;
      expect(print(read)).toBe(print(alone));
    }
    expect(knownAt).toBeGreaterThan(0);
    // Known well before the take-off: time to plant the lens.
    expect(at - knownAt).toBeGreaterThan(HZ);
    expect(flew).toBe(true);
  });
});
