// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS — the catalog of pairs this game is skied on, stated as data.
// Every pair is the same kind of thing: two skis with a sidecut, on
// bindings under a pair of boots, a pair of poles in the skier's hands, and
// the skier himself — his legs the only suspension there is. Every number
// carries its unit, and where it came from is said beside it: a real class
// of ski's proportions are kept as the BAND they sit in, never as a make.
//
// TWELVE PAIRS, TWELVE ANSWERS TO A KIND OF SNOW — never nine points on one
// scale.
// Each is a real class of ski, named for an animal of the high country that
// moves the way it does, and its numbers sit inside that class's measured
// bands:
//   CHAMOIS an ALL-MOUNTAIN ski — the middle of every band, the pair the
//           shared model was tuned on (`TUNING` is stated against it), the
//           default: at home on the piste and off it, best at nothing.
//   SWIFT   a SLALOM ski — short, narrow, a tight 13 m sidecut: the
//           quickest thing edge to edge, chattering and nervous at speed.
//   CHOUGH  a GIANT SLALOM ski — long, stiff, a 30 m sidecut: the carving
//           racer, holding an edge on ice a slalom ski skids off.
//   FALCON  a SUPER-G ski — longer than the giant slalom ski, a 45 m
//           sidecut: the edge that holds the hardest bend at a hundred
//           kilometres an hour, where one ski chatters and the other will
//           not bend.
//   EAGLE   a DOWNHILL ski — the longest and stiffest alpine ski here, a
//           50 m sidecut: flat out in a tuck it outruns every pair but one,
//           and it hates a bend.
//   WOLVERINE a SKI-CROSS ski — a giant slalom ski cut down for a course
//           built in the snow: shorter, a 24 m sidecut for its berms, a
//           softer shovel for its rollers and landings, on a high plate.
//   PEREGRINE a SPEED SKI — the speed-skiing class: 2.40 m of heavy, damped
//           ski with next to no sidecut, under a racer in an airtight suit
//           and calf fairings: straight down the fall line nothing comes
//           near it, and it will not turn.
//   MARMOT  a POWDER ski — wide under foot and rockered at the tip: floats
//           where the others sink, vague and slow on the groomer.
//   HARE    a PARK ski — a soft twin-tip: spins, lands anything softly,
//           slow in a tuck and loose on an edge.
//   RAVEN   a BIG-AIR ski — the competition park twin-tip: longer and
//           stiffer than the Hare, damp for a landing from ten metres up,
//           still mounted near its centre to spin and ride away switch.
//   IBEX    a MOGUL ski — short, narrow and straight, soft in the forebody:
//           pivots on a mogul's shoulder and folds over its crest, nervous
//           anywhere it can run.
//   KESTREL an AERIALS ski — short, narrow, light and nearly straight,
//           stiff underfoot: holds a dead straight line into a 71°
//           kicker and swings round three flips and five twists, and
//           little else.
// What separates them is what separates the real classes: the length, the
// waist and the tip, the sidecut radius, the flex and the rocker
// (`footprint.ts` prices every one), and what the skier can do on them.
// The three speed-event pairs stand inside their discipline's COMPETITION
// RULES at the top level (`docs/disciplines.md`, "The skis"), the men's
// least length and sidecut radius and the most waist and shoulder; the
// speed ski inside speed skiing's (§ Speed skiing: 2.20–2.40 m, at most
// 10 cm wide and 15 kg a pair).
//
// THE SIDECUT IS THE WIDTHS' GEOMETRY. A ski's edge between its widest
// points (the shoulder at the tip, the tail's corner — a chord `c`, about
// nine tenths of the length on a race ski) bows in by the side depth
// d = ((tip + tail) / 2 − waist) / 2, and the circle through those three
// points is R ≈ c² / 8d. The widths and the sidecut are stated together so
// that circle is the one the spec carves (`tests/topsheet_test.ts` holds
// every pair to it off the traced plan).
//
// The body frame is the engine's: x to the skier's right, y up, z forward,
// the origin at the centre of gravity of skier AND skis together. Every
// position below is measured from there.
//
// `topSpeed` is a DOCUMENTED EXPECTATION, not an input: the physics is what
// delivers it, `tests/skier_test.ts` holds it to it, and the bot reads it
// (`limits.ts`) to know what flat out is.

