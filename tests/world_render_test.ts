// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD RENDERER'S ARITHMETIC — the three-free halves of the picture:
// the sky's colour model (`sky.ts`), what a skier leaves in the snow
// (`trail-stamp.ts`), the camera ladder (`camera-rigs.ts`), the rider's
// pose (`rider-pose.ts`) and the interpolation between two engine steps
// (`interp.ts`). The shaders and the meshes are judged by LOOKING
// (`make world`); what can be said in numbers is said here.

import { describe, expect, it } from "vitest";
import { createGame, placeRun, step, NEUTRAL_INPUT, TUNING, type SnowContact } from "@engine";
import { LONE_TREE, syntheticLevel } from "./support/synthetic.ts";

import {
  blendLens,
  createBoomState,
  FRAME_AT,
  frameRig,
  MAGNET,
  PACE,
  PULL_MIN,
  RIGS,
  turn,
  type RigPose,
  type TrunksNear,
} from "../pwa/src/game/camera-rigs.ts";
import { createLineClear, createTrunksNear } from "../pwa/src/game/camera-clear.ts";
import { createTrack, nlerp, observe, sample } from "../pwa/src/game/interp.ts";
import { BODY, MOUNTS, skierPose, SHIN_ABOVE_CUFF, solveLimb } from "../pwa/src/game/skier-pose.ts";
import { ragdollPose, type BodyFrame } from "../pwa/src/game/skier-ragdoll.ts";
import { airMass, skyLookAt, skyLookFor, sunDirection, sunTint } from "../pwa/src/game/sky.ts";
import {
  bodyStampOf,
  createPen,
  drawnDepth,
  furrowProfile,
  recentre,
  stampsOf,
  TRAIL,
  type Stamp,
} from "../pwa/src/game/trail-stamp.ts";

const flat = () => 0;

function contact(over: Partial<SnowContact> = {}): SnowContact {
  return {
    kind: "ski",
    station: "mid",
    side: -1,
    x: 0,
    y: 0,
    z: 0,
    sink: 0.02,
    width: 0.15,
    compression: 0.08,
    load: 400,
    touching: true,
    ...over,
  };
}

describe("the sky", () => {
  it("points the sun where the engine's heading convention says", () => {
    const south = sunDirection(Math.PI, 0);
    expect(south.z).toBeCloseTo(-1, 6);
    const east = sunDirection(Math.PI / 2, 0);
    expect(east.x).toBeCloseTo(1, 6);
    const up = sunDirection(0, Math.PI / 2);
    expect(up.y).toBeCloseTo(1, 6);
  });

  it("puts more air in front of a low sun, and reddens it", () => {
    expect(airMass(Math.PI / 2)).toBeCloseTo(1, 2);
    expect(airMass(0.1)).toBeGreaterThan(5);
    const low = sunTint(0.08);
    const high = sunTint(1.0);
    expect(low[0]).toBe(1);
    expect(low[2]).toBeLessThan(high[2]);
    expect(high[2]).toBeGreaterThan(0.8);
  });

  it("is brighter overhead than at the horizon, and blue in its shade", () => {
    const look = skyLookFor(Math.PI, 0.4);
    const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    expect(lum(look.horizon)).toBeGreaterThan(lum(look.zenith));
    expect(look.skyLight[2]).toBeGreaterThan(look.skyLight[0]);
    expect(look.keyIntensity).toBeGreaterThan(skyLookFor(Math.PI, 0.05).keyIntensity);
  });

  it("reads the level's own sun off the run's clock", () => {
    const game = createGame({ seed: 38 });
    const look = skyLookAt(game.level);
    expect(look.elevation).toBeGreaterThan(0);
    expect(Math.hypot(look.sun.x, look.sun.y, look.sun.z)).toBeCloseTo(1, 6);
  });
});

