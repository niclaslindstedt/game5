// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SNOWBOARDER AT A CRAWL AND STOOD ACROSS A SLOPE — the board's answer to
// `poles.ts` and `sidestep.ts`, with its numbers and their sources in
// `defs/board-moves.ts` (`TUNING.board`). `skier.ts` calls the functions
// here IN PLACE OF the skier's own (the same names and the same arguments),
// and each hands a pair of skis straight on to the skier's — so a ski run
// takes the very same path it always did, and only a board (`SkiSpec.board`,
// which carries `SkierState.board`) is moved by anything below.
//
// THE ONE-FOOT SKATE (`strideOn`, `poleForce`): working for his speed at a
// crawl, the rider takes his REAR foot out of its binding (`BoardMoves.free`,
// `freeFootOf`) and pushes with it beside the board, the board running on
// its own line under the front foot — a push power-limited as the skier's is
// but a share of it (`skate.legs`), whole to a walk and gone by a run
// (`skate.speed`, `.fade`), quick and short (`skate.slow`, `.fast`), on the
// stride's phase the figure reads (`SkierState.stride`). In loose snow a
// free foot sinks, so there he keeps both feet in and HOPS the board along
// (`BoardMoves.hop`). The foot goes back in its binding once he is moving
// past what a push could add (`skate.strap`). While it is out, the board is
// stood on a share of its edge (`turnWork`, `skate.edge`): one foot cannot
// tip it hard over.
//
// THE STEP TURN ABOUT THE FRONT FOOT: at a crawl the free foot swings the
// tail round, the board PIVOTING ABOUT ITS FRONT BINDING (`skate.turn` a
// push) — the turn asked of the yaw, and the board's middle carried round
// the front foot with it. Stood still with a steer held he scoots it round
// the same way, on the skier's pair of steps (`stepRound`).
//
// THE SIDESLIP AND THE FALLING LEAF (`stepSide`, `sidestepEdge`,
// `holdsStill`): stood across a pitch — the board square to the fall line,
// barely moving, not working — he stands on his UPHILL edge, set, and is
// held where he stands. The steer AWAY from the hill eases the edge off
// (`BoardMoves.slip`) and the standstill hold lets go: the board slides
// down the fall line, the edge's own grip its brake (`skier.ts`'s stations),
// as fast as he lets it; the steer back, or the brake, sets it again and
// stops him. The lean swings the nose down the hill or up it
// (`BoardMoves.leaf`), and the board drifts forward or back across the
// slope as it slides. Eased off past flat, the DOWNHILL edge goes into the
// slide — the catch (`board-crash.ts`). There is no stepping up: a board
// strapped to both feet does not sidestep.