export type LegSpec = {
  /** The legs as a spring, N/m PER SKI (the three stations of one ski share
   * it): a skier's stance settles a few centimetres under his weight. */
  rate: number;
  /** Damping per ski, N·s/m — `bump` as the knees fold, `rebound` as they
   * straighten (a leg is always softer folding than straightening). */
  bump: number;
  rebound: number;
  /** Travel from standing tall to the knees fully bent, m. */
  travel: number;
};

export type SkiId =
  | "chamois"
  | "swift"
  | "chough"
  | "falcon"
  | "eagle"
  | "wolverine"
  | "peregrine"
  | "marmot"
  | "hare"
  | "raven"
  | "ibex"
  | "kestrel";

/** The snowboards (`boards.ts`), named as the skis are. */
export type BoardId = "lynx";

/** Any pair this game is ridden on: a pair of skis or a board. */
export type PairId = SkiId | BoardId;

/** A SNOWBOARD'S OWN SETUP (`boards.ts`) — what a board has and a pair of
 * skis does not: both feet on one deck, one behind the other along it. */
export type BoardFit = {
  /** Binding centre to binding centre ALONG the deck, m (about 0.30–0.32
   * of the rider's height). */
  stance: number;
  /** The bindings' angles off the line across the board, rad, positive
   * toward the nose: the front foot's and the back foot's. */
  front: number;
  back: number;
  /** Which foot leads at the nose: "regular" the left (the rider facing the
   * board's right, his toe edge on +x), "goofy" the right. */
  lead: "regular" | "goofy";
};

export type SkiSpec = {
  id: PairId;
  /** The pair's own name — an animal that moves the way it skis. */
  name: string;
  /** The class of ski, as the ski card bills it. */
  kind: string;
  /** One line the ski card says about it — what it is FOR. */
  blurb: string;
  /** The skier in his kit, kg. */
  skierMass: number;
  /** The skis, the bindings, the boots and the poles, kg (7–10 for a pair
   * of adult skis with race boots). */
  gearMass: number;
  /** The ski's length, m (slalom 1.55–1.65; giant slalom 1.93–1.95, the
   * rule's least 1.93 for men and 1.88 for women; super-G 2.10–2.13, the
   * least 2.10 for men and 2.05 for women; downhill 2.18–2.23, the
   * least 2.18 for men; all-mountain 1.70–1.85). */
  length: number;
  /** The widths, m: under the boot, at the tip, at the tail — the waist is
   * what the ski floats and turns on in powder, the tip what ploughs. */
  waist: number;
  tipWidth: number;
  tailWidth: number;
  /** THE SIDECUT RADIUS, m — the arc the ski's edge is cut to, and the
   * turn it carves at 45° of edge (`skier.ts`). Slalom 11–13; giant slalom
   * 30–35, the rule's least 30; super-G 45–50, the least 45 for men and 40
   * for women; downhill 50–55, the least 50; all-mountain
   * 15–20. */
  sidecut: number;
  /** How stiff the ski is, 0 (a soft park ski) … 1 (a downhill ski): a
   * stiff ski holds an edge on ice and pushes back at speed; a soft one
   * forgives a landing. */
  flex: number;
  /** How much of the tip is rockered, 0 (full camber) … 1 (the tip lifted
   * a hand's height): a rockered tip floats and turns in powder and gives
   * up edge on the groomer. */
  rocker: number;
  /** The most edge the skier can put the ski on at a standstill, rad
   * (`edgeLockAt` eases it with speed). Racers stand a ski at 65–75° in a
   * carve; a recreational skier at 30–50°. */
  edgeMax: number;
  /** The stance, m: boot centre to boot centre. */
  stance: number;
  /** Where the boot stands along the ski, as a share of its length from the
   * tail (a mounted binding is a little aft of centre: 0.45–0.48; a park
   * ski's twin-tip mount is centred). */
  mount: number;
  /** THE LEGS: the only suspension a skier has. */
  legs: LegSpec;
  /** Drag area, m²: standing tall, and folded into a tuck. A racer's tuck
   * is 0.25–0.35 m², a recreational skier's half-tuck 0.45–0.6; upright on
   * a piste 0.6–0.9. */
  cdAUpright: number;
  cdATuck: number;
  /** Centre of gravity above the snow standing tall, m (skier and skis),
   * and how far a full tuck drops it, m. */
  cogHeight: number;
  crouchDrop: number;
  /** The skier's mass centre above the whole's, m, and how far his hips can
   * hang inside a turn, m (the angulation). */
  skierHeight: number;
  hipReach: number;
  /** THE POLES: a plant's reach ahead of the boots, m, and the push one
   * plant delivers along the snow, N (a skating push-off, both poles and
   * a leg, is 200–300 N over the plant). */
  poleReach: number;
  polePush: number;
  /** Documented expectation: km/h flat out in a tuck down a 20° groomed
   * pitch (`TOP_SPEED_PITCH`, a red piste's steep pitch), once the drag
   * holds it. */
  topSpeed: number;
  /** A SNOWBOARD's setup — present on a board alone (`boards.ts`): its
   * stations stand in one column down the deck at its whole width
   * (`suspension.ts`), its rider carries no poles and never turns round
   * out of riding fakie (`switch.ts`). A pair of skis has none. */
  board?: BoardFit;
};

