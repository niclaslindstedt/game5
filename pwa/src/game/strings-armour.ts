// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE ARMY'S MACHINES TAKEN (`armour.ts`, `army-steal.ts`) — a
// block of the one strings table (`strings.ts`), stated next door and
// spread into `STRINGS` under the same names, as the piste machine's are:
// the news a theft earns, and the HUD — the vehicle driven, its gun, the
// way out, and the press that takes one.

import type { ArmyVehicleKind, StealKind, StealLivery } from "@engine";

/** Each vehicle's name, on the press and on the readout. */
const NAMES: Record<ArmyVehicleKind, string> = {
  carrier: "TRACKED CARRIER",
  truck: "ARMY TRUCK",
  tank: "TANK",
};

export const ARMOUR_STRINGS = {
  /* ── THE NEWS (run-news.ts) ────────────────────────────────────────── */
  /** A machine taken from its owners (`steal.ts`): which, and whose. */
  newsSteal: (vehicle: StealKind, livery: StealLivery): string => {
    if (vehicle === "carrier") return "STOLE AN ARMY CARRIER!";
    if (vehicle === "truck") return "STOLE AN ARMY TRUCK!";
    if (vehicle === "tank") return "STOLE A TANK!";
    if (vehicle === "heli")
      return livery === "police"
        ? "STOLE THE POLICE HELICOPTER!"
        : livery === "army"
          ? "STOLE AN ARMY HELICOPTER!"
          : "STOLE THE AIR AMBULANCE!";
    return livery === "army" ? "STOLE AN ARMY SNOWMOBILE!" : "STOLE THE SKI PATROL'S SNOWMOBILE!";
  },
  newsArmourHop: "OUT AND ON YOUR SKIS",
  newsArmourDead: "KNOCKED OUT!",

  /* ── THE HUD (hud-armour.tsx) ──────────────────────────────────────── */
  armourName: (kind: ArmyVehicleKind): string => NAMES[kind],
  armourSteal: (touch: boolean, key: string): string =>
    touch ? "TAP TO STEAL" : `${key} OR CLICK TO STEAL`,
  armourBoard: (touch: boolean, key: string): string =>
    touch ? "TAP TO DRIVE" : `${key} OR CLICK TO DRIVE`,
  armourSpeed: (kmh: number): string => `${Math.round(Math.abs(kmh))} KM/H`,
  armourReverse: "REVERSE",
  armourDrive: "DRIVE",
  armourDead: "KNOCKED OUT",
  /** The tank's turret off the hull's nose, deg (right positive), and the
   * gun's state — and how to fire it. */
  armourTurret: (deg: number): string =>
    deg === 0 ? "TURRET AHEAD" : `TURRET ${Math.abs(deg)}° ${deg > 0 ? "RIGHT" : "LEFT"}`,
  armourLoaded: (touch: boolean, key: string): string =>
    touch ? "LOADED · TAP JUMP TO FIRE" : `LOADED · ${key} TO FIRE`,
  armourLoading: "LOADING",
  armourOff: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO GET OUT" : `${key} TO GET OUT`,
};
