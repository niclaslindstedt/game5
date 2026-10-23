// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE PICTURE COSTS — the dictionary between a row of OPTIONS ▸ PICTURE
// and the numbers the renderer builds with. DOM-free and three-free, so
// `tests/video_test.ts` reads the whole ladder without a browser, and
// `renderer.setVideo` is the one place a row becomes a draw call.
//
// A ROW A BILL, BECAUSE THEY ARE DIFFERENT BILLS. A phone can be short
// of pixels and rich in triangles, or the other way round, and one QUALITY
// knob would make it pay for the thing it can afford to save on the thing it
// cannot:
//
//   RESOLUTION  how many pixels: HIGH the screen's own, MEDIUM half of
//               them, LOW a quarter.
//   DISTANCE    how far anything is drawn at all: the woods, and the ground's
//               clipmap cut to the view — with a MIST closing over the last
//               of it, the one row that changes the WEATHER, which is how the
//               cut-off stays out of sight. LOW is only what a skier needs
//               to ski; MAX alone draws the mountain to the summit ridge, unmisted.
//               The SKY rides it too (`SKY_TIER`): the baked table on LOW,
//               the GPU's on MEDIUM, and its aerial perspective on HIGH.
//   TERRAIN     the ground's clipmap (`terrain.ts`): the near grid's pitch
//               and how many cells a level carries. Every stop reaches the
//               DISTANCE row's view, so a cheaper ground is a coarser one
//               and never a shorter one.
//   TRAILS      the trail maps (`trail-map.ts`): the fine window's texels and
//               span, the coarse map's texels — or OFF, which stamps nothing
//               and leaves the snow untouched.
//   FOREST      how far the full and the mid cut of a tree run, how many of
//               the far band's sketches stand at all, how many VARIANTS of
//               each kind are drawn (10, 5 or 2 — never fewer kinds), and —
//               under SHADOWS MEDIUM and HIGH — whether a tree casts its
//               mid cut or the sketch. Never WHICH trunks exist: the physics
//               hits every one of them, and a tree the skier can hit is
//               always drawn.
//   SHADOWS     OFF, SKI_CATALOG (the machines, the skiers and the flags on a
//               tight map), MEDIUM (every tree's too, as far as the eye
//               needs them — each tree casting the shape the FOREST row
//               draws it in) or HIGH (MEDIUM, with every skier and his
//               machine cast into a fine map of their own).
//   SPRAY       the share of the roost, the ski spray and the puffs thrown.
//   LAMPS       after dark, how many lamps every lit pixel is shaded by: his
//               own headlamp always, then the nearest of the floods and the
//               field's lamps. Each one is a beam, a falloff and a glint
//               worked out over the whole snow, so on a phone's screen it is
//               the night's own bill. Nothing by day.
//   ANTIALIAS   the picture's multisampling: OFF, 2× or 4× samples a pixel
//               along every edge (`ANTIALIAS_SAMPLES`). The scene's target
//               takes it at once (`region-picture.ts`); the canvas's own,
//               read when the canvas is made, is used only where it is
//               what the row asks for.
//   RAYS        light worked out by marching rays through the frame the
//               node renderer has just drawn (`rays-tsl.ts`): LOW the shade
//               where things crowd the snow (ambient occlusion), HIGH that
//               and the short shadow a boot, a ski or a pole throws where
//               the sun's map is too coarse to (contact shadows), MAX both
//               and the lakes and the ice mirroring what stands round them
//               (screen-space reflections). Nothing on classic WebGL.
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

/** RESOLUTION: a quarter of the screen's own pixels, half of them, all. */
export type ResolutionLevel = Tier;
export const RESOLUTION_LEVELS: readonly ResolutionLevel[] = TIERS;

/** SKY: PLAIN the air's own colour from the horizon to the zenith as the
 * hour and the weather light it, and nothing in it — no cloud, sun, moon,
 * stars or contrails; FULL the whole sky. */
export type SkyLevel = "plain" | "full";
export const SKY_LEVELS: readonly SkyLevel[] = ["plain", "full"];

/** HORIZON: the far ranges round the map — PAINTED a skyline baked once
 * onto the dome, 3D the rings' own mesh standing to the horizon. */
export type HorizonLevel = "painted" | "3d";
export const HORIZON_LEVELS: readonly HorizonLevel[] = ["painted", "3d"];

