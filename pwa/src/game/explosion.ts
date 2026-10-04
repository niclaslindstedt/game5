// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EXPLOSION — a crashed helicopter going up (`heli.ts`'s `crash`), as
// drawn: what a light helicopter's fuel does when its tanks burst, which is
// a FIREBALL more than a blast — a ball of burning vapour that swells over
// a fraction of a second, rises as it burns out, and rolls into a column of
// black smoke — with a white FLASH at its heart lighting the snow round it,
// the airframe's DEBRIS flung out ballistically and bouncing on the snow,
// a ring of SNOW thrown up by the shock (the snow cloud's own puffs), and
// the wreck left BURNING until the ride starts again.
//
// Sprites over a canvas-drawn soft disc, additive for the fire and blended
// for the smoke, from a fixed pool: nothing allocates once it is built.
// Presentation only — the engine says where and how hard, nothing here
// reads back.

import * as THREE from "three";

/** The pools: fire puffs, smoke puffs, debris pieces. */
const FIRE = 46;
const SMOKE = 60;
const DEBRIS = 22;

/** How a puff of each kind lives: life, s; size at birth and at death, m. */
const FIRE_LIFE = 1.6;
const SMOKE_LIFE = 9;

/** One sprite's flight. */
type Puff = {
  sprite: THREE.Sprite;
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
};

type Piece = {
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
  /** Go up at (x, y, z) — `speed` the closing speed it came down at, m/s. */
  burst(x: number, y: number, z: number, speed: number): void;
  /** Keep the wreck burning at (x, y, z) while `on`. */
  burning(on: boolean, x: number, y: number, z: number): void;
  update(dt: number, groundAt: (x: number, z: number) => number): void;
  clear(): void;
  dispose(): void;
};

/** A soft round sprite drawn once on a canvas: a hot core for the fire, a
 * lumpy grey for the smoke. */
