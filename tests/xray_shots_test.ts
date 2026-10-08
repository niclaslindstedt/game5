// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY CAM'S DIRECTOR (`pwa/src/game/xray-shots.ts`): a blow seen
// coming slows the run and closes on the bone; a limb torn is a shot of its
// own; then the whole body, the run speeding back up; a blow that never
// lands lets the run go; and one fall is shot once.

import { describe, expect, it } from "vitest";

import { BONES, ORGANS, type GameState } from "@engine";

import type { Forecast } from "../pwa/src/game/impact-forecast.ts";
import { XRAY_BONES, XRAY_ORGANS } from "../pwa/src/game/xray-model.ts";
import {
  BIG_BONES,
  SKIP,
  XRAY,
  boneKind,
  createSkipCount,
  createXrayDirector,
} from "../pwa/src/game/xray-shots.ts";

type Fake = {
  t: number;
  events: unknown[];
  skier: { thrown: object | null };
  gore: { dead: number; mortal: number } | undefined;
};

const fake = (): Fake => ({
  t: 0,
  events: [],
  skier: { thrown: null },
  gore: { dead: -1, mortal: -1 },
});
const as = (s: Fake): GameState => s as unknown as GameState;
const WALL = 1 / 60;

/** Run `wall` seconds of frames, the game clock going at the look's rate. */
function run(d: ReturnType<typeof createXrayDirector>, s: Fake, wall: number) {
  let look = d.frame(as(s), WALL);
  for (let w = 0; w < wall; w += WALL) {
    s.t += WALL * look.rate;
    d.step(as(s));
    s.events = [];
    look = d.frame(as(s), WALL);
  }
  return look;
}

const femur: Forecast = { in: 0.3, part: "thighL", bones: ["femurL"], gore: false, fatal: true };

