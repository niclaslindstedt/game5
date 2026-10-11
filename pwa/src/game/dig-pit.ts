// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOLE DUG DOWN TO A BURIED SKIER, AS DRAWN (`avalanche-rescue.ts`'s
// `Burial.dug`). Rescuers do not dig straight down on the probe: they
// start a little downhill of it and cut in toward it, so the hole is a
// slot about as wide as a man's shoulders and a half, with a steep wall on
// the uphill side over the body, a level floor over him and a RAMP up the
// downhill side the snow is thrown out along — the longer the deeper he
// lies. Three-free: the shape a pure function of the burial and the drawn
// snow's height, so the suite reads it and `patrol-view.ts` writes it into
// a mesh. The snow inside the slot is cut away by the ground's shader
// (`room-cuts.ts`'s `setHoleCuts`) with the same rectangle.

/** The slot's numbers, m: half its width; how far the uphill wall stands
 * behind the body; the floor's length past it; the ramp's run per metre
 * dug (its slope about 30°); the least of the drawn snow's depth a full
 * dig is taken to; the walls' lip over the snow; and the colours of the walls and the floor — snow in
 * its own shade, the deeper the bluer. */
export const PIT = {
  half: 0.75,
  behind: 0.7,
  floor: 0.5,
  ramp: 1.7,
  least: 0.4,
  lip: 0.05,
  wall: [0.4, 0.5, 0.68],
  deep: [0.16, 0.24, 0.42],
  floorTint: [0.26, 0.34, 0.52],
} as const;

/** What the pit is drawn off: where the body lies, how deep, how much is
 * dug, and the fall line there (a unit vector, downhill). */
export type PitBurial = { x: number; z: number; depth: number; dug: number };

/** The slot's rectangle — its middle, heading (down the fall line) and
 * half width and half length — the same the ground cuts out. */
export type PitCut = { x: number; z: number; heading: number; hw: number; hd: number };

/** Stations along the slot, from the uphill wall (u < 0) to the ramp's top. */
const STATIONS = 4;
/** Triangles: the floor and two side walls a span, and the uphill wall. */
export const PIT_TRIANGLES = (STATIONS - 1) * 3 * 2 + 2;
export const PIT_VERTS = PIT_TRIANGLES * 3;

/** The ramp's top, m down the fall line from the body. */
function rampEnd(dug: number): number {
  return PIT.floor + PIT.ramp * Math.max(0.15, dug);
}

/** The cut for burial `b` on fall line (`fx`, `fz`), into `out`. */
export function pitCut(b: PitBurial, fx: number, fz: number, out: PitCut): PitCut {
  const end = rampEnd(Math.min(b.dug, b.depth));
  const mid = (end - PIT.behind) / 2;
  out.x = b.x + fx * mid;
  out.z = b.z + fz * mid;
  out.heading = Math.atan2(fx, fz);
  out.hw = PIT.half;
  out.hd = (end + PIT.behind) / 2;
  return out;
}

/**
 * THE PIT'S TRIANGLES for burial `b`, written into `pos` (x, y, z a
 * vertex) and `col` (r, g, b), `PIT_VERTS` of them. `surface` is the drawn
 * snow's height at a point and `lift` the drawn debris's depth over the
 * engine's ground there: a full dig goes down through all of it, to where
 * the body lies, a part dig the same share of the way.
 */
export function pitShape(
  b: PitBurial,
  fx: number,
  fz: number,
  surface: (x: number, z: number) => number,
  lift: (x: number, z: number) => number,
  pos: Float32Array,
  col: Float32Array,
): void {
  const share = b.depth > 0 ? Math.min(1, b.dug / b.depth) : 1;
  const down = share * Math.max(PIT.least, lift(b.x, b.z));
  const end = rampEnd(Math.min(b.dug, b.depth));
  // Across the fall line, to the right going down.
  const rx = fz;
  const rz = -fx;
  const us = [-PIT.behind, PIT.floor, (PIT.floor + end) / 2, end];
  const depthAt = (k: number): number => (k <= 1 ? down : k === 2 ? down / 2 : 0);
  // Each station's rim and floor, either side: [k][side] → x, z, rim, floor.
  const at = (k: number, side: number) => {
    const x = b.x + fx * us[k] + rx * side * PIT.half;
    const z = b.z + fz * us[k] + rz * side * PIT.half;
    const top = surface(x, z);
    // The walls stand a lip over the snow, so no seam opens where the
    // ground's own mesh runs a little high between its vertices.
    return { x, z, rim: top + PIT.lip, floor: top - depthAt(k) };
  };
  let v = 0;
  const put = (x: number, y: number, z: number, c: readonly number[]): void => {
    pos[v * 3] = x;
    pos[v * 3 + 1] = y;
    pos[v * 3 + 2] = z;
    col[v * 3] = c[0];
    col[v * 3 + 1] = c[1];
    col[v * 3 + 2] = c[2];
    v++;
  };
  // A wall's colour by how far below the rim a corner lies: the deeper,
  // the bluer and darker, as snow is in its own shadow.
  const shade = (below: number): number[] => {
    const t = Math.min(1, below / 1.2);
    return PIT.wall.map((w, i) => w + (PIT.deep[i] - w) * t);
  };
  const quad = (
    a: [number, number, number],
    b2: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
    ca: readonly number[],
    cb: readonly number[],
    cc: readonly number[],
    cd: readonly number[],
  ): void => {
    put(...a, ca);
    put(...b2, cb);
    put(...c, cc);
    put(...b2, cb);
    put(...d, cd);
    put(...c, cc);
  };
  for (let k = 0; k < STATIONS - 1; k++) {
    const l0 = at(k, -1);
    const r0 = at(k, 1);
    const l1 = at(k + 1, -1);
    const r1 = at(k + 1, 1);
    // The floor.
    quad(
      [l0.x, l0.floor, l0.z],
      [r0.x, r0.floor, r0.z],
      [l1.x, l1.floor, l1.z],
      [r1.x, r1.floor, r1.z],
      PIT.floorTint,
      PIT.floorTint,
      PIT.floorTint,
      PIT.floorTint,
    );
    // The two side walls, rim down to floor.
    for (const [p0, p1] of [
      [l0, l1],
      [r0, r1],
    ] as const) {
      quad(
        [p0.x, p0.rim, p0.z],
        [p1.x, p1.rim, p1.z],
        [p0.x, p0.floor, p0.z],
        [p1.x, p1.floor, p1.z],
        PIT.wall,
        PIT.wall,
        shade(p0.rim - p0.floor),
        shade(p1.rim - p1.floor),
      );
    }
  }
  // The uphill wall over the body.
  const l = at(0, -1);
  const r = at(0, 1);
  quad(
    [l.x, l.rim, l.z],
    [r.x, r.rim, r.z],
    [l.x, l.floor, l.z],
    [r.x, r.floor, r.z],
    PIT.wall,
    PIT.wall,
    shade(l.rim - l.floor),
    shade(r.rim - r.floor),
  );
}
