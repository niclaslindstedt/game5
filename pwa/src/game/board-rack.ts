// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOARD STOWED: a rider's snowboard off his feet while a machine carries
// him — strapped on edge in the snowmobile's rack on the tunnel's side
// (`sled-view.ts`), lashed through a balloon basket's rope handles to its
// wall (`balloon-basket.ts`) — where a skier's pair and poles ride. Its
// deck and its two bindings, straps done up, built off the rider's own board
// (`board-body.ts`, `board-look.ts`) so the racked board is the one he
// rides, in its own topsheet. No poles: a board is ridden with none.
//
// `buildRackedBoard` makes it in the deck's frame (x across to its right
// edge, y out of its top, z along to its nose, the origin on the base's
// line at its middle); `stowBoard` stands that frame on edge where a rack
// holds it — its length along the rack, its top facing out, its base
// against whatever it is strapped to.

import * as THREE from "three";
import type { SkiSpec } from "@engine";

import { buildBinding, buildDeck, type Paint } from "./board-body.ts";
import { boardOf } from "./board-input.ts";
import { sheetOf } from "./board-look.ts";
import { frontIndex } from "./board-pose.ts";

/** WHAT THE RIDER STOWS on a machine while it carries him: his own pair
 * (`spec`, its topsheet's `body` and `trim`, sRGB) with his poles if he
 * carries them — or, a snowboard's `spec`, his board. */
export type RackLoad = { spec: SkiSpec; poles: boolean; body: number; trim: number };

export type RackedBoard = {
  group: THREE.Group;
  /** The board's length, m. */
  length: number;
  /** Its widest, at the tip or the tail, m. */
  width: number;
  dispose(): void;
};

/** `spec`'s board, deck and bindings, in the deck's frame; `wrap` the
 * host's material wrapper (its haze). */
export function buildRackedBoard(
  spec: SkiSpec,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
): RackedBoard {
  const board = boardOf(spec);
  const sheet = sheetOf(spec.id);
  const group = new THREE.Group();
  group.name = "racked-board";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const paints = new Map<number, THREE.Material>();
  const paint: Paint = (colour) => {
    let m = paints.get(colour);
    if (!m) {
      m = wrap(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6 }), "board");
      mats.push(m);
      paints.set(colour, m);
    }
    return m;
  };
  const deck = buildDeck(board, sheet, wrap);
  deck.mesh.castShadow = true;
  group.add(deck.mesh);
  // The bindings where he rides them, at his stance's angles.
  const face = board.lead === "regular" ? 1 : -1;
  const fi = frontIndex(board.lead);
  for (let i = 0; i < 2; i++) {
    const b = buildBinding(sheet, paint, (g) => geos.push(g));
    const at = ((i === fi ? 1 : -1) * board.stance) / 2;
    const a = i === fi ? board.front : board.back;
    b.group.rotation.set(0, Math.atan2(face * Math.cos(a), Math.sin(a)), 0);
    b.group.position.set(0, deck.topAt(at), at);
    b.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    group.add(b.group);
  }
  return {
    group,
    length: spec.length,
    width: Math.max(spec.tipWidth, spec.tailWidth),
    dispose() {
      deck.dispose();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

type Dir = { x: number; y: number; z: number };

const basis = new THREE.Matrix4();
const ax = new THREE.Vector3();
const ay = new THREE.Vector3();
const az = new THREE.Vector3();

/** Stand `board` (a `buildRackedBoard` group) on edge in its parent's frame:
 * its length along `along`, its top facing `out`, the middle of its base at
 * `base`. `out` is squared off `along` first. */
export function stowBoard(board: THREE.Object3D, along: Dir, out: Dir, base: Dir): void {
  az.set(along.x, along.y, along.z).normalize();
  ay.set(out.x, out.y, out.z);
  ay.addScaledVector(az, -ay.dot(az)).normalize();
  ax.crossVectors(ay, az);
  board.quaternion.setFromRotationMatrix(basis.makeBasis(ax, ay, az));
  board.position.set(base.x, base.y, base.z);
}
