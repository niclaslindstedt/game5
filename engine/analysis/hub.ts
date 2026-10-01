// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R26, R29, R30 — THE FOOT OF THE MOUNTAIN AND THE SURFACE LIFTS HELD: the
// hub as the level publishes it (an open, groomed band holding every finish
// and every valley bottom station, no tree in it), its two wind tunnels
// (one each way along it, on the floor, square across any run, groomed and
// clear), and every drag lift's line (its length, its pitch, its pad, and
// no piste run up) — read off the finished map and never off the plan that
// laid them.

import { angleDiff, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { NetIndex, WIDEST, netHit } from "../mapgen/network.ts";
import { hubAt, outsideHub } from "../mapgen/query.ts";
import { RESORT_RULES as RR } from "../mapgen/resort-rules.ts";
import { LEVEL_RULES as R, withinBand } from "../mapgen/rules.ts";
import type { Level, Lift, Resort, WindTunnel } from "../mapgen/types.ts";
import type { Severity } from "./index.ts";

type Add = (rule: string, severity: Severity, message: string) => void;

/** How much past its numbers a pressed and baked map may read: the drag's
 * pitch and pad and a tunnel's grade are laid on the untouched mountain,
 * which the runs pressed into it move a little. */
const SLACK = 0.03;
/** How finely the hub's grooming and a line's grade are read, m. */
const READ = 20;
/** How near either end of a drag lift its line may meet the piste it
 * serves, m: its bottom stands beside a piste's foot. */
const ENDS = 40;

/** Whether a line at `heading` crossing a run at `run` crosses it square
 * (R26, R30): within `lift.drag.square` of square. */
function square(heading: number, run: number): boolean {
  const a = Math.abs(angleDiff(heading, run));
  return Math.min(a, Math.PI - a) >= Math.PI / 2 - RR.lift.drag.square;
}

/** R29 — the hub: present, holding every finish and every valley bottom
 * station, groomed, and no tree, kicker or cliff in it. */
export function holdHub(level: Level, resort: Resort, add: Add): void {
  const hub = resort.hub;
  if (!hub) {
    add("R29", "error", "no hub at the foot of the mountain");
    return;
  }
  const H = RR.hub;
  for (let i = 0; i < hub.top.length; i++) {
    const depth = hub.bottom[i] - hub.top[i];
    if (!withinBand(depth, H.depth, 1)) {
      add(
        "R29",
        "error",
        `the hub is ${depth.toFixed(0)} m deep at x ${(hub.x0 + i * hub.step).toFixed(0)}`,
      );
      break;
    }
  }
  const floorZ = R.mountain.base * level.size;
  for (const run of resort.runs) {
    if (run.into || run.to !== undefined) continue;
    const end = run.points[run.points.length - 1];
    if (outsideHub(hub, end.x, end.z) > 1)
      add("R29", "error", `run ${run.id} finishes outside the hub`);
  }
  for (const l of resort.lifts) {
    if (l.bottom.z < floorZ) continue;
    if (outsideHub(hub, l.bottom.x, l.bottom.z) > RR.access.skate) {
      add("R29", "error", `${l.id}'s bottom station stands off the hub`);
    }
  }
  let ungroomed = 0;
  const x1 = hub.x0 + hub.step * (hub.top.length - 1);
  for (let x = hub.x0; x <= x1; x += READ) {
    const e = hubAt(hub, x);
    if (!e) continue;
    for (let z = e.top; z <= e.bottom; z += READ) if (level.packedAt(x, z) < 0.98) ungroomed++;
  }
  if (ungroomed > 0) add("R29", "error", `the hub is ungroomed at ${ungroomed} place(s)`);
  const inside = level.trees.filter((t) => outsideHub(hub, t.x, t.z) === 0).length;
  if (inside > 0) add("R29", "error", `${inside} tree(s) stand in the hub`);
  const features = [...(level.kickers ?? []), ...(level.cliffs ?? [])].filter(
    (f) => outsideHub(hub, f.x, f.z) === 0,
  );
  if (features.length > 0)
    add("R29", "error", `${features.length} kicker(s) or cliff(s) stand in the hub`);
}

/** R30 — the two wind tunnels. */
export function holdTunnels(level: Level, resort: Resort, net: NetIndex, add: Add): void {
  const T = RR.tunnel;
  const tunnels = resort.tunnels ?? [];
  const ids = tunnels.map((t) => t.id).join(",");
  if (ids !== "W1,W2") {
    add("R30", "error", `the wind tunnels are [${ids}], not W1 and W2`);
    if (tunnels.length < 2) return;
  }
  const way = (t: WindTunnel): { x: number; z: number } => {
    const a = t.points[0];
    const b = t.points[t.points.length - 1];
    return { x: b.x - a.x, z: b.z - a.z };
  };
  const [a, b] = [way(tunnels[0]), way(tunnels[1])];
  if (a.x * b.x + a.z * b.z >= 0) add("R30", "error", "the wind tunnels blow the same way");
  const hit = netHit();
  const floorZ = R.mountain.base * level.size;
  const stations = [
    ...resort.lifts.flatMap((l) => (l.bottom.z >= floorZ ? [l.bottom] : [])),
    ...resort.runs.flatMap((r) =>
      r.into || r.to !== undefined ? [] : [r.points[r.points.length - 1]],
    ),
  ];
  const byStation = (p: { x: number; z: number }): number =>
    Math.min(...stations.map((q) => hypot(q.x - p.x, q.z - p.z)));
  for (const t of tunnels) {
    const pts = t.points;
    const n = pts.length;
    if (t.width < T.width - 1 || t.width > T.width + 1)
      add("R30", "error", `${t.id} is ${t.width} m wide`);
    if (t.speed < T.speed - 3 || t.speed > T.speed + 2)
      add("R30", "error", `${t.id} blows at ${t.speed} m/s`);
    if (n < 2 || t.length < T.length - 1 || Math.abs(pts[n - 1].s - t.length) > 0.5) {
      add("R30", "error", `${t.id} is ${t.length.toFixed(0)} m long`);
      continue;
    }
    for (let i = 1; i < n; i++) {
      const ds = pts[i].s - pts[i - 1].s;
      if (
        Math.abs(ds - T.step) > 1 ||
        Math.abs(hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) - ds) > 0.5
      ) {
        add(
          "R30",
          "error",
          `${t.id}'s stations are not ${T.step} m apart at ${pts[i].s.toFixed(0)} m`,
        );
        break;
      }
    }
    if (byStation(pts[0]) > T.reach)
      add("R30", "error", `${t.id}'s entrance stands by no station or finish`);
    if (byStation(pts[n - 1]) > T.reach)
      add("R30", "error", `${t.id}'s exit stands by no station or finish`);
    const k = Math.max(1, Math.round(T.window / T.step));
    let steepest = 0;
    let off = 0;
    let crossed = 0;
    let ungroomed = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const y = level.groundAt(p.x, p.z);
      if (i + k < n)
        steepest = Math.max(
          steepest,
          Math.abs(level.groundAt(pts[i + k].x, pts[i + k].z) - y) / (pts[i + k].s - p.s),
        );
      if (resort.hub && outsideHub(resort.hub, p.x, p.z) > 0) off++;
      if (level.packedAt(p.x, p.z) < 0.98) ungroomed++;
      net.nearest(p.x, p.z, WIDEST, () => false, hit);
      if (hit.distance < hit.width / 2 + t.width / 2 && !square(p.heading, hit.heading)) crossed++;
    }
    if (steepest > T.grade + SLACK) add("R30", "error", `${t.id} falls at ${steepest.toFixed(3)}`);
    if (off > 0) add("R30", "error", `${t.id} leaves the hub at ${off} station(s)`);
    if (ungroomed > 0) add("R30", "error", `${t.id} is ungroomed at ${ungroomed} station(s)`);
    if (crossed > 0) add("R30", "error", `${t.id} runs along a run at ${crossed} station(s)`);
    const reach = t.width / 2 + RR.lift.clear - 0.5;
    const xs = pts.map((q) => q.x);
    const zs = pts.map((q) => q.z);
    const box = {
      x0: Math.min(...xs) - reach,
      x1: Math.max(...xs) + reach,
      z0: Math.min(...zs) - reach,
      z1: Math.max(...zs) + reach,
    };
    const near = level.trees.filter(
      (tr) =>
        tr.x > box.x0 &&
        tr.x < box.x1 &&
        tr.z > box.z0 &&
        tr.z < box.z1 &&
        lineDistance(pts, tr.x, tr.z) < reach,
    );
    if (near.length > 0) add("R30", "error", `${near.length} tree(s) stand on ${t.id}`);
  }
  let apart = Infinity;
  for (const p of tunnels[0].points)
    apart = Math.min(apart, lineDistance(tunnels[1].points, p.x, p.z));
  if (apart < T.gap - 1) add("R30", "error", `the wind tunnels pass ${apart.toFixed(0)} m apart`);
}

