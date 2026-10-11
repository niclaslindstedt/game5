// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS AS THE HANDS MOVE IT, wired: the drags that look round (a finger
// on the lift's rope, a mouse held on any run — `lift-gaze.ts`) handed to
// the renderer, and the camera's presses — C, G and the wheel
// (`settings.ts`'s `createCameraPresses`) — stored as the skier's rung and
// put on the lens while a race is on screen. Kept out of `App.tsx`, whose
// business is which surface is up.

import type { InputManager } from "./input.ts";
import type { WorldRenderer } from "./renderer-api.ts";
import { createCameraPresses, type Settings } from "./settings.ts";
import { hudOver, type Shell } from "./shell.ts";

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
    () => settings.current.camera,
    (next) => {
      setSettings((s) => ({ ...s, camera: next }));
      if (hudOver(shell.current)) renderer.setCamera(next, false, true);
    },
  );
  // THE WHEEL: a rung further out or in along the ladder, on a run.
  manager.onZoom((dir) => shell.current === "run" && cams.zoom(dir));
  return cams;
}
