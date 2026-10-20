// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE A PERSON STRUCK BLEEDS FROM (`pwa/src/game/crowd-wound.ts`): the
// wound is on his body's struck side, never in the air between the two,
// and goes with his body as it is thrown, turned over and slid away.

import { describe, expect, it } from "vitest";
import { RAGDOLL } from "@engine";

import { DEPTH, woundAt, woundFacing, woundOf } from "../pwa/src/game/crowd-wound.ts";

type P = [number, number, number];

/** A man stood upright at the origin, his shoulders across x. */
function standing(): number[] {
  const at: Partial<Record<keyof typeof RAGDOLL, P>> = {
    hipL: [-0.1, 1, 0],
    hipR: [0.1, 1, 0],
    shoulderL: [-0.2, 1.5, 0],
    shoulderR: [0.2, 1.5, 0],
    head: [0, 1.75, 0],
    kneeL: [-0.1, 0.5, 0],
    kneeR: [0.1, 0.5, 0],
    footL: [-0.1, 0.05, 0],
    footR: [0.1, 0.05, 0],
    elbowL: [-0.3, 1.2, 0],
    elbowR: [0.3, 1.2, 0],
    handL: [-0.3, 0.95, 0],
    handR: [0.3, 0.95, 0],
  };
  const p = new Array<number>(3 * RAGDOLL.count).fill(0);
  for (const [k, v] of Object.entries(at))
    p.splice(3 * RAGDOLL[k as keyof typeof RAGDOLL], 3, ...v!);
  return p;
}

/** The body turned `a` rad about z through his hips and moved by `d`. */
function thrown(p: readonly number[], a: number, d: P): number[] {
  const out = [...p];
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i];
    const y = p[i + 1] - 1;
    out[i] = x * Math.cos(a) - y * Math.sin(a) + d[0];
    out[i + 1] = x * Math.sin(a) + y * Math.cos(a) + 1 + d[1];
    out[i + 2] = p[i + 2] + d[2];
  }
  return out;
}

describe("the wound a person struck bleeds from", () => {
  const p = standing();
  // The struck spot between the two middles, the player in front of him.
  const hit = { x: 0, y: 1.25, z: 0.24 };
  const w = woundOf(p, hit)!;
  const at = { x: 0, y: 0, z: 0 };

  it("lies on his trunk's struck side at the blow, not in the air between them", () => {
    expect(w).not.toBeNull();
    expect(woundAt(p, w, at)).toBe(true);
    // On the front of his trunk facing the player, at the blow's height.
    expect(at.x).toBeCloseTo(0, 6);
    expect(at.y).toBeCloseTo(1.25, 6);
    expect(at.z).toBeCloseTo(DEPTH, 6);
    // ...nearer his body's middle line than the spot between the two is.
    expect(Math.hypot(at.x, at.z)).toBeLessThan(Math.hypot(hit.x, hit.z));
    const f = { x: 0, y: 0, z: 0 };
    expect(woundFacing(p, w, f)).toBe(true);
    expect(f.z).toBeCloseTo(1, 6);
  });

  it("is kept to his chest and belly, whatever height the blow is filed at", () => {
    const low = woundOf(p, { x: 0, y: 0.2, z: 0.3 })!;
    const high = woundOf(p, { x: 0, y: 2.4, z: 0.3 })!;
    expect(low.up).toBeGreaterThan(0.2);
    expect(high.up).toBeLessThan(0.9);
  });

  it("goes with his body as it is thrown, turned over and slid away", () => {
    const later = thrown(p, Math.PI / 2, [4, -0.6, 3]);
    expect(woundAt(later, w, at)).toBe(true);
    // The front of his chest, turned over with him: (0, 0.25, DEPTH) off
    // his hips becomes (−0.25, 0, DEPTH), and the hips moved by (4, −0.6, 3).
    expect(at.x).toBeCloseTo(4 - 0.25, 6);
    expect(at.y).toBeCloseTo(1 - 0.6, 6);
    expect(at.z).toBeCloseTo(3 + DEPTH, 6);
  });

  it("is not read off a body with no trunk", () => {
    const flat = new Array<number>(3 * RAGDOLL.count).fill(0);
    expect(woundOf(flat, hit)).toBeNull();
    expect(woundAt(flat, w, at)).toBe(false);
  });
});
