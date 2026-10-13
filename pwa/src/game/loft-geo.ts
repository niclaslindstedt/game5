// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LOFTED SHAPES for the things built in code that are not faceted — the
// downhill bike's hydroformed tubes and the rider's limbs and clothes
// (`bike-dh-build.ts`, `bike-rider-build.ts`): a section swept along a
// path, its size and its squash read off the way along, its across axis
// held to a hint so an oval tube stays the way up it was cut, the two ends
// capped. Every geometry comes painted (a vertex colour) so a node's parts
// merge into one draw whatever their colours.

import * as THREE from "three";

export type P3 = { x: number; y: number; z: number };

/** A SECTION at `t` (0 at the path's start, 1 at its end): its half-width
 * along the across hint and its half-depth square to it, m. */
export type Section = (t: number) => [number, number];

export type LoftOptions = {
  /** Points round the section. */
  sides?: number;
  /** The across axis the section's width is laid along (projected square to
   * the path at every ring). */
  across?: P3;
  /** Close the ends. */
  caps?: boolean;
  /** Rings between the path's points (a smooth sweep of few points). */
  steps?: number;
  /** A shape for the section's outline (`a` the angle round it, 0 along
   * the across axis): its radius as a share; 1 is an ellipse. */
  outline?: (a: number, t: number) => number;
};

const tmp = new THREE.Vector3();

/** A Catmull-Rom point through `pts` at `u` in [0, pts.length − 1]. */
function along(pts: THREE.Vector3[], u: number, out: THREE.Vector3): THREE.Vector3 {
  const n = pts.length - 1;
  const i = Math.min(n - 1, Math.max(0, Math.floor(u)));
  const f = u - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n, i + 2)];
  const f2 = f * f;
  const f3 = f2 * f;
  for (const k of ["x", "y", "z"] as const)
    out[k] =
      0.5 *
      (2 * p1[k] +
        (-p0[k] + p2[k]) * f +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f3);
  return out;
}

/** A SWEEP of `section` along `path`, painted `colour`. */
export function loft(
  path: P3[],
  section: Section,
  colour: THREE.ColorRepresentation,
  o: LoftOptions = {},
): THREE.BufferGeometry {
  const sides = o.sides ?? 10;
  const steps = o.steps ?? (path.length > 2 ? 6 : 1);
  const pts = path.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const rings = (pts.length - 1) * steps + 1;
  const hint = new THREE.Vector3(o.across?.x ?? 1, o.across?.y ?? 0, o.across?.z ?? 0);
  const pos: number[] = [];
  const centres: THREE.Vector3[] = [];
  const tans: THREE.Vector3[] = [];
  for (let r = 0; r < rings; r++) centres.push(along(pts, r / steps, new THREE.Vector3()));
  for (let r = 0; r < rings; r++) {
    const a = centres[Math.max(0, r - 1)];
    const b = centres[Math.min(rings - 1, r + 1)];
    tans.push(b.clone().sub(a).normalize());
  }
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  for (let r = 0; r < rings; r++) {
    const t = r / (rings - 1);
    const T = tans[r];
    side.copy(hint).addScaledVector(T, -hint.dot(T));
    if (side.lengthSq() < 1e-8) side.set(0, 1, 0).addScaledVector(T, -T.y);
    side.normalize();
    up.crossVectors(T, side).normalize();
    const [w, d] = section(t);
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const k = o.outline ? o.outline(a, t) : 1;
      tmp
        .copy(centres[r])
        .addScaledVector(side, Math.cos(a) * w * k)
        .addScaledVector(up, Math.sin(a) * d * k);
      pos.push(tmp.x, tmp.y, tmp.z);
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rings - 1; r++)
    for (let s = 0; s < sides; s++) {
      const a = r * sides + s;
      const b = r * sides + ((s + 1) % sides);
      const c = a + sides;
      const d = b + sides;
      idx.push(a, c, b, b, c, d);
    }
  if (o.caps !== false) {
    for (const end of [0, rings - 1]) {
      const c = centres[end];
      const at = pos.length / 3;
      pos.push(c.x, c.y, c.z);
      for (let s = 0; s < sides; s++) {
        const a = end * sides + s;
        const b = end * sides + ((s + 1) % sides);
        if (end === 0) idx.push(at, a, b);
        else idx.push(at, b, a);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return paint(g, colour);
}

/** A ROUND TUBE from `a` to `b`, `r` thick (or tapering `r` to `r2`). */
export function rod(
  a: P3,
  b: P3,
  r: number,
  colour: THREE.ColorRepresentation,
  sides = 8,
  r2 = r,
): THREE.BufferGeometry {
  return loft([a, b], (t) => [r + (r2 - r) * t, r + (r2 - r) * t], colour, { sides });
}

/** Any geometry painted one colour, non-indexed-ready. */
export function paint(
  g: THREE.BufferGeometry,
  colour: THREE.ColorRepresentation,
): THREE.BufferGeometry {
  const c = new THREE.Color(colour);
  const n = g.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  if (!g.getAttribute("uv"))
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

/** An ELLIPSOID `r` (x, y, z half-sizes) at `at`, painted. */
export function blob(
  at: P3,
  r: P3,
  colour: THREE.ColorRepresentation,
  w = 12,
  h = 8,
): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(r.x, r.y, r.z);
  g.translate(at.x, at.y, at.z);
  return paint(g, colour);
}

/** A BOX at `at` w × h × l, painted, optionally turned. */
export function brick(
  at: P3,
  w: number,
  h: number,
  l: number,
  colour: THREE.ColorRepresentation,
  turn?: THREE.Euler,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, l);
  if (turn) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(turn));
  g.translate(at.x, at.y, at.z);
  return paint(g, colour);
}

/** A DISC or ring about +x at x = `x`: outer radius `r`, inner `hole`, `t` thick. */
export function ring(
  x: number,
  r: number,
  hole: number,
  t: number,
  colour: THREE.ColorRepresentation,
  n = 24,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, r, 0, Math.PI * 2, false);
  if (hole > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, hole, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: n });
  g.translate(0, 0, -t / 2);
  g.rotateY(Math.PI / 2);
  g.translate(x, 0, 0);
  return paint(g, colour);
}
