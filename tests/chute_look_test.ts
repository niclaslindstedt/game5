// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE AS DRAWN, held where it is decided three-free: the sport
// main's shape through its opening (`chute-canopy.ts` — the centre cells
// first, the span held in by the slider, the slider coming down), the loose
// pieces (`chute-rig-plan.ts` — the pilot chute, the bridle, the cut-away
// falling and lying, the canopy laid over a crown and a rope), the body's
// shapes at every stage and the pose they make (`skier-skydive.ts`), and
// the lenses out of the door and through the opening (`camera-skydive.ts`).

import { describe, expect, it } from "vitest";
import {
  CHUTE,
  NEUTRAL_INPUT,
  createGame,
  skydiveAt,
  step,
  TUNING,
  type ChuteState,
  type GameState,
} from "@engine";

import { flatLevel } from "./support/synthetic.ts";
import {
  SKY_WING,
  shapeSkyCanopy,
  skyInflation,
  skyLayout,
  skyLines,
  skyPaintAt,
  sliderOf,
} from "../pwa/src/game/chute-canopy.ts";
import { CANOPY, canopyLayout } from "../pwa/src/game/para-canopy.ts";
import {
  bridlePath,
  crownDrape,
  cutawayPoint,
  deflated,
  laidPoint,
  pilotOpen,
  ropeDrape,
} from "../pwa/src/game/chute-rig-plan.ts";
import {
  pitchPast,
  skydivePose,
  skydiveShapeOf,
  squareStand,
} from "../pwa/src/game/skier-skydive.ts";
import { MOUNTS, skierPose } from "../pwa/src/game/skier-pose.ts";
import { skydiveFramed, skydiveLens } from "../pwa/src/game/camera-skydive.ts";

const SIZE = 3000;

function shaped(spread: number, left = 0, right = 0): Float32Array {
  const out = new Float32Array(skyLayout().vertices * 3);
  shapeSkyCanopy(out, { left, right, spread, t: 0.37 });
  return out;
}
const spanOf = (p: Float32Array): number => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    lo = Math.min(lo, p[i]);
    hi = Math.max(hi, p[i]);
  }
  return hi - lo;
};

function dive(mode: "freefall" | "open" = "freefall"): GameState {
  const s = createGame({
    level: flatLevel({ size: SIZE }),
    mode: "free",
    plane: true,
    crowd: 0,
    quiet: true,
  });
  skydiveAt(s, { x: SIZE / 2, z: SIZE / 2, agl: 1500, fall: 50, mode });
  return s;
}
const fly = (s: GameState, seconds: number, input = NEUTRAL_INPUT): void => {
  for (let i = 0; i < Math.round(seconds / TUNING.dt); i++) step(s, input);
};

