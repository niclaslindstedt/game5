// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE PICTURE COSTS — the dictionary between a row of OPTIONS ▸ PICTURE
// and the numbers the renderer builds with. DOM-free and three-free, so
// `tests/video_test.ts` reads the whole ladder without a browser, and
// `renderer.setVideo` is the one place a row becomes a draw call.
//
// EIGHT ROWS, BECAUSE THEY ARE EIGHT DIFFERENT BILLS. A phone can be short
// of pixels and rich in triangles, or the other way round, and one QUALITY
// knob would make it pay for the thing it can afford to save on the thing it
// cannot:
//
//   RESOLUTION  how many pixels: a share of the device's own pixel ratio.
//   DISTANCE    how far anything is drawn at all: the woods, and the ground's
//               clipmap cut to the view — with a MIST closing over the last
//               of it, the one row that changes the WEATHER, which is how the
//               cut-off stays out of sight. LOW is only what a skier needs
//               to ski; MAX alone draws the mountain to the summit ridge, unmisted.
//   TERRAIN     the ground's clipmap (`terrain.ts`): the near grid's pitch
//               and how many cells a level carries. Every stop reaches the
//               DISTANCE row's view, so a cheaper ground is a coarser one
//               and never a shorter one.
//   TRAILS      the trail maps (`trail-map.ts`): the fine window's texels and
//               span, the coarse map's texels — or OFF, which stamps nothing
//               and leaves the snow untouched.
//   FOREST      how far the full-detail band runs, how many of the far
//               band's sketches stand at all, and — under SHADOWS MEDIUM
//               and HIGH —
//               whether a tree casts its own crown or the sketch. Never WHICH trunks exist: the physics hits every
//               one of them, and a tree the skier can hit is always drawn.
//   SHADOWS     OFF, SKI_CATALOG (the machines, the skiers and the flags on a
//               tight map), MEDIUM (every tree's too, as far as the eye
//               needs them — each tree casting the shape the FOREST row
//               draws it in) or HIGH (MEDIUM, with every skier and his
//               machine cast into a fine map of their own).
//   SPRAY       the share of the roost, the ski spray and the puffs thrown.
//   ANTIALIAS   the canvas's multisampling. The one row that cannot be
//               changed under a running context: it is read when the canvas
//               is made, and the page says so.
//
// Every ladder runs CHEAPEST FIRST, so a skier hunting for frames always
// walks the same way. `VIDEO_PRESETS` are whole pictures a tier at a time —
// what the PRESET row presses and what the first-visit probe hands out
// (`video-probe.ts`) — and `presetOf` reads a picture back as the tier it
// is, or `custom` once any row has been moved off one.

/** A stop on a ladder of costs. */
export type Tier = "low" | "medium" | "high";
export const TIERS: readonly Tier[] = ["low", "medium", "high"];

/** SHADOWS: none, the machines alone, the machines and every tree, and
 * that again with every skier sharp in a map of his own. */
export type ShadowLevel = "off" | "skiers" | "medium" | "high";
export const SHADOW_LEVELS: readonly ShadowLevel[] = ["off", "skiers", "medium", "high"];

/** DISTANCE: the three tiers, and MAX — the whole mountain, no mist. */
export type DistanceLevel = Tier | "max";
export const DISTANCE_LEVELS: readonly DistanceLevel[] = [...TIERS, "max"];

export type TrailLevel = "off" | Tier;
export const TRAIL_LEVELS: readonly TrailLevel[] = ["off", ...TIERS];

export type VideoSettings = {
  resolution: Tier;
  distance: DistanceLevel;
  terrain: Tier;
  trails: TrailLevel;
  forest: Tier;
  shadows: ShadowLevel;
  spray: Tier;
  antialias: boolean;
};

/* ── What each stop buys ─────────────────────────────────────────────── */

/** RESOLUTION: the share of the device's pixel ratio the canvas is drawn at.
 * The top is the screen's own; the bottom is still more than half of it on
 * each axis, below which the HUD's crisp type sits over a picture that reads
 * as out of focus rather than as cheaper. */
