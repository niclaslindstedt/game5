// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The shape of a generated map — the contract between the generator and
// everything that skis, draws or measures one. Extend it; never rename a
// field without moving every reader with it.
import type { Heightfield } from "@niclaslindstedt/oss-game-framework/core/heightfield";
import type { PisteGrade } from "./grades.ts";
import type { RegionId, TreeKind } from "./regions.ts";
import type { GeneratorVersion } from "./versions.ts";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A snow-loaded tree. The trunk is what the skier meets; the crown is drawn. */
export interface TreeDef {
  x: number;
  z: number;
  /** Ground height at the trunk, m. */
  y: number;
  height: number;
  /** Trunk collision radius, m. */
  radius: number;
  /** Crown radius at its widest, m. */
  crown: number;
  /** What grows here (R21) — a spruce when left out. Drawn only: a trunk
   * is a trunk to the skier. */
  kind?: TreeKind;
  /** The CLUMP it grew in (R14), numbered from 0 — trunks of one clump may
   * stand closer than `forest.gap`; left out for a tree standing alone. */
  clump?: number;
}

/** A gate across the piste. Index 0 of `Level.checkpoints` is the START
 * GATE, the last the FINISH LINE (R11). */
export interface Checkpoint {
  x: number;
  z: number;
  y: number;
  heading: number;
  width: number;
  /** Arc length down the piste, m. */
  s: number;
  /** The gate's panels (R11): red and blue alternate down the piste, the
   * start gate red. Drawn only. */
  colour: "red" | "blue";
  /** A SLALOM GATE (R28): its centre stands this far right of the piste's
   * centreline (negative: left), m — on a resort's course every gate but
   * the start gate and the finish is one, narrower than the piste and set
   * alternately either side of its line. Absent: a gate across the whole
   * piste. */
  offset?: number;
  /** A slalom gate's piste: its width there, m. */
  span?: number;
}

export interface TrackPoint {
  x: number;
  z: number;
  y: number;
  /** Arc length from the start line, the piste's first station, m. */
  s: number;
  heading: number;
  width: number;
}

export interface Spawn {
  x: number;
  z: number;
  heading: number;
}

/** THE MOUNTAIN as the map publishes it (R2): the summit at the head of the
 * piste's fall line — the summit ridge's height there, its crests aside —
 * the base at the finish line, and the vertical between them. */
export interface Mountain {
  summit: Vec3;
  base: Vec3;
  /** The height from the base to the summit, m. */
  vertical: number;
  /** The valley floor's altitude above the sea, m (R21's band): what the
   * tree line is measured against. */
  altitude: number;
  /** THE TREE LINE (R14), m above the sea — the region's own band. Above
   * it nothing grows; `altitude` + `vertical` is the summit's. */
  treeLine: number;
}

export interface Level {
  seed: number;
  /** The world is [0, size] × [0, size] metres. */
  size: number;
  /** Heightfield cell size, m. */
  cell: number;
  /** Terrain height, the piste's grading included. */
  ground: Heightfield;
  groundAt(x: number, z: number): number;
  normalAt(x: number, z: number, out: Vec3): void;
  /** 0 = virgin powder … 1 = fully packed piste. */
  packedAt(x: number, z: number): number;
  /** THE PISTE, open: from the start line (s = 0) to the finish (s =
   * `length`). The arc queries (`query.ts`) never wrap. */
  track: { points: TrackPoint[]; length: number; closed: false };
  checkpoints: Checkpoint[];
  /** The start line's point on the centreline, facing down the piste
   * (R13) — the row the skiers stand on. */
  spawn: Spawn;
  /** One slot per skier, the player's first. */
  grid: Spawn[];
  trees: TreeDef[];
  /** The day (R15): the solar hour, the day of the year and the latitude —
   * and, on a map the graded generator built, the FACE'S BEARING: the
   * compass heading (radians, 0 north, clockwise) the world's +z — the fall
   * line — points to. Absent, the face falls due north. Read the sun's place
   * through `sunAtRun`, which turns it into the world's headings. */
  sun: { hour: number; dayOfYear: number; latitude: number; facing?: number };
  /** Always 1: a run is skied once, top to bottom (R16). */
  laps: number;

