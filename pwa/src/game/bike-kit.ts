// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BENCH THE DOWNHILL BIKE IS BUILT ON (`bike-build.ts`) — a handful of
// shapes a bicycle is made of, every one smooth-shaded and stated in the
// engine's body frame (x the engine's right, y up, z forward, metres):
//
//   loft      a TUBE swept along a curve through a few points, its section
//             a squared ellipse (a superellipse) whose half width (along a
//             chosen side axis) and half height change along it — a
//             hydroformed down tube, a tapered chainstay, a fork leg, a bar
//   lathe     a body of revolution about the x axis off a profile of
//             (radius, x) pairs — a rim, a tyre's carcass, a hub, a seal
//   plate     a flat outline in the (z, y) plane extruded along x with its
//             edges rounded — a crown, a dropout, a crank arm, a rotor
//   ring      a toothed or plain ring about the x axis — a chainring, a cog
//   helix     a wire wound round the z axis — a shock's coil
//
// Three only; nothing here knows what a bike is.

import * as THREE from "three";

export type V3 = { x: number; y: number; z: number };

const tv = (p: V3): THREE.Vector3 => new THREE.Vector3(p.x, p.y, p.z);

/** A section of a loft at `u` (0 at its start, 1 at its end): half width
 * along the side axis, half height across it, m. */
export type Section = { w: number; h: number };

export type LoftOptions = {
  /** Round the section (8–24). */
  sides?: number;
  /** Rings along the curve. */
  rings?: number;
  /** The axis the section's width lies along, before it is squared to the
   * curve (the frame's x for a tube in the bike's plane). */
  side?: V3;
  /** The superellipse's exponent: 2 an ellipse, more a squarer box. */
  square?: number;
  /** Close the ends. */
  caps?: boolean;
  /** Straight segments instead of a smooth curve through the points. */
  straight?: boolean;
};

/** A TUBE along `path`, its section `section(u)`. */
export function loft(
  path: V3[],
  section: Section | ((u: number) => Section),
  o: LoftOptions = {},
): THREE.BufferGeometry {
  const sides = o.sides ?? 14;
  const square = o.square ?? 2;
  const pts = path.map(tv);
  const curve =
    pts.length > 2 && !o.straight
      ? new THREE.CatmullRomCurve3(pts, false, "centripetal")
      : new THREE.CurvePath<THREE.Vector3>();
  if (!(curve instanceof THREE.CatmullRomCurve3)) {
    for (let i = 0; i + 1 < pts.length; i++)
      (curve as THREE.CurvePath<THREE.Vector3>).add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  }
  const rings = o.rings ?? Math.max(2, Math.ceil(curve.getLength() / 0.02));
  const sec = typeof section === "function" ? section : () => section;
  const side = o.side ? tv(o.side).normalize() : new THREE.Vector3(1, 0, 0);
  const pos: number[] = [];
  const index: number[] = [];
  const t = new THREE.Vector3();
  const n = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  // The superellipse's point at angle a: sign · |cos|^(2/p).
  const se = (a: number, k: (x: number) => number): number => {
    const v = k(a);
    return Math.sign(v) * Math.abs(v) ** (2 / square);
  };
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    curve.getPointAt(u, c);
    curve.getTangentAt(u, t);
    // The side axis squared to the curve; a curve along the side itself
    // takes y (or z) instead.
    n.copy(side).addScaledVector(t, -side.dot(t));
    if (n.lengthSq() < 1e-6) n.set(0, 1, 0).addScaledVector(t, -t.y);
    if (n.lengthSq() < 1e-6) n.set(0, 0, 1).addScaledVector(t, -t.z);
    n.normalize();
    b.crossVectors(t, n).normalize();
    const s = sec(u);
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const x = se(a, Math.cos) * s.w;
      const y = se(a, Math.sin) * s.h;
      pos.push(c.x + n.x * x + b.x * y, c.y + n.y * x + b.y * y, c.z + n.z * x + b.z * y);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j;
      const bb = i * sides + ((j + 1) % sides);
      const cc = a + sides;
      const d = bb + sides;
      index.push(a, cc, bb, bb, cc, d);
    }
  }
  if (o.caps ?? true) {
    for (const [ring, flip] of [
      [0, true],
      [rings, false],
    ] as const) {
      const at = curve.getPointAt(ring / rings);
      const mid = pos.length / 3;
      pos.push(at.x, at.y, at.z);
      for (let j = 0; j < sides; j++) {
        const a = ring * sides + j;
        const bb = ring * sides + ((j + 1) % sides);
        if (flip) index.push(mid, a, bb);
        else index.push(mid, bb, a);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** A BODY OF REVOLUTION about the x axis off `profile` — (radius, x)
 * pairs, in order round its outline. */
export function lathe(profile: [number, number][], segments = 32): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    profile.map(([r, x]) => new THREE.Vector2(r, x)),
    segments,
  );
  // The lathe turns about y: lay its axis along x (y → x, the radius in yz).
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** An OUTLINE in the (z, y) plane — `[z, y]` points, holes beside — made a
 * plate `thick` m across x centred on `x`, its edges rounded by `bevel`. */
export function plate(
  outline: [number, number][],
  thick: number,
  o: { x?: number; bevel?: number; holes?: [number, number][][]; curve?: number } = {},
): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)));
  for (const h of o.holes ?? [])
    shape.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y))));
  const bevel = Math.min(o.bevel ?? thick * 0.3, thick * 0.45);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, thick - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: o.curve ?? 8,
  });
  g.translate(0, 0, -(thick - 2 * bevel) / 2);
  // The shape's (x, y) is the bike's (z, y); its extrusion the bike's x.
  g.rotateY(-Math.PI / 2);
  g.scale(-1, 1, 1);
  g.translate(o.x ?? 0, 0, 0);
  // `scale(-1)` turned the winding inside out.
  flipWinding(g);
  g.computeVertexNormals();
  return g;
}

