// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SKIER THROWS, WEIGHED — the spray as a MASS of snow cut, shoved and
// flown, the `mass` model of `spray-sim.ts` (three-free, so the labs fly it
// in Node). Every other model decides how many grains to draw; this one
// decides how many KILOGRAMS of snow leave the snow, out of the snow's own
// strength and the skier's own load, and only then how to draw them.
//
// THE SNOW AN EDGE CUTS. A ski's edge pressed into a packed piste sinks
// until the snow it displaces holds the load: the snow pushes back in
// proportion to the volume pressed (its hardness HV, N/mm³ — some 0.16 on a
// recreational piste, 0.21 on a race piste, 0.02 on spring snow, tens on
// ice), and an edge tipped θ off flat over a length L displaces e²·L/(2·tanθ)
// at a depth e — so e = √(2·F·tanθ / (HV·L)): four millimetres under a
// skier pressing 1500 N into a groomer at 45°, a centimetre on spring snow, a
// fifth of a millimetre on ice. SLIDING ACROSS ITS OWN LINE at U m/s, that
// edge planes off a layer e deep along L: ρ·e·L·U kilograms a second — the
// hockey stop's 15–20 kg off a groomer, under a kilo of dust off ice, twice
// that in wet clumps off spring snow. (A skid lifts the sidewall off the
// snow, which a carve rests on: the edge digs deeper, `MASS.skidDig`.)
//
// THE SNOW A SKI SHOVES. Loose snow over the base is not cut but pushed:
// the ski sliding across shoves the layer it stands in, h deep (the
// engine's own sink in powder, the groomer's sugar on a piste), and throws
// a share of it (`MASS.shove`) — the rest is bulldozed into the berm. Its
// tips running forward through deep snow throw a bow wave; its tail, railed
// in a carve, flicks the groove's lip.
//
// WHAT IT IS MADE OF. A kilogram of cut piste is fragments of sintered
// grains a few tenths of a millimetre across, a share of clumps and a pinch
// of dust; a kilogram of shoved powder is aggregates of crystals a
// millimetre or two across and light; wet snow is heavy grains and clumps.
// Each grain falls at its own terminal speed through the air
// (`settleSpeed`, the drag of a rough sphere at its Reynolds number): a
// tenth of a millimetre hangs (a few cm/s — the CLOUD's, handed to
// `snow-cloud.ts` as `dustOf`), half a millimetre stops in a fraction of a
// second and curtains down at a metre a second, a centimetre clump flies a
// stone's arc and BREAKS on the snow it lands on (the splash, a few grains
// thrown back at a third of its speed).
//
// HOW IT LEAVES: FORWARD, FROM UNDER THE SKIS, DOWN THE SLOPE. A sliding
// ski is a cutting tool whose rake face is its base, tipped the edge angle
// off the snow (machining theory's picture of a side-slip: a rake angle of
// θ − 90°, deeply negative). The snow in front of the base is pressed up
// to the ski's own slide and shoved on; what the edge cuts flows up the
// base and off its leading side. So the chips leave from under the base's
// leading half, the way the ski slides, at the slide plus their flow up
// the base (`MASS.push`, `.rake`) — 10–30° off the snow for cut chips,
// loose snow steeper as it rides further up the base — and carry most of
// the ski's own way along it. What the edge planes off and does not throw
// is the BERM, pressed ahead of the base and shoved on over the snow with
// the ski (`MASS.berm`); and whatever comes down slides on down the fall
// line a moment against the snow's friction (`MASS.roll`). In the air
// every parcel feels the drag against the AIR (the run's wind, `windAt`),
// not against the ground.
//
// HOW IT IS DRAWN. Snow is thrown as PARCELS of grains, each a few grams,
// spreading as it flies (turbulent dispersion: its radius grows as √(2·K·t))
// and as OPAQUE AS ITS GRAINS ARE: a parcel's grains' projected area —
// 1.5/(ρ·d) square metres a kilogram for grains of size d — over the disc it
// is drawn as is its optical depth, so a fresh curtain off an edge is solid
// white, thins to a veil as it spreads, and ice dust hardly shows. A lower
// SPRAY row flies FEWER, HEAVIER parcels drawn larger: the same snow, the
// same opacity, coarser grain.

import type { AgedSnow, SnowProps } from "./snowpack.ts";
import type { EdgeSlip } from "./spray-sim.ts";

type Aged = SnowProps & Partial<Pick<AgedSnow, "plates" | "heavy" | "flake">>;

