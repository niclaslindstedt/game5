// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INSIDES OF THE ARMY'S VEHICLES HE TAKES (`armour.ts`), held together:
// the carrier's cab (`carrier-cab.ts`), the truck's (`truck-cab.ts`), the
// tank's driver's station (`tank-driver.ts`) and its gunner's with his
// sight (`tank-gunner.ts`) — each built once, at load, on a ride that
// carries the army (`machines.ts`), parked in this group until he drives
// one, then hung in his vehicle as drawn (`army-vehicle-view.ts`' `Ridden`)
// and shown while the lens is in it:
//
//   * HELMET in the carrier or the truck: the driver's cab, the cab's
//     shell from outside put away;
//   * HELMET in the tank: the driver's station hatch down, the hull put
//     away; TIPS the gunner's station, the hull and the turret put away —
//     and THROUGH THE SIGHT, from either, while he lays the gun
//     (`tankStation`): the turret and the hull back, the reticle over the
//     lens. The tank's lenses turn with the turret, so they are handed to
//     the renderer as a lens of their own (`lens`), as the helicopter's and
//     the jump plane's are.
//
// Nothing here adds or removes a light; every lamp is emissive. Presentation
// only: it reads the state and writes nothing.

import * as THREE from "three";
import { ARMOUR, gunReady, sightPoint, type GameState } from "@engine";

import type { Ridden } from "./army-vehicle-view.ts";
import type { LensPose, Rung } from "./camera-rigs.ts";
import { drivenArmour } from "./camera-armour.ts";
import { createCarrierCab, type CarrierCab } from "./carrier-cab.ts";
import type { HazeUniforms } from "./haze.ts";
import { createTankDriver } from "./tank-driver.ts";
import { createTankGunner } from "./tank-gunner.ts";
import {
  createSightMemory,
  gunnerLens,
  sightLens,
  tankStation,
  type TankStation,
} from "./tank-station-plan.ts";
import { createTruckCab } from "./truck-cab.ts";

export type ArmourCabs = {
  group: THREE.Group;
  /** One frame: `ridden` his vehicle as drawn this frame (or null), `rung`
   * the lens's rung. Hangs and shows the inside the lens is in, and puts
   * the shells it is inside away. */
  frame(s: GameState, ridden: Ridden | null, rung: Rung, dt: number): void;
  /** The tank's station's lens this frame — the gunner's eye or the
   * sight's — or null. */
  lens(): LensPose | null;
  /** Which of the tank's stations the lens is in this frame. */
  station(): TankStation;
  dispose(): void;
};

export function createArmourCabs(haze: HazeUniforms): ArmourCabs {
  const group = new THREE.Group();
  group.name = "armour_cabs";
  const carrier = createCarrierCab(haze);
  const truck = createTruckCab(haze);
  const driver = createTankDriver(haze);
  const gunner = createTankGunner(haze);
  for (const c of [carrier.group, truck.group, driver.group, gunner.group]) group.add(c);
  const memory = createSightMemory();
  let station: TankStation = null;
  let lens: LensPose | null = null;

  /** Hang `o` under `parent` (or back in the group). */
  const hang = (o: THREE.Object3D, parent: THREE.Object3D | null): void => {
    const p = parent ?? group;
    if (o.parent !== p) p.add(o);
  };
  /** A driver's cab: hung in his vehicle of `kind` and shown from HELMET. */
  const cab = (
    c: CarrierCab,
    kind: "carrier" | "truck",
    s: GameState,
    ridden: Ridden | null,
    rung: Rung,
    dt: number,
  ): void => {
    const his = drivenArmour(s)?.kind === kind && ridden !== null;
    hang(c.group, his ? ridden.root : null);
    const shown = his && rung === "helmet";
    if (s.armour && (his || c.group.visible)) c.update(s.armour, s.t, dt, shown, shown);
    else c.group.visible = false;
    if (shown && ridden.glass) ridden.glass.visible = false;
  };

  return {
    group,
    frame(s, ridden, rung, dt) {
      cab(carrier, "carrier", s, ridden, rung, dt);
      cab(truck, "truck", s, ridden, rung, dt);
      const r = s.armour;
      const v = drivenArmour(s);
      const tank = v?.kind === "tank" && ridden !== null && !!r;
      station = tankStation(memory, rung, tank ? r : null, s.t, dt);
      hang(driver.group, tank ? ridden.root : null);
      hang(gunner.group, tank && ridden.turret ? ridden.turret : null);
      lens = null;
      if (!r || !tank) {
        driver.group.visible = false;
        gunner.update(null, null, dt, () => null, false);
        return;
      }
      driver.update(r, s.t, dt, station === "driver", station === "driver");
      const b = r.body;
      const gun = s.gunfire?.guns.find((g) => g.id === ARMOUR.tank.gun);
      const range = (): number | null => {
        const p = sightPoint(s, b);
        return Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z);
      };
      gunner.update(r, station, dt, range, !r.dead && (!gun || gunReady(gun)));
      // Inside the hull or the turret, their shells from outside put away.
      if ((station === "driver" || station === "gunner") && ridden.hull)
        ridden.hull.visible = false;
      if (station === "gunner") {
        if (ridden.shell) ridden.shell.visible = false;
        if (ridden.barrel) ridden.barrel.visible = false;
        lens = gunnerLens(ridden, b.turret);
      } else if (station === "sight") lens = sightLens(ridden, b.turret, b.gun);
    },
    lens: () => lens,
    station: () => station,
    dispose() {
      carrier.dispose();
      truck.dispose();
      driver.dispose();
      gunner.dispose();
    },
  };
}
