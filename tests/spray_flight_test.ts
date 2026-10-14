// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPRAY FLOWN AS A FUNCTION OF THE CLOCK (`spray-flight.ts`) — what the
// GPU ring flies in its vertex shader — held to the CPU pool's own flight
// (`spray-mass-pool.ts`): every parcel a stop throws, launched once and flown
// both ways, sampled at every frame of its life. The CPU steps at the
// frame; the clock's form solves a fixed grid of its own; they agree to a
// few centimetres where a plume is metres across, and a plume's height and
// reach — what the film score reads — to a few per cent.

import { describe, expect, it } from "vitest";

import { createGame, pairById, placeRun, step, TUNING } from "@engine";

import { holdInput } from "../pwa/src/game/hold-input.ts";
import { SNOW, type SnowKind } from "../pwa/src/game/snowpack.ts";
import {
  emptyFlown,
  flyLaunch,
  FLIGHT,
  SPRAY_FLIGHT_GLSL,
  type Launch,
} from "../pwa/src/game/spray-flight.ts";
import { MASS } from "../pwa/src/game/spray-mass.ts";
import { createMassPool } from "../pwa/src/game/spray-mass-pool.ts";
import { flatLevel } from "./support/synthetic.ts";

type Sample = { age: number; x: number; y: number; z: number; a: number };
type Track = { l: Launch; s: Sample[]; alive: boolean };

/** A stop from 40 km/h on `kind`, the CPU flying every parcel at 60 Hz;
 * each parcel's launch (its plane read off the map) and its every frame. */
function flown(kind: SnowKind): Track[] {
  const packed = ["groomed", "hard", "ice"].includes(kind) ? 1 : 0;
  const level = flatLevel({ packed });
  const state = createGame({
    level,
    spec: pairById("chamois"),
    rivals: 0,
    countdown: 0,
    quiet: true,
  });
  placeRun(state, { x: 1500, z: 200, heading: 0, speed: 40 / 3.6 });
  const live = new Map<number, Track>();
  const done: Track[] = [];
  const n = { x: 0, y: 1, z: 0 };
  const pool = createMassPool(30000, {
    launch(i, l) {
      level.normalAt(l.x, l.z, n);
      const ny = Math.max(n.y, 0.2);
      const t: Track = {
        l: { ...l, gx: -n.x / ny, gz: -n.z / ny, h0: level.groundAt(l.x, l.z) },
        s: [],
        alive: true,
      };
      const was = live.get(i);
      if (was) done.push(was);
      live.set(i, t);
    },
    retire(i) {
      const t = live.get(i);
      if (t) t.alive = false;
    },
  });
  const dt = 1 / 60;
  const t0 = state.t;
  for (let f = 0; f < 3.6 / dt; f++) {
    for (let k = 0; k < TUNING.physicsHz * dt; k++)
      step(state, holdInput(state, 40, 0, "stop", state.t - t0));
    if (f * dt < 2.4) pool.emit(state.skier, level, dt, 0, SNOW[kind]);
    pool.step(dt, level);
    for (const [i, t] of live) {
      if (!t.alive) {
        done.push(t);
        live.delete(i);
        continue;
      }
      const k = i * 3;
      t.s.push({
        age: pool.age[i],
        x: pool.pos[k],
        y: pool.pos[k + 1],
        z: pool.pos[k + 2],
        a: pool.alpha[i],
      });
    }
  }
  return [...done, ...live.values()].filter((t) => t.s.length > 1);
}

const q = (a: number[], p: number) => {
  const b = [...a].sort((x, y) => x - y);
  return b[Math.min(b.length - 1, Math.floor(p * b.length))];
};

describe("the spray flown off the clock", () => {
  for (const kind of ["groomed", "soft", "wet"] as SnowKind[]) {
    it(`flies a stop's parcels on ${kind} snow where the CPU pool flies them`, () => {
      const tracks = flown(kind);
      expect(tracks.length).toBeGreaterThan(2000);
      const out = emptyFlown();
      const err: number[] = [];
      const alpha: number[] = [];
      const highCpu: number[] = [];
      const highGpu: number[] = [];
      const reachCpu: number[] = [];
      const reachGpu: number[] = [];
      for (const t of tracks) {
        let hc = 0;
        let hg = 0;
        for (const s of t.s) {
          flyLaunch(t.l, s.age, out);
          err.push(Math.hypot(out.x - s.x, out.y - s.y, out.z - s.z));
          alpha.push(Math.abs(out.alpha - s.a));
          hc = Math.max(hc, s.y - t.l.h0);
          hg = Math.max(hg, out.y - t.l.h0);
        }
        const last = t.s[t.s.length - 1];
        flyLaunch(t.l, last.age, out);
        highCpu.push(hc);
        highGpu.push(hg);
        reachCpu.push(Math.hypot(last.x - t.l.x, last.z - t.l.z));
        reachGpu.push(Math.hypot(out.x - t.l.x, out.z - t.l.z));
      }
      // Each parcel, every frame: centimetres apart where a plume is metres.
      expect(q(err, 0.5)).toBeLessThan(0.08);
      expect(q(err, 0.9)).toBeLessThan(0.25);
      expect(q(alpha, 0.9)).toBeLessThan(0.03);
      // The plume as the film score reads it: its height and its reach.
      for (const p of [0.5, 0.9]) {
        expect(Math.abs(q(highGpu, p) - q(highCpu, p))).toBeLessThan(0.05 + 0.06 * q(highCpu, p));
        expect(Math.abs(q(reachGpu, p) - q(reachCpu, p))).toBeLessThan(
          0.05 + 0.06 * q(reachCpu, p),
        );
      }
    });
  }

  it("states the same numbers in its GLSL as in its TypeScript", () => {
    expect(SPRAY_FLIGHT_GLSL).toContain(`const int FLY_STEPS = ${FLIGHT.steps};`);
    expect(SPRAY_FLIGHT_GLSL).toContain(`const int FLY_SLIDE = ${FLIGHT.slide};`);
    expect(SPRAY_FLIGHT_GLSL).toContain(`const float FLY_KEEP = ${MASS.roll.keep};`);
    expect(SPRAY_FLIGHT_GLSL).toContain(`const float FLY_MU = ${MASS.roll.mu};`);
    expect(SPRAY_FLIGHT_GLSL).toContain("bool sprayParcel(");
  });

  it("lands a parcel at the same moment whichever frame looks at it", () => {
    const l: Launch = {
      x: 0,
      y: 0.05,
      z: 0,
      vx: 6,
      vy: 2.5,
      vz: 0,
      life: MASS.life,
      mass: MASS.parcel,
      term: 1.2,
      rad0: MASS.radius,
      eddy: MASS.eddy * 6.5,
      area: 1.5 / (520 * 0.00045),
      wx: 0,
      wz: 0,
      berm: false,
      hard: 0,
      glint: 0,
      h0: 0,
      gx: 0.1,
      gz: 0,
    };
    const out = emptyFlown();
    const landings = new Set<string>();
    for (let age = 0.3; age < 0.6; age += 1 / 37) {
      flyLaunch(l, age, out);
      if (out.landed >= 0) landings.add(out.landed.toFixed(5));
    }
    expect(landings.size).toBe(1);
  });
});
