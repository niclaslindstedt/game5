// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE EVERY FLOCK LIVES — the birds' placer, laid once per map off the
// renderer's own generator.
//
// The other half of `bird-plan.ts`, which is the MODEL: this file decides
// where a flock's home and its beat STAND, and that one says where each bird
// of it is at a moment. The split is the obvious one — a placer asks the map
// questions (`wild-ground.ts`: how far is the nearest trunk, how tall is the
// tallest spruce here, how far is the loop) and the model asks the clock.
//
// THE MAP IS NEVER MOVED BY IT. The generator's seeded stream is the
// generator's (`subSeed`, a fixed order of draws, and a pinned campaign map
// holds a DIGEST of what came out); this draws on a generator of its OWN,
// seeded off `level.seed` with a salt nothing in the engine uses, reads only
// what the `Level` publishes, and writes nothing back. So a map with birds
// on it is byte for byte the map without them, and a run's `state.rng` never
// hears of a raven.
//
// WHERE A HOME MAY BE. A spruce crown for the wood's birds — the tallest
// trees near the loop, the ones a raven would choose. A burrow in a meadow's
// powder for the ptarmigan: open snow, no trunk for a stone's throw, a gentle
// slope, off the groomer. A crag high on the ridge for the eagle, the one bird
// allowed to live out of sight of the loop, because it is only ever seen in
// the air over it.

import { TAU, createRng, regionOf, weatherOf, type Level, type Rng } from "@engine";

import { BIRDS, type Band, type BirdId, type BirdSpec } from "./bird-defs.ts";
import { CROSSING_INTERVAL, walkLoop, type BirdPlan, type Flock, type Roost } from "./bird-plan.ts";
import { groupCount } from "./rarity.ts";
import { wildGround, type WildGround } from "./wild-ground.ts";

/** The salt on the map's seed the birds are dealt off — nothing in the
 * engine draws a stream off it. */
export const BIRD_SALT = 0x6b1d;

/** How close to the LOOP a flock's home has to be, m, and how close its
 * beat's centre: a covey three hundred metres into the wood is a covey
 * nobody meets. The eagle's crag and beat are held by `EAGLE_REACH`. */
const NEAR_COURSE = 200;
const NEAR_LOOP = 160;
const EAGLE_REACH = 480;
/** How far off the home a flock's loop is centred, m. */
const LOOP_OUT: Band = { min: 15, max: 70 };
/** The tallest-tree cut for a perch, m, and how far up it the birds sit. */
const PERCH_TREE = 13;
const PERCH_CROWN = 0.9;
/** A covey's burrow: clear of any trunk by this much, m, off the groomer
 * by this much, and on ground no steeper than this. */
const BURROW_CLEAR = 14;
const BURROW_OFF_TRACK = 18;
const BURROW_SLOPE = 0.35;
/** How many samples round a loop the canopy under it is read at. */
const CANOPY_SAMPLES = 24;
/** How many attempts a flock gets at a home before the map is judged to
 * have no place for it. */
const TRIES = 32;

function inBand(rng: Rng, band: Band): number {
  return rng.range(band.min, band.max);
}

