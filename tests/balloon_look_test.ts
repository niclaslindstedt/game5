// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON AS DRAWN (`balloon-look.ts`): the envelope held to the
// engine's own `BALLOON` — its volume, height, widest girth and where it
// falls, its mouth and its gores — and to a sport balloon's look (a natural
// shape, panels about a metre and a half, lobes between the tapes), the
// mesh finite and closed round, the wires to the burner frame, the basket
// and what stands in it, the paint dealt off the seed and its rule, and
// the envelope laid on the snow on the snow.

import { describe, expect, it } from "vitest";
import { BALLOON } from "@engine";

import {
  BASKET_LOOK,
  BURNER_LOOK,
  DRAWN_HEIGHT,
  ENVELOPE_LOOK,
  EQUATOR_ROW,
  PALETTES,
  PAINT_GLSL,
  SCHEMES,
  colourwayOf,
  drawnVolume,
  envelopeLayout,
  everyColourway,
  laidPoint,
  lobedRadius,
  meridianAt,
  paintSlot,
  profile,
  ventArc,
  wickerTexels,
  wirePlan,
} from "../pwa/src/game/balloon-look.ts";

const E = BALLOON.envelope;
const K = BALLOON.basket;

describe("the balloon's envelope", () => {
  it("holds the class's volume", () => {
    const v = drawnVolume();
    expect(v).toBeGreaterThan(E.volume * 0.95);
    expect(v).toBeLessThan(E.volume * 1.05);
  });

  it("is a natural shape of the engine's measures", () => {
    const p = profile();
    const n = p.r.length;
    expect(p.r[0]).toBeCloseTo(E.mouth / 2, 6);
    expect(p.y[n - 1]).toBeCloseTo(E.height, 6);
    let widest = 0;
    let at = 0;
    for (let i = 0; i < n; i++) {
      if (p.r[i] > widest) {
        widest = p.r[i];
        at = p.y[i];
      }
    }
    expect(widest * 2).toBeCloseTo(E.diameter, 3);
    expect(at).toBeCloseTo(E.equator, 1);
    // The lower cone leaves the mouth at 20–40° off the axis, and the crown
    // is rounded: the height over the girth within a fifth of the radius.
    const m = meridianAt(0.5);
    const cone = (Math.atan2(m.dr, m.dy) * 180) / Math.PI;
    expect(cone).toBeGreaterThan(20);
    expect(cone).toBeLessThan(40);
    expect(Math.abs(E.height - E.equator - E.diameter / 2)).toBeLessThan(E.diameter / 10);
    // Taller than it is wide, as a natural shape stands.
    expect(E.height / E.diameter).toBeGreaterThan(1);
  });

  it("is sewn of panels about a metre and a half up its gores", () => {
    const panel = ventArc() / ENVELOPE_LOOK.rows;
    expect(panel).toBeGreaterThan(1.2);
    expect(panel).toBeLessThan(1.8);
    expect(EQUATOR_ROW).toBeGreaterThan(3);
    expect(EQUATOR_ROW).toBeLessThan(ENVELOPE_LOOK.rows - 2);
  });

  it("bulges between its tapes and nowhere past its girth", () => {
    expect(lobedRadius(1, 0.5)).toBeCloseTo(1, 9);
    expect(lobedRadius(1, 0)).toBeLessThan(1);
    expect(lobedRadius(1, 0.25)).toBeGreaterThan(lobedRadius(1, 0));
  });

  it("is a finite mesh round all its gores, the cap and the skirt", () => {
    const L = envelopeLayout();
    expect(L.position.every(Number.isFinite)).toBe(true);
    expect(L.normal.every(Number.isFinite)).toBe(true);
    expect(L.index.every((i) => i < L.vertices)).toBe(true);
    const gores = new Set<number>();
    let skirt = 0;
    let cap = 0;
    for (let i = 0; i < L.vertices; i++) {
      gores.add(L.panel[i * 4]);
      if (L.panel[i * 4 + 1] < 0) skirt++;
      if (L.panel[i * 4 + 1] === ENVELOPE_LOOK.rows) cap++;
      // Every normal points out of the axis's side or up over the crown.
      const x = L.position[i * 3];
      const z = L.position[i * 3 + 2];
      const out = x * L.normal[i * 3] + z * L.normal[i * 3 + 2];
      if (Math.hypot(x, z) > 0.5) expect(out).toBeGreaterThan(0);
    }
    expect(gores.size).toBe(E.gores);
    expect(skirt).toBeGreaterThan(0);
    expect(cap).toBeGreaterThan(0);
    // A few thousand triangles: one balloon on screen.
    expect(L.index.length / 3).toBeLessThan(20000);
  });

  it("stands about fourteen to twenty baskets tall", () => {
    const ratio = DRAWN_HEIGHT / K.wall;
    expect(ratio).toBeGreaterThan(14);
    expect(ratio).toBeLessThan(24);
  });
});

