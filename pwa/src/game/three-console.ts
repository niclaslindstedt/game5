// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THREE'S CONSOLE, A LINE ONCE. three warns from inside its draw loop, and a
// warning about a program is made again at every draw of it: the ground's
// program holds more samplers than the fragment stage counts (its vertex
// stage reads two of them, which the context's combined count allows), so
// three warned of it at every draw of every level of the ground, every
// frame — a console call a draw, which a browser with an inspector attached
// formats and keeps. Each distinct line is passed on the first time only.

import * as THREE from "three";

let quiet = false;

export function quietThree(): void {
  if (quiet) return;
  quiet = true;
  const seen = new Set<string>();
  THREE.setConsoleFunction((type: string, message: string, ...rest: unknown[]) => {
    if (seen.has(message)) return;
    seen.add(message);
    if (type === "error") console.error(message, ...rest);
    else if (type === "warn") console.warn(message, ...rest);
    else console.log(message, ...rest);
  });
}
