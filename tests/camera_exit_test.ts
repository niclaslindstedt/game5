// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EXIT CUT (`camera-exit.ts`): the leap out of the jump plane, off the
// helicopter's skid and over the balloon's rim shot as a film. These hold
// the shots' order and the slow motion, when the cut has him and when it
// lets go (a pull, a throw, a changed camera, too low, the paramotor), and
// that every shot frames what it says — his own eyes on the leap and on the
// craft going away, the camera flyer with the craft behind him, the long
// lens from the craft holding him — never looking straight up or down and
// never under the snow.

import { describe, expect, it } from "vitest";
import { fromEuler, PLANE, type ChuteCraft, type ChuteState } from "@engine";
import {
  createExitCut,
  EXIT_CUT,
  EXIT_END,
  exitBar,
  exitCraftOf,
  exitCutOn,
  exitLens,
  exitPace,
  exitShotAt,
  exitSkipOf,
  type ExitCraft,
  type ExitShot,
} from "../pwa/src/game/camera-exit.ts";
import type { LensPose } from "../pwa/src/game/camera-rigs.ts";

/** A jump `since` s out of `from`, `agl` m over the snow, heading +z. */
function jump(over: Partial<ChuteState> = {}): ChuteState {
  return {
    mode: "exit",
    from: "plane" as ChuteCraft,
    since: 0,
    t: 0,
    heading: 0,
    agl: 2000,
    done: false,
    fell: false,
    ...over,
  } as ChuteState;
}

const flat = (): number => 0;
const at = { x: 0, y: 1500, z: 0 };
/** A craft over and ahead of him, as the plane is once he is out. */
const ahead: ExitCraft = {
  middle: { x: 0, y: 1530, z: 60 },
  mount: { x: -1, y: 1530, z: 59 },
  out: { x: -1, y: 0, z: 0 },
};
/** A craft right over him, as the helicopter and the balloon are. */
const over: ExitCraft = {
  middle: { x: 0.5, y: 1540, z: 0 },
  mount: { x: 1, y: 1538, z: 0 },
  out: { x: 1, y: 0, z: 0 },
};

const look = (l: LensPose) => {
  const dx = l.target.x - l.eye.x;
  const dy = l.target.y - l.eye.y;
  const dz = l.target.z - l.eye.z;
  const n = Math.hypot(dx, dy, dz);
  return { x: dx / n, y: dy / n, z: dz / n };
};
/** The angle off the lens's axis a point stands, deg. */
function offAxis(l: LensPose, p: { x: number; y: number; z: number }): number {
  const a = look(l);
  const dx = p.x - l.eye.x;
  const dy = p.y - l.eye.y;
  const dz = p.z - l.eye.z;
  const n = Math.hypot(dx, dy, dz);
  return (Math.acos((a.x * dx + a.y * dy + a.z * dz) / n) * 180) / Math.PI;
}

describe("the exit cut's shots and pace", () => {
  it("runs close, out, back, drop in order and ends", () => {
    const order: ExitShot[] = [];
    for (let t = 0; t < EXIT_END; t += 0.05) {
      const s = exitShotAt(t)!.shot;
      if (order[order.length - 1] !== s) order.push(s);
    }
    expect(order).toEqual(["close", "out", "back", "drop"]);
    expect(exitShotAt(EXIT_END)).toBeNull();
  });

  it("goes without the look back off the paramotor, its time the drop's", () => {
    const skip = exitSkipOf("para");
    expect(skip).toBe("back");
    expect(exitSkipOf("heli")).toBeUndefined();
    for (let t = 0; t < EXIT_END; t += 0.05) expect(exitShotAt(t, skip)!.shot).not.toBe("back");
    expect(exitShotAt(3, skip)!.shot).toBe("drop");
    expect(exitShotAt(EXIT_END, skip)).toBeNull();
    const high = exitSkipOf("plane");
    expect(high).toBe("out");
    for (let t = 0; t < EXIT_END; t += 0.05) expect(exitShotAt(t, high)!.shot).not.toBe("out");
    expect(exitSkipOf("heli")).toBeUndefined();
    expect(exitSkipOf("balloon")).toBeUndefined();
  });

  it("slows the leap and gives the run back its pace", () => {
    expect(exitPace(0)).toBeCloseTo(EXIT_CUT.slow.pace);
    expect(exitPace(0.7)).toBeGreaterThan(EXIT_CUT.slow.pace);
    expect(exitPace(0.7)).toBeLessThan(1);
    expect(exitPace(EXIT_CUT.slow.end)).toBeCloseTo(1);
    expect(exitPace(3)).toBe(1);
  });
});

