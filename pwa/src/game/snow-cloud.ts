// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW CLOUD — the fine powder a skier rips up and leaves hanging in
// the air behind him: the wall off a skid, the sheet off a carving edge,
// the bow wave over a buried tip, the ring a landing throws, the burst of
// a wipeout. `spray.ts` flies
// the heavy part (the grains and clumps that arc and fall inside a second);
// this is the other substance, the one that stalls, swells, drifts on the
// wind and settles for seconds. What each source throws out of which snow
// is `snow-cloud-plan.ts`'s (three-free, tested); what the snow IS is
// `snowpack.ts`'s. This module flies the puffs and draws them.
//
// A PUFF is a camera-facing quad (instanced, one draw for every skier's
// cloud) shaded as a small VOLUME rather than a disc:
//
//   * THE BODY is a soft ball carved by DOMAIN-WARPED noise that slides
//     and turns as the puff ages, so a young puff is round and dense and an
//     old one is torn into wisps (the shader is `snow-cloud-glsl.ts`);
//   * THE LIGHT is the sky's, by its own names (`snow-air-light.ts`): the
//     key taken by height, through the weather's cloud and past the
//     mountain (`keyAtHeight`, `cloudShadow`, `terrainLit`), and the sky's
//     irradiance round it (`skyIrradiance`) — so a stop in the mountain's
//     shade throws a cloud lit by the sky alone, never a white glow on blue
//     snow, and after dark only the lamps light it. A normal off the ball
//     (bent by the noise) is lit wrapped round its terminator and SHADED BY
//     THE WHOLE CLOUD (a sun-first walk through it, Beer–Lambert), and a
//     multiple-scattering fill lifts what is shaded: ice scatters nearly all
//     it stops, so snow in shadow is blue, never grey;
//   * FORWARD SCATTER in two lobes (Henyey–Greenstein, g 0.86 and 0.45),
//     weighted to the thin parts: against a low sun the cloud's edges light
//     up silver and gold and the whole of it glows;
//   * ITS SHADOW on the slope beside it (`snow-cloud-shadow.ts`): white in
//     the air over white snow reads by day by the blot it casts;
//   * GLINTS: in dry cold snow single crystals catch the sun and twinkle;
//   * THE LAMPS: at night every lamp's beam — the finish arena's floods,
//     the skiers' headlamps — lights what it passes through (the lamp
//     slots, `haze.ts`'s `lampReach`);
//   * it FADES INTO THE SNOW where it meets it (the lower part of a puff
//     sitting on the ground thins out instead of cutting a line), away
//     close to the lens (a chase camera rides inside the player's own
//     plume), and into the same haze as the hills.
//
// SORTED back to front every frame (an insertion sort over the last
// frame's order, which is nearly sorted already), so a lit puff in front
// of a shaded one is never drawn under it.
//
// Presentation only: it reads the engine's state and never writes it, and
// draws from a stream of its own.

import * as THREE from "three";
import { rotate, type Level, type SkierState, type Wind } from "@engine";

import type { HazeUniforms } from "./haze.ts";
import { SHELTER } from "./shelter.ts";
import { airLightUniforms, setAirKey } from "./snow-air-light.ts";
import { createCloudShadow } from "./snow-cloud-shadow.ts";
import { CLOUD_FRAGMENT, CLOUD_VERTEX, makeRandom, noiseTexture } from "./snow-cloud-glsl.ts";
import { skiShares, stationOf } from "./ski-stand.ts";
import type { SkyLook } from "./sky.ts";
import { edgeSlips, emptySlip, type EdgeSlip } from "./spray-sim.ts";
import { dustOf, MASS } from "./spray-mass.ts";
import {
  flyPuff,
  carveOf,
  driveOf,
  emptyRecipe,
  landingPuffs,
  puffOpacity,
  puffRadius,
  skidCloud,
  skiCloud,
  type CloudRecipe,
  CLOUD,
} from "./snow-cloud-plan.ts";
import type { SnowProps } from "./snowpack.ts";

const CAPACITY = 2400;
/** THE SELF-SHADOW's grid: cells across the sun's rays, m, how many (a
 * hash table — a collision only shades a puff a little too much), and how
 * dark a unit of cloud laid in front makes what is behind it. */
