// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW EACH TECHNIQUE IS STOOD (`technique-pose.ts`, read by `skier-pose.ts`):
// the free skier's row is the pose with no row at all, to the last bit; every
// racer's row holds its discipline's measured numbers (`docs/disciplines.md`);
// and the pose answers each row — the slalom racer countered and square with
// his hands up and his legs pulled up through an edge change, the speed
// racers folded flat on a straight and higher in a turn with their poles
// under their arms — and the BLOCK at a slalom's turning pole is the outside
// fist punched forward across his chest, timed to the pole's pass and drawn
// back as a motion.

import { describe, expect, it } from "vitest";
import type { TechniqueId } from "@engine";

import { skierPose, type SkierPoseInput } from "../pwa/src/game/skier-pose.ts";
import {
  DOWNHILL_POSE,
  FREE_POSE,
  GIANT_SLALOM_POSE,
  NO_BLOCK,
  SLALOM_POSE,
  SUPER_G_POSE,
  TECHNIQUE_POSES,
  gateBlock,
  ridingOf,
  techniquePoseOf,
  widenStand,
  type BlockRun,
  type TechniquePose,
} from "../pwa/src/game/technique-pose.ts";

const DEG = Math.PI / 180;

const base: SkierPoseInput = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 5,
};

/** A carve to the left as the view hands it in: the hips in, the skis
 * edged, the pair rolled and inclined into it. */
const carve: SkierPoseInput = {
  ...base,
  hipRight: -0.3,
  steer: -1,
  edge: -0.3,
  roll: -0.5,
  body: { tilt: -0.3, roll: -0.5 },
  incline: -0.5,
  lift: [0.12, 0],
};

/** The moments the free row is held to. */
const MOMENTS: SkierPoseInput[] = [
  base,
  carve,
  { ...carve, hipRight: 0.3, steer: 1, edge: 0.3, roll: 0.5, body: { tilt: 0.3, roll: 0.5 } },
  { ...base, crouch: 1, tuck: 1 },
  { ...carve, crouch: 0.6, carve: 1 },
  { ...base, skid: 1, skiAngle: 0.9, edge: -0.4, hipRight: -0.2 },
  { ...base, plantAt: { side: 0, t: 0.35, weight: 1 }, edge: 0.02 },
  { ...base, ready: 1 },
  { ...base, airborne: true, air: 1 },
];

/** The shoulders' turn off the skis' line, rad (positive: the right
 * shoulder back). */
const shoulderTurn = (p: ReturnType<typeof skierPose>) =>
  Math.atan2(p.shoulders[0].z - p.shoulders[1].z, p.shoulders[1].x - p.shoulders[0].x);

describe("the technique pose table", () => {
  it("keeps one row a technique, the free skier's for a run that names none", () => {
    for (const [id, row] of Object.entries(TECHNIQUE_POSES)) expect(row.id).toBe(id);
    expect(techniquePoseOf({})).toBe(FREE_POSE);
    expect(techniquePoseOf(null)).toBe(FREE_POSE);
    const ids: TechniqueId[] = ["free", "slalom", "giantSlalom", "superG", "downhill"];
    for (const id of ids) expect(techniquePoseOf({ technique: id })).toBe(TECHNIQUE_POSES[id]);
  });

  it("draws the free skier exactly as the pose with no row", () => {
    for (const m of MOMENTS) {
      expect(skierPose({ ...m, style: FREE_POSE, swing: 0.6, block: NO_BLOCK })).toEqual(
        skierPose(m),
      );
      // ...and a block at a gate is nothing to him.
      expect(skierPose({ ...m, style: FREE_POSE, block: { side: 1, w: 1 } })).toEqual(skierPose(m));
    }
  });

  it("holds every racer's row to his discipline's measured numbers", () => {
    // Counter-rotation: the slalom's 15–30°, the speed events' 5–10°, the
    // giant slalom between.
    expect(SLALOM_POSE.twist).toBeGreaterThanOrEqual(15 * DEG);
    expect(SLALOM_POSE.twist).toBeLessThanOrEqual(30 * DEG);
    for (const r of [SUPER_G_POSE, DOWNHILL_POSE]) {
      expect(r.twist).toBeGreaterThanOrEqual(5 * DEG);
      expect(r.twist).toBeLessThanOrEqual(10 * DEG);
    }
    expect(GIANT_SLALOM_POSE.twist).toBeLessThan(SLALOM_POSE.twist);
    expect(GIANT_SLALOM_POSE.twist).toBeGreaterThan(SUPER_G_POSE.twist);
    // The giant slalom's trunk bent forward 27 ± 8°.
    expect(Math.abs(GIANT_SLALOM_POSE.pitch / DEG - 27)).toBeLessThanOrEqual(8);
    // The inside knee at its most folded: 180° less 67, 64, 60 and 58°.
    const inside: [TechniquePose, number][] = [
      [SLALOM_POSE, 67],
      [GIANT_SLALOM_POSE, 64],
      [SUPER_G_POSE, 60],
      [DOWNHILL_POSE, 58],
    ];
    for (const [r, knee] of inside)
      expect(Math.abs(180 - r.legs.kneeMost / DEG - knee)).toBeLessThan(3);
    // The outside leg held still: 11, 34, 42 and 38 % of a turn.
    expect(inside.map(([r]) => r.legs.hold)).toEqual([0.11, 0.34, 0.42, 0.38]);
    // A slalom's touch every turn, a giant slalom's rare plant, none with a
    // speed racer's poles under his arms.
    expect(SLALOM_POSE.plant.share).toBe(1);
    expect(GIANT_SLALOM_POSE.plant.share).toBeLessThan(0.5);
    for (const r of [SUPER_G_POSE, DOWNHILL_POSE]) {
      expect(r.plant.share).toBe(0);
      expect(r.underArm).toBe(1);
    }
    // The block: the slalom's outside fist, the giant slalom's inside arm.
    expect(SLALOM_POSE.block).toEqual({ hand: "outside", weight: 1 });
    expect(GIANT_SLALOM_POSE.block.hand).toBe("inside");
    expect(DOWNHILL_POSE.block.weight).toBe(0);
    // A retraction between slalom turns, a cross-over's rise in the speed
    // events.
    expect(SLALOM_POSE.transition.retract).toBeGreaterThan(0);
    expect(DOWNHILL_POSE.transition.retract).toBeLessThan(0);
    // The downhill's LOW tuck holds the torso 0–15° off level, its HIGH one
    // 25–35°.
    const offLevel = (pitch: number) => 90 - pitch / DEG;
    expect(offLevel(DOWNHILL_POSE.tuck.low)).toBeGreaterThanOrEqual(0);
    expect(offLevel(DOWNHILL_POSE.tuck.low)).toBeLessThanOrEqual(15);
    expect(offLevel(DOWNHILL_POSE.tuck.high)).toBeGreaterThanOrEqual(25);
    expect(offLevel(DOWNHILL_POSE.tuck.high)).toBeLessThanOrEqual(35);
  });
});

