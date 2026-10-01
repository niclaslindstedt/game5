// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND TUNNELS, read without a browser: the plan every surface asks
// (`wind-tunnel-plan.ts` — where a point on a lane is, whether a skier is in
// one, where a streak has been blown to), the minimap's marks and the way
// its arrows point (`minimap-view.ts`), the news line a tunnel earns
// (`run-news.ts`) and the gale and the whoosh the ear gets
// (`audio/tunnel-voice.ts`, `ride-bed.ts`), and how much of a lane the
// picture draws from where the lens stands (`TUNNEL_LOD`). The tunnels are
// laid by hand on the synthetic slope's run-out, as the generator would lay
// them.

import { describe, expect, it } from "vitest";

import { createGame, placeRun, type GameEvent, type Level } from "@engine";

import { createRideBed } from "../pwa/src/game/audio/ride-bed.ts";
import { TUNNEL_HEARD, tunnelTargets, tunnelVoiceAt } from "../pwa/src/game/audio/tunnel-voice.ts";
import { RUN_BANK } from "../pwa/src/game/audio/bank.ts";
import { soundForEvent } from "../pwa/src/game/audio/route.ts";
import { arrowAngle, buildMinimap, tunnelMarks } from "../pwa/src/game/minimap-view.ts";
import { newsFor } from "../pwa/src/game/run-news.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import {
  TUNNEL_LOD,
  TUNNEL_LOOK,
  archStride,
  marksAlong,
  streakArc,
  tunnelNear,
  tunnelPointAt,
  tunnelReach,
  tunnelUnder,
  tunnelsOf,
  type WindTunnel,
} from "../pwa/src/game/wind-tunnel-plan.ts";
import type {
  LayerSpec,
  LayerTarget,
  NoiseOptions,
  Synth,
  ToneOptions,
} from "@niclaslindstedt/oss-game-framework/audio/voice";
import { syntheticLevel } from "./support/synthetic.ts";

/** The lane's row on the run-out, z, and its two ends, x. */
const ROW = 1060;
const WEST = 200;
const EAST = 500;

/** A straight lane along x at `z` from `from` to `to`, a station every 4 m
 * on the snow. */
function lane(level: Level, id: string, z: number, from: number, to: number): WindTunnel {
  const way = Math.sign(to - from);
  const points: WindTunnel["points"] = [];
  for (let s = 0; s <= Math.abs(to - from); s += 4) {
    const x = from + way * s;
    points.push({ x, z, y: level.groundAt(x, z), s, heading: (way * Math.PI) / 2 });
  }
  return { id, points, length: points[points.length - 1].s, width: 9, speed: 28 };
}

/** The slope with two tunnels on its run-out: W1 east, W2 back west. */
function withTunnels(): Level {
  const level = syntheticLevel();
  const tunnels = [lane(level, "W1", ROW, WEST, EAST), lane(level, "W2", ROW + 30, EAST, WEST)];
  (level as { resort?: unknown }).resort = { runs: [], lifts: [], courses: [], tunnels };
  return level;
}

