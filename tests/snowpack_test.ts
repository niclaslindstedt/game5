// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWPACK as the picture reads it (`pwa/src/game/snowpack.ts`): six
// kinds of snow, which lies where, and what each does to a skier's furrow and
// an animal's print (`trail-stamp.ts`, `beast-tracks.ts`).

import { describe, expect, it } from "vitest";
import { createHeightfield, fillField, sampleField, type Level, type SnowContact } from "@engine";

import { beastById } from "../pwa/src/game/beast-defs.ts";
import { footfall } from "../pwa/src/game/beast-tracks.ts";
import {
  SNOW,
  SNOW_KINDS,
  blend,
  emptyMix,
  kindAt,
  printGive,
  snowAt,
  snowMix,
  snowpackOf,
  type SnowKind,
} from "../pwa/src/game/snowpack.ts";
import {
  TRAIL,
  createPen,
  drawnDepth,
  furrowProfile,
  stampsOf,
  wallPower,
  type Stamp,
} from "../pwa/src/game/trail-stamp.ts";

function contact(over: Partial<SnowContact> = {}): SnowContact {
  return {
    kind: "ski",
    station: "mid",
    side: 1,
    x: 0,
    y: 0,
    z: 0,
    sink: 0.01,
    width: 0.4,
    compression: 0.05,
    load: 400,
    touching: true,
    ...over,
  };
}

/** A strip of ALPINE country along x: the groomed track under x < 40, soft
 * powder to x = 100, a wind crust past it, and the river's ice past 300. */
function strip(weather: Level["weather"] = undefined) {
  const crust = createHeightfield(0, 0, 2, 201, 11);
  fillField(crust, (x) => (x > 100 ? 1 : 0));
  const hold = 0.55;
  return {
    region: "fell" as const,
    crust,
    weather,
    packedAt: (x: number, z: number) => (x < 40 ? 1 : sampleField(crust, x, z) * hold),
    iceAt: (x: number) => (x > 300 ? 1 : 0),
  };
}

const sum = (m: Record<SnowKind, number>) => SNOW_KINDS.reduce((a, k) => a + m[k], 0);

describe("the kinds of snow", () => {
  it("run from the fluffiest to the ice by density, as the field bands do", () => {
    const d = (k: SnowKind) => SNOW[k].density;
    expect(d("new")).toBeLessThan(d("soft"));
    expect(d("soft")).toBeLessThan(d("hard"));
    expect(d("hard")).toBeLessThan(d("wet"));
    expect(d("wet")).toBeLessThan(d("groomed"));
    expect(d("groomed")).toBeLessThan(d("ice"));
  });

  it("hang as cloud in the order the fine snow does, and clump the other way", () => {
    expect(SNOW.new.fine).toBeGreaterThan(SNOW.soft.fine);
    expect(SNOW.soft.fine).toBeGreaterThan(SNOW.hard.fine);
    expect(SNOW.hard.fine).toBeGreaterThan(SNOW.wet.fine);
    expect(SNOW.wet.clumps).toBeGreaterThan(SNOW.hard.clumps);
    expect(SNOW.hard.clumps).toBeGreaterThan(SNOW.soft.clumps);
    expect(SNOW.soft.clumps).toBeGreaterThan(SNOW.new.clumps);
    expect(SNOW.ice.loose).toBe(0);
  });

  it("keep settled powder as the picture the game had before", () => {
    const c = contact({ kind: "ski" });
    expect(drawnDepth(c, 0, 1, 1, SNOW.soft)).toBeCloseTo(drawnDepth(c, 0), 6);
    expect(wallPower(TRAIL.wall)).toBeCloseTo(4, 6);
    expect(furrowProfile(0.05, 0.1).press).toBeCloseTo(1 - 0.5 ** 4, 6);
    expect(blend({ ...emptyMix(), soft: 1 }).give).toBe(1);
  });
});

