// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER GROUND — what lies under a wheel or a boot on the mountain in
// midsummer, as numbers: the KINDS of ground a point can be (the research's
// belts, the piste survey and the reference photographs — `docs/summer.md`
// § What the game needs), the SURFACE each one is to a tyre (`docs/
// downhill-bike.md` § Tyres on dirt), and the rules that say where each
// lies (`summer-ground.ts` reads them). Every surface number is the middle
// of a published band, or is said to be our estimate where no band exists.

/** What a point of the summer mountain IS (`summerGroundAt`). */
export type SummerKind =
  /** Open grass below the tree line, under 25° — the valley's hay meadow. */
  | "meadow"
  /** Steep grazed grass, 25–40°, the cattle's terracettes across it. */
  | "pasture"
  /** A ski run in summer: a short-grass corridor, mown or grazed. */
  | "piste"
  /** Bare earth: a graded run's scars, an erosion scar off it. */
  | "dirt"
  /** Krummholz and shrub just under the tree line: not rideable off a trail. */
  | "scrub"
  /** Dwarf-shrub heath above the tree line on the fell and the maritime. */
  | "heath"
  /** Alpine turf above the tree line, under 35°. */
  | "turf"
  /** Loose broken rock on a 30–38° slope above the tree line. */
  | "scree"
  /** Bare rock: a face too steep for anything to grow on. */
  | "rock"
  /** A snow patch left lying in July. */
  | "snow"
  /** A bike trail's tread (laid by the bike park, `docs/bike-park.md`). */
  | "trail"
  /** A cat track: the gravel service road a ski area's machines use. */
  | "road"
  /** The village's sealed streets and sidewalks. */
  | "street"
  /** Flat wet ground on the fell and the maritime. */
  | "bog"
  /** A lake, a pond, a reservoir. */
  | "water"
  /** Under the trees: needles, moss and roots. */
  | "forest";

/** Every kind, in a fixed order (the lab's table, the suite's sweep). */
export const SUMMER_KINDS: readonly SummerKind[] = [
  "meadow",
  "pasture",
  "piste",
  "dirt",
  "scrub",
  "heath",
  "turf",
  "scree",
  "rock",
  "snow",
  "trail",
  "road",
  "street",
  "bog",
  "water",
  "forest",
];

/** What a surface is to a tyre: its peak and sliding friction (μ) and its
 * rolling resistance (Crr) for a downhill bike's knobbly tyre. */
export type SummerSurface = {
  /** Peak friction coefficient, μ. */
  readonly grip: number;
  /** Sliding friction coefficient once the tyre has let go, μ. */
  readonly slide: number;
  /** Rolling resistance coefficient, Crr (force over load). */
  readonly roll: number;
  /** True where the number is our estimate rather than a published band's
   * middle. */
  readonly estimate?: true;
};

/** THE SURFACES, the middles of `docs/downhill-bike.md`'s bands (dry
 * conditions: rain is out of scope). */
export const SURFACES = {
  /** Dry grass: μ 0.5–0.7, sliding 0.4–0.55, Crr 0.04–0.08. */
  grass: { grip: 0.6, slide: 0.48, roll: 0.06 },
  /** Rough grass (turf, heath): the dry grass band's slow end. */
  rough: { grip: 0.55, slide: 0.45, roll: 0.08, estimate: true },
  /** Dry hardpack: μ 0.8–1.0, sliding 0.65–0.8, Crr 0.025–0.04. */
  hardpack: { grip: 0.9, slide: 0.72, roll: 0.032 },
  /** Tacky loam: μ 0.9–1.2, sliding 0.75–0.9, Crr 0.05–0.08. */
  loam: { grip: 1.05, slide: 0.82, roll: 0.065 },
  /** Loose gravel over hardpack: μ 0.5–0.7, sliding 0.45–0.55, Crr 0.03–0.05. */
  gravel: { grip: 0.6, slide: 0.5, roll: 0.04 },
  /** Dry rock: μ 0.9–1.1, sliding 0.7–0.9, Crr 0.02–0.03. */
  rock: { grip: 1.0, slide: 0.8, roll: 0.025 },
  /** Scree: loose rock that rolls under the tyre — gravel's grip, worse. */
  scree: { grip: 0.5, slide: 0.4, roll: 0.06, estimate: true },
  /** A packed snow patch: μ ~0.2, sliding 0.15, Crr 0.03–0.06. */
  snow: { grip: 0.2, slide: 0.15, roll: 0.045 },
  /** Mud and peat: μ 0.3–0.5, sliding 0.25–0.4, Crr 0.08–0.15. */
  mud: { grip: 0.4, slide: 0.32, roll: 0.11 },
  /** A sealed street: the vehicle tables' dry asphalt, a knobbly's roll. */
  asphalt: { grip: 0.85, slide: 0.75, roll: 0.015, estimate: true },
  /** Shrub ploughed through: grass's grip, the stems' drag. */
  shrub: { grip: 0.5, slide: 0.4, roll: 0.25, estimate: true },
  /** Water a wheel is in: next to no grip, a wall of drag. */
  water: { grip: 0.3, slide: 0.25, roll: 0.5, estimate: true },
} as const satisfies Record<string, SummerSurface>;

