// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SKIER THROWS, FLOWN ON THE GPU. The CPU decides what leaves the
// snow and writes each particle ONCE into a ring of instance slots — where,
// how fast, how big, what it is, the plane of the snow under it — and never
// touches it again: the vertex shader flies it off the clock, lands it on
// the snow and lies it there (`gpu-spray-glsl.ts`). A frame costs the CPU
// only what was thrown that frame, and the GPU is sent only those slots, so
// the pool can hold some six times what the CPU pool (`spray-sim.ts`) can
// fly for the same frame.
//
// THREE KINDS OF SNOW IN THE AIR, each a sprite of its own:
//
//   * GRAINS — the chips an edge shaves off and the fan off a carving tail,
//     streaked along their motion, arcing at two to five metres a second of
//     fall speed, landing and lying a few seconds as a sprinkle of glints;
//   * CLUMPS and PLATES — packed lumps and a crust's shards, flown nearly as
//     stones, landing, rolling a hand and lying as lumps with their own
//     shadows: the fan of broken snow a hockey stop leaves on a groomer and
//     the debris round a fall;
//   * THE VEIL — big soft lit puffs off every row of chips and off powder,
//     falling at half a metre a second, swelling and carried by the wind,
//     the body of the curtain a turn throws, glowing against a low sun.
//
// What the edge cuts and how hard it slides is the CPU pool's own reading
// of the skier (`edgeSlips`, `cutShare`, `heavyShare`); how much of each
// kind a snow gives is `snowpack.ts`'s. The fine powder that hangs for
// seconds is `snow-cloud.ts`'s.

import * as THREE from "three";
import { rotate, type Level, type SkierState } from "@engine";

import { gpuSprayFragment, GPU_SPRAY_VERTEX } from "./gpu-spray-glsl.ts";
import { SKY_GLSL, type HazeUniforms } from "./haze.ts";
import { SHELTER, SHELTER_GLSL } from "./shelter.ts";
import { stationOf } from "./ski-stand.ts";
import type { AgedSnow, SnowProps } from "./snowpack.ts";
import type { Spray } from "./spray.ts";
import { cutShare, edgeSlips, emptySlip, heavyShare, type EdgeSlip } from "./spray-sim.ts";
import { SPRAY_STATS } from "./spray-stats.ts";
import { LOOSE } from "./trail-stamp.ts";

/** THE GPU SPRAY'S NUMBERS — picture, set by looking (`make snow-eval`). */
export const GPU_SPRAY = {
  /** The ring's slots at the HIGH picture (the SPRAY row's share of it). */
  capacity: 36000,
  /** Grains a second per metre of edge per m/s it slides across, at a whole
   * cut share — some three times the CPU pool's. */
  sheetRate: 340,
  /** The slide under which an edge cuts nothing worth seeing, m/s. */
  sheetFrom: 1,
  /** The grains' speed off the edge as a share of the slide (min, spread)
   * and their rise off the snow, rad (min, spread). */
  shove: [0.7, 0.6],
  rise: [0.22, 0.62],
  /** The fan's spread across the slide, a share of the grains' speed. */
  fan: 0.36,
  /** Veil puffs thrown with every hundred grains, by the snow's fine share. */
  veil: 16,
  /** Grains a second off a carving tail at a full edge, per m/s of speed. */
  tailRate: 46,
  /** Powder off the tips running deep, grains a second at full depth. */
  powder: 900,
  /** How long each kind may fly, s (min, spread). */
  life: [0.7, 0.7],
  veilLife: [0.9, 0.9],
  /** How long each kind lies on the snow once down, s, on the groomer —
   * loose snow swallows it sooner. */
  restGrain: 4,
  restClump: 16,
  /** The snow cloud's skid wall left beside this spray, as shares of its
   * rate and opacity: the veil flies the near wall, the cloud only the
   * long drift behind it. */
  cloudWall: [0.4, 0.6] as const,
  /** Sizes, m (min, spread). */
  grain: [0.02, 0.035],
  clump: [0.05, 0.08],
  puff: [0.12, 0.16],
  /** The fall speeds the air holds each to, m/s (min, spread). */
  fallGrain: [3.5, 2.5],
  fallClump: [6, 4],
  fallVeil: [0.45, 0.4],
} as const;

