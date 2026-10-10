// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The shape of a generated map — the contract between the generator and
// everything that skis, draws or measures one. Extend it; never rename a
// field without moving every reader with it.
import type { PipeFrame } from "./pipe.ts";
import type { MogulField } from "./mogul-field.ts";
import type { Heightfield } from "@niclaslindstedt/oss-game-framework/core/heightfield";
import type { PisteGrade, RunGrade } from "./grades.ts";
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
  /** Trunk collision radius, m — the trunk at breast height, its girth
   * that of its AGE (R14). */
  radius: number;
  /** How old the tree is, years (R14): what its trunk is grown from, and
   * what the picture reads as old or young. */
  age?: number;
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
  /** A POLE GATE (R31, a slalom's), drawn as two poles and no panel:
   * `"open"` across the hill, its TURNING pole at the end `turn` names
   * (−1 the skier's left as he comes down the piste, +1 his right) and its
   * OUTSIDE pole at the other; `"closed"` with its two poles one above the
   * other down the fall line, crossed sideways — `heading` the way across.
   * Absent: a gate of flags (R11, R28). */
  pole?: "open" | "closed";
  turn?: -1 | 1;
  /** A SPEED GATE (R32, a downhill's): four poles, a pair at each end of
   * its line holding a panel, `width` m between the inner poles — passed
   * with both feet between them. Absent: any other gate. */
  panels?: true;
  /** A SKI-CROSS GATE (R35): triangular flags, each a stubby turning pole
   * and a long outside pole joined by the flag. With `pole: "open"` a
   * TURNING GATE, one flag on the inside of a berm at the `turn` end;
   * alone a CORRIDOR GATE, a flag at each end of its line, passed with both
   * feet between them. Absent: any other gate. */
  flags?: true;
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
  /** THE SEA's height in the map's frame, m: a point's altitude is its
   * height less this (the HUD's ALT). From generator v8 the map's lowest
   * ground stands 10–20 m over it (R25); before, the valley floor stands
   * `altitude` over it. */
  sea: number;
}

/** ONE TREE WELL (`engine/game/tree-well.ts`): the hollow round a trunk at
 * (`x`, `z`) of radius `trunk`, `depth` m deep at the trunk, reaching
 * `reach` m from it across the fall line and `lean` further down it —
 * (`fx`, `fz`) the fall line's way, a unit vector in plan — and never past
 * `bound` m. */
export interface TreeWell {
  x: number;
  z: number;
  trunk: number;
  depth: number;
  reach: number;
  lean: number;
  fx: number;
  fz: number;
  bound: number;
}