const SHADOW_CELL = 1.2;
const SHADOW_CELLS = 8192;
const SHADOW_DEPTH = 0.9;
/** The most cells across a big puff's shadow is laid in, either way of
 * its middle. */
const SHADOW_REACH = 5;
/** How much deeper an avalanche's billow shades itself than a skier's
 * puff: its far side and its underside go the sky's grey-blue. */
const BILLOW_DENSE = 2.4;

function cell(u: number, v: number): number {
  return (Math.imul(u, 73856093) ^ Math.imul(v, 19349663)) & (SHADOW_CELLS - 1);
}

export type SnowCloud = {
  mesh: THREE.Mesh;
  /** Raise one skier's cloud over `dt`; `landed` is the landing's measure
   * this frame (0 for none), `snowAt` what the snow is at a point. */
  emit(
    skier: SkierState,
    dt: number,
    landed: number,
    snowAt: (x: number, z: number) => SnowProps,
  ): void;
  /** A BURST at a point — a wipeout's (`size` 1) or a body coming down on
   * the snow (less), carried along at (vx, vz). */
  burst(
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    size: number,
    snow: SnowProps,
  ): void;
  /** A PUFF BLOWN by a helicopter's rotor wash (`heli-view.ts`): one
   * puff of loose snow at a point, thrown at (vx, vy, vz), `size` m. */
  blow(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number): void;
  /** AN AVALANCHE'S POWDER CLOUD (`avalanche-view.ts`): one puff `size`
   * m across at a point, thrown at (vx, vy, vz), swelling `grow` m and
   * hanging `hang` s, at `opacity`. */
  billow(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    grow: number,
    hang: number,
    opacity: number,
  ): void;
  /** Fly every puff and sort them for the lens. */
  update(dt: number, look: SkyLook, level: Level, wind: Wind, eye: THREE.Vector3): void;
  /** The skier the lens is looking at, and how thin his plume is drawn
   * between them (1: whole — a planted lens). */
  setFocus(x: number, y: number, z: number, veil: number): void;
  /** The SPRAY row's share of the rates and of the pool. */
  setBudget(share: number): void;
  clear(): void;
  dispose(): void;
};