describe("the pose answers the row", () => {
  it("counters the slalom racer's shoulders more than the free skier's, a downhiller's less", () => {
    const free = shoulderTurn(skierPose(carve));
    const slalom = shoulderTurn(skierPose({ ...carve, style: SLALOM_POSE }));
    const downhill = shoulderTurn(skierPose({ ...carve, style: DOWNHILL_POSE }));
    expect(Math.abs(slalom)).toBeGreaterThan(Math.abs(free) + 3 * DEG);
    expect(Math.abs(downhill)).toBeLessThan(Math.abs(free) - 3 * DEG);
  });

  it("carries a slalom racer's hands up and forward, riding", () => {
    const free = skierPose(base);
    const slalom = skierPose({ ...base, style: SLALOM_POSE });
    for (const i of [0, 1]) {
      expect(slalom.hands[i].y).toBeGreaterThan(free.hands[i].y + 0.05);
      expect(slalom.hands[i].z).toBeGreaterThan(free.hands[i].z + 0.05);
      expect(Math.abs(slalom.hands[i].x)).toBeGreaterThan(Math.abs(slalom.hips.x) + 0.25);
    }
  });

  it("pulls a slalom racer's legs up through an edge change, never on a straight", () => {
    const flat = { ...base, edge: 0.02, roll: 0 };
    const linked = skierPose({ ...flat, style: SLALOM_POSE, swing: 0.8 });
    const straight = skierPose({ ...flat, style: SLALOM_POSE, swing: 0 });
    expect(linked.hips.y).toBeLessThan(straight.hips.y - 0.05);
    // Pulled up by the knees, never folded at the waist.
    expect(linked.pitch).toBeCloseTo(straight.pitch, 6);
    expect(straight).toEqual(skierPose({ ...flat, style: SLALOM_POSE }));
  });

  it("folds a downhiller flat on a straight and higher in a turn", () => {
    const tuck = { ...base, crouch: 1, tuck: 1 };
    const free = skierPose(tuck);
    const straight = skierPose({ ...tuck, style: DOWNHILL_POSE });
    const turning = skierPose({
      ...tuck,
      style: DOWNHILL_POSE,
      hipRight: 0.3,
      edge: 0.5,
      roll: 0.4,
      body: { tilt: 0.5, roll: 0.4 },
    });
    expect(straight.pitch).toBeGreaterThan(free.pitch + 0.1);
    expect(turning.pitch).toBeLessThan(straight.pitch - 0.25);
  });

  it("carries a speed racer's poles under his arms stood up, and plants none", () => {
    const free = skierPose(base);
    const sg = skierPose({ ...base, style: SUPER_G_POSE });
    for (const i of [0, 1]) {
      const tip = sg.poles![i];
      expect(tip.y).toBeGreaterThan(free.poles![i].y + 0.4);
      expect(tip.z).toBeLessThan(sg.hands[i].z - 0.8);
    }
    const plant = { side: 0 as const, t: 0.35, weight: 1 };
    expect(skierPose({ ...base, style: SUPER_G_POSE, plantAt: plant })).toEqual(sg);
  });
});

