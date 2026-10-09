// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND TUNNELS AS DRAWN — the resort's horizontal lifts along the
// valley floor, off their plan (`wind-tunnel-plan.ts`):
//
//   * THE ARCHES: a steel hoop over the lane every few metres, its feet in
//     the snow, and inside each a RING OF LIGHT in the tunnel's colour —
//     the rings CHASE: a bright band runs down them the way the air goes,
//     at the tunnel's own speed, so a lane says which way it blows from
//     any side and at any hour.
//   * THE CANOPY: a translucent skin over the arches in the same colour,
//     the half-pipe the wind is held in.
//   * THE CHEVRONS on the snow under it, pointing the way, chasing with the
//     rings.
//   * THE FAN at the entrance: a ring of blades turning inside the drum's
//     rim — open in the middle, so a skier is drawn in through it — a lip
//     of light on the drum's mouth and lit chevrons on the sign over it,
//     pointing in. The drum, the sign and everything else that stands
//     still of a tunnel — the footings, the snow on the crown, the portals
//     — are buildings, `tunnel-build.ts`'s, on the facade kit.
//   * THE STREAKS: snow blown down the lane a third faster than the
//     tunnel carries a skier, so the wind overtakes him; each fades in at
//     the fan and out at the exit, and enters again.
//
// WHAT MOVES moves off the engine's clock (`update(t)`), never the wall's,
// so a replay's slow motion slows the fan and the wind with everything
// else; nothing here touches `GameState`.
//
// THE DRAWS ARE FEW AND THE TRIANGLES FOLLOW THE LENS. Every part is one
// mesh for every tunnel of the resort — eight draws for the lot, three of
// them cast — and what moves is picked again for every picture from where
// the lens stands (`TUNNEL_LOD`): the arches at their full rhythm near,
// thinning with distance and gone past the DISTANCE row's wall, the
// chevrons and the streaks only near, and nothing behind the lens. The
// group is a `THREE.LOD` for that reason alone: three hands an LOD the
// camera while it walks the scene, before it culls or uploads a child, so
// a pick made there is drawn in the same picture — a cut (a lab's still,
// a replay's broadcast) never shows the last lens's arches. The streaks'
// count is the SPRAY row's share.

import * as THREE from "three";
import type { Level } from "@engine";

import { PAST_THE_WALL, hazeMaterial, type HazeUniforms } from "./haze.ts";
import { blocksOf, createBlockBuildings } from "./village-cuts.ts";
import { ARCH_FEET, FAN_HOUSE, buildTunnels, fanOf } from "./tunnel-build.ts";
import {
  TUNNEL_LOOK,
  archRadius,
  archStride,
  fanAngle,
  marksAlong,
  streakArc,
  TUNNEL_LOD,
  tunnelPaint,
  tunnelPointAt,
  tunnelReach,
  tunnelsOf,
  type TunnelPoint,
  type WindTunnel,
} from "./wind-tunnel-plan.ts";

/** How far past the half circle an arch's feet run into the snow, rad —
 * enough to keep a foot under on a lane with some fall across it. */
const FEET = ARCH_FEET;

/** A streak every this many metres of a lane at the full SPRAY share. */
const STREAK_EVERY = 2;

/** THE CHASE: a bright band every this many metres, running down the lane
 * at the tunnel's speed; and how much of the gap it lights. Where the
 * arches thin with distance the band's spacing stretches with them (times
 * the stride): a 40 m band sampled every 27 m would alias, and the lights
 * would seem to run up the lane. */
const CHASE_EVERY = 40;
const CHASE_BAND = 0.22;

/** How far round an arch the lens's pick reaches, m, beyond its radius:
 * its shadow, thrown long by a low sun, lands in the picture from an arch
 * that is not in it. */
const SHADOW_SLACK = 12;

/** The cut of an arch's steel and its ring of light: `radial` sides round
 * the tube, `around` steps along the arc — 13° a step reads as round from
 * under the arch, and a four-sided tube as a steel section. */
const HOOP = { around: 16, frame: 4, ring: 3 };

/** The canopy's cut: a ring every this many arches, and its steps round. A
 * skin this faint shows no facet; the arches carry the curve. */
const CANOPY = { archesPerRing: 2, around: 12 };

/** How bright a ring of light is between the bands and in one, a share of
 * its paint — over 1 so it reads as a light, not a paint, under the tone
 * map. */
const GLOW_LOW = 0.55;
const GLOW_HIGH = 2.6;

/** The paints, sRGB: the arches' white enamel, the blades' bright steel. */
const PAINT = { frame: 0xe8ecef, steel: 0xb9c1c8 };