/** A map's tree wells and the deepest of them, m. */
export interface WellField {
  list: readonly TreeWell[];
  deepest: number;
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
  /** The snow's normal at the surface point NEAREST `(x, y, z)` — on a map
   * with a surface steeper than a skier stands on (R39's pipe), where the
   * snow straight under a body is not the snow under its feet. Absent
   * elsewhere: `normalAt` under the point is the answer. */
  normalNear?(x: number, y: number, z: number, out: Vec3): void;
  /** THE PIPE cut into the map (R39, `withPipe`) — the surface `groundAt`,
   * `normalAt` and `normalNear` answer off, read by the flight off its
   * walls (`pipe-air.ts`). Absent on every map without one. */
  pipe?: PipeFrame;
  /** THE MOGUL FIELD laid on the map (R40, `withMoguls`) — the surface
   * `groundAt` and `normalAt` answer off inside its venue. Absent on every
   * map without one. */
  bumps?: MogulField;
  /** THE TREE WELLS round the trunks in deep powder (`engine/game/
   * tree-well.ts`'s `withWells`) — the hollows `groundAt` and `normalAt`
   * answer off. Absent on every map skied in the ordinary snow. */
  wells?: WellField;
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
   * a pinned map named an older row. */
  version?: GeneratorVersion;
  /** The kind of snow country the map was built in (R21) — ask `regionOf`,
   * which reads a hand-built map without one as the alpine. */
  region?: RegionId;
  /** THE REAL FACE the map's mountain was read off (R25, `real-face.ts`) —
   * absent on a dealt massif. */
  face?: string;
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
  /** A SLALOM set on the map (R31, `setSlalom`): its gates are this map's
   * `checkpoints`, its start hut the `spawn`. Absent on every map the
   * generator builds — a slalom is set over one. */
  slalom?: SlalomCourse;
  /** A DOWNHILL set on the map (R32, `setDownhill`): its gates are this
   * map's `checkpoints`, its start house the `spawn`. Absent on every map
   * the generator builds — a downhill is set over one. */
  downhill?: DownhillCourse;
  /** A SUPER-G set on the map (R33, `setSuperG`): its gates are this map's
   * `checkpoints`, its start house the `spawn`. Absent on every map the
   * generator builds — a super-G is set over one. */
  superG?: SuperGCourse;
  /** A GIANT SLALOM set on the map (R36, `setGiantSlalom`): its gates are
   * this map's `checkpoints`, its start house the `spawn`. Absent on every
   * map the generator builds — a giant slalom is set over one. */
  giantSlalom?: GiantSlalomCourse;
  /** A SPEED-SKIING TRACK set on the map (R34, `setSpeedSki`): its `track`
   * is the straight speed track cut down the fall line, its checkpoints
   * the start gate and the TIMING ZONE's two lines, its start house the
   * `spawn`. Absent on every map the generator builds — a speed track is
   * set over one. */
  speedSki?: SpeedSkiCourse;
  /** A SKI-CROSS COURSE built on the map (R35, `setSkiCross`): its `track`
   * is the course weaving down the piste's corridor, its ground graded and
   * its features built in the snow, its checkpoints the start gate, the
   * flags and the finish line, its `grid` the start gate's lanes. Absent on
   * every map the generator builds — a ski cross is built over one. */
  skiCross?: SkiCrossCourse;
  /** A BIG AIR JUMP built on the map (R37, `setBigAir`): its `track` is the
   * straight jump cut down the face — the platform, the drop-in, the
   * kicker, the table, the landing and the run-out — its checkpoints the
   * start gate and the finish line, its start platform the `spawn`. Absent
   * on every map the generator builds — a jump is built over one. */
  bigAir?: BigAirCourse;
  /** A SLOPESTYLE COURSE built on the map (R38, `setSlopestyle`): its
   * `track` the straight course cut down the face — the start platform,
   * three rail sections and three jump sections — its checkpoints the start
   * gate and the finish line, its start platform the `spawn`, its jumps'
   * kickers among the map's `kickers` and its rails and boxes the `jibs`.
   * Absent on every map the generator builds. */
  slopestyle?: SlopestyleCourse;
  /** A HALFPIPE built on the map (R39, `setHalfpipe`): its `track` the
   * straight line cut down the face — the platform, the pitch with the
   * pipe in it, the run-out — its checkpoints the start gate and the
   * finish line, its start platform the `spawn`, and the pipe's surface
   * answered by `groundAt` / `normalAt` / `normalNear`. Absent on every
   * map the generator builds. */
  halfpipe?: HalfpipeCourse;
  /** A MOGULS COURSE built on the map (R40, `setMoguls`): its `track` the
   * straight line cut down the face — the platform, the pitch with the
   * mogul track and the two air bumps in it, the finish area — its
   * checkpoints the start gate, the control gates and the finish line,
   * its start platform the `spawn`, its air bumps the map's `kickers`, and
   * the moguls answered by `groundAt` / `normalAt`. Absent on every map the
   * generator builds. */
  moguls?: MogulsCourse;
  /** AN AERIALS SITE built on the map (R41, `setAerials`): its `track` the
   * straight line cut down the face — the platform, the in-run, the table
   * with its one kicker, the knoll, the landing hill and the out-run — its
   * checkpoints the start gate and the finish line, its start platform the
   * `spawn`, its kicker the map's one kicker, and the site answered by
   * `groundAt` / `normalAt` off its analytic surface (`bumps`, with no
   * moguls in it). Absent on every map the generator builds. */
  aerials?: AerialsCourse;
  /** THE JIBS standing on the map — the rails and boxes a skier slides on
   * (`jib.ts`). Absent on every map the generator builds: a venue sets
   * them (R38). */
  jibs?: Jib[];
}

/** A JIB (R38): a RAIL or a BOX a skier slides on — a line, not a
 * surface. Its riding top is the polyline `points` from the end he mounts
 * at to the end he leaves by, each point in the world, m; `width` the
 * width of what he stands on (a rail's pipe, a box's top), m. */
