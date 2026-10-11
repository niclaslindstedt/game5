// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIRSTRIP AS DRAWN — everything at the jump plane's strip on a free
// ride, off the engine's plan of it (`airstrip-site.ts`'s `stripSiteOf`):
//   * THE SNOW: the runway and the apron laid packed and combed on the
//     ground's own grids, windrows along the edges (`strip-ground.ts`,
//     through `terrain.ts`'s `layGround`);
//   * THE MARKERS: orange boards on stakes down both edges and across both
//     ends, a spruce bough stuck in the snow between each pair, all merged
//     into one draw — and after dark a lamp at each board, white down the
//     edges and green across the ends — and inside each end a row of bars
//     of dyed snow across the runway, its threshold read from the air;
//   * THE BUILDINGS (`strip-build.ts`) as one facade mesh, their lamps and
//     panes lit after dark, the hangar's two lamps lighting the apron;
//   * THE WINDSOCK: the mast in the buildings' mesh, the sock a banded
//     tube posed every frame off the run's own wind (`windAt`): streaming
//     straight out down the wind at fifteen knots and over, sagging toward
//     the mast as the wind drops, fluttering with the gusts — and a red
//     lamp on the mast's head after dark.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  STRIP_SITE,
  stripPoint,
  stripSiteOf,
  windAt,
  type Airstrip,
  type GameState,
  type Level,
  type Wind,
} from "@engine";

import { FacadeKit } from "./facade-kit.ts";
import { FACADE } from "./facade-paint.ts";
import { facadeGeometry, facadeMaterial } from "./facade-mesh.ts";
import { glow } from "./glow-sprite.ts";
import type { Flood } from "./headlamp.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { buildStrip } from "./strip-build.ts";
import { stripStamp } from "./strip-ground.ts";
import { layGround } from "./terrain.ts";

export type StripView = {
  group: THREE.Group;
  /** One frame: the sock posed off the run's wind, the lamps lit. */
  frame(state: GameState, lit: number, eye: THREE.Vector3): void;
  /** After dark, the hangar's lamps over the apron into `out`, when the
   * eye is near enough to see what they light. */
  lamps(lit: number, eye: THREE.Vector3, out: Flood[]): void;
  dispose(): void;
};

/** The wind at which the sock streams straight out, m/s (fifteen knots). */
const FULL = 7.7;
/** The sock's rings along its length and its sides round. */
const RINGS = 8;
const SIDES = 12;
/** The hangar's lamps: their power, and how near the eye must be, m. */
const FLOOD = 1.6;
const FLOOD_NEAR = 700;

const S = STRIP_SITE.sock;