describe("the trail a skier leaves", () => {
  it("draws a furrow in powder whatever the physics' sink, a scuff on the piste", () => {
    const ski = contact({ sink: 0.01 });
    expect(drawnDepth(ski, 0)).toBeCloseTo(TRAIL.powderSki, 6);
    expect(drawnDepth(ski, 1)).toBeCloseTo(Math.max(0.01, TRAIL.packedDepth), 6);
    const tip = contact({ station: "tip", sink: 0.01 });
    expect(drawnDepth(tip, 0)).toBeGreaterThan(drawnDepth(ski, 0));
    // A physics sink deeper than the furrow is drawn as it is.
    expect(drawnDepth(contact({ sink: 0.3 }), 0)).toBeCloseTo(0.3, 6);
    expect(drawnDepth(contact({ sink: 2 }), 0)).toBe(TRAIL.maxDepth);
  });

  it("lays one capsule per probe from where it was to where it is", () => {
    const pen = createPen(2);
    const out: Stamp[] = [];
    stampsOf(
      [contact({ x: 0, z: 0 }), contact({ x: 1, z: 0, touching: false })],
      pen,
      flat,
      400,
      out,
    );
    expect(out).toHaveLength(1);
    expect(out[0].ax).toBe(out[0].bx);
    out.length = 0;
    stampsOf([contact({ x: 0, z: 0.5 }), contact({ x: 1, z: 0.5 })], pen, flat, 400, out);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ ax: 0, az: 0, bx: 0, bz: 0.5 });
    // The second probe was in the air: its capsule starts where it landed.
    expect(out[1]).toMatchObject({ ax: 1, az: 0.5, bx: 1, bz: 0.5 });
    expect(out[0].half).toBeCloseTo(0.075, 6);
  });

  it("does not sweep a trail across the map after a reset", () => {
    const pen = createPen(1);
    const out: Stamp[] = [];
    stampsOf([contact({ x: 0, z: 0 })], pen, flat, 400, out);
    out.length = 0;
    stampsOf([contact({ x: 50, z: 0 })], pen, flat, 400, out);
    expect(out).toHaveLength(0);
  });

  it("gouges a thrown rider's slide into the snow, and nothing while he flies", () => {
    const pen = createPen(1);
    const out: Stamp[] = [];
    bodyStampOf({ x: 0, z: 0, touching: false }, pen, flat, out);
    expect(out).toHaveLength(0);
    bodyStampOf({ x: 0, z: 0, touching: true }, pen, flat, out);
    bodyStampOf({ x: 0, z: 1.5, touching: true }, pen, flat, out);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ ax: 0, az: 0, bx: 0, bz: 1.5, half: TRAIL.body / 2 });
    // Given the body, every bone of it is pressed in too — a body lying in
    // powder lies in its own hole, limbs and all.
    out.length = 0;
    const points = new Array(39).fill(0);
    points[3 * 4 + 2] = 3.2;
    points[3 * 7 + 2] = 1.6;
    bodyStampOf({ x: 0, z: 2.4, touching: true, points }, pen, flat, out);
    expect(out).toHaveLength(11);
    expect(out[1]).toMatchObject({ ax: 0, az: 3.2, bx: 0, bz: 0 });
    expect(out.some((o) => o.bz === 1.6)).toBe(true);
    // A body is a wider mark than any probe.
    expect(TRAIL.body).toBeGreaterThan(2 * 0.3);
  });

  it("presses the centre deepest and throws a berm just outside it", () => {
    expect(furrowProfile(0, 0.1).press).toBe(1);
    expect(furrowProfile(0.05, 0.1).press).toBeGreaterThan(0.9);
    expect(furrowProfile(0.1, 0.1).press).toBe(0);
    expect(furrowProfile(0, 0.1).berm).toBe(0);
    const edge = furrowProfile(0.1 * (0.8 + TRAIL.bermReach / 2), 0.1);
    expect(edge.berm).toBeCloseTo(1, 6);
    expect(furrowProfile(0.3, 0.1).berm).toBe(0);
  });

  it("moves the fine window only when the rider has left its middle, onto whole texels", () => {
    expect(recentre(100, 100, 110, 95, 20, 0.08)).toBeNull();
    const moved = recentre(100, 100, 125.03, 100, 20, 0.08);
    expect(moved).not.toBeNull();
    expect(Math.abs(moved!.x / 0.08 - Math.round(moved!.x / 0.08))).toBeLessThan(1e-9);
    expect(moved!.x).toBeCloseTo(125.04, 6);
  });
});