/** R26 — the line of every drag lift R29 laid (all but the nursery's D1,
 * which the plan stands on its slopes). */
export function holdDrags(level: Level, resort: Resort, net: NetIndex, add: Add): void {
  const D = RR.lift.drag;
  const hit = netHit();
  const lanes = (r: number): boolean => resort.runs[r].kind === "road";
  for (const l of resort.lifts) {
    if (l.kind !== "drag" || l.id === "D1") continue;
    const length = hypot(l.top.x - l.bottom.x, l.top.z - l.bottom.z);
    if (!withinBand(length, D.length, 1))
      add("R26", "error", `${l.id} is ${length.toFixed(0)} m long`);
    const n = Math.max(2, Math.ceil(length / 5));
    const heading = Math.atan2(l.top.x - l.bottom.x, l.top.z - l.bottom.z);
    const ys: number[] = [];
    let along = 0;
    for (let i = 0; i <= n; i++) {
      const x = l.bottom.x + ((l.top.x - l.bottom.x) * i) / n;
      const z = l.bottom.z + ((l.top.z - l.bottom.z) * i) / n;
      ys.push(level.groundAt(x, z));
      const u = (i / n) * length;
      if (u < ENDS || u > length - ENDS) continue;
      net.nearest(x, z, WIDEST, lanes, hit);
      if (hit.distance < hit.width / 2 + D.room - 0.5 && !square(heading, hit.heading)) along++;
    }
    const k = Math.max(1, Math.round(D.pitchWindow / (length / n)));
    let steepest = 0;
    for (let i = 0; i + k <= n; i++)
      steepest = Math.max(steepest, (ys[i + k] - ys[i]) / (k * (length / n)));
    if (steepest > D.pitch + SLACK) add("R26", "error", `${l.id} climbs at ${steepest.toFixed(2)}`);
    if (along > 0) add("R26", "error", `${l.id} runs up a piste at ${along} place(s)`);
    const pad = padGrade(level, l);
    if (pad > D.padGrade + SLACK)
      add("R26", "error", `${l.id}'s top falls ${pad.toFixed(2)} across its pad`);
  }
}

/** The most the ground falls across a lift's top pad, m per m. */
function padGrade(level: Level, l: Lift): number {
  const h = RR.lift.pad / 2;
  const { x, z } = l.top;
  return (
    Math.max(
      Math.abs(level.groundAt(x + h, z) - level.groundAt(x - h, z)),
      Math.abs(level.groundAt(x, z + h) - level.groundAt(x, z - h)),
    ) /
    (2 * h)
  );
}

/** Plan distance from a point to a polyline, m. */
function lineDistance(pts: readonly { x: number; z: number }[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
    best = Math.min(best, hypot(x - (a.x + dx * t), z - (a.z + dz * t)));
  }
  return best;
}
