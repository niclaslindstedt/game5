// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EXPLOSION — a crashed helicopter going up (`heli.ts`'s `crash`), as
// drawn: what a light turbine helicopter's fuel does when its cells burst
// on impact, which is a FIREBALL far more than a blast (`fireball.ts`: its
// size and life off the fuel it burns, its lobes, its lift-off, the black
// mushroom it rolls up into). Round it: a FLASH lighting the snow, a
// shower of SPARKS and EMBERS (`sparks.ts`), small SHARDS of the airframe
// beside the pieces it comes apart in (`heli-shatter.ts`, whose burning
// ones trail fire and smoke through `flame` and strike sparks off the
// snow through `strike`), the snow round it SCORCHED, and the wreck left
// BURNING as a pool fire of the spilled fuel — flames ten metres tall,
// puffing, under a column of black smoke — until the ride starts again.
//
// The fire and the smoke are one sorted batch of billboards
// (`billboards.ts`), a lumpy billow in each — the fire's brightest at its
// heart and dull at its rim, tinted a little over white so the tone map
// keeps it glowing (fire only added on is lost against snow) — with the
// heat's halo added on in a second. Fixed pools: nothing allocates once
// it is built. Presentation only: the engine says where and how hard,
// nothing here reads back.

import * as THREE from "three";

import { createBillboards } from "./billboards.ts";
import { BALL, createBall, fireballOf, fireColour, lightBall, stepBall } from "./fireball.ts";
import { createSparks } from "./sparks.ts";

/** THE WRECK BURNING: the pool of spilled fuel, its radius, m (a pool
 * four to six metres across), the flames' height over it, m (some 30–45
 * MW of kerosene burns 10–12 m tall by the flame-height correlation), how
 * often its flames PUFF, Hz (a pool fire's pulsing, 1.5/√D), the flames,
 * smoke puffs and embers it throws a second, and how fast its smoke
 * leaves the flames' top, m/s (the plume's own climb there). */
export const POOL = {
  radius: 2.6,
  flame: 11,
  puff: 0.65,
  flames: 40,
  smoke: 10,
  embers: 14,
  plume: 10,
} as const;

/** A BURNING PIECE's trail: the flames, smoke puffs and embers it throws a
 * second at full heat. */
export const TRAIL = { flames: 14, smoke: 3, embers: 4 } as const;

/** THE SCORCH: the snow round the wreck melted to a dark wet ring and
 * speckled with soot — its radius, m, how long it takes to darken, s, and
 * how dark it goes at its middle. */
export const SCORCH = { radius: 10, darken: 2.5, dark: 0.85 } as const;

/** The pools: loose flames, smoke puffs, shards; and the batch they and
 * the fireball's lobes are drawn in. */
const FIRE = 520;
const SMOKE = 700;
const SHARDS = 40;
const BALLS = 1 + BALL.spray.length;
const BATCH = FIRE + SMOKE + BALLS * BALL.lobes;
/** The two cells of the billow strip. */
const FLAME_CELL = 0;
const SMOKE_CELL = 1;

type Puff = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size0: number;
  size1: number;
  rot: number;
  /** Smoke's own shade. */
  shade: number;
};

type Shard = {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: THREE.Vector3;
  live: boolean;
};

export type Explosion = {
  group: THREE.Group;
  /** Go up at (x, y, z) — `speed` the closing speed it came down at, m/s,
   * and (vx, vz) the way it was going, the fuel's spray thrown along it. */
  burst(x: number, y: number, z: number, speed: number, vx?: number, vz?: number): void;
  /** Keep the wreck burning at (x, y, z) while `on`. */
  burning(on: boolean, x: number, y: number, z: number): void;
  /** A burning piece of the airframe at (x, y, z) this frame, `heat`
   * 0..1, over `dt` s: the fire and smoke it trails. */
  flame(x: number, y: number, z: number, heat: number, dt: number): void;
  /** A piece of the airframe struck the snow at (x, y, z) at `speed` m/s:
   * the sparks off it. */
  strike(x: number, y: number, z: number, speed: number): void;
  /** Step it all `dt` on, and draw it for an eye at `eye`. */
  update(
    dt: number,
    groundAt: (x: number, z: number) => number,
    eye: { x: number; y: number; z: number },
  ): void;
  clear(): void;
  dispose(): void;
};

