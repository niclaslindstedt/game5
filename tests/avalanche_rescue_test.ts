// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEARCH AND THE PATROL (`avalanche-rescue.ts`): the others a slide
// takes, carried and buried on its own stream; the player's transceiver
// switching itself to search, the probe striking a body only within its
// reach and length, the shovel's time growing with the depth; the player
// buried gone at once, no patrol called for him; and the transceiver's
// face as the HUD draws it (`beacon-read.ts`).

import { describe, expect, it } from "vitest";
import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";

import {
  AVALANCHE_RESCUE,
  clipCrowd,
  dealKnobs,
  freshAmateur,
  NEUTRAL_INPUT,
  createGame,
  patrolMan,
  placeRun,
  releaseAvalanche,
  step,
  stepAvalanche,
  stepRagdoll,
  type Burial,
  type GameEvent,
  type GameState,
  type PatrolMan,
} from "@engine";
import { LEE, avalancheRide, leeLevel } from "./support/avalanche-scenes.ts";
import { beaconRead } from "../pwa/src/game/beacon-read.ts";
import { SCREEN_TO_ENGINE } from "../pwa/src/game/input-model.ts";
import { newsFor } from "../pwa/src/game/run-news.ts";

const R = AVALANCHE_RESCUE;
const phasesOf = (seen: GameEvent[]): string[] =>
  seen.flatMap((e) =>
    e.kind === "avalanche" ? [e.phase] : e.kind === "death" ? [`death:${e.cause}`] : [],
  );

/** The player caught on the bench's slab and stepped until he is buried. */
function buryPlayer(state: GameState, seen: GameEvent[] = []): void {
  placeRun(state, { x: LEE.x, z: LEE.slab, heading: Math.PI / 2, speed: 0 });
  releaseAvalanche(state, state.avalanche!, LEE.x, LEE.slab, []);
  for (let i = 0; i < 120 * 40 && state.avalanche!.victim?.phase !== "lost"; i++) {
    step(state, { ...NEUTRAL_INPUT, brake: 1 });
    for (const e of state.events) if (e.kind === "avalanche" || e.kind === "death") seen.push(e);
  }
  expect(state.avalanche!.victim?.phase).toBe("lost");
}

describe("the player buried is gone", () => {
  it("calls no patrol for him: the run starts again instead", () => {
    const s = avalancheRide();
    const seen: GameEvent[] = [];
    buryPlayer(s, seen);
    for (let i = 0; i < 120 * 5; i++) {
      step(s, NEUTRAL_INPUT);
      for (const e of s.events) if (e.kind === "avalanche") seen.push(e);
    }
    const phases = phasesOf(seen);
    expect(phases).toContain("buried");
    expect(phases).not.toContain("patrol");
    expect(s.avalanche!.burials.some((b) => b.who === "player")).toBe(false);
  });

  it("on a run that carries its injuries, the death flow takes him as he goes under", () => {
    const s = createGame({
      level: leeLevel(),
      mode: "free",
      quiet: true,
      crowd: 0,
      avalanche: true,
      gore: true,
    });
    const seen: GameEvent[] = [];
    buryPlayer(s, seen);
    const phases = phasesOf(seen);
    expect(phases.indexOf("death:smothered")).toBeGreaterThan(phases.indexOf("buried"));
    expect(s.gore!.dead).toBeCloseTo(s.t, 1);
  });

  it("is never called on a run without avalanches, and nothing of it is kept", () => {
    const s = avalancheRide(leeLevel(), false);
    expect(s.avalanche).toBeUndefined();
  });
});

/** An amateur stood on the bench's slab below the release, the crowd only
 * him — stepped by hand (the bench has no runs for the crowd to ski). */
function withAmateur(state: GameState, x: number, z: number) {
  const rng = createRng(7);
  const am = freshAmateur(0, 0, 0, "cruiser", "man", dealKnobs(rng, "cruiser"), rng);
  am.x = x;
  am.z = z;
  am.y = state.level.groundAt(x, z);
  am.mode = "stop";
  state.crowd = { rng, amateurs: [am], groups: [], queues: [] };
  return am;
}

/** The avalanche and the amateur's ragdoll stepped, the player's input
 * `input` (his transceiver, probe and shovel). */
function stepBy(state: GameState, input = NEUTRAL_INPUT, seen?: GameEvent[]): void {
  const events: GameEvent[] = [];
  stepAvalanche(state, events, input);
  for (const am of state.crowd?.amateurs ?? []) {
    if (!am.thrown) continue;
    stepRagdoll(state, am.thrown);
    am.x = am.thrown.x;
    am.z = am.thrown.z;
  }
  state.t += 1 / 120;
  seen?.push(...events);
}