describe("when the cut has him", () => {
  it("out of the plane, the helicopter, the balloon and the paramotor", () => {
    for (const from of ["plane", "heli", "balloon", "para"] as ChuteCraft[]) {
      expect(exitCutOn(jump({ from }), false)).toBe(true);
    }
  });

  it("lets go once he pulls, is thrown, is low or the shots are over", () => {
    expect(exitCutOn(jump({ mode: "freefall", since: 2 }), false)).toBe(true);
    expect(exitCutOn(jump({ mode: "deploying", since: 2 }), false)).toBe(false);
    expect(exitCutOn(jump(), true)).toBe(false);
    expect(exitCutOn(jump({ agl: EXIT_CUT.least.keep - 1 }), false)).toBe(false);
    expect(exitCutOn(jump({ mode: "freefall", since: EXIT_END }), false)).toBe(false);
  });

  it("is let go of for the jump when the camera is changed, and cut back hard", () => {
    const cut = createExitCut();
    const ch = jump();
    expect(cut.want(ch, false, "chase")?.shot).toBe("close");
    const pose: LensPose = {
      eye: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 0, z: 1 },
      fov: 80,
      roll: 0,
    };
    const next: LensPose = {
      eye: { x: 9, y: 9, z: 9 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
      roll: 0,
    };
    cut.frame(pose);
    expect(cut.lens(next, 1 / 60)).toEqual(pose);
    for (let i = 0; i < 30; i++) cut.lens(next, 1 / 60);
    expect(cut.share()).toBe(1);
    expect(cut.pace()).toBeLessThan(1);
    ch.since = 0.3;
    ch.mode = "freefall";
    expect(cut.want(ch, false, "helmet")).toBeNull();
    cut.frame(null);
    expect(cut.pace()).toBe(1);
    // The game's lens at once, as a film cuts; only the letterbox eases off.
    expect(cut.lens(next, 1 / 60)).toBeNull();
    expect(cut.share()).toBeGreaterThan(0);
    // ...and not taken up again on the old rung for the same jump.
    ch.since = 0.4;
    expect(cut.want(ch, false, "chase")).toBeNull();
    for (let i = 0; i < 200; i++) cut.lens(next, 1 / 60);
    expect(cut.share()).toBe(0);
  });

  it("films no jump too low to be filmed", () => {
    const cut = createExitCut();
    expect(cut.want(jump({ agl: EXIT_CUT.least.start - 1 }), false, "chase")).toBeNull();
  });
});

describe("each shot frames what it says", () => {
  const shots: ExitShot[] = ["close", "out", "back", "drop"];
  for (const craft of [ahead, over]) {
    const name = craft === ahead ? "a craft ahead" : "a craft overhead";
    it(`never looks straight up or down, never under the snow — ${name}`, () => {
      for (const shot of shots) {
        for (const k of [0, 0.5, 1]) {
          for (const aspect of [16 / 9, 390 / 844]) {
            const l = exitLens(shot, k, k, jump({ since: k }), at, null, craft, flat, aspect);
            for (const v of [l.eye.x, l.eye.y, l.eye.z, l.target.x, l.fov])
              expect(Number.isFinite(v)).toBe(true);
            expect(Math.abs(look(l).y)).toBeLessThanOrEqual(Math.sin(EXIT_CUT.steep) + 1e-6);
            expect(l.eye.y).toBeGreaterThan(0);
          }
        }
      }
    });

    it(`holds him and the craft — ${name}`, () => {
      // His own eyes: at his head.
      const out = exitLens("out", 0.5, 0.5, jump(), at, null, craft, flat);
      expect(Math.hypot(out.eye.x - at.x, out.eye.y - at.y, out.eye.z - at.z)).toBeLessThan(1);
      // The flyer: in his face as he goes, then pulled back off him until
      // the craft stands behind him in the frame.
      const near = exitLens("close", 0, 0, jump(), at, null, craft, flat);
      expect(Math.hypot(near.eye.x - at.x, near.eye.y - at.y, near.eye.z - at.z)).toBeLessThan(2.5);
      expect(offAxis(near, at)).toBeLessThan(near.fov / 2);
      const wide = exitLens("close", 1, 1.6, jump({ since: 1.6 }), at, null, craft, flat);
      expect(Math.hypot(wide.eye.x - at.x, wide.eye.y - at.y, wide.eye.z - at.z)).toBeGreaterThan(
        6,
      );
      expect(offAxis(wide, at)).toBeLessThan(wide.fov / 2);
      expect(offAxis(wide, craft.middle)).toBeLessThan(wide.fov / 2);
      expect(wide.eye.y).toBeLessThan(at.y);
      // Looking back: the craft dead ahead (or as near as a level-ish look allows).
      const back = exitLens("back", 0.5, 3, jump({ since: 3 }), at, null, craft, flat);
      expect(offAxis(back, craft.middle)).toBeLessThan(back.fov / 2);
      // The drop: from the craft, him in the frame, on a long lens.
      const drop = exitLens("drop", 1, 5, jump({ since: 5 }), at, null, craft, flat);
      expect(Math.hypot(drop.eye.x - craft.mount.x, drop.eye.z - craft.mount.z)).toBeLessThan(
        EXIT_CUT.drop.swing + 1,
      );
      expect(Math.abs(drop.eye.y - craft.mount.y)).toBeLessThan(1);
      expect(offAxis(drop, at)).toBeLessThan(drop.fov / 2);
      expect(drop.fov).toBeLessThan(EXIT_CUT.drop.wide);
    });
  }
});

describe("the craft and the letterbox", () => {
  it("stands the plane's lens at its jump door, out on the door's side", () => {
    const pose = { x: 100, y: 2000, z: 50, q: fromEuler(0, 0, 0) };
    const c = exitCraftOf("plane", pose);
    expect(Math.sign(c.mount.x - pose.x)).toBe(Math.sign(PLANE.door.x));
    expect(c.out.x * Math.sign(PLANE.door.x)).toBeGreaterThan(0.99);
    expect(c.middle.y).toBeGreaterThan(pose.y);
  });

  it("is a cinema frame on a wide screen and a thinner bar on a tall one", () => {
    expect(exitBar(16 / 9, 1)).toBeCloseTo((1 - 16 / 9 / EXIT_CUT.bars.scope) / 2, 3);
    expect(exitBar(390 / 844, 1)).toBeCloseTo(EXIT_CUT.bars.tall);
    expect(exitBar(16 / 9, 0)).toBe(0);
  });
});