import { approach, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fromAxisAngle,
  multiply,
  normalize,
  rotate,
  type Vec3,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import type { Level } from "../mapgen/types.ts";
import { riderOf } from "./defs/riders.ts";
import type { SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import * as Poles from "./poles.ts";
import * as Side from "./sidestep.ts";
import type { SkierState } from "./state.ts";

const P = TUNING.poles;
const K = TUNING.board.skate;
const L = TUNING.board.slip;
const STILL_DRIVE = Poles.STILL_DRIVE;

/** Which of a board rider's feet comes out of its binding to push: the
 * REAR one — the right under a regular rider (left foot forward), the left
 * under a goofy one. Null on skis. */
export function freeFootOf(spec: SkiSpec): "left" | "right" | null {
  if (!spec.board) return null;
  return spec.board.lead === "regular" ? "right" : "left";
}

/** How much of the one-foot push the way leaves, 0..1: whole under
 * `skate.speed`, gone by `skate.fade`. */
export function skateReach(way: number): number {
  return 1 - clamp((Math.abs(way) - K.speed) / (K.fade - K.speed), 0, 1);
}

/** Pushes a second at `way` m/s: short and quick, quickening to the fade. */
export function pushRate(way: number): number {
  return K.slow + (K.fast - K.slow) * clamp(Math.abs(way) / K.fade, 0, 1);
}

/** The share of his working that is HOPPING rather than skating, on snow
 * `packed` 0..1: none on the groomer, all of it in powder. */
export function hopShare(packed: number): number {
  return clamp((K.hopBelow - packed) / (K.hopBelow - K.hopAt), 0, 1);
}

/** THE MEAN ONE-FOOT PUSH along the board, N, at `way` m/s on snow `packed`
 * 0..1, working at `effort` 0..1: `skate.legs` of the skier's
 * power-limited push, hopped at `skate.hop` of it where it is loose. */
export function boardDrive(spec: SkiSpec, way: number, packed: number, effort: number): number {
  if (effort <= 0) return 0;
  const reach = skateReach(way);
  if (reach <= 0) return 0;
  const power = P.power * riderOf(spec).strength;
  const force = K.legs * Math.min(spec.polePush, power / Math.max(0.5, Math.abs(way)));
  const hop = hopShare(packed);
  return force * reach * (1 - hop + hop * K.hop) * effort;
}

/** What `poles.ts`'s `poleForce` is to a skier: the push THIS STEP along
 * the skis or the board, N, the mean shaped by the stride's phase. */
export function poleForce(
  spec: SkiSpec,
  way: number,
  packed: number,
  effort: number,
  stride: number,
  poles = true,
  step = 0,
): number {
  if (!spec.board) return Poles.poleForce(spec, way, packed, effort, stride, poles, step);
  return boardDrive(spec, way, packed, effort) * Poles.strideShape(stride);
}

/** What `poles.ts`'s `driveReach` is to a skier, for `c` at `way` m/s. */
export function pushReachOf(c: SkierState, way: number): number {
  return c.board ? skateReach(way) : Poles.driveReach(way, c.poles, c.step);
}

/** HOW MUCH OF HIM CAN STEP ROUND A TURN, 0..1, working at `drive` at
 * `speed` m/s (`poles.ts`'s `stepWork`) — and on a board all of it while a
 * foot is out: the edge he stands on is the strapped foot's share
 * (`skate.edge`, through `skier.ts`'s lock) and the push goes on through
 * the bend. */
export function turnWork(c: SkierState, speed: number, drive = c.drive): number {
  const m = c.board;
  if (!m) return Poles.stepWork(drive, speed, c.poles);
  if (m.free) return (1 - K.edge) / P.turn.edge;
  const d = clamp((drive - P.skateDrive) / (1 - P.skateDrive), 0, 1);
  return d * d * (3 - 2 * d) * clamp(2 * skateReach(speed), 0, 1);
}

/** ONE STEP OF HIS PUSHES (`poles.ts`'s `strideOn`): on a board, the pushes
 * counted, the rear foot taken out and strapped back in, the hop, and the
 * step turn about the front foot. Returns the step turn's rate, rad/s,
 * clockwise positive, which `skier.ts` asks of the yaw. */
export function strideOn(c: SkierState, speed: number, dt: number): number {
  const m = c.board;
  if (!m) return Poles.strideOn(c, speed, dt);
  // Stood across a slope on his edge (`stepSide`) he is not pushing.
  if (c.sidestep !== 0) c.drive = 0;
  const reach = skateReach(speed);
  if (c.drive > 0 && reach > 0) c.stride += pushRate(speed) * c.drive * dt;
  const onSnow = !c.airborne && c.thrown === null;
  m.hop = c.drive > STILL_DRIVE ? hopShare(c.packed) : 0;
  // THE FOOT: out to push at a crawl on firm snow, back in once going.
  m.free = m.free
    ? onSnow && speed < K.strap && c.sidestep === 0
    : onSnow && c.drive > K.drive && speed < K.free && m.hop < 0.5;
  // THE STEP TURN, the way he goes (a board ridden fakie steers mirrored).
  const side = c.switched ? -c.steer : c.steer;
  c.step = approach(c.step, side * turnWork(c, speed), K.rate * dt);
  c.glide = 0;
  const stepped = onSnow ? c.step * K.turn * pushRate(speed) * c.drive : 0;
  if (stepped !== 0) {
    const turn = stepped * dt;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const vx = c.vx;
    c.vx = vx * cos + c.vz * sin;
    c.vz = c.vz * cos - vx * sin;
    // ...about the FRONT FOOT: the tail swung round, the middle with it.
    const front = c.spec.board!.stance / 2;
    c.x -= front * turn * Math.cos(c.heading);
    c.z += front * turn * Math.sin(c.heading);
  }
  return stepped;
}

/** STOOD STILL (`poles.ts`'s `stoodStill`) — and on a board stood across a
 * slope on his edge (`SkierState.sidestep`), as long as he barely slides. */
export function stoodStill(c: SkierState, speed: number): boolean {
  if (!c.board || c.sidestep === 0) return Poles.stoodStill(c, speed);
  return slipReady(c) && speed < L.most;
}

/** Whether a rider may stand across a slope on his edge: on the snow, not
 * asked to go (the tuck) or loading a jump, both feet in. */
function slipReady(c: SkierState): boolean {
  return !c.airborne && c.thrown === null && c.tuck <= 0.05 && c.jumpLoad === 0 && !c.board?.free;
}

/** THE STEP ROUND ON THE SPOT (`poles.ts`'s `stepRound`) — on a board the
 * free foot scooting the tail round, the board pivoting about its front
 * foot. */
export function stepRound(c: SkierState, n: Vec3, still: boolean, dt: number): void {
  if (!c.board) return Poles.stepRound(c, n, still, dt);
  const before = rotate(c.q, NOSE);
  Poles.stepRound(c, n, still, dt);
  if (c.pivot === 0) return;
  c.board.free = true;
  const after = rotate(c.q, NOSE);
  const front = c.spec.board!.stance / 2;
  c.x += front * (before.x - after.x);
  c.z += front * (before.z - after.z);
}
const NOSE = { x: 0, y: 0, z: 1 };

/** THE SIDESTEP (`sidestep.ts`'s `stepSide`) — on a board THE SIDESLIP:
 * stood across a pitch on his edge, `c.sidestep` the side the hill rises
 * on, the edge eased off by the steer away from it (`BoardMoves.slip`) and
 * the nose swung by the lean (`BoardMoves.leaf`). Never a step up. Returns
 * whether he stands across the slope, which a step round on the spot then
 * leaves alone. */
export function stepSide(
  c: SkierState,
  level: Level,
  n: Vec3,
  still: boolean,
  dt: number,
): boolean {
  const m = c.board;
  if (!m) return Side.stepSide(c, level, n, still, dt);
  const slope = Side.slopeOf(n);
  const ready =
    slipReady(c) &&
    slope >= L.from &&
    Math.abs(c.way) < L.way &&
    Side.slideOver(c, n) < L.most &&
    c.pivot === 0;
  const side = ready ? Side.hillSide(c, n) : 0;
  c.sidestep = side;
  if (side === 0) {
    m.slip = 0;
    m.leaf = 0;
    return false;
  }
  // The steer as pressed: sliding tail first he is not riding fakie
  // (`switch.ts` mirrors the steer for that).
  const away = -(c.switched ? -c.steer : c.steer) * side;
  m.slip = c.brake > 0.05 ? 0 : clamp((away - L.dead) / L.span, 0, 1) * (1 + L.over);
  // THE FALLING LEAF: the nose swung down the hill (the lean forward) or up
  // it, about the snow's normal, at its rate.
  const fall = hypot(n.x, n.z);
  const nose = rotate(c.q, NOSE);
  const right = rotate(c.q, RIGHT);
  const down = (nose.x * n.x + nose.z * n.z) / fall;
  const along = (right.x * n.x + right.z * n.z) / fall;
  m.leaf = Math.asin(clamp(down, -1, 1));
  const want = clamp(c.lean, -1, 1) * L.leaf;
  if (Math.abs(along) > 0.2) {
    const yaw = clamp((want - m.leaf) / along, -L.leafRate * dt, L.leafRate * dt);
    c.q = normalize(multiply(fromAxisAngle(n.x, n.y, n.z, yaw), c.q));
  }
  return true;
}
const RIGHT = { x: 1, y: 0, z: 0 };

/** The edge his skis are SET on while he stands on his platforms
 * (`sidestep.ts`'s `sidestepEdge`) — on a board his uphill edge set a
 * little past level across the slope, eased off by `BoardMoves.slip`, past
 * flat onto the downhill edge. */
export function sidestepEdge(c: SkierState, n: Vec3): number {
  if (!c.board) return Side.sidestepEdge(c, n);
  if (c.sidestep === 0) return 0;
  const set = Math.min(L.edge, Side.slopeOf(n) + L.bite);
  return c.sidestep * set * (1 - c.board.slip);
}

/** On his platforms each ski stood where he set it (`sidestep.ts`'s
 * `laySkis`) — a board is one deck and stands where it is. */
export function laySkis(c: SkierState, level: Level): void {
  if (!c.board) Side.laySkis(c, level);
}

/** WHETHER THE STANDSTILL HOLDS HIM (`skier.ts`): his stations holding the
 * slope's pull (`strain` of `strained`), or stood on his platforms or
 * stepping round — and a board stood across a slope only while its edge is
 * set: eased off past `slip.hold`, it slides. */
export function holdsStill(c: SkierState, strain: number, strained: number): boolean {
  if (c.board && c.sidestep !== 0) return c.board.slip < L.hold;
  return strain <= strained || c.sidestep !== 0 || c.pivot !== 0;
}
