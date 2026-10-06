// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MACHINE TAPPED ON SCREEN: a tap or a click that lands on the
// snowmobile or the helicopter, while the skier is close enough to get on
// (`sledWithin`, `heliWithin`), is the machine press — ENTER's. The ray the
// tap casts is the renderer's (`WorldRenderer.pickRay`); what it hits is
// decided here, three-free and DOM-free, against a few balls traced down
// each machine's body. The listener the app hangs on the page is
// `machine-tap.ts`'s.

import { type GameState, heliWithin, sledWithin } from "@engine";

type Vec = { x: number; y: number; z: number };

/** A ray in the world, `d` of unit length. */
export type PickRay = { o: Vec; d: Vec };

/** The balls a tap must land in, down each machine's centre line: `z`
 * fore of its datum and `y` over it, m, and the radius — the body traced
 * in a few balls (the snowmobile about 3.3 m nose to tunnel; the
 * helicopter's cabin, then its boom out to the fin), each a fingertip's
 * `SLACK` past the body so a tap need not be exact. */
export const PICK = {
  sled: [
    { z: 0.8, y: 0.6, r: 1.0 },
    { z: -0.8, y: 0.6, r: 1.0 },
  ],
  heli: [
    { z: 1.2, y: 1.6, r: 1.9 },
    { z: -1.6, y: 1.7, r: 1.5 },
    { z: -4.2, y: 1.9, r: 1.0 },
    { z: -6.4, y: 2.2, r: 1.2 },
  ],
} as const;

const SLACK = 0.4;

/** Whether the ray lands on a machine at (x, y, z) facing `heading`. */
function hitsBody(
  ray: PickRay,
  at: Vec,
  heading: number,
  balls: readonly { z: number; y: number; r: number }[],
): boolean {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  return balls.some((b) =>
    rayHitsBall(ray, { x: at.x + fx * b.z, y: at.y + b.y, z: at.z + fz * b.z }, b.r + SLACK),
  );
}

/** Whether a ray passes within `r` of `c`, in front of its origin. */
export function rayHitsBall(ray: PickRay, c: Vec, r: number): boolean {
  const ox = c.x - ray.o.x;
  const oy = c.y - ray.o.y;
  const oz = c.z - ray.o.z;
  const along = ox * ray.d.x + oy * ray.d.y + oz * ray.d.z;
  if (along < 0) return false;
  const off = ox * ox + oy * oy + oz * oz - along * along;
  return off <= r * r;
}

/** Which machine a tap's ray takes him onto, or null — only one he can get
 * on now, never one merely in the picture. */
export function machineHit(state: GameState, ray: PickRay): "sled" | "heli" | null {
  const s = state.sled;
  if (s && sledWithin(state) && hitsBody(ray, s, s.heading, PICK.sled)) return "sled";
  const h = state.heli;
  if (h && heliWithin(state) && hitsBody(ray, h, h.heading, PICK.heli)) return "heli";
  return null;
}