export const RESOLUTION_SHARE: Record<Tier, number> = { low: 0.6, medium: 0.8, high: 1 };

/** How far out the ground reaches under DISTANCE MAX, m: past the basin's
 * rim from any corner of it, so the mountains are always ground and never a
 * hole with the sky in it. Every shorter stop closes its mist first. */
export const TERRAIN_REACH = 2800;

export type TerrainLook = {
  /** Cells a side per level (a multiple of 4). */
  n: number;
  /** Level 0's vertex spacing, m. */
  spacing: number;
  /** Levels, each double the last — derived, so every stop reaches the
   * view it is built for. */
  levels: number;
};

const TERRAIN_GRID: Record<Tier, { n: number; spacing: number }> = {
  // A 0.4 m pitch still shows a furrow as a trough, just a blunter one.
  low: { n: 96, spacing: 0.4 },
  medium: { n: 128, spacing: 0.3 },
  // The ground as it was tuned: a quarter-metre under the lens.
  high: { n: 192, spacing: 0.25 },
};

/** The clipmap a TERRAIN stop builds out to `reach` m — the DISTANCE row's
 * view (`DISTANCE_LOOK`), and no level more than it takes to get there. */
export function terrainLook(tier: Tier, reach: number = TERRAIN_REACH): TerrainLook {
  const { n, spacing } = TERRAIN_GRID[tier];
  let levels = 1;
  while ((n / 2) * spacing * 2 ** (levels - 1) < reach) levels++;
  return { n, spacing, levels };
}

/** How far out a clipmap's last level reaches, m. */
export function terrainReach(look: TerrainLook): number {
  return (look.n / 2) * look.spacing * 2 ** (look.levels - 1);
}

/** Roughly how many triangles a clipmap draws: level 0 whole, every level
 * after it a ring round the hole the finer one fills. */
export function terrainTriangles(look: TerrainLook): number {
  const full = 2 * look.n * look.n;
  const hole = look.n / 2 - 2;
  const ring = full - 2 * hole * hole;
  return full + (look.levels - 1) * ring;
}

export type TrailLook = {
  /** Whether a contact is stamped at all. */
  stamp: boolean;
  /** Fine window: texels a side, and metres a side. */
  fineSize: number;
  fineSpan: number;
  /** Coarse map texels a side (it spans the whole map). */
  coarseSize: number;
};

export const TRAIL_LOOK: Record<TrailLevel, TrailLook> = {
  // OFF still builds the smallest maps there are, so the ground's shader has
  // something to read — they are simply never written.
  off: { stamp: false, fineSize: 64, fineSpan: 64, coarseSize: 64 },
  low: { stamp: true, fineSize: 512, fineSpan: 64, coarseSize: 1024 },
  medium: { stamp: true, fineSize: 1024, fineSpan: 96, coarseSize: 1024 },
  high: { stamp: true, fineSize: 2048, fineSpan: 160, coarseSize: 2048 },
};

export type ForestLook = {
  /** The full-detail tree runs out to here, m; past it, the sketch. WHICH
   * trees cast is the SHADOWS row's (`SHADOW_LOOK`), never this band's, so
   * no shadow is switched on by riding closer to its tree. */
  full: number;
  /** The share of the far band's sketches that stand, 0..1. */
  farShare: number;
  /** THE SHAPE BUDGET: how many tree meshes the full band may draw —
   * shared out among the kinds a map grows by how many of their trees
   * stand on it, one to ten variants each (`tree-variants.ts`, the most
   * telling first). A mesh is a draw call; the far band and the casters
   * draw one shape a kind whatever this is. */
  shapes: number;
  /** What a tree casts under SHADOWS ALL: its own full-detail crown, or the
   * far band's sketch drawn a touch inside it (a quarter of the triangles
   * in the shadow pass, and it reads the same on the snow). */
  casters: TreeCasters;
};

export type TreeCasters = "full" | "sketch";

export const FOREST_LOOK: Record<Tier, ForestLook> = {
  low: { full: 90, farShare: 0.5, shapes: 12, casters: "sketch" },
  medium: { full: 130, farShare: 0.75, shapes: 28, casters: "sketch" },
  high: { full: 160, farShare: 1, shapes: 80, casters: "full" },
};

