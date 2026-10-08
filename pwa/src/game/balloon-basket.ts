// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BALLOON'S BASKET AND BURNER IN THE RENDERER — everything that hangs
// under the envelope's wires, in the basket's own frame (its floor's centre
// the origin, `balloon-look.ts`'s `BASKET_LOOK` and `BURNER_LOOK`):
//
//   * the WICKER: a round-cornered weave (`wickerTexels`, a colour and a
//     normal map a tile) on its floor and runners, its top rolled in suede,
//     rope handles hanging off its sides;
//   * the RODS in their padded sleeves out of the corners up to the burner
//     FRAME, the double burner hung in it — two coils of stainless tube
//     browned by the heat, the jets inside them, the valve blocks and the
//     blast-valve handles under them — and the hoses down to the cylinders;
//   * the propane CYLINDERS in three corners in quilted covers, a valve and
//     its handwheel on each;
//   * and lashed to a long side through its handles, the skier's own pair
//     and his poles while he flies (`rack`).
//
// Each material is one merged draw; past `FAR` m a plain stand-in of the
// same size is drawn (`THREE.LOD`).

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BALLOON } from "@engine";

import { BASKET_LOOK, BURNER_LOOK, wickerTexels } from "./balloon-look.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";

const K = BALLOON.basket;
const B = BASKET_LOOK;
const F = BURNER_LOOK;

/** How far off the detailed basket is drawn, m — past it, the stand-in. */
const FAR = 110;

export type Basket = {
  /** The whole of it, in the basket's frame. */
  group: THREE.Object3D;
  /** The burner's two outlets, in the basket's frame — where a flame
   * leaves the coils. */
  outlets: readonly THREE.Vector3[];
  /** Paint the cylinders' covers and the sleeves in a colourway's deep
   * colour (sRGB). */
  paint(cover: number): void;
  /** The pair lashed to the wall: its length, m, and its topsheet's
   * body and trim (sRGB) — or hidden. */
  rack(on: boolean, length?: number, body?: number, trim?: number): void;
  dispose(): void;
};

/** THE BASKET'S PLAN: points round its rounded rectangle, `inset` m in
 * from the outside of its wall — each with its outward normal and its
 * distance round from the first, m. */
function plan(
  inset: number,
  perCorner = 5,
): { x: number; z: number; nx: number; nz: number; d: number }[] {
  const hx = K.width / 2 - B.corner;
  const hz = K.length / 2 - B.corner;
  const r = B.corner - inset;
  const out: { x: number; z: number; nx: number; nz: number; d: number }[] = [];
  const corners: [number, number, number][] = [
    [hx, hz, 0],
    [-hx, hz, Math.PI / 2],
    [-hx, -hz, Math.PI],
    [hx, -hz, (3 * Math.PI) / 2],
  ];
  let d = 0;
  let px = 0;
  let pz = 0;
  for (const [cx, cz, a0] of corners) {
    for (let k = 0; k <= perCorner; k++) {
      const a = a0 + (k / perCorner) * (Math.PI / 2);
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      const x = cx + nx * r;
      const z = cz + nz * r;
      if (out.length) d += Math.hypot(x - px, z - pz);
      out.push({ x, z, nx, nz, d });
      px = x;
      pz = z;
    }
  }
  // Closed: the first point again at the end, its distance the whole way.
  const f = out[0];
  out.push({ ...f, d: d + Math.hypot(f.x - px, f.z - pz) });
  return out;
}

/** A wall round the plan, `inset` m in, from `y0` to `y1`, facing out (or
 * in), its uv in weave tiles. */
