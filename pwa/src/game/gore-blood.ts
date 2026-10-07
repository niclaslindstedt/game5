// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BLOOD AS DRAWN: the drops in the air and what they leave on the snow.
// Presentation only, on a run with the INJURIES switch on (`gore-view.ts`
// hands it the wounds and how hard the heart is pumping through them).
//
//   * A DROP is flown ballistically — the air barely slows a drop of
//     blood — stretched along its way, and where it meets the snow it
//     leaves a SPLAT the size its volume soaks (a drop of a few
//     millimetres soaks a blot of a couple of centimetres into snow).
//   * A POOL is a splat that grows under a wound that lies still, its
//     area the blood that has run into it — a litre wicking out over
//     more than a square metre of snow's grains — and a wound that slides on
//     smears a trail of them.
//
// Both are instanced: one draw for every drop, one for every blot.

import * as THREE from "three";

import { dropGeometry, GORE_COLOURS, splatGeometry, splatMask } from "./gore-shapes.ts";

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;

/** The snow under the blood: the height of the drawn surface and its
 * normal there. */
export type BloodGround = {
  heightAt(x: number, z: number): number;
  normalAt(x: number, z: number, out: { x: number; y: number; z: number }): unknown;
};

export type Blood = {
  group: THREE.Group;
  /** Throw `count` drops out of `at` along `dir` (a unit vector) at about
   * `speed` m/s, `spread` rad either side, the body's own way `carry`
   * added; `next` the stream they are dealt off. */
  emit(
    at: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    count: number,
    spread: number,
    carry: THREE.Vector3,
    next: () => number,
  ): void;
  /** Lay a blot `r` m across at (x, z), `shade` its darkness (1 fresh). */
  splat(x: number, z: number, r: number, shade: number, turn: number): void;
  /** The pool under wound `key` at (x, z): grown by `litres`; a wound that
   * has moved on starts a new one. */
  pool(key: string, x: number, z: number, litres: number): void;
  update(dt: number, ground: BloodGround): void;
  /** How many drops are flying. */
  flying(): number;
  clear(): void;
  dispose(): void;
};

/** The most drops in the air and blots on the snow at once. */
const DROPS = 1600;
const SPLATS = 3200;
const G = 9.81;
/** The share of a drop's speed the air takes a second. */
const AIR = 0.15;
/** A pool's area a litre, m²: blood wicks out wide through snow's grains. */
const SOAK = 1.4;
/** How far over the snow a blot lies, m — the drawn surface under it. */
const LIFT = 0.012;

