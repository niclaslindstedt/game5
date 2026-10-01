// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT CLOUD A SKIER RAISES, as arithmetic — three-free, so the suite reads
// it (`tests/snow_cloud_plan_test.ts`); `snow-cloud.ts` flies and draws it.
//
// WHAT A SKIER THROUGH POWDER LOOKS LIKE. The skis shove the loose snow
// aside and up: a carved turn shaves a SHEET off the outside edge that
// fans up beside him; a skid pushes a WALL of it ahead of the edges and
// out to the side — the hockey stop's plume, a curtain the height of the
// skier; the tips of skis running deep throw a BOW WAVE over his
// shoulders. The heavy part of it — grains and clumps — arcs and falls
// back inside a second (`spray.ts`). The FINE part is a different
// substance: crystals a tenth of a millimetre across whose terminal
// velocity is a fraction of a metre a second, carried by the air they were
// thrown into. So the plume STALLS within half a second of leaving the
// ski, swells as it mixes with the air round it, billows, drifts on the
// wind and settles slowly — a curtain hanging over the line the skier cut
// for seconds after he has gone. Its core is thick enough to shade itself
// (the side away from the sun goes the sky's blue-grey); its edges are
// thin, and against a low sun they light up silver, because fine ice
// scatters forward. In cold new snow single crystals glint in it.
//
// THE SNOW DECIDES ALL OF IT (`snowpack.ts`): how much loose snow there is
// to throw (`loose`), how much of it is fine enough to hang (`fine`) — new
// snow is almost all cloud, wet spring snow almost none — how long it hangs
// and how slowly it settles. The groomer gives a thin low mist of ice dust
// off a skid at speed and no plume; a wind crust a short-lived grainy
// cloud among its chunks.
//
// And the skier decides the rest: how far across the way the skis are
// pivoted (`skid`), how far over on their edges (`edge`), the speed, how
// deep the tips are in.

import type { SnowProps } from "./snowpack.ts";

/** THE CLOUD'S NUMBERS, set by looking (`make cloud`). */
export const CLOUD = {
  /** Puffs a second off a full skid at speed in settled powder. */
  skidRate: 90,
  /** Puffs a second off one ski, per m/s of carve (the edge times the
   * speed), and per metre of ploughing sink, in settled powder. */
  skiCarve: 1.1,
  skiPlough: 25,
  /** The skid's wall's climb off the skis, m/s: the least, and what a
   * full push of loose snow adds. */
  lift: { min: 2, loose: 5.5 },
  /** Thrown out across the way off a skid, m/s, relative to the skier. */
  back: { min: 2.5, skid: 4, most: 9 },
  /** A puff's radius at birth, m, and what it swells by over its life. */
  size: { min: 0.25, fine: 0.25 },
  grow: { min: 0.6, fine: 1.4 },
  /** How long a puff hangs, s: the heavy snow's, and what fine snow adds. */
  hang: { min: 0.7, fine: 4.6 },
  /** The settling speed, m/s: the finest's and the heaviest's. */
  settle: { fine: 0.3, coarse: 1.2 },
  /** How fast a puff slows to the air round it, s. */
  tau: { fine: 0.45, coarse: 0.7 },
  /** How much of the skier's own velocity a puff is born with — the wake
   * dragging the plume along. */
  carry: 0.45,
  /** A puff's opacity at its thickest. */
  opacity: 0.7,
  /** The landing's cloud: puffs per unit of landing, and the most. */
  landing: { per: 4, most: 60 },
  /** THE LOFT: the speed, m/s, under which a ski only shoves the powder
   * aside and it falls back, and the speed by which the fine snow it
   * throws is all lofted into a cloud that hangs; and what of each puff a
   * crawl keeps — of the rate, the size at birth, the swell, the life and
   * the climb. */
  loft: {
    from: 1,
    full: 14,
    keep: { rate: 0.15, size: 0.6, grow: 0.4, hang: 0.45, lift: 0.55 },
  },
} as const;

/** HOW MUCH OF THE SNOW A SKI THROWS BECOMES CLOUD at `speed` m/s, 0..1.
 * A walking-pace ski in powder shoves it aside and it falls straight back:
 * the grains are heavy against the little air they are thrown into. Only
 * a ski at speed throws the fine snow fast enough, into air moving fast
 * enough, to loft it — so a crawl leaves a low brief puff and a schuss a
 * plume. */
