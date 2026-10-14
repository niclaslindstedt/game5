// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WEIGHED SPRAY'S POOL — `spray-mass.ts`'s kilograms thrown off a
// skier as parcels and clumps (the emitter: the edge's cut and shove, the
// berm, the lip, the bow wave, the landing ring, a body's burst, a roost's
// fling), and the CPU's flight of them: quadratic drag against the air the
// parcel carries, landing on the snow and running on down it. Three-free.
//
// Every launch is stated once (`spray-flight.ts`'s `Launch`): the CPU pool
// flies it here step by step; handed a SINK (`createMassPool`'s `sink`) the
// pool flies nothing and the sink takes each launch — the GPU spray's ring
// (`gpu-spray.ts`), which flies it as a function of the clock.

import { rotate, windAt, type SkierState, type Wind } from "@engine";

import { stationOf } from "./ski-stand.ts";
import { fileTake, SNOW_TAKES } from "./snow-takes.ts";
import { emptyFlown, emptyLaunch, flyLaunch, type Launch } from "./spray-flight.ts";
import {
  clamp01,
  cutGrit,
  edgeFlux,
  lerp,
  looseDensity,
  looseGrit,
  MASS,
  settleSpeed,
  wetOf,
  type EdgeFlux,
  type Grit,
} from "./spray-mass.ts";
import {
  edgeSlips,
  emptySlip,
  type EdgeSlip,
  type SprayModel,
  type SprayPool,
  type SprayStats,
  type SprayWatch,
} from "./spray-sim.ts";

const G = 9.81;

/** The run's 10 m wind's share at a metre or so over the snow (the log
 * law's), which the parcels fly through. */
const WIND_AT_SNOW = 0.55;

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
    /** Every kilogram thrown out of the snow, dust and all (the berm's
     * shoved snow left out) — the hole's budget (`snow-takes.ts`). */
    taken: number;
  };
};

/** WHERE A POOL'S LAUNCHES GO when it flies none itself (the GPU ring):
 * `plane` fills a launch's snow plane, `take` keeps it, born `delay` s
 * from now. */
export type LaunchSink = {
  plane(l: Launch): void;
  take(l: Launch, delay: number): void;
};

