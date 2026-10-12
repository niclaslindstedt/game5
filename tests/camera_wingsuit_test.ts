// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT'S LENSES (`camera-wingsuit.ts`): the chase flyer straight
// behind and over him looking along his way, the far flyer behind him too,
// the first person ahead and down, the launch's dramatic shot flown round
// behind him within two seconds, the hover exit framed off the helicopter's
// side and out of its disc, and every change of rung flown round him.

import { describe, expect, it } from "vitest";
import { HELI, type ChuteState } from "@engine";

import {
  createWingsuitCam,
  flightWay,
  IN_VIEW,
  keepInView,
  launchShare,
  SUIT_DIVE,
  SUIT_LAUNCH,
  swingLens,
  wingsuitFramed,
  wingsuitLens,
  type SuitSubject,
} from "../pwa/src/game/camera-wingsuit.ts";
import type { LensPose } from "../pwa/src/game/camera-rigs.ts";

const flat = (): number => 0;
const at = { x: 0, y: 500, z: 0 };
// Gliding along +z at 45 m/s, 13 m/s down.
const v = { x: 0, y: -13, z: 45 };
const subject = (o: Partial<SuitSubject> = {}): SuitSubject => ({
  at,
  v,
  ground: flat,
  eyes: null,
  hover: false,
  aspect: 16 / 9,
  ...o,
});
const chute = (mode: ChuteState["mode"], o: Partial<ChuteState> = {}): ChuteState =>
  ({
    mode,
    suit: "wingsuit",
    heading: 0,
    t: 1,
    since: 10,
    done: false,
    fell: false,
    ...o,
  }) as ChuteState;
const down = (l: LensPose): number => {
  const dx = l.target.x - l.eye.x;
  const dy = l.target.y - l.eye.y;
  const dz = l.target.z - l.eye.z;
  return Math.atan2(-dy, Math.hypot(dx, dz));
};

describe("the wingsuit's lenses in flight", () => {
  it("flies along his velocity once there is any", () => {
    const d = flightWay(0, v);
    expect(d.y).toBeLessThan(-0.2);
    expect(d.z).toBeGreaterThan(0.9);
    expect(flightWay(1, { x: 0, y: 0, z: 0 }).x).toBeCloseTo(Math.sin(1), 5);
  });

  it("chases from straight behind and over him, looking where he goes", () => {
    const l = wingsuitLens("chase", chute("freefall"), subject());
    expect(l.eye.z).toBeLessThan(at.z - 3);
    expect(Math.abs(l.eye.x - at.x)).toBeLessThan(0.5);
    expect(l.eye.y - at.y).toBeGreaterThan(1);
    expect(l.eye.y - at.y).toBeLessThan(6);
    // Down along his line, past him, but never straight down at the map.
    expect(down(l)).toBeGreaterThan(0.3);
    expect(down(l)).toBeLessThan(0.9);
    expect(l.target.z).toBeGreaterThan(at.z + 15);
  });

  it("keeps the far flyer behind him too, and the high lens over him", () => {
    const far = wingsuitLens("far", chute("freefall"), subject());
    expect(far.eye.z).toBeLessThan(at.z - 6);
    expect(Math.abs(far.eye.x - at.x)).toBeLessThan(2);
    const high = wingsuitLens("high", chute("freefall"), subject());
    expect(high.eye.y - at.y).toBeGreaterThan(8);
    expect(down(high)).toBeGreaterThan(0.6);
  });

  it("closes in on him in a dive", () => {
    const reach = (l: LensPose): number =>
      Math.hypot(l.eye.x - at.x, l.eye.y - at.y, l.eye.z - at.z);
    const glide = wingsuitLens("chase", chute("freefall"), subject());
    const fast = { x: 0, y: -60, z: SUIT_DIVE.full };
    const dive = wingsuitLens("chase", chute("freefall"), subject({ v: fast }));
    expect(reach(dive)).toBeLessThan(reach(glide) * (1 - SUIT_DIVE.close) + 0.3);
    expect(reach(dive)).toBeGreaterThan(1.5);
  });

  it("looks ahead and down out of his own eyes", () => {
    const l = wingsuitLens("helmet", chute("freefall"), subject());
    expect(l.target.z).toBeGreaterThan(l.eye.z);
    expect(down(l)).toBeGreaterThan(0.5);
  });

  it("keeps every lens over the snow", () => {
    const ground = (): number => at.y + 1;
    for (const r of ["chase", "far", "high", "orbit"] as const) {
      const l = wingsuitLens(r, chute("freefall"), subject({ ground }));
      expect(l.eye.y).toBeGreaterThanOrEqual(at.y + 3 - 1e-9);
    }
  });
});

describe("the hover exit", () => {
  it("frames him from out of the helicopter's side and disc", () => {
    // The machine on his left (-x at a heading of 0): away is +x.
    const away = { x: 1, y: 0, z: 0 };
    const hub = { x: at.x - 1.1, z: at.z };
    for (const r of ["chase", "far", "high", "orbit"] as const) {
      const l = wingsuitLens(
        r,
        chute("ready", { t: 2 }),
        subject({ hover: true, away, v: { x: 0, y: 0, z: 0 } }),
      );
      expect(l.eye.x).toBeGreaterThan(at.x + 2);
      expect(Math.hypot(l.eye.x - hub.x, l.eye.z - hub.z)).toBeGreaterThan(HELI.rotor.radius + 0.5);
    }
  });

  it("is flown into the flight's framing after the step off", () => {
    const s = subject({ hover: true, away: { x: 1, y: 0, z: 0 } });
    const early = wingsuitLens("chase", chute("exit", { since: 0.1 }), s);
    const late = wingsuitLens("chase", chute("exit", { since: 5 }), s);
    const fly = wingsuitLens("chase", chute("freefall"), s);
    expect(late).toEqual(fly);
    expect(early.eye.x).toBeGreaterThan(at.x + 2);
  });
});

