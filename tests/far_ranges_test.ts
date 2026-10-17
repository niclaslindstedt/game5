// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FAR RANGES (`far-ranges-field.ts`, `far-ranges-plan.ts`,
// `far-face-codec.ts`, `far-faces.ts`): the country round a map dealt in
// its region's character off the seed alone, met at the map's edge with no
// step, the rings laid from the edge out, the rim the clipmap carries, and
// the real country's files read back.

import { describe, expect, it } from "vitest";

import { generateLevel, type GeneratedLevel, REAL_FACE_IDS, type RegionId } from "@engine";

import { decodeFarFace, encodeFarFace, FAR_FACE } from "../pwa/src/game/far-face-codec.ts";
import { farFaceIds, loadFarFace } from "../pwa/src/game/far-faces.ts";
import {
  beyondEdge,
  blendReach,
  dealtGrid,
  FAR_CHARACTER,
  farFrame,
  farHeightAt,
  gridHeight,
} from "../pwa/src/game/far-ranges-field.ts";
import {
  edgeRadius,
  FAR_RINGS,
  horizonToward,
  keyBands,
  rimGrid,
  ringMesh,
} from "../pwa/src/game/far-ranges-plan.ts";
import { SILHOUETTE, silhouetteOf } from "../pwa/src/game/far-silhouette.ts";
import { regionLookOf } from "../pwa/src/game/region-look.ts";
import { levelFor } from "./support/levels.ts";

const REGIONS: readonly RegionId[] = ["alpine", "fell", "continental", "maritime"];
const SEED = 1;
const maps = new Map<RegionId, GeneratedLevel>();
const mapOf = (r: RegionId): GeneratedLevel => {
  let m = maps.get(r);
  if (!m) {
    m = r === "alpine" ? levelFor(SEED) : generateLevel(SEED, { region: r });
    maps.set(r, m);
  }
  return m;
};

/** The highest the dealt country stands over the map's floor within
 * `reach` m of the map's middle, × the map's vertical. */
function peakOver(r: RegionId, reach: number): number {
  const level = mapOf(r);
  const frame = farFrame(level);
  const grid = dealtGrid(frame);
  let top = -Infinity;
  const c = level.size / 2;
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    for (let d = 3000; d <= reach; d += 500) {
      const y = gridHeight(grid, level.size, c + d * Math.sin(a), c + d * Math.cos(a));
      top = Math.max(top, y);
    }
  }
  return (top - frame.floor) / frame.vertical;
}

describe("the dealt country", () => {
  it("stands in its region's character: the alpine highest, the fell lowest", () => {
    const peaks = Object.fromEntries(REGIONS.map((r) => [r, peakOver(r, 30_000)]));
    for (const r of REGIONS) {
      const ch = FAR_CHARACTER[r];
      // Never past the region's relief and the floors' rise out to 30 km.
      const floorRise = (ch.rise * 30) / mapOf(r).mountain!.vertical;
      expect(peaks[r], r).toBeLessThan(ch.relief[1] + floorRise + 0.1);
      expect(peaks[r], r).toBeGreaterThan(0.6 * ch.relief[0]);
    }
    expect(peaks.alpine).toBeGreaterThan(peaks.continental * 0.9);
    expect(peaks.fell).toBeLessThan(peaks.alpine * 0.5);
    expect(peaks.fell).toBeLessThan(peaks.maritime);
  });

  it("is the seed's alone: the same grid twice, another for another seed", () => {
    const a = dealtGrid(farFrame(mapOf("alpine")));
    const b = dealtGrid(farFrame(mapOf("alpine")));
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    const other = farFrame({ ...mapOf("alpine"), seed: SEED + 1 } as GeneratedLevel);
    const c = dealtGrid(other);
    let diff = 0;
    for (let k = 0; k < a.heights.length; k++) diff += Math.abs(a.heights[k] - c.heights[k]);
    expect(diff / a.heights.length).toBeGreaterThan(20);
  });
});

describe("the seam at the map's edge", () => {
  it("takes the map's own ground at its edge and the country past the blend", () => {
    for (const r of REGIONS) {
      const level = mapOf(r);
      const frame = farFrame(level);
      const grid = dealtGrid(frame);
      const S = level.size;
      for (let k = 0; k <= 40; k++) {
        const t = (k / 40) * S;
        // Along each edge: just past it, against the map's own last row.
        for (const [x, z, ox, oz] of [
          [t, 0, 0, -1],
          [t, S, 0, 1],
          [0, t, -1, 0],
          [S, t, 1, 0],
        ]) {
          const inside = level.groundAt(x, z);
          const out = farHeightAt(level, frame, grid, x + ox * 2, z + oz * 2);
          expect(Math.abs(out - inside), `${r} at ${x},${z}`).toBeLessThan(25);
          const far = blendReach(frame) + 10;
          const fx = x + ox * far;
          const fz = z + oz * far;
          expect(farHeightAt(level, frame, grid, fx, fz)).toBeCloseTo(
            gridHeight(grid, S, fx, fz),
            3,
          );
        }
      }
    }
  });

  it("carries a rim the clipmap meets: the map's ground inside, its rise and drop bounded", () => {
    const level = mapOf("alpine");
    const frame = farFrame(level);
    const grid = dealtGrid(frame);
    const rim = rimGrid(level, frame, grid);
    for (let j = 0; j < rim.count; j += 7) {
      for (let i = 0; i < rim.count; i += 7) {
        const x = rim.origin + i * rim.cell;
        const z = rim.origin + j * rim.cell;
        if (beyondEdge(level.size, x, z).beyond > 0) continue;
        expect(rim.heights[j * rim.count + i]).toBeCloseTo(level.groundAt(x, z), 3);
      }
    }
    expect(rim.rise).toBeGreaterThan(0);
    expect(rim.rise).toBeLessThan(2.2 * frame.vertical);
    expect(rim.drop).toBeLessThan(frame.vertical);
  });
});

