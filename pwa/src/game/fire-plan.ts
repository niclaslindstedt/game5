// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIRES AS LAID OUT — every part of a ski area's camp fires and
// bonfires (`engine/game/fires.ts` says where each burns and what it has),
// worked out once a map as plain numbers for `fires-view.ts` to build and
// the suite to read (three-free):
//
//   * A CAMP FIRE is a ring of stones about a metre across with a small
//     teepee of split logs in it, a bed of embers under them, a sooty grill
//     grate over half of it on two flat stones, log benches round it (a
//     split half log on two stumps, its flat side up) and, mostly, a
//     woodpile of split logs stacked with their ends out. Its flames stand
//     half a metre to a metre; its smoke is a thin grey thread drifting off
//     downwind; a few sparks rise from it.
//   * A BONFIRE is a TEEPEE of long logs leaned to a point over a burnt
//     bed a little wider than it (no stones: a pit), its flames three to
//     five metres up through the logs, a tall column of smoke, sparks
//     thick at night, benches back where the heat is bearable and a big
//     woodpile.
//   * ROUND BOTH the snow is TRAMPLED and melted: char and ash in the
//     hearth, wet dark slush at its rim, grey-brown boot-packed snow out
//     past the benches, fading into the white.
//
// And THE LIGHT each throws (`lampOf`): a warm, flickering point light a
// little over its flames' middle, as strong as its kind. Every scatter is
// a hash of the fire's own place — never a stream, never the clock — so a
// map's fires are the same fires twice; the flicker is the shader's, off
// the run's clock.

import type { Fire, Level } from "@engine";

import { LOOSE } from "./trail-stamp.ts";

/** The look of each kind, m and counts.
 *   * `stones`: the hearth's ring — how many, their size between the two,
 *     how far out past the hearth's radius they sit (none for a bonfire).
 *   * `lay`: the logs burning in the hearth — how many lean in a teepee,
 *     each log's length and radius, how far out their feet stand and how
 *     high their tops meet.
 *   * `embers`: the glowing bed's radius against the hearth's.
 *   * `flames`: the tongues of fire — how many, how wide each is against
 *     the hearth, how far out from the middle their feet scatter (a share
 *     of the hearth's radius); the tallest stands the kind's `flames`.
 *   * `sparks`, `smoke`: how many of each a fire throws, how fast they
 *     rise, m/s, how long each lives, s, and a puff's size at birth and
 *     its swell, m and m/s.
 *   * `ring`: the trampled snow's outer radius past the benches, m.
 *   * `light`: the point light — how high over the hearth, a share of the
 *     flames, and its power in the lamp slots' units (`haze.ts`).
 *   * `glow`: the halo round the flames, m across, by day and by night. */
export const FIRE_LOOK = {
  camp: {
    stones: { count: 12, size: [0.13, 0.2] as const, out: 0.12 },
    lay: { logs: 6, length: 0.75, radius: 0.045, foot: 0.4, top: 0.45 },
    embers: 0.9,
    flames: { tongues: 8, width: 0.6, scatter: 0.5 },
    sparks: { count: 28, rise: 1.6, life: 2.4 },
    smoke: { count: 26, rise: 0.9, life: 7, size: 0.25, swell: 0.3, alpha: 0.22 },
    ring: 1.3,
    light: { up: 0.7, power: 0.8 },
    glow: { day: 1.4, night: 4.5 },
  },
  bonfire: {
    stones: { count: 0, size: [0, 0] as const, out: 0 },
    lay: { logs: 16, length: 3.3, radius: 0.11, foot: 1.55, top: 2.7 },
    embers: 1.1,
    flames: { tongues: 22, width: 0.36, scatter: 0.65 },
    sparks: { count: 110, rise: 3.2, life: 4 },
    smoke: { count: 60, rise: 2.4, life: 12, size: 0.8, swell: 0.4, alpha: 0.45 },
    ring: 2.4,
    light: { up: 0.45, power: 1.5 },
    glow: { day: 5, night: 16 },
  },
} as const;

/** The benches, the woodpile and the grill, m. A bench is a split log, its
 * flat side up `seat` m over the snow, on two stumps `stump` across set in
 * from its ends; a woodpile is `rows` rows of split logs `log` long laid
 * with their ends out along its length; a grill grate `grate` wide and
 * deep, `bars` across, `high` over the embers on two flat stones. */
