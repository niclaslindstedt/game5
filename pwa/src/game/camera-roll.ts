// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROLL A LENS IS LAID ON WITH — three-free, so the suite reads it. The
// engine's roll is RIGHT SIDE DOWN in its own axes, and the renderer maps
// those axes straight onto three.js's frame, whose view from behind MIRRORS
// them (`input-model.ts`'s sign boundary): his right is the screen's left.
// So a lens never banks by the engine's `roll` read as an angle — it is
// stood the right way up for an UP stated in the world (`rollFor`), which
// is what `aimLens` lays on, and a lens bolted to his body stands up for his
// body's own up (`boltedUp`), so the horizon tips the way his head does.

type Vec = { x: number; y: number; z: number };

/** THE ROLL that stands a lens looking along `f` (world; scaled to unit
 * here) the right way up for `up` (world), as `aimLens` lays it on: the
 * angle from the up a level lens would have to `up`, about the look. */
export function rollFor(f: Vec, up: Vec): number {
  const fl = Math.hypot(f.x, f.y, f.z) || 1;
  const fx = f.x / fl;
  const fy = f.y / fl;
  const fz = f.z / fl;
  // A level lens's right is the look crossed with the world's up, and its
  // up the right crossed with the look.
  let rx = -fz;
  let rz = fx;
  const rl = Math.hypot(rx, rz);
  if (rl < 1e-6) return 0;
  rx /= rl;
  rz /= rl;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  return Math.atan2(up.x * rx + up.z * rz, up.x * ux + up.y * uy + up.z * uz);
}

/** `v` swung `a` rad about the world's up, toward +x (his right) — the
 * head turned into the turn. In place. */
export function yawBy(v: Vec, a: number): Vec {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = v.x * c + v.z * s;
  v.z = v.z * c - v.x * s;
  v.x = x;
  return v;
}

/** THE UP OF A LENS BOLTED TO HIM, in his body frame: square to a look
 * `look` m ahead and `dip` m down off his forward axis — the top of his
 * own field of view, tipped forward with the look. */
export function boltedUp(look: number, dip: number): Vec {
  return { x: 0, y: look, z: dip };
}
