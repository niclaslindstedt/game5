// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOGS AS POSED AND BUILT (`dog-pose.ts`, `dog-shapes.ts`): every kind
// stood on its four paws, its legs the same length in every pose; the
// squat to poop with the hind feet forward and wide, the rump let down off
// the snow, the back hunched and the tail held clear; sat, the haunch down
// and the fore legs straight; a leg lifted to mark; the nose at the snow
// sniffing; the weights a dog is drawn at; the lead hung from the hand to
// the collar; and every kind built at every pose on one mesh.

import { describe, expect, it } from "vitest";

import { DOG_KINDS, DOG_SPECS } from "../pwa/src/game/dog-defs.ts";
import {
  DOG_POSES,
  collarOf,
  dogDials,
  dogSkel,
  leadCurve,
  type DogSkel,
  type V3,
} from "../pwa/src/game/dog-pose.ts";
import { DOG_LODS, buildDogFigure, dogTriangles } from "../pwa/src/game/dog-shapes.ts";
import { freshDogPose } from "../pwa/src/game/dog-walk-pose.ts";

const dist = (a: V3, b: V3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lowest = (s: DogSkel, from: number): number =>
  Math.min(...s.rings.slice(from).map((r) => r.c[1] - r.hh * r.up[1]));

describe("a dog stood and going", () => {
  it("stands on all four paws, its legs the same length whatever it does", () => {
    for (const kind of DOG_KINDS) {
      const stand = dogSkel(kind, "stand");
      for (const leg of stand.legs) expect(Math.abs(leg.paw[1]), kind).toBeLessThan(1e-6);
      const span = (s: DogSkel, i: number) => dist(s.legs[i].top, s.legs[i].mid);
      for (const target of DOG_POSES) {
        const s = dogSkel(kind, target);
        for (let i = 0; i < 4; i++) {
          expect(Math.abs(span(s, i) - span(stand, i)), `${kind} ${target} leg ${i}`).toBeLessThan(
            1e-3,
          );
        }
        // Nothing of the body under the snow.
        expect(lowest(s, 0), `${kind} ${target}`).toBeGreaterThan(-0.01);
      }
    }
  });

  it("walks a lateral sequence and trots in diagonal pairs", () => {
    const H = DOG_SPECS.retriever.height;
    const lifted = (t: (typeof DOG_POSES)[number]) =>
      dogSkel("retriever", t).legs.map((g) => g.paw[1] > 0.02 * H);
    // At a walk never more than one foot off the snow at a key.
    for (const t of ["walk0", "walk1", "walk2", "walk3"] as const) {
      expect(lifted(t).filter(Boolean).length, t).toBeLessThanOrEqual(1);
    }
    // At a trot a fore foot goes up with the hind foot on the other side.
    const trot = dogSkel("retriever", "trot1").legs.map((g) => g.paw[1]);
    const trot3 = dogSkel("retriever", "trot3").legs.map((g) => g.paw[1]);
    expect(Math.max(trot[0], trot[3]) > 0 || Math.max(trot3[0], trot3[3]) > 0).toBe(true);
    expect(Math.sign(trot[0] - trot[1])).toBe(Math.sign(trot[3] - trot[2]));
  });
});

describe("a dog squatting, sat, marking and sniffing", () => {
  it("squats to poop: hind feet forward and wide, rump off the snow, back hunched, tail up", () => {
    for (const kind of DOG_KINDS) {
      const H = DOG_SPECS[kind].height;
      const stand = dogSkel(kind, "stand");
      const s = dogSkel(kind, "poop");
      // The rump let down, but clear of the snow.
      expect(lowest(s, 4), kind).toBeLessThan(lowest(stand, 4) - 0.1 * H);
      expect(lowest(s, 4), kind).toBeGreaterThan(0.08 * H);
      // The hind feet brought forward and set wider.
      for (const i of [2, 3]) {
        expect(s.legs[i].paw[2], kind).toBeGreaterThan(stand.legs[i].paw[2]);
        expect(Math.abs(s.legs[i].paw[0]), kind).toBeGreaterThan(Math.abs(stand.legs[i].paw[0]));
      }
      // The tail out of the way: rising off its root.
      expect(s.tail[1][1], kind).toBeGreaterThan(s.tail[0][1]);
      // The back hunched: the middle above a line from withers to croup.
      const mid = (s.rings[1].c[1] + s.rings[5].c[1]) / 2;
      expect(s.rings[3].c[1], kind).toBeGreaterThan(mid);
    }
  });

  it("sits on its haunch on straight fore legs", () => {
    for (const kind of DOG_KINDS) {
      const H = DOG_SPECS[kind].height;
      const s = dogSkel(kind, "sit");
      expect(lowest(s, 4), kind).toBeLessThan(0.12 * H);
      for (const i of [0, 1]) expect(s.legs[i].paw[1]).toBeCloseTo(0, 6);
      expect(s.neck[1][1], kind).toBeGreaterThan(dogSkel(kind, "stand").neck[1][1] - 0.05 * H);
    }
  });

  it("lifts a hind leg to the side it marks, and brings its nose to the snow sniffing", () => {
    for (const kind of DOG_KINDS) {
      const H = DOG_SPECS[kind].height;
      const left = dogSkel(kind, "markL");
      const right = dogSkel(kind, "markR");
      expect(left.legs[2].paw[1]).toBeGreaterThan(0.3 * H);
      expect(left.legs[2].paw[0]).toBeLessThan(dogSkel(kind, "stand").legs[2].paw[0]);
      expect(right.legs[3].paw[1]).toBeGreaterThan(0.3 * H);
      expect(right.legs[2].paw[1]).toBeCloseTo(0, 6);
      const sniff = dogSkel(kind, "sniff");
      const nose = sniff.head.at.map((v, i) => v + sniff.head.dir[i] * DOG_SPECS[kind].head);
      expect(nose[1], kind).toBeLessThan(0.15 * H);
    }
  });
});

describe("drawing a dog", () => {
  it("weighs its poses so a stop never adds up past the whole dog", () => {
    const w = new Float32Array(DOG_POSES.length);
    const tail = (k: string) => k === "wagL" || k === "wagR";
    for (const act of ["walk", "stand", "sit", "sniff", "mark", "pee", "poop"] as const) {
      for (const clock of [0, 0.3, 2, 5, 9.9]) {
        dogDials(
          { ...freshDogPose(), act, clock, span: 10, stride: 0.37, speed: 1.2, trot: 0.4, lift: 1 },
          clock,
          3,
          w,
        );
        const body = DOG_POSES.reduce((a, k, i) => a + (tail(k) ? 0 : w[i]), 0);
        expect(body, `${act} ${clock}`).toBeLessThanOrEqual(1 + 1e-6);
        for (const x of w) expect(x).toBeGreaterThanOrEqual(0);
      }
    }
    // The squat at its middle is the squat, and nothing wags in it.
    dogDials({ ...freshDogPose(), act: "poop", clock: 5, span: 10 }, 5, 3, w);
    expect(w[DOG_POSES.indexOf("poop")]).toBeCloseTo(1, 6);
    expect(w[DOG_POSES.indexOf("wagL")] + w[DOG_POSES.indexOf("wagR")]).toBe(0);
  });

  it("hangs a lead in a sag as deep as its slack, straight when taut, never in the snow", () => {
    const hand: V3 = [0, 0.9, 0];
    const slack = leadCurve(hand, [0.8, 0.45, 0], 1.6, 0, 12);
    const taut = leadCurve(hand, [1.55, 0.45, 0], 1.6, 0, 12);
    const sag = (c: V3[]) => Math.max(...c.map((p, k) => 0.9 - 0.45 * (k / 11) - p[1]));
    expect(sag(slack)).toBeGreaterThan(0.2);
    expect(sag(taut)).toBeLessThan(0.15);
    for (const p of leadCurve(hand, [0.3, 0.2, 0], 1.8, 0, 12)) expect(p[1]).toBeGreaterThan(0);
    expect(slack[0]).toEqual(hand);
    // The collar on the neck, ahead of the withers.
    const s = dogSkel("retriever", "stand");
    expect(collarOf(s)[2]).toBeGreaterThan(s.rings[1].c[2]);
  });

  it("builds every kind at every pose on one mesh, the far cut the cheaper", () => {
    for (const kind of DOG_KINDS) {
      for (const lod of DOG_LODS) {
        const g = buildDogFigure(kind, lod);
        expect(g.morphAttributes.position?.length).toBe(DOG_POSES.length);
        expect(g.getAttribute("aSlot").count).toBe(g.getAttribute("position").count);
      }
      expect(dogTriangles(kind, "far")).toBeLessThan(dogTriangles(kind, "near") * 0.75);
      expect(dogTriangles(kind, "near")).toBeLessThan(800);
    }
  });
});
