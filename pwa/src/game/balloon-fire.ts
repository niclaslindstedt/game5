// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ENVELOPE ON FIRE IN THE RENDERER — what a burning hot air balloon
// throws off (`balloon-fire-plan.ts` decides where it caught, how the burn
// spreads and what it throws a second): smoke curling off the cloth where
// the burner's flame licks it, then FLAMES standing on the front as it
// climbs the gores from where it caught (the envelope's shader eats the
// cloth behind the same front and glows along it), a column of thick black
// smoke carried off on the wind, embers lofted in it, burning drips of
// melted nylon and burning SHREDS of cloth torn off and fluttering down,
// the fire's orange light on everything round it, and the wreck on the
// snow burning out and smouldering. A falling balloon leaves its smoke
// standing behind it in the sky.
//
// One sorted batch of billboards for the flames and the smoke
// (`billboards.ts`, drawn with the helicopter's billow strip from
// `explosion.ts`), the sparks' pool for the embers and the drips
// (`sparks.ts`), a small pool of shreds. Fixed pools: nothing allocates
// once it is built. Presentation only: its scatter is its own seeded
// stream, never the run's.

import * as THREE from "three";
import type { BalloonState } from "@engine";

import { FIRE, SPREAD, clothNoise, fireFront, spreadKey } from "./balloon-fire-plan.ts";
import { createBillboards } from "./billboards.ts";
import { billowStrip } from "./explosion.ts";
import { fireColour } from "./fireball.ts";
import type { Flood } from "./headlamp.ts";
import { createSparks } from "./sparks.ts";

/** The pools. */
const FLAMES = 560;
const SMOKE = 700;
const SHREDS = 36;
/** Every how-many-th vertex of the envelope the flames may stand on. */
const EVERY = 5;
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
  shade: number;
};

type Shred = {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: THREE.Vector3;
  heat: number;
  phase: number;
  live: boolean;
  lying: boolean;
};

export type EnvelopeFire = {
  group: THREE.Group;
  /** One frame: the balloon, the envelope's mesh (its vertices as now
   * drawn, and its world frame), its rest shape, where the fire caught
   * (its own frame), the frame's `dt` s, the snow. */
  update(
    b: BalloonState,
    mesh: THREE.Mesh,
    rest: Float32Array,
    caught: readonly number[],
    dt: number,
    groundAt: (x: number, z: number) => number,
  ): void;
  /** Sort it for the eye, and add its light to `out`. */
  seen(eye: THREE.Vector3, out: Flood[]): void;
  /** The spread's reach, m: the farthest key of the cloth from where it
   * caught (`fireFront`). */
  reach(): number;
  /** How much of a fire is burning now, 0..1 (the light, the sound). */
  blaze(): number;
  clear(): void;
  dispose(): void;
};