/** THE MASS MODEL'S NUMBERS. The snow's are measured (the hardness and the
 * densities of skiing-mechanics field work, the grains of blowing-snow
 * wind tunnels, the fall speeds of the settling laws); the shares of what
 * is thrown and how it is drawn are picture, set by looking (`make
 * snow-eval`). */
export const MASS = {
  /** THE HARDNESS a packed snow's edge meets, N/mm³ (HV): a recreational
   * piste at 480 kg/m³, scaled as the density's 2.5th power; spring snow;
   * hard ice. */
  hv: { piste: 0.16, density: 480, power: 2.5, wet: 0.022, ice: 30 },
  /** The deepest an edge cuts, m. */
  cutMost: 0.014,
  /** How much deeper a SKIDDING edge digs than a carving one (the
   * sidewall lifted off the snow), at a whole skid. */
  skidDig: 0.5,
  /** The slide across, m/s, under which an edge cuts nothing it throws —
   * a carve's own slip. */
  slideFrom: 0.6,
  /** THE SHARE OF SHOVED LOOSE SNOW THAT FLIES (the rest is pushed into
   * the berm): off the side of a sliding ski, off the tips running deep,
   * off a railed tail's lip. */
  shove: 0.32,
  /** The share of a wet snow's shove kept in the berm. */
  wetHold: 0.7,
  /** The share of the snow an edge planes off that FLIES — the rest is
   * packed into the windrow in front of the sliding edge. */
  cutFly: 0.6,
  /** How much slower a curtain's air spreads than each parcel in it: the
   * air between neighbouring parcels of one sheet goes with them, so the
   * sheet stays dense (and flies as one) long after each parcel spreads. */
  sheet: 0.06,
  /** How much steeper shoved loose snow leaves than cut chips, rad (it
   * rides up the tilted base and off it). */
  steep: 0.75,
  /** WHICH WAY IT GOES. A sliding ski is a cutting tool whose rake face is
   * its BASE, tipped the edge angle θ off the snow (the rake angle θ − 90°,
   * deeply negative — machining theory's picture of a side-slip): the snow
   * in front of the base is brought up to the ski's own slide and SHOVED
   * ON, and what the edge cuts flows up the base and off its leading side.
   * In the ground's frame a chip carries the slide (`push`: the share of it
   * the snow ahead is brought up to, least and spread, the first-shoved the
   * fastest) plus its flow up the base (`rake`: its speed against the base
   * as a share of the slide — brittle snow breaks off in a spray rather
   * than a chip, so well under one). Together: ahead of the ski the way it
   * slides, 10–30° off the snow. */
  push: [0.6, 0.45],
  rake: 0.96,
  /** WHAT LANDS RUNS ON: a parcel come down keeps this share of its speed
   * along the snow and slides on under gravity down the fall line against
   * the snow's friction `mu` for `time` s (a clump `clump` s) — the heap a
   * stop shoves rolling on down the slope. */
  roll: { keep: 0.8, mu: 0.5, time: 0.12, clump: 0.6 },
  /** THE BERM: what the edge planes off and does not throw (1 − `cutFly`)
   * is the snow pressed up in front of the base — a wedge of it riding the
   * sliding ski as machining's dead zone rides a negative-rake tool — and
   * shoved on over the snow at the ski's own velocity (`carry`, least and
   * spread), sliding on down the slope (`roll`) when the ski lets it go:
   * the heap a stop pushes ahead of its skis. Drawn low, `life` s, its
   * parcels spreading at `eddy` m²/s. Never counted as thrown. */
  berm: { carry: [0.85, 0.2], life: 0.25, eddy: 0.0012 },
  /** The share of its sink a carving base sweeps out of its arc a metre
   * of way. */
  sweep: 0.5,
  bow: 0.05,
  lip: 0.35,
  /** The groomer's sugar over its packed base, m, at `loose` 1. */
  sugar: 0.02,
  /** The air, kg/m³ and Pa·s (some 2000 m up, cold). */
  air: { rho: 1.0, mu: 1.7e-5 },
  /** A rough grain's drag over a sphere's. */
  rough: 1.6,
  /** THE PARCEL: the mass one is thrown as at the whole SPRAY row, kg; its
   * radius at birth at that mass, m; the eddies' spread, m²/s per m/s of
   * launch; the most parcels an edge may throw a frame. */
  parcel: 0.004,
  radius: 0.045,
  eddy: 0.004,
  perFrame: 90,
  /** How many times its own volume of air a parcel's grains drag along
   * with them (the air between neighbouring parcels of one curtain). */
  carried: 3,
  /** The optical depth a parcel's grains' area is drawn at (picture). */
  optics: 0.9,
  /** Clumps a frame an edge may throw at most. */
  clumpsPerFrame: 14,
  /** The longest anything flies, s. */
  life: 2.6,
  /** The share of an impact's speed a splash throws its grains back at. */
  splash: 0.32,
  /** The dust (what hangs) a full hockey stop in settled powder throws,
   * kg/s — the cloud's own reference (`snow-cloud.ts` scales by it). */
  dustRef: 8,
} as const;

