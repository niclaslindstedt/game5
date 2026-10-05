// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S VOICE (`pwa/src/game/audio/sled-voice.ts`) and its bed's
// reading of the state (`sled-bed.ts`'s `sledVoiceOf`): a pure function of
// the machine — the note says the revs, the belt's whine its track speed,
// the churn the paddles spinning in powder — and silence with the engine
// shut off.

import { describe, expect, it } from "vitest";
import { NEUTRAL_INPUT, SLED, createGame, step } from "@engine";

import {
  beltHz,
  noteHz,
  revOf,
  sledHeard,
  sledTargets,
  type SledVoice,
} from "../pwa/src/game/audio/sled-voice.ts";
import { sledVoiceOf } from "../pwa/src/game/audio/sled-bed.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const MIX = { engine: 1, exhaust: 1, tone: 1 };
const at = (o: Partial<SledVoice>): SledVoice => ({
  rpm: SLED.idleRpm,
  rev: 0,
  throttle: 0,
  load: 0,
  treadSpeed: 0,
  slip: 0,
  loose: 0,
  ...o,
});

describe("the snowmobile's voice", () => {
  it("fires twice a revolution: a 50 Hz chug at idle, near 280 Hz on the limiter", () => {
    expect(noteHz(1500)).toBeCloseTo(50);
    expect(noteHz(SLED.maxRpm)).toBeGreaterThan(270);
    expect(revOf(SLED.idleRpm, SLED.idleRpm, SLED.maxRpm)).toBe(0);
    expect(revOf(SLED.maxRpm, SLED.idleRpm, SLED.maxRpm)).toBe(1);
  });

  it("whines at the track's speed, not the crank's", () => {
    const slow = sledTargets(at({ rpm: 7800, rev: 0.9, treadSpeed: 10, throttle: 1 }), MIX);
    const fast = sledTargets(at({ rpm: 7800, rev: 0.9, treadSpeed: 30, throttle: 1 }), MIX);
    expect(slow.hum.hz).toBeCloseTo(fast.hum.hz!);
    expect(fast.belt.hz).toBeCloseTo(3 * slow.belt.hz!);
    expect(beltHz(30)).toBeGreaterThan(300);
  });

  it("comes on the pipe past a third of its band, and works harder with the load", () => {
    const low = sledTargets(at({ rpm: 3000, rev: 0.2, throttle: 1 }), MIX);
    const pipe = sledTargets(at({ rpm: 7800, rev: 0.9, throttle: 1 }), MIX);
    expect(low.rasp.level).toBe(0);
    expect(pipe.rasp.level).toBeGreaterThan(0);
    const free = sledTargets(at({ rpm: 7800, rev: 0.9, throttle: 1, load: 0 }), MIX);
    const worked = sledTargets(at({ rpm: 7800, rev: 0.9, throttle: 1, load: 1 }), MIX);
    expect(worked.hum.level).toBeGreaterThan(free.hum.level);
  });

  it("churns the powder as the belt spins in it, and hushes on the groomer", () => {
    const groomer = sledTargets(at({ treadSpeed: 20, slip: 10, loose: 0 }), MIX);
    const powder = sledTargets(at({ treadSpeed: 20, slip: 10, loose: 1 }), MIX);
    expect(groomer.churn.level).toBe(0);
    expect(powder.churn.level).toBeGreaterThan(0);
  });

  it("says nothing shut off and stood still, and fades with the distance", () => {
    const off = sledTargets(at({ rpm: 0 }), MIX);
    for (const t of Object.values(off)) expect(t.level).toBe(0);
    expect(sledHeard(60).gain).toBeLessThan(sledHeard(5).gain);
    expect(sledHeard(500).gain).toBe(0);
  });

  it("is read off the machine he rides, under him", () => {
    const s = createGame({
      level: syntheticLevel(),
      mode: "free",
      sled: true,
      crowd: 0,
      quiet: true,
    });
    for (let i = 0; i < 120; i++) step(s, { ...NEUTRAL_INPUT, tuck: 1 });
    const { voice, distance } = sledVoiceOf(s);
    expect(distance).toBe(0);
    expect(voice.throttle).toBeGreaterThan(0.9);
    expect(voice.rev).toBeGreaterThan(0.3);
  });
});
