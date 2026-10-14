// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMPER AS POSED (`skier-jumper.ts`, laid over the pose by
// `skis-body.ts`): sat on the bar, folded flat in the in-run, laid out over
// his skis in the V in the air — the V's opening the engine's own, his body
// a few degrees over the skis, his hips near straight, his heels off the
// skis — and down in a telemark, one foot ahead; never with poles, in a
// one-piece suit (`jumpKit`). And nothing of it reaches another mode: the
// pose with no jumper, every technique's row and every outfit's cut are
// what they were, to the last bit.

import { describe, expect, it } from "vitest";
import {
  ALBATROSS,
  botInput,
  createGame,
  riderById,
  step,
  TUNING,
  withRider,
  type GameState,
} from "@engine";

import { levelFor } from "./support/levels.ts";
import { mountsOf, pairStyle } from "../pwa/src/game/skis-body.ts";
import { skierPose, type SkierPoseInput } from "../pwa/src/game/skier-pose.ts";
import { TECHNIQUE_POSES, NO_BLOCK } from "../pwa/src/game/technique-pose.ts";
import { JUMPER, jumperPose, jumperShapeOf } from "../pwa/src/game/skier-jumper.ts";
import { dressOutfit, outfitKey } from "../pwa/src/game/dress.ts";
import {
  carriesPoles,
  DEFAULT_OUTFIT,
  gearOf,
  helmetOf,
  jumpKit,
  RIVAL_OUTFITS,
} from "../pwa/src/game/outfit.ts";
import { emptyStand } from "../pwa/src/game/ski-stand.ts";

const DEG = Math.PI / 180;
const M = mountsOf(ALBATROSS);
const TAIL = ALBATROSS.length * ALBATROSS.mount;

const base: SkierPoseInput = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 5,
  mounts: M,
  poles: false,
};

/** A jump on the bot's hands, stepped until `until` says stop. */
function jumpTo(until: (s: GameState) => boolean, limit = 40): GameState {
  const s = createGame({
    level: levelFor(1),
    mode: "skiJump",
    spec: withRider(ALBATROSS, riderById("light")),
    countdown: 0,
    quiet: true,
  });
  for (let i = 0; i < Math.round(limit / TUNING.dt) && !until(s); i++) step(s, botInput(s));
  return s;
}

const flying = jumpTo((s) => s.jump?.stage === "air" && s.t - s.jump.edgeAt > 2);
const sagittal = (v: { y: number; z: number }) => Math.atan2(v.y, v.z) / DEG;

