// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DOOR OPENED — a free ride's buildings let a skier in and out
// (`RunRules.doors`). Every building with a door (`building-walls.ts`'s
// `buildingDoors`) has its LEAVES (`leavesOf`): one, or a pair meeting in
// the middle, hung on their jambs, swinging into the room (a home's) or out
// of it (a public building's), or rolled up overhead (a garage's).
//
// THE PRESS: stopped — or at a crawl — within `DOOR.reach` of a doorway on
// either side and turned toward it, THE MACHINE PRESS (`SkierInput.machine`:
// ENTER, a double tap on touch) starts the MOVE (`DoorMove`): he shuffles on
// his skis to the handle and turns square to the door; his hand goes to the
// lever and presses it down; the leaf comes off its latch and he pushes it
// away from him, or draws it toward him and steps back out of its sweep;
// then he steps through behind it to stand a pace inside — a scripted path
// of keyframes (`DoorKey`), the step his while it runs, the snow and the
// trees waiting. The same press from inside lets him out.
//
// THE LEAF swings `DOOR.leaf.open` over `.swing` s, eased, and is held
// while he is in its way; let go and clear of it, its CLOSER brings it back
// slowly and latches it. Open past `.pass` of its swing it is no solid
// (`setDoor`); a press at a door standing open closes it at once.
//
// Pure over the level, the state and the clock: a leaf's angle and where
// the skier stands are functions of the moments things began (`door-state.ts`),
// nothing is drawn from the stream, and a run whose rules open no door never
// comes in here — so no digest moves.