function discTexture(kind: "fire" | "smoke"): THREE.Texture {
  const n = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  if (kind === "fire") {
    g.addColorStop(0, "rgba(255,250,220,1)");
    g.addColorStop(0.25, "rgba(255,200,90,0.95)");
    g.addColorStop(0.6, "rgba(230,90,20,0.55)");
    g.addColorStop(1, "rgba(120,20,0,0)");
  } else {
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.55, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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

export function createExplosion(): Explosion {
  const group = new THREE.Group();
  group.name = "explosion";
  const random = makeRandom(0xb00a);
  const fireTex = discTexture("fire");
  const smokeTex = discTexture("smoke");
  const mats: THREE.Material[] = [];
  const pool = (n: number, kind: "fire" | "smoke"): Puff[] =>
    Array.from({ length: n }, () => {
      const material = new THREE.SpriteMaterial({
        map: kind === "fire" ? fireTex : smokeTex,
        color: kind === "fire" ? 0xffffff : 0x2a2724,
        transparent: true,
        depthWrite: false,
        blending: kind === "fire" ? THREE.AdditiveBlending : THREE.NormalBlending,
        fog: false,
      });
      mats.push(material);
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = kind === "fire" ? 8 : 7;
      group.add(sprite);
      return { sprite, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 0, size0: 0, size1: 0 };
    });
  const fire = pool(FIRE, "fire");
  const smoke = pool(SMOKE, "smoke");
  const debrisGeo = new THREE.BoxGeometry(1, 1, 1);
  const debrisMat = new THREE.MeshStandardMaterial({ color: 0x1b1918, roughness: 0.9 });
  mats.push(debrisMat);
  const pieces: Piece[] = Array.from({ length: DEBRIS }, () => {
    const mesh = new THREE.Mesh(debrisGeo, debrisMat);
    mesh.visible = false;
    group.add(mesh);
    return { mesh, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: new THREE.Vector3(), live: false };
  });
  const flash = new THREE.PointLight(0xffb060, 0, 160, 1.6);
  group.add(flash);
  let flashAge = 99;
  let nextFire = 0;
  let nextSmoke = 0;
  let burn: { x: number; y: number; z: number } | null = null;
  let burnDebt = 0;

  function puff(list: Puff[], at: number, p: Partial<Puff>): number {
    const q = list[at];
    Object.assign(q, { age: 0 }, p);
    q.sprite.visible = true;
    return (at + 1) % list.length;
  }

  function flameAt(x: number, y: number, z: number, big: number): void {
    nextFire = puff(fire, nextFire, {
      x: x + (random() - 0.5) * 2 * big,
      y: y + random() * big,
      z: z + (random() - 0.5) * 2 * big,
      vx: (random() - 0.5) * 1.5,
      vy: 2 + random() * 3,
      vz: (random() - 0.5) * 1.5,
      life: 0.6 + random() * 0.6,
      size0: 1.2 * big,
      size1: 2.4 * big,
    });
  }

  function smokeAt(x: number, y: number, z: number, big: number, rise: number): void {
    const shade = 0.16 + 0.22 * random();
    (smoke[nextSmoke].sprite.material as THREE.SpriteMaterial).color.setRGB(
      shade,
      shade * 0.95,
      shade * 0.9,
    );
    nextSmoke = puff(smoke, nextSmoke, {
      x: x + (random() - 0.5) * 7 * big,
      y: y + random() * 4 * big,
      z: z + (random() - 0.5) * 7 * big,
      vx: (random() - 0.5) * 5,
      vy: rise * (0.4 + 1.0 * random()),
      vz: (random() - 0.5) * 5,
      life: SMOKE_LIFE * (0.6 + 0.6 * random()),
      size0: 3 * big,
      size1: 14 * big,
    });
  }

  return {
    group,
    burst(x, y, z, speed) {
      const big = 1 + Math.min(1, speed / 40) * 0.5;
      // THE FIREBALL: swelling out from the tanks, rising as it burns.
      for (let i = 0; i < FIRE; i++) {
        const a = random() * Math.PI * 2;
        const up = random();
        const sp = (4 + random() * 9) * big;
        nextFire = puff(fire, nextFire, {
          x,
          y: y + 1.2,
          z,
          vx: Math.sin(a) * sp * (1 - up * 0.5),
          vy: 3 + up * 10 * big,
          vz: Math.cos(a) * sp * (1 - up * 0.5),
          life: FIRE_LIFE * (0.5 + random() * 0.7),
          size0: 2.5 * big,
          size1: (5 + random() * 5) * big,
        });
      }
      // ...rolling into black smoke.
      for (let i = 0; i < SMOKE / 2; i++) smokeAt(x, y + 2, z, big, 5);
      // THE DEBRIS, flung out of it.
      for (const p of pieces) {
        const a = random() * Math.PI * 2;
        const sp = 6 + random() * 18;
        Object.assign(p, {
          x,
          y: y + 1.5,
          z,
          vx: Math.sin(a) * sp,
          vy: 6 + random() * 14,
          vz: Math.cos(a) * sp,
          live: true,
        });
        p.spin.set(random() * 12 - 6, random() * 12 - 6, random() * 12 - 6);
        const s = 0.2 + random() * 0.9;
        p.mesh.scale.set(s, s * (0.2 + random() * 0.5), s * (0.5 + random()));
        p.mesh.visible = true;
      }
      flash.position.set(x, y + 3, z);
      flashAge = 0;
    },
    burning(on, x, y, z) {
      burn = on ? { x, y, z } : null;
    },
    update(dt, groundAt) {
      if (dt <= 0) return;
      // The flash: a white-hot instant, an orange glow fading over a second.
      flashAge += dt;
      flash.intensity = flashAge < 1.4 ? 9000 * Math.exp(-flashAge * 3.2) : 0;
      if (burn) {
        // The wreck burning: flames licking up off it, smoke rising.
        flash.position.set(burn.x, burn.y + 2, burn.z);
        flash.intensity = Math.max(flash.intensity, 600 + 300 * Math.sin(flashAge * 23) * random());
        burnDebt += dt * 26;
        while (burnDebt >= 1) {
          burnDebt -= 1;
          if (random() < 0.7) flameAt(burn.x, burn.y + 0.6, burn.z, 0.9);
          else smokeAt(burn.x, burn.y + 2.5, burn.z, 0.5, 4);
        }
      }
      for (const list of [fire, smoke]) {
        const isFire = list === fire;
        for (const p of list) {
          if (!p.sprite.visible) continue;
          p.age += dt;
          if (p.age >= p.life) {
            p.sprite.visible = false;
            continue;
          }
          const k = p.age / p.life;
          // The fireball slowed by the air, the smoke carried up and spread.
          const drag = Math.exp(-(isFire ? 2.5 : 0.35) * dt);
          p.vx *= drag;
          p.vz *= drag;
          p.vy = p.vy * drag + (isFire ? 4 : 1.2) * dt;
          p.x += p.vx * dt;
          p.y = Math.max(groundAt(p.x, p.z) + 0.5, p.y + p.vy * dt);
          p.z += p.vz * dt;
          const size = p.size0 + (p.size1 - p.size0) * Math.sqrt(k);
          p.sprite.position.set(p.x, p.y, p.z);
          p.sprite.scale.set(size, size, 1);
          const m = p.sprite.material as THREE.SpriteMaterial;
          if (isFire) {
            m.opacity = (1 - k) * (1 - k);
            // From white heat through orange to a dull red as it burns out.
            m.color.setRGB(1, 0.75 + 0.25 * (1 - k), 0.55 * (1 - k) + 0.2);
          } else {
            m.opacity = 0.42 * Math.min(1, k * 6) * (1 - k);
          }
        }
      }
      for (const p of pieces) {
        if (!p.live) continue;
        p.vy -= 9.81 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const g = groundAt(p.x, p.z);
        if (p.y < g + 0.1) {
          // Into the snow: a bounce that the snow mostly swallows.
          p.y = g + 0.1;
          p.vy = Math.abs(p.vy) * 0.25;
          p.vx *= 0.5;
          p.vz *= 0.5;
          p.spin.multiplyScalar(0.5);
          if (Math.abs(p.vy) < 0.6 && Math.hypot(p.vx, p.vz) < 0.5) p.live = false;
        }
        p.mesh.position.set(p.x, p.y, p.z);
        p.mesh.rotation.x += p.spin.x * dt;
        p.mesh.rotation.y += p.spin.y * dt;
        p.mesh.rotation.z += p.spin.z * dt;
      }
    },
    clear() {
      for (const p of [...fire, ...smoke]) p.sprite.visible = false;
      for (const p of pieces) {
        p.live = false;
        p.mesh.visible = false;
      }
      flash.intensity = 0;
      burn = null;
    },
    dispose() {
      fireTex.dispose();
      smokeTex.dispose();
      debrisGeo.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