/** ANTIALIAS: the samples a pixel along an edge — none, two or four. */
export type AntialiasLevel = "off" | "2" | "4";
export const ANTIALIAS_LEVELS: readonly AntialiasLevel[] = ["off", "2", "4"];
export const ANTIALIAS_SAMPLES: Record<AntialiasLevel, number> = { off: 0, "2": 2, "4": 4 };

/** RAYS: none, the shade (LOW), the shade and the contact shadows (HIGH),
 * and those and the water's mirror (MAX). */
export type RaysLevel = "off" | "low" | "high" | "max";
export const RAYS_LEVELS: readonly RaysLevel[] = ["off", "low", "high", "max"];

export type VideoSettings = {
  resolution: ResolutionLevel;
  distance: DistanceLevel;
  terrain: Tier;
  trails: TrailLevel;
  forest: Tier;
  shadows: ShadowLevel;
  spray: Tier;
  lamps: Tier;
  sky: SkyLevel;
  horizon: HorizonLevel;
  antialias: AntialiasLevel;
  rays: RaysLevel;
};

/* ── What each stop buys ─────────────────────────────────────────────── */

/** RESOLUTION: the share of the device's pixel ratio the canvas is drawn at,
 * a side — the pixels a frame shades go as its square. HIGH is the
 * screen's own; MEDIUM half its pixels; LOW a quarter, half of it a side —
 * on a phone, whose two pixels to the point (`App.tsx` caps the ratio at
 * 2), one pixel a point; under it the HUD's crisp type sits over a picture
 * that reads as out of focus rather than as cheaper. */
export const RESOLUTION_SHARE: Record<ResolutionLevel, number> = {
  low: 0.5,
  medium: Math.SQRT1_2,
  high: 1,
};

/** How far out the ground reaches under DISTANCE MAX, m: past the basin's
 * rim from any corner of it, so the mountains are always ground and never a
 * hole with the sky in it. Every shorter stop closes its mist first. */
export const TERRAIN_REACH = 3800;

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
  /** Whether the TREE WELLS are drawn (`tree-wells.ts`): the hollow round
   * every trunk in deep powder lowered into the snow, and the stub of trunk
   * down into it. Their map is refilled every 16 m the lens moves — some
   * 18 ms of the processor's a time, a dropped frame every second or two at
   * speed — and the ground reads it five times a pixel near the lens. OFF
   * and LOW give them up: the snow round a trunk is drawn level, though the
   * skier still meets the hollow and can sink into it. */
  wells: boolean;
};

export const TRAIL_LOOK: Record<TrailLevel, TrailLook> = {
  // OFF still builds the smallest maps there are, so the ground's shader has
  // something to read — they are simply never written.
  off: { stamp: false, fineSize: 64, fineSpan: 64, coarseSize: 64, wells: false },
  low: { stamp: true, fineSize: 512, fineSpan: 64, coarseSize: 1024, wells: false },
  medium: { stamp: true, fineSize: 1024, fineSpan: 96, coarseSize: 1024, wells: true },
  high: { stamp: true, fineSize: 2048, fineSpan: 160, coarseSize: 2048, wells: true },
};

export type RockLook = {
  near: number;
  mid: number;
  cheap: 16 | 32;
  /** THE TALUS under the walls (`talus.ts`): how far from the lens its
   * stones are drawn, m (sunk into the snow over the last quarter), and
   * the share of them drawn, 0..1 — the smallest let go first. */
  talus: { readonly reach: number; readonly share: number };
};