export type SurfaceId = keyof typeof SURFACES;

/** Each kind's surface (`docs/summer.md`'s ground table). */
export const KIND_SURFACE: Readonly<Record<SummerKind, SurfaceId>> = {
  meadow: "grass",
  pasture: "grass",
  piste: "grass",
  dirt: "hardpack",
  scrub: "shrub",
  heath: "rough",
  turf: "rough",
  scree: "scree",
  rock: "rock",
  snow: "snow",
  trail: "hardpack",
  road: "gravel",
  street: "asphalt",
  bog: "mud",
  water: "water",
  forest: "loam",
};

/** WHERE EACH KIND LIES — the rules `summer-ground.ts` classifies by. */
export const SUMMER_GROUND = {
  /** Midsummer's day the SUMMER season stands on, as a day of the year
   * (15 July). */
  day: 196,
  /** The field's cell, m: the snow patches, the scars, the roads and the
   * scree baked once a map on a grid this fine (the ground's 2 m twice). */
  cell: 4,
  /** Slopes, degrees. */
  slope: {
    /** Grazed grass forms terracettes between these. */
    pasture: { from: 25, to: 40 },
    /** Alpine turf holds under this; scree lies over it. */
    turf: 35,
    /** Scree lies between these above the tree line. */
    scree: { from: 30, to: 40 },
    /** Bare rock past this: nothing holds on it. */
    rock: 42,
    /** Ground flatter than this is where a bog lies, in the wet countries. */
    bog: 4,
  },
  /** The KRUMMHOLZ band: the shrub patches in the metres of open ground
   * under the tree line, and the share of it they cover. */
  scrub: { band: 120, share: 0.4 },
  /** A CAT TRACK's gravel tread, m: a machine's width and a little (the
   * service roads a ski area grades are 4–6 m). */
  road: 5,
  /** A trunk within this of a point puts it under the trees, m. */
  forest: 4,
  /** THE SNOW PATCHES left in July (`docs/summer.md` § Snow patches). */
  snow: {
    /** Only in the top share of the relief. */
    top: 0.35,
    /** The share of the ground above the tree line they cover, by region:
     * 2–6 % on an alpine or a continental map, 1–3 % on a fell or a
     * maritime one (the bands' middles). */
    cover: { alpine: 0.04, continental: 0.04, fell: 0.02, maritime: 0.02 },
    /** A hollow's weight over a crest's: four times (the field reports). */
    concave: 4,
    /** How far round a point its hollowness is read, m. */
    reach: 12,
    /** The noise that scallops a patch's edge: its two scales, m. */
    scales: [28, 9],
  },
  /** THE BARE SCARS on a graded run: 5–15 % of a natural-turf run below the
   * tree line, 40–80 % of a bulldozed one above it (the piste survey);
   * a little off the runs too, where the turf has torn. */
  scar: { below: 0.1, above: 0.55, wild: 0.015, scale: 8 },
  /** The SCREE's own patchiness over its slope band, and the extra a dry
   * continental country carries. */
  scree: { scale: 22, continental: 1.6 },
} as const;
