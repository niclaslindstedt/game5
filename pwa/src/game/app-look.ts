// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS AS THE HANDS MOVE IT, wired: the drags that look round (a finger
// on the lift's rope, a mouse held on any run — `lift-gaze.ts`) handed to
// the renderer, and the camera's presses — C, G and the wheel
// (`settings.ts`'s `createCameraPresses`) — stored as the rung of where he
// is seen now (his own, or his machine's) and put on the lens while a race is on screen. Kept out of `App.tsx`, whose
// business is which surface is up.

import type { InputManager } from "./input.ts";
import type { WorldRenderer } from "./renderer-api.ts";
import type { CameraRung } from "./renderer-api.ts";
import { createCameraPresses, type Settings } from "./settings.ts";
import { cameraFor, hudOver, type Shell } from "./shell.ts";

/** The lens put on the rungs `s` keeps for `shell` — his own and his
 * machines' (the menus' orbit for both off a run). */
export function showCameras(renderer: WorldRenderer, shell: Shell, s: Settings): void {
  renderer.setCamera(cameraFor(shell, s.camera), false, undefined, cameraFor(shell, s.craftCamera));
}

/** `s` with `rung` stored where he is seen now: on his machine's rung while
 * he rides one (`riding`), else his own. */
export function withRung(s: Settings, rung: CameraRung, riding: boolean): Settings {
  return riding ? { ...s, craftCamera: rung } : { ...s, camera: rung };
}

export function wireLook(
  manager: InputManager,
  renderer: WorldRenderer,
  settings: { readonly current: Settings },
  setSettings: (update: (s: Settings) => Settings) => void,
  shell: { readonly current: Shell },
): ReturnType<typeof createCameraPresses> {
  manager.onLook((dx, dy, mouse) => renderer.lookAround(dx, dy, mouse));
  manager.onLookHold((on) => renderer.holdLook(on));
  const cams = createCameraPresses(
    () => (renderer.riding() ? settings.current.craftCamera : settings.current.camera),
    (next) => {
      const s = withRung(settings.current, next, renderer.riding());
      setSettings(() => s);
      if (hudOver(shell.current)) renderer.setCamera(s.camera, false, true, s.craftCamera);
    },
  );
  // THE WHEEL: a rung further out or in along the ladder, on a run.
  manager.onZoom((dir) => shell.current === "run" && cams.zoom(dir));
  return cams;
}
