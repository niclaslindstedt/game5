// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON THE HOT AIR BALLOON (`camera-balloon.ts`). The skier's
// ladder framed a man stood in a basket put the TIPS lens inside the wicker
// and the booms too close to hold a balloon twenty metres tall; in the
// basket the ladder is the balloon's own. These hold that the first-person
// lens stands in the basket over the rim and looks DOWN past it, moves with
// him and turns with him, never stands in the wicker or the corner rods,
// and that the booms hold the whole balloon.

import { describe, expect, it } from "vitest";
import { BALLOON, fromEuler, multiply, rotate, unrotate, type BalloonState } from "@engine";
import {
  BALLOON_LOOK,
  createBalloonLadder,
  KEEP_OUT,
  keepOutOfBalloon,
  rimPoint,
} from "../pwa/src/game/camera-balloon.ts";
import {
  blendLens,
  createBoomState,
  frameRig,
  freshRigPose,
  type LensPose,
  type Rung,
  type Vec3,
} from "../pwa/src/game/camera-rigs.ts";

const W = BALLOON.basket.width / 2;
const LEN = BALLOON.basket.length / 2;
const RIM_TOP = BALLOON.basket.wall + 0.11;

/** A balloon in the air over flat snow at `agl` m, heading `heading`. */
function balloon(over: Partial<BalloonState> = {}): BalloonState {
  return {
    mode: "flown",
    aboard: true,
    x: 500,
    y: 120,
    z: 500,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: 0.7,
    pitch: 0,
    roll: 0,
    walkX: 0,
    walkZ: 0,
    face: 0,
    grounded: false,
    ...over,
  } as BalloonState;
}

/** One rung framed for `b`, with the eye in the basket's own frame too. */
function framed(b: BalloonState, rung: Rung, frames = 30): { lens: LensPose; local: Vec3 } {
  const ladder = createBalloonLadder();
  const pose = freshRigPose();
  const st = createBoomState();
  let lens: LensPose | null = null;
  for (let i = 0; i < frames; i++) {
    ladder.pose(pose, b, null, 1 / 60);
    lens = frameRig(ladder.rigs[rung], pose, st, 1 / 60, () => 0);
  }
  const q = fromEuler(b.heading, b.pitch, b.roll);
  const local = unrotate(q, { x: lens!.eye.x - b.x, y: lens!.eye.y - b.y, z: lens!.eye.z - b.z });
  return { lens: lens!, local };
}

/** The look's angle under the horizontal, rad. */
const down = (l: LensPose): number =>
  Math.atan2(l.eye.y - l.target.y, Math.hypot(l.target.x - l.eye.x, l.target.z - l.eye.z));

/** The nearest the eye comes to a corner's rod, m (from the rim's corner up
 * to the burner frame's). */
function rodGap(e: Vec3): number {
  let least = Infinity;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const a = { x: sx * W, y: RIM_TOP, z: sz * LEN };
      const b = { x: sx * 0.42, y: 2.15, z: sz * 0.42 };
      const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const t = Math.max(
        0,
        Math.min(
          1,
          ((e.x - a.x) * d.x + (e.y - a.y) * d.y + (e.z - a.z) * d.z) /
            (d.x * d.x + d.y * d.y + d.z * d.z),
        ),
      );
      least = Math.min(
        least,
        Math.hypot(e.x - a.x - d.x * t, e.y - a.y - d.y * t, e.z - a.z - d.z * t),
      );
    }
  return least;
}

const PLACES = [
  { x: 0, z: 0 },
  { x: 0.42, z: 0.62 },
  { x: -0.42, z: -0.62 },
  { x: 0.42, z: -0.2 },
];
const FACES = [0, 0.6, Math.PI / 2, 2.3, Math.PI, -Math.PI / 2, -0.9];