describe("the ski jumper's pose", () => {
  it("sits on the bar with his soles over the tracks where the engine has them", () => {
    const s = jumpTo(() => true);
    expect(s.jump!.stage).toBe("bar");
    const shape = jumperShapeOf(s.jump!, s.t, s.level.skiJump!.w)!;
    expect(shape.angles).toBe(JUMPER.bar);
    const { pose } = jumperPose(skierPose(base), shape, M, TAIL);
    // Sat: the hips no higher than a hand over the knees.
    expect(pose.hips.y - pose.knees[0].y).toBeLessThan(0.15);
  });

  it("opens the skis into the engine's V, each yawed about its binding", () => {
    const j = flying.jump!;
    expect(j.vee).toBeGreaterThan(0.95);
    const shape = jumperShapeOf(j, flying.t, flying.level.skiJump!.w)!;
    const { yaw, skis } = jumperPose(skierPose(base), shape, M, TAIL);
    const open = (yaw[1] - yaw[0]) / DEG;
    expect(open).toBeCloseTo((JUMPER.vee / DEG) * j.vee, 6);
    expect(open).toBeGreaterThanOrEqual(25);
    expect(open).toBeLessThanOrEqual(35);
    // Tips out: the left ski turned left, the right right.
    expect(yaw[0]).toBeLessThan(0);
    expect(yaw[1]).toBeGreaterThan(0);
    // The tails meet behind him rather than cross: the feet carried apart.
    const tailX = (i: number) =>
      (i === 0 ? -1 : 1) * (ALBATROSS.stance / 2) + skis[i].dx - Math.sin(yaw[i]) * TAIL;
    expect(tailX(1) - tailX(0)).toBeGreaterThan(0);
  });

  it("lays his body a few degrees over the skis in stable flight, the hips open", () => {
    const shape = jumperShapeOf(flying.jump!, flying.t, flying.level.skiJump!.w)!;
    const { pose } = jumperPose(skierPose(base), shape, M, TAIL);
    const feet = {
      y: (pose.feet[0].y + pose.feet[1].y) / 2,
      z: (pose.feet[0].z + pose.feet[1].z) / 2,
    };
    // The body's line, the feet to the neck, 0–20° over the skis.
    const body = sagittal({ y: pose.neck.y - feet.y, z: pose.neck.z - feet.z });
    expect(body).toBeGreaterThan(0);
    expect(body).toBeLessThan(20);
    // The hip's inside angle, the knees to the neck: near 160°.
    const k = pose.knees[0];
    const thigh = { y: k.y - pose.hips.y, z: k.z - pose.hips.z };
    const trunk = { y: pose.neck.y - pose.hips.y, z: pose.neck.z - pose.hips.z };
    const hip = Math.abs(sagittal(thigh) - sagittal(trunk));
    expect(hip).toBeGreaterThan(150);
    expect(hip).toBeLessThan(172);
    // The heels off the skis: each boot's sole pitched up off its ski.
    for (const b of pose.boots) expect(b.f.y).toBeLessThan(-Math.sin(20 * DEG));
    // The arms back along him, the fists behind the hips.
    for (const h of pose.hands) expect(h.z).toBeLessThan(pose.hips.z);
  });

  it("lands in a telemark, one foot ahead and the back heel up", () => {
    const s = jumpTo((x) => x.jump?.record.landing != null, 60);
    for (let i = 0; i < Math.round(0.4 / TUNING.dt); i++) step(s, botInput(s));
    expect(s.jump!.record.landing).toBe("telemark");
    const shape = jumperShapeOf(s.jump!, s.t, s.level.skiJump!.w)!;
    const { pose, skis } = jumperPose(skierPose(base), shape, M, TAIL);
    expect(skis[0].dz - skis[1].dz).toBeGreaterThan(0.25);
    expect(pose.boots[1].f.y).toBeLessThan(pose.boots[0].f.y - 0.3);
  });

  it("never carries poles, and wears the suit in his own colours", () => {
    const shape = jumperShapeOf(flying.jump!, flying.t, flying.level.skiJump!.w)!;
    expect(jumperPose(skierPose(base), shape, M, TAIL).pose.poles).toBeNull();
    for (const o of [DEFAULT_OUTFIT, ...RIVAL_OUTFITS]) {
      const k = jumpKit(o);
      expect(carriesPoles(k)).toBe(false);
      expect(k.suit).toBe(true);
      expect(helmetOf(k).shell).toBe(gearOf("jacket", o.jacket).main);
      expect(outfitKey(k)).not.toBe(outfitKey({ ...k, suit: undefined }));
      // ...put on him by the pair a jump is jumped on.
      expect(pairStyle(ALBATROSS, { outfit: o }).skier.outfit).toEqual(k);
    }
  });
});

/** A hash of everything a pose or a mesh holds, to the last bit. */
// Every number rounded to 1e-4 first: the last bits of a sine differ
// between Node releases, and the hash must hold on every one CI runs.
function hashOf(x: unknown): string {
  const s = JSON.stringify(x, (_k, v: unknown) =>
    typeof v === "number"
      ? Math.round(v * 1e4)
      : ArrayBuffer.isView(v)
        ? Array.from(v as Float32Array)
        : v,
  );
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

const MOMENTS: SkierPoseInput[] = [
  { ...base, mounts: undefined, poles: undefined },
  { ...base, mounts: undefined, poles: undefined, crouch: 1, tuck: 1 },
  {
    ...base,
    mounts: undefined,
    poles: undefined,
    hipRight: -0.3,
    steer: -1,
    edge: -0.3,
    roll: -0.5,
    body: { tilt: -0.3, roll: -0.5 },
    incline: -0.5,
    lift: [0.12, 0],
  },
  { ...base, mounts: undefined, poles: undefined, airborne: true, air: 1 },
];

describe("every other mode, unmoved", () => {
  it("poses every technique as it did", () => {
    const poses = Object.values(TECHNIQUE_POSES).flatMap((row) =>
      MOMENTS.map((m) => skierPose({ ...m, style: row, swing: 0.4, block: NO_BLOCK })),
    );
    expect(hashOf(poses)).toBe(POSES_HASH);
  });

  it("cuts every outfit as it did", () => {
    const meshes = [DEFAULT_OUTFIT, ...RIVAL_OUTFITS].map((o) => {
      const d = dressOutfit(o);
      return [d.cloth.position, d.cloth.color, d.hard.position, d.hard.color];
    });
    expect(hashOf(meshes)).toBe(DRESS_HASH);
  });

  it("stands the skis unturned off the stand", () => {
    expect(emptyStand().yaw).toEqual([0, 0]);
  });
});

// Taken off the tree before the jumper was drawn (the dress re-cut when the
// gauntlet cuff was fitted over the sleeve, and again when a straight limb's
// bone kept the face its knee or elbow folds to — `skier-rig.ts`'s
// `limbBend`, which re-seats the legs' and cuffs' rings a few cm; and again
// when the skier's moves were smoothed — the knee's soft limit, the poles).
const POSES_HASH = "9c1361c5";
const DRESS_HASH = "c040fa6d";