const G = 9.81;

/** THE TERMINAL SPEED a grain of diameter `d` m and density `rho` kg/m³
 * settles at through still air, m/s: the drag of a sphere at its Reynolds
 * number (the standard drag curve — Stokes' at a crawl, Newton's 0.42
 * fast) times `MASS.rough`, solved by a few fixed-point steps. */
export function settleSpeed(d: number, rho: number): number {
  const { rho: ra, mu } = MASS.air;
  let v = Math.sqrt((4 * G * d * rho) / (3 * 0.44 * MASS.rough * ra));
  for (let i = 0; i < 8; i++) {
    const re = Math.max(1e-6, (ra * v * d) / mu);
    const cd =
      MASS.rough * ((24 / re) * (1 + 0.15 * re ** 0.687) + 0.42 / (1 + 42500 * re ** -1.16));
    const next = Math.sqrt((4 * G * d * rho) / (3 * cd * ra));
    v = 0.5 * (v + next);
  }
  return v;
}

/** WHAT A KIND OF SNOW IS MADE OF, thrown: the median diameter of its
 * grains, m, and their spread (a lognormal's σ); the grains' own density,
 * kg/m³; the share of its mass thrown as CLUMPS, their diameter, m (least,
 * spread) and density; the share that is DUST fine enough to hang. */
