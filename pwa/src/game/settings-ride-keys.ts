// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MACHINES' OWN KEYS — a table for each thing the skier rides that is
// worked through his own controls (`SkierInput`'s tuck, brake, edge and
// lean): the snowmobile, the piste machine, the paramotor, the skydive and
// the balloon. The engine reads each of them off those same four controls
// (`sledControls`, `paraControls`, `chuteControls`, …), so a table here is a
// RENAMING and a REBINDING of them, never new controls: its rows say what
// each one does on that machine (the THROTTLE, the BURNER, the TOGGLES) and
// the input manager reads the machine's table in place of the skier's while
// he rides it (`input.ts`). The other snow games keep a table per
// discipline for the same reason: a key that means "burn" in the basket is
// a thing a player wants to find and move under that word.
//
// THE KEYBOARD AS IT SHIPS is the skier's own, row for row (W, S, A / ←,
// D / →, the lean keys), so nothing a player already knows moves. The jump,
// the grab, the machine key and every press about the run stay the skier's.
// Never Ctrl, which beside W closes the tab.

import type { GameState } from "@engine";

import type { KeysHeld } from "./input-model.ts";
import { DEFAULT_KEYS, KEYS_PER_ACTION } from "./settings-input.ts";
import { STRINGS } from "./strings.ts";

/** The machines with a table of their own here. The helicopter and the
 * plane fly on controls of their own (`settings-heli-keys.ts`,
 * `settings-plane-keys.ts`). */
export type RideMachine = "sled" | "groomer" | "para" | "chute" | "balloon";

/** The skier's controls a machine's table may rebind. */
export type RideAction = "tuck" | "brake" | "left" | "right" | "leanForward" | "leanBack";

export type RideBindings = Record<RideMachine, Partial<Record<RideAction, readonly string[]>>>;

/** Each machine's section of OPTIONS ▸ KEYS: its heading, and its rows in
 * order — only the controls it reads. */
export const RIDE_TABLES: Record<
  RideMachine,
  { title: string; rows: readonly { id: RideAction; label: string }[] }
> = {
  sled: {
    title: STRINGS.keysSledTitle,
    rows: [
      { id: "tuck", label: STRINGS.rideThrottle },
      { id: "brake", label: STRINGS.rideBrake },
      { id: "left", label: STRINGS.rideSteerLeft },
      { id: "right", label: STRINGS.rideSteerRight },
      { id: "leanForward", label: STRINGS.rideWeightForward },
      { id: "leanBack", label: STRINGS.rideWeightBack },
    ],
  },
  groomer: {
    title: STRINGS.keysGroomerTitle,
    rows: [
      { id: "tuck", label: STRINGS.rideForward },
      { id: "brake", label: STRINGS.rideReverse },
      { id: "left", label: STRINGS.ridePivotLeft },
      { id: "right", label: STRINGS.ridePivotRight },
    ],
  },
  para: {
    title: STRINGS.keysParaTitle,
    rows: [
      { id: "tuck", label: STRINGS.rideThrottle },
      { id: "brake", label: STRINGS.rideFlare },
      { id: "left", label: STRINGS.rideToggleLeft },
      { id: "right", label: STRINGS.rideToggleRight },
      { id: "leanForward", label: STRINGS.rideRisersForward },
      { id: "leanBack", label: STRINGS.rideRisersBack },
    ],
  },
  chute: {
    title: STRINGS.keysChuteTitle,
    rows: [
      { id: "tuck", label: STRINGS.rideHeadDown },
      { id: "brake", label: STRINGS.rideFlare },
      { id: "left", label: STRINGS.rideTurnLeft },
      { id: "right", label: STRINGS.rideTurnRight },
      { id: "leanForward", label: STRINGS.rideTrack },
      { id: "leanBack", label: STRINGS.rideBackSlide },
    ],
  },
  balloon: {
    title: STRINGS.keysBalloonTitle,
    rows: [
      { id: "tuck", label: STRINGS.rideBurner },
      { id: "brake", label: STRINGS.rideVent },
      { id: "left", label: STRINGS.rideWalkLeft },
      { id: "right", label: STRINGS.rideWalkRight },
      { id: "leanForward", label: STRINGS.rideWalkForward },
      { id: "leanBack", label: STRINGS.rideWalkBack },
    ],
  },
};