export const FIRE_KIT = {
  bench: { seat: 0.45, radius: 0.17, stump: 0.14, inset: 0.3 },
  woodpile: {
    camp: { length: 1.4, rows: 4, log: 0.5, radius: 0.065 },
    bonfire: { length: 2.6, rows: 6, log: 0.6, radius: 0.08 },
  },
  grate: { wide: 0.62, deep: 0.42, bars: 7, bar: 0.012, high: 0.32 },
  /** How far the lens may be from a fire for its light to take a lamp
   * slot, m, and how many fires' lights at most. */
  lamps: { reach: 260, most: 4 },
} as const;

/** A LOG (or a stump, a bar): its middle, the unit way along it, its
 * length and radius, m, and its tone — 0 fresh bark, 1 burnt black. */
export type LogPiece = {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  length: number;
  radius: number;
  tone: number;
};

/** A STONE of a hearth's ring, or a grate's support: its middle, size
 * (m, its radius) and turn about the up axis. */
export type Stone = { x: number; y: number; z: number; size: number; yaw: number; flat: number };

/** A BENCH's seat: a half log, its flat side up — the middle of its flat
 * face, its heading (the way along it), length and radius. */
export type Seat = {
  x: number;
  y: number;
  z: number;
  heading: number;
  length: number;
  radius: number;
};

/** A TONGUE of flame: its foot, its height and width, its own scatter. */
export type Tongue = {
  x: number;
  y: number;
  z: number;
  height: number;
  width: number;
  seed: number;
};

/** One fire laid out. */
export type FireLayout = {
  fire: Fire;
  /** The drawn snow's height at the hearth, m. */
  floor: number;
  stones: Stone[];
  /** Every log: the hearth's lay, the benches' stumps, the woodpile. */
  logs: LogPiece[];
  seats: Seat[];
  /** The grill's bars (camp fires), as logs of steel. */
  bars: LogPiece[];
  tongues: Tongue[];
  /** The ember bed's radius and the trampled ring's, m. */
  embers: number;
  ring: number;
  /** Where its light hangs, and how strong. */
  lamp: { x: number; y: number; z: number; power: number };
};

/** A 0..1 hash of a fire's place and an index. */
export function fireHash(x: number, z: number, i: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233 + i * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** The drawn snow's height at (x, z): the ground and the loose cover on it
 * (`trail-stamp.ts`'s `LOOSE`) — what the terrain draws, and so what every
 * part of a fire stands on. */
export function snowFloor(level: Level, x: number, z: number): number {
  return level.groundAt(x, z) + LOOSE * (1 - level.packedAt(x, z));
}

/** A log between two points. */
function logBetween(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  radius: number,
  tone: number,
): LogPiece {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dy, dz);
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    dx: dx / length,
    dy: dy / length,
    dz: dz / length,
    length,
    radius,
    tone,
  };
}

