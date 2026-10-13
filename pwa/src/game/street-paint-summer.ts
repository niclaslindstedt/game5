// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S STREETS IN SUMMER, PAINTED IN CODE — the same three
// surfaces `street-paint.ts` paints for the winter, laid on the same tiles
// (`street-plan.ts`'s `TILE`), as a mountain village's streets look with
// the snow gone (`docs/buildings.md`, "The village and its streets"):
//
//   * ROAD — grey asphalt, a lane and its strip to the kerb across (u 0
//     the crown, ½ the lane's edge, 1 the kerb): the wheel tracks polished
//     a shade darker, the aggregate's speckle, a patch or two of newer
//     tar and a sealed crack, a DASHED CENTRE LINE at the crown (each lane
//     paints its half of it, so the two meet into one) and the line along
//     the lane's edge, both worn;
//   * AREA — the car park's and the junctions' asphalt, oil spots under
//     where the cars stand, the tyres' scuffs;
//   * WALK — the sidewalk's and the square's granite setts, bare, dust in
//     the joints and a weed here and there.
//
// Tiles as the winter's do. sRGB 0..255 RGBA, three-free.

import { fbm, hash, mix, noise, put, smooth, type Paint } from "./street-paint.ts";
import { TILE } from "./street-plan.ts";

/** The colours, sRGB: the asphalt, its worn and its polished tone, a
 * newer patch, a crack's seal, the paint, an oil spot, a sett, the dust in
 * a joint and a weed. */
const ASPHALT = [84, 86, 90];
const WORN = [112, 112, 112];
const POLISHED = [66, 68, 72];
const PATCH = [52, 54, 58];
const SEAL = [34, 35, 38];
const PAINT = [226, 226, 218];
const OIL = [48, 46, 46];
const SETT = [142, 140, 138];
const DUST = [118, 108, 92];
const WEED = [92, 118, 62];

/** The asphalt's own speckle: a coarse aggregate a texel or two across,
 * pale and dark. */
function aggregate(c: number[], x: number, y: number, salt: number): number[] {
  const h = hash(x, y, salt);
  if (h > 0.35) return c;
  return mix(c, hash(x, y, salt + 1) < 0.5 ? [150, 148, 144] : [44, 45, 48], 0.25 * (h / 0.35));
}

/** THE ROAD in summer: `width` px across a lane and its strip, `height` px
 * along `TILE.road` m. */
export function paintSummerRoad(width = 128, height = 512): Paint {
  const data = new Uint8Array(width * height * 4);
  const lane = 3.2;
  const perM = height / TILE.road;
  for (let j = 0; j < height; j++) {
    const along = j / perM;
    for (let i = 0; i < width; i++) {
      const u = (i + 0.5) / width;
      const tone = fbm(i, j, 24, width, height, 51);
      let c = mix(ASPHALT, WORN, 0.15 + 0.45 * tone);
      if (u < 0.5) {
        const m = (u / 0.5) * lane;
        // The wheel tracks polished darker, a car's track apart.
        let track = 0;
        for (const r of [0.75, 2.35])
          track = Math.max(track, 1 - smooth(0.15, 0.4, Math.abs(m - r)));
        c = mix(c, POLISHED, track * 0.55);
        // THE DASHED CENTRE LINE: 3 m of paint in every 9, 0.12 m wide
        // across both lanes, its paint worn by the tyres that cross it.
        const dash = along % 9 < 3 ? 1 : 0;
        const line = dash * (1 - smooth(0.04, 0.07, m));
        // The lane's edge line, whole, 0.1 m wide.
        const edge = 1 - smooth(0.04, 0.06, Math.abs(m - 3.1));
        const wear = 0.6 + 0.4 * fbm(i, j, 6, width, height, 53);
        c = mix(c, PAINT, Math.max(line, edge) * wear);
      } else {
        // The strip to the kerb, rougher: a newer patch of tar now and then.
        const patch = smooth(0.62, 0.66, noise(i, j, 64, width, height, 55));
        c = mix(c, PATCH, patch * 0.8);
      }
      // A sealed crack wandering across.
      const crack = Math.abs(noise(i, j, 96, width, height, 57) - 0.5);
      if (crack < 0.008) c = mix(c, SEAL, 0.7);
      c = aggregate(c, i, j, 59);
      put(data, j * width + i, c);
    }
  }
  return { width, height, data };
}

/** THE CAR PARK'S ASPHALT in summer: `size` px square over `TILE.area` m —
 * oil spots and tyre scuffs over the grey. */
export function paintSummerArea(size = 256): Paint {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const tone = fbm(i, j, 32, size, size, 61);
      let c = mix(ASPHALT, WORN, 0.2 + 0.5 * tone);
      const oil = smooth(0.7, 0.78, noise(i, j, 20, size, size, 62));
      c = mix(c, OIL, oil * 0.5);
      const scuff = smooth(0.66, 0.72, fbm(i, j, 12, size, size, 63));
      c = mix(c, POLISHED, scuff * 0.4);
      const crack = Math.abs(noise(i, j, 80, size, size, 64) - 0.5);
      if (crack < 0.01) c = mix(c, SEAL, 0.6);
      c = aggregate(c, i, j, 65);
      put(data, j * size + i, c);
    }
  }
  return { width: size, height: size, data };
}

/** THE SIDEWALK in summer: `size` px square over `tile` m — the granite
 * setts bare, dust in the joints and a weed in one now and then. */
export function paintSummerWalk(size = 256, tile: number = TILE.walk): Paint {
  const data = new Uint8Array(size * size * 4);
  const perM = size / tile;
  const sett = 0.2 * perM;
  for (let j = 0; j < size; j++) {
    const row = Math.floor(j / sett);
    for (let i = 0; i < size; i++) {
      const shift = (row % 2) * sett * 0.5;
      const ci = Math.floor((i + shift) / sett);
      const fx = ((i + shift) % sett) / sett;
      const fy = (j % sett) / sett;
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
      const own = hash(ci, row, 71);
      let stone = mix(SETT, [176, 170, 162], own);
      stone = mix(stone, [110, 108, 108], 0.25 * fbm(i, j, 8, size, size, 72));
      const weed = hash(ci, row, 73) < 0.04;
      const joint = weed ? WEED : DUST;
      const c = mix(joint, stone, smooth(0.04, 0.12, edge));
      put(data, j * size + i, c);
    }
  }
  return { width: size, height: size, data };
}
