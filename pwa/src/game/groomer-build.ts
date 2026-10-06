// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINE BUILT IN CODE — the stand-in `groomer-view.ts` draws
// when the build is switched back from the Blender model
// (`VITE_MODEL_GROOMER=0`, `model-switch.ts`) or the model fails to load:
// the same machine at the same size, cruder, off `GROOMER`'s measures and
// the class's layout (`groomer-look.ts`) — two rubber belts over their road
// wheels, the hull, the cab with glass all round, the engine's housing and
// the deck behind it, the twelve-way blade on its push frame, the tiller on
// its hitch with its hood and its comb, the lamps' housings and lenses
// where the model has them, and the beacon's dome.
//
// It hands back the same parts the model's nodes are (`GroomerBody`), so
// the view poses either alike: the blade turned about its hinge, the tiller
// about its hitch, the heap shown while it works, the beacon's reflector
// turned, the belts run.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GROOMER } from "@engine";

import { GROOMER_LOOK, type GroomerLamp } from "./groomer-look.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";

const K = GROOMER;
const LOOK = GROOMER_LOOK;
const BELT = LOOK.belt;

/** THE PARTS A DRAWN MACHINE IS POSED BY — the model's nodes or the code's
 * groups, in the machine's frame (`groomer-look.ts`). */
export type GroomerBody = {
  /** Everything, hung in the view's group. */
  root: THREE.Object3D;
  /** The blade and its push frame, its origin the hinge. */
  blade: THREE.Object3D | null;
  /** The tiller, its origin the hitch. */
  tiller: THREE.Object3D | null;
  /** The snow rolling ahead of the blade. */
  heap: THREE.Object3D | null;
  /** The beacon's reflector, its origin the beacon's middle. */
  beacon: THREE.Object3D | null;
  /** Run the belts `metres` round from where they were built. */
  run(metres: number): void;
};

/** The paint the code's machine is drawn in, shared by every machine on
 * the map — and the lamps' lens, glass, beacon and tail materials the view
 * lights by the dark, which the model's own (by name) stand in for. */
export type GroomerPaint = ReturnType<typeof groomerPaint>;

export function groomerPaint(haze: HazeUniforms) {
  const mats: THREE.Material[] = [];
  const paint = (params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(params), haze, "groomer");
    mats.push(m);
    return m;
  };
  return {
    red: paint({ color: 0xd0141c, roughness: 0.38, metalness: 0.25 }),
    rubber: paint({ color: 0x18191b, roughness: 0.92 }),
    steel: paint({ color: 0x9aa1a8, roughness: 0.35, metalness: 0.8 }),
    dark: paint({ color: 0x2c2f33, roughness: 0.6, metalness: 0.4 }),
    black: paint({ color: 0x0c0c0d, roughness: 0.55 }),
    glass: paint({
      color: 0x2a3a44,
      roughness: 0.12,
      metalness: 0.1,
      emissive: 0xffb062,
      emissiveIntensity: 0,
    }),
    lamp: paint({ color: 0xf4f8ff, roughness: 0.1, emissive: 0xe8f0ff, emissiveIntensity: 0.5 }),
    amber: paint({
      color: 0xff9a1a,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
      emissive: 0xff7a00,
      emissiveIntensity: 0.6,
    }),
    tail: paint({ color: 0x8a0005, roughness: 0.3, emissive: 0xff1010, emissiveIntensity: 0.4 }),
    orange: paint({ color: 0xff5a10, roughness: 0.6, side: THREE.DoubleSide }),
    snow: paint({ color: 0xeef3f9, roughness: 0.95 }),
    dispose(): void {
      for (const m of mats) m.dispose();
    },
  };
}

/** A belt's side profile, (z, y), round its idler and sprocket — the
 * outline, and the same inset by the belt's thickness. */