export function createBlood(wrap: Wrap): Blood {
  const group = new THREE.Group();
  group.name = "blood";

  const dropMat = wrap(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHex(GORE_COLOURS.blood),
      roughness: 0.18,
      metalness: 0.05,
    }),
    "blood-drop",
  );
  const dropGeo = dropGeometry();
  const drops = new THREE.InstancedMesh(dropGeo, dropMat, DROPS);
  drops.frustumCulled = false;
  drops.count = 0;
  group.add(drops);

  const mask = splatMask();
  const splatMat = wrap(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0,
      transparent: true,
      alphaMap: mask,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    "blood-splat",
  );
  const splatGeo = splatGeometry();
  const splats = new THREE.InstancedMesh(splatGeo, splatMat, SPLATS);
  splats.frustumCulled = false;
  splats.count = 0;
  splats.renderOrder = 1;
  splats.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SPLATS * 3), 3);
  group.add(splats);

  const px = new Float32Array(DROPS);
  const py = new Float32Array(DROPS);
  const pz = new Float32Array(DROPS);
  const vx = new Float32Array(DROPS);
  const vy = new Float32Array(DROPS);
  const vz = new Float32Array(DROPS);
  const size = new Float32Array(DROPS);
  let live = 0;
  let nextSplat = 0;
  let splatCount = 0;
  const pools = new Map<string, { index: number; x: number; z: number; litres: number }>();

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const nn = { x: 0, y: 1, z: 0 };
  const yUp = new THREE.Vector3(0, 1, 0);
  const spin = new THREE.Quaternion();
  const c = new THREE.Color();
  const fresh = new THREE.Color().setHex(0x8e0a08);
  const old = new THREE.Color().setHex(GORE_COLOURS.clot);
  let ground: BloodGround | null = null;

  const lay = (index: number, x: number, z: number, r: number, shade: number, turn: number) => {
    if (!ground) return;
    ground.normalAt(x, z, nn);
    n.set(nn.x, nn.y, nn.z).normalize();
    q.setFromUnitVectors(yUp, n);
    spin.setFromAxisAngle(yUp, turn);
    q.multiply(spin);
    p.set(x, ground.heightAt(x, z) + LIFT, z);
    s.set(r, 1, r);
    m.compose(p, q, s);
    splats.setMatrixAt(index, m);
    c.copy(fresh).lerp(old, Math.max(0, Math.min(1, 1 - shade)));
    splats.setColorAt(index, c);
    splats.instanceMatrix.needsUpdate = true;
    splats.instanceColor!.needsUpdate = true;
  };

  const take = (): number => {
    const i = nextSplat;
    nextSplat = (nextSplat + 1) % SPLATS;
    splatCount = Math.min(SPLATS, splatCount + 1);
    splats.count = splatCount;
    return i;
  };

  return {
    group,
    emit(at, dir, speed, count, spread, carry, next) {
      for (let k = 0; k < count && live < DROPS; k++) {
        const i = live++;
        // A cone about `dir`: two random tilts off it.
        const a = (next() - 0.5) * 2 * spread;
        const b = (next() - 0.5) * 2 * spread;
        v.set(dir.x + a, dir.y + b, dir.z + (a - b) * 0.5).normalize();
        const u = speed * (0.55 + 0.6 * next());
        px[i] = at.x + (next() - 0.5) * 0.02;
        py[i] = at.y + (next() - 0.5) * 0.02;
        pz[i] = at.z + (next() - 0.5) * 0.02;
        vx[i] = v.x * u + carry.x;
        vy[i] = v.y * u + carry.y;
        vz[i] = v.z * u + carry.z;
        // Most drops are a couple of millimetres; a few are clots.
        size[i] = 0.0025 + 0.006 * next() ** 3;
      }
    },
    splat(x, z, r, shade, turn) {
      lay(take(), x, z, r, shade, turn);
    },
    pool(key, x, z, litres) {
      let o = pools.get(key);
      const r = o ? Math.sqrt((o.litres * SOAK) / Math.PI) : 0;
      if (!o || Math.hypot(x - o.x, z - o.z) > Math.max(0.12, r * 0.6)) {
        // A new pool where the wound now lies; the last stays as a smear.
        o = { index: take(), x, z, litres: o ? o.litres * 0.3 : 0 };
        pools.set(key, o);
      }
      o.litres += litres;
      const rr = Math.max(0.05, Math.sqrt((o.litres * SOAK) / Math.PI));
      lay(o.index, o.x, o.z, rr, 0.75, o.index * 2.39);
    },
    update(dt, g) {
      ground = g;
      if (dt <= 0) return;
      const k = Math.exp(-AIR * dt);
      let j = 0;
      for (let i = 0; i < live; i++) {
        vx[i] *= k;
        vz[i] *= k;
        vy[i] = vy[i] * k - G * dt;
        px[i] += vx[i] * dt;
        py[i] += vy[i] * dt;
        pz[i] += vz[i] * dt;
        const floor = g.heightAt(px[i], pz[i]);
        if (py[i] <= floor) {
          // Met the snow: a blot as big as the drop soaks, spread wider
          // and longer the faster it struck.
          const hit = Math.hypot(vx[i], vy[i], vz[i]);
          const r = size[i] * (3 + 0.6 * Math.min(8, hit));
          lay(take(), px[i], pz[i], r, 1, (px[i] * 37 + pz[i] * 11) % 6.28);
          continue;
        }
        if (j !== i) {
          px[j] = px[i];
          py[j] = py[i];
          pz[j] = pz[i];
          vx[j] = vx[i];
          vy[j] = vy[i];
          vz[j] = vz[i];
          size[j] = size[i];
        }
        j++;
      }
      live = j;
      for (let i = 0; i < live; i++) {
        v.set(vx[i], vy[i], vz[i]);
        const u = v.length();
        q.setFromUnitVectors(yUp, u > 1e-4 ? v.divideScalar(u) : yUp);
        s.set(size[i], size[i] * (1 + Math.min(4, u * 0.25)), size[i]);
        p.set(px[i], py[i], pz[i]);
        m.compose(p, q, s);
        drops.setMatrixAt(i, m);
      }
      drops.count = live;
      drops.instanceMatrix.needsUpdate = true;
    },
    flying: () => live,
    clear() {
      live = 0;
      drops.count = 0;
      splatCount = 0;
      nextSplat = 0;
      splats.count = 0;
      pools.clear();
    },
    dispose() {
      dropGeo.dispose();
      splatGeo.dispose();
      dropMat.dispose();
      splatMat.dispose();
      mask?.dispose();
    },
  };
}