/** An amateur buried on the bench, the player stood `off` m from him. */
function buriedAmateur(seed = 3): { s: GameState; b: Burial } {
  for (let k = 0; k < 12; k++) {
    const s = avalancheRide(leeLevel(), true, seed + k);
    placeRun(s, { x: LEE.x + 150, z: 650, heading: 0, speed: 0 });
    withAmateur(s, LEE.x, LEE.slab + 20);
    releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
    for (let i = 0; i < 120 * 60; i++) {
      stepBy(s);
      const b = s.avalanche!.burials.find((x) => x.who === "amateur");
      if (b?.phase === "buried") return { s, b };
      if (b?.phase === "out") break;
    }
  }
  throw new Error("no amateur buried on twelve seeds");
}

describe("the others a slide takes", () => {
  it("an amateur in its way is thrown, carried and buried, his air dealt", () => {
    const { s, b } = buriedAmateur();
    const am = s.crowd!.amateurs[0];
    expect(am.thrown).not.toBeNull();
    expect(am.mode).toBe("down");
    expect(am.buried).toBe(b.id);
    expect(b.depth).toBeGreaterThan(0.3);
    expect(b.air).toBeGreaterThan(0);
  });

  it("his unit switches the player's transceiver to search; a press switches it back", () => {
    const { s } = buriedAmateur();
    const B = s.avalanche!.beacon;
    stepBy(s);
    expect(B.search).toBe(true);
    stepBy(s, { ...NEUTRAL_INPUT, beacon: true });
    expect(B.search).toBe(false);
    // Switched back by hand, it stays so for the same burial.
    stepBy(s);
    expect(B.search).toBe(false);
  });

  it("the patrol is called for him, skis in, searches, probes and digs him out alive", () => {
    const { s, b } = buriedAmateur();
    b.air = 1e6;
    const a = s.avalanche!;
    const seen: GameEvent[] = [];
    const acts = new Set<string>();
    const man: PatrolMan = { shown: false, x: 0, z: 0, heading: 0, act: "stand", work: 0 };
    let t = 0;
    for (; t < 120 * 200 && b.phase === "buried"; t++) {
      stepBy(s, NEUTRAL_INPUT, seen);
      if (a.patrol) acts.add(`${a.patrol.phase}:${patrolMan(a.patrol, 0, man).act}`);
    }
    const phases = phasesOf(seen);
    expect(phases).toContain("patrol");
    expect(phases).toContain("dug");
    expect(b.alive).toBe(true);
    // Not before a team could get there, nor long after.
    expect(t / 120).toBeGreaterThan(R.patrol.respond[0] + R.patrol.search + R.patrol.probe);
    expect(t / 120).toBeLessThan(R.patrol.respond[1] + 60);
    for (const want of ["coming:ski", "search:search", "dig:dig"]) expect(acts).toContain(want);
  });

  it("left buried past his air, he is dug out dead", () => {
    const { s, b } = buriedAmateur();
    b.air = b.t + 0.5;
    s.avalanche!.patrol = null;
    for (let i = 0; i < 120 * 2; i++) stepBy(s);
    expect(b.alive).toBe(false);
  });
});

describe("the probe and the shovel", () => {
  it("strikes only within its reach, and only a body no deeper than it is long", () => {
    const { s, b } = buriedAmateur();
    const seen: GameEvent[] = [];
    const press = { ...NEUTRAL_INPUT, dig: true };
    // A miss a metre and a half off.
    placeRun(s, { x: b.x + 1.5, z: b.z, heading: 0, speed: 0 });
    stepBy(s, press, seen);
    stepBy(s, NEUTRAL_INPUT, seen);
    expect(phasesOf(seen)).toContain("probe");
    expect(b.struck).toBe(false);
    // Too soon for another stroke: nothing.
    const holes = s.avalanche!.beacon.holes.length;
    placeRun(s, { x: b.x + 0.3, z: b.z, heading: 0, speed: 0 });
    stepBy(s, press);
    expect(s.avalanche!.beacon.holes.length).toBe(holes);
    for (let i = 0; i < 120; i++) stepBy(s);
    // On him: a strike.
    stepBy(s, press, seen);
    if (b.depth <= R.probe.length) {
      expect(b.struck).toBe(true);
      expect(phasesOf(seen)).toContain("strike");
    }
  });

  it("a stroke past the probe's length finds nothing", () => {
    const { s, b } = buriedAmateur();
    b.depth = R.probe.length + 0.5;
    placeRun(s, { x: b.x, z: b.z, heading: 0, speed: 0 });
    stepBy(s, { ...NEUTRAL_INPUT, dig: true });
    expect(b.struck).toBe(false);
  });

  it("digs at a lone rescuer's rate, the time growing with the depth", () => {
    const timeFor = (depth: number): number => {
      const { s, b } = buriedAmateur();
      b.depth = depth;
      b.air = 1e6;
      b.struck = true;
      s.avalanche!.patrol = null;
      placeRun(s, { x: b.x, z: b.z + 1.5, heading: 0, speed: 0 });
      const hold = { ...NEUTRAL_INPUT, dig: true };
      let i = 0;
      for (; i < 120 * 120 && b.phase === "buried"; i++) {
        stepBy(s, hold);
        // The patrol kept out of it: the player digs alone.
        s.avalanche!.patrol = null;
      }
      expect(b.phase).toBe("out");
      expect(b.alive).toBe(true);
      return i / 120;
    };
    const one = timeFor(1);
    const two = timeFor(2);
    expect(one).toBeCloseTo(1 / R.dig.rate, 0);
    expect(two / one).toBeCloseTo(2, 1);
  });

  it("holds a man digging in his hole, and nobody shoulders the body under him", () => {
    const { s, b } = buriedAmateur();
    b.struck = true;
    b.air = 1e6;
    s.avalanche!.patrol = null;
    placeRun(s, { x: b.x, z: b.z + 1, heading: 0, speed: 0 });
    const c = s.skier;
    c.vx = 0.4;
    c.vz = -0.3;
    stepBy(s, { ...NEUTRAL_INPUT, dig: true });
    expect(s.avalanche!.beacon.digging).toBe(b.id);
    expect(Math.hypot(c.vx, c.vy, c.vz)).toBe(0);
    // Stood right over him, the crowd's shove leaves him where he is.
    placeRun(s, { x: b.x, z: b.z, heading: 0, speed: 0 });
    const am = s.crowd!.amateurs[0];
    am.x = b.x;
    am.z = b.z;
    am.y = c.y - c.spec.cogHeight;
    clipCrowd(s, []);
    expect(c.x).toBe(b.x);
    expect(c.z).toBe(b.z);
  });

  it("does nothing while he is moving, or with nobody under", () => {
    const { s, b } = buriedAmateur();
    placeRun(s, { x: b.x, z: b.z, heading: 0, speed: 6 });
    stepBy(s, { ...NEUTRAL_INPUT, dig: true });
    expect(s.avalanche!.beacon.holes.length).toBe(0);
    const quiet = avalancheRide();
    placeRun(quiet, { x: LEE.x, z: 600, heading: 0, speed: 0 });
    stepAvalanche(quiet, [], { ...NEUTRAL_INPUT, dig: true });
    expect(quiet.avalanche!.beacon.holes.length).toBe(0);
  });
});

