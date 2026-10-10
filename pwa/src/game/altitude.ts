// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW HIGH HE IS — the one place a point's height above the sea is read
// for the player (the HUD's ALT, the balloon's and the snowmobile's
// gauges), and the ski area's BASE it is measured against beside it.
//
// On a dealt mountain the altitude is the map's own: a point's height less
// the sea's (`Mountain.sea`, R25). On a map raised on a REAL FACE
// (`Level.face`) it is the REAL altitude of the spot: the elevation model's
// height at that point of the face (`faceHeight` — the map's square IS the
// face's window, so a map point is the real point), plus whatever he stands
// over the snow there (in the air, a balloon's height). The map's own
// heights are the face stretched to R25's vertical and its relief calmed
// (`massif.ts`'s `readFace` / `faceLift`), so its sea-relative height would
// read a made-up mountain; the real one's is what a watch would read
// standing there. A run's vertical stays as skied —
// only a height above the sea is read this way.
//
// THE BASE is the foot of the ski area's lowest lift — its valley station
// — read the same way, so the readout beside the altitude is the altitude
// less it. A map with no lifts has none.
//
// Presentation only: it reads the map and the loaded face, writes nothing,
// and moves no digest. DOM-free.

import { faceHeight, realFace, realFaceLoaded, type Level, type RealFace } from "@engine";

/** The face a map was raised on, when it is in hand; null on a dealt map
 * (and, defensively, on a face map whose heights are not loaded — the
 * map's own height is read then). */
function faceOf(level: Level): RealFace | null {
  const id = level.face;
  if (!id || !realFaceLoaded(id)) return null;
  return realFace(id);
}

/** The height above the sea, m, of the point (`x`, `y`, `z`) of `level`'s
 * frame — the real altitude on a real face, the map's own on a dealt one;
 * null on a map that publishes no mountain. */
export function altitudeAt(level: Level, x: number, y: number, z: number): number | null {
  const mountain = level.mountain;
  if (!mountain) return null;
  const face = faceOf(level);
  if (!face) return y - mountain.sea;
  return faceHeight(face, x, z) + (y - level.groundAt(x, z));
}

const bases = new WeakMap<Level, number | null>();

/** THE BASE's altitude, m — the lowest of the ski area's lifts' bottom
 * stations, read as `altitudeAt` reads any point; null on a map with no
 * lifts or no mountain. Read once a map. */
export function baseAltitude(level: Level): number | null {
  if (bases.has(level)) return bases.get(level)!;
  let low: number | null = null;
  for (const lift of level.resort?.lifts ?? []) {
    const b = lift.bottom;
    const h = altitudeAt(level, b.x, b.y, b.z);
    if (h !== null && (low === null || h < low)) low = h;
  }
  // A face loaded after the map was read once is read again next time.
  if (!level.face || faceOf(level)) bases.set(level, low);
  return low;
}

/** How far the point stands over the base, m (negative under it), or null
 * where there is no base. */
export function overBase(level: Level, x: number, y: number, z: number): number | null {
  const base = baseAltitude(level);
  const here = altitudeAt(level, x, y, z);
  return base === null || here === null ? null : here - base;
}