function pose(over: Partial<RigPose> = {}): RigPose {
  return {
    x: 100,
    y: 10,
    z: 100,
    heading: 0,
    pitch: 0,
    roll: 0,
    vx: 0,
    vy: 0,
    vz: 10,
    speed: 10,
    airborne: false,
    packed: 1,
    q: { x: 0, y: 0, z: 0, w: 1 },
    ...over,
  };
}

describe("the camera ladder", () => {
  it("stands the chase boom behind the nose and aims it ahead", () => {
    const lens = frameRig(RIGS.chase, pose(), createBoomState(), 1 / 60, flat);
    expect(lens.eye.z).toBeLessThan(100);
    expect(lens.eye.y).toBeGreaterThan(10);
    expect(lens.target.z).toBeGreaterThan(100);
    expect(Math.abs(lens.eye.x - 100)).toBeLessThan(1e-9);
  });

  it("follows a turn rather than copying it", () => {
    const st = createBoomState();
    frameRig(RIGS.chase, pose(), st, 1 / 60, flat);
    for (let i = 0; i < 3; i++)
      frameRig(
        RIGS.chase,
        pose({ heading: 1, vx: Math.sin(1) * 10, vz: Math.cos(1) * 10 }),
        st,
        1 / 60,
        flat,
      );
    expect(st.yaw.y).toBeGreaterThan(0);
    expect(st.yaw.y).toBeLessThan(0.2);
  });

  it("keeps the lens out of the hill", () => {
    const lens = frameRig(RIGS.chase, pose(), createBoomState(), 1 / 60, () => 50);
    expect(lens.eye.y).toBeGreaterThanOrEqual(50 + (RIGS.chase as { clearance: number }).clearance);
  });

  it("bolts the tips camera to the skier and turns with him", () => {
    const h = Math.PI / 2;
    const q = { x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) };
    const lens = frameRig(RIGS.tips, pose({ heading: h, q }), createBoomState(), 1 / 60, flat);
    // Heading a quarter clockwise points the nose along +x.
    expect(lens.target.x - lens.eye.x).toBeGreaterThan(10);
  });

  it("blends two lenses smoothly and lands on the second", () => {
    const a = frameRig(RIGS.chase, pose(), createBoomState(), 1 / 60, flat);
    const b = frameRig(RIGS.high, pose(), createBoomState(), 1 / 60, flat);
    expect(blendLens(a, b, 0).eye).toEqual(a.eye);
    expect(blendLens(a, b, 1).eye).toEqual(b.eye);
    const mid = blendLens(a, b, 0.5).eye.y;
    expect(mid).toBeGreaterThan(a.eye.y);
    expect(mid).toBeLessThan(b.eye.y);
    expect(turn(3, -3)).toBeCloseTo(2 * Math.PI - 6, 9);
  });
});

