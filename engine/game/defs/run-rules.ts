// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RULES A RUN IS PLAYED BY (`RunRules`) and the weather a race's jury
// runs in (`Jury`) — the shape every mode's bundle in `modes.ts` fills.
// Stated apart so that file stays under its line cap; `modes.ts`
// re-exports both.

import type { TechniqueId } from "./technique.ts";

export type RunRules = {
  /** How many OTHER skiers start beside the player (`rivals.ts`). */
  rivals: number;
  /** Runs to the finish — one: the piste is skied top to bottom. */
  laps: number;
  /** Seconds the lights hold the field before the clock starts; 0 is no
   * lights at all, and the run is racing from its first step. */
  countdown: number;
  /** Whether one skier can lean on another (`rivals.ts`'s `clipRiders`). */
  contact: boolean;
  /** WHETHER THE COURSE COUNTS: the gates and the finish (`course.ts`).
   * Off on a FREE RIDE, where the piste is only a groomed way down the
   * mountain, nothing is owed and a reset stands the skier on the nearest
   * point of it rather than at a gate. */
  course: boolean;
  /** WHETHER THE TRICKS COUNT: the strokes and the trick button are read
   * (`strokes.ts`) and the combo is the run's to work for. The score is
   * kept on every run (`tricks.ts`), but only a run with this on can turn
   * anything. */
  tricks: boolean;
  /** WHETHER THE SKIER MAY TRICK THE MOUNTAIN: the strokes thrown in the
   * air (`strokes.ts` — a tap on the edge half a turn about his up axis, a
   * tap on the lean a whole one nose over tail) and riding SWITCH, the
   * skis backward down the hill (`skier.ts`, `flight.ts`, `crash.ts`). On
   * the FREE RIDE and on TRICKS; never on a race, whose skier goes down the
   * hill facing it. */
  stunts: boolean;
  /** THE BUZZER, s of run clock: the run ends there, whatever it was doing;
   * 0 is no buzzer at all. */
  limit: number;
  /** THE PULL ON A SKIER IN FLIGHT, as a multiple of `TUNING.g`: the arcade's
   * heavier air (`TUNING.air.gravity`) on a race, and the real g on a tricks
   * run and a free ride, whose strokes and combos are timed to a real hang
   * (`limits.ts`'s `flightGravity`). */
  airGravity: number;
  /** THE CROWD: how many amateurs are out on the ski area (`crowd.ts`) —
   * the free ride's resort full of people; 0 on every measured run, which
   * has the snow to itself. */
  crowd: number;
  /** WHETHER THE LIFTS TAKE HIM UP (`lift-ride.ts`): a skier who rides into
   * a lift's load zone is carried to its top. On a FREE RIDE only — a race
   * is one run down, and a lift ridden would be a run off the course. */
  lifts: boolean;
  /** WHETHER A HELICOPTER WAITS ON ITS PAD (`heli.ts`): ridden into, it is
   * the player's to fly anywhere on the mountain and push off. On a FREE
   * RIDE only. */
  heli: boolean;
  /** WHETHER A SNOWMOBILE WAITS AT THE BOTTOM (`sled.ts`): ridden into, it
   * is the player's to ride anywhere on the mountain and hop off. On a FREE
   * RIDE only. */
  sled: boolean;
  /** WHETHER THE AFTERSKI LODGES OPEN THEIR DOORS (`afterski.ts`): skied up
   * to and stopped at, the machine press takes him in for a beer. Left
   * out, they are shut. */
  afterski?: boolean;
  /** WHETHER THE PISTE MACHINES WORK THE RUNS AT NIGHT (`groomer.ts`):
   * driven into, one is the player's to drive. On a FREE RIDE only. */
  groomer: boolean;
  /** WHETHER THE VILLAGE'S TRAFFIC MEETS HIM (`traffic.ts`): its cars, its
   * bus and its bicycles hold a skier off them and knock him down
   * (`traffic-contact.ts`), and are drawn. On a FREE RIDE only; left out,
   * the streets are empty. */
  traffic?: boolean;
  /** HOW THE FIELD STARTS: `"line"` — every skier on the start line at once,
   * the lights, GO; `"interval"` — ONE RACER ON THE COURSE AT A TIME, out of
   * the start hut: the field has skied it before the player, and its times
   * are what he races (`field.ts`). On an interval start the run clock
   * waits for the racer to open the wand. `"gate"` — A SKI CROSS'S START
   * GATE (R35): every racer behind a door of his own, the doors dropping
   * together at GO, each racer pulling himself out on the handles and
   * skating away; the clock runs from GO. */
  start: "line" | "interval" | "gate";
  /** THE FIELD DEALT, NOT SKIED (`field.ts`): the rivals are a BOARD of
   * times dealt about par, raced one at a time before the player — an
   * interval start's always, and a ski cross's qualification out of its
   * gate. Left out: a field on an interval start is dealt, any other is
   * skied. */
  dealt?: boolean;
  /** CONTACT THAT PUTS A RACER DOWN (R35's heats): a shoulder hard enough
   * throws the skier it lands on, and a racer who knocks down the one
   * ahead of him from behind is disqualified by the jury
   * (`cross-contact.ts`). Left out: skiers lean on each other and nobody
   * goes down for it. */
  knock?: boolean;
  /** THE GATES' LAW: `"arcade"` — a gate skied past is owed again (or, a
   * slalom gate of R28, charged on the clock) and the reset stands him
   * back on the course; `"strict"` — the international rules (R31): a gate
   * missed or straddled DISQUALIFIES, a racer stopped by a fall is out, and
   * he must be away within `window` seconds of GO. */
  gates: "arcade" | "strict";
  /** THE START WINDOW, s after GO: a racer not through the start gate by
   * then is disqualified; 0 is no window. */
  window: number;
  /** HOW THE SKIER WORKS THE SKI (`technique.ts`): the slalom racer's on
   * a slalom, the downhiller's on a downhill, the super-G racer's on a
   * super-G, the speed skier's on a speed track; left out, the free skier's —
   * the shared model as it is. */
  technique?: TechniqueId;
  /** THE JURY'S WEATHER (`jury.ts`): the most wind and the heaviest fall
   * the race is run in. A race's jury holds, lowers or calls off a start
   * the weather makes unsafe or unfair, so a race is only ever run on a
   * day inside its discipline's `JURY` row; left out, the run is skied in
   * whatever the sky deals. */
  jury?: Jury;
  /** THE MOST A FLIGHT'S STROKES MAY OWE on each axis, rad (`strokes.ts`):
   * a contest's ceilings over the arcade's (`TUNING.tricks.spinMost` and
   * `.flipMost`, a 720 and a double) — big air's 2160 and quad. Left out,
   * the arcade's. */
  spinMost?: number;
  flipMost?: number;
  /** THE IN-RUN RIDDEN TUCKED (`in-run.ts`): on a big air jump, from the
   * start gate to the lip, the skier holds his tuck, never brakes and
   * never sits back, whatever is pressed — the jump is built for the speed
   * a tucked skier carries off it, and a contest skier drops in straight,
   * tucked and centred. The edge and the jump are his own, and in the air
   * every control is. Left out, the controls are. */
  inRun?: boolean;
  /** THE AERIALS FLIGHT (`aerial-flight.ts`): in the air off an aerials
   * kicker (R41) the lean's taps are FLIPS turned about the take-off's
   * side axis, the edge's taps TWISTS turned about the body's long axis
   * inside the flip under way, and the trick button held the TUCK —
   * flown as a twisting somersault is, the flips paced to the air and the
   * twists to their flip; the strokes and the grabs are not read. Left
   * out, the air is the strokes' (`strokes.ts`). */
  aerials?: boolean;
  /** THE HOCKEY STOP (`hockey-stop.ts`): a freestyle run over — the jump
   * landed, the course run, the buzzer gone — is ridden out by throwing
   * the skis across the fall line on the brake and standing there, rather
   * than coasting on down the run-out. Left out, a finished run coasts. */
  hockeyStop?: boolean;
};

/** WHAT A RACE'S JURY RUNS IN — the weather a discipline is raced under,
 * stated at the course's START, where the jury's anemometer stands. */
export type Jury = {
  /** The strongest GUST, m/s at the standard 10 m over the start, the race
   * is run in: a mean wind whose gusts would pass it is a race held for a
   * calmer hour, and the race is skied in that calmer wind. */
  wind: number;
  /** The heaviest fall it is run in (`Weather.snowfall`, 0..1): past it the
   * course is unfit to race on — a speed race is not run in a blizzard. */
  fall: number;
};