/** ONE FIRE's parts. */
export function layoutFire(level: Level, fire: Fire): FireLayout {
  const L = FIRE_LOOK[fire.kind];
  const K = FIRE_KIT;
  const h = (i: number): number => fireHash(fire.x, fire.z, i);
  // The hearth stands on the snow as the terrain draws it.
  const at = (x: number, z: number): number => snowFloor(level, x, z);
  const floor = at(fire.x, fire.z) + 0.01;
  const stones: Stone[] = [];
  const logs: LogPiece[] = [];
  const seats: Seat[] = [];
  const bars: LogPiece[] = [];
  const tongues: Tongue[] = [];

  // THE RING OF STONES.
  const S = L.stones;
  const turn = h(1) * Math.PI * 2;
  for (let i = 0; i < S.count; i++) {
    const a = turn + ((i + 0.3 * (h(10 + i) - 0.5)) / S.count) * Math.PI * 2;
    const size = S.size[0] + (S.size[1] - S.size[0]) * h(30 + i);
    const r = fire.radius + S.out + size * 0.4;
    const x = fire.x + Math.sin(a) * r;
    const z = fire.z + Math.cos(a) * r;
    stones.push({
      x,
      y: at(x, z) + size * 0.3,
      z,
      size,
      yaw: h(50 + i) * Math.PI * 2,
      flat: 0.6 + 0.25 * h(70 + i),
    });
  }

  // THE LAY: logs leaned in a teepee, their feet round the hearth and
  // their tops meeting over its middle — each charred the more the lower
  // it burns.
  const Y = L.lay;
  const lean = h(2) * Math.PI * 2;
  for (let i = 0; i < Y.logs; i++) {
    const a = lean + ((i + 0.35 * (h(90 + i) - 0.5)) / Y.logs) * Math.PI * 2;
    const foot = Y.foot * (0.85 + 0.3 * h(110 + i));
    const fx = fire.x + Math.sin(a) * foot;
    const fz = fire.z + Math.cos(a) * foot;
    const top = {
      x: fire.x + Math.sin(a) * 0.06,
      y: floor + Y.top * (0.9 + 0.2 * h(130 + i)),
      z: fire.z + Math.cos(a) * 0.06,
    };
    const bottom = { x: fx, y: at(fx, fz) + Y.radius * 0.6, z: fz };
    const log = logBetween(
      bottom,
      top,
      Y.radius * (0.8 + 0.4 * h(150 + i)),
      0.55 + 0.4 * h(170 + i),
    );
    // Long enough to cross at the top a little, never longer than the kind's.
    log.length = Math.min(Y.length, log.length + Y.radius * 2);
    logs.push(log);
  }

  // THE GRILL over the camp fire: bars across half the ring, on two flat
  // stones either side.
  if (fire.kind === "camp") {
    const G = K.grate;
    const gx = Math.sin(turn);
    const gz = Math.cos(turn);
    const cx = fire.x + gx * fire.radius * 0.35;
    const cz = fire.z + gz * fire.radius * 0.35;
    const y = floor + G.high;
    for (let i = 0; i < G.bars; i++) {
      const off = ((i + 0.5) / G.bars - 0.5) * G.deep;
      const mx = cx + gx * off;
      const mz = cz + gz * off;
      bars.push(
        logBetween(
          { x: mx - gz * (G.wide / 2), y, z: mz + gx * (G.wide / 2) },
          { x: mx + gz * (G.wide / 2), y, z: mz - gx * (G.wide / 2) },
          G.bar,
          1,
        ),
      );
    }
    // Its frame: the two rails along it.
    for (const side of [-1, 1]) {
      const mx = cx + gz * side * (G.wide / 2);
      const mz = cz - gx * side * (G.wide / 2);
      bars.push(
        logBetween(
          { x: mx - gx * (G.deep / 2), y, z: mz - gz * (G.deep / 2) },
          { x: mx + gx * (G.deep / 2), y, z: mz + gz * (G.deep / 2) },
          G.bar * 1.4,
          1,
        ),
      );
      const sx = mx + gz * side * 0.08;
      const sz = mz - gx * side * 0.08;
      // A flat stone stood on its end under each rail, up to the grate.
      const foot = at(sx, sz);
      const tall = Math.max(0.08, (y - 0.02 - foot) / 2);
      stones.push({ x: sx, y: foot + tall, z: sz, size: tall, yaw: turn, flat: 1 });
    }
  }

  // THE BENCHES: a split half log on two stumps.
  const B = K.bench;
  fire.seats.forEach((seat, i) => {
    const ax = Math.sin(seat.heading + Math.PI / 2);
    const az = Math.cos(seat.heading + Math.PI / 2);
    // Sat on: the snow round it is trampled to the ground.
    const y0 = at(seat.x, seat.z);
    seats.push({
      x: seat.x,
      y: y0 + B.seat,
      z: seat.z,
      heading: seat.heading + Math.PI / 2,
      length: seat.length,
      radius: B.radius,
    });
    for (const end of [-1, 1]) {
      const along = end * (seat.length / 2 - B.inset);
      const sx = seat.x + ax * along;
      const sz = seat.z + az * along;
      const g = at(sx, sz) - 0.08;
      const top = y0 + B.seat - B.radius * 0.9;
      logs.push(
        logBetween(
          { x: sx, y: g, z: sz },
          { x: sx, y: top, z: sz },
          B.stump * (0.9 + 0.2 * h(200 + i * 2 + end)),
          0.05,
        ),
      );
    }
  });

  // THE WOODPILE: rows of split logs, their ends out, along its length.
  const wp = fire.woodpile;
  if (wp) {
    const W = K.woodpile[fire.kind];
    const ax = Math.sin(wp.heading);
    const az = Math.cos(wp.heading);
    const per = Math.max(2, Math.floor(W.length / (W.radius * 2.1)));
    for (let row = 0; row < W.rows; row++) {
      const n = per - (row % 2);
      const y = at(wp.x, wp.z) + W.radius * (0.8 + 1.75 * row);
      for (let k = 0; k < n; k++) {
        const along = (k - (n - 1) / 2) * W.radius * 2.05 + (row % 2) * 0.0;
        const x = wp.x + ax * along;
        const z = wp.z + az * along;
        const jut = (fireHash(x, z, row) - 0.5) * 0.08;
        logs.push(
          logBetween(
            { x: x - az * (W.log / 2 + jut), y, z: z + ax * (W.log / 2 + jut) },
            { x: x + az * (W.log / 2 - jut), y, z: z - ax * (W.log / 2 - jut) },
            W.radius * (0.85 + 0.3 * fireHash(x, z, 7 + row)),
            0,
          ),
        );
      }
    }
  }

  // THE FLAMES: the tallest in the middle, lower toward the rim.
  const F = L.flames;
  for (let i = 0; i < F.tongues; i++) {
    const r = fire.radius * F.scatter * Math.sqrt(h(300 + i));
    const a = h(320 + i) * Math.PI * 2;
    const middle = 1 - r / Math.max(1e-3, fire.radius * F.scatter);
    tongues.push({
      x: fire.x + Math.sin(a) * r,
      y: floor + 0.05,
      z: fire.z + Math.cos(a) * r,
      height: fire.flames * (0.55 + 0.55 * middle) * (0.8 + 0.25 * h(340 + i)),
      width: fire.radius * 2 * F.width * (0.75 + 0.5 * h(360 + i)),
      seed: h(380 + i),
    });
  }

  return {
    fire,
    floor,
    stones,
    logs,
    seats,
    bars,
    tongues,
    embers: fire.radius * L.embers,
    ring:
      (fire.seats.length > 0
        ? Math.max(...fire.seats.map((s) => Math.hypot(s.x - fire.x, s.z - fire.z)))
        : 0) + L.ring,
    lamp: {
      x: fire.x,
      y: floor + fire.flames * L.light.up,
      z: fire.z,
      power: L.light.power,
    },
  };
}