describe("the lens on the hot air balloon", () => {
  it("leans out over the wall he faces, on its inside and off its corners", () => {
    for (const p of PLACES)
      for (const f of FACES) {
        const r = rimPoint(p.x, p.z, f);
        const onSide = Math.abs(Math.abs(r.x) - BALLOON_LOOK.inside.x) < 1e-9;
        const onEnd = Math.abs(Math.abs(r.z) - BALLOON_LOOK.inside.z) < 1e-9;
        expect(onSide || onEnd, `${p.x},${p.z} ${f}`).toBe(true);
        expect(Math.abs(r.x)).toBeLessThanOrEqual(BALLOON_LOOK.inside.x + 1e-9);
        expect(Math.abs(r.z)).toBeLessThanOrEqual(BALLOON_LOOK.inside.z + 1e-9);
        // The wall he leans over is the one ahead of him.
        expect((r.x - p.x) * Math.sin(f) + (r.z - p.z) * Math.cos(f)).toBeGreaterThan(-0.35);
      }
  });

  it("stands the first-person eye in the basket, over the rim, clear of the rods", () => {
    for (const p of PLACES)
      for (const f of FACES)
        for (const rung of ["tips", "helmet"] as const) {
          const { local } = framed(balloon({ walkX: p.x, walkZ: p.z, face: f }), rung);
          // TIPS leans his head out over the rim's roll, never past the
          // wall's outer face; HELMET stands inside the wicker.
          const inset = rung === "tips" ? 0 : 0.04;
          expect(Math.abs(local.x), rung).toBeLessThan(W - inset);
          expect(Math.abs(local.z), rung).toBeLessThan(LEN - inset);
          expect(local.y, rung).toBeGreaterThan(RIM_TOP + 0.15);
          expect(local.y, rung).toBeLessThan(2.0);
          expect(rodGap(local), `${rung} ${p.x},${p.z} ${f}`).toBeGreaterThan(0.1);
        }
  });

  it("looks DOWN over the rim at the snow, the rim in the frame's foot", () => {
    for (const f of FACES) {
      const { lens, local } = framed(balloon({ face: f }), "tips");
      expect(down(lens)).toBeGreaterThan(0.85);
      // The rim's top straight ahead of the eye is inside the frame's
      // vertical half-angle, under the look.
      const q = multiply(fromEuler(0.7, 0, 0), fromEuler(f, 0, 0));
      const ahead = unrotate(q, rotate(fromEuler(0.7, 0, 0), local));
      const toRim = Math.atan2(ahead.y - RIM_TOP, 0.08);
      expect(Math.abs(toRim - down(lens))).toBeLessThan((lens.fov / 2) * (Math.PI / 180));
      // And the snow 120 m under it is in it.
      expect(lens.target.y).toBeLessThan(lens.eye.y);
    }
  });

  it("moves with him as he walks, and turns with the way he faces", () => {
    const left = framed(balloon({ walkX: -0.4 }), "tips").local;
    const right = framed(balloon({ walkX: 0.4 }), "tips").local;
    expect(right.x - left.x).toBeGreaterThan(0.4);
    const ahead = framed(balloon({ face: 0 }), "tips").lens;
    const side = framed(balloon({ face: Math.PI / 2 }), "tips").lens;
    const way = (l: LensPose) => Math.atan2(l.target.x - l.eye.x, l.target.z - l.eye.z);
    const turned = Math.atan2(Math.sin(way(side) - way(ahead)), Math.cos(way(side) - way(ahead)));
    expect(turned).toBeCloseTo(Math.PI / 2, 1);
    const eyes = framed(balloon({ walkZ: 0.5 }), "helmet").local;
    expect(eyes.z).toBeGreaterThan(0.5);
    expect(eyes.y).toBeCloseTo(BALLOON_LOOK.eyes.y, 1);
  });

  it("holds the whole balloon in every boom's frame", () => {
    const crown = BALLOON.envelope.mouthHeight + BALLOON.envelope.height;
    for (const rung of ["chase", "far", "high"] as const) {
      const b = balloon();
      const { lens } = framed(b, rung, 400);
      const away = Math.hypot(lens.eye.x - b.x, lens.eye.z - b.z);
      expect(away, rung).toBeGreaterThan(20);
      const half = ((lens.fov / 2) * Math.PI) / 180;
      const axis = Math.atan2(
        lens.target.y - lens.eye.y,
        Math.hypot(lens.target.x - lens.eye.x, lens.target.z - lens.eye.z),
      );
      for (const y of [b.y, b.y + crown]) {
        const at = Math.atan2(y - lens.eye.y, Math.hypot(b.x - lens.eye.x, b.z - lens.eye.z));
        expect(Math.abs(at - axis), `${rung} ${y - b.y}`).toBeLessThan(half);
      }
    }
  });

  it("keeps one ladder object, so the lens hands over rather than cutting", () => {
    const ladder = createBalloonLadder();
    const pose = freshRigPose();
    const rigs = ladder.rigs;
    ladder.pose(pose, balloon(), null, 1 / 60);
    ladder.pose(pose, balloon({ walkX: 0.3 }), null, 1 / 60);
    expect(ladder.rigs).toBe(rigs);
  });

  it("flies a change of rung over the rim and round the envelope, never through them", () => {
    const b = balloon({ walkX: 0.3, walkZ: 0.4, face: 0.7 });
    const at = { x: b.x, y: b.y, z: b.z, q: fromEuler(b.heading, 0, 0) };
    const e = KEEP_OUT.envelope;
    for (const [from, to] of [
      ["tips", "chase"],
      ["helmet", "high"],
      ["helmet", "far"],
      ["orbit", "tips"],
      ["tips", "helmet"],
    ] as const) {
      const a = framed(b, from, 400).lens;
      const z = framed(b, to, 400).lens;
      for (let k = 0; k <= 40; k++) {
        const eye = { ...blendLens(a, z, k / 40).eye };
        keepOutOfBalloon(eye, at);
        const l = unrotate(at.q, { x: eye.x - b.x, y: eye.y - b.y, z: eye.z - b.z });
        const inWicker =
          Math.abs(l.x) < W && Math.abs(l.z) < LEN && l.y > 0 && l.y < KEEP_OUT.rimTop;
        expect(inWicker, `${from}→${to} ${k}`).toBe(false);
        const r = Math.hypot(l.x / e.across, (l.y - e.y) / e.up, l.z / e.across);
        expect(r, `${from}→${to} ${k}`).toBeGreaterThan(0.999);
      }
    }
    // The first-person eyes themselves are left where they stand.
    for (const rung of ["tips", "helmet"] as const) {
      const eye = { ...framed(b, rung).lens.eye };
      const was = { ...eye };
      keepOutOfBalloon(eye, at);
      expect(eye).toEqual(was);
    }
  });

  it("frames the whole envelope across a phone held upright", () => {
    const ladder = createBalloonLadder();
    const wide = { ...ladder.rigs.chase };
    ladder.fit(390 / 844);
    for (const rung of ["chase", "far", "high", "orbit"] as const) {
      const r = ladder.rigs[rung];
      const arm =
        r.kind === "boom" ? Math.hypot(r.dist, r.height) : r.kind === "orbit" ? r.radius : 0;
      const half = Math.atan(Math.tan(((r.fov / 2) * Math.PI) / 180) * (390 / 844));
      // The envelope's half-width is inside the frame's half-width, with room.
      expect(Math.atan(BALLOON.envelope.diameter / 2 / arm), rung).toBeLessThan(half * 0.85);
    }
    expect(ladder.rigs.chase.fov).toBeGreaterThan(wide.fov);
    ladder.fit(16 / 9);
    expect(ladder.rigs.chase).toEqual(wide);
  });
});
