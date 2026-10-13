// The rider and gear cards' stage: the rider's idle never jumps between
// habits, and the skier is framed in the part of the screen the card leaves
// free.
import { describe, expect, it } from "vitest";
import { keyPoints } from "../pwa/src/game/party-pose.ts";
import { DEFAULT_OUTFIT, GEAR, type Outfit } from "../pwa/src/game/outfit.ts";
import { idleKey, idleRoom } from "../pwa/src/game/rider-idle.ts";
import { freeOf } from "../pwa/src/game/stage-free.ts";

describe("the rider's idle", () => {
  it("moves smoothly through every habit, never a jump between frames", () => {
    const frame = 1 / 60;
    let last = keyPoints(idleKey(0), 0);
    let worst = 0;
    for (let t = frame; t < 60; t += frame) {
      const now = keyPoints(idleKey(t), 0);
      for (let i = 0; i < now.length; i++) worst = Math.max(worst, Math.abs(now[i] - last[i]));
      last = now;
    }
    // A hand moves at most a couple of metres a second while he fidgets.
    expect(worst).toBeLessThan(0.04);
  });

  it("hangs his fists clear of his pants, the broader the leg the further out", () => {
    // The thigh's outside at its fullest: the hip joint (0.12 m out), the
    // thigh's radius on the build and the pants' ease over it; a glove's
    // fist reaches about 0.045 m in from the hand toward it.
    const ease = { insulated: 0.024, race: 0.012, baggy: 0.05, cargo: 0.034 };
    for (const w of GEAR.weight)
      for (const p of GEAR.pants) {
        const o = { ...DEFAULT_OUTFIT, weight: w.id, pants: p.id } as Outfit;
        const thigh = 0.12 + 0.1 * (1 + (w.girth - 1) * 0.7) + ease[p.id];
        for (const t of [0, 3, 7.5, 12, 20]) {
          const k = idleKey(t, idleRoom(o));
          for (const h of k.hands) expect(Math.abs(h.x - k.hipX) - 0.045).toBeGreaterThan(thigh);
        }
      }
  });

  it("stands him on his feet: the hips about a skier's height up", () => {
    for (const t of [0, 3, 7.5, 12, 20]) {
      const hipY = keyPoints(idleKey(t), 0)[1];
      expect(hipY).toBeGreaterThan(0.8);
      expect(hipY).toBeLessThan(1.0);
    }
  });
});

describe("the stage's free part", () => {
  const stage = { left: 0, top: 0, width: 1000, height: 600 };

  it("leaves the left of the screen when the card is a panel on the right", () => {
    const f = freeOf(stage, [{ left: 640, top: 40, width: 340, height: 500 }]);
    expect(f.x).toBe(0);
    expect(f.w).toBeCloseTo(0.64);
    expect(f.h).toBe(1);
  });

  it("leaves the band between a head and a sheet on a phone", () => {
    const phone = { left: 0, top: 0, width: 390, height: 844 };
    const f = freeOf(phone, [
      { left: 0, top: 0, width: 390, height: 60 },
      { left: 0, top: 560, width: 390, height: 284 },
    ]);
    expect(f.y).toBeCloseTo(60 / 844);
    expect(f.h).toBeCloseTo(500 / 844);
    expect(f.w).toBe(1);
  });

  it("never frames him in less than a quarter of the screen", () => {
    const f = freeOf(stage, [{ left: 0, top: 0, width: 990, height: 590 }]);
    expect(f.w * f.h).toBeGreaterThanOrEqual(0.0625 - 1e-9);
  });
});
