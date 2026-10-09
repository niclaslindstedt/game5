// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S COCKPIT AS DRAWN — what the COCKPIT lens (`camera-heli.ts`'s
// HELMET rung) sees from the pilot's seat, laid out by `cockpit-plan.ts` and
// painted by `cockpit-paint.ts`:
//
//   * THE CABIN'S INSIDE is the Blender model's own skin turned inside out:
//     its opaque panels copied a couple of centimetres in and drawn from
//     behind in the trim of a cabin — the floor's mat, the walls, the
//     headliner — so every window is exactly where the outside has it, its
//     frame the skin round it; the glass drawn as thin, clear glass from
//     in here (the outside's dark, opaque glass put away while the eye is
//     inside); a wall at the back of the cabin behind the rear bench;
//   * THE PANEL, the glareshield over it, the pedestal and the floor
//     console, the overhead console and its two levers, the wet compass;
//   * THE SEATS: the pilot's and the guide's in front, the bench behind,
//     the guide's harness lying on his;
//   * THE CONTROLS, MOVING with the machine's own (`HeliState.controls`):
//     the cyclic swung fore and aft and across, the collective raised, the
//     pedals pushed — and THE PILOT'S hands on them, his arms and legs
//     solved to them, in a flight suit and gloves.
//
// Built once, when the model arrives, as a child of the machine — so it
// moves with the drawing exactly — and shown only while the eye is in the
// cabin. Presentation only: it reads `GameState.heli` and writes nothing.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HELI, type HeliState, type Level } from "@engine";

import {
  COCKPIT,
  collectiveGrip,
  controlPose,
  cyclicGrip,
  gaugesOf,
  joint,
} from "./cockpit-plan.ts";
import {
  OVERHEAD_H,
  OVERHEAD_W,
  PANEL_H,
  PANEL_W,
  PEDESTAL_H,
  PEDESTAL_W,
  paintOverhead,
  paintPanelBack,
  paintPanelLive,
  paintPedestal,
} from "./cockpit-paint.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";

/** How often the panel's faces are painted again, Hz. */
const PAINT_HZ = 20;
/** How far the skin's copy stands in from it, m. */
const LINER_IN = 0.022;

export type Cockpit = {
  group: THREE.Group;
  /** Whether the eye is in the cabin (the cockpit shown, the outside's
   * glass put away), and whether it is the pilot's own (his head left
   * out). */
  show(inside: boolean, pilotEye: boolean): void;
  /** The controls, the hands and the panel's faces to the machine as it
   * stands. */
  update(h: HeliState, level: Level, t: number, dt: number): void;
  dispose(): void;
};

type V3 = { x: number; y: number; z: number };

const up = new THREE.Vector3(0, 1, 0);

/** Each vertex colour of the cabin's inside, by which way the skin faces
 * there: the floor's mat, the walls' trim, the headliner. */
const FLOOR_MAT = new THREE.Color(0.12, 0.123, 0.13);
const WALL = new THREE.Color(0.34, 0.345, 0.355);
const LINER = new THREE.Color(0.56, 0.56, 0.54);

/** THE SKIN'S OPAQUE PANELS INSIDE THE CABIN, copied in from it, as one
 * geometry in the machine's frame (`toMachine` each mesh's own matrix into
 * it), and the glass's copy. */
