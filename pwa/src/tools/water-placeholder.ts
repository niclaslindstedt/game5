// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PLACEHOLDER WATER for the water lab (`water-harness.ts`): until a real
// face's lakes and streams come off its OpenStreetMap hints, a lab lays a
// few of its own on any map, in the shape `Level.water` and
// `Level.streams` will have — a VALLEY LAKE on the valley floor away from
// the village, a TARN in the flattest bowl high on the face, and the
// STREAM that runs out of the tarn down the fall line — and does to the
// ground what the generator will: flattens it to each surface, feathered
// into the shore, and clears the trees off the water. Lab-only: nothing in
// the game reads this file.

import { nearestTrackPoint, type Level, type WaterBody, type WaterStream } from "@engine";

/** Where in the real world a lab's water lies: the real height over the sea
 * a map's valley floor stands at, by country, m. */
const VALLEY_REAL: Record<string, number> = {
  alpine: 800,
  fell: 380,
  continental: 1500,
  maritime: 300,
};

/** A noisy ellipse round (x, z): `rx` across, `rz` along, `n` points. */
function blob(x: number, z: number, rx: number, rz: number, seed: number, n = 72): Float32Array {
  const ring = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wob =
      1 +
      0.14 * Math.sin(3 * a + seed) +
      0.08 * Math.sin(5 * a + seed * 2.3) +
      0.05 * Math.sin(9 * a + seed * 0.7);
    ring[2 * i] = x + Math.cos(a) * rx * wob;
    ring[2 * i + 1] = z + Math.sin(a) * rz * wob;
  }
  return ring;
}

function inside(ring: Float32Array, x: number, z: number): boolean {
  let hit = false;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const zi = ring[2 * i + 1];
    const zj = ring[2 * j + 1];
    if (zi > z === zj > z) continue;
    const xi = ring[2 * i];
    const xj = ring[2 * j];
    if (x < xi + ((z - zi) / (zj - zi)) * (xj - xi)) hit = !hit;
  }
  return hit;
}

function edgeDistance(ring: Float32Array, x: number, z: number): number {
  let best = Infinity;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = ring[2 * j];
    const az = ring[2 * j + 1];
    const bx = ring[2 * i] - ax;
    const bz = ring[2 * i + 1] - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz || 1)));
    best = Math.min(best, Math.hypot(x - ax - bx * t, z - az - bz * t));
  }
  return best;
}

/** Flatten the ground to `y` inside `ring`, feathered `feather` m out. */
function flatten(level: Level, ring: Float32Array, y: number, feather: number): void {
  const f = level.ground;
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    x0 = Math.min(x0, ring[i]);
    x1 = Math.max(x1, ring[i]);
    z0 = Math.min(z0, ring[i + 1]);
    z1 = Math.max(z1, ring[i + 1]);
  }
  const data = f.data as Float32Array;
  const c0 = Math.max(0, Math.floor((x0 - feather - f.originX) / f.cell));
  const c1 = Math.min(f.cols - 1, Math.ceil((x1 + feather - f.originX) / f.cell));
  const r0 = Math.max(0, Math.floor((z0 - feather - f.originZ) / f.cell));
  const r1 = Math.min(f.rows - 1, Math.ceil((z1 + feather - f.originZ) / f.cell));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = f.originX + c * f.cell;
      const z = f.originZ + r * f.cell;
      const k = r * f.cols + c;
      if (inside(ring, x, z)) {
        data[k] = y;
        continue;
      }
      const d = edgeDistance(ring, x, z);
      if (d >= feather) continue;
      const s = d / feather;
      const w = s * s * (3 - 2 * s);
      data[k] = y + (data[k] - y) * w + 0.6 * (1 - w) * s;
    }
  }
}

function lowest(ring: Float32Array, level: Level): { x: number; z: number; y: number } {
  let best = { x: ring[0], z: ring[1], y: Infinity };
  for (let i = 0; i < ring.length; i += 2) {
    const y = level.groundAt(ring[i], ring[i + 1]);
    if (y < best.y) best = { x: ring[i], z: ring[i + 1], y };
  }
  return best;
}

export type Placeholder = {
  level: Level;
  valley: WaterBody;
  tarn: WaterBody | null;
  stream: WaterStream | null;
};

/**
 * The map with a lab's water laid on it. `scale` sizes the valley lake
 * (1: about 600 × 340 m, a valley lake a ski village stands by).
 */
