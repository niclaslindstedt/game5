// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BLOOD AS DRAWN: the streams running out of him and what they leave
// on the snow. Presentation only, on a run with the INJURIES switch on
// (`gore-view.ts` hands it where the blood leaves him and how much).
//
//   * A STREAM is blood POURING out of a gap in his clothes or a torn
//     wound, not thrown: one unbroken tube down the path a drop let go
//     there falls along (the arc off its way out under gravity, to the
//     snow), thicker the more flows and thinning as it speeds up, laid
//     again every frame from where the wound is now — and where it meets
//     the snow it spatters. A gout (a piece torn off) is a short burst of
//     drops that falls within a metre or so.
//   * A DROP meets the snow and leaves a SPLAT the size its volume soaks.
//   * A POOL is a blot that grows under a gap that lies still, its area
//     the litres run into it times how far a litre spreads on that snow
//     (`gore-view.ts`: wide on the packed groomer and on thin snow, where
//     it cannot sink in; small in deep loose snow, which drinks it) — and
//     one that slides on smears a trail of them.
//
// Both are instanced: one draw for every drop, one for every blot.

import * as THREE from "three";

import { dropGeometry, GORE_COLOURS, poolMask, splatGeometry, splatMask } from "./gore-shapes.ts";

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
  /** Pour a STREAM out of `at` along `dir` for `dt` s: `q` L/s at about
   * `speed` m/s, the body's own way `carry` added; `lead` the points it
   * runs over his skin to get to `at` (blood down a bare face). */
  stream(
    at: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    q: number,
    dt: number,
    carry: THREE.Vector3,
    next: () => number,
    lead?: readonly THREE.Vector3[],
  ): void;
  /** Lay a blot `r` m across at (x, z), `shade` its darkness (1 fresh). */
  splat(x: number, z: number, r: number, shade: number, turn: number): void;
  /** The pool under `key` at (x, z): grown by `litres`, a litre spread
   * over `soak` m² of this snow; one that has moved on starts a new one. */
  pool(key: string, x: number, z: number, litres: number, soak: number): void;
  update(dt: number, ground: BloodGround): void;
  /** How many drops are flying. */
  flying(): number;
  clear(): void;
  dispose(): void;
};

/** The most drops in the air and blots on the snow at once. */
const DROPS = 1600;
const SPLATS = 3200;
/** The most pools at once — on a mesh of their own, so the drops' blots
 * never take a pool's place. */
