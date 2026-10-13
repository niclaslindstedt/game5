// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE ON THE BENCH (`bike-body.ts`): every row `docs/downhill-bike.md`'s
// evals hold the physics to, ridden by the REAL bodies on grounds no
// generator built (`bike-worlds.ts`) — the coast and the rolling resistance,
// the pedals, the brakes and the endo, the lean in a turn, the weave and the
// capsize, the sag, the drops, a table landed, cased and overshot, a garden
// of roots and rocks, a berm and a bunny hop. Shared by the lab
// (`scripts/bike-ride-lab.mjs`, `make bike-ride`) and the suite
// (`tests/bike_test.ts`), so the table a PR shows is the rows the tests hold.

import {
  BIKE,
  BIKE_REAR_AXLE,
  SURFACES,
  bikeFrontAxleAt,
  bikeSpringsFor,
  type BikeControls,
  type BikeState,
  type SurfaceId,
} from "@engine";
import {
  NO_HANDS,
  RAW,
  RIDDEN,
  benchRide,
  benchWorld,
  profile,
  slope,
  type Ground,
  type Sample,
} from "./bike-worlds.ts";
import type { BikeZone, ZonedWorld } from "@engine";

const G = 9.81;
const KMH = 3.6;
const DEG = 180 / Math.PI;

/** A row's verdict: the measured value in its unit, the band it is held
 * to (null where the row is a reading, not a test), and a word. */
export type BikeRowResult = { value: number; note?: string; pass?: boolean };

export type BikeRow = {
  id: string;
  group: string;
  label: string;
  unit: string;
  band: [number, number] | null;
  run: () => BikeRowResult;
};

const M = BIKE.mass + BIKE.rider.mass;

// ---- hands ---------------------------------------------------------------

const ctl = (o: Partial<BikeControls>): BikeControls => ({ ...NO_HANDS, ...o });

/** Holds `v` m/s on the pedals and a touch of rear brake. */
const hold = (v: number) => (b: BikeState) =>
  ctl({ pedal: b.way < v - 0.1 ? 1 : 0, rear: b.way > v + 0.4 ? 0.25 : 0 });

/** A HAND ON A CIRCLE: the bars asked whatever turn holds the bike on the
 * circle about (cx, cz) of radius r (dir +1 clockwise — a right turn), its
 * speed held at v. */
function circleHand(cx: number, cz: number, r: number, dir: 1 | -1, v: number) {
  let u = 0;
  return (b: BikeState): BikeControls => {
    const d = Math.hypot(b.x - cx, b.z - cz);
    // The turn the circle asks, tightened when outside it.
    const want = dir * (1 / r + (0.6 * (d - r)) / (r * r));
    const now = b.wy / Math.cos(b.roll) / Math.max(0.5, b.speed);
    u = Math.max(-1, Math.min(1, u + 0.6 * r * (want - now) * (1 / 120) * 3));
    return { ...hold(v)(b), steer: u };
  };
}

/** The bars held at `steer` at `v` m/s on the flat: the radius and the
 * lean it settles to. */
function turnAt(v: number, steer: number) {
  let yaw = 0;
  let lean = 0;
  let n = 0;
  const s = benchRide(flat(), {
    speed: v,
    seconds: 7,
    hand: (b, t) => ({ ...hold(v)(b), steer: t > 1 ? steer : 0 }),
    watch: ({ t, b }) => {
      if (t > 4) {
        yaw += b.wy / Math.cos(b.roll);
        lean += b.roll;
        n++;
      }
    },
  });
  return {
    R: v / Math.max(1e-3, yaw / Math.max(1, n)),
    lean: (lean / Math.max(1, n)) * DEG,
    crash: s.crash,
  };
}

/** The berm of radius `r` ridden at `v` m/s, the bars held at `steer`:
 * where he settles from its centre, his lean off vertical, the most of the
 * grip used. */