  // ── Beyond the contract: what the generator also publishes ──────────
  // Optional in the TYPE so a hand-built level (a test's synthetic one)
  // need not invent them; `generateLevel` always sets every one.
  /** The packed-snow field `packedAt` samples (R10), on the ground's grid. */
  packed?: Heightfield;
  /** Every crest shaped to throw a skier, on the piste and off it (R4, R9). */
  kickers?: Kicker[];
  /** Every cliff cut into the face (R22). */
  cliffs?: Cliff[];
  /** The summit, the base and the vertical (R2). */
  mountain?: Mountain;
  /** Which sub-seed attempt the search accepted (0 = the first). */
  attempt?: number;
  /** Every stretch of the piste lying under a drift (R17), in the order
   * they are skied. */
  drifts?: Drift[];
  /** The sky the map is skied under (R19). A hand-built level without one
   * is skied under `CLEAR_WEATHER` — ask `weatherOf`, never this field. */
  weather?: Weather;
  /** WHICH GENERATOR built the map (`versions.ts`): the current rules unless
   * a campaign map pinned an older row. */
  version?: GeneratorVersion;
  /** The kind of snow country the map was built in (R21) — ask `regionOf`,
   * which reads a hand-built map without one as the alpine. */
  region?: RegionId;
  /** THE PISTE GRADE the map was BUILT to (R23) — absent on a map from a
   * generator before the grades, or a hand-built one. Ask `gradeOf` for the
   * colour on its signs, which measures one where none was built to. */
  grade?: PisteGrade;
  /** THE REGION'S OWN SNOW (R21), on the ground's grid: the wind crust's
   * share of the country, 0..1, before it is folded into `packed` — what
   * the picture draws a crust with. Absent where the region lays none. */
  crust?: Heightfield;
  /** Ice, 0..1 on the ground's grid, and its sample: a surface with a
   * fraction of the groomer's grip. No region lays any today (a mountain
   * has no frozen river), so both are absent on every generated map; a
   * reader that asks keeps the physics' answer to ice honest. */
  ice?: Heightfield;
  iceAt?(x: number, z: number): number;
  /** THE SKI AREA (R25–R28) on a map built by a generator from the resorts
   * on: every run, lift and course, and which course `track` is. */
  resort?: Resort;
}

/** The skies R19 deals, lightest first. Three of them SNOW — a few flakes
 * out of a sunny sky (`flurries`), a steady fall under a grey lid (`snow`)
 * and a blizzard under black cloud (`storm`). */
export type WeatherKind =
  "clear" | "fair" | "flurries" | "high" | "overcast" | "snow" | "storm" | "fog";

/** The skies that SNOW, each dealt a fall in its own band (R19). */
export type SnowingKind = Extract<WeatherKind, "flurries" | "snow" | "storm">;

/** The weather a map is skied under (R19): the word and its numbers. What a
 * sky LOOKS like is the app's; the engine says only what is in the air. */
export interface Weather {
  kind: WeatherKind;
  /** How hard it is snowing on the whole, 0 (nothing falling) … 1 (a
   * blizzard) — the mean the squalls breathe about (`snowAt`). */
  snowfall: number;
  /** How thick the fog lying over the lower mountain is, 0 (none) … 1. */
  fog: number;
  /** The mean wind at 10 m, m/s. */
  wind: number;
  /** The world heading the wind blows FROM (heading convention). */
  windFrom: number;
  /** Whether R19 sent this map out in the evening (R15's exception). */
  evening: boolean;
}

/** A sky chosen by hand rather than dealt: FREE's start card, a lab's sheet.
 * A kind alone takes that sky at its typical numbers (`weatherFor`); an
 * `hour` is the solar hour the run starts at, whatever R15 dealt. */
export interface SkyOverride {
  weather?: WeatherKind | Partial<Weather>;
  hour?: number;
}

/** A stretch of the piste the wind has drifted over (R17): its full-depth
 * core from arc `from` to arc `to`, m. The packed field eases back to
 * groomed over `drift.fade` metres past each end. */
