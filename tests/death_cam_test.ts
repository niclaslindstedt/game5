// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEATH CAM (`camera-death.ts`): the skier thrown into the lone trunk
// on the stadium, stepped the way the app steps him — at the rate the cam
// hands out — and the lens read frame by frame. It leaves the ladder where
// the ladder was, slows the picture smoothly into the impact, closes in on
// him, rises over him once he lies still, and hands back on the reset; the
// engine gives it that still beat before it stands him up.

import { describe, expect, it } from "vitest";

import { createGame, NEUTRAL_INPUT, placeRun, step, TUNING, type GameState } from "@engine";

import { createDeathCam, DEATH, fallLeft, frameDeath } from "../pwa/src/game/camera-death.ts";
import type { LensPose } from "../pwa/src/game/camera-rigs.ts";
import { createBodyTrack, observeBody, sampleBody } from "../pwa/src/game/interp.ts";
import { LONE_TREE, syntheticLevel } from "./support/synthetic.ts";

const FRAME = 1 / 60;

type Frame = {
  rate: number;
  lens: LensPose | null;
  bodyY: number;
  still: number;
  touching: boolean;
  /** Coming down: the impact is the first touch while falling, because a
   * skier is thrown off his own feet on the snow and his launch touches. */
  falling: boolean;
  ended: boolean;
};

/** A trunk at 50 km/h, the frames drawn at 60 Hz until the reset and a
 * second past it. */
function crash(): { frames: Frame[]; ladder: LensPose; state: GameState } {
  const state = createGame({ level: syntheticLevel(), rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: LONE_TREE.x + 0.4, z: LONE_TREE.z - 30, heading: 0, speed: 50 / 3.6 });
  const cam = createDeathCam();
  const track = createBodyTrack();
  const frames: Frame[] = [];
  let acc = 0;
  let after = -1;
  const input = { ...NEUTRAL_INPUT, tuck: 1 };
  const ladder: LensPose = {
    eye: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    fov: 62,
    roll: 0,
  };
  for (let f = 0; f < 60 * 30 && after < 60; f++) {
    acc += FRAME * cam.rate;
    const steps = Math.floor(acc * TUNING.physicsHz + 1e-9);
    acc -= steps * TUNING.dt;
    for (let i = 0; i < steps; i++) step(state, input);
    const alpha = acc * TUNING.physicsHz;
    observeBody(track, state.skier.thrown, state.tick);
    const s = state.skier;
    // The ladder's chase lens, roughly: behind the skis and over it.
    ladder.eye = { x: s.x, y: s.y + 1.9, z: s.z - 5.2 };
    ladder.target = { x: s.x, y: s.y + 0.7, z: s.z + 7 };
    const body = sampleBody(track, alpha);
    const lens = frameDeath(cam, body, ladder, FRAME, state.level.groundAt);
    frames.push({
      rate: cam.rate,
      lens,
      bodyY: body?.y ?? 0,
      still: body?.still ?? 0,
      touching: body?.touching ?? false,
      falling: (body?.vy ?? 0) <= 0,
      ended: cam.ended,
    });
    if (after >= 0 || (cam.ended && after < 0)) after++;
  }
  return { frames, ladder, state };
}

describe("the death cam", () => {
  const { frames } = crash();
  const on = frames.findIndex((f) => f.lens !== null);
  const end = frames.findIndex((f) => f.ended);
  const impact = frames.findIndex((f, i) => i > on && f.touching && f.falling);

  it("takes the lens when he is thrown and gives it back on the reset", () => {
    expect(on).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(on);
    expect(frames.slice(on, end).every((f) => f.lens !== null)).toBe(true);
    expect(frames.slice(end).every((f) => f.lens === null)).toBe(true);
  });

  it("flies off the ladder rather than cutting to itself", () => {
    const a = frames[on - 1];
    const b = frames[on].lens!;
    expect(a.lens).toBeNull();
    // The first frame is a fraction of the way from where the ladder was.
    const moved = frames[on + 1].lens!;
    const step = Math.hypot(moved.eye.x - b.eye.x, moved.eye.y - b.eye.y, moved.eye.z - b.eye.z);
    expect(step).toBeLessThan(1);
  });

  it("slows into the impact smoothly, and is slow when he lands", () => {
    expect(impact).toBeGreaterThan(on);
    expect(frames[on].rate).toBeGreaterThan(0.9);
    expect(frames[impact].rate).toBeLessThan(0.55);
    const floor = Math.min(...frames.map((f) => f.rate));
    expect(floor).toBeLessThan(DEATH.slow + 0.05);
    expect(floor).toBeGreaterThanOrEqual(DEATH.slow - 1e-9);
    for (let i = 1; i < frames.length; i++) {
      expect(Math.abs(frames[i].rate - frames[i - 1].rate)).toBeLessThan(0.08);
    }
  });

  it("closes in on him while he goes, zoomed in", () => {
    const flying = frames.slice(on, impact + 60).map((f) => f.lens!);
    expect(flying.at(-1)!.fov).toBeLessThan(52);
  });

  it("rises into the sky over him once he lies still, swaying", () => {
    const rest = frames.findIndex((f) => f.still > 0);
    expect(rest).toBeGreaterThan(impact);
    expect(rest).toBeLessThan(end);
    const last = frames[end - 1];
    const lens = last.lens!;
    expect(lens.eye.y - last.bodyY).toBeGreaterThan(12);
    // Looking down on him, not along the snow.
    const down = lens.eye.y - lens.target.y;
    const across = Math.hypot(lens.eye.x - lens.target.x, lens.eye.z - lens.target.z);
    expect(down / across).toBeGreaterThan(2);
    const rolls = frames.slice(rest, end).map((f) => f.lens!.roll);
    expect(Math.max(...rolls) - Math.min(...rolls)).toBeGreaterThan(0.03);
    // ...for long enough to be seen: the still beat, slowed — well over the
    // engine's own `lieStill` on screen.
    expect((end - rest) * FRAME).toBeGreaterThan(TUNING.crash.lieStill * 1.3);
  });

  it("comes back to full speed after the reset", () => {
    expect(frames.at(-1)!.rate).toBeGreaterThan(0.95);
  });
});

describe("the fall left", () => {
  it("is the time a body falling from a height takes to meet the snow", () => {
    expect(fallLeft(0, 0)).toBe(0);
    const h = 4.905;
    expect(fallLeft(h, 0)).toBeCloseTo(Math.sqrt((2 * h) / TUNING.g), 6);
    expect(fallLeft(0, 2)).toBeCloseTo(4 / TUNING.g, 6);
  });
});