function bermAt(r: number, v: number, steer: number) {
  let lean = 0;
  let over = 0;
  let d = 0;
  let vv = 0;
  let n = 0;
  const s = benchRide(berm(r, 40), {
    z: -12,
    speed: v,
    seconds: 6,
    hand: (b) => ({ ...hold(v)(b), steer: b.z > -1.5 ? steer : 0 }),
    watch: ({ b }) => {
      const theta = Math.atan2(b.z, b.x + r);
      if (b.z > 0 && theta > 1 && theta < 2.5) {
        lean += -b.roll;
        over = Math.max(over, b.front.over, b.rear.over);
        d += Math.hypot(b.x + r, b.z);
        vv += b.speed * b.speed;
        n++;
      }
      return b.z > 0 && theta > 2.5;
    },
  });
  const k = Math.max(1, n);
  return {
    lean: (lean / k) * DEG,
    over,
    d: d / k,
    asks: Math.atan(vv / k / (G * (d / k || 1))) * DEG,
    crash: s.crash,
  };
}

// ---- worlds -----------------------------------------------------------------

const flat = (s: SurfaceId = "hardpack"): ZonedWorld => benchWorld(slope(0), s);

/** A ledge `H` m high at z = 0, its face over 0.1 m, then flat; a jump's
 * zones off it: its own flat. */
const ledge = (H: number, landing = 0): ZonedWorld => {
  const t = Math.tan((landing * Math.PI) / 180);
  const g: Ground = profile((z) => {
    if (z < 0) return 0;
    if (landing > 0) return Math.max(-H, -0.15 - t * z);
    if (z < 0.1) return (-H * z) / 0.1;
    return -H;
  });
  return benchWorld(g, "hardpack", () => (landing > 0 ? "landing" : "flat"));
};

/** THE 6 m TABLE at 30°: a flat approach, a kicker's arc rising 1.2 m to
 * its lip at z = 0 at 30°, a 6 m deck, a 30° landing down to the bench,
 * the run-out. */
export const TABLE = { lip: 1.2, angle: 30, deck: 6 } as const;
export const table = (): ZonedWorld => {
  const a = (TABLE.angle * Math.PI) / 180;
  const R = TABLE.lip / (1 - Math.cos(a));
  const L = R * Math.sin(a);
  const land = TABLE.lip / Math.tan(a);
  const k = TABLE.deck;
  const h = (z: number): number => {
    if (z < -L) return 0;
    if (z < 0) {
      const u = z + L;
      return R - Math.sqrt(R * R - u * u);
    }
    if (z < k) return TABLE.lip;
    if (z < k + land) return TABLE.lip - (z - k) * Math.tan(a);
    return 0;
  };
  const zone = (_x: number, z: number): BikeZone =>
    z < 0 ? "flat" : z < k ? "deck" : z < k + land + 0.6 ? "landing" : "runout";
  return benchWorld(profile(h), "hardpack", zone);
};

/** A GARDEN of half-round roots (0.06 m) every 0.7 m, or rocks 0.12–0.22 m
 * tall at an uneven step, from z = 5 to 20 on flat ground. */
export const garden = (kind: "roots" | "rocks"): ZonedWorld => {
  const h = (z: number): number => {
    if (z < 5 || z > 20) return 0;
    if (kind === "roots") {
      const u = (z - 5) % 0.7;
      const r = 0.06;
      const d = u - 0.35;
      return Math.abs(d) < r ? Math.sqrt(r * r - d * d) : 0;
    }
    // Rocks: a lumpy run of rounded stones, sized off their index.
    const i = Math.floor((z - 5) / 0.9);
    const u = (z - 5) / 0.9 - i;
    const tall = 0.12 + 0.1 * ((i * 7) % 5) * 0.25;
    return tall * Math.max(0, Math.sin(Math.PI * u)) ** 0.7;
  };
  return benchWorld(profile(h), (_x, z) =>
    z < 5 || z > 20 ? "hardpack" : kind === "roots" ? "roots" : "rock",
  );
};

/** A BERM: a circular turn of radius r banked `bank` degrees about the
 * point (−r, 0), the bike starting on it at the origin facing +z — a left
 * turn. */
export const berm = (r: number, bank: number): ZonedWorld => {
  const most = (bank * Math.PI) / 180;
  const at = (x: number, z: number): number => {
    if (z < 0) return 0;
    const dx = x + r;
    const theta = Math.atan2(z, dx);
    if (theta < 0 || theta > Math.PI) return 0;
    // The bank grows over the berm's first half radian.
    const t = Math.tan(most * Math.min(1, theta / 0.5));
    const e = Math.max(-6, Math.min(6, Math.hypot(dx, z) - r));
    return e * t;
  };
  const g: Ground = (x, z, o) => {
    const e = 0.01;
    o.h = at(x, z);
    o.dx = (at(x + e, z) - at(x - e, z)) / (2 * e);
    o.dz = (at(x, z + e) - at(x, z - e)) / (2 * e);
  };
  return benchWorld(g, "hardpack");
};

