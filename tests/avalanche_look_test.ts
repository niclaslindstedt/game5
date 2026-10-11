// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE AS DRAWN (`avalanche-plan.ts`, the three-free half of
// `avalanche-view.ts`): the slab's frame round-trips, the bed is the slab's
// depth inside its crown and flanks and nothing outside them, the debris
// map carries the engine's own depth (`debrisDepth`) at every texel's
// middle, the plates stay inside the slab and under their budget, a chunk
// only rounds off, and the cloud's share, the quake and the rumble stay in
// their ranges. Its numbers are its own: nothing here moves a digest.

import { describe, expect, it } from "vitest";

import {
  AVALANCHE,
  AVALANCHE_CELL as CELL,
  NEUTRAL_INPUT,
  debrisDepth,
  placeRun,
  releaseAvalanche,
  step,
  type GameEvent,
  type SlabFrame,
} from "@engine";
import { LEE, avalancheRide } from "./support/avalanche-scenes.ts";
import {
  SLIDE_LOOK,
  bedDepth,
  chunkSize,
  cloudShare,
  crownAt,
  debrisAt,
  debrisBox,
  debrisBoxOf,
  debrisFits,
  plateBreak,
  plateGap,
  plateGrid,
  quakeAt,
  slabFrameOf,
  slabPhases,
  splatDebris,
} from "../pwa/src/game/avalanche-plan.ts";
import { rumbleForEvent, RUMBLE } from "../pwa/src/game/rumble.ts";
import { freeGameOptions, freshRide, mergeRide } from "../pwa/src/game/free-ride.ts";
import { FULL_ASSIST, SKIS } from "@engine";

const SLAB: SlabFrame = {
  x: 400,
  y: 900,
  z: 300,
  fx: 0.6,
  fz: 0.8,
  left: 22,
  right: 18,
  length: 120,
  depth: 0.6,
};

/** A whole flow, released on the lee test face and run to rest. */
function restedSlide() {
  const s = avalancheRide();
  placeRun(s, { x: LEE.x + 300, z: 200, heading: 0, speed: 0 });
  const slide = releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
  for (let i = 0; i < 120 * AVALANCHE.runMost && slide.running; i++) step(s, NEUTRAL_INPUT);
  return slide;
}

describe("the slab's frame", () => {
  it("round-trips a plan point through across and down the fall line", () => {
    const at = { u: 0, v: 0 };
    for (const [u, v] of [
      [0, 0],
      [10, 50],
      [-17, 3],
      [21.5, 119],
    ]) {
      const x = SLAB.x + SLAB.fz * u + SLAB.fx * v;
      const z = SLAB.z - SLAB.fx * u + SLAB.fz * v;
      slabFrameOf(SLAB, x, z, at);
      expect(at.u).toBeCloseTo(u, 9);
      expect(at.v).toBeCloseTo(v, 9);
    }
  });

  it("deals the same crown line to the same slab", () => {
    expect(slabPhases(SLAB)).toEqual(slabPhases({ ...SLAB }));
    expect(slabPhases(SLAB)).not.toEqual(slabPhases({ ...SLAB, x: SLAB.x + 1 }));
  });
});

describe("the bed", () => {
  const phase = slabPhases(SLAB);
  it("is the slab's depth in its middle under the crown and nothing off it", () => {
    const top = crownAt(phase, 0);
    expect(Math.abs(top)).toBeLessThanOrEqual(SLIDE_LOOK.crown.jog[0] + SLIDE_LOOK.crown.jog[1]);
    expect(bedDepth(SLAB, phase, 0, top + 1)).toBeCloseTo(SLAB.depth, 1);
    // Above the crown, past either flank, below the stauchwall: untouched.
    expect(bedDepth(SLAB, phase, 0, top - 0.5)).toBe(0);
    expect(bedDepth(SLAB, phase, SLAB.left + SLIDE_LOOK.flank.ragged + 0.1, 40)).toBe(0);
    expect(bedDepth(SLAB, phase, -SLAB.right - SLIDE_LOOK.flank.ragged - 0.1, 40)).toBe(0);
    expect(bedDepth(SLAB, phase, 0, SLAB.length + 0.1)).toBe(0);
  });

  it("never runs deeper than the slab, and the flanks are lower than the middle", () => {
    for (let u = -SLAB.right; u <= SLAB.left; u += 1.5) {
      for (let v = 0; v <= SLAB.length; v += 3) {
        const d = bedDepth(SLAB, phase, u, v);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(SLAB.depth + 1e-9);
      }
    }
    const v = 30;
    expect(bedDepth(SLAB, phase, SLAB.left - 0.5, v)).toBeLessThan(bedDepth(SLAB, phase, 0, v));
  });
});

