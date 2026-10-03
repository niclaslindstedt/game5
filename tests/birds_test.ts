// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WILDLIFE — the birds over the woods (`bird-defs.ts`, `bird-roost.ts`,
// `bird-plan.ts`), the animals in the snow (`beast-defs.ts`,
// `beast-plan.ts`), their prints (`beast-tracks.ts`) and the birds' voices
// (`audio/bird-voice.ts`, `bird-bank.ts`) — held without a renderer.
//
// The claims, in the order they matter: the wildlife never MOVES A MAP (a
// pinned map's digest is the same with birds on it or without) and never
// draws from a run's stream; a seed deals the same wildlife every time and
// every pose is a pure function of the clock; nothing stands on the loop;
// the rarity ladder is a ladder; the flush and the fright are rules; the
// prints are stamps the trail map already knows how to draw.

import { describe, expect, it } from "vitest";
import {
  createGame,
  generateLevel,
  levelDigest,
  step,
  withDay,
  NEUTRAL_INPUT,
  REGION_IDS,
  type GameState,
  type Level,
  type RegionId,
} from "@engine";

import { BEASTS, beastById, beastRarity } from "../pwa/src/game/beast-defs.ts";
import {
  CALM,
  beastPose,
  freshBeastPose,
  planBeasts,
  spookAt,
  walked,
} from "../pwa/src/game/beast-plan.ts";
import { footfall, priorPrints } from "../pwa/src/game/beast-tracks.ts";
import { BIRDS, birdById, birdRarity } from "../pwa/src/game/bird-defs.ts";
import {
  FLUSH_RADIUS,
  FLUSH_SECONDS,
  activityAt,
  birdPose,
  crossingAt,
  crossingPose,
  flushAt,
  forEachCrossing,
  freshBirdPose,
  type Flock,
} from "../pwa/src/game/bird-plan.ts";
import { planBirds } from "../pwa/src/game/bird-roost.ts";
import { RARITY_FLOOR, rarityOf } from "../pwa/src/game/rarity.ts";
import { TRAIL, type Stamp } from "../pwa/src/game/trail-stamp.ts";
import { wildGround } from "../pwa/src/game/wild-ground.ts";
import { RUN_BANK } from "../pwa/src/game/audio/bank.ts";
import { BIRD_CALLS, criesIn, heardAt } from "../pwa/src/game/audio/bird-voice.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

/** A game on a map, with the player's skier stood at (`x`, `z`) and the
 * clock at `t` — all the flush and the fright read. */
function standAt(level: Level, x: number, z: number, t: number): GameState {
  const state = createGame({ level, mode: "free" });
  state.skier.x = x;
  state.skier.z = z;
  state.t = t;
  return state;
}

