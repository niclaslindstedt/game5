// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PATROL'S RESCUE TOBOGGAN AS DRAWN (`RESCUE_SLEDS.toboggan`): a
// fibreglass pan in the patrol's orange, 2.3 m by 0.62 m, its nose swept up
// so it rides over the snow rather than into it, two runners under it, an
// aluminium rail along each side and a pair of handles out of its tail for
// a patroller to steer it by on foot, and a chain brake slung under the
// tail; the rigid TOW BAR — an A-frame of two tubes from the nose's corners
// to one eye on the machine's hitch, `tongue` long — and the LASHINGS done
// up across him over the stretcher (`SledCrewFrame.lashed`). Low-poly and
// vertex-coloured, three-built once and shared by every toboggan.
//
// Every geometry is in the toboggan's own frame: x across, y up from the
// snow under its runners, z forward (its nose), its middle at the origin —
// the frame `rescue-sleds-crew.ts` beds the stretcher in (`SLED_CREW.floor`
// over the snow).

import * as THREE from "three";
import { RESCUE_SLEDS } from "@engine";

import { box, merge, paint } from "./rescue-view.ts";

const T = RESCUE_SLEDS.toboggan;

/** The toboggan's colours: the pan, the rails and the bar, the runners
 * and the brake's chain, the lashings and their buckles. */
const PAN = 0xe2471c;
const RAIL = 0xa3a9b0;
const DARK = 0x1d1e21;
const LASH = 0x1a1b1f;
const BUCKLE = 0xd8b21c;

/** THE PAN's section, m, as shares of its half width across and heights
 * over the snow: the outer skin from the left rim round under to the right
 * rim, and the inner from the right rim back over the floor — the floor
 * where the stretcher's mattress beds (`SLED_CREW.floor`, less the
 * mattress's own depth under its rails). */
const OUTER: readonly [number, number][] = [
  [-1, T.height],
  [-0.93, 0.2],
  [-0.78, 0.07],
  [-0.45, 0.025],
  [0.45, 0.025],
  [0.78, 0.07],
  [0.93, 0.2],
  [1, T.height],
];
const INNER: readonly [number, number][] = [
  [0.94, T.height],
  [0.87, 0.24],
  [0.72, 0.19],
  [-0.72, 0.19],
  [-0.87, 0.24],
  [-0.94, T.height],
];
/** Where the nose starts to sweep up (along, m), and how high it lifts. */
const SWEEP = { from: 0.62, lift: 0.26, narrow: 0.22 };

/** The section's points at `z` along: the nose swept up and drawn in. */
function sectionAt(z: number): [number, number][] {
  const L = T.length / 2;
  const u = Math.max(0, (z - SWEEP.from) / (L - SWEEP.from));
  const lift = SWEEP.lift * u * u;
  const w = (T.width / 2) * (1 - SWEEP.narrow * u * u);
  // The tail's corners rounded a little in plan.
  const tail = Math.max(0, (-z - (L - 0.12)) / 0.12);
  const ww = w * (1 - 0.12 * tail * tail);
  return [...OUTER, ...INNER].map(([x, y]) => [x * ww, y + lift * (1 - y / (T.height + 0.1))]);
}

/** THE PAN: the section lofted from tail to nose, both ends closed. */
function panGeometry(): THREE.BufferGeometry {
  const L = T.length / 2;
  const zs: number[] = [];
  for (let k = 0; k <= 12; k++) zs.push(-L + (2 * L * k) / 12);
  const rings = zs.map((z) => sectionAt(z).map(([x, y]) => new THREE.Vector3(x, y, z)));
  const n = rings[0].length;
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let r = 0; r + 1 < rings.length; r++) {
    const A = rings[r];
    const B = rings[r + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      tri(A[i], B[i], B[j]);
      tri(A[i], B[j], A[j]);
    }
  }
  // The ends: the section's own outline, triangulated.
  for (const [ring, flip] of [
    [rings[0], true],
    [rings[rings.length - 1], false],
  ] as const) {
    const shape = ring.map((p) => new THREE.Vector2(p.x, p.y));
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(shape, [])) {
      if (flip) tri(ring[a], ring[b], ring[c]);
      else tri(ring[a], ring[c], ring[b]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  paint(g, PAN);
  return g;
}

/** A tube from `a` to `b`, `r` m round, in a colour, into a list of parts. */
export function tube(
  geos: THREE.BufferGeometry[],
  colour: number,
  a: THREE.Vector3,
  b: THREE.Vector3,
  r: number,
): void {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), 8);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()),
  );
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  paint(g, colour);
  geos.push(g);
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Where the tow bar meets the nose: its two feet, m (toboggan frame). */
export const BAR_FEET = { half: 0.2, y: 0.36, z: T.length / 2 - 0.08 };