const plans = new WeakMap<Level, FireLayout[]>();

/** EVERY FIRE of `level` laid out, once a map. */
export function fireLayouts(level: Level, fires: readonly Fire[]): readonly FireLayout[] {
  let list = plans.get(level);
  if (!list) {
    list = fires.map((f) => layoutFire(level, f));
    plans.set(level, list);
  }
  return list;
}

/** THE FLICKER of a fire's light at `t`, 0.7..1.15 — two slow breaths and
 * a quick one, each fire on its own phase; the shader's tongues breathe on
 * the same clock. */
export function flickerAt(t: number, seed: number): number {
  const p = seed * 17.3;
  return (
    0.92 +
    0.09 * Math.sin(t * 5.3 + p) +
    0.06 * Math.sin(t * 9.1 + p * 1.7) +
    0.05 * Math.sin(t * 17.9 + p * 2.3)
  );
}

/** The lights of the `most` fires nearest (x, y, z) within `reach`, into
 * `out` (cleared), nearest first. */
export function nearestFires(
  layouts: readonly FireLayout[],
  x: number,
  y: number,
  z: number,
  out: FireLayout[],
  reach: number = FIRE_KIT.lamps.reach,
  most: number = FIRE_KIT.lamps.most,
): FireLayout[] {
  out.length = 0;
  const far: number[] = [];
  for (const f of layouts) {
    const d = Math.hypot(f.lamp.x - x, f.lamp.y - y, f.lamp.z - z);
    if (d > reach) continue;
    let k = out.length;
    while (k > 0 && far[k - 1] > d) k--;
    out.splice(k, 0, f);
    far.splice(k, 0, d);
    if (out.length > most) {
      out.length = most;
      far.length = most;
    }
  }
  return out;
}