describe("the debris", () => {
  it("carries the engine's own depth at every texel's middle once the flow rests", () => {
    const slide = restedSlide();
    expect(slide.running).toBe(false);
    const k = slide.slab;
    // The room first kept for it, then grown to where the flow got to.
    expect(debrisBox(k).v0).toBe(-SLIDE_LOOK.debris.above);
    const box = debrisBoxOf(slide);
    expect(debrisFits(box, slide)).toBe(true);
    expect(box.nu).toBeLessThanOrEqual(SLIDE_LOOK.debris.most[0]);
    expect(box.nv).toBeLessThanOrEqual(SLIDE_LOOK.debris.most[1]);
    const map = new Float32Array(box.nu * box.nv);
    const laid = splatDebris(slide, box, map);
    expect(laid).toBe(slide.count);
    let deepest = 0;
    let checked = 0;
    for (let j = 0; j < box.nv; j += 3) {
      for (let i = 0; i < box.nu; i += 3) {
        const u = box.u0 + (i + 0.5) * box.texel;
        const v = box.v0 + (j + 0.5) * box.texel;
        const x = k.x + k.fz * u + k.fx * v;
        const z = k.z - k.fx * u + k.fz * v;
        const want = debrisDepth(slide, x, z);
        expect(map[j * box.nu + i]).toBeCloseTo(want, 4);
        // Read back between texels as the shader's filter reads it.
        expect(debrisAt(box, map, u, v)).toBeCloseTo(want, 4);
        if (want > 0) checked++;
        deepest = Math.max(deepest, want);
      }
    }
    expect(checked).toBeGreaterThan(10);
    // A size 2's deposit: tens of centimetres to a few metres deep.
    expect(deepest).toBeGreaterThan(0.2);
    expect(deepest).toBeLessThan(6);
  });

  it("lays nothing while every parcel still runs", () => {
    const s = avalancheRide();
    placeRun(s, { x: LEE.x + 300, z: 200, heading: 0, speed: 0 });
    const events: GameEvent[] = [];
    const slide = releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, events);
    const box = debrisBox(slide.slab);
    const map = new Float32Array(box.nu * box.nv);
    expect(splatDebris(slide, box, map)).toBe(0);
    expect(map.every((d) => d === 0)).toBe(true);
  });
});

