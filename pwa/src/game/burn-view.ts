// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKIER BURNING, AS DRAWN — a free ride's skier who rode into a camp
// fire or a bonfire (`engine/game/fire-burn.ts`, `GameState.burn`), decided
// by `burn-plan.ts` and drawn here over his own figure as it is posed this
// frame — on his skis, thrown, stumbling, lying — so the fire goes where
// he goes:
//
//   * THE FLAMES: two tongues of fire on every patch of him the fire has
//     reached, climbing from his boots to his helmet, standing up off him
//     whichever way he lies — each a quad turned to the lens, shaped in the
//     fires' own shader (`fire-glsl.ts`), one instanced draw. A soft glow
//     round him.
//   * THE SMOKE off his melting clothes, thick and black, carried off on
//     the wind; the SPARKS and the burning drips thrown up off him — and,
//     the moment he caught, a burst of sparks out of the fire he rode into.
//     Both a pool of particles flown here on the run's own clock, one draw
//     each.
//   * THE CHAR: his clothes, helmet and gloves blackened behind the fire
//     as it climbs, browned in patches where the melted shell ran — the
//     cloth's own colours painted over (`gore-soak.ts`'s `cleanColours`
//     gives them back on the next run).
//   * THE LIGHT: the flames' warm, flickering light dealt a lamp slot
//     (`lamps`), so after dark he lights the snow round him.
//   * Once the flames are out, he SMOULDERS: embers in the char and thin
//     grey wisps, dying away.
//
// Built only once a run sets him alight, and never on a run kept safe for
// work (`burnShown`). Presentation only.

import * as THREE from "three";
import { FIRE_BURN, windAt, type GameState } from "@engine";

import {
  BURN_FLAMES,
  BURN_LOOK,
  BURN_SITES,
  FULL_HEAT,
  boneAt,
  burnHash,
  burnLight,
  burnShown,
  charAt,
  charColour,
  frontOf,
  fuelOf,
  heightShare,
  siteHeat,
  sinceCaught,
  smoulderOf,
} from "./burn-plan.ts";
import { FADE, FLAME_FRAGMENT, SMOKE_FRAGMENT, SPARK_FRAGMENT } from "./fire-glsl.ts";
import { ALL_ROUND, FIRE_LIGHT } from "./fires-view.ts";
import { cleanColours } from "./gore-soak.ts";
import type { HazeUniforms } from "./haze.ts";
import type { Flood } from "./headlamp.ts";
import type { SkisModel } from "./skis-body.ts";
import type { SkyLook } from "./sky.ts";

/** The pools' sizes, and how much each throws. Smoke and sparks a second
 * off his flames at full (`FULL_HEAT`), the catch's burst, the smoulder's. */
const POOL = { smoke: 140, spark: 220 } as const;
const THROW = {
  smoke: 26,
  spark: 70,
  burst: { spark: 140, smoke: 10 },
  smoulder: { smoke: 5, ember: 9 },
} as const;
/** How far the flames, smoke and sparks are drawn, m. */
const REACH = 600;
/** The flames stood this far toward the lens off his skin, m, so his body
 * cuts only the ones round his far side. */
const PROUD = 0.1;

export type BurnView = {
  group: THREE.Group;
  /** One frame: the run, his figure as posed this frame (null: none drawn)
   * and the run's own time since the last frame, s (0 under a pause). */
  frame(state: GameState, model: SkisModel | null, simDt: number): void;
  /** The sky's light on his smoke. */
  light(look: SkyLook): void;
  /** His flames' light onto `out`; `lit` the night's lamps (0 by day … 1). */
  lamps(lit: number, out: Flood[]): void;
  dispose(): void;
};

/** A quad from (-1, `y0`) to (1, 1), one per instance. */
function quad(y0: number): THREE.InstancedBufferGeometry {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, y0, 0, 1, y0, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  return geo;
}

/** A per-instance attribute rewritten every frame. */
function live(geo: THREE.InstancedBufferGeometry, name: string, n: number, size: number) {
  const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size);
  a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute(name, a);
  return a;
}

