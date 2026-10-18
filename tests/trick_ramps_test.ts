// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE'S TRICK RAMPS (`trick-ramps.ts`) on generated mountains:
// laid down the pistes off no stream, so the map they are laid on does not
// move; every one off the run's middle, so the lane down it is the snow it
// was; a steep lip in front of a receiver across a gap; the surface the
// skis meet the ramp's own; and asked for by a winter free ride alone.
import { describe, expect, it } from "vitest";
import {
  TRICK_RAMPS,
  createGame,
  levelDigest,
  rampGeometry,
  setTrickRamps,
  type Kicker,
  type Level,
  type RampKind,
} from "@engine";
import { levelFor } from "./support/levels.ts";

const SLOW = 240_000;

const rampsOf = (level: Level): Kicker[] => (level.kickers ?? []).filter((k) => k.rampKind);

/** The ramp's surface `u` metres past its lip, down its middle. */
function along(level: Level, k: Kicker, u: number): number {
  return level.groundAt(k.x + Math.sin(k.heading) * u, k.z + Math.cos(k.heading) * u);
}

describe("the trick ramps on generated mountains", () => {
  for (const seed of [1, 38]) {
    it(
      `are laid down the pistes and leave the map as it was — seed ${seed}`,
      () => {
        const base = levelFor(seed);
        const before = levelDigest(base);
        const level = setTrickRamps(base);
        expect(levelDigest(base)).toBe(before);
        expect(level.trickRamps?.base).toBe(base);
        expect(setTrickRamps(base)).toBe(level);
        expect(setTrickRamps(level)).toBe(level);
        const ramps = rampsOf(level);
        expect(ramps.length).toBeGreaterThan(8);
        expect(level.trickRamps?.count).toBe(ramps.length);
        const pistes = new Set(
          base.resort?.runs.filter((r) => r.kind === "piste").map((r) => r.id),
        );
        for (const k of ramps) {
          expect(pistes.has(k.run ?? "")).toBe(true);
          expect(k.trick).toBe(true);
          // The lip stands over the snow it was built on.
          expect(k.y - base.groundAt(k.x, k.z)).toBeGreaterThan(0.3);
        }
        // More than one steepness on every map.
        expect(new Set(ramps.map((k) => k.rampKind)).size).toBeGreaterThanOrEqual(3);
        // THE LANE: the run's middle is the snow it was, ramps or none.
        for (const run of level.resort?.runs ?? []) {
          for (const p of run.points) {
            expect(Math.abs(level.groundAt(p.x, p.z) - base.groundAt(p.x, p.z))).toBeLessThan(0.01);
          }
        }
      },
      SLOW,
    );
  }

  it(
    "builds a steep lip in front of a receiver across a gap",
    () => {
      const level = setTrickRamps(levelFor(38));
      const steep = rampsOf(level).filter((k) => k.rampKind === "gap" || k.rampKind === "booter");
      expect(steep.length).toBeGreaterThan(0);
      for (const k of steep) {
        const z = TRICK_RAMPS.kinds[k.rampKind as RampKind];
        // The trough between the lip and the knoll lies well under both.
        let trough = Infinity;
        for (let u = 1.5; u < z.gap; u += 0.25) trough = Math.min(trough, along(level, k, u));
        const knoll = along(level, k, z.gap + z.deck / 2);
        expect(k.y - trough).toBeGreaterThan(1.5);
        expect(knoll - trough).toBeGreaterThan(1);
        // The receiver's back is a landing slope, falling from the knoll.
        expect(along(level, k, z.gap + z.deck + z.fall / 2)).toBeLessThan(knoll - 3);
      }
    },
    SLOW,
  );

  it(
    "throws off every lip at its own steepness",
    () => {
      const level = setTrickRamps(levelFor(38));
      for (const k of rampsOf(level)) {
        const z = TRICK_RAMPS.kinds[k.rampKind as RampKind];
        // The take-off's last half metre, against the horizontal.
        const rise = (along(level, k, 0) - along(level, k, -0.5)) / 0.5;
        const deg = (Math.atan(rise) * 180) / Math.PI;
        expect(deg).toBeGreaterThan(z.lip - 6);
        expect(deg).toBeLessThan(z.lip + 2);
        expect(k.ramp).toBeGreaterThanOrEqual(rampGeometry(k.rampKind as RampKind).ramp - 1e-6);
      }
    },
    SLOW,
  );

  it(
    "are asked for by a winter free ride alone",
    () => {
      const base = levelFor(38);
      const free = createGame({ level: base, mode: "free", trickRamps: true, quiet: true });
      expect(free.level.trickRamps?.base).toBe(base);
      // A ride handed back the map its ramps are on, still asking, keeps it;
      // asked without, it is the map under them.
      const again = createGame({ level: free.level, mode: "free", trickRamps: true, quiet: true });
      expect(again.level.trickRamps).toBe(free.level.trickRamps);
      const off = createGame({ level: free.level, mode: "free", quiet: true });
      expect(off.level.trickRamps).toBeUndefined();
      const summer = createGame({
        level: base,
        mode: "free",
        trickRamps: true,
        summer: true,
        quiet: true,
      });
      expect(summer.level.trickRamps).toBeUndefined();
      const race = createGame({ level: base, mode: "timeTrial", trickRamps: true, quiet: true });
      expect(race.level.trickRamps).toBeUndefined();
    },
    SLOW,
  );
});
