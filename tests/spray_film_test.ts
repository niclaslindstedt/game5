// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The film references and the measure the snow eval lab's film score reads the
// game's spray by (`pwa/src/game/spray-film.ts`).

import { describe, expect, it } from "vitest";

import {
  FILM,
  FILM_MOVES,
  filmAt,
  frameScore,
  plumeOf,
  SILHOUETTE,
  bornSince,
  type PlumeBit,
} from "../pwa/src/game/spray-film.ts";

const flat = () => 0;

describe("the film references", () => {
  it("every row's moments run forward in time with a plume that rises and falls", () => {
    for (const move of FILM_MOVES) {
      const f = FILM[move].frames;
      for (let i = 1; i < f.length; i++) expect(f[i].t).toBeGreaterThan(f[i - 1].t);
      for (const frame of f) {
        expect(frame.top).toBeGreaterThan(0);
        expect(frame.reach).toBeGreaterThan(0);
        expect(frame.area).toBeGreaterThan(0);
      }
    }
  });

  it("orders the manoeuvres as the photographs do: a carve least, a board's stop over a ski's, powder most", () => {
    const peak = (move: (typeof FILM_MOVES)[number]) =>
      Math.max(...FILM[move].frames.map((f) => f.top));
    expect(peak("carve")).toBeLessThan(peak("stop"));
    expect(peak("stop")).toBeLessThan(peak("boardToe"));
    expect(peak("boardToe")).toBeLessThan(peak("boardHeel"));
    expect(peak("boardHeel")).toBeLessThan(peak("powder"));
    expect(FILM.powder.linger).toBeGreaterThan(FILM.stop.linger);
  });

  it("interpolates between moments and holds at the ends", () => {
    const f = FILM.stop.frames;
    const mid = filmAt("stop", (f[1].t + f[2].t) / 2);
    expect(mid.top).toBeCloseTo((f[1].top + f[2].top) / 2, 6);
    expect(filmAt("stop", 0).top).toBe(f[0].top);
    expect(filmAt("stop", 99).reach).toBe(f[f.length - 1].reach);
  });
});

describe("the measure", () => {
  const view = { x: 0, z: 1 };

  it("reads a wall of snow as its height, its reach and its share of a silhouette", () => {
    // A wall 2 m along x, 1 m tall, of opaque 10 cm puffs, seen along z.
    const bits: PlumeBit[] = [];
    for (let x = 0.05; x < 2; x += 0.1) {
      for (let y = 0.05; y < 1; y += 0.1) bits.push({ x, y, z: 0, r: 0.06, a: 1 });
    }
    const p = plumeOf(bits, flat, 0, 0, view);
    expect(p.top).toBeGreaterThan(0.85);
    expect(p.top).toBeLessThan(1.1);
    expect(p.reach).toBeGreaterThan(1.6);
    expect(p.reach).toBeLessThan(2.1);
    expect(p.area * SILHOUETTE).toBeGreaterThan(1.6);
    expect(p.area * SILHOUETTE).toBeLessThan(2.4);
    expect(p.wayX).toBeGreaterThan(0.99);
  });

  it("does not count what the eye cannot see", () => {
    const p = plumeOf([{ x: 1, y: 1, z: 0, r: 0.1, a: 0.01 }], flat, 0, 0, view);
    expect(p.bits).toBe(0);
    expect(p.area).toBe(0);
  });

  it("scores the film itself 100 and a plume twice its size about half", () => {
    const ref = filmAt("stop", 1.2);
    expect(frameScore(ref, ref)).toBeCloseTo(100, 6);
    const twice = { ...ref, top: ref.top * 2, reach: ref.reach * 2, area: ref.area * 2 };
    const s = frameScore(twice, ref);
    expect(s).toBeGreaterThan(45);
    expect(s).toBeLessThan(60);
    expect(frameScore({ ...ref, top: 0, reach: 0, area: 0 }, ref)).toBeLessThan(20);
  });
});

describe("the manoeuvre's own snow", () => {
  it("keeps what was thrown inside the window and what carries no age", () => {
    const bits: PlumeBit[] = [
      { x: 0, y: 0, z: 0, r: 0.1, a: 1, age: 0.2 },
      { x: 0, y: 0, z: 0, r: 0.1, a: 1, age: 3 },
      { x: 0, y: 0, z: 0, r: 0.1, a: 1 },
    ];
    const kept = bornSince(bits, 1);
    expect(kept.length).toBe(2);
    expect(kept.some((b) => b.age === 3)).toBe(false);
  });
});
