// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WANTED LEVEL's numbers (`wanted.ts`): how hard the army hunts the
// skier who stole a helicopter, star by star. Every number carries its unit.
//
// The shape is a wanted level's as open-world crime games settled it — five
// stars, each one sending more and heavier pursuers; the stars held SOLID
// while a pursuer has him in sight and FLASHING while they only search
// where he was last seen; and lost all at once once he has stayed out of
// every pursuer's sight long enough, longer the more stars he carries. The
// roster climbs the way a real military response is escalated: first a
// helicopter to find and shadow him, then a fire team, a squad, mechanised
// pursuit over the snow, and at the top several aircraft at once — and the
// rules of fire step up the force continuum the same way, from presence
// to warning shots to aimed fire.

/** What one star sends: the most of each the army has out at once. */
export type WantedRoster = {
  /** Army helicopters (a medium twin-engine utility helicopter). */
  helicopters: number;
  /** Door gunners, across all the helicopters out (two doors a machine). */
  gunners: number;
  /** Soldiers on skis, set down by the helicopters where he landed. */
  soldiers: number;
  /** Military snowmobiles, two up (a driver and a gunner behind him). */
  snowmobiles: number;
  /** Soldiers who ride the ski area's LIFTS up and ski down after him. */
  lifted: number;
  /** Army hot-air balloons drifting in on the wind, and the soldiers in
   * their baskets firing shoulder-launched rockets, across all of them. */
  balloons: number;
  rocketeers: number;
  /** Soldiers flying the game's paramotor in, rifles slung, alongside the
   * balloons. */
  paramotors: number;
  /** The rules of fire: `hold` (shadow him, no shots), `warn` (warning
   * fire, aimed off him) or `aim` (aimed fire). */
  fire: "hold" | "warn" | "aim";
};

/** One GROUND WAVE's vehicles and men, coming up the mountain from the
 * valley: military snowmobiles (two up), tracked over-snow carriers
 * (articulated, a section in the back), trucks (on the village's roads
 * as far as they go), tanks, and soldiers climbing on foot. */
export type WaveMix = {
  snowmobiles: number;
  tracked: number;
  trucks: number;
  tanks: number;
  foot: number;
};

/** A star's GROUND WAVES: the first `first` s after he reached the star,
 * then one every `every` s, each `base` plus `grow` for every wave before
 * it (rounded down), up to `cap` of a kind in a wave. */
export type GroundWaves = {
  first: number;
  every: number;
  base: WaveMix;
  grow: WaveMix;
  cap: WaveMix;
};

/** Who is hunting him: what a pursuer is, which sets how far he sees. */
export type PursuerKind =
  "helicopter" | "gunner" | "soldier" | "snowmobile" | "vehicle" | "balloon" | "paramotor";