// ---- readings -----------------------------------------------------------

/** The lowest of the two wheels over the ground, m — the hop's clearance. */
function clearance(b: BikeState, world: ZonedWorld): number {
  let best = Infinity;
  const q = b.q;
  const rot = (v: { x: number; y: number; z: number }) => {
    // Body → world by the quaternion.
    const ux = q.x;
    const uy = q.y;
    const uz = q.z;
    const cx = uy * v.z - uz * v.y;
    const cy = uz * v.x - ux * v.z;
    const cz = ux * v.y - uy * v.x;
    return {
      x: v.x + 2 * (q.w * cx + uy * cz - uz * cy),
      y: v.y + 2 * (q.w * cy + uz * cx - ux * cz),
      z: v.z + 2 * (q.w * cz + ux * cy - uy * cx),
    };
  };
  const front = bikeFrontAxleAt(b.steer, b.front.comp, { x: 0, y: 0, z: 0 });
  for (const [a, R] of [
    [front, BIKE.front.radius],
    [BIKE_REAR_AXLE, BIKE.rear.radius],
  ] as const) {
    const w = rot(a);
    const x = b.x + w.x;
    const z = b.z + w.z;
    best = Math.min(best, b.y + w.y - R - world.groundAt(x, z));
  }
  return best;
}

/** Ride until stopped from `v0` m/s with `hand`: the distance and the mean
 * deceleration, g, and what went wrong. */
function stop(
  world: ZonedWorld,
  v0: number,
  hand: (b: BikeState, t: number) => BikeControls,
  ride = RAW,
) {
  let dist = 0;
  let px = 0;
  let pz = 0;
  let endo = false;
  let off = 0;
  let lock = false;
  const s = benchRide(world, {
    speed: v0,
    seconds: 8,
    ride,
    hand: (b, t) => hand(b, t),
    watch: ({ b }) => {
      dist += Math.hypot(b.x - px, b.z - pz);
      px = b.x;
      pz = b.z;
      // The rear off and the front on for a tenth of a second: an endo.
      off = !b.rear.touching && b.front.touching ? off + 1 : 0;
      if (off > 12) endo = true;
      if (b.rear.locked) lock = true;
      return b.speed < 0.3;
    },
  });
  return {
    dist,
    g: (v0 * v0) / (2 * Math.max(dist, 0.01)) / G,
    endo: endo || s.crash === "bars",
    lock,
    crash: s.crash,
    t: s.t,
  };
}

/** The coasting speed down a straight `grade` on `surface`, km/h. */
function coast(grade: number, surface: SurfaceId, seconds = 60): number {
  return benchRide(benchWorld(slope(grade), surface), { speed: 10, seconds }).b.speed * KMH;
}

/** The roll left after a nudge, hands off at `v`: seconds until it lies
 * past 45°, or 6 when it holds. */
function capsize(v: number, ride = { ...RAW, hands: false }): number {
  const s = benchRide(flat(), {
    speed: v,
    seconds: 6,
    ride,
    through: true,
    hand: (b, t) => {
      if (t < 0.01) b.wz -= 0.15;
      return NO_HANDS;
    },
    watch: ({ b }) => Math.abs(b.roll) > Math.PI / 4,
  });
  return Math.abs(s.b.roll) > Math.PI / 4 ? s.t : 6;
}

/** A drop of `H` m to flat (or onto a landing of `landing` degrees) rolled
 * off at `v` m/s: the summed peak tyre loads over the weight, the rear's
 * and front's peaks, the body's peak, and what came of it. */
/** HOW A RIDER TAKES A LIP at `lip` (z, m): loaded in a crouch over the
 * last 2.5 m, sprung as the front wheel meets it, his weight back as it
 * goes and the bike levelled in the air (the lean against the pitch). */
export const dropHand =
  (lip: number) =>
  (b: BikeState): BikeControls =>
    ctl({
      crouch: !b.airborne && b.front.z > lip - 2.5 && b.front.z < lip - 0.4 ? 1 : 0,
      lean: b.airborne
        ? Math.max(-1, Math.min(1, -4 * b.pitch + 0.15))
        : b.front.z > lip - 1 && b.rear.z < lip + 0.5
          ? 1
          : 0.3,
    });