describe("the block at a slalom's turning pole", () => {
  /** An open gate across the hill at z = 20, its turning pole on the
   * right at x = 3, and the gate after it. */
  const run: BlockRun & { rules: { technique?: TechniqueId } } = {
    level: {
      checkpoints: [
        { x: 0, z: 0, heading: 0, width: 6 },
        { x: 0, z: 20, heading: 0, width: 6, pole: "open", turn: 1 },
        { x: -4, z: 32, heading: 0, width: 6, pole: "open", turn: -1 },
      ],
    },
    progress: { nextCheckpoint: 1 },
    rules: { technique: "slalom" },
  };
  const skierAt = (z: number) => ({ x: 2.4, z, vx: 0, vz: 12, speed: 12 });

  it("punches as he reaches the pole and draws back after it, as a motion", () => {
    const w: number[] = [];
    for (let z = 10; z < 26; z += 12 / 120) {
      // The gate is credited as he crosses its line.
      const at = skierAt(z);
      const r = { ...run, progress: { nextCheckpoint: z < 20 ? 1 : 2 } };
      const b = gateBlock(r, at);
      if (b.w > 0) expect(b.side).toBe(1);
      w.push(b.w);
    }
    expect(w[0]).toBe(0);
    expect(w.at(-1)).toBe(0);
    expect(Math.max(...w)).toBe(1);
    // Never a jump between two steps, the gate's credit included.
    for (let i = 1; i < w.length; i++) expect(Math.abs(w[i] - w[i - 1])).toBeLessThan(0.1);
    // A pole passed far off his line is no block.
    expect(gateBlock(run, { ...skierAt(19.8), x: -2 }).w).toBe(0);
    // At a crawl, or on a run with no pole gate, nothing.
    expect(gateBlock(run, { ...skierAt(19.8), speed: 2 }).w).toBe(0);
    expect(gateBlock(null, skierAt(19.8))).toBe(NO_BLOCK);
  });

  it("punches the OUTSIDE fist forward across his chest, the giant slalom's inside one at the pole", () => {
    const block = { side: 1 as const, w: 1 };
    const riding = skierPose({ ...base, style: SLALOM_POSE });
    const punched = skierPose({ ...base, style: SLALOM_POSE, block });
    // The pole on his right: the left fist goes forward, across toward it,
    // at chest height.
    const fist = punched.hands[0];
    expect(fist.z).toBeGreaterThan(punched.shoulders[0].z + 0.3);
    expect(fist.x).toBeGreaterThan(riding.hands[0].x + 0.25);
    expect(fist.y).toBeGreaterThan(punched.hips.y + 0.15);
    expect(fist.y).toBeLessThan(punched.shoulders[0].y);
    expect(punched.hands[1]).toEqual(riding.hands[1]);
    const gs = skierPose({ ...base, style: GIANT_SLALOM_POSE, block });
    const gsRiding = skierPose({ ...base, style: GIANT_SLALOM_POSE });
    expect(gs.hands[1].z).toBeGreaterThan(gsRiding.hands[1].z + 0.1);
    expect(gs.hands[0]).toEqual(gsRiding.hands[0]);
  });

  it("is read off the run: the slalom's row and block, nothing for a free skier", () => {
    const at = skierAt(19.9);
    const slalom = ridingOf(run, at);
    expect(slalom.style).toBe(SLALOM_POSE);
    expect(slalom.block.w).toBeGreaterThan(0.9);
    const free = ridingOf({ ...run, rules: {} }, at);
    expect(free.style).toBe(FREE_POSE);
    expect(free.block).toBe(NO_BLOCK);
  });
});

describe("the stance a technique stands in", () => {
  const stand = () => ({
    incline: 0.4,
    lift: [0.1, 0] as [number, number],
    out: [0, 0] as [number, number],
    fore: [0, 0] as [number, number],
  });

  it("narrows a slalom racer's skis in his carve, never thrown across or at a crawl", () => {
    const s = stand();
    widenStand(s, SLALOM_POSE.stance, 0, 0, 14);
    expect(s.out[0]).toBeGreaterThan(0.01);
    expect(s.out[1]).toBeCloseTo(-s.out[0], 9);
    // Narrowed in the snow's plane: each ski moved along the snow he
    // inclines to, the two by as much.
    expect(Math.abs(s.lift[1])).toBeGreaterThan(0.005);
    expect(s.lift[0] - 0.1).toBeCloseTo(-s.lift[1], 9);
    for (const [skid, speed] of [
      [1, 14],
      [0, 2],
    ]) {
      const t = stand();
      widenStand(t, SLALOM_POSE.stance, 0, skid, speed);
      expect(t).toEqual(stand());
    }
    const free = stand();
    widenStand(free, FREE_POSE.stance, 0.3, 0, 14);
    expect(free).toEqual(stand());
  });
});
