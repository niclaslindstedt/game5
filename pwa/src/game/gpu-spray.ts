// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WEIGHED SPRAY, FLOWN ON THE GPU. The CPU decides what leaves the snow
// exactly as the CPU pool does — `spray-mass-pool.ts`'s emitter, the same
// kilograms, the same grains, the same way out from under the skis — and
// writes each parcel ONCE into a ring of instance slots when it is thrown:
// where and how fast, its mass and its grains' fall speed, its spread, the
// wind and the snow's plane under it (`spray-flight.ts`'s `Launch`). From
// then on the vertex shader flies it alone off the clock (`SPRAY_FLIGHT_GLSL`)
// and draws it as the CPU's grains are drawn (`spray-glsl.ts`). A frame costs
// the CPU only what was thrown that frame, and the GPU is sent only those
// slots (one run of them, `addUpdateRange`): no per-grain step, no packing,
// no whole-pool upload.
//
// Kept from the GPU-particle lab: the ring, the dirty run, the write-once
// slots. Not kept: its look and its own emission — the spray is the mass
// model's and is drawn by part 3's shaders.

import * as THREE from "three";
import { type Level } from "@engine";

import type { HazeUniforms } from "./haze.ts";
import { SHELTER } from "./shelter.ts";
import { airLightUniforms, setAirKey } from "./snow-air-light.ts";
import type { PlumeBit } from "./spray-film.ts";
import {
  emptyFlown,
  emptyLaunch,
  flyLaunch,
  SPRAY_FLIGHT_GLSL,
  type Launch,
} from "./spray-flight.ts";
import { SPRAY_FRAGMENT, sprayVertex } from "./spray-glsl.ts";
import { createMassPool } from "./spray-mass-pool.ts";
import { SPRAY_STATS } from "./spray-stats.ts";
import type { Spray } from "./spray.ts";
import { nodeTwin } from "./gpu-backend.ts";

/** Floats a slot holds: five vec4s (`SPRAY_FLIGHT_GLSL`'s `aL0`…`aL4`). */
const SLOT = 20;
/** The ring's clock is rebased past this, s, so a long ride's birth times
 * keep a 32-bit float's millimetres. */
const REBASE = 600;
/** The ring's slots over the CPU pool's at the same SPRAY share. A clump's
 * splash is written when it is thrown though born when it lands, so the
 * ring holds those still to come beside the pool's own count (`uOldest`
 * cuts it to what the pool holds): at the pool's own size it would cut a
 * stop's plume short at its peak (a third fewer grains in the air on a LOW
 * hockey stop). */
const RING = 1.5;

/** THE POOL'S MEMORY, KEPT: the CPU pool holds its last `keep` parcels —
 * first in, first out, a clump's splash counted when it is born — and so
 * does the ring, by the birth of the `keep`-th youngest (`uOldest`), so a
 * plume saturating the pool is cut where the pool cuts it. Births a frame
 * shares are counted together (`Born`), the splashes still to be born kept
 * aside (`pending`). */
type Born = { birth: number; count: number };