describe("the X-ray director", () => {
  it("idles until a blow is seen coming", () => {
    const d = createXrayDirector();
    const s = fake();
    d.step(as(s));
    expect(d.frame(as(s), WALL)).toMatchObject({ active: false, rate: 1 });
    // Too far ahead: not yet.
    d.seen({ ...femur, in: XRAY.lead + 0.2 }, as(s));
    expect(d.frame(as(s), WALL).active).toBe(false);
  });

  it("slows the run and looks at the bone that will break", () => {
    const d = createXrayDirector();
    const s = fake();
    d.step(as(s));
    d.seen(femur, as(s));
    // The skier drawn solid for the lead's first half, the run still quick.
    let look = run(d, s, XRAY.leadSolid - 0.05);
    expect(look.active).toBe(true);
    expect(look.shot).toEqual({ kind: "bone", bone: "femurL" });
    expect(look.xray).toBe(0);
    expect(look.rate).toBeGreaterThan(XRAY.slow * 2);
    // Glass over the second half, and the blow lands a wall second in.
    look = run(d, s, XRAY.leadWall - XRAY.leadSolid);
    expect(look.xray).toBeGreaterThan(0.9);
    expect(look.rate).toBeLessThan(XRAY.slow * 1.2);
    expect(s.t).toBeGreaterThan(femur.in - 0.03);
    expect(s.t).toBeLessThan(femur.in + 0.03);
  });

  it("takes the run a wall second before a blow seen at the lead", () => {
    const d = createXrayDirector();
    const s = fake();
    d.step(as(s));
    d.seen({ ...femur, in: XRAY.lead }, as(s));
    let wall = 0;
    let look = d.frame(as(s), WALL);
    expect(look.rate).toBeGreaterThan(0.95);
    while (s.t < XRAY.lead && wall < 3) {
      s.t += WALL * look.rate;
      wall += WALL;
      d.step(as(s));
      look = d.frame(as(s), WALL);
    }
    expect(wall).toBeGreaterThan(XRAY.leadWall - 0.08);
    expect(wall).toBeLessThan(XRAY.leadWall + 0.08);
  });

  it("lets the run go when the blow seen coming never lands", () => {
    const d = createXrayDirector();
    const s = fake();
    d.step(as(s));
    d.seen({ ...femur, in: 0.05 }, as(s));
    const look = run(d, s, 12);
    expect(look.active).toBe(false);
    // Spent until he is stood up — he never fell, so the next step frees it.
    d.step(as(s));
    d.seen({ ...femur, in: 0.05 }, as(s));
    expect(d.frame(as(s), WALL).active).toBe(true);
  });

  it("pans to a torn limb, then pulls out to the body and speeds back up", () => {
    const d = createXrayDirector();
    const s = fake();
    s.skier.thrown = {};
    d.step(as(s));
    d.seen(femur, as(s));
    run(d, s, 0.5);
    s.events.push({ kind: "gore", t: s.t, what: "torn", piece: "legL", x: 1, y: 2, z: 3 });
    const shots: string[] = [];
    let broke = false;
    let look = d.frame(as(s), WALL);
    for (let w = 0; w < 20 && look.active; w += WALL) {
      s.t += WALL * look.rate;
      // The femur breaks when it was seen to.
      if (s.t >= 0.3 && !broke) {
        s.events.push({ kind: "injury", t: s.t, part: "thighL", injury: "brokenFemur", ais: 3 });
        broke = true;
      }
      d.step(as(s));
      s.events = [];
      look = d.frame(as(s), WALL);
      const name = look.shot?.kind === "bone" ? look.shot.bone : (look.shot?.kind ?? "-");
      if (shots.at(-1) !== name) shots.push(name);
    }
    expect(shots).toEqual(["femurL", "tear", "body", "-"]);
  });

  it("draws the lens back home and the skin back solid, then lets go", () => {
    const d = createXrayDirector();
    const s = fake();
    s.skier.thrown = {};
    s.gore = { dead: -1, mortal: 0 };
    d.step(as(s));
    s.events.push({ kind: "gore", t: 0, what: "torn", piece: "head", x: 0, y: 0, z: 0 });
    d.step(as(s));
    s.events = [];
    let look = run(d, s, XRAY.tear + 0.2);
    expect(look.shot?.kind).toBe("body");
    let back = look.back;
    let xray = look.xray;
    let rate = look.rate;
    for (let w = 0; w < XRAY.back + 2 && look.active; w += WALL) {
      look = run(d, s, WALL);
      if (!look.active) break;
      // Never a jump: the lens only goes home, the skin only comes back.
      expect(look.back).toBeGreaterThanOrEqual(back);
      expect(look.xray).toBeLessThanOrEqual(xray);
      expect(look.rate).toBeGreaterThanOrEqual(rate - 1e-9);
      expect(look.back - back).toBeLessThan(0.05);
      expect(xray - look.xray).toBeLessThan(0.05);
      ({ back, xray, rate } = look);
    }
    // It let go home, solid and at the run's own pace.
    expect(look.active).toBe(false);
    expect(back).toBeGreaterThan(0.99);
    expect(xray).toBeLessThan(0.01);
    expect(rate).toBeGreaterThan(0.97);
  });

  it("shoots only a fall he dies of", () => {
    const d = createXrayDirector();
    const s = fake();
    s.skier.thrown = {};
    d.step(as(s));
    // A bone broken that he lives through: seen coming or landed, no cam.
    d.seen({ ...femur, fatal: false }, as(s));
    s.events.push({ kind: "injury", t: 0, part: "thighL", injury: "brokenFemur", ais: 3 });
    d.step(as(s));
    s.events = [];
    expect(run(d, s, 0.5).active).toBe(false);
    // The run knows he is dying: the next blow is shot.
    s.gore = { dead: -1, mortal: s.t };
    s.events.push({ kind: "gore", t: s.t, what: "torn", piece: "armL", x: 0, y: 0, z: 0 });
    d.step(as(s));
    s.events = [];
    expect(run(d, s, 0.2).active).toBe(true);
  });

  it("closes first on the part of him the blow lands on", () => {
    const d = createXrayDirector();
    const s = fake();
    d.step(as(s));
    d.seen(
      { in: 0.3, part: "thighL", bones: ["pelvis", "femurL"], gore: false, fatal: true },
      as(s),
    );
    expect(run(d, s, 0.5).shot).toEqual({ kind: "bone", bone: "femurL" });
  });
});

describe("the X-ray skeleton (xray-model.ts)", () => {
  it("draws every bone and organ the body names, and nothing else", () => {
    expect(XRAY_BONES.map((p) => p.name).sort()).toEqual([...BONES].sort());
    expect(new Set(XRAY_ORGANS.map((p) => p.name.replace(/[LR]$/, "")))).toEqual(
      new Set(ORGANS.map((o) => o.replace(/[LR]$/, ""))),
    );
    for (const k of BIG_BONES) expect(XRAY_BONES.some((p) => boneKind(p.name) === k)).toBe(true);
  });
});

describe("skipping the X-ray cam", () => {
  it("lets go at once at the run's own pace and does not take the fall up again", () => {
    const d = createXrayDirector();
    const s = fake();
    d.step(as(s));
    d.seen(femur, as(s));
    expect(run(d, s, 0.3).active).toBe(true);
    d.skip(as(s));
    expect(d.frame(as(s), WALL)).toMatchObject({ active: false, rate: 1, xray: 0 });
    // The blow still coming is seen again, and left alone.
    d.step(as(s));
    d.seen({ ...femur, in: 0.1 }, as(s));
    expect(d.frame(as(s), WALL).active).toBe(false);
  });

  it("counts a mash of the keys, not one press", () => {
    const c = createSkipCount();
    expect(c.press(0)).toBe(false);
    expect(c.press(SKIP.within + 0.1)).toBe(false);
    expect(c.press(SKIP.within + 0.3)).toBe(true);
    expect(c.press(SKIP.within + 0.4)).toBe(false);
  });
});