/** A seeded stream of the fire's own. */
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createEnvelopeFire(): EnvelopeFire {
  const group = new THREE.Group();
  group.name = "balloon-fire";
  const random = stream(0xf1a3e);
  const strip = billowStrip();
  const batch = createBillboards(strip, 2, FLAMES + SMOKE);
  batch.mesh.renderOrder = 8;
  group.add(batch.mesh);
  const sparks = createSparks();
  group.add(sparks.group);
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
  const flames = Array.from({ length: FLAMES }, puff);
  const smoke = Array.from({ length: SMOKE }, puff);
  let nextFlame = 0;
  let nextSmoke = 0;

  // THE SHREDS: a torn, crumpled scrap of cloth — two triangles folded.
  const shredGeo = new THREE.BufferGeometry();
  shredGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.5, 0, -0.4, 0.5, 0.12, -0.5, -0.1, -0.1, 0.5, 0.5, 0.12, -0.5, 0.45, 0.05, 0.35, -0.1,
        -0.1, 0.5,
      ],
      3,
    ),
  );
  shredGeo.computeVertexNormals();
  const shredMats = [0x1a1512, 0x2b1d16, 0x3a2418].map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        side: THREE.DoubleSide,
        emissive: 0xff5a10,
        emissiveIntensity: 0,
      }),
  );
  const shreds: Shred[] = Array.from({ length: SHREDS }, (_, i) => {
    const mesh = new THREE.Mesh(shredGeo, shredMats[i % shredMats.length].clone());
    mesh.visible = false;
    group.add(mesh);
    return {
      mesh,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: new THREE.Vector3(),
      heat: 0,
      phase: 0,
      live: false,
      lying: false,
    };
  });
  let nextShred = 0;

  // The points of the cloth a flame may stand on: their vertex, their key.
  let sites: Int32Array | null = null;
  let keys: Float32Array | null = null;
  let keyedFor = "";
  let reach = 30;
  const active = new Int32Array(4096);
  let nActive = 0;
  const debt = { flame: 0, smoke: 0, ember: 0, drip: 0, shred: 0 };
  const p = new THREE.Vector3();
  const centre = new THREE.Vector3();
  let blaze = 0;
  let downFor = 0;
  let wind = { x: 0, z: 0 };
  let lit = false;
  let clock = 0;
  const light: Flood = {
    x: 0,
    y: 0,
    z: 0,
    dx: 0,
    dy: -1,
    dz: 0,
    colour: FIRE.light.colour,
    beam: [-2, -1.5, -3, 0],
    power: 0,
  };
  const rgb = [0, 0, 0];

  function keyAll(rest: Float32Array, caught: readonly number[]): void {
    const tag = caught.join(",");
    const n = rest.length / 3;
    if (!sites) {
      const count = Math.floor(n / EVERY);
      sites = new Int32Array(count);
      keys = new Float32Array(count);
      for (let i = 0; i < count; i++) sites[i] = i * EVERY;
    }
    if (tag === keyedFor) return;
    keyedFor = tag;
    let most = 1;
    for (let i = 0; i < sites.length; i++) {
      const v = sites[i] * 3;
      const x = rest[v];
      const y = rest[v + 1];
      const z = rest[v + 2];
      keys![i] = spreadKey(x, y, z, caught[0], caught[1], caught[2], clothNoise(x, y, z));
      most = Math.max(most, keys![i]);
    }
    // A margin over the sites' farthest, for the cloth between them.
    reach = most + 0.5;
  }

  /** Site `i`'s point in the world, as the mesh now has it. */
  function siteAt(mesh: THREE.Mesh, i: number, out: THREE.Vector3): THREE.Vector3 {
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    return out.fromBufferAttribute(pos, sites![i]).applyMatrix4(mesh.matrixWorld);
  }

  function flameAt(
    x: number,
    y: number,
    z: number,
    big: number,
    rise: number,
    vx: number,
    vz: number,
    life = 0.5 + random() * 0.6,
  ): void {
    const f = flames[nextFlame];
    nextFlame = (nextFlame + 1) % FLAMES;
    Object.assign(f, {
      x,
      y,
      z,
      vx: vx + (random() - 0.5) * 1.4,
      vy: rise * (0.7 + 0.6 * random()),
      vz: vz + (random() - 0.5) * 1.4,
      age: 0,
      life,
      size0: big * (0.75 + 0.5 * random()),
      size1: big * 0.5,
      rot: random() * Math.PI * 2,
    });
  }

  function smokeAt(
    x: number,
    y: number,
    z: number,
    big: number,
    rise: number,
    life: number,
    dark: number,
  ): void {
    const s = smoke[nextSmoke];
    nextSmoke = (nextSmoke + 1) % SMOKE;
    Object.assign(s, {
      x,
      y,
      z,
      vx: (random() - 0.5) * 1.5,
      vy: rise * (0.7 + 0.5 * random()),
      vz: (random() - 0.5) * 1.5,
      age: 0,
      life: life * (0.75 + 0.5 * random()),
      size0: big,
      size1: big * (2.4 + random()),
      rot: random() * Math.PI * 2,
      shade: dark + 0.1 * random() ** 2,
    });
  }

  function tear(x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
    const s = shreds[nextShred];
    nextShred = (nextShred + 1) % SHREDS;
    const a = random() * Math.PI * 2;
    Object.assign(s, {
      x,
      y,
      z,
      vx: vx + Math.sin(a) * 2,
      vy: Math.min(vy, 0) - 1,
      vz: vz + Math.cos(a) * 2,
      heat: 1,
      phase: random() * 10,
      live: true,
      lying: false,
    });
    s.spin.set(random() * 6 - 3, random() * 6 - 3, random() * 6 - 3);
    s.mesh.scale.setScalar(0.5 + random() * 1.1);
    s.mesh.visible = true;
  }

  function stepAll(dt: number, groundAt: (x: number, z: number) => number): void {
    clock += dt;
    const toWind = 1 - Math.exp(-0.5 * dt);
    for (const f of flames) {
      if (f.age >= f.life) continue;
      f.age += dt;
      const drag = Math.exp(-1.6 * dt);
      f.vx = f.vx * drag + (wind.x - f.vx) * toWind;
      f.vz = f.vz * drag + (wind.z - f.vz) * toWind;
      f.vy = f.vy * drag + 7 * dt;
      f.x += f.vx * dt;
      f.y = Math.max(groundAt(f.x, f.z) + 0.2, f.y + f.vy * dt);
      f.z += f.vz * dt;
    }
    for (const s of smoke) {
      if (s.age >= s.life) continue;
      s.age += dt;
      // Carried off on the wind, its climb dying as it cools and spreads.
      s.vx += (wind.x - s.vx) * toWind;
      s.vz += (wind.z - s.vz) * toWind;
      s.vy *= Math.exp(-0.12 * dt);
      s.x += s.vx * dt;
      s.y = Math.max(groundAt(s.x, s.z) + 0.6, s.y + s.vy * dt);
      s.z += s.vz * dt;
      s.rot += 0.12 * dt;
    }
    for (const s of shreds) {
      if (!s.live) continue;
      s.heat = Math.max(0, s.heat - dt / (3 + (s.phase % 3)));
      s.phase += dt;
      if (!s.lying) {
        // A scrap of cloth falls at a couple of metres a second, swinging
        // and tumbling, and drifts with the air.
        s.vx += (wind.x + Math.sin(s.phase * 2.3) * 1.8 - s.vx) * (1 - Math.exp(-1.2 * dt));
        s.vz += (wind.z + Math.cos(s.phase * 1.9) * 1.8 - s.vz) * (1 - Math.exp(-1.2 * dt));
        s.vy += (-2.6 - s.vy) * (1 - Math.exp(-2 * dt));
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        s.mesh.rotation.x += s.spin.x * dt;
        s.mesh.rotation.y += s.spin.y * dt;
        s.mesh.rotation.z += s.spin.z * dt;
        const g = groundAt(s.x, s.z) + 0.04;
        if (s.y <= g) {
          s.y = g;
          s.lying = true;
          s.mesh.rotation.x = (random() - 0.5) * 0.3;
          s.mesh.rotation.z = (random() - 0.5) * 0.3;
        }
        if (s.heat > 0.1) {
          if (random() < dt * 9 * s.heat)
            flameAt(s.x, s.y + 0.1, s.z, 0.5 + 0.6 * s.heat, 1.5, s.vx, s.vz, 0.3 + 0.3 * random());
          if (random() < dt * 2.5 * s.heat) smokeAt(s.x, s.y + 0.3, s.z, 0.5, 1, 4, 0.04);
        }
      }
      s.mesh.position.set(s.x, s.y, s.z);
      (s.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2.2 * s.heat * (0.7 + 0.3 * Math.sin(s.phase * 17));
    }
    sparks.update(dt, groundAt);
  }

  function clear(): void {
    for (const f of flames) f.age = f.life = 0;
    for (const s of smoke) s.age = s.life = 0;
    for (const s of shreds) {
      s.live = false;
      s.mesh.visible = false;
    }
    sparks.clear();
    keyedFor = "";
    blaze = 0;
    downFor = 0;
    lit = false;
    debt.flame = debt.smoke = debt.ember = debt.drip = debt.shred = 0;
  }

  return {
    group,
    update(b, mesh, rest, caught, dt, groundAt) {
      wind = { x: b.windX, z: b.windZ };
      if (!b.burning && b.scorch <= 0) {
        if (lit) clear();
        stepAll(dt, groundAt);
        return;
      }
      lit = true;
      if (b.burning) keyAll(rest, caught);
      mesh.updateMatrixWorld();
      const vx = b.vx;
      const vy = b.vy;
      const vz = b.vz;
      blaze = 0;
      if (!b.burning) {
        // SCORCHING: the cloth where the flame is laid into it smokes,
        // then catches in licks.
        p.set(caught[0], caught[1], caught[2]).applyMatrix4(mesh.matrixWorld);
        const smoking = Math.max(0, (b.scorch - 0.3) / 0.7);
        if (random() < dt * 9 * smoking) smokeAt(p.x, p.y, p.z, 0.6 + smoking, 2.5, 5, 0.12);
        if (b.scorch > 0.75 && b.flame > 0.3 && random() < dt * 30 * (b.scorch - 0.75)) {
          flameAt(p.x, p.y, p.z, 0.6 + 1.2 * (b.scorch - 0.75) * 4, 2.5, vx, vz, 0.35);
        }
        centre.copy(p);
        blaze = smoking * 0.15;
      } else {
        // BURNING: flames on the front, smoke off it, embers and drips and
        // shreds torn away behind it.
        const front = fireFront(b.burnt, reach);
        nActive = 0;
        centre.set(0, 0, 0);
        for (let i = 0; i < sites!.length && nActive < active.length; i++) {
          const behind = front - keys![i];
          if (behind > -0.3 && behind < SPREAD.edge * 1.6) active[nActive++] = i;
        }
        const down = b.mode === "down";
        downFor = down ? downFor + dt : 0;
        // The wreck on the snow: the cloth left burns down, then smoulders.
        const wreck = down ? Math.exp(-downFor / FIRE.wreckBurn) : 1;
        const smoulder = down ? Math.exp(-downFor / FIRE.smoulder) : 1;
        // After the front has gone over it all, the streamers still burn.
        const after = nActive === 0 ? Math.max(0, 1 - (b.burnt - 0.85) * 4) * 0.35 : 0;
        const share = Math.min(1, nActive / 60);
        const strength = Math.max(share, after, down ? 0.4 : 0) * (down ? wreck : 1);
        const pick = (): number => {
          if (nActive > 0) return active[Math.floor(random() * nActive)];
          return Math.floor(random() * sites!.length);
        };
        const pickKeep = (): number => {
          // Off the front, or — the front gone over — any cloth still there.
          for (let k = 0; k < 6; k++) {
            const i = pick();
            if (
              nActive > 0 ||
              front - keys![i] < SPREAD.edge ||
              clothNoise(rest[sites![i] * 3], rest[sites![i] * 3 + 1], rest[sites![i] * 3 + 2]) >=
                SPREAD.streamer
            )
              return i;
          }
          return pick();
        };
        const fx = down ? 0 : vx * 0.75;
        const fz = down ? 0 : vz * 0.75;
        debt.flame += dt * FIRE.flames * strength;
        let cn = 0;
        for (; debt.flame >= 1; debt.flame--) {
          siteAt(mesh, pickKeep(), p);
          flameAt(
            p.x,
            p.y,
            p.z,
            down ? 0.5 + 0.9 * random() : 1.1 + 2.2 * random(),
            down ? 1.6 : 4.5,
            fx,
            fz,
          );
          centre.add(p);
          cn++;
        }
        if (cn > 0) centre.multiplyScalar(1 / cn);
        else siteAt(mesh, pick(), centre);
        debt.smoke += dt * FIRE.smoke * Math.max(strength, down ? 0.25 * smoulder : 0);
        for (; debt.smoke >= 1; debt.smoke--) {
          siteAt(mesh, pickKeep(), p);
          const big = down && strength < 0.2 ? 1.4 : 3.2 + random() * 2.4;
          smokeAt(
            p.x,
            p.y + 1,
            p.z,
            big,
            FIRE.plume * (down ? 0.5 : 1),
            14,
            down && strength < 0.2 ? 0.1 : 0.025,
          );
        }
        debt.ember += dt * FIRE.embers * strength;
        for (; debt.ember >= 1; debt.ember--) {
          siteAt(mesh, pick(), p);
          sparks.emit(
            p.x,
            p.y,
            p.z,
            fx + (random() - 0.5) * 3,
            2 + random() * 4,
            fz + (random() - 0.5) * 3,
            2 + random() * 3,
            true,
          );
        }
        if (!down) {
          debt.drip += dt * FIRE.drips * share;
          for (; debt.drip >= 1; debt.drip--) {
            siteAt(mesh, pick(), p);
            sparks.emit(
              p.x,
              p.y,
              p.z,
              vx + (random() - 0.5),
              vy - 1 - random() * 2,
              vz + (random() - 0.5),
              1.5 + random() * 2,
            );
          }
          debt.shred += dt * FIRE.shreds * share;
          for (; debt.shred >= 1; debt.shred--) {
            siteAt(mesh, pick(), p);
            tear(p.x, p.y, p.z, vx, vy, vz);
          }
        }
        blaze = Math.min(1, strength * 1.2);
      }
      stepAll(dt, groundAt);
    },
    seen(eye, out) {
      batch.begin();
      for (const f of flames) {
        if (f.age >= f.life) continue;
        const k = f.age / f.life;
        const size = f.size0 + (f.size1 - f.size0) * k;
        fireColour(0.92 - k * 0.65, rgb);
        const a = k < 0.12 ? k / 0.12 : (1 - k) / 0.88;
        const lean = 0.25 * Math.sin(f.rot);
        batch.push(f.x, f.y, f.z, size, size * 1.9, lean, rgb[0], rgb[1], rgb[2], a, FLAME_CELL);
      }
      for (const s of smoke) {
        if (s.age >= s.life) continue;
        const k = s.age / s.life;
        const size = s.size0 + (s.size1 - s.size0) * Math.sqrt(k);
        const g = s.shade + 0.1 * k;
        const a = 0.88 * Math.min(1, k * 8) * (1 - k) ** 1.3;
        batch.push(s.x, s.y, s.z, size, size, s.rot, g, g * 0.93, g * 0.87, a, SMOKE_CELL);
      }
      batch.end(eye);
      if (blaze > 0.01) {
        light.x = centre.x;
        light.y = centre.y;
        light.z = centre.z;
        light.power =
          FIRE.light.power * blaze * (0.85 + 0.15 * Math.sin(clock * 19) * Math.sin(clock * 7));
        out.push(light);
      }
    },
    blaze: () => blaze,
    reach: () => reach,
    clear,
    dispose() {
      strip.dispose();
      batch.dispose();
      sparks.dispose();
      shredGeo.dispose();
      for (const s of shreds) (s.mesh.material as THREE.Material).dispose();
      for (const m of shredMats) m.dispose();
    },
  };
}