/** A PAIR OF SKIS — a spec that is one of the catalog's skis, never a
 * board: what the ski card, the models and the topsheets are keyed on. */
export type SkisSpec = SkiSpec & { id: SkiId };

/** THE CHAMOIS — the ALL-MOUNTAIN ski, the reference pair, and the one
 * every shared number in `TUNING` was tuned on: at home on the piste and
 * off it, the middle of every band and best at nothing. A 178 cm ski with
 * an 88 mm waist (the class runs 85–95), a 130 mm tip, an 18 m sidecut,
 * medium flex, a little tip rocker, under an 80 kg skier in his kit. */
export const SKIS: SkisSpec = {
  id: "chamois",
  name: "Chamois",
  kind: "All-mountain",
  blurb: "At home on the piste and off it: asks nothing of the snow and refuses nothing.",
  skierMass: 80,
  gearMass: 8.5,
  length: 1.78,
  waist: 0.088,
  tipWidth: 0.13,
  tailWidth: 0.114,
  sidecut: 18,
  flex: 0.5,
  rocker: 0.25,
  edgeMax: 1.05,
  stance: 0.3,
  mount: 0.46,
  // A skier's stance settles about 6 cm under his own weight on each leg,
  // about 1.8 Hz in heave, and a knee that folds softer than it straightens:
  // a landing taken in one bob.
  legs: { rate: 7500, bump: 500, rebound: 900, travel: 0.45 },
  cdAUpright: 0.9,
  cdATuck: 0.48,
  cogHeight: 1.0,
  crouchDrop: 0.3,
  skierHeight: 0.05,
  hipReach: 0.35,
  poleReach: 0.9,
  polePush: 260,
  topSpeed: 118,
};

/** THE SWIFT — a SLALOM ski: short, narrow and quick, made for a gate every
 * ten metres. 165 cm on a 66 mm waist with a 13 m sidecut (the class is
 * 11–13), stiff underfoot, no rocker: it goes edge to edge faster than
 * anything here and bites a groomed bend a longer ski runs wide in — and at
 * speed it chatters, and in powder its narrow waist sinks. */
export const SWIFT: SkisSpec = {
  ...SKIS,
  id: "swift",
  name: "Swift",
  kind: "Slalom",
  blurb: "Short and narrow on a tight sidecut: darts from edge to edge, nervous at speed.",
  length: 1.65,
  waist: 0.066,
  tipWidth: 0.122,
  tailWidth: 0.104,
  sidecut: 13,
  flex: 0.6,
  rocker: 0,
  edgeMax: 1.15,
  mount: 0.47,
  cdAUpright: 0.88,
  cdATuck: 0.53,
  topSpeed: 112,
};

/** THE CHOUGH — a GIANT SLALOM ski: the carving racer, built to the
 * men's top-level rule. 193 cm (the least the rule allows a man; 188 is the
 * women's) on a 65 mm waist (the most it allows) with a 30 m sidecut (the
 * least it allows; the class is skied on 30–35, and a racer picks the
 * tightest he may), a 98 mm shoulder (at most 103) and an 80 mm tail —
 * 12 mm of side depth over a 1.70 m chord, which is 30 m. Stiff, no
 * rocker: it holds an edge on ice the slalom ski skids off and carries its
 * speed through a long bend, and it wants a bend that long — a tight one
 * it has to be skidded round. */
