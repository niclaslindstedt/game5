// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCORE — what a skier is paid for the parts of a run the clock does not
// measure. Time is the race; this is the other game on the same snow, and it
// is the arcade one: points TICK while a flight is up, every element won
// raises a MULTIPLIER over the whole run of them, and nothing is yours until
// you are back on the snow with the skis under you. Get thrown and the lot
// goes.
//
// WHAT IS SCORED is what a skier can reach off a kicker: the time he
// spends in the air AND the ground that flight covered — the two halves of
// one jump, paid on one curve and weighing the same — the revolutions it
// turns nose over tail (THE PUMP throws one, `strokes.ts`), the revolutions
// it turns about its own up axis (THE TWIRL), the TWIST of having both come
// round in one flight, the skier's GRABS, and the flight itself as an
// element beside any of them.
//
// THE RULES, and the reason each is the shape it is:
//
// 1. AIR TIME PAYS BY THE SECOND, AT A RATE THAT RISES WITH THE FLIGHT
//    (`airPointsPerSecond`, logarithmic in how long he has been up),
//    so a flight's purse grows faster than the flight does: a hop is worth
//    almost nothing, a second is a jump, and three seconds off the big lip
//    is worth several of the small one's.
//
// 1b. ...AND SO DOES THE GROUND IT COVERED, BY THE METRE, ON THE SAME
//    CURVE (`lengthPointsPerMetre`), tied to the air at one reference speed
//    (`tricks.lengthKnee`) so a flight at that speed earns as much by the
//    metre as by the second. A skier popped straight up is all seconds; one
//    driven flat off a lip at speed is the other way about. It buys no
//    element of its own: the flight is already named by rule 3.
//
// 2. A REVOLUTION RAISES THE MULTIPLIER, AND THE NEXT ONE RAISES IT MORE.
//    The Nth revolution of a flight on one axis is N times the base and N
//    steps of multiplier, so a double is ×4 and not ×3. The two axes are
//    counted apart, so a flip with a 360 in it is two FIRST revolutions.
//
// 3. ...AND SO DOES THE AIR THEY WERE TURNED IN, ONCE SOMETHING WAS TURNED
//    IN IT. A flight past `airElement` is worth one step, credited only
//    beside a trick and once per combo: credited alone every jump would read
//    ×2, and a multiplier that always says ×2 says nothing. It adds no base
//    — the seconds are already paid.
//
// 2b. HALF A TURN LANDED IS AN ELEMENT TOO: a flight that comes down with
//    half a revolution about the up axis over its whole ones — the skis
//    backward, ridden away switch (`strokes.ts`'s twirl, once) — wins the
//    180, half a 360's base and one step, judged at the touchdown, since a
//    360 passes through it on the way round.
//
// 4. BOTH AXES IN ONE FLIGHT ARE A THIRD THING: THE TWIST, won as the second
//    comes round and once a flight. What it prices is the combination.
//
// 5. A POSE HELD `poseHold` s IN THE AIR IS AN ELEMENT — each of the three
//    once a flight, a little under a revolution because the skier never turns
//    over for it. AND IT HAS TO BE LET GO BEFORE THE SNOW COMES BACK: a
//    landing taken still in a grab is a skier coming down with a hand off
//    the boards, and it loses the combo.
//
// 6. NOTHING IS BANKED UNTIL THE COMBO CLOSES. The base and the multiplier
//    ride together while he is up and for `linkWindow` seconds after
//    it lands, so one landing straight into the next kicker is ONE combo.
//    The window running out banks `base × mult` into the score. THE LANDING
//    IS JUDGED by the suspension (`land`'s `harsh`): one it took whole
//    leaves the window open; one that bottomed it — SKETCHY — banks the
//    combo there and then at its base alone, the multiplier forfeit. Thrown
//    off (`wipeout`, which is also what a nose-in landing is), or put back
//    on the track (`reset`), banks nothing at all.
//
// 7. A CLEAN LANDING IS AN ELEMENT OF ITS OWN, judged off how hard the skier
//    met the snow as a share of what its suspension takes before it
//    bottoms (`landingGrade`) — the same measure that makes a landing
//    sketchy past the whole of it, and that bends the suspension where
//    damage is on. A flight of `airElement` or more met at `cleanLanding`
//    of it or less is CLEAN, at `perfectLanding` or less PERFECT, and adds
//    `landPoints` to the base the softer it came down; beside a trick
//    turned in the same flight it is a step of multiplier, two for a
//    perfect one — a flip put down on the landing slope is worth more than
//    one slammed onto the flat. A landing well sideways is neither.
//
// The engine only ever says what happened: `trick`, `combo` and `bail`
// events carry the beat a presentation pulses on, and `TrickState` carries
// the numbers and the element list it reads. No word for any of it is here
// — the names live in `pwa/src/game/strings.ts`. Nothing here draws, and
// nothing here is random: a run replays to the same score.

