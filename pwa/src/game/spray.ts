// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SKIER THROWS — the snow in the air. Four sources, all read off
// the engine's state and never written back:
//
//   * THE EDGE'S SHEET: a ski carving on its edge shaves a sheet of snow
//     off the outside of the arc, from under the boot and the tail, sized
//     by how far it is tipped (`edge`) and how fast — the fan of a railed
//     turn on a groomer, a wave off it in powder — and by the ski's share
//     of the load (`ski-stand.ts`): the OUTSIDE ski, which carries two
//     thirds of him and more, throws most of it.
//   * THE SKID'S WALL: skis pivoted across the way (`skid`) push a wall of
//     snow ahead of their edges, out to the side the skier is sliding —
//     the hockey stop's spray, off the stations of the ski that carries
//     him most, the downhill one.
//   * THE POWDER OVER THE SHOULDER: in deep snow at speed the tips throw
//     powder up over the skier, sized by how deep they are running.
//   * THE LANDING PUFF: a skier coming down out of the air sends a ring of
//     powder out from under him, sized by how hard he met the snow — read
//     off the airborne → grounded transition rather than the `land` event,
//     so a frame that ran two steps cannot swallow it, and a rival's
//     landing throws the same puff as the player's.
//
// THE HEAVY PART ONLY. The fine powder that stalls, hangs and drifts is
// `snow-cloud.ts`'s; this is the grains and clumps that arc and fall back
// inside a second — and how much of that there is, and how big a clump, is
// the snow's (`snowpack.ts`): wet spring snow and a broken wind slab throw
// clumps and chunks, new snow almost nothing but cloud.
//
// One pool of soft sprites for every skier, simulated here in plain arrays
// (gravity, air drag, a little growth as the cloud disperses) and drawn as
// one `Points` draw. They are lit as the snow is — the sun's colour and the
// sky's blue — and fade into the same haze.

import * as THREE from "three";
import { rotate, type Level, type SkierState } from "@engine";

import { SKY_GLSL, type HazeUniforms } from "./haze.ts";
import { SHELTER, SHELTER_GLSL } from "./shelter.ts";
import { skiShares } from "./ski-stand.ts";
import type { SkyLook } from "./sky.ts";
import type { SnowProps } from "./snowpack.ts";

/** How much HEAVY snow — grains and clumps rather than cloud — a surface
 * throws, 0..1.5: the loose snow less its fine share, more of it the more
 * it comes off in clumps. With no snow said, the packed field's powder. */
export function heavyShare(snow: SnowProps | undefined, packed: number): number {
  if (!snow) return 1 - packed;
  return snow.loose * (0.35 + 0.65 * snow.clumps + 0.3 * (1 - snow.fine));
}

const CAPACITY = 5000;

/** A tiny deterministic-enough stream for the look of the spray (the
 * engine's stream is the engine's; nothing drawn may draw from it). */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export type Spray = {
  points: THREE.Points;
  /** Emit for one rider over `dt`; `landed` is the landing's measure this
   * frame (0 for none); `snow` what the skier is on (`snowpack.ts`). */
  emit(skier: SkierState, level: Level, dt: number, landed: number, snow?: SnowProps): void;
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
  /** Pixels per metre at one metre from the lens (the projection's scale). */
  setScale(pixelsPerMetre: number): void;
  /** The SPRAY row: the share, 0..1, of every emission rate and of the pool
   * the particles are flown from. */
  setBudget(share: number): void;
  clear(): void;
  dispose(): void;
};