/** THE TOBOGGAN, whole: the pan, its runners, its rails and handles, the
 * brake's chain under the tail. */
export function tobogganGeometry(): THREE.BufferGeometry {
  const L = T.length / 2;
  const w = T.width / 2;
  const geos: THREE.BufferGeometry[] = [panGeometry()];
  // The runners, a hand in from either side.
  for (const s of [-1, 1])
    box(geos, DARK, s * 0.2 - 0.02, 0, -L + 0.08, s * 0.2 + 0.02, 0.03, SWEEP.from + 0.1);
  // The rails, on posts over each rim, and the tail's handles.
  const top = T.height + 0.05;
  for (const s of [-1, 1]) {
    const x = s * (w + 0.025);
    tube(geos, RAIL, v(x, top, -L - 0.05), v(x, top, L - 0.32), 0.015);
    for (const z of [-L + 0.1, -0.35, 0.35, L - 0.36])
      tube(geos, RAIL, v(x, top, z), v(s * w, T.height - 0.01, z), 0.011);
    // A handle out of the tail, turned up a little at its end.
    tube(geos, RAIL, v(x, top, -L - 0.05), v(s * (w - 0.06), top + 0.07, -L - 0.3), 0.016);
  }
  tube(geos, RAIL, v(-(w - 0.06), top + 0.07, -L - 0.3), v(w - 0.06, top + 0.07, -L - 0.3), 0.016);
  // The tow bar's lugs on the nose.
  for (const s of [-1, 1]) {
    box(
      geos,
      RAIL,
      s * BAR_FEET.half - 0.03,
      BAR_FEET.y - 0.04,
      BAR_FEET.z - 0.05,
      s * BAR_FEET.half + 0.03,
      BAR_FEET.y + 0.03,
      BAR_FEET.z + 0.04,
    );
  }
  // The chain brake hung under the tail, its links lying on the snow.
  box(geos, DARK, -0.12, 0.0, -L + 0.06, 0.12, 0.03, -L + 0.12);
  for (let k = 0; k < 4; k++)
    box(geos, DARK, -0.1 + k * 0.065, 0.0, -L - 0.12, -0.08 + k * 0.065, 0.025, -L + 0.06);
  return merge(geos);
}

/** THE TOW BAR on a unit length: its feet either side at z 0 and the eye at
 * z 1 on the hitch — stretched along z to the length it spans. */
export function towBarGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const h = BAR_FEET.half;
  for (const s of [-1, 1]) tube(geos, RAIL, v(s * h, 0, 0), v(s * 0.03, 0, 0.94), 0.02);
  tube(geos, RAIL, v(-h * 0.7, 0, 0.3), v(h * 0.7, 0, 0.3), 0.014);
  box(geos, DARK, -0.035, -0.03, 0.92, 0.035, 0.03, 1.0);
  return merge(geos);
}

/** Along the toboggan, m, the lashings done up over him, in the order
 * they are: across the chest, the hips, the shins. */
export const LASHINGS = [0.45, 0.0, -0.5] as const;

/** ONE LASHING over the rails across him, its top `over` m over the snow. */
export function lashGeometry(z: number, over = 0.62): THREE.BufferGeometry {
  const w = T.width / 2 + 0.03;
  const geos: THREE.BufferGeometry[] = [];
  box(geos, LASH, -w + 0.04, over, z - 0.025, w - 0.04, over + 0.015, z + 0.025);
  for (const s of [-1, 1]) {
    tube(geos, LASH, v(s * (w - 0.04), over + 0.007, z), v(s * w, T.height + 0.05, z), 0.012);
  }
  box(geos, BUCKLE, -0.04, over + 0.01, z - 0.03, 0.04, over + 0.03, z + 0.03);
  return merge(geos);
}