/** A seeded stream of its own for the scatter — never the engine's. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** THE BILLOW STRIP drawn once on a canvas: two square cells side by side,
 * each a dozen soft blobs piled into a lumpy ball, so a pile of them reads
 * as rolling fire or smoke rather than a stack of discs — the fire's
 * blobs brightest at their hearts and dull at their rims (a flame cell
 * meeting the air), the smoke's even. */
export function billowStrip(): THREE.Texture {
  const n = 128;
  const canvas = document.createElement("canvas");
  canvas.width = n * 2;
  canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const cell = (x0: number, dense: number, rim: number, seed: number): void => {
    const rand = makeRandom(seed);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, n, n);
    ctx.clip();
    for (let i = 0; i < 16; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * n * 0.2;
      const cx = x0 + n / 2 + Math.cos(a) * r;
      const cy = n / 2 + Math.sin(a) * r;
      const rad = n * (0.15 + rand() * 0.17);
      const b = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const edge = Math.round(255 * (1 - rim));
      const mid = Math.round(255 * (1 - rim * 0.45));
      b.addColorStop(0, `rgba(255,255,255,${dense})`);
      b.addColorStop(0.6, `rgba(${mid},${mid},${mid},${dense * 0.6})`);
      b.addColorStop(1, `rgba(${edge},${edge},${edge},0)`);
      ctx.fillStyle = b;
      ctx.fillRect(x0, 0, n, n);
    }
    ctx.restore();
  };
  cell(0, 0.85, 0.7, 11);
  cell(n, 0.5, 0, 7);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The scorch's mark: a dark, ragged blot fading out to its rim and
 * speckled with soot beyond it. */