export interface Jib {
  /** `J<section><L|R>` — the section, and the line's side. */
  id: string;
  /** The rail section it stands in, from 1. */
  section: number;
  /** Its line across the course: −1 the left (looking down it), +1 the
   * right. */
  line: number;
  kind: "rail" | "box";
  /** Its shape, from the top: `"down"` the slope's own fall all the way,
   * `"flatDown"` level then down, `"downFlatDown"` down, level and down,
   * `"rainbow"` up over an arch and down. */
  shape: "down" | "flatDown" | "downFlatDown" | "rainbow";
  points: Vec3[];
  width: number;
}

/** One SECTION of a slopestyle course (R38), by its arcs down the course,
 * m: a RAIL section (its jibs side by side) or a JUMP (`lip` its kicker's
 * lip, `knuckle` its table's end — what a flight off it is judged
 * against). */
export interface SlopeSection {
  kind: "rail" | "jump";
  from: number;
  to: number;
  lip?: number;
  knuckle?: number;
  /** The speed it is designed to be met at, m/s: a rail section's at its
   * jibs' start, a jump's off its lip. */
  speed: number;
}

/** A SLOPESTYLE COURSE (R38) as it was built over a map: its own `track`,
 * every arc down it, m. */
export interface SlopestyleCourse {
  /** The map it was built over, before any course. */
  base: Level;
  /** The start gate's arc and the finish line's, m. */
  from: number;
  to: number;
  /** The vertical between them, m. */
  vertical: number;
  /** The six judged sections, in the order they are ridden. */
  sections: SlopeSection[];
  /** How far either side of the course's middle a rail section's two
   * lines run, m. */
  lines: number;
  /** The course's width, m. */
  width: number;
}

/** A HALFPIPE (R39) as it was built over a map: its own `track`, every
 * arc down it, m, and the pipe on it. */
export interface HalfpipeCourse {
  /** The map it was built over, before any course. */
  base: Level;
  /** The start gate's arc and the finish line's, m. */
  from: number;
  to: number;
  /** The vertical between them, m. */
  vertical: number;
  /** The pipe: its line, its section and where its walls stand. */
  pipe: PipeFrame;
}

/** A MOGULS COURSE (R40) as it was built over a map: its own `track`, every
 * arc down it, m. */
export interface MogulsCourse {
  /** The map it was built over, before any course. */
  base: Level;
  /** The start gate's arc and the finish line's, m. */
  from: number;
  to: number;
  /** The control gates' arcs, m, in order down the course. */
  gates: number[];
  /** The vertical between the start and the finish, m, and the course's
   * length down the slope, m. */
  vertical: number;
  length: number;
  /** THE AIR BUMPS: each its kicker's foot and lip and the end of its
   * landing, m along; and the lip's height over the pitch, m. */
  airs: { foot: number; lip: number; landed: number }[];
  airHeight: number;
  /** The pitch, rad. */
  pitch: number;
  /** The mogul field (`Level.bumps`). */
  field: MogulField;
}

/** A BIG AIR JUMP (R37) as it was built over a map: its own `track`, every
 * arc down it, m. */
export interface BigAirCourse {
  /** The map it was built over, before any course. */
  base: Level;
  /** The start gate's arc and the finish line's, m. */
  from: number;
  to: number;
  /** The vertical between them, m. */
  vertical: number;
  /** The flat's end (the kicker's foot), the LIP, the KNUCKLE (the table's
   * end), the landing's end and the run-out's start, m. */
  foot: number;
  lip: number;
  knuckle: number;
  landing: number;
  outrun: number;
  /** The lip's height over the flat, m, and its take-off angle, rad. */
  height: number;
  kick: number;
  /** The speed off the lip the drop-in is sized for, m/s. */
  speed: number;
  /** The jump's width, m. */
  width: number;
}

/** Which of an aerials site's three kickers a jump is assigned (R41). */
export type AerialKicker = "single" | "double" | "triple";

/** AN AERIALS SITE (R41) as it was built over a map: its own `track`, every
 * arc down it, m. */
export interface AerialsCourse {
  /** The map it was built over, before any course. */
  base: Level;
  /** The kicker it was built with. */
  kicker: AerialKicker;
  /** The start gate's arc and the finish line's, m. */
  from: number;
  to: number;
  /** The vertical between them, m. */
  vertical: number;
  /** The in-run's foot (the table's start), the kicker's foot, its LIP,
   * the KNOLL (the table's end), the landing hill's foot and the
   * out-run's start, m. */
  table: number;
  foot: number;
  lip: number;
  knoll: number;
  landing: number;
  outrun: number;
  /** The lip's height over the table, m, its take-off, rad, and the
   * landing hill's grade, rad. */
  height: number;
  kick: number;
  slope: number;
  /** The speed off the lip the in-run is sized for, m/s. */
  speed: number;
  /** The site's width, m. */
  width: number;
  /** The site's height `d` m of plan along its line, m (the start
   * platform's back at 0) — the analytic surface. */
  yAt: (d: number) => number;
}