export function createGpuSpray(haze: HazeUniforms, pool0: number, shutter: number): Spray {
  const capacity = Math.round(pool0 * RING);
  const data = Array.from({ length: 5 }, () => new Float32Array(capacity * 4));
  // Every slot born long ago: dead until written.
  for (let i = 0; i < capacity; i++) data[0][i * 4 + 3] = -1e6;
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const attrs = data.map((a) =>
    new THREE.InstancedBufferAttribute(a, 4).setUsage(THREE.DynamicDrawUsage),
  );
  attrs.forEach((at, k) => geometry.setAttribute(`aL${k}`, at));
  geometry.instanceCount = 0;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...haze,
      ...airLightUniforms(),
      uScale: { value: 600 },
      uShutter: { value: shutter },
      uTime: { value: 0 },
      uNow: { value: 0 },
      uOldest: { value: -1e9 },
      ...SHELTER,
    },
    vertexShader: sprayVertex(SPRAY_FLIGHT_GLSL),
    fragmentShader: SPRAY_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  // Drawn on the node renderer by its twin (`spray-tsl.ts`).
  nodeTwin(material, "particles", "spray-gpu");
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;

  // The ring's clock (`uNow` = now − epoch) and its slots.
  let now = 0;
  let epoch = 0;
  let cap = capacity;
  let head = 0;
  // The highest slot ever written: the draw never pays for slots past it.
  let used = 0;
  // The slots written since the last upload, as one run from `dirtyFrom`.
  let dirtyFrom = -1;
  let dirtyCount = 0;
  let wrote = 0;
  let whole = false;
  let level: Level | null = null;
  const n = { x: 0, y: 1, z: 0 };
  // What the pool would still hold (`Born`): the frames' births, oldest
  // first, the splashes to come, the launches this frame and the cut.
  let keep = pool0;
  let born: Born[] = [];
  let pending: number[] = [];
  let thrown = 0;
  let oldest = -1e9;

  /** The births now due counted, and the cut moved to the `keep`-th
   * youngest — a frame's launches kept or cut whole, whichever is nearer. */
  function recount(at: number, frame: number) {
    if (thrown > 0) born.push({ birth: frame, count: thrown });
    thrown = 0;
    if (pending.length) {
      const due = pending.filter((b) => b <= at).sort((a, b) => a - b);
      if (due.length) {
        pending = pending.filter((b) => b > at);
        for (const b of due) {
          const last = born[born.length - 1];
          if (last && last.birth === b) last.count++;
          else born.push({ birth: b, count: 1 });
        }
      }
    }
    let total = 0;
    let k = born.length - 1;
    for (; k >= 0; k--) {
      total += born[k].count;
      if (total >= keep) break;
    }
    if (k < 0) {
      oldest = -1e9;
      return;
    }
    // Over by more with this frame than short without it: cut it.
    if (total - keep > keep - (total - born[k].count) && k + 1 < born.length) k++;
    oldest = born[k].birth;
    if (k > 0) born = born.slice(k);
  }

  function flush() {
    if (dirtyCount <= 0) return;
    for (const at of attrs) {
      at.addUpdateRange(dirtyFrom * 4, dirtyCount * 4);
      at.needsUpdate = true;
    }
    dirtyFrom = -1;
    dirtyCount = 0;
  }

  const sink = {
    plane(l: Launch) {
      if (!level) {
        l.h0 = l.y - 0.05;
        l.gx = 0;
        l.gz = 0;
        return;
      }
      level.normalAt(l.x, l.z, n);
      const ny = Math.max(n.y, 0.2);
      l.gx = -n.x / ny;
      l.gz = -n.z / ny;
      l.h0 = level.groundAt(l.x, l.z);
    },
    take(l: Launch, delay: number) {
      const i = head;
      head = (head + 1) % cap;
      if (i + 1 > used) used = i + 1;
      // One run of slots an upload: a wrap starts a second, so send the first.
      if (dirtyFrom >= 0 && i !== dirtyFrom + dirtyCount) flush();
      if (dirtyFrom < 0) dirtyFrom = i;
      dirtyCount++;
      wrote++;
      const k = i * 4;
      const [d0, d1, d2, d3, d4] = data;
      d0[k] = l.x;
      d0[k + 1] = l.y;
      d0[k + 2] = l.z;
      d0[k + 3] = now - epoch + delay;
      if (delay > 0) pending.push(now - epoch + delay);
      else thrown++;
      d1[k] = l.vx;
      d1[k + 1] = l.vy;
      d1[k + 2] = l.vz;
      d1[k + 3] = l.life;
      d2[k] = l.mass;
      d2[k + 1] = l.berm ? -l.term : l.term;
      d2[k + 2] = l.rad0;
      d2[k + 3] = l.eddy;
      d3[k] = l.area;
      d3[k + 1] = l.wx;
      d3[k + 2] = l.wz;
      d3[k + 3] = l.hard;
      d4[k] = l.h0;
      d4[k + 1] = l.gx;
      d4[k + 2] = l.gz;
      d4[k + 3] = l.glint;
    },
  };
  const pool = createMassPool(pool0, {}, sink);

  /** Slot `i` read back as a launch, and its age now (−1 cut). */
  const back = emptyLaunch();
  function launchAt(i: number): number {
    const k = i * 4;
    const [d0, d1, d2, d3, d4] = data;
    // Cut as the pool would have overwritten it: never seen again.
    if (d0[k + 3] < oldest) return -1;
    back.x = d0[k];
    back.y = d0[k + 1];
    back.z = d0[k + 2];
    back.vx = d1[k];
    back.vy = d1[k + 1];
    back.vz = d1[k + 2];
    back.life = d1[k + 3];
    back.mass = d2[k];
    back.term = Math.abs(d2[k + 1]);
    back.berm = d2[k + 1] < 0;
    back.rad0 = d2[k + 2];
    back.eddy = d2[k + 3];
    back.area = d3[k];
    back.wx = d3[k + 1];
    back.wz = d3[k + 2];
    back.hard = d3[k + 3];
    back.h0 = d4[k];
    back.gx = d4[k + 1];
    back.gz = d4[k + 2];
    back.glint = d4[k + 3];
    return now - epoch - d0[k + 3];
  }
  const flown = emptyFlown();

  return {
    points: mesh,
    emit(skier, lv, dt, landed, snow) {
      level = lv;
      const began = SPRAY_STATS.on ? performance.now() : 0;
      pool.emit(skier, lv, dt, landed, snow);
      if (SPRAY_STATS.on) SPRAY_STATS.cpuMs += performance.now() - began;
    },
    burst(x, y, z, vx, vz, size, snow) {
      pool.burst(x, y, z, vx, vz, size, snow);
    },
    fling(x, y, z, vx, vy, vz, life, size, hard) {
      pool.fling(x, y, z, vx, vy, vz, life, size, hard);
    },
    update(dt, look, lv) {
      const began = SPRAY_STATS.on ? performance.now() : 0;
      level = lv;
      setAirKey(material.uniforms.uKeyCol.value as THREE.Color, look);
      material.uniforms.uTime.value += dt;
      // This frame's launches were born at the clock before it moves on.
      let frame = now - epoch;
      now += dt;
      // The wind the next launches leave into.
      pool.step(dt, lv);
      if (now - epoch > REBASE) {
        // Every live slot's birth moved onto the new epoch, sent whole.
        const shift = now - epoch;
        epoch = now;
        for (let i = 0; i < used; i++) data[0][i * 4 + 3] -= shift;
        for (const b of born) b.birth -= shift;
        pending = pending.map((b) => b - shift);
        frame -= shift;
        whole = true;
      }
      material.uniforms.uNow.value = now - epoch;
      recount(now - epoch, frame);
      material.uniforms.uOldest.value = oldest;
      if (whole) {
        for (const at of attrs) {
          at.clearUpdateRanges();
          at.needsUpdate = true;
        }
        whole = false;
        dirtyFrom = -1;
        dirtyCount = 0;
        wrote = used;
      } else flush();
      geometry.instanceCount = used;
      if (SPRAY_STATS.on) {
        SPRAY_STATS.cpuMs += performance.now() - began;
        SPRAY_STATS.bytes += wrote * SLOT * 4;
        let live = 0;
        for (let i = 0; i < used; i++) {
          const age = launchAt(i);
          // Counted as the CPU counts its own: the grains still to be seen.
          if (age < 0 || age >= back.life) continue;
          flyLaunch(back, age, flown);
          if (!flown.gone && flown.alpha > 0.004) live++;
        }
        SPRAY_STATS.live = live;
      }
      wrote = 0;
    },
    setScale(v) {
      material.uniforms.uScale.value = v;
    },
    setBudget(next) {
      pool.setBudget(next);
      keep = Math.max(1, Math.round(pool0 * Math.max(0, Math.min(1, next))));
      cap = Math.max(1, Math.round(capacity * Math.max(0, Math.min(1, next))));
      head %= cap;
      if (used > cap) used = cap;
    },
    clear() {
      pool.clear();
      for (let i = 0; i < capacity; i++) data[0][i * 4 + 3] = -1e6;
      whole = true;
      used = 0;
      head = 0;
      born = [];
      pending = [];
      thrown = 0;
      oldest = -1e9;
      geometry.instanceCount = 0;
    },
    bits(out: PlumeBit[]) {
      for (let i = 0; i < used; i++) {
        const age = launchAt(i);
        if (age < 0 || age >= back.life) continue;
        flyLaunch(back, age, flown);
        if (flown.gone || flown.alpha <= 0.004) continue;
        out.push({ x: flown.x, y: flown.y, z: flown.z, r: flown.size / 2, a: flown.alpha, age });
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
