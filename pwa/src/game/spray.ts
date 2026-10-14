// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SKIER THROWS, DRAWN — the grains and clumps `spray-sim.ts` flies
// (the edge's sheet, the carve's tail, the powder over the shoulder, the
// landing puff, a body's burst), every one of every skier in ONE draw.
//
// A grain is drawn as the eye and a camera see a small bright thing moving
// fast: a STREAK along its own motion over a short shutter, not a dot — so
// a sheet thrown off a sliding edge reads as a fan of streaks fanning out
// and falling, the way spray reads in a photograph of a hockey stop or a
// turn in powder (a dot cloud reads as foam). A clump is streaked less: it
// is a lump with an edge. A streak is thinned by its length, so a fast
// grain is not brighter than a slow one.
//
// A grain is a little VOLUME — a few jittered sub-grains in a haze of fines
// — and a clump a ragged faceted lump. They are lit by the sky's own names
// (`snow-air-light.ts`: the key by height, through the weather's cloud and
// past the mountain, and the sky's irradiance round it), so a spray in the
// mountain's shade is blue and never glows white; they SCATTER FORWARD
// (Henyey–Greenstein, g 0.78, weighted to the thin parts: spray seen into a
// low sun is a silver or gold sheet), GLINT as the crystals turn (more off
// new snow than wet), take the lamps' light after dark and nothing else,
// and fade into the same haze.
// The fine powder that hangs is `snow-cloud.ts`'s.

import * as THREE from "three";
import type { Level, SkierState } from "@engine";

import type { HazeUniforms } from "./haze.ts";
import { SHELTER } from "./shelter.ts";
import type { SkyLook } from "./sky.ts";
import { airLightUniforms, setAirKey } from "./snow-air-light.ts";
import { SPRAY_FRAGMENT, sprayVertex } from "./spray-glsl.ts";
import type { AgedSnow, SnowProps } from "./snowpack.ts";
import { createGpuSpray } from "./gpu-spray.ts";
import type { PlumeBit } from "./spray-film.ts";
import { createSprayPool, SPRAY_MODEL, type SprayModel } from "./spray-sim.ts";
import { SPRAY_STATS } from "./spray-stats.ts";

export { heavyShare } from "./spray-sim.ts";

const CAPACITY = 6000;
/** The shutter a streak is drawn over, s: long enough that a chip thrown
 * at 10 m/s reads as a stroke a hand long at chase range. */
const SHUTTER = 0.045;

export type Spray = {
  /** The one draw (an instanced quad a grain), named `points` for the
   * renderer that adds it. */
  points: THREE.Object3D;
  /** Emit for one rider over `dt`; `landed` is the landing's measure this
   * frame (0 for none); `snow` what the skier is on, as its age leaves it
   * (`snowpack.ts`'s `ageSnow`). */
  emit(
    skier: SkierState,
    level: Level,
    dt: number,
    landed: number,
    snow?: SnowProps | AgedSnow,
  ): void;
  /** A BURST of snow thrown up at a point — a wipeout's (`size` 1) or a
   * body bouncing on the snow (less) — carried along at (vx, vz). */
  burst(
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    size: number,
    snow?: SnowProps,
  ): void;
  /** ONE GRAIN OR CLUMP FLUNG from a point at (vx, vy, vz) — a
   * snowmobile's roost off its paddles (`sled-scene.ts`): living `life` s,
   * `size` m across, `hard` 0 a grain puff … 1 a clump. Thinned by the
   * SPRAY row's share. */
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
  update(dt: number, look: SkyLook, level: Level): void;
  /** Pixels per metre at one metre from the lens (the projection's scale)
   * — the streak keeps a grain at least about a pixel across. */
  setScale(pixelsPerMetre: number): void;
  /** The SPRAY row: the share, 0..1, of every emission rate and of the pool
   * the particles are flown from. */
  setBudget(share: number): void;
  /** The SPRAY row's other half: fly the weighed spray on the GPU
   * (`gpu-spray.ts`) or the CPU (the pool here) — the same snow either way.
   * Only the wrapper `createSpray` makes switches; a lone flyer ignores it. */
  setFlight?(onGpu: boolean): void;
  /** Every grain the last frame drew, as the snow eval lab's film score
   * reads them (`plume-probe.ts`). */
  bits(out: PlumeBit[]): void;
  /** How a grain flies (`spray-sim.ts`'s `SprayModel`) — the game flies
   * `SPRAY_MODEL`; the labs fly each candidate. */
  setModel(model: SprayModel): void;
  clear(): void;
  dispose(): void;
};