export const CHOUGH: SkisSpec = {
  ...SKIS,
  id: "chough",
  name: "Chough",
  kind: "Giant slalom",
  blurb: "Long, stiff and cut for a wide arc: holds an edge on ice, skids a tight bend.",
  length: 1.93,
  waist: 0.065,
  tipWidth: 0.098,
  tailWidth: 0.08,
  sidecut: 30,
  flex: 0.8,
  rocker: 0,
  edgeMax: 1.15,
  mount: 0.46,
  legs: { rate: 7800, bump: 520, rebound: 940, travel: 0.45 },
  cdAUpright: 0.9,
  cdATuck: 0.42,
  topSpeed: 126,
};

/** THE FALCON — a SUPER-G ski: the speed event whose gates turn the racer,
 * built to the men's top-level rule. 210 cm (the least the rule allows a
 * man, where racers ski 210–213; 205 is the women's and a lower level's)
 * on a 65 mm waist (the most it allows) with a 45 m sidecut (the least it
 * allows; the class is skied on 45–45.5, 40 for women), a 94 mm shoulder
 * (at most 95; the class runs 93.5–95) and a 79 mm tail (78–81) — 11 mm
 * of side depth over the 1.97 m its short, low shovel leaves between the
 * widest points, which is 45 m. Stiff underfoot under three sheets of
 * metal, a little softer at the ends, no rocker, on a race plate. Its
 * answer is a long bend at a hundred kilometres an hour:
 * there its 45 m arc asks about all its edge can hold, where the giant
 * slalom ski's tighter arc asks more than it holds and chatters, and the
 * downhill ski's longer one never asks enough to use its edge. Slower than
 * the downhill ski flat out, slower than the giant slalom ski edge to
 * edge. */
export const FALCON: SkisSpec = {
  ...SKIS,
  id: "falcon",
  name: "Falcon",
  kind: "Super-G",
  blurb: "Long and stiff on a 45 m sidecut: holds the hardest bend at a hundred km/h.",
  gearMass: 9.5,
  length: 2.1,
  waist: 0.065,
  tipWidth: 0.094,
  tailWidth: 0.079,
  sidecut: 45,
  flex: 0.9,
  rocker: 0,
  edgeMax: 1.12,
  mount: 0.455,
  legs: { rate: 8000, bump: 540, rebound: 960, travel: 0.45 },
  cdAUpright: 0.9,
  cdATuck: 0.38,
  topSpeed: 132,
};

/** THE EAGLE — a DOWNHILL ski: the fastest thing here in a straight line,
 * built to the men's top-level rule. 218 cm (the least the rule allows a
 * man) on a 65 mm waist (the most it allows) with a 50 m sidecut (the least
 * it allows; the class is skied on 50–55), a 90 mm shoulder (at most 95)
 * and a 75 mm tail — under 9 mm of side depth over a 1.88 m chord, which
 * is 50 m. The stiffest ski in the catalog, in the smallest tuck here
 * (0.35 m² of drag): on a long schuss it outruns everything and lands a
 * downhill's jumps on its length — and it hates a bend, hangs its tips in
 * powder and takes its time onto an edge. */
export const EAGLE: SkisSpec = {
  ...SKIS,
  id: "eagle",
  name: "Eagle",
  kind: "Downhill",
  blurb: "Two metres and more of stiff ski: flat out it outruns everything, and it hates a bend.",
  gearMass: 10,
  length: 2.18,
  waist: 0.065,
  tipWidth: 0.09,
  tailWidth: 0.075,
  sidecut: 50,
  flex: 1,
  rocker: 0,
  edgeMax: 1.1,
  mount: 0.45,
  legs: { rate: 8200, bump: 560, rebound: 980, travel: 0.45 },
  cdAUpright: 0.9,
  cdATuck: 0.35,
  topSpeed: 138,
};

/** THE WOLVERINE — a SKI-CROSS ski (named for the fiercest small thing in
 * the high country, which gives way to nothing): a race ski for a course
 * built in the snow (R35), skied four abreast. The ski-cross rules set no
 * length, width or sidecut — only a binding plate no higher than 50 mm — so
 * the class is what racers ski: a GIANT-SLALOM-TYPE ski cut down, some
 * 1.80–1.95 m on a 21–27 m arc (est., `docs/disciplines.md` § Ski cross).
 * 188 cm on a 68 mm waist with a 24 m sidecut, a 105 mm shoulder and a
 * 91 mm tail — 15 mm of side depth over its chord, which is 24 m — stiff
 * underfoot under its plate with a softer shovel for the rollers and the
 * landings, a touch of tip rocker, on a race suit's tuck. Its answer is a
 * berm taken at 60 km/h and a landing taken without a bobble: it turns
 * tighter than the giant slalom ski, holds more at speed than the slalom
 * ski, and lands what a stiffer race ski folds on. */