function drop(H: number, v: number, o: { landing?: number; stiff?: boolean } = {}) {
  // Landed LEVEL off a drop taken well: the bike started in the air H over
  // the flat (or over a landing of `landing` degrees), moving v.
  const t = Math.tan(((o.landing ?? 0) * Math.PI) / 180);
  // A landing falls away from right under the lip the bike leaves.
  const ground = o.landing ? profile((z) => (z < 0 ? 0 : -t * z)) : slope(0);
  const world = benchWorld(ground, "hardpack", () => (o.landing ? "landing" : "flat"));
  let pf = 0;
  let pr = 0;
  let body = 0;
  const s = benchRide(world, {
    z: o.landing ? 0.5 : 0,
    speed: v,
    seconds: 3,
    lift: o.landing ? 0.1 : H,
    ride: { ...RIDDEN, stiff: o.stiff },
    hand: (b) =>
      ctl({ lean: b.airborne ? Math.max(-1, Math.min(1, -4 * (b.pitch + Math.atan(t)))) : 0 }),
    watch: ({ b }) => {
      pf = Math.max(pf, b.front.load);
      pr = Math.max(pr, b.rear.load);
      body = Math.max(body, b.g);
    },
  });
  return { sum: (pf + pr) / (M * G), pf, pr, body, crash: s.crash, landings: s.landings };
}

/** A LEDGE `H` m high rolled off at `v` m/s with the lip technique
 * (`dropHand`): whether he rides away, and how it was judged. */
function rollOff(H: number, v: number) {
  const s = benchRide(ledge(H), { z: -4, speed: v, seconds: 4, hand: dropHand(0) });
  return {
    crash: s.crash,
    verdict: s.landings[0]?.verdict ?? "none",
    peak: s.landings[0]?.peak ?? 0,
  };
}

/** The 6 m table hit at `kmh`: how it was judged, the body's peak. */
function hitTable(kmh: number) {
  const s = benchRide(table(), {
    z: -20,
    speed: kmh / KMH,
    seconds: 6,
    hand: (b) => ctl({ pedal: !b.airborne && b.z < -6 && b.way < kmh / KMH ? 1 : 0 }),
  });
  const l = s.landings[0];
  return { verdict: l?.verdict ?? "none", peak: l?.peak ?? 0, crash: s.crash };
}

const VERDICTS = ["clean", "cased", "nosed", "overshot", "flat", "none"] as const;
const verdictOf = (v: string): number => VERDICTS.indexOf(v as (typeof VERDICTS)[number]);

// ---- the rows ------------------------------------------------------------------

const row = (
  id: string,
  group: string,
  label: string,
  unit: string,
  band: [number, number] | null,
  run: () => BikeRowResult,
): BikeRow => ({ id, group, label, unit, band, run });

const surfaces: SurfaceId[] = [
  "asphalt",
  "rock",
  "hardpack",
  "fines",
  "gravel",
  "roots",
  "loam",
  "grass",
  "scree",
  "rough",
  "mud",
];