describe("the sport main as drawn", () => {
  it("is the paramotor's cloth on a sport main's numbers, nine cells sewn as two", () => {
    expect(SKY_WING.cells).toBe(CHUTE.canopy.cells);
    expect(SKY_WING.sub).toBe(2);
    const full = shaped(1);
    // The span: a sport main's flat arc takes some ten per cent off it.
    const span = spanOf(full);
    expect(span).toBeGreaterThan(CHUTE.canopy.span * 0.82);
    expect(span).toBeLessThan(CHUTE.canopy.span * 1.02);
    // The paramotor's own layout is untouched by the main's parameters.
    expect(canopyLayout().vertices).toBe(canopyLayout(CANOPY).vertices);
    for (const v of full) expect(Number.isFinite(v)).toBe(true);
  });

  it("opens from the middle out, held narrow by the slider, wider every step", () => {
    let last = -Infinity;
    let lastFill = -Infinity;
    for (let k = 0; k <= 10; k++) {
      const p = k / 10;
      const inf = skyInflation(p);
      // The centre fills before the ends.
      expect(inf.fill(0)).toBeGreaterThanOrEqual(inf.fill(0.95));
      expect(inf.width).toBeGreaterThanOrEqual(last);
      expect(inf.fill(0.6)).toBeGreaterThanOrEqual(lastFill);
      last = inf.width;
      lastFill = inf.fill(0.6);
    }
    expect(skyInflation(0).width).toBeLessThan(0.3);
    expect(skyInflation(1).width).toBe(1);
    expect(skyInflation(1).fill(1)).toBe(1);
    expect(spanOf(shaped(0.1))).toBeLessThan(spanOf(shaped(1)) * 0.45);
  });

  it("pulls the trailing edge down on the toggle's side only", () => {
    const flat = shaped(1);
    const left = shaped(1, 1, 0);
    let dl = 0;
    let dr = 0;
    for (let i = 0; i < flat.length; i += 3) {
      const d = flat[i + 1] - left[i + 1];
      if (flat[i] < -1) dl = Math.max(dl, d);
      if (flat[i] > 1) dr = Math.max(dr, d);
    }
    expect(dl).toBeGreaterThan(0.3);
    expect(dr).toBeLessThan(0.01);
  });

  it("hangs four rows of lines off the ten loaded ribs, and steering lines off the outer ones", () => {
    const lines = skyLines();
    expect(lines.filter((l) => !l.brake).length).toBe((CHUTE.canopy.cells + 1) * 4);
    expect(lines.some((l) => l.brake && l.side < 0)).toBe(true);
    expect(lines.some((l) => l.brake && l.side > 0)).toBe(true);
    expect(lines.every((l) => !l.brake || !l.front)).toBe(true);
  });

  it("paints the centre cell, the body and the ends in their own colours", () => {
    expect(skyPaintAt(0, 0.5, 1)).not.toEqual(skyPaintAt(0.5, 0.5, 1));
    expect(skyPaintAt(0.98, 0.5, 1)).not.toEqual(skyPaintAt(0.5, 0.5, 1));
  });

  it("brings the slider down the lines, opening as it comes", () => {
    expect(sliderOf(1).share).toBe(1);
    expect(sliderOf(0).open).toBeGreaterThan(sliderOf(1).open);
    expect(sliderOf(0.5).open).toBeGreaterThan(sliderOf(0.8).open);
  });
});

describe("the loose pieces", () => {
  it("opens the pilot chute from a fistful of cloth, collapsed once the canopy flies", () => {
    expect(pilotOpen(0, false)).toBeLessThan(0.3);
    expect(pilotOpen(0.5, false)).toBe(1);
    expect(pilotOpen(0.1, false)).toBeLessThan(pilotOpen(0.25, false));
    expect(pilotOpen(9, true)).toBeLessThan(0.5);
  });

  it("lays the bridle straight when taut and sags it when slack", () => {
    const out = new Float32Array(17 * 3);
    const from = { x: 0, y: 0, z: 0 };
    const side = { x: 1, y: 0, z: 0 };
    expect(bridlePath(from, { x: 0, y: 2.5, z: 0 }, 2.5, side, 0, 16, out)).toBe(0);
    for (let i = 0; i <= 16; i++) expect(Math.abs(out[i * 3])).toBeLessThan(1e-9);
    expect(bridlePath(from, { x: 0, y: 1, z: 0 }, 2.5, side, 0, 16, out)).toBeCloseTo(1.5, 6);
    expect(Math.abs(out[8 * 3])).toBeGreaterThan(0.3);
  });

  it("crumples the cut-away into a streamer as it falls, and lays it flat on the snow", () => {
    expect(deflated(0)).toBe(0);
    expect(deflated(3)).toBe(1);
    const full = shaped(1);
    const fell = new Float32Array(full.length);
    const lay = new Float32Array(full.length);
    const p = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < full.length; i += 3) {
      p.x = full[i];
      p.y = full[i + 1];
      p.z = full[i + 2];
      cutawayPoint(p, 2, fell, i);
      laidPoint(p, { x: 100, z: 50, heading: 0.7 }, () => 12, lay, i);
    }
    expect(spanOf(fell)).toBeLessThan(spanOf(full) * 0.5);
    for (let i = 0; i < lay.length; i += 3) {
      expect(lay[i + 1]).toBeGreaterThanOrEqual(12);
      expect(lay[i + 1]).toBeLessThan(12.25);
      expect(Math.hypot(lay[i] - 100, lay[i + 2] - 50)).toBeLessThan(CHUTE.canopy.span);
    }
  });

  it("lays a caught canopy over the crown and hangs it off the rim; folds it over a rope", () => {
    const crown = { x: 0, z: 0, top: 20, depth: 12, radius: 3 };
    const snag = { x: 0.5, y: 19, z: 0 };
    const out = [0, 0, 0];
    crownDrape({ x: 1, y: 19.5, z: 0.5 }, snag, crown, out, 0);
    // Near the snag: on the cone, under the top.
    expect(out[1]).toBeLessThan(crown.top + 0.2);
    expect(Math.hypot(out[0], out[2])).toBeLessThanOrEqual(crown.radius + 0.01);
    crownDrape({ x: 30, y: 19, z: 0 }, snag, crown, out, 0);
    // Far off it: hanging below the cone's foot, just outside its rim.
    expect(out[1]).toBeLessThan(crown.top - crown.depth);
    expect(Math.hypot(out[0], out[2])).toBeGreaterThan(crown.radius);
    const rope = { x: 0, y: 10, z: 0 };
    const along = { x: 1, y: 0, z: 0 };
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    ropeDrape({ x: 0, y: 10, z: 2 }, rope, along, a, 0);
    ropeDrape({ x: 0, y: 10, z: -2 }, rope, along, b, 0);
    expect(a[1]).toBeLessThan(9);
    expect(b[1]).toBeLessThan(9);
    expect(Math.sign(a[2])).toBe(-Math.sign(b[2]));
  });
});