export interface Drift {
  from: number;
  to: number;
}

/** A level as `generateLevel` hands it out: every optional field set but
 * the ice, which no region lays. */
export type GeneratedLevel = Level &
  Required<
    Pick<
      Level,
      | "packed"
      | "kickers"
      | "cliffs"
      | "mountain"
      | "attempt"
      | "drifts"
      | "weather"
      | "version"
      | "region"
    >
  >;

/** A crest shaped to kick a skier into the air (R4, R9). `x, z` is the LIP. */
export interface Kicker {
  /** `K1…` on the piste in the order they are skied, `X1…` off it. */
  id: string;
  x: number;
  z: number;
  /** Ground height at the lip, m. */
  y: number;
  /** The direction a skier crosses the lip in (heading convention). */
  heading: number;
  /** Lip over the ground the kicker was shaped on, m. */
  height: number;
  /** Ramp length, foot to lip, m. */
  ramp: number;
  /** Landing length, lip to foot, m. */
  landing: number;
  /** Full-height width across the kicker, m. */
  width: number;
  onTrack: boolean;
  /** Arc length of the lip down the piste (on-piste kickers only), m. */
  s?: number;
  /** The resort's run it stands on (R27), on one that is not the course
   * raced — a piste's kicker, though not this map's piste's. */
  run?: string;
  /** One of the TERRAIN PARK's (R20, `T1…`), laid on the piste only on a
   * map built for a tricks run. */
  trick?: boolean;
  /** Which of the park's three sizes it is (R20). */
  size?: TrickSize;
  /** A BUILT landing (R20): a deck, a landing slope dug under the ground and
   * a run-out back up to it. Absent, the landing falls away from the lip
   * (R4, R9). `landing` is then the whole length from the lip to the end of
   * the run-out. */
  shape?: KickerShape;
}

/** The park's three sizes of kicker (R20). */
export type TrickSize = "low" | "medium" | "high";

/** A built landing past a kicker's lip (`kickerProfile`), m: the flat
 * `deck` at the lip's height, the landing slope's length `fall`, and how
 * far under the ground it was shaped on the slope bottoms out, `dig`. */
export interface KickerShape {
  deck: number;
  fall: number;
  dig: number;
}

/** A cliff a skier drops off into the lower ground below (R22) — or a DROP
 * across the piste (R24, `onTrack`). `x, z` is the middle of its EDGE, the
 * top of the face. */
export interface Cliff {
  /** `C1…` off the piste, in the order they were laid; `D1…` across it, in
   * the order they are skied. */
  id: string;
  x: number;
  z: number;
  /** Ground height at the top of the edge, m. */
  y: number;
  /** The direction a skier goes over the edge in — down the fall line
   * (heading convention). */
  heading: number;
  /** The face's height, m. */
  drop: number;
  /** The face's run, edge to foot, m. */
  face: number;
  /** The landing apron below the face: its height over the country at the
   * face's foot, and its run from there to where it meets the country, m. */
  apron: number;
  landing: number;
  /** The shelf behind the edge, foot to edge, m. */
  shelf: number;
  /** Full-height length of the edge across, m. */
  width: number;
  /** A DROP across the piste (R24), laid on the graded line. */
  onTrack?: boolean;
  /** Arc length of a drop's edge down the piste (drops only), m. */
  s?: number;
  /** The resort's run a drop stands across (R27), on one that is not the
   * course raced. */
  run?: string;
}

/** R27 — what a run is: a PISTE built to a colour, or a TRANSPORT LANE
 * (a cat track) graded gentle across the mountain between them. */
export type RunKind = "piste" | "road";

/** A run of a resort (R27): its number on the piste map, what it is, the
 * colour it measures, its line — every station on it as the piste's
 * (`TrackPoint`), arc from its top station — the lift it leaves the top of,
 * and the run it merges into at what arc of that one (null: it runs into
 * the village). */
