// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOORS IN THE RENDERER — every building's door LEAF (`door-looks.ts`)
// hung on its hinge in its doorway (`doorway.ts`'s `leavesOf`) and swung
// as the engine has it (`leafShare`): one instanced draw a kind and hand of
// leaf for the whole map, an instance a leaf, in the buildings' own painted
// material. A leaf is moved only while it moves — the matrices of the
// doors the run has open are written each frame, every other one once.
// The building drew the doorway behind it dark, so an opened door shows
// the room's darkness.

import * as THREE from "three";
import {
  BUILDING_WALLS,
  buildingDoors,
  doorFrame,
  doorPoint,
  leafShare,
  leavesOf,
  type BuildingDoor,
  type GameState,
  type Level,
} from "@engine";

import { doorLookOf, leafArrays, leafPose, roomArrays, type DoorLook } from "./door-looks.ts";
import { FacadeKit } from "./facade-kit.ts";
import { facadeGeometry, facadeMaterial } from "./facade-mesh.ts";
import type { HazeUniforms } from "./haze.ts";

export type DoorsView = {
  group: THREE.Group;
  /** Every leaf where `state` has it: the doors in motion, and all of them
   * on a run not seen before. */
  update(state: GameState): void;
  dispose(): void;
};

/** One leaf drawn: its door, which of its leaves, the look, the instanced
 * draw it is in and its slot there. */
type Slot = {
  door: BuildingDoor;
  leaf: number;
  look: DoorLook;
  mesh: THREE.InstancedMesh;
  i: number;
};

export function createDoorsView(level: Level, haze: HazeUniforms): DoorsView | null {
  const doors = buildingDoors(level).filter((d) => doorLookOf(d.kind));
  if (doors.length === 0) return null;
  const group = new THREE.Group();
  group.name = "doors";
  const material = facadeMaterial(haze, "doors");
  // The leaves by the geometry they share: a kind, its hand and its half.
  const kinds = new Map<string, { geo: THREE.BufferGeometry; leaves: [BuildingDoor, number][] }>();
  for (const door of doors) {
    const look = doorLookOf(door.kind)!;
    leavesOf(door).forEach((L, k) => {
      const dir = L.latch > L.hinge ? -1 : 1;
      const half = door.leaves === 2 ? k : 0;
      const h = door.height - look.sill;
      const key = `${door.kind}|${dir}|${half}|${L.width}|${h}`;
      let entry = kinds.get(key);
      if (!entry) {
        entry = { geo: facadeGeometry(leafArrays(look, L.width, h, dir, half).out), leaves: [] };
        kinds.set(key, entry);
      }
      entry.leaves.push([door, k]);
    });
  }
  const slots = new Map<string, Slot[]>();
  const meshes: THREE.InstancedMesh[] = [];
  for (const { geo, leaves } of kinds.values()) {
    const mesh = new THREE.InstancedMesh(geo, material, leaves.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
    group.add(mesh);
    leaves.forEach(([door, leaf], i) => {
      const list = slots.get(door.id) ?? [];
      list.push({ door, leaf, look: doorLookOf(door.kind)!, mesh, i });
      slots.set(door.id, list);
    });
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  /** Lay `slot` at its share of its opening. */
  const lay = (s: Slot, share: number): void => {
    const { door, look } = s;
    const L = leavesOf(door)[s.leaf];
    const f = doorFrame(door);
    const p = doorPoint(f, L.hinge, BUILDING_WALLS.wall / 2 + look.face);
    const h = door.height - look.sill;
    let yaw = door.heading;
    let lift = 0;
    if (look.style === "roll") lift = Math.min(h - 0.05, leafPose("roll", share, door.height));
    else {
      const dir = L.latch > L.hinge ? -1 : 1;
      yaw += leafPose(look.style, share, h) * dir * (L.way < 0 ? 1 : -1);
    }
    at.set(p.x, door.y + look.sill + lift, p.z);
    q.setFromAxisAngle(UP, yaw);
    size.set(1, (h - lift) / h, 1);
    s.mesh.setMatrixAt(s.i, m.compose(at, q, size));
    s.mesh.instanceMatrix.needsUpdate = true;
  };
  // The dark rooms behind the holes a log building cut for a leaf that
  // swings in: one static draw for the map.
  const rooms = new FacadeKit();
  for (const door of doors) {
    const look = doorLookOf(door.kind)!;
    if (!look.room) continue;
    const f = doorFrame(door);
    rooms.at(f.x, door.y, f.z, door.heading);
    const span = Math.min(door.width, door.leaves * door.leaf);
    roomArrays(rooms, span + 0.3, door.height + 0.2, door.leaf + 0.2);
  }
  let roomGeo: THREE.BufferGeometry | null = null;
  if (rooms.triangles > 0) {
    roomGeo = facadeGeometry(rooms.out);
    group.add(new THREE.Mesh(roomGeo, material));
  }
  for (const list of slots.values()) for (const s of list) lay(s, 0);
  for (const mesh of meshes) mesh.computeBoundingSphere();
  let seen: GameState | null = null;
  let moving = new Set<string>();
  return {
    group,
    update(state) {
      const now = new Set<string>();
      for (const s of state.doorway?.swings ?? []) now.add(s.id);
      // A run not seen before: every leaf as it has it.
      const all = state !== seen;
      seen = state;
      for (const [id, list] of slots) {
        if (!all && !now.has(id) && !moving.has(id)) continue;
        for (const s of list) lay(s, leafShare(state, id, s.leaf));
      }
      moving = now;
    },
    dispose() {
      for (const { geo } of kinds.values()) geo.dispose();
      roomGeo?.dispose();
      for (const mesh of meshes) mesh.dispose();
      material.dispose();
    },
  };
}
