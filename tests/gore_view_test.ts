// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GORE AS DRAWN, in its three-free and DOM-free halves: where the
// skin is cut for a piece torn off (`gore-cut.ts`), how what flies off a
// body comes to rest on the snow (`gore-gibs.ts`), and the HUD taking his
// blows and his death (`hud-wreck.ts`).

import { describe, expect, it } from "vitest";
import { GORE_PIECES, type GorePiece } from "@engine";

import {
  PIECE_BONES,
  bodyCollapse,
  bodyHides,
  cutsOf,
  pieceCollapse,
} from "../pwa/src/game/gore-cut.ts";
import { rope, stepRope, stepStick, stick, type GibGround } from "../pwa/src/game/gore-gibs.ts";
import { DEATH, wreckOf } from "../pwa/src/game/hud-wreck.ts";
import type { BoneFrame, SkierBone } from "../pwa/src/game/skier-rig.ts";

const bit = (p: GorePiece): number => 1 << GORE_PIECES.indexOf(p);

/** A rig's frames stood up the y axis, each bone a step above the last. */
function framesOf(): Record<SkierBone, BoneFrame> {
  const names = new Set<SkierBone>(["chest", "head"] as SkierBone[]);
  for (const bones of Object.values(PIECE_BONES)) for (const b of bones) names.add(b);
  const out = {} as Record<SkierBone, BoneFrame>;
  [...names].forEach((name, i) => {
    out[name] = {
      head: { x: 0, y: i * 0.1, z: 0 },
      x: { x: 1, y: 0, z: 0 },
      y: { x: 0, y: 1, z: 0 },
      z: { x: 0, y: 0, z: 1 },
      length: 0.1,
    } as BoneFrame;
  });
  return out;
}

const FLAT: GibGround = {
  heightAt: () => 0,
  normalAt: (_x, _z, out) => {
    out.x = 0;
    out.y = 1;
    out.z = 0;
    return out;
  },
};

describe("the skin cut for a piece torn off", () => {
  it("cuts the body at the outermost piece that holds a lost bone", () => {
    expect(cutsOf(bit("forearmL"))).toEqual(["forearmL"]);
    expect(cutsOf(bit("forearmL") | bit("armL"))).toEqual(["armL"]);
    expect(cutsOf(bit("lower") | bit("legR") | bit("shinL"))).toEqual(["lower"]);
    expect(cutsOf(0)).toEqual([]);
  });

  it("hides every bone a lost piece took, and none it did not", () => {
    const hides = bodyHides(bit("head") | bit("legL"));
    expect([...hides.keys()].sort()).toEqual([...PIECE_BONES.head, ...PIECE_BONES.legL].sort());
    expect(hides.get("shin_l")).toBe("legL");
    expect(hides.has("thigh_r")).toBe(false);
  });

  it("collapses the body's lost bones at their cut, and a piece's other bones at its own", () => {
    const f = framesOf();
    const body = bodyCollapse(bit("armL"), -1, f);
    for (const b of PIECE_BONES.armL) expect(body.bones.get(b)).toEqual(f.upperarm_l.head);
    const piece = pieceCollapse("armL", f);
    for (const b of PIECE_BONES.armL) expect(piece.bones.has(b)).toBe(false);
    expect(piece.bones.get("chest")).toEqual(f.upperarm_l.head);
  });

  it("draws an arm torn after its forearm as the upper arm alone", () => {
    const f = framesOf();
    const piece = pieceCollapse("armL", f, bit("forearmL"));
    expect(piece.bones.get("forearm_l")).toEqual(f.forearm_l.head);
    expect(piece.bones.get("hand_l")).toEqual(f.forearm_l.head);
    expect(piece.bones.has("upperarm_l")).toBe(false);
  });
});

describe("what flies off a body", () => {
  it("a limb thrown comes down on the snow and lies still on it", () => {
    const dt = 1 / 60;
    const s = stick(
      { x: 0, y: 1.5, z: 0 },
      { x: 0.6, y: 1.5, z: 0 },
      { x: 6, y: 4, z: 0 },
      { x: 0, y: 2, z: 0 },
      0.08,
      0.05,
      8,
      dt,
    );
    for (let i = 0; i < 60 * 10; i++) stepStick(s, FLAT, dt);
    expect(s.down).toBe(true);
    expect(s.still).toBeGreaterThan(1);
    expect(s.a.y).toBeGreaterThanOrEqual(0.08 - 0.02);
    expect(s.a.y).toBeLessThan(0.2);
    expect(Math.hypot(s.a.x - s.b.x, s.a.y - s.b.y, s.a.z - s.b.z)).toBeCloseTo(0.6, 1);
  });

  it("a bowel held at the wound stays at it and keeps its links", () => {
    const dt = 1 / 60;
    const at = { x: 0, y: 0.6, z: 0 };
    const r = rope(at, { x: 2, y: 1, z: 0 }, 12, 0.08, 0.02, dt);
    for (let i = 0; i < 60 * 4; i++) stepRope(r, FLAT, dt);
    expect(r.p[0]).toEqual(at);
    for (let i = 0; i + 1 < r.p.length; i++) {
      const a = r.p[i];
      const b = r.p[i + 1];
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(0.08 * 1.3);
    }
    for (const p of r.p) expect(p.y).toBeGreaterThan(-0.01);
  });
});

describe("the HUD taking his blows", () => {
  it("is still and true while he is alive and nothing has struck him", () => {
    expect(wreckOf(null, null)).toMatchObject({ jolt: 0, fade: 0, word: 0, dark: 0 });
  });

  it("jolts on a blow and settles as it ages", () => {
    const fresh = wreckOf({ g: 120, id: 3, age: 0 }, null);
    expect(fresh.jolt).toBe(1);
    expect(fresh.joltId).toBe(3);
    expect(wreckOf({ g: 60, id: 3, age: 0 }, null).jolt).toBeCloseTo(0.5);
    expect(wreckOf({ g: 120, id: 3, age: 1 }, null).jolt).toBe(0);
  });

  it("fades its readouts, then says DIED and goes dark, in that order when he dies", () => {
    const at = (t: number) => wreckOf(null, t);
    expect(at(0)).toMatchObject({ fade: 0, word: 0, dark: 0 });
    expect(at(DEATH.clearing / 2).fade).toBeCloseTo(0.5);
    expect(at(DEATH.clear + DEATH.clearing).fade).toBe(1);
    // The readouts are gone before the word comes up.
    expect(DEATH.clear + DEATH.clearing).toBeLessThanOrEqual(DEATH.word);
    expect(at(DEATH.word - 0.01).word).toBe(0);
    expect(at(DEATH.word + DEATH.rise).word).toBe(1);
    expect(at(DEATH.dark - 0.01).dark).toBe(0);
    expect(at(DEATH.dark + DEATH.fade).dark).toBe(1);
    expect(DEATH.dark + DEATH.fade).toBeLessThanOrEqual(DEATH.again);
  });
});