export type WindTunnels = {
  group: THREE.Object3D;
  /** Move the fans, the streaks and the chase to the engine's clock. */
  update(t: number): void;
  /** The SPRAY row's share of the streaks (`SPRAY_SHARE`). */
  setBudget(share: number): void;
  dispose(): void;
};

/** A box `w × h × d` centred at (x, y, z), into a list of parts. */
function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.translate(x, y, z);
  return g;
}

/** Geometries with position and normal, as one non-indexed one — each
 * part painted its own colour (linear) where `paints` gives one. */
function joined(parts: THREE.BufferGeometry[], paints?: THREE.Color[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  parts.forEach((part, k) => {
    const g = part.index ? part.toNonIndexed() : part;
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    const c = paints?.[k];
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      if (c) col.push(c.r, c.g, c.b);
    }
    if (g !== part) g.dispose();
    part.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  if (paints) out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/** A hoop of unit radius standing in the XY plane over the origin, its
 * feet `FEET` past the half circle — +z is the way the air goes — `radial`
 * sides round its tube and `around` along its arc (`HOOP`). */
function hoop(tube: number, radial: number, around: number): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(1, tube, radial, around, Math.PI + 2 * FEET);
  g.rotateZ(-FEET);
  return g;
}

/** A chevron flat on the snow, its point toward +z, `w` m across. */
function chevron(w: number): THREE.BufferGeometry {
  const h = w / 2;
  const shape = new THREE.Shape();
  // Drawn in (x, −z): `rotateX(−π/2)` lays the shape's +y down the −z.
  shape.moveTo(0, -0.55 * h);
  shape.lineTo(h, 0.35 * h);
  shape.lineTo(h, 0.75 * h);
  shape.lineTo(0, -0.15 * h);
  shape.lineTo(-h, 0.75 * h);
  shape.lineTo(-h, 0.35 * h);
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** A FAN'S BLADES on a unit rim: a ring at the blades' roots and sixteen
 * blades pitched into the air between it and the rim, open in the middle. */
function rotorGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const blades = 16;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    const b = box(0.09, 0.36, 0.01, 0, 0.77, 0);
    b.rotateY(0.9);
    b.rotateZ(a);
    parts.push(b);
  }
  parts.push(new THREE.TorusGeometry(0.58, 0.02, 4, 32));
  parts.push(new THREE.TorusGeometry(0.96, 0.025, 4, 32));
  return joined(parts);
}

/** Three chevrons pointing UP the board, on its face toward −z — the way a
 * skier comes at the mouth. */
function signArrows(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-1.9, 0, 1.9]) {
    const g = chevron(1.5).toNonIndexed();
    // Flat on the snow pointing +z → stood up on the board pointing up.
    g.rotateX(-Math.PI / 2);
    g.translate(x, 2.6, -0.13);
    parts.push(g);
  }
  return joined(parts);
}

/** THE CANOPY: every tunnel's half-pipe over its arches, one geometry with
 * the tunnel's paint as a vertex colour. */