describe("the transceiver as the HUD reads it", () => {
  it("sends with nobody under; searches for a signal out of range; points in it; brackets close", () => {
    const { s, b } = buriedAmateur();
    stepBy(s);
    const at = (dx: number, dz: number) => {
      placeRun(s, { x: b.x + dx, z: b.z + dz, heading: Math.PI, speed: 0 });
      return beaconRead(s, s.t);
    };
    const far = at(0, 120);
    expect(far?.mode).toBe("signal");
    const coarse = at(0, 30);
    expect(coarse?.mode).toBe("coarse");
    expect(coarse!.metres).toBeGreaterThan(20);
    expect(coarse!.metres).toBeLessThan(45);
    expect(coarse!.arrow).not.toBeNull();
    const fine = at(0.8, 1.2);
    expect(fine?.mode).toBe("fine");
    expect(fine!.arrow).toBeNull();
    expect(fine!.metres).toBeLessThan(R.beacon.fine);
    // Switched to sending, it reads no search.
    s.avalanche!.beacon.search = false;
    expect(beaconRead(s, s.t)?.mode).toBe("send");
    expect(beaconRead(avalancheRide(leeLevel(), false), 0)).toBeNull();
  });

  it("followed, the arrow takes him in on the flux line's curve to the fine search", () => {
    const { s, b } = buriedAmateur();
    stepBy(s);
    let curved = 0;
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + 0.3;
      let x = b.x + Math.sin(ang) * 35;
      let z = b.z + Math.cos(ang) * 35;
      let heading = Math.atan2(b.x - x, b.z - z);
      let walked = 0;
      let reached = false;
      for (let i = 0; i < 400; i++) {
        placeRun(s, { x, z, heading, speed: 0 });
        s.t += 0.1;
        const r = beaconRead(s, s.t)!;
        if (r.mode === "fine") {
          reached = true;
          break;
        }
        if (r.arrow === null) continue;
        heading += r.arrow * SCREEN_TO_ENGINE;
        x += Math.sin(heading) * 0.5;
        z += Math.cos(heading) * 0.5;
        walked += 0.5;
      }
      expect(reached).toBe(true);
      if (walked > 35 * 1.08) curved++;
    }
    // Off the aerial's axis, the flux line is a curve, longer than straight.
    expect(curved).toBeGreaterThan(0);
  });

  it("news for a strike and a dig", () => {
    const s = avalancheRide();
    const ev = (phase: string, alive?: boolean): GameEvent =>
      ({
        kind: "avalanche",
        t: 1,
        phase,
        id: 1,
        x: 0,
        z: 0,
        size: 900,
        depth: 1.2,
        who: "amateur",
        alive,
      }) as GameEvent;
    expect(newsFor(ev("strike"), s)).not.toBeNull();
    expect(newsFor(ev("dug", true), s)).not.toBeNull();
    expect(newsFor(ev("dug", false), s)).not.toBeNull();
    expect(newsFor(ev("patrol"), s)).not.toBeNull();
  });
});