import { TUNING } from "./defs/tuning.ts";
import { harshShare } from "./damage.ts";
import { harshSpeedOf } from "./limits.ts";
import type {
  BailCause,
  GameEvent,
  GameState,
  SkierState,
  TrickKind,
  TrickState,
} from "./state.ts";
import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";

const T = TUNING.tricks;
const TAU = Math.PI * 2;

/** What a second of air is worth `seconds` into a flight, points/s:
 * `airRate` a second one knee in, rising as `log2(1 + t/knee)`. */
export function airPointsPerSecond(seconds: number): number {
  return T.airRate * Math.log2(1 + Math.max(0, seconds) / T.airKnee);
}

/** ...and what a METRE of that flight is worth `metres` into it, points/m —
 * the same curve on the jump's other axis (rule 1b). The rate is not a dial
 * of its own: `airRate · airKnee / lengthKnee` is the one arithmetic that
 * makes the two halves weigh the same. With `d = v·t` at the reference speed
 * `v = lengthKnee / airKnee`, `∫ rate · log2(1 + d/lengthKnee) dd` is
 * `airRate · ∫ log2(1 + t/airKnee) dt` — the air's own purse, to the point.
 * Stating it here rather than beside `airRate` keeps one copy of the tie. */
export function lengthPointsPerMetre(metres: number): number {
  const rate = (T.airRate * T.airKnee) / T.lengthKnee;
  return rate * Math.log2(1 + Math.max(0, metres) / T.lengthKnee);
}

export function freshTricks(): TrickState {
  return {
    score: 0,
    base: 0,
    mult: 1,
    link: 0,
    rotation: 0,
    spins: 0,
    yaw: 0,
    turns: 0,
    fromX: 0,
    fromZ: 0,
    paidLength: 0,
    aired: false,
    airPaid: false,
    twisted: false,
    pose: null,
    poseTime: 0,
    posed: [],
    flipCrossed: 0,
    spinCrossed: 0,
    flipGoal: 0,
    spinGoal: 0,
    flipDone: 0,
    spinDone: 0,
    flipHeld: false,
    spinHeld: false,
    inAir: false,
    parts: [],
    flight: 0,
    last: 0,
    lastAt: 0,
    lastBailed: false,
    lastParts: [],
  };
}

/** AN ELEMENT WON: the air's own rung first (rule 3, and first so the line
 * reads in the order the skier earned it), then the element's base and its
 * steps, then the beat. `spins` is which revolution of this flight it was
 * — the whole of the ladder. */
function win(
  state: GameState,
  events: GameEvent[],
  kind: TrickKind,
  spins: number,
  points: number,
): void {
  const k = state.tricks;
  if (k.aired && !k.airPaid) {
    k.airPaid = true;
    k.mult += 1;
    k.parts.push({ kind: "air", spins: 1, flight: k.flight });
    events.push({ kind: "trick", t: state.t, trick: "air", spins: 1, points: 0, mult: k.mult });
  }
  k.base += points;
  k.mult += spins;
  k.link = T.linkWindow;
  k.parts.push({ kind, spins, flight: k.flight });
  events.push({ kind: "trick", t: state.t, trick: kind, spins, points, mult: k.mult });
}