describe("the body at every stage", () => {
  it("is poised in the door, then boxes, and is his own on the snow", () => {
    expect(skydiveShapeOf(null, true)?.door).toBe(1);
    expect(skydiveShapeOf(null, false)).toBeNull();
    const s = dive();
    fly(s, 1);
    const box = skydiveShapeOf(s.chute!, false)!;
    expect(box.box).toBeGreaterThan(0.9);
    expect(box.attitude).toBeCloseTo(Math.PI / 2, 1);
    expect(pitchPast(box)).toBeGreaterThan(0);
    fly(s, 3, { ...NEUTRAL_INPUT, lean: -1 });
    expect(skydiveShapeOf(s.chute!, false)!.track).toBeGreaterThan(0.5);
  });

  it("reaches back, throws, takes the shock and hangs on the toggles through the opening", () => {
    const s = dive();
    fly(s, 1);
    step(s, { ...NEUTRAL_INPUT, machine: true });
    const seen = { reach: 0, throw: 0, shock: 0, hang: 0 };
    const ch = (): ChuteState => s.chute!;
    for (let i = 0; i < Math.round(4 / TUNING.dt) && ch().mode === "deploying"; i++) {
      step(s, NEUTRAL_INPUT);
      const sh = skydiveShapeOf(ch(), false)!;
      for (const k of ["reach", "throw", "shock", "hang"] as const)
        seen[k] = Math.max(seen[k], sh[k]);
    }
    expect(seen.reach).toBeGreaterThan(0.8);
    expect(seen.throw).toBeGreaterThan(0.8);
    expect(seen.shock).toBeGreaterThan(0.5);
    expect(seen.hang).toBeGreaterThan(0.9);
    expect(ch().mode).toBe("open");
    fly(s, 1, { ...NEUTRAL_INPUT, steer: -1 });
    const turning = skydiveShapeOf(ch(), false)!;
    expect(turning.toggles[0]).toBeGreaterThan(turning.toggles[1]);
  });

  it("poses every stage with the boots on the skis and the hands within the arms' reach", () => {
    const base = {
      hipRight: 0,
      hipAft: 0,
      lean: 0,
      steer: 0,
      crouch: 0,
      airborne: true,
      landing: 5,
    };
    const p = skierPose(base);
    const s = dive();
    fly(s, 1);
    const shapes = [skydiveShapeOf(null, true)!, skydiveShapeOf(s.chute!, false)!];
    const open = dive("open");
    fly(open, 1, { ...NEUTRAL_INPUT, brake: 1 });
    shapes.push(skydiveShapeOf(open.chute!, false)!);
    for (const sh of shapes) {
      const { pose, skis } = skydivePose(p, sh, MOUNTS);
      for (const side of [0, 1]) {
        const arm = Math.hypot(
          pose.hands[side].x - pose.shoulders[side].x,
          pose.hands[side].y - pose.shoulders[side].y,
          pose.hands[side].z - pose.shoulders[side].z,
        );
        expect(arm).toBeLessThan(0.75);
        for (const v of [skis[side].dx, skis[side].dy, skis[side].dz, skis[side].pitch]) {
          expect(Number.isFinite(v)).toBe(true);
        }
      }
      expect(pose.poles).toBeNull();
    }
  });

  it("lays the box on a square stand, the two legs mirror images", () => {
    const turning = {
      hipRight: 0.2,
      hipAft: 0.1,
      lean: 0.4,
      steer: 0.8,
      edge: 0.5,
      crouch: 0,
      airborne: true,
      landing: 5,
    };
    const s = dive();
    fly(s, 1);
    const { pose } = skydivePose(
      skierPose(squareStand(turning)),
      skydiveShapeOf(s.chute!, false)!,
      MOUNTS,
    );
    for (const k of ["knees", "feet"] as const) {
      expect(pose[k][0].x).toBeCloseTo(-pose[k][1].x, 2);
      expect(pose[k][0].y).toBeCloseTo(pose[k][1].y, 2);
      expect(pose[k][0].z).toBeCloseTo(pose[k][1].z, 2);
    }
  });
});

