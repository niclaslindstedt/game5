// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HEAD IN ITS SKI HELMET (`pwa/src/game/helmet-shape.ts`), held to the
// measures of a real one — an adult medium's shell 26–28 cm long, 21–23 wide
// and 20–22 from the ear cover's foot to the crown, widest just above the
// ears; goggles 17–19 cm across and 9–10.5 tall tucked under the brim with
// no gap — and to its budget: the game's cut of it is the code figure's and
// the model's (`make blender KIND=skier` is handed these triangles), so a
// triangle added here is one every skier on the start line draws.

import { describe, expect, it } from "vitest";

import {
  GOGGLES,
  SHELL,
  edgeAt,
  helmetParts,
  helmetReach,
  helmetTriangles,
  shellAt,
  type HelmetMaterial,
  type HelmetPart,
} from "../pwa/src/game/helmet-shape.ts";

const parts = helmetParts();
const of = (...m: HelmetMaterial[]): HelmetPart[] => parts.filter((p) => m.includes(p.material));
const points = (ps: HelmetPart[]): [number, number, number][] =>
  ps.flatMap((p) =>
    Array.from({ length: p.position.length / 3 }, (_, i): [number, number, number] => [
      p.position[i * 3],
      p.position[i * 3 + 1],
      p.position[i * 3 + 2],
    ]),
  );
const span = (pts: [number, number, number][], k: number): [number, number] => [
  Math.min(...pts.map((p) => p[k])),
  Math.max(...pts.map((p) => p[k])),
];

describe("the shell", () => {
  const shell = points(of("shell", "stripe", "trim"));

  it("is an adult medium's size", () => {
    const [x0, x1] = span(shell, 0);
    const [y0, y1] = span(shell, 1);
    const [z0, z1] = span(shell, 2);
    expect(z1 - z0).toBeGreaterThan(0.26);
    expect(z1 - z0).toBeLessThan(0.28);
    expect(x1 - x0).toBeGreaterThan(0.21);
    expect(x1 - x0).toBeLessThan(0.23);
    expect(y1 - y0).toBeGreaterThan(0.2);
    expect(y1 - y0).toBeLessThan(0.22);
  });

  it("is widest just above the ears, and symmetric", () => {
    const widest = shell.reduce((a, p) => (Math.abs(p[0]) > Math.abs(a[0]) ? p : a));
    expect(widest[1]).toBeGreaterThan(-0.005);
    expect(widest[1]).toBeLessThan(0.035);
    const [x0, x1] = span(shell, 0);
    expect(x1 + x0).toBeCloseTo(0, 3);
  });

  it("covers the ears and opens over the eyes: the brim high, the ear cover low", () => {
    expect(edgeAt(0)).toBeGreaterThan(0.035);
    expect(edgeAt(Math.PI / 2)).toBeLessThan(-0.06);
    expect(edgeAt(-Math.PI / 2)).toBeCloseTo(edgeAt(Math.PI / 2), 9);
    // The nape higher than the ear cover's foot, lower than the brim.
    expect(edgeAt(Math.PI)).toBeGreaterThan(edgeAt(Math.PI / 2));
    expect(edgeAt(Math.PI)).toBeLessThan(edgeAt(0));
  });

  it("faces out everywhere", () => {
    for (const p of of("shell", "stripe")) {
      const P = p.position;
      for (let t = 0; t < p.index.length; t += 3) {
        const [i, j, k] = [p.index[t], p.index[t + 1], p.index[t + 2]];
        const a = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
        const e1 = [P[j * 3] - a[0], P[j * 3 + 1] - a[1], P[j * 3 + 2] - a[2]];
        const e2 = [P[k * 3] - a[0], P[k * 3 + 1] - a[1], P[k * 3 + 2] - a[2]];
        const n = [
          e1[1] * e2[2] - e1[2] * e2[1],
          e1[2] * e2[0] - e1[0] * e2[2],
          e1[0] * e2[1] - e1[1] * e2[0],
        ];
        const out = [a[0], a[1] - SHELL.widest, a[2] - SHELL.z0];
        expect(n[0] * out[0] + n[1] * out[1] + n[2] * out[2]).toBeGreaterThanOrEqual(-1e-12);
      }
    }
  });

  it("is what the headlamp is strapped to", () => {
    const front = shellAt(0.075, 0);
    const r = helmetReach(0, Math.atan2(front[1], front[2]));
    expect(r).toBeCloseTo(Math.hypot(front[1], front[2]), 4);
  });
});

describe("the goggles", () => {
  const frame = points(of("frame"));

  it("are a medium frame, bent round the face", () => {
    const [x0, x1] = span(frame, 0);
    const [y0, y1] = span(frame, 1);
    expect(x1 - x0).toBeGreaterThan(0.16);
    expect(x1 - x0).toBeLessThan(0.19);
    expect(y1 - y0).toBeGreaterThan(0.09);
    expect(y1 - y0).toBeLessThan(0.105);
  });

  it("are tucked under the brim with no gap, nearly flush with it", () => {
    const top = GOGGLES.mid + GOGGLES.tall;
    expect(edgeAt(0) - top).toBeGreaterThanOrEqual(0);
    expect(edgeAt(0) - top).toBeLessThan(0.005);
    const brim = shellAt(edgeAt(0), 0)[2];
    expect(GOGGLES.front - brim).toBeGreaterThan(0);
    expect(GOGGLES.front - brim).toBeLessThan(0.015);
  });
});

describe("the triangles", () => {
  it("are whole: every index a vertex, every normal a unit", () => {
    for (const p of parts) {
      const n = p.position.length / 3;
      expect(p.normal.length).toBe(p.position.length);
      for (const i of p.index) expect(i).toBeLessThan(n);
      for (let v = 0; v < n; v++) {
        const l = Math.hypot(p.normal[v * 3], p.normal[v * 3 + 1], p.normal[v * 3 + 2]);
        expect(l, `${p.material} normal ${v}`).toBeCloseTo(1, 3);
      }
      if (p.uv) expect(p.uv.length).toBe(n * 2);
    }
  });

  it("stay inside the head's budget, most of them on the shell the chase camera sees", () => {
    const t = helmetTriangles();
    const total = Object.values(t).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(3400);
    expect((t.shell + t.stripe + t.trim) / total).toBeGreaterThan(0.5);
    const fine = Object.values(helmetTriangles(2)).reduce((a, b) => a + b, 0);
    expect(fine).toBeGreaterThan(total * 2.5);
  });
});