export function createSnowCloud(haze: HazeUniforms): SnowCloud {
  const pos = new Float32Array(CAPACITY * 3);
  const vel = new Float32Array(CAPACITY * 3);
  const age = new Float32Array(CAPACITY);
  const life = new Float32Array(CAPACITY);
  const size0 = new Float32Array(CAPACITY);
  const grow = new Float32Array(CAPACITY);
  const tau = new Float32Array(CAPACITY);
  const settle = new Float32Array(CAPACITY);
  const opacity = new Float32Array(CAPACITY);
  const seed = new Float32Array(CAPACITY);
  const sparkle = new Float32Array(CAPACITY);
  const spin = new Float32Array(CAPACITY);
  const ground = new Float32Array(CAPACITY);
  /** How deeply a puff shades itself, 1 the skier's: an avalanche's billow,
   * metres of snow through, goes darker on its far side. */
  const dense = new Float32Array(CAPACITY).fill(1);
  /** The draw order (far first), and whether a slot is in it. */
  const order = new Int32Array(CAPACITY);
  const listed = new Uint8Array(CAPACITY);
  const key = new Float32Array(CAPACITY);
  let count = 0;
  /** THE CLOUD'S SHADOW ON ITSELF: the puffs walked sun-first (`sunOrder`,
   * by `toSun`), each reading how much cloud has already been laid across
   * its ray (`reach`, a hashed grid of cells across the sun's rays) before
   * laying its own; `lit` is what it reads, as the share of the sun left. */
  const sunOrder = new Int32Array(CAPACITY);
  const toSun = new Float32Array(CAPACITY);
  const lit = new Float32Array(CAPACITY).fill(1);
  const reach = new Float32Array(SHADOW_CELLS);
  let head = 0;
  let share = 1;
  let cap = CAPACITY;
  let clock = 0;
  const random = makeRandom(0x5c10d);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  const iLook = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  const iSnow = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  for (const a of [iPos, iLook, iSnow]) a.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("iPos", iPos);
  geometry.setAttribute("iLook", iLook);
  geometry.setAttribute("iSnow", iSnow);
  geometry.instanceCount = 0;
  // Each drawn puff's age, s, in draw order, for the snow eval lab's
  // measure (`plume-probe.ts`) — never uploaded.
  const drawnAge = new Float32Array(CAPACITY);
  geometry.userData.age = drawnAge;

  const noise = noiseTexture();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...haze,
      uNoise: { value: noise },
      uKey: { value: new THREE.Vector3(0, 1, 0) },
      ...airLightUniforms(),
      uGlint: { value: 1 },
      uTime: { value: 0 },
      uNight: { value: 0 },
      uNear: { value: 2.2 },
      uFocus: { value: new THREE.Vector4(0, -1e5, 0, 1) },
      ...SHELTER,
    },
    vertexShader: CLOUD_VERTEX,
    fragmentShader: CLOUD_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  // Its shadow on the slope, drawn under it (`snow-cloud-shadow.ts`).
  const shadow = createCloudShadow(
    haze,
    material.uniforms.uKeyCol as { value: THREE.Color },
    CAPACITY,
  );
  mesh.add(shadow.mesh);

  function spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    r: CloudRecipe,
    g: number,
    depth = 1,
  ) {
    const i = head;
    head = (head + 1) % cap;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    vel[i * 3] = vx;
    vel[i * 3 + 1] = vy;
    vel[i * 3 + 2] = vz;
    age[i] = 0;
    life[i] = r.hang * (0.7 + 0.6 * random());
    size0[i] = r.size * (0.6 + 0.8 * random());
    grow[i] = r.grow * (0.55 + 0.9 * random());
    tau[i] = r.tau * (0.8 + 0.4 * random());
    settle[i] = r.settle * (0.8 + 0.4 * random());
    opacity[i] = r.opacity * (0.75 + 0.5 * random());
    seed[i] = random();
    sparkle[i] = r.sparkle;
    spin[i] = random() * Math.PI * 2;
    ground[i] = g;
    dense[i] = depth;
    if (!listed[i]) {
      listed[i] = 1;
      order[count++] = i;
    }
  }

  /** Walk the live puffs sun-first and shadow each by what lies before
   * it: cells `SHADOW_CELL` m across the sun's rays, written and read
   * bilinearly so a puff crossing a cell's edge does not pop. */
  function shadowWalk(kx: number, ky: number, kz: number): void {
    // Two axes across the sun's rays.
    let ax = -kz;
    let az = kx;
    let al = Math.hypot(ax, az);
    if (al < 1e-3) {
      ax = 1;
      az = 0;
      al = 1;
    }
    ax /= al;
    az /= al;
    const bx = ky * az;
    const by = kz * ax - kx * az;
    const bz = -ky * ax;
    let n = 0;
    for (let m = 0; m < count; m++) sunOrder[n++] = order[m];
    // Sun-first: the largest `toSun` first.
    for (let a = 1; a < n; a++) {
      const i = sunOrder[a];
      const v = toSun[i];
      let b = a - 1;
      while (b >= 0 && toSun[sunOrder[b]] < v) {
        sunOrder[b + 1] = sunOrder[b];
        b--;
      }
      sunOrder[b + 1] = i;
    }
    reach.fill(0);
    for (let m = 0; m < n; m++) {
      const i = sunOrder[m];
      const k = i * 3;
      const u = (pos[k] * ax + pos[k + 2] * az) / SHADOW_CELL;
      const v = (pos[k] * bx + pos[k + 1] * by + pos[k + 2] * bz) / SHADOW_CELL;
      const u0 = Math.floor(u);
      const v0 = Math.floor(v);
      const fu = u - u0;
      const fv = v - v0;
      const c00 = cell(u0, v0);
      const c10 = cell(u0 + 1, v0);
      const c01 = cell(u0, v0 + 1);
      const c11 = cell(u0 + 1, v0 + 1);
      const w00 = (1 - fu) * (1 - fv);
      const w10 = fu * (1 - fv);
      const w01 = (1 - fu) * fv;
      const w11 = fu * fv;
      const before = reach[c00] * w00 + reach[c10] * w10 + reach[c01] * w01 + reach[c11] * w11;
      // Ice scatters nearly all the light it stops, so what is shadowed is
      // lit again by the cloud round it: a second, gentler octave of the
      // same extinction stands for every scattering after the first.
      const tau = SHADOW_DEPTH * before;
      lit[i] = Math.min(1, Math.exp(-tau) + 0.45 * Math.exp(-tau * 0.2));
      // What this puff lays across the ray: its snow, spread over the cells
      // its disc covers.
      const a01 = age[i] / life[i];
      const r = puffRadius(size0[i], grow[i], a01);
      const thick = puffOpacity(opacity[i], size0[i], grow[i], a01);
      if (r < SHADOW_CELL * 1.5) {
        const laid = thick * Math.min(1, (r * r) / (SHADOW_CELL * SHADOW_CELL));
        reach[c00] += laid * w00;
        reach[c10] += laid * w10;
        reach[c01] += laid * w01;
        reach[c11] += laid * w11;
        continue;
      }
      // A BIG PUFF (an avalanche's billow) shades a disc as wide as it is,
      // thickest through its middle — in cells of its own size past
      // `SHADOW_REACH`, so a cloud of them costs no more than a few.
      const step = Math.max(1, Math.ceil(r / SHADOW_CELL / SHADOW_REACH));
      const span = Math.ceil(r / SHADOW_CELL / step);
      for (let b = -span; b <= span; b++) {
        for (let a = -span; a <= span; a++) {
          const d2 = ((a * a + b * b) * step * step * SHADOW_CELL * SHADOW_CELL) / (r * r);
          if (d2 >= 1) continue;
          const laid = thick * (1 - d2);
          for (let bb = 0; bb < step; bb++) {
            for (let aa = 0; aa < step; aa++) {
              reach[cell(u0 + a * step + aa, v0 + b * step + bb)] += laid;
            }
          }
        }
      }
    }
  }

  /** The map the cloud was last flown over — where a new puff's ground is
   * read before its first flight. */
  let levelRef: Level | null = null;
  function groundOf(x: number, z: number): number {
    return levelRef ? levelRef.groundAt(x, z) : -1e4;
  }

  // Emission carries fractions over from frame to frame, per skier.
  let debt = new WeakMap<SkierState, number[]>();
  const wall = emptyRecipe();
  const ski = emptyRecipe();
  const puff = emptyRecipe();
  const blown: CloudRecipe = {
    ...emptyRecipe(),
    hang: 4.5,
    settle: 0.35,
    tau: 1.4,
    opacity: 0.55,
    sparkle: 0.4,
  };
  // The avalanche's cloud: slow to settle, slow to stop, glinting little.
  const boil: CloudRecipe = { ...emptyRecipe(), settle: 0.12, tau: 2.2, sparkle: 0.25 };
  const drive = { speed: 0, skid: 0, edge: 0, grounded: false };
  const shares: [number, number] = [0.5, 0.5];
  const slips: [EdgeSlip, EdgeSlip] = [emptySlip(), emptySlip()];

  const api: SnowCloud = {
    mesh,
    emit(skier, dt, landed, snowAt) {
      let owed = debt.get(skier);
      if (!owed) {
        owed = [0, 0, 0];
        debt.set(skier, owed);
      }
      // THE SKI THAT CARRIES HIM throws the cloud (`ski-stand.ts`): the
      // outside one, two thirds of his weight and more in a turn — the
      // wall rises off its boot, and each ski's sheet goes by its share.
      skiShares(skier, shares);
      const lead = stationOf(skier.contacts, shares[0] >= shares[1] ? 0 : 1, 1);
      const under = rotate(skier.q, { x: 0, y: -skier.spec.cogHeight, z: 0 });
      const on = lead?.touching === true;
      const ux = on ? lead.x : skier.x + under.x;
      const uy = on ? lead.y : skier.y + under.y;
      const uz = on ? lead.z : skier.z + under.z;
      const snow = snowAt(ux, uz);
      driveOf(skier, drive);
      // Which way the skis are sliding across their own line.
      const out = skier.skiAngle !== 0 ? -Math.sign(skier.skiAngle) : -Math.sign(skier.edge || 1);
      // THE SKID'S WALL, off the loaded edge, the way it slides
      // (`spray-sim.ts`'s `edgeSlips`: the skier's velocity read across the
      // skis) — the fine part of the same sheet the grains are, so the
      // cloud rises where the spray flies and never behind it.
      skidCloud(drive, snow, wall);
      // THE SPRAY WEIGHED (`spray-mass.ts`): the wall is the dust the edges
      // actually threw — a groomer's stop a low mist, powder's a cloud.
      const dust = dustOf(skier);
      if (dust !== undefined) {
        const f = Math.min(1.2, Math.sqrt(dust / MASS.dustRef));
        wall.rate *= f;
        wall.lift *= 0.5 + 0.5 * Math.min(1, f);
      }
      const edges = edgeSlips(skier, slips);
      // Ridden on the jet of the snow the skis shove on (`CLOUD.jet`).
      if (slips[0].share > 0 || (edges > 1 && slips[1].share > 0)) wall.tau *= CLOUD.jet;
      const e = edges > 1 && slips[1].share > slips[0].share ? slips[1] : slips[0];
      const along = e.share > 0;
      const ax = along ? e.across.x : 0;
      const az = along ? e.across.z : 0;
      const slide = along ? e.slide : 0;
      owed[0] += wall.rate * dt * share;
      while (owed[0] >= 1) {
        owed[0] -= 1;
        // Spread along the frame's path, so a fast skier's plume is a
        // stream and not a string of beads a frame apart — and along the
        // loaded edge, tip to tail, as the sheet is.
        const back = random() * dt;
        const u = 0.1 + 0.85 * random();
        // Born where the spray is: low, just ahead of the base's leading
        // side, the way the skis slide (`spray-mass.ts`'s `MASS.push`).
        const lead = 0.25 + 0.5 * random();
        const at = along
          ? {
              x: e.tip.x + (e.tail.x - e.tip.x) * u - ux + ax * lead,
              y: 0.06 + 0.12 * random(),
              z: e.tip.z + (e.tail.z - e.tip.z) * u - uz + az * lead,
            }
          : rotate(skier.q, {
              x: (random() - 0.5) * 0.7 + out * 0.3,
              y: 0.1 + (random() - 0.5) * 0.2,
              z: (random() - 0.5) * 0.8,
            });
        // Along: the skis' slide carried on — the dust is the finest of
        // the snow they shoved FORWARD, so it leaves ahead of them at the
        // slide and a little over (the shove's own), low, and swells up
        // as it slows; nothing of the slide is left behind.
        const throwOut = wall.back * (0.3 + 0.5 * random()) + slide * (0.35 + 0.4 * random());
        const kick = along
          ? {
              x: ax * throwOut + (random() - 0.5) * 1.2,
              y: wall.lift * (0.25 + 0.4 * random()),
              z: az * throwOut + (random() - 0.5) * 1.2,
            }
          : rotate(skier.q, {
              x: out * wall.back * (0.6 + 0.8 * random()),
              y: wall.lift * (0.55 + 0.7 * random()),
              z: (random() - 0.5) * 1.5,
            });
        const x = ux + at.x - skier.vx * back;
        const z = uz + at.z - skier.vz * back;
        // The skier's own velocity carried whole across the skis (the
        // slide the snow ahead is brought up to) and in part along them.
        const vAcross = along ? skier.vx * ax + skier.vz * az : 0;
        const keepX = skier.vx - vAcross * ax;
        const keepZ = skier.vz - vAcross * az;
        spawn(
          x,
          uy + at.y - skier.vy * back,
          z,
          (along ? vAcross * ax : 0) + keepX * 0.45 + kick.x,
          skier.vy * 0.3 + kick.y,
          (along ? vAcross * az : 0) + keepZ * 0.45 + kick.z,
          wall,
          groundOf(x, z),
        );
      }
      // THE SKIS: the sheet off a carve, the bow wave of a buried tip.
      const carve = carveOf(drive);
      for (let k = 0; k < 2; k++) {
        const tip = stationOf(skier.contacts, k, 0);
        const mid = stationOf(skier.contacts, k, 1);
        if (!mid || !mid.touching) continue;
        skiCloud(carve, tip?.touching ? tip.sink : 0, snowAt(mid.x, mid.z), ski, drive.speed);
        owed[1 + k] += ski.rate * dt * share * 2 * shares[k];
        while (owed[1 + k] >= 1) {
          owed[1 + k] -= 1;
          const c = random() < 0.5 && tip?.touching ? tip : mid;
          const kick = rotate(skier.q, {
            x: out * (0.8 + random() * 2),
            y: ski.lift * (0.5 + random()),
            z: -ski.back * random(),
          });
          const back = random() * dt;
          const x = c.x - skier.vx * back;
          const z = c.z - skier.vz * back;
          spawn(
            x,
            c.y + 0.15,
            z,
            skier.vx * 0.5 + kick.x,
            kick.y,
            skier.vz * 0.5 + kick.z,
            ski,
            groundOf(x, z),
          );
        }
      }
      // THE LANDING: a ring of cloud rolled out from under the skier.
      if (landed > 0) {
        const at = snowAt(skier.x, skier.z);
        const n = Math.round(landingPuffs(landed, at) * share);
        // A landing's cloud is the fall's, not the forward speed's: lofted
        // whole however slow he was going.
        skidCloud(
          { speed: skier.speed, skid: 1, edge: 0, grounded: true },
          at,
          puff,
          CLOUD.loft.full,
        );
        const g = groundOf(skier.x, skier.z);
        for (let i = 0; i < n; i++) {
          const a = random() * Math.PI * 2;
          const sp = 1.5 + random() * (2 + landed * 0.35);
          spawn(
            skier.x + Math.sin(a) * 0.8,
            g + 0.2 + random() * 0.4,
            skier.z + Math.cos(a) * 1.1,
            Math.sin(a) * sp + skier.vx * 0.35,
            0.8 + random() * (1 + landed * 0.15),
            Math.cos(a) * sp + skier.vz * 0.35,
            puff,
            g,
          );
        }
      }
    },
    burst(x, y, z, vx, vz, size, snow) {
      // A body meeting the snow throws its own cloud, whatever the speed.
      skidCloud({ speed: 8, skid: 1, edge: 0, grounded: true }, snow, puff, CLOUD.loft.full);
      const n = Math.round(Math.min(45, (5 + 35 * size) * snow.loose * snow.fine) * share);
      for (let i = 0; i < n; i++) {
        const a = random() * Math.PI * 2;
        const sp = 0.8 + random() * (1.5 + 3 * size);
        spawn(
          x + Math.sin(a) * 0.4 * random(),
          y + random() * 0.4,
          z + Math.cos(a) * 0.4 * random(),
          Math.sin(a) * sp + vx * 0.3,
          1 + random() * (1.5 + 2 * size),
          Math.cos(a) * sp + vz * 0.3,
          puff,
          groundOf(x, z),
        );
      }
    },
    blow(x, y, z, vx, vy, vz, size) {
      // The wash's snow: big, slow-settling puffs that hang and drift — a
      // whiteout is the air full of them.
      blown.size = size;
      blown.grow = size * 2.2;
      if (random() > share) return;
      spawn(x, y, z, vx, vy, vz, blown, groundOf(x, z));
    },
    billow(x, y, z, vx, vy, vz, size, grow, hang, opacity) {
      if (random() > share) return;
      boil.size = size;
      boil.grow = grow;
      boil.hang = hang;
      boil.opacity = opacity;
      spawn(x, y, z, vx, vy, vz, boil, groundOf(x, z), BILLOW_DENSE);
    },
    update(dt, look, level, wind, eye) {
      levelRef = level;
      clock += dt;
      const u = material.uniforms;
      (u.uKey.value as THREE.Vector3).set(look.key.x, look.key.y, look.key.z);
      setAirKey(u.uKeyCol.value as THREE.Color, look);
      u.uGlint.value = look.glitter * (1 - look.night);
      u.uTime.value = clock;
      u.uNight.value = look.night;

      const sunX = look.key.x;
      const sunY = look.key.y;
      const sunZ = look.key.z;
      // Fly, and drop the dead from the order.
      let live = 0;
      for (let n = 0; n < count; n++) {
        const i = order[n];
        if (life[i] <= 0 || i >= cap) {
          listed[i] = 0;
          continue;
        }
        age[i] += dt;
        if (age[i] >= life[i]) {
          life[i] = 0;
          listed[i] = 0;
          continue;
        }
        const k = i * 3;
        flyPuff(vel, k, wind.x, 0, wind.z, tau[i], settle[i], dt);
        pos[k] += vel[k] * dt;
        pos[k + 1] += vel[k + 1] * dt;
        pos[k + 2] += vel[k + 2] * dt;
        // Settled onto the snow: it lies there and is gone sooner.
        const r = puffRadius(size0[i], grow[i], age[i] / life[i]);
        const floor = level.groundAt(pos[k], pos[k + 2]);
        ground[i] = floor;
        if (pos[k + 1] < floor + r * 0.3) {
          pos[k + 1] = floor + r * 0.3;
          if (vel[k + 1] < 0) vel[k + 1] = 0;
          age[i] += dt * 0.6;
        }
        const dx = pos[k] - eye.x;
        const dy = pos[k + 1] - eye.y;
        const dz = pos[k + 2] - eye.z;
        key[i] = dx * dx + dy * dy + dz * dz;
        toSun[i] = pos[k] * sunX + pos[k + 1] * sunY + pos[k + 2] * sunZ;
        order[live++] = i;
      }
      count = live;
      shadowWalk(look.key.x, look.key.y, look.key.z);
      // Far first: insertion sort over last frame's order, nearly sorted.
      for (let a = 1; a < count; a++) {
        const i = order[a];
        const v = key[i];
        let b = a - 1;
        while (b >= 0 && key[order[b]] < v) {
          order[b + 1] = order[b];
          b--;
        }
        order[b + 1] = i;
      }
      const P = iPos.array as Float32Array;
      const L = iLook.array as Float32Array;
      const S = iSnow.array as Float32Array;
      for (let n = 0; n < count; n++) {
        const i = order[n];
        const a01 = age[i] / life[i];
        const r = puffRadius(size0[i], grow[i], a01);
        drawnAge[n] = age[i];
        P[n * 4] = pos[i * 3];
        P[n * 4 + 1] = pos[i * 3 + 1];
        P[n * 4 + 2] = pos[i * 3 + 2];
        P[n * 4 + 3] = r;
        L[n * 4] = puffOpacity(opacity[i], size0[i], grow[i], a01);
        L[n * 4 + 1] = seed[i];
        L[n * 4 + 2] = a01;
        L[n * 4 + 3] = ground[i];
        S[n * 4] = sparkle[i];
        // How thick it shades itself: dense young, thin once spread.
        S[n * 4 + 1] = Math.min(1.2, (opacity[i] * (size0[i] * 2.2)) / r + 0.25) * dense[i];
        S[n * 4 + 2] = spin[i] + a01 * (seed[i] - 0.5) * 1.5;
        S[n * 4 + 3] = lit[i];
      }
      geometry.instanceCount = count;
      shadow.update(level, look.key, count, P, L);
      iPos.needsUpdate = true;
      iLook.needsUpdate = true;
      iSnow.needsUpdate = true;
    },
    setFocus(x, y, z, veil) {
      (material.uniforms.uFocus.value as THREE.Vector4).set(x, y, z, veil);
    },
    setBudget(next) {
      share = Math.max(0, Math.min(1, next));
      cap = Math.max(1, Math.round(CAPACITY * share));
      head %= cap;
      for (let i = cap; i < CAPACITY; i++) life[i] = 0;
    },
    clear() {
      life.fill(0);
      listed.fill(0);
      count = 0;
      geometry.instanceCount = 0;
      shadow.clear();
      debt = new WeakMap();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      noise.dispose();
      shadow.dispose();
    },
  };

  return api;
}