function cabinOf(
  body: THREE.Object3D,
  toMachine: (m: THREE.Mesh) => THREE.Matrix4,
): { liner: THREE.BufferGeometry | null; glass: THREE.BufferGeometry | null } {
  const liner: number[] = [];
  const linerN: number[] = [];
  const linerC: number[] = [];
  const glass: number[] = [];
  const glassN: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tri: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const nor: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  body.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    const name = (o.material as THREE.Material).name;
    const isGlass = /^glass/i.test(name);
    if (!isGlass && !/^(trim|paint|stripe|dark)/i.test(name)) return;
    const geo = o.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute("position");
    const norm = geo.getAttribute("normal");
    if (!pos || !norm) return;
    const m = toMachine(o);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const index = geo.getIndex();
    const count = index ? index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      let cz = 0;
      let cy = 0;
      let cx = 0;
      for (let k = 0; k < 3; k++) {
        const v = index ? index.getX(i + k) : i + k;
        tri[k].fromBufferAttribute(pos, v).applyMatrix4(m);
        nor[k].fromBufferAttribute(norm, v).applyMatrix3(nm).normalize();
        cx += tri[k].x / 3;
        cy += tri[k].y / 3;
        cz += tri[k].z / 3;
      }
      if (cz < COCKPIT.bulkhead - 0.02 || cy > HELI.body.roof + 0.05 || Math.abs(cx) > 1.0) {
        continue;
      }
      for (let k = 0; k < 3; k++) {
        p.copy(tri[k]);
        n.copy(nor[k]);
        if (isGlass) {
          p.addScaledVector(n, -0.005);
          glass.push(p.x, p.y, p.z);
          glassN.push(n.x, n.y, n.z);
          continue;
        }
        p.addScaledVector(n, -LINER_IN);
        liner.push(p.x, p.y, p.z);
        linerN.push(n.x, n.y, n.z);
        const c = n.y < -0.55 ? FLOOR_MAT : n.y > 0.6 ? LINER : WALL;
        linerC.push(c.r, c.g, c.b);
      }
    }
  });
  const make = (v: number[], nv: number[], c?: number[]): THREE.BufferGeometry | null => {
    if (!v.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nv, 3));
    if (c) g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
    return g;
  };
  return { liner: make(liner, linerN, linerC), glass: make(glass, glassN) };
}

/** THE WALL AT THE BACK OF THE CABIN: the skin's section at the bulkhead
 * (its hull, drawn in a little), facing forward. */
function bulkheadOf(
  body: THREE.Object3D,
  toMachine: (m: THREE.Mesh) => THREE.Matrix4,
): THREE.BufferGeometry | null {
  const z0 = COCKPIT.bulkhead;
  const pts: [number, number][] = [];
  const p = new THREE.Vector3();
  body.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const name = (o.material as THREE.Material).name ?? "";
    if (!/^(trim|paint|stripe|dark)/i.test(name)) return;
    const pos = (o.geometry as THREE.BufferGeometry).getAttribute("position");
    const m = toMachine(o);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (Math.abs(p.z - z0) < 0.12 && p.y < HELI.body.roof + 0.02 && Math.abs(p.x) < 1.0)
        pts.push([p.x, p.y]);
    }
  });
  if (pts.length < 3) return null;
  // The convex hull (monotone chain).
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0)
      lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const q = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0)
      upper.pop();
    upper.push(q);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  let cx = 0;
  let cy = 0;
  for (const [x, y] of hull) {
    cx += x / hull.length;
    cy += y / hull.length;
  }
  const v: number[] = [];
  const shrink = (x: number, y: number): [number, number] => {
    const d = Math.hypot(x - cx, y - cy) || 1;
    const k = Math.max(0, d - LINER_IN * 1.5) / d;
    return [cx + (x - cx) * k, cy + (y - cy) * k];
  };
  for (let i = 0; i < hull.length; i++) {
    const a = shrink(...hull[i]);
    const b = shrink(...hull[(i + 1) % hull.length]);
    v.push(cx, cy, z0, b[0], b[1], z0, a[0], a[1], z0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  // Facing forward, whichever way round the hull ran.
  const nz = g.getAttribute("normal").getZ(0);
  if (nz < 0) {
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i += 3) {
      const x = pos.getX(i + 1);
      const y = pos.getY(i + 1);
      pos.setXY(i + 1, pos.getX(i + 2), pos.getY(i + 2));
      pos.setXY(i + 2, x, y);
    }
    g.computeVertexNormals();
  }
  return g;
}

/** A box `w` × `h` × `d` m at (x, y, z), turned `rx` about x. */
function box(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return g;
}

