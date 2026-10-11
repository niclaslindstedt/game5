// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S RACK, LOADED WITH WHAT HE RIDES. The model's rack node
// (`sled_rack`, `scripts/blender/sled.py`'s `build_rack`) carries one
// generic pair of skis with its poles, a mesh a material: `rack_ski`,
// `rack_trim` and `rack_base` the pair (the baskets in the last too),
// `aluminium` the poles' shafts and `rubber` their grips. Here that rack is
// made the rider's own:
//
//   * HIS PAIR, in its topsheet's colours (`rack_ski`, `rack_trim`);
//   * NO POLES when he skis without them — the shafts and grips hidden and
//     the baskets cut out of the base's index (`basketFree`);
//   * HIS BOARD in place of the pair, on a snowboard — the pair and poles
//     hidden and his own deck and bindings (`board-rack.ts`) strapped on
//     edge where the pair stood, its base against the tunnel's side and
//     its bindings out, rising rearward along the pair's own line.
//
// Where the pair stands and which way it runs is READ OFF THE MODEL'S OWN
// GEOMETRY (`fitRack`), never restated, so a rebuilt model carries its rack
// with it.

import * as THREE from "three";

import { buildRackedBoard, stowBoard, type RackedBoard, type RackLoad } from "./board-rack.ts";

/** How the pair lies on the rack, in the rack node's frame. */
export type RackFit = {
  /** Along the pair, rising toward its upper end (unit). */
  along: THREE.Vector3;
  /** Out from the tunnel's side, across the pair's thickness (unit). */
  out: THREE.Vector3;
  /** The middle of the pair's inner face, against the tunnel, m. */
  base: THREE.Vector3;
};

/** The principal axis of a cloud of points (power iteration on its
 * covariance), and its centroid. */
function principal(points: readonly THREE.Vector3[]): { axis: THREE.Vector3; mid: THREE.Vector3 } {
  const mid = new THREE.Vector3();
  for (const p of points) mid.add(p);
  mid.multiplyScalar(1 / Math.max(1, points.length));
  const c = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of points) {
    const d = [p.x - mid.x, p.y - mid.y, p.z - mid.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i * 3 + j] += d[i] * d[j];
  }
  let v = new THREE.Vector3(0.3, 0.4, 0.9);
  for (let k = 0; k < 32; k++) {
    v = new THREE.Vector3(
      c[0] * v.x + c[1] * v.y + c[2] * v.z,
      c[3] * v.x + c[4] * v.y + c[5] * v.z,
      c[6] * v.x + c[7] * v.y + c[8] * v.z,
    ).normalize();
  }
  return { axis: v, mid };
}

function pointsOf(mesh: THREE.Mesh): THREE.Vector3[] {
  const at = (mesh.geometry as THREE.BufferGeometry).attributes.position;
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < at.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(at, i));
  return out;
}

const materialOf = (o: THREE.Object3D): string =>
  o instanceof THREE.Mesh && !Array.isArray(o.material) ? (o.material as THREE.Material).name : "";

/** WHERE THE PAIR LIES on `rack`, off its skis' own vertices: their long
 * axis (rising), out from the tunnel (away from the model's middle, x 0),
 * and the middle of their inner face. Null when the rack has no skis. */
export function fitRack(rack: THREE.Object3D): RackFit | null {
  const skis = rack.children.filter(
    (o): o is THREE.Mesh => o instanceof THREE.Mesh && materialOf(o) === "rack_ski",
  );
  const points = skis.flatMap(pointsOf);
  if (points.length < 4) return null;
  const { axis, mid } = principal(points);
  if (axis.y < 0) axis.negate();
  const out = new THREE.Vector3(Math.sign(mid.x) || -1, 0, 0);
  out.addScaledVector(axis, -out.dot(axis)).normalize();
  // The inner face: the pair's extent toward the tunnel, along `out`.
  let inner = Infinity;
  for (const p of points) inner = Math.min(inner, p.clone().sub(mid).dot(out));
  return { along: axis, out, base: mid.clone().addScaledVector(out, inner) };
}

