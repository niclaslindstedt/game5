// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CORDON TAPE BROKEN (`pwa/src/game/police-tape.ts`), held without a
// renderer on the synthetic slope: what breaks a span and how (the player
// fast through it snaps it at the contact, a slow push tears it off the
// nearer stake, one in the air over it or the tape not yet run out there
// leaves it be, an amateur of the crowd breaks it as the player does), the
// break written by the app's own step and carried on a call's copy and by
// the book, and the broken span's rope — springing back, falling and lying
// limp on the snow, never below it, tied to its stakes, still in seconds,
// and the same rope however its clock is stepped.

import { describe, expect, it } from "vitest";
import {
  copyCall,
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  type CrowdState,
  type GameState,
  type Level,
  type RescueCall,
  type TapeCut,
} from "@engine";

import { stepRun } from "../pwa/src/game/crowd-calls.ts";
import { POLICE } from "../pwa/src/game/police-defs.ts";
import { callsOf, createRescueBook } from "../pwa/src/game/rescue-book.ts";
import {
  ROPE,
  TAPE_CUT,
  TAPE_SHAPE,
  cutTape,
  cutsAt,
  ribbonOf,
  ropeOf,
  ropeTo,
  spanPoint,
  type Rope,
} from "../pwa/src/game/police-tape.ts";
import { SLOPE, flatLevel, syntheticLevel } from "./support/synthetic.ts";

/** A cordon on the slope: a square 16 m a side round (`SLOPE.x`, 800), its
 * first span across the fall line at its top (z 792), the tape run along
 * each span from 10 s to 20 s, the machine lifting off at 300 s. */
const X = SLOPE.x;
const RING = [
  { x: X - 8, z: 792 },
  { x: X + 8, z: 792 },
  { x: X + 8, z: 808 },
  { x: X - 8, z: 808 },
];

function policeCall(): RescueCall {
  return {
    start: 0,
    site: { x: X + 200, y: 0, z: 800, heading: 0, pitch: 0, roll: 0 },
    down: 1e6,
    up: 1e6 + 1,
    casualties: [{ x: X, z: 800, known: 0 }],
    kind: "police",
    evidence: [{ what: "body", x: X, z: 800 }],
    cordon: { ring: RING, spans: RING.map((_, i) => ({ t0: 10 + i, t1: 11 + i })), lift: 300 },
  };
}

function sceneOn(level: Level): GameState {
  const s = createGame({ level, seed: 1, mode: "free", crowd: 0, quiet: true });
  s.rescue = [policeCall()];
  return s;
}

/** The skier stood `past` m beyond the top span at `u` along it, moving
 * through it at `speed` m/s, `over` m above where he would stand. */
function through(s: GameState, u: number, speed: number, over = 0): void {
  const c = s.skier;
  c.x = RING[0].x + 16 * u;
  c.z = RING[0].z + speed * 0.004;
  c.vx = 0;
  c.vz = speed;
  c.y = s.level.groundAt(c.x, c.z) + TAPE_CUT.stand + over;
  s.t = 30;
}