export interface Run {
  id: string;
  kind: RunKind;
  grade: PisteGrade;
  points: TrackPoint[];
  length: number;
  from: string;
  /** `from` here is the arc on THIS run from which it closes on the one it
   * merges into — where it came within the gap of it (R27). */
  into: { run: string; s: number; from: number } | null;
  /** A BRANCH LANE (R27): the run it leaves part-way down, and the arc on
   * that run where it leaves — a junction at its start, as `into` is at
   * its end. Absent on a run that leaves a top station. */
  branch?: { run: string; s: number };
  /** A LINK LANE (R27): the lift whose bottom station it runs to (`into`
   * null). Absent on every other run. */
  to?: string;
  /** The stretches of it lying drifted (R17), by its own arc. */
  drifts: Drift[];
}

/** A lift (R26): a straight line from its bottom station to its top. */
export interface Lift {
  id: string;
  kind: "gondola" | "chair" | "drag";
  bottom: Vec3;
  top: Vec3;
}

/** A course (R28): the line from a run's top station down the network to
 * the village — the runs it follows, in order, and what it measures. */
export interface Course {
  id: string;
  grade: PisteGrade;
  runs: string[];
  length: number;
  /** Its drop from the start line to the finish, m. */
  drop: number;
}

/** R29 — THE HUB: the open band across the valley floor where the runs
 * end and the valley's bottom stations stand, as its two edges read every
 * `step` metres across from `x0` — `top[i]` the upper edge's z (up the
 * mountain), `bottom[i]` the lower edge's, at x = x0 + i · step. */
export type Hub = { x0: number; step: number; top: number[]; bottom: number[] };

/** R30 — A WIND TUNNEL: a horizontal lift along the hub that blows a skier
 * from its entrance to its exit. Its line runs entrance→exit, points every
 * ~4 m on the ground (`s` its arc, `heading` the way the wind blows);
 * width ≈8–10 m; speed m/s ≈25–30. */
export type WindTunnel = {
  id: string;
  points: { x: number; z: number; y: number; s: number; heading: number }[];
  length: number;
  width: number;
  speed: number;
};

/** THE SKI AREA a resort map is (R25): its runs, its lifts, the courses
 * down them, and which one this map is raced on. */
export interface Resort {
  runs: Run[];
  lifts: Lift[];
  courses: Course[];
  /** The id of the course this map's `track` is. */
  course: string;
  /** The village on the valley floor. */
  village: Vec3;
  /** R29 — the hub at the foot of the mountain. */
  hub?: Hub;
  /** R30 — the wind tunnels along the hub, "W1" and "W2". */
  tunnels?: WindTunnel[];
}

/** What a caller may ask of the generator beyond the seed. */
export interface GenerateOptions {
  /** How many sub-seeds the search may try before it gives up (default 16). */
  attempts?: number;
  /** Runs a race on this map is skied over (default R16's: one). */
  laps?: number;
  /** Ski the map under this sky and from this hour instead of the ones
   * R15 and R19 dealt (`withSky`). Applied AFTER the search accepts the
   * map, so it moves nothing the map builds. */
  sky?: SkyOverride;
  /** The generator version to build by (`versions.ts`) — a campaign map's
   * pinned row; the current rules when left out or unknown. */
  version?: GeneratorVersion;
  /** Lay the TERRAIN PARK on the piste (R20) — a map for a tricks run. Left
   * out, the map carries none and is exactly the seed's race map. */
  tricks?: boolean;
  /** The kind of snow country to build in (R21, `regions.ts`); the alpine
   * when left out. */
  region?: RegionId;
  /** The PISTE GRADE to build to (R23, `grades.ts`); the one the seed deals
   * when left out. A version from before the grades builds none either way.
   * On a resort (R28): the colour of the course raced. */
  grade?: PisteGrade;
  /** R28 — the course a resort map is raced on, by id; one of `grade`'s (or
   * the seed's) when left out. */
  course?: string;
}

/** The answer to "where on the piste is this point nearest?" */
export interface TrackHit {
  /** Index of the track point starting the nearest segment. */
  index: number;
  /** Arc length of the nearest point on the centreline, m. */
  s: number;
  /** Plan distance to the centreline, m. */
  distance: number;
  /** Signed plan offset: positive to the RIGHT of the direction of travel, m. */
  lateral: number;
  /** The nearest point on the centreline. */
  x: number;
  z: number;
}