/** One of a ski-cross course's BUILT FEATURES (R35), by its arcs down the
 * course, m: a BERM (a banked turn, `side` the inside: −1 left, +1 right),
 * a series of ROLLERS, a JUMP (`lip` its take-off's arc, `height` the lip
 * over the line) or a STEP-DOWN (the same, onto a lower landing). */
export interface CrossFeature {
  kind: "berm" | "rollers" | "jump" | "step";
  from: number;
  to: number;
  side?: -1 | 1;
  lip?: number;
  height?: number;
}

/** A SKI-CROSS COURSE (R35) as it was built over a map: its own `track`,
 * the piste's corridor it weaves down, its features and its fence. */
export interface SkiCrossCourse {
  /** The map it was built over, before any course. */
  base: Level;
  /** The start gate's arc (its doors) and the finish line's, m. */
  from: number;
  to: number;
  /** The vertical between them, m. */
  vertical: number;
  /** The course's width, m. */
  width: number;
  /** Every built feature, in the order they are skied. */
  features: CrossFeature[];
  /** THE FENCE along both edges: its line this far outside the course's
   * edge, m, this tall, m, from arc `from` to `to`. */
  nets: { gap: number; height: number; from: number; to: number };
  /** The stretch of the piste it was built on, m of the piste's own arc. */
  axis: { from: number; to: number };
}

/** A SPEED-SKIING TRACK (R34) as it was set over a built map: a straight
 * cut down the fall line, graded smooth and groomed hard, its own `track`
 * — the map's piste is not skied. Every arc is down this track. */
export interface SpeedSkiCourse {
  /** Which run of the two (R34): the QUALIFICATION from a lowered start
   * (1), or the FINAL from the top (2). */
  run: 1 | 2;
  /** The map it was set over, before any course. */
  base: Level;
  /** The run's start gate's arc (the wand), m, and the timing zone's end —
   * where the run is measured to. */
  from: number;
  to: number;
  /** The vertical between them, m. */
  vertical: number;
  /** THE TIMING ZONE: its two lines' arcs, m, and its length along the
   * snow, m — the speed is that length over the time between them. */
  zone: { from: number; to: number; length: number };
  /** The final's start, at the top of the track, m — a qualification
   * starts lower. */
  top: number;
  /** The run-out's end, m: where the track stops, on the valley floor. */
  stop: number;
  /** The track's width, m. */
  width: number;
}

/** A COURSE SET ON A RACING LINE over a built map — a downhill's (R32), a
 * super-G's (R33) or a giant slalom's (R36): the stretch, the nets along
 * it, the trap (a speed event's),
 * the jumps it keeps and the racing line its gates are set on
 * (`speed-course.ts`). */
export interface SpeedCourse {
  /** The map it was set over, before any course. */
  base: Level;
  /** The stretch of the piste it is set on — a downhill's the whole of it,
   * a super-G's from a start lowered into the band: the start gate's arc
   * (the wand) and the finish line's, m. */
  from: number;
  to: number;
  /** The vertical between them, m. */
  vertical: number;
  /** THE SPEED TRAP: its arc down the piste, m, and its line across it
   * (a point on the piste's centreline and the way down it there) — a
   * speed event's; a giant slalom has none. */
  trap?: SpeedTrap;
  /** THE A-NETS along both edges: their line this far outside the piste's
   * edge, m, this tall, m, from arc `from` to `to`. */
  nets: { gap: number; height: number; from: number; to: number };
  /** The jumps the course keeps (its drops, by arc), m. */
  jumps: number[];
  /** THE RACING LINE (`speedLineAt`): points down the course every few
   * metres, each an arc and how far right of the piste's centreline, m — a
   * downhill's the line that bends the least inside the piste, which its
   * gates mark; a super-G's that line swung round its turning poles. */
  line: { s: number; x: number }[];
}

/** A speed event's SPEED TRAP: its arc down the piste, m, and its line
 * across it (a point on the piste's centreline and the way down it there). */
export type SpeedTrap = { s: number; x: number; z: number; heading: number; width: number };

