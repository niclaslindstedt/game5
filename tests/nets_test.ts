// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// INTO THE A-NETS (R32, `nets.ts`): a racer driven into a downhill's nets
// goes down into them (`crash.ts`'s `net` cause) and the mesh takes him —
// billowed back no further than its give, dropped to its foot and kept in
// its pocket — and his skis go in with him, hooked in the mesh more often
// than not, a hooked end held where it caught. A brush he skis out.
import { describe, expect, it } from "vitest";

import {
  DISCIPLINE_RULES,
  DOWNHILL_NETS,
  NEUTRAL_INPUT,
  TUNING,
  createGame,
  netPocket,
  placeRun,
  step,
  trackPointAt,
  type GameEvent,
  type GameState,
} from "@engine";
import { bulgeAt, netDents } from "../pwa/src/game/net-bulge.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const BASE = syntheticLevel();
const GIVE = DISCIPLINE_RULES.downhill.nets.give;

/** A racer `inside` m inside the right-hand net at `share` of the way down
 * the course, skiing at `speed` m/s `angle` rad off the piste toward it. */
function stage(speed: number, angle: number, share = 0.5, inside = 0.5): GameState {
  const state = createGame({ level: BASE, seed: 3, mode: "downhill", rivals: 0, quiet: true });
  const dh = state.level.downhill!;
  const s = dh.from + (dh.to - dh.from) * share;
  const p = trackPointAt(state.level, s);
  const net = p.width / 2 + dh.nets.gap;
  const rx = Math.cos(p.heading);
  const rz = -Math.sin(p.heading);
  placeRun(state, {
    x: p.x + rx * (net - inside),
    z: p.z + rz * (net - inside),
    heading: p.heading + angle,
    speed,
    time: 30,
    nextCheckpoint: state.level.checkpoints.findIndex((c) => c.s > s),
  });
  return state;
}

/** Ski `state` on for `seconds`, calling `each` after every step. */
function ride(state: GameState, seconds: number, each?: () => void): GameEvent[] {
  const seen: GameEvent[] = [];
  for (let i = 0; i < seconds / TUNING.dt; i++) {
    step(state, NEUTRAL_INPUT);
    seen.push(...state.events);
    each?.();
  }
  return seen;
}

/** How far past the net's line the furthest of `pts` (x y z each) stands. */
function deepest(state: GameState, pts: readonly number[]): number {
  let most = 0;
  for (let j = 0; j < pts.length; j += 3) {
    most = Math.max(most, netPocket(state.level, pts[j], pts[j + 2])?.past ?? 0);
  }
  return most;
}

describe("into the A-nets", () => {
  it("throws a racer driven into them, and the mesh takes him: no further than its give", () => {
    const state = stage(30, 0.4);
    let most = 0;
    const seen = ride(state, 1.5, () => {
      const b = state.skier.thrown;
      if (b) most = Math.max(most, deepest(state, b.points));
    });
    expect(seen.find((e) => e.kind === "wipeout")).toMatchObject({ cause: "net" });
    expect(state.progress.out).toMatchObject({ status: "dnf", why: "net" });
    // It billowed: the body went into the mesh, and never through it.
    expect(most).toBeGreaterThan(0.2);
    expect(most).toBeLessThanOrEqual(GIVE + 1e-6);
  });

  it("drops him to its foot and keeps him in its pocket", () => {
    const state = stage(25, 1.2);
    ride(state, 3);
    const b = state.skier.thrown!;
    expect(b.cause).toBe("net");
    // Lying at the foot of the net, still...
    expect(b.y - state.level.groundAt(b.x, b.z)).toBeLessThan(0.5);
    expect(b.still).toBeGreaterThan(0.5);
    // ...and in it: the net sagged back to its pocket, not to its line.
    expect(b.netted).not.toBe(0);
    const pocket = netPocket(state.level, b.x, b.z)?.past ?? 0;
    expect(pocket).toBeGreaterThan(DOWNHILL_NETS.pocket * 0.5);
  });

  it("is not carried far along it", () => {
    const state = stage(30, 0.3);
    const x0 = state.skier.x;
    const z0 = state.skier.z;
    ride(state, 3);
    const b = state.skier.thrown!;
    expect(Math.hypot(b.x - x0, b.z - z0)).toBeLessThan(30);
  });

  it("lets a brush be skied out", () => {
    const state = stage(20, 0.06, 0.5, 0.2);
    const seen = ride(state, 1);
    expect(seen.some((e) => e.kind === "net")).toBe(true);
    expect(seen.some((e) => e.kind === "wipeout")).toBe(false);
    expect(state.skier.thrown).toBeNull();
  });

  it("hooks the skis in the mesh more often than not, and a hooked end stays put", () => {
    let skis = 0;
    let hooked = 0;
    for (const share of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      for (const [speed, angle] of [
        [25, 1.2],
        [30, 0.4],
        [20, 0.25],
      ]) {
        const state = stage(speed, angle, share);
        const at = new Map<object, number[]>();
        ride(state, 2.5, () => {
          for (const ski of state.skier.thrown?.skis ?? []) {
            if (!ski.hooked) continue;
            const end = ski.hooked & 1 ? 0 : 3;
            const now = ski.ends.slice(end, end + 3);
            const was = at.get(ski);
            if (was) for (let a = 0; a < 3; a++) expect(now[a]).toBe(was[a]);
            else at.set(ski, now);
            // Hooked by ONE end: the ski hangs off it.
            expect(ski.hooked === 1 || ski.hooked === 2).toBe(true);
          }
        });
        for (const ski of state.skier.thrown?.skis ?? []) {
          skis += 1;
          if (ski.hooked) hooked += 1;
        }
      }
    }
    expect(skis).toBe(30);
    expect(hooked / skis).toBeGreaterThan(0.5);
  });

  it("replays crash for crash: the hooks are drawn off a hash, never the run's stream", () => {
    const a = stage(30, 0.4);
    const b = stage(30, 0.4);
    ride(a, 2);
    ride(b, 2);
    expect(b.skier.thrown!.points).toEqual(a.skier.thrown!.points);
    expect(b.skier.thrown!.skis.map((s) => s.hooked)).toEqual(
      a.skier.thrown!.skis.map((s) => s.hooked),
    );
  });
});

describe("the A-net as drawn round what it caught", () => {
  it("bulges where the body is in it, held flat at its cable and far along it", () => {
    const state = stage(25, 1.2);
    ride(state, 2);
    const dents = netDents(state, []);
    expect(dents.length).toBeGreaterThan(0);
    const d = dents.reduce((a, b) => (b.past > a.past ? b : a));
    const lx = d.x - d.ux * d.past;
    const lz = d.z - d.uz * d.past;
    const ground = state.level.groundAt(lx, lz);
    const height = state.level.downhill!.nets.height;
    const out = { by: 0, ux: 0, uz: 0 };
    // At the body the sheet stands out past him...
    bulgeAt(lx, d.y, lz, d.y - ground, height, dents, out);
    expect(out.by).toBeGreaterThan(d.past);
    // ...the cable holds its top, and well along it the net hangs flat.
    expect(bulgeAt(lx, ground + height, lz, height, height, dents, out).by).toBe(0);
    const along = { x: d.uz, z: -d.ux };
    const fx = lx + along.x * 8;
    const fz = lz + along.z * 8;
    const fy = state.level.groundAt(fx, fz) + 0.3;
    expect(bulgeAt(fx, fy, fz, 0.3, height, dents, out).by).toBe(0);
  });

  it("is flat while nobody is down", () => {
    expect(netDents(stage(20, 0), [])).toEqual([]);
  });
});