/** A LAB'S SWITCH over the SPRAY row's flight: `null` the row's own. */
let flightFor: boolean | null = null;

/** A LAB'S SWITCH: fly every spray made after this on the GPU (`true`), on
 * the CPU (`false`), or as the SPRAY row says (`null`). */
export function flySprayOn(onGpu: boolean | null): void {
  flightFor = onGpu;
}

/** The model every spray made from now on flies — `SPRAY_MODEL` unless a
 * lab says otherwise (`flySprayAs`, the spray lab's `?spray=`). */
let flown: SprayModel = SPRAY_MODEL;

/** A LAB'S SWITCH: fly every spray made after this by `model`. */
export function flySprayAs(model: SprayModel): void {
  flown = model;
}

/** What the CPU's draw reads per grain: its place and size, its motion
 * and opacity, and what it is. */
const CPU_SOURCE = /* glsl */ `
  attribute vec4 aSpot;
  attribute vec4 aMove;
  attribute vec3 aKind;
  bool sprayParcel(out vec3 world, out vec3 move, out float size, out float alpha,
                   out float hard, out float glint, out float seed) {
    world = aSpot.xyz;
    move = aMove.xyz;
    size = aSpot.w;
    alpha = aMove.w;
    hard = aKind.x;
    glint = aKind.y;
    seed = aKind.z;
    return true;
  }
`;

/** THE SPRAY: both ways of flying it behind one face, the SPRAY row's
 * stop choosing (`setFlight`), each made the first time it is asked for.
 * The counted models (the labs' before) fly on the CPU only. */
export function createSpray(haze: HazeUniforms): Spray {
  const group = new THREE.Group();
  let cpu: Spray | null = null;
  let gpu: Spray | null = null;
  let share = 1;
  let scale = 600;
  let gpuWanted = false;
  let current: SprayModel = flown;
  const model = (): SprayModel => current;
  const make = (onGpu: boolean): Spray => {
    const made = onGpu
      ? (gpu ??= createGpuSpray(haze, CAPACITY, SHUTTER))
      : (cpu ??= createCpuSpray(haze));
    made.setBudget(share);
    made.setScale(scale);
    return made;
  };
  let live = make(false);
  group.add(live.points);
  const choose = () => {
    const onGpu = (flightFor ?? gpuWanted) && model() === "mass";
    const next = make(onGpu);
    if (next === live) return;
    live.clear();
    group.remove(live.points);
    live = next;
    group.add(live.points);
  };
  return {
    points: group,
    emit: (...a) => live.emit(...a),
    burst: (...a) => live.burst(...a),
    fling: (...a) => live.fling(...a),
    update: (dt, look, level) => live.update(dt, look, level),
    setScale(v) {
      scale = v;
      live.setScale(v);
    },
    setBudget(next) {
      share = next;
      live.setBudget(next);
    },
    setFlight(onGpu) {
      gpuWanted = onGpu;
      choose();
    },
    setModel(next) {
      current = next;
      cpu?.setModel(next);
      choose();
    },
    clear: () => live.clear(),
    bits: (out) => live.bits(out),
    dispose() {
      cpu?.dispose();
      gpu?.dispose();
    },
  };
}

/** THE CPU SPRAY: the pool flown here in plain arrays, its live grains
 * packed into the instance buffer every frame. */