describe("the rings", () => {
  it("start on the map's edge and run out to the tier's last ring, outermost first", () => {
    const level = mapOf("alpine");
    const frame = farFrame(level);
    const grid = dealtGrid(frame);
    const look = regionLookOf("alpine");
    for (const tier of ["low", "medium", "high"] as const) {
      const rings = FAR_RINGS[tier];
      const mesh = ringMesh(level, frame, grid, look, rings);
      const B = rings.bearings;
      expect(mesh.positions.length).toBe(B * rings.rows * 3);
      const c = level.size / 2;
      for (let i = 0; i < B; i += 9) {
        const a = (i / B) * Math.PI * 2;
        const x = mesh.positions[i * 3] - c;
        const z = mesh.positions[i * 3 + 2] - c;
        expect(Math.hypot(x, z)).toBeCloseTo(edgeRadius(level.size, a), 2);
        const k = ((rings.rows - 1) * B + i) * 3;
        const r = Math.hypot(mesh.positions[k] - c, mesh.positions[k + 2] - c);
        expect(r).toBeCloseTo(rings.outer, -1);
      }
      // The first triangles drawn are the outermost ring's.
      expect(Math.min(...mesh.index.slice(0, 6 * B))).toBeGreaterThanOrEqual((rings.rows - 2) * B);
      for (const v of mesh.albedo) expect(v).toBeGreaterThanOrEqual(0);
      for (let k = 1; k < mesh.normals.length; k += 3) expect(mesh.normals[k]).toBeGreaterThan(0);
    }
  });

  it("light the peaks by a horizon each point sees, and reckon the key up past the peaks", () => {
    // A wall a kilometre off and 500 m high hides a key under 26–29°.
    const wall = (x: number): number => (x > 900 && x < 1500 ? 500 : 0);
    const h = horizonToward((x) => wall(x), 0, 0, 0, Math.PI / 2);
    expect(h).toBeGreaterThan(0.4);
    expect(h).toBeLessThan(0.5);
    const bands = keyBands(farFrame(mapOf("alpine")));
    for (let i = 1; i < 4; i++) expect(bands[i]).toBeGreaterThan(bands[i - 1]);
  });
});

describe("the real country", () => {
  it("round-trips through its codec to the step", () => {
    const heights = Array.from({ length: 512 }, (_, k) => 400 + 1800 * Math.sin(k * 0.37) ** 2);
    const { base, data } = encodeFarFace(heights, FAR_FACE.step);
    const back = decodeFarFace({
      id: "t",
      bearings: 512,
      rows: 1,
      inner: 1,
      outer: 2,
      step: FAR_FACE.step,
      base,
      data,
    });
    heights.forEach((h, k) => expect(Math.abs(back[k] - h)).toBeLessThanOrEqual(FAR_FACE.step / 2));
  });

  it("is baked for real faces only, each on the layout, standing as real ranges do", async () => {
    const ids = farFaceIds();
    expect(ids.length).toBeGreaterThan(0);
    const known = new Set(REAL_FACE_IDS);
    for (const id of ids) {
      expect(known.has(id), id).toBe(true);
      const far = (await loadFarFace(id))!;
      expect(far.bearings).toBe(FAR_FACE.bearings);
      expect(far.rows).toBe(FAR_FACE.rows);
      const h = decodeFarFace(far);
      expect(h.length).toBe(far.bearings * far.rows);
      expect(Math.min(...h)).toBeGreaterThanOrEqual(0);
      // No real mountain stands past nine kilometres.
      expect(Math.max(...h)).toBeLessThan(9000);
    }
  });
});

describe("the skyline a plain sky paints", () => {
  it("bakes every bearing's near and far crest off the rings' own ground", () => {
    const level = mapOf("alpine");
    const frame = farFrame(level);
    const grid = dealtGrid(frame);
    const sil = silhouetteOf(level, frame, grid);
    expect(sil.bins).toBe(SILHOUETTE.bins);
    expect(sil.data.length).toBe(SILHOUETTE.bins * 4);
    let ranges = 0;
    for (let i = 0; i < sil.bins; i++) {
      const [nh, nd, fh, fd] = sil.data.subarray(i * 4, i * 4 + 4);
      const a = (i / sil.bins) * Math.PI * 2;
      // The near layer from the map's edge to the split, the far past it.
      expect(nd).toBeGreaterThanOrEqual(edgeRadius(frame.size, a) - 1);
      expect(nd).toBeLessThanOrEqual(SILHOUETTE.split);
      expect(fd).toBeGreaterThanOrEqual(SILHOUETTE.split);
      expect(fd).toBeLessThanOrEqual(grid.outer);
      expect(Number.isFinite(nh) && Number.isFinite(fh)).toBe(true);
      // Each crest is ground the rings stand on (the curve's drop taken
      // off, so never over it).
      const c = frame.size / 2;
      const ground = (r: number): number =>
        farHeightAt(level, frame, grid, c + r * Math.sin(a), c + r * Math.cos(a));
      expect(fh).toBeLessThanOrEqual(ground(fd) + 1e-3);
      if (fh > frame.floor + frame.vertical * 0.5) ranges++;
    }
    // The far country stands over the eye along much of the skyline.
    expect(ranges).toBeGreaterThan(sil.bins / 4);
  });

  it("is the same skyline for the same map", () => {
    const level = mapOf("fell");
    const frame = farFrame(level);
    const a = silhouetteOf(level, frame, dealtGrid(frame));
    const b = silhouetteOf(level, frame, dealtGrid(frame));
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });
});