describe("the rider stays in the picture", () => {
  /** Where the rider's middle stands against the look's axis, as a share
   * of the vertical half-fov (1 the frame's edge, negative below). */
  const offAxis = (l: ReturnType<typeof frameRig>, p: RigPose) => {
    const aim = Math.atan2(
      l.target.y - l.eye.y,
      Math.hypot(l.target.x - l.eye.x, l.target.z - l.eye.z),
    );
    const at = Math.atan2(p.y + FRAME_AT - l.eye.y, Math.hypot(p.x - l.eye.x, p.z - l.eye.z));
    return (at - aim) / ((l.fov * Math.PI) / 360);
  };
  /** Ride along +z at `vz` over `ground`, thrown up at `vy0` at z = 100. */
  const fly = (
    rung: "chase" | "far" | "high",
    ground: (x: number, z: number) => number,
    vz: number,
    vy0 = 0,
  ) => {
    const st = createBoomState();
    const dt = 1 / 60;
    let z = 60;
    let y = ground(100, z);
    let vy = 0;
    let air = false;
    let worst = 0;
    for (let i = 0; i < 360; i++) {
      if (!air && vy0 > 0 && z >= 100) [vy, air] = [vy0, true];
      z += vz * dt;
      const g = ground(100, z);
      if (!air && g < y - 0.05) air = true;
      if (air) {
        vy -= 9.81 * dt;
        y += vy * dt;
        if (y <= g) [y, vy, air] = [g, 0, false];
      } else y = g;
      const p = pose({ z, y, vy, vz, speed: Math.hypot(vy, vz), airborne: air });
      const o = offAxis(frameRig(RIGS[rung], p, st, dt, ground), p);
      if (Math.abs(o) > Math.abs(worst)) worst = o;
    }
    return worst;
  };
  const cliff = (_x: number, z: number) => (z < 120 ? 30 : 10);

  it("tips the booms after a skier dropping off a cliff, and off a big kicker", () => {
    for (const rung of ["chase", "far", "high"] as const) {
      expect(Math.abs(fly(rung, cliff, 20))).toBeLessThan(0.7);
      expect(Math.abs(fly(rung, flat, 30, 14))).toBeLessThan(0.7);
    }
  });

  it("composes the skier under the middle of the frame on level snow", () => {
    for (const rung of ["chase", "far", "high"] as const) {
      const st = createBoomState();
      let o = 0;
      for (let i = 0; i < 120; i++) {
        const p = pose({ z: 100 + (i * 10) / 60 });
        o = offAxis(frameRig(RIGS[rung], p, st, 1 / 60, flat), p);
      }
      const place = (RIGS[rung] as { place: number }).place;
      expect(o).toBeLessThan(0);
      expect(Math.abs(o + place)).toBeLessThan(0.05);
    }
  });
});

