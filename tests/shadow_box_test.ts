// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Where the sun's shadow stands, and which trees cast into it
// (`pwa/src/game/shadow-box.ts`).

import { describe, expect, it } from "vitest";

import {
  aimShadow,
  castsInto,
  HERO_BACK,
  HERO_DEPTH,
  heroFrame,
  SHADOW_AHEAD,
  SHADOW_MARGIN,
  SHADOW_TAIL,
  shadowFade,
  shadowLength,
  type ShadowBox,
} from "../pwa/src/game/shadow-box.ts";
import { SHADOW_LEVELS, SHADOW_LOOK } from "../pwa/src/game/settings-video.ts";

/** A box at the origin, reach 60, the sun `elevation` rad up in the +x
 * quarter (so shadows fall toward −x). */
function boxAt(elevation: number, reach = 60): ShadowBox {
  return {
    x: 0,
    y: 0,
    z: 0,
    reach,
    sx: Math.cos(elevation),
    sy: Math.sin(elevation),
    sz: 0,
  };
}

describe("the shadow box (shadow-box.ts)", () => {
  it("stands ahead of the lens, along its look in plan", () => {
    const box = aimShadow(boxAt(0.3), 100, 50, 0, 2, 60);
    expect(box.x).toBeCloseTo(100);
    expect(box.z).toBeCloseTo(50 + SHADOW_AHEAD * 60);
    // A lens looking straight down keeps its own spot.
    const down = aimShadow(boxAt(0.3), 100, 50, 0, 0, 60);
    expect([down.x, down.z]).toEqual([100, 50]);
  });

  it("fades out over the rim, never before the lens", () => {
    for (const level of SHADOW_LEVELS) {
      const { reach } = SHADOW_LOOK[level];
      if (reach === 0) continue;
      const [inner, outer] = shadowFade(reach);
      expect(inner).toBeLessThan(outer);
      expect(outer).toBe(reach);
      // The lens stands SHADOW_AHEAD reaches behind the centre: whole there.
      expect(SHADOW_AHEAD * reach).toBeLessThan(inner);
      expect(SHADOW_MARGIN).toBeGreaterThan(0);
    }
  });

  it("throws a longer shadow the lower the sun, capped", () => {
    expect(shadowLength(boxAt(Math.PI / 4), 10)).toBeCloseTo(10);
    expect(shadowLength(boxAt(0.2), 10)).toBeGreaterThan(40);
    expect(shadowLength(boxAt(0.001), 10)).toBe(SHADOW_TAIL * 60);
    // A sun overhead throws none.
    expect(shadowLength({ ...boxAt(0), sx: 0, sy: 1 }, 10)).toBe(0);
  });

  it("casts every tree whose shadow reaches the circle, and no other", () => {
    const box = boxAt(Math.atan(1 / 2)); // shadows twice the tree's height
    // Inside the circle, whichever way.
    expect(castsInto(box, 30, 30, 10, 2)).toBe(true);
    // Up-sun past the rim, its 20 m shadow reaching back in.
    expect(castsInto(box, 75, 0, 10, 2)).toBe(true);
    // Up-sun too far for its shadow to arrive.
    expect(castsInto(box, 90, 0, 10, 2)).toBe(false);
    // Down-sun past the rim: its shadow falls away from the circle.
    expect(castsInto(box, -70, 0, 10, 2)).toBe(false);
    // Across the sun, past the rim.
    expect(castsInto(box, 0, 70, 10, 2)).toBe(false);
  });
});

describe("the riders' own shadow maps (shadow-box.ts heroFrame)", () => {
  it("draws every rider at millimetres a texel on the stops that give him a map", () => {
    for (const level of SHADOW_LEVELS) {
      const { size, reach, hero } = SHADOW_LOOK[level];
      if (hero === 0) continue;
      // The machine's bound (`skis-body.ts` / `posed-merge.ts`) is 3.2 m.
      const own = heroFrame(3.2, hero).texel;
      const wide = (2 * (reach + SHADOW_MARGIN)) / size;
      expect(own).toBeLessThan(0.01);
      expect(own).toBeLessThan(wide / 5);
    }
  });

  it("grows with a thrown rider's bound, and keeps its offsets under a few centimetres", () => {
    const near = heroFrame(3.2, 2048);
    const thrown = heroFrame(12, 2048);
    expect(thrown.half).toBeGreaterThan(near.half);
    expect(thrown.texel).toBeGreaterThan(near.texel);
    expect(near.normalBias).toBeLessThan(0.02);
    expect(near.depthBias * (HERO_BACK + HERO_DEPTH)).toBeLessThanOrEqual(0.03);
  });
});

describe("the shadow's fade, grafted into every world material (haze.ts)", () => {
  it("wraps the directional light's shadow, and only it, in shadowFaded", async () => {
    const { lightsWithFade } = await import("../pwa/src/game/haze.ts");
    const chunk = lightsWithFade();
    expect(chunk.match(/shadowFaded\(/g)?.length).toBe(1);
    expect(chunk).toContain(
      "shadowFaded( shadowGone() ? 1.0 : getShadow( directionalShadowMap[ i ]",
    );
  });

  it("takes the rider's own map with the wide one, once", async () => {
    const { lightsWithFade } = await import("../pwa/src/game/haze.ts");
    const chunk = lightsWithFade();
    expect(chunk.match(/heroShadowed\(/g)?.length).toBe(1);
    expect(chunk).toContain("heroShadowed( shadowFaded( shadowGone() ? 1.0 : getShadow(");
    expect(chunk).toContain("), geometryNormal ) : 1.0;");
  });
});
