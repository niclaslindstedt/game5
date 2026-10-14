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

import { rotate, windAt, type SkierState, type Wind } from "@engine";

import { stationOf } from "./ski-stand.ts";
import type { AgedSnow, SnowProps } from "./snowpack.ts";
import {
  edgeSlips,
  emptySlip,
  type EdgeSlip,
  type SprayModel,
  type SprayPool,
  type SprayStats,
  type SprayWatch,
} from "./spray-sim.ts";

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
  roll: { keep: 0.8, mu: 0.5, time: 0.45, clump: 0.7 },
  /** THE BERM: what the edge planes off and does not throw (1 − `cutFly`)
   * is the snow pressed up in front of the base — a wedge of it riding the
   * sliding ski as machining's dead zone rides a negative-rake tool — and
   * shoved on over the snow at the ski's own velocity (`carry`, least and
   * spread), sliding on down the slope (`roll`) when the ski lets it go:
   * the heap a stop pushes ahead of its skis. Drawn low, `life` s, its
   * parcels spreading at `eddy` m²/s. Never counted as thrown. */
  berm: { carry: [0.85, 0.2], life: 0.75, eddy: 0.0012 },
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

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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

/** The dust each skier threw last frame, kg/s — what `snow-cloud.ts`
 * scales its skid's wall by when the spray is weighed. */
const dustBy = new WeakMap<SkierState, number>();

/** THE DUST A SKIER THREW, kg/s (none known: undefined). */
export function dustOf(skier: SkierState): number | undefined {
  return dustBy.get(skier);
}