describe("the plan (wind-tunnel-plan.ts)", () => {
  const level = withTunnels();
  const [w1, w2] = tunnelsOf(level);

  it("reads none off a map with no resort", () => {
    expect(tunnelsOf(syntheticLevel())).toEqual([]);
  });

  it("interpolates a point down a lane and clamps it to the ends", () => {
    const p = tunnelPointAt(w1, 101);
    expect(p.x).toBeCloseTo(WEST + 101, 6);
    expect(p.z).toBe(ROW);
    expect(p.heading).toBeCloseTo(Math.PI / 2, 6);
    expect(tunnelPointAt(w1, -50).x).toBe(WEST);
    expect(tunnelPointAt(w1, 1e6).x).toBe(EAST);
    expect(tunnelPointAt(w2, 10).x).toBeCloseTo(EAST - 10, 6);
  });

  it("knows a skier in the lane from one beside it, behind it or past it", () => {
    const inside = tunnelUnder(level, 300, ROW + 3);
    expect(inside?.tunnel.id).toBe("W1");
    expect(inside?.s).toBeCloseTo(100, 6);
    // Heading +x, so its right is −z: three metres +z is to the LEFT.
    expect(inside?.lateral).toBeCloseTo(-3, 6);
    expect(tunnelUnder(level, 300, ROW + 6)).toBe(null);
    expect(tunnelUnder(level, WEST - 2, ROW)).toBe(null);
    expect(tunnelUnder(level, EAST + 2, ROW)).toBe(null);
    const beside = tunnelNear(level, 300, ROW - 14.5, TUNNEL_HEARD);
    expect(beside?.inside).toBe(false);
    expect(beside?.out).toBeCloseTo(10, 6);
    expect(tunnelNear(level, 300, ROW - 100, TUNNEL_HEARD)).toBe(null);
  });

  it("blows a streak down the lane faster than a skier and enters it again", () => {
    const a = streakArc(w1, 0.25, 0);
    const b = streakArc(w1, 0.25, 1);
    expect(b - a).toBeCloseTo(w1.speed * TUNNEL_LOOK.streakGain, 6);
    for (let t = 0; t < 60; t += 0.7) {
      const s = streakArc(w1, 0.9, t);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(w1.length);
    }
  });

  it("spaces the marks evenly and keeps the ends when asked", () => {
    expect(marksAlong(20, 8)).toEqual([0, 8, 16]);
    expect(marksAlong(20, 8, 0, true)).toEqual([0, 8, 16, 20]);
  });
});

describe("how much of a lane is drawn (TUNNEL_LOD)", () => {
  const WALLS = [280, 600, 1300, 0];

  it("draws every arch near, thins them with distance, and none past the wall", () => {
    for (const wall of WALLS) {
      const reach = tunnelReach(wall);
      expect(reach.far).toBe(wall > 0 ? wall : TUNNEL_LOD.open);
      expect(reach.near).toBeGreaterThanOrEqual(TUNNEL_LOD.nearMin);
      expect(reach.near).toBeLessThanOrEqual(TUNNEL_LOD.nearMax);
      expect(archStride(0, reach)).toBe(1);
      expect(archStride(reach.far + 1, reach)).toBe(0);
      // Each stride a multiple of the nearer one: an arch drawn far is
      // still drawn as the lens closes on it, so nothing pops in.
      let nearer = 1;
      for (let d = 0; d <= reach.far; d += 5) {
        const stride = archStride(d, reach);
        expect(stride % nearer).toBe(0);
        nearer = stride;
      }
    }
  });

  it("buys more of the lane with a farther DISTANCE wall", () => {
    const shown = (wall: number) => {
      const reach = tunnelReach(wall);
      let n = 0;
      for (let k = 0; k * TUNNEL_LOOK.archEvery <= 1700; k++) {
        const stride = archStride(k * TUNNEL_LOOK.archEvery, reach);
        if (stride > 0 && k % stride === 0) n++;
      }
      return n;
    };
    const counts = WALLS.map(shown);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    // A lens at the mouth of a 1.7 km lane draws a fraction of its arches.
    expect(counts[1]).toBeLessThan(1700 / TUNNEL_LOOK.archEvery / 3);
  });
});

describe("the minimap's tunnels (minimap-view.ts)", () => {
  it("turns an arrow so it points the way the lane blows", () => {
    // A path pointing UP (−y) turned by `rotate(θ)` points (sin θ, −cos θ);
    // the world group's y is the world's z.
    for (const h of [0, Math.PI / 2, Math.PI, -Math.PI / 3, 2]) {
      const a = (arrowAngle(h) * Math.PI) / 180;
      expect(Math.sin(a)).toBeCloseTo(Math.sin(h), 6);
      expect(-Math.cos(a)).toBeCloseTo(Math.cos(h), 6);
    }
  });

  it("marks every tunnel with its line, its own paint and arrows down it", () => {
    const level = withTunnels();
    const marks = tunnelMarks(level);
    expect(marks.map((m) => m.id)).toEqual(["W1", "W2"]);
    expect(marks[0].paint).not.toBe(marks[1].paint);
    for (const m of marks) {
      expect(m.d.startsWith("M")).toBe(true);
      expect(m.arrows.length).toBeGreaterThanOrEqual(3);
      for (const a of m.arrows) expect(a.z).toBeCloseTo(m.id === "W1" ? ROW : ROW + 30, 6);
    }
    // W1 blows east (+x), W2 back west.
    expect(marks[0].arrows[0].angle).toBeCloseTo(90, 6);
    expect(marks[1].arrows[0].angle).toBeCloseTo(270, 6);
    const state = createGame({ level, seed: 3, rivals: 0, quiet: true });
    expect(buildMinimap(state).tunnels.length).toBe(2);
    expect(
      buildMinimap(createGame({ level: syntheticLevel(), seed: 3, quiet: true })).tunnels,
    ).toEqual([]);
  });
});

