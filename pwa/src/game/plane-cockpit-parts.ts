// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE COCKPIT'S PARTS (`plane-cockpit.ts` assembles them), each
// built in the cockpit's frame (`plane-cockpit-plan.ts`: x to the right as
// seen): the bench of shapes they are made of (a box, an upholstered box, a
// tube, a quad, many geometries merged into one mesh, a canvas and its
// texture), and the parts that are more than one shape — the seats, the
// sticks, the pedals, the quadrant and its levers, the trim wheel.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PLANE } from "@engine";

import { PLANE_COCKPIT } from "./plane-cockpit-plan.ts";

export type V3 = { x: number; y: number; z: number };

const up = new THREE.Vector3(0, 1, 0);

/** A box `w` × `h` × `d` m at (x, y, z), turned `rx` about x. */
export function box(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return g;
}

/** A box with its edges rounded to `r` m — upholstery and mouldings. */
export function soft(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  r = 0.03,
) {
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return g;
}

/** A tube from `a` to `b`, radius `r0` at `a` and `r1` at `b`. */
export function tube(a: V3, b: V3, r0: number, r1 = r0, seg = 10): THREE.BufferGeometry {
  const d = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

/** A quad with its corners in order and its uv over the whole of a
 * texture: `a` the bottom left, `b` the bottom right, `c` the top right,
 * facing the way `a → b → c` winds counter-clockwise. */
export function quad(a: V3, b: V3, c: V3, d: V3, flip = false): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z],
      3,
    ),
  );
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex(flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/** Many geometries, one mesh (positions and normals only). */
export function merged(list: THREE.BufferGeometry[], m: THREE.Material): THREE.Mesh {
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
export function canvasTexture(
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas, ctx, texture };
}

/** The materials the parts are made of. */
export type Mats = Record<
  | "black"
  | "satin"
  | "steel"
  | "rubber"
  | "fabric"
  | "leather"
  | "shell"
  | "strap"
  | "red"
  | "blue"
  | "white"
  | "yellow",
  THREE.Material
>;

/** THE SEATS: two bucket seats on their rails, upholstered, the harness of
 * the empty one lying in it. */
export function seats(m: Mats): THREE.Object3D[] {
  const S = PLANE_COCKPIT.seat;
  const floor = PLANE.cabin.floor;
  const pad: THREE.BufferGeometry[] = [];
  const frame: THREE.BufferGeometry[] = [];
  const shell: THREE.BufferGeometry[] = [];
  const straps: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const x = side * S.x;
    const depth = S.front - S.back;
    pad.push(soft(S.width, 0.1, depth, x, S.top - 0.05, (S.front + S.back) / 2, -0.07));
    const lean = S.lean;
    const mid = { y: S.top + S.tall / 2, z: S.back - Math.sin(lean) * (S.tall / 2) };
    pad.push(soft(S.width - 0.05, S.tall, 0.09, x, mid.y, mid.z - 0.035, -lean));
    shell.push(soft(S.width, S.tall + 0.04, 0.035, x, mid.y, mid.z - 0.1, -lean, 0.015));
    pad.push(
      soft(
        S.width * 0.52,
        0.14,
        0.09,
        x,
        S.top + S.tall + 0.06,
        S.back - Math.sin(lean) * (S.tall + 0.06) - 0.045,
        -lean,
      ),
    );
    for (const b of [-1, 1]) {
      pad.push(
        soft(
          0.06,
          0.1,
          depth - 0.04,
          x + (b * (S.width - 0.06)) / 2,
          S.top + 0.02,
          (S.front + S.back) / 2,
        ),
        soft(
          0.07,
          S.tall * 0.6,
          0.11,
          x + (b * (S.width - 0.07)) / 2,
          S.top + S.tall * 0.32,
          S.back - Math.sin(lean) * S.tall * 0.32 - 0.02,
          -lean,
        ),
      );
      // The seat's legs to its two rails on the floor.
      for (const fz of [S.back + 0.05, S.front - 0.06]) {
        frame.push(
          tube(
            { x: x + b * (S.width / 2 - 0.05), y: floor, z: fz },
            { x: x + b * (S.width / 2 - 0.05), y: S.top - 0.1, z: fz },
            0.013,
          ),
        );
      }
      frame.push(
        box(0.03, 0.025, 0.9, x + b * (S.width / 2 - 0.05), floor + 0.012, (S.front + S.back) / 2),
      );
    }
    frame.push(box(S.width - 0.06, 0.025, 0.025, x, floor + 0.12, S.front - 0.06));
    // The four-point harness: on the empty seat lying in it, on the
    // pilot's run back over the seat's top to its anchor (his own straps
    // are under his body).
    for (const b of [-1, 1]) {
      straps.push(
        box(0.045, S.tall * 0.85, 0.006, x + b * 0.09, S.top + S.tall * 0.45, S.back - 0.05, -lean),
      );
      if (side > 0)
        straps.push(box(0.045, 0.006, 0.42, x + b * 0.1, S.top + 0.004, S.back + 0.26, 0.07));
    }
  }
  return [
    merged(pad, m.fabric),
    merged(frame, m.steel),
    merged(shell, m.shell),
    merged(straps, m.strap),
  ];
}