describe("the tape broken", () => {
  const level = syntheticLevel();

  it("snaps at the contact when skied through fast", () => {
    const s = sceneOn(level);
    through(s, 0.3, 12);
    cutTape(s);
    const cut = s.rescue![0].tape!;
    expect(cut).toHaveLength(1);
    expect(cut[0].span).toBe(0);
    expect(cut[0].u).toBeCloseTo(0.3, 2);
    expect(cut[0].tear).toBe(false);
    expect(cut[0].t).toBeCloseTo(30, 6);
    // Broken once: the same span is not broken again.
    cutTape(s);
    expect(s.rescue![0].tape).toHaveLength(1);
  });

  it("tears off the nearer stake when pushed through slowly", () => {
    const s = sceneOn(level);
    through(s, 0.8, 1.5);
    cutTape(s);
    const cut = s.rescue![0].tape![0];
    expect(cut.tear).toBe(true);
    const rope = ropeTo(level, ropeOf(level, RING[0], RING[1], cut), cut.t + 1);
    expect(rope.tiedA).toBe(true);
    expect(rope.tiedB).toBe(false);
  });

  it("leaves it be: leant on, jumped over, not yet run out, gone with the machine", () => {
    const leant = sceneOn(level);
    through(leant, 0.5, TAPE_CUT.least * 0.5);
    cutTape(leant);
    const over = sceneOn(level);
    through(over, 0.5, 12, 1.2);
    cutTape(over);
    const early = sceneOn(level);
    through(early, 0.8, 12);
    early.t = 10.5; // the first span half run out: not yet at 0.8
    cutTape(early);
    const gone = sceneOn(level);
    through(gone, 0.5, 12);
    gone.t = 301;
    cutTape(gone);
    for (const s of [leant, over, early, gone]) expect(s.rescue![0].tape ?? []).toHaveLength(0);
    // The first span half run out: broken where it is run out.
    through(early, 0.3, 12);
    early.t = 10.5;
    cutTape(early);
    expect(early.rescue![0].tape).toHaveLength(1);
  });

  it("is broken by an amateur of the crowd as by the player", () => {
    const s = sceneOn(level);
    s.skier.x = X + 300;
    s.t = 30;
    const x = RING[0].x + 16 * 0.6;
    const z = RING[0].z + 0.02;
    const a = { x, y: level.groundAt(x, z), z, vx: 1, vz: 8, lift: -1 };
    s.crowd = { amateurs: [a] } as unknown as CrowdState;
    cutTape(s);
    const cut = s.rescue![0].tape!;
    expect(cut).toHaveLength(1);
    expect(cut[0].u).toBeGreaterThan(0.55);
    expect(cut[0].u).toBeLessThan(0.62);
    // On a chair over it, he passes.
    const t = sceneOn(level);
    t.skier.x = X + 300;
    t.t = 30;
    t.crowd = { amateurs: [{ ...a, y: a.y + 6, lift: 0 }] } as unknown as CrowdState;
    cutTape(t);
    expect(t.rescue![0].tape ?? []).toHaveLength(0);
  });

  it("is broken by the app's own step, the same on every run, and carried on", () => {
    const ride = (): RescueCall => {
      const s = sceneOn(level);
      s.t = 30;
      placeRun(s, { x: X - 2, z: 780, heading: 0, speed: 9, time: 30 });
      for (let i = 0; i < 360; i++) stepRun(s, NEUTRAL_INPUT);
      return s.rescue![0];
    };
    const one = ride();
    expect(one.tape?.length).toBeGreaterThanOrEqual(1);
    expect(one.tape![0].span).toBe(0);
    expect(one.tape![0].tear).toBe(false);
    expect(ride().tape).toEqual(one.tape);
    // A run's copy of its call carries the tape broken, its own copy.
    const copy = copyCall(one);
    expect(copy.tape).toEqual(one.tape);
    expect(copy.tape).not.toBe(one.tape);
    expect(copy.cordon).toBe(one.cordon);
    // And the book hands it on to the runs after.
    const book = createRescueBook();
    book.level = level;
    book.rides.push({
      start: 0,
      casualties: [{ x: X, z: 800, known: 0 }],
      flight: { site: one.site, down: 0, lift: 300, gone: 400 } as never,
      kind: "police",
      evidence: one.evidence,
      tape: one.tape,
    });
    expect(callsOf(book)[0].tape).toEqual(one.tape);
  });

  it("is read at a clock only once broken", () => {
    const cut: TapeCut = { span: 2, u: 0.5, t: 40, vx: 0, vz: 9, tear: false, wx: 0, wz: 0 };
    expect(cutsAt([cut], 39.9).size).toBe(0);
    expect(cutsAt([cut], 40).get(2)).toBe(cut);
  });
});

/** Every point's height over the snow, and the ribbon's edges'. */
function clearance(level: Level, rope: Rope): { node: number; edge: number } {
  let node = Infinity;
  let edge = Infinity;
  for (let i = 0; i < rope.n; i++) {
    const j = 3 * i;
    node = Math.min(node, rope.pos[j + 1] - level.groundAt(rope.pos[j], rope.pos[j + 2]));
  }
  const mid = new Float32Array(3 * rope.n);
  const half = new Float32Array(3 * rope.n);
  ribbonOf(level, rope, mid, half);
  for (let i = 0; i < rope.n; i++) {
    for (const e of [1, -1]) {
      const j = 3 * i;
      const x = mid[j] + half[j] * e;
      const z = mid[j + 2] + half[j + 2] * e;
      edge = Math.min(edge, mid[j + 1] + half[j + 1] * e - level.groundAt(x, z));
    }
  }
  return { node, edge };
}