export type Grit = {
  d50: number;
  sigma: number;
  rho: number;
  clumps: number;
  clumpD: [number, number];
  clumpRho: number;
  dust: number;
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** How WET a snow is, 0..1, off what the picture knows of it: wet snow
 * throws clumps and nothing fine. */
export function wetOf(snow: Aged | undefined): number {
  if (!snow) return 0;
  return Math.max(snow.heavy ?? 0, clamp01((snow.clumps - snow.fine - 0.35) / 0.45));
}

/** How ICY, 0..1: past 800 kg/m³ nothing gives. */
export function iceOf(snow: Aged | undefined): number {
  return snow ? clamp01((snow.density - 750) / 120) : 0;
}

/** THE HARDNESS an edge meets, N/mm³ (`MASS.hv`). */
export function hardnessOf(snow: Aged | undefined): number {
  const hv = MASS.hv;
  const rho = snow?.density ?? hv.density;
  const dry = hv.piste * Math.max(0.05, rho / hv.density) ** hv.power;
  const wet = wetOf(snow);
  const soft = dry + (hv.wet - dry) * wet;
  return soft + (hv.ice - soft) * iceOf(snow);
}

/** HOW DEEP AN EDGE CUTS, m: `load` N pressed over `length` m tipped
 * `edge` rad off flat into snow of hardness `hv` N/mm³ — e = √(2F·tanθ /
 * (HV·L)). A flat ski presses the base in, not the edge: it cuts a little
 * still (the edge's own corner), never nothing. */
export function edgeDepth(load: number, edge: number, length: number, hv: number): number {
  const theta = Math.min(1.35, Math.max(0.08, Math.abs(edge)));
  const e = Math.sqrt(
    (2 * Math.max(0, load) * Math.tan(theta)) / (hv * 1e9 * Math.max(0.3, length)),
  );
  return Math.min(MASS.cutMost, e);
}

/** WHAT THE PACKED SNOW AN EDGE CUTS is made of: fragments of sintered
 * grains (0.35 mm mean in the wind tunnels' compact snow), a crust's or a
 * slab's plates as clumps, wet snow's heavy grains, ice's dust. */
export function cutGrit(snow: Aged | undefined, out: Grit): Grit {
  const wet = wetOf(snow);
  const ice = iceOf(snow);
  const clumps = snow ? snow.clumps : 0.25;
  const plates = snow?.plates ?? 0;
  out.d50 = lerp(lerp(0.00045 * (1 + 0.4 * clumps), 0.0018, wet), 0.00016, ice);
  out.sigma = 0.55;
  out.rho = lerp(lerp(520, 650, wet), 900, ice);
  out.clumps = (1 - ice) * Math.min(0.75, 0.06 + 0.3 * clumps + 0.35 * plates + 0.25 * wet);
  out.clumpD = [lerp(0.006, 0.012, wet), lerp(0.012, 0.022, wet)];
  out.clumpRho = lerp(430, 600, wet);
  out.dust = (1 - wet) * lerp(0.04 * (snow ? snow.fine : 0.6), 0.3, ice);
  return out;
}

/** WHAT LOOSE SNOW A SKI SHOVES is made of: new snow's aggregates of
 * crystals (a couple of millimetres, light — they fall at half a metre to a
 * metre a second), settled powder's rounded grains, wet snow's slush. */
export function looseGrit(snow: Aged | undefined, out: Grit): Grit {
  const wet = wetOf(snow);
  const rho = snow ? snow.density : 200;
  const fresh = clamp01((220 - rho) / 140);
  // The finer a snow reads (new snow's broken crystals), the finer it flies.
  const fine = snow ? snow.fine : 0.6;
  out.d50 = lerp(lerp(0.0009, 0.0014, fresh) * (1.35 - 0.7 * fine), 0.003, wet);
  out.sigma = 0.6;
  out.rho = lerp(lerp(320, 100, fresh), 680, wet);
  out.clumps = Math.min(0.8, (snow ? snow.clumps : 0.25) * 0.45 + 0.4 * wet);
  out.clumpD = [lerp(0.008, 0.015, wet), lerp(0.02, 0.03, wet)];
  out.clumpRho = lerp(lerp(300, 180, fresh), 600, wet);
  out.dust = (1 - wet) * (snow ? snow.fine : 0.6) * lerp(0.18, 0.32, fresh);
  return out;
}

/** The density of the LOOSE snow a ski shoves, kg/m³: the snow's own where
 * it is loose, the groomer's sugar over its packed base. */
export function looseDensity(snow: Aged | undefined): number {
  if (!snow) return 150;
  const wet = wetOf(snow);
  return lerp(Math.min(snow.density, 220), snow.density, wet);
}

/** What one edge throws a second, kg/s, by source — the lab's reading and
 * the pool's emission. */
export type EdgeFlux = { cut: number; shove: number; lip: number; depth: number };

/** THE FLUX OFF ONE EDGE: `e` its slip (`edgeSlips`), `load` N on it,
 * `edge` rad tipped, `way` m/s along it, `sink` m into the snow, `packed`
 * the field's share. */
export function edgeFlux(
  e: Pick<EdgeSlip, "slide" | "tip" | "tail">,
  load: number,
  edge: number,
  way: number,
  sink: number,
  skid: number,
  packed: number,
  snow: Aged | undefined,
  out: EdgeFlux,
): EdgeFlux {
  const length = Math.hypot(e.tip.x - e.tail.x, e.tip.z - e.tail.z);
  const hv = hardnessOf(snow);
  const depth = edgeDepth(load, edge, length, hv) * (1 + MASS.skidDig * skid);
  out.depth = depth;
  const slide = Math.max(0, e.slide - MASS.slideFrom);
  const rho = snow ? snow.density : 480;
  // The packed base is cut where there is one under the ski.
  const base = Math.max(packed, snow && snow.loose < 0.5 ? 1 : 0);
  out.cut = MASS.cutFly * rho * depth * length * slide * base;
  // The loose layer the ski stands in: the engine's own sink where the
  // snow is loose, the groomer's sugar where it is packed (the sink on a
  // piste is the base pressed in, nothing loose to shove), none on ice.
  const loose = snow ? snow.loose : 0.14;
  const deep = clamp01((loose - 0.3) / 0.5);
  // (How much of the sunk depth is loose snow to throw goes with the
  // snow's own loose share: a thin layer over a crust, a deep fall.)
  const layer = lerp(Math.min(loose, 1) * MASS.sugar, sink * Math.min(1.6, loose), deep);
  const rl = looseDensity(snow);
  // Wet snow holds together: most of what a ski pushes through slush goes
  // into the berm in front of it.
  out.shove = MASS.shove * (1 - MASS.wetHold * wetOf(snow)) * rl * layer * length * slide;
  // A railed edge's groove and the sugar its tilted base sweeps, flicked
  // off the tail's lip — little off a carve on a groomer, as it should be.
  const theta = Math.min(1.3, Math.max(0.05, Math.abs(edge)));
  const groove = (rho * base * depth * depth) / (2 * Math.tan(theta));
  const sweep = rl * lerp(0.08, MASS.sweep, deep) * Math.sin(theta) * layer;
  // A flat ski cuts no groove and tips nothing out of it: the lip is an
  // edge set's.
  const set = clamp01((Math.abs(edge) - 0.15) / 0.3);
  out.lip = MASS.lip * set * (groove + sweep) * Math.abs(way) * Math.max(0, 1 - e.slide / 3);
  return out;
}
