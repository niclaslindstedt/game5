// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SKIER THROWS, FLOWN — the grains and clumps of `spray.ts`, decided
// and flown here in plain arrays (three-free, so the spray lab can fly the
// same pool in Node: `make spray-metrics`). Four sources, all read off the
// engine's state and never written back:
//
//   * THE EDGE'S SHEET: an edge that SLIDES across its own line cuts the
//     snow it meets as a plane cuts wood — the chips are shoved ahead of
//     the edge at about the speed it slides across, and thrown up off it
//     (`edgeSlips`: the skier's velocity read across each ski's own line,
//     so a clean carve, which slides across nothing, throws almost none of
//     it, and a hockey stop, which slides across at its whole speed, throws
//     a wall). It leaves along the WHOLE loaded edge — the tip to the tail
//     of a ski, nose to tail of a board's one long edge — as a fan, not a
//     jet: a narrow spread about the slide, a rising angle off the snow,
//     each ski by its share of the load (`ski-stand.ts`), so the outside
//     ski throws most of it.
//   * THE CARVE'S TAIL: a ski railed on its edge at speed peels the groove's
//     lip off its tail — a thin fan flicked out of the arc that the skier
//     leaves hanging behind him, sized by the edge and the speed.
//   * THE POWDER OVER THE SHOULDER: in deep snow at speed the tips (a
//     board's nose) throw powder up over the rider, by how deep they run.
//   * THE LANDING PUFF and A BODY'S BURST: a ring of snow from under a
//     skier coming down out of the air, or a body going in.
//
// THE HEAVY PART ONLY: the fine powder that hangs is `snow-cloud.ts`'s. How
// much a surface gives the edge to cut, how much of it is clumps and how it
// glints is the snow's (`snowpack.ts`).

import { rotate, type Level, type SkierState } from "@engine";

import { skiShares, stationOf } from "./ski-stand.ts";
import type { SnowProps } from "./snowpack.ts";

/** How much HEAVY snow — grains and clumps rather than cloud — a surface
 * throws, 0..1.5: the loose snow less its fine share, more of it the more
 * it comes off in clumps. With no snow said, the packed field's powder. */
export function heavyShare(snow: SnowProps | undefined, packed: number): number {
  if (!snow) return 1 - packed;
  return snow.loose * (0.35 + 0.65 * snow.clumps + 0.3 * (1 - snow.fine));
}

/** How much snow an EDGE CUTS sliding across a surface, 0..~1: a groomer
 * is machined into chips by a sliding edge (the hockey stop's spray on a
 * groomed run is the edge shaving it), loose snow is shoved whole, ice has
 * almost nothing to give. */
export function cutShare(snow: SnowProps | undefined, packed: number): number {
  const bite = snow ? Math.min(1, snow.loose * 5) : 1;
  return 0.45 * bite + heavyShare(snow, packed);
}

/** ONE EDGE ON THE SNOW: where it runs (tip to tail, world m), its share
 * of the load, which way it slides across its own line (a unit vector on
 * the snow) and how fast, m/s, and its own line's unit vector. */
export type EdgeSlip = {
  tip: { x: number; y: number; z: number };
  tail: { x: number; y: number; z: number };
  share: number;
  slide: number;
  across: { x: number; z: number };
  along: { x: number; z: number };
};

export function emptySlip(): EdgeSlip {
  return {
    tip: { x: 0, y: 0, z: 0 },
    tail: { x: 0, y: 0, z: 0 },
    share: 0,
    slide: 0,
    across: { x: 1, z: 0 },
    along: { x: 0, z: 1 },
  };
}

const shareBuf: [number, number] = [0.5, 0.5];

/** THE EDGES ON THE SNOW for one skier, into `out` (two for a pair, one
 * for a board — `count` says how many are filled): each a line from its
 * tip to its tail, its share of the load and how fast it slides ACROSS its
 * own line — the skier's velocity read across the skis as they stand
 * pivoted under him (`skiAngle`, clockwise positive). On a board the one
 * edge carries him whole. */