export const RIDE_MACHINES = Object.keys(RIDE_TABLES) as RideMachine[];

/** The shipped tables: each row the skier's own keys for the control. */
export function freshRideKeys(): RideBindings {
  const out = {} as RideBindings;
  for (const m of RIDE_MACHINES) {
    const table: Partial<Record<RideAction, string[]>> = {};
    for (const row of RIDE_TABLES[m].rows) table[row.id] = [...DEFAULT_KEYS[row.id]];
    out[m] = table;
  }
  return out;
}

export const DEFAULT_RIDE_KEYS: RideBindings = freshRideKeys();

/** A stored blob's tables, row by row: a row it lacks or garbles is the
 * shipped one; a machine or a row this build dropped is dropped. */
export function mergeRideKeys(parsed: unknown): RideBindings {
  const keys = freshRideKeys();
  if (!parsed || typeof parsed !== "object") return keys;
  const blob = parsed as Partial<Record<RideMachine, unknown>>;
  for (const m of RIDE_MACHINES) {
    const table = blob[m];
    if (!table || typeof table !== "object") continue;
    for (const row of RIDE_TABLES[m].rows) {
      const codes = (table as Partial<Record<RideAction, unknown>>)[row.id];
      if (!Array.isArray(codes)) continue;
      const clean = codes.filter((c): c is string => typeof c === "string" && c.length > 0);
      if (clean.length > 0) keys[m][row.id] = [...new Set(clean)].slice(0, KEYS_PER_ACTION);
    }
  }
  return keys;
}

/** One machine's row rebound to one key — the list replaced, as the
 * skier's is. */
export function bindRideKey(
  keys: RideBindings,
  machine: RideMachine,
  action: RideAction,
  code: string,
): RideBindings {
  return { ...keys, [machine]: { ...keys[machine], [action]: [code] } };
}

/** The OTHER rows of the same machine a code of this one's is on. */
export function rideClashesWith(
  keys: RideBindings,
  machine: RideMachine,
  action: RideAction,
): RideAction[] {
  const table = keys[machine];
  const mine = new Set(table[action] ?? []);
  if (mine.size === 0) return [];
  return RIDE_TABLES[machine].rows
    .map((row) => row.id)
    .filter((other) => other !== action && (table[other] ?? []).some((c) => mine.has(c)));
}

/** WHICH TABLE THE PLAYER'S HANDS ARE ON: the machine he rides now, or
 * null on his skis (and on the helicopter and the plane, which fly on
 * tables of their own). */
export function rideOf(state: GameState): RideMachine | null {
  if (state.heli?.rider || state.plane?.rider) return null;
  if (state.balloon?.aboard) return "balloon";
  if (state.sled?.mode === "ridden") return "sled";
  if (state.groomers?.some((g) => g.rider)) return "groomer";
  if (state.para?.mode === "ready" || state.para?.mode === "flown") return "para";
  const ch = state.chute;
  if (ch && ch.mode !== "landed" && ch.mode !== "released") return "chute";
  return null;
}

/** The skier's held keys with a machine's six rows put in place of his:
 * the machine's table says which of those controls are down, and a control
 * the machine has no row for is up. */
export function rideHeld(
  held: KeysHeld,
  machine: RideMachine | null,
  rideKeys: Record<RideMachine, Partial<Record<RideAction, boolean>>>,
): KeysHeld {
  if (!machine) return held;
  const on = rideKeys[machine];
  return {
    ...held,
    tuck: on.tuck === true,
    brake: on.brake === true,
    left: on.left === true,
    right: on.right === true,
    leanForward: on.leanForward === true,
    leanBack: on.leanBack === true,
  };
}