export type DistanceLook = {
  /** How far out a tree is drawn at all, m. Past it the ground's own forest
   * tint (`snow-glsl.ts`) carries the woods to the rim. */
  trees: number;
  /** How far out anything is drawn, m: the ground's clipmap reaches this and
   * no level further (`terrainLook`). */
  view: number;
  /** Whether a MIST closes on `view` (`hazeAmount` in `haze.ts`): clear
   * round the skis, thickening with the square of the distance, and whole
   * by the view — so the ground's edge and the last trees are never seen. */
  mist: boolean;
};

/** DISTANCE. The trees stop a little inside the view, where the mist is
 * nearly whole, so the woods thin into it rather than stopping at a line.
 * LOW is the course and what stands beside it — a few seconds ahead at
 * speed, and no more; MAX is the mountain to its summit ridge on the sky's own air. */
export const DISTANCE_LOOK: Record<DistanceLevel, DistanceLook> = {
  low: { trees: 250, view: 280, mist: true },
  medium: { trees: 540, view: 600, mist: true },
  high: { trees: 1100, view: 1300, mist: true },
  max: { trees: 1600, view: TERRAIN_REACH, mist: false },
};

/** The wall the mist closes on for a DISTANCE stop, m; 0 is no mist. */
export function mistFor(distance: DistanceLevel): number {
  const look = DISTANCE_LOOK[distance];
  return look.mist ? look.view : 0;
}

export type ShadowLook = {
  /** The key light's map, texels a side; 0 is no shadow at all. */
  size: number;
  /** How far round the shadow box's centre a shadow stands, m. The box is
   * this a side each way in the light's own frame; a shadow fades out over
   * the last `SHADOW_FADE` of it rather than stopping at a line. */
  reach: number;
  /** Whether the trees cast — every one whose shadow can land in reach. */
  trees: boolean;
  /** THE SKIERS' OWN MAPS (`hero-shadow.ts`), texels a side each: every
   * skier and his machine cast into a map a few metres across that follows
   * them, not into the wide one, whose texels are wider than an arm; 0
   * leaves them in the wide one. */
  hero: number;
};

/** SHADOWS. Under MEDIUM and HIGH, EVERY tree whose shadow can land in reach casts,
 * whatever band it is drawn in — so a shadow is never switched on by
 * riding closer to its tree. */
export const SHADOW_LOOK: Record<ShadowLevel, ShadowLook> = {
  off: { size: 0, reach: 0, trees: false, hero: 0 },
  // The field on a tight map: the sharpest shadow there is under the skiers for
  // almost nothing in the pass, and the snow under the woods left bare.
  skiers: { size: 1024, reach: 30, trees: false, hero: 0 },
  medium: { size: 2048, reach: 75, trees: true, hero: 0 },
  // The skiers sharp: millimetres a texel, where the wide map's are
  // centimetres — the one shadow in every frame.
  high: { size: 2048, reach: 75, trees: true, hero: 1024 },
};

/** SPRAY: the share of every emission rate, and of the particle pool. */
export const SPRAY_SHARE: Record<Tier, number> = { low: 0.35, medium: 0.65, high: 1 };

/* ── Whole pictures ──────────────────────────────────────────────────── */

/** A whole picture a tier at a time. ANTIALIAS is not in it: it is a fact
 * about the canvas rather than a cost the probe weighs, and a preset that
 * moved it would be a press that did nothing until the next visit. */
export const VIDEO_PRESETS: Record<Tier, Omit<VideoSettings, "antialias">> = {
  low: {
    resolution: "medium",
    distance: "low",
    terrain: "low",
    trails: "low",
    forest: "low",
    shadows: "off",
    spray: "low",
  },
  medium: {
    resolution: "high",
    distance: "medium",
    terrain: "medium",
    trails: "medium",
    forest: "medium",
    shadows: "medium",
    spray: "medium",
  },
  high: {
    resolution: "high",
    distance: "high",
    terrain: "high",
    trails: "high",
    forest: "high",
    shadows: "high",
    spray: "high",
  },
};

