// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE AS TRACED — the mountain class's silhouette, taken off a
// studio photograph of a long-track mountain machine seen square from the
// side (and its front and rear widths off the views beside it), traced
// point by point, drawn back over the photograph to check the line, and
// scaled by the class's published length. No make or model is kept: what is
// kept is the SHAPE of the class, in metres. The sibling sled game's trace
// of the same class, carried over whole.
//
// It is stated in the TRACE'S OWN FRAME: z forward from the rearmost point
// of the tunnel, y up from the snow under the belt. `SLED.trace` carries it
// onto the engine's body frame (x right, y up, z forward, the origin at the
// centre of gravity): the traced spindle stands on the physics' ski line
// and the traced rear idler on the belt's end (`sledFrame`).
//
//   hood           the cowl as one closed outline: the nose at the bumper,
//                  over the hood to the dash, down the side panel, forward
//                  along the belly
//   grip, post     the right grip and the steering post's foot; the bar's
//                  width and a mountain machine's loop over its middle
//   seat           the seat's top line, back to front, over `seatBase`
//   tailbox        the pack behind the seat
//   tunnel*        the tunnel's top and bottom edges, and its width
//   ski, spindle   one ski's profile, tail to tip, and its spindle
//   trackUp        the belt's upper run climbing from the rear idler
//   idler, sprocket, contact   the rear wheel, the drive, the belt's run
//   boards         the running boards' stretch
//   lamps          the headlamps' pair: their spread, height and place
//
// Three-free and DOM-free: the Blender builder is handed it
// (`scripts/blender/kinds/sled.mjs`), and `tests/sled_test.ts` holds it to
// the engine's table.

import { SLED } from "@engine";

type P = [number, number];

export type SledLook = {
  hood: P[];
  hoodWidth: number;
  noseWidth: number;
  screen: null;
  grip: P;
  post: P;
  barWidth: number;
  handle: { width: number; height: number };
  seat: P[];
  seatBase: number;
  tailbox: P[];
  tunnelTop: P[];
  tunnelBottom: P[];
  tunnelWidth: number;
  ski: P[];
  spindle: P[];
  trackUp: P[];
  contact: P;
  idler: { at: P; radius: number };
  sprocket: { at: P; radius: number };
  boards: { from: number; to: number; open: boolean };
  taillight: P[];
  lamps: { width: number; y: number; z: number };
  bumperWidth: number;
};

export const SLED_LOOK: SledLook = {
  hood: [
    [2.86, 0.629],
    [2.604, 0.867],
    [2.494, 0.991],
    [2.397, 1.045],
    [2.277, 1.044],
    [1.827, 0.896],
    [1.654, 0.792],
    [1.684, 0.336],
    [1.885, 0.283],
    [2.281, 0.285],
    [2.323, 0.475],
    [2.59, 0.357],
    [2.903, 0.581],
  ],
  hoodWidth: 0.65,
  noseWidth: 0.4,
  screen: null,
  grip: [1.978, 1.135],
  post: [2.044, 0.978],
  barWidth: 0.74,
  handle: { width: 0.14, height: 0.09 },
  seat: [
    [1.144, 0.817],
    [1.302, 0.807],
    [1.464, 0.796],
    [1.649, 0.792],
  ],
  seatBase: 0.623,
  tailbox: [
    [0.852, 0.593],
    [0.857, 0.783],
    [1.139, 0.8],
  ],
  tunnelTop: [
    [0.0, 0.665],
    [0.081, 0.736],
    [0.434, 0.667],
    [0.852, 0.593],
  ],
  tunnelBottom: [
    [0.201, 0.617],
    [0.798, 0.506],
    [1.412, 0.351],
    [1.684, 0.336],
  ],
  tunnelWidth: 0.42,
  ski: [
    [2.157, 0.111],
    [2.228, 0.035],
    [2.787, 0.032],
    [3.014, 0.098],
    [3.22, 0.208],
  ],
  spindle: [
    [2.536, 0.14],
    [2.481, 0.34],
  ],
  trackUp: [
    [0.083, 0.291],
    [0.668, 0.478],
  ],
  contact: [0.22, 1.522],
  idler: { at: [0.084, 0.182], radius: 0.109 },
  sprocket: { at: [1.711, 0.364], radius: 0.098 },
  boards: { from: 1.195, to: 1.928, open: true },
  taillight: [
    [0.217, 0.644],
    [0.472, 0.613],
  ],
  lamps: { width: 0.27, y: 0.74, z: 2.76 },
  bumperWidth: 0.4,
};

/** THE TRACE ON THE BODY FRAME: a trace point (z, y) as the engine's body
 * frame has it — shifted by `SLED.trace`, so the spindle stands on the ski
 * line and the idler on the belt's end. */
export function sledFrame(p: P): P {
  return [p[0] - SLED.trace.z, p[1] - SLED.trace.y];
}