function createCpuSpray(haze: HazeUniforms): Spray {
  const pool = createSprayPool(CAPACITY);
  pool.model = flown;
  // Per grain: where and how big (xyz, size), how it moves and how opaque
  // (xyz, alpha), and what it is (hardness, glint, its own seed).
  const a0 = new Float32Array(CAPACITY * 4);
  const a1 = new Float32Array(CAPACITY * 4);
  const a2 = new Float32Array(CAPACITY * 3);
  // Each drawn grain's age, s, in draw order: never uploaded — the snow
  // eval lab's measure reads it (`bits`, `plume-probe.ts`).
  const ages = new Float32Array(CAPACITY);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const at0 = new THREE.InstancedBufferAttribute(a0, 4).setUsage(THREE.DynamicDrawUsage);
  const at1 = new THREE.InstancedBufferAttribute(a1, 4).setUsage(THREE.DynamicDrawUsage);
  const at2 = new THREE.InstancedBufferAttribute(a2, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aSpot", at0);
  geometry.setAttribute("aMove", at1);
  geometry.setAttribute("aKind", at2);
  geometry.instanceCount = 0;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...haze,
      ...airLightUniforms(),
      uScale: { value: 600 },
      uShutter: { value: SHUTTER },
      // 0 draws every grain round (the `puff` model), 1 streaked.
      uStreak: { value: pool.model === "puff" ? 0 : 1 },
      uTime: { value: 0 },
      ...SHELTER,
    },
    vertexShader: sprayVertex(CPU_SOURCE),
    fragmentShader: SPRAY_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;

  return {
    points: mesh,
    emit(skier, level, dt, landed, snow) {
      const began = SPRAY_STATS.on ? performance.now() : 0;
      pool.emit(skier, level, dt, landed, snow);
      if (SPRAY_STATS.on) SPRAY_STATS.cpuMs += performance.now() - began;
    },
    burst: pool.burst,
    fling: pool.fling,
    update(dt, look, level) {
      const began = SPRAY_STATS.on ? performance.now() : 0;
      setAirKey(material.uniforms.uKeyCol.value as THREE.Color, look);
      material.uniforms.uTime.value += dt;
      pool.step(dt, level);
      // Pack the live grains to the front of the instance buffer: the draw
      // pays for what is flying, never for the pool's empty slots.
      const { pos, vel, size, alpha, hard, glint, age } = pool;
      let n = 0;
      for (let i = 0; i < pool.cap; i++) {
        if (alpha[i] <= 0.004 || size[i] <= 0) continue;
        const k = i * 3;
        a0[n * 4] = pos[k];
        a0[n * 4 + 1] = pos[k + 1];
        a0[n * 4 + 2] = pos[k + 2];
        a0[n * 4 + 3] = size[i];
        a1[n * 4] = vel[k];
        a1[n * 4 + 1] = vel[k + 1];
        a1[n * 4 + 2] = vel[k + 2];
        a1[n * 4 + 3] = alpha[i];
        a2[n * 3] = hard[i];
        a2[n * 3 + 1] = glint[i];
        // Its own seed off its slot, steady for its life: its ragged rim
        // and its wisp's noise do not boil from frame to frame.
        a2[n * 3 + 2] = (i * 0.618034) % 1;
        ages[n] = age[i];
        n++;
      }
      geometry.instanceCount = n;
      if (n > 0) {
        at0.clearUpdateRanges();
        at1.clearUpdateRanges();
        at2.clearUpdateRanges();
        at0.addUpdateRange(0, n * 4);
        at1.addUpdateRange(0, n * 4);
        at2.addUpdateRange(0, n * 3);
        at0.needsUpdate = true;
        at1.needsUpdate = true;
        at2.needsUpdate = true;
      }
      if (SPRAY_STATS.on) {
        SPRAY_STATS.cpuMs += performance.now() - began;
        // Every live grain sent whole each frame: three attributes of it.
        SPRAY_STATS.bytes += n * 44;
        SPRAY_STATS.live = n;
      }
    },
    bits(out) {
      for (let n = 0; n < geometry.instanceCount; n++) {
        out.push({
          x: a0[n * 4],
          y: a0[n * 4 + 1],
          z: a0[n * 4 + 2],
          r: a0[n * 4 + 3] / 2,
          a: a1[n * 4 + 3],
          age: ages[n],
        });
      }
    },
    setScale(v) {
      material.uniforms.uScale.value = v;
    },
    setBudget(next) {
      pool.setBudget(next);
    },
    setModel(model) {
      pool.model = model;
      material.uniforms.uStreak.value = model === "puff" ? 0 : 1;
    },
    clear() {
      pool.clear();
      geometry.instanceCount = 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