describe("the sense of speed", () => {
  /** Ride `rig` for `secs` at a steady pace (or a ramp from `from`). */
  const ride = (rung: "chase" | "tips", secs: number, over: Partial<RigPose>, from?: number) => {
    const st = createBoomState();
    const dt = 1 / 60;
    const n = Math.round(secs / dt);
    const lenses = [];
    for (let i = 0; i <= n; i++) {
      const speed =
        from === undefined ? (over.speed ?? 10) : from + ((over.speed ?? 10) - from) * (i / n);
      lenses.push(frameRig(RIGS[rung], pose({ ...over, vz: speed, speed }), st, dt, flat));
    }
    return { st, lenses };
  };
  const back = (l: { eye: { z: number } }) => 100 - l.eye.z;

  it("widens the fov with pace and pulls the arm in, so the skier keeps nearly its size", () => {
    const slow = ride("chase", 1, { speed: 2 }).lenses.at(-1)!;
    const fast = ride("chase", 1, { speed: 28 }).lenses.at(-1)!;
    expect(fast.fov).toBeGreaterThan(slow.fov + 12);
    expect(back(fast)).toBeLessThan(back(slow));
    // How big the skier stands in the frame: its size over the half-height
    // the frame spans at its distance.
    const size = (l: typeof fast) => 1 / (back(l) * Math.tan((l.fov * Math.PI) / 360));
    expect(size(fast) / size(slow)).toBeGreaterThan(0.8);
  });

  it("lets the arm fall behind a skier pulling away, and back when the pace is steady", () => {
    const pulling = ride("chase", 1.5, { speed: 26 }, 12);
    expect(pulling.st.surge).toBeGreaterThan(0.2);
    const steady = ride("chase", 4, { speed: 26 });
    expect(Math.abs(steady.st.surge)).toBeLessThan(0.01);
    const braking = ride("chase", 1.5, { speed: 10 }, 24);
    expect(braking.st.surge).toBeLessThan(-0.2);
    expect(braking.st.surge).toBeGreaterThanOrEqual(-PACE.surge.max);
  });

  it("buzzes past a brisk pace, never at a crawl, and goes still in the air", () => {
    const spread = (ls: { eye: { x: number; y: number } }[]) => {
      const ys = ls.slice(-60).map((l) => l.eye.y);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(spread(ride("chase", 2, { speed: 8 }).lenses)).toBe(0);
    const fast = ride("chase", 2, { speed: 30 });
    expect(spread(fast.lenses)).toBeGreaterThan(PACE.tremor.travel * 0.3);
    expect(spread(fast.lenses)).toBeLessThan(PACE.tremor.travel * 2 + 1e-9);
    const powder = ride("chase", 2, { speed: 30, packed: 0 });
    expect(powder.st.buzz).toBeLessThan(fast.st.buzz);
    const air = ride("chase", 2, { speed: 30, airborne: true });
    expect(air.st.buzz).toBe(0);
    // Bolted on, the whole world buzzes: the aim swings, the horizon cants.
    const hood = ride("tips", 2, { speed: 30 }).lenses.slice(-60);
    expect(new Set(hood.map((l) => l.roll.toFixed(6))).size).toBeGreaterThan(10);
  });
});

describe("the lens kept out of the woods", () => {
  const level = syntheticLevel();
  const clear = createLineClear(level);
  // Riding north (+z) three metres past the lone spruce: the boom's arm runs
  // straight back through its crown.
  const past = () =>
    pose({
      x: LONE_TREE.x,
      z: LONE_TREE.z + 3,
      y: level.groundAt(LONE_TREE.x, LONE_TREE.z + 3) + 0.5,
    });

  it("reads a line through a crown as blocked and one in the open as clear", () => {
    const y = level.groundAt(LONE_TREE.x, LONE_TREE.z) + 2;
    const from = { x: LONE_TREE.x, y, z: LONE_TREE.z + 5 };
    expect(clear(from, { x: LONE_TREE.x, y, z: LONE_TREE.z - 5 })).toBeLessThan(0.5);
    expect(clear(from, { x: LONE_TREE.x, y, z: LONE_TREE.z + 12 })).toBe(1);
  });

  it("pulls the chase arm in short of the tree, at once, and never onto the rider", () => {
    const p = past();
    const free = frameRig(RIGS.chase, p, createBoomState(), 1 / 60, level.groundAt);
    const st = createBoomState();
    const held = frameRig(RIGS.chase, p, st, 1 / 60, level.groundAt, clear);
    expect(st.pull).toBeLessThan(1);
    // In front of the trunk, not behind it.
    expect(held.eye.z).toBeGreaterThan(LONE_TREE.z);
    expect(free.eye.z).toBeLessThan(LONE_TREE.z);
    const arm = Math.hypot(held.eye.x - p.x, held.eye.z - p.z);
    expect(arm).toBeGreaterThan(PULL_MIN * 0.5);
  });

  it("leaves the ridden boom out at its length past a tree — a bough in the frame, never a jolt", () => {
    const p = past();
    const boomClear = createLineClear(level, { trees: false });
    const free = frameRig(RIGS.chase, p, createBoomState(), 1 / 60, level.groundAt);
    const st = createBoomState();
    const rode = frameRig(RIGS.chase, p, st, 1 / 60, level.groundAt, boomClear);
    expect(st.pull).toBe(1);
    expect(rode.eye).toEqual(free.eye);
  });

  it("lets the arm back out slowly once the tree is behind it", () => {
    const st = createBoomState();
    frameRig(RIGS.chase, past(), st, 1 / 60, level.groundAt, clear);
    const pulled = st.pull;
    const open = pose({ x: LONE_TREE.x, z: LONE_TREE.z + 40 });
    open.y = level.groundAt(open.x, open.z) + 0.5;
    frameRig(RIGS.chase, open, st, 1 / 60, level.groundAt, clear);
    expect(st.pull).toBeGreaterThan(pulled);
    expect(st.pull).toBeLessThan(1);
  });

  /** The chase boom ridden north past the lone spruce at 12 m/s, `beside` m
   * east of its trunk (and drifting `drift` m east a second): every lens,
   * and the boom's last state. The speed it READS is under the tremor's,
   * so the buzz does not stir the metres measured. */
  const rideBy = (beside: number, trunks?: TrunksNear, drift = 0) => {
    const boomClear = createLineClear(level, { trees: false });
    const st = createBoomState();
    const lenses: ReturnType<typeof frameRig>[] = [];
    const poses: RigPose[] = [];
    for (let i = 0; i < 240; i++) {
      const z = LONE_TREE.z - 25 + (12 * i) / 60;
      const x = LONE_TREE.x + beside + (drift * i) / 60;
      const p = pose({ x, z, y: level.groundAt(x, z) + 0.5, vx: drift, vz: 12, speed: 8 });
      poses.push(p);
      lenses.push(frameRig(RIGS.chase, p, st, 1 / 60, level.groundAt, boomClear, trunks));
    }
    return { lenses, poses, st };
  };
  const bark = (eye: { x: number; z: number }) =>
    Math.hypot(eye.x - LONE_TREE.x, eye.z - LONE_TREE.z) - 0.35;

  it("keeps the ridden boom a metre off a trunk it rides past, never pulling it in", () => {
    const trunks = createTrunksNear(level);
    for (const beside of [1.2, -1.2, 0.6, 0]) {
      const straight = rideBy(beside);
      const pushed = rideBy(beside, trunks);
      expect(Math.min(...straight.lenses.map((l) => bark(l.eye)))).toBeLessThan(MAGNET.gap);
      const closest = Math.min(...pushed.lenses.map((l) => bark(l.eye)));
      expect(closest).toBeGreaterThan(MAGNET.gap - 1e-6);
      // A metre, not a swing: never further off its own path than the push
      // needs, and never a jump from one frame to the next.
      let widest = 0;
      let leap = 0;
      pushed.lenses.forEach((l, i) => {
        widest = Math.max(
          widest,
          Math.hypot(l.eye.x - straight.lenses[i].eye.x, l.eye.z - straight.lenses[i].eye.z),
        );
        if (i > 0) {
          const was = pushed.lenses[i - 1].eye;
          leap = Math.max(leap, Math.hypot(l.eye.x - was.x, l.eye.z - was.z));
        }
      });
      expect(widest).toBeGreaterThan(0);
      expect(widest).toBeLessThan(0.35 + MAGNET.gap + MAGNET.soft);
      expect(leap).toBeLessThan(0.5);
      expect(pushed.st.pull).toBe(1);
    }
  });

  it("lets a lens that clears the trunk by more than the band ride straight by", () => {
    const trunks = createTrunksNear(level);
    const beside = 0.35 + MAGNET.gap + MAGNET.soft + 0.3;
    const straight = rideBy(beside);
    const pushed = rideBy(beside, trunks);
    pushed.lenses.forEach((l, i) => expect(l.eye).toEqual(straight.lenses[i].eye));
  });

  it("carries a lens whose arm swings over the trunk round it, never through it or across it at a stroke", () => {
    const trunks = createTrunksNear(level);
    const boomClear = createLineClear(level, { trees: false });
    for (const dir of [1, -1]) {
      // Stood four metres past the spruce and turning across it, so the
      // arm behind him sweeps over the trunk.
      const x = LONE_TREE.x;
      const z = LONE_TREE.z + 4;
      const st = createBoomState();
      const free = createBoomState();
      let slid = false;
      let leap = 0;
      let was: { x: number; z: number } | null = null;
      let last = null as ReturnType<typeof frameRig> | null;
      let alone = null as ReturnType<typeof frameRig> | null;
      for (let i = 0; i < 300; i++) {
        const heading = dir * (-0.8 + (1.6 * Math.min(i, 180)) / 180);
        const p = pose({ x, z, y: level.groundAt(x, z) + 0.5, heading, vz: 0, speed: 0 });
        last = frameRig(RIGS.chase, p, st, 1 / 60, level.groundAt, boomClear, trunks);
        alone = frameRig(RIGS.chase, p, free, 1 / 60, level.groundAt, boomClear);
        expect(bark(last.eye)).toBeGreaterThan(MAGNET.gap - 1e-6);
        if (was) leap = Math.max(leap, Math.hypot(last.eye.x - was.x, last.eye.z - was.z));
        was = last.eye;
        slid ||= st.slide !== null;
      }
      expect(slid).toBe(true);
      expect(leap).toBeLessThan(0.5);
      expect(st.slide).toBeNull();
      expect(last!.eye).toEqual(alone!.eye);
    }
  });

  it("keeps the look on the skier while pushed", () => {
    const { lenses, poses } = rideBy(0.6, createTrunksNear(level));
    const straight = rideBy(0.6);
    const i = lenses.findIndex((l, k) => l.eye.x !== straight.lenses[k].eye.x);
    expect(i).toBeGreaterThan(0);
    const lens = lenses[i];
    const p = poses[i];
    const ax = lens.target.x - lens.eye.x;
    const az = lens.target.z - lens.eye.z;
    const bx = p.x - lens.eye.x;
    const bz = p.z - lens.eye.z;
    expect(Math.abs(ax * bz - az * bx) / Math.hypot(ax, az) / Math.hypot(bx, bz)).toBeLessThan(
      1e-6,
    );
  });

  it("never moves the lens in the open, and lets it go once the tree is passed", () => {
    const trunks = createTrunksNear(level);
    const boomClear = createLineClear(level, { trees: false });
    const open = pose({ x: LONE_TREE.x, z: LONE_TREE.z + 40 });
    open.y = level.groundAt(open.x, open.z) + 0.5;
    const free = frameRig(RIGS.chase, open, createBoomState(), 1 / 60, level.groundAt, boomClear);
    const rode = frameRig(
      RIGS.chase,
      open,
      createBoomState(),
      1 / 60,
      level.groundAt,
      boomClear,
      trunks,
    );
    expect(rode.eye).toEqual(free.eye);
    const straight = rideBy(0.6);
    const pushed = rideBy(0.6, trunks);
    expect(pushed.lenses.at(-1)!.eye).toEqual(straight.lenses.at(-1)!.eye);
    expect(pushed.st.sides.size).toBe(0);
  });
});

describe("the rider's pose", () => {
  it("keeps every limb its own length", () => {
    const root = { x: 0, y: 0, z: 0 };
    const target = { x: 0.2, y: -0.5, z: 0.3 };
    const joint = solveLimb(root, target, 0.44, 0.46, { x: 0, y: 0, z: 1 });
    const d = (a: typeof root, b: typeof root) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    expect(d(root, joint)).toBeCloseTo(0.44, 6);
    expect(d(joint, target)).toBeCloseTo(0.46, 6);
    // Bent toward the pole.
    expect(joint.z).toBeGreaterThan(0.15);
  });

  it("thrown, hangs on the engine's ragdoll with every limb its own length", () => {
    // The engine's body is measured with the figure's own bones.
    const T = TUNING.crash.body;
    for (const k of ["thigh", "shin", "upperArm", "forearm", "spine", "shoulder", "hip", "neck"]) {
      expect(T[k as keyof typeof T], k).toBe(BODY[k as keyof typeof BODY]);
    }
    const d = (a: { x: number; y: number; z: number }, b: typeof a) =>
      Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const state = createGame({ level: syntheticLevel(), rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: LONE_TREE.x + 0.4, z: LONE_TREE.z - 30, heading: 0, speed: 50 / 3.6 });
    const frame: BodyFrame = {
      origin: { x: 0, y: 0, z: 0 },
      x: { x: 1, y: 0, z: 0 },
      y: { x: 0, y: 1, z: 0 },
      z: { x: 0, y: 0, z: 1 },
    };
    let seen = 0;
    for (let i = 0; i < 6 * 120 && seen < 40; i++) {
      step(state, { ...NEUTRAL_INPUT, tuck: 1 });
      const off = state.skier.thrown;
      if (!off || i % 7) continue;
      seen++;
      const p = ragdollPose(off.points, frame);
      for (let s = 0; s < 2; s++) {
        expect(d(p.shoulders[s], p.elbows[s])).toBeCloseTo(BODY.upperArm, 2);
        expect(d(p.elbows[s], p.hands[s])).toBeCloseTo(BODY.forearm, 2);
        // The cloth stops at the boot's cuff up the shin; the foot in its
        // liner is squared below it, its frame a true one.
        expect(d(p.knees[s], p.feet[s])).toBeCloseTo(SHIN_ABOVE_CUFF, 2);
        const { f, n } = p.boots[s];
        expect(Math.hypot(f.x, f.y, f.z)).toBeCloseTo(1, 6);
        expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 6);
        expect(f.x * n.x + f.y * n.y + f.z * n.z).toBeCloseTo(0, 6);
      }
      expect(d(p.hips, p.neck)).toBeCloseTo(BODY.spine, 2);
      // The frame is his trunk's: the neck straight up it, the hips across.
      expect(p.neck.x).toBeCloseTo(0, 6);
      expect(p.neck.z).toBeCloseTo(0, 6);
      expect(Math.hypot(frame.x.x, frame.x.y, frame.x.z)).toBeCloseTo(1, 6);
    }
    expect(seen).toBeGreaterThan(10);
  });

  it("keeps the poles a pole's length from the fists", () => {
    // Into a turn to his right: the look follows the engine's hip shift
    // (which lags the key), never the key itself, which flips in a step.
    const p = skierPose({
      hipRight: 0.2,
      hipAft: 0,
      lean: 0,
      steer: 0.8,
      crouch: 0,
      airborne: false,
      landing: 5,
    });
    expect(p.poles).not.toBeNull();
    const h = p.hands[1];
    const b = p.poles![1];
    expect(Math.hypot(b.x - h.x, b.y - h.y, b.z - h.z)).toBeCloseTo(MOUNTS.pole, 6);
    expect(p.look).toBeGreaterThan(0);
  });

  it("angulates into a turn and sits back for a lean", () => {
    const base = {
      hipRight: 0,
      hipAft: 0,
      lean: 0,
      steer: 0,
      crouch: 0,
      airborne: false,
      landing: 5,
    };
    const hung = skierPose({ ...base, hipRight: 0.25, steer: 1, edge: 0.5 });
    expect(hung.hips.x).toBeGreaterThan(0.1);
    // Angulated: the trunk leans in less than the legs do — a hinge at the
    // hips, so the neck stands nearer the centre than the legs' line.
    const feetX = (hung.feet[0].x + hung.feet[1].x) / 2;
    const feetY = (hung.feet[0].y + hung.feet[1].y) / 2;
    const legs = Math.atan2(hung.hips.x - feetX, hung.hips.y - feetY);
    const trunk = Math.atan2(hung.neck.x - hung.hips.x, hung.neck.y - hung.hips.y);
    expect(trunk).toBeLessThan(legs - 0.1);
    const back = skierPose({ ...base, lean: 1 });
    expect(back.pitch).toBeLessThan(skierPose(base).pitch);
    // The back is two spans, never stretched: the lumbar and the chest's
    // together are the spine's length, the chord a hair short of it.
    const d = (a: { x: number; y: number; z: number }, b: typeof a) =>
      Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    expect(d(back.hips, back.waist) + d(back.waist, back.neck)).toBeCloseTo(BODY.spine, 6);
    expect(d(back.hips, back.neck)).toBeGreaterThan(BODY.spine - 0.01);
  });
});

