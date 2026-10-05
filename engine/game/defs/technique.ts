// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TECHNIQUE A SKIER SKIS WITH — how he works the ski, as distinct from
// the ski's own numbers (`skis.ts`). A slalom racer and a free skier on the
// same pair are two different skiers: the racer rolls from edge to edge
// in a fraction of a second, stands the ski at 65–70° and angulates onto
// the shelf it cuts, and holds that edge at a slalom's pace; the free
// skier stands it at 30–50°, flattens it as he goes faster and slides on
// the edge's bite. Which technique a run is skied with is its mode's
// (`RunRules.technique`, dealt by `MODE_RULES`), or one asked for by name
// (`CreateGameOptions.technique` — a lab skiing one course with every row);
// a run that names none is skied with `FREE`, whose every number is the
// identity on the shared model — so a mode that has no technique of its own
// skis exactly as the physics does without this table, to the last bit.
//
// Every row is multipliers and floors on the shared model in `TUNING`,
// never a branch on a mode: the physics reads the row it is handed. The
// numbers are the measured ones of each discipline at the top level
// (`docs/disciplines.md`), turned into the model's terms; *(est.)* marks
// an estimate. The giant slalom, super-G and downhill rows are DATA until
// their disciplines are built: no mode deals them yet.

/** The techniques the engine knows. */
export type TechniqueId = "free" | "slalom" | "giantSlalom" | "superG" | "downhill";

export type Technique = {
  id: TechniqueId;
  /** HOW FAST HE ROLLS FROM EDGE TO EDGE, as a multiple of
   * `steer.edgeRate` (on top of the pair's own `Footprint.edgeRate`) — and,
   * past 1, how much stiffer and further he holds the roll he lays himself
   * over with, his edge being his inclination and his angulation
   * (`skier.ts`). */
  edgeRate: number;
  /** THE MOST EDGE HE STANDS THE SKI ON, rad — his discipline's, in place
   * of the pair's own `edgeMax` (0: the pair's). */
  edgeMax: number;
  /** HOW LONG HE HOLDS HIS EDGE AS HE GOES FASTER: a multiple of
   * `steer.fadeSpeed`, the speed by which the edge's lock has eased to two
   * thirds (`limits.ts`'s `edgeLockAt`). */
  fade: number;
  /** HOW FAR HE STANDS ON THE SHELF an edge past `grip.platform.from` cuts
   * (`snow.ts`'s `platformOf`), 0..1: the racer's angulation, his hips
   * held inside and his weight square on the base; 0 — the edge's bite
   * alone. */
  platform: number;
  /** THE MOST HIS WHOLE BODY INCLINES INTO A CARVE on the groomer, rad —
   * how far he lays himself over to the turn's balance (`skier.ts`), a
   * floor under `skier.inclineMost` (0: that cap). */
  incline: number;
  /** THE EDGE CHANGE — how he gets from one turn's edge onto the next's
   * (`incline.ts`). A CROSS-OVER takes the whole body over the skis into
   * the next turn as the old one lets him go, the edge never further over
   * than the body is laid plus his angulation: the shared model. A
   * CROSS-UNDER (a retraction) flexes both legs and tips the skis from
   * edge to edge UNDER a body that stays quiet: the new edge bites while
   * the body is still coming over, far sooner than a body rolled over the
   * skis would let it. */
  cross: Crossing;
};

/** How a technique changes its edge (`Technique.cross`); every number a
 * floor or a multiple on the shared model, its identity the free skier's. */
export type Crossing = {
  /** THE EDGE THE LEGS ALONE STAND THE SKIS ON, rad, whatever the body
   * above them is doing — the skis tipped onto the new edge under a body
   * still level, or still laid toward the old turn; past it an edge needs
   * the body laid over to its side (`skier.angulateMost` past the
   * inclination, `incline.ts`'s `edgeReach`). 0: none of its own, the
   * cross-over's skis rolled over with the body. */
  under: number;
  /** THE RETRACTION, m: how far both legs are pulled up together as the
   * skis swing under him — the skis' own points hung that much higher on
   * him (as the tuck folds them), so a body swung upright on legs still
   * bent by the old turn's load neither digs his skis' tips in nor is
   * sprung off the snow by the load let go. 0: none, the cross-over's
   * legs stretched as he rises over his skis. */
  retract: number;
  /** THE PITCH, rad, past which he gives the cross-under up for a
   * cross-over (`incline.ts`'s `crossUnderOf`, over the next 0.1 rad): a
   * giant slalom racer's legs tip the skis under a still trunk on the flat
   * and his whole body crosses over them on a steep complete turn. 0: he
   * crosses under on any pitch. */
  steep: number;
};

/** The shared model's edge change: a cross-over, every number its own. */
const CROSS_OVER: Crossing = { under: 0, retract: 0, steep: 0 };

/** THE FREE SKIER — every number the identity: the shared model as it is.
 * Every mode but the slalom skis with it. */
export const FREE: Technique = {
  id: "free",
  edgeRate: 1,
  edgeMax: 0,
  fade: 1,
  platform: 0,
  incline: 0,
  cross: CROSS_OVER,
};