export function createStripView(level: Level, haze: HazeUniforms): StripView {
  const site = stripSiteOf(level);
  const strip = site.strip;
  layGround(level, stripStamp(site));
  const group = new THREE.Group();
  group.name = "airstrip";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  // THE BUILDINGS and the sock's mast, one mesh.
  const kit = new FacadeKit();
  buildStrip(kit, site.buildings);
  kit.at(site.sock.x, site.sock.y, site.sock.z, strip.heading);
  kit.box(-0.35, -0.6, -0.35, 0.35, 0.12, 0.35, FACADE.concrete, 0xcfcac2);
  kit.column(0, 0, 0, S.mast, 0.055, FACADE.steel, 0xb8bdc2, 8);
  kit.column(0, 0, S.mast - 0.05, S.mast + 0.12, 0.08, FACADE.steel, 0x3a3f44, 8);
  const buildingGeo = facadeGeometry(kit.out);
  geos.push(buildingGeo);
  const buildingMat = facadeMaterial(haze, "airstrip");
  mats.push(buildingMat);
  const buildings = new THREE.Mesh(buildingGeo, buildingMat);
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  buildings.name = "airstrip-buildings";
  group.add(buildings);

  // THE MARKERS, one merged mesh.
  const marksMat = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 }),
    haze,
    "airstrip-marks",
  );
  mats.push(marksMat);
  const marksGeo = markersGeometry(site.markers, strip.heading);
  geos.push(marksGeo);
  const marks = new THREE.Mesh(marksGeo, marksMat);
  marks.castShadow = true;
  marks.name = "airstrip-markers";
  group.add(marks);

  // THE THRESHOLD BARS: dyed snow, laid on the ground just over it.
  const dyeMat = hazeMaterial(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    haze,
    "airstrip-dye",
  );
  mats.push(dyeMat);
  const dyeGeo = dyeGeometry(level, strip);
  geos.push(dyeGeo);
  const dye = new THREE.Mesh(dyeGeo, dyeMat);
  dye.receiveShadow = true;
  dye.name = "airstrip-dye";
  group.add(dye);

  // THE EDGE LAMPS after dark: a glow at every board.
  const boards = site.markers.filter((m) => m.kind !== "bough");
  const lampPos = new Float32Array(boards.length * 3);
  const lampCol = new Float32Array(boards.length * 3);
  boards.forEach((m, i) => {
    lampPos.set([m.x, m.y + 0.62, m.z], i * 3);
    lampCol.set(m.kind === "threshold" ? [0.35, 1, 0.45] : [1, 0.9, 0.7], i * 3);
  });
  const lampGeo = new THREE.BufferGeometry();
  lampGeo.setAttribute("position", new THREE.BufferAttribute(lampPos, 3));
  lampGeo.setAttribute("color", new THREE.BufferAttribute(lampCol, 3));
  geos.push(lampGeo);
  const lampMat = new THREE.PointsMaterial({
    map: glow(),
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  mats.push(lampMat);
  const lampPoints = new THREE.Points(lampGeo, lampMat);
  lampPoints.visible = false;
  lampPoints.renderOrder = 9;
  group.add(lampPoints);

  // THE SOCK: a banded tube, its rings posed every frame.
  const sockGeo = sockGeometry();
  geos.push(sockGeo);
  const sockMat = hazeMaterial(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
    haze,
    "airstrip-sock",
  );
  mats.push(sockMat);
  const sock = new THREE.Mesh(sockGeo, sockMat);
  sock.castShadow = true;
  sock.frustumCulled = false;
  sock.name = "airstrip-sock";
  sock.position.set(site.sock.x, site.sock.y + S.mast, site.sock.z);
  group.add(sock);
  const beaconMat = new THREE.SpriteMaterial({
    map: glow(),
    color: 0xff3018,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  mats.push(beaconMat);
  const beacon = new THREE.Sprite(beaconMat);
  beacon.scale.set(1.2, 1.2, 1);
  beacon.position.set(site.sock.x, site.sock.y + S.mast + 0.2, site.sock.z);
  beacon.visible = false;
  group.add(beacon);

  // The hangar's lamps, in the world.
  const floods: Flood[] = [];
  for (const b of site.buildings) {
    if (b.kind !== "hangar" && b.kind !== "leanTo") continue;
    const sin = Math.sin(b.heading);
    const cos = Math.cos(b.heading);
    for (const px of [-5, 5]) {
      const pz = b.depth / 2 + 0.5;
      floods.push({
        x: b.x + px * cos + pz * sin,
        y: b.floor + 5.1,
        z: b.z - px * sin + pz * cos,
        dx: sin * 0.75,
        dy: -0.66,
        dz: cos * 0.75,
        colour: [1, 0.93, 0.8],
        power: FLOOD,
      });
    }
  }

  const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };
  let lastT = Number.NaN;
  return {
    group,
    frame(state, lit, eye) {
      const near = eye.distanceToSquared(sock.position) < 900 * 900;
      sock.visible = near;
      if (near && state.t !== lastT) {
        lastT = state.t;
        windAt(level, state.t, wind);
        poseSock(sockGeo, wind, state.t);
      }
      const on = lit > 0.02;
      lampPoints.visible = on;
      beacon.visible = on;
      lampMat.opacity = Math.min(1, lit * 1.4);
      beaconMat.opacity = Math.min(1, lit * 1.4) * (0.75 + 0.25 * Math.sin(state.t * 3));
    },
    lamps(lit, eye, out) {
      if (lit <= 0.02) return;
      for (const f of floods) {
        if (Math.hypot(f.x - eye.x, f.z - eye.z) > FLOOD_NEAR) continue;
        out.push({ ...f, power: (f.power ?? 1) * lit });
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

/** A coloured copy of `g`, set down at (x, y, z) turned `yaw`. */
function placed(
  g: THREE.BufferGeometry,
  colour: number,
  x: number,
  y: number,
  z: number,
  yaw: number,
  tilt = 0,
): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone();
  const c = new THREE.Color(colour);
  const n = out.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  out.deleteAttribute("uv");
  const m = new THREE.Matrix4().makeRotationY(yaw);
  if (tilt) m.multiply(new THREE.Matrix4().makeRotationX(tilt));
  m.setPosition(x, y, z);
  out.applyMatrix4(m);
  return out;
}

/** Every marker, merged: a board is an orange plate with a white bar on two
 * stakes, long along the strip; a bough three dark sprigs. */
function markersGeometry(
  markers: readonly { kind: string; x: number; y: number; z: number }[],
  heading: number,
): THREE.BufferGeometry {
  const plate = new THREE.BoxGeometry(0.06, 0.34, 1.0);
  const bar = new THREE.BoxGeometry(0.065, 0.1, 1.0);
  const stake = new THREE.BoxGeometry(0.04, 0.5, 0.04);
  const sprig = new THREE.ConeGeometry(0.2, 0.95, 5);
  const parts: THREE.BufferGeometry[] = [];
  for (const [i, m] of markers.entries()) {
    if (m.kind === "bough") {
      // Three sprigs leaned apart, sunk a hand in the snow.
      for (let k = 0; k < 3; k++) {
        const a = heading + k * 2.1 + i;
        const lean = 0.18 + 0.08 * k;
        parts.push(
          placed(
            sprig,
            0x24432c,
            m.x + Math.sin(a) * 0.12,
            m.y + 0.35,
            m.z + Math.cos(a) * 0.12,
            a,
            lean,
          ),
        );
      }
      continue;
    }
    // A threshold board stands across the strip, an edge board along it.
    const yaw = m.kind === "threshold" ? heading + Math.PI / 2 : heading;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    parts.push(placed(plate, 0xf06418, m.x, m.y + 0.45, m.z, yaw));
    parts.push(placed(bar, 0xf2f2ee, m.x, m.y + 0.45, m.z, yaw));
    for (const s of [-0.42, 0.42]) {
      parts.push(placed(stake, 0x2a2c2e, m.x + fx * s, m.y + 0.13, m.z + fz * s, yaw));
    }
  }
  const out = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  for (const p of parts) p.dispose();
  for (const g of [plate, bar, stake, sprig]) g.dispose();
  return out;
}

/** The threshold bars: at each end, `DYE.bars` bars of dyed snow either side
 * of the centre line, `DYE.long` m down the runway from `DYE.in` m inside
 * its end, each a strip of quads draped on the snow. */
const DYE = { bars: 3, wide: 1.5, gap: 1.2, middle: 1.5, in: 5, long: 16, colour: 0xb8402a };

function dyeGeometry(level: Level, strip: Airstrip): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color(DYE.colour);
  const half = strip.length / 2;
  const at = (along: number, across: number): number[] => {
    const p = stripPoint(strip, along, across);
    return [p.x, level.groundAt(p.x, p.z) + 0.03, p.z];
  };
  for (const end of [-1, 1]) {
    const a0 = end * (half - DYE.in);
    const a1 = end * (half - DYE.in - DYE.long);
    for (const side of [-1, 1]) {
      for (let k = 0; k < DYE.bars; k++) {
        const w0 = side * (DYE.middle + k * (DYE.wide + DYE.gap));
        const w1 = w0 + side * DYE.wide;
        const steps = 4;
        for (let i = 0; i < steps; i++) {
          const u0 = a0 + ((a1 - a0) * i) / steps;
          const u1 = a0 + ((a1 - a0) * (i + 1)) / steps;
          const q = [at(u0, w0), at(u1, w0), at(u1, w1), at(u0, w1)];
          // Wound to face up whichever end and side it lies on.
          const flip = end * side < 0;
          const tris = flip ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
          for (const t of tris) {
            pos.push(...q[t]);
            col.push(c.r, c.g, c.b);
          }
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** The sock's tube: RINGS + 1 rings of SIDES, banded orange and white
 * (orange at both ends), its faces indexed; positions posed per frame. */
function sockGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const n = (RINGS + 1) * SIDES;
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const col = new Float32Array(n * 3);
  const orange = new THREE.Color(0xff5a12);
  const white = new THREE.Color(0xf4f4f0);
  for (let r = 0; r <= RINGS; r++) {
    const band = Math.min(4, Math.floor((r / (RINGS + 0.001)) * 5));
    const c = band % 2 === 0 ? orange : white;
    for (let k = 0; k < SIDES; k++) col.set([c.r, c.g, c.b], (r * SIDES + k) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const idx: number[] = [];
  for (let r = 0; r < RINGS; r++) {
    for (let k = 0; k < SIDES; k++) {
      const a = r * SIDES + k;
      const b = r * SIDES + ((k + 1) % SIDES);
      const c = a + SIDES;
      const d = b + SIDES;
      idx.push(a, c, b, b, c, d);
    }
  }
  g.setIndex(idx);
  return g;
}

/** The sock posed off the wind: its mouth on the mast's head, the tube out
 * down the wind — level at FULL and over, hanging toward the mast as the
 * wind drops, its tail the slacker — and fluttering with the gust. */
function poseSock(g: THREE.BufferGeometry, w: Wind, t: number): void {
  const fill = Math.min(1, w.speed / FULL);
  const slack = 1 - fill;
  const dir = w.speed > 0.05 ? Math.atan2(w.x, w.z) : 0;
  const dx = Math.sin(dir);
  const dz = Math.cos(dir);
  // Across the wind, for the flutter.
  const ax = dz;
  const az = -dx;
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  let px = 0;
  let py = 0;
  let pz = 0;
  const seg = S.length / RINGS;
  const flutter = 0.06 + 0.12 * w.gust * fill;
  for (let r = 0; r <= RINGS; r++) {
    const s = r / RINGS;
    // The droop below level: none full, near the mast's line calm.
    const droop = slack * (1.15 + 0.5 * s) + 0.04;
    const wag = Math.sin(t * (5 + 4 * fill) - s * 4) * flutter * s;
    const hx = Math.cos(droop) * dx + wag * ax;
    const hz = Math.cos(droop) * dz + wag * az;
    const hy = -Math.sin(droop);
    if (r > 0) {
      px += hx * seg;
      py += hy * seg;
      pz += hz * seg;
    }
    // The ring's radius: the mouth's, tapering to the tail, slack rings
    // folded flatter.
    const radius = (S.mouth / 2) * (1 - 0.6 * s) * (1 - 0.45 * slack * s);
    // The ring's frame: along (hx, hy, hz), one side across the wind.
    const along = new THREE.Vector3(hx, hy, hz).normalize();
    const side = new THREE.Vector3(ax, 0, az);
    const up = new THREE.Vector3().crossVectors(side, along).normalize();
    for (let k = 0; k < SIDES; k++) {
      const a = (k / SIDES) * Math.PI * 2;
      const squash = 1 - 0.5 * slack * s;
      const cx = Math.cos(a) * radius;
      const cy = Math.sin(a) * radius * squash;
      pos.setXYZ(
        r * SIDES + k,
        px + side.x * cx + up.x * cy,
        py + side.y * cx + up.y * cy,
        pz + side.z * cx + up.z * cy,
      );
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}