export function withPlaceholderWater(level: Level, scale = 1): Placeholder {
  const size = level.size;
  const region = level.region ?? "alpine";
  const base = level.mountain?.base.y ?? level.groundAt(size / 2, size * 0.95);
  const top = level.mountain?.summit.y ?? level.groundAt(size / 2, size * 0.05);
  const realOf = (y: number): number => (VALLEY_REAL[region] ?? 800) + (y - base);
  const hub = level.resort?.hub;
  const hx = hub ? hub.x0 + (hub.step * hub.top.length) / 2 : size / 2;

  // THE VALLEY LAKE: the lowest stretch of the floor, as far from the
  // village as it lies.
  const rx = 300 * scale;
  const rz = 170 * scale;
  let at = { x: size / 2, z: size * 0.9, score: Infinity };
  for (let z = size * 0.7; z < size - rz - 40; z += 20) {
    for (let x = rx + 60; x < size - rx - 60; x += 20) {
      const score = level.groundAt(x, z) - 0.02 * Math.abs(x - hx);
      if (score < at.score) at = { x, z, score };
    }
  }
  const ring = blob(at.x, at.z, rx, rz, 1.7);
  const y = lowest(ring, level).y + 0.5;
  flatten(level, ring, y, 30);
  const valley: WaterBody = {
    kind: "lake",
    rings: [ring],
    y,
    realLevel: realOf(y),
    area: Math.PI * rx * rz,
  };

  // THE TARN: the flattest ground two-thirds of the way up, off the pistes.
  let best = { x: 0, z: 0, slope: Infinity };
  const band0 = base + (top - base) * 0.55;
  const band1 = base + (top - base) * 0.85;
  for (let z = 150; z < size * 0.6; z += 24) {
    for (let x = 150; x < size - 150; x += 24) {
      const h = level.groundAt(x, z);
      if (h < band0 || h > band1) continue;
      if (nearestTrackPoint(level, x, z).distance < 120) continue;
      const slope =
        Math.abs(level.groundAt(x + 40, z) - level.groundAt(x - 40, z)) +
        Math.abs(level.groundAt(x, z + 40) - level.groundAt(x, z - 40));
      if (slope < best.slope) best = { x, z, slope };
    }
  }
  let tarn: WaterBody | null = null;
  let stream: WaterStream | null = null;
  if (Number.isFinite(best.slope)) {
    const tr = blob(best.x, best.z, 75, 50, 4.1, 48);
    const out = lowest(tr, level);
    const ty = out.y + 0.3;
    flatten(level, tr, ty, 20);
    tarn = { kind: "pond", rings: [tr], y: ty, realLevel: realOf(ty), area: Math.PI * 75 * 50 };
    // THE STREAM out of it: down the steepest way, until the valley lake.
    const line: number[] = [out.x, out.z];
    let x = out.x;
    let z = out.z;
    for (let k = 0; k < 90; k++) {
      let bx = x;
      let bz = z;
      let bh = Infinity;
      for (let a = 0; a < 16; a++) {
        const th = (a / 16) * Math.PI * 2;
        const nx = x + Math.sin(th) * 14;
        const nz = z + Math.cos(th) * 14;
        if (inside(tr, nx, nz)) continue;
        const h = level.groundAt(nx, nz);
        if (h < bh) {
          bh = h;
          bx = nx;
          bz = nz;
        }
      }
      if (bh >= level.groundAt(x, z) || inside(ring, bx, bz)) break;
      x = bx;
      z = bz;
      line.push(x, z);
    }
    if (line.length >= 6) {
      stream = { kind: "stream", line: new Float32Array(line), width: 3, realLevel: realOf(ty) };
    }
  }

  const water = tarn ? [valley, tarn] : [valley];
  const wet = (x: number, z: number): boolean => water.some((b) => inside(b.rings[0], x, z));
  // The lab's lens stands on the valley lake's downhill shore: clear it.
  let sx = ring[0];
  let sz = ring[1];
  for (let i = 0; i < ring.length; i += 2) {
    if (ring[i + 1] > sz) {
      sx = ring[i];
      sz = ring[i + 1];
    }
  }
  const trees = level.trees.filter((t) => !wet(t.x, t.z) && Math.hypot(t.x - sx, t.z - sz) > 45);
  return {
    level: { ...level, trees, water, streams: stream ? [stream] : [] },
    valley,
    tarn,
    stream,
  };
}

export { inside as insideRing };