export function loftOf(speed: number): number {
  const t = Math.min(
    1,
    Math.max(0, (speed - CLOUD.loft.from) / (CLOUD.loft.full - CLOUD.loft.from)),
  );
  return t * t * (3 - 2 * t);
}

/** A recipe scaled by the loft at `speed`: fewer, smaller, briefer, lower
 * puffs at a crawl. */
function lofted(out: CloudRecipe, speed: number): CloudRecipe {
  const k = loftOf(speed);
  const keep = CLOUD.loft.keep;
  const by = (least: number) => least + (1 - least) * k;
  out.rate *= by(keep.rate);
  out.size *= by(keep.size);
  out.grow *= by(keep.grow);
  out.hang *= by(keep.hang);
  out.lift *= by(keep.lift);
  return out;
}

/** What the skier is doing, as the cloud needs it (off `SkierState`). */
export type CloudDrive = {
  speed: number;
  /** How far across the way the skis are pivoted, 0..1. */
  skid: number;
  /** How far over on their edges, 0..1 of the most. */
  edge: number;
  /** The skis on the snow. */
  grounded: boolean;
};

/** What a skier's state says the cloud is thrown by, into `out` — the one
 * reading `snow-cloud.ts` emits by and the cloud metrics lab measures by. */
export function driveOf(
  skier: { speed: number; skid: number; edge: number; airborne: boolean },
  out: CloudDrive,
): CloudDrive {
  out.speed = skier.speed;
  out.skid = skier.skid;
  out.edge = Math.min(1, Math.abs(skier.edge) / 0.9);
  out.grounded = !skier.airborne;
  return out;
}

/** How hard a ski carves for its sheet: the edge it stands on, less what
 * is skidded away, times the speed, m/s. */
export function carveOf(drive: CloudDrive): number {
  return drive.edge * (1 - drive.skid) * drive.speed;
}

/** One source's recipe: how many puffs a second, and what each is born as. */
export type CloudRecipe = {
  /** Puffs a second. */
  rate: number;
  /** The climb off the skis and the throw out across the way, m/s. */
  lift: number;
  back: number;
  /** Radius at birth and gained over the life, m. */
  size: number;
  grow: number;
  /** Life, s; settling speed, m/s; the slowing's time constant, s. */
  hang: number;
  settle: number;
  tau: number;
  /** Opacity at the thickest, 0..1, and how much it glints, 0..1. */
  opacity: number;
  sparkle: number;
};

export function emptyRecipe(): CloudRecipe {
  return {
    rate: 0,
    lift: 0,
    back: 0,
    size: 0,
    grow: 0,
    hang: 0,
    settle: 0,
    tau: 0,
    opacity: 0,
    sparkle: 0,
  };
}

/** What every puff out of this snow is like, whatever threw it. */
function puffOf(snow: SnowProps, out: CloudRecipe): CloudRecipe {
  const fine = Math.min(1, Math.max(0, snow.fine));
  out.size = CLOUD.size.min + CLOUD.size.fine * fine;
  out.grow = CLOUD.grow.min + CLOUD.grow.fine * fine;
  out.hang = CLOUD.hang.min + CLOUD.hang.fine * fine * fine;
  out.settle = CLOUD.settle.coarse + (CLOUD.settle.fine - CLOUD.settle.coarse) * fine;
  out.tau = CLOUD.tau.coarse + (CLOUD.tau.fine - CLOUD.tau.coarse) * fine;
  out.opacity = CLOUD.opacity * (0.55 + 0.45 * fine);
  out.sparkle = snow.sparkle;
  return out;
}

/** THE SKID'S WALL: the cloud the skis push up when they are pivoted
 * across the way, into `out`. Nothing with the skis off the snow, nothing
 * with no skid and nothing where there is no loose snow; lofted by the
 * speed (`loftOf`) — or by `loftSpeed`, for a cloud whose energy is not
 * the forward speed's (a landing, a body hitting the snow). */