/** A STICK: its rubber boot on the floor, the tube, the grip and its
 * trigger and trim button; built about its pivot, upright, for `pose` to
 * turn. */
export function stick(m: Mats): THREE.Group {
  const S = PLANE_COCKPIT.stick;
  const g = new THREE.Group();
  g.position.set(0, S.y, S.z);
  const bend = { x: 0, y: S.length * 0.55, z: -0.03 };
  const top = { x: 0, y: S.length, z: 0 };
  g.add(
    merged(
      [tube({ x: 0, y: 0, z: 0 }, bend, 0.015, 0.013), tube(bend, top, 0.013, 0.012)],
      m.satin,
    ),
    merged(
      [
        tube({ x: 0, y: -0.02, z: 0 }, { x: 0, y: 0.11, z: 0 }, 0.075, 0.022, 12),
        tube(top, { x: 0, y: S.length + S.grip, z: 0.01 }, 0.02, 0.023, 12),
      ],
      m.rubber,
    ),
    merged(
      [
        box(0.05, 0.03, 0.045, 0, S.length + S.grip + 0.012, 0.016),
        box(0.012, 0.022, 0.012, 0, S.length + S.grip - 0.025, 0.03),
      ],
      m.black,
    ),
    merged([box(0.012, 0.012, 0.012, 0.012, S.length + S.grip + 0.032, 0.026)], m.red),
    merged([box(0.016, 0.01, 0.016, -0.011, S.length + S.grip + 0.03, 0.022)], m.steel),
  );
  return g;
}

/** A PEDAL: its arm off a pivot under the panel and its plate with the toe
 * brake on top, at (x, y, z). */
export function pedal(m: Mats, x: number): THREE.Group {
  const E = PLANE_COCKPIT.pedals;
  const g = new THREE.Group();
  g.position.set(x, E.y, E.z);
  g.add(
    merged([box(0.09, 0.15, 0.015, 0, 0.05, 0, -0.45)], m.rubber),
    merged(
      [
        box(0.1, 0.012, 0.02, 0, 0.125, 0.04, -0.45),
        box(0.1, 0.012, 0.02, 0, -0.02, -0.03, -0.45),
        tube({ x: 0, y: 0.11, z: 0.04 }, { x: 0, y: 0.3, z: 0.12 }, 0.011),
      ],
      m.steel,
    ),
  );
  return g;
}

/** THE QUADRANT: its housing under the panel's middle, its curved slotted
 * face (painted, `plate`), and its four levers — each a group turned about
 * x at the levers' pivot by `pose`: the propeller's blue round knob, the
 * power's black T-handle, the condition's red ridged knob, the flap lever's
 * white aerofoil. */