/** What the age of the snow adds to what it throws. */
type Aged = SnowProps & Partial<Pick<AgedSnow, "plates" | "heavy" | "flake">>;

/** The kinds as the shader reads `aKind.y`: 0 the veil, a grain under ½, a
 * clump at ½ and over (its hardness). */
const VEIL = 0;

function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function createGpuSpray(haze: HazeUniforms): Spray {
  const capacity: number = GPU_SPRAY.capacity;
  const a0 = new Float32Array(capacity * 4);
  const a1 = new Float32Array(capacity * 4);
  const a2 = new Float32Array(capacity * 4);
  const a3 = new Float32Array(capacity * 4);
  // Every slot born long ago: dead until written.
  for (let i = 0; i < capacity; i++) a0[i * 4 + 3] = -1e6;
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const attrs = [a0, a1, a2, a3].map((a) =>
    new THREE.InstancedBufferAttribute(a, 4).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute("aSpot", attrs[0]);
  geometry.setAttribute("aMove", attrs[1]);
  geometry.setAttribute("aKind", attrs[2]);
  geometry.setAttribute("aPlane", attrs[3]);
  geometry.instanceCount = 0;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...haze,
      uLit: { value: new THREE.Color(1, 1, 1) },
      uShade: { value: new THREE.Color(0.6, 0.7, 0.9) },
      uScale: { value: 600 },
      uShutter: { value: 0.04 },
      uNow: { value: 0 },
      uWind: { value: new THREE.Vector3() },
      ...SHELTER,
    },
    vertexShader: GPU_SPRAY_VERTEX,
    fragmentShader: gpuSprayFragment(SKY_GLSL, SHELTER_GLSL),
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;

  let now = 0;
  let share = 1;
  let cap = capacity;
  let head = 0;
  // The highest slot ever written: the draw never pays for slots past it.
  let used = 0;
  // The slots written since the last upload, as a run from `dirtyFrom`.
  let dirtyFrom = -1;
  let dirtyCount = 0;
  let wrote = 0;
  const random = makeRandom(0x5eed1);
  let level: Level | null = null;
  const n = { x: 0, y: 1, z: 0 };

  function flush() {
    if (dirtyCount <= 0) return;
    for (const at of attrs) {
      at.addUpdateRange(dirtyFrom * 4, dirtyCount * 4);
      at.needsUpdate = true;
    }
    dirtyFrom = -1;
    dirtyCount = 0;
  }

  /** WRITE ONE PARTICLE. `kind` 0 the veil, a grain under ½, a clump ½..1. */
  function put(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    kind: number,
    fall: number,
    rest: number,
    glint: number,
  ) {
    const i = head;
    head = (head + 1) % cap;
    if (i + 1 > used) used = i + 1;
    // A run of slots per upload: a wrap starts a second run, so flush the first.
    if (dirtyFrom >= 0 && i !== dirtyFrom + dirtyCount) flush();
    if (dirtyFrom < 0) dirtyFrom = i;
    dirtyCount++;
    wrote++;
    const k = i * 4;
    a0[k] = x;
    a0[k + 1] = y;
    a0[k + 2] = z;
    a0[k + 3] = now;
    a1[k] = vx;
    a1[k + 1] = vy;
    a1[k + 2] = vz;
    a1[k + 3] = life;
    a2[k] = size;
    a2[k + 1] = kind;
    a2[k + 2] = fall;
    a2[k + 3] = rest;
    // The snow's plane under it: its height where it was thrown, its slope.
    let h = y - 0.05;
    let gx = 0;
    let gz = 0;
    if (level) {
      level.normalAt(x, z, n);
      const ny = Math.max(n.y, 0.2);
      gx = -n.x / ny;
      gz = -n.z / ny;
      h = level.groundAt(x, z) + LOOSE * (1 - level.packedAt(x, z));
    }
    a3[k] = gx;
    a3[k + 1] = gz;
    a3[k + 2] = h;
    a3[k + 3] = glint;
  }

  // What the snow being thrown is like, set at the top of each emission.
  let fineNow = 0.6;
  let heavyNow = 0;
  let looseNow = 1;
  /** How long a thing lies once down: loose snow swallows it soon. */
  let restScale = 1;
  const restOf = (clump: boolean) =>
    ((clump ? GPU_SPRAY.restClump : GPU_SPRAY.restGrain) * restScale) /
    (1 + 9 * Math.max(0, looseNow - 0.2));

  /** One grain or clump: `hard` 0..1 how much of a lump it is. */
  function grain(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    hard: number,
    plate: boolean,
    glint: number,
  ) {
    const clump = hard >= 0.5;
    const r = random();
    const size = clump
      ? (GPU_SPRAY.clump[0] + GPU_SPRAY.clump[1] * r) * (plate ? 1.3 : 1)
      : GPU_SPRAY.grain[0] + GPU_SPRAY.grain[1] * r;
    const fall = clump
      ? GPU_SPRAY.fallClump[0] + GPU_SPRAY.fallClump[1] * random() + 3 * heavyNow
      : GPU_SPRAY.fallGrain[0] + GPU_SPRAY.fallGrain[1] * random() + 2 * heavyNow;
    put(
      x,
      y,
      z,
      vx,
      vy,
      vz,
      (GPU_SPRAY.life[0] + GPU_SPRAY.life[1] * random()) * (1 - 0.3 * heavyNow),
      size,
      clump ? Math.max(0.5, hard) : Math.min(0.45, 0.05 + hard),
      fall,
      restOf(clump),
      plate ? Math.min(1, glint * 1.5) : glint * random(),
    );
  }

  /** One puff of the veil, thinned out of wet snow. */
  function puff(x: number, y: number, z: number, vx: number, vy: number, vz: number, big = 1) {
    if (random() < heavyNow * 0.8) return;
    put(
      x,
      y,
      z,
      vx,
      vy,
      vz,
      GPU_SPRAY.veilLife[0] + GPU_SPRAY.veilLife[1] * random(),
      (GPU_SPRAY.puff[0] + GPU_SPRAY.puff[1] * random()) * big,
      VEIL,
      GPU_SPRAY.fallVeil[0] + GPU_SPRAY.fallVeil[1] * random(),
      0,
      0,
    );
  }

  const debt = new WeakMap<SkierState, number[]>();
  const slips: [EdgeSlip, EdgeSlip] = [emptySlip(), emptySlip()];

  function emit(skier: SkierState, lv: Level, dt: number, landed: number, snow?: Aged) {
    level = lv;
    let owed = debt.get(skier);
    if (!owed) {
      owed = [0, 0, 0, 0, 0];
      debt.set(skier, owed);
    }
    const powder = heavyShare(snow, skier.packed);
    const cut = cutShare(snow, skier.packed);
    const clumps = snow ? snow.clumps : 0.25;
    const base = snow ? Math.min(1, snow.loose * 5) : 1;
    const plates = snow?.plates ?? 0;
    const heavy = snow?.heavy ?? 0;
    const glints = Math.min(1, (snow ? snow.sparkle : 0.5) + (snow?.flake ?? 0));
    const deep = snow ? Math.min(1, Math.max(0, snow.loose - 0.8) / 1.2) : 0;
    const lift = snow ? Math.min(1.5, Math.max(0, snow.loose - 0.14)) : 0;
    fineNow = snow ? snow.fine : 0.6;
    heavyNow = heavy;
    looseNow = snow ? Math.min(1, snow.loose) : 1;
    const slow = 1 - 0.35 * heavy;
    const flat = 1 - 0.3 * heavy;
    const edge = Math.min(1, Math.abs(skier.edge) / 0.9);
    const count = edgeSlips(skier, slips);
    const outSide = -Math.sign(skier.edge || 1);
    const veilShare = (GPU_SPRAY.veil / 100) * fineNow * (0.4 + 0.6 * Math.min(1, looseNow * 2));
    for (let k = 0; k < count; k++) {
      const e = slips[k];
      if (e.share <= 0) continue;
      const length = Math.hypot(e.tip.x - e.tail.x, e.tip.z - e.tail.z);
      // THE EDGE'S SHEET, thrown in rows that leave together.
      const slide = Math.max(0, e.slide - GPU_SPRAY.sheetFrom);
      owed[k] +=
        GPU_SPRAY.sheetRate *
        length *
        slide *
        cut *
        e.share *
        share *
        2 *
        (0.55 + 0.45 * edge) *
        dt;
      const way = skier.vx * e.along.x + skier.vz * e.along.z;
      const row = Math.floor(owed[k]);
      if (row > 0) {
        owed[k] -= row;
        const fs = random();
        const fr = random();
        let veilOwed = random();
        for (let j = 0; j < row; j++) {
          const u = 0.12 + (0.88 * (j + random())) / row;
          const x = e.tip.x + (e.tail.x - e.tip.x) * u;
          const y = e.tip.y + (e.tail.y - e.tip.y) * u;
          const z = e.tip.z + (e.tail.z - e.tip.z) * u;
          const s1 = Math.min(1, Math.max(0, fs + (random() - 0.5) * 0.35));
          const s2 = Math.min(1, Math.max(0, fr + (random() - 0.5) * 0.3));
          const sp =
            e.slide * (GPU_SPRAY.shove[0] + GPU_SPRAY.shove[1] * s1) * slow * (1 + 0.15 * lift);
          const rise = Math.min(
            1.25,
            (GPU_SPRAY.rise[0] + GPU_SPRAY.rise[1] * (0.4 * edge + 0.6 * s2)) * flat + 0.25 * lift,
          );
          const out = sp * Math.cos(rise);
          const side = (((j + 0.5) / row - 0.5) * 2 + (random() - 0.5) * 0.4) * GPU_SPRAY.fan * sp;
          const up = sp * Math.sin(rise);
          const along = way * (0.35 + 0.3 * random()) + side;
          const vx = e.across.x * out + e.along.x * along;
          const vy = up + skier.vy * 0.3;
          const vz = e.across.z * out + e.along.z * along;
          const r = random();
          const plate = r < plates * 0.45;
          const big = plate || r < plates * 0.45 + clumps * clumps * 0.6;
          grain(
            x + e.across.x * 0.06,
            y + 0.03,
            z + e.across.z * 0.06,
            vx,
            vy,
            vz,
            big ? 0.6 + 0.4 * random() : clumps * 0.4 * random(),
            plate,
            glints,
          );
          // The veil leaves with the row, slower: the curtain's body.
          veilOwed += veilShare;
          if (veilOwed >= 1) {
            veilOwed -= 1;
            puff(x, y + 0.08, z, vx * 0.55, vy * 0.6 + 0.3, vz * 0.55, 0.8 + 0.5 * e.share);
          }
        }
      }
      // THE CARVE'S TAIL: the groove's lip flicked off a railed tail.
      const carving = Math.max(0, 1 - e.slide / 3);
      owed[2 + k] +=
        GPU_SPRAY.tailRate *
        edge *
        edge *
        carving *
        skier.speed *
        (0.3 * base + powder) *
        e.share *
        share *
        (count === 1 ? 3 : 2) *
        dt;
      while (owed[2 + k] >= 1) {
        owed[2 + k] -= 1;
        const kick = rotate(skier.q, {
          x: outSide * (0.6 + random() * 1.6 + 1.2 * edge) * slow,
          y: (0.7 + random() * (1.2 + 1.4 * edge)) * slow + deep,
          z: -0.4 - random() * 1.2,
        });
        const u = 0.65 + 0.35 * random();
        const x = e.tip.x + (e.tail.x - e.tip.x) * u;
        const y = e.tip.y + (e.tail.y - e.tip.y) * u + 0.04;
        const z = e.tip.z + (e.tail.z - e.tip.z) * u;
        const vx = skier.vx * 0.35 + kick.x;
        const vy = skier.vy * 0.3 + kick.y;
        const vz = skier.vz * 0.35 + kick.z;
        grain(x, y, z, vx, vy, vz, clumps * random() * 0.6, false, glints);
        if (random() < veilShare * 1.5) puff(x, y, z, vx * 0.5, vy * 0.5, vz * 0.5, 0.7);
      }
    }
    // THE POWDER OVER THE SHOULDER, off the tips running deep.
    const board = skier.contacts.length === 4;
    const tipA = board ? skier.contacts[0] : stationOf(skier.contacts, 0, 0);
    const tipB = board ? skier.contacts[0] : stationOf(skier.contacts, 1, 0);
    const sunk = Math.max(tipA?.sink ?? 0, tipB?.sink ?? 0);
    if (sunk > 0.06 && skier.speed > 4 && !skier.airborne) {
      owed[4] +=
        Math.min(1, sunk / 0.35) *
        Math.min(1, skier.speed / 15) *
        GPU_SPRAY.powder *
        powder *
        share *
        dt;
      while (owed[4] >= 1) {
        owed[4] -= 1;
        const c = random() < 0.5 ? tipA : tipB;
        if (!c) continue;
        const kick = rotate(skier.q, {
          x: (random() - 0.5) * (board ? 3 : 2) + outSide * edge * (1 + 2 * random()),
          y: (2 + random() * 3) * slow * (1 + 0.4 * deep),
          z: -(1.5 + random() * 3) * slow,
        });
        const x = c.x + (random() - 0.5) * 0.25;
        const z = c.z + (random() - 0.5) * 0.25;
        const vx = skier.vx * 0.6 + kick.x;
        const vy = skier.vy * 0.4 + kick.y;
        const vz = skier.vz * 0.6 + kick.z;
        if (random() < 0.55 * fineNow) puff(x, c.y + 0.15, z, vx, vy, vz, 2);
        else grain(x, c.y + 0.1, z, vx, vy, vz, clumps * random(), false, glints);
      }
    }
    // THE LANDING PUFF: a ring out from under him.
    if (landed > 0) {
      const ground = lv.groundAt(skier.x, skier.z);
      const total = Math.round(
        Math.min(420, 60 * base + landed * 40 * (0.3 * base + powder)) * share,
      );
      for (let i = 0; i < total; i++) {
        const a = random() * Math.PI * 2;
        const sp = (2 + random() * (3 + landed * 0.8)) * slow;
        const x = skier.x + Math.cos(a) * 0.6;
        const y = ground + 0.1 + random() * 0.3;
        const z = skier.z + Math.sin(a) * 1.0;
        const vx = Math.cos(a) * sp + skier.vx * 0.4;
        const vy = (1 + random() * (1.5 + landed * 0.3)) * slow;
        const vz = Math.sin(a) * sp + skier.vz * 0.4;
        if (random() < 0.25 * fineNow) puff(x, y, z, vx * 0.6, vy * 0.6, vz * 0.6, 1.4);
        else grain(x, y, z, vx, vy, vz, clumps * random(), false, glints);
      }
    }
  }

  /** A BODY GOING IN: snow flung up and out, the clumps landing round it and
   * lying there, the veil over it. */
  function burst(
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    size: number,
    snow?: SnowProps,
  ) {
    const heavy = snow ? Math.min(1.2, 0.4 + heavyShare(snow, 0)) : 1;
    fineNow = snow ? snow.fine : 0.6;
    heavyNow = 0;
    looseNow = snow ? Math.min(1, snow.loose) : 1;
    const clumps = snow ? snow.clumps : 0.3;
    const total = Math.round(Math.min(900, (60 + 520 * size) * heavy) * share);
    // Most of it falls back into the hole and the slide: it lies briefly.
    restScale = 0.3;
    for (let i = 0; i < total; i++) {
      const a = random() * Math.PI * 2;
      const sp = 1 + random() * (2 + 4.5 * size);
      const px = x + Math.cos(a) * 0.5 * random();
      const py = y + random() * 0.4;
      const pz = z + Math.sin(a) * 0.5 * random();
      const ux = Math.cos(a) * sp + vx * 0.35;
      const uy = 1.5 + random() * (2 + 3.5 * size);
      const uz = Math.sin(a) * sp + vz * 0.35;
      const r = random();
      if (r < 0.22 * fineNow) puff(px, py, pz, ux * 0.5, uy * 0.6, uz * 0.5, 1.6 + size);
      else
        grain(
          px,
          py,
          pz,
          ux,
          uy,
          uz,
          r < 0.12 + 0.3 * clumps ? 0.55 + 0.45 * random() : 0.2 * random(),
          false,
          0.5,
        );
    }
    restScale = 1;
  }

  return {
    points: mesh,
    cloudWall: GPU_SPRAY.cloudWall,
    emit(skier, lv, dt, landed, snow) {
      emit(skier, lv, dt, landed, snow as Aged | undefined);
    },
    burst,
    fling(x, y, z, vx, vy, vz, life, size, hard) {
      if (random() > share) return;
      put(
        x,
        y,
        z,
        vx,
        vy,
        vz,
        life,
        size,
        hard >= 0.5 ? hard : Math.min(0.45, hard + 0.05),
        hard >= 0.5 ? 7 : 3,
        2,
        0.3,
      );
    },
    update(dt, look, lv) {
      const began = performance.now();
      level = lv;
      now += dt;
      const lit = material.uniforms.uLit.value as THREE.Color;
      const shade = material.uniforms.uShade.value as THREE.Color;
      const sun = look.keyIntensity * 0.34;
      const sky = look.ambient * 0.55;
      lit.setRGB(
        look.keyColour[0] * sun + look.skyLight[0] * sky,
        look.keyColour[1] * sun + look.skyLight[1] * sky,
        look.keyColour[2] * sun + look.skyLight[2] * sky,
      );
      shade.setRGB(
        look.skyLight[0] * sky * 1.2,
        look.skyLight[1] * sky * 1.2,
        look.skyLight[2] * sky * 1.25,
      );
      material.uniforms.uNow.value = now;
      flush();
      geometry.instanceCount = used;
      SPRAY_STATS.bytes = wrote * 64;
      wrote = 0;
      SPRAY_STATS.updateMs = performance.now() - began;
      if (SPRAY_STATS.count) {
        let live = 0;
        for (let i = 0; i < used; i++) {
          const age = now - a0[i * 4 + 3];
          if (age >= 0 && age <= a1[i * 4 + 3] + a2[i * 4 + 3]) live++;
        }
        SPRAY_STATS.live = live;
      }
    },
    setWind(x, z) {
      (material.uniforms.uWind.value as THREE.Vector3).set(x, 0, z);
    },
    setScale(v) {
      material.uniforms.uScale.value = v;
    },
    setBudget(next) {
      share = Math.max(0, Math.min(1, next));
      cap = Math.max(1, Math.round(capacity * share));
      head %= cap;
      if (used > cap) used = cap;
    },
    setModel() {
      // One way of flying: the shader's.
    },
    clear() {
      for (let i = 0; i < capacity; i++) a0[i * 4 + 3] = -1e6;
      for (const at of attrs) {
        at.clearUpdateRanges();
        at.needsUpdate = true;
      }
      dirtyFrom = -1;
      dirtyCount = 0;
      used = 0;
      head = 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