describe("the broken span's rope", () => {
  const maps: [string, Level][] = [
    ["the slope", syntheticLevel()],
    ["the flat", flatLevel()],
  ];
  const cuts: [string, TapeCut][] = [
    ["snapped", { span: 0, u: 0.4, t: 30, vx: 2, vz: 12, tear: false, wx: 4, wz: -2 }],
    ["torn", { span: 0, u: 0.2, t: 30, vx: 0.4, vz: 1.4, tear: true, wx: 0, wz: 0 }],
  ];
  for (const [name, level] of maps) {
    const a = { x: (name === "the flat" ? 1500 : X) - 6, z: 800 };
    const b = { x: a.x + 12, z: 801 };
    for (const [kind, cut] of cuts) {
      it(`${kind} on ${name}: falls and lies limp on the snow, never below it, tied on, still`, () => {
        const rope = ropeOf(level, a, b, cut);
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        let t = cut.t;
        while (!rope.done) {
          t += 0.05;
          ropeTo(level, rope, t);
          const c = clearance(level, rope);
          expect(c.node).toBeGreaterThanOrEqual(ROPE.lie - 1e-6);
          expect(c.edge).toBeGreaterThanOrEqual(ROPE.lie - 1e-4);
        }
        // Still well before the cap, a few seconds after it parted.
        expect(t - cut.t).toBeLessThan(ROPE.most - 2);
        // Tied to its stakes at the tape's height (the torn end loose).
        const y0 = level.groundAt(a.x, a.z) + POLICE.cordon.tape;
        expect(rope.pos[1]).toBeCloseTo(cut.tear && cut.u < 0.5 ? rope.pos[1] : y0, 6);
        if (!cut.tear) expect(rope.pos[0]).toBeCloseTo(a.x, 6);
        expect(rope.pos[3 * (rope.n - 1)]).toBeCloseTo(b.x, 6);
        // Limp on the snow: every point more than 3 m (in plan) from a
        // stake it hangs from lies on it (what hangs off a stake streams a
        // little in the wind).
        for (let i = 0; i < rope.n; i++) {
          const j = 3 * i;
          const p = { x: rope.pos[j], z: rope.pos[j + 2] };
          const fromA = rope.tiedA ? Math.hypot(p.x - a.x, p.z - a.z) : Infinity;
          const fromB = rope.tiedB ? Math.hypot(p.x - b.x, p.z - b.z) : Infinity;
          if (Math.min(fromA, fromB) < 3) continue;
          expect(rope.pos[j + 1] - level.groundAt(p.x, p.z)).toBeLessThan(0.03);
        }
        // Never longer than the span it was, and a little stretched at most.
        let length = 0;
        for (let i = 0; i < rope.n - 1; i++) {
          if (!rope.linked[i]) continue;
          const j = 3 * i;
          length += Math.hypot(
            rope.pos[j + 3] - rope.pos[j],
            rope.pos[j + 4] - rope.pos[j + 1],
            rope.pos[j + 5] - rope.pos[j + 2],
          );
        }
        expect(length).toBeLessThan(len * 1.15);
        // It springs back and falls: well down from the tape's height a
        // second on.
        const early = ropeTo(level, ropeOf(level, a, b, cut), cut.t + 1.5);
        expect(clearance(level, early).node).toBeLessThan(0.05);
      });
    }
  }

  it("is the same rope however its clock is stepped, and again from the break", () => {
    const level = syntheticLevel();
    const a = { x: X - 6, z: 800 };
    const b = { x: X + 6, z: 801 };
    const cut = cuts[0][1];
    const once = ropeTo(level, ropeOf(level, a, b, cut), cut.t + 2.37);
    const bit = ropeOf(level, a, b, cut);
    for (let t = cut.t; t < cut.t + 2.37; t += 0.0173) ropeTo(level, bit, t);
    ropeTo(level, bit, cut.t + 2.37);
    expect(Array.from(bit.pos)).toEqual(Array.from(once.pos));
    // Seeked back: stepped again from the break, the same rope.
    ropeTo(level, bit, cut.t + 6);
    ropeTo(level, bit, cut.t + 2.37);
    expect(Array.from(bit.pos)).toEqual(Array.from(once.pos));
    // Its first point is where the intact span's was, its width the tape's.
    const p = spanPoint(level, a, b, 0);
    const fresh = ropeOf(level, a, b, cut);
    expect(fresh.pos[0]).toBeCloseTo(p[0], 9);
    expect(fresh.pos[1]).toBeCloseTo(p[1], 9);
    const mid = new Float32Array(3 * fresh.n);
    const half = new Float32Array(3 * fresh.n);
    ribbonOf(level, fresh, mid, half);
    expect(Math.hypot(half[3], half[4], half[5]) * 2).toBeCloseTo(TAPE_SHAPE.width, 4);
  });
});
