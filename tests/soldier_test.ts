// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SOLDIERS' POSES AND KIT (`soldier-pose.ts`, `soldier-kit.ts`): every
// figure's every pose a whole body on the floor, its weapons where its
// hands are, the rifle at the shoulder when he aims, the gunner's hands on
// his gun at any aim, and the camouflage sparse.

import { describe, expect, it } from "vitest";

import { gunHolds, gunnerSeat, type P3 } from "../pwa/src/game/army-heli-plan.ts";
import type { V3 } from "../pwa/src/game/crowd-rig.ts";
import { camoAt, CAMO_SHARE, LAUNCHER, RIFLE } from "../pwa/src/game/soldier-kit.ts";
import { buildSoldierFigure, soldierTriangles } from "../pwa/src/game/soldier-shapes.ts";
import {
  aimOf,
  asP3,
  GUNNER_AIMS,
  gunnerPosed,
  seatFrame,
  SOLDIER_CARRIES,
  SOLDIER_KINDS,
  SOLDIER_POSES,
  soldierPose,
  soldierTargets,
  type SoldierPoseName,
} from "../pwa/src/game/soldier-pose.ts";

const d = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const len = (a: V3, b: V3) => d(a, b);
const finite = (p: V3) => p.every(Number.isFinite);

describe("the soldiers' poses", () => {
  it("names a rest and its poses for every figure", () => {
    expect(SOLDIER_KINDS).toEqual(["skier", "foot", "gunner", "rocketeer"]);
    for (const k of SOLDIER_KINDS) expect(soldierTargets(k)).toHaveLength(SOLDIER_POSES[k].length);
  });

  it("carries the same things in every pose of a figure, so its morph targets never change the mesh", () => {
    for (const k of SOLDIER_KINDS) {
      const c = SOLDIER_CARRIES[k];
      for (const [i, p] of soldierTargets(k).entries()) {
        const at = `${k} ${SOLDIER_POSES[k][i]}`;
        expect(p.rifle !== null, at).toBe(c.rifle);
        expect(p.tube !== null, at).toBe(c.tube);
        expect(p.poles !== null, at).toBe(c.skis);
      }
    }
  });

  it("stands every pose's body whole: finite joints, its bones their length, his head over his hips", () => {
    for (const k of SOLDIER_KINDS) {
      for (const [i, p] of soldierTargets(k).entries()) {
        const at = `${k} ${SOLDIER_POSES[k][i]}`;
        const P = p.posed;
        for (const q of [P.head, P.neck, P.pelvis, P.handL, P.handR, P.ankleL, P.ankleR]) {
          expect(finite(q), at).toBe(true);
        }
        expect(P.head[1], at).toBeGreaterThan(P.pelvis[1]);
        for (const [a, b] of [
          [P.shoulderL, P.handL],
          [P.shoulderR, P.handR],
        ] as const) {
          expect(len(a, b), at).toBeLessThan(0.7);
        }
        for (const [a, b] of [
          [P.hipL, P.ankleL],
          [P.hipR, P.ankleR],
        ] as const) {
          expect(len(a, b), at).toBeLessThan(0.95);
        }
      }
    }
  });

  it("stands a soldier on his feet on the floor, and on his skis on the snow", () => {
    for (const k of ["skier", "foot", "rocketeer"] as const) {
      for (const name of SOLDIER_POSES[k]) {
        if (name === "doorSit" || name === "rope" || name === "seat") continue;
        const P = soldierPose(k, name as SoldierPoseName<typeof k>).posed;
        const low = Math.min(P.ankleL[1], P.ankleR[1]);
        expect(low, `${k} ${name}`).toBeGreaterThan(-0.02);
        // The ankle is the boot's cuff, a hand over the sole.
        expect(low, `${k} ${name}`).toBeLessThan(0.35);
      }
    }
  });

  it("kneels with the right knee down and the left foot forward", () => {
    for (const [k, name] of [
      ["foot", "kneel"],
      ["rocketeer", "kneelLaunch"],
      ["skier", "skiKneel"],
    ] as const) {
      const P = soldierPose(k, name as never).posed;
      expect(P.kneeR[1], name).toBeLessThan(k === "skier" ? 0.32 : 0.2);
      expect(P.ankleL[2]).toBeGreaterThan(P.ankleR[2] + 0.5);
      expect(P.pelvis[1]).toBeLessThan(0.75);
    }
  });

  it("holds a rifle in his hands as long as a rifle, its grip in his right fist", () => {
    for (const k of SOLDIER_KINDS) {
      for (const [i, p] of soldierTargets(k).entries()) {
        const at = `${k} ${SOLDIER_POSES[k][i]}`;
        if (p.rifle) expect(len(p.rifle.rear, p.rifle.front), at).toBeCloseTo(RIFLE.length, 3);
        if (p.tube) expect(len(p.tube.rear, p.tube.front), at).toBeCloseTo(LAUNCHER.length, 3);
      }
    }
    const ready = soldierPose("foot", "ready");
    const r = ready.rifle!;
    const grip = r.rear.map((x, j) => x + ((r.front[j] - x) / RIFLE.length) * RIFLE.grip) as V3;
    expect(d(grip, ready.posed.handR)).toBeLessThan(RIFLE.gripDrop + 0.02);
  });

  it("aims with the butt in the right shoulder and the muzzle out ahead along his aim", () => {
    for (const [k, name] of [
      ["foot", "aim"],
      ["foot", "kneel"],
      ["skier", "skiAim"],
      ["skier", "skiKneel"],
    ] as const) {
      const p = soldierPose(k, name as never);
      const r = p.rifle!;
      expect(d(r.rear, p.posed.shoulderR), name).toBeLessThan(0.12);
      const aim = aimOf(k, name)!;
      const axis = r.front.map((x, j) => (x - r.rear[j]) / RIFLE.length);
      expect(axis[0] * aim[0] + axis[1] * aim[1] + axis[2] * aim[2], name).toBeGreaterThan(0.97);
      expect(r.front[2], name).toBeGreaterThan(p.posed.head[2] + 0.5);
    }
    expect(aimOf("foot", "ready")).toBeNull();
  });

  it("puts the launcher on his right shoulder to fire it, its rear behind him clear of his head", () => {
    for (const name of ["launch", "kneelLaunch"] as const) {
      const p = soldierPose("rocketeer", name);
      const t = p.tube!;
      expect(t.rear[2]).toBeLessThan(p.posed.shoulderR[2] - 0.2);
      expect(t.front[2]).toBeGreaterThan(p.posed.shoulderR[2] + 0.4);
      expect(Math.abs(t.rear[0] - p.posed.shoulderR[0])).toBeLessThan(0.1);
      expect(t.rear[0]).toBeGreaterThan(p.posed.head[0] + 0.1);
    }
  });

  it("plants the skier's poles upright beside him when he aims, and holds them when he skis", () => {
    const aim = soldierPose("skier", "skiAim");
    for (const [top, tip] of aim.poles!) {
      expect(Math.abs(top[0] - tip[0])).toBeLessThan(1e-9);
      expect(tip[1]).toBeLessThan(0);
    }
    const ski = soldierPose("skier", "ski");
    expect(ski.poles![0][0]).toEqual(ski.posed.handL);
    expect(ski.poles![1][0]).toEqual(ski.posed.handR);
  });
});