describe("the wildlife never moves a map or a run", () => {
  it("leaves every map's digest as the generator built it", () => {
    for (const seed of LEVEL_SEEDS.slice(0, 3)) {
      const level = levelFor(seed);
      const before = levelDigest(level);
      planBirds(level);
      planBeasts(level);
      expect(levelDigest(level), `seed ${seed}`).toBe(before);
    }
  });

  it("draws nothing from a run's stream", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    const a = createGame({ level });
    const b = createGame({ level });
    planBirds(level);
    planBeasts(level);
    for (let i = 0; i < 240; i++) {
      step(a, NEUTRAL_INPUT);
      step(b, NEUTRAL_INPUT);
    }
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it("deals the same wildlife off the same seed", () => {
    const level = levelFor(LEVEL_SEEDS[1]);
    expect(JSON.stringify(planBirds(level).flocks)).toBe(JSON.stringify(planBirds(level).flocks));
    expect(JSON.stringify(planBeasts(level).groups)).toBe(JSON.stringify(planBeasts(level).groups));
  });
});

/** The maps of each region, built once for the file: the alpine's two off
 * the corpus, one of each other region's — a whole ski area (R25) deals
 * most of a region's roster on its own, though one can come out nearly
 * bare of a sparse roster (the fell's): seed 39 is one that does not. */
const maps = new Map<RegionId, Level[]>();
const mapsOf = (region: RegionId): Level[] => {
  let hit = maps.get(region);
  if (!hit) {
    hit =
      region === "alpine"
        ? [levelFor(LEVEL_SEEDS[0]), levelFor(LEVEL_SEEDS[1])]
        : [generateLevel(39, { region })];
    maps.set(region, hit);
  }
  return hit;
};

describe("the wildlife by region (R21)", () => {
  it("names at least one region on every row, and lays each region a roster of its own", () => {
    for (const row of [...BIRDS, ...BEASTS]) {
      expect(row.regions.length, row.id).toBeGreaterThan(0);
      for (const r of row.regions) expect(REGION_IDS, `${row.id} → ${r}`).toContain(r);
    }
    for (const region of REGION_IDS) {
      expect(BIRDS.filter((b) => b.regions.includes(region)).length, region).toBeGreaterThan(2);
      expect(BEASTS.filter((b) => b.regions.includes(region)).length, region).toBeGreaterThan(2);
    }
    // The alpine's own: the chough round the crags, the chamois and the
    // ibex on the faces; the fell's: the reindeer and the arctic fox.
    for (const id of ["chamois", "ibex"] as const)
      expect(beastById(id).regions).toEqual(["alpine"]);
    expect(birdById("chough").regions).toEqual(["alpine"]);
    for (const id of ["reindeer", "arcticfox"] as const)
      expect(beastById(id).regions).toEqual(["fell"]);
    // What lives in the spruce is not dealt where there is no spruce wood.
    expect(birdById("crossbill").regions).not.toContain("fell");
    expect(birdById("crossbill").regions).not.toContain("maritime");
    expect(birdById("capercaillie").regions).not.toContain("alpine");
    expect(beastById("moose").regions).not.toContain("alpine");
  });

  it("deals a few species in every region, and only that region's rows", () => {
    for (const region of REGION_IDS) {
      const seen = new Set<string>();
      for (const level of mapsOf(region)) {
        for (const f of planBirds(level).flocks) {
          expect(birdById(f.species).regions, `${f.species} in the ${region}`).toContain(region);
          seen.add(f.species);
        }
        for (const g of planBeasts(level).groups) {
          expect(beastById(g.species).regions, `${g.species} in the ${region}`).toContain(region);
          seen.add(g.species);
        }
      }
      expect(seen.size, `${region}: ${[...seen].join(", ")}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps every animal and its prints off the ice, where a map lays any", () => {
    for (const level of REGION_IDS.flatMap((r) => mapsOf(r))) {
      if (!level.iceAt) continue;
      const ground = wildGround(level);
      const pose = freshBeastPose();
      for (const g of planBeasts(level).groups) {
        const prints: Stamp[] = [];
        priorPrints(g, level.packedAt, prints);
        for (const s of prints) expect(ground.onIce(s.bx, s.bz), g.species).toBe(false);
        for (let t = 0; t < 300; t += 11) {
          beastPose(g, 0, t, ground, pose);
          expect(ground.onIce(pose.x, pose.z), g.species).toBe(false);
        }
      }
    }
  });
});

describe("the rosters and the rarity ladder", () => {
  it("files every row on a rung, and leaves no rung empty", () => {
    const earned = new Set<string>();
    for (const b of BIRDS) {
      const r = birdRarity(b);
      if (r) earned.add(r);
    }
    for (const b of BEASTS) earned.add(beastRarity(b));
    for (const [word] of RARITY_FLOOR) expect(earned.has(word), word).toBe(true);
    expect(rarityOf(5)).toBe("common");
    expect(rarityOf(0.01)).toBe("legendary");
  });

  it("gives every bird that calls a cry the bank holds", () => {
    for (const b of BIRDS) {
      const call = BIRD_CALLS[b.id];
      if (!call) continue;
      expect(RUN_BANK[call.sound], `${b.id} → ${call.sound}`).toBeDefined();
      if (call.flush) expect(RUN_BANK[call.flush], call.flush).toBeDefined();
      expect(call.reach).toBeGreaterThan(call.ref);
    }
    expect(heardAt(0, { ref: 10, reach: 100 })).toBe(1);
    expect(heardAt(100, { ref: 10, reach: 100 })).toBe(0);
  });

  it("cries the same cries twice", () => {
    const one: number[] = [];
    const two: number[] = [];
    criesIn(1234, 6, 8, 0, 30, (c) => one.push(c.at));
    criesIn(1234, 6, 8, 0, 30, (c) => two.push(c.at));
    expect(one.length).toBeGreaterThan(0);
    expect(two).toEqual(one);
  });
});

describe("the birds", () => {
  it("lays flocks over every map, near the loop, and flies them over the wood", () => {
    let flocks = 0;
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      const ground = wildGround(level);
      const plan = planBirds(level);
      flocks += plan.flocks.length;
      const pose = freshBirdPose();
      for (const flock of plan.flocks) {
        if (flock.home.kind !== "crag") {
          expect(ground.trackDistance(flock.home.x, flock.home.z)).toBeLessThan(260);
        }
        // Up on its loop, every bird clears the snow under it.
        for (let t = 0; t < 1200; t += 7) {
          birdPose(flock, 0, t, pose);
          if (pose.airborne < 1) continue;
          const size = level.size;
          const x = Math.min(Math.max(pose.x, 0), size);
          const z = Math.min(Math.max(pose.z, 0), size);
          expect(pose.y, `${flock.species} over seed ${seed}`).toBeGreaterThan(ground.snowY(x, z));
        }
      }
    }
    expect(flocks).toBeGreaterThan(LEVEL_SEEDS.length * 3);
  });

  it("poses a bird as a pure function of the clock", () => {
    const plan = planBirds(levelFor(LEVEL_SEEDS[2]));
    const flock = plan.flocks[0];
    const a = birdPose(flock, 1, 123.4, freshBirdPose());
    const b = birdPose(flock, 1, 123.4, freshBirdPose());
    expect(b).toEqual(a);
  });

  it("puts birds to roost in the dark", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    const night = { ...level, sun: { ...level.sun, hour: 0 } };
    const noon = { ...level, sun: { ...level.sun, hour: 12 } };
    expect(activityAt(night)).toBe(0);
    expect(activityAt(noon)).toBeGreaterThan(0.9);
  });

  it("flushes a covey when a skier comes close, and not again until it has settled", () => {
    let covey: Flock | undefined;
    let level: Level | undefined;
    for (const seed of LEVEL_SEEDS) {
      level = levelFor(seed);
      covey = planBirds(level).flocks.find((f) => birdById(f.species).flushes);
      if (covey) break;
    }
    expect(covey).toBeDefined();
    const lv = level!;
    const home = covey!.home;
    const far = standAt(lv, home.x + 400, home.z, 50);
    expect(flushAt(covey!, far, -Infinity)).toBe(-Infinity);
    const near = standAt(lv, home.x + FLUSH_RADIUS * 0.5, home.z, 50);
    expect(flushAt(covey!, near, -Infinity)).toBe(50);
    near.t = 50 + FLUSH_SECONDS * 0.5;
    expect(flushAt(covey!, near, 50)).toBe(50);
    // Put up, the covey is in the air.
    const pose = birdPose(covey!, 0, 52, freshBirdPose(), 1, 50);
    expect(pose.y).toBeGreaterThan(home.y + 1);
    // A raven in a spruce watches the skier go by.
    const raven = planBirds(lv).flocks.find((f) => f.species === "raven");
    if (raven) {
      const by = standAt(lv, raven.home.x, raven.home.z, 50);
      expect(flushAt(raven, by, -Infinity)).toBe(-Infinity);
    }
  });

  it("sends skeins north over the fell in March, and none in January", () => {
    // The swans and the geese cross the fell and the maritime range.
    const level = mapsOf("fell")[0];
    const march = withDay(level, { dayOfYear: 85 });
    const january = withDay(level, { dayOfYear: 20 });
    expect(planBirds(january).crossers.length).toBe(0);
    const plan = planBirds(march);
    expect(plan.crossers.length).toBeGreaterThan(0);
    let seen = 0;
    const pose = freshBirdPose();
    forEachCrossing(plan, 300, (c) => {
      seen++;
      crossingPose(c, 0, 300, pose);
      expect(pose.y).toBeGreaterThan(march.groundAt(march.size / 2, march.size / 2));
    });
    expect(seen).toBeGreaterThan(0);
    expect(crossingAt(plan, 3)).toEqual(crossingAt(plan, 3));
  });
});

describe("the animals in the snow", () => {
  it("lays groups over every map, off the loop and out of the woods", () => {
    let groups = 0;
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      const ground = wildGround(level);
      const plan = planBeasts(level);
      groups += plan.groups.length;
      const pose = freshBeastPose();
      for (const g of plan.groups) {
        for (let i = 0; i < g.count; i++) {
          for (let t = 0; t < 600; t += 13) {
            beastPose(g, i, t, ground, pose);
            expect(
              ground.trackDistance(pose.x, pose.z),
              `${g.species} on seed ${seed}`,
            ).toBeGreaterThan(10);
          }
        }
      }
    }
    expect(groups).toBeGreaterThan(LEVEL_SEEDS.length);
  });

  it("walks a round without a jump, and stands still between", () => {
    const plan = planBeasts(levelFor(LEVEL_SEEDS[4]));
    for (const g of plan.groups) {
      const spec = beastById(g.species);
      let prev = walked(g, 0).s;
      let stood = false;
      for (let t = 0.1; t < 400; t += 0.1) {
        const w = walked(g, t);
        expect(Math.abs(w.s - prev)).toBeLessThanOrEqual(spec.speed * 0.1 * 1.001 + 1e-9);
        expect(w.pace).toBeGreaterThanOrEqual(0);
        expect(w.pace).toBeLessThanOrEqual(1);
        if (w.pace === 0) stood = true;
        prev = w.s;
      }
      expect(stood, g.species).toBe(true);
    }
  });

  it("runs from an engine, straight away from it, and settles where it ran to", () => {
    // The first map of the corpus a group is dealt on — a map may deal
    // none, the rare rungs being rare.
    const level = LEVEL_SEEDS.map(levelFor).find((l) => planBeasts(l).groups.length > 0)!;
    const ground = wildGround(level);
    const plan = planBeasts(level);
    const g = plan.groups[0];
    const spec = beastById(g.species);
    const pose = freshBeastPose();
    beastPose(g, 0, 40, ground, pose);
    const quiet = standAt(level, pose.x + spec.wary * 3, pose.z, 40);
    expect(spookAt(g, quiet, CALM, ground)).toBe(CALM);
    const loud = standAt(level, pose.x + spec.wary * 0.5, pose.z, 40);
    const spook = spookAt(g, loud, CALM, ground);
    expect(spook).not.toBe(CALM);
    expect(Math.hypot(spook.dx, spook.dz)).toBeCloseTo(spec.flee, 5);
    // A minute on it has settled: it stands `flee` metres from where its
    // round would have had it, off the side away from the engine — the
    // round itself walks on and may well come back past the skier.
    const awayX = pose.x - loud.skier.x;
    const awayZ = pose.z - loud.skier.z;
    const calm = freshBeastPose();
    beastPose(g, 0, 40 + 60, ground, calm);
    beastPose(g, 0, 40 + 60, ground, pose, spook);
    const dx = pose.x - calm.x;
    const dz = pose.z - calm.z;
    expect(Math.hypot(dx, dz)).toBeCloseTo(spec.flee, 1);
    expect(dx * awayX + dz * awayZ).toBeGreaterThan(0);
    // Still running, it is not frightened again.
    loud.t = 41;
    expect(spookAt(g, loud, spook, ground)).toBe(spook);
  });

  it("leaves prints the trail map draws, in the species' own pattern", () => {
    const level = levelFor(LEVEL_SEEDS[5]);
    const plan = planBeasts(level);
    for (const g of plan.groups) {
      const out: Stamp[] = [];
      priorPrints(g, level.packedAt, out);
      expect(out.length, g.species).toBeGreaterThan(10);
      for (const s of out) {
        expect(s.depth).toBeGreaterThan(0);
        expect(s.depth).toBeLessThanOrEqual(TRAIL.maxDepth);
        expect(s.berm).toBeLessThanOrEqual(TRAIL.maxBerm);
      }
    }
    // A fox's line is ONE line; a hare's bound is four prints.
    const one: Stamp[] = [];
    footfall(beastById("fox"), 10, 10, 0, 0, 0, one);
    expect(one.length).toBe(1);
    const four: Stamp[] = [];
    footfall(beastById("hare"), 10, 10, 0, 0, 0, four);
    expect(four.length).toBe(4);
    // Deeper in powder than on the groomer.
    const packed: Stamp[] = [];
    footfall(beastById("moose"), 10, 10, 0, 0, 1, packed);
    const powder: Stamp[] = [];
    footfall(beastById("moose"), 10, 10, 0, 0, 0, powder);
    expect(powder[0].depth).toBeGreaterThan(packed[0].depth);
  });
});