/** THE SLALOM RACER (R31). A turn every 0.8–1.0 s on a preferred radius of
 * some 5 m, the edge ~5° at the transition and 66–71° at and after the
 * gate (rolled at some 150°/s), a skid of 12–15° at most early in the turn
 * and under 4° by the gate, the body inclined 45–55° with 10–20° of
 * angulation at the hip, 4–5 body weights at the peak, 40–60 km/h. So: the
 * edge rolled 1.6 times the shared rate (some 6.5 rad/s on the slalom pair
 * — the model's own rate is an arcade's, quicker than the measured one on
 * every row, and the slalom keeps its lead over the others), stood at up
 * to 70°, held there to a slalom's pace (the lock's fade four times as
 * slow), the whole shelf stood on, and the body let in as far as 63° —
 * a slalom apex's 2.5–3 g balanced (tan θ = a_lat / g) is 68–72°, the
 * last of it the hips' angulation. He CROSSES UNDER, the legs retracting
 * and extending as one: the skis stood on up to 57° of the new edge before
 * his body has come over (a turn every 0.9 s made where crossing over
 * missed every other one) and drawn up 11 cm as they swing under him
 * (est.), on any pitch. */
export const SLALOM_TECHNIQUE: Technique = {
  id: "slalom",
  edgeRate: 1.6,
  edgeMax: 1.22,
  fade: 4,
  platform: 1,
  incline: 1.1,
  cross: { under: 1.0, retract: 0.11, steep: 0 },
};

/** THE GIANT SLALOM RACER — data, no mode yet. A turn every ~1.45 s on a
 * preferred radius of ~20 m (13 m at the tightest, est.), 65–72° of edge
 * at the peak (est.) rolled at ~90°/s (est.), a skid of 8° at most, 61–70
 * km/h on the mean and 80 at the peak, 3.2 body weights. So: the edge
 * rolled 0.6 of the slalom's rate (0.96 of the shared), stood at up to 68°,
 * held to 70–80 km/h (the fade two and a half times as slow), the whole
 * shelf, the body let in to 59° (the apex's balance at 18 m/s on ~20 m,
 * est.); crossing under on the flatter ground — the trunk still, the legs
 * tipping the skis to 46° and drawn up half the slalom's — and over on a
 * steep complete turn, past 19° of pitch (est.). */
export const GIANT_SLALOM_TECHNIQUE: Technique = {
  id: "giantSlalom",
  edgeRate: 0.96,
  edgeMax: 1.19,
  fade: 2.5,
  platform: 1,
  incline: 1.03,
  cross: { under: 0.8, retract: 0.05, steep: 0.33 },
};

/** THE SUPER-G RACER — data, no mode yet. A turn every 2.0–2.3 s on a
 * preferred radius of ~45 m (35 at the tightest), 55–65° of edge at the
 * peak (est.) rolled at ~55°/s (est.), a skid of 5° at most, a tuck on a
 * sixth of the course, 80–87 km/h on the mean and 100–110 at the peak,
 * 2.4–2.8 body weights. So: the edge rolled 0.37 of the slalom's rate,
 * stood at up to 60°, held a little longer (the fade one and a half times
 * as slow), most of the shelf, the body let in to 52° (the apex's balance
 * at 24 m/s on ~45 m, est.), crossing over with little unweighting. */
export const SUPER_G_TECHNIQUE: Technique = {
  id: "superG",
  edgeRate: 0.6,
  edgeMax: 1.05,
  fade: 1.5,
  platform: 0.8,
  incline: 0.91,
  cross: CROSS_OVER,
};

/** THE DOWNHILL RACER — data, no mode yet. A turn every 2.4–2.6 s on a
 * preferred radius of ~52 m, 45–60° of edge at the peak (est.) rolled at
 * ~45°/s (est.), a skid of 5° at most, a tuck on 37 % of the course (a
 * drag area of 0.17–0.24 m² in it against 0.63–0.66 stood up), 86–95
 * km/h on the mean and 120–150 at the peak, 2–2.5 body weights. So: the
 * edge rolled 0.3 of the slalom's rate, stood at up to 55°, the shared
 * fade (a downhiller stands his skis flatter the faster he goes), half the
 * shelf, the body let in to 53° (the apex's balance at 26 m/s on ~52 m,
 * est.), crossing over with little unweighting. */
export const DOWNHILL_TECHNIQUE: Technique = {
  id: "downhill",
  edgeRate: 0.48,
  edgeMax: 0.96,
  fade: 1,
  platform: 0.5,
  incline: 0.92,
  cross: CROSS_OVER,
};

export const TECHNIQUES: Readonly<Record<TechniqueId, Technique>> = {
  free: FREE,
  slalom: SLALOM_TECHNIQUE,
  giantSlalom: GIANT_SLALOM_TECHNIQUE,
  superG: SUPER_G_TECHNIQUE,
  downhill: DOWNHILL_TECHNIQUE,
};

/** The technique a run is skied with: its rules' own, the free skier's when
 * they name none. */
export function techniqueOf(rules: { technique?: TechniqueId }): Technique {
  return TECHNIQUES[rules.technique ?? "free"];
}
