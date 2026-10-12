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
//
// A part is never WAITED ON for good. Three's wait polls each program's
// completion status, which a lost context never reports — a phone that took
// the GPU back mid-load would leave the loading card up until the context
// came back, and longer if it never did. So a part is let go once the
// context is lost or `PART_LIMIT_MS` has passed: whatever is not compiled
// then is compiled at its first draw, as it would be without this at all.

import type * as THREE from "three";

/** The longest one part is waited on, ms. */
export const PART_LIMIT_MS = 15_000;
/** How often a part's wait looks at the context, ms. */
const LOOK_MS = 100;

/** Resolves once `gl`'s context is lost or `limit` ms have passed — or
 * never, if `done` is called first. */
function giveUp(gl: THREE.WebGLRenderer, limit: number): { at: Promise<void>; done: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const at = new Promise<void>((resolve) => {
    const start = performance.now();
    const look = (): void => {
      if (gl.getContext().isContextLost() || performance.now() - start >= limit) resolve();
      else timer = setTimeout(look, LOOK_MS);
    };
    timer = setTimeout(look, LOOK_MS);
  });
  return { at, done: () => clearTimeout(timer) };
}

/** `work` (a compile three waits on) waited on no longer than the context
 * lives and `limit` ms (`PART_LIMIT_MS`) pass. */
export async function compiled(
  gl: THREE.WebGLRenderer,
  work: Promise<unknown>,
  limit = PART_LIMIT_MS,
): Promise<void> {
  const stop = giveUp(gl, limit);
  await Promise.race([work, stop.at]);
  stop.done();
}

export async function compileByParts(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  live: () => boolean,
): Promise<void> {
  for (const part of [...scene.children]) {
    if (!live()) return;
    await compiled(gl, gl.compileAsync(part, camera, scene));
  }
}