/** Everything that belongs to ONE flight, cleared as the snow comes back. */
function endFlight(k: TrickState): void {
  k.inAir = false;
  k.rotation = 0;
  k.spins = 0;
  k.yaw = 0;
  k.turns = 0;
  k.paidLength = 0;
  k.aired = false;
  k.twisted = false;
  k.pose = null;
  k.poseTime = 0;
  k.posed = [];
}

/** Everything that belongs to the COMBO, cleared as it closes either way. */
function endCombo(k: TrickState): void {
  k.parts = [];
  k.flight = 0;
  k.base = 0;
  k.mult = 1;
  k.link = 0;
  k.airPaid = false;
}

/** Close the combo and pay it into the run's score — at its base alone on a
 * sketchy landing (rule 6). */
function bank(state: GameState, events: GameEvent[], sketchy: boolean): void {
  const k = state.tricks;
  const mult = sketchy ? 1 : k.mult;
  const points = Math.round(k.base * mult);
  events.push({ kind: "combo", t: state.t, points, base: Math.round(k.base), mult, sketchy });
  k.score += points;
  k.last = points;
  k.lastAt = state.t;
  k.lastBailed = false;
  k.lastParts = k.parts;
  endCombo(k);
}

/** Drop the combo on the floor. The run's banked score is untouched. */
function bail(state: GameState, events: GameEvent[], cause: BailCause): void {
  const k = state.tricks;
  const lost = Math.round(k.base * k.mult);
  if (lost > 0) {
    events.push({ kind: "bail", t: state.t, lost, cause });
    k.last = lost;
    k.lastAt = state.t;
    k.lastBailed = true;
    k.lastParts = k.parts;
  }
  endCombo(k);
  endFlight(k);
}

/** THE FLIGHT'S TURNS, counted as it leaves the air. Called every airborne
 * step with `slack` 0; at the touchdown with `landSlack`, so a revolution
 * the landing finished is the skier's (rule 2). */
function countTurns(state: GameState, events: GameEvent[], slack: number): void {
  const k = state.tricks;
  while (Math.abs(k.rotation) + slack >= (k.spins + 1) * TAU) {
    k.spins += 1;
    const kind = k.rotation > 0 ? "backflip" : "frontflip";
    win(state, events, kind, k.spins, T.flipPoints * k.spins);
  }
  while (Math.abs(k.yaw) + slack >= (k.turns + 1) * TAU) {
    k.turns += 1;
    win(state, events, "spin", k.turns, T.spinPoints * k.turns);
  }
  if (!k.twisted && k.spins > 0 && k.turns > 0) {
    k.twisted = true;
    win(state, events, "twist", 1, T.twistPoints);
  }
}

/** The turns a clean touchdown finished — and the half turn over them a
 * skier who came down backward has turned (rule 2b). */
function turnsLanded(state: GameState, events: GameEvent[]): void {
  countTurns(state, events, T.landSlack);
  const k = state.tricks;
  if (Math.abs(k.yaw) - k.turns * TAU + T.landSlack >= Math.PI) {
    win(state, events, "half", 1, T.spinPoints / 2);
  }
}

/** HOW HARD A LANDING WAS, as the share of what the legs of the skier who
 * took it could have taken (`harshSpeedOf`, less what damage has cost them
 * — `skier.ts` calls a landing harsh past 1 by the same arithmetic): 0 is a
 * touchdown with nothing into the slope, 1 the one that folds them to the
 * stop. */
export function landingGrade(c: SkierState, impact: number): number {
  return impact / (harshSpeedOf(c.spec) * harshShare(c));
}

/** How far the skier is turned from the way he is going over the snow,
 * rad, 0 … π — from the nearer end of his skis where he may ride switch
 * (`switchOk`), so a 180 ridden away backward is a landing along his line. */
function slipOf(c: SkierState, switchOk: boolean): number {
  const v = hypot(c.vx, c.vz);
  if (v < 1) return 0;
  const along = (c.vx * Math.sin(c.heading) + c.vz * Math.cos(c.heading)) / v;
  return Math.acos(Math.max(-1, Math.min(1, switchOk ? Math.abs(along) : along)));
}