describe("drawing between two steps", () => {
  it("lands on the step before at alpha 0 and on the step at alpha 1", () => {
    const game = createGame({ seed: 38 });
    const track = createTrack();
    observe(track, game.skier, game.tick);
    for (let i = 0; i < 400; i++) step(game, { ...NEUTRAL_INPUT, tuck: 1 });
    observe(track, game.skier, game.tick);
    const x0 = game.skier.x;
    step(game, { ...NEUTRAL_INPUT, tuck: 1 });
    step(game, { ...NEUTRAL_INPUT, tuck: 1 });
    observe(track, game.skier, game.tick);
    const out = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
    expect(sample(track, 1, out).x).toBeCloseTo(game.skier.x, 9);
    const before = sample(track, 0, out).x;
    // One of the two steps back, on the line from the last frame's pose.
    expect(before).toBeCloseTo((x0 + game.skier.x) / 2, 9);
    expect(Math.hypot(out.q.x, out.q.y, out.q.z, out.q.w)).toBeCloseTo(1, 9);
  });

  it("blends quaternions the short way round", () => {
    const a = { x: 0, y: 0, z: 0, w: 1 };
    const b = { x: 0, y: 0, z: 0, w: -1 };
    const out = nlerp(a, b, 0.5, { x: 0, y: 0, z: 0, w: 0 });
    expect(Math.abs(out.w)).toBeCloseTo(1, 9);
  });
});