export const WOLVERINE: SkisSpec = {
  ...SKIS,
  id: "wolverine",
  name: "Wolverine",
  kind: "Ski cross",
  blurb: "A race ski cut down for berms and jumps: turns hard, lands clean, gives no ground.",
  gearMass: 9.5,
  length: 1.88,
  waist: 0.068,
  tipWidth: 0.105,
  tailWidth: 0.091,
  sidecut: 24,
  flex: 0.7,
  rocker: 0.1,
  edgeMax: 1.12,
  mount: 0.46,
  legs: { rate: 7600, bump: 500, rebound: 900, travel: 0.47 },
  cdAUpright: 0.9,
  cdATuck: 0.44,
  topSpeed: 122,
};

/** THE PEREGRINE — a SPEED SKI, the speed-skiing class (named for the
 * fastest thing in the sky, in its stoop): built to the top class's rule —
 * 2.40 m (the most it allows; the class runs 2.20–2.40), under 10 cm wide
 * (the most it allows) and next to no sidecut, a ~285 m arc over the 2.15 m
 * between the widest points — heavy and damped to keep its tips down, run
 * flat on its base: "essentially impossible to turn". The racer on it is in
 * the class's kit — an airtight suit with fairings behind his calves and an
 * aero shell over his helmet, 15 kg of skis, 6 of boots and 6 of helmet,
 * poles and fairings — and folds into a tuck of 0.08 m² of drag area (the
 * measured top class's 0.06–0.09; 0.65 stood up in race clothes, a little
 * less in the suit). He is the catalog's 80 kg skier, as on every pair; the
 * class's heavy men — heavier is faster — are the HEAVY build
 * (`riders.ts`), some 140 kg with the kit. Straight down a
 * fall line nothing comes near it; it carves no bend, chatters on nothing,
 * and in powder its weight sinks it. */
export const PEREGRINE: SkisSpec = {
  ...SKIS,
  id: "peregrine",
  name: "Peregrine",
  kind: "Speed ski",
  blurb:
    "Two and a half metres of damped ski and an airtight suit: it goes straight, and only straight.",
  gearMass: 27,
  length: 2.4,
  waist: 0.094,
  tipWidth: 0.099,
  tailWidth: 0.097,
  sidecut: 285,
  flex: 1,
  rocker: 0,
  edgeMax: 0.9,
  mount: 0.45,
  legs: { rate: 9000, bump: 620, rebound: 1040, travel: 0.42 },
  cdAUpright: 0.6,
  cdATuck: 0.08,
  crouchDrop: 0.36,
  poleReach: 0.6,
  polePush: 240,
  topSpeed: 316,
};

/** THE MARMOT — a POWDER ski: wide under foot and rockered at the tip.
 * 186 cm on a 116 mm waist (the class is 105–125) with a 22 m sidecut and
 * a soft, lifted tip: it floats up out of powder the others sink in and
 * turns there off its base — and on the groomer the wide waist is slow onto
 * its edge, vague once there, and the soft tip wanders at speed. */
export const MARMOT: SkisSpec = {
  ...SKIS,
  id: "marmot",
  name: "Marmot",
  kind: "Powder",
  blurb: "Wide and rockered: floats where the others sink, vague and slow on the groomer.",
  gearMass: 9.5,
  length: 1.86,
  waist: 0.116,
  tipWidth: 0.142,
  tailWidth: 0.13,
  sidecut: 22,
  flex: 0.4,
  rocker: 0.7,
  edgeMax: 0.95,
  mount: 0.47,
  cdAUpright: 0.9,
  cdATuck: 0.57,
  topSpeed: 108,
};

/** THE HARE — a PARK ski: a soft twin-tip mounted on its centre. 174 cm on
 * a 90 mm waist with a 17 m sidecut, the softest ski here, flat-cambered
 * with a little rocker at both ends: it spins the easiest, lands anything
 * without a jolt (the soft ski and a low harsh speed's worth of give), and
 * it is slow in a tuck, loose on an edge and buried in deep powder. */
