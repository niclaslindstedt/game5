// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOARDING RINGS AS DRAWN — the lit circle on the snow at every lift's
// foot where its queue starts (`boardingRing`, the engine's), shown only on
// a run whose rules ride the lifts (a free ride). Ride into one and the lift
// takes you (`lift-ride.ts`). Each is drawn so it reads as a place to go
// from up the hill:
//
//   * THE BAND: a glowing amber ring laid on the snow as it lies, its light
//     breathing with the clock;
//   * THE MARCH: a ring of dashes inside it turning slowly round;
//   * THE POOL: a faint wash of the same light filling the circle;
//   * THE BEAM: a column of light standing up out of it, fading to nothing
//     overhead, seen over the corrals and the crowd.
//
// Unlit and untoned, so it glows at noon and at night alike. All the rings
// of a resort are one draw a part; nothing here reads the engine's state
// but the clock.

import * as THREE from "three";
import { BOARDING_RING, boardingRing, type Level, type LiftPlan } from "@engine";

import { LOOSE } from "./trail-stamp.ts";

/** The light's colour, sRGB, and its look, m: the band's inner and outer
 * share of the ring's radius, the dashes', how many dashes, the beam's
 * height and its radius's share of the ring's. */
const LOOK = {
  colour: 0xffb21e,
  band: [0.86, 1] as const,
  march: [0.7, 0.78] as const,
  dashes: 12,
  beam: 16,
  beamShare: 0.55,
  /** How far over the drawn snow the decals ride, m. */
  lift: 0.06,
  /** Segments round a ring. */
  around: 72,
};

export type BoardingRings = {
  group: THREE.Group;
  /** Breathe and turn to the engine's clock, s. */
  update(t: number): void;
  dispose(): void;
};

/** A flat ring from `r0` to `r1` round each centre, laid on the snow; `u`
 * runs once round (×`wrap`), `v` from the inner edge to the outer. */
function ringGeometry(
  level: Level,
  centres: readonly { x: number; z: number }[],
  r0: number,
  r1: number,
  wrap: number,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = LOOK.around;
  const snow = (x: number, z: number): number =>
    level.groundAt(x, z) + LOOSE * (1 - level.packedAt(x, z)) + LOOK.lift;
  for (const c of centres) {
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      for (const [r, v] of [
        [r0, 0],
        [r1, 1],
      ] as const) {
        const x = c.x + Math.sin(a) * r;
        const z = c.z + Math.cos(a) * r;
        pos.push(x, snow(x, z), z);
        uv.push((i / n) * wrap, v);
      }
    }
    for (let i = 0; i < n; i++) {
      const k = base + i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** An open column of light round each centre, its foot sunk into the snow,
 * `v` 0 at the foot to 1 at its head. */
function beamGeometry(
  level: Level,
  centres: readonly { x: number; z: number }[],
  r: number,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = 32;
  for (const c of centres) {
    const base = pos.length / 3;
    const top = level.groundAt(c.x, c.z) + LOOK.beam;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = c.x + Math.sin(a) * r;
      const z = c.z + Math.cos(a) * r;
      pos.push(x, level.groundAt(x, z) - 0.2, z, x, top, z);
      uv.push(i / n, 0, i / n, 1);
    }
    for (let i = 0; i < n; i++) {
      const k = base + i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A one-row texture of `w` texels whose green is `f(texel share)`, as an
 * alpha map (`alphaMap` reads the green). */
function alphaRow(w: number, f: (s: number) => number, vertical = false): THREE.DataTexture {
  const data = new Uint8Array(w * 4);
  for (let i = 0; i < w; i++) {
    const a = Math.round(255 * Math.max(0, Math.min(1, f((i + 0.5) / w))));
    data.set([a, a, a, 255], i * 4);
  }
  const tex = vertical
    ? new THREE.DataTexture(data, 1, w, THREE.RGBAFormat)
    : new THREE.DataTexture(data, w, 1, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** The boarding rings of every lift of the map, from its plans. */
export function createBoardingRings(level: Level, plans: readonly LiftPlan[]): BoardingRings {
  const group = new THREE.Group();
  group.name = "boarding-rings";
  const centres = plans.map((p) => boardingRing(p));
  const R = BOARDING_RING.radius;
  const geos = [
    ringGeometry(level, centres, R * LOOK.band[0], R * LOOK.band[1], 1),
    ringGeometry(level, centres, R * LOOK.march[0], R * LOOK.march[1], LOOK.dashes),
    ringGeometry(level, centres, 0, R * LOOK.band[0], 1),
    beamGeometry(level, centres, R * LOOK.beamShare),
  ];
  // A dash and its gap; the pool brightest at its rim; the beam fading up.
  const dash = alphaRow(32, (s) => (s < 0.55 ? 1 : 0));
  const pool = alphaRow(32, (s) => 0.1 + 0.35 * s * s, true);
  const fade = alphaRow(64, (s) => (1 - s) ** 2, true);
  const textures = [dash, pool, fade];
  const light = (p: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({
      color: LOOK.colour,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
      ...p,
    });
  const band = light({ opacity: 0.95 });
  const march = light({ alphaMap: dash, opacity: 0.9 });
  const fill = light({ alphaMap: pool, opacity: 1 });
  const beam = light({
    alphaMap: fade,
    opacity: 0.2,
    side: THREE.FrontSide,
    polygonOffset: false,
  });
  const mats = [band, march, fill, beam];
  geos.forEach((g, i) => {
    const m = new THREE.Mesh(g, mats[i]);
    m.frustumCulled = false;
    m.renderOrder = i === 3 ? 6 : 2;
    group.add(m);
  });
  return {
    group,
    update(t) {
      const breath = 0.5 + 0.5 * Math.sin(t * 3);
      band.opacity = 0.75 + 0.25 * breath;
      beam.opacity = 0.12 + 0.1 * breath;
      dash.offset.x = (-t * 0.25) % 1;
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const tex of textures) tex.dispose();
    },
  };
}