/** A LANDING TAKEN WHOLE, judged (rule 7): a clean or a perfect one is an
 * element, `spins` 1 or 2 — the tier, which is how the words tell them
 * apart. */
function landed(state: GameState, events: GameEvent[], impact: number, tricked: boolean): void {
  const k = state.tricks;
  const c = state.skier;
  const grade = landingGrade(c, impact);
  if (grade > T.cleanLanding || slipOf(c, state.rules.stunts) > T.landSlip) return;
  const tier = grade <= T.perfectLanding ? 2 : 1;
  const points = T.landPoints * (1 - grade / T.cleanLanding);
  k.base += points;
  if (tricked) k.mult += tier;
  k.link = T.linkWindow;
  k.parts.push({ kind: "landing", spins: tier, flight: k.flight });
  events.push({ kind: "trick", t: state.t, trick: "landing", spins: tier, points, mult: k.mult });
}

/** One fixed step of the score, run on the PLAYER's run after it has been
 * stepped and has left this step's `land`, `wipeout`, `reset` and `finish`
 * on the events: the skier says what he did, and this decides what it was
 * worth. */
export function stepTricks(state: GameState, events: GameEvent[]): void {
  const k = state.tricks;
  const c = state.skier;
  const dt = TUNING.dt;
  let finished = false;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "wipeout" || e.kind === "reset") {
      bail(state, events, e.kind);
      return;
    }
    if (e.kind === "air") k.flight += 1;
    if (e.kind === "finish") finished = true;
  }
  if (c.thrown !== null) return;
  if (!finished && (state.phase !== "racing" || state.progress.finished)) return;

  if (c.airborne) {
    if (!k.inAir) {
      // Where the flight left the snow, walked back from where the skier is
      // now — a placed flight is already some way into its air.
      k.inAir = true;
      k.fromX = c.x - c.vx * c.airTime;
      k.fromZ = c.z - c.vz * c.airTime;
    }
    // HOW FAR THE SKIER HAS TURNED, rad, on each axis he can turn about:
    // tips up positive for the flip (−wx), and about the up axis for
    // the 360. The BODY rates are those axes at any attitude, so summing them
    // aloft is the rotation itself rather than a reading off the Euler
    // angles, which wrap.
    k.rotation -= c.wx * dt;
    k.yaw += c.wy * dt;
    countTurns(state, events, 0);
    if (k.pose !== null && k.poseTime >= T.poseHold && !k.posed.includes(k.pose)) {
      k.posed.push(k.pose);
      win(state, events, k.pose, 1, T.posePoints);
    }
    if (c.airTime > T.airElement) k.aired = true;
    const length = hypot(c.x - k.fromX, c.z - k.fromZ);
    if (c.airTime > TUNING.air.counts) {
      k.base += airPointsPerSecond(c.airTime) * dt;
      k.base += lengthPointsPerMetre(length) * Math.max(0, length - k.paidLength);
      // The flight holds the combo open; the window is what he has AFTER.
      k.link = T.linkWindow;
    }
    k.paidLength = Math.max(k.paidLength, length);
  } else if (k.inAir) {
    // BACK ON THE SNOW — judged off the landing the skier reported, when the
    // flight was long enough to report one.
    let land: Extract<GameEvent, { kind: "land" }> | null = null;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.kind === "land") land = e;
    }
    const posing = k.pose !== null;
    if (land) turnsLanded(state, events);
    const tricked = k.parts.some((p) => p.flight === k.flight && p.kind !== "air");
    endFlight(k);
    if (land && posing) {
      bail(state, events, "pose");
      return;
    }
    if (land?.harsh && k.base > 0) bank(state, events, true);
    else if (land && land.airTime >= T.airElement) landed(state, events, land.impact, tricked);
  } else if (k.base > 0) {
    k.link -= dt;
    if (k.link <= 0) bank(state, events, false);
  }
  // THE BUZZER, or the flag: whatever is in hand is paid, as the window
  // would have paid it — a flip landed on the last second is a flip.
  if (finished && k.base > 0) bank(state, events, false);
}