/** The picture a first visit opens on: the design point, which the probe
 * then moves up or down once it has timed this machine drawing it. */
export const DEFAULT_VIDEO: VideoSettings = { ...VIDEO_PRESETS.medium, antialias: true };

export type PresetLevel = Tier | "custom";

/** Which preset a picture IS — or `custom` once any row is off every one. */
export function presetOf(video: VideoSettings): PresetLevel {
  for (const tier of TIERS) {
    const p = VIDEO_PRESETS[tier];
    if ((Object.keys(p) as (keyof typeof p)[]).every((k) => p[k] === video[k])) return tier;
  }
  return "custom";
}

/** True while the skier has expressed no opinion about the picture: every
 * row where it shipped. */
export function videoUntouched(video: VideoSettings): boolean {
  return (Object.keys(DEFAULT_VIDEO) as (keyof VideoSettings)[]).every(
    (key) => video[key] === DEFAULT_VIDEO[key],
  );
}

/** A picture moved onto a preset, the canvas's antialiasing kept. */
export function withPreset(video: VideoSettings, tier: Tier): VideoSettings {
  return { ...video, ...VIDEO_PRESETS[tier] };
}

/** The rows a picture is fitted by (`picture-fit.ts`) and a link may set
 * (`?picture=`), each with its ladder, cheapest first. ANTIALIAS is not
 * one: the canvas takes it only when it is made. */
export type PictureRow = Exclude<keyof VideoSettings, "antialias">;
export const PICTURE_LADDERS: { readonly [R in PictureRow]: readonly VideoSettings[R][] } = {
  resolution: TIERS,
  distance: DISTANCE_LEVELS,
  terrain: TIERS,
  trails: TRAIL_LEVELS,
  forest: TIERS,
  shadows: SHADOW_LEVELS,
  spray: TIERS,
};
export const PICTURE_ROWS = Object.keys(PICTURE_LADDERS) as PictureRow[];

/** A picture as a link spells it, `row:stop` by commas
 * (`distance:low,shadows:off`), and back: only real rows at real stops. */
export function readPicture(text: string | null): Partial<VideoSettings> {
  const out: Partial<Record<PictureRow, string>> = {};
  for (const pair of (text ?? "").split(",")) {
    const [row, stop] = pair.split(":");
    const ladder = PICTURE_LADDERS[row as PictureRow] as readonly string[] | undefined;
    if (ladder?.includes(stop)) out[row as PictureRow] = stop;
  }
  return out as Partial<VideoSettings>;
}
export function writePicture(video: Partial<VideoSettings>): string {
  return PICTURE_ROWS.filter((row) => video[row] !== undefined)
    .map((row) => `${row}:${video[row]}`)
    .join(",");
}

/** A stored blob — anything at all — made into a picture this build offers,
 * row by row: a value off a ladder is one no press can walk back from. */
export function mergeVideo(parsed: unknown): VideoSettings {
  const out = { ...DEFAULT_VIDEO };
  if (!parsed || typeof parsed !== "object") return out;
  const blob = parsed as Record<string, unknown>;
  const pick = <T extends string>(value: unknown, ladder: readonly T[], fallback: T): T =>
    typeof value === "string" && ladder.includes(value as T) ? (value as T) : fallback;
  out.resolution = pick(blob.resolution, TIERS, out.resolution);
  out.distance = pick(blob.distance, DISTANCE_LEVELS, out.distance);
  out.terrain = pick(blob.terrain, TIERS, out.terrain);
  out.trails = pick(blob.trails, TRAIL_LEVELS, out.trails);
  out.forest = pick(blob.forest, TIERS, out.forest);
  // A picture stored under an older row: its quality ladder's LOW, and the
  // mode ladder's ALL — which is HIGH now, the skier's own map added.
  const shadows =
    blob.shadows === "low" ? "medium" : blob.shadows === "all" ? "high" : blob.shadows;
  out.shadows = pick(shadows, SHADOW_LEVELS, out.shadows);
  out.spray = pick(blob.spray, TIERS, out.spray);
  if (typeof blob.antialias === "boolean") out.antialias = blob.antialias;
  return out;
}