/** THE BASE'S INDEX WITHOUT THE BASKETS: the pole baskets are cut from the
 * same material as the skis' bases, so they share a mesh — every triangle
 * standing round the poles' line near their lower ends, out past the pair,
 * is dropped. Null when there are no poles to find. */
export function basketFree(rack: THREE.Object3D, base: THREE.Mesh): THREE.BufferAttribute | null {
  const shafts = rack.children.find(
    (o): o is THREE.Mesh => o instanceof THREE.Mesh && materialOf(o) === "aluminium",
  );
  const g = base.geometry as THREE.BufferGeometry;
  if (!shafts || !g.index) return null;
  const pts = pointsOf(shafts);
  const { axis, mid } = principal(pts);
  if (axis.y < 0) axis.negate();
  let low = Infinity;
  for (const p of pts) low = Math.min(low, p.clone().sub(mid).dot(axis));
  // The baskets stand 8–9.5 cm up the shafts off their lower ends (r 4.5
  // cm): keep a margin either side along, and never reach in to the pair.
  const from = low + 0.05;
  const to = low + 0.13;
  const toPair = Math.sign(-mid.x) || 1;
  const at = g.attributes.position;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const kept: number[] = [];
  const index = g.index;
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(at, index.getX(i));
    b.fromBufferAttribute(at, index.getX(i + 1));
    c.fromBufferAttribute(at, index.getX(i + 2));
    const m = a
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3)
      .sub(mid);
    const along = m.dot(axis);
    const across = m.x * toPair;
    const basket = along > from && along < to && across < 0.034 && m.length() < 0.6;
    if (!basket) kept.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  }
  return new THREE.BufferAttribute(new Uint32Array(kept), 1);
}

export type SledRack = {
  /** Load the rack with `load` (his pair and his poles, or his board). */
  stow(load: RackLoad): void;
  dispose(): void;
};

/** The rack node `rack` of a loaded model made the rider's; `wrap` the
 * host's material wrapper (its haze). */
export function createSledRack(
  rack: THREE.Object3D,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
): SledRack {
  const fit = fitRack(rack);
  const meshes = rack.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
  const base = meshes.find((o) => materialOf(o) === "rack_base") ?? null;
  const full = base ? (base.geometry as THREE.BufferGeometry).index : null;
  let bare: THREE.BufferAttribute | null | undefined;
  let board: { id: string; racked: RackedBoard } | null = null;
  let last = "";
  return {
    stow(load) {
      const key = `${load.spec.id}:${load.poles}:${load.body}:${load.trim}`;
      if (key === last) return;
      last = key;
      const onBoard = load.spec.board !== undefined && fit !== null;
      for (const o of meshes) {
        const name = materialOf(o);
        if (name === "rack_ski") (o.material as THREE.MeshStandardMaterial).color.setHex(load.body);
        if (name === "rack_trim")
          (o.material as THREE.MeshStandardMaterial).color.setHex(load.trim);
        const pole = name === "aluminium" || name === "rubber";
        o.visible = !onBoard && (load.poles || !pole);
      }
      if (base && full) {
        if (bare === undefined) bare = basketFree(rack, base);
        const g = base.geometry as THREE.BufferGeometry;
        g.setIndex(load.poles || !bare ? full : bare);
      }
      if (board && (!onBoard || board.id !== load.spec.id)) {
        board.racked.group.removeFromParent();
        board.racked.dispose();
        board = null;
      }
      if (onBoard && !board) {
        const racked = buildRackedBoard(load.spec, wrap);
        stowBoard(racked.group, fit.along, fit.out, fit.base);
        rack.add(racked.group);
        board = { id: load.spec.id, racked };
      }
    },
    dispose() {
      board?.racked.dispose();
      if (base && full) (base.geometry as THREE.BufferGeometry).setIndex(full);
    },
  };
}
