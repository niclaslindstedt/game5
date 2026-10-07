// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY CAM'S DIRECTOR (`pwa/src/game/xray-shots.ts`): a blow seen
// coming slows the run and closes on the bone; a limb torn is a shot of its
// own; then the whole body, the run speeding back up; a blow that never
// lands lets the run go; and one fall is shot once.

import { describe, expect, it } from "vitest";

import { BONES, ORGANS, type GameState } from "@engine";

import type { Forecast } from "../pwa/src/game/impact-forecast.ts";
import { XRAY_BONES, XRAY_ORGANS } from "../pwa/src/game/xray-model.ts";
import { BIG_BONES, XRAY, boneKind, createXrayDirector } from "../pwa/src/game/xray-shots.ts";

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

const femur: Forecast = { in: 0.3, part: "thighL", bones: ["femurL"], gore: false };

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
    const look = run(d, s, 1);
    expect(look.active).toBe(true);
    expect(look.shot).toEqual({ kind: "bone", bone: "femurL" });
    expect(look.rate).toBeLessThan(XRAY.slow * 1.2);
    expect(look.xray).toBe(1);
    // A second of wall is a fraction of a second of the run.
    expect(s.t).toBeLessThan(0.2);
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
    let look = d.frame(as(s), WALL);
    for (let w = 0; w < 20 && look.active; w += WALL) {
      s.t += WALL * look.rate;
      // The femur breaks when it was seen to.
      if (s.t >= 0.3 && !shots.includes("broke")) {
        s.events.push({ kind: "injury", t: s.t, part: "thighL", injury: "brokenFemur", ais: 3 });
        shots.push("broke");
      }
      d.step(as(s));
      s.events = [];
      look = d.frame(as(s), WALL);
      const name = look.shot?.kind === "bone" ? look.shot.bone : (look.shot?.kind ?? "-");
      if (shots.at(-1) !== name) shots.push(name);
    }
    expect(shots.filter((x) => x !== "broke")).toEqual(["femurL", "tear", "body", "-"]);
  });

  it("holds on a body that is dying", () => {
    const d = createXrayDirector();
    const s = fake();
    s.skier.thrown = {};
    d.step(as(s));
    s.events.push({ kind: "gore", t: 0, what: "torn", piece: "head", x: 0, y: 0, z: 0 });
    d.step(as(s));
    s.events = [];
    s.gore = { dead: -1, mortal: 0 };
    const look = run(d, s, XRAY.tear + XRAY.bodyHold + 4);
    expect(look).toMatchObject({ active: true, shot: { kind: "body" } });
    expect(look.rate).toBeGreaterThan(0.95);
    expect(look.xray).toBe(0);
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