function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** A standard normal off two uniforms (Box–Muller). */
function normal(random: () => number): number {
  const u = Math.max(1e-9, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

export type MassPool = SprayPool & {
  /** Kilograms thrown since the last read (the lab's tally), by source. */
  weighed(): {
    cut: number;
    shove: number;
    bow: number;
    lip: number;
    burst: number;
    dust: number;
    berm: number;
  };
};

export function createMassPool(capacity = 6000, watch: SprayWatch = {}): MassPool {
  const pos = new Float32Array(capacity * 3);
  const vel = new Float32Array(capacity * 3);
  const age = new Float32Array(capacity);
  const life = new Float32Array(capacity);
  const size = new Float32Array(capacity);
  const alpha = new Float32Array(capacity);
  const hard = new Float32Array(capacity);
  const glint = new Float32Array(capacity);
  const term = new Float32Array(capacity);
  // A parcel's mass, kg; its radius at birth, m; the eddies' spread, m²/s;
  // its grains' projected area a kilogram, m²/kg (0 a clump: drawn whole);
  // whether it has come down.
  const mass = new Float32Array(capacity);
  const rad0 = new Float32Array(capacity);
  const eddy = new Float32Array(capacity);
  const area = new Float32Array(capacity);
  const down = new Uint8Array(capacity);
  const ox = new Float32Array(capacity);
  const oz = new Float32Array(capacity);
  const peak = new Float32Array(capacity);
  const fell = new Float32Array(capacity);
  const berm = new Uint8Array(capacity);
  let head = 0;
  let share = 1;
  let cap = capacity;
  let clock = 0;
  const random = makeRandom(0x5a17);
  const tally: SprayStats = { thrown: 0, launch: 0, high: 0, reach: 0, done: 0 };
  const kilos = { cut: 0, shove: 0, bow: 0, lip: 0, burst: 0, dust: 0, berm: 0 };
  const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };
  const cutG: Grit = {
    d50: 0,
    sigma: 0,
    rho: 0,
    clumps: 0,
    clumpD: [0, 0],
    clumpRho: 0,
    dust: 0,
  };
  const looseG: Grit = { ...cutG, clumpD: [0, 0] };
  const flux: EdgeFlux = { cut: 0, shove: 0, lip: 0, depth: 0 };
  let glints = 0.5;
  const slope = { x: 0, y: 1, z: 0 };

  function retire(i: number) {
    if (berm[i]) {
      life[i] = 0;
      alpha[i] = 0;
      size[i] = 0;
      berm[i] = 0;
      return;
    }
    // How far it came DOWN from where it was thrown: where it landed, not
    // where it slid on to after.
    const reach = down[i] ? fell[i] : Math.hypot(pos[i * 3] - ox[i], pos[i * 3 + 2] - oz[i]);
    tally.done++;
    tally.high += peak[i];
    tally.reach += reach;
    watch.retire?.(i, peak[i], reach);
    life[i] = 0;
    alpha[i] = 0;
    size[i] = 0;
  }

  /** One parcel (`grains` > 0: its grains' size, m, and density) or one
   * clump (`grains` 0, `d` its size), thrown at a velocity. */
  function spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    m: number,
    d: number,
    rho: number,
    clump: boolean,
    lifetime: number = MASS.life,
    lumpy = 0,
    pushed = false,
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
    mass[i] = m;
    term[i] = Math.max(0.05, settleSpeed(d, rho));
    // A berm's snow is on the snow from the first: it slides, never flies.
    down[i] = pushed ? 1 : 0;
    berm[i] = pushed ? 1 : 0;
    fell[i] = 0;
    if (clump) {
      rad0[i] = d / 2;
      eddy[i] = 0;
      area[i] = 0;
      hard[i] = 0.75 + 0.25 * random();
    } else {
      // A heavier parcel drawn larger, so its grains' opacity is the same.
      rad0[i] = MASS.radius * Math.sqrt(m / MASS.parcel);
      eddy[i] = pushed ? MASS.berm.eddy : MASS.eddy * Math.hypot(vx, vy, vz);
      area[i] = 1.5 / (rho * d);
      hard[i] = Math.max(lumpy, 0.12 * random());
    }
    size[i] = rad0[i] * 2;
    alpha[i] = 0;
    glint[i] = glints * random();
    ox[i] = x;
    oz[i] = z;
    peak[i] = 0;
    if (pushed) return;
    tally.thrown++;
    tally.launch += Math.hypot(vx, vy, vz);
    watch.spawn?.(i);
  }

  /** A grain size off a grit's lognormal. */
  const grainOf = (g: Grit) => g.d50 * Math.exp(g.sigma * normal(random));

  /** Throw `kg` of `grit` from a point `at(u)` (u 0..1 along the source)
   * with a velocity `kick(s, out)` (s 0..1, fast to slow), as parcels and
   * clumps; `owed` carries the fractions of a parcel and a clump over. */
  const kick = { x: 0, y: 0, z: 0 };
  const at = { x: 0, y: 0, z: 0 };
  function throwMass(
    kg: number,
    grit: Grit,
    owed: number[],
    slot: number,
    place: (u: number, out: typeof at) => void,
    launch: (s: number, out: typeof kick) => void,
    pushed = false,
  ) {
    if (kg <= 0) return;
    const parcel = MASS.parcel / Math.max(0.05, share);
    // THE GRAINS: whole parcels, one launch each.
    owed[slot] += (kg * (1 - grit.clumps - grit.dust)) / parcel;
    // Past the frame's count, more snow is drawn as MORE AND HEAVIER
    // parcels both (the count growing as the root of the excess), so a
    // deeper stop still reads as more.
    const most = MASS.perFrame * share;
    const due = Math.floor(owed[slot]);
    let n = due <= most ? due : Math.floor(Math.min(2.5 * most, most * Math.sqrt(due / most)));
    const each = n > 0 && due > most ? (owed[slot] * parcel) / n : parcel;
    owed[slot] = n > 0 && due > most ? 0 : owed[slot] - n;
    for (; n > 0; n--) {
      const s = random();
      place(random(), at);
      launch(s, kick);
      spawn(
        at.x,
        at.y,
        at.z,
        kick.x,
        kick.y,
        kick.z,
        each,
        grainOf(grit),
        grit.rho,
        false,
        pushed ? MASS.berm.life * (0.7 + 0.6 * random()) : MASS.life,
        0,
        pushed,
      );
    }
    // THE CLUMPS: each one whole.
    const d = grit.clumpD[0] + grit.clumpD[1] * random();
    const m = (grit.clumpRho * Math.PI * d * d * d) / 6;
    owed[slot + 1] += (kg * grit.clumps) / m;
    let c = Math.min(MASS.clumpsPerFrame * share, Math.floor(owed[slot + 1]));
    owed[slot + 1] -= Math.floor(owed[slot + 1]);
    for (; c > 0; c--) {
      const dc = grit.clumpD[0] + grit.clumpD[1] * random();
      const s = random();
      place(random(), at);
      // A clump leaves a little slower than the grains round it.
      launch(0.25 + 0.5 * s, kick);
      spawn(
        at.x,
        at.y,
        at.z,
        kick.x,
        kick.y,
        kick.z,
        m,
        dc,
        grit.clumpRho,
        true,
        pushed ? MASS.berm.life * (0.7 + 0.6 * random()) : MASS.life,
        0,
        pushed,
      );
    }
  }

  let debt = new WeakMap<SkierState, number[]>();
  const slips: [EdgeSlip, EdgeSlip] = [emptySlip(), emptySlip()];
  let model: SprayModel = "mass";

  const pool: MassPool = {
    capacity,
    pos,
    vel,
    size,
    alpha,
    hard,
    glint,
    age,
    term,
    get cap() {
      return cap;
    },
    get model() {
      return model;
    },
    set model(next: SprayModel) {
      model = next;
    },
    fling(x, y, z, vx, vy, vz, lifetime, s, h) {
      if (random() > share) return;
      // A roost's lump: a clump if hard, a parcel of grains if not.
      const clump = h > 0.5;
      spawn(
        x,
        y,
        z,
        vx,
        vy,
        vz,
        clump ? 0.01 : MASS.parcel,
        clump ? s : 0.0012,
        clump ? 450 : 250,
        clump,
        lifetime * 1.4,
      );
    },
    emit(skier, level, dt, landed, snow) {
      let owed = debt.get(skier);
      if (!owed) {
        owed = new Array(20).fill(0);
        debt.set(skier, owed);
      }
      glints = Math.min(1, (snow ? snow.sparkle : 0.5) + (snow?.flake ?? 0));
      cutGrit(snow, cutG);
      looseGrit(snow, looseG);
      const n = edgeSlips(skier, slips);
      const board = skier.contacts.length === 4;
      let dust = 0;
      const vx0 = skier.vx;
      const vz0 = skier.vz;
      for (let k = 0; k < n; k++) {
        const e = slips[k];
        if (e.share <= 0) continue;
        // The load on this edge and how deep it runs in the snow.
        let load = 0;
        let sink = 0;
        for (const c of skier.contacts) {
          if (!c.touching || (!board && c.side !== (k === 0 ? -1 : 1))) continue;
          load += c.load;
          sink = Math.max(sink, c.sink);
        }
        // The turn's split of the weight lies over the engine's own (the
        // outside ski carries him — `ski-stand.ts`).
        const total = skier.contacts.reduce((a, c) => a + (c.touching ? c.load : 0), 0);
        if (!board) load = total * e.share;
        const way = vx0 * e.along.x + vz0 * e.along.z;
        edgeFlux(e, load, skier.edge, way, sink, skier.skid, skier.packed, snow, flux);
        const theta = Math.min(1.3, Math.abs(skier.edge));
        const wet = wetOf(snow);
        const powder = clamp01(((snow ? snow.loose : 0.14) - 0.3) / 0.5);
        // New snow is so light the base lifts it off almost straight up.
        const light = clamp01((220 - (snow ? snow.density : 480)) / 140);
        const slide = e.slide;
        // THE CUT AND THE SHOVE leave FROM UNDER THE BASE, ITS LEADING
        // HALF — between the ski's line and the edge it slides toward —
        // down at the snow, along the ski from near its tip to its tail.
        const half = board ? 0.13 : 0.5 * skier.spec.waist;
        const place = (u: number, out: typeof at) => {
          const v = 0.1 + 0.85 * u;
          const lead = half * random();
          out.x = e.tip.x + (e.tail.x - e.tip.x) * v + e.across.x * lead;
          out.y = e.tip.y + (e.tail.y - e.tip.y) * v + 0.01;
          out.z = e.tip.z + (e.tail.z - e.tip.z) * v + e.across.z * lead;
        };
        // And go FORWARD, THE WAY THE SKI SLIDES (`MASS.push`, `.rake`):
        // the slide the snow ahead is brought up to, plus its flow up the
        // base tipped `tilt` off the snow — low and fast where it was
        // shoved hardest, a little steeper and slower behind it; loose
        // snow rides further up the base (`steep`), powder off it faster.
        const sideKick = (steep: number, fast: number) => (s: number, out: typeof kick) => {
          const tilt = Math.min(1.3, Math.max(0.5, theta) + steep);
          // (Slush sticks: wet snow leaves slower, short and heavy.)
          const pushed = slide * (MASS.push[0] + MASS.push[1] * s) * (1 - 0.25 * wet);
          const flow =
            slide * MASS.rake * fast * Math.max(0.2, 1.05 - 0.75 * s + 0.15 * normal(random));
          const ahead = pushed + flow * Math.cos(tilt);
          const fan = 0.16 * ahead * normal(random);
          const carry = way * (0.6 + 0.3 * random());
          out.x = e.across.x * ahead + e.along.x * (carry + fan);
          out.y = flow * Math.sin(tilt) + skier.vy * 0.3;
          out.z = e.across.z * ahead + e.along.z * (carry + fan);
        };
        const cutKg = flux.cut * dt;
        const shoveKg = flux.shove * dt;
        throwMass(cutKg, cutG, owed, 4 * k, place, sideKick(0, 1));
        throwMass(
          shoveKg,
          looseG,
          owed,
          4 * k + 2,
          place,
          sideKick(
            MASS.steep * (0.5 + 0.5 * powder) * (1 - 0.6 * wet) * (1 + 0.6 * light),
            1 + 1.5 * powder * (1 - wet),
          ),
        );
        kilos.cut += cutKg * (1 - cutG.dust);
        // THE BERM pressed up ahead of the base and shoved on with the ski.
        const bermKg = (cutKg * (1 - MASS.cutFly)) / MASS.cutFly;
        if (bermKg > 0) {
          const front = (u: number, out: typeof at) => {
            place(u, out);
            out.x += e.across.x * (half + 0.06 * random());
            out.z += e.across.z * (half + 0.06 * random());
          };
          const shoved = (s: number, out: typeof kick) => {
            const c = MASS.berm.carry[0] + MASS.berm.carry[1] * s;
            out.x = vx0 * c;
            out.y = 0;
            out.z = vz0 * c;
          };
          throwMass(bermKg, cutG, owed, 16 + 2 * k, front, shoved, true);
          kilos.berm += bermKg;
        }
        kilos.shove += shoveKg * (1 - looseG.dust);
        dust += flux.cut * cutG.dust + flux.shove * looseG.dust;
        // THE LIP off a railed tail: out of the arc and up, off its rear third.
        const lipKg = flux.lip * dt;
        if (lipKg > 0) {
          const outSide = -Math.sign(skier.edge || 1);
          const tailAt = (u: number, out: typeof at) => {
            const v = 0.7 + 0.3 * u;
            out.x = e.tip.x + (e.tail.x - e.tip.x) * v;
            out.y = e.tip.y + (e.tail.y - e.tip.y) * v + 0.03;
            out.z = e.tip.z + (e.tail.z - e.tip.z) * v;
          };
          // The groove's snow is at rest on the hill: the sidewall shoves
          // it out at the tail's own slip, slow, and drags it a little along.
          const lipKick = (s: number, out: typeof kick) => {
            const sp =
              (0.8 + lerp(0.1, 0.3, powder) * Math.abs(way)) * Math.sin(theta) * (0.4 + 0.6 * s);
            const k2 = rotate(skier.q, {
              x: outSide * sp * (0.7 + 0.3 * random()),
              y: sp * (0.9 - 0.4 * s) + 0.3,
              z: -sp * 0.3 * random(),
            });
            out.x = vx0 * (0.08 + 0.1 * random()) + k2.x;
            out.y = k2.y;
            out.z = vz0 * (0.08 + 0.1 * random()) + k2.z;
          };
          throwMass(lipKg, looseG, owed, 8 + (k % 2) * 2, tailAt, lipKick);
          kilos.lip += lipKg;
          dust += flux.lip * looseG.dust;
        }
      }
      // THE BOW WAVE off tips running deep through loose snow.
      const tipA = board ? skier.contacts[0] : stationOf(skier.contacts, 0, 0);
      const tipB = board ? skier.contacts[0] : stationOf(skier.contacts, 1, 0);
      const deep = Math.max(tipA?.touching ? tipA.sink : 0, tipB?.touching ? tipB.sink : 0);
      if (deep > 0.04 && skier.speed > 3 && !skier.airborne) {
        const width = board ? 0.26 : 2 * skier.spec.waist;
        const flow = looseDensity(snow) * width * deep * skier.speed;
        const bowKg = MASS.bow * flow * Math.min(1, skier.speed / 12) * dt;
        const tipAt = (u: number, out: typeof at) => {
          const c = (u < 0.5 ? tipA : tipB) ?? tipA!;
          out.x = c.x + (random() - 0.5) * 0.15;
          out.y = c.y + 0.08;
          out.z = c.z + (random() - 0.5) * 0.15;
        };
        const bowKick = (s: number, out: typeof kick) => {
          const sp = skier.speed;
          const k2 = rotate(skier.q, {
            x: (random() - 0.5) * 0.4 * sp,
            y: sp * (0.25 + 0.35 * (1 - s)),
            z: -sp * (0.15 + 0.3 * s),
          });
          out.x = vx0 + k2.x;
          out.y = skier.vy * 0.3 + k2.y;
          out.z = vz0 + k2.z;
        };
        throwMass(bowKg, looseG, owed, 12, tipAt, bowKick);
        kilos.bow += bowKg;
        dust += (bowKg / Math.max(dt, 1e-6)) * looseG.dust;
      }
      // THE LANDING: the skis and the body coming down into the snow
      // shove out what lies under them — a ring.
      if (landed > 0) {
        const layer = Math.max(
          deep,
          (snow ? Math.min(snow.loose, 1.5) : 0.14) *
            (snow && snow.loose > 0.5 ? 0.25 : MASS.sugar),
        );
        const kg = 0.25 * looseDensity(snow) * 1.6 * layer * Math.min(3, landed / 4);
        const ground = level.groundAt(skier.x, skier.z);
        const ringAt = (_u: number, out: typeof at) => {
          const a = random() * Math.PI * 2;
          out.x = skier.x + Math.cos(a) * 0.5;
          out.y = ground + 0.05;
          out.z = skier.z + Math.sin(a) * 0.9;
          kick.x = Math.cos(a);
          kick.z = Math.sin(a);
        };
        const ringKick = (s: number, out: typeof kick) => {
          const sp = landed * MASS.splash * (0.4 + 0.9 * s);
          out.x = out.x * sp + vx0 * 0.6;
          out.y = sp * (1.1 - 0.5 * s);
          out.z = out.z * sp + vz0 * 0.6;
        };
        throwMass(kg, looseG, owed, 14, ringAt, ringKick);
        kilos.burst += kg;
        dust += (kg / Math.max(dt, 1e-6)) * looseG.dust * 0.2;
      }
      kilos.dust += dust * dt;
      dustBy.set(skier, dust);
    },
    burst(x, y, z, vx, vz, s, snow) {
      // A BODY GOING IN: what it shoves out of the snow it lands in — a
      // body's footprint pressed in as deep as the snow lets it, a third of
      // it thrown up and out, carried on with the body.
      const loose = snow ? snow.loose : 0.5;
      const layer = Math.min(0.5, loose > 0.5 ? 0.12 + 0.18 * Math.min(1.5, loose) : 0.025);
      const kg = 0.33 * looseDensity(snow) * 0.6 * layer * (0.3 + 1.2 * s);
      looseGrit(snow, looseG);
      const owed = [0, 0];
      const g = y;
      const speed = Math.hypot(vx, vz);
      const ringAt = (_u: number, out: typeof at) => {
        const a = random() * Math.PI * 2;
        const r = 0.45 * Math.sqrt(random());
        out.x = x + Math.cos(a) * r;
        out.y = g + 0.05 + random() * 0.25;
        out.z = z + Math.sin(a) * r;
        kick.x = Math.cos(a);
        kick.z = Math.sin(a);
      };
      const ringKick = (q: number, out: typeof kick) => {
        const sp = (1.2 + 0.35 * speed) * (0.35 + 0.9 * q) * (0.6 + 0.6 * s);
        out.x = out.x * sp * 0.8 + vx * 0.45;
        out.y = sp * (1.15 - 0.55 * q);
        out.z = out.z * sp * 0.8 + vz * 0.45;
      };
      throwMass(kg, looseG, owed, 0, ringAt, ringKick);
      kilos.burst += kg;
    },
    step(dt, level) {
      clock += dt;
      // The air the grains fly through: the run's wind at a metre or so
      // over the snow (the log law's share of the 10 m wind there).
      windAt(level, clock, wind);
      const wx = wind.x * 0.55;
      const wz = wind.z * 0.55;
      for (let i = 0; i < cap; i++) {
        if (life[i] <= 0) continue;
        age[i] += dt;
        const t = age[i] / life[i];
        if (t >= 1) {
          retire(i);
          continue;
        }
        const k = i * 3;
        if (!down[i]) {
          // QUADRATIC DRAG against the air, set by the parcel's own fall
          // speed (implicit, so a fine grain stops at once and stays put) —
          // and against the air the parcel CARRIES WITH IT: a fresh curtain
          // is grains packed so close (its mass loading φ, its grains over
          // the air in its own volume) that the air between them goes with
          // them, and the drag on each falls as (1 + φ)². The sheet flies as
          // one until it has spread thin, then each grain stalls on its own.
          const vt = term[i];
          const rx = vel[k] - wx;
          const ry = vel[k + 1];
          const rz = vel[k + 2] - wz;
          const sp = Math.hypot(rx, ry, rz);
          let phi = 0;
          if (area[i] > 0) {
            const r = rad0[i] + Math.sqrt(2 * MASS.sheet * eddy[i] * age[i]);
            phi = mass[i] / (MASS.air.rho * MASS.carried * 4.19 * r * r * r);
          }
          const keep = 1 / (1 + ((G / (vt * vt)) * sp * dt) / ((1 + phi) * (1 + phi)));
          vel[k] = wx + rx * keep;
          vel[k + 1] = ry * keep - G * dt;
          vel[k + 2] = wz + rz * keep;
          pos[k] += vel[k] * dt;
          pos[k + 1] += vel[k + 1] * dt;
          pos[k + 2] += vel[k + 2] * dt;
        }
        const gnd = level.groundAt(pos[k], pos[k + 2]);
        const over = pos[k + 1] - gnd;
        if (over > peak[i]) peak[i] = over;
        if (!down[i] && over < 0.02) {
          down[i] = 1;
          fell[i] = Math.hypot(pos[k] - ox[i], pos[k + 2] - oz[i]);
          pos[k + 1] = gnd + 0.02;
          // A CLUMP SPLASHES: broken into grains thrown back up at a third
          // of the speed it came in at, the way grains off a snow bed are.
          if (area[i] === 0 && mass[i] > 0.0002) {
            const hit = Math.hypot(vel[k], vel[k + 1], vel[k + 2]);
            const bits = rad0[i] > 0.006 ? 3 : 2;
            for (let b = 0; b < bits; b++) {
              const a = random() * Math.PI * 2;
              const sp = hit * MASS.splash * (0.4 + 0.6 * random());
              spawn(
                pos[k],
                gnd + 0.03,
                pos[k + 2],
                vel[k] * 0.25 + Math.cos(a) * sp * 0.6,
                sp * (0.5 + 0.5 * random()),
                vel[k + 2] * 0.25 + Math.sin(a) * sp * 0.6,
                (mass[i] * 0.5) / bits,
                0.0008,
                500,
                false,
                0.6,
                // Broken lumps of the clump, drawn lumpy.
                0.6,
              );
            }
          }
          // WHAT LANDS RUNS ON (`MASS.roll`): a share of its speed along
          // the snow kept, then gone in a moment — lying on the snow, it is
          // the snow.
          vel[k] *= MASS.roll.keep;
          vel[k + 2] *= MASS.roll.keep;
          vel[k + 1] = 0;
          life[i] = Math.min(life[i], age[i] + (area[i] === 0 ? MASS.roll.clump : MASS.roll.time));
        } else if (down[i]) {
          // Sliding on down the fall line: the slope's pull along the snow
          // (gravity's share off the normal) against the snow's friction.
          level.normalAt(pos[k], pos[k + 2], slope);
          let vx = vel[k] + G * slope.y * slope.x * dt;
          let vz = vel[k + 2] + G * slope.y * slope.z * dt;
          const sp = Math.hypot(vx, vz);
          const brake = MASS.roll.mu * G * slope.y * dt;
          const keep = sp > brake ? (sp - brake) / sp : 0;
          vx *= keep;
          vz *= keep;
          vel[k] = vx;
          vel[k + 2] = vz;
          pos[k] += vx * dt;
          pos[k + 2] += vz * dt;
          pos[k + 1] = level.groundAt(pos[k], pos[k + 2]) + 0.02;
        }
        // THE PARCEL SPREADS: its radius grows as the eddies mix it, its
        // grains' area over its disc its optical depth.
        const r = rad0[i] + Math.sqrt(2 * eddy[i] * age[i]);
        size[i] = 2 * r;
        const fade = Math.min(1, age[i] * 40) * (t > 0.8 ? (1 - t) / 0.2 : 1);
        if (area[i] > 0) {
          const tau = (MASS.optics * mass[i] * area[i]) / (Math.PI * r * r);
          alpha[i] = (1 - Math.exp(-tau)) * fade;
        } else {
          alpha[i] = fade;
        }
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
    weighed() {
      const out = { ...kilos };
      kilos.cut = kilos.shove = kilos.bow = kilos.lip = kilos.burst = kilos.dust = kilos.berm = 0;
      return out;
    },
  };
  return pool;
}
