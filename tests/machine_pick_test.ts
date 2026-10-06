// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MACHINE TAPPED ON SCREEN (`pwa/src/game/machine-pick.ts`): a tap's
// ray takes the skier onto the snowmobile or the helicopter only when it
// lands on one he can get on now — and he can get on rolling up to it, not
// only stopped dead beside it.

import { describe, expect, it } from "vitest";
import {
  HELI,
  NEUTRAL_INPUT,
  SLED,
  createGame,
  heliWithin,
  sledWithin,
  standSkier,
  step,
  type GameState,
} from "@engine";

import { machineHit, rayHitsBall, type PickRay } from "../pwa/src/game/machine-pick.ts";
import { levelFor } from "./support/levels.ts";

const level = levelFor(1);

/** A ray from 12 m up and back of (x, y, z), aimed at it. */
function rayAt(x: number, y: number, z: number): PickRay {
  const o = { x: x - 8, y: y + 12, z: z - 8 };
  const d = { x: x - o.x, y: y - o.y, z: z - o.z };
  const n = Math.hypot(d.x, d.y, d.z);
  return { o, d: { x: d.x / n, y: d.y / n, z: d.z / n } };
}

function free(): GameState {
  return createGame({ level, mode: "free", crowd: 0, quiet: true });
}

describe("the machine tapped on screen (machine-pick.ts)", () => {
  it("hits a ball in front of the ray and misses one beside or behind it", () => {
    const ray: PickRay = { o: { x: 0, y: 0, z: 0 }, d: { x: 0, y: 0, z: 1 } };
    expect(rayHitsBall(ray, { x: 0.5, y: 0, z: 10 }, 1)).toBe(true);
    expect(rayHitsBall(ray, { x: 3, y: 0, z: 10 }, 1)).toBe(false);
    expect(rayHitsBall(ray, { x: 0, y: 0, z: -10 }, 1)).toBe(false);
  });

  it("takes a tap on the snowmobile only when he can get on it", () => {
    const s = free();
    const k = s.sled!;
    const ray = rayAt(k.x, k.y + 0.6, k.z);
    // Far off, the tap on it is nothing.
    standSkier(s, k.x + 40, k.z, k.heading);
    expect(machineHit(s, ray)).toBe(null);
    // Rolling up beside it, it is the snowmobile.
    standSkier(s, k.x + SLED.board.reach - 1, k.z, k.heading);
    s.skier.vz = 8;
    expect(sledWithin(s)).toBe(true);
    expect(machineHit(s, ray)).toBe("sled");
    // ...and a tap on the snow a few metres off it is not.
    expect(machineHit(s, rayAt(k.x + 10, k.y, k.z + 10))).toBe(null);
  });

  it("takes a tap on the helicopter only when he can get on it", () => {
    const s = free();
    const h = s.heli!;
    const ray = rayAt(h.x, h.y + 1.6, h.z);
    // The tip of its rotor disc, well clear of the body, is not it.
    const beside = rayAt(h.x + 9, h.y + 1.6, h.z + 9);
    standSkier(s, h.x + 80, h.z, 0);
    expect(machineHit(s, ray)).toBe(null);
    for (let a = 0; a < 16 && !heliWithin(s); a++) {
      const r = HELI.board.reach - 1;
      standSkier(
        s,
        h.x + r * Math.sin((a * Math.PI) / 8),
        h.z + r * Math.cos((a * Math.PI) / 8),
        0,
      );
    }
    expect(heliWithin(s)).toBe(true);
    expect(machineHit(s, ray)).toBe("heli");
    expect(machineHit(s, beside)).toBe(null);
  });

  it("boards a skier still rolling at a cruise, not only one stopped dead", () => {
    const s = free();
    const k = s.sled!;
    standSkier(s, k.x + 2, k.z, k.heading);
    s.skier.vz = 8; // about 29 km/h
    step(s, { ...NEUTRAL_INPUT, machine: true });
    expect(s.sled!.rider).toBe(true);
  });
});
