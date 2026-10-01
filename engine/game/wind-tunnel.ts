// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND TUNNEL (R30) — a horizontal lift along the hub at the foot of
// the mountain: a skier stood into the wind inside one is blown along it to
// its exit at the tunnel's own speed, without skiing a metre, and let go
// there with his way kept. The player and every rival alike: it is part of
// the one step a skier takes (`run.ts`).
//
// Two halves, both pure over the level and the skier, drawing nothing from
// the stream:
//   * THE RIDE (`stepTunnel`), before the skier is stepped: whether he is
//     taken in (inside its width, his skis within `tunnel.capture` of the
//     way it blows — so a skier skiing across one, a racer's finish among
//     them, is never carried off), where along it he is, and when he is let
//     go — past its edge, at its exit, or thrown — each with its event.
//   * THE WIND (`tunnelWind`, `tunnelBlow`), summed with every other force
//     on him (`skier.ts`): the air in a tunnel moves along it at its speed,
//     so his drag is against that air, and the blowers thrust him on toward
//     it and hold him to its line.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { TUNING } from "./defs/tuning.ts";
import type { WindTunnel } from "../mapgen/types.ts";
import type { GameEvent, GameState, SkierState } from "./state.ts";

/** Where a point stands against a tunnel's line: its arc along it (read
 * past either end, so a point beyond the exit is past `length`), how far
 * right of it, the way the wind blows there, and the station it was read
 * from. */
type Hit = { s: number; lateral: number; heading: number; seg: number };

const hit: Hit = { s: 0, lateral: 0, heading: 0, seg: 0 };

/** How many stations either way of the last one a rider's place is read
 * over; a skier at a tunnel's speed covers one a step. */
const WINDOW = 6;

/** Read a point against a tunnel's line, over its stations `from`..`to`. */
function readAt(t: WindTunnel, x: number, z: number, from: number, to: number): Hit {
  const pts = t.points;
  let best = Infinity;
  for (let i = Math.max(0, from); i < Math.min(pts.length - 1, to); i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = hypot(dx, dz) || 1;
    // The ends read past themselves: before the entrance, beyond the exit.
    let u = ((x - a.x) * dx + (z - a.z) * dz) / len;
    if (i > 0) u = Math.max(0, u);
    if (i < pts.length - 2) u = Math.min(len, u);
    const px = a.x + (dx / len) * u;
    const pz = a.z + (dz / len) * u;
    const d = hypot(x - px, z - pz);
    if (d >= best) continue;
    best = d;
    // Right of the way it blows is positive (`cos h, −sin h`).
    hit.lateral = (x - px) * (dz / len) - (z - pz) * (dx / len);
    hit.s = a.s + u;
    hit.heading = Math.atan2(dx, dz);
    hit.seg = i;
  }
  return hit;
}

/** R30 — THE RIDE: take the skier in, follow him along, or let him go,
 * before he is stepped. `events` is the run's own list. */
export function stepTunnel(run: GameState, events: GameEvent[]): void {
  const c = run.skier;
  const tunnels = run.level.resort?.tunnels;
  const T = TUNING.tunnel;
  const ride = c.tunnel;
  if (ride) {
    const t = tunnels?.[ride.index];
    const h = t ? readAt(t, c.x, c.z, ride.seg - WINDOW, ride.seg + WINDOW) : null;
    if (!t || !h || c.thrown || h.s >= t.length || Math.abs(h.lateral) > t.width / 2 + T.release) {
      c.tunnel = null;
      events.push({ kind: "tunnel", t: run.t, id: ride.id, phase: "out" });
      return;
    }
    ride.s = h.s;
    ride.lateral = h.lateral;
    ride.heading = h.heading;
    ride.seg = h.seg;
    return;
  }
  if (!tunnels || c.thrown) return;
  for (let i = 0; i < tunnels.length; i++) {
    const t = tunnels[i];
    if (!near(t, c.x, c.z)) continue;
    const h = readAt(t, c.x, c.z, 0, t.points.length);
    if (h.s < 0 || h.s >= t.length || Math.abs(h.lateral) > t.width / 2) continue;
    if (Math.abs(angleDiff(c.heading, h.heading)) > T.capture) continue;
    c.tunnel = { index: i, id: t.id, s: h.s, lateral: h.lateral, heading: h.heading, seg: h.seg };
    events.push({ kind: "tunnel", t: run.t, id: t.id, phase: "in" });
    return;
  }
}

/** The box round a tunnel's every station, m — a tunnel need not be
 * straight — and whether a point is inside it, its width out. */
const boxes = new WeakMap<WindTunnel, { x0: number; x1: number; z0: number; z1: number }>();
function near(t: WindTunnel, x: number, z: number): boolean {
  let box = boxes.get(t);
  if (!box) {
    box = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    for (const p of t.points) {
      box.x0 = Math.min(box.x0, p.x);
      box.x1 = Math.max(box.x1, p.x);
      box.z0 = Math.min(box.z0, p.z);
      box.z1 = Math.max(box.z1, p.z);
    }
    boxes.set(t, box);
  }
  const pad = t.width;
  return x > box.x0 - pad && x < box.x1 + pad && z > box.z0 - pad && z < box.z1 + pad;
}

const wind = { x: 0, z: 0 };
const blow = { x: 0, z: 0 };

/** THE AIR in the tunnel a skier rides, m/s — still air out of one. The
 * drag he feels is against it (`skier.ts`). */
export function tunnelWind(
  c: SkierState,
  tunnels: readonly WindTunnel[] | undefined,
): { x: number; z: number } {
  const t = c.tunnel ? tunnels?.[c.tunnel.index] : undefined;
  if (!c.tunnel || !t) {
    wind.x = 0;
    wind.z = 0;
    return wind;
  }
  wind.x = Math.sin(c.tunnel.heading) * t.speed;
  wind.z = Math.cos(c.tunnel.heading) * t.speed;
  return wind;
}

/** THE BLOWERS, m/s² on the whole skier: the thrust along the tunnel
 * toward its speed, and the hold to its line across it. */
export function tunnelBlow(
  c: SkierState,
  tunnels: readonly WindTunnel[] | undefined,
): { x: number; z: number } {
  const ride = c.tunnel;
  const t = ride ? tunnels?.[ride.index] : undefined;
  if (!ride || !t) {
    blow.x = 0;
    blow.z = 0;
    return blow;
  }
  const T = TUNING.tunnel;
  const fx = Math.sin(ride.heading);
  const fz = Math.cos(ride.heading);
  const along = c.vx * fx + c.vz * fz;
  const across = c.vx * fz - c.vz * fx;
  const push = T.thrust * clamp((t.speed - along) / T.soft, -T.back, 1);
  const hold = -T.centre * ride.lateral - T.damp * across;
  // Along the way it blows, and across it to the right (`fz, −fx`).
  blow.x = fx * push + fz * hold;
  blow.z = fz * push - fx * hold;
  return blow;
}
