// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MACHINES' OWN KEYS (`pwa/src/game/settings-ride-keys.ts`): each
// machine ships on the skier's keys, rebinds on its own, survives a stored
// blob, and is read in place of the skier's six controls while he rides it.
import { describe, expect, it } from "vitest";

import type { GameState } from "@engine";

import { NO_KEYS } from "../pwa/src/game/input-model.ts";
import { DEFAULT_KEYS } from "../pwa/src/game/settings-input.ts";
import {
  RIDE_MACHINES,
  RIDE_TABLES,
  bindRideKey,
  freshRideKeys,
  mergeRideKeys,
  rideClashesWith,
  rideHeld,
  rideOf,
} from "../pwa/src/game/settings-ride-keys.ts";

describe("the machines' own keys", () => {
  it("ship every row on the skier's own keys for that control", () => {
    const keys = freshRideKeys();
    for (const m of RIDE_MACHINES) {
      expect(RIDE_TABLES[m].rows.length).toBeGreaterThan(0);
      for (const row of RIDE_TABLES[m].rows) {
        expect(keys[m][row.id]).toEqual(DEFAULT_KEYS[row.id]);
        expect(row.label.length).toBeGreaterThan(0);
      }
      expect(rideClashesWith(keys, m, "tuck")).toEqual([]);
    }
  });

  it("rebinds one machine's row without touching another's", () => {
    const keys = bindRideKey(freshRideKeys(), "balloon", "tuck", "KeyB");
    expect(keys.balloon.tuck).toEqual(["KeyB"]);
    expect(keys.sled.tuck).toEqual(DEFAULT_KEYS.tuck);
    const clash = bindRideKey(keys, "balloon", "brake", "KeyB");
    expect(rideClashesWith(clash, "balloon", "brake")).toEqual(["tuck"]);
  });

  it("merges a stored blob row by row", () => {
    const merged = mergeRideKeys({ sled: { tuck: ["KeyI", 3], hover: ["KeyH"] }, boat: {} });
    expect(merged.sled.tuck).toEqual(["KeyI"]);
    expect(merged.sled.brake).toEqual(DEFAULT_KEYS.brake);
    expect("boat" in merged).toBe(false);
    expect(mergeRideKeys(null)).toEqual(freshRideKeys());
    // The piste machine has no lean rows to keep.
    expect(merged.groomer.leanBack).toBeUndefined();
  });

  it("puts a machine's controls in place of the skier's while he rides it", () => {
    const skier = { ...NO_KEYS, tuck: true, jump: true };
    expect(rideHeld(skier, null, {} as never)).toBe(skier);
    const held = rideHeld(skier, "balloon", {
      sled: {},
      groomer: {},
      para: {},
      chute: {},
      balloon: { brake: true },
    });
    expect(held.tuck).toBe(false);
    expect(held.brake).toBe(true);
    // The jump stays the skier's.
    expect(held.jump).toBe(true);
  });

  it("finds the machine he rides", () => {
    const at = (s: Partial<GameState>) => rideOf(s as GameState);
    expect(at({})).toBeNull();
    expect(at({ balloon: { aboard: true } } as never)).toBe("balloon");
    expect(at({ sled: { mode: "ridden" } } as never)).toBe("sled");
    expect(at({ groomers: [{ rider: false }, { rider: true }] } as never)).toBe("groomer");
    expect(at({ para: { mode: "flown" } } as never)).toBe("para");
    expect(at({ para: { mode: "dropped" } } as never)).toBeNull();
    expect(at({ chute: { mode: "freefall" } } as never)).toBe("chute");
    expect(at({ chute: { mode: "landed" } } as never)).toBeNull();
    expect(at({ heli: { rider: true }, sled: { mode: "ridden" } } as never)).toBeNull();
  });
});
