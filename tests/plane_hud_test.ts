// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE AND THE SKYDIVE AS THE HUD READS THEM
// (`pwa/src/game/plane-hud.ts`): the plane flown from its door — its
// readings and the press the machine key is — and the skydive from the
// door to the snow, its PULL cue and its presses.

import { describe, expect, it } from "vitest";
import {
  CHUTE,
  NEUTRAL_INPUT,
  TUNING,
  createGame,
  planeAloft,
  skydiveAt,
  step,
  type GameState,
} from "@engine";

import { aloftInPlane, chuteOf, planeOf } from "../pwa/src/game/plane-hud.ts";
import { SCREEN_TO_ENGINE } from "../pwa/src/game/input-model.ts";
import { flatLevel } from "./support/synthetic.ts";

const SIZE = 4000;
const level = flatLevel({ size: SIZE });
const dt = TUNING.dt;
const ride = (o: { plane?: boolean; chute?: number } = { plane: true }): GameState =>
  createGame({ level, mode: "free", crowd: 0, quiet: true, ...o });

describe("planeOf", () => {
  it("is nothing on a ride with no plane", () => {
    expect(planeOf(createGame({ level, mode: "free", crowd: 0, quiet: true }))).toBeNull();
  });

  it("reads the plane on the strip with him in its door: stopped, a STEP OFF", () => {
    const hud = planeOf(ride());
    expect(hud?.kind).toBe("flown");
    if (hud?.kind !== "flown") return;
    expect(hud.grounded).toBe(true);
    expect(hud.press).toBe("stepoff");
    expect(hud.height).toBe(0);
    expect(hud.stall).toBe(false);
  });

  it("reads the plane in the air: its height, its speed, a JUMP", () => {
    const s = ride();
    planeAloft(s, { x: SIZE / 2, y: 900, z: SIZE / 2, heading: 0, speed: 50, power: 0.7 });
    const hud = planeOf(s);
    expect(hud?.kind).toBe("flown");
    if (hud?.kind !== "flown") return;
    expect(hud.press).toBe("jump");
    expect(hud.grounded).toBe(false);
    expect(hud.height).toBeGreaterThan(800);
    expect(hud.speed).toBeCloseTo(50, -1);
    expect(hud.throttle).toBe(s.plane!.controls.throttle);
    // The bank is the screen's: the engine's roll through the one flip.
    expect(hud.bank).toBeCloseTo(s.plane!.roll * SCREEN_TO_ENGINE, 9);
    expect(aloftInPlane(s)).toBe(true);
  });
});

describe("chuteOf", () => {
  it("is nothing with no skydive", () => {
    expect(chuteOf(ride())).toBeNull();
    expect(aloftInPlane(ride({}))).toBe(false);
  });

  it("reads freefall high up: OPEN, no PULL cue yet", () => {
    const s = ride({ chute: 1500 });
    const hud = chuteOf(s);
    expect(hud?.mode).toBe("freefall");
    expect(hud?.press).toBe("open");
    expect(hud?.pull).toBe(false);
    expect(hud!.height).toBeCloseTo(1500, -1);
    expect(aloftInPlane(s)).toBe(true);
  });

  it("calls PULL at the pull height", () => {
    const s = ride({ plane: true });
    skydiveAt(s, { x: SIZE / 2, z: SIZE / 2, agl: CHUTE.bot.open - 50 });
    expect(chuteOf(s)?.pull).toBe(true);
  });

  it("names CUT AWAY under the open canopy, and nothing while it opens", () => {
    const s = ride({ chute: 1500 });
    step(s, { ...NEUTRAL_INPUT, machine: true });
    let opening = false;
    const mode = (): string => s.chute!.mode;
    for (let i = 0; i < Math.round(8 / dt) && mode() !== "open"; i++) {
      step(s, NEUTRAL_INPUT);
      if (mode() !== "freefall" && mode() !== "open") opening ||= chuteOf(s)?.press === null;
    }
    expect(opening).toBe(true);
    expect(s.chute!.mode).toBe("open");
    expect(chuteOf(s)?.press).toBe("release");
  });
});