export function createMassPool(
  capacity = 6000,
  watch: SprayWatch = {},
  sink?: LaunchSink,
): MassPool {
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
  const kilos = { cut: 0, shove: 0, bow: 0, lip: 0, burst: 0, dust: 0, berm: 0, taken: 0 };
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
  const launch = emptyLaunch();
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
    // THE LAUNCH, stated once (`spray-flight.ts`): what the CPU flies
    // below, and what a sink is handed.
    const l = launch;
    l.x = x;
    l.y = y;
    l.z = z;
    l.vx = vx;
    l.vy = vy;
    l.vz = vz;
    l.life = lifetime;
    l.mass = m;
    l.term = Math.max(0.05, settleSpeed(d, rho));
    l.berm = pushed;
    l.wx = wind.x * WIND_AT_SNOW;
    l.wz = wind.z * WIND_AT_SNOW;
    if (clump) {
      l.rad0 = d / 2;
      l.eddy = 0;
      l.area = 0;
      l.hard = 0.75 + 0.25 * random();
    } else {
      // A heavier parcel drawn larger, so its grains' opacity is the same.
      l.rad0 = MASS.radius * Math.sqrt(m / MASS.parcel);
      l.eddy = pushed ? MASS.berm.eddy : MASS.eddy * Math.hypot(vx, vy, vz);
      l.area = 1.5 / (rho * d);
      l.hard = Math.max(lumpy, 0.12 * random());
    }
    l.glint = glints * random();
    if (!pushed) {
      tally.thrown++;
      tally.launch += Math.hypot(vx, vy, vz);
    }
    if (sink) {
      sink.plane(l);
      sink.take(l, 0);
      // A CLUMP SPLASHES where it comes down (the CPU's below), thrown now
      // and born then.
      if (clump && !pushed && m > 0.0002) splashLater(l);
      return;
    }
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
    term[i] = l.term;
    // A berm's snow is on the snow from the first: it slides, never flies.
    down[i] = pushed ? 1 : 0;
    berm[i] = pushed ? 1 : 0;
    fell[i] = 0;
    rad0[i] = l.rad0;
    eddy[i] = l.eddy;
    area[i] = l.area;
    hard[i] = l.hard;
    size[i] = rad0[i] * 2;
    alpha[i] = 0;
    glint[i] = l.glint;
    ox[i] = x;
    oz[i] = z;
    peak[i] = 0;
    if (pushed) return;
    watch.launch?.(i, l);
    watch.spawn?.(i);
  }

  /** A launched clump's splash, for a sink: where `flyLaunch` brings it
   * down, its broken lumps thrown back up then (`MASS.splash`). */
  const flown = emptyFlown();
  const splash = emptyLaunch();
  function splashLater(l: Launch) {
    flyLaunch(l, l.life * 0.999, flown);
    const tl = flown.landed;
    if (tl < 0) return;
    flyLaunch(l, Math.max(0, tl - 1e-4), flown);
    const hit = Math.hypot(flown.vx, flown.vy, flown.vz);
    const bits = l.rad0 > 0.006 ? 3 : 2;
    const x = flown.x;
    const z = flown.z;
    const vx = flown.vx;
    const vz = flown.vz;
    const mass = l.mass;
    for (let b = 0; b < bits; b++) {
      const a = random() * Math.PI * 2;
      const sp = hit * MASS.splash * (0.4 + 0.6 * random());
      const s = splash;
      s.x = x;
      s.z = z;
      s.y = l.h0 + l.gx * (x - l.x) + l.gz * (z - l.z) + 0.03;
      s.vx = vx * 0.25 + Math.cos(a) * sp * 0.6;
      s.vy = sp * (0.5 + 0.5 * random());
      s.vz = vz * 0.25 + Math.sin(a) * sp * 0.6;
      s.life = 0.6;
      s.mass = (mass * 0.5) / bits;
      s.term = Math.max(0.05, settleSpeed(0.0008, 500));
      s.berm = false;
      s.wx = l.wx;
      s.wz = l.wz;
      s.rad0 = MASS.radius * Math.sqrt(s.mass / MASS.parcel);
      s.eddy = MASS.eddy * Math.hypot(s.vx, s.vy, s.vz);
      s.area = 1.5 / (500 * 0.0008);
      s.hard = 0.6;
      s.glint = glints * random();
      sink!.plane(s);
      sink!.take(s, tl);
    }
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
      // ONE SNOW BUDGET: this skier's takes filed for the hole (`snow-takes.ts`).
      const files = SNOW_TAKES.on && SNOW_TAKES.skier === skier;
      const rhoCut = snow ? snow.density : 480;
      const rhoLoose = looseDensity(snow);
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
        kilos.taken += cutKg + shoveKg + Math.max(0, lipKg);
        if (files) {
          // The edge's strip: the cut out of the base with its berm, the
          // shove and the lip out of the loose snow over it.
          const ax = e.across.x;
          const az = e.across.z;
          fileTake(
            e.tip.x,
            e.tip.z,
            e.tail.x,
            e.tail.z,
            half,
            false,
            ax,
            az,
            cutKg,
            rhoCut,
            Math.max(0, bermKg),
            rhoCut,
          );
          fileTake(
            e.tip.x,
            e.tip.z,
            e.tail.x,
            e.tail.z,
            half,
            false,
            ax,
            az,
            shoveKg + Math.max(0, lipKg),
            rhoLoose,
          );
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
        kilos.taken += bowKg;
        if (files) {
          // Out of the snow at the tips, back along the way he goes.
          const v = Math.hypot(vx0, vz0) || 1;
          const tips = tipA && tipB && tipA !== tipB ? [tipA, tipB] : [tipA ?? tipB];
          for (const c of tips) {
            if (!c) continue;
            const bx = c.x - (vx0 / v) * 0.5;
            const bz = c.z - (vz0 / v) * 0.5;
            fileTake(c.x, c.z, bx, bz, width / 4, false, 0, 0, bowKg / tips.length, rhoLoose);
          }
        }
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
        kilos.taken += kg;
        if (files) fileTake(skier.x, skier.z, skier.x, skier.z, 0.7, true, 0, 0, kg, rhoLoose);
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
      kilos.taken += kg;
      fileTake(x, z, x, z, 0.45, true, 0, 0, kg, looseDensity(snow));
    },
    step(dt, level) {
      clock += dt;
      if (sink) {
        windAt(level, clock, wind);
        return;
      }
      // The air the grains fly through: the run's wind at a metre or so
      // over the snow (the log law's share of the 10 m wind there).
      windAt(level, clock, wind);
      const wx = wind.x * WIND_AT_SNOW;
      const wz = wind.z * WIND_AT_SNOW;
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
      kilos.taken = 0;
      return out;
    },
  };
  return pool;
}