describe("the door gunner", () => {
  it("takes a point to his seat's frame and back", () => {
    const f = seatFrame(gunnerSeat(1));
    const p: P3 = { x: 1.1, y: 1.4, z: 0.7 };
    const back = f.toBody(f.toSeat(p));
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
    expect(back.z).toBeCloseTo(p.z);
    // Facing out of the right door: ahead is +x, his right is aft.
    expect(f.toBody([0, 0, 1]).x).toBeGreaterThan(gunnerSeat(1).x);
    expect(f.toBody([1, 0, 0]).z).toBeLessThan(gunnerSeat(1).z);
  });

  it("has his fists on the gun's grip and wrist at every aim, on either side", () => {
    for (const side of [1, -1] as const) {
      const f = seatFrame(gunnerSeat(side));
      for (const a of Object.values(GUNNER_AIMS)) {
        const p = gunnerPosed(side, a.yaw, a.pitch);
        const h = gunHolds(side, a.yaw, a.pitch);
        const to = (q: V3) => f.toBody(q);
        const near = (q: V3, r: P3) => Math.hypot(to(q).x - r.x, to(q).y - r.y, to(q).z - r.z);
        expect(near(p.posed.handR, h.right)).toBeLessThan(0.03);
        expect(near(p.posed.handL, h.left)).toBeLessThan(0.03);
        expect(near(p.posed.head, h.cheek)).toBeLessThan(0.3);
        expect(asP3(p.posed.pelvis).y).toBeGreaterThan(0.3);
      }
    }
  });
});

describe("the soldiers' kit", () => {
  it("is a rifle under a metre and a launcher about a metre long", () => {
    expect(RIFLE.length).toBeLessThan(1);
    expect(RIFLE.stock + RIFLE.receiver + RIFLE.handguard + RIFLE.barrel).toBeCloseTo(
      RIFLE.length,
      6,
    );
    expect(LAUNCHER.diameter).toBeLessThan(0.1);
  });

  it("lays a sparse camouflage: mostly white, a few blotches, fewer dark", () => {
    const n = [0, 0, 0];
    let k = 0;
    for (let x = -0.6; x <= 0.6; x += 0.03) {
      for (let y = 0; y <= 1.9; y += 0.03) {
        for (let z = -0.4; z <= 0.4; z += 0.05) {
          n[camoAt(x, y, z)]++;
          k++;
        }
      }
    }
    expect(n[1] / k).toBeGreaterThan(CAMO_SHARE.blotch * 0.6);
    expect(n[1] / k).toBeLessThan(CAMO_SHARE.blotch * 1.5);
    expect(n[2] / k).toBeGreaterThan(CAMO_SHARE.dark * 0.5);
    expect(n[2] / k).toBeLessThan(CAMO_SHARE.dark * 1.6);
    expect(n[0] / k).toBeGreaterThan(0.7);
  });
});

describe("the soldiers as built", () => {
  it("builds every figure at every cut with a morph target a pose, in a crowd figure's budget", () => {
    for (const k of SOLDIER_KINDS) {
      let last = Infinity;
      for (const lod of ["near", "mid", "far"] as const) {
        const g = buildSoldierFigure(k, lod);
        expect(g.morphAttributes.position, `${k} ${lod}`).toHaveLength(SOLDIER_POSES[k].length - 1);
        const tris = soldierTriangles(k, lod);
        expect(tris, `${k} ${lod}`).toBeLessThanOrEqual(lod === "far" ? 260 : 800);
        expect(tris, `${k} ${lod}`).toBeLessThanOrEqual(last);
        last = tris;
      }
    }
  });
});