describe("the balloon's rigging and basket", () => {
  it("hangs a wire off every load tape, four to a corner of the frame", () => {
    const wires = wirePlan();
    expect(wires.length).toBe(E.gores);
    const corners = new Map<string, number>();
    for (const w of wires) {
      const key = `${w.corner[0]},${w.corner[2]}`;
      corners.set(key, (corners.get(key) ?? 0) + 1);
      expect(Math.hypot(w.top[0], w.top[2])).toBeCloseTo(E.mouth / 2, 6);
      // From the mouth over the frame, 2–3.5 m of cable.
      const len = Math.hypot(
        w.top[0] - w.corner[0],
        E.mouthHeight - w.corner[1],
        w.top[2] - w.corner[2],
      );
      expect(len).toBeGreaterThan(2);
      expect(len).toBeLessThan(3.5);
    }
    expect([...corners.values()]).toEqual([4, 4, 4, 4]);
  });

  it("puts the burner under the mouth, its outlets where the engine has them", () => {
    expect(BURNER_LOOK.outlet).toBe(K.burner);
    expect(BURNER_LOOK.frameY).toBeLessThan(K.burner);
    expect(BURNER_LOOK.frameY).toBeGreaterThan(K.wall + 0.8);
    expect(E.mouthHeight - BURNER_LOOK.outlet).toBeGreaterThan(1.5);
    // The coils fit in the frame.
    expect(BURNER_LOOK.coilX + BURNER_LOOK.coilR).toBeLessThan(BURNER_LOOK.frameHalf);
    // The skirt stops short of the frame it hangs over.
    expect(ENVELOPE_LOOK.skirt).toBeLessThan(E.mouthHeight - BURNER_LOOK.frameY);
  });

  it("stands three cylinders in the corners, under the rim and inside the wicker", () => {
    expect(BASKET_LOOK.cylinders.length).toBe(3);
    expect(BASKET_LOOK.cylH).toBeLessThan(K.wall);
    expect(BASKET_LOOK.cylIn).toBeGreaterThan(BASKET_LOOK.cylR + BASKET_LOOK.thick - 0.01);
    const free = BASKET_LOOK.cylinders.every(
      ([x, z]) => x !== BASKET_LOOK.rack[0] || z !== BASKET_LOOK.rack[1],
    );
    expect(free).toBe(true);
  });

  it("weaves its wicker into a tile that repeats", () => {
    const { colour, height } = wickerTexels(64);
    expect(colour.length).toBe(64 * 64 * 4);
    expect(Math.max(...height)).toBeGreaterThan(0.8);
    expect(Math.min(...height)).toBeLessThan(0.1);
    // A honey colour: red over green over blue.
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < colour.length; i += 4) {
      r += colour[i];
      g += colour[i + 1];
      b += colour[i + 2];
    }
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });
});

describe("the balloon's paint", () => {
  it("deals a colourway off the seed alone, and every pattern over a few seeds", () => {
    expect(colourwayOf(38)).toEqual(colourwayOf(38));
    const seen = new Set<number>();
    for (let s = 0; s < 200; s++) seen.add(colourwayOf(s).scheme);
    expect(seen.size).toBe(SCHEMES.length);
    expect(everyColourway().length).toBe(SCHEMES.length);
  });

  it("paints every panel from its palette, the skirt in the dark", () => {
    for (let scheme = 0; scheme < SCHEMES.length; scheme++) {
      for (let g = 0; g < E.gores; g++) {
        for (let row = -1; row <= ENVELOPE_LOOK.rows; row++) {
          for (const [u, v] of [
            [0.1, 0.1],
            [0.5, 0.5],
            [0.9, 0.8],
          ]) {
            const slot = paintSlot(scheme, g, row, u, v);
            expect(slot).toBeGreaterThanOrEqual(0);
            expect(slot).toBeLessThan(11);
            if (row < 0) expect(slot).toBe(4);
          }
        }
      }
    }
    for (const p of PALETTES) expect(p.length).toBe(5);
    // Two-colour gores alternate round the envelope.
    expect(paintSlot(0, 0, 5, 0.5, 0.5)).not.toBe(paintSlot(0, 1, 5, 0.5, 0.5));
    // The shader states the same rule (its rows and the equator's).
    expect(PAINT_GLSL).toContain(`int rows = ${ENVELOPE_LOOK.rows};`);
    expect(PAINT_GLSL).toContain(`int eq = ${EQUATOR_ROW};`);
  });
});

describe("the envelope laid on the snow", () => {
  // Flat but for its rucks: no fold of the cloth stands past 0.8 m.
  it("lies flat on the snow downwind of the mouth", () => {
    const ground = (x: number, z: number): number => 100 + 0.05 * x - 0.02 * z;
    const lay = { x: 2, z: 0, heading: Math.PI / 2, groundAt: ground, ox: 0, oy: 100, oz: 0 };
    const L = envelopeLayout();
    const out = new Float32Array(3);
    let far = 0;
    for (let i = 0; i < L.vertices; i++) {
      laidPoint(L.position[i * 3], L.position[i * 3 + 1], L.position[i * 3 + 2], lay, out, 0);
      const snow = ground(out[0], out[2]) - 100;
      expect(out[1]).toBeGreaterThanOrEqual(snow);
      expect(out[1] - snow).toBeLessThan(0.8);
      far = Math.max(far, out[0]);
    }
    // Its crown lies the envelope's height off the mouth, downwind (+x).
    expect(far).toBeGreaterThan(E.height * 0.85);
  });
});
