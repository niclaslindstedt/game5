// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TITLE SCENE'S PLATES: what the key art is published as and what it
// is made from. The scene is path-traced in Blender (`make title-scene`:
// `scripts/blender/title.py` over `kinds/title.mjs`) and published here by
// `scripts/title-plates.mjs`; the title stage composites the plates live.
// DOM-free and import-free, so the publisher, the suite
// (`tests/title_scene_test.ts`) and the stage read one list.
//
//   title-colour.webp  the frame, 2048², the view transform baked
//   title-aux.webp     1024² RGBA: R depth (log, `depth` in the JSON),
//                      G sparkle (the sunlit snow), B sky, A glow (the
//                      spray and the backlit rims)
//   title-plate.json   the frame's facts, projected through the lens: the
//                      sun, the ridge, the spray's emitter, the subject, the
//                      safe crops and the camera (`TitlePlate`)
//   sources.json       the stamp: the hash of every source below

/** Where the plates are committed, from the repository's root. */
export const TITLE_DIR = "pwa/src/title";

/** Each published plate and its byte budget. */
export const TITLE_PLATES = {
  "title-colour.webp": { size: 2048, budget: 750 * 1024 },
  "title-aux.webp": { size: 1024, budget: 220 * 1024 },
} as const;

/** Every file the plates are made from, from the repository's root: the
 * lab's driver and shelf, the scene's builder and its kind, the skier as
 * the game dresses him (the exporter, the loom and every piece cut on it,
 * the kit, the body, the helmet) and his rig, the carve he is posed from,
 * the palette, the mark cut into the snow, the woods, and the committed
 * pair he rides. A
 * change to any of them leaves the stamp stale until the scene is
 * rendered again. */
export const TITLE_SOURCES = [
  "scripts/blender.mjs",
  "scripts/blender/lib.py",
  "scripts/dressed-skier.mjs",
  "scripts/blender/kinds/title.mjs",
  "scripts/blender/title.py",
  "scripts/blender/title_world.py",
  "scripts/blender/title_rider.py",
  "scripts/blender/title_spray.py",
  "scripts/blender/title_plates.py",
  "scripts/lib/skier-moves.mjs",
  "scripts/lib/skier-trace.mjs",
  "pwa/src/identity.ts",
  "pwa/src/game/outfit.ts",
  "pwa/src/game/dress.ts",
  "pwa/src/game/dress-loft.ts",
  "pwa/src/game/dress-garments.ts",
  "pwa/src/game/dress-head.ts",
  "pwa/src/game/dress-body.ts",
  "pwa/src/game/helmet-shape.ts",
  "pwa/src/game/skier-pose.ts",
  "pwa/src/game/skier-rig.ts",
  "pwa/src/game/app-mark.ts",
  "pwa/src/game/tree-variants.ts",
  "pwa/models/chamois.glb",
] as const;

/** A crop of the square plate, as shares of it: `[x, y, w, h]`. */
export type PlateRect = [number, number, number, number];

/** What `title-plate.json` holds. Every point is in plate UV (0..1, v down
 * from the top); a point off the plate (the sun above the frame) may fall
 * outside it. */
export type TitlePlate = {
  /** The colour plate's side and the aux plate's, px. */
  size: number;
  aux: number;
  /** The sun's disc, and its elevation, degrees. */
  sun: [number, number];
  sunElevation: number;
  /** The skyline left to right, `[u, v, depth]` (depth as the aux's R). */
  ridge: [number, number, number][];
  /** Where the frozen spray's grains breathe from, and how far, in UV. */
  spray: { uv: [number, number]; radius: number };
  /** The skier's centre of gravity. */
  subject: [number, number];
  /** The safe crops: a 16:9 band and a 9:19.5 column. */
  crops: { landscape: PlateRect; portrait: PlateRect };
  /** The lens: its focal length and sensor, mm, and its f-number. */
  camera: { lens: number; sensor: number; fstop: number };
  /** How the aux's R maps to metres: `near * (far / near) ** r`. */
  depth: { near: number; far: number; scale: "log" };
};