const POOLS = 160;
const G = 9.81;
/** The share of a drop's speed the air takes a second. */
const AIR = 0.15;
/** The most streams at once, the rings down each and the sides of a ring. */
const STREAMS = 48;
const RINGS = 14;
const SIDES = 5;
/** The blots a second a stream spatters where it meets the snow. */
const SPATTER = 6;
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
  // THE STREAMS: one mesh of tubes, rebuilt every frame from the streams
  // asked for since the last.
  const tubeGeo = new THREE.BufferGeometry();
  const tubePos = new Float32Array(STREAMS * RINGS * SIDES * 3);
  const tubeNor = new Float32Array(STREAMS * RINGS * SIDES * 3);
  tubeGeo.setAttribute("position", new THREE.BufferAttribute(tubePos, 3));
  tubeGeo.setAttribute("normal", new THREE.BufferAttribute(tubeNor, 3));
  const tubeIdx: number[] = [];
  for (let k = 0; k < STREAMS; k++)
    for (let i = 0; i < RINGS - 1; i++)
      for (let j = 0; j < SIDES; j++) {
        const a = (k * RINGS + i) * SIDES + j;
        const b = (k * RINGS + i) * SIDES + ((j + 1) % SIDES);
        tubeIdx.push(a, a + SIDES, b, b, a + SIDES, b + SIDES);
      }
  tubeGeo.setIndex(tubeIdx);
  tubeGeo.setDrawRange(0, 0);
  // Fresh blood pouring, lit by the sky: brighter than a dark drop.
  const tubeMat = wrap(
    new THREE.MeshStandardMaterial({ color: 0xa80e0a, roughness: 0.22, metalness: 0.02 }),
    "blood-stream",
  );
  const tubes = new THREE.Mesh(tubeGeo, tubeMat);
  tubes.frustumCulled = false;
  group.add(tubes);
  const asked: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    r: number;
    lead?: readonly THREE.Vector3[];
  }[] = [];
  drops.frustumCulled = false;
  drops.count = 0;
  group.add(drops);

  const mask = splatMask();
  const splatMat = wrap(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
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
  const wide = poolMask();
  const poolMat = wrap(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0,
      transparent: true,
      alphaMap: wide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    "blood-pool",
  );
  const pooled = new THREE.InstancedMesh(splatGeo, poolMat, POOLS);
  pooled.frustumCulled = false;
  pooled.count = 0;
  // Under the drops' blots.
  pooled.renderOrder = 1;
  splats.renderOrder = 2;
  pooled.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(POOLS * 3), 3);
  group.add(pooled);

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
  let nextPool = 0;
  let poolCount = 0;
  const pools = new Map<
    string,
    { index: number; x: number; z: number; litres: number; soak: number }
  >();

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

  const lay = (
    mesh: THREE.InstancedMesh,
    index: number,
    x: number,
    z: number,
    r: number,
    shade: number,
    turn: number,
    lift = LIFT,
  ) => {
    if (!ground) return;
    ground.normalAt(x, z, nn);
    n.set(nn.x, nn.y, nn.z).normalize();
    q.setFromUnitVectors(yUp, n);
    spin.setFromAxisAngle(yUp, turn);
    q.multiply(spin);
    p.set(x, ground.heightAt(x, z) + lift, z);
    s.set(r, 1, r);
    m.compose(p, q, s);
    mesh.setMatrixAt(index, m);
    c.copy(fresh).lerp(old, Math.max(0, Math.min(1, 1 - shade)));
    mesh.setColorAt(index, c);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
  };

  /** How long a drop let go as stream `o` takes to meet the snow, s. */
  const fallTime = (o: (typeof asked)[number]): number => {
    if (!ground) return 0.5;
    let t = 0;
    for (; t < 1.6; t += 0.02) {
      const y = o.y + o.vy * t - 0.5 * G * t * t;
      if (y <= ground.heightAt(o.x + o.vx * t, o.z + o.vz * t)) break;
    }
    return t;
  };

  /** Lay the tubes of every stream asked for this frame. */
  const layTubes = () => {
    const T = new THREE.Vector3();
    const N = new THREE.Vector3();
    const B = new THREE.Vector3();
    let k = 0;
    for (const o of asked) {
      const end = Math.max(0.02, fallTime(o));
      const u0 = Math.max(0.3, Math.hypot(o.vx, o.vy, o.vz));
      // The first rings over the skin it runs on, the rest its fall.
      const lead = o.lead ?? [];
      const fall = RINGS - lead.length;
      for (let i = 0; i < RINGS; i++) {
        let cx: number;
        let cy: number;
        let cz: number;
        let u: number;
        if (i < lead.length) {
          const p = lead[i];
          const q = i + 1 < lead.length ? lead[i + 1] : o;
          cx = p.x;
          cy = p.y;
          cz = p.z;
          T.set(q.x - p.x, q.y - p.y, q.z - p.z);
          T.divideScalar(Math.max(1e-6, T.length()));
          u = u0;
        } else {
          const t = (end * (i - lead.length)) / (fall - 1);
          cx = o.x + o.vx * t;
          cy = o.y + o.vy * t - 0.5 * G * t * t;
          cz = o.z + o.vz * t;
          T.set(o.vx, o.vy - G * t, o.vz);
          u = Math.max(1e-3, T.length());
          T.divideScalar(u);
        }
        N.set(Math.abs(T.y) < 0.9 ? 0 : 1, Math.abs(T.y) < 0.9 ? 1 : 0, 0)
          .cross(T)
          .normalize();
        B.crossVectors(T, N);
        // Thinning as it speeds up: the same flow through a faster stream.
        const r = o.r * Math.max(0.7, Math.sqrt(u0 / Math.max(u0, u)));
        for (let j = 0; j < SIDES; j++) {
          const a = (j / SIDES) * Math.PI * 2;
          const c = Math.cos(a);
          const sn = Math.sin(a);
          const at = ((k * RINGS + i) * SIDES + j) * 3;
          tubeNor[at] = N.x * c + B.x * sn;
          tubeNor[at + 1] = N.y * c + B.y * sn;
          tubeNor[at + 2] = N.z * c + B.z * sn;
          tubePos[at] = cx + tubeNor[at] * r;
          tubePos[at + 1] = cy + tubeNor[at + 1] * r;
          tubePos[at + 2] = cz + tubeNor[at + 2] * r;
        }
      }
      k++;
    }
    tubeGeo.setDrawRange(0, k * (RINGS - 1) * SIDES * 6);
    tubeGeo.attributes.position.needsUpdate = true;
    tubeGeo.attributes.normal.needsUpdate = true;
    asked.length = 0;
  };

  const take = (): number => {
    const i = nextSplat;
    nextSplat = (nextSplat + 1) % SPLATS;
    splatCount = Math.min(SPLATS, splatCount + 1);
    splats.count = splatCount;
    return i;
  };
  const takePool = (): number => {
    const i = nextPool;
    nextPool = (nextPool + 1) % POOLS;
    poolCount = Math.min(POOLS, poolCount + 1);
    pooled.count = poolCount;
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
        size[i] = 0.004 + 0.009 * next() ** 3;
      }
    },
    stream(at, dir, speed, q, dt, carry, next, lead) {
      if (q <= 0 || asked.length >= STREAMS) return;
      // As thick as what flows, from a thread to a pour a couple of
      // centimetres across — drawn a little fuller than life, so a thread
      // seen from a few metres is not finer than a pixel.
      const r = Math.min(0.02, 0.005 + 0.04 * Math.sqrt(q));
      asked.push({
        x: at.x,
        y: at.y,
        z: at.z,
        vx: dir.x * speed + carry.x,
        vy: dir.y * speed + carry.y,
        vz: dir.z * speed + carry.z,
        r,
        ...(lead ? { lead: lead.slice(0, RINGS - 4) } : {}),
      });
      // Where it meets the snow, it spatters.
      if (ground && dt > 0 && next() < SPATTER * dt) {
        const t = fallTime(asked[asked.length - 1]);
        const o = asked[asked.length - 1];
        const x = o.x + o.vx * t + (next() - 0.5) * 0.06;
        const z = o.z + o.vz * t + (next() - 0.5) * 0.06;
        lay(splats, take(), x, z, r * (2 + 2 * next()), 1, next() * 6.28);
      }
    },
    splat(x, z, r, shade, turn) {
      lay(splats, take(), x, z, r, shade, turn);
    },
    pool(key, x, z, litres, soak) {
      let o = pools.get(key);
      const r = o ? Math.sqrt((o.litres * o.soak) / Math.PI) : 0;
      if (!o || Math.hypot(x - o.x, z - o.z) > Math.max(0.12, r * 0.6)) {
        // A new pool where the gap now lies; the last stays as a smear.
        o = { index: takePool(), x, z, litres: o ? o.litres * 0.3 : 0, soak };
        pools.set(key, o);
      }
      o.litres += litres;
      o.soak = soak;
      const rr = Math.max(0.05, Math.sqrt((o.litres * o.soak) / Math.PI));
      // Lifted the more the wider, over the snow's own bumps under it.
      lay(pooled, o.index, o.x, o.z, rr, 0.75, o.index * 2.39, LIFT + 0.02 * rr);
    },
    update(dt, g) {
      ground = g;
      layTubes();
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
          const turn = (px[i] * 37 + pz[i] * 11) % 6.28;
          lay(splats, take(), px[i], pz[i], size[i] * (3 + 0.6 * Math.min(8, hit)), 1, turn);
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
        // Stretched along its way the faster it goes.
        s.set(size[i], size[i] * (1 + Math.min(5, u * 0.4)), size[i]);
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
      asked.length = 0;
      tubeGeo.setDrawRange(0, 0);
      splatCount = 0;
      nextSplat = 0;
      splats.count = 0;
      nextPool = 0;
      poolCount = 0;
      pooled.count = 0;
      pools.clear();
    },
    dispose() {
      dropGeo.dispose();
      tubeGeo.dispose();
      splatGeo.dispose();
      dropMat.dispose();
      tubeMat.dispose();
      splatMat.dispose();
      poolMat.dispose();
      mask?.dispose();
      wide?.dispose();
    },
  };
}