export function createSpray(haze: HazeUniforms): Spray {
  const pos = new Float32Array(CAPACITY * 3);
  const vel = new Float32Array(CAPACITY * 3);
  const age = new Float32Array(CAPACITY);
  const life = new Float32Array(CAPACITY).fill(0);
  const size0 = new Float32Array(CAPACITY);
  const size = new Float32Array(CAPACITY);
  const alpha = new Float32Array(CAPACITY);
  /** How much of a CLUMP a particle is, 0 (a soft grain puff) … 1 (a lump of
   * wet snow or a piece of slab): harder-edged, shaded, falling faster. */
  const hard = new Float32Array(CAPACITY);
  let head = 0;
  /** The share of every rate thrown, and the slots in use (`setBudget`). */
  let share = 1;
  let cap = CAPACITY;
  const random = makeRandom(0x5eed);

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
  const hardAttr = new THREE.BufferAttribute(hard, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aHard", hardAttr);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("aSize", sizeAttr);
  geometry.setAttribute("aAlpha", alphaAttr);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...haze,
      uLit: { value: new THREE.Color(1, 1, 1) },
      uShade: { value: new THREE.Color(0.6, 0.7, 0.9) },
      uScale: { value: 600 },
      ...SHELTER,
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aHard;
      uniform float uScale;
      varying float vAlpha;
      varying float vHard;
      varying vec3 vWorld;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vWorld = position;
        vAlpha = aAlpha;
        vHard = aHard;
        gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${SKY_GLSL}
      ${SHELTER_GLSL}
      uniform vec3 uLit;
      uniform vec3 uShade;
      varying float vAlpha;
      varying float vHard;
      varying vec3 vWorld;
      void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r = dot(c, c);
        if (r > 1.0 || sheltered(vWorld)) discard;
        // A grain puff is soft to its rim; a clump is a lump with an edge.
        float soft = mix((1.0 - r) * (1.0 - r), smoothstep(1.0, 0.55, r), vHard);
        // The sunward side of a puff is brighter than its underside, and a
        // clump's much more so: it is a solid, not a haze.
        float lit = clamp(0.55 - c.y * 0.45 * (1.0 + vHard), 0.0, 1.0);
        vec3 col = mix(uShade * (1.0 - 0.3 * vHard), uLit, lit);
        gl_FragColor = vec4(col, soft * vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec3 ray = vWorld - cameraPosition;
        float d = length(ray);
        vec3 hz = hazeColour(ray / max(d, 1e-3));
        #if defined(TONE_MAPPING)
          hz = toneMapping(hz);
        #endif
        hz = linearToOutputTexel(vec4(hz, 1.0)).rgb;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, hz, hazeAmount(d, ray.y));
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;

  function spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    lifetime: number,
    s: number,
    h = 0,
  ) {
    const i = head;
    hard[i] = h;
    head = (head + 1) % cap;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    vel[i * 3] = vx;
    vel[i * 3 + 1] = vy;
    vel[i * 3 + 2] = vz;
    age[i] = 0;
    life[i] = lifetime;
    size0[i] = s;
  }

  // Emission carries fractions over from frame to frame, per skier.
  let debt = new WeakMap<SkierState, number[]>();
  const shares: [number, number] = [0.5, 0.5];

  return {
    points,
    fling(x, y, z, vx, vy, vz, lifetime, s, h) {
      if (random() > share) return;
      spawn(x, y, z, vx, vy, vz, lifetime, s, h);
    },
    emit(skier, level, dt, landed, snow) {
      let owed = debt.get(skier);
      if (!owed) {
        owed = [0, 0, 0, 0];
        debt.set(skier, owed);
      }
      const powder = heavyShare(snow, skier.packed);
      const clumps = snow ? snow.clumps : 0.25;
      // Bare ice has nothing loose on it to throw.
      const base = snow ? Math.min(1, snow.loose * 5) : 1;
      const edge = Math.min(1, Math.abs(skier.edge) / 0.9);
      const skid = skier.skid;
      // Which way the skis are sliding across their own line: the skid
      // pushes snow to the outside of the pivot, the edge shaves it off the
      // outside of the arc.
      const outSide =
        skier.skiAngle !== 0 ? -Math.sign(skier.skiAngle) : -Math.sign(skier.edge || 1);
      // Which ski carries him, and so throws the snow (`ski-stand.ts`).
      skiShares(skier, shares);
      // THE EDGE'S SHEET, off the boot and the tail of each ski, by its
      // share of the load — the two together throwing what the pair does.
      for (let k = 0; k < 2; k++) {
        const mid = skier.contacts[k * 3 + 1];
        const tail = skier.contacts[k * 3 + 2];
        if (!mid || !mid.touching) continue;
        const rate =
          (edge * (1 - skid) * skier.speed * 9 + skier.speed * 0.6) *
          (0.15 * base + powder) *
          share *
          2 *
          shares[k];
        owed[k] += rate * dt;
        while (owed[k] >= 1) {
          owed[k] -= 1;
          const c = random() < 0.6 && tail.touching ? tail : mid;
          const kick = rotate(skier.q, {
            x: outSide * (0.8 + random() * 2.2 + 1.5 * edge),
            y: 0.8 + random() * (1.6 + 1.2 * edge),
            z: -0.6 - random() * 1.6,
          });
          spawn(
            c.x + (random() - 0.5) * 0.12,
            c.y + 0.04,
            c.z + (random() - 0.5) * 0.25,
            skier.vx * 0.55 + kick.x,
            skier.vy * 0.3 + kick.y,
            skier.vz * 0.55 + kick.z,
            0.4 + random() * 0.45,
            (0.08 + random() * 0.1) * (1 + 1.2 * clumps * random()),
            clumps * random(),
          );
        }
      }
      // THE SKID'S WALL, off every station across the way.
      if (skid > 0.05 && !skier.airborne) {
        const rate = skid * Math.min(1, skier.speed / 12) * (60 * base + 260 * powder) * share;
        owed[2] += rate * dt;
        while (owed[2] >= 1) {
          owed[2] -= 1;
          // Off the ski that carries him, as often as it does.
          const k = random() < shares[0] ? 0 : 1;
          const c = skier.contacts[k * 3 + Math.floor(random() * 3)];
          if (!c.touching) continue;
          const kick = rotate(skier.q, {
            x: outSide * (1.5 + random() * 3 + skid * 2),
            y: 0.6 + random() * 2.4,
            z: (random() - 0.5) * 1.5,
          });
          spawn(
            c.x + (random() - 0.5) * 0.2,
            c.y + 0.05,
            c.z + (random() - 0.5) * 0.3,
            skier.vx * 0.5 + kick.x,
            skier.vy * 0.3 + kick.y,
            skier.vz * 0.5 + kick.z,
            0.45 + random() * 0.5,
            (0.1 + random() * 0.14) * (1 + 1.4 * clumps * random()),
            clumps * (0.4 + 0.6 * random()),
          );
        }
      }
      // THE POWDER OVER THE SHOULDER, off the tips running deep.
      const deep = Math.max(skier.contacts[0]?.sink ?? 0, skier.contacts[3]?.sink ?? 0);
      if (deep > 0.06 && skier.speed > 4) {
        const rate =
          Math.min(1, deep / 0.35) * Math.min(1, skier.speed / 15) * 380 * powder * share;
        owed[3] += rate * dt;
        while (owed[3] >= 1) {
          owed[3] -= 1;
          const c = skier.contacts[random() < 0.5 ? 0 : 3];
          const kick = rotate(skier.q, {
            x: (random() - 0.5) * 2,
            y: 2 + random() * 3,
            z: -(1.5 + random() * 3),
          });
          spawn(
            c.x + (random() - 0.5) * 0.2,
            c.y + 0.1,
            c.z + 0.2,
            skier.vx * 0.6 + kick.x,
            skier.vy * 0.4 + kick.y,
            skier.vz * 0.6 + kick.z,
            0.5 + random() * 0.6,
            (0.09 + random() * 0.12) * (1 + 1.2 * clumps * random()),
            clumps * random(),
          );
        }
      }
      // THE LANDING PUFF.
      if (landed > 0) {
        const n = Math.round(
          Math.min(160, 24 * base + landed * 16 * (0.3 * base + powder)) * share,
        );
        const ground = level.groundAt(skier.x, skier.z);
        for (let i = 0; i < n; i++) {
          const a = random() * Math.PI * 2;
          const sp = 2 + random() * (3 + landed * 0.8);
          spawn(
            skier.x + Math.cos(a) * 0.6,
            ground + 0.1 + random() * 0.3,
            skier.z + Math.sin(a) * 1.0,
            Math.cos(a) * sp + skier.vx * 0.4,
            1 + random() * (1.5 + landed * 0.3),
            Math.sin(a) * sp + skier.vz * 0.4,
            // Short: a puff is a burst that falls back into the snow, and
            // one that hangs for a second and a half reads as fog.
            0.3 + random() * 0.45,
            (0.18 + random() * 0.22) * (1 - 0.4 * clumps),
            clumps * random(),
          );
        }
      }
    },
    burst(x, y, z, vx, vz, size, snow) {
      // THE WIPEOUT'S BURST: snow flung up and out, bigger and slower to
      // fall than a landing's puff — a man and his skis going in separately.
      const heavy = snow ? Math.min(1.2, 0.4 + heavyShare(snow, 0)) : 1;
      const n = Math.round(Math.min(220, (30 + 170 * size) * heavy) * share);
      for (let i = 0; i < n; i++) {
        const a = random() * Math.PI * 2;
        const sp = 1 + random() * (2 + 4 * size);
        spawn(
          x + Math.cos(a) * 0.5 * random(),
          y + random() * 0.4,
          z + Math.sin(a) * 0.5 * random(),
          Math.cos(a) * sp + vx * 0.35,
          1.5 + random() * (2 + 3 * size),
          Math.sin(a) * sp + vz * 0.35,
          0.45 + random() * (0.4 + 0.5 * size),
          0.2 + random() * 0.3 * (0.6 + size),
        );
      }
    },
    update(dt, look, level) {
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
      const drag = Math.exp(-2.4 * dt);
      for (let i = 0; i < cap; i++) {
        if (life[i] <= 0) {
          alpha[i] = 0;
          size[i] = 0;
          continue;
        }
        age[i] += dt;
        const t = age[i] / life[i];
        if (t >= 1) {
          life[i] = 0;
          alpha[i] = 0;
          size[i] = 0;
          continue;
        }
        const k = i * 3;
        vel[k] *= drag;
        // A clump falls nearly as a stone does; a grain puff floats a little.
        vel[k + 1] = vel[k + 1] * drag - (6.5 + 3.3 * hard[i]) * dt;
        vel[k + 2] *= drag;
        pos[k] += vel[k] * dt;
        pos[k + 1] += vel[k + 1] * dt;
        pos[k + 2] += vel[k + 2] * dt;
        // Settled onto the snow: it stops and fades where it lies.
        const g = level.groundAt(pos[k], pos[k + 2]);
        if (pos[k + 1] < g + 0.05) {
          pos[k + 1] = g + 0.05;
          vel[k] *= 0.5;
          vel[k + 1] = 0;
          vel[k + 2] *= 0.5;
          age[i] += dt * 5;
        }
        size[i] = size0[i] * (1 + 1.6 * t * (1 - hard[i]));
        // A clump holds together until it lands; a grain puff thins.
        const h = hard[i];
        alpha[i] =
          Math.min(1, t * 12) * ((1 - t) * (1 - t) * 0.75 * (1 - h) + (1 - t ** 4) * 0.95 * h);
      }
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
      hardAttr.needsUpdate = true;
    },
    setScale(v) {
      material.uniforms.uScale.value = v;
    },
    setBudget(next) {
      share = Math.max(0, Math.min(1, next));
      cap = Math.max(1, Math.round(CAPACITY * share));
      head %= cap;
      // Whatever flew in the slots past the new pool is let go of at once,
      // and the draw stops at the pool's end.
      for (let i = cap; i < CAPACITY; i++) {
        life[i] = 0;
        alpha[i] = 0;
        size[i] = 0;
      }
      geometry.setDrawRange(0, cap);
      alphaAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    },
    clear() {
      life.fill(0);
      alpha.fill(0);
      size.fill(0);
      debt = new WeakMap();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