/** A pool of particles flown on the CPU: place, velocity, age, life, size,
 * and what kind (0 a spark, 1 an ember lying in the char; 0 black smoke,
 * 1 a grey wisp). */
type Pool = {
  n: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  age: Float32Array;
  life: Float32Array;
  size: Float32Array;
  kind: Uint8Array;
};
function pool(n: number): Pool {
  return {
    n: 0,
    x: new Float32Array(n),
    y: new Float32Array(n),
    z: new Float32Array(n),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    vz: new Float32Array(n),
    age: new Float32Array(n),
    life: new Float32Array(n),
    size: new Float32Array(n),
    kind: new Uint8Array(n),
  };
}
/** The oldest particle dropped when the pool is full. */
function slot(p: Pool): number {
  if (p.n < p.x.length) return p.n++;
  let worst = 0;
  for (let i = 1; i < p.n; i++) if (p.age[i] / p.life[i] > p.age[worst] / p.life[worst]) worst = i;
  return worst;
}
function drop(p: Pool, i: number): void {
  const j = --p.n;
  if (i === j) return;
  for (const k of ["x", "y", "z", "vx", "vy", "vz", "age", "life", "size", "kind"] as const) {
    p[k][i] = p[k][j];
  }
}

export function createBurnView(haze: HazeUniforms): BurnView {
  const group = new THREE.Group();
  group.name = "burn";
  group.visible = false;
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const shared = {
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector3() },
    uNight: { value: 0 },
    uLit: { value: new THREE.Color(0.8, 0.8, 0.8) },
    uGlow: { value: 0 },
    uHaze: haze.uHaze,
    uReach: { value: REACH },
  };
  const shader = (
    vertex: string,
    fragment: string,
    blending: THREE.Blending,
  ): THREE.ShaderMaterial => {
    const m = new THREE.ShaderMaterial({
      uniforms: shared,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending,
    });
    mats.push(m);
    return m;
  };
  const draw = (
    geo: THREE.InstancedBufferGeometry,
    mat: THREE.Material,
    order: number,
    name: string,
  ) => {
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    mesh.name = name;
    group.add(mesh);
  };

  // THE FLAMES: two tongues a patch.
  const TONGUES = BURN_SITES.length * 2;
  const flameGeo = quad(0);
  const aBase = live(flameGeo, "aBase", TONGUES, 4);
  const aSize = live(flameGeo, "aSize", TONGUES, 3);
  draw(
    flameGeo,
    shader(
      /* glsl */ `
      attribute vec4 aBase;
      attribute vec3 aSize;
      uniform float uTime;
      uniform vec3 uWind;
      ${FADE}
      varying vec2 vUv;
      varying float vSeed;
      varying float vFade;
      void main() {
        float s = aBase.w;
        float breathe = 0.78 + 0.16 * sin(uTime * 6.1 + s * 17.3) + 0.1 * sin(uTime * 13.3 + s * 31.1);
        float h = aSize.y * breathe;
        vec3 toEye = cameraPosition - aBase.xyz;
        float far = length(toEye);
        vec2 side = normalize(vec2(toEye.z, -toEye.x) + vec2(1e-5, 0.0));
        float v = position.y;
        vec3 p = aBase.xyz + toEye / max(far, 1e-3) * ${PROUD.toFixed(2)};
        p += vec3(side.x, 0.0, side.y) * position.x * aSize.x * 0.5;
        p.y += (v - 0.12) * h;
        vec2 lay = uWind.xz * 0.06;
        lay /= max(1.0, length(lay) / 0.7);
        p.xz += lay * h * v * v;
        vUv = vec2(position.x, v);
        vSeed = s;
        vFade = aSize.z * fadeAt(far);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
      FLAME_FRAGMENT,
      THREE.NormalBlending,
    ),
    6,
    "burn-flames",
  );

  // THE GLOW round him, wide at night.
  const glowGeo = quad(-1);
  const aGlow = live(glowGeo, "aGlow", 1, 4);
  draw(
    glowGeo,
    shader(
      /* glsl */ `
      attribute vec4 aGlow;
      uniform float uNight;
      uniform float uGlow;
      uniform float uTime;
      ${FADE}
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float size = aGlow.w * mix(0.8, 1.25, uNight);
        vec4 mv = viewMatrix * vec4(aGlow.xyz, 1.0);
        float dist = length(mv.xyz);
        mv.xyz += normalize(-mv.xyz) * min(size * 0.5, dist * 0.5);
        mv.xy += position.xy * size;
        vUv = position.xy;
        float flick = 0.9 + 0.1 * sin(uTime * 7.3) + 0.06 * sin(uTime * 15.1);
        vAlpha = uGlow * mix(0.3, 0.42, uNight) * flick * fadeAt(dist) * smoothstep(0.6, 2.5, dist);
        gl_Position = projectionMatrix * mv;
      }`,
      /* glsl */ `
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float r = length(vUv);
        if (r > 1.0) discard;
        float g = 1.0 - r;
        g = g * g * g;
        gl_FragColor = vec4(vec3(1.0, 0.45, 0.12) * g * vAlpha, 1.0);
        #include <colorspace_fragment>
      }`,
      THREE.AdditiveBlending,
    ),
    7,
    "burn-glow",
  );
  glowGeo.instanceCount = 0;

  // THE SPARKS and the embers.
  const sparks = pool(POOL.spark);
  const sparkGeo = quad(-1);
  const aSpark = live(sparkGeo, "aSpark", POOL.spark, 4);
  const aSparkLife = live(sparkGeo, "aSparkLife", POOL.spark, 2);
  draw(
    sparkGeo,
    shader(
      /* glsl */ `
      attribute vec4 aSpark;
      attribute vec2 aSparkLife;
      ${FADE}
      varying vec2 vUv;
      varying float vAlpha;
      varying float vHeat;
      void main() {
        vec4 mv = viewMatrix * vec4(aSpark.xyz, 1.0);
        float dist = length(mv.xyz);
        mv.xy += position.xy * max(aSpark.w, dist * 0.0016);
        vUv = position.xy;
        vHeat = aSparkLife.y;
        vAlpha = aSparkLife.x * fadeAt(dist) * smoothstep(250.0, 120.0, dist);
        gl_Position = projectionMatrix * mv;
      }`,
      SPARK_FRAGMENT,
      THREE.AdditiveBlending,
    ),
    8,
    "burn-sparks",
  );

  // THE SMOKE: black off the melting shell, grey once it smoulders.
  const smoke = pool(POOL.smoke);
  const smokeGeo = quad(-1);
  const aPuff = live(smokeGeo, "aPuff", POOL.smoke, 4);
  const aPuffLife = live(smokeGeo, "aPuffLife", POOL.smoke, 4);
  draw(
    smokeGeo,
    shader(
      /* glsl */ `
      attribute vec4 aPuff;
      attribute vec4 aPuffLife;
      uniform float uNight;
      uniform vec3 uLit;
      ${FADE}
      varying vec2 vUv;
      varying float vAlpha;
      varying vec3 vCol;
      varying float vSeed;
      void main() {
        vec4 mv = viewMatrix * vec4(aPuff.xyz, 1.0);
        float dist = length(mv.xyz);
        float spin = aPuffLife.y;
        vec2 q = vec2(cos(spin) * position.x - sin(spin) * position.y,
                      sin(spin) * position.x + cos(spin) * position.y);
        mv.xy += q * aPuff.w;
        vUv = position.xy;
        vSeed = fract(aPuffLife.y * 0.159);
        vAlpha = aPuffLife.x * fadeAt(dist) * smoothstep(0.4, 1.5, dist);
        // Lit by the sky, the black of burning plastic or a wood-smoke grey;
        // glowing from under by his flames at night.
        vCol = uLit * aPuffLife.z + vec3(1.0, 0.4, 0.1) * uNight * 0.16 * aPuffLife.w;
        gl_Position = projectionMatrix * mv;
      }`,
      SMOKE_FRAGMENT,
      THREE.NormalBlending,
    ),
    5,
    "burn-smoke",
  );

  // ----------------------------------------------------------- per frame
  const at = new THREE.Vector3();
  const p = { x: 0, y: 0, z: 0 };
  const lit = new Float32Array(BURN_SITES.length * 4); // x, y, z, heat a patch
  let heatSum = 0;
  let lastBurnT = Number.NaN;
  let seed = 1;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const middle = new THREE.Vector3();
  let smoulder = 0;
  let night = 0;
  let acc = { smoke: 0, spark: 0, wisp: 0, ember: 0 };

  /** A lit patch, picked by its heat (or any, for the smoulder). */
  const pickSite = (any: boolean): number => {
    for (let tries = 0; tries < 8; tries++) {
      const i = Math.floor(rand() * BURN_SITES.length);
      if (any || rand() < lit[i * 4 + 3]) return i;
    }
    return -1;
  };
  const throwSpark = (x: number, y: number, z: number, ember: boolean, burst = false): void => {
    const i = slot(sparks);
    sparks.x[i] = x;
    sparks.y[i] = y;
    sparks.z[i] = z;
    const a = rand() * Math.PI * 2;
    const r = burst ? 1.5 + rand() * 4 : ember ? 0.05 : 0.3 + rand() * 0.9;
    sparks.vx[i] = Math.sin(a) * r;
    sparks.vz[i] = Math.cos(a) * r;
    sparks.vy[i] = burst ? 2 + rand() * 5 : ember ? 0.05 + rand() * 0.2 : 1.2 + rand() * 2.4;
    sparks.age[i] = 0;
    sparks.life[i] = burst ? 0.8 + rand() * 1.4 : ember ? 1.2 + rand() * 2 : 0.6 + rand() * 1.1;
    sparks.size[i] = ember ? 0.018 : 0.012 + rand() * 0.016;
    sparks.kind[i] = ember ? 1 : 0;
  };
  const throwPuff = (x: number, y: number, z: number, grey: boolean, big = 1): void => {
    const i = slot(smoke);
    smoke.x[i] = x + (rand() - 0.5) * 0.2;
    smoke.y[i] = y;
    smoke.z[i] = z + (rand() - 0.5) * 0.2;
    smoke.vx[i] = (rand() - 0.5) * 0.3;
    smoke.vz[i] = (rand() - 0.5) * 0.3;
    smoke.vy[i] = grey ? 0.5 + rand() * 0.3 : 1.2 + rand() * 0.8;
    smoke.age[i] = 0;
    smoke.life[i] = grey ? 3.5 + rand() * 2 : 3 + rand() * 2;
    smoke.size[i] = (grey ? 0.16 : 0.32 + rand() * 0.16) * big;
    smoke.kind[i] = grey ? 1 : 0;
  };

  // THE CHAR on his cloth: each skinned mesh's colours as others last
  // left them, and the version of the colours this view last wrote.
  type Charred = { geo: THREE.BufferGeometry; base: Float32Array; mine: number; key: number };
  let charred: Charred[] = [];
  let charGroup: THREE.Object3D | null = null;
  const tint: [number, number, number] = [0, 0, 0];
  const unchar = (): void => {
    for (const c of charred) {
      const col = c.geo.getAttribute("color") as THREE.BufferAttribute;
      (col.array as Float32Array).set(cleanColours(c.geo));
      col.needsUpdate = true;
    }
    charred = [];
    charGroup = null;
  };
  const char = (model: SkisModel, front: number, since: number): void => {
    const skin = model.skin().group;
    if (skin !== charGroup) {
      unchar();
      charGroup = skin;
      skin.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (!m.isSkinnedMesh || !m.geometry.getAttribute("color")) return;
        const col = m.geometry.getAttribute("color") as THREE.BufferAttribute;
        cleanColours(m.geometry);
        charred.push({
          geo: m.geometry,
          base: Float32Array.from(col.array as Float32Array),
          mine: -1,
          key: -1,
        });
      });
    }
    // Rewritten as the fire climbs and the cloth blackens: about thirty
    // times a burn, and whenever the blood has painted it since.
    const key =
      Math.round(front * 40) * 1000 + Math.round(Math.min(1, since / BURN_LOOK.char.deep) * 30);
    for (const c of charred) {
      const col = c.geo.getAttribute("color") as THREE.BufferAttribute;
      const arr = col.array as Float32Array;
      const theirs = col.version !== c.mine;
      if (theirs && c.mine >= 0) c.base.set(arr);
      if (!theirs && c.key === key) continue;
      const pos = c.geo.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const n = burnHash(Math.round(x * 22), Math.round(y * 22), Math.round(z * 22));
        const k = charAt(heightShare(y), front, since, n);
        const j = 3 * i;
        if (k <= 0) {
          arr[j] = c.base[j];
          arr[j + 1] = c.base[j + 1];
          arr[j + 2] = c.base[j + 2];
          continue;
        }
        charColour(n, tint);
        arr[j] = c.base[j] + (tint[0] - c.base[j]) * k;
        arr[j + 1] = c.base[j + 1] + (tint[1] - c.base[j + 1]) * k;
        arr[j + 2] = c.base[j + 2] + (tint[2] - c.base[j + 2]) * k;
      }
      col.needsUpdate = true;
      c.mine = col.version;
      c.key = key;
    }
  };

  const clearAll = (): void => {
    sparks.n = 0;
    smoke.n = 0;
    flameGeo.instanceCount = 0;
    glowGeo.instanceCount = 0;
    sparkGeo.instanceCount = 0;
    smokeGeo.instanceCount = 0;
    heatSum = 0;
    smoulder = 0;
    acc = { smoke: 0, spark: 0, wisp: 0, ember: 0 };
  };

  return {
    group,
    frame(state, model, simDt) {
      const burn = state.burn;
      if (!burnShown(state) || !burn || !model) {
        if (group.visible) {
          group.visible = false;
          clearAll();
          lastBurnT = Number.NaN;
        }
        if (charred.length > 0) unchar();
        return;
      }
      group.visible = true;
      const t = state.t;
      shared.uTime.value = t;
      const wind = windAt(state.level, t);
      shared.uWind.value.set(wind.x, 0, wind.z);
      if (burn.t !== lastBurnT) {
        // Caught afresh: the pools start clean, a burst out of the fire.
        lastBurnT = burn.t;
        clearAll();
        seed = (Math.floor(burn.t * 1000) ^ 0x9e3779b9) >>> 0;
        for (let i = 0; i < THROW.burst.spark; i++)
          throwSpark(burn.x, burn.y + 0.3, burn.z, false, true);
        for (let i = 0; i < THROW.burst.smoke; i++)
          throwPuff(burn.x, burn.y + 0.5, burn.z, false, 1.6);
      }
      const since = sinceCaught(state);
      const front = frontOf(since);
      const fuel = fuelOf(burn);
      smoulder = smoulderOf(burn, since - FIRE_BURN.lasts);

      // WHERE EVERY PATCH OF HIM IS, as posed this frame.
      const skin = model.skin();
      skin.group.updateWorldMatrix(true, false);
      const M = skin.group.matrixWorld;
      heatSum = 0;
      middle.set(0, 0, 0);
      let n = 0;
      const base = aBase.array as Float32Array;
      const size = aSize.array as Float32Array;
      // Lower and narrower once he is down: the figure shows through.
      const down = state.skier.thrown ? BURN_LOOK.lying : { height: 1, width: 1 };
      for (let i = 0; i < BURN_SITES.length; i++) {
        const s = BURN_SITES[i];
        boneAt(skin.frames[s.bone], s.along, s.around, s.out, p);
        at.set(p.x, p.y, p.z).applyMatrix4(M);
        const heat = siteHeat(s, front, fuel);
        lit[i * 4] = at.x;
        lit[i * 4 + 1] = at.y;
        lit[i * 4 + 2] = at.z;
        lit[i * 4 + 3] = heat;
        middle.add(at);
        heatSum += heat;
        if (heat < 0.02) continue;
        const F = BURN_FLAMES[s.stuff];
        for (let k = 0; k < 2; k++) {
          const big = k === 0 ? 1 : 0.65;
          base[n * 4] = at.x;
          base[n * 4 + 1] = at.y + k * 0.06;
          base[n * 4 + 2] = at.z;
          base[n * 4 + 3] = (s.seed + k * 0.5) % 1;
          size[n * 3] = F.width * down.width * big * (0.6 + 0.4 * heat);
          size[n * 3 + 1] = F.height * down.height * big * (0.45 + 0.55 * heat);
          size[n * 3 + 2] = Math.min(1, heat * 1.3);
          n++;
        }
      }
      middle.multiplyScalar(1 / BURN_SITES.length);
      flameGeo.instanceCount = n;
      aBase.needsUpdate = n > 0;
      aSize.needsUpdate = n > 0;
      const share = heatSum / FULL_HEAT;
      shared.uGlow.value = Math.min(1, share * 1.6);
      const glow = aGlow.array as Float32Array;
      glow[0] = middle.x;
      glow[1] = middle.y + 0.3;
      glow[2] = middle.z;
      glow[3] = 2.2;
      aGlow.needsUpdate = true;
      glowGeo.instanceCount = share > 0.01 ? 1 : 0;

      // WHAT HE THROWS, on the run's clock.
      const dt = Math.min(simDt, 0.1);
      if (dt > 0) {
        acc.smoke += THROW.smoke * share * dt;
        acc.spark += THROW.spark * share * dt;
        acc.wisp += THROW.smoulder.smoke * smoulder * dt;
        acc.ember += THROW.smoulder.ember * smoulder * dt;
        for (; acc.smoke >= 1; acc.smoke--) {
          const i = pickSite(false);
          if (i >= 0) throwPuff(lit[i * 4], lit[i * 4 + 1] + 0.25, lit[i * 4 + 2], false);
        }
        for (; acc.spark >= 1; acc.spark--) {
          const i = pickSite(false);
          if (i >= 0) throwSpark(lit[i * 4], lit[i * 4 + 1] + 0.1, lit[i * 4 + 2], false);
        }
        for (; acc.wisp >= 1; acc.wisp--) {
          const i = pickSite(true);
          throwPuff(lit[i * 4], lit[i * 4 + 1] + 0.05, lit[i * 4 + 2], true);
        }
        for (; acc.ember >= 1; acc.ember--) {
          const i = pickSite(true);
          throwSpark(lit[i * 4], lit[i * 4 + 1], lit[i * 4 + 2], true);
        }
        // Sparks: up on the heat, slowing, swirled, carried downwind;
        // burning drips fall.
        for (let i = sparks.n - 1; i >= 0; i--) {
          sparks.age[i] += dt;
          if (sparks.age[i] >= sparks.life[i]) {
            drop(sparks, i);
            continue;
          }
          const drag = Math.exp(-dt * 1.4);
          sparks.vx[i] = sparks.vx[i] * drag + wind.x * (1 - drag) * 0.7;
          sparks.vz[i] = sparks.vz[i] * drag + wind.z * (1 - drag) * 0.7;
          sparks.vy[i] = sparks.vy[i] * drag - (sparks.kind[i] ? 0 : 0.6 * dt);
          sparks.x[i] += sparks.vx[i] * dt;
          sparks.y[i] += sparks.vy[i] * dt;
          sparks.z[i] += sparks.vz[i] * dt;
        }
        // Smoke: up on its heat, slowing as it cools, laid over by the wind
        // and swelling.
        for (let i = smoke.n - 1; i >= 0; i--) {
          smoke.age[i] += dt;
          if (smoke.age[i] >= smoke.life[i]) {
            drop(smoke, i);
            continue;
          }
          const drag = Math.exp(-dt * 0.6);
          smoke.vx[i] = smoke.vx[i] * drag + wind.x * 0.8 * (1 - drag);
          smoke.vz[i] = smoke.vz[i] * drag + wind.z * 0.8 * (1 - drag);
          smoke.vy[i] *= Math.exp(-dt * 0.35);
          smoke.x[i] += smoke.vx[i] * dt;
          smoke.y[i] += smoke.vy[i] * dt;
          smoke.z[i] += smoke.vz[i] * dt;
          smoke.size[i] += dt * (smoke.kind[i] ? 0.16 : 0.5);
        }
      }
      const sp = aSpark.array as Float32Array;
      const sl = aSparkLife.array as Float32Array;
      for (let i = 0; i < sparks.n; i++) {
        const k = sparks.age[i] / sparks.life[i];
        sp[i * 4] = sparks.x[i];
        sp[i * 4 + 1] = sparks.y[i];
        sp[i * 4 + 2] = sparks.z[i];
        sp[i * 4 + 3] = sparks.size[i] * (1 - 0.5 * k);
        const flick = 0.6 + 0.4 * Math.sin(t * 23 + i * 1.7);
        sl[i * 2] = (1 - k) * Math.min(1, k * 25) * flick * (sparks.kind[i] ? 0.7 : 1);
        sl[i * 2 + 1] = sparks.kind[i] ? 0.35 + 0.3 * flick : 1 - k;
      }
      sparkGeo.instanceCount = sparks.n;
      aSpark.needsUpdate = sparks.n > 0;
      aSparkLife.needsUpdate = sparks.n > 0;
      const pu = aPuff.array as Float32Array;
      const pl = aPuffLife.array as Float32Array;
      for (let i = 0; i < smoke.n; i++) {
        const k = smoke.age[i] / smoke.life[i];
        const grey = smoke.kind[i] === 1;
        pu[i * 4] = smoke.x[i];
        pu[i * 4 + 1] = smoke.y[i];
        pu[i * 4 + 2] = smoke.z[i];
        pu[i * 4 + 3] = smoke.size[i];
        pl[i * 4] = (grey ? 0.4 : 0.95) * Math.min(1, k * 8) * Math.pow(1 - k, 1.1);
        pl[i * 4 + 1] = i * 2.39996 + smoke.age[i] * 0.3;
        pl[i * 4 + 2] = grey ? 0.32 : 0.045 + 0.05 * k;
        pl[i * 4 + 3] = grey ? 0 : Math.exp(-smoke.age[i] * 3);
      }
      smokeGeo.instanceCount = smoke.n;
      aPuff.needsUpdate = smoke.n > 0;
      aPuffLife.needsUpdate = smoke.n > 0;
      shared.uNight.value = night;

      char(model, front, since);
    },
    light(look) {
      const k = look.keyIntensity * 0.4;
      const a = look.ambient * 0.8;
      shared.uLit.value.setRGB(
        look.keyColour[0] * k + look.skyLight[0] * a,
        look.keyColour[1] * k + look.skyLight[1] * a,
        look.keyColour[2] * k + look.skyLight[2] * a,
      );
    },
    lamps(level, out) {
      night = Math.min(1, Math.max(0, level));
      if (!group.visible) return;
      const share = heatSum / FULL_HEAT;
      const power = burnLight(share, shared.uTime.value) + 0.15 * smoulder;
      if (power <= 0.01) return;
      out.push({
        x: middle.x,
        y: middle.y + BURN_LOOK.light.up,
        z: middle.z,
        dx: 0,
        dy: -1,
        dz: 0,
        colour: FIRE_LIGHT,
        beam: ALL_ROUND,
        power,
      });
    },
    dispose() {
      unchar();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