export const HARE: SkisSpec = {
  ...SKIS,
  id: "hare",
  name: "Hare",
  kind: "Park",
  blurb: "A soft twin-tip on a centre mount: spins and lands anything, slow and loose on an edge.",
  gearMass: 8,
  length: 1.74,
  waist: 0.09,
  tipWidth: 0.122,
  tailWidth: 0.12,
  sidecut: 17,
  flex: 0.2,
  rocker: 0.35,
  edgeMax: 1.0,
  mount: 0.5,
  legs: { rate: 6800, bump: 460, rebound: 820, travel: 0.48 },
  cdAUpright: 0.9,
  cdATuck: 0.59,
  topSpeed: 106,
};

/** THE RAVEN — a BIG-AIR ski (named for the bird that rolls and tumbles in
 * the air for the joy of it): the competition park twin-tip a big air jump
 * is ridden on (`docs/freestyle.md` § *Big air*, "The skis"). The freestyle
 * rules set no length, width or sidecut, so the class is what the
 * athletes ride: a twin-tip of some 1.78–1.84 m on an 85–96 mm waist and a
 * 17–20 m arc, built STIFF and damp for the take-off and a landing from ten
 * metres up where a jib ski is soft for rails, and mounted a few
 * centimetres behind its true centre to spin either way and ride away
 * switch. 180 cm on an 88 mm waist with a 20 m sidecut — 14 mm of side
 * depth over its chord — a little rocker at both ends, and the legs of a
 * skier set for big landings: a deeper fold than the race pairs', a
 * firmer one than the Hare's. Its answer is a kicker taken at 60 km/h and
 * a 1440 put down on the landing without a bobble: it holds the in-run
 * straighter than the Hare, lands what the Hare folds on, and still spins
 * as a park ski does. */
export const RAVEN: SkisSpec = {
  ...SKIS,
  id: "raven",
  name: "Raven",
  kind: "Big air",
  blurb:
    "A stiff competition twin-tip: straight down the in-run, round three times, and down clean.",
  gearMass: 8.5,
  length: 1.8,
  waist: 0.088,
  tipWidth: 0.118,
  tailWidth: 0.114,
  sidecut: 20,
  flex: 0.6,
  rocker: 0.25,
  edgeMax: 1.02,
  mount: 0.49,
  legs: { rate: 7300, bump: 520, rebound: 860, travel: 0.52 },
  cdAUpright: 0.9,
  cdATuck: 0.52,
  topSpeed: 110,
};

/** THE IBEX — a MOGUL ski (named for the goat that bounds down broken rock
 * a step at a time): the class a moguls course is skied on (`docs/freestyle.md`
 * § *Moguls*, "The skis"). The rules set no length, width or sidecut; the
 * class the athletes ride is 161–179 cm (a man's 171–175), 92–100 mm at the
 * tip, 61–66 mm underfoot and 81–90 mm at the tail, on a STRAIGHT 17–26 m
 * sidecut that pivots rather than hooks, full camber, light, and SOFT IN
 * THE FOREBODY (a tip a quarter softer than the rest) so it folds over a
 * mogul's crest and finds the trough. 172 cm on a 63 mm waist, 95 mm tip and
 * 84 mm tail — 13 mm of side depth over its chord, a 22.5 m arc — mounted
 * where a race ski is, and the legs of a mogul skier: the deepest fold and
 * the quickest give of any pair, for a bump every third of a second. Its
 * answer is a mogul line taken at 35 km/h: it turns on a crest the others
 * have to be skidded off, and it is slow in a tuck, chatters at speed and
 * sinks in powder. */
export const IBEX: SkisSpec = {
  ...SKIS,
  id: "ibex",
  name: "Ibex",
  kind: "Moguls",
  blurb:
    "Short, narrow and straight, soft at the tip: pivots on a crest and folds into the trough.",
  gearMass: 8,
  length: 1.72,
  waist: 0.063,
  tipWidth: 0.095,
  tailWidth: 0.084,
  sidecut: 22.5,
  flex: 0.45,
  rocker: 0,
  edgeMax: 1.0,
  mount: 0.46,
  legs: { rate: 7000, bump: 380, rebound: 760, travel: 0.5 },
  cdAUpright: 0.88,
  cdATuck: 0.56,
  topSpeed: 106,
};