export type ForestLook = {
  /** The FULL tree runs out to here, m; past it the MID cut of the same
   * variant, to `mid`; past that the far band's sketch. WHICH trees cast is
   * the SHADOWS row's (`SHADOW_LOOK`), never a band's, so no shadow is
   * switched on by riding closer to its tree. */
  full: number;
  mid: number;
  /** HOW THE TREES ARE DRAWN: `faceted` — the solid, chunky cuts
   * (`tree-shapes.ts`) at every distance — or `cards`, the same trees with
   * their needles on cards over a painted atlas (`tree-cards.ts`): the
   * boughs, their snow, the dark gaps between them, lighter with distance
   * (the full cut, the light cut, the billboard cloud) out to the mid
   * band's edge, the far band the faceted sketch a few pixels high. */
  style: TreeStyle;
  /** THE FULL CARD TREES run out to here, m, inside the full band (0: none,
   * the light cut is the nearest): every bough its own pair of cards. Only
   * the richest row affords them. */
  cards: number;
  /** The share of the far band's sketches that stand, 0..1. */
  farShare: number;
  /** HOW MANY VARIANTS OF EACH KIND are drawn, 1..10 (`tree-variants.ts`,
   * the most telling first) — every kind a map grows is always drawn, only
   * in fewer shapes. A shape is a mesh at the full and the mid cut, so two
   * draw calls and its triangles held on the GPU; the far band and the
   * casters draw one shape a kind whatever this is. */
  variants: number;
  /** What a tree casts under SHADOWS MEDIUM and HIGH: its kind's mid cut,
   * or the far band's sketch drawn a touch inside it (a fraction of the
   * triangles in the shadow pass, and it reads the same on the snow). */
  casters: TreeCasters;
  /** THE WILDLIFE rides the same row (the woods and what lives in them are
   * one thing to a skier): how many FORMS of each species are drawn, 1..3
   * (`wild-traits.ts`, the most telling first — a cheap picture draws a
   * herd's calves as its grown animals, never fewer SPECIES), and how far
   * from the lens an animal or a bird is drawn at its NEAR cut, m, before
   * the FAR one takes over. */
  wild: WildLook;
  /** THE CRAGS ride the same row (`rocks.ts`): a tile whose nearest corner
   * is within `near` m of the lens is built on the physics' own lattice,
   * every bed (so the rock drawn is the rock met — never under 250 m, the
   * reach the rock eval lab holds that to); out to `mid` m on a `cheap` m
   * lattice, its beds taken two at a time for a 16 m one and four for a
   * 32 m one; past that on a lattice twice as coarse with the beds twice as
   * many to a ledge. */
  rocks: RockLook;
  /** THE SUMMER GRASS rides the row too (the meadow is the summer's woods
   * to a rider's eye, `summer-grass.ts`): how far from the lens the tufts
   * stand, m, and the share of the cells that grow one, 0..1. Its price in
   * `PICTURE_PRICES` is an ESTIMATE until a GPU bench measures it. */
  grass: GrassLook;
};

export type GrassLook = { readonly reach: number; readonly share: number };

export type WildLook = { readonly forms: number; readonly near: number };

export type TreeCasters = "full" | "sketch";

export type TreeStyle = "faceted" | "cards";

