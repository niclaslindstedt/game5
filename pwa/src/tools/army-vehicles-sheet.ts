// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY LAB'S `vehicles` SHEET (`make army ARGS="--sheet=vehicles"`):
// the ground waves' carriers, trucks and tanks IN THE GAME
// (`army-vehicle.ts`, drawn by `army-vehicle-view.ts` off
// `army-vehicle-shapes.ts`) — a hunted free ride on the real engine at five
// stars, him stood still, the waves alone:
//
//   * `vehicle-stand`: one of each stood on the piste beside him — round
//     the tank, the carrier and the truck, and close on each;
//   * `vehicle-wave`: a wave's vehicles out and climbing at him — wide from
//     over him down the mountain, beside the nearest, behind the column;
//   * `vehicle-fire`: a tank halted and firing its main gun — the gun as it
//     fires from behind the tank, the shell's burst on the snow, and wide.
//
// The army harness hands over its own lenses and its run (`VehicleLab`).

import * as THREE from "three";
import {
  ARMY_WAVE,
  NEUTRAL_INPUT,
  WANTED,
  armyVehicles,
  callVehicles,
  step,
  type ArmyVehicle,
  type GameState,
  type GunfireEvent,
  type WantedRoster,
} from "@engine";

import type { WaveLab } from "./army-waves-sheet.ts";

/** What the army harness lends the sheet: the waves' lab and a frame drawn
 * `dt` s on (so a burst grows between two). */
export type VehicleLab = WaveLab & { frame(run: GameState, dt: number): void };

/** The waves alone for the length of `fn`: the roster's men held back,
 * its fire as `fire`, no snowmobiles; put back after. */
async function alone<T>(fire: WantedRoster["fire"], fn: () => Promise<T>): Promise<T> {
  const rows = WANTED.roster as WantedRoster[];
  const kept = rows.map((r) => ({ ...r }));
  const W = ARMY_WAVE as { sleds: number };
  const keptSleds = W.sleds;
  for (const r of rows) {
    r.gunners = 0;
    r.soldiers = 0;
    r.lifted = 0;
    r.snowmobiles = 0;
    if (r.fire !== "hold") r.fire = fire;
  }
  W.sleds = 0;
  try {
    return await fn();
  } finally {
    kept.forEach((r, i) => Object.assign(rows[i], r));
    W.sleds = keptSleds;
  }
}

const centre = (r: GameState, v: { x: number; z: number }, up = 1.5): THREE.Vector3 =>
  new THREE.Vector3(v.x, r.level.groundAt(v.x, v.z) + up, v.z);

/** A lens `d` m from `c` on the bearing `h` (rad), `up` m over it, kept
 * `clear` m over the snow. */
function off(r: GameState, c: THREE.Vector3, h: number, d: number, up: number, clear = 2) {
  const v = new THREE.Vector3(c.x + Math.sin(h) * d, c.y + up, c.z + Math.cos(h) * d);
  v.y = Math.max(v.y, r.level.groundAt(v.x, v.z) + clear);
  return v;
}

function noteOf(lab: WaveLab, r: GameState): string {
  const vs = armyVehicles(r);
  const by = (k: ArmyVehicle["kind"]) => vs.filter((v) => v.kind === k).length;
  const a = r.army;
  return `${lab.note(r)} · ${by("carrier")} carriers, ${by("truck")} trucks, ${by("tank")} tanks out · ${a?.unloaded ?? 0} men put down · ${a?.shells ?? 0} shells`;
}

