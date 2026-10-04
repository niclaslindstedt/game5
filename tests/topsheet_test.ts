// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TOPSHEETS AND THE TRACED LOOKS — the data the pairs are dressed and
// drawn from (`ski-topsheets.ts`, `ski-looks.ts`), held to what the builder
// assumes: every pair sold in ONE topsheet of its own (nothing to pick, and
// nothing kept of a pick), each pattern's decals inside the ski's outline;
// and every traced look carried onto its spec without a stretch, the tail
// and the tip where the spec's length puts them, the boots under the
// skier's feet, and the widths drawing the sidecut the spec carves.

import { describe, expect, it } from "vitest";
import { SKI_CATALOG, isSkiId } from "@engine";

import { freshSettings, mergeSettings } from "../pwa/src/game/settings.ts";
import { PATTERNS, TOPSHEETS } from "../pwa/src/game/ski-topsheets.ts";
import { SKI_LOOKS, halfWidth, lookFrame } from "../pwa/src/game/ski-looks.ts";
import { MOUNTS } from "../pwa/src/game/skier-pose.ts";

describe("the topsheets", () => {
  it("dress every pair in one of its own, no two alike", () => {
    expect(Object.keys(TOPSHEETS).sort()).toEqual(SKI_CATALOG.map((s) => s.id).sort());
    expect(Object.keys(TOPSHEETS).every(isSkiId)).toBe(true);
    const sheets = Object.values(TOPSHEETS);
    expect(new Set(sheets.map((l) => `${l.body}:${l.pattern}`)).size).toBe(sheets.length);
    expect(new Set(sheets.map((l) => l.name)).size).toBe(sheets.length);
  });

  it("lays every decal inside the ski's outline", () => {
    // `u` runs the ski's length, tail to tip; `v` is across it, centred,
    // so a decal reaches at most half a width either side.
    for (const p of Object.values(PATTERNS)) {
      for (const decal of p.top) {
        expect(decal.length).toBeGreaterThanOrEqual(3);
        for (const [u, v] of decal) {
          expect(u).toBeGreaterThanOrEqual(-0.1);
          expect(u).toBeLessThanOrEqual(1.1);
          expect(v).toBeGreaterThanOrEqual(-1);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
      if (p.split !== undefined) {
        expect(p.split).toBeGreaterThan(0);
        expect(p.split).toBeLessThan(1);
      }
    }
  });

  it("keeps no pick: a stored one from an older build is dropped", () => {
    const merged = mergeSettings({ topsheets: { hare: 2, eagle: 1 } }) as unknown as Record<
      string,
      unknown
    >;
    expect(merged.topsheets).toBeUndefined();
    expect("topsheets" in freshSettings()).toBe(false);
  });
});

describe("the traced looks", () => {
  it("carry every class's trace onto its pair without a stretch", () => {
    for (const s of SKI_CATALOG) {
      const F = lookFrame(s);
      expect(F.look).toBe(SKI_LOOKS[s.id]);
      expect(F.stretch, s.id).toBeGreaterThan(0.97);
      expect(F.stretch, s.id).toBeLessThan(1.03);
      // The tail and the tip are the spec's length apart, the boot between
      // them under the body's origin, and the base on the snow.
      expect(F.tip - F.tail).toBeCloseTo(s.length, 6);
      expect(F.tail).toBeLessThan(F.boot);
      expect(F.tip).toBeGreaterThan(F.boot);
      expect(F.y(0)).toBeCloseTo(-s.cogHeight, 6);
    }
  });

  it("shape every ski as a ski: a shovel that rises, a waist under the boot", () => {
    for (const s of SKI_CATALOG) {
      const look = SKI_LOOKS[s.id];
      expect(look.tip.rise).toBeGreaterThan(0);
      expect(look.tip.length).toBeGreaterThan(0);
      expect(look.tip.length + look.tail.length).toBeLessThan(s.length);
      expect(look.boot.length).toBeGreaterThan(0);
      expect(look.pole.length).toBeGreaterThan(0.8);
    }
  });

  it("draw the sidecut the spec carves: the circle through the widths", () => {
    // The edge between the drawn plan's widest points — the shoulder near
    // the tip, the corner near the tail — bows in by the side depth, and
    // the circle through the three is R ≈ c² / 8d. A race pair is cut to
    // its radius within a few per cent; the rockered and twin-tipped pairs
    // run a little off it, and none by more than a sixth.
    for (const s of SKI_CATALOG) {
      const look = SKI_LOOKS[s.id];
      const widest = (from: number, to: number): number => {
        let best = from;
        for (let x = from; x <= to; x += 0.001) {
          if (halfWidth(s, look, x) > halfWidth(s, look, best)) best = x;
        }
        return best;
      };
      const chord = widest(s.length / 2, s.length) - widest(0, s.length / 2);
      const depth = ((s.tipWidth + s.tailWidth) / 2 - s.waist) / 2;
      const radius = (chord * chord) / (8 * depth);
      expect(radius / s.sidecut, s.id).toBeGreaterThan(0.85);
      expect(radius / s.sidecut, s.id).toBeLessThan(1.15);
    }
  });

  it("stand the boots where the skier's feet are", () => {
    // The ankles sit over the boots' cuffs: half the stance apart, a hair
    // ahead of the boot centre, which every look puts under the origin.
    for (const s of SKI_CATALOG) {
      const F = lookFrame(s);
      expect(Math.abs(F.boot - MOUNTS.foot.z), s.id).toBeLessThan(0.1);
      expect(s.stance / 2).toBeCloseTo(MOUNTS.foot.x, 1);
    }
  });
});