export function skidCloud(
  drive: CloudDrive,
  snow: SnowProps,
  out: CloudRecipe,
  loftSpeed = drive.speed,
): CloudRecipe {
  puffOf(snow, out);
  const loose = Math.max(0, snow.loose);
  // A skidding ski shoves the snow ahead of its edge whether or not the
  // skier is hard on the brake: the further across and the faster, the
  // more it throws.
  const push = drive.grounded ? drive.skid * Math.min(1, drive.speed / 12) : 0;
  // At speed on hard snow the skis still lift a mist without digging: the
  // air under a fast skier sweeps the loose top off.
  const sweep = drive.grounded ? Math.min(1, drive.speed / 30) * 0.25 : 0;
  out.rate = CLOUD.skidRate * (push + sweep) * Math.min(1.8, loose) * snow.fine;
  out.lift = (CLOUD.lift.min + CLOUD.lift.loose * Math.min(1.5, loose)) * (0.35 + 0.65 * push);
  out.back =
    Math.min(CLOUD.back.most, CLOUD.back.min + drive.skid * CLOUD.back.skid) * (0.5 + push);
  return lofted(out, loftSpeed);
}

/** THE SKI'S CLOUD: the sheet a ski throws off its outside edge when it
 * carves, and the bow wave its tip shoves up when it is buried. `carve` is
 * the edge (0..1 of the most) times the speed (m/s), `sink` how deep the
 * ski is in, m, `speed` the skier's, m/s — the plough lofts nothing at a
 * crawl (`loftOf`). */
export function skiCloud(
  carve: number,
  sink: number,
  snow: SnowProps,
  out: CloudRecipe,
  speed: number = CLOUD.loft.full,
): CloudRecipe {
  puffOf(snow, out);
  const loose = Math.min(1.8, Math.max(0, snow.loose));
  out.rate =
    (CLOUD.skiCarve * Math.max(0, carve) + CLOUD.skiPlough * Math.max(0, sink)) * loose * snow.fine;
  out.lift = 1 + 1.6 * Math.min(1.5, loose);
  out.back = 1.5;
  out.size *= 0.8;
  return lofted(out, speed);
}

/** THE LANDING'S CLOUD: how many puffs a landing of `hard` (the renderer's
 * measure: the fall's speed plus twice the air time) throws out of this
 * snow — a wall of it off new snow, a puff off the groomer. */
export function landingPuffs(hard: number, snow: SnowProps): number {
  const loose = Math.min(1.8, Math.max(0, snow.loose));
  return Math.min(CLOUD.landing.most, CLOUD.landing.per * Math.max(0, hard) * loose * snow.fine);
}

/** A puff's radius at `age01` (0..1 of its life): quick at first as the
 * jet mixes with the air, then the slow swell of diffusion. */
export function puffRadius(size: number, grow: number, age01: number): number {
  const a = Math.min(1, Math.max(0, age01));
  return size + grow * (0.6 * (1 - Math.exp(-a * 6)) + 0.4 * Math.sqrt(a));
}

/** A puff's opacity at `age01`: in over its first few percent, and thinned
 * as it spreads (the same snow over a bigger disc), gone at the end. */
export function puffOpacity(opacity: number, size: number, grow: number, age01: number): number {
  const a = Math.min(1, Math.max(0, age01));
  const r = puffRadius(size, grow, a);
  const spread = Math.min(1, ((size * 2) / r) ** 0.8);
  const fadeIn = Math.min(1, a * 25);
  const fadeOut = 1 - smoothstep(0.55, 1, a);
  return opacity * spread * fadeIn * fadeOut;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** One step of a puff's flight, in place: it slows toward the air round
 * it (`air`, m/s) with the time constant `tau` and settles at `settle` m/s
 * once it has — the Stokes picture, gravity balanced by the drag at the
 * terminal speed. `v` is [vx, vy, vz] at `i`. */
export function flyPuff(
  v: Float32Array,
  i: number,
  airX: number,
  airY: number,
  airZ: number,
  tau: number,
  settle: number,
  dt: number,
): void {
  const k = 1 - Math.exp(-dt / Math.max(0.01, tau));
  v[i] += (airX - v[i]) * k;
  v[i + 1] += (airY - settle - v[i + 1]) * k;
  v[i + 2] += (airZ - v[i + 2]) * k;
}