function wall(inset: number, y0: number, y1: number, inward: boolean): THREE.BufferGeometry {
  const pts = plan(inset);
  const n = pts.length;
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const s = inward ? -1 : 1;
  for (const p of pts) {
    for (const y of [y0, y1]) {
      pos.push(p.x, y, p.z);
      nrm.push(p.nx * s, 0, p.nz * s);
      uv.push(p.d / B.tile, y / B.tile);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    if (inward) idx.push(a, b, c, b, d, c);
    else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A tube swept round the plan (the rim's roll). */
function rimRoll(): THREE.BufferGeometry {
  const pts = plan(B.thick / 2, 6).map((p) => new THREE.Vector3(p.x, K.wall, p.z));
  pts.pop();
  const curve = new THREE.CatmullRomCurve3(pts, true);
  return new THREE.TubeGeometry(curve, 96, B.rim, 8, true);
}

/** A cylinder from `a` to `b`, radius `r`. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, sides = 8): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, sides, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  g.applyQuaternion(q);
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** A coil of tube round a vertical axis at (x, z), from `y0` up. */
class Helix extends THREE.Curve<THREE.Vector3> {
  readonly cx: number;
  readonly cz: number;
  readonly y0: number;
  constructor(cx: number, cz: number, y0: number) {
    super();
    this.cx = cx;
    this.cz = cz;
    this.y0 = y0;
  }
  override getPoint(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    const a = t * F.coilTurns * Math.PI * 2;
    return out.set(
      this.cx + Math.cos(a) * F.coilR,
      this.y0 + t * F.coilHeight,
      this.cz + Math.sin(a) * F.coilR,
    );
  }
}

/** The weave's colour and normal maps (`wickerTexels`). */
function wickerMaps(): { map: THREE.DataTexture; normal: THREE.DataTexture } {
  const size = 128;
  const { colour, height } = wickerTexels(size);
  const map = new THREE.DataTexture(colour, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  const nrm = new Uint8Array(size * size * 4);
  const at = (i: number, j: number): number =>
    height[((j + size) % size) * size + ((i + size) % size)];
  const k = 2.2;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const dx = (at(i + 1, j) - at(i - 1, j)) * k;
      const dy = (at(i, j + 1) - at(i, j - 1)) * k;
      const l = Math.hypot(dx, dy, 1);
      const o = (j * size + i) * 4;
      nrm[o] = Math.round(((-dx / l) * 0.5 + 0.5) * 255);
      nrm[o + 1] = Math.round(((-dy / l) * 0.5 + 0.5) * 255);
      nrm[o + 2] = Math.round(((1 / l) * 0.5 + 0.5) * 255);
      nrm[o + 3] = 255;
    }
  }
  const normal = new THREE.DataTexture(nrm, size, size, THREE.RGBAFormat);
  for (const t of [map, normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 4;
    t.needsUpdate = true;
  }
  return { map, normal };
}

export function createBasket(haze: HazeUniforms): Basket {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const mat = (
    name: string,
    o: THREE.MeshStandardMaterialParameters,
  ): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(o), haze, name);
    mats.push(m);
    return m;
  };
  const maps = wickerMaps();
  const wicker = mat("balloon-wicker", {
    map: maps.map,
    normalMap: maps.normal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: 0.88,
  });
  const suede = mat("balloon-suede", { color: 0x4a2f1c, roughness: 0.95 });
  const sleeveMat = mat("balloon-sleeve", { color: 0x232a3a, roughness: 0.92 });
  const steel = mat("balloon-steel", { color: 0xc4c8cc, roughness: 0.3, metalness: 0.85 });
  const coilMat = mat("balloon-coil", { color: 0x8a7258, roughness: 0.45, metalness: 0.75 });
  const dark = mat("balloon-dark", { color: 0x1a1a1c, roughness: 0.7 });
  const floorMat = mat("balloon-floor", { color: 0x3b3430, roughness: 0.95 });
  const rope = mat("balloon-rope", { color: 0x9c8a66, roughness: 0.95 });
  const cover = mat("balloon-cover", { color: 0x1d2b53, roughness: 0.96 });
  const red = mat("balloon-red", { color: 0xb3221c, roughness: 0.5 });
  const skiBody = mat("balloon-ski", { color: 0xd5361f, roughness: 0.4 });
  const skiTrim = mat("balloon-ski-trim", { color: 0xf2f2f2, roughness: 0.4 });

  /** Geometries gathered a material at a time, merged at the end. */
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (m: THREE.Material, g: THREE.BufferGeometry): void => {
    const list = parts.get(m) ?? [];
    list.push(g);
    parts.set(m, list);
  };

  // ── THE WICKER ──────────────────────────────────────────────────────
  add(wicker, wall(0, 0, K.wall, false));
  add(wicker, wall(B.thick, 0.03, K.wall, true));
  // The floor inside, a mat over the plywood; the floor's underside and
  // its two ash runners.
  const floor = new THREE.BoxGeometry(K.width - 2 * B.thick, 0.03, K.length - 2 * B.thick);
  floor.translate(0, 0.015, 0);
  add(floorMat, floor);
  const under = new THREE.BoxGeometry(K.width - 0.04, 0.03, K.length - 0.04);
  under.translate(0, -0.005, 0);
  add(dark, under);
  for (const sx of [-1, 1]) {
    const run = new THREE.BoxGeometry(0.07, B.runner, K.length - 0.1);
    run.translate(sx * (K.width / 2 - 0.2), -B.runner / 2 - 0.02, 0);
    add(suede, run);
  }
  add(suede, rimRoll());
  // A suede band round the wall's foot.
  const foot = wall(-0.004, 0, 0.08, false);
  add(suede, foot);

  // ── THE ROPE HANDLES ────────────────────────────────────────────────
  const handle = (x: number, z: number, along: number): void => {
    const g = new THREE.TorusGeometry(B.handleR, B.handleRope, 6, 12, Math.PI);
    g.rotateZ(Math.PI);
    g.rotateY(along);
    g.translate(x, B.handleY, z);
    add(rope, g);
  };
  for (const sx of [-1, 1]) {
    for (let k = 0; k < B.handlesLong; k++) {
      const z = ((k + 0.5) / B.handlesLong - 0.5) * (K.length - 0.5);
      handle(sx * (K.width / 2 + 0.012), z, Math.PI / 2);
    }
  }
  for (const sz of [-1, 1]) {
    for (let k = 0; k < B.handlesShort; k++) handle(0, sz * (K.length / 2 + 0.012), 0);
  }

  // ── THE RODS, THE FRAME AND THE BURNER ──────────────────────────────
  const h = F.frameHalf;
  const frameCorners = [
    new THREE.Vector3(h, F.frameY, h),
    new THREE.Vector3(-h, F.frameY, h),
    new THREE.Vector3(-h, F.frameY, -h),
    new THREE.Vector3(h, F.frameY, -h),
  ];
  for (const c of frameCorners) {
    const sx = Math.sign(c.x);
    const sz = Math.sign(c.z);
    // Out of the basket's corner, inside its wall, up to the frame's.
    const foot = new THREE.Vector3(
      sx * (K.width / 2 - 0.09),
      K.wall - 0.3,
      sz * (K.length / 2 - 0.09),
    );
    const top = c.clone().add(new THREE.Vector3(0, -0.06, 0));
    add(sleeveMat, rod(foot, foot.clone().lerp(top, 0.82), F.sleeve, 10));
    add(steel, rod(foot.clone().lerp(top, 0.8), top, F.sleeve * 0.45, 8));
    // The frame's corner block and the karabiners the wires clip to.
    const block = new THREE.BoxGeometry(0.07, 0.08, 0.07);
    block.translate(c.x, c.y, c.z);
    add(steel, block);
  }
  for (let i = 0; i < 4; i++) {
    add(steel, rod(frameCorners[i], frameCorners[(i + 1) % 4], F.frameTube, 8));
  }
  // The gimbal's cross-bar along the frame, the burner hung off it.
  add(
    steel,
    rod(new THREE.Vector3(0, F.frameY, -h), new THREE.Vector3(0, F.frameY, h), F.frameTube, 8),
  );
  const coilFoot = F.outlet - F.coilHeight;
  const outlets: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) {
    const cx = sx * F.coilX;
    add(coilMat, new THREE.TubeGeometry(new Helix(cx, 0, coilFoot), 120, F.coilTube, 6, false));
    // The jet inside the coil, the can round its top.
    const jet = new THREE.CylinderGeometry(0.035, 0.045, F.coilHeight, 10);
    jet.translate(cx, coilFoot + F.coilHeight / 2, 0);
    add(dark, jet);
    const can = new THREE.CylinderGeometry(F.coilR + 0.02, F.coilR + 0.02, 0.05, 20, 1, true);
    can.translate(cx, F.outlet - 0.01, 0);
    add(steel, can);
    // The valve block under the coil and its blast-valve handle, out to
    // the side and down where the pilot's hand finds it.
    const block = new THREE.BoxGeometry(0.15, 0.1, 0.13);
    block.translate(cx, coilFoot - 0.06, 0);
    add(steel, block);
    const grip0 = new THREE.Vector3(cx + sx * 0.08, coilFoot - 0.08, 0.04);
    const grip1 = new THREE.Vector3(cx + sx * 0.3, coilFoot - 0.2, 0.1);
    add(steel, rod(grip0, grip1, 0.01, 6));
    add(red, rod(grip1, grip1.clone().add(new THREE.Vector3(sx * 0.1, -0.04, 0.02)), 0.016, 8));
    outlets.push(new THREE.Vector3(cx, F.outlet, 0));
  }

  // ── THE CYLINDERS AND THEIR HOSES ───────────────────────────────────
  const quilt: THREE.Vector2[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * B.cylH;
    const puff = 1 + 0.035 * Math.abs(Math.sin((y / B.cylH) * Math.PI * 6));
    const shoulder = y > B.cylH - 0.08 ? Math.sqrt(1 - ((y - (B.cylH - 0.08)) / 0.08) ** 2) : 1;
    quilt.push(new THREE.Vector2(Math.max(0.06, B.cylR * puff * shoulder), y));
  }
  quilt.unshift(new THREE.Vector2(0.001, 0));
  quilt.push(new THREE.Vector2(0.001, B.cylH));
  for (const [sx, sz] of B.cylinders) {
    const x = sx * (K.width / 2 - B.cylIn);
    const z = sz * (K.length / 2 - B.cylIn);
    const body = new THREE.LatheGeometry(quilt, 16);
    body.translate(x, 0.03, z);
    add(cover, body);
    const collar = new THREE.CylinderGeometry(0.075, 0.075, 0.1, 12, 1, true);
    collar.translate(x, B.cylH + 0.08, z);
    add(steel, collar);
    const wheel = new THREE.TorusGeometry(0.035, 0.008, 5, 12);
    wheel.rotateX(Math.PI / 2);
    wheel.translate(x, B.cylH + 0.11, z);
    add(red, wheel);
    // The hose up to the burner's block over the basket's middle.
    const a = new THREE.Vector3(x, B.cylH + 0.1, z);
    const end = new THREE.Vector3(Math.sign(sx) * F.coilX, coilFoot - 0.1, 0);
    const mid = new THREE.Vector3(x * 0.55, (a.y + end.y) / 2 + 0.25, z * 0.4);
    const hose = new THREE.QuadraticBezierCurve3(a, mid, end);
    add(dark, new THREE.TubeGeometry(hose, 24, 0.012, 6, false));
  }

  // Merge each material's parts into one draw.
  const detail = new THREE.Group();
  detail.name = "balloon-basket";
  for (const [m, list] of parts) {
    const merged = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    if (!merged) continue;
    geos.push(merged);
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    detail.add(mesh);
  }

  // THE PAIR LASHED to the outside of the wall on the rack's side, through
  // its rope handles: the two skis on their edges against the wicker, the
  // poles beside them (inside, three cylinders and a pilot leave no room).
  const racked = new THREE.Group();
  racked.name = "balloon-stowed-skis";
  const skiGeo = new THREE.BoxGeometry(0.016, 1, 0.085);
  skiGeo.translate(0, 0.5, 0);
  const stripeGeo = new THREE.BoxGeometry(0.017, 1, 0.03);
  stripeGeo.translate(0, 0.5, 0);
  geos.push(skiGeo, stripeGeo);
  const rackX = B.rack[0] * (K.width / 2 + 0.02);
  for (const k of [0, 1]) {
    const one = new THREE.Group();
    one.add(new THREE.Mesh(skiGeo, skiBody), new THREE.Mesh(stripeGeo, skiTrim));
    one.position.set(rackX + B.rack[0] * k * 0.02, B.handleY - 0.02 + k * 0.012, 0);
    one.rotation.x = Math.PI / 2 - 0.03;
    racked.add(one);
  }
  const poleGeo = new THREE.CylinderGeometry(0.009, 0.009, 1.2, 6);
  poleGeo.translate(0, 0.6, 0);
  geos.push(poleGeo);
  for (const k of [0, 1]) {
    const pole = new THREE.Mesh(poleGeo, steel);
    pole.position.set(rackX + B.rack[0] * (0.05 + k * 0.012), B.handleY + 0.1, -0.6);
    pole.rotation.x = Math.PI / 2 + 0.02;
    racked.add(pole);
  }
  racked.visible = false;
  detail.add(racked);

  // THE STAND-IN far off: the basket a box, the frame and its rods.
  const far = new THREE.Group();
  const box = new THREE.BoxGeometry(K.width, K.wall, K.length);
  box.translate(0, K.wall / 2, 0);
  geos.push(box);
  far.add(new THREE.Mesh(box, wicker));
  const farRods: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const c = frameCorners[i];
    farRods.push(
      rod(new THREE.Vector3(Math.sign(c.x) * 0.6, K.wall, Math.sign(c.z) * 0.8), c, 0.04, 4),
    );
    farRods.push(rod(c, frameCorners[(i + 1) % 4], 0.03, 4));
  }
  const farGeo = mergeGeometries(farRods, false)!;
  for (const g of farRods) g.dispose();
  geos.push(farGeo);
  far.add(new THREE.Mesh(farGeo, steel));

  const lod = new THREE.LOD();
  lod.name = "balloon-basket-lod";
  lod.addLevel(detail, 0);
  lod.addLevel(far, FAR);

  return {
    group: lod,
    outlets,
    paint(c) {
      cover.color.setHex(c);
      sleeveMat.color.setHex(c).multiplyScalar(0.7);
    },
    rack(on, length = 1.7, body = 0xd5361f, trim = 0xf2f2f2) {
      racked.visible = on;
      if (!on) return;
      for (const one of racked.children.slice(0, 2)) {
        one.scale.set(1, length, 1);
        one.position.z = -length / 2;
      }
      skiBody.color.setHex(body);
      skiTrim.color.setHex(trim);
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      maps.map.dispose();
      maps.normal.dispose();
    },
  };
}
