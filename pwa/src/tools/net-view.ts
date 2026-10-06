// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S NET VIEWS (`make world ARGS="--downhill
// --views=net-0.4,net-1,net-3"`): a crash into a downhill's A-nets, frame by
// frame (`nets.ts`'s `catchInNets`).
//
//   * the player is stood half way down the course a few metres inside the
//     right-hand net and pointed into it at 100 km/h, 20° off the piste;
//   * every frame is drawn from ONE lens planted when he leaves his skis — a
//     little up the piste from him and in from the net, near square to it —
//     so the pocket the mesh makes round him and the skis hooked in it read.

import { nearestTrackPoint, placeRun, trackPointAt, type GameState } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

let planted: { x: number; z: number } | null = null;

/** Stand the player short of the right-hand A-net and point him into it —
 * false on a run with no downhill set. */
export function intoNet(state: GameState): boolean {
  const course = state.level.downhill;
  if (!course) return false;
  const s = course.from + (course.to - course.from) * 0.5;
  const p = trackPointAt(state.level, s);
  const net = p.width / 2 + course.nets.gap;
  const rx = Math.cos(p.heading);
  const rz = -Math.sin(p.heading);
  placeRun(state, {
    x: p.x + rx * (net - 4),
    z: p.z + rz * (net - 4),
    heading: p.heading + 0.35,
    speed: 28,
    time: 30,
    nextCheckpoint: state.level.checkpoints.findIndex((c) => c.s > s),
  });
  planted = null;
  return true;
}

/** The lens on the thrown skier, planted the first time it is asked for
 * — null while nobody is down. */
export function netLens(state: GameState): LensPose | null {
  const off = state.skier.thrown;
  const course = state.level.downhill;
  if (!off || !course) return null;
  const level = state.level;
  if (!planted) {
    const back = trackPointAt(level, nearestTrackPoint(level, off.x, off.z).s - 4);
    const net = back.width / 2 + course.nets.gap;
    // The side of the piste he left it by.
    const side =
      (off.x - back.x) * Math.cos(back.heading) - (off.z - back.z) * Math.sin(back.heading);
    const rx = Math.cos(back.heading) * Math.sign(side || 1);
    const rz = -Math.sin(back.heading) * Math.sign(side || 1);
    planted = { x: back.x + rx * (net - 4.5), z: back.z + rz * (net - 4.5) };
  }
  return {
    eye: { x: planted.x, y: level.groundAt(planted.x, planted.z) + 1.7, z: planted.z },
    target: { x: off.x, y: off.y, z: off.z },
    fov: 50,
    roll: 0,
  };
}