describe("the launch", () => {
  it("opens in front of him off a ledge and is behind him within two seconds", () => {
    const s = subject();
    const early = wingsuitLens("chase", chute("exit", { since: 0.2 }), s);
    expect(early.eye.z).toBeGreaterThan(at.z + 3);
    const done = SUIT_LAUNCH.hold + SUIT_LAUNCH.fly;
    expect(done).toBeLessThanOrEqual(2);
    expect(launchShare(done + 1e-9)).toBe(1);
    const flown = wingsuitLens("chase", chute("freefall", { since: done + 1e-9 }), s);
    expect(flown).toEqual(wingsuitLens("chase", chute("freefall"), s));
    expect(flown.eye.z).toBeLessThan(at.z);
  });

  it("leaves his own eyes alone", () => {
    const s = subject();
    const eyes = wingsuitLens("helmet", chute("exit", { since: 0.2 }), s);
    expect(eyes).toEqual(wingsuitLens("helmet", chute("freefall", { since: 0.2 }), s));
  });
});

describe("keeping him in view", () => {
  it("turns an aim that has lost him back until he is inside the frame", () => {
    const lens: LensPose = {
      eye: { x: 0, y: 510, z: -5 },
      target: { x: 0, y: 510, z: 40 },
      fov: 60,
      roll: 0,
    };
    const off = (l: LensPose): number => {
      const t = { x: l.target.x - l.eye.x, y: l.target.y - l.eye.y, z: l.target.z - l.eye.z };
      const b = { x: at.x - l.eye.x, y: at.y - l.eye.y, z: at.z - l.eye.z };
      const c =
        (t.x * b.x + t.y * b.y + t.z * b.z) / Math.hypot(t.x, t.y, t.z) / Math.hypot(b.x, b.y, b.z);
      return Math.acos(c);
    };
    expect(off(lens)).toBeGreaterThan(0.6);
    const kept = keepInView(lens, at);
    expect(off(kept)).toBeCloseTo(((60 * Math.PI) / 360) * IN_VIEW, 5);
    expect(kept.eye).toEqual(lens.eye);
    // One that holds him already is left alone.
    const fine = wingsuitLens("chase", chute("freefall"), subject());
    expect(keepInView(fine, at)).toEqual(fine);
  });

  it("never loses him through the launch", () => {
    const s = subject({ v: { x: 0, y: -25, z: 6 } });
    for (let t = 0; t <= 2.5; t += 0.1) {
      const l = wingsuitLens("chase", chute(t < 1 ? "exit" : "freefall", { since: t }), s);
      const tx = l.target.x - l.eye.x;
      const ty = l.target.y - l.eye.y;
      const tz = l.target.z - l.eye.z;
      const bx = at.x - l.eye.x;
      const by = at.y - l.eye.y;
      const bz = at.z - l.eye.z;
      const c = (tx * bx + ty * by + tz * bz) / Math.hypot(tx, ty, tz) / Math.hypot(bx, by, bz);
      expect(Math.acos(Math.min(1, c))).toBeLessThanOrEqual(
        ((l.fov * Math.PI) / 360) * IN_VIEW + 1e-6,
      );
    }
  });
});

describe("the change of rung", () => {
  it("is flown round him, never through him", () => {
    const a: LensPose = { eye: { x: 0, y: 500, z: -6 }, target: at, fov: 60, roll: 0 };
    const b: LensPose = { eye: { x: 0, y: 500, z: 6 }, target: at, fov: 60, roll: 0 };
    for (let t = 0; t <= 1; t += 0.1) {
      const l = swingLens(at, a, b, t);
      expect(Math.hypot(l.eye.x - at.x, l.eye.y - at.y, l.eye.z - at.z)).toBeGreaterThan(3);
    }
  });

  it("flies a change and cuts a restart", () => {
    const cam = createWingsuitCam();
    const s = subject();
    const chase = wingsuitLens("chase", chute("freefall"), s);
    const far = wingsuitLens("far", chute("freefall"), s);
    cam.frame("chase", false, at, chase, true, 1 / 60);
    const mid = cam.frame("far", false, at, far, false, 0.3);
    expect(mid).not.toEqual(far);
    let last = mid;
    for (let i = 0; i < 120; i++) last = cam.frame("far", false, at, far, false, 1 / 60);
    expect(last).toEqual(far);
    expect(cam.frame("chase", false, at, chase, true, 1 / 60)).toEqual(chase);
  });

  it("is wanted from the exit through the glide, never off a craft before the jump", () => {
    expect(wingsuitFramed(chute("ready"), "cliff", false)).toBe(true);
    expect(wingsuitFramed(chute("ready"), "craft", false)).toBe(false);
    expect(wingsuitFramed(chute("freefall"), "craft", false)).toBe(true);
    expect(wingsuitFramed(chute("open"), "cliff", false)).toBe(false);
    expect(wingsuitFramed(chute("freefall", { suit: "box" }), "air", false)).toBe(false);
  });
});
