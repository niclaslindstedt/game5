// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND KEPT OUT OF A ROOM. A building stands terraced into its
// slope: its back is dug in under the floor (`CABIN_LAYOUT.plinth.cut`,
// metres on a mountain building's site), so the snow's surface runs on
// under it and would stand up through any room drawn inside. Nobody sees
// that from outside (the walls hide it), but whoever stands in the room
// would. So the ground drops every fragment inside a room that is BUILT
// (`interiors-view.ts` hands over the nearest `ROOM_CUTS`), its footprint
// a little short of the walls' outer faces so the snow still meets them.
//
// The uniforms are one object every terrain level's shader takes, written
// by the rooms' view when its set changes — one renderer a page.

import * as THREE from "three";

/** How many rooms the ground keeps out at once. */
export const ROOM_CUTS = 8;

/** Each room's centre and heading (x, z, sin, cos) and its half width and
 * half depth (and how far short of the walls the cut stays). */
export const roomCutUniforms = {
  uRoomCutA: { value: Array.from({ length: ROOM_CUTS }, () => new THREE.Vector4()) },
  uRoomCutB: { value: Array.from({ length: ROOM_CUTS }, () => new THREE.Vector4()) },
  uRoomCuts: { value: 0 },
};

/** A room's footprint: its building's middle and heading, and its half
 * width and depth to the walls' outer faces. */
export type RoomCut = { x: number; z: number; heading: number; hw: number; hd: number };

/** How far inside the walls' outer faces the cut stays, m. */
const SHORT = 0.08;

/** Hand the ground the rooms built now, nearest first. */
export function setRoomCuts(list: readonly RoomCut[]): void {
  const n = Math.min(ROOM_CUTS, list.length);
  for (let i = 0; i < n; i++) {
    const r = list[i];
    roomCutUniforms.uRoomCutA.value[i].set(r.x, r.z, Math.sin(r.heading), Math.cos(r.heading));
    roomCutUniforms.uRoomCutB.value[i].set(
      Math.max(0, r.hw - SHORT),
      Math.max(0, r.hd - SHORT),
      0,
      0,
    );
  }
  roomCutUniforms.uRoomCuts.value = n;
}

/** The uniforms' declarations and the test, for a fragment shader that
 * has the world position in `p` (x, z). */
export const ROOM_CUT_PARS = /* glsl */ `
uniform vec4 uRoomCutA[${ROOM_CUTS}];
uniform vec4 uRoomCutB[${ROOM_CUTS}];
uniform int uRoomCuts;
bool inRoomCut(vec2 p) {
  for (int i = 0; i < ${ROOM_CUTS}; i++) {
    if (i >= uRoomCuts) break;
    vec4 a = uRoomCutA[i];
    vec2 d = p - a.xy;
    // The building's frame: x across its front, z out of it.
    float lx = d.x * a.w - d.y * a.z;
    float lz = d.x * a.z + d.y * a.w;
    if (abs(lx) < uRoomCutB[i].x && abs(lz) < uRoomCutB[i].y) return true;
  }
  return false;
}
`;
