// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHELTER — a closed cabin the lens is inside (the helicopter's
// cockpit, `heli-cockpit.ts`), where no snow falls. The falling snow, the
// spindrift, the spray and the snow cloud are drawn wherever they are and
// depth-tested against the world; a cabin's glass is clear, so a flake or
// a puff of the rotor's wash that the box round the lens puts INSIDE the
// cabin would be drawn in front of the panel. Every one of those shaders
// asks `sheltered(world)` and leaves out what is inside the box.
//
// One box for the page, set by whoever owns the cabin the lens is in
// (`heli-scene.ts`'s `seen`) and let go when it leaves.

import * as THREE from "three";

/** The box: off (0) or on (1), the world → box matrix (its centre at the
 * origin, its axes the cabin's) and its half-extents, m. */
export const SHELTER = {
  uShelterOn: { value: 0 },
  uShelter: { value: new THREE.Matrix4() },
  uShelterHalf: { value: new THREE.Vector3(1, 1, 1) },
};

/** The uniforms and `sheltered(vec3 world)`, for a shader's source. */
export const SHELTER_GLSL = /* glsl */ `
uniform float uShelterOn;
uniform mat4 uShelter;
uniform vec3 uShelterHalf;
bool sheltered(vec3 world) {
  if (uShelterOn < 0.5) return false;
  vec3 p = (uShelter * vec4(world, 1.0)).xyz;
  return all(lessThan(abs(p), uShelterHalf));
}
`;

const inverse = new THREE.Matrix4();

/** The cabin box at `at` (the machine's world place and turn), its centre
 * `centre` and half-extents `half` in the machine's own frame, m. */
export function shelterAt(
  at: { x: number; y: number; z: number; q: THREE.Quaternion },
  centre: { x: number; y: number; z: number },
  half: { x: number; y: number; z: number },
): void {
  const m = SHELTER.uShelter.value;
  m.makeRotationFromQuaternion(at.q);
  const c = new THREE.Vector3(centre.x, centre.y, centre.z).applyQuaternion(at.q);
  m.setPosition(at.x + c.x, at.y + c.y, at.z + c.z);
  m.copy(inverse.copy(m).invert());
  SHELTER.uShelterHalf.value.set(half.x, half.y, half.z);
  SHELTER.uShelterOn.value = 1;
}

/** No cabin round the lens: the snow drawn everywhere. */
export function shelterOff(): void {
  SHELTER.uShelterOn.value = 0;
}