/** THE KESTREL — an AERIALS ski (named for the falcon that hangs on the
 * wind and drops): the class an aerials jump is skied on
 * (`docs/freestyle.md` § *Aerials*, "The skis"). The rules set no length,
 * width or sidecut; the class the athletes ride is SHORT — 150–160 cm, to
 * the shoulder — NARROW, some 65 mm underfoot, with LITTLE SIDECUT and a
 * long arc (no turn is skied on it: the in-run is straight), light
 * (carbon, for the swing of three flips) and stiff underfoot for the
 * kicker's load. 158 cm on a 65 mm waist, 85 mm tip and 79 mm tail — 8.5
 * mm of side depth over its chord, a 30 m arc — flat-tailed, mounted near
 * its middle, stiff (`flex` 0.75), and the legs of a skier set for a
 * landing from ten metres and more onto a 37° hill. It is the LIGHTEST
 * and SHORTEST pair — the least swing weight to turn in the air, its bar
 * on the card (`ski-stats.ts`'s `spinOf`). Its answer is the straight
 * line into a 71° kicker at 55 km/h and the twist about its own length in
 * the air; it is slow in a tuck, vague on an edge and sinks in powder. */
export const KESTREL: SkisSpec = {
  ...SKIS,
  id: "kestrel",
  name: "Kestrel",
  kind: "Aerials",
  blurb: "Short, narrow, light and straight: dead straight into the kicker, and round in the air.",
  gearMass: 6.5,
  length: 1.58,
  waist: 0.065,
  tipWidth: 0.085,
  tailWidth: 0.079,
  sidecut: 30,
  flex: 0.75,
  rocker: 0,
  edgeMax: 1.0,
  mount: 0.47,
  legs: { rate: 7400, bump: 560, rebound: 900, travel: 0.52 },
  cdAUpright: 0.88,
  cdATuck: 0.56,
  topSpeed: 106,
};

/** THE CATALOG, in the order the ski card turns through it — the order a
 * skier should pick them in, best all-round first and the one that asks
 * most of him last: the all-mountain ski that refuses nothing, the alpine
 * race skis from the shortest to the longest (slalom, giant slalom, super-G,
 * downhill), the ski-cross ski, the speed ski, the powder ski and the park
 * ski, the big-air ski, the mogul ski and the aerials ski. (`make sim ARGS="--skis
 * all"` is the measure.) */
export const SKI_CATALOG: readonly SkisSpec[] = [
  SKIS,
  SWIFT,
  CHOUGH,
  FALCON,
  EAGLE,
  WOLVERINE,
  PEREGRINE,
  MARMOT,
  HARE,
  RAVEN,
  IBEX,
  KESTREL,
];

/** The pair with this id, or the all-mountain ski for one this build does
 * not carry (a stored pick from another version, or a hand-typed link).
 * The skis alone: a board is `boards.ts`'s `pairById`. */
export function skisById(id: string): SkisSpec {
  return SKI_CATALOG.find((s) => s.id === id) ?? SKIS;
}

/** Whether `id` names a pair in the catalog. */
export function isSkiId(id: string): id is SkiId {
  return SKI_CATALOG.some((s) => s.id === id);
}

/** Skier and skis, kg. */
export function totalMass(spec: SkiSpec): number {
  return spec.skierMass + spec.gearMass;
}

/** The envelope the whole stands in, m: the skis' length, the stance plus
 * the boots and the elbows out, and the skier's standing height — what the
 * trunks and the hull contacts see, and what the inertia is built on. */
export function envelopeOf(spec: SkiSpec): { length: number; width: number; height: number } {
  return { length: spec.length, width: spec.stance + 0.5, height: spec.cogHeight * 1.8 };
}

/** The principal moments of inertia, kg·m², about the body's right (pitch),
 * up (yaw) and forward (roll) axes: a standing body over a pair of skis is
 * near a tall box of the envelope's height and the stance's width, with the
 * skis' length along the forward axis lightly weighted — the skis are a
 * tenth of the mass and all of the length. */
export function inertiaOf(spec: SkiSpec): { x: number; y: number; z: number } {
  const m = totalMass(spec);
  const e = envelopeOf(spec);
  // The body: a box e.width × e.height × 0.35 m deep; the skis: rods of
  // e.length along z, at the mass they weigh.
  const body = spec.skierMass;
  const gear = spec.gearMass;
  const D = 0.35;
  const H = e.height;
  const W = e.width;
  const L = e.length;
  return {
    x: (body * (H * H + D * D)) / 12 + (gear * L * L) / 12 + m * 0.02,
    y: (body * (W * W + D * D)) / 12 + (gear * L * L) / 12 + m * 0.02,
    z: (body * (W * W + H * H)) / 12 + m * 0.02,
  };
}