export const WANTED = {
  /** The most stars there are. */
  maxStars: 5,
  /** THE ROSTER, by stars (index 0 is nobody). A utility helicopter seats
   * a section of up to about a dozen; a fire team is four, a squad two of
   * them; at three stars soldiers start riding the lifts up to ski down at
   * him; at four a second helicopter comes and an army balloon drifts in
   * with rocketeers in its basket and riflemen on paramotors beside it;
   * at five a third helicopter, a second balloon and more of both. */
  roster: [
    {
      helicopters: 0,
      gunners: 0,
      soldiers: 0,
      snowmobiles: 0,
      lifted: 0,
      balloons: 0,
      rocketeers: 0,
      paramotors: 0,
      fire: "hold",
    },
    {
      helicopters: 1,
      gunners: 1,
      soldiers: 0,
      snowmobiles: 0,
      lifted: 0,
      balloons: 0,
      rocketeers: 0,
      paramotors: 0,
      fire: "hold",
    },
    {
      helicopters: 1,
      gunners: 2,
      soldiers: 4,
      snowmobiles: 0,
      lifted: 0,
      balloons: 0,
      rocketeers: 0,
      paramotors: 0,
      fire: "warn",
    },
    {
      helicopters: 1,
      gunners: 2,
      soldiers: 8,
      snowmobiles: 1,
      lifted: 4,
      balloons: 0,
      rocketeers: 0,
      paramotors: 0,
      fire: "aim",
    },
    {
      helicopters: 2,
      gunners: 4,
      soldiers: 8,
      snowmobiles: 2,
      lifted: 8,
      balloons: 1,
      rocketeers: 2,
      paramotors: 2,
      fire: "aim",
    },
    {
      helicopters: 3,
      gunners: 6,
      soldiers: 12,
      snowmobiles: 3,
      lifted: 12,
      balloons: 2,
      rocketeers: 4,
      paramotors: 4,
      fire: "aim",
    },
  ] as readonly WantedRoster[],
  /** THE GROUND WAVES, by stars (index 0 and 1 send none — one
   * helicopter shadows him first). An over-snow carrier seats about a
   * section, a truck a squad or two, and the men climbing on foot come in
   * platoons that grow with every wave: the longer he lasts, the more of
   * the mountain is soldiers. Read by the later parts; data only here. */
  waves: [
    null,
    null,
    {
      first: 90,
      every: 75,
      base: { snowmobiles: 1, tracked: 0, trucks: 0, tanks: 0, foot: 4 },
      grow: { snowmobiles: 0.5, tracked: 0, trucks: 0, tanks: 0, foot: 2 },
      cap: { snowmobiles: 2, tracked: 0, trucks: 1, tanks: 0, foot: 12 },
    },
    {
      first: 60,
      every: 60,
      base: { snowmobiles: 2, tracked: 1, trucks: 1, tanks: 0, foot: 8 },
      grow: { snowmobiles: 0.5, tracked: 0.5, trucks: 0.5, tanks: 0, foot: 4 },
      cap: { snowmobiles: 4, tracked: 2, trucks: 2, tanks: 0, foot: 24 },
    },
    {
      first: 45,
      every: 50,
      base: { snowmobiles: 2, tracked: 2, trucks: 2, tanks: 0, foot: 16 },
      grow: { snowmobiles: 0.5, tracked: 0.5, trucks: 0.5, tanks: 0.25, foot: 6 },
      cap: { snowmobiles: 5, tracked: 4, trucks: 3, tanks: 1, foot: 40 },
    },
    {
      first: 30,
      every: 40,
      base: { snowmobiles: 3, tracked: 2, trucks: 2, tanks: 1, foot: 24 },
      grow: { snowmobiles: 0.5, tracked: 0.5, trucks: 0.5, tanks: 0.5, foot: 8 },
      cap: { snowmobiles: 6, tracked: 6, trucks: 4, tanks: 3, foot: 64 },
    },
  ] as readonly (GroundWaves | null)[],
  /** THE LONGER HE SURVIVES, THE WORSE IT GETS: seconds hunted IN SIGHT
   * to climb from each star to the next (index = the stars he has; the
   * last never climbs). Out of sight the clock runs at `searchClimb` of
   * that pace — evading is survival too, only slower to anger. */
  climb: [Infinity, 45, 60, 80, 100, Infinity] as readonly number[],
  searchClimb: 0.5,
  /** LOSING THEM: seconds out of every pursuer's sight before the stars
   * are dropped, by stars — the more he carries, the longer they search. */
  lose: [0, 12, 18, 25, 32, 40] as readonly number[],
  /** Where they search: the radius round where he was last seen, m, by
   * stars — the circle the pursuers comb (read by the later parts). */
  searchRadius: [0, 300, 450, 600, 800, 1000] as readonly number[],
  /** THE FIX an offence gives them: for this many seconds after one they
   * know where he is, pursuer in sight or not (the report of the theft). */
  fix: 10,
  /** HOW FAR EACH KIND OF PURSUER SEES a man on the snow, m, in clear
   * day: a helicopter's crew scanning from aloft, a door gunner from the
   * same seat, a soldier on foot or on skis, a snowmobile's crew low on
   * the snow, a ground vehicle's (a carrier's, a truck's, a tank's) from
   * its hatch, and a balloon's basket hanging high and still. */
  sight: {
    helicopter: 900,
    gunner: 900,
    soldier: 350,
    snowmobile: 400,
    vehicle: 500,
    balloon: 1200,
    paramotor: 900,
  } as Record<PursuerKind, number>,
  /** Nearer than this, m, he is heard and seen whatever is between. */
  close: 25,
  /** How often the pursuers look, s — a sight line is marched over the
   * ground at this cadence, not every step. */
  lookEvery: 0.25,
  /** THE SIGHT LINE over the terrain: sampled every `step` m, and blocked
   * where the ground rises within `clear` m of it. The line ends at his
   * chest, `chest` m over the point he stands on. */
  line: { step: 6, clear: 0.4, chest: 1.1 },
  /** THE ARREST: with SAFE FOR WORK on (`RunRules.sfw`, the INJURIES
   * switch off) the army does not kill — a soldier who reaches him within
   * `reach` m takes him in (`arrestSkier`), which ends the run. */
  arrest: { reach: 2 },
  /** WHAT AN OFFENCE IS WORTH: `add` stars of heat on top of what he has,
   * and `floor` the stars it raises him to at the least. */
  offences: {
    "stole-ambulance": { add: 1, floor: 2 },
    "stole-police": { add: 1, floor: 3 },
    "downed-helicopter": { add: 1, floor: 3 },
    "hit-soldier": { add: 0.5, floor: 1 },
    "stole-snowmobile": { add: 0.5, floor: 2 },
    dev: { add: 1, floor: 1 },
  } as Record<string, { add: number; floor: number }>,
} as const;

/** The causes `raiseHeat` is handed: each a row of `WANTED.offences`. */
export type WantedCause =
  | "stole-ambulance"
  | "stole-police"
  | "downed-helicopter"
  | "hit-soldier"
  | "stole-snowmobile"
  | "dev";