/** A tube from `a` to `b`, radius `r0` at `a` and `r1` at `b`. */
function tube(a: V3, b: V3, r0: number, r1 = r0, seg = 10): THREE.BufferGeometry {
  const d = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

/** A quad with its corners in order and its uv over the whole of a
 * texture: `a` the bottom left, `b` the bottom right, `c` the top right. */
function quad(a: V3, b: V3, c: V3, d: V3): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z],
      3,
    ),
  );
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/** Many geometries, one mesh. */
function merged(list: THREE.BufferGeometry[], m: THREE.Material): THREE.Mesh {
  const parts = list.map((g) => {
    const plain = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(plain.attributes)) {
      if (k !== "position" && k !== "normal") plain.deleteAttribute(k);
    }
    return plain;
  });
  const geo = mergeGeometries(parts, false)!;
  const mesh = new THREE.Mesh(geo, m);
  mesh.receiveShadow = true;
  return mesh;
}

/** A canvas and the texture over it. */
function canvasTexture(
  w: number,
  h: number,
): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
} {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas, ctx, texture };
}

export function createCockpit(
  body: THREE.Object3D | null,
  toMachine: (m: THREE.Mesh) => THREE.Matrix4,
  haze: HazeUniforms,
): Cockpit {
  const C = COCKPIT;
  const group = new THREE.Group();
  group.name = "cockpit";
  // Everything laid out in the cockpit's own frame (`cockpit-plan.ts`: x to
  // the right as seen) under a mirror into the engine's body frame; the
  // cabin's inside, copied off the model, is in the body frame already.
  const room = new THREE.Group();
  room.scale.x = -1;
  group.add(room);
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const textures: THREE.Texture[] = [];
  const std = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, "heli");
    mats.push(m);
    return m;
  };
  const black = std({ color: 0x141517, roughness: 0.85 });
  const satin = std({ color: 0x2a2c30, roughness: 0.55, metalness: 0.35 });
  const steel = std({ color: 0x8d9096, roughness: 0.35, metalness: 0.8 });
  const rubber = std({ color: 0x0b0b0c, roughness: 0.75 });
  const fabric = std({ color: 0x3c4556, roughness: 0.95 });
  const strap = std({ color: 0x3b3f46, roughness: 0.8 });
  const suit = std({ color: 0x2f3a2c, roughness: 0.9 });
  const glove = std({ color: 0x17130f, roughness: 0.6 });
  const boot = std({ color: 0x1b1714, roughness: 0.7 });
  const helmet = std({ color: 0xd9dad5, roughness: 0.4 });
  const red = std({ color: 0xb0201a, roughness: 0.5 });
  const yellow = std({ color: 0xd8a518, roughness: 0.5 });

  // THE CABIN'S INSIDE off the model's skin; the glass from in here.
  const outsideGlass: THREE.Mesh[] = [];
  if (body) {
    body.traverse((o) => {
      if (o instanceof THREE.Mesh && /^glass/i.test((o.material as THREE.Material).name ?? ""))
        outsideGlass.push(o);
    });
    const cabin = cabinOf(body, toMachine);
    if (cabin.liner) {
      const m = std({ vertexColors: true, roughness: 0.92, side: THREE.BackSide });
      const mesh = new THREE.Mesh(cabin.liner, m);
      mesh.receiveShadow = true;
      group.add(mesh);
      geos.push(cabin.liner);
    }
    if (cabin.glass) {
      const m = hazeMaterial(
        new THREE.MeshStandardMaterial({
          color: 0x9fb6bf,
          roughness: 0.08,
          metalness: 0.4,
          transparent: true,
          opacity: 0.07,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
        haze,
        "heli",
      );
      mats.push(m);
      const mesh = new THREE.Mesh(cabin.glass, m);
      mesh.renderOrder = 4;
      group.add(mesh);
      geos.push(cabin.glass);
    }
    const wall = bulkheadOf(body, toMachine);
    if (wall) {
      const mesh = new THREE.Mesh(wall, std({ color: 0x33363b, roughness: 0.95 }));
      mesh.receiveShadow = true;
      group.add(mesh);
      geos.push(wall);
    }
  }

  // THE UPPER PANEL: its face, painted, leant back; its housing behind.
  const P = C.panel;
  const rise = P.top - P.bottom;
  const zTop = P.z + rise * Math.tan(P.lean);
  const panelCanvas = canvasTexture(PANEL_W, PANEL_H);
  const panelBack = document.createElement("canvas");
  panelBack.width = PANEL_W;
  panelBack.height = PANEL_H;
  paintPanelBack(panelBack.getContext("2d")!);
  panelCanvas.ctx.drawImage(panelBack, 0, 0);
  textures.push(panelCanvas.texture);
  const panelMat = std({
    map: panelCanvas.texture,
    emissiveMap: panelCanvas.texture,
    emissive: 0xffffff,
    emissiveIntensity: 0.32,
    roughness: 0.5,
  });
  const face = quad(
    { x: -P.half, y: P.bottom, z: P.z },
    { x: P.half, y: P.bottom, z: P.z },
    { x: P.half, y: P.top, z: zTop },
    { x: -P.half, y: P.top, z: zTop },
  );
  // Facing the pilot (−z): the quad as wound faces him already from
  // behind, so turn its winding over.
  face.setIndex([0, 2, 1, 0, 3, 2]);
  face.computeVertexNormals();
  const faceMesh = new THREE.Mesh(face, panelMat);
  faceMesh.receiveShadow = true;
  room.add(faceMesh);
  geos.push(face);

  const G = C.glare;
  const housing: THREE.BufferGeometry[] = [
    // The housing behind the face, down to the floor's curve in the nose.
    box(P.half * 2, rise + 0.02, 0.2, 0, (P.top + P.bottom) / 2, (P.z + zTop) / 2 + 0.11, P.lean),
    // The glareshield: its lip over the face and its top run forward and
    // down to the windscreen's foot.
    box(P.half * 2 + 0.02, G.lip, G.over + 0.02, 0, P.top + G.lip / 2, zTop - G.over / 2),
    quad(
      { x: P.half + 0.01, y: P.top + G.lip, z: zTop - G.over },
      { x: -P.half - 0.01, y: P.top + G.lip, z: zTop - G.over },
      { x: -P.half + 0.05, y: G.foot.y, z: G.foot.z },
      { x: P.half - 0.05, y: G.foot.y, z: G.foot.z },
    ),
  ];
  // THE PEDESTAL: its sloping radio face and its sides, then the floor
  // console on aft between the seats.
  const D = C.pedestal;
  const floor = HELI.body.floor;
  const pedCanvas = canvasTexture(PEDESTAL_W, PEDESTAL_H);
  paintPedestal(pedCanvas.ctx, false);
  textures.push(pedCanvas.texture);
  const pedMat = std({
    map: pedCanvas.texture,
    emissiveMap: pedCanvas.texture,
    emissive: 0xffffff,
    emissiveIntensity: 0.25,
    roughness: 0.55,
  });
  const pedFace = quad(
    { x: -D.half, y: D.knee, z: D.aft },
    { x: D.half, y: D.knee, z: D.aft },
    { x: D.half, y: P.bottom, z: P.z },
    { x: -D.half, y: P.bottom, z: P.z },
  );
  const pedMesh = new THREE.Mesh(pedFace, pedMat);
  pedMesh.position.y = 0.002;
  pedMesh.receiveShadow = true;
  room.add(pedMesh);
  geos.push(pedFace);
  for (const s of [-1, 1]) {
    housing.push(
      quad(
        { x: s * D.half, y: floor, z: D.aft },
        { x: s * D.half, y: floor, z: P.z + 0.15 },
        { x: s * D.half, y: P.bottom, z: P.z + 0.15 },
        { x: s * D.half, y: D.knee, z: D.aft },
      ),
    );
  }
  housing.push(
    box(D.half * 2, D.knee - floor, 0.02, 0, (D.knee + floor) / 2, D.aft),
    box(
      D.aftHalf * 2,
      D.knee - floor - 0.04,
      D.aft - D.end,
      0,
      (D.knee - 0.04 + floor) / 2,
      (D.aft + D.end) / 2,
    ),
  );
  // THE OVERHEAD CONSOLE.
  const O = C.overhead;
  const roof = HELI.body.roof;
  housing.push(
    box(
      O.half * 2,
      roof - O.y + 0.05,
      O.to - O.from,
      0,
      (roof + O.y) / 2 + 0.02,
      (O.to + O.from) / 2,
    ),
  );
  const overCanvas = canvasTexture(OVERHEAD_W, OVERHEAD_H);
  paintOverhead(overCanvas.ctx);
  textures.push(overCanvas.texture);
  const overFace = quad(
    { x: -O.half, y: O.y - 0.008, z: O.to },
    { x: O.half, y: O.y - 0.008, z: O.to },
    { x: O.half, y: O.y - 0.008, z: O.from },
    { x: -O.half, y: O.y - 0.008, z: O.from },
  );
  overFace.setIndex([0, 2, 1, 0, 3, 2]);
  overFace.computeVertexNormals();
  const overMesh = new THREE.Mesh(
    overFace,
    std({
      map: overCanvas.texture,
      roughness: 0.6,
      emissiveMap: overCanvas.texture,
      emissive: 0xffffff,
      emissiveIntensity: 0.12,
    }),
  );
  room.add(overMesh);
  geos.push(overFace);
  // The wet compass on the windscreen's centre strip, and the strip.
  housing.push(
    box(0.07, 0.06, 0.06, 0, C.compass.y, C.compass.z),
    box(0.012, 0.05, 0.05, 0, C.compass.y + 0.06, C.compass.z + 0.02),
  );
  room.add(merged(housing, black));
  const compassCard = new THREE.Mesh(
    box(0.05, 0.02, 0.005, 0, C.compass.y + 0.004, C.compass.z - 0.031),
    std({ color: 0xe8e6da, roughness: 0.5, emissive: 0x302e28 }),
  );
  room.add(compassCard);

  // THE TWO LEVERS off the overhead: the rotor brake (red) and the fuel
  // shut-off (yellow), hanging forward of it.
  {
    const leverY = O.y - 0.01;
    room.add(
      merged(
        [
          tube(
            { x: -0.07, y: leverY, z: O.to - 0.02 },
            { x: -0.07, y: leverY - 0.08, z: O.to + 0.03 },
            0.009,
          ),
        ],
        red,
      ),
      merged([box(0.026, 0.04, 0.026, -0.07, leverY - 0.09, O.to + 0.035)], red),
      merged(
        [
          tube(
            { x: 0.06, y: leverY, z: O.to - 0.02 },
            { x: 0.06, y: leverY - 0.07, z: O.to + 0.02 },
            0.008,
          ),
        ],
        yellow,
      ),
      merged([box(0.026, 0.035, 0.022, 0.06, leverY - 0.08, O.to + 0.025)], yellow),
    );
  }

  // THE SEATS: two bucket seats in front and the bench behind.
  const S = C.seat;
  const seatParts: THREE.BufferGeometry[] = [];
  const seatFrame: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const x = side * S.x;
    const depth = S.front - S.back;
    seatParts.push(box(S.width, 0.1, depth, x, S.top - 0.05, (S.front + S.back) / 2, -0.06));
    // The back, leant aft, and its headrest.
    const lean = S.lean;
    const mid = { y: S.top + S.tall / 2, z: S.back - Math.sin(lean) * (S.tall / 2) };
    seatParts.push(box(S.width, S.tall, 0.1, x, mid.y, mid.z - 0.04, -lean));
    seatParts.push(
      box(
        S.width * 0.55,
        0.16,
        0.08,
        x,
        S.top + S.tall + 0.06,
        S.back - Math.sin(lean) * (S.tall + 0.06) - 0.04,
        -lean,
      ),
    );
    // The bucket's side bolsters.
    for (const b of [-1, 1]) {
      seatParts.push(
        box(0.05, 0.08, depth, x + (b * S.width) / 2, S.top + 0.01, (S.front + S.back) / 2),
      );
    }
    // The frame and its legs to the floor.
    for (const fz of [S.back + 0.05, S.front - 0.06]) {
      for (const b of [-1, 1]) {
        seatFrame.push(
          tube(
            { x: x + b * (S.width / 2 - 0.05), y: floor, z: fz },
            { x: x + b * (S.width / 2 - 0.05), y: S.top - 0.1, z: fz },
            0.014,
          ),
        );
      }
    }
    seatFrame.push(box(S.width - 0.06, 0.03, 0.03, x, floor + 0.12, S.front - 0.06));
  }
  const B = C.bench;
  seatParts.push(
    box(1.56, 0.11, B.front - B.back, 0, B.top - 0.055, (B.front + B.back) / 2),
    box(1.56, 0.6, 0.1, 0, B.top + 0.3, B.back - 0.02, -0.12),
  );
  room.add(merged(seatParts, fabric), merged(seatFrame, steel));
  // The guide's harness lying on his seat, and the belts on the bench.
  {
    const x = -S.x;
    const straps: THREE.BufferGeometry[] = [];
    for (const b of [-1, 1]) {
      straps.push(box(0.045, 0.006, 0.5, x + b * 0.09, S.top + 0.004, S.back + 0.25, 0.06));
      straps.push(box(0.045, 0.45, 0.006, x + b * 0.09, S.top + 0.3, S.back - 0.06, -S.lean));
    }
    straps.push(box(0.06, 0.004, 0.32, x, S.top + 0.006, S.front - 0.2));
    for (const bx of [-0.55, 0, 0.55]) {
      straps.push(box(0.045, 0.006, 0.36, bx, B.top + 0.004, (B.front + B.back) / 2, 0));
    }
    room.add(merged(straps, strap));
    room.add(merged([box(0.07, 0.012, 0.06, x, S.top + 0.012, S.back + 0.3)], steel));
  }

  // THE CONTROLS. The cyclic: its boot, the stick, its grip and buttons.
  const Y = C.cyclic;
  const cyclic = new THREE.Group();
  cyclic.position.set(Y.x, Y.y, Y.z);
  const stickLow = { x: 0, y: 0, z: 0 };
  const stickBend = { x: 0, y: Y.length * 0.62, z: -0.035 };
  const stickTop = { x: 0, y: Y.length, z: 0 };
  cyclic.add(
    merged(
      [tube(stickLow, stickBend, 0.014, 0.012), tube(stickBend, stickTop, 0.012, 0.011)],
      satin,
    ),
    merged(
      [
        tube({ x: 0, y: -0.02, z: 0 }, { x: 0, y: 0.12, z: 0 }, 0.07, 0.02, 12),
        tube(
          { x: 0, y: Y.length, z: 0 },
          { x: 0, y: Y.length + Y.grip, z: 0.012 },
          0.019,
          0.022,
          12,
        ),
      ],
      rubber,
    ),
    merged(
      [
        box(0.05, 0.03, 0.04, 0, Y.length + Y.grip + 0.01, 0.018),
        box(0.012, 0.012, 0.012, 0.012, Y.length + Y.grip + 0.03, 0.03),
        box(0.012, 0.02, 0.012, -0.022, Y.length + Y.grip - 0.02, 0.03),
      ],
      satin,
    ),
    merged([box(0.01, 0.01, 0.01, -0.012, Y.length + Y.grip + 0.03, 0.03)], red),
  );
  room.add(cyclic);
  // The collective: the lever, the friction knob, the twist grip and the
  // switch box on its end, and its gaiter at the floor.
  const L = C.collective;
  const collective = new THREE.Group();
  collective.position.set(L.x, L.y, L.z);
  collective.add(
    merged(
      [
        tube({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: L.length - 0.14 }, 0.016),
        box(0.05, 0.05, 0.06, 0, 0, 0.0),
      ],
      satin,
    ),
    merged(
      [
        tube(
          { x: 0, y: 0, z: L.length - 0.15 },
          { x: 0, y: 0, z: L.length - 0.02 },
          0.022,
          0.022,
          12,
        ),
        tube({ x: 0.025, y: 0, z: 0.16 }, { x: 0.06, y: 0, z: 0.16 }, 0.018, 0.018, 10),
      ],
      rubber,
    ),
    merged([box(0.06, 0.05, 0.07, 0, 0.01, L.length + 0.02)], black),
    merged(
      [
        box(0.01, 0.012, 0.01, -0.015, 0.04, L.length + 0.03),
        box(0.01, 0.012, 0.01, 0.015, 0.04, L.length + 0.0),
      ],
      yellow,
    ),
  );
  room.add(collective);
  room.add(merged([box(0.08, 0.04, 0.16, L.x, floor + 0.12, L.z + 0.02)], rubber));
  // The pedals: each its arm off a pivot under the panel and its plate.
  const E = C.pedals;
  const pedals: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(E.x + side * E.gap, E.y, E.z);
    g.add(
      merged([box(0.1, 0.17, 0.015, 0, 0.06, 0, -0.35)], rubber),
      merged(
        [
          box(0.112, 0.012, 0.02, 0, 0.145, 0.03, -0.35),
          box(0.112, 0.012, 0.02, 0, -0.02, -0.03, -0.35),
          tube({ x: 0, y: 0.12, z: 0.03 }, { x: 0, y: 0.34, z: 0.12 }, 0.011),
        ],
        steel,
      ),
    );
    room.add(g);
    pedals.push(g);
  }

  // THE PILOT: limbs as tapered tubes between his joints, rebuilt off the
  // hands' and feet's places each frame; a torso and a helmeted head for
  // any eye but his own.
  const Pi = C.pilot;
  const limb = (m: THREE.Material, r0: number, r1: number): THREE.Mesh => {
    const g = new THREE.CylinderGeometry(r1, r0, 1, 10);
    g.translate(0, 0.5, 0);
    geos.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    room.add(mesh);
    return mesh;
  };
  const ball = (m: THREE.Material, r: number): THREE.Mesh => {
    const g = new THREE.SphereGeometry(r, 12, 8);
    geos.push(g);
    const mesh = new THREE.Mesh(g, m);
    room.add(mesh);
    return mesh;
  };
  const arms = [0, 1].map(() => ({
    upper: limb(suit, 0.05, 0.045),
    fore: limb(suit, 0.044, 0.036),
    elbow: ball(suit, 0.045),
    hand: ball(glove, 0.042),
    cuff: limb(glove, 0.04, 0.038),
  }));
  const legs = [0, 1].map(() => ({
    thigh: limb(suit, 0.075, 0.062),
    shin: limb(suit, 0.058, 0.05),
    knee: ball(suit, 0.062),
    boot: (() => {
      const g = new THREE.BoxGeometry(0.1, 0.11, 0.27);
      g.translate(0, 0, 0.07);
      geos.push(g);
      const mesh = new THREE.Mesh(g, boot);
      room.add(mesh);
      return mesh;
    })(),
  }));
  const torso = new THREE.Mesh(
    (() => {
      const g = new THREE.CapsuleGeometry(0.17, 0.3, 6, 12);
      g.scale(1.15, 1, 0.75);
      geos.push(g);
      return g;
    })(),
    suit,
  );
  torso.position.set(S.x, Pi.hip.y + 0.27, Pi.shoulder.z - 0.04);
  torso.rotation.x = -0.12;
  const head = new THREE.Mesh(
    (() => {
      const g = new THREE.SphereGeometry(0.135, 16, 12);
      g.scale(0.95, 1.05, 1.1);
      geos.push(g);
      return g;
    })(),
    helmet,
  );
  head.position.set(C.eye.x, C.eye.y + 0.04, C.eye.z - 0.1);
  room.add(torso, head);

  const a = new THREE.Vector3();
  const dir = new THREE.Vector3();
  /** Lay a tube mesh from `p` to `q`. */
  const lay = (mesh: THREE.Mesh, p: V3, q: V3): void => {
    dir.set(q.x - p.x, q.y - p.y, q.z - p.z);
    const len = dir.length();
    mesh.position.set(p.x, p.y, p.z);
    mesh.quaternion.setFromUnitVectors(up, dir.multiplyScalar(1 / (len || 1)));
    mesh.scale.set(1, len, 1);
  };

  /** Pose the controls and the pilot on them. */
  const pose = (h: HeliState): void => {
    const cp = controlPose(h.controls);
    const cyc = cyclicGrip(cp);
    a.set(cyc.x - Y.x, cyc.y - Y.y, cyc.z - Y.z).normalize();
    cyclic.quaternion.setFromUnitVectors(up, a);
    collective.rotation.x = -cp.collective;
    pedals[0].position.z = E.z + cp.pedalLeft;
    pedals[1].position.z = E.z + cp.pedalRight;
    const col = collectiveGrip(cp);
    // The hands: the right round the cyclic's grip, the left on the
    // collective's twist grip, the wrist a hand's length back of each.
    const grips: [V3, V3, number][] = [
      [{ x: cyc.x + 0.01, y: cyc.y - 0.01, z: cyc.z - 0.035 }, { x: 0.35, y: -0.6, z: -1 }, 1],
      [{ x: col.x, y: col.y + 0.03, z: col.z - 0.01 }, { x: -0.6, y: -0.8, z: -0.6 }, -1],
    ];
    grips.forEach(([hand, pole, side], i) => {
      const arm = arms[i];
      const sh = { x: S.x + side * Pi.shoulder.half, y: Pi.shoulder.y, z: Pi.shoulder.z };
      const back = { x: hand.x - side * 0.01, y: hand.y + 0.02, z: hand.z - 0.08 };
      const el = joint(sh, back, Pi.upperArm, Pi.forearm, pole);
      lay(arm.upper, sh, el);
      lay(arm.fore, el, back);
      lay(arm.cuff, back, hand);
      arm.elbow.position.set(el.x, el.y, el.z);
      arm.hand.position.set(hand.x, hand.y, hand.z);
    });
    [-1, 1].forEach((side, i) => {
      const leg = legs[i];
      const hip = { x: S.x + side * Pi.hip.half, y: Pi.hip.y, z: Pi.hip.z };
      const pedal = pedals[i];
      const ankle = { x: pedal.position.x, y: pedal.position.y + 0.1, z: pedal.position.z - 0.1 };
      const knee = joint(hip, ankle, Pi.thigh, Pi.shin, { x: side * 0.35, y: 1, z: 0.4 });
      lay(leg.thigh, hip, knee);
      lay(leg.shin, knee, ankle);
      leg.knee.position.set(knee.x, knee.y, knee.z);
      leg.boot.position.set(ankle.x, ankle.y - 0.02, ankle.z);
      leg.boot.rotation.x = -0.35;
    });
  };

  let inside = false;
  let paintDebt = 0;
  let pedLive: boolean | null = null;
  group.visible = true;
  return {
    group,
    show(on, pilotEye) {
      inside = on;
      group.visible = on;
      head.visible = !pilotEye;
      torso.visible = !pilotEye;
      for (const g of outsideGlass) g.visible = !on;
    },
    update(h, level, t, dt) {
      if (!inside) return;
      pose(h);
      paintDebt -= dt;
      if (paintDebt > 0) return;
      paintDebt = 1 / PAINT_HZ;
      const g = gaugesOf(h, level.groundAt(h.x, h.z), t);
      const s = Math.sin(h.heading);
      const c = Math.cos(h.heading);
      paintPanelLive(
        panelCanvas.ctx,
        panelBack,
        g,
        // Ahead `f` and to the right as seen `r` — the engine's left.
        (f, r) => level.groundAt(h.x + s * f - c * r, h.z + c * f + s * r),
        h.y,
        level.sun.hour + t / 3600,
      );
      panelCanvas.texture.needsUpdate = true;
      if (pedLive !== g.live) {
        pedLive = g.live;
        paintPedestal(pedCanvas.ctx, g.live);
        pedCanvas.texture.needsUpdate = true;
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const m of mats) m.dispose();
      for (const tx of textures) tx.dispose();
    },
  };
}
