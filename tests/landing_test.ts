// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LANDING'S LOAD (`flight.ts`'s `landingLoad`, `landingTolerance`,
// `landingOff`; the `landing` wipeout in `crash.ts`): the speed into the
// slope as an equivalent fall height, stopped over the legs and the snow's
// give — and what a professional rides away: anything he comes down on his
// skis for, short of the load that folds his legs, and nothing he comes
// down on his side for.

import { describe, expect, it } from "vitest";
import {
  SKIS,
  TUNING,
  createGame,
  fallHeight,
  landingLoad,
  landingTolerance,
  placeRun,
  step,
  type GameEvent,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const TUCK = { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false };

/** Drop a skier from `height` m (his CoG over the snow) at 70 km/h onto a
 * flat strip and report the landing and whether he was thrown by it. */
function drop(opts: {
  packed: number;
  height: number;
  roll?: number;
  pitch?: number;
  snow?: number;
}) {
  const level = flatLevel({ packed: opts.packed });
  const state = createGame({
    level,
    spec: SKIS,
    rivals: 0,
    countdown: 0,
    quiet: true,
    snowDepth: opts.snow,
  });
  placeRun(state, {
    x: level.size / 2,
    z: 200,
    heading: 0,
    speed: 70 / 3.6,
    height: opts.height,
    roll: opts.roll ?? 0,
    pitch: opts.pitch ?? 0,
  });
  const c = state.skier;
  let land: Extract<GameEvent, { kind: "land" }> | null = null;
  let thrown: string | null = null;
  let save: string | null = null;
  // After the touchdown: the deepest the legs bent, m, whether he left the
  // snow again inside the absorbing, and his fastest pitch rate, rad/s.
  let bent = 0;
  let bounced = false;
  let whipped = 0;
  // How long after the touchdown the skis lay flat on the snow, s, and
  // whether he left it again after they had.
  let flatIn = Number.POSITIVE_INFINITY;
  let reflew = false;
  let since = 0;
  for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
    step(state, TUCK);
    for (const e of state.events) {
      if (e.kind === "land" && !land) land = e;
      if (e.kind === "wipeout" && !thrown) thrown = e.cause;
      if (e.kind === "save" && !save) save = e.save;
    }
    if (land && c.thrown === null && c.landing < TUNING.landing.absorb.for) {
      bent = Math.max(bent, ...c.skiCompression);
      bounced ||= c.airborne;
      whipped = Math.max(whipped, Math.abs(c.wx));
      if (flatIn === Number.POSITIVE_INFINITY && Math.abs(c.pitch) < 0.05) flatIn = since;
      if (flatIn < since) reflew ||= c.airborne;
      since += TUNING.dt;
    }
  }
  return { land, thrown, save, bent, bounced, whipped, flatIn, reflew };
}

describe("the landing's load", () => {
  it("reads the speed into the slope as the drop from rest that meets it as hard", () => {
    expect(fallHeight(Math.sqrt(2 * TUNING.g * 1.5))).toBeCloseTo(1.5, 6);
  });

  it("is softened by the snow's give and hardened by a tuck", () => {
    const groomer = landingLoad(8, 0, 0);
    expect(landingLoad(8, 0, 0.4)).toBeLessThan(groomer);
    expect(landingLoad(8, 1, 0)).toBeGreaterThan(groomer);
    expect(landingLoad(0, 0, 0)).toBe(1);
  });

  it("forgives less the bigger it is, and nothing past the buckle", () => {
    const L = TUNING.landing;
    expect(landingTolerance(1)).toBe(1 + L.slack);
    expect(landingTolerance(L.clean)).toBe(1);
    expect(landingTolerance((L.clean + L.buckle) / 2)).toBeLessThan(1);
    expect(landingTolerance(L.buckle - 1e-6)).toBeLessThan(landingTolerance(L.clean + 1));
    expect(landingTolerance(L.buckle - 1e-6)).toBeCloseTo(L.tight, 3);
    expect(landingTolerance(L.buckle)).toBe(0);
  });
});

describe("a landing ridden away, or not", () => {
  it("rides away a drop taken true on the groomer", () => {
    const { land, thrown } = drop({ packed: 1, height: 2.5 });
    expect(land).not.toBeNull();
    expect(thrown).toBeNull();
  });

  it("buckles under a big drop onto the flat groomer, however true", () => {
    const { land, thrown } = drop({ packed: 1, height: 9 });
    expect(land!.g).toBeGreaterThan(TUNING.crash.legsFold);
    expect(thrown).toBe("landing");
  });

  it("rides the same big drop away into a metre of powder, the snow taking the fall", () => {
    const groomer = drop({ packed: 1, height: 9 });
    const powder = drop({ packed: 0, height: 9, snow: 2.5 });
    expect(powder.land!.g).toBeLessThan(groomer.land!.g * 0.5);
    expect(powder.thrown).toBeNull();
  });

  it("rides a crooked landing away on his edges, off a hop or a drop — the drop a save", () => {
    for (const height of [1.4, 4]) {
      expect(drop({ packed: 1, height, roll: 0.5 }).thrown, `${height} m`).toBeNull();
    }
    expect(drop({ packed: 1, height: 4, roll: 0.5 }).save).toBe("landing");
    expect(drop({ packed: 1, height: 1.4, roll: 1 }).save).toBe("landing");
  });

  it("bends deeper the harder he lands and is not sprung back off the snow", () => {
    const hop = drop({ packed: 1, height: 1.4 });
    const big = drop({ packed: 1, height: 2.5 });
    expect(big.thrown).toBeNull();
    expect(big.bounced).toBe(false);
    expect(hop.bounced).toBe(false);
    // The bigger the landing the deeper the knees.
    expect(big.bent).toBeGreaterThan(hop.bent);
  });

  it("rides a landing on the tails away, the skis pivoted flat under him", () => {
    for (const pitch of [0.25, -0.2]) {
      const { thrown, whipped } = drop({ packed: 1, height: 2.5, pitch });
      expect(thrown, `pitch ${pitch}`).toBeNull();
      // The tips laid down to the slope at `follow` at the most; the tails
      // never whipped down faster than `rate`.
      const most = pitch > 0 ? TUNING.landing.absorb.follow : TUNING.landing.absorb.rate;
      expect(whipped, `pitch ${pitch}`).toBeLessThanOrEqual(most + 1e-9);
    }
  });

  it("snaps the skis down off their tails and lands on them, never bounced back up", () => {
    for (const height of [1.5, 3, 5]) {
      for (const pitch of [0.4, 0.6]) {
        const { thrown, flatIn, reflew } = drop({ packed: 1, height, pitch });
        const at = `${height} m, pitch ${pitch}`;
        expect(thrown, at).toBeNull();
        expect(flatIn, at).toBeLessThan(0.1);
        expect(reflew, at).toBe(false);
      }
    }
  });

  it("goes down when he comes down on his side, off a hop or a drop", () => {
    for (const height of [1.4, 4]) {
      expect(drop({ packed: 1, height, roll: 1.5 }).thrown, `${height} m`).toBe("landing");
    }
  });
});
