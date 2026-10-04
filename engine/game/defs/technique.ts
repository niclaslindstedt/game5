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
   * `steer.edgeRate` (on top of the pair's own `Footprint.edgeRate`). */
  edgeRate: number;
  /** THE MOST EDGE HE STANDS THE SKI ON, rad — a floor under the pair's
   * own `edgeMax` (0: the pair's). */
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
  /** THE MOST HIS WHOLE BODY INCLINES INTO A CARVE on the groomer, rad — a
   * floor under `skier.rollPacked` (0: that cap). */
  incline: number;
};

/** THE FREE SKIER — every number the identity: the shared model as it is.
 * Every mode but the slalom skis with it. */
export const FREE: Technique = {
  id: "free",
  edgeRate: 1,
  edgeMax: 0,
  fade: 1,
  platform: 0,
  incline: 0,
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
 * slow), the whole shelf stood on, and the body let in to 46° — further,
 * and a full edge thrown from one side to the other every 0.9 s on the 20°
 * strip rolled him in past what he could hold at every change of edge
 * (`make ride SCENARIO=slalom-rhythm`). */
export const SLALOM_TECHNIQUE: Technique = {
  id: "slalom",
  edgeRate: 1.6,
  edgeMax: 1.22,
  fade: 4,
  platform: 1,
  incline: 0.8,
};

/** THE GIANT SLALOM RACER — data, no mode yet. A turn every ~1.45 s on a
 * preferred radius of ~20 m (13 m at the tightest, est.), 65–72° of edge
 * at the peak (est.) rolled at ~90°/s (est.), a skid of 8° at most, 61–70
 * km/h on the mean and 80 at the peak, 3.2 body weights. So: the edge
 * rolled 0.6 of the slalom's rate (0.96 of the shared), stood at up to 69°,
 * held to 70–80 km/h (the fade two and a half times as slow), the whole
 * shelf, the body let in to 46°. */
export const GIANT_SLALOM_TECHNIQUE: Technique = {
  id: "giantSlalom",
  edgeRate: 0.96,
  edgeMax: 1.2,
  fade: 2.5,
  platform: 1,
  incline: 0.8,
};

/** THE SUPER-G RACER — data, no mode yet. A turn every 2.0–2.3 s on a
 * preferred radius of ~45 m (35 at the tightest), 55–65° of edge at the
 * peak (est.) rolled at ~55°/s (est.), a skid of 5° at most, a tuck on a
 * sixth of the course, 80–87 km/h on the mean and 100–110 at the peak,
 * 2.4–2.8 body weights. So: the edge rolled 0.37 of the slalom's rate,
 * the pair's own most edge (a super-G or downhill pair's 60–66° is the
 * band), held a little longer (the fade one and a half times as slow),
 * most of the shelf, the body inclined no further than the shared cap. */
export const SUPER_G_TECHNIQUE: Technique = {
  id: "superG",
  edgeRate: 0.6,
  edgeMax: 0,
  fade: 1.5,
  platform: 0.8,
  incline: 0,
};

/** THE DOWNHILL RACER — data, no mode yet. A turn every 2.4–2.6 s on a
 * preferred radius of ~52 m, 45–60° of edge at the peak (est.) rolled at
 * ~45°/s (est.), a skid of 5° at most, a tuck on 37 % of the course (a
 * drag area of 0.17–0.24 m² in it against 0.63–0.66 stood up), 86–95
 * km/h on the mean and 120–150 at the peak, 2–2.5 body weights. So: the
 * edge rolled 0.3 of the slalom's rate, the pair's own most edge, the
 * shared fade (a downhiller stands his skis flatter the faster he goes),
 * half the shelf, the shared cap on his inclination. */
export const DOWNHILL_TECHNIQUE: Technique = {
  id: "downhill",
  edgeRate: 0.48,
  edgeMax: 0,
  fade: 1,
  platform: 0.5,
  incline: 0,
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
