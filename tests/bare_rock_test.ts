// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// BARE ROCK TAKES NO TRAIL (`pwa/src/game/bare-rock.ts`): where a steep face
// is drawn as stone, a ski's stamps are dropped, the snowpack has nothing to
// throw or press, and the rider is drawn on the ground rather than sunk
// into a furrow that is not there.

import { describe, expect, it } from "vitest";
import type { Level, RegionId, SkierState, SnowContact } from "@engine";

import { bareRockOf, offRock } from "../pwa/src/game/bare-rock.ts";
import { regionLookOf } from "../pwa/src/game/region-look.ts";
import { rideSink } from "../pwa/src/game/ride-sink.ts";
import { snowAt, snowpackOf } from "../pwa/src/game/snowpack.ts";
import type { Stamp } from "../pwa/src/game/trail-stamp.ts";

/** How far out the face is `slope` m per m steep, m. */
const RUN = 40;
const X = (slope: number): number => slope * RUN;

/** A face whose slope (m per m) steepens with x — `x / RUN` m per m at x,
 * gently enough that the snow banked at the rock's foot (`rock-lip.ts`)
 * lies over a sliver of it — and packed where z < 0. */
function face(region: RegionId): Pick<Level, "normalAt" | "packedAt" | "region"> {
  return {
    region,
    packedAt: (_x, z) => (z < 0 ? 1 : 0),
    normalAt: (x, _z, out) => {
      const l = Math.hypot(x / RUN, 1);
      out.x = -x / RUN / l;
      out.y = 1 / l;
      out.z = 0;
      return out;
    },
  };
}

const stamp = (x: number, z = 1): Stamp => ({
  ax: x,
  az: z,
  bx: x,
  bz: z,
  half: 0.05,
  depth: 0.1,
  berm: 0.03,
  wall: 0.25,
  slough: 0.01,
});

describe("bare rock", () => {
  const rock = regionLookOf("continental").rock!;
  const bare = bareRockOf(face("continental"))!;

  it("is the shader's share: none under the region's slope, whole past it, none packed", () => {
    expect(bare(X(rock.from - 0.05), 1)).toBe(0);
    expect(bare(X(rock.to + 0.1), 1)).toBe(1);
    expect(bare(X(rock.to + 0.1), -1)).toBe(0);
  });

  it("cuts its edge crisp, the snow banked over the foot of it", () => {
    // Across the slope's whole ramp (18 m of this face) the edge is a band
    // of a metre or two, partly rock, and the rock starts past where the
    // slope first passes half its share.
    const xs: number[] = [];
    for (let x = X(rock.from); x <= X(rock.to) + 6; x += 0.05) xs.push(x);
    const partial = xs.filter((x) => bare(x, 1) > 0.02 && bare(x, 1) < 0.98).length * 0.05;
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(4);
    const first = xs.find((x) => bare(x, 1) > 0.5)!;
    expect(first).toBeGreaterThan(X((rock.from + rock.to) / 2));
  });

  it("is nothing in a region that draws no rock", () => {
    expect(regionLookOf("maritime").rock).toBeNull();
    expect(bareRockOf(face("maritime"))).toBeNull();
  });

  it("drops the stamps laid on it and presses the edge's by the snow left", () => {
    let mid = X(rock.from);
    while (bare(mid, 1) < 0.3) mid += 0.01;
    const stamps = [
      stamp(X(0.2)),
      stamp(X(rock.to + 0.1)),
      stamp(mid),
      stamp(X(rock.to + 0.1), -1),
    ];
    const kept = stamps[0];
    offRock(stamps, bare);
    expect(stamps.length).toBe(3);
    expect(stamps[0]).toBe(kept);
    expect(kept.depth).toBe(0.1);
    expect(stamps[1].depth).toBeGreaterThan(0.02);
    expect(stamps[1].depth).toBeLessThan(0.08);
    expect(stamps[1].berm).toBeLessThan(0.03);
    // On the packed snow below the face the groomer holds it.
    expect(stamps[2].depth).toBe(0.1);
  });

  it("leaves the stamps before `from` alone", () => {
    const stamps = [stamp(X(rock.to + 0.1)), stamp(X(rock.to + 0.1))];
    offRock(stamps, bare, 1);
    expect(stamps.length).toBe(1);
  });

  it("holds no snow to throw or to press", () => {
    const level = {
      ...face("continental"),
      crust: undefined,
      iceAt: undefined,
      weather: undefined,
    } as unknown as Level;
    const pack = snowpackOf(level, { bare });
    const on = snowAt(pack, X(rock.to + 0.1), 1);
    expect(on.loose).toBe(0);
    expect(on.give).toBe(0);
    const off = snowAt(pack, X(0.2), 1);
    expect(off.loose).toBeGreaterThan(0.5);
    expect(snowAt(snowpackOf(level), X(rock.to + 0.1), 1).loose).toBeGreaterThan(0.5);
  });

  it("stands the rider on it, not down in a furrow", () => {
    const contact = (x: number): SnowContact =>
      ({ station: "mid", touching: true, x, z: 1, sink: 0.06, load: 1 }) as SnowContact;
    const skier = (x: number) =>
      ({ spec: {}, contacts: [contact(x), contact(x)] }) as unknown as SkierState;
    const level = { ...face("continental"), groundAt: () => 0 };
    // In powder he is let down into the furrow he cut...
    expect(rideSink(skier(X(0.2)), level, 1, true, undefined, bare)).toBeGreaterThanOrEqual(0);
    // ...on rock lifted out of the sink and the cover onto the stone.
    expect(rideSink(skier(X(rock.to + 0.1)), level, 1, true, undefined, bare)).toBeCloseTo(
      -0.16,
      5,
    );
  });
});