function flipWinding(g: THREE.BufferGeometry): void {
  const idx = g.index;
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]];
    idx.needsUpdate = true;
    return;
  }
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i += 3) {
    for (let k = 0; k < 3; k++) {
      const t = p.getComponent(i + 1, k);
      p.setComponent(i + 1, k, p.getComponent(i + 2, k));
      p.setComponent(i + 2, k, t);
    }
  }
}

/** A circle's outline in the (z, y) plane about (cz, cy), `n` points. */
export function circle(r: number, n = 24, cz = 0, cy = 0, from = 0): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = from + (i / n) * Math.PI * 2;
    out.push([cz + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/** A RING about the x axis between `inner` and `outer`, `thick` across x;
 * `teeth` cut round its outside (a chainring, a cog). */
export function ring(
  inner: number,
  outer: number,
  thick: number,
  o: { x?: number; teeth?: number; tooth?: number; holes?: [number, number][][] } = {},
): THREE.BufferGeometry {
  const pts: [number, number][] = [];
  const teeth = o.teeth ?? 0;
  const n = teeth ? teeth * 4 : 48;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // A tooth: two points out, two in.
    const r = teeth ? (i % 4 < 2 ? outer : outer - (o.tooth ?? 0.006)) : outer;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return plate(pts, thick, {
    x: o.x,
    bevel: thick * 0.2,
    holes: [circle(inner, 32).reverse(), ...(o.holes ?? [])],
  });
}

/** A COIL of `turns` round the z axis from z0 to z1, radius `r`, its wire
 * `wire` thick. */
export function helix(
  r: number,
  wire: number,
  z0: number,
  z1: number,
  turns: number,
): THREE.BufferGeometry {
  const path: V3[] = [];
  const n = Math.ceil(turns * 18);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * turns * Math.PI * 2;
    path.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: z0 + ((z1 - z0) * i) / n });
  }
  return loft(
    path,
    { w: wire, h: wire },
    { sides: 7, rings: n, straight: true, side: { x: 0, y: 0, z: 1 } },
  );
}

/** A rounded box, `w × h × l` (x, y, z), its centre at `at`. */
export function block(at: V3, w: number, h: number, l: number, r = 0.003): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, l, 1, 1, 1);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  // A soft edge read in the light: the corners pulled in a little.
  void r;
  g.translate(at.x, at.y, at.z);
  p.needsUpdate = true;
  return g;
}

/** A cylinder about the axis from `a` to `b`, radius `r`. */
export function rod(a: V3, b: V3, r: number, sides = 10): THREE.BufferGeometry {
  return loft([a, b], { w: r, h: r }, { sides, rings: 1, straight: true });
}

/** Turn a geometry `angle` rad about the x axis through `about`. */
export function turnX(
  g: THREE.BufferGeometry,
  angle: number,
  about: V3 = { x: 0, y: 0, z: 0 },
): THREE.BufferGeometry {
  g.translate(-about.x, -about.y, -about.z);
  g.rotateX(angle);
  g.translate(about.x, about.y, about.z);
  return g;
}