import { angleDiff, clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { lodgesOf, enterLodge } from "./afterski.ts";
import { buildingDoorOf, buildingDoors, setDoor, type BuildingDoor } from "./building-walls.ts";
import { standSkier } from "./course.ts";
import { BUILDING_WALLS } from "./defs/building-walls.ts";
import { DOOR } from "./defs/doors.ts";
import { TUNING } from "./defs/tuning.ts";
import type { DoorKey, DoorMove, DoorSwing } from "./door-state.ts";
import type { GameEvent, GameState, SkierInput } from "./state.ts";

export type { DoorEvent, DoorKey, DoorMove, DoorSwing, Doorway } from "./door-state.ts";

/** A door's frame in the world: the doorway's middle on the wall's middle
 * line (x, z) at the floor (y), the way out of it (nx, nz) and the way to
 * the right of one stood outside facing it (rx, rz). */
export type DoorFrame = {
  x: number;
  z: number;
  y: number;
  nx: number;
  nz: number;
  rx: number;
  rz: number;
};

/** `door`'s frame. */
export function doorFrame(door: BuildingDoor): DoorFrame {
  const nx = Math.sin(door.heading);
  const nz = Math.cos(door.heading);
  const back = BUILDING_WALLS.wall / 2;
  return { x: door.x - nx * back, z: door.z - nz * back, y: door.y, nx, nz, rx: -nz, rz: nx };
}

/** A point of a door's frame in the world: `u` m to the right as seen from
 * outside, `w` m out of the wall's middle line (negative: inside). */
export function doorPoint(f: DoorFrame, u: number, w: number): { x: number; z: number } {
  return { x: f.x + f.rx * u + f.nx * w, z: f.z + f.rz * u + f.nz * w };
}

/** ONE LEAF of a doorway, in its frame: its hinge and its latch edge as
 * `u` (m to the right as seen from outside), its width, and which way it
 * swings — +1 out of the building, −1 into it, 0 rolled up. */
export type LeafPlan = { hinge: number; latch: number; width: number; way: 1 | -1 | 0 };

/** THE LEAVES of `door`: a single leaf on the jamb its row hangs it on, a
 * pair hung on both jambs meeting in the middle, a roller door's one. */
export function leavesOf(door: BuildingDoor): LeafPlan[] {
  const way = door.swing === "roll" ? 0 : door.swing === "out" ? 1 : -1;
  const w = door.leaf;
  if (door.leaves === 2) {
    return [
      { hinge: -w, latch: 0, width: w, way },
      { hinge: w, latch: 0, width: w, way },
    ];
  }
  const h = door.hinge === "left" ? -w / 2 : w / 2;
  return [{ hinge: h, latch: -h, width: w, way }];
}

/** The leaf a skier opens: a pair's right one as seen from outside. */
export function activeLeaf(door: BuildingDoor): number {
  return door.leaves === 2 ? 1 : 0;
}

/** The most a leaf opens: its angle, rad, or a roller door's share of its
 * height. */
export function leafMost(door: BuildingDoor): number {
  return door.swing === "roll" ? DOOR.leaf.roll : DOOR.leaf.open;
}

const smooth = (u: number): number => {
  const k = clamp(u, 0, 1);
  return k * k * (3 - 2 * k);
};

/** HOW FAR OPEN a swing is at the run's `t`, 0 shut .. 1 as open as it
 * goes: pushed through its swing, eased; then, let go, brought back by its
 * closer at a steady sweep and latched the last stretch a little quicker
 * (a roller door wound down at a steady pace). */
export function swingShare(s: DoorSwing, t: number, roll: boolean): number {
  const L = DOOR.leaf;
  if (s.shut < 0) return smooth((t - s.at) / (roll ? L.rollUp : L.swing));
  const dt = t - s.shut;
  if (roll) return Math.max(0, s.from - dt / L.rollDown);
  // The sweep at 1/close a second to the latch's stretch, then twice that.
  const rate = 1 / L.close;
  const sweep = Math.max(0, (s.from - L.latch) / rate);
  if (dt < sweep) return s.from - rate * dt;
  const at = Math.min(s.from, L.latch);
  return Math.max(0, at - 2 * rate * (dt - sweep));
}

/** How far open leaf `leaf` of the building `id` is on this run, 0..1. */
export function leafShare(state: GameState, id: string, leaf: number): number {
  const swings = state.doorway?.swings;
  if (!swings) return 0;
  for (const s of swings) {
    if (s.id !== id || s.leaf !== leaf) continue;
    return swingShare(s, state.t, buildingDoorOf(state.level, id)?.swing === "roll");
  }
  return 0;
}

/** The inverse of the opening ease: the share of the swing's time that
 * has the leaf `share` open. */
function unsmooth(share: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (smooth(mid) < share) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** WHERE THE SKIER STANDS through his move `t` s after the press: (u, w)
 * in the door's frame and the way he faces, off its keyframes. */
export function moveAt(move: DoorMove, t: number): { u: number; w: number; heading: number } {
  const k = move.keys;
  if (t <= k[0].t) return k[0];
  for (let i = 1; i < k.length; i++) {
    const b = k[i];
    if (t > b.t) continue;
    const a = k[i - 1];
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
    const e = b.lin ? f : smooth(f);
    return {
      u: a.u + (b.u - a.u) * e,
      w: a.w + (b.w - a.w) * e,
      heading: a.heading + angleDiff(b.heading, a.heading) * e,
    };
  }
  return k[k.length - 1];
}

/** How long a move takes, s. */
export function moveLength(move: DoorMove): number {
  return move.keys[move.keys.length - 1].t;
}

/** THE DOOR HE CAN OPEN NOW, or null: on a run that opens them, on his
 * skis (not thrown, on foot, on a lift, in a tunnel, on a rail, a machine
 * or in a lodge), at a crawl, within `DOOR.reach` of a doorway on either
 * side and turned toward it, not already moving through one. */
export function doorNear(run: GameState): BuildingDoor | null {
  if (!run.rules.doors || run.doorway?.move) return null;
  const c = run.skier;
  if (c.thrown || c.fetch || c.lift || c.tunnel || c.jib) return null;
  if (run.afterski?.inside || run.heli?.rider || run.sled?.rider) return null;
  if (run.para && run.para.mode !== "dropped") return null;
  if (run.balloon?.aboard) return null;
  if (hypot3(c.vx, c.vy, c.vz) > DOOR.slowest) return null;
  let best: BuildingDoor | null = null;
  let most: number = DOOR.reach;
  for (const d of buildingDoors(run.level)) {
    const f = doorFrame(d);
    const dx = c.x - f.x;
    const dz = c.z - f.z;
    const off = offDoorway(d, c.x, c.z);
    if (off > most) continue;
    if (Math.abs(c.y - c.spec.cogHeight - f.y) > 3) continue;
    const to = Math.atan2(-dx, -dz);
    if (Math.abs(angleDiff(to, c.heading)) > DOOR.facing) continue;
    most = off;
    best = d;
  }
  return best;
}

/** How far (x, z) is from `door`'s doorway, m — anywhere across its width,
 * on its wall's middle line. */
export function offDoorway(door: BuildingDoor, x: number, z: number): number {
  const f = doorFrame(door);
  const dx = x - f.x;
  const dz = z - f.z;
  const along = clamp(dx * f.rx + dz * f.rz, -door.width / 2, door.width / 2);
  return hypot(dx - f.rx * along, dz - f.rz * along);
}

/** Whether the machine press would open (or shut) a door now. */
export function doorWithin(run: GameState): boolean {
  return doorNear(run) !== null;
}

/** The move through `door`'s leaf from the side (u0, w0) is on, facing
 * `h0` — the keyframes off `DOOR`. */
function planMove(
  run: GameState,
  door: BuildingDoor,
  side: 1 | -1,
  u0: number,
  w0: number,
  h0: number,
): DoorMove {
  const T = DOOR.time;
  const f = doorFrame(door);
  const leaf = activeLeaf(door);
  const L = leavesOf(door)[leaf];
  const half = BUILDING_WALLS.wall / 2;
  // His side's depth `o` off the leaf's face, as w.
  const at = (o: number): number => side * (o + half);
  const facing = Math.atan2(-side * f.nx, -side * f.nz);
  const roll = L.way === 0;
  // Toward the latch from the hinge, in u.
  const toLatch = Math.sign(L.latch - L.hinge) || 1;
  // A leaf that swings toward his side comes to him: he draws it.
  const pull = !roll && L.way === side;
  const stand = roll
    ? { u: 0, w: at(0.9) }
    : pull
      ? { u: L.latch + toLatch * DOOR.pull.past, w: at(DOOR.pull.out) }
      : { u: L.latch - toLatch * DOOR.push.in, w: at(DOOR.push.out) };
  const away = hypot(stand.u - u0, stand.w - w0);
  const a = clamp(away / T.shuffle, T.least, T.most);
  const open = a + T.reach + T.press;
  const keys: DoorKey[] = [
    { t: 0, u: u0, w: w0, heading: h0 },
    { t: a, ...stand, heading: facing },
    { t: open, ...stand, heading: facing },
  ];
  // Through: a pace past the hinge's half of the passage, out the far side.
  const pass = roll ? 0 : L.hinge + 0.55 * (L.latch - L.hinge);
  const far = { u: pass, w: -side * (DOOR.inside + half) };
  let from = stand;
  let t = open + T.wait;
  if (pull) {
    // Drawn toward him as he steps back out of its sweep, then round it.
    const back = { u: stand.u, w: at(DOOR.pull.back) };
    keys.push({ t: open + 0.6, ...back, heading: facing });
    from = back;
    t = open + 1.25;
  }
  keys.push({ t, ...from, heading: facing });
  const near = { u: pass, w: at(pull ? 0.55 : 0.35) };
  const go = (p: { u: number; w: number }, lin: boolean): void => {
    const last = keys[keys.length - 1];
    t += hypot(p.u - last.u, p.w - last.w) / T.through;
    keys.push({ t, ...p, heading: facing, lin });
  };
  go(near, false);
  go({ u: pass, w: 0 }, true);
  go(far, false);
  return { id: door.id, leaf, side, start: run.t, open, pull, keys };
}

/** The door's frame point and the snow or floor under it: stood there on
 * his skis, facing `heading` — on the snow outside, on the floor within. */
function stand(
  run: GameState,
  door: BuildingDoor,
  f: DoorFrame,
  u: number,
  w: number,
  heading: number,
): void {
  const p = doorPoint(f, u, w);
  standSkier(run, p.x, p.z, heading);
  // Within the walls the floor is the building's, never the hill it is
  // dug into or the snow drifted against it.
  const c = run.skier;
  const inside = -w - BUILDING_WALLS.wall / 2;
  if (inside > 0) {
    const k = clamp(inside / 0.4, 0, 1);
    c.y += (door.y + c.spec.cogHeight - c.y) * k;
    if (k >= 1) c.q = fromEuler(heading, 0, 0);
  }
}

/** A swing begun, re-begun from how far open it is, or let go. */
function withSwing(run: GameState, s: DoorSwing): void {
  const was = run.doorway ?? { swings: [], move: null };
  const rest = was.swings.filter((o) => o.id !== s.id || o.leaf !== s.leaf);
  run.doorway = { ...was, swings: [...rest, s] };
}

/** ONE STEP OF THE DOORS, before anything else is stepped: every leaf
 * moved on by the clock — held while he is in its way, let go to its
 * closer once he is clear, latched shut — and the solid it is (`setDoor`).
 * `events` is the run's own list. */
export function stepDoorLeaves(run: GameState, events: GameEvent[]): void {
  const d0 = run.doorway;
  if (!d0 || d0.swings.length === 0) return;
  const c = run.skier;
  const L = DOOR.leaf;
  let swings: DoorSwing[] | null = null;
  for (const s of d0.swings) {
    const door = buildingDoorOf(run.level, s.id);
    if (!door) continue;
    const roll = door.swing === "roll";
    const share = swingShare(s, run.t, roll);
    // LET GO: once he is not moving through it and is clear of it, and it
    // has finished its swing and stood its dwell.
    if (s.shut < 0) {
      const moving = d0.move?.id === s.id;
      const clear = offDoorway(door, c.x, c.z) > L.clear;
      const done = run.t - s.at >= (roll ? L.rollUp : L.swing) + L.dwell;
      if (!moving && clear && done) {
        swings ??= d0.swings.slice();
        swings[swings.indexOf(s)] = { ...s, shut: run.t, from: share };
      }
    } else if (share <= 0) {
      // LATCHED: gone from the list.
      swings ??= d0.swings.slice();
      swings.splice(swings.indexOf(s), 1);
      const f = doorFrame(door);
      events.push({
        kind: "door",
        t: run.t,
        phase: "shut",
        id: s.id,
        stuff: door.stuff,
        swing: door.swing,
        x: f.x,
        y: f.y + 1,
        z: f.z,
      });
    }
  }
  if (swings) run.doorway = { ...d0, swings };
  // THE SOLID: a doorway any of whose leaves is open past `pass` lets him by.
  const open = new Map<string, boolean>();
  for (const s of run.doorway!.swings) {
    const roll = buildingDoorOf(run.level, s.id)?.swing === "roll";
    if (swingShare(s, run.t, roll) >= L.pass) open.set(s.id, true);
    else if (!open.has(s.id)) open.set(s.id, false);
  }
  for (const id of run.doors ?? []) if (!open.has(id)) open.set(id, false);
  for (const [id, on] of open) setDoor(run, id, on);
  if (run.doorway!.swings.length === 0 && !run.doorway!.move) delete run.doorway;
}

/** ONE STEP OF THE SKIER AT A DOOR: the machine press at one starts his
 * move (or shuts a door standing open); while the move runs he is stood
 * where it has him and the step is his. True while it runs — the snow, the
 * trees and his clock wait. */
export function stepDoorway(run: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const move = run.doorway?.move ?? null;
  if (!move) {
    if (!input.machine) return false;
    const door = doorNear(run);
    if (!door) return false;
    const leaf = activeLeaf(door);
    const share = leafShare(run, door.id, leaf);
    const held = run.doorway?.swings.find((s) => s.id === door.id && s.leaf === leaf);
    // A DOOR STANDING OPEN is shut on the press.
    if (held && held.shut < 0 && share > 0.5) {
      withSwing(run, { ...held, shut: run.t, from: share });
      return false;
    }
    const f = doorFrame(door);
    const c = run.skier;
    const dx = c.x - f.x;
    const dz = c.z - f.z;
    const w0 = dx * f.nx + dz * f.nz;
    const side: 1 | -1 = w0 >= 0 ? 1 : -1;
    const m = planMove(run, door, side, dx * f.rx + dz * f.rz, w0, c.heading);
    run.doorway = { swings: run.doorway?.swings ?? [], move: m };
    standHeld(run, door, f, m);
    return true;
  }
  const door = buildingDoorOf(run.level, move.id);
  if (!door) {
    run.doorway = { ...run.doorway!, move: null };
    return false;
  }
  const f = doorFrame(door);
  const t = run.t - move.start;
  // THE LATCH DRAWN: the leaf set moving — from wherever a closer had
  // brought it, if it was still swinging.
  if (t >= move.open && t - TUNING.dt < move.open) {
    const roll = door.swing === "roll";
    const share = leafShare(run, door.id, move.leaf);
    withSwing(run, {
      id: door.id,
      leaf: move.leaf,
      at: run.t - (roll ? DOOR.leaf.rollUp : DOOR.leaf.swing) * unsmooth(share),
      shut: -1,
      from: 0,
    });
    events.push({
      kind: "door",
      t: run.t,
      phase: "open",
      id: door.id,
      stuff: door.stuff,
      swing: door.swing,
      x: f.x,
      y: f.y + 1,
      z: f.z,
    });
  }
  if (t >= moveLength(move)) {
    standHeld(run, door, f, move);
    run.doorway = { ...run.doorway!, move: null };
    // INTO AN AFTERSKI LODGE: the room is the lodge's.
    if (move.side > 0 && door.kind === "afterski" && run.afterski && !run.afterski.inside) {
      const lodge = lodgesOf(run.level).find((l) => l.id === door.id);
      if (lodge) enterLodge(run, lodge, events);
    }
    return true;
  }
  standHeld(run, door, f, move);
  return true;
}

/** Stood where the move has him now. */
function standHeld(run: GameState, door: BuildingDoor, f: DoorFrame, move: DoorMove): void {
  const p = moveAt(move, run.t - move.start);
  stand(run, door, f, p.u, p.w, p.heading);
}
