// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND TUNNELS' BUILDINGS (`tunnel-build.ts`, `docs/buildings.md`): the
// footings, the snow on the crowns, the portals and the fan houses, built
// on the facade kit over two lanes laid by hand on the synthetic slope's
// run-out as the generator lays them — every attribute filled, standing on
// the lanes they are built for, down into the snow, and low-poly.

import { describe, expect, it } from "vitest";

import type { Level } from "@engine";
import type { FacadeArrays } from "../pwa/src/game/facade-kit.ts";
import { FACADE, FACADE_LAYERS } from "../pwa/src/game/facade-paint.ts";
import { FAN_HOUSE, buildTunnels, fanOf } from "../pwa/src/game/tunnel-build.ts";
import {
  archRadius,
  tunnelNear,
  tunnelPointAt,
  tunnelsOf,
  type WindTunnel,
} from "../pwa/src/game/wind-tunnel-plan.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** A straight lane along x at `z` from `from` to `to`, a station every 4 m
 * on the snow. */
function lane(level: Level, id: string, z: number, from: number, to: number): WindTunnel {
  const way = Math.sign(to - from);
  const points: WindTunnel["points"] = [];
  for (let s = 0; s <= Math.abs(to - from); s += 4) {
    const x = from + way * s;
    points.push({ x, z, y: level.groundAt(x, z), s, heading: (way * Math.PI) / 2 });
  }
  return { id, points, length: points[points.length - 1].s, width: 9, speed: 28 };
}

function withTunnels(): Level {
  const level = syntheticLevel();
  const tunnels = [lane(level, "W1", 1060, 200, 500), lane(level, "W2", 1090, 500, 200)];
  (level as { resort?: unknown }).resort = { runs: [], lifts: [], courses: [], tunnels };
  return level;
}

function filled(a: FacadeArrays): void {
  const n = a.pos.length / 3;
  expect(n).toBeGreaterThan(0);
  expect(a.nrm.length).toBe(n * 3);
  expect(a.col.length).toBe(n * 3);
  expect(a.uv.length).toBe(n * 2);
  expect(a.layer.length).toBe(n);
  expect(a.glow.length).toBe(n);
  expect(a.layer.every((l) => Number.isInteger(l) && l >= 0 && l < FACADE_LAYERS)).toBe(true);
  expect(a.pos.every(Number.isFinite)).toBe(true);
  expect(a.uv.every(Number.isFinite)).toBe(true);
}

describe("the wind tunnels' buildings", () => {
  const level = withTunnels();
  const tunnels = tunnelsOf(level);
  const kit = buildTunnels(level, tunnels);
  const { pos, nrm, layer } = kit.out;

  it("is built whole in the materials of a gallery", () => {
    filled(kit.out);
    for (const l of [FACADE.concrete, FACADE.steel, FACADE.panel, FACADE.snow, FACADE.louvre])
      expect(layer).toContain(l);
  });

  it("stays low-poly: a few hundred triangles a tunnel's ends, a few thousand a kilometre", () => {
    const km = tunnels.reduce((sum, t) => sum + t.length, 0) / 1000;
    expect(kit.triangles).toBeLessThan(tunnels.length * 900 + km * 2600);
    // And every face is lit by a unit normal.
    for (let i = 0; i < nrm.length; i += 3)
      expect(Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2])).toBeCloseTo(1, 4);
  });

  it("stands on its lanes: nothing built far from a tunnel or its fan", () => {
    const fans = tunnels.map((t) => fanOf(level, t));
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const z = pos[i + 2];
      const lane = tunnelNear(level, x, z, 12);
      const fan = fans.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 6);
      expect(lane !== null || fan, `vertex at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(true);
    }
  });

  it("puts its footings down into the snow under the arches' feet", () => {
    for (const t of tunnels) {
      const r = archRadius(t);
      const p = tunnelPointAt(t, t.length / 2);
      // The footings' feet: concrete under the snow, beside the lane at
      // the arch's radius.
      let low = Infinity;
      let high = -Infinity;
      for (let i = 0; i < pos.length / 3; i++) {
        if (layer[i] !== FACADE.concrete) continue;
        const x = pos[i * 3];
        const z = pos[i * 3 + 2];
        if (Math.abs(x - p.x) > 10 || Math.abs(Math.abs(z - p.z) - r) > 0.5) continue;
        low = Math.min(low, pos[i * 3 + 1]);
        high = Math.max(high, pos[i * 3 + 1]);
      }
      expect(low).toBeLessThan(level.groundAt(p.x, p.z));
      expect(high).toBeGreaterThan(p.y);
      expect(high).toBeLessThan(p.y + 1);
    }
  });

  it("lays its snow on the crown, over the canopy and never across the lane", () => {
    for (const t of tunnels) {
      const p = tunnelPointAt(t, t.length / 2);
      const r = archRadius(t);
      for (let i = 0; i < pos.length / 3; i++) {
        if (layer[i] !== FACADE.snow) continue;
        const x = pos[i * 3];
        const z = pos[i * 3 + 2];
        if (Math.abs(x - p.x) > 20 || Math.abs(z - p.z) > r + 1) continue;
        expect(pos[i * 3 + 1]).toBeGreaterThan(p.y + r * 0.85);
      }
    }
  });

  it("stands each fan house before its entrance, its drum round the lane", () => {
    for (const t of tunnels) {
      const f = fanOf(level, t);
      const mouth = tunnelPointAt(t, 0);
      const back = Math.hypot(f.x - mouth.x, f.z - mouth.z);
      expect(back).toBeGreaterThan(FAN_HOUSE.depth);
      expect(f.r).toBeGreaterThan(archRadius(t));
      // Panels round the drum at its radius, on its crown.
      let crown = false;
      for (let i = 0; i < pos.length / 3 && !crown; i++)
        crown =
          layer[i] === FACADE.panel &&
          Math.hypot(pos[i * 3] - f.x, pos[i * 3 + 2] - f.z) < FAN_HOUSE.depth + 1 &&
          Math.abs(pos[i * 3 + 1] - (f.y + f.r)) < 0.3;
      expect(crown).toBe(true);
    }
  });

  it("builds nothing on a map with no tunnels", () => {
    expect(buildTunnels(syntheticLevel(), []).triangles).toBe(0);
  });
});
