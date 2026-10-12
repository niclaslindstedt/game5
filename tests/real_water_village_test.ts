// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A REAL FACE'S VILLAGE ON THE SHORE, never on the ice (`real-water.ts`'s
// `keepVillageDry`, `village-streets.ts`): on a face whose lake fills the
// valley floor up to the hub's edge, or whose river every road out down the
// valley would cross, no street of the village, nor its square, its car
// park, a bay or a building, lies in the face's water — and the water past
// the village's room is kept.

import { beforeAll, describe, expect, it } from "vitest";

import { generateLevel, inWater, loadRealFace, villageBuildingsOf, villageOf } from "@engine";

/** The faces whose villages stood on the ice: two lakes reaching up to
 * the hub's edge, and a river across the valley's side. */
const FACES = ["fell-1", "fell-9", "alpine-9"] as const;

describe("a real face's village by the water", () => {
  beforeAll(async () => {
    for (const id of FACES) expect(await loadRealFace(id)).toBe(true);
  });

  for (const id of FACES) {
    it(`stands on the shore on ${id}`, () => {
      const level = generateLevel(1, { face: id });
      const water = level.water!;
      expect(water.length, id).toBeGreaterThan(0);
      const village = villageOf(level);
      expect(village, id).not.toBeNull();
      const v = village!;
      for (const st of v.streets) {
        for (const p of st.points) expect(inWater(water, p.x, p.z), `${id} ${st.id}`).toBe(false);
      }
      for (const a of v.areas) expect(inWater(water, a.x, a.z), `${id} ${a.kind}`).toBe(false);
      for (const b of v.bays) expect(inWater(water, b.x, b.z), `${id} ${b.id}`).toBe(false);
      for (const c of villageBuildingsOf(level)) {
        expect(inWater(water, c.x, c.z), `${id} ${c.kind}`).toBe(false);
      }
      // The water past the village is kept: a body still lies further
      // down the valley than its back street.
      const back = Math.max(
        ...v.back.flatMap((sid) =>
          v.streets.find((s) => s.id === sid)!.points.map((p) => (p.z - v.edge) * v.valley),
        ),
      );
      const beyond = water.some((b) => {
        for (let k = 1; k < b.rings[0].length; k += 2) {
          if ((b.rings[0][k] - v.edge) * v.valley > back) return true;
        }
        return false;
      });
      expect(beyond, id).toBe(true);
    });
  }
});