describe("the skydive's lenses", () => {
  it("frames him out of the door to full, never under a full canopy", () => {
    const s = dive();
    fly(s, 1);
    expect(skydiveFramed(s.chute, false)).toBe(true);
    expect(skydiveFramed(s.chute, true)).toBe(false);
    expect(skydiveFramed(dive("open").chute, false)).toBe(false);
  });

  it("flies beside and over him looking past him at the ground, and pulls back for the opening", () => {
    const s = dive();
    fly(s, 1);
    const c = s.skier;
    const at = { x: c.x, y: c.y, z: c.z };
    const ground = () => 0;
    const chase = skydiveLens("chase", s.chute!, at, null, ground);
    expect(chase.eye.y).toBeGreaterThan(at.y);
    expect(chase.target.y).toBeLessThan(at.y);
    const far = skydiveLens("far", s.chute!, at, null, ground);
    const d = (l: typeof chase) => Math.hypot(l.eye.x - at.x, l.eye.y - at.y, l.eye.z - at.z);
    expect(d(far)).toBeGreaterThan(d(chase));
    step(s, { ...NEUTRAL_INPUT, machine: true });
    fly(s, 2);
    const top = { x: at.x, y: c.y + 5, z: at.z };
    const open = skydiveLens("chase", s.chute!, { x: c.x, y: c.y, z: c.z }, top, ground);
    expect(d(open)).toBeGreaterThan(d(chase));
    const up = skydiveLens("helmet", s.chute!, { x: c.x, y: c.y, z: c.z }, top, ground);
    expect(up.target.y).toBeGreaterThan(up.eye.y);
    // Through his own eyes as posed, when the drawing hands them in.
    const eyes = {
      at: { x: c.x, y: c.y + 0.9, z: c.z },
      face: { x: 0, y: -1, z: 0 },
      up: { x: 0, y: 0, z: 1 },
    };
    const own = skydiveLens("helmet", s.chute!, { x: c.x, y: c.y, z: c.z }, top, ground, eyes);
    expect(own.eye).toEqual(eyes.at);
  });
});