export function quadrant(
  m: Mats,
  plate: THREE.Material,
): { parts: THREE.Object3D[]; levers: THREE.Group[]; flap: THREE.Group } {
  const L = PLANE_COCKPIT.levers;
  const F = L.face;
  const P = PLANE_COCKPIT.panel;
  // The curved face: an arc about the pivot from `from` to `to`.
  const rows: V3[][] = [];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const a = F.from + ((F.to - F.from) * i) / N;
    const y = L.y + Math.cos(a) * F.radius;
    const z = L.z - Math.sin(a) * F.radius;
    rows.push([
      { x: F.mid + F.half, y, z },
      { x: F.mid - F.half, y, z },
    ]);
  }
  const face = new THREE.Mesh(loftRows(rows), plate);
  face.receiveShadow = true;
  // The housing's cheeks either side, and its back up to the panel.
  const cheek: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const x = F.mid + s * (F.half + 0.004);
    const pts: V3[] = [];
    for (let i = 0; i <= N; i++) {
      const a = F.from + ((F.to - F.from) * i) / N;
      pts.push({
        x,
        y: L.y + Math.cos(a) * (F.radius + 0.004),
        z: L.z - Math.sin(a) * (F.radius + 0.004),
      });
    }
    // A fan from the pivot's foot to the arc.
    const v: number[] = [];
    const foot = { x, y: L.y - 0.02, z: L.z + 0.02 };
    for (let i = 0; i < N; i++)
      v.push(
        foot.x,
        foot.y,
        foot.z,
        pts[i].x,
        pts[i].y,
        pts[i].z,
        pts[i + 1].x,
        pts[i + 1].y,
        pts[i + 1].z,
      );
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    cheek.push(
      g,
      box(0.012, P.bottom - L.y + 0.02, P.z - L.z + 0.06, x, (P.bottom + L.y) / 2, (P.z + L.z) / 2),
    );
  }
  // The top plate from the face's top edge forward to the panel, the front
  // from its lower edge down to the floor, and the pedestal's sides under
  // it: the quadrant a closed box between the seats.
  const hi = { y: L.y + Math.cos(F.from) * F.radius, z: L.z - Math.sin(F.from) * F.radius };
  const lo = { y: L.y + Math.cos(F.to) * F.radius, z: L.z - Math.sin(F.to) * F.radius };
  const floor = PLANE.cabin.floor;
  const xl = F.mid - F.half - 0.006;
  const xr = F.mid + F.half + 0.006;
  cheek.push(
    quad(
      { x: xr, y: hi.y, z: hi.z },
      { x: xl, y: hi.y, z: hi.z },
      { x: xl, y: P.bottom, z: P.z },
      { x: xr, y: P.bottom, z: P.z },
    ),
    quad(
      { x: xl, y: floor, z: lo.z },
      { x: xr, y: floor, z: lo.z },
      { x: xr, y: lo.y, z: lo.z },
      { x: xl, y: lo.y, z: lo.z },
    ),
  );
  for (const x of [xl, xr]) {
    cheek.push(
      quad(
        { x, y: floor, z: lo.z },
        { x, y: floor, z: P.z },
        { x, y: P.bottom, z: P.z },
        { x, y: lo.y, z: lo.z },
      ),
    );
  }
  const housing = merged(cheek, m.shell);
  const lever = (k: number, knob: THREE.Mesh[]): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(k < 0 ? PLANE_COCKPIT.flapLever.x : L.x[k], L.y, L.z);
    const len = k < 0 ? PLANE_COCKPIT.flapLever.length : L.length;
    g.add(merged([tube({ x: 0, y: 0, z: 0 }, { x: 0, y: len, z: 0 }, 0.007, 0.006, 8)], m.steel));
    for (const kn of knob) {
      kn.position.y += len;
      g.add(kn);
    }
    return g;
  };
  const prop = lever(0, [merged([soft(0.034, 0.03, 0.034, 0, 0.01, 0, 0, 0.014)], m.blue)]);
  const power = lever(1, [
    merged(
      [tube({ x: -0.045, y: 0.012, z: 0 }, { x: 0.045, y: 0.012, z: 0 }, 0.014, 0.014, 12)],
      m.black,
    ),
    merged([box(0.022, 0.03, 0.022, 0, -0.002, 0)], m.black),
  ]);
  const cond = lever(2, [merged([soft(0.03, 0.04, 0.026, 0, 0.012, 0, 0, 0.008)], m.red)]);
  const flap = lever(-1, [merged([soft(0.05, 0.016, 0.03, 0, 0.008, 0, 0, 0.007)], m.white)]);
  return { parts: [face, housing], levers: [prop, power, cond], flap };
}

/** A grid of points as a geometry (the quadrant's face), its uv the grid's
 * — u across, v down its rows. */
function loftRows(rows: V3[][]): THREE.BufferGeometry {
  const p: number[] = [];
  const uv: number[] = [];
  const n = rows.length;
  rows.forEach((r, i) =>
    r.forEach((q, j) => {
      p.push(q.x, q.y, q.z);
      uv.push(j === 0 ? 1 : 0, 1 - i / (n - 1));
    }),
  );
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** THE TRIM WHEEL overhead: a wheel on an axle across, its rim knurled,
 * built about its middle for `pose` to turn about x. */
export function trimWheel(m: Mats): THREE.Group {
  const T = PLANE_COCKPIT.trim;
  const g = new THREE.Group();
  g.position.set(T.x, T.y, T.z);
  const wheel = new THREE.CylinderGeometry(T.radius, T.radius, T.width, 28);
  wheel.rotateZ(Math.PI / 2);
  const ridges: THREE.BufferGeometry[] = [wheel];
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    ridges.push(
      box(T.width + 0.004, 0.012, 0.012, 0, Math.cos(a) * T.radius, Math.sin(a) * T.radius, a),
    );
  }
  g.add(merged(ridges, m.black));
  g.add(merged([box(T.width + 0.006, 0.02, 0.014, 0, T.radius - 0.01, 0)], m.white));
  return g;
}
