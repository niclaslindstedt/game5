// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SCENE'S PROGRAMS COMPILED A PART AT A TIME, never the whole of it at once.
//
// The first time a phone meets a kind of ride (the snowboard, the plane)
// none of its programs is in the browser's shader cache, and every one of
// them compiling side by side is a peak of the driver's memory that has
// had the tab killed and the page reloaded — while the second start, its
// programs cached, went through. One part of the scene after another is the
// same work with a fraction of it in flight; each part is still compiled
// against the whole scene, so its lights and fog are the ones it is drawn
// under. Where the driver cannot compile in the background, three blocks
// on each part in turn, with the page's thread handed back between them.

import type * as THREE from "three";

export async function compileByParts(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  live: () => boolean,
): Promise<void> {
  for (const part of [...scene.children]) {
    if (!live()) return;
    await gl.compileAsync(part, camera, scene);
  }
}