export function vehicleViews(lab: VehicleLab): Record<string, () => Promise<void>> {
  /** One of each stood on the piste round him, parked. */
  const stand = () =>
    alone("hold", async () => {
      const r = await lab.groundRun(5, true, (g) => g.t > 1, 10, lab.at);
      if (!r) return;
      const c = r.skier;
      const h = lab.at.heading;
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      const rx = fz;
      const rz = -fx;
      const way = [];
      const path = [];
      for (let d = 0; d <= 400; d += 8) {
        way.push({ x: c.x - fx * d, z: c.z - fz * d, w: 12 });
        path.push(d);
      }
      const mix = { snowmobiles: 0, foot: 0, tracked: 1, trucks: 1, tanks: 1 };
      callVehicles(r, r.army!, r.wanted!, mix, 0, way, path, 0, []);
      // Stood across the piste below him, broadside to the lens.
      const spots: Record<ArmyVehicle["kind"], [number, number]> = {
        tank: [0, -26],
        carrier: [-14, -40],
        truck: [14, -40],
      };
      for (const v of r.army!.vehicles) {
        const [across, along] = spots[v.kind];
        v.x = c.x + rx * across + fx * along;
        v.z = c.z + rz * across + fz * along;
        v.y = r.level.groundAt(v.x, v.z);
        v.heading = h + (v.kind === "tank" ? 0.6 : 0.2);
        v.rear = v.heading - 0.25;
        v.mode = "park";
        v.speed = 0;
        v.pitch = 0;
        v.roll = 0;
        if (v.kind === "tank") {
          v.turret = -0.5;
          v.gun = 0.06;
        }
      }
      lab.frame(r, 1 / 60);
      const n = noteOf(lab, r);
      const tank = r.army!.vehicles.find((v) => v.kind === "tank")!;
      const carrier = r.army!.vehicles.find((v) => v.kind === "carrier")!;
      const truck = r.army!.vehicles.find((v) => v.kind === "truck")!;
      const mid = centre(r, { x: c.x + fx * -34, z: c.z + fz * -34 }, 1.5);
      lab.shoot("the three", lab.look(off(r, mid, h + 0.3, 34, 9), mid, 50), n, r);
      for (const [label, v, bearings] of [
        ["the tank", tank, [0.9, -2.3]],
        ["the carrier", carrier, [1.2, -2.0]],
        ["the truck", truck, [-1.0, 2.4]],
      ] as const) {
        const at = centre(r, v, 1.4);
        for (const b of bearings)
          lab.shoot(label, lab.look(off(r, at, v.heading + b, 11, 2.2), at, 50), n, r);
      }
    });

  /** A wave's vehicles out and climbing at him. */
  const wave = () =>
    alone("hold", async () => {
      const r = await lab.groundRun(
        5,
        false,
        (g) => {
          const vs = armyVehicles(g).filter((v) => v.mode === "drive");
          return vs.length >= 5 && vs.some((v) => v.t > 25);
        },
        300,
        lab.at,
      );
      if (!r) return;
      for (let i = 0; i < 4; i++) {
        lab.frame(r, 1 / 60);
        for (let k = 0; k < 4; k++) step(r, NEUTRAL_INPUT);
      }
      const n = noteOf(lab, r);
      const him = centre(r, r.skier, 1.5);
      const vs = armyVehicles(r)
        .slice()
        .sort(
          (a, b) =>
            Math.hypot(a.x - him.x, a.z - him.z) - Math.hypot(b.x - him.x, b.z - him.z),
        );
      const near = vs[0];
      const mid = new THREE.Vector3();
      for (const v of vs.slice(0, 6)) mid.add(centre(r, v, 1.5));
      mid.multiplyScalar(1 / Math.min(6, vs.length));
      const away = Math.atan2(him.x - mid.x, him.z - mid.z);
      lab.shoot(
        "wide, from over him",
        lab.look(off(r, him, away, 25, 35), mid, 55),
        n,
        r,
      );
      const at = centre(r, near, 1.6);
      lab.shoot(
        `beside the nearest (${near.kind})`,
        lab.look(off(r, at, near.heading + 1.4, 16, 3), at, 50),
        n,
        r,
      );
      lab.shoot(
        "behind the column",
        lab.look(off(r, mid, away + Math.PI, 70, 25), him, 50),
        n,
        r,
      );
    });

  /** A tank halted, firing its main gun, and the shell's burst. */
  const fire = () =>
    alone("aim", async () => {
      let tankId = -1;
      const r = await lab.groundRun(
        5,
        false,
        (g) => {
          for (const e of g.events)
            if (e.kind === "army-vehicle" && e.change === "halt" && e.vehicle === "tank") {
              const t = armyVehicles(g).find(
                (v) => v.kind === "tank" && v.mode === "halt" && v.shots === 0,
              );
              if (t) tankId = t.id;
            }
          return tankId >= 0;
        },
        400,
        lab.at,
      );
      if (!r) return;
      lab.frame(r, 1 / 60);
      let fired = false;
      let burst: GunfireEvent | null = null;
      for (let i = 0; i < 120 * 12 && !burst; i++) {
        step(r, NEUTRAL_INPUT);
        for (const e of r.events) {
          if (e.kind === "army-vehicle" && e.change === "fire") fired = true;
          if (e.kind === "gunfire" && e.phase === "blast" && e.weapon === "tankGun") burst = e;
        }
        if (fired && i % 2 === 0) lab.frame(r, 1 / 60);
      }
      const tank = r.army!.vehicles.find((v) => v.id === tankId);
      if (!tank || !burst) return;
      // The burst grown a few frames.
      for (let i = 0; i < 6; i++) {
        lab.frame(r, 1 / 60);
        step(r, NEUTRAL_INPUT);
        step(r, NEUTRAL_INPUT);
      }
      const n = `${noteOf(lab, r)} · the burst ${Math.hypot(burst.x - r.skier.x, burst.z - r.skier.z).toFixed(0)} m from him`;
      const at = centre(r, tank, 2);
      const blast = new THREE.Vector3(burst.x, burst.y + 1.5, burst.z);
      const toward = Math.atan2(blast.x - at.x, blast.z - at.z);
      lab.shoot(
        "behind the gun",
        lab.look(off(r, at, toward + Math.PI - 0.35, 14, 4), blast, 50),
        n,
        r,
      );
      lab.shoot(
        "the burst",
        lab.look(off(r, blast, toward + 1.6, 30, 6), blast, 50),
        n,
        r,
      );
      const mid = at.clone().lerp(blast, 0.5);
      lab.shoot("wide", lab.look(off(r, mid, toward + 1.4, 120, 45), mid, 50), n, r);
    });

  return { "vehicle-stand": stand, "vehicle-wave": wave, "vehicle-fire": fire };
}

/** The sheet's views, as the harness lists them. */
export const VEHICLE_VIEWS = ["vehicle-stand", "vehicle-wave", "vehicle-fire"] as const;
