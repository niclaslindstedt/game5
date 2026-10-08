// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TITLE SCENE'S DECISIONS (`title-plan.ts`) and the shell's half of it:
// the crop every screen shape is shown is inside the plate and covers the
// screen; the drift stays inside the margin the zoom leaves; the beats run
// in order; reduced motion holds the lens and drops the particles; the
// resolution only ever steps down; the attract card's reveal (`splash.ts`),
// the backdrop the front door stands over (`shell.ts`) and the frozen title
// clock a lab reads off the URL (`url-params.ts`).

import { describe, expect, it } from "vitest";

import plateJson from "../pwa/src/title/title-plate.json";
import type { TitlePlate } from "../pwa/src/title/plates.ts";
import { initialBackdrop, titleUp, type Shell } from "../pwa/src/game/shell.ts";
import { revealAt } from "../pwa/src/game/splash.ts";
import {
  DPR_CAP,
  RENDER_SCALES,
  SLOW_FRAMES,
  SLOW_FRAME_MS,
  TITLE_BEATS,
  cropFor,
  driftAt,
  exposureAt,
  framingAt,
  particleCounts,
  pixelRatio,
  scaleAfter,
  zoomAt,
} from "../pwa/src/game/title-plan.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

const plate = plateJson as unknown as TitlePlate;
/** From a tall phone (9:21) to an ultrawide (21:9). */
const ASPECTS = [9 / 21, 390 / 844, 9 / 16, 3 / 4, 1, 4 / 3, 16 / 10, 16 / 9, 844 / 390, 21 / 9];
const EPS = 1e-9;

const inside = ([x, y, w, h]: readonly number[]): boolean =>
  x >= -EPS && y >= -EPS && x + w <= 1 + EPS && y + h <= 1 + EPS && w > 0 && h > 0;

describe("the title's framing (title-plan.ts)", () => {
  it("crops every screen shape inside the plate, at the screen's own aspect", () => {
    for (const aspect of ASPECTS) {
      const r = cropFor(aspect, plate);
      expect(inside(r), `aspect ${aspect.toFixed(3)}`).toBe(true);
      expect(r[2] / r[3]).toBeCloseTo(aspect, 6);
    }
  });

  it("shows a wide screen the landscape crop's width and a tall one the portrait's height", () => {
    const wide = cropFor(plate.crops.landscape[2] / plate.crops.landscape[3], plate);
    expect(wide[2]).toBeCloseTo(plate.crops.landscape[2], 3);
    const tall = cropFor(plate.crops.portrait[2] / plate.crops.portrait[3], plate);
    expect(tall[3]).toBeCloseTo(plate.crops.portrait[3], 3);
  });

  it("keeps the drifting, pushing, leaning frame inside the plate at every moment", () => {
    for (const aspect of ASPECTS) {
      for (let t = 0; t <= 120; t += 0.75) {
        for (const menu of [0, 0.5, 1]) {
          const f = framingAt(t, aspect, plate, menu, [1, -1]);
          expect(inside(f.rect), `aspect ${aspect} t ${t} menu ${menu}`).toBe(true);
          expect(Math.abs(f.parallax[0])).toBeLessThan(0.02);
          expect(Math.abs(f.parallax[1])).toBeLessThan(0.02);
        }
      }
    }
  });

  it("drifts by less than the margin the rest zoom leaves", () => {
    const margin = (1 - 1 / zoomAt(0, 0)) / 2;
    for (let t = 0; t < 600; t += 0.37) {
      const [dx, dy] = driftAt(t);
      expect(Math.abs(dx)).toBeLessThan(margin);
      expect(Math.abs(dy)).toBeLessThan(margin);
    }
  });

  it("holds the lens still and drops the particles under reduced motion", () => {
    expect(driftAt(13, true)).toEqual([0, 0]);
    expect(zoomAt(0, 0, true)).toBe(zoomAt(1000, 0, true));
    const a = framingAt(3, 16 / 9, plate, 0, [1, 1], true);
    const b = framingAt(47, 16 / 9, plate, 0, [-1, 0], true);
    expect(a.rect).toEqual(b.rect);
    expect(a.parallax).toEqual([0, 0]);
    expect(particleCounts(1280, 720, true)).toEqual({ snow: [0, 0, 0], spray: 0 });
  });

  it("zooms in for the front door and slides the subject aside", () => {
    expect(zoomAt(10, 1)).toBeGreaterThan(zoomAt(10, 0));
    const rest = framingAt(10, 16 / 9, plate, 0);
    const menu = framingAt(10, 16 / 9, plate, 1);
    const subjectU = (r: readonly number[]): number => (plate.subject[0] - r[0]) / r[2];
    expect(subjectU(menu.rect)).toBeGreaterThan(0.5);
    expect(menu.rect[2]).toBeLessThan(rest.rect[2]);
  });

  it("runs the reveal's beats in order and the exposure up from black", () => {
    const b = TITLE_BEATS;
    expect(b.publisherOut).toBeLessThan(b.logo);
    expect(b.logo).toBeLessThan(b.prompt);
    expect(b.exposure).toBeLessThanOrEqual(b.prompt);
    expect(exposureAt(-1)).toBe(0);
    expect(exposureAt(0)).toBe(0);
    expect(exposureAt(b.exposure / 1000)).toBe(1);
    expect(exposureAt(0.9)).toBeGreaterThan(exposureAt(0.3));
  });

  it("scales the particles with the screen, inside their bounds", () => {
    const phone = particleCounts(390, 844);
    const desk = particleCounts(1280, 720);
    const huge = particleCounts(3840, 2160);
    expect(phone.snow[0]).toBeLessThan(desk.snow[0]);
    expect(huge.snow[0]).toBe(Math.round(150 * 1.2));
    expect(particleCounts(10, 10).spray).toBe(Math.round(44 * 0.5));
  });
});

