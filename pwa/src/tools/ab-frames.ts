// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INTERLEAVED A/B a lab times (`make world ARGS="--frames=n --ab=..."`):
// each frame drawn whole or without one part in turn (`HIDEABLE`), each
// timed to the finish, so the machine's drift between two readings is shared
// by all of them. Under the software rasteriser a reading is a SHARE of the
// frame, never a phone's milliseconds.

import type { Hideable } from "../game/benchmark-report.ts";
import type { WorldRendererExt } from "../game/renderer-api.ts";

/** The mean ms a frame, whole ("(nothing)") and without each part. */
export function abFrames(
  renderer: WorldRendererExt,
  frame: () => void,
  frames: number,
  parts: readonly Hideable[],
): Record<string, number> {
  const gl = renderer.gl.getContext();
  const cycle: (Hideable | "")[] = ["", ...parts];
  const sum: Record<string, number> = {};
  for (const part of cycle) sum[part || "(nothing)"] = 0;
  for (let i = 0; i < frames; i++) {
    for (const part of cycle) {
      renderer.setHidden(part ? [part] : []);
      gl.finish();
      const t0 = performance.now();
      frame();
      gl.finish();
      sum[part || "(nothing)"] += performance.now() - t0;
    }
  }
  renderer.setHidden([]);
  for (const k of Object.keys(sum)) sum[k] /= frames;
  return sum;
}