/** Ramanujan's ellipse perimeter, exact enough at these eccentricities. */
function perimeter(a: number, b: number): number {
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/** The highest thing under a loop — the snow, or a crown standing within a
 * crown's reach of the sample — so a flight held over it clears the wood. */
function canopyOver(ground: WildGround, loop: Parameters<typeof walkLoop>[0]): number {
  let top = -Infinity;
  walkLoop(loop, CANOPY_SAMPLES, (x, z) => {
    const cx = Math.min(Math.max(x, 0), ground.level.size);
    const cz = Math.min(Math.max(z, 0), ground.level.size);
    top = Math.max(top, ground.snowY(cx, cz));
    const tree = ground.nearestTree(cx, cz, 6);
    if (tree) top = Math.max(top, tree.y + tree.height);
  });
  return top;
}

/** A spot high on the mountain: up along the summit ridge or out on a side
 * ridge, the highest of a handful of tries. */
function cragFor(rng: Rng, ground: WildGround): Roost | null {
  const level = ground.level;
  const m = level.mountain;
  const top = m ? m.summit : { x: level.size / 2, z: level.size * 0.08 };
  let best: Roost | null = null;
  for (let k = 0; k < 8; k++) {
    const side = rng.next() < 0.5;
    const x = side
      ? (rng.next() < 0.5 ? 0.08 : 0.92) * level.size
      : top.x + rng.range(-0.3, 0.3) * level.size;
    const z = side ? rng.range(0.2, 0.6) * level.size : top.z + rng.range(0, 60);
    if (!ground.inside(x, z, 30)) continue;
    const y = level.groundAt(x, z);
    if (!best || y > best.y) best = { kind: "crag", x, z, y };
  }
  return best;
}

/**
 * Lay every flock over the map, and decide what crosses it. Deterministic
 * in the map's seed on the renderer's own generator, so nothing here costs
 * the run a draw.
 */
export function planBirds(level: Level): BirdPlan {
  const rng = createRng(level.seed ^ BIRD_SALT);
  const ground = wildGround(level);
  const km = level.track.length / 1000;
  const perches = ground.tallTrees(PERCH_TREE);
  const facing = weatherOf(level).windFrom;
  const flocks: Flock[] = [];
  const region = regionOf(level).id;

  /** One try at a home for a flock of this species. */
  const homeFor = (spec: BirdSpec): Roost | null => {
    switch (spec.home) {
      case "tree": {
        // A country with no tall tree in it (the fell, the high alpine) is
        // one a tree bird perches on the rock of instead.
        if (perches.length === 0) return cragFor(rng, ground);
        // Weighted to the tallest: the first third of the list twice over.
        const pool = rng.chance(0.6) ? perches.slice(0, Math.ceil(perches.length / 3)) : perches;
        const t = rng.pick(pool);
        return { kind: "tree", x: t.x, z: t.z, y: t.y + t.height * PERCH_CROWN };
      }
      case "snow": {
        const x = rng.range(0, level.size);
        const z = rng.range(0, level.size);
        if (!ground.inside(x, z, 40)) return null;
        if (ground.nearestTree(x, z, BURROW_CLEAR)) return null;
        if (ground.trackDistance(x, z) < BURROW_OFF_TRACK) return null;
        if (ground.slope(x, z) > BURROW_SLOPE) return null;
        if (ground.onIce(x, z)) return null;
        return { kind: "snow", x, z, y: ground.snowY(x, z) };
      }
      case "crag":
        return cragFor(rng, ground);
      default:
        return null;
    }
  };

  for (const spec of BIRDS) {
    if (!spec.regions.includes(region)) continue;
    if (spec.home === undefined || spec.perKm <= 0) continue;
    const want = groupCount(rng, spec.perKm, km);
    const eagle = spec.home === "crag";
    const near = eagle ? EAGLE_REACH + 300 : NEAR_COURSE;
    const nearLoop = eagle ? EAGLE_REACH : NEAR_LOOP;
    for (let n = 0; n < want; n++) {
      for (let attempt = 0; attempt < TRIES; attempt++) {
        const size = rng.int(spec.flock.min, spec.flock.max);
        const home = homeFor(spec);
        if (!home) continue;
        if (ground.trackDistance(home.x, home.z) > near) continue;
        // The loop it flies, off to one side of the home — thrice as far
        // for the eagle, which hunts the country out from under its crag.
        const bearing = rng.range(0, TAU);
        const out = inBand(rng, LOOP_OUT) * (eagle ? 3 : 1);
        const cx = home.x + Math.sin(bearing) * out;
        const cz = home.z + Math.cos(bearing) * out;
        const radius = inBand(rng, spec.beat);
        if (!ground.inside(cx, cz, radius * 0.5)) continue;
        if (ground.trackDistance(cx, cz) > nearLoop) continue;
        const ovality = rng.range(0.45, 0.9);
        const heading = rng.range(0, TAU);
        const sense: 1 | -1 = rng.chance(0.5) ? 1 : -1;
        const lift = inBand(rng, spec.altitude);
        const loop = { x: cx, z: cz, radius, ovality, heading };
        flocks.push({
          id: `B${flocks.length + 1}`,
          species: spec.id,
          count: size,
          home,
          roost: spec.roost,
          facing,
          loop: {
            ...loop,
            sense,
            altitude: canopyOver(ground, loop) + lift,
            period: perimeter(radius, radius * ovality) / spec.speed,
          },
          cycle: inBand(rng, spec.cycle),
          airShare: spec.airShare,
          phase: rng.next(),
          scatter: rng.int(1, 0x7fffffff),
        });
        break;
      }
    }
  }

  // What CROSSES on this day, each bird repeated by its share.
  const day = level.sun.dayOfYear;
  const crossers: BirdId[] = [];
  for (const spec of BIRDS) {
    const p = spec.passage;
    if (!p || !spec.regions.includes(region) || day < p.days.min || day > p.days.max) continue;
    for (let i = 0; i < p.share; i++) crossers.push(spec.id);
  }
  return {
    seed: level.seed,
    flocks,
    interval: crossers.length > 0 ? CROSSING_INTERVAL : Infinity,
    crossers,
    level,
  };
}
