// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD CUP BIKE'S BENCH (`bike-wc-build.ts`): the few shapes a race
// bike is made of, as three.js geometry — a SWEEP (a smooth tube of an
// oval or a squared section carried along a curve through its points,
// tapering, painted along and around by a colour rule: the frame's carbon
// tubes, the stays, the hoses, the fender), a LATHE about the x axis (a
// tyre's casing, a rim, a hub, a rotor), round and square bars between two
// points, and the plate that carries a number. Every piece carries a
// vertex colour, so a node's parts of one material merge into one draw.

import * as THREE from "three";

import type { V3 } from "./bike-look.ts";

export const tv = (p: V3): THREE.Vector3 => new THREE.Vector3(p.x, p.y, p.z);

/** Paint every vertex of `g` one colour (sRGB hex, stored linear). */
export function painted(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = g.getAttribute("position").count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
}

/** Strip a primitive to the attributes every merged piece shares. */
export function plain(g: THREE.BufferGeometry, hex = 0xffffff): THREE.BufferGeometry {
  for (const k of Object.keys(g.attributes)) {
    if (k !== "position" && k !== "normal") g.deleteAttribute(k);
  }
  if (!g.index) {
    const n = g.getAttribute("position").count;
    g.setIndex([...Array(n).keys()]);
  }
  return painted(g, hex);
}

/** A section's half width (across x) and half height at a share `u` of
 * the way along, and how square it is (2 an ellipse, 4 near a box). */
export type Section = { w: number; h: number; square?: number };

export type SweepSpec = {
  points: V3[];
  section: (u: number) => Section;
  /** Rings along and faces around. */
  rings?: number;
  sides?: number;
  /** The colour at `u` along and `a` around (rad, 0 the side's up). */
  colour?: (u: number, a: number) => number;
  /** Close the ends. */
  caps?: boolean;
  /** Which way is "up" for the section (default: the body's +y, falling
   * back to +x where the curve runs up it). */
  up?: V3;
};

/** A SWEPT TUBE through `points` (a centripetal Catmull-Rom), its section
 * an oval or a squared oval, smooth shaded. */
export function sweep(spec: SweepSpec): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(spec.points.map(tv), false, "centripetal");
  const rings = spec.rings ?? 24;
  const sides = spec.sides ?? 14;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const up0 = spec.up ? tv(spec.up).normalize() : new THREE.Vector3(0, 1, 0);
  const t = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    const p = curve.getPointAt(u);
    curve.getTangentAt(u, t);
    // The section's up: the chosen up made square to the tangent; where the
    // curve runs along it, the body's x instead.
    side.crossVectors(t, up0);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    up.crossVectors(side, t).normalize();
    const s = spec.section(u);
    const e = 2 / (s.square ?? 2);
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const x = Math.sign(ca) * Math.abs(ca) ** e * s.w;
      const y = Math.sign(sa) * Math.abs(sa) ** e * s.h;
      pos.push(
        p.x + side.x * x + up.x * y,
        p.y + side.y * x + up.y * y,
        p.z + side.z * x + up.z * y,
      );
      c.set(spec.colour ? spec.colour(u, a) : 0xffffff);
      col.push(c.r, c.g, c.b);
    }
  }
  const row = sides + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  if (spec.caps) {
    for (const end of [0, rings]) {
      const p = curve.getPointAt(end / rings);
      const centre = pos.length / 3;
      pos.push(p.x, p.y, p.z);
      const cc = spec.colour ? c.set(spec.colour(end / rings, 0)) : c.set(0xffffff);
      col.push(cc.r, cc.g, cc.b);
      for (let j = 0; j < sides; j++) {
        const a = end * row + j;
        if (end === 0) idx.push(centre, a + 1, a);
        else idx.push(centre, a, a + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);

/** A round bar from `a` to `b`, radius `r` (or `r` to `r2`). */
export function rod(
  a: V3,
  b: V3,
  r: number,
  sides = 8,
  hex = 0xffffff,
  r2 = r,
): THREE.BufferGeometry {
  const A = tv(a);
  const d = tv(b).sub(A);
  const g = new THREE.CylinderGeometry(r2, r, Math.max(1e-4, d.length()), sides, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()));
  g.translate(A.x + d.x / 2, A.y + d.y / 2, A.z + d.z / 2);
  return plain(g, hex);
}

/** A box centred on `at`, turned `turn` (Euler x, y, z). */
export function block(
  at: V3,
  size: V3,
  hex = 0xffffff,
  turn: V3 = { x: 0, y: 0, z: 0 },
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(size.x, size.y, size.z);
  g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(turn.x, turn.y, turn.z)));
  g.translate(at.x, at.y, at.z);
  return plain(g, hex);
}

/** A LATHE about the x axis through the origin: `profile` its points as
 * (radius, x), revolved `segments` times. */
export function latheX(
  profile: [number, number][],
  segments: number,
  hex = 0xffffff,
): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    profile.map(([r, x]) => new THREE.Vector2(r, x)),
    segments,
  );
  // The lathe's axis is y; turn it onto x.
  g.rotateZ(-Math.PI / 2);
  return plain(g, hex);
}

/** A flat ring (an annulus) about the x axis at `x`, `thick` deep. */
export function ringX(
  x: number,
  inner: number,
  outer: number,
  thick: number,
  segments: number,
  hex = 0xffffff,
): THREE.BufferGeometry {
  const h = thick / 2;
  return latheX(
    [
      [inner, -h],
      [outer, -h],
      [outer, h],
      [inner, h],
      [inner, -h],
    ].map(([r, dx]) => [r, dx + x] as [number, number]),
    segments,
    hex,
  );
}

/** Copies of `g` turned about the x axis `n` times evenly, from `start`. */
export function aroundX(g: THREE.BufferGeometry, n: number, start = 0): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const c = g.clone();
    c.rotateX(start + (i / n) * Math.PI * 2);
    out.push(c);
  }
  g.dispose();
  return out;
}

/** THE NUMBER PLATE's face: a white plate, a race's number in black, the
 * team's accent bar along its foot — a texture drawn once. */
export function plateTexture(number: string, accent: number): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 200;
  const x = cv.getContext("2d");
  if (!x) return null;
  x.fillStyle = "#f4f4f0";
  x.fillRect(0, 0, 256, 200);
  x.fillStyle = `#${accent.toString(16).padStart(6, "0")}`;
  x.fillRect(0, 160, 256, 40);
  x.fillStyle = "#111";
  x.font = "bold 150px sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(number, 128, 88);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