function scorchTexture(): THREE.Texture {
  const n = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const rand = makeRandom(0x5c0c);
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * n * 0.18;
    const cx = n / 2 + Math.cos(a) * r;
    const cy = n / 2 + Math.sin(a) * r;
    const rad = n * (0.12 + rand() * 0.2);
    const b = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    b.addColorStop(0, "rgba(20,15,12,0.55)");
    b.addColorStop(1, "rgba(20,15,12,0)");
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, n, n);
  }
  ctx.fillStyle = "rgba(15,12,10,0.6)";
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2;
    const r = n * (0.15 + 0.33 * Math.sqrt(rand()));
    ctx.fillRect(
      n / 2 + Math.cos(a) * r,
      n / 2 + Math.sin(a) * r,
      1 + rand() * 1.5,
      1 + rand() * 1.5,
    );
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A soft round glow: the heat's halo, added on. */
export function glowTexture(): THREE.Texture {
  const n = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, "rgba(255,240,200,1)");
  g.addColorStop(0.35, "rgba(255,170,70,0.5)");
  g.addColorStop(1, "rgba(255,90,10,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createExplosion(): Explosion {
  const group = new THREE.Group();
  group.name = "explosion";
  const random = makeRandom(0xb00a);
  const strip = billowStrip();
  const haloTex = glowTexture();
  const batch = createBillboards(strip, 2, BATCH);
  const halos = createBillboards(haloTex, 1, BALLS);
  batch.mesh.renderOrder = 8;
  halos.mesh.renderOrder = 9;
  group.add(batch.mesh, halos.mesh);
  const puff = (): Puff => ({
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 0,
    life: 0,
    size0: 0,
    size1: 0,
    rot: 0,
    shade: 0,
  });
  const fire: Puff[] = Array.from({ length: FIRE }, puff);
  const smoke: Puff[] = Array.from({ length: SMOKE }, puff);
  const balls = Array.from({ length: BALLS }, createBall);
  const sparks = createSparks();
  group.add(sparks.group);
  const mats: THREE.Material[] = [];
  const shardGeo = new THREE.BoxGeometry(1, 1, 1);
  // Shards of the airframe: burnt, its paint, its belly's white, metal.
  const shardMats = [0x1b1918, 0x2a2624, 0x7a1612, 0x8d8a86, 0x3a3f44].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  mats.push(...shardMats);
  const shards: Shard[] = Array.from({ length: SHARDS }, (_, i) => {
    const mesh = new THREE.Mesh(shardGeo, shardMats[i % shardMats.length]);
    mesh.visible = false;
    group.add(mesh);
    return { mesh, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: new THREE.Vector3(), live: false };
  });
  // The scorch, draped over the snow where it went up.
  const scorchTex = scorchTexture();
  const scorchN = 12;
  const scorchGeo = new THREE.PlaneGeometry(SCORCH.radius * 2, SCORCH.radius * 2, scorchN, scorchN);
  scorchGeo.rotateX(-Math.PI / 2);
  const scorchMat = new THREE.MeshBasicMaterial({
    map: scorchTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    fog: false,
  });
  mats.push(scorchMat);
  const scorch = new THREE.Mesh(scorchGeo, scorchMat);
  scorch.visible = false;
  scorch.renderOrder = 1;
  group.add(scorch);
  let scorchAt: { x: number; y: number; z: number } | null = null;
  let scorchAge = 0;
  const flash = new THREE.PointLight(0xffa050, 0, 260, 1.5);
  group.add(flash);
  let flashAge = 99;
  let nextFire = 0;
  let nextSmoke = 0;
  let burn: { x: number; y: number; z: number } | null = null;
  const debt = { flame: 0, smoke: 0, ember: 0 };
  let clock = 0;
  const rgb = [0, 0, 0];
  const full = fireballOf(BALL.fuel * BALL.share);

  function spawn(list: Puff[], at: number, p: Partial<Puff>): number {
    Object.assign(list[at], { age: 0, rot: random() * Math.PI * 2 }, p);
    return (at + 1) % list.length;
  }

  /** A loose flame at (x, y, z), `big` m across, licking up at `rise`
   * for `life` s. */
  function flameAt(
    x: number,
    y: number,
    z: number,
    big: number,
    rise: number,
    life = 0.45 + random() * 0.5,
  ): void {
    nextFire = spawn(fire, nextFire, {
      x,
      y,
      z,
      vx: (random() - 0.5) * 1.2,
      vy: rise * (0.7 + 0.6 * random()),
      vz: (random() - 0.5) * 1.2,
      life,
      size0: big * (0.8 + 0.4 * random()),
      size1: big * 0.55,
    });
  }

  /** A puff of black smoke at (x, y, z), `big` m across, rising `rise`. */
  function smokeAt(
    x: number,
    y: number,
    z: number,
    big: number,
    rise: number,
    vx = 0,
    vz = 0,
    life = 9,
  ): void {
    nextSmoke = spawn(smoke, nextSmoke, {
      x,
      y,
      z,
      vx: vx + (random() - 0.5) * 2,
      vy: rise * (0.75 + 0.5 * random()),
      vz: vz + (random() - 0.5) * 2,
      life: life * (0.7 + 0.6 * random()),
      size0: big,
      size1: big * (2.6 + random()),
      // Black-brown, a few of them catching the light grey at the edges.
      shade: 0.03 + 0.11 * random() ** 2,
    });
  }

  /** A shower of `n` sparks from (x, y, z), the fastest `top` m/s. */
  function shower(x: number, y: number, z: number, n: number, top: number, vx = 0, vz = 0): void {
    for (let i = 0; i < n; i++) {
      const a = random() * Math.PI * 2;
      const up = random() ** 0.7;
      const sp = top * (0.25 + 0.75 * random());
      const flat = Math.sqrt(1 - up * up * 0.8);
      sparks.emit(
        x,
        y,
        z,
        Math.sin(a) * sp * flat + vx,
        up * sp * 0.9 + 3,
        Math.cos(a) * sp * flat + vz,
        0.4 + random() * 1.2,
      );
    }
  }

  function draw(eye: { x: number; y: number; z: number }): void {
    batch.begin();
    halos.begin();
    for (const b of balls) {
      if (!b.live || b.age < 0) continue;
      for (const l of b.lobes) {
        if (!l.done)
          batch.push(l.x, l.y, l.z, l.w, l.w, l.rot, l.rgb[0], l.rgb[1], l.rgb[2], l.a, FLAME_CELL);
      }
      const h = b.halo;
      halos.push(h.x, h.y, h.z, h.size, h.size, 0, 1.1, 0.5, 0.16, h.a, 0);
    }
    for (const p of fire) {
      if (p.age >= p.life) continue;
      const k = p.age / p.life;
      const size = p.size0 + (p.size1 - p.size0) * k;
      fireColour(0.82 - k * 0.6, rgb);
      const a = k < 0.15 ? k / 0.15 : (1 - k) / 0.85;
      // Tongues: taller than they are wide, never turned far off upright.
      const lean = 0.25 * Math.sin(p.rot);
      batch.push(p.x, p.y, p.z, size, size * 1.8, lean, rgb[0], rgb[1], rgb[2], a, FLAME_CELL);
    }
    for (const p of smoke) {
      if (p.age >= p.life) continue;
      const k = p.age / p.life;
      const size = p.size0 + (p.size1 - p.size0) * Math.sqrt(k);
      // Thick black-brown going a little greyer as it thins.
      const g = p.shade + 0.08 * k;
      const a = 0.9 * Math.min(1, k * 10) * (1 - k) ** 1.2;
      batch.push(p.x, p.y, p.z, size, size, p.rot, g, g * 0.93, g * 0.86, a, SMOKE_CELL);
    }
    batch.end(eye);
    halos.end(eye);
  }

  return {
    group,
    burst(x, y, z, speed, vx = 0, vz = 0) {
      const flat = Math.hypot(vx, vz);
      const fx = flat > 1 ? vx / flat : 0;
      const fz = flat > 1 ? vz / flat : 0;
      // THE FIREBALL, and the smaller ones the fuel's spray lights along
      // the way it was going.
      const R = full.diameter / 2;
      lightBall(balls[0], x, y, z, R, 0, fx, fz, random);
      const reach = Math.min(1, flat / 30) * R;
      BALL.spray.forEach((s, i) => {
        const a = flat > 1 ? (random() - 0.5) * 0.9 : random() * Math.PI * 2;
        const dx = flat > 1 ? fx * Math.cos(a) - fz * Math.sin(a) : Math.sin(a);
        const dz = flat > 1 ? fz * Math.cos(a) + fx * Math.sin(a) : Math.cos(a);
        const out = flat > 1 ? s.along * reach : R * 0.5;
        lightBall(balls[i + 1], x + dx * out, y, z + dz * out, R * s.size, s.delay, fx, fz, random);
      });
      // THE SPARKS: burning fuel and metal flung out of it, white-hot; and
      // the embers lofted in it.
      shower(x, y + 1.2, z, 520, 50, vx * 0.4, vz * 0.4);
      for (let i = 0; i < 160; i++) {
        const a = random() * Math.PI * 2;
        const sp = 2 + random() * 8;
        sparks.emit(
          x + (random() - 0.5) * R,
          y + 1 + random() * R * 0.6,
          z + (random() - 0.5) * R,
          Math.sin(a) * sp,
          3 + random() * 8,
          Math.cos(a) * sp,
          2 + random() * 4,
          true,
        );
      }
      // THE SHARDS, flung out of it.
      const big = 1 + Math.min(1, speed / 40);
      for (const p of shards) {
        const a = random() * Math.PI * 2;
        const sp = (8 + random() * 22) * big;
        Object.assign(p, {
          x,
          y: y + 1.5,
          z,
          vx: Math.sin(a) * sp + vx * 0.5,
          vy: 5 + random() * 16,
          vz: Math.cos(a) * sp + vz * 0.5,
          live: true,
        });
        p.spin.set(random() * 20 - 10, random() * 20 - 10, random() * 20 - 10);
        // Bits of skin and spar: thin and long, never cubes.
        const s = 0.12 + random() * 0.4;
        p.mesh.scale.set(s, s * (0.05 + random() * 0.15), s * (0.6 + random() * 1.6));
        p.mesh.visible = true;
      }
      flash.position.set(x, y + 4, z);
      flashAge = 0;
      scorchAt = { x, y, z };
      scorchAge = 0;
    },
    burning(on, x, y, z) {
      burn = on ? { x, y, z } : null;
    },
    flame(x, y, z, heat, dt) {
      debt.flame += dt * TRAIL.flames * heat;
      for (; debt.flame >= 1; debt.flame--) flameAt(x, y + 0.2, z, 1.2 + 1.6 * heat, 2.5);
      debt.smoke += dt * TRAIL.smoke * heat;
      for (; debt.smoke >= 1; debt.smoke--) smokeAt(x, y + 0.8, z, 1 + heat, 3, 0, 0, 5);
      debt.ember += dt * TRAIL.embers * heat;
      for (; debt.ember >= 1; debt.ember--) {
        const vx = (random() - 0.5) * 2;
        const vz = (random() - 0.5) * 2;
        sparks.emit(x, y + 0.5, z, vx, 2 + random() * 3, vz, 1.5 + random() * 2, true);
      }
    },
    strike(x, y, z, speed) {
      shower(x, y + 0.1, z, Math.min(70, 8 + speed * 2.5), speed * 0.7);
    },
    update(dt, groundAt, eye) {
      if (dt <= 0) {
        draw(eye);
        return;
      }
      clock += dt;
      // The flash: a white-hot instant, an orange glow fading with the
      // ball.
      flashAge += dt;
      flash.intensity =
        flashAge < 4 ? 3000 * Math.exp(-flashAge * 7) + 1800 * Math.exp(-flashAge * 1.1) : 0;
      for (const b of balls) stepBall(b, dt, clock, smokeAt, random);
      if (scorchAt) {
        if (scorchAge === 0) {
          // Laid over the snow under it, vertex by vertex.
          const pos = scorchGeo.getAttribute("position") as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            const px = scorchAt.x + pos.getX(i);
            const pz = scorchAt.z + pos.getZ(i);
            pos.setY(i, groundAt(px, pz) - scorchAt.y + 0.2);
          }
          pos.needsUpdate = true;
          scorchGeo.computeBoundingSphere();
          scorch.position.set(scorchAt.x, scorchAt.y, scorchAt.z);
          scorch.visible = true;
        }
        scorchAge += dt;
        scorchMat.opacity = SCORCH.dark * Math.min(1, scorchAge / SCORCH.darken);
      }
      if (burn) {
        // THE POOL FIRE: flames licking up off the spilled fuel ten metres
        // and more, PUFFING as a pool fire does, smoke rolling up black
        // over them, embers in the plume.
        const R = POOL.radius;
        const pulse = 0.5 + 0.5 * Math.sin(clock * POOL.puff * Math.PI * 2);
        const flick = (0.7 + 0.3 * pulse) * (0.9 + 0.1 * Math.sin(clock * 23));
        flash.position.set(burn.x, burn.y + 4, burn.z);
        flash.intensity = Math.max(flash.intensity, 380 * flick);
        const rise = POOL.flame * (0.85 + 0.45 * pulse);
        for (let n = POOL.flames * (0.6 + 0.6 * pulse) * dt + random(); n >= 1; n--) {
          const a = random() * Math.PI * 2;
          const d = Math.sqrt(random()) * R;
          flameAt(
            burn.x + Math.sin(a) * d,
            burn.y + 0.4,
            burn.z + Math.cos(a) * d,
            (3 + 3 * random() * (1 - d / R)) * (0.85 + 0.3 * pulse),
            rise * (1 - 0.5 * (d / R)),
            0.7 + 0.6 * random(),
          );
        }
        for (let n = POOL.smoke * dt + random(); n >= 1; n--) {
          smokeAt(
            burn.x + (random() - 0.5) * R,
            burn.y + POOL.flame * (0.6 + 0.4 * random()),
            burn.z + (random() - 0.5) * R,
            3.5,
            POOL.plume,
            0,
            0,
            12,
          );
        }
        for (let n = POOL.embers * dt + random(); n >= 1; n--) {
          sparks.emit(
            burn.x + (random() - 0.5) * R,
            burn.y + 1 + random() * 3,
            burn.z + (random() - 0.5) * R,
            (random() - 0.5) * 3,
            4 + random() * 4,
            (random() - 0.5) * 3,
            2 + random() * 3,
            true,
          );
        }
      }
      for (const p of fire) {
        if (p.age >= p.life) continue;
        p.age += dt;
        // A flame licks up and thins as it goes.
        const drag = Math.exp(-1.5 * dt);
        p.vx *= drag;
        p.vz *= drag;
        p.vy = p.vy * drag + 6 * dt;
        p.x += p.vx * dt;
        p.y = Math.max(groundAt(p.x, p.z) + 0.3, p.y + p.vy * dt);
        p.z += p.vz * dt;
      }
      for (const p of smoke) {
        if (p.age >= p.life) continue;
        p.age += dt;
        // Carried up and spread: the climb dies away slowly as the smoke
        // cools and spreads out under it — the mushroom's cap, a column
        // eighty metres and more after ten seconds.
        const drag = Math.exp(-0.32 * dt);
        p.vx *= drag;
        p.vz *= drag;
        p.vy *= Math.exp(-0.09 * dt);
        p.x += p.vx * dt;
        p.y = Math.max(groundAt(p.x, p.z) + 0.6, p.y + p.vy * dt);
        p.z += p.vz * dt;
        p.rot += 0.15 * dt;
      }
      for (const p of shards) {
        if (!p.live) continue;
        p.vy -= 9.81 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const g = groundAt(p.x, p.z);
        if (p.y < g + 0.05) {
          // Into the snow: a bounce that the snow mostly swallows.
          p.y = g + 0.05;
          p.vy = Math.abs(p.vy) * 0.25;
          p.vx *= 0.45;
          p.vz *= 0.45;
          p.spin.multiplyScalar(0.5);
          if (Math.abs(p.vy) < 0.6 && Math.hypot(p.vx, p.vz) < 0.5) p.live = false;
        }
        p.mesh.position.set(p.x, p.y, p.z);
        p.mesh.rotation.x += p.spin.x * dt;
        p.mesh.rotation.y += p.spin.y * dt;
        p.mesh.rotation.z += p.spin.z * dt;
      }
      sparks.update(dt, groundAt);
      draw(eye);
    },
    clear() {
      for (const p of [...fire, ...smoke]) p.age = p.life = 0;
      for (const b of balls) b.live = false;
      for (const p of shards) {
        p.live = false;
        p.mesh.visible = false;
      }
      sparks.clear();
      batch.begin();
      batch.end({ x: 0, y: 0, z: 0 });
      halos.begin();
      halos.end({ x: 0, y: 0, z: 0 });
      scorch.visible = false;
      scorchAt = null;
      flash.intensity = 0;
      flashAge = 99;
      burn = null;
    },
    dispose() {
      strip.dispose();
      haloTex.dispose();
      scorchTex.dispose();
      scorchGeo.dispose();
      shardGeo.dispose();
      batch.dispose();
      halos.dispose();
      sparks.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