/** A DOWNHILL COURSE (R32) as it was set over a built map. */
export type DownhillCourse = SpeedCourse & { trap: SpeedTrap };

/** A SUPER-G COURSE (R33) as it was set over a built map: a speed course
 * whose gates TURN the racer. */
export interface SuperGCourse extends SpeedCourse {
  trap: SpeedTrap;
  /** The direction changes its gates make. */
  turns: number;
}

/** A GIANT-SLALOM COURSE (R36) as it was set over a built map: a course
 * on a racing line whose gates turn the racer, one of two runs. */
export interface GiantSlalomCourse extends SpeedCourse {
  /** Which run of the two — each set afresh on the same stretch. */
  run: 1 | 2;
  /** The direction changes its gates make. */
  turns: number;
}

/** A SLALOM COURSE (R31) as it was set over a built map. */
export interface SlalomCourse {
  /** Which run of the two (R31) — each set afresh on the same stretch. */
  run: 1 | 2;
  /** The map it was set over, before any slalom: what a run's other course
   * is set over again. */
  base: Level;
  /** The stretch of the piste it is set on: the start gate's arc (the
   * wand) and the finish line's, m. */
  from: number;
  to: number;
  /** The vertical between them, m. */
  vertical: number;
  /** How many of each combination it carries. */
  hairpins: number;
  verticals: number;
  delays: number;
  /** THE LINE A RACER TAKES (`slalomLineAt`): points down the course, each
   * an arc and how far right of the piste's centreline, m — just outside
   * every turning pole, across the middle of every closed gate. */
  line: { s: number; x: number }[];
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

/** R42 — A SKI ROUTE (`ski-routes.ts`): an ORANGE run, marked down the
 * mountain as it lies and never groomed — its line off a top station's rim
 * (`TrackPoint`s, arc from the rim, `width` the marked corridor), the lift
 * it leaves the top of, the run it comes down onto and at what arc of that
 * one, and its steepest `track.colourWindow`, m per m — past any black's. */
export interface SkiRoute {
  id: string;
  grade: "orange";
  points: TrackPoint[];
  length: number;
  from: string;
  into: { run: string; s: number };
  steepest: number;
}

/** A lift (R26): a straight line from its bottom station to its top. */
export interface Lift {
  id: string;
  kind: "gondola" | "chair" | "drag";
  bottom: Vec3;
  top: Vec3;
  /** THE RAMPS OFF ITS TOP (R26): one down from its pad's
   * rim to the head of each run a rider skis onto from it. Absent on a drag
   * and on a map from before them. */
  ramps?: SummitRamp[];
}

/** A RAMP OFF A TOP (R26, `summit-ramps.ts`): from the pad's rim (`from`, on
 * the pad's surface) down to where it joins the run `run` (`to`, its point
 * there and its arc `s`), `width` m wide — eased off the pad, even down to
 * the run's head, the run's lip. */
export type SummitRamp = {
  run: string;
  from: Vec3;
  to: Vec3 & { s: number };
  width: number;
};

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
  /** R42 — the ski routes, "SR1"…; absent on a map from before them. */
  routes?: SkiRoute[];
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
  /** The generator version to build by (`versions.ts`) — a pinned map's
   * row; the current rules when left out or unknown. */
  version?: GeneratorVersion;
  /** Lay the TERRAIN PARK on the piste (R20) — a map for a tricks run. Left
   * out, the map carries none and is exactly the seed's race map. */
  tricks?: boolean;
  /** The kind of snow country to build in (R21, `regions.ts`); the alpine
   * when left out. */
  region?: RegionId;
  /** R25 — raise the resort on a REAL face (`real-face.ts`'s ids) rather
   * than a dealt massif; its region is the face's own, whatever `region`
   * says. Left out (or an id no face has), the massif the seed deals. */
  face?: string;
  /** The PISTE GRADE to build to (R23, `grades.ts`); the one the seed deals
   * when left out. A version from before the grades builds none either way.
   * On a resort (R28): the colour of the course raced — ORANGE (R42), a
   * ski route's, the hardest piste's, as no course is a route. */
  grade?: RunGrade;
  /** R28 — the course a resort map is raced on, by id; one of `grade`'s (or
   * the seed's) when left out. */
  course?: string;
  /** Told how far the search has got, 0–1, at its landmarks (`progress.ts`)
   * — for a loading card's bar. Draws nothing and moves nothing it builds. */
  progress?: (share: number) => void;
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