export function edgeSlips(skier: SkierState, out: [EdgeSlip, EdgeSlip]): number {
  const a = skier.skiAngle;
  const fwd = rotate(skier.q, { x: Math.sin(a), y: 0, z: Math.cos(a) });
  const flat = Math.hypot(fwd.x, fwd.z) || 1;
  const ax = fwd.x / flat;
  const az = fwd.z / flat;
  // Across the ski on the snow, to its right.
  const cx = az;
  const cz = -ax;
  const vAcross = skier.vx * cx + skier.vz * cz;
  const board = skier.contacts.length === 4;
  const n = board ? 1 : 2;
  if (!board) skiShares(skier, shareBuf);
  for (let k = 0; k < n; k++) {
    const e = out[k];
    const tip = board ? skier.contacts[0] : stationOf(skier.contacts, k, 0);
    const tail = board ? skier.contacts[3] : stationOf(skier.contacts, k, 2);
    const touching = board
      ? skier.contacts.some((c) => c.touching)
      : !!stationOf(skier.contacts, k, 1)?.touching;
    if (!tip || !tail || !touching || skier.airborne) {
      e.share = 0;
      e.slide = 0;
      continue;
    }
    e.tip.x = tip.x;
    e.tip.y = tip.y;
    e.tip.z = tip.z;
    e.tail.x = tail.x;
    e.tail.y = tail.y;
    e.tail.z = tail.z;
    e.share = board ? 1 : shareBuf[k];
    // The brake's scrub counts as a slide even where the drawn pivot is
    // small (a check down the fall line skids its skis without turning
    // them far): the snow goes the way the skis were turned, or off the
    // outside of the arc.
    const scrub = skier.skid * skier.speed * 0.45;
    e.slide = Math.max(Math.abs(vAcross), scrub);
    const lean = skier.skiAngle !== 0 ? -Math.sign(skier.skiAngle) : -Math.sign(skier.edge || 1);
    const s = Math.abs(vAcross) >= scrub * 0.5 ? (vAcross >= 0 ? 1 : -1) : lean;
    e.across.x = cx * s;
    e.across.z = cz * s;
    e.along.x = ax;
    e.along.z = az;
  }
  return n;
}

/** THE SPRAY'S NUMBERS — picture, set by looking (`make spray`) and held
 * by the metrics (`make spray-metrics`). */
export const SPRAY = {
  /** Chips a second per metre of edge, per m/s it slides across, at a
   * whole cut share. */
  sheetRate: 120,
  /** The slide, m/s, under which an edge cuts nothing worth seeing — the
   * carve's own slip. */
  sheetFrom: 1,
  /** The chips' speed off the edge as a share of the slide (min, spread),
   * and the rise off the snow, rad (min, spread): a fan from about 15° to
   * 50°, steeper the harder the edge is set. */
  shove: [0.75, 0.55],
  rise: [0.26, 0.6],
  /** The fan's spread across the slide, as a share of the chips' speed. */
  fan: 0.32,
  /** Chips a second off a carving tail at a full edge, per m/s of speed. */
  tailRate: 22,
  /** The longest a chip flies, s. */
  life: [0.55, 0.6],
  /** A grain's size, m (min, spread). */
  grain: [0.025, 0.045],
} as const;

/** What the pool has done since it was last read: the lab's measure. */
export type SprayStats = {
  /** Grains thrown. */
  thrown: number;
  /** Summed launch speed off the snow, m/s, and summed peak height over
   * the snow, m, of every grain that came down. */
  launch: number;
  high: number;
  /** Summed distance from where each grain was thrown to where it came
   * down or faded, m, and how many did. */
  reach: number;
  done: number;
};

export type SprayPool = {
  readonly capacity: number;
  /** Per slot: position, velocity, size (m across), opacity, hardness
   * (0 a grain puff … 1 a clump) and glint (0..1). Slots past `cap` are
   * dead. */
  pos: Float32Array;
  vel: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  hard: Float32Array;
  glint: Float32Array;
  readonly cap: number;
  emit(skier: SkierState, level: Level, dt: number, landed: number, snow?: SnowProps): void;
  burst(
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    size: number,
    snow?: SnowProps,
  ): void;
  fling(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    hard: number,
  ): void;
  step(dt: number, level: Level): void;
  setBudget(share: number): void;
  clear(): void;
  /** The tally since the last read, reset by reading it. */
  stats(): SprayStats;
};

