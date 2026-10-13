// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RETRO LOOK: the RIDER card's eighties colourways read and kept on an
// outfit, and the wind that swings the scarf's tails and the bobble
// (`retro-wind.ts`) — hanging at rest, streaming at speed, out of his body.
import { describe, expect, it } from "vitest";

import { DEFAULT_OUTFIT, LOOKS, outfitOf } from "../pwa/src/game/outfit.ts";
import { outfitKey } from "../pwa/src/game/dress.ts";
import { RETRO_CHAINS, RETRO_COLOURWAYS } from "../pwa/src/game/retro-look.ts";
import { createRetroWind, FEEL, type ChainRest, type Mat } from "../pwa/src/game/retro-wind.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

/** A bone's world frame: no turn, its origin at `at`. */
const frameAt = (x: number, y: number, z: number): Mat => [
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  x,
  y,
  z,
  1,
];

/** A tail of six links hanging 0.66 m straight down off a root at the
 * bone's origin. */
const TAIL: ChainRest = {
  name: "scarf_a",
  anchor: 0,
  joints: Array.from({ length: 7 }, (_, k) => ({ x: 0, y: -0.11 * k, z: 0.12 })),
  feel: FEEL.scarf,
};

function ride(
  speed: number,
  seconds: number,
  colliders = [{ bone: 0, at: { x: 0, y: -0.3, z: 0 }, r: 0.1 }],
) {
  const wind = createRetroWind([TAIL], colliders);
  const dt = 1 / 60;
  for (let i = 0; i <= seconds / dt; i++) {
    // The rider runs ahead along +z; the air past him blows back at -speed.
    wind.step([frameAt(0, 1.4, speed * i * dt)], dt);
  }
  const p = wind.points()[0];
  return { root: p[0], tip: p[p.length - 1], points: p };
}

describe("the retro look", () => {
  it("is offered as the modern kit and every colourway, and kept only when known", () => {
    expect(LOOKS).toEqual(["modern", ...RETRO_COLOURWAYS.map((c) => `retro-${c.id}`)]);
    expect(outfitOf({ ...DEFAULT_OUTFIT, look: "retro-magenta" }).look).toBe("retro-magenta");
    expect(outfitOf({ ...DEFAULT_OUTFIT, look: "retro-nope" }).look).toBeUndefined();
    expect(outfitOf(DEFAULT_OUTFIT).look).toBeUndefined();
  });

  it("dresses a skier apart: a look is its own key", () => {
    const retro = outfitKey({ ...DEFAULT_OUTFIT, look: "retro-cobalt" });
    expect(retro).not.toBe(outfitKey(DEFAULT_OUTFIT));
    expect(outfitKey({ ...DEFAULT_OUTFIT, look: "modern" })).toBe(outfitKey(DEFAULT_OUTFIT));
  });

  it("is read off a link for the visit", () => {
    expect(readParams("?look=retro-canary").look).toBe("retro-canary");
    expect(readParams("?look=pyjamas").look).toBeNull();
  });

  it("names the parts that fly as the builder lays them", () => {
    expect(RETRO_CHAINS.map((c) => c.name)).toEqual(["scarf_a", "scarf_b", "bobble"]);
  });
});

describe("the wind on the scarf", () => {
  it("leaves a tail hanging when he stands", () => {
    const { root, tip } = ride(0, 3, []);
    expect(root.y - tip.y).toBeGreaterThan(0.55);
    expect(Math.abs(tip.z - root.z)).toBeLessThan(0.15);
  });

  it("streams it out behind him at speed", () => {
    const { root, tip } = ride(20, 3, []);
    // Behind (−z) by most of its length, and lifted off the hang.
    expect(root.z - tip.z).toBeGreaterThan(0.45);
    expect(root.y - tip.y).toBeLessThan(0.4);
  });

  it("holds every link to its length", () => {
    const { points } = ride(15, 2, []);
    for (let k = 1; k < points.length; k++) {
      const d = Math.hypot(
        points[k].x - points[k - 1].x,
        points[k].y - points[k - 1].y,
        points[k].z - points[k - 1].z,
      );
      expect(d).toBeCloseTo(0.11, 2);
    }
  });

  it("keeps it out of his body", () => {
    const { points } = ride(0, 2);
    for (const p of points.slice(1)) {
      expect(Math.hypot(p.x, p.y - (1.4 - 0.3), p.z) + 1e-6).toBeGreaterThanOrEqual(0.1);
    }
  });
});