describe("the title's resolution (title-plan.ts)", () => {
  it("caps the pixel ratio and steps it down by the scale", () => {
    expect(pixelRatio(1, 0)).toBe(1);
    expect(pixelRatio(3, 0)).toBe(DPR_CAP);
    expect(pixelRatio(3, 2)).toBeCloseTo(DPR_CAP * RENDER_SCALES[2]);
    expect(pixelRatio(0, 0)).toBe(1);
    expect(pixelRatio(2, 99)).toBeCloseTo(DPR_CAP * RENDER_SCALES[RENDER_SCALES.length - 1]);
  });

  it("drops a step only after a run of slow frames, and never climbs back", () => {
    let s = { step: 0, slow: 0 };
    for (let i = 0; i < SLOW_FRAMES - 1; i++) s = scaleAfter(s.step, s.slow, SLOW_FRAME_MS + 5);
    expect(s.step).toBe(0);
    s = scaleAfter(s.step, s.slow, SLOW_FRAME_MS + 5);
    expect(s).toEqual({ step: 1, slow: 0 });
    // A fast frame clears the run but keeps the step.
    s = scaleAfter(s.step, 10, 5);
    expect(s).toEqual({ step: 1, slow: 0 });
    for (let i = 0; i < SLOW_FRAMES * 5; i++) s = scaleAfter(s.step, s.slow, 100);
    expect(s.step).toBe(RENDER_SCALES.length - 1);
  });
});

describe("the attract card and the backdrop (splash.ts, shell.ts, url-params.ts)", () => {
  it("reveals the logo, then the invitation, and a skip shows everything at once", () => {
    expect(revealAt(0)).toEqual({ publisher: true, logo: false, prompt: false });
    expect(revealAt(TITLE_BEATS.logo)).toMatchObject({
      publisher: false,
      logo: true,
      prompt: false,
    });
    expect(revealAt(TITLE_BEATS.prompt).prompt).toBe(true);
    expect(revealAt(0, true)).toEqual({ publisher: false, logo: true, prompt: true });
  });

  it("opens over the title, a booted run over the race, and the URL over either", () => {
    expect(initialBackdrop("", false)).toBe("title");
    expect(initialBackdrop("?start=race", true)).toBe("race");
    expect(initialBackdrop("?backdrop=race", false)).toBe("race");
    expect(initialBackdrop("?backdrop=title", true)).toBe("title");
    expect(initialBackdrop("?backdrop=junk", false)).toBe("title");
  });

  it("draws the title only over the cards before a run, and never after one", () => {
    for (const shell of ["splash", "menu", "loading"] as Shell[]) {
      expect(titleUp("title", shell, false)).toBe(true);
      expect(titleUp("title", shell, true)).toBe(false);
      expect(titleUp("race", shell, false)).toBe(false);
    }
    for (const shell of ["run", "pause", "replay", "bench"] as Shell[]) {
      expect(titleUp("title", shell, false)).toBe(false);
    }
  });

  it("reads a frozen title time off the URL, and nothing else as one", () => {
    expect(readParams("").titleT).toBeNull();
    expect(readParams("?titleT=4").titleT).toBe(4);
    expect(readParams("?titleT=0.5").titleT).toBe(0.5);
    expect(readParams("?titleT=-1").titleT).toBeNull();
    expect(readParams("?titleT=junk").titleT).toBeNull();
  });
});