/** A tiny stream for the look of the spray (the engine's stream is the
 * engine's; nothing drawn may draw from it). */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function createSprayPool(capacity = 6000): SprayPool {
  const pos = new Float32Array(capacity * 3);
  const vel = new Float32Array(capacity * 3);
  const age = new Float32Array(capacity);
  const life = new Float32Array(capacity);
  const size0 = new Float32Array(capacity);
  const size = new Float32Array(capacity);
  const alpha = new Float32Array(capacity);
  const hard = new Float32Array(capacity);
  const glint = new Float32Array(capacity);
  // Where each was thrown from and how high over the snow it has been —
  // the lab's tally, cheap enough to keep always.
  const ox = new Float32Array(capacity);
  const oz = new Float32Array(capacity);
  const peak = new Float32Array(capacity);
  let head = 0;
  let share = 1;
  let cap = capacity;
  const random = makeRandom(0x5eed);
  const tally: SprayStats = { thrown: 0, launch: 0, high: 0, reach: 0, done: 0 };

  function spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    lifetime: number,
    s: number,
    h = 0,
    g = 0.5,
  ) {
    const i = head;
    head = (head + 1) % cap;
    if (life[i] > 0) retire(i);
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    vel[i * 3] = vx;
    vel[i * 3 + 1] = vy;
    vel[i * 3 + 2] = vz;
    age[i] = 0;
    life[i] = lifetime;
    size0[i] = s;
    size[i] = s;
    alpha[i] = 0;
    hard[i] = h;
    glint[i] = g * random();
    ox[i] = x;
    oz[i] = z;
    peak[i] = 0;
    tally.thrown++;
    tally.launch += Math.hypot(vx, vy, vz);
  }

  function retire(i: number) {
    tally.done++;
    tally.high += peak[i];
    tally.reach += Math.hypot(pos[i * 3] - ox[i], pos[i * 3 + 2] - oz[i]);
    life[i] = 0;
    alpha[i] = 0;
    size[i] = 0;
  }

  // Emission carries fractions over from frame to frame, per skier.
  let debt = new WeakMap<SkierState, number[]>();
  const slips: [EdgeSlip, EdgeSlip] = [emptySlip(), emptySlip()];

  return {
    capacity,
    pos,
    vel,
    size,
    alpha,
    hard,
    glint,
    get cap() {
      return cap;
    },
    fling(x, y, z, vx, vy, vz, lifetime, s, h) {
      if (random() > share) return;
      spawn(x, y, z, vx, vy, vz, lifetime, s, h);
    },
    emit(skier, level, dt, landed, snow) {
      let owed = debt.get(skier);
      if (!owed) {
        owed = [0, 0, 0, 0, 0];
        debt.set(skier, owed);
      }
      const powder = heavyShare(snow, skier.packed);
      const cut = cutShare(snow, skier.packed);
      const clumps = snow ? snow.clumps : 0.25;
      const sparkle = snow ? snow.sparkle : 0.5;
      const base = snow ? Math.min(1, snow.loose * 5) : 1;
      const edge = Math.min(1, Math.abs(skier.edge) / 0.9);
      const n = edgeSlips(skier, slips);
      // The arc's outside, where a carving tail flicks its lip.
      const outSide = -Math.sign(skier.edge || 1);
      for (let k = 0; k < n; k++) {
        const e = slips[k];
        if (e.share <= 0) continue;
        const length = Math.hypot(e.tip.x - e.tail.x, e.tip.z - e.tail.z);
        // THE EDGE'S SHEET.
        const slide = Math.max(0, e.slide - SPRAY.sheetFrom);
        const rate =
          SPRAY.sheetRate * length * slide * cut * e.share * share * 2 * (0.55 + 0.45 * edge);
        owed[k] += rate * dt;
        while (owed[k] >= 1) {
          owed[k] -= 1;
          // Along the edge, more from under the boot and the tail, where
          // the load is.
          const u = 0.15 + 0.85 * Math.sqrt(random());
          const x = e.tip.x + (e.tail.x - e.tip.x) * u;
          const y = e.tip.y + (e.tail.y - e.tip.y) * u;
          const z = e.tip.z + (e.tail.z - e.tip.z) * u;
          const sp = e.slide * (SPRAY.shove[0] + SPRAY.shove[1] * random());
          const rise = SPRAY.rise[0] + SPRAY.rise[1] * (0.4 * edge + 0.6 * random());
          const out = sp * Math.cos(rise);
          const fan = (random() - 0.5) * 2 * SPRAY.fan * sp;
          // Along the ski the chip keeps a little of the skier's way.
          const way = (skier.vx * e.along.x + skier.vz * e.along.z) * (0.35 + 0.3 * random());
          const big = random() < clumps * clumps * 0.6;
          spawn(
            x + e.across.x * 0.06,
            y + 0.03,
            z + e.across.z * 0.06,
            e.across.x * out + e.along.x * (way + fan),
            sp * Math.sin(rise) + skier.vy * 0.3,
            e.across.z * out + e.along.z * (way + fan),
            SPRAY.life[0] + SPRAY.life[1] * random(),
            big
              ? (0.05 + random() * 0.08) * (1 + clumps)
              : SPRAY.grain[0] + SPRAY.grain[1] * random(),
            big ? 0.6 + 0.4 * random() : clumps * 0.4 * random(),
            sparkle,
          );
        }
        // THE CARVE'S TAIL: the groove's lip flicked off a railed tail.
        const carving = Math.max(0, 1 - e.slide / 3);
        const tail =
          SPRAY.tailRate *
          edge *
          edge *
          carving *
          skier.speed *
          (0.3 * base + powder) *
          e.share *
          share *
          // A board's one edge is wider and longer in the snow than a ski's
          // and lays a broader groove: it throws more than a pair's two.
          (n === 1 ? 3 : 2);
        owed[2 + k] += tail * dt;
        while (owed[2 + k] >= 1) {
          owed[2 + k] -= 1;
          const kick = rotate(skier.q, {
            x: outSide * (0.6 + random() * 1.6 + 1.2 * edge),
            y: 0.7 + random() * (1.2 + 1.4 * edge),
            z: -0.4 - random() * 1.2,
          });
          // Off the rear third of the edge, where the groove is finished.
          const u = 0.65 + 0.35 * random();
          spawn(
            e.tip.x + (e.tail.x - e.tip.x) * u,
            e.tip.y + (e.tail.y - e.tip.y) * u + 0.04,
            e.tip.z + (e.tail.z - e.tip.z) * u,
            skier.vx * 0.35 + kick.x,
            skier.vy * 0.3 + kick.y,
            skier.vz * 0.35 + kick.z,
            0.35 + random() * 0.45,
            SPRAY.grain[0] + SPRAY.grain[1] * random() * (1 + clumps),
            clumps * random() * 0.6,
            sparkle,
          );
        }
      }
      // THE POWDER OVER THE SHOULDER, off the tips (a board's nose) running deep.
      const board = skier.contacts.length === 4;
      const tipA = board ? skier.contacts[0] : stationOf(skier.contacts, 0, 0);
      const tipB = board ? skier.contacts[0] : stationOf(skier.contacts, 1, 0);
      const deep = Math.max(tipA?.sink ?? 0, tipB?.sink ?? 0);
      if (deep > 0.06 && skier.speed > 4 && !skier.airborne) {
        const rate =
          Math.min(1, deep / 0.35) * Math.min(1, skier.speed / 15) * 380 * powder * share;
        owed[4] += rate * dt;
        while (owed[4] >= 1) {
          owed[4] -= 1;
          const c = random() < 0.5 ? tipA : tipB;
          if (!c) continue;
          const kick = rotate(skier.q, {
            x: (random() - 0.5) * (board ? 3 : 2),
            y: 2 + random() * 3,
            z: -(1.5 + random() * 3),
          });
          spawn(
            c.x + (random() - 0.5) * 0.2,
            c.y + 0.1,
            c.z + 0.2,
            skier.vx * 0.6 + kick.x,
            skier.vy * 0.4 + kick.y,
            skier.vz * 0.6 + kick.z,
            0.5 + random() * 0.6,
            (0.06 + random() * 0.1) * (1 + 1.2 * clumps * random()),
            clumps * random(),
            sparkle,
          );
        }
      }
      // THE LANDING PUFF.
      if (landed > 0) {
        const count = Math.round(
          Math.min(160, 24 * base + landed * 16 * (0.3 * base + powder)) * share,
        );
        const ground = level.groundAt(skier.x, skier.z);
        for (let i = 0; i < count; i++) {
          const a = random() * Math.PI * 2;
          const sp = 2 + random() * (3 + landed * 0.8);
          spawn(
            skier.x + Math.cos(a) * 0.6,
            ground + 0.1 + random() * 0.3,
            skier.z + Math.sin(a) * 1.0,
            Math.cos(a) * sp + skier.vx * 0.4,
            1 + random() * (1.5 + landed * 0.3),
            Math.sin(a) * sp + skier.vz * 0.4,
            // Short: a puff is a burst that falls back into the snow, and
            // one that hangs for a second and a half reads as fog.
            0.3 + random() * 0.45,
            (0.12 + random() * 0.18) * (1 - 0.4 * clumps),
            clumps * random(),
            sparkle,
          );
        }
      }
    },
    burst(x, y, z, vx, vz, s, snow) {
      // THE WIPEOUT'S BURST: snow flung up and out, bigger and slower to
      // fall than a landing's puff — a man and his skis going in separately.
      const heavy = snow ? Math.min(1.2, 0.4 + heavyShare(snow, 0)) : 1;
      const count = Math.round(Math.min(220, (30 + 170 * s) * heavy) * share);
      for (let i = 0; i < count; i++) {
        const a = random() * Math.PI * 2;
        const sp = 1 + random() * (2 + 4 * s);
        spawn(
          x + Math.cos(a) * 0.5 * random(),
          y + random() * 0.4,
          z + Math.sin(a) * 0.5 * random(),
          Math.cos(a) * sp + vx * 0.35,
          1.5 + random() * (2 + 3 * s),
          Math.sin(a) * sp + vz * 0.35,
          0.45 + random() * (0.4 + 0.5 * s),
          0.16 + random() * 0.24 * (0.6 + s),
        );
      }
    },
    step(dt, level) {
      // A grain is slowed by the air as a small, light body is; a clump
      // carries further.
      const dragGrain = Math.exp(-2.6 * dt);
      const dragClump = Math.exp(-0.9 * dt);
      for (let i = 0; i < cap; i++) {
        if (life[i] <= 0) continue;
        age[i] += dt;
        const t = age[i] / life[i];
        if (t >= 1) {
          retire(i);
          continue;
        }
        const k = i * 3;
        const h = hard[i];
        const drag = dragGrain + (dragClump - dragGrain) * h;
        vel[k] *= drag;
        vel[k + 1] = vel[k + 1] * drag - 9.0 * dt;
        vel[k + 2] *= drag;
        pos[k] += vel[k] * dt;
        pos[k + 1] += vel[k + 1] * dt;
        pos[k + 2] += vel[k + 2] * dt;
        const g = level.groundAt(pos[k], pos[k + 2]);
        const over = pos[k + 1] - g;
        if (over > peak[i]) peak[i] = over;
        // Come down onto the snow: it stops and fades where it lies — a
        // clump bounces once and rolls a little.
        if (over < 0.03) {
          pos[k + 1] = g + 0.03;
          const keep = 0.25 + 0.3 * h;
          vel[k] *= keep;
          vel[k + 1] = h > 0.5 && vel[k + 1] < -2 ? -vel[k + 1] * 0.2 : 0;
          vel[k + 2] *= keep;
          age[i] += dt * 6;
        }
        size[i] = size0[i] * (1 + 1.3 * t * (1 - h));
        // A clump holds together until it lands; a grain thins.
        alpha[i] = Math.min(1, t * 14) * ((1 - t * t) * 0.9 * (1 - h) + (1 - t ** 4) * h);
      }
    },
    setBudget(next) {
      share = Math.max(0, Math.min(1, next));
      cap = Math.max(1, Math.round(capacity * share));
      head %= cap;
      for (let i = cap; i < capacity; i++) {
        life[i] = 0;
        alpha[i] = 0;
        size[i] = 0;
      }
    },
    clear() {
      life.fill(0);
      alpha.fill(0);
      size.fill(0);
      debt = new WeakMap();
    },
    stats() {
      const out = { ...tally };
      tally.thrown = tally.launch = tally.high = tally.reach = tally.done = 0;
      return out;
    },
  };
}