describe("which snow lies where", () => {
  it("reads the groomer, the powder, the crust and the ice off the map", () => {
    const pack = snowpackOf(strip());
    expect(kindAt(pack, 10, 10)).toBe("groomed");
    expect(kindAt(pack, 70, 10)).toBe("soft");
    expect(kindAt(pack, 200, 10)).toBe("hard");
    expect(kindAt(pack, 350, 10)).toBe("ice");
    for (const x of [10, 70, 101, 200, 350]) expect(sum(snowMix(pack, x, 10))).toBeCloseTo(1, 6);
  });

  it("buries it all but the ice under new snow, from the sky and from the run", () => {
    const fallen = snowpackOf(strip(), { fresh: 0.2 });
    for (const x of [10, 70, 200]) expect(kindAt(fallen, x, 10)).toBe("new");
    expect(kindAt(fallen, 350, 10)).toBe("ice");
    const storm = snowpackOf(
      strip({ kind: "storm", snowfall: 1, fog: 0, wind: 10, windFrom: 0, evening: false }),
    );
    expect(storm.laid).toBeGreaterThan(0.1);
    expect(kindAt(storm, 70, 10)).toBe("new");
    // The night's fall lies off the piste: the groomer is buried only by
    // what falls during the run, as the physics has it.
    expect(kindAt(storm, 10, 10)).toBe("groomed");
    for (const x of [10, 70, 101, 200, 350]) expect(sum(snowMix(storm, x, 10))).toBeCloseTo(1, 6);
  });

  it("goes wet under a high sun, never while it snows, less under a lid", () => {
    const high = 0.7;
    const clear = snowpackOf(strip(), { elevation: high });
    expect(kindAt(clear, 70, 10)).toBe("wet");
    expect(kindAt(clear, 10, 10)).toBe("groomed");
    expect(snowpackOf(strip(), { elevation: 0.1 }).wet).toBe(0);
    const lid = snowpackOf(
      strip({ kind: "overcast", snowfall: 0, fog: 0, wind: 3, windFrom: 0, evening: false }),
      { elevation: high },
    );
    expect(lid.wet).toBeLessThan(clear.wet);
    const snowing = snowpackOf(
      strip({ kind: "snow", snowfall: 0.5, fog: 0, wind: 5, windFrom: 0, evening: false }),
      { elevation: high },
    );
    expect(snowing.wet).toBe(0);
  });

  it("lays one kind everywhere for a lab, and scales the loose snow by the dial", () => {
    const pack = snowpackOf(strip(), { force: "wet" });
    for (const x of [10, 200, 350]) expect(kindAt(pack, x, 10)).toBe("wet");
    const deep = snowAt(snowpackOf(strip(), { depth: 2 }), 70, 10);
    const shallow = snowAt(snowpackOf(strip(), { depth: 0.5 }), 70, 10);
    expect(deep.loose).toBeGreaterThan(shallow.loose);
    expect(deep.give).toBeGreaterThan(shallow.give);
    // The dial leaves the groomer alone, as it leaves the physics' alone.
    expect(snowAt(snowpackOf(strip(), { depth: 2 }), 10, 10).give).toBeCloseTo(SNOW.groomed.give);
  });
});

describe("what the snow does to a track", () => {
  it("takes a skier's furrow deepest in new snow and shallowest on the groomer", () => {
    const c = contact();
    const at = (k: SnowKind) => drawnDepth(c, 0, 1, 1, SNOW[k]);
    expect(at("new")).toBeGreaterThan(at("soft"));
    expect(at("soft")).toBeGreaterThan(at("wet"));
    expect(at("wet")).toBeGreaterThan(at("hard"));
    expect(at("hard")).toBeGreaterThan(at("groomed"));
    // ...and never shallower than the physics' own sink.
    expect(drawnDepth(contact({ sink: 0.2 }), 0, 1, 1, SNOW.groomed)).toBeCloseTo(0.2, 6);
  });

  it("stamps the snow's walls and berm with every capsule", () => {
    const out: Stamp[] = [];
    const pen = createPen(1);
    const probe = [contact({ x: 0 })];
    stampsOf(
      probe,
      pen,
      () => 0,
      400,
      out,
      1,
      () => SNOW.wet,
    );
    probe[0] = contact({ x: 1 });
    stampsOf(
      probe,
      pen,
      () => 0,
      400,
      out,
      1,
      () => SNOW.wet,
    );
    const s = out[out.length - 1];
    expect(s.wall).toBe(SNOW.wet.wall);
    expect(s.berm).toBeCloseTo(Math.min(TRAIL.maxBerm, s.depth * SNOW.wet.berm), 6);
    // Square walls stay deep further out than sloughed ones.
    expect(furrowProfile(0.08, 0.1, 1).press).toBeGreaterThan(furrowProfile(0.08, 0.1, 0).press);
  });

  it("carries a fox over a crust that a moose goes through", () => {
    const fox = beastById("fox");
    const moose = beastById("moose");
    expect(printGive(SNOW.hard, fox.sink)).toBeLessThan(0.2);
    expect(printGive(SNOW.hard, moose.sink)).toBeGreaterThan(printGive(SNOW.hard, fox.sink));
    expect(printGive(SNOW.soft, fox.sink)).toBe(1);
    const depth = (spec: typeof fox, k: SnowKind) => {
      const out: Stamp[] = [];
      footfall(spec, 0, 0, 0, 0, 0, out, SNOW[k]);
      return out[0].depth / spec.prints.depth;
    };
    expect(depth(fox, "new")).toBeGreaterThan(depth(fox, "soft"));
    expect(depth(fox, "hard")).toBeLessThan(depth(moose, "hard"));
    // Left unsaid, a print is in settled powder over the packed field.
    const plain: Stamp[] = [];
    footfall(fox, 0, 0, 0, 0, 0, plain);
    expect(plain[0].depth).toBeCloseTo(fox.prints.depth, 6);
  });
});