function canopyGeometry(tunnels: readonly WindTunnel[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  const around = CANOPY.around;
  const every = TUNNEL_LOOK.archEvery * CANOPY.archesPerRing;
  const at: TunnelPoint = { x: 0, y: 0, z: 0, heading: 0 };
  tunnels.forEach((tunnel, ti) => {
    c.set(tunnelPaint(ti));
    const r = archRadius(tunnel) - 0.05;
    const rings = marksAlong(tunnel.length, every, 0, true);
    const base = pos.length / 3;
    for (const s of rings) {
      tunnelPointAt(tunnel, s, at);
      const rx = Math.cos(at.heading);
      const rz = -Math.sin(at.heading);
      for (let k = 0; k <= around; k++) {
        const a = -FEET + ((Math.PI + 2 * FEET) * k) / around;
        const ox = Math.cos(a);
        const oy = Math.sin(a);
        pos.push(at.x + rx * ox * r, at.y + oy * r, at.z + rz * ox * r);
        nor.push(rx * ox, oy, rz * ox);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i + 1 < rings.length; i++) {
      for (let k = 0; k < around; k++) {
        const a = base + i * (around + 1) + k;
        const b = a + around + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** A STREAK: two crossed ribbons a metre long down +z, the head bright and
 * the tail gone, so a stretched one reads as a line of blown snow. */
function streakGeometry(): THREE.BufferGeometry {
  const w = 0.035;
  const pos = [
    // flat
    -w,
    0,
    -0.5,
    w,
    0,
    -0.5,
    w,
    0,
    0.5,
    -w,
    0,
    -0.5,
    w,
    0,
    0.5,
    -w,
    0,
    0.5,
    // upright
    0,
    -w,
    -0.5,
    0,
    w,
    -0.5,
    0,
    w,
    0.5,
    0,
    -w,
    -0.5,
    0,
    w,
    0.5,
    0,
    -w,
    0.5,
  ];
  const col: number[] = [];
  for (let i = 0; i < pos.length; i += 3) {
    const head = pos[i + 2] > 0 ? 1 : 0;
    col.push(1, 1, 1, head);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.computeVertexNormals();
  return g;
}

/** A hash of an integer to 0..1, for the streaks' fixed scatter — the
 * picture's own, never the engine's stream. */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** How lit a mark `s` m down a lane is at `t` s: a band running down it at
 * the tunnel's speed, `stride` times its spacing apart where the marks are
 * drawn every `stride`th. */
function chase(tunnel: WindTunnel, s: number, t: number, stride = 1): number {
  const w = ((((t * tunnel.speed - s) / (CHASE_EVERY * stride)) % 1) + 1) % 1;
  const lit = Math.max(0, 1 - w / CHASE_BAND);
  return lit * lit;
}

export function createWindTunnels(level: Level, haze: HazeUniforms, budget = 1): WindTunnels {
  const group = new THREE.LOD();
  group.name = "tunnels";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const meshes: THREE.Mesh[] = [];
  const disposers: (() => void)[] = [];
  const dispose = () => {
    for (const d of disposers) d();
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
    for (const m of meshes) if (m instanceof THREE.InstancedMesh) m.dispose();
  };
  const tunnels = tunnelsOf(level).filter((t) => t.points.length > 1 && t.length > 0);
  group.update = () => {};
  if (tunnels.length === 0) {
    return { group, update() {}, setBudget() {}, dispose };
  }
  const wrap = <M extends THREE.Material>(m: M): M => {
    mats.push(m);
    return hazeMaterial(m, haze, "tunnel", PAST_THE_WALL);
  };
  const enamel = wrap(
    new THREE.MeshStandardMaterial({ color: PAINT.frame, roughness: 0.4, metalness: 0.2 }),
  );
  const steel = wrap(
    new THREE.MeshStandardMaterial({
      color: PAINT.steel,
      roughness: 0.45,
      metalness: 0.3,
      side: THREE.DoubleSide,
    }),
  );
  const light = wrap(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const lamps = wrap(new THREE.MeshBasicMaterial({ vertexColors: true }));
  const decal = wrap(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  // THE SKIN IS MATTE: a gloss on a sheet seen edge-on from inside the
  // lane would mirror the whole sky at the grazing angle and close the
  // walls the view is meant to go through.
  const skin = wrap(
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const snow = wrap(
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const fore = new THREE.Vector3(0, 0, 1);
  const v = new THREE.Vector3();
  const size = new THREE.Vector3();
  const tint = new THREE.Color();
  const at: TunnelPoint = { x: 0, y: 0, z: 0, heading: 0 };

  /** An instanced part. Every one is picked again for each picture, so its
   * bounds are the lens's business, not three's. */
  const instanced = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    count: number,
    shadow: boolean,
  ): THREE.InstancedMesh => {
    geos.push(geo);
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
    mesh.count = 0;
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    mesh.frustumCulled = false;
    meshes.push(mesh);
    group.add(mesh);
    return mesh;
  };
  const whole = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow: boolean): THREE.Mesh => {
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    meshes.push(mesh);
    group.add(mesh);
    return mesh;
  };
  const place = (
    mesh: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    heading: number,
    scale: number,
  ) => {
    q.setFromAxisAngle(up, heading);
    mesh.setMatrixAt(i, m4.compose(v.set(x, y, z), q, size.set(scale, scale, scale)));
  };
  /** A part's own geometry stood at (x, y, z) facing `heading`, scaled. */
  const stood = (
    g: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    heading: number,
    scale: number,
  ): THREE.BufferGeometry => {
    q.setFromAxisAngle(up, heading);
    return g.applyMatrix4(m4.compose(v.set(x, y, z), q, size.set(scale, scale, scale)));
  };

  // THE MARKS DOWN THE LANES: every arch at every `archEvery` (its place in
  // its lane counts the strides), every chevron at every `chevronEvery`,
  // stood once; the pick chooses among them.
  type Mark = {
    tunnel: WindTunnel;
    ti: number;
    s: number;
    k: number;
    last: boolean;
    x: number;
    y: number;
    z: number;
    heading: number;
    r: number;
  };
  const arches: Mark[] = [];
  const chevrons: Mark[] = [];
  tunnels.forEach((tunnel, ti) => {
    const r = archRadius(tunnel);
    const along = marksAlong(tunnel.length, TUNNEL_LOOK.archEvery, 0, true);
    along.forEach((s, k) => {
      tunnelPointAt(tunnel, s, at);
      arches.push({ tunnel, ti, s, k, last: k === along.length - 1, ...at, r });
    });
    marksAlong(tunnel.length, TUNNEL_LOOK.chevronEvery, 6).forEach((s, k) => {
      tunnelPointAt(tunnel, s, at);
      const y = level.groundAt(at.x, at.z) + 0.06;
      chevrons.push({ tunnel, ti, s, k, last: false, ...at, y, r });
    });
  });
  const frames = instanced(hoop(0.045, HOOP.frame, HOOP.around), enamel, arches.length, true);
  const rings = instanced(hoop(0.014, HOOP.ring, HOOP.around), light, arches.length, false);
  const marks = instanced(chevron(1), decal, chevrons.length, false);

  // THE CANOPY, one draw for the lot.
  whole(canopyGeometry(tunnels), skin, false).renderOrder = 2;

  // THE BUILDINGS (`tunnel-build.ts`): the footings, the snow on the
  // crowns, the portals and the fan houses with their sign gantries — one
  // mesh in the painted materials (`facade-paint.ts`) for every tunnel.
  // Cut into blocks at two cuts as the village is (`village-cuts.ts`), so
  // the lot is neither drawn whole nor shadowed from across the mountain.
  const buildings = createBlockBuildings(
    blocksOf((minArea) => {
      const kit = buildTunnels(level, tunnels, minArea);
      return { kit, spans: [{ from: 0, to: kit.triangles, at: null }] };
    }),
    haze,
    "tunnels",
  );
  group.add(buildings.group);
  disposers.push(() => buildings.dispose());

  // THE FANS: the lit lip on each drum's mouth and the sign's arrows (one
  // draw) and the blades, `fanBack` m and the drum's depth before each
  // entrance (`fanOf`).
  const depth = FAN_HOUSE.depth;
  /** The blades turn in the middle of the drum. */
  const mid = depth / 2;
  const fans = tunnels.map((tunnel) => fanOf(level, tunnel));
  const lit: THREE.BufferGeometry[] = [];
  const litPaint: THREE.Color[] = [];
  fans.forEach((f, i) => {
    const sign = f.y + f.r + FAN_HOUSE.sign.foot;
    // The lip of light round the bellmouth's rim, ahead of the drum.
    const bell = FAN_HOUSE.bell;
    const ahead = bell.length + 0.04;
    const lip = f.r + bell.flare - FAN_HOUSE.shell / 2;
    const lx = f.x - Math.sin(f.heading) * ahead;
    const lz = f.z - Math.cos(f.heading) * ahead;
    lit.push(stood(hoop(0.035, 6, 28), lx, f.y, lz, f.heading, lip));
    litPaint.push(new THREE.Color(tunnelPaint(i)).multiplyScalar(GLOW_HIGH * 0.7));
    lit.push(stood(signArrows(), f.x, sign, f.z, f.heading, 1));
    litPaint.push(new THREE.Color(tunnelPaint(i)).multiplyScalar(GLOW_HIGH));
  });
  whole(joined(lit, litPaint), lamps, false);
  const rotors = instanced(rotorGeometry(), steel, fans.length, true);
  rotors.count = fans.length;

  // THE STREAKS: a fixed scatter per lane — where across it, how high under
  // the canopy, how long — carried down it by the clock.
  type Streak = { tunnel: WindTunnel; phase: number; lateral: number; high: number; long: number };
  const streaks: Streak[] = [];
  tunnels.forEach((tunnel, ti) => {
    const r = archRadius(tunnel) - 0.4;
    const n = Math.ceil(tunnel.length / STREAK_EVERY);
    for (let k = 0; k < n; k++) {
      const seed = ti * 7919 + k * 4;
      const lateral = (hash(seed) * 2 - 1) * tunnel.width * 0.45;
      const roof = Math.sqrt(Math.max(0, r * r - lateral * lateral));
      streaks.push({
        tunnel,
        phase: hash(seed + 1),
        lateral,
        high: 0.15 + hash(seed + 2) * (roof - 0.3),
        long: 1.6 + hash(seed + 3) * 3.2,
      });
    }
  });
  // Shuffled across the lanes, so a budget's share thins every lane alike.
  streaks.sort((a, b) => a.phase - b.phase);
  const blown = instanced(streakGeometry(), snow, streaks.length, false);
  blown.renderOrder = 1;
  let shown = streaks.length;
  let clock = 0;

  // THE PICK, for each picture: what of the lanes the lens at `eye` sees.
  const frustum = new THREE.Frustum();
  const view = new THREE.Matrix4();
  const ball = new THREE.Sphere();
  const eye = new THREE.Vector3();
  /** Whether a ball of radius `r` at (x, y, z) is in the picture. */
  const seen = (x: number, y: number, z: number, r: number): boolean => {
    ball.center.set(x, y, z);
    ball.radius = r;
    return frustum.intersectsSphere(ball);
  };
  const pick = (camera: THREE.Camera) => {
    view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(view);
    camera.getWorldPosition(eye);
    buildings.update(eye);
    const reach = tunnelReach(haze.uMist.value);
    const close = reach.near * TUNNEL_LOD.marks;
    const t = clock;

    let n = 0;
    for (const a of arches) {
      const stride = archStride(Math.hypot(a.x - eye.x, a.y - eye.y, a.z - eye.z), reach);
      if (stride === 0 || (a.k % stride !== 0 && !a.last)) continue;
      if (!seen(a.x, a.y + a.r / 2, a.z, a.r + SHADOW_SLACK)) continue;
      place(frames, n, a.x, a.y, a.z, a.heading, a.r);
      place(rings, n, a.x, a.y, a.z, a.heading, a.r - 0.32);
      const glow = GLOW_LOW + (GLOW_HIGH - GLOW_LOW) * chase(a.tunnel, a.s, t, stride);
      rings.setColorAt(n, tint.set(tunnelPaint(a.ti)).multiplyScalar(glow));
      n++;
    }
    frames.count = rings.count = n;

    n = 0;
    for (const c of chevrons) {
      if (Math.hypot(c.x - eye.x, c.y - eye.y, c.z - eye.z) > close) continue;
      if (!seen(c.x, c.y, c.z, c.tunnel.width / 2)) continue;
      place(marks, n, c.x, c.y, c.z, c.heading, c.tunnel.width * 0.42);
      const glow = 0.45 + 1.1 * chase(c.tunnel, c.s, t);
      marks.setColorAt(n, tint.set(tunnelPaint(c.ti)).multiplyScalar(glow));
      n++;
    }
    marks.count = n;

    // The wind, carried down the lane; each streak grows in at the
    // entrance and shrinks away at the exit rather than popping.
    n = 0;
    for (let i = 0; i < shown; i++) {
      const k = streaks[i];
      const s = streakArc(k.tunnel, k.phase, t);
      tunnelPointAt(k.tunnel, s, at);
      if (Math.hypot(at.x - eye.x, at.y - eye.y, at.z - eye.z) > close) continue;
      const rx = Math.cos(at.heading);
      const rz = -Math.sin(at.heading);
      const x = at.x + rx * k.lateral;
      const y = at.y + k.high;
      const z = at.z + rz * k.lateral;
      if (!seen(x, y, z, k.long)) continue;
      const ends = Math.min(1, s / 10, (k.tunnel.length - s) / 10);
      q.setFromAxisAngle(up, at.heading);
      blown.setMatrixAt(
        n++,
        m4.compose(v.set(x, y, z), q, size.set(1, 1, Math.max(0.01, k.long * ends))),
      );
    }
    blown.count = n;

    for (const m of [frames, rings, marks, blown]) {
      m.visible = m.count > 0;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  };
  // Three calls an LOD's `update` with the lens of every picture it draws
  // the scene for (`projectObject`), before it walks the children. The
  // shadow maps call nothing, and draw what the lens picked; an ortho lens
  // (the skiers' own shadow maps, a lab's plan) picks nothing.
  group.update = (camera) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) pick(camera);
  };

  const api: WindTunnels = {
    group,
    update(t) {
      clock = t;
      // The fans turn.
      fans.forEach((f, i) => {
        q.setFromAxisAngle(up, f.heading);
        spin.setFromAxisAngle(fore, fanAngle(t) * (i % 2 === 0 ? 1 : -1));
        q.multiply(spin);
        v.set(f.x + Math.sin(f.heading) * mid, f.y, f.z + Math.cos(f.heading) * mid);
        rotors.setMatrixAt(i, m4.compose(v, q, size.set(f.r, f.r, f.r)));
      });
      rotors.instanceMatrix.needsUpdate = true;
    },
    setBudget(share) {
      shown = Math.round(streaks.length * Math.min(1, Math.max(0, share)));
    },
    dispose,
  };
  api.setBudget(budget);
  api.update(0);
  return api;
}
