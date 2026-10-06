// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R20 — THE TERRAIN PARK: laid on the piste of a map asked for it and on no
// other, in its three sizes in turn, each built past its lip, spaced along
// the line, and the seed's own mountain, piste, start and gates untouched.
import { describe, expect, it } from "vitest";

import { LEVEL_RULES as R, generateLevel, levelDigest, trackPointAt, withinBand } from "@engine";

import { LEVEL_SEEDS } from "./support/levels.ts";

/** The terrain park is laid on a map of ONE piste — the generator the six
 * trick maps stand on (`trick-maps.ts`); a resort (R25) lays none. */
const PARK = { version: 1 } as const;

describe("the terrain park (R20)", () => {
  const seed = LEVEL_SEEDS[0];
  const race = generateLevel(seed, PARK);
  const park = generateLevel(seed, { tricks: true, ...PARK });
  const field = park.kickers.filter((k) => k.trick);

  it("is laid only on a map asked for one", () => {
    expect(race.kickers.some((k) => k.trick)).toBe(false);
    expect(field.length).toBeGreaterThanOrEqual(R.trick.count.min);
    expect(field.length).toBeLessThanOrEqual(R.trick.count.max);
  });

  it("leaves the seed's piste, start and gates where the race map has them", () => {
    expect(park.track.length).toBe(race.track.length);
    expect(park.spawn).toEqual(race.spawn);
    expect(park.checkpoints.map((c) => c.s)).toEqual(race.checkpoints.map((c) => c.s));
    expect(park.sun).toEqual(race.sun);
    expect(park.weather).toEqual(race.weather);
    // A different map to the digest: a tricks map is its seed's race map
    // with the park on its piste.
    expect(levelDigest(park)).not.toBe(levelDigest(race));
  });

  it("lays the sizes in turn, each on the piste in the order they are skied", () => {
    const order = R.trick.order;
    let turn = 0;
    let lastS = -Infinity;
    for (const k of field) {
      expect(k.onTrack).toBe(true);
      expect(k.s).toBeGreaterThan(lastS);
      lastS = k.s ?? 0;
      expect(k.size).toBeDefined();
      const row = R.trick.sizes[k.size!];
      expect(k.height).toBeCloseTo(row.height, 6);
      expect(k.shape).toBeDefined();
      expect(k.shape!.dig).toBeCloseTo(row.dig, 6);
      // A smaller size may be laid out of turn where it fits sooner (R20);
      // the size whose turn it is never runs ahead of the turn.
      const at = order.indexOf(k.size!);
      expect(at).toBeLessThanOrEqual(turn % order.length);
      if (at === turn % order.length) turn++;
    }
  });

  it("keeps the lead after the start gate and before the finish, and the gap between", () => {
    const first = field[0];
    const last = field[field.length - 1];
    expect(first.s ?? 0).toBeGreaterThanOrEqual(R.trick.lead - 1);
    expect(park.track.length - (last.s ?? 0) - last.landing).toBeGreaterThanOrEqual(
      R.trick.lead - 1,
    );
    for (let i = 1; i < field.length; i++) {
      const a = field[i - 1];
      const b = field[i];
      expect((b.s ?? 0) - b.ramp - ((a.s ?? 0) + a.landing)).toBeGreaterThanOrEqual(
        R.trick.gap - 1,
      );
    }
    // No gate on any of them, a run-in from the gate before each: a reset
    // at a gate stands a skier on the line, and he reaches the next lip.
    const yAt = (s: number): number => {
      const p = trackPointAt(park, s);
      return park.groundAt(p.x, p.z);
    };
    for (const k of field) {
      const from = (k.s ?? 0) - k.ramp;
      const to = (k.s ?? 0) + k.landing;
      let before = -Infinity;
      for (const gate of park.checkpoints) {
        expect(
          gate.s > from - R.trick.gateClear.before + 1 && gate.s < to + R.trick.gateClear.after - 1,
        ).toBe(false);
        if (gate.s <= from - R.trick.gateClear.before + 1) before = Math.max(before, gate.s);
      }
      expect(before).toBeGreaterThan(-Infinity);
      expect(yAt(before) - yAt(from)).toBeGreaterThanOrEqual(R.trick.runIn * k.height - 0.3);
    }
  });

  it("digs every landing slope under the piste and stands every lip over it", () => {
    for (const k of field) {
      const at = (u: number): number => {
        const p = trackPointAt(park, (k.s ?? 0) + u);
        return park.groundAt(p.x, p.z);
      };
      const lip = at(0);
      // The grade breaks at the lip: up the ramp's last metres, down the deck's.
      expect((lip - at(-3)) / 3 - (at(3) - lip) / 3).toBeGreaterThan(0.15);
      // The floor of the landing, `dig` under the line the ramp's foot is on
      // and the lip's height below the lip, past the deck.
      const shape = k.shape!;
      const floor = at(shape.deck + shape.fall);
      expect(lip - floor).toBeGreaterThan(k.height + shape.dig * 0.5);
      expect(withinBand(k.width, { min: R.track.width.min, max: R.track.width.max + 40 })).toBe(
        true,
      );
    }
  });
});