export const FOREST_LOOK: Record<Tier, ForestLook> = {
  low: {
    full: 50,
    mid: 140,
    style: "faceted",
    cards: 0,
    farShare: 0.5,
    variants: 2,
    casters: "sketch",
    wild: { forms: 1, near: 35 },
    rocks: { near: 250, mid: 420, cheap: 32, talus: { reach: 110, share: 0.35 } },
    grass: { reach: 18, share: 0.5 },
  },
  medium: {
    full: 80,
    mid: 220,
    style: "cards",
    cards: 0,
    farShare: 0.75,
    variants: 5,
    casters: "sketch",
    wild: { forms: 2, near: 60 },
    rocks: { near: 280, mid: 560, cheap: 16, talus: { reach: 160, share: 0.7 } },
    grass: { reach: 28, share: 0.75 },
  },
  high: {
    full: 110,
    mid: 320,
    style: "cards",
    cards: 25,
    farShare: 1,
    variants: 10,
    casters: "full",
    wild: { forms: 3, near: 90 },
    rocks: { near: 300, mid: 700, cheap: 16, talus: { reach: 200, share: 1 } },
    grass: { reach: 40, share: 1 },
  },
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
 * speed, and no more; MAX is the mountain to its summit ridge on the sky's own air.
 * These are the reaches ON THE SNOW: a lens high over it sees further on
 * every stop (`view-aloft.ts`). */
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

/** THE SKY rides the DISTANCE row (the sky and the air the ground fades
 * into ARE the far view — `sky-gpu-plan.ts`): LOW the baked table, MEDIUM
 * and HIGH the GPU's sky-view, HIGH with the aerial-perspective volume.
 * MAX draws the HIGH sky. Its own row waits on a real GPU's price
 * (PLAN decision 5): the presets keep it in step either way. */
export const SKY_TIER: Record<DistanceLevel, Tier> = {
  low: "low",
  medium: "medium",
  high: "high",
  max: "high",
};

/** THE CLOUD rides it too (`clouds.ts`): LOW one read a layer in the
 * dome (the shell), MEDIUM a slab of four steps and a read toward the sun
 * at half the picture's resolution, HIGH the raymarched VOLUME
 * (`cloud-volume.ts`: a sixteenth of a half-resolution picture marched a
 * frame, the rest carried over) and MAX the same marched finer and a
 * quarter of it a frame. `slab8` is what HIGH draws until the volume's
 * noise has landed. */
export type CloudTier = "shell" | "slab4" | "slab8" | "volume" | "volumeFine";
export const CLOUD_TIER: Record<DistanceLevel, CloudTier> = {
  low: "shell",
  medium: "slab4",
  high: "volume",
  max: "volumeFine",
};

/** THE CONTRAILS ride it with the cloud (`contrails.ts`): how many
 * trails the dome reads a pixel, and whether an old one's fibres are
 * drawn. LOW reads the eight that fill the most sky, smooth. */
export const CONTRAIL_LOOK: Record<DistanceLevel, { trails: number; fibres: number }> = {
  low: { trails: 8, fibres: 0 },
  medium: { trails: 12, fibres: 1 },
  high: { trails: 16, fibres: 1 },
  max: { trails: 16, fibres: 1 },
};

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
 * riding closer to its tree. Every stop but OFF also lays the MOUNTAIN'S OWN
 * shadow (`terrain-shade.ts`): one horizon map baked a map off the thread,
 * and a texture read a pixel — nothing a frame the stops tell apart. */
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

/** SPRAY: whether the weighed spray is FLOWN ON THE GPU (`gpu-spray.ts`:
 * each parcel written once when thrown and flown in the vertex shader) or
 * stepped and re-sent every frame on the CPU (`spray.ts`'s pool). The same
 * snow and the same draw either way; the GPU flight spares the CPU its step
 * and its upload at every stop (`make snow-eval`'s perf rows). Measured on a
 * 40 km/h stop: the spray's CPU time 1.2–2.3 ms → 0.45–0.9 ms and its upload
 * 66–173 KB → 9–23 KB a frame, with as many grains in the air and the same
 * draw calls. LOW's machines gain too, so every stop flies on the GPU. */
export const SPRAY_GPU: Record<Tier, boolean> = { low: true, medium: true, high: true };

/** LAMPS: how many of the lamp slots (`haze.ts`'s `LAMP_SLOTS`) are dealt
 * after dark (`headlamp.ts`'s `dealLamps`) — his own headlamp first, then
 * the nearest of the rest. Every shader stops at the first empty slot, so a
 * slot not dealt is a lamp no pixel pays for. LOW keeps his own and one
 * more: what lights the snow in front of him, and the nearest beam. */
export const LAMP_COUNT: Record<Tier, number> = { low: 2, medium: 4, high: 6 };

/** LAMPS, again: whether the snow near the lens GLITTERS toward the lamps
 * (`snow-glsl.ts`, `haze.ts`'s `uLampGlint`) or is only lit by them — the
 * crystals are the dearest part of a lamp on the snow, and LOW gives them
 * up; the moon's own glitter stays. */
export const LAMP_GLINT: Record<Tier, boolean> = { low: false, medium: true, high: true };

export type RaysLook = {
  /** THE SHADE (ambient occlusion): how much of the sky's light a point
   * still sees past what stands round it, marched a pixel in every other
   * row and column of the frame. */
  shade: boolean;
  /** THE CONTACT SHADOWS: a short march toward the sun from every pixel the
   * sun lights, for the shadows the key's map is too coarse to hold. */
  contact: boolean;
  /** THE MIRROR: the water and the ice reflect what the last frame drew
   * round them, the sky and the far hills where a ray finds nothing. */
  mirror: boolean;
};

/** RAYS, stop by stop: each stop adds one effect to the one under it. */
export const RAYS_LOOK: Record<RaysLevel, RaysLook> = {
  off: { shade: false, contact: false, mirror: false },
  low: { shade: true, contact: false, mirror: false },
  high: { shade: true, contact: true, mirror: false },
  max: { shade: true, contact: true, mirror: true },
};

/** Whether a RAYS stop marches anything at all. */
export const raysOn = (level: RaysLevel): boolean => level !== "off";

/* ── Whole pictures ──────────────────────────────────────────────────── */

/** A whole picture a tier at a time. */
export const VIDEO_PRESETS: Record<Tier, VideoSettings> = {
  low: {
    resolution: "medium",
    distance: "low",
    terrain: "low",
    trails: "low",
    forest: "low",
    shadows: "off",
    spray: "low",
    lamps: "low",
    sky: "plain",
    horizon: "3d",
    antialias: "2",
    rays: "off",
  },
  medium: {
    resolution: "high",
    distance: "medium",
    terrain: "medium",
    trails: "medium",
    forest: "medium",
    shadows: "medium",
    spray: "medium",
    lamps: "medium",
    sky: "full",
    horizon: "3d",
    antialias: "4",
    rays: "off",
  },
  high: {
    resolution: "high",
    distance: "high",
    terrain: "high",
    trails: "high",
    forest: "high",
    shadows: "high",
    spray: "high",
    lamps: "high",
    sky: "full",
    horizon: "3d",
    antialias: "4",
    rays: "high",
  },
};

/** The picture a first visit opens on: the design point, which the probe
 * then moves up or down once it has timed this machine drawing it. */
export const DEFAULT_VIDEO: VideoSettings = { ...VIDEO_PRESETS.medium };

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

/** A picture moved onto a preset. */
export function withPreset(video: VideoSettings, tier: Tier): VideoSettings {
  return { ...video, ...VIDEO_PRESETS[tier] };
}

/** The rows a picture is fitted by (`picture-fit.ts`) and a link may set
 * (`?picture=`), each with its ladder, cheapest first. */
export type PictureRow = keyof VideoSettings;
export const PICTURE_LADDERS: { readonly [R in PictureRow]: readonly VideoSettings[R][] } = {
  resolution: RESOLUTION_LEVELS,
  distance: DISTANCE_LEVELS,
  terrain: TIERS,
  trails: TRAIL_LEVELS,
  forest: TIERS,
  shadows: SHADOW_LEVELS,
  spray: TIERS,
  lamps: TIERS,
  sky: SKY_LEVELS,
  horizon: HORIZON_LEVELS,
  antialias: ANTIALIAS_LEVELS,
  rays: RAYS_LEVELS,
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
  // A picture stored under the ladder of tenths (or the word ladder before
  // it, whose MIN was the half): the stop nearest it by the pixels drawn.
  const tenths: Record<string, ResolutionLevel> = {
    min: "low",
    "50": "low",
    "60": "low",
    "70": "medium",
    "80": "medium",
    "90": "high",
    "100": "high",
  };
  const resolution =
    typeof blob.resolution === "string" && Object.hasOwn(tenths, blob.resolution)
      ? tenths[blob.resolution]
      : blob.resolution;
  out.resolution = pick(resolution, RESOLUTION_LEVELS, out.resolution);
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
  out.lamps = pick(blob.lamps, TIERS, out.lamps);
  // A picture stored before the SKY row: the LOW preset's own plain sky if
  // every other row stood on LOW, so it is still that preset.
  const low = VIDEO_PRESETS.low;
  const wasLow = (Object.keys(low) as (keyof typeof low)[]).every(
    (k) => k === "sky" || k === "horizon" || k === "antialias" || out[k] === low[k],
  );
  out.sky = pick(blob.sky, SKY_LEVELS, wasLow && blob.sky === undefined ? "plain" : out.sky);
  out.horizon = pick(blob.horizon, HORIZON_LEVELS, out.horizon);
  // A picture stored when the row was on or off: on was the canvas's own,
  // four samples.
  const antialias =
    blob.antialias === true ? "4" : blob.antialias === false ? "off" : blob.antialias;
  out.antialias = pick(antialias, ANTIALIAS_LEVELS, out.antialias);
  // A picture stored before the RAYS row: the HIGH preset's own stop if
  // every other row stood on HIGH, so it is still that preset.
  const high = VIDEO_PRESETS.high;
  const wasHigh = (Object.keys(high) as (keyof typeof high)[]).every(
    (k) => k === "rays" || out[k] === high[k],
  );
  out.rays = pick(blob.rays, RAYS_LEVELS, wasHigh && blob.rays === undefined ? "high" : out.rays);
  return out;
}