export const BIKE_ROWS: BikeRow[] = [
  // THE SAG.
  row("sag-rear", "sag", "rear sag, rider standing", "%", [30, 35], () => {
    const s = benchRide(flat(), { speed: 0, seconds: 2 });
    return { value: (s.b.rear.comp / BIKE.rearEnd.travel) * 100 };
  }),
  row("sag-front", "sag", "front sag, rider standing", "%", [20, 30], () => {
    const s = benchRide(flat(), { speed: 0, seconds: 2 });
    return { value: (s.b.front.comp / BIKE.frontEnd.travel) * 100 };
  }),
  row("weight-rear", "sag", "rear's share of the weight", "%", [55, 68], () => {
    const s = benchRide(flat(), { speed: 0, seconds: 2 });
    return { value: (s.b.rear.load / (s.b.rear.load + s.b.front.load)) * 100 };
  }),
  row("rate-rear", "sag", "rear wheel rate at sag", "N/mm", [9, 12], () => {
    const e = bikeSpringsFor(BIKE.rider.mass).rear;
    return { value: (e.k0 * (1 + e.a * BIKE.rearEnd.sag)) / 1000 };
  }),

  // THE COAST.
  row("coast-25", "coast", "coast, 25% hardpack", "km/h", [90, 110], () => ({
    value: coast(0.25, "hardpack"),
  })),
  row("coast-20", "coast", "coast, 20% hardpack", "km/h", [80, 95], () => ({
    value: coast(0.2, "hardpack"),
  })),
  row("coast-10", "coast", "coast, 10% hardpack", "km/h", [50, 60], () => ({
    value: coast(0.1, "hardpack"),
  })),
  row("coast-order", "coast", "10%: hardpack > grass > mud", "km/h", null, () => {
    const h = coast(0.1, "hardpack");
    const g = coast(0.1, "grass");
    const m = coast(0.1, "mud");
    return {
      value: g,
      note: `${h.toFixed(0)} > ${g.toFixed(0)} > ${m.toFixed(0)}`,
      pass: h > g && g > m,
    };
  }),
  ...surfaces.map((id) =>
    row(`crr-${id}`, "coast", `rolling resistance, ${id} (×table)`, "×", [0.85, 1.15], () => {
      // Coasting on the flat from 3 m/s: the deceleration near 2.5 m/s,
      // less the air's share, over g.
      let v1 = 0;
      let t1 = 0;
      let v2 = 0;
      let t2 = 0;
      benchRide(flat(id), {
        speed: 3.2,
        seconds: 12,
        watch: ({ t, b }) => {
          if (!v1 && b.speed < 2.6) {
            v1 = b.speed;
            t1 = t;
          }
          if (!v2 && b.speed < 2.0) {
            v2 = b.speed;
            t2 = t;
            return true;
          }
        },
      });
      const v = (v1 + v2) / 2;
      const air = (0.5 * 1.05 * BIKE.rider.cda * v * v) / M;
      const crr = ((v1 - v2) / Math.max(1e-3, t2 - t1) - air) / G;
      return { value: crr / SURFACES[id].roll, note: `Crr ${crr.toFixed(3)}` };
    }),
  ),

  // THE PEDALS.
  row("pedal-flat", "pedal", "sprint on the flat, best in 40 s", "km/h", [40, 55], () => {
    let best = 0;
    benchRide(flat(), {
      speed: 1,
      seconds: 40,
      hand: () => ctl({ pedal: 1 }),
      watch: ({ b }) => {
        best = Math.max(best, b.speed);
      },
    });
    return { value: best * KMH };
  }),
  row("pedal-sustain", "pedal", "pedalled for 3 min, flat", "km/h", [24, 32], () => ({
    value:
      benchRide(flat(), { speed: 1, seconds: 180, hand: () => ctl({ pedal: 1 }) }).b.speed * KMH,
  })),

  // THE BRAKES.
  row("stop-40-both", "brakes", "both, 40 km/h, hardpack (fingers)", "m", [8, 12], () => {
    const r = stop(flat(), 40 / KMH, () => ctl({ front: 1, rear: 1 }), RIDDEN);
    return { value: r.dist, note: `${r.g.toFixed(2)} g${r.endo ? " ENDO" : ""}`, pass: !r.endo };
  }),
  ...(["hardpack", "loam"] as const).flatMap((s) => [
    row(`stop-30-both-${s}`, "brakes", `both, 30 km/h, ${s} (fingers)`, "g", [0.6, 0.9], () => {
      const r = stop(flat(s), 30 / KMH, () => ctl({ front: 1, rear: 1 }), RIDDEN);
      return {
        value: r.g,
        note: `${r.dist.toFixed(1)} m`,
        pass: !r.endo && r.g >= 0.6 && r.g <= 0.9,
      };
    }),
    row(
      `stop-30-front-${s}`,
      "brakes",
      `front alone, 30 km/h, ${s} (fingers)`,
      "g",
      [0.55, 0.85],
      () => {
        const r = stop(flat(s), 30 / KMH, () => ctl({ front: 1 }), RIDDEN);
        return {
          value: r.g,
          note: `${r.dist.toFixed(1)} m${r.endo ? " ENDO" : ""}`,
          pass: !r.endo && r.g >= 0.55 && r.g <= 0.85,
        };
      },
    ),
    row(`stop-30-rear-${s}`, "brakes", `rear alone, 30 km/h, ${s}`, "g", [0.25, 0.42], () => {
      const r = stop(flat(s), 30 / KMH, () => ctl({ rear: 1 }));
      return { value: r.g, note: `${r.dist.toFixed(1)} m${r.lock ? " locks" : ""}` };
    }),
  ]),
  row("grab-front", "brakes", "front grabbed, 30 km/h, no fingers: over", "", null, () => {
    const r = stop(flat(), 30 / KMH, () => ctl({ front: 1 }));
    return { value: r.endo ? 1 : 0, note: r.endo ? "over the bars" : "held", pass: r.endo };
  }),
  row("rear-locks", "brakes", "rear grabbed, 30 km/h: locks", "", null, () => {
    const r = stop(flat(), 30 / KMH, () => ctl({ rear: 1 }));
    return { value: r.lock ? 1 : 0, note: r.lock ? "locks and slides" : "rolls", pass: r.lock };
  }),
  // THE ENDO's onset under a slow squeeze. Standing still the bike and
  // rider's b/h is 0.83 neutral and 1.17 back (measured on the bench); on
  // the brake the fork dives and the body is carried forward, so the rear
  // goes light earlier than the static figure says (motorcycles: 0.8–0.98 g
  // measured on stiffer forks). Back, the front tyre slides first.
  ...(
    [
      ["endo-neutral", 0, [0.6, 0.9]],
      ["endo-back", 1, [0.95, 1.25]],
    ] as const
  ).map(([id, lean, band]) =>
    row(
      id,
      "brakes",
      `endo threshold, ${lean ? "back" : "neutral"}`,
      "g",
      [band[0], band[1]],
      () => {
        // The front lever squeezed slowly until the rear goes light.
        // The deceleration read over the last tenth of a second.
        let at = 0;
        let most = 0;
        const past: number[] = [];
        benchRide(flat(), {
          speed: 12,
          seconds: 6,
          through: true,
          ride: { ...RAW },
          hand: (_b, t) => ctl({ front: Math.min(1, t * 0.4), lean }),
          watch: ({ b }) => {
            past.push(b.way);
            if (past.length > 12) past.shift();
            const a = past.length === 12 ? (past[0] - past[11]) / (11 / 120) / G : 0;
            most = Math.max(most, a);
            if (!at && b.rear.load < 30) {
              at = a;
              return true;
            }
            return b.way < 2;
          },
        });
        // Never lifted: the most the lever stopped it at, held.
        return at
          ? { value: at }
          : { value: most, note: "never lifted: the tyre gave first", pass: lean > 0 };
      },
    ),
  ),
  ...(
    [
      ["slope-endo-neutral", 0, true],
      ["slope-endo-back", 1, false],
    ] as const
  ).map(([id, lean, over]) =>
    row(
      id,
      "brakes",
      `15° pitch, front grabbed, ${lean ? "back" : "neutral"}: ${over ? "over" : "holds"}`,
      "",
      null,
      () => {
        const r = stop(benchWorld(slope(Math.tan((15 * Math.PI) / 180)), "hardpack"), 8, (_b, t) =>
          ctl({ front: Math.max(0, Math.min(1, (t - 0.4) * 4)), lean }),
        );
        return {
          value: r.endo ? 1 : 0,
          note: r.endo ? "over the bars" : `stopped in ${r.dist.toFixed(1)} m`,
          pass: r.endo === over,
        };
      },
    ),
  ),

  // THE LEAN.
  row("lean-10m-30", "turn", "lean on a 10 m turn at 30 km/h, hardpack", "°", [32, 38], () => {
    // The bars held steady, found by halving to the one that turns 10 m.
    let lo = 0.2;
    let hi = 1;
    let got = turnAt(30 / KMH, 0.6);
    for (let k = 0; k < 7; k++) {
      const mid = (lo + hi) / 2;
      got = turnAt(30 / KMH, mid);
      if (got.R > 10) lo = mid;
      else hi = mid;
    }
    return {
      value: got.lean,
      note: `radius ${got.R.toFixed(1)} m, tan⁻¹(v²/gR) ${(Math.atan((30 / KMH) ** 2 / (G * got.R)) * DEG).toFixed(1)}°${got.crash ? " " + got.crash : ""}`,
    };
  }),
  row("lean-10m-30-grass", "turn", "the same turn on dry grass: slides out", "", null, () => {
    const s = benchRide(flat("grass"), {
      speed: 30 / KMH,
      seconds: 9,
      ride: RAW,
      hand: circleHand(10, 0, 10, 1, 30 / KMH),
    });
    return {
      value: s.crash ? 1 : 0,
      note: s.crash ?? `held, ${(s.b.roll * DEG).toFixed(0)}°`,
      pass: s.crash !== null,
    };
  }),
  ...[10, 20, 30, 40].map((kmh) =>
    row(`radius-${kmh}`, "turn", `full bars at ${kmh} km/h: radius (lean)`, "m", null, () => {
      let yaw = 0;
      let lean = 0;
      let n = 0;
      const s = benchRide(flat(), {
        speed: kmh / KMH,
        seconds: 7,
        hand: (b, t) => ({ ...hold(kmh / KMH)(b), steer: t > 1 ? 1 : 0 }),
        watch: ({ t, b }) => {
          if (t > 4) {
            yaw += b.wy / Math.cos(b.roll);
            lean += b.roll;
            n++;
          }
        },
      });
      const R = kmh / KMH / Math.max(1e-3, yaw / Math.max(1, n));
      return {
        value: R,
        note: `${((lean / Math.max(1, n)) * DEG).toFixed(0)}°${s.crash ? " " + s.crash : ""}`,
      };
    }),
  ),

  // THE WEAVE AND THE CAPSIZE.
  ...[2, 3, 4, 5, 6, 8, 10, 12].map((v) =>
    row(
      `capsize-${v}`,
      "balance",
      `hands off at ${v} m/s: seconds to 45°`,
      "s",
      v <= 3 ? [0, 3] : v >= 8 ? [6, 6] : null,
      () => ({
        value: capsize(v),
      }),
    ),
  ),
  row("crawl-hands", "balance", "2.5 m/s, rider's hands on: roll after 4 s", "°", [0, 15], () => {
    const s = benchRide(flat(), {
      speed: 2.5,
      seconds: 4,
      through: true,
      hand: (b, t) => {
        if (t < 0.01) b.wz -= 0.15;
        return hold(2.5)(b);
      },
    });
    return { value: Math.abs(s.b.roll) * DEG };
  }),

  // THE DROPS. The force plate (a 130 mm bike) read 6.1–8.9 × W summed,
  // the millisecond spike of the tyre and the wheel stopping; this model
  // carries no unsprung mass, so it reads the springs' and dampers' peak,
  // lower (2–9 × W held), the rear's above the front's and rising with H.
  ...[0.3, 0.5, 0.7].map((H) =>
    row(`drop-${H}`, "drops", `${H} m to flat at 3 m/s: summed tyre peaks`, "×W", [2, 9], () => {
      const r = drop(H, 3);
      return {
        value: r.sum,
        note: `rear ${r.pr.toFixed(0)} N, front ${r.pf.toFixed(0)} N${r.crash ? " " + r.crash : ""}`,
        pass: r.sum >= 2 && r.sum <= 9 && r.pr > r.pf && !r.crash,
      };
    }),
  ),
  row("drop-1", "drops", "1 m to flat at 5 m/s: body's peak", "g", [2, 4.5], () => {
    const r = drop(1, 5);
    return {
      value: r.body,
      note: r.crash ?? r.landings[0]?.verdict ?? "",
      pass: !r.crash && r.body >= 2 && r.body <= 4.5,
    };
  }),
  row("drop-2", "drops", "2 m to flat at 5 m/s, absorbed: body's peak", "g", [3, 5], () => {
    const r = drop(2, 5);
    return {
      value: r.body,
      note: r.crash ?? r.landings[0]?.verdict ?? "",
      pass: !r.crash && r.body >= 3 && r.body <= 5,
    };
  }),
  row(
    "drop-2-stiff",
    "drops",
    "2 m to flat at 5 m/s, taken stiff: body's peak",
    "g",
    [7, 20],
    () => {
      const r = drop(2, 5, { stiff: true });
      return { value: r.body, note: r.crash ?? "" };
    },
  ),
  row(
    "drop-landing",
    "drops",
    "off a lip onto a 30° landing at 5 m/s: body's peak",
    "g",
    [1, 3],
    () => {
      const r = drop(0, 5, { landing: 30 });
      return {
        value: r.body,
        note: r.crash ?? r.landings[0]?.verdict ?? "",
        pass: !r.crash && r.body <= 3,
      };
    },
  ),
  ...([0.5, 1, 1.5] as const).map((H) =>
    row(
      `lip-${H}`,
      "drops",
      `${H} m ledge rolled off at 5 m/s, weight back: rides away`,
      "g",
      null,
      () => {
        const r = rollOff(H, 5);
        return { value: r.peak, note: r.crash ?? r.verdict, pass: !r.crash };
      },
    ),
  ),

  // THE 6 m TABLE (lip 1.2 m at 30°). Clearing 6 m of deck wants
  // v² = g·d / sin 2θ at the lip, 8.2 m/s, and the climb's 2·g·1.2 m on
  // top: about 34 km/h at the kicker's foot ridden passively (a rider's
  // pop takes some off). Slower he rolls it or cases the deck; past
  // ~42 km/h he flies the 2.1 m landing onto the flat.
  ...(
    [
      [26, "none"],
      [34, "cased"],
      [38, "clean"],
      [48, "overshot"],
    ] as const
  ).map(([kmh, want]) =>
    row(
      `table-${kmh}`,
      "jumps",
      `6 m table at ${kmh} km/h: ${want === "none" ? "rolled" : want}`,
      "g",
      null,
      () => {
        const r = hitTable(kmh);
        return {
          value: r.peak,
          note: `${r.verdict}${r.crash ? ", " + r.crash : ""}`,
          pass: r.verdict === want && !r.crash && (want !== "clean" || r.peak < 5),
        };
      },
    ),
  ),

  // THE GARDENS, 15 m of them, entered at 25 km/h and pedalled through as
  // a rider does: the speed at their end (every hit's lift costs some, the
  // springs and the legs taking it), and the body's peak.
  ...(
    [
      ["roots", 18],
      ["rocks", 12],
    ] as const
  ).map(([k, least]) =>
    row(
      `garden-${k}`,
      "rough",
      `${k} entered at 25 km/h, pedalled: speed out`,
      "km/h",
      [least, 30],
      () => {
        let body = 0;
        let out = 0;
        const s = benchRide(garden(k), {
          speed: 25 / KMH,
          seconds: 5,
          hand: (b) => ctl({ pedal: b.way < 25 / KMH ? 1 : 0 }),
          watch: ({ b }) => {
            body = Math.max(body, b.g);
            if (!out && b.z > 20) out = b.speed * KMH;
            return out > 0;
          },
        });
        return {
          value: out,
          note: `body ${body.toFixed(1)} g${s.crash ? " " + s.crash : ""}`,
          pass: !s.crash && out >= least,
        };
      },
    ),
  ),

  // THE BERM: the bars held at the steer that keeps him on its line,
  // found by halving; ridden at its bank speed he stands square to it.
  ...[1, 1.25].map((f) =>
    row(
      `berm-40-${f}`,
      "turn",
      `40° berm, r 8 m, entered at ${f}× its bank speed: lean off vertical`,
      "°",
      null,
      () => {
        const r = 8;
        const v = Math.sqrt(G * r * Math.tan((40 * Math.PI) / 180)) * f;
        let lo = -1;
        let hi = -0.05;
        let got = bermAt(r, v, -0.5);
        for (let k = 0; k < 7; k++) {
          const mid = (lo + hi) / 2;
          got = bermAt(r, v, mid);
          if (got.d < r) lo = mid;
          else hi = mid;
        }
        return {
          value: got.lean,
          note: `on ${got.d.toFixed(1)} m, its turn asks ${got.asks.toFixed(1)}°, grip used ${got.over.toFixed(2)}${got.crash ? " " + got.crash : ""}`,
          pass:
            !got.crash &&
            (f !== 1 || (Math.abs(got.lean - got.asks) <= 4 && Math.abs(got.d - r) < 1)),
        };
      },
    ),
  ),

  // THE POP.
  row("hop", "air", "bunny hop from 4.5 m/s: clearance", "m", [0.3, 0.6], () => {
    let best = 0;
    const world = flat();
    benchRide(world, {
      speed: 4.5,
      seconds: 2.5,
      hand: (_b, t) => ctl({ crouch: t > 0.5 && t < 0.85 ? 1 : 0 }),
      watch: ({ b }) => {
        best = Math.max(best, clearance(b, world));
      },
    });
    return { value: best };
  }),
];

/** Whether a row's result sits in its band (or its own pass says). */
export function rowPasses(r: BikeRow, res: BikeRowResult): boolean {
  if (res.pass !== undefined) return res.pass;
  if (!r.band) return true;
  return res.value >= r.band[0] && res.value <= r.band[1];
}

export { verdictOf };
export type { Sample };