function beltOutline(inset: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const arc = (cz: number, cy: number, r: number, a0: number, a1: number) => {
    for (let i = 0; i <= 10; i++) {
      const a = a0 + ((a1 - a0) * i) / 10;
      pts.push(new THREE.Vector2(cz + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  const I = BELT.idler;
  const S = BELT.sprocket;
  const t = BELT.rubber;
  arc(I.z, I.y, I.r + t - inset, -Math.PI / 2, Math.PI / 2);
  arc(S.z, S.y, S.r + t - inset, Math.PI / 2, (3 * Math.PI) / 2);
  return pts;
}

/** THE CODE'S MACHINE: built once per view, its geometry its own. */
export function buildGroomer(paint: GroomerPaint): GroomerBody & { dispose(): void } {
  const geometries: THREE.BufferGeometry[] = [];
  const keep = <G extends THREE.BufferGeometry>(g: G): G => {
    geometries.push(g);
    return g;
  };
  const root = new THREE.Group();
  root.name = "piste-machine-code";
  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = root) => {
    const mesh = new THREE.Mesh(keep(g), m);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
    new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const lump = (
    pieces: THREE.BufferGeometry[],
    m: THREE.Material,
    parent: THREE.Object3D = root,
  ) => {
    const merged = mergeGeometries(
      pieces.map((p) => (p.index ? p.toNonIndexed() : p)),
      false,
    )!;
    for (const p of pieces) p.dispose();
    return add(merged, m, parent);
  };
  const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, sides = 8) => {
    const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), sides);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        b.clone().sub(a).normalize(),
      ),
    );
    const m = a.clone().add(b).multiplyScalar(0.5);
    return g.translate(m.x, m.y, m.z);
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // ── THE BELTS, their cleats in two runs that slide with the speed.
  const belts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape(beltOutline(0));
    shape.holes.push(new THREE.Path(beltOutline(BELT.rubber * 2.5).reverse()));
    const g = new THREE.ExtrudeGeometry(shape, { depth: BELT.width, bevelEnabled: false });
    g.rotateY(-Math.PI / 2);
    g.translate(side * BELT.x + BELT.width / 2, 0, 0);
    belts.push(g);
  }
  lump(belts, paint.rubber);
  const I = BELT.idler;
  const S = BELT.sprocket;
  const pitch = BELT.pitch;
  const topFront = I.y + I.r + BELT.rubber;
  const topBack = S.y + S.r + BELT.rubber;
  const cleatRun = (y0: number, y1: number): THREE.Group => {
    const pieces: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      for (let z = S.z; z <= I.z; z += pitch) {
        const y = y0 + ((y1 - y0) * (z - S.z)) / (I.z - S.z);
        pieces.push(box(BELT.width * 0.98, 0.05, 0.05, side * BELT.x, y, z));
      }
    }
    const holder = new THREE.Group();
    root.add(holder);
    lump(pieces, paint.steel, holder);
    return holder;
  };
  const bottom = cleatRun(0.02, 0.02);
  const top = cleatRun(topBack + 0.02, topFront + 0.02);
  const W = BELT.wheels;
  const wheels: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    for (const z of W.z) {
      wheels.push(
        new THREE.CylinderGeometry(W.r, W.r, BELT.width * 0.86, 16)
          .rotateZ(Math.PI / 2)
          .translate(side * BELT.x, W.y, z),
      );
    }
    for (const c of [I, S]) {
      wheels.push(
        new THREE.CylinderGeometry(c.r, c.r, BELT.width * 0.8, 16)
          .rotateZ(Math.PI / 2)
          .translate(side * BELT.x, c.y, c.z),
      );
    }
  }
  lump(wheels, paint.dark);

  // ── THE HULL, THE HOOD AND THE DECK.
  const H = LOOK.hull;
  const HD = LOOK.hood;
  const D = LOOK.deck;
  lump(
    [
      box(H.keel * 2, H.top - H.belly, H.front - H.back, 0, (H.top + H.belly) / 2, 0),
      box(2 * H.half, H.plate - H.top, H.front - H.back - 0.1, 0, (H.plate + H.top) / 2, 0),
      box(
        2 * HD.half,
        HD.crown - H.plate,
        HD.front - HD.back,
        0,
        (HD.crown + H.plate) / 2,
        (HD.front + HD.back) / 2,
      ),
      box(
        2 * H.half - 0.3,
        D.floor - H.plate,
        D.front - D.back,
        0,
        (D.floor + H.plate) / 2,
        (D.front + D.back) / 2,
      ),
    ],
    paint.red,
  );

  // ── THE CAB: a red lower body, glass above it, black pillars and roof.
  const C = LOOK.cab;
  lump(
    [
      box(
        C.half * 2,
        C.sill.front - C.floor,
        C.screen.foot - C.back,
        0,
        (C.sill.front + C.floor) / 2,
        (C.screen.foot + C.back) / 2,
      ),
    ],
    paint.red,
  );
  {
    const s = new THREE.Shape([
      new THREE.Vector2(C.back, C.sill.back),
      new THREE.Vector2(C.screen.foot, C.sill.front),
      new THREE.Vector2(C.screen.head, C.roof - 0.08),
      new THREE.Vector2(C.back, C.roof - 0.08),
    ]);
    const g = new THREE.ExtrudeGeometry(s, { depth: C.half * 2 - 0.04, bevelEnabled: false });
    g.rotateY(-Math.PI / 2);
    g.translate(C.half - 0.02, 0, 0);
    add(g, paint.glass);
  }
  const frame: THREE.BufferGeometry[] = [
    box(
      C.half * 2 + 0.04,
      0.1,
      C.screen.head + C.lip - C.back + 0.06,
      0,
      C.roof - 0.05,
      (C.screen.head + C.lip + C.back) / 2,
    ),
  ];
  for (const sx of [-1, 1]) {
    frame.push(
      rod(
        v(sx * C.half, C.sill.front, C.screen.foot),
        v(sx * C.half, C.roof - 0.08, C.screen.head),
        0.05,
        6,
      ),
    );
    frame.push(
      rod(v(sx * C.half, C.sill.back, C.back), v(sx * C.half, C.roof - 0.08, C.back), 0.05, 6),
    );
  }
  lump(frame, paint.black);

  // ── THE LAMPS' housings and lenses, where the model has them.
  const housings: THREE.BufferGeometry[] = [];
  const lenses: THREE.BufferGeometry[] = [];
  const lampOn = (l: GroomerLamp, at: THREE.Vector3) => {
    const out = l.face === "front" ? 1 : l.face === "rear" ? -1 : 0;
    const side = l.face === "side" ? Math.sign(l.x) : 0;
    const x = l.x - at.x;
    const y = l.y - at.y;
    const z = l.z - at.z;
    const along = side !== 0;
    housings.push(
      box(
        along ? 0.1 : l.w + 0.04,
        l.h + 0.04,
        along ? l.w + 0.04 : 0.1,
        x - side * 0.05,
        y,
        z - out * 0.05,
      ),
    );
    lenses.push(
      box(along ? 0.02 : l.w, l.h, along ? l.w : 0.02, x + side * 0.01, y, z + out * 0.01),
    );
  };
  const BL = LOOK.blade;
  const T = LOOK.tiller;
  const hinge = v(0, BL.hinge.y, BL.hinge.z);
  const hitch = v(0, T.hitch.y, T.hitch.z);
  const origin = v(0, 0, 0);
  for (const l of LOOK.lamps) if (l.bar !== "blade" && l.bar !== "tiller") lampOn(l, origin);
  lump(housings.splice(0), paint.black);
  lump(lenses.splice(0), paint.lamp).castShadow = false;
  lump(
    [
      box(0.26, 0.12, 0.05, -LOOK.tail.x, LOOK.tail.y, LOOK.tail.z),
      box(0.26, 0.12, 0.05, LOOK.tail.x, LOOK.tail.y, LOOK.tail.z),
    ],
    paint.tail,
  );

  // ── THE BEACON's dome, and its reflector turning in it.
  const B = LOOK.beacon;
  add(
    new THREE.SphereGeometry(0.1, 12, 8).scale(1, 1.3, 1).translate(B.x, B.y - 0.02, B.z),
    paint.amber,
  ).castShadow = false;
  const beacon = new THREE.Group();
  beacon.position.set(B.x, B.y, B.z);
  root.add(beacon);
  add(new THREE.BoxGeometry(0.11, 0.1, 0.012), paint.steel, beacon).castShadow = false;

  // ── THE BLADE on its push frame, about its hinge.
  const blade = new THREE.Group();
  blade.position.copy(hinge);
  root.add(blade);
  const wing = (K.blade.width - BL.middle) / 2 / Math.cos(BL.wing);
  const mid = BL.face - wing * Math.sin(BL.wing);
  const bladePieces: THREE.BufferGeometry[] = [
    box(BL.middle, BL.height, 0.3, 0, BL.height / 2, mid - 0.15),
  ];
  for (const sx of [-1, 1]) {
    bladePieces.push(
      box(wing, BL.height, 0.3, 0, BL.height / 2, 0)
        .translate((sx * wing) / 2, 0, -0.15)
        .rotateY(-sx * BL.wing)
        .translate((sx * BL.middle) / 2, 0, mid),
    );
  }
  bladePieces.push(
    rod(v(-0.34, BL.hinge.y, BL.hinge.z), v(-1.05, 0.48, mid - 0.5), 0.1),
    rod(v(0.34, BL.hinge.y, BL.hinge.z), v(1.05, 0.48, mid - 0.5), 0.1),
  );
  for (const p of bladePieces) p.translate(-hinge.x, -hinge.y, -hinge.z);
  lump(bladePieces, paint.dark, blade);
  for (const l of LOOK.lamps) if (l.bar === "blade") lampOn(l, hinge);
  lump(housings.splice(0), paint.black, blade);
  lump(lenses.splice(0), paint.lamp, blade).castShadow = false;

  // THE HEAP rolling ahead of the blade.
  const heapPieces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 22; i++) {
    const x = -K.blade.width / 2 + (i / 21) * K.blade.width;
    const r = 0.26 + 0.12 * Math.sin(i * 2.3) ** 2;
    heapPieces.push(
      new THREE.IcosahedronGeometry(r, 1)
        .scale(1.3, 0.75, 1)
        .translate(x, r * 0.45, mid + 0.25 + Math.max(0, Math.abs(x) - BL.middle / 2) * 0.4),
    );
  }
  const heap = lump(heapPieces, paint.snow);
  heap.castShadow = false;

  // ── THE TILLER about its hitch: its arms, its hood, its comb, its flags.
  const tiller = new THREE.Group();
  tiller.position.copy(hitch);
  root.add(tiller);
  const dr = T.drum;
  const tp: THREE.BufferGeometry[] = [
    rod(v(-0.55, T.hitch.y, T.hitch.z), v(-0.62, dr.y + 0.42, dr.z + 0.35), 0.09),
    rod(v(0.55, T.hitch.y, T.hitch.z), v(0.62, dr.y + 0.42, dr.z + 0.35), 0.09),
  ];
  const hood = new THREE.CylinderGeometry(T.hood.r, T.hood.r, dr.width, 16, 1, false, 0, Math.PI)
    .rotateZ(Math.PI / 2)
    .translate(0, dr.y, dr.z);
  const comb = box(T.mat.width, 0.04, T.mat.from - T.mat.to, 0, 0.03, (T.mat.from + T.mat.to) / 2);
  for (const p of [...tp, hood, comb]) p.translate(-hitch.x, -hitch.y, -hitch.z);
  lump(tp, paint.dark, tiller);
  add(hood, paint.red, tiller);
  add(comb, paint.rubber, tiller);
  for (const l of LOOK.lamps) if (l.bar === "tiller") lampOn(l, hitch);
  lump(housings.splice(0), paint.black, tiller);
  lump(lenses.splice(0), paint.lamp, tiller).castShadow = false;

  return {
    root,
    blade,
    tiller,
    heap,
    beacon,
    run(metres) {
      // The ground run still on the snow as the machine moves over it, the
      // top run carried forward.
      const p = ((metres % pitch) + pitch) % pitch;
      bottom.position.z = -p;
      top.position.z = p;
    },
    dispose() {
      for (const g of geometries) g.dispose();
    },
  };
}