describe("the blocks", () => {
  it("cuts the slab into plates inside it, under the budget, each on a parcel", () => {
    const slide = restedSlide();
    const k = slide.slab;
    const starts = new Float64Array(slide.count * 2);
    for (let i = 0; i < slide.count; i++) {
      starts[i * 2] = slide.cells[i * CELL.stride + CELL.x];
      starts[i * 2 + 1] = slide.cells[i * CELL.stride + CELL.z];
    }
    const plates = plateGrid(k, slabPhases(k), starts, slide.count);
    expect(plates.length).toBeGreaterThan(0);
    expect(plates.length).toBeLessThanOrEqual(SLIDE_LOOK.plate.most);
    for (const p of plates) {
      expect(p.u).toBeGreaterThanOrEqual(-k.right);
      expect(p.u).toBeLessThanOrEqual(k.left);
      expect(p.v).toBeGreaterThanOrEqual(0);
      expect(p.v).toBeLessThanOrEqual(k.length);
      expect(p.h).toBeLessThanOrEqual(k.depth + 1e-9);
      expect(p.parcel).toBeGreaterThanOrEqual(0);
      expect(p.parcel).toBeLessThan(slide.count);
    }
    // Not a tiled floor: the blocks of a row come in widths of their own.
    const widths = new Set(plates.map((p) => p.w.toFixed(2)));
    expect(widths.size).toBeGreaterThan(3);
  });

  it("parts the cracks as a plate runs and breaks each up within its band", () => {
    expect(plateGap(0)).toBe(SLIDE_LOOK.plate.gap[0]);
    expect(plateGap(100)).toBe(SLIDE_LOOK.plate.gap[1]);
    for (let i = 0; i < 200; i++) {
      const b = plateBreak(i);
      expect(b).toBeGreaterThanOrEqual(SLIDE_LOOK.plate.breaks[0]);
      expect(b).toBeLessThanOrEqual(SLIDE_LOOK.plate.breaks[1]);
    }
  });

  it("rounds a chunk off into a snowball and never grows it", () => {
    const C = SLIDE_LOOK.chunk;
    for (let k = 0; k < 40; k++) {
      for (let j = 0; j < C.per; j++) {
        let was = Infinity;
        for (let run = 0; run <= 600; run += 20) {
          const size = chunkSize(k, j, run);
          expect(size).toBeLessThanOrEqual(was + 1e-12);
          expect(size).toBeGreaterThanOrEqual(C.ball[0] - 1e-12);
          expect(size).toBeLessThanOrEqual(C.big[1] + 1e-12);
          was = size;
        }
        expect(chunkSize(k, j, 2000)).toBeLessThan(C.ball[1] + 1e-3);
      }
    }
  });
});

describe("the cloud, the quake and the hands", () => {
  it("boils the cloud off the fast flow only, the front the most", () => {
    expect(cloudShare(0)).toBe(0);
    expect(cloudShare(SLIDE_LOOK.cloud.from)).toBe(0);
    expect(cloudShare(SLIDE_LOOK.cloud.full)).toBe(1);
    expect(cloudShare(60)).toBe(1);
    expect(cloudShare(15)).toBeGreaterThan(cloudShare(10));
  });

  it("shakes the ground near a fast flow and at the crack, and nowhere else", () => {
    const Q = SLIDE_LOOK.quake;
    expect(quakeAt(0, Q.speed, 10, 500)).toBe(1);
    expect(quakeAt(Q.reach + 1, Q.speed, 10, 500)).toBe(0);
    expect(quakeAt(5, 0, 10, 500)).toBe(0);
    expect(quakeAt(Infinity, 0, 0, 0)).toBe(1);
    expect(quakeAt(Infinity, 0, Q.jolt, 0)).toBe(0);
    for (const near of [0, 10, 40, 80, 200]) {
      for (const since of [0, 0.5, 3]) {
        const q = quakeAt(near, 20, since, 30);
        expect(q).toBeGreaterThanOrEqual(0);
        expect(q).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is felt in the hands: the whumpf, the flow taking him the hardest, the debris", () => {
    const at = (phase: string) =>
      rumbleForEvent({ kind: "avalanche", phase } as unknown as GameEvent);
    expect(at("release")?.strength).toBeGreaterThan(0.3);
    expect(at("caught")).toEqual({ ms: RUMBLE.longest, strength: 1 });
    expect(at("buried")?.strength).toBeLessThan(1);
    expect(at("surfaced")).not.toBeNull();
  });
});

describe("the start card's AVALANCHES row", () => {
  it("is on by default, kept when stored and handed to the run", () => {
    expect(freshRide().avalanche).toBe(true);
    expect(mergeRide({ avalanche: false }).avalanche).toBe(false);
    expect(mergeRide({ avalanche: "no" }).avalanche).toBe(true);
    const skier = { spec: SKIS, assist: FULL_ASSIST };
    expect(freeGameOptions(freshRide(), 7, skier, () => 0.9).avalanche).toBe(true);
    const off = { ...freshRide(), avalanche: false };
    expect(freeGameOptions(off, 7, skier, () => 0.9).avalanche).toBe(false);
  });
});