describe("the tunnel's news (run-news.ts)", () => {
  const state = createGame({ level: withTunnels(), seed: 3, rivals: 0, quiet: true });
  const event = (phase: "in" | "out"): GameEvent => ({ kind: "tunnel", t: 1, id: "W1", phase });

  it("says so going in, and nothing coming out", () => {
    expect(newsFor(event("in"), state)).toEqual({ text: STRINGS.newsTunnel, tone: "info" });
    expect(newsFor(event("out"), state)).toBe(null);
  });
});

/** A synth that plays nothing and remembers what it was asked for. */
function recorder(): Synth & { noises: NoiseOptions[]; tones: ToneOptions[]; layers: LayerSpec[] } {
  const rec = {
    noises: [] as NoiseOptions[],
    tones: [] as ToneOptions[],
    layers: [] as LayerSpec[],
    unlock: () => {},
    autostart: () => {},
    resume: () => {},
    now: () => 0,
    tone: (o: ToneOptions) => void rec.tones.push(o),
    noise: (o: NoiseOptions) => void rec.noises.push(o),
    layer(spec: LayerSpec) {
      rec.layers.push(spec);
      let alive = true;
      return {
        set: (_t: LayerTarget) => {},
        stop: () => void (alive = false),
        alive: () => alive,
      };
    },
  };
  return rec;
}

describe("the tunnel's gale (audio/tunnel-voice.ts, ride-bed.ts)", () => {
  it("is silent away from a tunnel, a murmur beside one and a gale in it", () => {
    const mix = { wind: 1 };
    const far = tunnelTargets(tunnelVoiceAt(null, 3), mix);
    const beside = tunnelTargets(tunnelVoiceAt({ out: 10, s: 200 }, 3), mix);
    const inside = tunnelTargets(tunnelVoiceAt({ out: 0, s: 200 }, 3), mix);
    expect(far.gale.level + far.body.level + far.fan.level).toBe(0);
    expect(beside.gale.level).toBeGreaterThan(0);
    expect(inside.gale.level).toBeGreaterThan(beside.gale.level * 4);
    expect(inside.body.level).toBeGreaterThan(beside.body.level);
    // The fan is the mouth's, and gone down the lane.
    const mouth = tunnelTargets(tunnelVoiceAt({ out: 0, s: 5 }, 3), mix);
    expect(mouth.fan.level).toBeGreaterThan(0);
    expect(inside.fan.level).toBe(0);
  });

  it("whooshes in and out on the engine's word, and roars while he is carried", () => {
    expect(soundForEvent({ kind: "tunnel", t: 1, id: "W1", phase: "in" })?.id).toBe("tunnel_in");
    expect(soundForEvent({ kind: "tunnel", t: 1, id: "W1", phase: "out" })?.id).toBe("tunnel_out");
    expect(RUN_BANK.tunnel_in).toBeDefined();
    expect(RUN_BANK.tunnel_out).toBeDefined();

    const voice = recorder();
    const bed = createRideBed(recorder(), voice);
    const state = createGame({
      level: withTunnels(),
      seed: 3,
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 300, z: ROW, heading: Math.PI / 2, speed: 20 });
    bed.update(state, 1 / 60);
    // The wind's four and the gale's three, through the wind's fader.
    expect(voice.layers.length).toBe(7);
  });

  it("builds nothing of it on a map without a tunnel", () => {
    const voice = recorder();
    createRideBed(recorder(), voice).update(
      createGame({ level: syntheticLevel(), seed: 3, quiet: true }),
      1 / 60,
    );
    expect(voice.layers.length).toBe(4);
  });
});
