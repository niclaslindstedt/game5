// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S TRAFFIC VIEWS (`make world ARGS="--views=village-traffic"`,
// `--hour=21` for the night): the village's cars, ski bus and bicycles
// (`traffic-view.ts`) through the game's own renderer, each at a MOMENT the
// view picks off the plan (the run's clock wound to it for the picture and
// back after, so the ride goes on where it was):
//
//   * village-traffic — down the main street at a walker's eye from the
//     sidewalk, a car coming toward the lens at the street's pace;
//   * village-junction — over the busiest junction from a first floor's
//     height, as the most vehicles are about it;
//   * village-carpark — over the day car park, its bays and the cars in
//     them, a visitor turning into one or backing out;
//   * village-bus — across the street from the bus stop, the ski bus
//     standing at it;
//   * village-cyclist — beside a cyclist riding, at his height;
//   * vehicle-<kind> — one of a kind close, from its front three quarters;
//   * vehicles — THE SHEET: every kind on the map from the front three
//     quarters, the side, the back three quarters and from above, a row a
//     kind (a parked one where there is one, else one moving).

import {
  VEHICLES,
  freshVehiclePose,
  onCarriageway,
  trafficOf,
  vehicleAt,
  villageOf,
  type GameState,
  type TrafficPlan,
  type VehicleKind,
  type VehiclePose,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

type Lab = {
  state: GameState;
  still(): void;
  setOverride(p: LensPose | null): void;
  canvas: HTMLCanvasElement;
};

/** The views this module answers for the world lab. */
export const TRAFFIC_VIEWS = [
  "village-traffic",
  "village-junction",
  "village-carpark",
  "village-bus",
  "village-cyclist",
  "vehicles",
  "vehicle-hatch",
  "vehicle-estate",
  "vehicle-suv",
  "vehicle-van",
  "vehicle-bus",
  "vehicle-bike",
] as const;

/** The first moment from `t0` on (every half second over a period) that
 * `ok` holds of some vehicle, and that vehicle's pose then. */
function findMoment(
  plan: TrafficPlan,
  t0: number,
  ok: (p: VehiclePose, k: number, t: number) => boolean,
): { t: number; k: number; pose: VehiclePose } | null {
  const p = freshVehiclePose();
  for (let t = t0; t < t0 + plan.period; t += 0.5) {
    for (let k = 0; k < plan.vehicles.length; k++) {
      vehicleAt(plan, k, t, p);
      if (p.shown && ok(p, k, t)) return { t, k, pose: { ...p } };
    }
  }
  return null;
}

/** How many vehicles are within `r` m of (x, z) at `t`. */
function crowdAt(plan: TrafficPlan, x: number, z: number, r: number, t: number): number {
  const p = freshVehiclePose();
  let n = 0;
  for (let k = 0; k < plan.vehicles.length; k++) {
    vehicleAt(plan, k, t, p);
    if (p.shown && Math.hypot(p.x - x, p.z - z) < r) n++;
  }
  return n;
}

/** A lens at `eye` on `target`. */
function look(
  ex: number,
  ey: number,
  ez: number,
  tx: number,
  ty: number,
  tz: number,
  fov = 55,
): LensPose {
  return { eye: { x: ex, y: ey, z: ez }, target: { x: tx, y: ty, z: tz }, fov, roll: 0 };
}

/** The traffic views, keyed by name. */
export function trafficShots(lab: Lab): Record<string, () => string> {
  const level = lab.state.level;
  const plan = trafficOf(level);
  const v = villageOf(level);
  const shots: Record<string, () => string> = {};
  /** The picture at `t` of the run's clock from `pose`. */
  const frame = (t: number, pose: LensPose, note: string) => {
    const was = lab.state.t;
    lab.state.t = t;
    lab.setOverride(pose);
    lab.still();
    lab.setOverride(null);
    lab.state.t = was;
    return note;
  };
  const none = "no village traffic on this map";
  const ground = (x: number, z: number) => level.groundAt(x, z);

  shots["village-traffic"] = () => {
    if (!plan || !v) return none;
    const main = new Set(v.main);
    const lanes = plan.lanes;
    const at = findMoment(plan, lab.state.t, (p) => {
      if (p.kind === "bike" || p.kind === "bus" || p.lane < 0 || p.speed < 5) return false;
      return main.has(lanes[p.lane].street);
    });
    if (!at) return "no car on the main street";
    const p = at.pose;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    // On the kerb ahead of it and to its side, looking back up the street.
    const ex = p.x + fx * 13 - Math.cos(p.heading) * 4.4;
    const ez = p.z + fz * 13 + Math.sin(p.heading) * 4.4;
    return frame(
      at.t,
      look(ex, ground(ex, ez) + 1.7, ez, p.x - fx * 6, p.y + 1.0, p.z - fz * 6, 50),
      `a ${p.kind} on the main street at ${(p.speed * 3.6).toFixed(0)} km/h, t ${at.t.toFixed(1)} s`,
    );
  };

  shots["village-junction"] = () => {
    if (!plan || !v) return none;
    let best = { t: 0, n: -1, j: v.junctions[0] };
    for (const j of v.junctions) {
      if (j.exit) continue;
      for (let t = lab.state.t; t < lab.state.t + 120; t += 1) {
        const n = crowdAt(plan, j.x, j.z, 28, t);
        if (n > best.n) best = { t, n, j };
      }
    }
    const j = best.j;
    const ex = j.x + 16;
    const ez = j.z - 14 * v.valley;
    return frame(
      best.t,
      look(ex, ground(ex, ez) + 7.5, ez, j.x, j.y + 0.5, j.z, 62),
      `junction ${j.id}, ${best.n} vehicles within 28 m, t ${best.t.toFixed(0)} s`,
    );
  };

  shots["village-carpark"] = () => {
    if (!plan || !v) return none;
    const park = v.areas.find((a) => a.kind === "carpark");
    if (!park) return "no car park on this map";
    // A moment a visitor is moving in it.
    const at = findMoment(
      plan,
      lab.state.t,
      (p, k) =>
        plan.vehicles[k].role === "visitor" &&
        Math.abs(p.speed) > 0.3 &&
        Math.hypot(p.x - park.x, p.z - park.z) < park.half + 4,
    );
    const t = at?.t ?? lab.state.t;
    const hx = Math.sin(park.heading);
    const hz = Math.cos(park.heading);
    const ex = park.x - hx * (park.depth + 14) + hz * 10;
    const ez = park.z - hz * (park.depth + 14) - hx * 10;
    return frame(
      t,
      look(ex, ground(ex, ez) + 13, ez, park.x, park.y, park.z, 60),
      `the car park, ${plan.parked.length} cars parked in the village${at ? ", a visitor moving" : ""}`,
    );
  };

  shots["village-bus"] = () => {
    if (!plan || !v?.bus) return none;
    const stop = v.bus;
    const k = plan.vehicles.findIndex((x) => x.kind === "bus");
    const at = findMoment(
      plan,
      lab.state.t,
      (p, kk) =>
        kk === k && Math.abs(p.speed) < 0.05 && Math.hypot(p.x - stop.x, p.z - stop.z) < 12,
    );
    if (!at) return "the bus never stands at its stop";
    const p = at.pose;
    // Across the street from the shelter, three quarters off the bus's front.
    const ex = p.x + Math.sin(stop.heading) * 6.5 + Math.sin(p.heading) * 13;
    const ez = p.z + Math.cos(stop.heading) * 6.5 + Math.cos(p.heading) * 13;
    return frame(
      at.t + 4,
      look(ex, ground(ex, ez) + 1.7, ez, p.x, p.y + 1.6, p.z, 58),
      `the ski bus at its stop, t ${(at.t + 4).toFixed(1)} s`,
    );
  };

  shots["village-cyclist"] = () => {
    if (!plan) return none;
    const at = findMoment(plan, lab.state.t, (p) => p.kind === "bike" && p.speed > 2.5);
    if (!at) return "no cyclist on this map";
    const p = at.pose;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    const ex = p.x + fx * 3.2 - rx * 4.2;
    const ez = p.z + fz * 3.2 - rz * 4.2;
    return frame(
      at.t,
      look(ex, ground(ex, ez) + 1.5, ez, p.x, p.y + 0.9, p.z, 50),
      `a cyclist at ${(p.speed * 3.6).toFixed(0)} km/h`,
    );
  };

  /** One of `kind` to look at: a parked one at the end of a row, else one
   * moving, and the moment. */
  const specimen = (kind: VehicleKind) => {
    if (!plan) return null;
    const parked = plan.parked.find((c) => c.kind === kind && !crowded(plan, c.x, c.z));
    if (parked)
      return { kind, t: lab.state.t, x: parked.x, y: parked.y, z: parked.z, h: parked.heading };
    const at = findMoment(plan, lab.state.t, (p) => p.kind === kind && p.speed > 1.5);
    return at
      ? { kind, t: at.t, x: at.pose.x, y: at.pose.y, z: at.pose.z, h: at.pose.heading }
      : null;
  };
  for (const kind of ["hatch", "estate", "suv", "van", "bus", "bike"] as const) {
    shots[`vehicle-${kind}`] = () => {
      const r = specimen(kind);
      if (!r) return `no ${kind} on this map`;
      const V = VEHICLES[kind];
      const d = Math.max(3, V.length * 1.15);
      // The front three quarters from the street's side.
      // A long vehicle is looked at nearer its nose, so the lens stays on
      // the street rather than in the windrow beside it.
      const off = kind === "bus" ? 0.32 : 0.62;
      let az = r.h + off;
      if (!onCarriageway(level, r.x + Math.sin(az) * d, r.z + Math.cos(az) * d)) az = r.h - off;
      const ex = r.x + Math.sin(az) * d;
      const ez = r.z + Math.cos(az) * d;
      return frame(
        r.t,
        look(
          ex,
          Math.max(r.y + 1.2 + V.height * 0.35, ground(ex, ez) + 1.5),
          ez,
          r.x,
          r.y + V.height * 0.42,
          r.z,
          46,
        ),
        `a ${kind}`,
      );
    };
  }

  shots.vehicles = () => {
    if (!plan) return none;
    const kinds: VehicleKind[] = ["hatch", "estate", "suv", "van", "bus", "bike"];
    const angles = [
      { name: "front 3/4", az: 35, high: 1.3, dist: 1.0 },
      { name: "side", az: 90, high: 1.0, dist: 1.0 },
      { name: "back 3/4", az: 215, high: 1.6, dist: 1.0 },
      { name: "above", az: 60, high: 6, dist: 0.9 },
    ];
    const rows = kinds.flatMap((kind) => {
      const r = specimen(kind);
      return r ? [r] : [];
    });
    const cellW = 320;
    const cellH = 180;
    const sheet = document.createElement("canvas");
    sheet.width = cellW * angles.length;
    sheet.height = cellH * rows.length;
    const g = sheet.getContext("2d") as CanvasRenderingContext2D;
    g.fillStyle = "#0b1116";
    g.fillRect(0, 0, sheet.width, sheet.height);
    g.font = "13px monospace";
    rows.forEach((r, row) => {
      const V = VEHICLES[r.kind];
      const size = Math.max(3.2, V.length * 1.25);
      // Every view from the open side: the street's, not the kerb's.
      const d = size;
      const open = (deg: number) => {
        const az = r.h + (deg * Math.PI) / 180;
        return onCarriageway(level, r.x + Math.sin(az) * d, r.z + Math.cos(az) * d);
      };
      const flip = !open(90) && open(-90);
      angles.forEach((a, col) => {
        const az = r.h + ((flip ? -a.az : a.az) * Math.PI) / 180;
        const ex = r.x + Math.sin(az) * d * a.dist;
        const ez = r.z + Math.cos(az) * d * a.dist;
        frame(
          r.t,
          look(ex, r.y + a.high + V.height * 0.4, ez, r.x, r.y + V.height * 0.45, r.z, 50),
          "",
        );
        g.drawImage(lab.canvas, col * cellW, row * cellH, cellW, cellH);
        g.fillStyle = "rgba(0,0,0,0.55)";
        g.fillRect(col * cellW, row * cellH, cellW, 20);
        g.fillStyle = "#fff";
        g.fillText(`${r.kind} · ${a.name}`, col * cellW + 6, row * cellH + 14);
      });
    });
    lab.canvas.style.display = "none";
    sheet.id = "sheet";
    document.body.prepend(sheet);
    document.body.style.overflow = "visible";
    document.documentElement.style.height = "auto";
    document.body.style.height = "auto";
    return `${rows.length} kinds from four sides`;
  };
  return shots;
}

/** Whether another parked car stands within a car's length of (x, z) on
 * both sides — a sheet's car is one at the end of a row, seen whole. */
function crowded(plan: TrafficPlan, x: number, z: number): boolean {
  let n = 0;
  for (const c of plan.parked) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d > 0.1 && d < 3.2) n++;
  }
  return n >= 2;
}
